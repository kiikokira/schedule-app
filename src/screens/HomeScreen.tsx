import BookCard from '../components/BookCard'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { calcDonePages, calcScheduleStatus, todayStr } from '../lib/progress'

type Props = {
  onOpenBook: (id: string) => void
}

export default function HomeScreen({ onOpenBook }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()

  const sortedBooks = [...books].sort((a, b) => {
    const sa = calcScheduleStatus(a, calcDonePages(records, a.id), todayStr())
    const sb = calcScheduleStatus(b, calcDonePages(records, b.id), todayStr())
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
      {sortedBooks.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>参考書がありません。「＋」から追加してください。</p>
      ) : (
        sortedBooks.map((book) => (
          <BookCard key={book.id} book={book} records={records} onOpen={onOpenBook} />
        ))
      )}
    </div>
  )
}