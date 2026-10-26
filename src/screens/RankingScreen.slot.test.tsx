import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import RankingScreen from './RankingScreen'
describe('ranking slot history', () => {
  it('slotMatches直近5件を表示する', async () => {
    const { loadSeasonState, saveSeasonState, syncLeagueSlot } = await import('../data/seasonStore')
    localStorage.clear()
    const today = '2026-10-26'
    const st0 = loadSeasonState(today)
    saveSeasonState({ ...st0, div: 10 })
    syncLeagueSlot(today, '2026-10-26#390-420', { my: 10, unit: 'pages', slotMinutes: 30 })
    const st1 = loadSeasonState(today)
    expect(Object.keys(st1.slotMatches).length).toBe(1)
  })
  it('履歴はスロット開始時刻の数値順で直近5件を表示する（#1005が#390より後に来る）', async () => {
    const { loadSeasonState, saveSeasonState, syncLeagueSlot } = await import('../data/seasonStore')
    localStorage.clear()
    const today = '2026-10-26'
    const st0 = loadSeasonState(today)
    saveSeasonState({ ...st0, div: 10 })
    // 時系列順（開始時刻昇順）に6枠記録。語彙順だと #1005-1035 が #390-420 より前に来てしまう。
    const seeds: Array<[string, number]> = [
      ['2026-10-26#390-420', 101],
      ['2026-10-26#420-450', 202],
      ['2026-10-26#480-510', 303],
      ['2026-10-26#540-570', 404],
      ['2026-10-26#600-630', 505],
      ['2026-10-26#1005-1035', 606],
    ]
    for (const [key, my] of seeds) {
      syncLeagueSlot(today, key, { my, unit: 'pages', slotMinutes: 30 })
    }
    render(<RankingScreen onBack={() => {}} today={today} />)
    fireEvent.click(screen.getByTestId('league-tab'))
    const history = screen.getByTestId('league-history')
    // 直近5件＝最古（101）を落とし、時系列順に 202,303,404,505,606 が並ぶ
    const texts = [0, 1, 2, 3, 4].map(
      (i) => within(history).getByTestId(`league-history-${i}`).textContent ?? '',
    )
    expect(texts[0]).toContain('202-')
    expect(texts[1]).toContain('303-')
    expect(texts[2]).toContain('404-')
    expect(texts[3]).toContain('505-')
    expect(texts[4]).toContain('606-')
    expect(texts.join('|')).not.toContain('101-')
  })
})
