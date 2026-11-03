import { describe, it, expect } from 'vitest'
import {
  W3_DEFAULT_UNLOCKED,
  W3_UNLOCKS,
  findRoute3d,
  normalizeW3Graph,
  samplePath3d,
  validateWorld3dGraph,
  type W3Graph,
} from './rpgWorld3d'
import realGraphJson from '../../artifacts/3d/world1_graph.json'

const MINI: W3Graph = {
  nodes: [
    { id: 'a', x: 0, y: 0, z: 0 },
    { id: 'b', x: 4, y: 0, z: 0 },
    { id: 'c', x: 8, y: 2, z: 0 },
  ],
  paths: [
    { id: 'p-ab', from: 'a', to: 'b', kind: 'walk', speed: 2 },
    { id: 'p-bc', from: 'b', to: 'c', kind: 'jump', speed: 3, arcHeight: 1.5 },
  ],
}

describe('rpgWorld3d', () => {
  it('validates the Blender-exported W1 graph with no issues', () => {
    expect(validateWorld3dGraph(realGraphJson as W3Graph)).toEqual([])
  })

  it('exposes 16 nodes and 17 paths in the real graph', () => {
    const g = realGraphJson as W3Graph
    expect(g.nodes).toHaveLength(16)
    expect(g.paths).toHaveLength(17)
  })

  it('routes from start to exit when everything is unlocked', () => {    const g = realGraphJson as W3Graph
    const all = new Set(g.paths.map((p) => p.id))
    const route = findRoute3d(g, 'n0', 'n11', all)
    expect(route).not.toBeNull()
    expect(route![0]).toBe('n0')
    expect(route![route!.length - 1]).toBe('n11')
  })

  it('reaches stage-1 with default unlocks but not the jump', () => {
    const g = realGraphJson as W3Graph
    const open = new Set(W3_DEFAULT_UNLOCKED)
    expect(findRoute3d(g, 'n0', 'n6', open)).not.toBeNull()
    expect(findRoute3d(g, 'n0', 'n8', open)).toBeNull()
  })

  it('unlocks the full journey stage by stage', () => {
    const g = realGraphJson as W3Graph
    const open = new Set(W3_DEFAULT_UNLOCKED)
    for (const s of ['grass-stage-1', 'grass-stage-2', 'grass-stage-3']) {
      for (const p of W3_UNLOCKS[s]) open.add(p)
    }
    expect(findRoute3d(g, 'n0', 'n11', open)).not.toBeNull()
  })

  it('samples exact endpoints and never overshoots', () => {
    const p = MINI.paths[0]
    const s = samplePath3d(MINI, p, 'a', 0)
    expect([s.pos[0], s.pos[2]]).toEqual([0, 0])
    const e = samplePath3d(MINI, p, 'a', 10_000)
    expect(e.t).toBe(1)
    expect(e.pos[0]).toBeCloseTo(4, 6)
  })

  it('adds the arc height mid-jump and mid-bridge', () => {
    const p = MINI.paths[1]
    const len = 8
    const mid = samplePath3d(MINI, p, 'b', len / 2, 'a', undefined, len)
    expect(mid.pos[1]).toBeGreaterThan(1 + 1.4)
    const g = realGraphJson as W3Graph
    const bridge = g.paths.find((x) => x.id === 'p3')!
    expect(bridge.arcHeight).toBeCloseTo(0.65, 2)
  })

  it('rejects bad graphs', () => {
    expect(validateWorld3dGraph({ nodes: [], paths: [] })).not.toEqual([])
    const bad: W3Graph = {
      nodes: [{ id: 'a', x: 0, y: 0, z: 0 }],
      paths: [{ id: 'p', from: 'a', to: 'zz', kind: 'walk', speed: 1 }],
    }
    expect(validateWorld3dGraph(bad).length).toBeGreaterThan(0)
  })

  it('normalizes Blender stage keys and exposes all three stage entries', () => {
    const g = normalizeW3Graph(realGraphJson as W3Graph)
    const byId = new Map(g.nodes.map((n) => [n.id, n]))
    expect(byId.get('n6')?.stageId).toBe('grass-stage-1')
    expect(byId.get('n8')?.stageId).toBe('grass-stage-2')
    expect(byId.get('n9')?.stageId).toBe('grass-stage-3')
    expect(validateWorld3dGraph(g)).toEqual([])
  })
})
