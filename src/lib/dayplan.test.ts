import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MINUTES_PER_PAGE,
  effectiveSpeed,
  generateDayPlan,
  improvePlan,
  learnSpeed,
  minutesPerPageFor,
  parseTimeToMin,
  planScore,
  slotsForDate,
  type ScheduledBook,
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

const book = (partial: Partial<ScheduledBook> = {}): ScheduledBook => ({
  bookId: 'b1',
  donePages: 0,
  totalPages: 100,
  minutesPerPage: 2,
  startDate: '2026-09-21',
  deadline: '2026-11-30',
  ...partial,
})

const slot = (startMin: number, endMin: number, bookId: string, pages: number) => ({
  startMin,
  endMin,
  bookId,
  pages,
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

describe('generateDayPlan', () => {
  it('allocates the day to a high-need book filling whole 15-minute slots', () => {
    // 期限9/25: 残り4日で100ページ → 1日25ページ = 50分。60分(4スロット)が入る
    const out = generateDayPlan({
      availability: [weekSlot(1, '21:00', '23:00')],
      books: [
        book({
          bookId: 'b1',
          totalPages: 100,
          donePages: 0,
          minutesPerPage: 2,
          deadline: '2026-09-25',
        }),
      ],
      today: '2026-09-21',
    })
    expect(out.today.slots).toEqual([slot(1260, 1320, 'b1', 30)])
  })

  it('assigns the highest-priority book to the first slot', () => {
    const out = generateDayPlan({
      availability: [weekSlot(1, '21:00', '22:30')],
      books: [
        book({ bookId: 'b1', totalPages: 300, minutesPerPage: 2 }),
        book({ bookId: 'b2', totalPages: 300, minutesPerPage: 2 }),
      ],
      today: '2026-09-21',
    })
    expect(out.today.slots[0].bookId).toBe('b1')
    expect(out.today.totalMinutes).toBe(90)
  })

  it('carries over the deficit from past days into today and shows a notice', () => {
    // 2026-09-19 開始、2026-09-21 が今日。2日経過、実績0ページ → deficit > 0
    const out = generateDayPlan({
      availability: [weekSlot(1, '21:00', '23:00')],
      books: [
        book({
          bookId: 'b1',
          totalPages: 100,
          donePages: 0,
          startDate: '2026-09-19',
          deadline: '2026-11-30',
          minutesPerPage: 2,
        }),
      ],
      today: '2026-09-21',
    })
    expect(out.today.slots[0].bookId).toBe('b1')
    expect(out.notice).toBe('前日までの不足分を今日の空き時間に再配置しました')
  })

  it('returns empty today slots and a notice when there is no availability', () => {
    const out = generateDayPlan({
      availability: [],
      books: [book({ bookId: 'b1' })],
      today: '2026-09-21',
    })
    expect(out.today.slots).toEqual([])
    expect(out.notice).toBe('今日の空き時間がありません')
  })

  it('excludes finished and future-start books from today', () => {
    const out = generateDayPlan({
      availability: [weekSlot(1, '21:00', '23:00')],
      books: [
        book({ bookId: 'b1', donePages: 100, totalPages: 100 }),
        book({ bookId: 'b2', startDate: '2026-10-01' }),
      ],
      today: '2026-09-21',
    })
    expect(out.today.slots).toEqual([])
  })

  it('respects allottedRatio as an upper bound of the day minutes', () => {
    const out = generateDayPlan({
      availability: [weekSlot(1, '21:00', '23:00')],
      books: [
        book({ bookId: 'b1', allottedRatio: 0.25, minutesPerPage: 2 }),
        book({ bookId: 'b2', minutesPerPage: 2 }),
      ],
      today: '2026-09-21',
    })
    const b1Min = out.today.slots
      .filter((s) => s.bookId === 'b1')
      .reduce((sum, s) => sum + (s.endMin - s.startMin), 0)
    expect(b1Min).toBeLessThanOrEqual(30) // 120分の25%
  })

  it('generateDayPlan runs within a few milliseconds', () => {
    const books: ScheduledBook[] = Array.from({ length: 30 }, (_, i) =>
      book({
        bookId: `b${i}`,
        totalPages: 200,
        donePages: 0,
        minutesPerPage: 2,
        deadline: i % 2 === 0 ? '2026-10-01' : '2026-11-30',
      }),
    )
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) {
      generateDayPlan({
        availability: [weekSlot(1, '18:00', '22:00')],
        books,
        today: '2026-09-21',
      })
    }
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(200) // 20回で200ms → 1回10ms以内
  })

  it('builds upcoming summaries for the next days', () => {
    const out = generateDayPlan({
      availability: [weekSlot(1, '21:00', '23:00'), weekSlot(2, '21:00', '23:00')],
      books: [book({ bookId: 'b1', minutesPerPage: 2 })],
      today: '2026-09-21',
      horizonDays: 2,
    })
    expect(out.upcoming).toHaveLength(2)
    expect(out.upcoming[0].date).toBe('2026-09-22')
    expect(out.upcoming[0].items.length).toBeGreaterThan(0)
  })
})

it('planScore prefers fewer switches', () => {
  const contiguous = [slot(0, 30, 'b1', 5), slot(30, 60, 'b1', 5)]
  const switching = [slot(0, 30, 'b1', 5), slot(30, 60, 'b2', 5)]
  expect(planScore(contiguous)).toBeGreaterThan(planScore(switching))
})

it('improvePlan merges adjacent same-book slots', () => {
  const merged = improvePlan([slot(0, 30, 'b1', 5), slot(30, 60, 'b1', 5)])
  expect(merged).toEqual([{ startMin: 0, endMin: 60, bookId: 'b1', pages: 10 }])
})

it('learnSpeed blends current with effective speed', () => {
  // 30分で10ページ → 実効3分/頁。現行2分/頁 → 2*0.7 + 3*0.3 = 2.3
  expect(learnSpeed(2, 30, 10)).toBeCloseTo(2.3)
})

it('learnSpeed rejects pages=0 or minutes=0 (keeps current)', () => {
  expect(learnSpeed(2, 0, 10)).toBe(2)
  expect(learnSpeed(2, 30, 0)).toBe(2)
})

it('learnSpeed ignores abnormal ratios (speed outside 0.1..120 min/page)', () => {
  expect(learnSpeed(2, 10, 1000)).toBe(2) // 0.01分/頁 → 範囲外は無視
  expect(learnSpeed(2, 1000, 5)).toBe(2) // 200分/頁 → 範囲外は無視
})

it('effectiveSpeed falls back to per-subject default', () => {
  expect(effectiveSpeed(undefined, '英単語')).toBe(1)
  expect(effectiveSpeed(4, '英単語')).toBe(4)
})