import { useState } from 'react'
import ProgressChart from '../components/ProgressChart'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import {
  calcDonePages,
  calcDailyTarget,
  daysBetween,
  todayStr,
  type BookData,
} from '../lib/progress'

type Props = {
  bookId: string
  onBack: () => void
  onEdit: (id: string) => void
}

export default function BookDetailScreen({ bookId, onBack, onEdit }: Props) {
  const { books, removeBook } = useBooks()
  const { records, addProgress } = useRecords()
  const [pagesInput, setPagesInput] = useState('')
  const book: BookData | undefined = books.find((b) => b.id === bookId)

  if (!book) {
    return (
      <div style={{ padding: 16 }}>
        <p>参考書が見つかりません。</p>
        <button onClick={onBack}>戻る</button>
      </div>
    )
  }

  const today = todayStr()
  const done = calcDonePages(records, book.id)
  const remainingDays = daysBetween(today, book.deadline)
  const target = calcDailyTarget(book, done, remainingDays)
  const todayRecord = records.find((r) => r.bookId === book.id && r.date === today)

  const bookRecords = records
    .filter((r) => r.bookId === book.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const todayValues = bookRecords.map((r) => r.pages)

  const handleRecord = async () => {
    const pages = Number(pagesInput)
    if (!Number.isInteger(pages) || pages < 1) return
    await addProgress(book.id, today, pages)
    setPagesInput('')
  }

  const handleDelete = async () => {
    if (!window.confirm(`「${book.title}」を削除しますか？`)) return
    await removeBook(book.id)
    onBack()
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack}>← 戻る</button>
      <h1 data-testid="book-title" style={{ fontSize: 20 }}>
        {book.title}
      </h1>
      {book.coverUrl && <img src={book.coverUrl} alt="" width={96} height={136} />}
      <p>
        完了ページ: <span data-testid="done-count">{done}</span> / {book.totalPages}
      </p>
      <p>
        今日の目標: <strong data-testid="today-target">{target}</strong> ページ
      </p>
      <p>
        残り {Math.max(book.totalPages - done, 0)} ページ / 期限まで{' '}
        {Math.max(remainingDays, 0)} 日
      </p>
      <div style={{ margin: '16px 0' }}>
        <p>今日の学習（{todayRecord ? '記録済み・上書きします' : '未記録'}）</p>
        <input
          data-testid="progress-input"
          type="number"
          inputMode="numeric"
          value={todayRecord?.pages ? String(todayRecord.pages) : pagesInput}
          onChange={(e) => setPagesInput(e.target.value)}
          placeholder="ページ数"
        />
        <button data-testid="record-progress" type="button" onClick={() => void handleRecord()}>
          今日やったページ数を記録
        </button>
      </div>
      {todayValues.length > 0 && (
        <>
          <h2 style={{ fontSize: 16 }}>進捗の推移</h2>
          <ProgressChart dates={bookRecords.map((r) => r.date)} values={todayValues} />
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => onEdit(book.id)}>編集</button>
        <button onClick={() => void handleDelete()} style={{ color: '#b91c1c' }}>
          削除
        </button>
      </div>
    </div>
  )
}