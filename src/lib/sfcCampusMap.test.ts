import { describe, it, expect } from 'vitest'
import { MAP_W, MAP_H, SPAWN, BLOCKERS, HOTSPOTS, LABELS, AREA_LABELS, findNearbyHotspot, nearestArea } from './sfcCampusMap'
import { CAMPUS_LAYOUT } from './sfcCampusLayout'
import { isWalkable, nearestWalkable, type WalkOptions } from './sfcCampusMovement'

const o: WalkOptions = { blockers: BLOCKERS, radius: 6, mapW: MAP_W, mapH: MAP_H }

describe('SFC campus map', () => {
  it('spawns on walkable ground', () => {
    expect(isWalkable(SPAWN, o)).toBe(true)
  })
  it('blocks every building and the pond', () => {
    for (const b of CAMPUS_LAYOUT.buildings) {
      expect(isWalkable({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, o)).toBe(false)
    }
    const pond = AREA_LABELS.find((a) => a.text === '鴨池')!
    expect(isWalkable({ x: pond.x, y: pond.y }, o)).toBe(false)
  })
  it('has unique hotspot ids', () => {
    expect(new Set(HOTSPOTS.map((h) => h.id)).size).toBe(HOTSPOTS.length)
  })
  it('keeps every hotspot reachable from walkable ground', () => {
    for (const h of HOTSPOTS) {
      const p = nearestWalkable({ x: h.x, y: h.y }, o, 16)
      expect(isWalkable(p, o)).toBe(true)
      expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeLessThanOrEqual(h.r + 40)
    }
  })
  it('finds a hotspot within its radius', () => {
    const h = HOTSPOTS[0]
    expect(findNearbyHotspot(h.x, h.y)?.id).toBe(h.id)
    expect(findNearbyHotspot(-999, -999)).toBeNull()
  })
  it('labels the SFC campus', () => {
    const text = LABELS.map((l) => l.text).join(' ')
    for (const name of [
      'Α本館', 'Μメディアセンター', 'κ館', 'ε館', 'ι館', 'ο館', 'λ館',
      'Θ館', 'Ω館', 'τ大学院棟', 'Σ生協食堂', '鴨池', '並木道', 'βヴィレッジ', 'Ηヴィレッジ',
    ]) {
      expect(text).toContain(name)
    }
  })
  it('names the nearest area', () => {
    const pond = AREA_LABELS.find((a) => a.text === '鴨池')
    expect(pond).toBeTruthy()
    expect(nearestArea(pond!.x, pond!.y)).toBe('鴨池')
  })
})
