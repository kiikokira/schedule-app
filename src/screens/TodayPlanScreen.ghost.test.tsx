import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'
import TodayPlanScreen from './TodayPlanScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot } from '../data/dayplanStore'
import { saveFocusPeriods } from '../data/focusPeriods'
import { resetSchedule } from '../data/scheduleStore'

beforeEach(async () => {
  localStorage.clear()
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  await db.availability.clear()
  await db.ghostLogs.clear()
  resetSchedule()
  saveFocusPeriods([])
})

describe('ghost snapshot', () => {
  it('appends a ghost log when pages are recorded', async () => {
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: '英文法ポラリス2（応用レベル）', subject: '英語', totalPages: 100, startDate: '2026-09-01', deadline: '2026-11-30', createdAt: now, updatedAt: now } as any)
    await saveAvailabilitySlot({ id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' }, true)
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const input = await screen.findByTestId('plan-input-b1')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('plan-record-b1'))
    fireEvent.click(await screen.findByTestId('record-confirm-yes'))
    await waitFor(async () => {
      const rows = await db.ghostLogs.toArray()
      expect(rows.length).toBeGreaterThanOrEqual(1)
      expect(rows[rows.length - 1].total).toBe(10)
    })
  })
})

describe('ghost battle card', () => {
  it('shows lead text against uniform ghost', async () => {
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: '英文法ポラリス2（応用レベル）', subject: '英語', totalPages: 100, startDate: '2026-09-01', deadline: '2026-11-30', createdAt: now, updatedAt: now } as any)
    await db.records.add({ id: 'past1', bookId: 'b1', date: '2026-09-20', pages: 120 } as any)
    await saveAvailabilitySlot({ id: 'a1', weekday: 1, date: null, start: '09:00', end: '17:00' }, true)
    await db.records.add({ id: 't1', bookId: 'b1', date: '2026-09-21', pages: 60 } as any)
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('ghost-battle')).toBeInTheDocument()
    expect(within(await screen.findByTestId('ghost-battle')).getByTestId('ghost-status')).toBeInTheDocument()
  })
})
