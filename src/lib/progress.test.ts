import { describe, it, expect } from 'vitest'
import {
  formatDate,
  parseDate,
  todayStr,
  daysBetween,
  calcDailyTarget,
  calcRequiredPerDay,
  calcScheduleStatus,
  calcDonePages,
  calcTotalDone,
  currentRound,
  formatJaDate,
  recentAvgPagesPerDay,
  overallDiagnosis,
  expandCyclePairs,
  calcCycleDonePairs,
  cycleGrandTotal,
  calcCycleDailyTarget,
  currentCycleRound,
  type BookData,
  type ProgressRecordData,
  type CycleRecordData,
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

describe('formatJaDate', () => {
  it('formats a date as 月日（曜日） without a year', () => {
    expect(formatJaDate('2026-09-21')).toBe('9月21日（月）')
    expect(formatJaDate('2026-01-03')).toBe('1月3日（土）')
    expect(formatJaDate('2026-12-31')).toBe('12月31日（木）')
  })
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

describe('calcRequiredPerDay', () => {
  it('subtracts today pages and divides by remaining days excluding today', () => {
    // 残り10ページ / 期限まで5日、今日3ページ → 残り4日で7ページ = 1日2ページ
    expect(calcRequiredPerDay({ totalPages: 100 }, 90, 3, 5)).toBe(2)
  })
  it('rounds up fractional required pages', () => {
    // 残り10ページ / 今日を除いて4日、今日0ページ → 1日3ページ
    expect(calcRequiredPerDay({ totalPages: 100 }, 90, 0, 5)).toBe(3)
  })
  it('returns 0 when book will be finished today', () => {
    expect(calcRequiredPerDay({ totalPages: 100 }, 90, 10, 5)).toBe(0)
  })
  it('returns remaining pages when deadline is today or passed', () => {
    expect(calcRequiredPerDay({ totalPages: 100 }, 90, 5, 0)).toBe(5)
    expect(calcRequiredPerDay({ totalPages: 100 }, 90, 0, -3)).toBe(10)
  })
  it('returns remaining pages when no days after today', () => {
    expect(calcRequiredPerDay({ totalPages: 100 }, 90, 5, 1)).toBe(5)
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

describe('calcTotalDone', () => {
  it('adds initialDonePages to recorded pages', () => {
    const book = makeBook({ id: 'b1', initialDonePages: 120 })
    const records: ProgressRecordData[] = [
      { id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 10 },
      { id: 'r2', bookId: 'b2', date: '2026-01-05', pages: 99 },
    ]
    expect(calcTotalDone(book, records)).toBe(130)
  })
  it('treats missing initialDonePages as 0', () => {
    const book = makeBook({ id: 'b1' })
    const records: ProgressRecordData[] = [
      { id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 10 },
    ]
    expect(calcTotalDone(book, records)).toBe(10)
  })
  it('returns initialDonePages alone when no records', () => {
    const book = makeBook({ id: 'b1', initialDonePages: 50 })
    expect(calcTotalDone(book, [])).toBe(50)
  })
})

describe('currentRound', () => {
  it('stays on 1周目 through the first pass of the whole book', () => {
    expect(currentRound(0, 308)).toBe(1)
    expect(currentRound(1, 308)).toBe(1)
    expect(currentRound(308, 308)).toBe(1)
  })

  it('moves to 2周目 once the recorded pages pass the total', () => {
    expect(currentRound(309, 308)).toBe(2)
    expect(currentRound(616, 308)).toBe(2)
  })

  it('continues to further rounds', () => {
    expect(currentRound(617, 308)).toBe(3)
  })

  it('returns 1周目 for a zero or missing total', () => {
    expect(currentRound(10, 0)).toBe(1)
  })
})

describe('recentAvgPagesPerDay', () => {
  const rec = (id: string, date: string, pages: number): ProgressRecordData => ({
    id,
    bookId: 'b1',
    date,
    pages,
  })

  it('averages only the last 7 days including today', () => {
    const records = [
      rec('r1', '2026-01-04', 10),
      rec('r2', '2026-01-06', 20),
      rec('r3', '2026-01-10', 40),
    ]
    // (10 + 20 + 40) / 7 = 10
    expect(recentAvgPagesPerDay(records, '2026-01-10')).toBe(10)
  })

  it('ignores records older than the window', () => {
    const records = [rec('r1', '2026-01-03', 700), rec('r2', '2026-01-09', 14)]
    // 2026-01-03 は窓(01-04〜01-10)の外。14 / 7 = 2
    expect(recentAvgPagesPerDay(records, '2026-01-10')).toBe(2)
  })

  it('returns 0 when there are no records in the window', () => {
    expect(recentAvgPagesPerDay([], '2026-01-10')).toBe(0)
    expect(
      recentAvgPagesPerDay([rec('r1', '2025-01-04', 100)], '2026-01-10'),
    ).toBe(0)
  })
})

describe('overallDiagnosis', () => {
  const makeBook = (overrides: Partial<BookData> = {}): BookData => ({
    id: 'b1',
    title: '単語帳',
    totalPages: 100,
    startDate: '2026-01-01',
    deadline: '2026-02-11',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
  const rec = (id: string, bookId: string, date: string, pages: number): ProgressRecordData => ({
    id,
    bookId,
    date,
    pages,
  })

  it('spreads the remaining pages evenly over all days until the latest deadline', () => {
    const books = [
      makeBook({ id: 'b1', totalPages: 100, deadline: '2026-02-11' }),
      makeBook({ id: 'b2', totalPages: 100, deadline: '2026-01-11' }),
    ]
    const records = [rec('r1', 'b1', '2026-01-09', 40)]
    // 残り 160 ページ / 2026-01-11〜2026-02-11 の31日 = 切り上げ6ページ
    const d = overallDiagnosis(books, records, '2026-01-11')
    expect(d.remainingPages).toBe(160)
    expect(d.requiredPerDay).toBe(6)
    expect(d.endDate).toBe('2026-02-11')
  })

  it('is behind when the recent pace is slower than the required per-day pages', () => {
    const books = [makeBook({ id: 'b1', totalPages: 100, deadline: '2026-02-11' })]
    const records = [rec('r1', 'b1', '2026-01-09', 14)]
    const d = overallDiagnosis(books, records, '2026-01-11')
    // 必要4ページ/日、直近7日実績 14/7 = 2/日 → 遅れ
    expect(d.behind).toBe(true)
  })

  it('is not behind when the recent pace meets the requirement', () => {
    const books = [makeBook({ id: 'b1', totalPages: 100, deadline: '2026-02-11' })]
    const records = [rec('r1', 'b1', '2026-01-09', 42)]
    const d = overallDiagnosis(books, records, '2026-01-11')
    // 必要4ページ/日、直近7日実績 42/7 = 6/日 → 順調
    expect(d.behind).toBe(false)
  })

  it('is not behind and returns zero pace when there are no books', () => {
    const d = overallDiagnosis([], [], '2026-01-11')
    expect(d.remainingPages).toBe(0)
    expect(d.requiredPerDay).toBe(0)
    expect(d.behind).toBe(false)
  })

  it('subtracts initialDonePages from remaining pages', () => {
    const books = [makeBook({ id: 'b1', totalPages: 300, initialDonePages: 120, deadline: '2026-02-11' })]
    const d = overallDiagnosis(books, [], '2026-01-11')
    // 残り 180 ページ
    expect(d.remainingPages).toBe(180)
  })

  it('反復本を残りページから除外する', () => {
    const books = [
      makeBook({ id: 'b1', totalPages: 100, deadline: '2026-02-11' }),
      makeBook({ id: 'b2', totalPages: 576, studyMode: 'cycles', totalUnits: 20, targetRounds: 3, deadline: '2026-02-11' }),
    ]
    const d = overallDiagnosis(books, [], '2026-01-11')
    expect(d.remainingPages).toBe(100)
  })
})

describe('cycle progress', () => {
  const rec = (id: string, unitFrom: number, unitTo: number, round: number): CycleRecordData => ({
    id, bookId: 'b1', date: '2026-01-05', unitFrom, unitTo, round,
  })

  it('重なった範囲を二重計上せず distinct で数える', () => {
    const records = [rec('r1', 1, 5, 1), rec('r2', 4, 8, 1)]
    expect(expandCyclePairs(records).size).toBe(8)
    expect(calcCycleDonePairs({}, records)).toBe(8)
  })

  it('初期完了分を加算し総量と毎日の目標を計算する', () => {
    const book = { totalUnits: 10, targetRounds: 3, initialDoneUnits: 10 }
    expect(cycleGrandTotal(book)).toBe(30)
    // 完了 10 + 記録 8 = 18、残り 12 / 6日 = 2区画/日
    const done = calcCycleDonePairs(book, [rec('r1', 1, 8, 2)])
    expect(done).toBe(18)
    expect(calcCycleDailyTarget(book, done, 6)).toBe(2)
  })

  it('未完の最小周回を返す', () => {
    const book = { totalUnits: 5, targetRounds: 3 }
    const records = [rec('r1', 1, 5, 1), rec('r2', 1, 2, 2)]
    expect(currentCycleRound(book, records)).toBe(2)
  })

  it('完了時は0、期限切れ時は残り全部を返す', () => {
    const book = { totalUnits: 10, targetRounds: 1 }
    expect(calcCycleDailyTarget(book, 10, 5)).toBe(0)
    expect(calcCycleDailyTarget(book, 4, 0)).toBe(6)
  })
})