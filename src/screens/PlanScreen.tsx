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
import { todayStr, formatJaDate } from '../lib/progress'
import { parseTimeToMin } from '../lib/dayplan'
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
  applyBulkPin,
  restoreBulkPin,
  savePinBackup,
  loadPinBackup,
  clearPinBackup,
  type AvailabilitySlot,
} from '../data/dayplanStore'
import {
  loadOverridePresets,
  saveOverridePresets,
  type OverridePreset,
} from '../data/overridePresets'
import { isLeapBook } from '../lib/leap'

type Props = {
  onDone: () => void
  onFocus?: () => void
}

type SlotRow = { start: string; end: string; bookId?: string; onTrain?: boolean }

const emptyRow = (): SlotRow => ({ start: '', end: '', onTrain: false })

type RowsResult = { ok: true; rows: SlotRow[] } | { ok: false; message: string }

function collectRows(rows: SlotRow[]): RowsResult {
  const filled = rows.filter((r) => r.start !== '' || r.end !== '')
  for (const r of filled) {
    if (r.start === '' || r.end === '') {
      return { ok: false, message: '開始と終了の両方を入力してください' }
    }
    if (parseTimeToMin(r.end) <= parseTimeToMin(r.start)) {
      return { ok: false, message: '終了時刻は開始時刻より後にしてください' }
    }
  }
  const sorted = [...filled].sort(
    (a, b) => parseTimeToMin(a.start) - parseTimeToMin(b.start),
  )
  for (let i = 1; i < sorted.length; i++) {
    if (parseTimeToMin(sorted[i].start) < parseTimeToMin(sorted[i - 1].end)) {
      return { ok: false, message: '時間帯が重複しないようにしてください' }
    }
  }
  return { ok: true, rows: filled }
}

export default function PlanScreen({ onDone, onFocus }: Props) {
  const { books, saveBook } = useBooks()
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => loadSchedule())
  const [result, setResult] = useState<string | null>(null)
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [slotWeekday, setSlotWeekday] = useState('')
  const [weekdayRows, setWeekdayRows] = useState<SlotRow[]>(() => [emptyRow()])
  const [slotDate, setSlotDate] = useState('')
  const [dateRows, setDateRows] = useState<SlotRow[]>(() => [emptyRow()])
  const [showWeeklyForm, setShowWeeklyForm] = useState(false)
  const [showDateForm, setShowDateForm] = useState(false)
  const [showPresetForm, setShowPresetForm] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [slotDrafts, setSlotDrafts] = useState<Record<string, SlotRow>>({})
  const [presets, setPresets] = useState<OverridePreset[]>(() => loadOverridePresets())
  const [presetId, setPresetId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetRows, setPresetRows] = useState<SlotRow[]>(() => [emptyRow()])

  const updateSlotDraft = (slot: AvailabilitySlot, patch: Partial<SlotRow>) =>
    setSlotDrafts((prev) => {
      const base: SlotRow = { start: slot.start, end: slot.end, bookId: slot.bookId, onTrain: slot.onTrain }
      const next: SlotRow = Object.assign({}, base, prev[slot.id] ?? {}, patch)
      return { ...prev, [slot.id]: next }
    })

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const refreshAvailability = async () => {
    setAvailability(await listAvailability())
  }

  useEffect(() => {
    void refreshAvailability()
  }, [])

  const updateWeekdayRow = (i: number, patch: Partial<SlotRow>) =>
    setWeekdayRows((rows) =>
      rows.map((r, ri) => (ri === i ? { ...r, ...patch } : r)),
    )

  const updateDateRow = (i: number, patch: Partial<SlotRow>) =>
    setDateRows((rows) =>
      rows.map((r, ri) => (ri === i ? { ...r, ...patch } : r)),
    )

  const updatePresetRow = (i: number, patch: Partial<SlotRow>) =>
    setPresetRows((rows) =>
      rows.map((r, ri) => (ri === i ? { ...r, ...patch } : r)),
    )

  const selectPreset = (id: string) => {
    setPresetId(id)
    if (!id) return
    const found = presets.find((p) => p.id === id)
    if (!found) return
    setPresetName(found.name)
    setPresetRows(
      found.rows.length > 0
        ? found.rows.map((r) => ({ start: r.start, end: r.end, bookId: r.bookId, onTrain: r.onTrain }))
        : [emptyRow()],
    )
  }

  const savePreset = () => {
    const name = presetName.trim()
    if (!name) return
    const rows = presetRows
      .filter((r) => r.start !== '' && r.end !== '')
      .map((r) => ({ start: r.start, end: r.end, bookId: r.bookId, onTrain: r.onTrain }))
    if (rows.length === 0) return
    const existing = presets.find((p) => p.id === presetId)
    let next: OverridePreset[]
    let savedId = presetId
    if (existing) {
      next = presets.map((p) => (p.id === existing.id ? { ...p, name, rows } : p))
    } else {
      savedId = crypto.randomUUID()
      next = [...presets, { id: savedId, name, rows }]
    }
    saveOverridePresets(next)
    setPresets(next)
    setPresetId(savedId)
    setPresetName(name)
    setPresetRows(rows.map((r) => ({ ...r })))
  }

  const deletePreset = () => {
    if (!presetId) return
    const target = presets.find((p) => p.id === presetId)
    if (!window.confirm(`プリセット「${target?.name ?? ''}」を削除しますか？`)) return
    const next = presets.filter((p) => p.id !== presetId)
    saveOverridePresets(next)
    setPresets(next)
    setPresetId('')
    setPresetName('')
    setPresetRows([emptyRow()])
  }

  const addWeekdaySlot = async () => {
    if (slotWeekday === '') return
    const res = collectRows(weekdayRows)
    if (!res.ok) {
      window.alert(res.message)
      return
    }
    if (res.rows.length === 0) return
    for (const row of res.rows) {
      await saveAvailabilitySlot(
        {
          id: crypto.randomUUID(),
          weekday: Number(slotWeekday),
          date: null,
          start: row.start,
          end: row.end,
          bookId: row.bookId || undefined,
          onTrain: row.onTrain || undefined,
        },
        true,
      )
    }
    setSlotWeekday('')
    setWeekdayRows([emptyRow()])
    await refreshAvailability()
  }

  const addDateSlot = async () => {
    if (!slotDate) return
    const res = collectRows(dateRows)
    if (!res.ok) {
      window.alert(res.message)
      return
    }
    if (res.rows.length === 0) return
    for (const row of res.rows) {
      await saveAvailabilitySlot(
        {
          id: crypto.randomUUID(),
          weekday: null,
          date: slotDate,
          start: row.start,
          end: row.end,
          bookId: row.bookId || undefined,
          onTrain: row.onTrain || undefined,
        },
        true,
      )
    }
    setSlotDate('')
    setDateRows([emptyRow()])
    await refreshAvailability()
  }

  const removeSlot = async (id: string, label: string) => {
    if (!window.confirm(`「${label}」の空き時間を削除しますか？`)) return
    await deleteAvailabilitySlot(id)
    await refreshAvailability()
  }

  const saveSlotTimes = async (slot: AvailabilitySlot) => {
    const draft: SlotRow = slotDrafts[slot.id] ?? {
      start: slot.start,
      end: slot.end,
      bookId: slot.bookId,
      onTrain: slot.onTrain,
    }
    if (parseTimeToMin(draft.end) <= parseTimeToMin(draft.start)) {
      window.alert('終了時刻は開始時刻より後にしてください')
      return
    }
    const next: AvailabilitySlot = { ...slot, start: draft.start, end: draft.end }
    if (draft.bookId) next.bookId = draft.bookId
    else delete next.bookId
    if (draft.onTrain) next.onTrain = true
    else delete next.onTrain
    await saveAvailabilitySlot(next, false)
    setSlotDrafts((prev) => {
      const next = { ...prev }
      delete next[slot.id]
      return next
    })
    await refreshAvailability()
  }

  const copyWeekdaySlots = (w: number) => {
    const slots = availability.filter((s) => s.weekday === w).sort(byStart)
    setSlotWeekday(String(w))
    setWeekdayRows(slots.map((s) => ({ start: s.start, end: s.end, bookId: s.bookId, onTrain: s.onTrain })))
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

  // テスト期間などの集中学習用：曜日の空き時間すべてを指定本（LEAP）に固定する。
  // 固定前の状態を残すので「元に戻す」で完全に復旧できる。
  const fixAllToLeap = async () => {
    const leap = books.find((b) => isLeapBook(b))
    if (!leap) {
      setResult('LEAPが登録されていません')
      return
    }
    const targets = availability.filter((s) => s.weekday !== null)
    const { slots: fixed, backup } = applyBulkPin(targets, leap.id)
    savePinBackup(backup)
    for (const s of fixed) {
      await saveAvailabilitySlot(s, false)
    }
    setResult(`すべての曜日枠（${fixed.length}件）をLEAPに固定しました`)
    await refreshAvailability()
  }

  const restorePins = async () => {
    const backup = loadPinBackup()
    if (!backup) {
      setResult('戻せる固定がありません')
      return
    }
    for (const s of restoreBulkPin(availability, backup)) {
      await saveAvailabilitySlot(s, false)
    }
    clearPinBackup()
    setResult('固定を元に戻しました')
    await refreshAvailability()
  }

  const byStart = (a: AvailabilitySlot, b: AvailabilitySlot) =>
    parseTimeToMin(a.start) - parseTimeToMin(b.start)

  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土']

  const slotLabelWithPin = (s: AvailabilitySlot) => {
    const trainMark = s.onTrain ? '【汽車】' : ''
    const base = `${trainMark}${s.start}〜${s.end}`
    if (!s.bookId) return base
    const pinned = books.find((b) => b.id === s.bookId)
    return pinned ? `${base}（${pinned.title}）` : base
  }

  const weekdayGroups = weekdayOrder
    .map((w) => ({
      key: `weekday-${w}`,
      weekday: w,
      slots: availability.filter((s) => s.weekday === w).sort(byStart),
    }))
    .filter((g) => g.slots.length > 0)

  const dateGroups = [
    ...new Set(
      availability.filter((s) => s.date !== null).map((s) => s.date as string),
    ),
  ]
    .sort()
    .map((d) => ({
      key: `date-${d}`,
      date: d,
      slots: availability.filter((s) => s.date === d).sort(byStart),
    }))

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
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          テスト期間などは全ての曜日枠をLEAPに固定できます（固定前の状態に戻せます）。
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button data-testid="leap-focus-all" type="button" onClick={() => void fixAllToLeap()}>
            全ての曜日枠をLEAPに固定
          </button>
          <button data-testid="leap-focus-restore" type="button" onClick={() => void restorePins()}>
            固定を元に戻す
          </button>
        </div>
        <div data-testid="availability-list">
          {[...weekdayGroups, ...dateGroups].map((group) => {
            const label =
              'weekday' in group
                ? `${weekdayNames[group.weekday]}曜 ${group.slots.map(slotLabelWithPin).join(', ')}`
                : `${formatJaDate(group.date)} ${group.slots.map(slotLabelWithPin).join(', ')}`
            const open = expandedGroups.has(group.key)
            return (
              <div key={group.key} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    data-testid={`slot-group-${group.key}`}
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    style={{ flex: 1, textAlign: 'left' }}
                  >
                    {label}
                  </button>
                  {'weekday' in group && (
                    <button
                      data-testid={`slot-copy-weekday-${group.weekday}`}
                      type="button"
                      onClick={() => copyWeekdaySlots(group.weekday)}
                    >
                      コピー
                    </button>
                  )}
                </div>
                {open &&
                  group.slots.map((slot) => {
                    const draft: SlotRow = slotDrafts[slot.id] ?? {
                      start: slot.start,
                      end: slot.end,
                      bookId: slot.bookId,
                      onTrain: slot.onTrain,
                    }
                    const slotLabel = `${slot.start}〜${slot.end}`
                    return (
                      <div key={slot.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, paddingLeft: 8, flexWrap: 'wrap' }}>
                        <label htmlFor={`slot-edit-start-${slot.id}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>開始時刻</label>
                        <input
                          id={`slot-edit-start-${slot.id}`}
                          data-testid={`slot-edit-start-${slot.id}`}
                          type="time"
                          value={draft.start}
                          onChange={(e) => updateSlotDraft(slot, { start: e.target.value })}
                        />
                        <span>〜</span>
                        <label htmlFor={`slot-edit-end-${slot.id}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>終了時刻</label>
                        <input
                          id={`slot-edit-end-${slot.id}`}
                          data-testid={`slot-edit-end-${slot.id}`}
                          type="time"
                          value={draft.end}
                          onChange={(e) => updateSlotDraft(slot, { end: e.target.value })}
                        />
                        <select
                          data-testid={`slot-book-${slot.id}`}
                          value={draft.bookId ?? ''}
                          onChange={(e) =>
                            updateSlotDraft(slot, { bookId: e.target.value || undefined })
                          }
                          aria-label="この時間にする本"
                        >
                          <option value="">おまかせ</option>
                          {books.map((book) => (
                            <option key={book.id} value={book.id}>
                              {book.title}
                            </option>
                          ))}
                        </select>
                        <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                          <input
                            data-testid={`slot-train-${slot.id}`}
                            type="checkbox"
                            checked={!!draft.onTrain}
                            onChange={(e) => updateSlotDraft(slot, { onTrain: e.target.checked })}
                          />
                          汽車
                        </label>
                        <button data-testid={`slot-save-${slot.id}`} type="button" onClick={() => void saveSlotTimes(slot)}>
                          保存
                        </button>
                        <button data-testid={`slot-delete-${slot.id}`} type="button" onClick={() => void removeSlot(slot.id, `${label} ${slotLabel}`)}>
                          削除
                        </button>
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            data-testid="slot-weekly-toggle"
            type="button"
            aria-expanded={showWeeklyForm}
            onClick={() => setShowWeeklyForm((v) => !v)}
            style={{ fontSize: 14, fontWeight: 700 }}
          >
            曜日ごと {showWeeklyForm ? '▼' : '▶'}
          </button>
          <button
            data-testid="slot-date-toggle"
            type="button"
            aria-expanded={showDateForm}
            onClick={() => setShowDateForm((v) => !v)}
            style={{ fontSize: 14, fontWeight: 700 }}
          >
            当日上書き {showDateForm ? '▼' : '▶'}
          </button>
          <button
            data-testid="slot-preset-toggle"
            type="button"
            aria-expanded={showPresetForm}
            onClick={() => setShowPresetForm((v) => !v)}
            style={{ fontSize: 14, fontWeight: 700 }}
          >
            プリセット制作 {showPresetForm ? '▼' : '▶'}
          </button>
        </div>
        {showWeeklyForm && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <select data-testid="slot-weekday-select" value={slotWeekday} onChange={(e) => setSlotWeekday(e.target.value)}>
                <option value="">曜日を選択</option>
                {['日','月','火','水','木','金','土'].map((w, i) => (
                  <option key={i} value={i}>{w}</option>
                ))}
              </select>
              <button data-testid="slot-row-add" type="button" onClick={() => setWeekdayRows((rows) => [...rows, emptyRow()])}>
                時間帯を追加
              </button>
            </div>
            {weekdayRows.map((row, i) => (
              <div key={i} data-testid={`slot-row-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                  <label htmlFor={`slot-start-${i}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>開始時刻</label>
                  <input id={`slot-start-${i}`} data-testid={`slot-start-${i}`} type="time" value={row.start} onChange={(e) => updateWeekdayRow(i, { start: e.target.value })} style={{ minWidth: 0, flex: 1 }} />
                  <span>〜</span>
                  <label htmlFor={`slot-end-${i}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>終了時刻</label>
                  <input id={`slot-end-${i}`} data-testid={`slot-end-${i}`} type="time" value={row.end} onChange={(e) => updateWeekdayRow(i, { end: e.target.value })} style={{ minWidth: 0, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <select
                  data-testid={`slot-weekday-book-${i}`}
                  value={row.bookId ?? ''}
                  onChange={(e) => updateWeekdayRow(i, { bookId: e.target.value || undefined })}
                  aria-label="この時間にする本"
                >
                  <option value="">おまかせ</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                  <input
                    data-testid={`slot-weekday-train-${i}`}
                    type="checkbox"
                    checked={!!row.onTrain}
                    onChange={(e) => updateWeekdayRow(i, { onTrain: e.target.checked })}
                  />
                  汽車
                </label>
                </div>
              </div>
            ))}
            <button data-testid="slot-add" type="button" disabled={slotWeekday === ''} onClick={() => void addWeekdaySlot()}>
              まとめて追加
            </button>
          </>
        )}
        {showDateForm && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input data-testid="slot-date" type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
              <button data-testid="slot-date-row-add" type="button" onClick={() => setDateRows((rows) => [...rows, emptyRow()])}>
                時間帯を追加
              </button>
            </div>
            {dateRows.map((row, i) => (
              <div key={i} data-testid={`slot-date-row-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                  <label htmlFor={`slot-date-start-${i}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>開始時刻</label>
                  <input id={`slot-date-start-${i}`} data-testid={`slot-date-start-${i}`} type="time" value={row.start} onChange={(e) => updateDateRow(i, { start: e.target.value })} style={{ minWidth: 0, flex: 1 }} />
                  <span>〜</span>
                  <label htmlFor={`slot-date-end-${i}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>終了時刻</label>
                  <input id={`slot-date-end-${i}`} data-testid={`slot-date-end-${i}`} type="time" value={row.end} onChange={(e) => updateDateRow(i, { end: e.target.value })} style={{ minWidth: 0, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <select
                  data-testid={`slot-date-book-${i}`}
                  value={row.bookId ?? ''}
                  onChange={(e) => updateDateRow(i, { bookId: e.target.value || undefined })}
                  aria-label="この時間にする本"
                >
                  <option value="">おまかせ</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                  <input
                    data-testid={`slot-date-train-${i}`}
                    type="checkbox"
                    checked={!!row.onTrain}
                    onChange={(e) => updateDateRow(i, { onTrain: e.target.checked })}
                  />
                  汽車
                </label>
                </div>
              </div>
            ))}
            <button data-testid="slot-date-add" type="button" disabled={!slotDate} onClick={() => void addDateSlot()}>
              まとめて追加
            </button>
          </>
        )}
        {showPresetForm && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <select
                data-testid="plan-preset-select"
                value={presetId}
                onChange={(e) => selectPreset(e.target.value)}
                aria-label="プリセット"
              >
                <option value="">プリセットを選ぶ</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button data-testid="plan-preset-delete" type="button" onClick={deletePreset}>
                削除
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <input
                data-testid="plan-preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="プリセット名"
                aria-label="プリセット名"
              />
              <button data-testid="plan-preset-row-add" type="button" onClick={() => setPresetRows((rows) => [...rows, emptyRow()])}>
                時間帯を追加
              </button>
            </div>
            {presetRows.map((row, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                  <label htmlFor={`plan-preset-start-${i}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>開始時刻</label>
                  <input id={`plan-preset-start-${i}`} data-testid={`plan-preset-start-${i}`} type="time" value={row.start} onChange={(e) => updatePresetRow(i, { start: e.target.value })} style={{ minWidth: 0, flex: 1 }} />
                  <span>〜</span>
                  <label htmlFor={`plan-preset-end-${i}`} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>終了時刻</label>
                  <input id={`plan-preset-end-${i}`} data-testid={`plan-preset-end-${i}`} type="time" value={row.end} onChange={(e) => updatePresetRow(i, { end: e.target.value })} style={{ minWidth: 0, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <select
                    data-testid={`plan-preset-book-${i}`}
                    value={row.bookId ?? ''}
                    onChange={(e) => updatePresetRow(i, { bookId: e.target.value || undefined })}
                    aria-label="この時間にする本"
                  >
                    <option value="">おまかせ</option>
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                  </select>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                    <input
                      data-testid={`plan-preset-train-${i}`}
                      type="checkbox"
                      checked={!!row.onTrain}
                      onChange={(e) => updatePresetRow(i, { onTrain: e.target.checked })}
                    />
                    汽車
                  </label>
                </div>
              </div>
            ))}
            <button data-testid="plan-preset-save" type="button" onClick={savePreset} style={{ marginTop: 8 }}>
              保存
            </button>
          </>
        )}
      </section>

      {onFocus && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button data-testid="plan-focus" type="button" onClick={onFocus}>
            テスト期間
          </button>
        </div>
      )}

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