import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import BreakdownScreen from './BreakdownScreen'
import { db } from '../db/database'

describe('BreakdownScreen', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.books.clear()
    await db.records.clear()
    await db.cycleRecords.clear()
  })
  it('renders one row per book with cover and total', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: 'LEAP', totalPages: 100, coverUrl: 'https://example.com/leap.jpg', startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
    render(<BreakdownScreen onBack={() => {}} today={today} />)
    expect(await screen.findByTestId('breakdown-row-b1')).toHaveTextContent('LEAP')
    expect(screen.getByTestId('breakdown-row-b1')).toHaveTextContent('5')
  })
  it('renders rows as display-only (no detail navigation)', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: 'LEAP', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
    render(<BreakdownScreen onBack={() => {}} today={today} />)
    const row = await screen.findByTestId('breakdown-row-b1')
    expect(row.tagName).toBe('DIV')
    expect(row.querySelector('button')).toBeNull()
  })
  it('renders cover-placeholder for a book without coverUrl', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b2', title: 'NOCOVER', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r2', bookId: 'b2', date: today, pages: 5 })
    render(<BreakdownScreen onBack={() => {}} today={today} />)
    expect(within(await screen.findByTestId('breakdown-row-b2')).getByTestId('cover-placeholder')).toBeInTheDocument()
  })
  it('shows grand total summary with pages, units and book count', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: 'SMALL', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.books.add({ id: 'b2', title: 'BIG', totalPages: 100, studyMode: 'cycles', startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b2', date: today, unitFrom: 1, unitTo: 10, round: 1 })
    render(<BreakdownScreen onBack={() => {}} today={today} />)
    const summary = await screen.findByTestId('breakdown-summary')
    expect(summary).toHaveTextContent('合計 15')
    expect(summary).toHaveTextContent('ページ5')
    expect(summary).toHaveTextContent('反復10')
    expect(summary).toHaveTextContent('2冊')
  })
  it('shows empty state when no records exist', async () => {
    const today = '2026-10-24'
    render(<BreakdownScreen onBack={() => {}} today={today} />)
    expect(await screen.findByTestId('breakdown-page')).toHaveTextContent(/まだ記録がありません/)
  })
  it('sorts books by total descending', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: 'SMALL', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.books.add({ id: 'b2', title: 'BIG', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
    await db.records.add({ id: 'r2', bookId: 'b2', date: today, pages: 50 })
    render(<BreakdownScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^breakdown-row-/)
    expect(rows).toHaveLength(2)
    expect(rows[0].getAttribute('data-testid')).toBe('breakdown-row-b2')
  })
})
