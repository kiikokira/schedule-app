import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import BookDetailScreen from './BookDetailScreen'

const pad = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysFromNow = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

const book = {
  id: 'b1',
  title: '英単語1000',
  totalPages: 100,
  startDate: daysFromNow(0),
  deadline: daysFromNow(10),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  vi.restoreAllMocks()
})

describe('BookDetailScreen', () => {
  it('shows today target and remaining pages', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('book-title')).toHaveTextContent('英単語1000')
    // 100ページ / 期限まで6日 = 17ページ（切り上げ）
    expect(screen.getByTestId('today-target')).toHaveTextContent('17')
  })

  it('records today progress and shows updated total', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.change(await screen.findByTestId('progress-input'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('record-progress'))
    await waitFor(() => expect(screen.getByTestId('done-count')).toHaveTextContent('10'))
  })

  it('overwrites same-day record', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 4 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.change(await screen.findByTestId('progress-input'), { target: { value: '7' } })
    fireEvent.click(screen.getByTestId('record-progress'))
    await waitFor(() => expect(screen.getByTestId('done-count')).toHaveTextContent('7'))
  })

  it('shows required pages per day, updating live as the input changes', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    const line = await screen.findByTestId('required-per-day')
    // 100ページ / 今日を除く5日 = 1日20ページ
    expect(line).toHaveTextContent('今日 0 ページを進める場合、期限まで1日あたり 20 ページ')
    fireEvent.change(await screen.findByTestId('progress-input'), { target: { value: '10' } })
    // (100 - 10) / 5日 = 1日18ページ
    expect(screen.getByTestId('required-per-day')).toHaveTextContent(
      '今日 10 ページを進める場合、期限まで1日あたり 18 ページ',
    )
  })

  it('reflects today record in the required pages per day', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    await db.records.add({
      id: 'r1',
      bookId: 'b1',
      date: localDateStr(new Date()),
      pages: 40,
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    // (100 - 40) / 5日 = 1日12ページ
    expect(await screen.findByTestId('required-per-day')).toHaveTextContent(
      '今日 40 ページを進める場合、期限まで1日あたり 12 ページ',
    )
  })
})