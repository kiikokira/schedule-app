import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../db/database'
import PlanScreen from './PlanScreen'

const pad = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
})

describe('PlanScreen', () => {
  it('shows schedule phases with deadline dates', () => {
    render(<PlanScreen onDone={() => {}} />)
    expect(screen.getByText('学習スケジュールを登録')).toBeInTheDocument()
    expect(screen.getByText(/2028-08-31/)).toBeInTheDocument()
    expect(screen.getByText('関正生のThe Rules英語長文問題集1 入試基礎')).toBeInTheDocument()
  })

  it('registers all schedule books with deadlines when none exist', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('apply-schedule'))
    expect(await screen.findByTestId('apply-result')).toHaveTextContent('新規 20 冊')
    const books = await db.books.toArray()
    expect(books).toHaveLength(20)
    const leap = books.find((b) => b.catalogId === 'leap')
    expect(leap?.deadline).toBe('2027-07-15')
    expect(leap?.startDate).toBe(localDateStr(new Date()))
    expect(leap?.coverUrl).toMatch(/^https:\/\//)
  })

  it('updates deadline of an existing registered book', async () => {
    await db.books.add({
      id: 'b1',
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      subject: '英単語',
      totalPages: 576,
      coverUrl: 'https://example.com/leap.jpg',
      startDate: '2026-04-01',
      deadline: '2026-06-01',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('apply-schedule'))
    expect(await screen.findByTestId('apply-result')).toHaveTextContent(
      '新規 19 冊 / 期限を更新 1 冊',
    )
    const books = await db.books.toArray()
    const leap = books.find((b) => b.id === 'b1')
    expect(leap?.deadline).toBe('2027-07-15')
    expect(leap?.startDate).toBe('2026-04-01')
    expect(leap?.coverUrl).toBe('https://example.com/leap.jpg')
  })
})