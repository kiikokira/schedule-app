import { useState } from 'react'
import { searchBooks, getBooksApiKey, type SearchResultItem } from '../api/googleBooks'
import { useBooks } from '../hooks/useBooks'
import { todayStr, type BookData } from '../lib/progress'
import CoverImage from '../components/CoverImage'
import { searchCatalog, type CatalogBook } from '../data/catalog'

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
  const [catalogId, setCatalogId] = useState(book?.catalogId ?? null)
  const [startDate, setStartDate] = useState(book?.startDate ?? todayStr())
  const [deadline, setDeadline] = useState(book?.deadline ?? '')
  const [tab, setTab] = useState<'catalog' | 'search'>('catalog')
  const [catalogQuery, setCatalogQuery] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')

  const catalogResults = searchCatalog(catalogQuery)

  const runSearch = async () => {
    if (!query.trim()) return
    setSearchError('')
    try {
      setResults(await searchBooks(query, 10, fetch, getBooksApiKey()))
    } catch {
      setResults([])
      setSearchError('検索できませんでした。参考書一覧から選んでください')
    }
  }

  const pickResult = (item: SearchResultItem) => {
    setTitle(item.title)
    if (item.pageCount) setTotalPages(String(item.pageCount))
    setCoverUrl(item.thumbnail)
    setCatalogId(null)
  }

  const pickCatalog = (item: CatalogBook) => {
    setTitle(item.title)
    setSubject(item.subject)
    setTotalPages(String(item.totalPages))
    setCoverUrl(item.coverSrc ?? null)
    setCatalogId(item.id)
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
      catalogId: catalogId ?? undefined,
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
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              data-testid="tab-catalog"
              type="button"
              aria-pressed={tab === 'catalog'}
              onClick={() => setTab('catalog')}
            >
              参考書一覧
            </button>
            <button
              data-testid="tab-search"
              type="button"
              aria-pressed={tab === 'search'}
              onClick={() => setTab('search')}
            >
              Google Booksで検索
            </button>
          </div>
          {tab === 'catalog' && (
            <div>
              <input
                data-testid="catalog-search-input"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="タイトルで絞り込み"
              />
              {catalogResults.map((item) => (
                <div
                  key={item.id}
                  data-testid={`catalog-item-${item.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}
                >
                  <CoverImage src={item.coverSrc ?? null} width={40} height={56} />
                  <div style={{ flex: 1 }}>
                    <div>{item.title}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                      {item.subject} / {item.totalPages}ページ
                    </div>
                  </div>
                  <button type="button" onClick={() => pickCatalog(item)}>
                    選ぶ
                  </button>
                </div>
              ))}
            </div>
          )}
          {tab === 'search' && (
            <div>
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
              {searchError && <p style={{ color: 'var(--danger)' }}>{searchError}</p>}
              {results.length === 0 && !searchError && (
                <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8 }}>
                  参考書一覧から選ぶと、確実に入力できます。
                </p>
              )}
              {results.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <CoverImage src={item.thumbnail} width={40} height={56} />
                  <div style={{ flex: 1 }}>
                    <div>{item.title}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
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
        </div>
      )}
      {coverUrl && (
        <div style={{ marginBottom: 12 }}>
          <CoverImage src={coverUrl} width={56} height={80} />
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
      {error && <p data-testid="book-error" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button data-testid="book-save" type="button" onClick={() => void handleSave()}>
        {book ? '保存' : '登録する'}
      </button>
    </div>
  )
}