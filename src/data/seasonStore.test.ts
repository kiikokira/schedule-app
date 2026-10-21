import { describe, expect, it, beforeEach } from 'vitest'
import { loadSeasonState, recordSeasonDay, saveSeasonState, applyPromotionIfNeeded } from './seasonStore'
import { seasonIdForDate } from '../lib/seasonLeague'

describe('seasonStore', () => {
  beforeEach(() => localStorage.clear())
  it('初回はDiv10、記録でexp加算', () => {
    const s0 = loadSeasonState('2026-09-01')
    expect(s0.div).toBe(10)
    const s1 = recordSeasonDay('2026-09-01', 10, 0)
    expect(s1.exp).toBe(100)
    expect(s1.days['2026-09-01']).toBe(10)
  })
  it('シーズン切替でdivを引き継ぐ(初回のみDiv10)', () => {
    const s0 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...s0, div: 8, exp: 500, days: { '2026-09-01': 10 } })
    const s1 = loadSeasonState('2026-09-29')
    expect(s1.seasonId).toBe(seasonIdForDate('2026-09-29'))
    expect(s1.div).toBe(8)
    expect(s1.exp).toBe(0)
    expect(s1.days).toEqual({})
  })
  it('同日再記録は二重加算しない(差分付け替え)', () => {
    const s1 = recordSeasonDay('2026-09-01', 10, 0)
    expect(s1.exp).toBe(100)
    const s2 = recordSeasonDay('2026-09-01', 20, 0)
    expect(s2.exp).toBe(200)
    expect(s2.days['2026-09-01']).toBe(20)
  })
  it('最終日に昇格し、繰り返し適用は冪等', () => {
    const base = loadSeasonState('2026-09-01')
    saveSeasonState({ ...base, div: 5, exp: 1000, days: {} })
    const table = ['me', 'r2', 'r3', 'r4', 'r5']
    const p1 = applyPromotionIfNeeded('2026-09-28', table, 'me')
    expect(p1.div).toBe(4)
    const p2 = applyPromotionIfNeeded('2026-09-28', table, 'me')
    expect(p2.div).toBe(4)
  })
  it('降格・クランプ(Div1昇格維持・Div10降格維持)', () => {
    const base = loadSeasonState('2026-09-01')
    // demote: myId at bottom
    saveSeasonState({ ...base, div: 5, exp: 0, days: {} })
    const table = ['r1', 'r2', 'r3', 'r4', 'me']
    const d1 = applyPromotionIfNeeded('2026-09-28', table, 'me')
    expect(d1.div).toBe(6)
    // clamp top: Div1 promote stays 1
    const b2 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...b2, div: 1, exp: 0, days: {}, appliedSeasonId: undefined })
    localStorage.removeItem('schedule-app-season')
    const b3 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...b3, div: 1, exp: 0, days: {} })
    const c1 = applyPromotionIfNeeded('2026-09-28', ['me', 'r2', 'r3', 'r4', 'r5'], 'me')
    expect(c1.div).toBe(1)
    // clamp bottom: Div10 demote stays 10 (need fresh season to bypass idempotency guard)
    localStorage.clear()
    const b4 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...b4, div: 10, exp: 0, days: {} })
    const c2 = applyPromotionIfNeeded('2026-09-28', ['r1', 'r2', 'r3', 'r4', 'me'], 'me')
    expect(c2.div).toBe(10)
  })
  it('破損入力ガード(div範囲外はクランプ・days nullは空)', () => {
    localStorage.setItem(
      'schedule-app-season',
      JSON.stringify({ seasonId: seasonIdForDate('2026-09-01'), div: 99, exp: 100, days: null }),
    )
    const s = loadSeasonState('2026-09-01')
    expect(s.div).toBe(10)
    expect(s.days).toEqual({})
    localStorage.setItem(
      'schedule-app-season',
      JSON.stringify({ seasonId: seasonIdForDate('2026-09-01'), div: -5, exp: 0, days: null }),
    )
    const s2 = loadSeasonState('2026-09-01')
    expect(s2.div).toBe(1)
    expect(s2.days).toEqual({})
  })
})
