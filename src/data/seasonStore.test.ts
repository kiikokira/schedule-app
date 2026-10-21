import { describe, expect, it, beforeEach } from 'vitest'
import { loadSeasonState, recordSeasonDay } from './seasonStore'

describe('seasonStore', () => {
  beforeEach(() => localStorage.clear())
  it('初回はDiv10、記録でexp加算', () => {
    const s0 = loadSeasonState('2026-09-01')
    expect(s0.div).toBe(10)
    const s1 = recordSeasonDay('2026-09-01', 10, 0)
    expect(s1.exp).toBe(100)
    expect(s1.days['2026-09-01']).toBe(10)
  })
})
