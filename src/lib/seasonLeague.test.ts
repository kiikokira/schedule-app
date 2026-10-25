import { describe, expect, it } from 'vitest'
import { seasonIdForDate, seasonDayIndex, isSeasonFinalDay, decidePromotion, leagueDayResults, leagueDayInfo, seasonEndForDate, leaguePointsForPages, LEAGUE_PT_RATE, type LeagueDayResult } from './seasonLeague'
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
  it('リーグptはページ数に換算率を掛けたもので単調に増える', () => {
    expect(LEAGUE_PT_RATE).toBeGreaterThan(0)
    expect(LEAGUE_PT_RATE).toBeLessThan(1)
    expect(leaguePointsForPages(0)).toBe(0)
    expect(leaguePointsForPages(100)).toBe(Math.round(100 * LEAGUE_PT_RATE))
    expect(leaguePointsForPages(50)).toBeLessThanOrEqual(leaguePointsForPages(100))
    expect(leaguePointsForPages(100)).toBeLessThan(100)
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
  it('ラウンド勝ち点は勝ち3引分1負け0', async () => {
    const { roundPoints } = await import('./seasonLeague')
    expect(roundPoints(['win', 'win', 'draw', 'loss'])).toBe(7)
  })
  it('Div10は勝ち点3で即昇格確定', async () => {
    const { decideRoundOutcome } = await import('./seasonLeague')
    expect(decideRoundOutcome(10, ['win'])).toBe('promote')
  })
  it('Div8は残り試合の全勝敗パターンで覆らない時だけ確定する', async () => {
    const { decideRoundOutcome } = await import('./seasonLeague')
    expect(decideRoundOutcome(8, ['win', 'win', 'win'])).toBe('promote')
    expect(decideRoundOutcome(8, ['loss', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss'])).toBe('undecided')
    const stay: LeagueDayResult[] = ['win', 'win', 'draw', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss']
    expect(decideRoundOutcome(8, [...stay])).toBe('stay')
  })
  it('Div4は22点で昇格・19点以下で残留判定', async () => {
    const { decideRoundOutcome } = await import('./seasonLeague')
    const wins7: Array<'win'> = ['win', 'win', 'win', 'win', 'win', 'win', 'win']
    expect(decideRoundOutcome(4, wins7)).toBe('undecided')
    expect(decideRoundOutcome(4, [...wins7, 'win'])).toBe('promote')
    const stay: LeagueDayResult[] = ['win', 'win', 'win', 'win', 'win', 'win', 'draw', 'loss', 'loss', 'loss']
    expect(decideRoundOutcome(4, [...stay])).toBe('stay')
    const drop: LeagueDayResult[] = ['win', 'win', 'win', 'draw', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss']
    expect(decideRoundOutcome(4, [...drop])).toBe('relegate')
  })
  it('残留ラインのないDivは降格しない', async () => {
    const { decideRoundOutcome } = await import('./seasonLeague')
    expect(decideRoundOutcome(10, Array<LeagueDayResult>(10).fill('loss'))).toBe('stay')
    expect(decideRoundOutcome(9, Array<LeagueDayResult>(10).fill('loss'))).toBe('stay')
    expect(decideRoundOutcome(6, Array<LeagueDayResult>(10).fill('loss'))).toBe('stay')
  })
  it('タリーから結果配列に復元できる', async () => {
    const { tallyToResults } = await import('./seasonLeague')
    expect(tallyToResults({ w: 2, d: 1, l: 0 })).toEqual(['win', 'win', 'draw'])
  })
})
