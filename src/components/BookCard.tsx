import type { BookData, ProgressRecordData } from '../lib/progress'
import {
  calcDonePages,
  calcDailyTarget,
  daysBetween,
  todayStr,
  calcScheduleStatus,
} from '../lib/progress'
import CoverImage from './CoverImage'

type Props = {
  book: BookData
  records: ProgressRecordData[]
  onOpen: (id: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  done: '完了',
  behind: '遅れ',
  scheduled: '順調',
}

export default function BookCard({ book, records, onOpen }: Props) {
  const done = calcDonePages(records, book.id)
  const remaining = Math.max(book.totalPages - done, 0)
  const remainingDays = daysBetween(todayStr(), book.deadline)
  const target = calcDailyTarget(book, done, remainingDays)
  const status = calcScheduleStatus(book, done, todayStr())
  const progress = book.totalPages > 0 ? (done / book.totalPages) * 100 : 0

  return (
    <button
      data-testid={`book-card-${book.id}`}
      onClick={() => onOpen(book.id)}
      className={`book-card ${status === 'behind' ? 'behind' : ''}`}
      style={{
        display: 'block',
        width: '100%',
        marginBottom: '12px',
        padding: '12px',
        textAlign: 'left',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: status === 'behind' ? '#fdeaea' : 'var(--surface)',
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
          <div>
            期限 {book.deadline}（残り{Math.max(remainingDays, 0)}日） / {STATUS_LABEL[status]}
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
  )
}