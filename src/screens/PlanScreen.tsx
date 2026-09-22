import { useEffect, useState } from 'react'
import CoverImage from '../components/CoverImage'
import { useBooks } from '../hooks/useBooks'
import { db } from '../db/database'
import { CATALOG } from '../data/catalog'
import {
  SCHEDULE,
  buildApplyResult,
  entryKey,
  suggestDeadline,
  type ScheduleEntry,
} from '../data/schedule'
import { todayStr } from '../lib/progress'
import {
  addEntry,
  loadSchedule,
  removeEntry,
  saveSchedule,
  updateEntry,
} from '../data/scheduleStore'
import {
  listAvailability,
  saveAvailabilitySlot,
  deleteAvailabilitySlot,
  type AvailabilitySlot,
} from '../data/dayplanStore'

type Props = {
  onDone: () => void
}

export default function PlanScreen({ onDone }: Props) {
  const { books, saveBook } = useBooks()
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => loadSchedule())
  const [result, setResult] = useState<string | null>(null)
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [slotWeekday, setSlotWeekday] = useState('')
  const [slotStart, setSlotStart] = useState('')
  const [slotEnd, setSlotEnd] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [slotDateStart, setSlotDateStart] = useState('')
  const [slotDateEnd, setSlotDateEnd] = useState('')

  const refreshAvailability = async () => {
    setAvailability(await listAvailability())
  }

  useEffect(() => {
    void refreshAvailability()
  }, [])

  const addWeekdaySlot = async () => {
    if (slotWeekday === '' || !slotStart || !slotEnd) return
    const id = crypto.randomUUID()
    await saveAvailabilitySlot(
      { id, weekday: Number(slotWeekday), date: null, start: slotStart, end: slotEnd },
      true,
    )
    setSlotWeekday('')
    setSlotStart('')
    setSlotEnd('')
    await refreshAvailability()
  }

  const addDateSlot = async () => {
    if (!slotDate || !slotDateStart || !slotDateEnd) return
    const id = crypto.randomUUID()
    await saveAvailabilitySlot(
      { id, weekday: null, date: slotDate, start: slotDateStart, end: slotDateEnd },
      true,
    )
    setSlotDate('')
    setSlotDateStart('')
    setSlotDateEnd('')
    await refreshAvailability()
  }

  const removeSlot = async (id: string) => {
    await deleteAvailabilitySlot(id)
    await refreshAvailability()
  }

  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [selectedBookId, setSelectedBookId] = useState('')
  const [addStart, setAddStart] = useState(() => todayStr())

  const availableBooks = CATALOG.filter(
    (c) => !entries.some((e) => e.catalogId === c.id),
  )

  const registeredBooks = books.filter(
    (b) =>
      !entries.some(
        (e) =>
          entryKey(e) === b.id ||
          (e.catalogId !== undefined && e.catalogId === b.catalogId),
      ),
  )

  const apply = async () => {
    const registered = await db.books.orderBy('deadline').toArray()
    const { newBooks, updatedBooks } = buildApplyResult(registered, new Date(), entries)
    for (const book of newBooks) {
      await saveBook(book, true)
    }
    for (const book of updatedBooks) {
      await saveBook(book, false)
    }
    setResult(
      `登録しました。新規 ${newBooks.length} 冊 / 期限を更新 ${updatedBooks.length} 冊`,
    )
  }

  const save = () => {
    saveSchedule(entries)
    setResult('保存しました')
  }

  const reset = () => {
    if (!window.confirm('学習スケジュールを最新の内容に更新しますか？変更内容は置き換わります。')) return
    setEntries([...SCHEDULE])
    saveSchedule([...SCHEDULE])
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>学習スケジュールを登録</h1>
      <p style={{ color: 'var(--text-dim)' }}>
        参考書ごとの開始日と期限を確認・編集できます。カタログから追加して「保存」した後、「このスケジュールで登録する」で参考書を登録できます。
      </p>

      <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>カタログから追加</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <select
            data-testid="catalog-select"
            value={selectedCatalogId}
            onChange={(e) => {
              const id = e.target.value
              setSelectedCatalogId(id)
            }}
          >
            <option value="">カタログから選ぶ</option>
            {availableBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
          <label>
            開始
            <input
              data-testid="add-start"
              type="date"
              value={addStart}
              onChange={(e) => setAddStart(e.target.value)}
            />
          </label>
          <label>
            期限（目安90日）
            <input
              data-testid="add-deadline"
              type="date"
              value={suggestDeadline(addStart, 90)}
              readOnly
            />
          </label>
          <button
            data-testid="add-entry"
            type="button"
            disabled={!selectedCatalogId}
            onClick={() => {
              if (!selectedCatalogId) return
              setEntries((prev) =>
                addEntry(prev, {
                  catalogId: selectedCatalogId,
                  startDate: addStart,
                  deadline: suggestDeadline(addStart, 90),
                }),
              )
              setSelectedCatalogId('')
            }}
          >
            追加
          </button>
        </div>
      </section>

      <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>登録済みの参考書を追加</h2>
        <p data-testid="registered-books-section" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          検索で追加した参考書もスケジュールに組み込めます。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <select
            data-testid="registered-select"
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
          >
            <option value="">登録済みの参考書から選ぶ</option>
            {registeredBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
          <label>
            開始
            <input
              data-testid="registered-add-start"
              type="date"
              value={addStart}
              onChange={(e) => setAddStart(e.target.value)}
            />
          </label>
          <button
            data-testid="add-registered-entry"
            type="button"
            disabled={!selectedBookId}
            onClick={() => {
              if (!selectedBookId) return
              const book = books.find((b) => b.id === selectedBookId)
              if (!book) return
              setEntries((prev) =>
                addEntry(prev, {
                  bookId: selectedBookId,
                  startDate: addStart,
                  deadline: book.deadline,
                }),
              )
              setSelectedBookId('')
            }}
          >
            追加
          </button>
        </div>
      </section>

      {entries.map((entry) => {
        const key = entryKey(entry)
        const book = entry.bookId
          ? books.find((b) => b.id === entry.bookId)
          : CATALOG.find((c) => c.id === entry.catalogId)
        if (!book) return null
        const coverUrl =
          entry.bookId && 'coverUrl' in book ? book.coverUrl : 'coverSrc' in book ? book.coverSrc : undefined
        const displayTitle = 'title' in book ? book.title : key
        const subject = 'subject' in book ? book.subject : undefined
        const totalPages = 'totalPages' in book ? book.totalPages : 0
        return (
          <div
            key={key}
            data-testid={`entry-row-${key}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}
          >
            <CoverImage src={coverUrl ?? null} width={40} height={56} />
            <div style={{ flex: 1 }}>
              <div>{displayTitle}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                {subject ? `${subject} / ` : ''}{totalPages}ページ
                {entry.note ? ` / ${entry.note}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <label style={{ fontSize: 12 }}>
                  開始
                  <input
                    data-testid={`entry-start-${key}`}
                    type="date"
                    value={entry.startDate}
                    onChange={(e) =>
                      setEntries((prev) =>
                        updateEntry(prev, key, {
                          startDate: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  期限
                  <input
                    data-testid={`entry-deadline-${key}`}
                    type="date"
                    value={entry.deadline}
                    onChange={(e) =>
                      setEntries((prev) =>
                        updateEntry(prev, key, {
                          deadline: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>
            </div>
            <button
              data-testid={`entry-delete-${key}`}
              type="button"
              onClick={() => {
                if (!window.confirm(`「${displayTitle}」をスケジュールから削除しますか？`)) return
                setEntries((prev) => removeEntry(prev, key))
              }}
              style={{ flexShrink: 0 }}
            >
              削除
            </button>
          </div>
        )
      })}

      <section data-testid="availability-section" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>空き時間の設定</h2>
        <div data-testid="availability-list">
          {availability.map((slot) => (
            <div key={slot.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <span>
                {slot.date ?? `曜日 ${['日','月','火','水','木','金','土'][slot.weekday ?? 0]}`} {slot.start}〜{slot.end}
              </span>
              <button data-testid={`slot-delete-${slot.id}`} type="button" onClick={() => void removeSlot(slot.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
        <h3 style={{ fontSize: 14 }}>曜日ごと</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <select data-testid="slot-weekday-select" value={slotWeekday} onChange={(e) => setSlotWeekday(e.target.value)}>
            <option value="">曜日を選択</option>
            {['日','月','火','水','木','金','土'].map((w, i) => (
              <option key={i} value={i}>{w}</option>
            ))}
          </select>
          <input data-testid="slot-start" type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
          <input data-testid="slot-end" type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
          <button data-testid="slot-add" type="button" disabled={slotWeekday === ''} onClick={() => void addWeekdaySlot()}>
            追加
          </button>
        </div>
        <h3 style={{ fontSize: 14, marginTop: 12 }}>当日上書き</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input data-testid="slot-date" type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
          <input data-testid="slot-date-start" type="time" value={slotDateStart} onChange={(e) => setSlotDateStart(e.target.value)} />
          <input data-testid="slot-date-end" type="time" value={slotDateEnd} onChange={(e) => setSlotDateEnd(e.target.value)} />
          <button data-testid="slot-date-add" type="button" disabled={!slotDate} onClick={() => void addDateSlot()}>
            追加
          </button>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button data-testid="save-schedule" type="button" onClick={save}>
          スケジュールを保存
        </button>
        <button data-testid="reset-schedule" type="button" onClick={reset}>
          最新のスケジュールに更新
        </button>
        <button data-testid="apply-schedule" type="button" onClick={() => void apply()}>
          このスケジュールで登録する
        </button>
      </div>
      {result && (
        <p data-testid={result === '保存しました' ? 'save-result' : 'apply-result'} style={{ color: 'var(--accent-strong)' }}>
          {result}
        </p>
      )}
      <p>
        <button data-testid="back-button" onClick={onDone}>戻る</button>
      </p>
    </div>
  )
}