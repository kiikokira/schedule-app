import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { useBooks } from './useBooks'
import { saveSchedule, loadSchedule, resetSchedule } from '../data/scheduleStore'
import { saveAvailabilitySlot, listAvailability } from '../data/dayplanStore'

const now = new Date().toISOString()

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.availability.clear()
  resetSchedule()
  localStorage.clear()
})

describe('useBooks removeBook', () => {
  it('removes schedule entries referencing the deleted book', async () => {
    await db.books.add({
      id: 'b1',
      title: '英単語1000',
      totalPages: 100,
      startDate: '2026-09-01',
      deadline: '2026-11-30',
      createdAt: now,
      updatedAt: now,
    } as any)
    saveSchedule([
      { bookId: 'b1', startDate: '2026-09-01', deadline: '2026-11-30' },
      { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
    ])
    const { result } = renderHook(() => useBooks())
    await act(async () => {
      await result.current.removeBook('b1')
    })
    expect(await db.books.get('b1')).toBeUndefined()
    const keys = loadSchedule().map((e) => e.bookId ?? e.catalogId)
    expect(keys).not.toContain('b1')
    expect(keys).toContain('eibunpo-polaris-2')
  })

  it('unpins availability slots pinned to the deleted book', async () => {
    await db.books.add({
      id: 'b1',
      title: '英単語1000',
      totalPages: 100,
      startDate: '2026-09-01',
      deadline: '2026-11-30',
      createdAt: now,
      updatedAt: now,
    } as any)
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '22:00', bookId: 'b1' },
      true,
    )
    const { result } = renderHook(() => useBooks())
    await act(async () => {
      await result.current.removeBook('b1')
    })
    const all = await listAvailability()
    expect(all).toHaveLength(1)
    expect(all[0].bookId).toBeUndefined()
  })
})
