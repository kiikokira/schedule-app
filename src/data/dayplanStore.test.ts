import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../db/database'
import {
  listAvailability,
  saveAvailabilitySlot,
  deleteAvailabilitySlot,
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