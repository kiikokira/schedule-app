import BookCard from '../components/BookCard'
import CoverImage from '../components/CoverImage'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import {
  calcDonePages,
  calcScheduleStatus,
  todayStr,
  type BookData,
} from '../lib/progress'
import { CATALOG } from '../data/catalog'
import { loadSchedule } from '../data/scheduleStore'
import { sortScheduleEntries } from '../data/schedule'

const STATUS_LABEL: Record<string, string> = {
  done: '完了',
  behind: '遅れ',
  scheduled: '順調',
}

type Props = {
  onOpenBook: (id: string) => void
}

function findRegistered(
  books: BookData[],
  catalogId: string,
  title: string | undefined,
): BookData | undefined {
  return books.find(
    (b) =>
      b.catalogId === catalogId ||
      (b.catalogId === undefined && title !== undefined && b.title === title),
  )
}

export default function HomeScreen({ onOpenBook }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()
  const today = todayStr()
  const scheduled = sortScheduleEntries(loadSchedule(), today)

  const sortedBooks = [...books].sort((a, b) => {
    const sa = calcScheduleStatus(a, calcDonePages(records, a.id), today)
    const sb = calcScheduleStatus(b, calcDonePages(records, b.id), today)
    if (sa === 'behind' && sb !== 'behind') return -1
    if (sa !== 'behind' && sb === 'behind') return 1
    return 0
  })

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>参考書スケジュール</h1>
      <p style={{ color: 'var(--text-dim)' }}>
        今日の目標を毎日見て、参考書を期限内に終わらせよう。
      </p>

      <section data-testid="schedule-section" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>学習スケジュール</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          期限が近い順。遅れている参考書が上に表示されます。
        </p>
        {scheduled.map((entry) => {
          const catalogBook = CATALOG.find((c) => c.id === entry.catalogId)
          const registered = findRegistered(
            books,
            entry.catalogId,
            catalogBook?.title,
          )
          const done = registered ? calcDonePages(records, registered.id) : 0
          const status = registered
            ? calcScheduleStatus(
                {
                  ...registered,
                  startDate: entry.startDate,
                  deadline: entry.deadline,
                },
                done,
                today,
              )
            : 'unregistered'
          return (
            <div
              key={entry.catalogId}
              data-testid={`schedule-row-${entry.catalogId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                marginBottom: 8,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background:
                  status === 'behind'
                    ? '#fdeaea'
                    : status === 'unregistered'
                      ? 'var(--surface)'
                      : 'var(--surface)',
              }}
            >
              <CoverImage
                src={catalogBook?.coverSrc ?? null}
                width={40}
                height={56}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {catalogBook?.title ?? entry.catalogId}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  期限 {entry.deadline}
                  {entry.note ? `（${entry.note}）` : ''} /{' '}
                  {status === 'unregistered'
                    ? '未登録'
                    : STATUS_LABEL[status]}
                </div>
              </div>
              {registered && (
                <button
                  type="button"
                  onClick={() => onOpenBook(registered.id)}
                  style={{ flexShrink: 0 }}
                >
                  開く
                </button>
              )}
            </div>
          )
        })}
      </section>

      <section>
        <h2 data-testid="book-list-heading" style={{ fontSize: 16 }}>
          登録済みの参考書
        </h2>
        {sortedBooks.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>
            参考書がありません。「＋」から追加してください。
          </p>
        ) : (
          sortedBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              records={records}
              onOpen={onOpenBook}
            />
          ))
        )}
      </section>
    </div>
  )
}