import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    render(<BreakdownScreen onBack={() => {}} onOpenBook={() => {}} today={today} />)
    expect(await screen.findByTestId('breakdown-row-b1')).toHaveTextContent('LEAP')
    expect(screen.getByTestId('breakdown-row-b1')).toHaveTextContent('5')
  })
  it('calls onOpenBook with bookId on row tap', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: 'LEAP', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
    const onOpen = vi.fn()
    render(<BreakdownScreen onBack={() => {}} onOpenBook={onOpen} today={today} />)
    fireEvent.click(await screen.findByTestId('breakdown-row-b1'))
    expect(onOpen).toHaveBeenCalledWith('b1')
  })
})
