import { describe, it, expect, beforeEach } from 'vitest'
import { loadMockHistory, recordMockIfNeeded } from './mockHistory'

describe('mockHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('月初1〜7日に初記録を追加する', () => {
    const h = recordMockIfNeeded('2026-10-05', 50000, 55.1, 200)
    expect(h.length).toBe(1)
    expect(h[0]).toMatchObject({ ym: '2026-10', rank: 50000, deviation: 55.1, pages: 200 })
    expect(loadMockHistory().length).toBe(1)
  })
  it('同じ月は重複追加しない', () => {
    recordMockIfNeeded('2026-10-05', 50000, 55.1, 200)
    const h = recordMockIfNeeded('2026-10-06', 40000, 56.0, 250)
    expect(h.length).toBe(1)
    expect(h[0].rank).toBe(50000)
  })
  it('8日以降は記録しない', () => {
    const h = recordMockIfNeeded('2026-10-08', 50000, 55.1, 200)
    expect(h.length).toBe(0)
  })
})
