import { describe, it, expect } from 'vitest'
import {
  WORLD_COUNT,
  WORLD_DEFS,
  worldForLevel,
  nodeForLevel,
  unlockedWorldCount,
  type EdgeKind,
} from './rpgWorlds'

describe('rpgWorlds progression', () => {
  it('maps levels 1-10 to world 1 and 11-20 to world 2', () => {
    expect(worldForLevel(1)).toBe(1)
    expect(worldForLevel(10)).toBe(1)
    expect(worldForLevel(11)).toBe(2)
    expect(worldForLevel(20)).toBe(2)
  })

  it('caps at world 9 for high levels and clamps low levels to 1', () => {
    expect(worldForLevel(81)).toBe(9)
    expect(worldForLevel(200)).toBe(9)
    expect(worldForLevel(0)).toBe(1)
  })

  it('unlocks one world per cleared 10-level band', () => {
    expect(unlockedWorldCount(1)).toBe(1)
    expect(unlockedWorldCount(10)).toBe(1)
    expect(unlockedWorldCount(11)).toBe(2)
    expect(unlockedWorldCount(90)).toBe(9)
  })

  it('places the token on the node matching the in-band level', () => {
    expect(nodeForLevel(1, 1)).toBe(0)
    expect(nodeForLevel(1, 10)).toBe(9)
    expect(nodeForLevel(2, 15)).toBe(4)
    expect(nodeForLevel(9, 200)).toBe(11)
  })

  it('spreads 10 band levels across worlds with extra nodes', () => {
    const w3 = WORLD_DEFS[2]
    expect(w3.nodes.length).toBeGreaterThan(10)
    expect(nodeForLevel(3, 21)).toBe(0)
    expect(nodeForLevel(3, 30)).toBe(w3.nodes.length - 1)
  })
})

describe('WORLD_DEFS shape', () => {
  it('defines 9 worlds with about 10 nodes each (never below 10)', () => {
    expect(WORLD_COUNT).toBe(9)
    expect(WORLD_DEFS).toHaveLength(9)
    for (const w of WORLD_DEFS) {
      expect(w.nodes.length).toBeGreaterThanOrEqual(10)
      expect(w.nodes.length).toBeLessThanOrEqual(12)
    }
    expect(new Set(WORLD_DEFS.map((w) => w.nodes.length)).size).toBeGreaterThan(1)
  })

  it('chains every consecutive node with a valid edge kind', () => {
    const kinds: EdgeKind[] = ['walk', 'ladder', 'jump']
    for (const w of WORLD_DEFS) {
      expect(w.edges).toHaveLength(w.nodes.length - 1)
      w.edges.forEach((e, i) => {
        expect(e.from).toBe(i)
        expect(e.to).toBe(i + 1)
        expect(kinds).toContain(e.kind)
      })
    }
  })

  it('gives every world at least one ladder and one jump', () => {
    for (const w of WORLD_DEFS) {
      expect(w.edges.some((e) => e.kind === 'ladder')).toBe(true)
      expect(w.edges.some((e) => e.kind === 'jump')).toBe(true)
    }
  })

  it('keeps every node inside the 360x220 stage', () => {
    for (const w of WORLD_DEFS) {
      for (const n of w.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0)
        expect(n.x).toBeLessThanOrEqual(360)
        expect(n.y).toBeGreaterThanOrEqual(0)
        expect(n.y).toBeLessThanOrEqual(220)
      }
    }
  })
})
