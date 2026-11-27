import { describe, it, expect } from 'vitest'
import { CAMPUS_LAYOUT, buildingById } from './sfcCampusLayout'

const REQUIRED = [
  'Α本館', 'Μメディアセンター', 'κ館', 'ε館', 'ι館', 'ο館', 'λ館',
  'Σ生協食堂', 'Θ館', 'Ω館', 'τ大学院棟', '学生ラウンジ', 'βヴィレッジ', 'Ηヴィレッジ',
]

describe('CAMPUS_LAYOUT', () => {
  it('covers the required SFC buildings', () => {
    const names = CAMPUS_LAYOUT.buildings.map((b) => b.name)
    for (const name of REQUIRED) expect(names).toContain(name)
    expect(buildingById('alpha')?.name).toBe('Α本館')
  })
  it('keeps every building inside the map and apart from the others', () => {
    for (const b of CAMPUS_LAYOUT.buildings) {
      expect(b.x).toBeGreaterThan(0)
      expect(b.y).toBeGreaterThan(0)
      expect(b.x + b.w).toBeLessThan(CAMPUS_LAYOUT.width)
      expect(b.y + b.h).toBeLessThan(CAMPUS_LAYOUT.height)
      expect(b.w).toBeGreaterThanOrEqual(100)
      expect(b.h).toBeGreaterThanOrEqual(70)
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
  it('keeps the pond, paths, cliffs and tree zones inside the map', () => {
    for (const p of CAMPUS_LAYOUT.pond) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(CAMPUS_LAYOUT.width)
      expect(p.y).toBeLessThanOrEqual(CAMPUS_LAYOUT.height)
    }
    expect(CAMPUS_LAYOUT.pond.length).toBeGreaterThanOrEqual(6)
    for (const path of CAMPUS_LAYOUT.paths) {
      expect(path.points.length).toBeGreaterThanOrEqual(2)
      expect(path.width).toBeGreaterThanOrEqual(40)
      for (const p of path.points) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(CAMPUS_LAYOUT.width)
        expect(p.y).toBeLessThanOrEqual(CAMPUS_LAYOUT.height)
      }
    }
    for (const rect of [...CAMPUS_LAYOUT.cliffs, ...CAMPUS_LAYOUT.treeZones]) {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.w).toBeLessThanOrEqual(CAMPUS_LAYOUT.width)
      expect(rect.y + rect.h).toBeLessThanOrEqual(CAMPUS_LAYOUT.height)
    }
  })
  it('has dense tree zones along the avenue and the edges', () => {
    expect(CAMPUS_LAYOUT.treeZones.length).toBeGreaterThanOrEqual(6)
    const weighted = CAMPUS_LAYOUT.treeZones.reduce((sum, z) => sum + z.w * z.h * z.density, 0)
    expect(weighted).toBeGreaterThan(180000)
  })
  it('uses a 4:3 map', () => {
    expect(CAMPUS_LAYOUT.width).toBe(1600)
    expect(CAMPUS_LAYOUT.height).toBe(1200)
  })
})
