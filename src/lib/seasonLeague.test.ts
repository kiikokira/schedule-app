import { describe, expect, it } from 'vitest'
import { seasonIdForDate, seasonDayIndex, isSeasonFinalDay, decidePromotion } from './seasonLeague'

describe('seasonLeague', () => {
  it('anchor 2026-09-01から28日ブロックでseasonIdが決まる', () => {
    expect(seasonIdForDate('2026-09-01')).toBe('2026-09-01')
    expect(seasonIdForDate('2026-09-28')).toBe('2026-09-01')
    expect(seasonIdForDate('2026-09-29')).toBe('2026-09-29')
  })
  it('day indexは0-27、最終日は27', () => {
    expect(seasonDayIndex('2026-09-01')).toBe(0)
    expect(seasonDayIndex('2026-09-28')).toBe(27)
    expect(isSeasonFinalDay('2026-09-28')).toBe(true)
    expect(isSeasonFinalDay('2026-09-27')).toBe(false)
  })
  it('8人中上位2昇格・下位2降格', () => {
    const ids = ['a','b','c','d','e','f','g','h']
    expect(decidePromotion(ids)).toEqual({ promote: ['a','b'], demote: ['g','h'] })
  })
})
