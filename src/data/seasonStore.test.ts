import { describe, expect, it, beforeEach } from 'vitest'
import { loadSeasonState, recordSeasonDay } from './seasonStore'
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
  it('開始Divは過去最高Divで決まる', async () => {
    const { startDivForHighest } = await import('./seasonStore')
    expect(startDivForHighest(1)).toBe(3)
    expect(startDivForHighest(2)).toBe(4)
    expect(startDivForHighest(3)).toBe(5)
    expect(startDivForHighest(4)).toBe(6)
    expect(startDivForHighest(5)).toBe(7)
    expect(startDivForHighest(6)).toBe(8)
    expect(startDivForHighest(7)).toBe(10)
    expect(startDivForHighest(10)).toBe(10)
  })
  it('同日再記録は二重加算しない(差分付け替え)', () => {
    const s1 = recordSeasonDay('2026-09-01', 10, 0)
    expect(s1.exp).toBe(100)
    const s2 = recordSeasonDay('2026-09-01', 20, 0)
    expect(s2.exp).toBe(200)
    expect(s2.days['2026-09-01']).toBe(20)
  })
  it('10試合でラウンド確定しDiv4からDiv3へ昇格する', async () => {
    const { loadSeasonState, saveSeasonState, syncLeagueDay } = await import('./seasonStore')
    localStorage.clear()
    const s0 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...s0, div: 4, highestDiv: 4, phaseBestDiv: 4, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
    const days: Record<string, number> = {}
    for (let d = 1; d <= 10; d++) days[`2026-09-${String(d).padStart(2, '0')}`] = 150
    const s1 = syncLeagueDay('2026-09-10', days, 4, '2026-09-01')
    expect(s1.div).toBe(3)
    expect(s1.highestDiv).toBe(3)
    expect(s1.phaseBestDiv).toBe(3)
    expect(s1.round.w + s1.round.d + s1.round.l).toBe(0)
    expect(s1.rating).toBe(1200)
  })
  it('昇格確定前にスキップすると即昇格し新ラウンドになる', async () => {
    const { loadSeasonState, saveSeasonState, syncLeagueDay, finalizeRoundEarly } = await import('./seasonStore')
    localStorage.clear()
    const s0 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...s0, div: 10, highestDiv: 10, phaseBestDiv: 10, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
    const s1 = syncLeagueDay('2026-09-01', { '2026-09-01': 100 }, 10, '2026-09-01')
    expect(s1.div).toBe(10)
    expect(s1.round.w + s1.round.d + s1.round.l).toBe(1)
    const s2 = finalizeRoundEarly(s1, '2026-09-01')
    expect(s2.div).toBe(9)
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
  it('シーズン切替で開始Divとバッジが決まる', async () => {
    const { loadSeasonState, saveSeasonState } = await import('./seasonStore')
    const { loadLeagueBadges } = await import('../lib/leagueBadges')
    localStorage.clear()
    const s0 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...s0, div: 2, highestDiv: 1, phaseBestDiv: 1, rating: 1300, ratedUpTo: '2026-09-28', round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: { '2026-09-01': 10 } })
    const s1 = loadSeasonState('2026-09-29')
    expect(s1.div).toBe(3)
    expect(s1.highestDiv).toBe(1)
    expect(loadLeagueBadges().awards.map((a) => a.badgeId)).toEqual(['div1'])
  })
  it('Div3で1500到達したらDiv2へ昇格する', async () => {
    const { loadSeasonState, saveSeasonState, applyMatchRatings } = await import('./seasonStore')
    localStorage.clear()
    const s0 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...s0, div: 3, highestDiv: 3, phaseBestDiv: 3, rating: 1490, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
    const base = loadSeasonState('2026-09-01')
    const s1 = applyMatchRatings({ ...base, div: 3 }, 3, [{ date: '2026-09-02', result: 'win', oppRating: 1490 }])
    expect(s1.rating).toBeGreaterThanOrEqual(1500)
    expect(s1.div).toBe(2)
    expect(s1.highestDiv).toBe(2)
    expect(s1.phaseBestDiv).toBe(2)
  })
  it('Div2で1800到達したらDiv1へ昇格する', async () => {
    const { loadSeasonState, saveSeasonState, applyMatchRatings } = await import('./seasonStore')
    localStorage.clear()
    const s0 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...s0, div: 2, highestDiv: 2, phaseBestDiv: 2, rating: 1790, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
    const base = loadSeasonState('2026-09-01')
    const s1 = applyMatchRatings({ ...base, div: 2 }, 2, [{ date: '2026-09-02', result: 'win', oppRating: 1790 }])
    expect(s1.rating).toBeGreaterThanOrEqual(1800)
    expect(s1.div).toBe(1)
    expect(s1.highestDiv).toBe(1)
  })
  it('Div3から1800超えは一気にDiv1へ昇格する', async () => {
    const { loadSeasonState, saveSeasonState, applyMatchRatings } = await import('./seasonStore')
    localStorage.clear()
    const s0 = loadSeasonState('2026-09-01')
    saveSeasonState({ ...s0, div: 3, highestDiv: 3, phaseBestDiv: 3, rating: 1790, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
    const base = loadSeasonState('2026-09-01')
    const s1 = applyMatchRatings({ ...base, div: 3 }, 3, [{ date: '2026-09-02', result: 'win', oppRating: 1790 }])
    expect(s1.rating).toBeGreaterThanOrEqual(1800)
    expect(s1.div).toBe(1)
  })
})
