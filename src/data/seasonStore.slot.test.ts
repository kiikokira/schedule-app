import { describe, expect, it } from 'vitest'

describe('seasonStore slot', () => {
  it('syncLeagueSlotで1枠1試合がラウンドに加算される', async () => {
    const { loadSeasonState, saveSeasonState } = await import('./seasonStore')
    const { seasonIdForDate } = await import('../lib/seasonLeague')
    localStorage.clear()
    const today = '2026-10-26'
    const st0 = loadSeasonState(today)
    saveSeasonState({ ...st0, div: 10 })
    const { syncLeagueSlot } = await import('./seasonStore')
    const st1 = syncLeagueSlot(today, '2026-10-26#390-420', { my: 10, unit: 'pages', slotMinutes: 30 })
    expect(Object.keys(st1.slotMatches ?? {})).toContain('2026-10-26#390-420')
    expect((st1.round.w + st1.round.d + st1.round.l)).toBe(1)
    void seasonIdForDate
  })
  it('同一枠の二重確定は2回目を無視する', async () => {
    const { syncLeagueSlot } = await import('./seasonStore')
    const today = '2026-10-26'
    const a = syncLeagueSlot(today, '2026-10-26#390-420', { my: 10, unit: 'pages', slotMinutes: 30 })
    const b = syncLeagueSlot(today, '2026-10-26#390-420', { my: 99, unit: 'pages', slotMinutes: 30 })
    expect(b.slotMatches['2026-10-26#390-420'].my).toBe(a.slotMatches['2026-10-26#390-420'].my)
  })
  it('やらなかった(my=0)はlossで勝ち点0', async () => {
    localStorage.clear()
    const { loadSeasonState, saveSeasonState, syncLeagueSlot } = await import('./seasonStore')
    const st0 = loadSeasonState('2026-10-27')
    saveSeasonState({ ...st0, div: 10 })
    const st1 = syncLeagueSlot('2026-10-27', '2026-10-27#390-420', { my: 0, unit: 'pages', slotMinutes: 30, forfeit: true })
    expect(st1.slotMatches['2026-10-27#390-420'].result).toBe('loss')
  })
})
