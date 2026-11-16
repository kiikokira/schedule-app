import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
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
  if (db.adjustments) await db.adjustments.clear()
  resetSchedule()
  saveFocusPeriods([])
})

const fillBook = (id: string, over: Record<string, unknown> = {}) => {
  const now = new Date().toISOString()
  const baseTitle = id === 'b1' ? '英文法ポラリス2（応用レベル）' : id === 'c1' ? '反復本' : id
  return db.books.add({
    id,
    title: baseTitle,
    subject: '英語',
    totalPages: 100,
    startDate: '2026-09-01',
    deadline: '2026-11-30',
    createdAt: now,
    updatedAt: now,
    ...over,
  } as any)
}

describe('TodayPlanScreen progress donuts', () => {
  it('shows per-book donuts under title', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '22:00' },
      true,
    )
    await db.records.add({ id: 'r1', bookId: 'b1', date: '2026-09-21', pages: 10 } as any)
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('today-progress-donuts')).toBeInTheDocument()
    expect(screen.getByTestId('today-progress-b1')).toHaveTextContent('あと10ページ')
  })

  it('excludes unassigned slots and shows cycle units', async () => {
    await fillBook('b1', { trainFit: 'home' })
    await fillBook('c1', {
      title: '反復本',
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-21', start: '09:00', end: '10:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd2', weekday: null, date: '2026-09-21', start: '10:00', end: '11:00', onTrain: true },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd3', weekday: null, date: '2026-09-21', start: '11:00', end: '12:00', bookId: 'c1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('today-progress-donuts')).toBeInTheDocument()
    expect(screen.queryByTestId('today-progress-')).toBeNull()
    expect(screen.getByTestId('today-progress-c1')).toHaveTextContent('区画')
  })
})
