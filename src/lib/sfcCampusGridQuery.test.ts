import { describe, it, expect } from 'vitest'
import { cellAt, cellAtPoint, isRoadCell, isBlockedCell, buildingsFromGrid, blockerRects, roadCellCenters } from './sfcCampusGridQuery'
import { isWalkable, type WalkOptions } from './sfcCampusMovement'
import { CAMPUS_SPAWN_CELL } from './sfcCampusGrid'

const NAMED = ['sigma-cafeteria', 'kappa', 'epsilon', 'iota', 'omicron', 'lambda', 'mu', 'lounge', 'theta', 'omega', 'tau', 'alpha']

describe('campus grid query', () => {
  it('treats outside cells as blocked cliffs', () => {
    expect(cellAt(-1, 0)).toBe('#')
    expect(isBlockedCell(cellAt(-1, 0))).toBe(true)
  })
  it('finds every named building exactly once', () => {
    const names = buildingsFromGrid().filter((b) => b.name !== null).map((b) => b.id)
    expect([...names].sort()).toEqual([...NAMED].sort())
  })
  it('puts every building entrance on a walkable road or grass cell', () => {
    const o: WalkOptions = { blockers: blockerRects(), radius: 6, mapW: 1480, mapH: 1184 }
    for (const b of buildingsFromGrid()) {
      expect(isBlockedCell(cellAtPoint(b.entrance.x, b.entrance.y))).toBe(false)
      expect(isWalkable(b.entrance, o)).toBe(true)
    }
  })
  it('spawns on a walkable road cell', () => {
    const o: WalkOptions = { blockers: blockerRects(), radius: 6, mapW: 1480, mapH: 1184 }
    const spawn = { x: CAMPUS_SPAWN_CELL.col * 8 + 4, y: CAMPUS_SPAWN_CELL.row * 8 + 4 }
    expect(isRoadCell(cellAt(CAMPUS_SPAWN_CELL.col, CAMPUS_SPAWN_CELL.row))).toBe(true)
    expect(isWalkable(spawn, o)).toBe(true)
  })
  it('reaches every walkable road centre and every entrance from the spawn over walkable cells', () => {
    const o: WalkOptions = { blockers: blockerRects(), radius: 6, mapW: 1480, mapH: 1184 }
    const centers = roadCellCenters().filter((p) => isWalkable(p, o))
    expect(centers.length).toBeGreaterThan(100)
    // 8マス刻みのBFSで、スポーンから歩けるマス（道・土・草地）を辿る
    const start = { x: CAMPUS_SPAWN_CELL.col * 8 + 4, y: CAMPUS_SPAWN_CELL.row * 8 + 4 }
    const seen = new Set<string>([`${start.x},${start.y}`])
    const queue = [start]
    while (queue.length) {
      const p = queue.shift()!
      for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const q = { x: p.x + dx, y: p.y + dy }
        const key = `${q.x},${q.y}`
        if (!seen.has(key) && isWalkable(q, o) && !isBlockedCell(cellAtPoint(q.x, q.y))) {
          seen.add(key)
          queue.push(q)
        }
      }
    }
    for (const p of centers) expect(seen.has(`${p.x},${p.y}`)).toBe(true)
    for (const b of buildingsFromGrid()) {
      expect(isWalkable(b.entrance, o)).toBe(true)
      expect(seen.has(`${b.entrance.x},${b.entrance.y}`)).toBe(true)
    }
  })
  it('keeps the pond and buildings blocked', () => {
    const o: WalkOptions = { blockers: blockerRects(), radius: 6, mapW: 1480, mapH: 1184 }
    for (let r = 0; r < 148; r += 1) for (let c = 0; c < 185; c += 1) {
      if (isBlockedCell(cellAt(c, r))) expect(isWalkable({ x: c * 8 + 4, y: r * 8 + 4 }, o)).toBe(false)
    }
  })
})
