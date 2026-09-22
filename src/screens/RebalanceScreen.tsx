import { useEffect, useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import {
  listAvailability,
  addAdjustment,
  type AvailabilitySlot,
} from '../data/dayplanStore'
import { generateDayPlan, effectiveSpeed, type ScheduledBook } from '../lib/dayplan'
import { todayStr, type BookData } from '../lib/progress'

type Props = {
  bookId: string
  onBack: () => void
  onSchedule: () => void
}

const PRIORITY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '公平均分' },
  { value: 1, label: '優先' },
  { value: 2, label: '軽視' },
  { value: 3, label: 'スキップ' },
]

function toScheduledBook(b: BookData, done: number): ScheduledBook {
  return {
    bookId: b.id,
    donePages: done,
    totalPages: b.totalPages,
    minutesPerPage: effectiveSpeed(b.minutesPerPage, b.subject),
    priority: b.priority,
    allottedRatio: b.allottedRatio,
    startDate: b.startDate,
    deadline: b.deadline,
  }
}

export default function RebalanceScreen({ bookId, onBack, onSchedule }: Props) {
  const { books, saveBook } = useBooks()
  const today = todayStr()
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [priorities, setPriorities] = useState<Record<string, number>>({})
  const [ratios, setRatios] = useState<Record<string, string>>({})
  const [recalcStatus, setRecalcStatus] = useState<string | null>(null)

  useEffect(() => {
    void listAvailability().then(setAvailability)
  }, [])

  const priorityOf = (b: BookData) => priorities[b.id] ?? b.priority ?? 2
  const ratioOf = (b: BookData) =>
    ratios[b.id] !== undefined ? clampRatio(ratios[b.id]) : b.allottedRatio

  const scheduled = (includeTarget: boolean, overrides: boolean) =>
    books
      .filter((b) => includeTarget || b.id !== bookId)
      .filter((b) => (overrides ? priorityOf(b) : (b.priority ?? 2)) !== 3)
      .map((b) =>
        toScheduledBook(
          {
            ...b,
            priority: overrides ? priorityOf(b) : b.priority ?? 2,
            allottedRatio: overrides ? ratioOf(b) : b.allottedRatio,
          },
          0,
        ),
      )

  const before = generateDayPlan({
    availability,
    books: scheduled(false, false),
    today,
  })
  const after = generateDayPlan({
    availability,
    books: scheduled(true, true),
    today,
  })

  const recompute = () => {
    setRecalcStatus('再計算しました')
  }

  const report = async () => {
    const book = books.find((b) => b.id === bookId)
    if (!book) return
    const changed: Partial<BookData> = {}
    if (priorities[bookId] !== undefined && priorityOf(book) !== book.priority) {
      changed.priority = priorityOf(book)
    }
    if (
      ratios[bookId] !== undefined &&
      ratioOf(book) !== book.allottedRatio
    ) {
      changed.allottedRatio = ratioOf(book)
    }
    await saveBook({ ...book, ...changed, updatedAt: new Date().toISOString() }, false)
    if (changed.priority !== undefined) {
      await addAdjustment({
        id: crypto.randomUUID(),
        date: today,
        bookId,
        kind: 'priority',
        value: changed.priority,
      })
    }
    if (changed.allottedRatio !== undefined) {
      await addAdjustment({
        id: crypto.randomUUID(),
        date: today,
        bookId,
        kind: 'ratio',
        value: changed.allottedRatio,
      })
    }
    onSchedule()
  }

  const renderPlan = (
    plan: Awaited<ReturnType<typeof generateDayPlan>>,
    testid: string,
    title: string,
  ) => (
    <div
      data-testid={testid}
      style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}
    >
      <h3 style={{ fontSize: 14 }}>{title}</h3>
      {plan.today.slots.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>割り当てなし</p>
      ) : (
        plan.today.slots.map((s, i) => {
          const book = books.find((b) => b.id === s.bookId)
          return (
            <div
              key={`${testid}-${i}`}
              data-testid={`${testid}-row-${s.bookId}`}
              style={{ marginBottom: 4, fontSize: 14 }}
            >
              {fmt(s.startMin)}-{fmt(s.endMin)} {book?.title ?? s.bookId}{' '}
              {s.endMin - s.startMin}分 {s.pages}ページ
            </div>
          )
        })
      )}
    </div>
  )

  return (
    <div data-testid="rebalance-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>配分を再調整</h1>
      <p style={{ color: 'var(--text-dim)' }}>
        修正前と修正後の配分を比較し、対象の本の優先度・配分比率を調整できます。
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {renderPlan(before, 'rebalance-before', '修正前')}
        {renderPlan(after, 'rebalance-after', '修正後')}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 16 }}>優先度・配分比率を調整</h2>
      {books.map((b) => {
        const isTarget = b.id === bookId
        return (
          <div
            key={b.id}
            style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}
          >
            <span style={{ flex: 1 }}>{b.title}</span>
            {isTarget ? (
              <select
                data-testid={`priority-select-${b.id}`}
                value={String(priorityOf(b))}
                onChange={(e) =>
                  setPriorities((p) => ({ ...p, [b.id]: Number(e.target.value) }))
                }
                style={{ width: 120 }}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                data-testid={`priority-select-${b.id}`}
                type="hidden"
                value={String(priorityOf(b))}
                readOnly
              />
            )}
            {isTarget ? (
              <input
                data-testid={`ratio-input-${b.id}`}
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={ratios[b.id] ?? (b.allottedRatio !== undefined ? String(b.allottedRatio) : '')}
                onChange={(e) => setRatios((r) => ({ ...r, [b.id]: e.target.value }))}
                placeholder="配分比率(0-1)"
                style={{ width: 120 }}
              />
            ) : (
              <input
                data-testid={`ratio-input-${b.id}`}
                type="hidden"
                value={ratios[b.id] ?? (b.allottedRatio !== undefined ? String(b.allottedRatio) : '')}
                readOnly
              />
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button data-testid="rebalance-apply" type="button" onClick={recompute}>
          再計算
        </button>
        <button data-testid="rebalance-report" type="button" onClick={() => void report()}>
          計画に反映
        </button>
        <button data-testid="rebalance-back" type="button" onClick={onBack}>
          戻る
        </button>
      </div>
      {recalcStatus && (
        <p data-testid="rebalance-status" style={{ color: 'var(--text-dim)' }}>
          {recalcStatus}
        </p>
      )}
    </div>
  )
}

function clampRatio(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.min(Math.max(n, 0), 1)
}

function fmt(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}