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

  it('maps priority options per the design intent (優先=0, 公平均分=1, 軽視=2, スキップ=3)', async () => {
    await addBook('b1', { priority: 0 })
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const select = (await screen.findByTestId('priority-select-b1')) as HTMLSelectElement
    expect(select.selectedOptions[0].textContent).toBe('優先')
    expect(screen.getByRole('option', { name: '優先' })).toHaveValue('0')
    expect(screen.getByRole('option', { name: '公平均分' })).toHaveValue('1')
    expect(screen.getByRole('option', { name: '軽視' })).toHaveValue('2')
    expect(screen.getByRole('option', { name: 'スキップ' })).toHaveValue('3')
  })

  it('allocates an unset book ahead of a 軽視 book in the 修正前 panel', async () => {
    await addBook('b1', { priority: 2, deadline: todayStr() })
    await addBook('b2', { deadline: addDays(todayStr(), 1) })
    await addBook('b3')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b3" onBack={() => {}} onSchedule={() => {}} />)
    await screen.findByText('b1')
    const before = within(await screen.findByTestId('rebalance-before'))
    expect(before.getByTestId('rebalance-before-row-b2')).toHaveTextContent('60ページ')
    expect(before.queryByTestId('rebalance-before-row-b1')).not.toBeInTheDocument()
  })

  it('favors 優先(0) over 未設定 and places 公平均分(1) below 未設定', async () => {
    await addBook('b1', { deadline: todayStr() })
    await addBook('b2', { deadline: addDays(todayStr(), 1) })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByTestId('rebalance-apply'))
    const after = within(screen.getByTestId('rebalance-after'))
    expect(after.getByTestId('rebalance-after-row-b1')).toHaveTextContent('60ページ')
    expect(after.queryByTestId('rebalance-after-row-b2')).not.toBeInTheDocument()

    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByTestId('rebalance-apply'))
    expect(after.getByTestId('rebalance-after-row-b2')).toHaveTextContent('60ページ')
    expect(after.queryByTestId('rebalance-after-row-b1')).not.toBeInTheDocument()
  })

  it('frees time for another book when the target book is skipped', async () => {
    await addBook('b1', { deadline: addDays(todayStr(), 1) })
    await addBook('b2', { totalPages: 30, deadline: todayStr() })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    await screen.findByText('b1')
    const after = within(screen.getByTestId('rebalance-after'))
    expect(after.getByTestId('rebalance-after-row-b2')).toHaveTextContent('30ページ')
    expect(after.getByTestId('rebalance-after-row-b1')).toHaveTextContent('30ページ')
    fireEvent.change(await screen.findByTestId('priority-select-b2'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByTestId('rebalance-apply'))
    expect(after.queryByTestId('rebalance-after-row-b2')).not.toBeInTheDocument()
    expect(after.getByTestId('rebalance-after-row-b1')).toHaveTextContent('60ページ')
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

  it('shows 未設定 for an unset priority', async () => {
    await addBook('b1')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const select = (await screen.findByTestId('priority-select-b1')) as HTMLSelectElement
    expect(select.value).toBe('')
    expect(screen.getByRole('option', { name: '未設定' })).toHaveValue('')
  })

  it('clearing back to 未設定 does not write priority or emit an adjustment', async () => {
    const onSchedule = vi.fn()
    await addBook('b1')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '2' },
    })
    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByTestId('rebalance-report'))
    await waitFor(() => expect(onSchedule).toHaveBeenCalled())
    const book = await db.books.get('b1')
    expect(book?.priority).toBeUndefined()
    const adjustments = await listAdjustments()
    expect(adjustments.length).toBe(0)
  })

  it('saves a priority change and records an adjustment when reporting to the plan', async () => {
    const onSchedule = vi.fn()
    await addBook('b1')
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(await screen.findByTestId('priority-select-b2'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByTestId('rebalance-report'))
    await waitFor(async () => {
      const book = await db.books.get('b2')
      expect(book?.priority).toBe(2)
      const adjustments = await listAdjustments()
      expect(adjustments.some((a) => a.kind === 'priority')).toBe(true)
    })
    expect(onSchedule).toHaveBeenCalled()
  })
})