import { renderHook, act, waitFor } from '@testing-library/react'
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

  it('normalizes a LEAP book with wrong totalUnits to 2300 words on load', async () => {
    await db.books.add({
      id: 'leap-1',
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 23,
      targetRounds: 4,
      startDate: '2026-09-26',
      deadline: '2026-10-15',
      createdAt: now,
      updatedAt: now,
    } as any)
    const { result } = renderHook(() => useBooks())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.books[0].totalUnits).toBe(2300)
    expect(result.current.books[0].targetRounds).toBe(4)
    expect((await db.books.get('leap-1'))?.totalUnits).toBe(2300)
  })
})
