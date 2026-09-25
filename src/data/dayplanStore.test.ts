import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../db/database'
import {
  listAvailability,
  saveAvailabilitySlot,
  deleteAvailabilitySlot,
  unpinBook,
  prunePastOverrides,
  listAdjustments,
  addAdjustment,
  type AvailabilitySlot,
} from './dayplanStore'

beforeEach(async () => {
  await db.availability.clear()
  await db.adjustments.clear()
})

describe('availability store', () => {
  it('saves and lists a weekday slot', async () => {
    const slot: AvailabilitySlot = {
      id: 'a1',
      weekday: 1,
      date: null,
      start: '21:00',
      end: '23:00',
    }
    await saveAvailabilitySlot(slot, true)
    const all = await listAvailability()
    expect(all).toEqual([slot])
  })

  it('updates an existing slot when isNew is false', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '20:00', end: '22:00' },
      false,
    )
    const all = await listAvailability()
    expect(all).toHaveLength(1)
    expect(all[0].start).toBe('20:00')
  })

  it('deletes a slot', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    await deleteAvailabilitySlot('a1')
    expect(await listAvailability()).toEqual([])
  })

  it('saves and lists a slot with a pinned book', async () => {
    const slot: AvailabilitySlot = {
      id: 'a1',
      weekday: 1,
      date: null,
      start: '21:00',
      end: '23:00',
      bookId: 'b1',
    }
    await saveAvailabilitySlot(slot, true)
    expect(await listAvailability()).toEqual([slot])
  })
})

describe('unpinBook', () => {
  it('clears the pinned book from matching slots and keeps the slots', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00', bookId: 'b1' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a2', weekday: 1, date: null, start: '15:00', end: '16:00', bookId: 'b2' },
      true,
    )
    await unpinBook('b1')
    const all = await listAvailability()
    expect(all).toHaveLength(2)
    expect(all.find((s) => s.id === 'a1')?.bookId).toBeUndefined()
    expect(all.find((s) => s.id === 'a2')?.bookId).toBe('b2')
  })
})

describe('prune past overrides', () => {
  beforeEach(async () => {
    await db.availability.clear()
  })

  it('deletes overrides whose date is before today only', async () => {
    await saveAvailabilitySlot(
      { id: 'past', weekday: null, date: '2026-09-20', start: '21:00', end: '23:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'today', weekday: null, date: '2026-09-22', start: '21:00', end: '23:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'future', weekday: null, date: '2026-09-23', start: '21:00', end: '23:00' },
      true,
    )
    await prunePastOverrides('2026-09-22')
    const slots = await listAvailability()
    expect(slots.map((s) => s.id).sort()).toEqual(['future', 'today'])
  })

  it('keeps weekday slots unaffected', async () => {
    await saveAvailabilitySlot(
      { id: 'wd', weekday: 2, date: null, start: '21:00', end: '23:00' },
      true,
    )
    await prunePastOverrides('2026-09-22')
    expect(await listAvailability()).toHaveLength(1)
  })

  it('does not delete when today has no past overrides', async () => {
    await prunePastOverrides('2026-09-22')
    expect(await listAvailability()).toEqual([])
  })
})

describe('adjustments store', () => {
  it('adds and lists an adjustment', async () => {
    await addAdjustment({
      id: 'j1',
      date: '2026-09-21',
      bookId: 'b1',
      kind: 'priority',
      value: 1,
    })
    expect(await listAdjustments()).toHaveLength(1)
  })
})