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

  it('shows search results and fills page count when selected', async () => {
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
    fireEvent.change(screen.getByTestId('book-search-input'), { target: { value: '英単語' } })
    fireEvent.click(screen.getByTestId('book-search-btn'))
    expect(await screen.findByText('英単語1000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect((screen.getByTestId('book-title') as HTMLInputElement).value).toBe('英単語1000')
    expect((screen.getByTestId('book-pages') as HTMLInputElement).value).toBe('320')
  })

  it('validates page count is a positive integer', async () => {
    render(<BookFormScreen book={null} onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('book-title'), { target: { value: '単語帳' } })
    fireEvent.change(screen.getByTestId('book-pages'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByTestId('book-save'))
    expect(screen.getByTestId('book-error')).toHaveTextContent(/ページ数/)
  })
})