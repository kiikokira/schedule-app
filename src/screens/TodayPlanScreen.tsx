import { useEffect, useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { listAvailability } from '../data/dayplanStore'
import { generateDayPlan, effectiveSpeed, learnSpeed, type ScheduledBook } from '../lib/dayplan'
import { todayStr, formatJaDate, type BookData } from '../lib/progress'
import CoverImage from '../components/CoverImage'

type Props = {
  onBack: () => void
  onSettings: () => void
  today?: string
}

function toScheduledBook(b: BookData): ScheduledBook {
  return {
    bookId: b.id,
    donePages: 0,
    totalPages: b.totalPages,
    minutesPerPage: effectiveSpeed(b.minutesPerPage, b.subject),
    priority: b.priority,
    allottedRatio: b.allottedRatio,
    startDate: b.startDate,
    deadline: b.deadline,
  }
}

export default function TodayPlanScreen({ onBack, onSettings, today: todayProp }: Props) {
  const { books, saveBook } = useBooks()
  const { records, addProgress } = useRecords()
  const today = todayProp ?? todayStr()
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof listAvailability>>>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    void listAvailability().then(setAvailability)
  }, [])

  const doneByBook = new Map(books.map((b) => [b.id, 0]))
  for (const r of records) {
    const done = doneByBook.get(r.bookId)
    if (done !== undefined) doneByBook.set(r.bookId, done + r.pages)
  }
  const scheduled = books
    .map((b) => ({ ...toScheduledBook(b), donePages: doneByBook.get(b.id) ?? 0 }))
    .map((sb) => sb)
  // スケジュールに含まれていない登録本も対象にする
  const planned = generateDayPlan({ availability, books: scheduled, today })

  const handleRecord = async (bookId: string) => {
    const raw = inputs[bookId] ?? ''
    const pages = Number(raw)
    if (!Number.isInteger(pages) || pages < 1) return
    await addProgress(bookId, today, pages)
    setInputs((p) => ({ ...p, [bookId]: '' }))
    // 速度学習: その日に割り当てられた時間の合計
    const todayMin = planned.today.slots
      .filter((s) => s.bookId === bookId)
      .reduce((sum, s) => sum + (s.endMin - s.startMin), 0)
    if (todayMin > 0) {
      const book = books.find((b) => b.id === bookId)
      if (book) {
        const current = effectiveSpeed(book.minutesPerPage, book.subject)
        const next = learnSpeed(current, todayMin, pages)
        if (next !== current) {
          await saveBook(
            { ...book, minutesPerPage: next, updatedAt: new Date().toISOString() },
            false,
          )
        }
      }
    }
  }

  return (
    <div data-testid="today-plan-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>今日の計画</h1>
      {planned.notice && (
        <p data-testid="plan-notice" style={{ color: 'var(--text-dim)' }}>
          {planned.notice}
        </p>
      )}
      {planned.today.slots.length === 0 ? (
        <p data-testid="empty-availability-notice" style={{ color: 'var(--text-dim)' }}>
          今日の割り当てはありません。
          <button data-testid="go-settings" type="button" onClick={onSettings}>
            空き時間を設定
          </button>
        </p>
      ) : (
        <div data-testid="today-table">
          {planned.today.slots.map((s, i) => {
            const book = books.find((b) => b.id === s.bookId)
            return (
              <div
                key={`${s.startMin}-${s.bookId}`}
                data-testid={`plan-row-${i}`}
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}
              >
                <CoverImage src={book?.coverUrl ?? null} width={48} height={68} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div
                      data-testid="plan-row-book"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 700,
                        fontSize: 15,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {book?.title ?? s.bookId}
                    </div>
                    {book && (
                      <>
                        <input
                          data-testid={`plan-input-${s.bookId}`}
                          type="number"
                          inputMode="numeric"
                          value={inputs[s.bookId] ?? ''}
                          onChange={(e) =>
                            setInputs((p) => ({ ...p, [s.bookId]: e.target.value }))
                          }
                          placeholder="ページ"
                        />
                        <button
                          data-testid={`plan-record-${s.bookId}`}
                          type="button"
                          onClick={() => void handleRecord(s.bookId)}
                        >
                          記録
                        </button>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, color: 'var(--text-dim)' }}>
                    <div data-testid="plan-row-hours">
                      {fmt(s.startMin)}-{fmt(s.endMin)}
                    </div>
                    <div data-testid="plan-row-pages">予定 {s.pages}ページ</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div data-testid="upcoming-list" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>今後数日</h2>
        {planned.upcoming.map((u) => (
          <div key={u.date} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{formatJaDate(u.date)}</div>
            {u.items.map((it) => {
              const book = books.find((b) => b.id === it.bookId)
              return (
                <div
                  key={it.bookId}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: 8,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    marginTop: 4,
                    fontSize: 15,
                  }}
                >
                  <CoverImage src={book?.coverUrl ?? null} width={40} height={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      data-testid="upcoming-title"
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {book?.title ?? it.bookId}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                      {it.minutes}分・{it.pages}ページ
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <button data-testid="today-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}

function fmt(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}