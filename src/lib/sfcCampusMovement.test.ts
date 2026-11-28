import { describe, it, expect } from 'vitest'
import {
  collides, isWalkable, moveWithCollision, nearestWalkable, findPath, clampCamera,
  type Blocker, type WalkOptions,
} from './sfcCampusMovement'

const base: WalkOptions = { blockers: [], radius: 6, mapW: 200, mapH: 200 }

describe('collides', () => {
  it('blocks a polygon interior and its edges, but not the outside', () => {
    const square: Blocker = { kind: 'poly', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }] }
    expect(collides(20, 20, [square], 6)).toBe(true)
    expect(collides(43, 20, [square], 6)).toBe(true)
    expect(collides(60, 20, [square], 6)).toBe(false)
  })
  it('detects a circle against a rect', () => {
    const wall: Blocker = { kind: 'rect', x: 0, y: 0, w: 20, h: 20 }
    expect(collides(10, 10, [wall], 6)).toBe(true)
    expect(collides(30, 10, [wall], 6)).toBe(false)
  })
  it('detects a circle against a circle', () => {
    const pond: Blocker = { kind: 'circle', x: 50, y: 50, r: 10 }
    expect(collides(55, 50, [pond], 6)).toBe(true)
    expect(collides(70, 50, [pond], 6)).toBe(false)
  })
})

describe('moveWithCollision', () => {
  it('blocks x and slides along y', () => {
    const wall: Blocker = { kind: 'rect', x: 20, y: 0, w: 20, h: 100 }
    const o: WalkOptions = { ...base, blockers: [wall] }
    expect(moveWithCollision({ x: 10, y: 30 }, 20, 5, o)).toEqual({ x: 10, y: 35 })
  })
  it('clamps to the map bounds', () => {
    expect(moveWithCollision({ x: 10, y: 10 }, -50, -50, base)).toEqual({ x: 6, y: 6 })
  })
})

describe('isWalkable', () => {
  it('rejects the outer radius', () => {
    expect(isWalkable({ x: 3, y: 50 }, base)).toBe(false)
    expect(isWalkable({ x: 50, y: 50 }, base)).toBe(true)
  })
})

describe('findPath', () => {
  const wall: Blocker = { kind: 'rect', x: 80, y: 0, w: 20, h: 160 }
  const o: WalkOptions = { ...base, blockers: [wall] }
  it('routes around a wall and stays walkable', () => {
    const path = findPath({ x: 20, y: 100 }, { x: 160, y: 100 }, o, 10)
    expect(path.length).toBeGreaterThan(2)
    expect(path.every((p) => isWalkable(p, o))).toBe(true)
    const end = path[path.length - 1]
    expect(Math.hypot(end.x - 160, end.y - 100)).toBeLessThanOrEqual(10)
  })
  it('returns [] when the goal is fully walled off', () => {
    const fullWall: Blocker = { kind: 'rect', x: 80, y: 0, w: 20, h: 200 }
    expect(findPath({ x: 20, y: 100 }, { x: 160, y: 100 }, { ...base, blockers: [fullWall] }, 10)).toEqual([])
  })
  it('moves a blocked goal to walkable ground', () => {
    const block: Blocker = { kind: 'rect', x: 80, y: 80, w: 40, h: 40 }
    const o2: WalkOptions = { ...base, blockers: [block] }
    const path = findPath({ x: 20, y: 100 }, { x: 100, y: 100 }, o2, 10)
    expect(path.length).toBeGreaterThan(0)
    expect(path.every((p) => isWalkable(p, o2))).toBe(true)
  })
  it('does not append a deep-blocked goal to the path', () => {
    const big: Blocker = { kind: 'rect', x: 100, y: 100, w: 600, h: 600 }
    const o3: WalkOptions = { blockers: [big], radius: 6, mapW: 800, mapH: 800 }
    const path = findPath({ x: 50, y: 50 }, { x: 400, y: 400 }, o3, 16)
    expect(path.length).toBeGreaterThan(0)
    expect(path.every((p) => isWalkable(p, o3))).toBe(true)
  })
  it('returns no path when start and goal share a blocked cell', () => {
    const big: Blocker = { kind: 'rect', x: 100, y: 100, w: 600, h: 600 }
    const o3: WalkOptions = { blockers: [big], radius: 6, mapW: 800, mapH: 800 }
    const path = findPath({ x: 400, y: 400 }, { x: 400, y: 400 }, o3, 16)
    expect(path.length).toBe(0)
    expect(path.every((p) => isWalkable(p, o3))).toBe(true)
  })
})

describe('nearestWalkable', () => {
  it('moves a blocked point to free ground', () => {
    const wall: Blocker = { kind: 'rect', x: 40, y: 40, w: 40, h: 40 }
    const o: WalkOptions = { ...base, blockers: [wall] }
    const p = nearestWalkable({ x: 60, y: 60 }, o, 10)
    expect(isWalkable(p, o)).toBe(true)
    expect(Math.hypot(p.x - 60, p.y - 60)).toBeLessThanOrEqual(40)
  })
})

describe('clampCamera', () => {
  it('clamps to the map edges', () => {
    expect(clampCamera({ x: 0, y: 0 }, { w: 200, h: 100 }, { w: 400, h: 300 }, 2)).toEqual({ x: 50, y: 25 })
    expect(clampCamera({ x: 500, y: 500 }, { w: 200, h: 100 }, { w: 400, h: 300 }, 2)).toEqual({ x: 350, y: 275 })
  })
  it('centers the map when it is smaller than the view', () => {
    expect(clampCamera({ x: 0, y: 0 }, { w: 1000, h: 1000 }, { w: 400, h: 300 }, 2)).toEqual({ x: 200, y: 150 })
  })
})
