import type { AvailabilitySlot } from '../data/dayplanStore'
import { parseDate } from './progress'

export const DEFAULT_MINUTES_PER_PAGE = 2

const SUBJECT_MINUTES_PER_PAGE: Record<string, number> = {
  英単語: 1,
  英熟語: 1,
  英文法: 2,
  英語: 3,
  英語長文: 3,
  小論文: 3,
  英作文: 3,
}

export function minutesPerPageFor(
  subject: string | undefined,
  minutesPerPage: number | undefined,
): number {
  if (minutesPerPage !== undefined && Number.isFinite(minutesPerPage) && minutesPerPage > 0) {
    return minutesPerPage
  }
  if (subject && SUBJECT_MINUTES_PER_PAGE[subject] !== undefined) {
    return SUBJECT_MINUTES_PER_PAGE[subject]
  }
  return DEFAULT_MINUTES_PER_PAGE
}

export type TimeSlot = { startMin: number; endMin: number }

export function parseTimeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function slotsForDate(
  availability: AvailabilitySlot[],
  date: string,
): TimeSlot[] {
  const dateOverrides = availability
    .filter((a) => a.date === date)
    .sort((a, b) => parseTimeToMin(a.start) - parseTimeToMin(b.start))
  if (dateOverrides.length > 0) {
    return dateOverrides
      .map((a) => ({ startMin: parseTimeToMin(a.start), endMin: parseTimeToMin(a.end) }))
      .filter((s) => s.endMin > s.startMin && s.endMin <= 1440)
  }
  const d = parseDate(date)
  const weekday = d.getDay()
  return availability
    .filter((a) => a.weekday === weekday)
    .sort((a, b) => parseTimeToMin(a.start) - parseTimeToMin(b.start))
    .map((a) => ({ startMin: parseTimeToMin(a.start), endMin: parseTimeToMin(a.end) }))
    .filter((s) => s.endMin > s.startMin && s.endMin <= 1440)
}