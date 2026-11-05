import { describe, it, expect } from 'vitest'
import { mulberry32, ringPlacements } from './rpgVista'

describe('rpgVista seeded placement', () => {
  it('is deterministic for the same seed', () => {
    const a = ringPlacements({ count: 12, rMin: 20, rMax: 60, seed: 7, y: 0 })
    const b = ringPlacements({ count: 12, rMin: 20, rMax: 60, seed: 7, y: 0 })
    expect(a).toEqual(b)
  })

  it('differs across seeds', () => {
    const a = ringPlacements({ count: 12, rMin: 20, rMax: 60, seed: 7, y: 0 })
    const b = ringPlacements({ count: 12, rMin: 20, rMax: 60, seed: 8, y: 0 })
    expect(a).not.toEqual(b)
  })

  it('keeps every placement inside the ring and outside the play area', () => {
    const pts = ringPlacements({ count: 40, rMin: 20, rMax: 60, seed: 42, y: -1 })
    expect(pts).toHaveLength(40)
    for (const p of pts) {
      const r = Math.hypot(p.x, p.z)
      expect(r).toBeGreaterThanOrEqual(20)
      expect(r).toBeLessThanOrEqual(60)
      expect(p.y).toBe(-1)
      expect(p.scale).toBeGreaterThan(0)
    }
  })

  it('mulberry32 stays in [0, 1)', () => {
    const rng = mulberry32(1234)
    for (let i = 0; i < 200; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
