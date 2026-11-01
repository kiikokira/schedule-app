import { describe, it, expect } from 'vitest'
import {
  WORLD_COUNT,
  NODES_PER_WORLD,
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
    expect(nodeForLevel(9, 200)).toBe(9)
  })
})

describe('WORLD_DEFS shape', () => {
  it('defines 9 worlds with 10 nodes each', () => {
    expect(WORLD_COUNT).toBe(9)
    expect(WORLD_DEFS).toHaveLength(9)
    for (const w of WORLD_DEFS) {
      expect(w.nodes).toHaveLength(NODES_PER_WORLD)
    }
  })

  it('chains every consecutive node with a valid edge kind', () => {
    const kinds: EdgeKind[] = ['walk', 'ladder', 'jump']
    for (const w of WORLD_DEFS) {
      expect(w.edges).toHaveLength(NODES_PER_WORLD - 1)
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
