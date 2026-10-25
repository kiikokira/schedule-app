import { describe, expect, it, beforeEach } from 'vitest'
import { LEAGUE_BADGE_DEFS, awardPhaseBadge, loadLeagueBadges } from './leagueBadges'

describe('leagueBadges', () => {
  beforeEach(() => localStorage.clear())
  it('6種の定義があり画像パスを持つ', () => {
    expect(Object.keys(LEAGUE_BADGE_DEFS)).toEqual(['div3', 'div2', 'div1', 'top1000', 'top100', 'top10'])
    for (const def of Object.values(LEAGUE_BADGE_DEFS)) {
      expect(def.img).toMatch(/^(\.\/)?badges\/badge-.+\.jpg$/)
      expect(def.name.length).toBeGreaterThan(0)
    }
  })
  it('最高到達Div3でdiv3を1個だけ付与する', () => {
    const got = awardPhaseBadge('2026-09-01', { bestDiv: 3, finalRank: 500000, played: 5 })
    expect(got).toHaveLength(1)
    expect(loadLeagueBadges().awards.map((a) => a.badgeId)).toEqual(['div3'])
  })
  it('複数条件を満たしても最高グレード1個のみ', () => {
    const got = awardPhaseBadge('2026-09-01', { bestDiv: 1, finalRank: 5, played: 10 })
    expect(got).toHaveLength(1)
    expect(loadLeagueBadges().awards[0].badgeId).toBe('top10')
  })
  it('1試合未満では付与しない', () => {
    expect(awardPhaseBadge('2026-09-01', { bestDiv: 1, finalRank: 1, played: 0 })).toEqual([])
    expect(loadLeagueBadges().awards).toEqual([])
  })
  it('最終順位Top1000でtop1000を付与する', () => {
    const got = awardPhaseBadge('2026-09-01', { bestDiv: 9, finalRank: 1000, played: 3 })
    expect(got).toEqual(['2026-09-01:top1000'])
  })
})
