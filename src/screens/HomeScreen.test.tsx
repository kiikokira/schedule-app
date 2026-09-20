import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import HomeScreen from './HomeScreen'

const pad = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localDateStr(d)
}

const book = {
  id: 'b1',
  title: '英単語1000',
  totalPages: 100,
  startDate: daysAgo(30),
  deadline: daysAgo(1),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
})

describe('HomeScreen', () => {
  it('shows book title and today target on the card', async () => {
    await db.books.add({ ...book, id: 'b1', deadline: daysAgo(1) })
    render(<HomeScreen onOpenBook={() => {}} />)
    expect(await screen.findByText('英単語1000')).toBeInTheDocument()
  })

  it('shows 遅れ status when behind pace', async () => {
    await db.books.add({ ...book, id: 'b1', deadline: daysAgo(1) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 10 })
    render(<HomeScreen onOpenBook={() => {}} />)
    const card = await screen.findByTestId('book-card-b1')
    expect(card).toHaveTextContent('遅れ')
  })

  it('calls onOpenBook when card clicked', async () => {
    await db.books.add({ ...book, id: 'b1', deadline: daysAgo(1) })
    const onOpen = vi.fn()
    render(<HomeScreen onOpenBook={onOpen} />)
    const card = await screen.findByTestId('book-card-b1')
    card.click()
    expect(onOpen).toHaveBeenCalledWith('b1')
  })
})