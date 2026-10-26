import { describe, expect, it } from 'vitest'
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
})
