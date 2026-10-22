import { describe, expect, it } from 'vitest'
import { seasonIdForDate, seasonDayIndex, isSeasonFinalDay, decidePromotion, leagueDayResults, leagueDayInfo, seasonEndForDate } from './seasonLeague'
import { generateRivals, rivalPagesForDay } from './seasonRivals'

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
  it('シーズン終了日は開始+27日', () => {
    expect(seasonEndForDate('2026-09-01')).toBe('2026-09-28')
    expect(seasonEndForDate('2026-09-29')).toBe('2026-10-26')
  })
  it('日次平均を上回れば勝ち・下回れば負け', () => {
    const wins = leagueDayResults('2026-09-01', 10, [10000, 10000, 10000])
    expect(wins).toEqual(['win', 'win', 'win'])
  })
  it('日次平均と同点なら引分', () => {
    const rivals = generateRivals('2026-09-01', 10)
    const avg = Math.round(rivals.reduce((s, r) => s + rivalPagesForDay(r, 0), 0) / rivals.length)
    const results = leagueDayResults('2026-09-01', 10, [avg])
    expect(results).toEqual(['draw'])
  })
  it('入力日数分の結果を返す', () => {
    expect(leagueDayResults('2026-09-01', 10, [])).toEqual([])
    expect(leagueDayResults('2026-09-01', 10, [10000, 0]).length).toBe(2)
  })
  it('対戦情報は平均・最接戦相手・勝敗を返す', () => {
    const info = leagueDayInfo('2026-09-01', 10, 0, 10000)
    expect(info.result).toBe('win')
    expect(info.average).toBeGreaterThanOrEqual(0)
    expect(info.opponent.length).toBeGreaterThan(0)
    expect(info.opponentPages).toBeGreaterThanOrEqual(0)
  })
  it('対戦相手はその日に最もptが近いライバル', () => {
    const rivals = generateRivals('2026-09-01', 10)
    const pages = rivals.map((r) => ({ name: r.name, pages: rivalPagesForDay(r, 1) }))
    const mine = 25
    let expected = pages[0]
    for (const p of pages) {
      if (Math.abs(p.pages - mine) < Math.abs(expected.pages - mine)) expected = p
    }
    const info = leagueDayInfo('2026-09-01', 10, 1, mine)
    expect(info.opponent).toBe(expected.name)
    expect(info.opponentPages).toBe(expected.pages)
  })
})
