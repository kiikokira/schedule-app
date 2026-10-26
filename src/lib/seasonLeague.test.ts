import { describe, expect, it } from 'vitest'
import { seasonIdForDate, seasonDayIndex, isSeasonFinalDay, decidePromotion, leagueDayResults, leagueDayInfo, seasonEndForDate, leaguePointsForPages, LEAGUE_PT_RATE, type LeagueDayResult } from './seasonLeague'
import { generateRivals, rivalPagesForDay } from './seasonRivals'
import { leagueSlotInfo, rivalForSlot, rivalSlotAmount } from './slotLeague'

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
  // NOTE: 日次平均によるリーグ進行は廃止し、枠ベースに移行した。以下の日次ヘルパー
  // (leagueDayInfo/leagueDayResults) は互換のため残す。枠ベースの勝敗仕様は slotLeague.test.ts を正とする。
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
  it('枠ベースでも超過・同値・未満で勝敗が決まる（日次比較と同値）', () => {
    const seasonId = '2026-09-01'
    const slotKey = '2026-09-02#390-420'
    const rival = rivalForSlot(seasonId, 10, slotKey)
    const opp = rivalSlotAmount(rival, slotKey, 'pages', 30)
    const win = leagueSlotInfo(seasonId, 10, slotKey, opp + 1, 'pages', 30)
    expect(win.opponent).toBe(rival.name)
    expect(win.opponentAmount).toBe(opp)
    expect(win.result).toBe('win')
    expect(leagueSlotInfo(seasonId, 10, slotKey, opp, 'pages', 30).result).toBe('draw')
    expect(leagueSlotInfo(seasonId, 10, slotKey, 0, 'pages', 30).result).toBe('loss')
  })
  it('対戦情報は平均・最接戦相手・勝敗を返す（日次互換。枠ベースは slotLeague.test.ts 参照）', () => {
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
  it('リーグ母集団はフェーズごとに200万〜500万で同フェーズ内一定', async () => {
    const { leaguePopulationFor } = await import('./seasonLeague')
    const p = leaguePopulationFor('2026-09-01')
    expect(p).toBeGreaterThanOrEqual(2000000)
    expect(p).toBeLessThanOrEqual(5000000)
    expect(leaguePopulationFor('2026-09-01')).toBe(p)
    expect(leaguePopulationFor('2026-09-28')).toBe(p)
  })
  it('リーグ順位は累計ページが多いほど上位で母集団以内', async () => {
    const { leagueRankForPages, leaguePopulationFor } = await import('./seasonLeague')
    const pop = leaguePopulationFor('2026-09-01')
    const r600 = leagueRankForPages(600, pop)
    expect(r600).toBeGreaterThanOrEqual(1)
    expect(r600).toBeLessThanOrEqual(pop)
    expect(leagueRankForPages(6000, pop)).toBeLessThan(r600)
    expect(leagueRankForPages(0, pop)).toBe(pop)
  })
})
