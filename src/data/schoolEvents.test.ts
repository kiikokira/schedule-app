import { describe, it, expect } from 'vitest'
import { schoolEventsForMonth } from './schoolEvents'

describe('schoolEvents', () => {
  it('returns October events sorted by day including past dates', () => {
    const oct = schoolEventsForMonth(10)
    expect(oct.length).toBeGreaterThan(0)
    expect(oct[0]).toEqual({ month: 10, day: 1, text: '中間試験発表', tone: 'exam' })
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

  it('assigns tone from the PDF text color', () => {
    const oct = schoolEventsForMonth(10)
    expect(oct.find((e) => e.text === '中間試験①')?.tone).toBe('exam')
    expect(oct.find((e) => e.text === 'ベネッセ総合学テ（1・2年）')?.tone).toBe('info')
    expect(oct.find((e) => e.text === '2年理数科SFV')?.tone).toBe('green')
    expect(oct.find((e) => e.text === '土曜補習⑦（全学年）')?.tone).toBe('plain')
    // PDF actual colors (differ from the rough guideline): 追試系は黒、課題テストは青
    expect(schoolEventsForMonth(1).find((e) => e.text === '追試')?.tone).toBe('plain')
    expect(schoolEventsForMonth(1).find((e) => e.text === '課題テスト')?.tone).toBe('info')
    expect(schoolEventsForMonth(11).find((e) => e.text === '校内選考③［作文・面接］')?.tone).toBe('plain')
  })
})
