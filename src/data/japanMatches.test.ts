import { describe, it, expect } from 'vitest'
import { JAPAN_MATCHES, matchWindow, validateJapanMatches, daysUntil } from './japanMatches'

describe('japanMatches', () => {
  it('ships the 2026-10-05 final vs New Zealand at 19:30', () => {
    const m = JAPAN_MATCHES.find((x) => x.id === '2026-10-05-vs-new-zealand')
    expect(m).toMatchObject({
      date: '2026-10-05',
      kickoff: '19:30',
      opponent: 'ニュージーランド',
      competition: 'KIRIN CUP SOCCER 2026',
    })
  })
  it('derives a 19:20-21:35 window for a 19:30 kickoff', () => {
    expect(matchWindow({ kickoff: '19:30' })).toEqual({ start: '19:20', end: '21:35' })
  })
  it('clamps a late window at 24:00', () => {
    expect(matchWindow({ kickoff: '23:30' })).toEqual({ start: '23:20', end: '24:00' })
  })
  it('clamps an early window at 00:00', () => {
    expect(matchWindow({ kickoff: '00:05' })).toEqual({ start: '00:00', end: '02:10' })
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
