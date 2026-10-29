// src/lib/ghost.test.ts
import { describe, it, expect } from 'vitest'
import { findGhostDate, buildGhostCurve, ghostTotalAt, todaySlotBounds } from './ghost'

describe('findGhostDate', () => {
  it('picks max before today, tie prefers newer', () => {
    expect(findGhostDate({ '2026-10-20': 50, '2026-10-21': 120, '2026-10-22': 120, '2026-10-23': 30 }, '2026-10-23')).toBe('2026-10-22')
  })
  it('excludes today even if today is max', () => {
    expect(findGhostDate({ '2026-10-21': 100, '2026-10-23': 999 }, '2026-10-23')).toBe('2026-10-21')
  })
  it('returns null when no history', () => {
    expect(findGhostDate({}, '2026-10-23')).toBeNull()
    expect(findGhostDate({ '2026-10-23': 10 }, '2026-10-23')).toBeNull()
  })
})

describe('ghostTotalAt uniform', () => {
  it('scales linearly with floor', () => {
    const c = buildGhostCurve({ total: 120, events: [] })
    expect(ghostTotalAt(c, 60, 480)).toBe(15)
    expect(ghostTotalAt(c, -5, 480)).toBe(0)
    expect(ghostTotalAt(c, 9999, 480)).toBe(120)
  })
  it('returns 0 when no ghost', () => {
    expect(ghostTotalAt({ kind: 'none' }, 60, 480)).toBe(0)
  })
})

describe('ghostTotalAt events', () => {
  it('interpolates relative from first log', () => {
    const base = Date.parse('2026-10-21T09:00:00+09:00')
    const c = buildGhostCurve({ total: 100, events: [
      { atMs: base, total: 0 },
      { atMs: base + 60 * 60000, total: 20 },
      { atMs: base + 180 * 60000, total: 80 },
    ]})
    expect(ghostTotalAt(c, 30, 480)).toBe(10)
    expect(ghostTotalAt(c, 120, 480)).toBe(50)
    expect(ghostTotalAt(c, 9999, 480)).toBe(100)
  })
  it('ignores broken events and falls back to uniform', () => {
    const c = buildGhostCurve({ total: 90, events: [{ atMs: NaN, total: 10 }] })
    expect(ghostTotalAt(c, 240, 480)).toBe(45)
  })
})

describe('todaySlotBounds', () => {
  it('uses unclipped first start and sum', () => {
    expect(todaySlotBounds([{ startMin: 540, endMin: 600 }, { startMin: 660, endMin: 720 }])).toEqual({ startMin: 540, totalMinutes: 120 })
  })
  it('returns null when empty', () => {
    expect(todaySlotBounds([])).toBeNull()
  })
})
