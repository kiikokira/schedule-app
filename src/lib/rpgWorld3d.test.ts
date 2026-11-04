import { describe, it, expect } from 'vitest'
import {
  W3_DEFAULT_UNLOCKED,
  W3_UNLOCKS,
  decideStep,
  findRoute3d,
  normalizeW3Graph,
  samplePath3d,
  validateWorld3dGraph,
  type W3Graph,
} from './rpgWorld3d'
import realGraphJson from '../../artifacts/3d/world1_graph.json'
import desertGraphJson from '../../artifacts/3d/world2_graph.json'

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

describe('rpgWorld3d desert (W2)', () => {
  const g = normalizeW3Graph(desertGraphJson as unknown as W3Graph)

  it('validates the Blender-exported W2 graph with no issues', () => {
    expect(validateWorld3dGraph(g)).toEqual([])
  })

  it('exposes 16 nodes and 17 paths with desert stages', () => {
    expect(g.nodes).toHaveLength(16)
    expect(g.paths).toHaveLength(17)
    const byId = new Map(g.nodes.map((n) => [n.id, n]))
    expect(byId.get('n6')?.stageId).toBe('desert-stage-1')
    expect(byId.get('n8')?.stageId).toBe('desert-stage-2')
    expect(byId.get('n9')?.stageId).toBe('desert-stage-3')
  })

  it('reaches stage-1 with default unlocks, full journey stage by stage', () => {
    const open = new Set(W3_DEFAULT_UNLOCKED)
    expect(findRoute3d(g, 'n0', 'n6', open)).not.toBeNull()
    expect(findRoute3d(g, 'n0', 'n8', open)).toBeNull()
    for (const s of ['desert-stage-1', 'desert-stage-2', 'desert-stage-3']) {
      for (const p of W3_UNLOCKS[s]) open.add(p)
    }
    const route = findRoute3d(g, 'n0', 'n11', open)
    expect(route).not.toBeNull()
    expect(route![route!.length - 1]).toBe('n11')
  })

  it('has a measured bridge arc and a valid jump gap', () => {
    const bridge = g.paths.find((x) => x.id === 'p3')!
    expect(bridge.kind).toBe('bridge')
    expect(bridge.arcHeight ?? 0).toBeGreaterThan(0.3)
    const jump = g.paths.find((x) => x.id === 'p12')!
    expect(jump.kind).toBe('jump')
    expect(jump.oneWay).toBe(true)
  })
})

const WORLD_FILES = [
  { file: 'world3_graph.json', prefix: 'snow', nodes: 16, paths: 17 },
  { file: 'world4_graph.json', prefix: 'sea', nodes: 18, paths: 19 },
  { file: 'world5_graph.json', prefix: 'forest', nodes: 16, paths: 17 },
  { file: 'world6_graph.json', prefix: 'rock', nodes: 16, paths: 17 },
  { file: 'world7_graph.json', prefix: 'cloud', nodes: 16, paths: 17 },
  { file: 'world8_graph.json', prefix: 'lava', nodes: 16, paths: 17 },
  { file: 'world9_graph.json', prefix: 'star', nodes: 16, paths: 17 },
] as const

// artifacts配下の全ワールドグラフを一括検証する
const graphModules = import.meta.glob('../../artifacts/3d/world*_graph.json', { eager: true }) as Record<string, { default: W3Graph }>

describe.each(WORLD_FILES)('rpgWorld3d $prefix', ({ file, prefix, nodes, paths }) => {
  const raw = graphModules[`../../artifacts/3d/${file}`].default as unknown as W3Graph
  const g = normalizeW3Graph(raw)

  it('validates with no issues and exposes expected node/path counts', () => {
    expect(validateWorld3dGraph(g)).toEqual([])
    expect(g.nodes).toHaveLength(nodes)
    expect(g.paths).toHaveLength(paths)
  })

  it('exposes three stage entries and unlocks the full journey', () => {
    const byId = new Map(g.nodes.map((n) => [n.id, n]))
    expect(byId.get('n6')?.stageId).toBe(`${prefix}-stage-1`)
    expect(byId.get('n8')?.stageId).toBe(`${prefix}-stage-2`)
    expect(byId.get('n9')?.stageId).toBe(`${prefix}-stage-3`)
    const open = new Set(W3_DEFAULT_UNLOCKED)
    expect(findRoute3d(g, 'n0', 'n6', open)).not.toBeNull()
    expect(findRoute3d(g, 'n0', 'n8', open)).toBeNull()
    for (const s of [`${prefix}-stage-1`, `${prefix}-stage-2`, `${prefix}-stage-3`]) {
      for (const p of W3_UNLOCKS[s]) open.add(p)
    }
    const route = findRoute3d(g, 'n0', 'n11', open)
    expect(route).not.toBeNull()
    expect(route![route!.length - 1]).toBe('n11')
  })

  it('has bridge arc and one-way jump', () => {
    const bridge = g.paths.find((x) => x.id === 'p3')!
    expect(bridge.kind).toBe('bridge')
    expect(bridge.arcHeight ?? 0).toBeGreaterThan(0.3)
    const jump = g.paths.find((x) => x.id === 'p12')!
    expect(jump.kind).toBe('jump')
    expect(jump.oneWay).toBe(true)
  })
})

describe('rpgWorld3d W4 swim route', () => {
  const raw = graphModules['../../artifacts/3d/world4_graph.json'].default as unknown as W3Graph
  const g = normalizeW3Graph(raw)

  it('has a two-way swim path across the lagoon reachable by default', () => {
    const swim = g.paths.find((x) => x.id === 'w4-swim')!
    expect(swim.kind).toBe('swim')
    expect(swim.oneWay).toBe(false)
    expect(W3_DEFAULT_UNLOCKED).toContain('w4-swim')
    expect(W3_DEFAULT_UNLOCKED).toContain('w4-swim-walk')
    const open = new Set(W3_DEFAULT_UNLOCKED)
    const route = findRoute3d(g, 'n0', 'w4-swim-out', open)
    expect(route).not.toBeNull()
    expect(route).toContain('w4-swim-in')
    expect(route![route!.length - 1]).toBe('w4-swim-out')
  })

  it('keeps the swim spur off the main journey (no shortcut)', () => {
    const open = new Set(W3_DEFAULT_UNLOCKED)
    for (const s of ['sea-stage-1', 'sea-stage-2', 'sea-stage-3']) {
      for (const p of W3_UNLOCKS[s]) open.add(p)
    }
    const route = findRoute3d(g, 'w4-swim-out', 'n11', open)!
    expect(route[1]).toBe('w4-swim-in')
  })
})

describe('decideStep (D-pad never goes silent)', () => {
  const g1 = normalizeW3Graph(realGraphJson as unknown as W3Graph)
  const g3raw = graphModules['../../artifacts/3d/world3_graph.json'].default as unknown as W3Graph
  const g3 = normalizeW3Graph(g3raw)
  const open = () => new Set(W3_DEFAULT_UNLOCKED)

  it('w1 start: right/up step forward, left/down nudge the viewpoint instead of silence', () => {
    const right = decideStep(g1, 'n0', 1, 0, open())
    expect(right.type).toBe('step')
    if (right.type === 'step') expect(right.toId).toBe('n1')
    const up = decideStep(g1, 'n0', 0, -1, open())
    expect(up.type).toBe('step')
    const left = decideStep(g1, 'n0', -1, 0, open())
    expect(left.type).toBe('nudge')
    if (left.type === 'nudge') expect(left.yawDelta).not.toBe(0)
    const down = decideStep(g1, 'n0', 0, 1, open())
    expect(down.type).toBe('nudge')
    if (down.type === 'nudge') expect(down.yawDelta).not.toBe(0)
  })

  it('w3 start (mirrored layout): left steps while right nudges', () => {
    const left = decideStep(g3, 'n0', -1, 0, open())
    expect(left.type).toBe('step')
    const right = decideStep(g3, 'n0', 1, 0, open())
    expect(right.type).toBe('nudge')
  })

  it('every arrow from n0 in every world yields step or nudge (never silent)', () => {
    const worlds: W3Graph[] = [g1, normalizeW3Graph(desertGraphJson as unknown as W3Graph)]
    for (const raw of Object.values(graphModules)) {
      worlds.push(normalizeW3Graph((raw as { default: W3Graph }).default))
    }
    const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]]
    for (const g of worlds) {
      for (const [dx, dz] of dirs) {
        const d = decideStep(g, 'n0', dx, dz, open())
        if (d.type === 'step') {
          expect(d.dot).toBeGreaterThan(0)
          expect(d.toId).not.toBe('n0')
        } else {
          expect(d.yawDelta).not.toBe(0)
        }
      }
    }
  })

  it('with nothing unlocked every arrow still nudges (worst-case save)', () => {
    const empty = new Set<string>()
    for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const d = decideStep(g1, 'n0', dx, dz, empty)
      expect(d.type).toBe('nudge')
    }
  })
})
