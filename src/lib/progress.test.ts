import { describe, it, expect } from 'vitest'
import {
  formatDate,
  parseDate,
  todayStr,
  daysBetween,
  calcDailyTarget,
  calcScheduleStatus,
  calcDonePages,
  type BookData,
  type ProgressRecordData,
} from './progress'

const makeBook = (overrides: Partial<BookData> = {}): BookData => ({
  id: 'b1',
  title: '単語帳',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('formatDate / parseDate / todayStr', () => {
  it('formats local date as yyyy-MM-dd', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('parses yyyy-MM-dd to local date', () => {
    const d = parseDate('2026-01-05')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(5)
  })
  it('todayStr returns 10-char date', () => {
    expect(todayStr(new Date(2026, 2, 3))).toBe('2026-03-03')
  })
})

describe('daysBetween', () => {
  it('counts inclusive days from today to deadline', () => {
    expect(daysBetween('2026-01-05', '2026-01-11')).toBe(6)
  })
  it('returns 0 when deadline equals today', () => {
    expect(daysBetween('2026-01-05', '2026-01-05')).toBe(0)
  })
  it('returns negative when deadline passed', () => {
    expect(daysBetween('2026-01-10', '2026-01-05')).toBe(-5)
  })
})

describe('calcDailyTarget', () => {
  it('divides remaining pages by remaining days, rounding up', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 40, 6)).toBe(10)
  })
  it('rounds up fractional target', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 97, 6)).toBe(1)
  })
  it('returns full remaining when days <= 0', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 90, 0)).toBe(10)
    expect(calcDailyTarget({ totalPages: 100 }, 90, -3)).toBe(10)
  })
  it('returns 0 when book finished', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 100, 6)).toBe(0)
  })
})

describe('calcScheduleStatus', () => {
  it('is done when done >= totalPages', () => {
    const book = makeBook({ totalPages: 100 })
    expect(calcScheduleStatus(book, 100, '2026-01-05')).toBe('done')
  })
  it('is behind when behind expected pace', () => {
    const book = makeBook({ totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
    expect(calcScheduleStatus(book, 30, '2026-01-05')).toBe('behind')
  })
  it('is scheduled when on/above expected pace', () => {
    const book = makeBook({ totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
    expect(calcScheduleStatus(book, 50, '2026-01-05')).toBe('scheduled')
    expect(calcScheduleStatus(book, 60, '2026-01-05')).toBe('scheduled')
  })
  it('is scheduled when deadline not reached and done is 0 early on', () => {
    const book = makeBook({ totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
    expect(calcScheduleStatus(book, 0, '2026-01-01')).toBe('scheduled')
  })
})

describe('calcDonePages', () => {
  it('sums pages for the given book only', () => {
    const records: ProgressRecordData[] = [
      { id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 10 },
      { id: 'r2', bookId: 'b1', date: '2026-01-06', pages: 20 },
      { id: 'r3', bookId: 'b2', date: '2026-01-05', pages: 99 },
    ]
    expect(calcDonePages(records, 'b1')).toBe(30)
  })
  it('returns 0 when no records', () => {
    expect(calcDonePages([], 'b1')).toBe(0)
  })
})