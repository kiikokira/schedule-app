import { describe, expect, it } from 'vitest'
import { RATING_START, RATING_DIV2, RATING_DIV1, ratingBandForDiff, leagueRatingDelta, rivalRatingFor } from './leagueRating'

describe('leagueRating', () => {
  it('定数は開始1200・Div2は1500・Div1は1800', () => {
    expect(RATING_START).toBe(1200)
    expect(RATING_DIV2).toBe(1500)
    expect(RATING_DIV1).toBe(1800)
  })
  it('レート差±100以内が同等', () => {
    expect(ratingBandForDiff(0)).toBe('even')
    expect(ratingBandForDiff(99)).toBe('even')
    expect(ratingBandForDiff(-99)).toBe('even')
    expect(ratingBandForDiff(100)).toBe('above')
    expect(ratingBandForDiff(-100)).toBe('below')
  })
  it('変動幅は写真の表の範囲内で決定的', () => {
    for (const seed of ['2026-09-01', '2026-09-02', 's']) {
      expect(leagueRatingDelta('above', 'win', seed)).toBeGreaterThanOrEqual(20)
      expect(leagueRatingDelta('above', 'win', seed)).toBeLessThanOrEqual(30)
      expect(leagueRatingDelta('above', 'loss', seed)).toBeGreaterThanOrEqual(-15)
      expect(leagueRatingDelta('above', 'loss', seed)).toBeLessThanOrEqual(-5)
      const d = leagueRatingDelta('above', 'draw', seed)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(5)
      expect(leagueRatingDelta('even', 'win', seed)).toBeGreaterThanOrEqual(10)
      expect(leagueRatingDelta('even', 'win', seed)).toBeLessThanOrEqual(20)
      expect(leagueRatingDelta('even', 'loss', seed)).toBeGreaterThanOrEqual(-20)
      expect(leagueRatingDelta('even', 'loss', seed)).toBeLessThanOrEqual(-10)
      expect(leagueRatingDelta('even', 'draw', seed)).toBe(0)
      expect(leagueRatingDelta('below', 'win', seed)).toBeGreaterThanOrEqual(5)
      expect(leagueRatingDelta('below', 'win', seed)).toBeLessThanOrEqual(10)
      expect(leagueRatingDelta('below', 'loss', seed)).toBeGreaterThanOrEqual(-25)
      expect(leagueRatingDelta('below', 'loss', seed)).toBeLessThanOrEqual(-15)
      const dd = leagueRatingDelta('below', 'draw', seed)
      expect(dd).toBeGreaterThanOrEqual(-5)
      expect(dd).toBeLessThanOrEqual(0)
      expect(leagueRatingDelta('above', 'win', seed)).toBe(leagueRatingDelta('above', 'win', seed))
    }
  })
  it('相手レートは1000〜1400で決定的', () => {
    const a = rivalRatingFor('r10-0', 10)
    expect(a).toBeGreaterThanOrEqual(1000)
    expect(a).toBeLessThanOrEqual(1400)
    expect(rivalRatingFor('r10-0', 10)).toBe(a)
  })
})
