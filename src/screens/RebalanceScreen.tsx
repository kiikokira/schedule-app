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

const PRIORITY_OPTIONS: { value: number | ''; label: string }[] = [
  { value: '', label: '未設定' },
  { value: 0, label: '優先' },
  { value: 1, label: '公平均分' },
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

function sameSlots(
  a: { bookId: string; startMin: number; endMin: number; pages: number }[],
  b: { bookId: string; startMin: number; endMin: number; pages: number }[],
): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (s, i) =>
      s.bookId === b[i].bookId &&
      s.startMin === b[i].startMin &&
      s.endMin === b[i].endMin &&
      s.pages === b[i].pages,
  )
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

  const priorityOf = (b: BookData): number | undefined =>
    priorities[b.id] !== undefined ? priorities[b.id] : b.priority
  const ratioOf = (b: BookData) =>
    ratios[b.id] !== undefined ? clampRatio(ratios[b.id]) : b.allottedRatio

  const scheduled = (includeTarget: boolean, overrides: boolean) =>
    books
      .filter((b) => includeTarget || b.id !== bookId)
      .filter((b) => (overrides ? priorityOf(b) : b.priority) !== 3)
      .map((b) =>
        toScheduledBook(
          {
            ...b,
            priority: overrides ? priorityOf(b) : b.priority,
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
    const effectivePriority = priorityOf(book)
    const changed: Partial<BookData> = {}
    if (effectivePriority !== undefined && effectivePriority !== book.priority) {
      changed.priority = effectivePriority
    }
    if (ratios[bookId] !== undefined && ratioOf(book) !== book.allottedRatio) {
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

  const hasDiff = !sameSlots(before.today.slots, after.today.slots)

  const summarize = (
    plan: Awaited<ReturnType<typeof generateDayPlan>>,
  ): { minutes: number; pages: number } => {
    let minutes = 0
    let pages = 0
    for (const s of plan.today.slots) {
      if (s.bookId !== bookId) continue
      minutes += s.endMin - s.startMin
      pages += s.pages
    }
    return { minutes, pages }
  }
  const beforeSummary = summarize(before)
  const afterSummary = summarize(after)
  const targetBook = books.find((b) => b.id === bookId)

  const renderPlan = (
    plan: Awaited<ReturnType<typeof generateDayPlan>>,
    testid: string,
    title: string,
  ) => {
    const targetSlots = plan.today.slots.filter((s) => s.bookId === bookId)
    const otherSlots = plan.today.slots.filter((s) => s.bookId !== bookId)
    const otherBookIds = [...new Set(otherSlots.map((s) => s.bookId))]
    return (
      <div
        data-testid={testid}
        style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}
      >
        <h3 style={{ fontSize: 15 }}>{title}</h3>
        {targetSlots.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>対象の本の割り当てなし</p>
        ) : (
          targetSlots.map((s, i) => {
            const book = books.find((b) => b.id === s.bookId)
            return (
              <div
                key={`${testid}-${i}`}
                data-testid={`${testid}-row-${s.bookId}`}
                style={{ marginBottom: 8, fontSize: 16, lineHeight: 1.6 }}
              >
                <div>
                  {fmt(s.startMin)}-{fmt(s.endMin)}
                </div>
                <div>{book?.title ?? s.bookId}</div>
                <div style={{ color: 'var(--text-dim)' }}>
                  {s.endMin - s.startMin}分 {s.pages}ページ
                </div>
              </div>
            )
          })
        )}
        {otherSlots.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 14, color: 'var(--text-dim)' }}>
              他{otherBookIds.length}冊の割当
            </summary>
            {otherSlots.map((s, i) => {
              const book = books.find((b) => b.id === s.bookId)
              return (
                <div
                  key={`${testid}-other-${i}`}
                  data-testid={`${testid}-row-${s.bookId}`}
                  style={{ marginTop: 4, fontSize: 14 }}
                >
                  {fmt(s.startMin)}-{fmt(s.endMin)} {book?.title ?? s.bookId}{' '}
                  {s.endMin - s.startMin}分 {s.pages}ページ
                </div>
              )
            })}
          </details>
        )}
      </div>
    )
  }

  if (!hasDiff) {
    return (
      <div data-testid="rebalance-screen" style={{ padding: 16 }}>
        <h1 style={{ fontSize: 20 }}>配分を再調整</h1>
        <p data-testid="rebalance-summary" style={{ fontSize: 16 }}>
          {targetBook?.title ?? bookId}：{beforeSummary.minutes}分 {beforeSummary.pages}ページ →{' '}
          {afterSummary.minutes}分 {afterSummary.pages}ページ
        </p>
        <p data-testid="rebalance-no-change" style={{ fontSize: 16 }}>
          今日の割当に変化はありません。
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button data-testid="rebalance-report" type="button" onClick={onSchedule}>
            今日の計画を見る
          </button>
          <button data-testid="rebalance-back" type="button" onClick={onBack}>
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="rebalance-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>配分を再調整</h1>
      <p data-testid="rebalance-summary" style={{ fontSize: 16 }}>
        {targetBook?.title ?? bookId}：{beforeSummary.minutes}分 {beforeSummary.pages}ページ →{' '}
        {afterSummary.minutes}分 {afterSummary.pages}ページ
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {renderPlan(before, 'rebalance-before', '修正前')}
        {renderPlan(after, 'rebalance-after', '修正後')}
      </div>

      {targetBook && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 16 }}>優先度・配分比率を調整</h2>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 15, marginBottom: 4 }}>{targetBook.title}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                data-testid={`priority-select-${targetBook.id}`}
                value={String(priorityOf(targetBook) ?? '')}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') {
                    setPriorities((p) => {
                      const next = { ...p }
                      delete next[targetBook.id]
                      return next
                    })
                  } else {
                    setPriorities((p) => ({ ...p, [targetBook.id]: Number(v) }))
                  }
                }}
                style={{ width: 120 }}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                data-testid={`ratio-input-${targetBook.id}`}
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={ratios[targetBook.id] ?? (targetBook.allottedRatio !== undefined ? String(targetBook.allottedRatio) : '')}
                onChange={(e) => setRatios((r) => ({ ...r, [targetBook.id]: e.target.value }))}
                placeholder="配分比率(0-1)"
                style={{ width: 140 }}
              />
            </div>
          </div>
        </>
      )}

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