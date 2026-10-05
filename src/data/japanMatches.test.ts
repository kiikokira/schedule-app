import { describe, it, expect } from 'vitest'
import { JAPAN_MATCHES, matchWindow, validateJapanMatches, daysUntil } from './japanMatches'

describe('japanMatches', () => {
  it('ships the 2026-10-05 final vs New Zealand at 19:30', () => {
    const m = JAPAN_MATCHES.find((x) => x.id === '2026-10-05-kirin-cup-final')
    expect(m).toMatchObject({ date: '2026-10-05', kickoff: '19:30', opponent: 'ニュージーランド' })
  })
  it('derives a 19:20-21:35 window for a 19:30 kickoff', () => {
    expect(matchWindow({ id: 'x', date: '2026-10-05', kickoff: '19:30', opponent: 'NZ', competition: 'K', homeAway: 'home' })).toEqual({ start: '19:20', end: '21:35' })
  })
  it('counts days until the match', () => {
    expect(daysUntil('2026-11-14', '2026-10-05')).toBe(40)
    expect(daysUntil('2026-10-05', '2026-10-05')).toBe(0)
  })
  it('rejects malformed data', () => {
    expect(validateJapanMatches([{ id: 'x', date: '2026-13-99' }])).toBe(false)
    expect(validateJapanMatches(JAPAN_MATCHES)).toBe(true)
  })
})
