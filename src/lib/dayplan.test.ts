import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MINUTES_PER_PAGE,
  minutesPerPageFor,
  parseTimeToMin,
  slotsForDate,
} from './dayplan'
import type { AvailabilitySlot } from '../data/dayplanStore'

const weekSlot = (weekday: number, start: string, end: string): AvailabilitySlot => ({
  id: `w${weekday}`,
  weekday,
  date: null,
  start,
  end,
})

const dateSlot = (date: string, start: string, end: string): AvailabilitySlot => ({
  id: `d-${date}-${start}`,
  weekday: null,
  date,
  start,
  end,
})

describe('parseTimeToMin', () => {
  it('converts HH:mm to minutes of day', () => {
    expect(parseTimeToMin('00:00')).toBe(0)
    expect(parseTimeToMin('21:00')).toBe(1260)
    expect(parseTimeToMin('23:30')).toBe(1410)
  })
})

describe('minutesPerPageFor', () => {
  it('returns the explicit value when set', () => {
    expect(minutesPerPageFor('英語', 4)).toBe(4)
  })
  it('returns per-subject default when no explicit value', () => {
    expect(minutesPerPageFor('英単語', undefined)).toBe(1)
    expect(minutesPerPageFor('英文法', undefined)).toBe(2)
    expect(minutesPerPageFor('英語', undefined)).toBe(3)
  })
  it('returns DEFAULT when subject unknown', () => {
    expect(minutesPerPageFor(undefined, undefined)).toBe(DEFAULT_MINUTES_PER_PAGE)
  })
})

describe('slotsForDate', () => {
  it('resolves weekday slots for a Monday (2026-09-21 is a Monday)', () => {
    const slots = slotsForDate(
      [weekSlot(1, '21:00', '23:00'), weekSlot(6, '09:00', '12:00')],
      '2026-09-21',
    )
    expect(slots).toEqual([{ startMin: 1260, endMin: 1380 }])
  })

  it('prefers date overrides over weekday slots', () => {
    const slots = slotsForDate(
      [weekSlot(1, '21:00', '23:00'), dateSlot('2026-09-21', '07:00', '08:00')],
      '2026-09-21',
    )
    expect(slots).toEqual([{ startMin: 420, endMin: 480 }])
  })

  it('sorts slots by start time and truncates slots that cross midnight', () => {
    const slots = slotsForDate(
      [weekSlot(1, '23:00', '25:00'), weekSlot(1, '20:00', '21:00')],
      '2026-09-21',
    )
    expect(slots).toEqual([{ startMin: 1200, endMin: 1260 }])
  })
})