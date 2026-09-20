import { useState } from 'react'
import type { BookData, ProgressRecordData } from '../lib/progress'
import {
  calcDonePages,
  calcDailyTarget,
  calcRequiredPerDay,
  daysBetween,
  todayStr,
  calcScheduleStatus,
} from '../lib/progress'
import CoverImage from './CoverImage'

type Props = {
  book: BookData
  records: ProgressRecordData[]
  onOpen: (id: string) => void
  onRecord: (bookId: string, pages: number) => void
}

const STATUS_LABEL: Record<string, string> = {
  done: '完了',
  behind: '遅れ',
  scheduled: '順調',
}

export default function BookCard({ book, records, onOpen, onRecord }: Props) {
  const [pagesInput, setPagesInput] = useState('')
  const today = todayStr()
  const done = calcDonePages(records, book.id)
  const todayRecord = records.find((r) => r.bookId === book.id && r.date === today)
  const todayPages = todayRecord?.pages ?? 0
  const doneBeforeToday = done - todayPages
  const remaining = Math.max(book.totalPages - done, 0)
  const remainingDays = daysBetween(today, book.deadline)
  const target = calcDailyTarget(book, done, remainingDays)
  const previewTodayPages = (() => {
    const p = Number(pagesInput)
    if (Number.isInteger(p) && p >= 1) return p
    return todayPages
  })()
  const requiredPerDay = calcRequiredPerDay(
    book,
    doneBeforeToday,
    previewTodayPages,
    remainingDays,
  )
  const status = calcScheduleStatus(book, done, today)
  const progress = book.totalPages > 0 ? (done / book.totalPages) * 100 : 0

  const handleRecord = () => {
    const pages = Number(pagesInput)
    if (Number.isInteger(pages) && pages >= 1) {
      onRecord(book.id, pages)
      setPagesInput('')
    }
  }

  return (
    <div
      data-testid={`book-card-${book.id}`}
      className={`book-card ${status === 'behind' ? 'behind' : ''}`}
      style={{
        display: 'block',
        width: '100%',
        marginBottom: '12px',
        padding: '12px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: status === 'behind' ? '#fdeaea' : 'var(--surface)',
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(book.id)}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CoverImage src={book.coverUrl ?? null} width={56} height={80} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{book.title}</div>
            <div>残り {remaining} ページ</div>
            <div>
              今日の目標 <strong>{target}</strong> ページ
            </div>
            <div>期限まで1日あたり {requiredPerDay} ページ</div>
            <div>
              期限 {book.deadline}（残り{Math.max(remainingDays, 0)}日） /{' '}
              {STATUS_LABEL[status]}
            </div>
          </div>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: 8,
            borderRadius: 4,
            background: 'var(--cover-placeholder)',
            marginTop: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: status === 'done' ? '#2f9e63' : 'var(--accent-strong)',
            }}
          />
        </div>
      </button>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          data-testid={`card-progress-input-${book.id}`}
          type="number"
          inputMode="numeric"
          value={pagesInput}
          onChange={(e) => setPagesInput(e.target.value)}
          placeholder="今日のページ数"
          style={{ flex: 1, minWidth: 96 }}
        />
        <button
          data-testid={`card-record-${book.id}`}
          type="button"
          onClick={() => void handleRecord()}
        >
          記録
        </button>
      </div>
    </div>
  )
}