import BookCard from '../components/BookCard'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'

type Props = {
  onOpenBook: (id: string) => void
}

export default function HomeScreen({ onOpenBook }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>参考書スケジュール</h1>
      <p style={{ color: '#666' }}>
        今日の目標を毎日見て、参考書を期限内に終わらせよう。
      </p>
      {books.length === 0 ? (
        <p style={{ color: '#888' }}>参考書がありません。「＋」から追加してください。</p>
      ) : (
        books.map((book) => (
          <BookCard key={book.id} book={book} records={records} onOpen={onOpenBook} />
        ))
      )}
    </div>
  )
}