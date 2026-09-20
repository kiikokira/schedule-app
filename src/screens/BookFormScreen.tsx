import { useState } from 'react'
import { searchBooks, type SearchResultItem } from '../api/googleBooks'
import { useBooks } from '../hooks/useBooks'
import { todayStr, type BookData } from '../lib/progress'

type Props = {
  book: BookData | null
  onDone: () => void
}

export default function BookFormScreen({ book, onDone }: Props) {
  const { saveBook } = useBooks()
  const [title, setTitle] = useState(book?.title ?? '')
  const [subject, setSubject] = useState(book?.subject ?? '英語')
  const [totalPages, setTotalPages] = useState(book?.totalPages ? String(book.totalPages) : '')
  const [coverUrl, setCoverUrl] = useState<string | null>(book?.coverUrl ?? null)
  const [startDate, setStartDate] = useState(book?.startDate ?? todayStr())
  const [deadline, setDeadline] = useState(book?.deadline ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')

  const runSearch = async () => {
    if (!query.trim()) return
    setSearchError('')
    try {
      setResults(await searchBooks(query))
    } catch (e) {
      setResults([])
      setSearchError(e instanceof Error ? e.message : '検索できませんでした')
    }
  }

  const pickResult = (item: SearchResultItem) => {
    setTitle(item.title)
    if (item.pageCount) setTotalPages(String(item.pageCount))
    setCoverUrl(item.thumbnail)
  }

  const handleSave = async () => {
    setError('')
    if (!title.trim()) {
      setError('タイトルを入力してください')
      return
    }
    const pages = Number(totalPages)
    if (!Number.isInteger(pages) || pages < 1) {
      setError('ページ数は1以上の整数で入力してください')
      return
    }
    if (!deadline) {
      setError('期限日を入力してください')
      return
    }
    if (deadline <= startDate) {
      setError('期限は開始日より後を指定してください')
      return
    }
    const now = new Date().toISOString()
    const isNew = book === null
    const next: BookData = {
      id: book?.id ?? crypto.randomUUID(),
      title: title.trim(),
      subject: subject.trim() || undefined,
      totalPages: pages,
      coverUrl: coverUrl ?? undefined,
      startDate,
      deadline,
      createdAt: book?.createdAt ?? now,
      updatedAt: now,
    }
    try {
      await saveBook(next, isNew)
    } catch {
      setError('保存に失敗しました。もう一度お試しください')
      return
    }
    onDone()
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>{book ? '参考書を編集' : '参考書を追加'}</h1>
      {book === null && (
        <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16 }}>本を検索して追加</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              data-testid="book-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="タイトルを入力"
            />
            <button data-testid="book-search-btn" type="button" onClick={() => void runSearch()}>
              検索
            </button>
          </div>
          {searchError && <p style={{ color: '#b91c1c' }}>{searchError}</p>}
          {results.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" width={40} height={56} />
              ) : (
                <div style={{ width: 40, height: 56, background: '#eee' }} />
              )}
              <div style={{ flex: 1 }}>
                <div>{item.title}</div>
                <div style={{ color: '#666', fontSize: 12 }}>
                  {item.pageCount ? `${item.pageCount}ページ` : 'ページ数不明'}
                </div>
              </div>
              <button type="button" onClick={() => pickResult(item)}>
                追加
              </button>
            </div>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="book-title">タイトル</label>
        <input id="book-title" data-testid="book-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-subject">科目</label>
        <input id="book-subject" data-testid="book-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-pages">総ページ数</label>
        <input id="book-pages" data-testid="book-pages" type="number" inputMode="numeric" value={totalPages} onChange={(e) => setTotalPages(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-start">開始日</label>
        <input id="book-start" data-testid="book-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-deadline">期限日</label>
        <input id="book-deadline" data-testid="book-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      {error && <p data-testid="book-error" style={{ color: '#b91c1c' }}>{error}</p>}
      <button data-testid="book-save" type="button" onClick={() => void handleSave()}>
        {book ? '保存' : '登録する'}
      </button>
    </div>
  )
}