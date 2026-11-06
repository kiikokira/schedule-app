// src/lib/rpgW1Visual.ts
import { w1StageStatus, w1NextStage, normalizeW1Cleared, W1_STAGE_ORDER, W1_UNLOCKS } from './rpgW1Stages'
import type { W3Graph } from './rpgWorld3d'
export type W1VisualStatus = 'cleared' | 'next' | 'future'
export const W1_YELLOW_RING = '#ffd233'
export const W1_FUTURE_CENTER = '#20242c'
export function w1VisualFor(stageId: string | undefined, cleared: readonly string[]): W1VisualStatus {
  if (!stageId) return 'cleared'
  const s = w1StageStatus(stageId, cleared)
  if (s === 'cleared') return 'cleared'
  if (s === 'next') return 'next'
  return 'future'
}
/** Beyond-next path set: union of unlock sets for stages strictly after next. */
export function w1BeyondPathIds(cleared: readonly string[]): Set<string> {
  const norm = normalizeW1Cleared([...cleared])
  const next = w1NextStage(norm)
  if (!next) return new Set()
  const idx = (W1_STAGE_ORDER as readonly string[]).indexOf(next)
  const out = new Set<string>()
  for (let i = idx + 1; i < W1_STAGE_ORDER.length; i++) {
    const s = W1_STAGE_ORDER[i]
    for (const pid of W1_UNLOCKS[s] ?? []) out.add(pid)
  }
  return out
}
// v3 edge -> path id (both directions map to same path).
const EDGE_TO_PATH: Record<string, string> = {
  'n0>n1': 'p0', 'n1>n2': 'p1', 'n2>n3a': 'p2', 'n3a>n3b': 'p3',
  'n3b>n4': 'p4', 'n4>n5a': 'p5', 'n5a>n5b': 'p6', 'n4>n5c': 'p7',
  'n5c>n5d': 'p8', 'n5d>n6': 'p9', 'n5b>n6': 'p10', 'n6>n7': 'p11',
  'n7>n8': 'p12', 'n8>n9': 'p13', 'n9>n10': 'p14', 'n10>n11': 'p15',
  'n5b>n5d': 'p16',
}
function edgePathId(fromId: string, toId: string): string | null {
  return EDGE_TO_PATH[`${fromId}>${toId}`] ?? EDGE_TO_PATH[`${toId}>${fromId}`] ?? null
}
export function isPathBeyondNext(fromId: string, toId: string, cleared: readonly string[]): boolean {
  const pid = edgePathId(fromId, toId)
  if (!pid) return false
  return w1BeyondPathIds(cleared).has(pid)
}
function segDistXZ(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax
  const vz = bz - az
  const l2 = vx * vx + vz * vz
  const t = l2 < 1e-9 ? 0 : Math.min(1, Math.max(0, ((px - ax) * vx + (pz - az) * vz) / l2))
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz))
}
/** Nearest v3 path to an XZ point within maxDist (2m default), else null. */
export function w1NearestPathId(x: number, z: number, graph: W3Graph, maxDist = 2): string | null {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  let best: string | null = null
  let bestD = Infinity
  for (const p of graph.paths) {
    const a = byId.get(p.from)
    const b = byId.get(p.to)
    if (!a || !b) continue
    const d = segDistXZ(x, z, a.x, a.z, b.x, b.z)
    if (d < bestD) {
      bestD = d
      best = p.id
    }
  }
  return bestD <= maxDist ? best : null
}
/** Proximity dimming: true when majority of matched samples lie on beyond-next paths. */
export function w1ShouldDimRoadSamples(samples: readonly { x: number; z: number }[], cleared: readonly string[], graph: W3Graph, maxDist = 2): boolean {
  if (samples.length === 0) return false
  const beyond = w1BeyondPathIds(cleared)
  if (beyond.size === 0) return false
  let matched = 0
  let beyondCount = 0
  for (const s of samples) {
    const pid = w1NearestPathId(s.x, s.z, graph, maxDist)
    if (!pid) continue
    matched += 1
    if (beyond.has(pid)) beyondCount += 1
  }
  if (matched === 0) return false
  return beyondCount / matched > 0.5
}
