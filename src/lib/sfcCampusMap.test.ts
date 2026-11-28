import { describe, it, expect } from 'vitest'
import { MAP_W, MAP_H, SPAWN, BLOCKERS, HOTSPOTS, LABELS, AREA_LABELS, findNearbyHotspot, nearestArea } from './sfcCampusMap'
import { CAMPUS_LAYOUT } from './sfcCampusLayout'
import { CAMPUS_CELL, CAMPUS_GRID, CAMPUS_NAMIKI_CELL } from './sfcCampusGrid'
import { cellAt, cellAtPoint, isRoadCell } from './sfcCampusGridQuery'
import { isWalkable, nearestWalkable, type WalkOptions } from './sfcCampusMovement'

const o: WalkOptions = { blockers: BLOCKERS, radius: 6, mapW: MAP_W, mapH: MAP_H }

function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * CAMPUS_CELL + CAMPUS_CELL / 2, y: row * CAMPUS_CELL + CAMPUS_CELL / 2 }
}

describe('SFC campus map', () => {
  it('spawns on walkable road', () => {
    expect(isWalkable(SPAWN, o)).toBe(true)
    expect(isRoadCell(cellAtPoint(SPAWN.x, SPAWN.y))).toBe(true)
  })
  it('blocks the pond water and every building cell', () => {
    for (let r = 0; r < CAMPUS_GRID.length; r += 1) {
      for (let c = 0; c < CAMPUS_GRID[r].length; c += 1) {
        const ch = cellAt(c, r)
        if ('~nSKEIOLMUTWYA'.includes(ch)) expect(isWalkable(cellCenter(c, r), o)).toBe(false)
      }
    }
  })
  it('has unique hotspot ids and no village hotspots', () => {
    const ids = HOTSPOTS.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('beta-village')
    expect(ids).not.toContain('eta-village')
  })
  it('keeps every hotspot reachable from walkable ground within its radius', () => {
    for (const h of HOTSPOTS) {
      const p = nearestWalkable(h, o, 8)
      expect(isWalkable(p, o)).toBe(true)
      expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeLessThanOrEqual(h.r)
    }
  })
  it('puts the kamoike hotspot on the pond shore', () => {
    const k = HOTSPOTS.find((h) => h.id === 'kamoike')!
    expect(cellAtPoint(k.x, k.y)).not.toBe('~')
    let nearWater = false
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (cellAtPoint(k.x + dc * CAMPUS_CELL, k.y + dr * CAMPUS_CELL) === '~') nearWater = true
      }
    }
    expect(nearWater).toBe(true)
  })
  it('puts the namiki board at the centre of the namiki cell', () => {
    const h = HOTSPOTS.find((s) => s.id === 'namiki-board')!
    expect({ x: h.x, y: h.y }).toEqual(cellCenter(CAMPUS_NAMIKI_CELL.col, CAMPUS_NAMIKI_CELL.row))
    expect(cellAt(CAMPUS_NAMIKI_CELL.col, CAMPUS_NAMIKI_CELL.row)).toBe('=')
  })
  it('finds a hotspot within its radius', () => {
    const h = HOTSPOTS[0]
    expect(findNearbyHotspot(h.x, h.y)?.id).toBe(h.id)
    expect(findNearbyHotspot(-999, -999)).toBeNull()
  })
  it('labels the named buildings and areas, without villages', () => {
    const text = LABELS.map((l) => l.text).join(' ')
    for (const name of [
      'Α本館', 'Μメディアセンター', 'κ館', 'ε館', 'ι館', 'ο館', 'λ館',
      'Θ館', 'Ω館', 'τ大学院棟', 'Σ生協食堂', '学生ラウンジ', '鴨池', '並木道',
    ]) {
      expect(text).toContain(name)
    }
    expect(text).not.toContain('βヴィレッジ')
    expect(text).not.toContain('Ηヴィレッジ')
    expect(AREA_LABELS.map((a) => a.text)).not.toContain('ヴィレッジ')
  })
  it('names the nearest area', () => {
    const pond = AREA_LABELS.find((a) => a.text === '鴨池')
    expect(pond).toBeTruthy()
    expect(nearestArea(pond!.x, pond!.y)).toBe('鴨池')
  })
  it('keeps the layout size in step with the map', () => {
    expect(MAP_W).toBe(CAMPUS_LAYOUT.width)
    expect(MAP_H).toBe(CAMPUS_LAYOUT.height)
  })
})
