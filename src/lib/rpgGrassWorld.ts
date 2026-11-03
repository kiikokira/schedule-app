// 草原ワールド（Phase 1 縦方向完成版）の経路グラフ・地形・検証ロジック。
// 表示（RpgGrassMap）と移動は同じ Path データから生成し、表示と論理の不一致を作らない。

export type GrassNodeKind =
  | 'start'
  | 'stop'
  | 'branch'
  | 'stage'
  | 'ladder_bottom'
  | 'ladder_top'
  | 'jump_from'
  | 'jump_to'
  | 'gate'

export type GrassPathKind =
  | 'walk'
  | 'run'
  | 'bridge'
  | 'jump'
  | 'ladder_up'
  | 'ladder_down'
  | 'slope_up'
  | 'slope_down'
  | 'stairs_up'
  | 'stairs_down'
  | 'fall'
  | 'swim'
  | 'enter_building'
  | 'exit_building'

export type GrassPoint = { x: number; y: number }
export type GrassNode = {
  id: string
  kind: GrassNodeKind
  x: number
  y: number
  h: number
  label: string
  stageId?: string
  stopOnArrival: boolean
}
export type GrassPath = {
  id: string
  fromId: string
  toId: string
  kind: GrassPathKind
  points: GrassPoint[]
  width: number
  moveSpeed: number
  oneWay: boolean
  jumpHeight?: number
}

// ワールド座標: 720 x 440。h は標高（見た目の厚み・影・接地に使う）。
export const GRASS_NODES: GrassNode[] = [
  { id: 'g-n0', kind: 'start', x: 70, y: 360, h: 0, label: 'はじまりの丘', stopOnArrival: true },
  { id: 'g-n1', kind: 'stop', x: 160, y: 330, h: 2, label: '花畑', stopOnArrival: true },
  { id: 'g-n2', kind: 'branch', x: 250, y: 320, h: 4, label: 'わかれ道', stopOnArrival: true },
  { id: 'g-n3a', kind: 'stop', x: 340, y: 340, h: 2, label: '小川', stopOnArrival: false },
  { id: 'g-n4a', kind: 'stop', x: 430, y: 330, h: 4, label: '橋のたもと', stopOnArrival: false },
  { id: 'g-n5', kind: 'stage', x: 520, y: 300, h: 10, label: '丘の小屋', stageId: 'grass-stage-1', stopOnArrival: true },
  { id: 'g-n3b', kind: 'stop', x: 300, y: 250, h: 12, label: '坂道', stopOnArrival: false },
  { id: 'g-n4b', kind: 'ladder_bottom', x: 360, y: 200, h: 18, label: 'はしご下', stopOnArrival: true },
  { id: 'g-n5b', kind: 'ladder_top', x: 360, y: 140, h: 46, label: 'はしご上', stopOnArrival: true },
  { id: 'g-n6', kind: 'stage', x: 460, y: 130, h: 48, label: '風見の丘', stageId: 'grass-stage-2', stopOnArrival: true },
  { id: 'g-n7', kind: 'jump_from', x: 540, y: 150, h: 48, label: '崖っぷち', stopOnArrival: true },
  { id: 'g-n8', kind: 'jump_to', x: 620, y: 190, h: 40, label: '対岸', stopOnArrival: true },
  { id: 'g-n9', kind: 'stage', x: 650, y: 270, h: 12, label: '洞窟まえ', stageId: 'grass-stage-3', stopOnArrival: true },
  { id: 'g-n10', kind: 'gate', x: 600, y: 350, h: 6, label: '城門', stopOnArrival: true },
]

export const GRASS_PATHS: GrassPath[] = [
  { id: 'g-p0', fromId: 'g-n0', toId: 'g-n1', kind: 'walk', points: [{ x: 70, y: 360 }, { x: 115, y: 348 }, { x: 160, y: 330 }], width: 26, moveSpeed: 110, oneWay: false },
  { id: 'g-p1', fromId: 'g-n1', toId: 'g-n2', kind: 'walk', points: [{ x: 160, y: 330 }, { x: 205, y: 326 }, { x: 250, y: 320 }], width: 26, moveSpeed: 110, oneWay: false },
  { id: 'g-p2a', fromId: 'g-n2', toId: 'g-n3a', kind: 'slope_down', points: [{ x: 250, y: 320 }, { x: 295, y: 332 }, { x: 340, y: 340 }], width: 24, moveSpeed: 95, oneWay: false },
  { id: 'g-p3a', fromId: 'g-n3a', toId: 'g-n4a', kind: 'bridge', points: [{ x: 340, y: 340 }, { x: 385, y: 336 }, { x: 430, y: 330 }], width: 22, moveSpeed: 100, oneWay: false },
  { id: 'g-p4a', fromId: 'g-n4a', toId: 'g-n5', kind: 'slope_up', points: [{ x: 430, y: 330 }, { x: 475, y: 316 }, { x: 520, y: 300 }], width: 24, moveSpeed: 85, oneWay: false },
  { id: 'g-p2b', fromId: 'g-n2', toId: 'g-n3b', kind: 'slope_up', points: [{ x: 250, y: 320 }, { x: 276, y: 286 }, { x: 300, y: 250 }], width: 24, moveSpeed: 85, oneWay: false },
  { id: 'g-p3b', fromId: 'g-n3b', toId: 'g-n4b', kind: 'stairs_up', points: [{ x: 300, y: 250 }, { x: 330, y: 226 }, { x: 360, y: 200 }], width: 22, moveSpeed: 70, oneWay: false },
  { id: 'g-p4b', fromId: 'g-n4b', toId: 'g-n5b', kind: 'ladder_up', points: [{ x: 360, y: 200 }, { x: 360, y: 170 }, { x: 360, y: 140 }], width: 18, moveSpeed: 55, oneWay: false },
  { id: 'g-p5', fromId: 'g-n5b', toId: 'g-n6', kind: 'walk', points: [{ x: 360, y: 140 }, { x: 410, y: 134 }, { x: 460, y: 130 }], width: 26, moveSpeed: 110, oneWay: false },
  { id: 'g-p6', fromId: 'g-n6', toId: 'g-n7', kind: 'run', points: [{ x: 460, y: 130 }, { x: 500, y: 140 }, { x: 540, y: 150 }], width: 24, moveSpeed: 150, oneWay: false },
  { id: 'g-p7', fromId: 'g-n7', toId: 'g-n8', kind: 'jump', points: [{ x: 540, y: 150 }, { x: 580, y: 168 }, { x: 620, y: 190 }], width: 20, moveSpeed: 170, oneWay: true, jumpHeight: 46 },
  { id: 'g-p8', fromId: 'g-n8', toId: 'g-n9', kind: 'slope_down', points: [{ x: 620, y: 190 }, { x: 638, y: 230 }, { x: 650, y: 270 }], width: 24, moveSpeed: 95, oneWay: false },
  { id: 'g-p9', fromId: 'g-n9', toId: 'g-n10', kind: 'fall', points: [{ x: 650, y: 270 }, { x: 626, y: 312 }, { x: 600, y: 350 }], width: 22, moveSpeed: 130, oneWay: true },
  { id: 'g-p10', fromId: 'g-n5', toId: 'g-n6', kind: 'walk', points: [{ x: 520, y: 300 }, { x: 500, y: 220 }, { x: 460, y: 130 }], width: 20, moveSpeed: 100, oneWay: false },
]

export type GrassStage = {
  id: string
  entryNodeId: string
  title: string
  description: string
  unlockPathsOnClear: string[]
}

export const GRASS_STAGES: GrassStage[] = [
  { id: 'grass-stage-1', entryNodeId: 'g-n5', title: '丘の小屋', description: '今日の計画とつながる最初のステージ', unlockPathsOnClear: ['g-p2b', 'g-p3b'] },
  { id: 'grass-stage-2', entryNodeId: 'g-n6', title: '風見の丘', description: '参考書の記録とつながるステージ', unlockPathsOnClear: ['g-p4b', 'g-p6', 'g-p7'] },
  { id: 'grass-stage-3', entryNodeId: 'g-n9', title: '洞窟まえ', description: 'ランキングのクエストとつながるステージ', unlockPathsOnClear: ['g-p9', 'g-p10'] },
]

const nodeById = new Map(GRASS_NODES.map((n) => [n.id, n]))
const pathById = new Map(GRASS_PATHS.map((p) => [p.id, p]))

export function grassNodeById(id: string): GrassNode {
  const n = nodeById.get(id)
  if (!n) throw new Error(`unknown grass node: ${id}`)
  return n
}

export function grassPathById(id: string): GrassPath {
  const p = pathById.get(id)
  if (!p) throw new Error(`unknown grass path: ${id}`)
  return p
}

export function grassPathsFrom(nodeId: string): GrassPath[] {
  return GRASS_PATHS.filter((p) => p.fromId === nodeId || (!p.oneWay && p.toId === nodeId))
}

export function grassPathLength(p: GrassPath): number {
  let len = 0
  for (let i = 1; i < p.points.length; i++) {
    len += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y)
  }
  return Math.max(1, len)
}

// 地形高さの共通取得。装飾の接地・影・キャラ接地が矛盾しないよう一元化する。
export function getGrassTerrainHeightAt(x: number, y: number): number {
  // 丘（風見の丘の高台）と川底（小川のくぼみ）をガウス場で表す。ノード h と整合するよう調整済み。
  const hill = 48 * Math.exp(-((x - 430) * (x - 430) + (y - 140) * (y - 140)) / (2 * 130 * 130))
  const riverDip = -8 * Math.exp(-((x - 385) * (x - 385) + (y - 338) * (y - 338)) / (2 * 70 * 70))
  const base = 4 + hill + riverDip
  // ノード近傍ではノード h に寄せる（誤接地防止）。
  let best: GrassNode | null = null
  let bestDist = Infinity
  for (const n of GRASS_NODES) {
    const d = Math.hypot(n.x - x, n.y - y)
    if (d < bestDist) {
      bestDist = d
      best = n
    }
  }
  if (best && bestDist < 40) {
    const t = bestDist / 40
    return best.h * (1 - t) + base * t
  }
  return base
}

export type GrassPose = { x: number; y: number; h: number; t: number; dirX: number; dirY: number }

export function positionAlongGrassPath(p: GrassPath, dist: number): GrassPose {
  const total = grassPathLength(p)
  const clamped = Math.min(total, Math.max(0, dist))
  const target = (clamped / total) * total
  let acc = 0
  for (let i = 1; i < p.points.length; i++) {
    const a = p.points[i - 1]
    const b = p.points[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (target <= acc + seg || i === p.points.length - 1) {
      const tSeg = seg === 0 ? 0 : (target - acc) / seg
      const x = a.x + (b.x - a.x) * tSeg
      const y = a.y + (b.y - a.y) * tSeg
      const from = nodeById.get(p.fromId)!
      const to = nodeById.get(p.toId)!
      const gt = clamped / total
      let h = from.h + (to.h - from.h) * gt
      if (p.kind === 'jump' && p.jumpHeight) {
        h += p.jumpHeight * 4 * gt * (1 - gt)
      }
      const dirX = b.x - a.x
      const dirY = b.y - a.y
      const len = Math.hypot(dirX, dirY) || 1
      return { x, y, h, t: clamped / total, dirX: dirX / len, dirY: dirY / len }
    }
    acc += seg
  }
  const last = p.points[p.points.length - 1]
  return { x: last.x, y: last.y, h: nodeById.get(p.toId)!.h, t: 1, dirX: 0, dirY: 0 }
}

export function findGrassRoute(fromId: string, toId: string, unlockedPathIds: Set<string>): string[] | null {
  if (fromId === toId) return [fromId]
  const prev = new Map<string, string>()
  const visited = new Set<string>([fromId])
  const queue: string[] = [fromId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const p of GRASS_PATHS) {
      if (!unlockedPathIds.has(p.id)) continue
      let next: string | null = null
      if (p.fromId === cur) next = p.toId
      else if (!p.oneWay && p.toId === cur) next = p.fromId
      if (next && !visited.has(next)) {
        visited.add(next)
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

export function validateGrassWorld(): string[] {
  const issues: string[] = []
  const ids = new Set<string>()
  for (const n of GRASS_NODES) {
    if (ids.has(n.id)) issues.push(`duplicate node: ${n.id}`)
    ids.add(n.id)
  }
  for (const p of GRASS_PATHS) {
    if (!ids.has(p.fromId)) issues.push(`missing from node: ${p.id} -> ${p.fromId}`)
    if (!ids.has(p.toId)) issues.push(`missing to node: ${p.id} -> ${p.toId}`)
    if (p.fromId === p.toId) issues.push(`self loop: ${p.id}`)
    if (p.points.length < 2) issues.push(`path needs 2+ points: ${p.id}`)
    const a = nodeById.get(p.fromId)
    const b = nodeById.get(p.toId)
    if (a && b && p.points.length >= 2) {
      const first = p.points[0]
      const last = p.points[p.points.length - 1]
      if (Math.hypot(first.x - a.x, first.y - a.y) > 1) issues.push(`start mismatch: ${p.id}`)
      if (Math.hypot(last.x - b.x, last.y - b.y) > 1) issues.push(`end mismatch: ${p.id}`)
    }
    if (p.kind === 'jump' && !(p.jumpHeight && p.jumpHeight > 0)) issues.push(`jump needs height: ${p.id}`)
  }
  const ladder = GRASS_PATHS.find((p) => p.kind === 'ladder_up')
  if (ladder) {
    const a = nodeById.get(ladder.fromId)!
    const b = nodeById.get(ladder.toId)!
    if (b.h - a.h < 10) issues.push('ladder height mismatch')
  }
  for (const s of GRASS_STAGES) {
    if (!ids.has(s.entryNodeId)) issues.push(`stage missing node: ${s.id}`)
  }
  return issues
}
