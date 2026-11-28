// SFCキャンパスRPGの移動エンジン（DOM・Canvas非依存の純粋関数）。
// 円と矩形／円の当たり判定、軸分離スライディング、A*経路探索、カメラのクランプを扱う。

export type Point = { x: number; y: number }
export type RectBlocker = { kind: 'rect'; x: number; y: number; w: number; h: number }
export type CircleBlocker = { kind: 'circle'; x: number; y: number; r: number }
export type Blocker = RectBlocker | CircleBlocker
export type WalkOptions = { blockers: readonly Blocker[]; radius: number; mapW: number; mapH: number }
export type PadState = { dx: number; dy: number }

// 円が矩形・円に重なっているか。境界にちょうど接するだけなら非衝突。
export function collides(x: number, y: number, blockers: readonly Blocker[], radius: number): boolean {
  const r2 = radius * radius
  for (const b of blockers) {
    if (b.kind === 'rect') {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w))
      const ny = Math.max(b.y, Math.min(y, b.y + b.h))
      const dx = x - nx
      const dy = y - ny
      if (dx * dx + dy * dy < r2) return true
    } else {
      const dx = x - b.x
      const dy = y - b.y
      const rr = radius + b.r
      if (dx * dx + dy * dy < rr * rr) return true
    }
  }
  return false
}

export function isWalkable(p: Point, o: WalkOptions): boolean {
  const { radius, mapW, mapH } = o
  if (p.x < radius || p.x > mapW - radius) return false
  if (p.y < radius || p.y > mapH - radius) return false
  return !collides(p.x, p.y, o.blockers, radius)
}

function clampToMap(value: number, radius: number, size: number): number {
  const lo = radius
  const hi = size - radius
  if (hi < lo) return size / 2
  return Math.max(lo, Math.min(hi, value))
}

// x軸→y軸の順に別々に動かし、ぶつかった軸だけ戻すことで壁沿いに滑る。
export function moveWithCollision(pos: Point, dx: number, dy: number, o: WalkOptions): Point {
  let x = pos.x
  let y = pos.y
  const nextX = x + dx
  if (!collides(nextX, y, o.blockers, o.radius)) x = nextX
  const nextY = y + dy
  if (!collides(x, nextY, o.blockers, o.radius)) y = nextY
  return {
    x: clampToMap(x, o.radius, o.mapW),
    y: clampToMap(y, o.radius, o.mapH),
  }
}

const NEAREST_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]

// ブロック内の点を、cell刻みの同心円状に近い順で歩行可能な地点へ補正する。
export function nearestWalkable(p: Point, o: WalkOptions, cell = 16): Point {
  if (isWalkable(p, o)) return { x: p.x, y: p.y }
  const step = cell > 0 ? cell : 16
  for (let ring = 1; ring <= 12; ring++) {
    for (const [ux, uy] of NEAREST_DIRS) {
      const candidate = { x: p.x + ux * step * ring, y: p.y + uy * step * ring }
      if (isWalkable(candidate, o)) return candidate
    }
  }
  return { x: p.x, y: p.y }
}

type HeapNode = { key: number; f: number }

// A*用の二分ヒープ（最小fを先に取り出す）。
class MinHeap {
  private readonly items: HeapNode[] = []

  get size(): number {
    return this.items.length
  }

  push(node: HeapNode): void {
    const items = this.items
    items.push(node)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent].f <= items[i].f) break
      const tmp = items[parent]
      items[parent] = items[i]
      items[i] = tmp
      i = parent
    }
  }

  pop(): HeapNode | undefined {
    const items = this.items
    if (items.length === 0) return undefined
    const top = items[0]
    const last = items.pop()
    if (last === undefined) return top
    if (items.length > 0) {
      items[0] = last
      let i = 0
      for (;;) {
        const left = i * 2 + 1
        const right = left + 1
        let smallest = i
        if (left < items.length && items[left].f < items[smallest].f) smallest = left
        if (right < items.length && items[right].f < items[smallest].f) smallest = right
        if (smallest === i) break
        const tmp = items[smallest]
        items[smallest] = items[i]
        items[i] = tmp
        i = smallest
      }
    }
    return top
  }
}

const GRID_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

// 8近傍A*。斜め移動は直交2セルが両方歩行可能なときだけ許可する（角抜け防止）。
export function findPath(start: Point, goal: Point, o: WalkOptions, cell = 16): Point[] {
  const step = cell > 0 ? cell : 16
  const cols = Math.max(1, Math.ceil(o.mapW / step))
  const rows = Math.max(1, Math.ceil(o.mapH / step))
  const total = cols * rows

  // 0=未判定、1=歩行可、-1=不可。
  const cache = new Int8Array(total)
  const cellWalkable = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= cols || j >= rows) return false
    const key = j * cols + i
    const cached = cache[key]
    if (cached !== 0) return cached > 0
    const ok = isWalkable({ x: (i + 0.5) * step, y: (j + 0.5) * step }, o)
    cache[key] = ok ? 1 : -1
    return ok
  }

  // 指定セルに最も近い歩行可能セル（セル中心基準）を探す。
  const nearestCell = (i0: number, j0: number): number => {
    const maxRing = Math.max(cols, rows)
    for (let ring = 0; ring <= maxRing; ring++) {
      let best = -1
      let bestD = Infinity
      for (let dj = -ring; dj <= ring; dj++) {
        for (let di = -ring; di <= ring; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue
          const i = i0 + di
          const j = j0 + dj
          if (!cellWalkable(i, j)) continue
          const d = di * di + dj * dj
          if (d < bestD) {
            bestD = d
            best = j * cols + i
          }
        }
      }
      if (best >= 0) return best
    }
    return -1
  }

  const s = nearestWalkable(start, o, step)
  const g = nearestWalkable(goal, o, step)
  const sKey = nearestCell(Math.floor(s.x / step), Math.floor(s.y / step))
  const gKey = nearestCell(Math.floor(g.x / step), Math.floor(g.y / step))
  if (sKey < 0 || gKey < 0) return []
  if (sKey === gKey) return isWalkable(g, o) ? [g] : []

  const gI = gKey % cols
  const gJ = (gKey - gI) / cols
  const heuristic = (key: number): number => {
    const i = key % cols
    const j = (key - i) / cols
    const dx = Math.abs(i - gI)
    const dy = Math.abs(j - gJ)
    return step * (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy))
  }

  const gScore = new Float64Array(total).fill(Infinity)
  const cameFrom = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)
  const heap = new MinHeap()
  gScore[sKey] = 0
  heap.push({ key: sKey, f: heuristic(sKey) })

  let expanded = 0
  let reached = false
  while (heap.size > 0) {
    const current = heap.pop()
    if (current === undefined) break
    const curKey = current.key
    if (closed[curKey]) continue
    closed[curKey] = 1
    expanded++
    if (expanded > 20000) return []
    if (curKey === gKey) {
      reached = true
      break
    }

    const i = curKey % cols
    const j = (curKey - i) / cols
    for (const [di, dj] of GRID_DIRS) {
      const ni = i + di
      const nj = j + dj
      if (!cellWalkable(ni, nj)) continue
      const diagonal = di !== 0 && dj !== 0
      if (diagonal && (!cellWalkable(i + di, j) || !cellWalkable(i, j + dj))) continue
      const nextKey = nj * cols + ni
      if (closed[nextKey]) continue
      const cost = diagonal ? step * Math.SQRT2 : step
      const tentative = gScore[curKey] + cost
      if (tentative < gScore[nextKey]) {
        gScore[nextKey] = tentative
        cameFrom[nextKey] = curKey
        heap.push({ key: nextKey, f: tentative + heuristic(nextKey) })
      }
    }
  }

  if (!reached) return []

  const keys: number[] = []
  let key = gKey
  while (key !== sKey) {
    keys.push(key)
    key = cameFrom[key]
    if (key < 0) return []
  }
  keys.push(sKey)
  keys.reverse()

  const path: Point[] = keys.map((k) => {
    const i = k % cols
    const j = (k - i) / cols
    return { x: (i + 0.5) * step, y: (j + 0.5) * step }
  })
  const last = path[path.length - 1]
  if (isWalkable(g, o) && (!last || last.x !== g.x || last.y !== g.y)) path.push({ x: g.x, y: g.y })
  return path
}

// カメラ中心をマップ内に収める。マップが表示領域より小さい軸は中央に固定する。
export function clampCamera(
  center: Point,
  view: { w: number; h: number },
  map: { w: number; h: number },
  zoom: number,
): Point {
  const z = zoom > 0 ? zoom : 1
  const halfW = view.w / (2 * z)
  const halfH = view.h / (2 * z)
  const x = map.w <= halfW * 2 ? map.w / 2 : Math.max(halfW, Math.min(map.w - halfW, center.x))
  const y = map.h <= halfH * 2 ? map.h / 2 : Math.max(halfH, Math.min(map.h - halfH, center.y))
  return { x, y }
}
