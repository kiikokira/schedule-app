import { describe, it, expect } from 'vitest'
import {
  w1TerrainHeight,
  distToPolyline,
  distToSegment,
  W1_RIVER,
  W1_RIVER_HALF,
  W1_LAKE,
  W1_LAYOUT,
} from './rpgWorldGen'
import realGraphJson from '../../artifacts/3d/world1_graph.json'

const PATHS: [string, string][] = [
  ['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3a'], ['n3a', 'n3b'], ['n3b', 'n4'],
  ['n4', 'n5a'], ['n4', 'n5c'], ['n5c', 'n5d'], ['n5d', 'n6'], ['n5a', 'n5b'],
  ['n5b', 'n6'], ['n5b', 'n5d'], ['n6', 'n7'], ['n7', 'n8'], ['n8', 'n9'],
  ['n9', 'n10'], ['n10', 'n11'],
]

describe('rpgWorldGen W1 island', () => {
  it('is deterministic', () => {
    expect(w1TerrainHeight(3.5, -7.25)).toBe(w1TerrainHeight(3.5, -7.25))
  })

  it('keeps every node on dry land with a walkable height', () => {
    for (const [id, p] of Object.entries(W1_LAYOUT)) {
      const h = w1TerrainHeight(p.x, p.z)
      expect(h, `${id} above water`).toBeGreaterThan(-0.5)
      expect(h, `${id} sane height`).toBeLessThan(12)
    }
  })

  it('spreads wider than the old 24m island', () => {
    const xs = Object.values(W1_LAYOUT).map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(30)
  })

  it('lets the river cross only the bridge path', () => {
    for (const [a, b] of PATHS) {
      const pa = W1_LAYOUT[a]
      const pb = W1_LAYOUT[b]
      // sample along the segment, min distance to river
      let minD = Infinity
      for (let i = 0; i <= 20; i++) {
        const x = pa.x + ((pb.x - pa.x) * i) / 20
        const z = pa.z + ((pb.z - pa.z) * i) / 20
        minD = Math.min(minD, distToPolyline(x, z, W1_RIVER))
      }
      if (a === 'n3a' && b === 'n3b') {
        expect(minD, 'bridge must cross the river').toBeLessThan(W1_RIVER_HALF)
      } else {
        expect(minD, `${a}->${b} keeps clear of the river`).toBeGreaterThan(W1_RIVER_HALF + 1.2)
      }
    }
  })

  it('keeps the lake clear of all paths', () => {
    for (const [a, b] of PATHS) {
      const pa = W1_LAYOUT[a]
      const pb = W1_LAYOUT[b]
      let minD = Infinity
      for (let i = 0; i <= 20; i++) {
        const x = pa.x + ((pb.x - pa.x) * i) / 20
        const z = pa.z + ((pb.z - pa.z) * i) / 20
        minD = Math.min(minD, Math.hypot(x - W1_LAKE.x, z - W1_LAKE.z))
      }
      expect(minD, `${a}->${b} keeps clear of the lake`).toBeGreaterThan(W1_LAKE.r + 1.5)
    }
  })

  it('keeps the ladder climb steep enough for validation', () => {
    const a = W1_LAYOUT.n5c
    const b = W1_LAYOUT.n5d
    const dy = Math.abs(w1TerrainHeight(b.x, b.z) - w1TerrainHeight(a.x, a.z))
    expect(dy).toBeGreaterThanOrEqual(1)
  })

  it('distToSegment behaves', () => {
    expect(distToSegment(0, 1, { x: -1, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(1)
    expect(distToSegment(0, 0, { x: -1, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(0)
  })

  it('checked-in W1 graph matches the layout and terrain heights', () => {
    const g = realGraphJson as unknown as {
      nodes: { id: string; x: number; y: number; z: number; kind?: string; stageId?: string; stage?: string }[]
      paths: { id: string; from: string; to: string }[]
    }
    expect(g.nodes).toHaveLength(16)
    expect(g.paths).toHaveLength(17)
    for (const n of g.nodes) {
      const laid = W1_LAYOUT[n.id]
      expect(laid, `unknown node ${n.id}`).toBeDefined()
      expect(n.x).toBe(laid.x)
      expect(n.z).toBe(laid.z)
      expect(Math.abs(n.y - w1TerrainHeight(n.x, n.z)), `${n.id} grounded`).toBeLessThan(0.06)
      if (n.id === 'n6' || n.id === 'n8' || n.id === 'n9') {
        expect(n.stageId ?? (n as { stage?: string }).stage).toBeDefined()
      }
    }
  })
})
