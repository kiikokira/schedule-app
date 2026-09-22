import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import RebalanceScreen from './RebalanceScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot, listAdjustments } from '../data/dayplanStore'
import { addDays } from '../lib/dayplan'
import { todayStr } from '../lib/progress'

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.availability.clear()
  if (db.adjustments) await db.adjustments.clear()
})

const addBook = async (id: string, over: Record<string, unknown> = {}) => {
  const now = new Date().toISOString()
  const today = todayStr()
  await db.books.add({
    id,
    title: id,
    totalPages: 200,
    startDate: today,
    deadline: addDays(today, 90),
    minutesPerPage: 2,
    createdAt: now,
    updatedAt: now,
    ...over,
  } as any)
}

const seedDaySlot = async () => {
  await saveAvailabilitySlot(
    { id: 'a1', weekday: null, date: todayStr(), start: '21:00', end: '23:00' },
    true,
  )
}

describe('RebalanceScreen', () => {
  it('shows before and after plans', async () => {
    await addBook('b1', { deadline: addDays(todayStr(), 60) })
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    expect(await screen.findByTestId('rebalance-before')).toBeInTheDocument()
    expect(await screen.findByTestId('rebalance-after')).toBeInTheDocument()
    expect(await screen.findByText('b1')).toBeInTheDocument()
    expect(await screen.findByText('b2')).toBeInTheDocument()
  })

  it('keeps the equal-share plan when the target book is skipped', async () => {
    await addBook('b1', { totalPages: 800 })
    await addBook('b2', { totalPages: 200 })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    fireEvent.change(await screen.findByTestId('priority-select-b2'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByTestId('rebalance-apply'))
    const after = screen.getByTestId('rebalance-after')
    expect(within(after).getByTestId('rebalance-after-row-b1')).toHaveTextContent('15ページ')
    expect(within(after).queryByTestId('rebalance-after-row-b2')).not.toBeInTheDocument()
  })

  it('applies the new ratio and recomputes the plan', async () => {
    await addBook('b1')
    await addBook('b2', { totalPages: 3000 })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    fireEvent.change(await screen.findByTestId('ratio-input-b2'), {
      target: { value: '0.5' },
    })
    fireEvent.click(screen.getByTestId('rebalance-apply'))
    expect((screen.getByTestId('ratio-input-b2') as HTMLInputElement).value).toBe('0.5')
    const after = within(screen.getByTestId('rebalance-after'))
    expect(after.getByTestId('rebalance-after-row-b2')).toHaveTextContent('60分')
  })

  it('saves the ratio and records an adjustment when reporting to the plan', async () => {
    const onSchedule = vi.fn()
    await addBook('b1')
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(await screen.findByTestId('ratio-input-b2'), {
      target: { value: '0.5' },
    })
    fireEvent.click(screen.getByTestId('rebalance-report'))
    await waitFor(async () => {
      const book = await db.books.get('b2')
      expect(book?.allottedRatio).toBe(0.5)
      const adjustments = await listAdjustments()
      expect(adjustments.length).toBeGreaterThan(0)
      expect(adjustments[0].kind).toBe('ratio')
    })
    expect(onSchedule).toHaveBeenCalled()
  })

  it('saves a priority change and records an adjustment when reporting to the plan', async () => {
    const onSchedule = vi.fn()
    await addBook('b1')
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(await screen.findByTestId('priority-select-b2'), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByTestId('rebalance-report'))
    await waitFor(async () => {
      const book = await db.books.get('b2')
      expect(book?.priority).toBe(1)
      const adjustments = await listAdjustments()
      expect(adjustments.some((a) => a.kind === 'priority')).toBe(true)
    })
    expect(onSchedule).toHaveBeenCalled()
  })
})