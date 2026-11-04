// 3Dワールドマップ用の経路グラフ・サンプリング・検証ロジック（three.js非依存）。
// 座標系: Blenderと同一 (x=東, y=高さ, z=北=+Z)。道メッシュはBlender側で同一点列から
// Chaikin平滑化して生成しており、こちらはCatmull-Rom(Hermite)で近似して同じ中心線をたどる。

export type V3 = [number, number, number]
export type W3NodeKind = 'start' | 'stop' | 'branch' | 'stage' | 'ladder_bottom' | 'ladder_top' | 'jump_from' | 'jump_to' | 'gate'
export type W3PathKind =
  | 'walk' | 'run' | 'bridge' | 'jump'
  | 'ladder_up' | 'ladder_down' | 'slope_up' | 'slope_down'
  | 'stairs_up' | 'stairs_down' | 'fall' | 'swim'
  | 'enter_building' | 'exit_building'

export type W3Node = { id: string; x: number; y: number; z: number; kind?: W3NodeKind; label?: string; stageId?: string }
export type W3Path = {
  id: string; from: string; to: string; kind: W3PathKind; speed: number;
  oneWay?: boolean; arcHeight?: number; jumpHeight?: number
}

/** arcHeight（橋の反り・ジャンプ放物線）。旧キーjumpHeightも受理する。 */
export function pathArc(p: W3Path): number {
  return p.arcHeight ?? p.jumpHeight ?? 0
}
export type W3Graph = { nodes: W3Node[]; paths: W3Path[] }

export const W3_DEFAULT_UNLOCKED: string[] = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p7', 'p8', 'p9', 'p10']
// W1とW2でパスID体系を共有するため解放表も共有する
export const W3_UNLOCKS: Record<string, string[]> = {
  'grass-stage-1': ['p6', 'p16', 'p11', 'p12'],
  'grass-stage-2': ['p13'],
  'grass-stage-3': ['p14', 'p15'],
  'desert-stage-1': ['p6', 'p16', 'p11', 'p12'],
  'desert-stage-2': ['p13'],
  'desert-stage-3': ['p14', 'p15'],
}

export function w3NodeById(g: W3Graph, id: string): W3Node {
  const n = g.nodes.find((v) => v.id === id)
  if (!n) throw new Error(`unknown 3d node: ${id}`)
  return n
}

/** Blender由来JSON (stageキー) をアプリ形式 (stageId) へ正規化する。 */
export function normalizeW3Graph(g: { nodes: (W3Node & { stage?: string })[]; paths: W3Path[] }): W3Graph {
  return {
    nodes: g.nodes.map((n) => ({ ...n, stageId: n.stageId ?? n.stage })),
    paths: g.paths,
  }
}

export function validateWorld3dGraph(g: W3Graph): string[] {
  const issues: string[] = []
  const ids = new Set<string>()
  for (const n of g.nodes) {
    if (ids.has(n.id)) issues.push(`duplicate node: ${n.id}`)
    ids.add(n.id)
    if (![n.x, n.y, n.z].every((v) => typeof v === 'number' && Number.isFinite(v))) {
      issues.push(`bad coords: ${n.id}`)
    }
  }
  if (g.nodes.length === 0) issues.push('no nodes')
  for (const p of g.paths) {
    if (!ids.has(p.from)) issues.push(`missing from: ${p.id} -> ${p.from}`)
    if (!ids.has(p.to)) issues.push(`missing to: ${p.id} -> ${p.to}`)
    if (p.from === p.to) issues.push(`self loop: ${p.id}`)
    if (!(p.speed > 0)) issues.push(`bad speed: ${p.id}`)
    if (p.kind === 'jump' && !(pathArc(p) > 0)) issues.push(`jump needs arcHeight: ${p.id}`)
    if (p.kind === 'ladder_up' || p.kind === 'ladder_down') {
      const a = g.nodes.find((n) => n.id === p.from)
      const b = g.nodes.find((n) => n.id === p.to)
      if (a && b && Math.abs(b.y - a.y) < 1) issues.push(`ladder too flat: ${p.id}`)
    }
  }
  return issues
}

export function findRoute3d(g: W3Graph, fromId: string, toId: string, unlocked: Set<string>): string[] | null {
  if (fromId === toId) return [fromId]
  const prev = new Map<string, string>()
  const seen = new Set<string>([fromId])
  const queue = [fromId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const p of g.paths) {
      if (!unlocked.has(p.id)) continue
      let next: string | null = null
      if (p.from === cur) next = p.to
      else if (!p.oneWay && p.to === cur) next = p.from
      if (next && !seen.has(next)) {
        seen.add(next)
        prev.set(next, cur)
        if (next === toId) {
          const route = [toId]
          let c = toId
          while (prev.has(c)) {
            c = prev.get(c)!
            route.unshift(c)
          }
          return route
        }
        queue.push(next)
      }
    }
  }
  return null
}

function hermite(p0: V3, m0: V3, p1: V3, m1: V3, t: number): V3 {
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  return [
    h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0],
    h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1],
    h00 * p0[2] + h10 * m0[2] + h01 * p1[2] + h11 * m1[2],
  ]
}

function nodePos(n: W3Node): V3 {
  return [n.x, n.y, n.z]
}

/** 経路長（サンプリングによる折れ線近似）。lengthHintを与えるとそれを採用する。 */
export function pathLength3d(g: W3Graph, pathId: string, fromId: string, lengthHint?: number): number {
  if (lengthHint && lengthHint > 0) return lengthHint
  const p = g.paths.find((v) => v.id === pathId)!
  let len = 0
  let prev: V3 | null = null
  for (let i = 0; i <= 24; i++) {
    const s = samplePath3d(g, p, fromId, i / 24, undefined, undefined, 1)
    if (prev) {
      len += Math.hypot(s.pos[0] - prev[0], s.pos[1] - prev[1], s.pos[2] - prev[2])
    }
    prev = s.pos
  }
  return Math.max(0.5, len)
}

export type W3Pose = { pos: V3; dir: V3; t: number }

/**
 * 経路上の距離dist[m]における姿勢。distは全長に対する割合で解釈する
 * （lengthHint省略時は内部で全長を測り、dist>=全長で終端クランプ）。
 */
export function samplePath3d(
  g: W3Graph,
  path: W3Path,
  fromId: string,
  dist: number,
  prevId?: string,
  nextId?: string,
  lengthHint?: number,
): W3Pose {
  const total = pathLength3d(g, path.id, fromId, lengthHint)
  const clamped = Math.min(total, Math.max(0, dist))
  const t = total === 0 ? 1 : clamped / total
  const aN = w3NodeById(g, fromId)
  const bN = w3NodeById(g, fromId === path.from ? path.to : path.from)
  const a = nodePos(aN)
  const b = nodePos(bN)
  // 接線: 前後ノードからCatmull-Rom型（XZのみ。高さは線形＋arc）
  const pPrev = prevId ? nodePos(w3NodeById(g, prevId)) : [2 * a[0] - b[0], a[1], 2 * a[2] - b[2]]
  const pNext = nextId ? nodePos(w3NodeById(g, nextId)) : [2 * b[0] - a[0], b[1], 2 * b[2] - a[2]]
  const m0: V3 = [(b[0] - pPrev[0]) / 2, 0, (b[2] - pPrev[2]) / 2]
  const m1: V3 = [(pNext[0] - a[0]) / 2, 0, (pNext[2] - a[2]) / 2]
  const flat: V3 = hermite([a[0], 0, a[2]], m0, [b[0], 0, b[2]], m1, t)
  const arc = pathArc(path)
  const y = a[1] + (b[1] - a[1]) * t + arc * 4 * t * (1 - t)
  const eps = 0.004
  const t2 = Math.min(1, t + eps)
  const f2 = hermite([a[0], 0, a[2]], m0, [b[0], 0, b[2]], m1, t2)
  const dx = f2[0] - flat[0]
  const dz = f2[2] - flat[2]
  const dl = Math.hypot(dx, dz)
  const dir: V3 = dl > 1e-9 ? [dx / dl, 0, dz / dl] : [b[0] - a[0], 0, b[2] - a[2]]
  const dl2 = Math.hypot(dir[0], dir[2]) || 1
  return { pos: [flat[0], y, flat[2]], dir: [dir[0] / dl2, 0, dir[2] / dl2], t: clamped / total }
}
