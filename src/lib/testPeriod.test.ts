import { describe, expect, it } from 'vitest'
import { testPeriodForDate } from './testPeriod'

describe('testPeriodForDate', () => {
  it('中間テストは発表日から最後の試験日の前日まで', () => {
    expect(testPeriodForDate('2026-10-01')).toEqual({
      name: '中間テスト',
      startDate: '2026-10-01',
      endDate: '2026-10-13',
    })
    expect(testPeriodForDate('2026-10-13')).not.toBeNull()
    expect(testPeriodForDate('2026-10-14')).toBeNull()
    expect(testPeriodForDate('2026-09-30')).toBeNull()
  })

  it('期末テストは最終試験日の前日まで', () => {
    expect(testPeriodForDate('2026-11-18')).toEqual({
      name: '期末テスト',
      startDate: '2026-11-18',
      endDate: '2026-11-30',
    })
    expect(testPeriodForDate('2026-11-17')).toBeNull()
    expect(testPeriodForDate('2026-12-01')).toBeNull()
  })

  it('学年末テストは最終試験日の前日まで', () => {
    expect(testPeriodForDate('2027-02-10')).toEqual({
      name: '学年末テスト',
      startDate: '2027-02-10',
      endDate: '2027-02-25',
    })
    expect(testPeriodForDate('2027-02-26')).toBeNull()
  })

  it('不正な日付は null', () => {
    expect(testPeriodForDate('')).toBeNull()
    expect(testPeriodForDate('2026-1-1')).toBeNull()
  })
})
