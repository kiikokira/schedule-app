import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BookFormScreen from './BookFormScreen'

beforeEach(() => {
  vi.restoreAllMocks()
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
    expect(screen.getByText('英文法ポラリス1 Final')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('catalog-search-input'), { target: { value: 'ポラリス' } })
    fireEvent.click(screen.getAllByRole('button', { name: /選ぶ/ })[0])
    expect((screen.getByTestId('book-title') as HTMLInputElement).value).toBe('英文法ポラリス1 Final')
    expect((screen.getByTestId('book-pages') as HTMLInputElement).value).toBe('360')
    expect((screen.getByTestId('book-subject') as HTMLInputElement).value).toBe('文法')
  })

  it('filters catalog by query', () => {
    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('catalog-search-input'), { target: { value: 'ポラリス' } })
    expect(screen.getByText('英文法ポラリス1 Final')).toBeInTheDocument()
    expect(screen.queryByText('システム英単語 5訂版')).not.toBeInTheDocument()
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
})