import { describe, expect, it, beforeEach } from 'vitest'
import {
  MAX_EQUIPPED_BADGES,
  badgeIdForDiv,
  ensureLeagueBadgeForSeason,
  loadLeagueBadges,
  seasonLabel,
  toggleBadgeEquipped,
} from './leagueBadges'

describe('leagueBadges', () => {
  beforeEach(() => localStorage.clear())
  it('Div1〜3到達で当季バッジを付与し二重付与しない', () => {
    expect(ensureLeagueBadgeForSeason('2026-09-29', 2)).toEqual(['2026-09-29:div2'])
    expect(ensureLeagueBadgeForSeason('2026-09-29', 2)).toEqual([])
    expect(loadLeagueBadges().awards).toHaveLength(1)
  })
  it('Div4以下・不正入力では付与しない', () => {
    expect(ensureLeagueBadgeForSeason('2026-09-29', 4)).toEqual([])
    expect(ensureLeagueBadgeForSeason('xxx', 1)).toEqual([])
    expect(loadLeagueBadges().awards).toHaveLength(0)
  })
  it('別シーズンは別バッジとして付与する', () => {
    ensureLeagueBadgeForSeason('2026-09-01', 1)
    ensureLeagueBadgeForSeason('2026-09-29', 1)
    expect(loadLeagueBadges().awards).toHaveLength(2)
  })
  it('装着は3つまで・4つ目はfullで拒否', () => {
    expect(MAX_EQUIPPED_BADGES).toBe(3)
    const uids = ['2026-09-01:div1', '2026-09-01:div2', '2026-09-01:div3', '2026-09-29:div1']
    for (const [i, s] of ['2026-09-01', '2026-09-01', '2026-09-01', '2026-09-29'].entries()) {
      ensureLeagueBadgeForSeason(s, (i % 3) + 1)
    }
    expect(toggleBadgeEquipped(uids[0]).ok).toBe(true)
    expect(toggleBadgeEquipped(uids[1]).ok).toBe(true)
    expect(toggleBadgeEquipped(uids[2]).ok).toBe(true)
    const r = toggleBadgeEquipped(uids[3])
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('full')
    expect(loadLeagueBadges().equipped).toHaveLength(3)
  })
  it('装着済みの再タップで外せる・未所持はmissing', () => {
    ensureLeagueBadgeForSeason('2026-09-01', 1)
    expect(toggleBadgeEquipped('2026-09-01:div1').ok).toBe(true)
    expect(toggleBadgeEquipped('2026-09-01:div1').ok).toBe(true)
    expect(loadLeagueBadges().equipped).toHaveLength(0)
    expect(toggleBadgeEquipped('2099-01-01:div1').reason).toBe('missing')
  })
  it('破損JSONは空コレクションとして扱う', () => {
    localStorage.setItem('schedule-app-league-badges-v1', 'not-json')
    expect(loadLeagueBadges()).toEqual({ awards: [], equipped: [] })
  })
  it('期ラベルは下2桁年-月・不正は―', () => {
    expect(seasonLabel('2026-09-29')).toBe('26-09')
    expect(badgeIdForDiv(1)).toBe('div1')
    expect(badgeIdForDiv(4)).toBeNull()
  })
})
