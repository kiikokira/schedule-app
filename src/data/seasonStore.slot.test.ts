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
  it('過去の未確定・book付き枠を自動敗戦にする', async () => {
    const { autoForfeitPastSlots, loadSeasonState } = await import('./seasonStore')
    localStorage.clear()
    const availability = [
      { id: 'a1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'b1' },
    ]
    const books = [
      { id: 'b1', title: '本1', totalPages: 100, startDate: '2026-09-01', deadline: '2026-12-31', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    ]
    const forfeited = autoForfeitPastSlots('2026-09-22', availability, books)
    expect(forfeited).toContain('2026-09-21#1260-1380')
    expect(loadSeasonState('2026-09-22').slotMatches['2026-09-21#1260-1380']?.result).toBe('loss')
  })
  it('未来枠は自動敗戦にしない', async () => {
    const { autoForfeitPastSlots, loadSeasonState } = await import('./seasonStore')
    localStorage.clear()
    const availability = [
      { id: 'a1', weekday: null, date: '2026-09-23', start: '21:00', end: '23:00', bookId: 'b1' },
    ]
    const books = [
      { id: 'b1', title: '本1', totalPages: 100, startDate: '2026-09-01', deadline: '2026-12-31', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    ]
    const forfeited = autoForfeitPastSlots('2026-09-22', availability, books)
    expect(forfeited).toEqual([])
    expect(loadSeasonState('2026-09-22').slotMatches['2026-09-23#1260-1380']).toBeUndefined()
  })
  it('確定済み枠は上書きしない', async () => {
    const { autoForfeitPastSlots, loadSeasonState, syncLeagueSlot } = await import('./seasonStore')
    localStorage.clear()
    syncLeagueSlot('2026-09-22', '2026-09-21#1260-1380', { my: 10, unit: 'pages', slotMinutes: 120 })
    const availability = [
      { id: 'a1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'b1' },
    ]
    const books = [
      { id: 'b1', title: '本1', totalPages: 100, startDate: '2026-09-01', deadline: '2026-12-31', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    ]
    const forfeited = autoForfeitPastSlots('2026-09-22', availability, books)
    expect(forfeited).toEqual([])
    const entry = loadSeasonState('2026-09-22').slotMatches['2026-09-21#1260-1380']
    expect(entry.my).toBe(10)
  })
  it('未割当枠は対象外', async () => {
    const { autoForfeitPastSlots, loadSeasonState } = await import('./seasonStore')
    localStorage.clear()
    const availability = [
      { id: 'a1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00' },
    ]
    const books = [
      { id: 'b1', title: '本1', totalPages: 100, startDate: '2026-09-01', deadline: '2026-12-31', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    ]
    const forfeited = autoForfeitPastSlots('2026-09-22', availability, books)
    expect(forfeited).toEqual([])
    expect(loadSeasonState('2026-09-22').slotMatches['2026-09-21#1260-1380']).toBeUndefined()
  })
  it('削除済み本の枠もpagesで敗戦になる', async () => {
    const { autoForfeitPastSlots, loadSeasonState } = await import('./seasonStore')
    localStorage.clear()
    const availability = [
      { id: 'a1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'gone' },
    ]
    const forfeited = autoForfeitPastSlots('2026-09-22', availability, [])
    expect(forfeited).toContain('2026-09-21#1260-1380')
    const entry = loadSeasonState('2026-09-22').slotMatches['2026-09-21#1260-1380']
    expect(entry?.result).toBe('loss')
    expect(entry?.unit).toBe('pages')
  })
  it('曜日枠の過去日も敗戦になる', async () => {
    const { autoForfeitPastSlots, loadSeasonState } = await import('./seasonStore')
    localStorage.clear()
    const weekday = new Date(2026, 8, 21).getDay()
    const availability = [
      { id: 'w1', weekday, date: null, start: '21:00', end: '23:00', bookId: 'b1' },
    ]
    const books = [
      { id: 'b1', title: '本1', totalPages: 100, startDate: '2026-09-01', deadline: '2026-12-31', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    ]
    const forfeited = autoForfeitPastSlots('2026-09-22', availability, books)
    expect(forfeited).toContain('2026-09-21#1260-1380')
    expect(loadSeasonState('2026-09-22').slotMatches['2026-09-21#1260-1380']?.result).toBe('loss')
  })
  it('cycles+LEAP本はwords単位で敗戦になる', async () => {
    const { autoForfeitPastSlots, loadSeasonState } = await import('./seasonStore')
    localStorage.clear()
    const availability = [
      { id: 'a1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'leap1' },
    ]
    const books = [
      { id: 'leap1', title: '改訂版 必携 英単語 LEAP', totalPages: 0, startDate: '2026-09-01', deadline: '2026-12-31', createdAt: '2026-09-01', updatedAt: '2026-09-01', studyMode: 'cycles' as const, totalUnits: 2300, targetRounds: 3 },
    ]
    const forfeited = autoForfeitPastSlots('2026-09-22', availability, books)
    expect(forfeited).toContain('2026-09-21#1260-1380')
    const entry = loadSeasonState('2026-09-22').slotMatches['2026-09-21#1260-1380']
    expect(entry?.result).toBe('loss')
    expect(entry?.unit).toBe('words')
  })
})
