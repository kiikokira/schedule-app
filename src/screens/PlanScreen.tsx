import { useState } from 'react'
import CoverImage from '../components/CoverImage'
import { useBooks } from '../hooks/useBooks'
import { db } from '../db/database'
import { CATALOG } from '../data/catalog'
import {
  SCHEDULE,
  buildApplyResult,
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

type Props = {
  onDone: () => void
}

export default function PlanScreen({ onDone }: Props) {
  const { saveBook } = useBooks()
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => loadSchedule())
  const [result, setResult] = useState<string | null>(null)

  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [addStart, setAddStart] = useState(() => todayStr())

  const availableBooks = CATALOG.filter(
    (c) => !entries.some((e) => e.catalogId === c.id),
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
    setEntries([...SCHEDULE])
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>学習スケジュールを登録</h1>
      <p style={{ color: 'var(--text-dim)' }}>
        参考書ごとの開始日と期限を確認・編集できます。カタログから追加して「保存」した後、「このスケジュールで登録する」で参考書を登録できます。
      </p>

      <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>参考書を追加</h2>
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

      {entries.map((entry) => {
        const book = CATALOG.find((c) => c.id === entry.catalogId)
        if (!book) return null
        return (
          <div
            key={entry.catalogId}
            data-testid={`entry-row-${entry.catalogId}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}
          >
            <CoverImage src={book.coverSrc ?? null} width={40} height={56} />
            <div style={{ flex: 1 }}>
              <div>{book.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                {book.subject} / {book.totalPages}ページ
                {entry.note ? ` / ${entry.note}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <label style={{ fontSize: 12 }}>
                  開始
                  <input
                    data-testid={`entry-start-${entry.catalogId}`}
                    type="date"
                    value={entry.startDate}
                    onChange={(e) =>
                      setEntries((prev) =>
                        updateEntry(prev, entry.catalogId, {
                          startDate: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  期限
                  <input
                    data-testid={`entry-deadline-${entry.catalogId}`}
                    type="date"
                    value={entry.deadline}
                    onChange={(e) =>
                      setEntries((prev) =>
                        updateEntry(prev, entry.catalogId, {
                          deadline: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>
            </div>
            <button
              data-testid={`entry-delete-${entry.catalogId}`}
              type="button"
              onClick={() =>
                setEntries((prev) => removeEntry(prev, entry.catalogId))
              }
              style={{ flexShrink: 0 }}
            >
              削除
            </button>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button data-testid="save-schedule" type="button" onClick={save}>
          スケジュールを保存
        </button>
        <button data-testid="reset-schedule" type="button" onClick={reset}>
          初期状態に戻す
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