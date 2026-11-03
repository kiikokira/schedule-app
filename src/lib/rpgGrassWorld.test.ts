import { describe, it, expect } from 'vitest'
import {
  GRASS_NODES,
  GRASS_PATHS,
  GRASS_STAGES,
  findGrassRoute,
  getGrassTerrainHeightAt,
  positionAlongGrassPath,
  validateGrassWorld,
} from './rpgGrassWorld'

describe('rpgGrassWorld', () => {
  it('has unique node ids and valid path references', () => {
    const issues = validateGrassWorld()
    expect(issues).toEqual([])
  })

  it('keeps curve endpoints on their nodes', () => {
    for (const p of GRASS_PATHS) {
      const a = GRASS_NODES.find((n) => n.id === p.fromId)!
      const b = GRASS_NODES.find((n) => n.id === p.toId)!
      expect(a).toBeDefined()
      expect(b).toBeDefined()
      const first = p.points[0]
      const last = p.points[p.points.length - 1]
      expect(Math.hypot(first.x - a.x, first.y - a.y)).toBeLessThan(1)
      expect(Math.hypot(last.x - b.x, last.y - b.y)).toBeLessThan(1)
    }
  })

  it('grounds the character within tolerance', () => {
    const n = GRASS_NODES[0]
    expect(Math.abs(getGrassTerrainHeightAt(n.x, n.y) - n.h)).toBeLessThanOrEqual(6)
  })

  it('finds a route from start to the stage and refuses locked paths', () => {
    const open = findGrassRoute('g-n0', 'g-n5', new Set(GRASS_PATHS.map((p) => p.id)))
    expect(open).not.toBeNull()
    expect(open![0]).toBe('g-n0')
    expect(open![open!.length - 1]).toBe('g-n5')
    const locked = findGrassRoute('g-n0', 'g-n10', new Set(['g-p0']))
    expect(locked).toBeNull()
  })

  it('moves along a path with deltaTime and never passes the end', () => {
    const p = GRASS_PATHS[0]
    const start = positionAlongGrassPath(p, 0)
    expect(start.t).toBe(0)
    const end = positionAlongGrassPath(p, 10_000)
    expect(end.t).toBe(1)
    expect(end.x).toBeCloseTo(p.points[p.points.length - 1].x, 0)
  })

  it('defines at least three stage entries', () => {
    expect(GRASS_STAGES.length).toBeGreaterThanOrEqual(3)
  })
})
