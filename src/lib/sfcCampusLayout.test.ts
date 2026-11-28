import { describe, it, expect } from 'vitest'
import { CAMPUS_LAYOUT, buildingById } from './sfcCampusLayout'

const REQUIRED = [
  'Α本館', 'Μメディアセンター', 'κ館', 'ε館', 'ι館', 'ο館', 'λ館',
  'Σ生協食堂', 'Θ館', 'Ω館', 'τ大学院棟', '学生ラウンジ',
]

describe('CAMPUS_LAYOUT', () => {
  it('covers the required SFC buildings', () => {
    const names = CAMPUS_LAYOUT.buildings.map((b) => b.name)
    for (const name of REQUIRED) expect(names).toContain(name)
    expect(names.filter((n) => n !== '')).toHaveLength(REQUIRED.length)
    expect(buildingById('alpha')?.name).toBe('Α本館')
  })
  it('has no village buildings', () => {
    expect(buildingById('beta')).toBeUndefined()
    expect(buildingById('eta')).toBeUndefined()
    expect(CAMPUS_LAYOUT.buildings.map((b) => b.name).join(' ')).not.toContain('ヴィレッジ')
  })
  it('keeps every building on the grid, inside the map and apart from the others', () => {
    for (const b of CAMPUS_LAYOUT.buildings) {
      expect(b.x % 8).toBe(0)
      expect(b.y % 8).toBe(0)
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w).toBeLessThanOrEqual(CAMPUS_LAYOUT.width)
      expect(b.y + b.h).toBeLessThanOrEqual(CAMPUS_LAYOUT.height)
    }
    const bs = CAMPUS_LAYOUT.buildings
    for (let i = 0; i < bs.length; i += 1) {
      for (let j = i + 1; j < bs.length; j += 1) {
        const a = bs[i]
        const b = bs[j]
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap).toBe(false)
      }
    }
  })
  it('puts every entrance outside its footprint and inside the map', () => {
    for (const b of CAMPUS_LAYOUT.buildings) {
      const inside = b.entrance.x > b.x && b.entrance.x < b.x + b.w && b.entrance.y > b.y && b.entrance.y < b.y + b.h
      expect(inside).toBe(false)
      expect(b.entrance.x).toBeGreaterThan(0)
      expect(b.entrance.x).toBeLessThan(CAMPUS_LAYOUT.width)
      expect(b.entrance.y).toBeGreaterThan(0)
      expect(b.entrance.y).toBeLessThan(CAMPUS_LAYOUT.height)
    }
  })
  it('uses the 185 by 148 cell map', () => {
    expect(CAMPUS_LAYOUT.width).toBe(1480)
    expect(CAMPUS_LAYOUT.height).toBe(1184)
  })
})
