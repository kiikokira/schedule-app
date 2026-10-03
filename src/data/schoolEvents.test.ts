import { describe, it, expect } from 'vitest'
import { schoolEventsForMonth } from './schoolEvents'

describe('schoolEvents', () => {
  it('returns October events sorted by day including past dates', () => {
    const oct = schoolEventsForMonth(10)
    expect(oct.length).toBeGreaterThan(0)
    expect(oct[0]).toEqual({ month: 10, day: 1, text: '中間試験発表' })
    const days = oct.map((e) => e.day)
    expect([...days].sort((a, b) => a - b)).toEqual(days)
  })

  it('returns February exam events', () => {
    const feb = schoolEventsForMonth(2)
    expect(feb.map((e) => e.text)).toContain('学年末試験①')
  })

  it('does not include other months', () => {
    expect(schoolEventsForMonth(10).every((e) => e.month === 10)).toBe(true)
    expect(schoolEventsForMonth(3).every((e) => e.month === 3)).toBe(true)
  })
})
