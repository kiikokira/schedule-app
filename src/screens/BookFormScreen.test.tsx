import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BookFormScreen from './BookFormScreen'
import { db } from '../db/database'

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.books.clear()
  await db.records.clear()
})

describe('BookFormScreen', () => {
  it('validates required fields before save', async () => {
    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('book-save'))
    expect(screen.getByTestId('book-error')).toHaveTextContent('タイトルを入力してください')
  })

  it('shows catalog books by default and allows picking one', () => {
    render(<BookFormScreen book={null} onDone={() => {}} />)
    expect(screen.getByTestId('catalog-search-input')).toBeInTheDocument()
    expect(screen.getByText('英文法ポラリス1（標準レベル）')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('catalog-search-input'), { target: { value: 'ポラリス' } })
    fireEvent.click(screen.getAllByRole('button', { name: /選ぶ/ })[0])
    expect((screen.getByTestId('book-title') as HTMLInputElement).value).toBe('英文法ポラリス1（標準レベル）')
    expect((screen.getByTestId('book-pages') as HTMLInputElement).value).toBe('308')
    expect((screen.getByTestId('book-subject') as HTMLInputElement).value).toBe('文法')
  })

  it('filters catalog by query', () => {
    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('catalog-search-input'), { target: { value: 'ポラリス' } })
    expect(screen.getByText('英文法ポラリス1（標準レベル）')).toBeInTheDocument()
    expect(screen.queryByText('システム英単語＜5訂版＞')).not.toBeInTheDocument()
  })

  it('shows Google Books search results and fills page count when selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'v1',
            volumeInfo: {
              title: '英単語1000',
              authors: ['Taro'],
              pageCount: 320,
              imageLinks: { thumbnail: 'http://t.co/x' },
            },
          },
        ],
      }),
    } as Response)

    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('tab-search'))
    fireEvent.change(screen.getByTestId('book-search-input'), { target: { value: '英単語' } })
    fireEvent.click(screen.getByTestId('book-search-btn'))
    expect(await screen.findByText('英単語1000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect((screen.getByTestId('book-title') as HTMLInputElement).value).toBe('英単語1000')
    expect((screen.getByTestId('book-pages') as HTMLInputElement).value).toBe('320')
  })

  it('shows a notice pointing to the catalog when Google Books fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'))
    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('tab-search'))
    fireEvent.change(screen.getByTestId('book-search-input'), { target: { value: '単語' } })
    fireEvent.click(screen.getByTestId('book-search-btn'))
    expect(await screen.findByText(/参考書一覧から選んでください/)).toBeInTheDocument()
  })

  it('validates page count is a positive integer', async () => {
    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('book-title'), { target: { value: '単語帳' } })
    fireEvent.change(screen.getByTestId('book-pages'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByTestId('book-save'))
    expect(screen.getByTestId('book-error')).toHaveTextContent(/ページ数/)
  })

  it('saves the minutes-per-page input', async () => {
    render(<BookFormScreen book={null} onDone={() => {}} onRebalance={() => {}} />)
    fireEvent.change(screen.getByTestId('book-title'), {
      target: { value: 'テスト本' },
    })
    fireEvent.change(screen.getByTestId('book-pages'), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByTestId('book-start'), {
      target: { value: '2026-09-01' },
    })
    fireEvent.change(screen.getByTestId('book-deadline'), {
      target: { value: '2026-11-30' },
    })
    fireEvent.change(screen.getByTestId('book-minutes'), {
      target: { value: '4' },
    })
    fireEvent.click(screen.getByTestId('book-save'))
    await waitFor(async () => {
      const books = await db.books.toArray()
      const created = books.find((b) => b.title === 'テスト本')
      expect(created?.minutesPerPage).toBe(4)
    })
  })

  it('does not call onRebalance when saving a new book (wired in Task 8)', async () => {
    const now = new Date().toISOString()
    await db.books.add({
      id: 'b1',
      title: '本',
      totalPages: 100,
      startDate: '2026-09-01',
      deadline: '2026-11-30',
      createdAt: now,
      updatedAt: now,
    })
    const cb = vi.fn()
    render(<BookFormScreen book={null} onDone={() => {}} onRebalance={cb} />)
    // 新規の場合は onRebalance を呼ばない仕様なので、cb が呼ばれないことを確認
    fireEvent.change(screen.getByTestId('book-title'), { target: { value: '別の本' } })
    fireEvent.change(screen.getByTestId('book-pages'), { target: { value: '50' } })
    fireEvent.change(screen.getByTestId('book-deadline'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByTestId('book-save'))
    await waitFor(() => expect(cb).not.toHaveBeenCalled())
  })

  it('stores catalogId when saving a catalog book', async () => {
    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('catalog-search-input'), { target: { value: 'システム英単語＜5訂版＞' } })
    fireEvent.click(screen.getAllByRole('button', { name: /選ぶ/ })[0])
    fireEvent.change(screen.getByTestId('book-start'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByTestId('book-deadline'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByTestId('book-save'))
    await waitFor(async () => {
      const books = await db.books.toArray()
      expect(books.some((b) => b.catalogId === 'system-tango')).toBe(true)
    })
  })
})