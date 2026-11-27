// SFCキャンパスRPGの背景描画。DOM非依存、CanvasRenderingContext2Dのみを受け取る。
// 16bitドット絵のような密度を出すため、すべて決定論的な mulberry32 で散布する。
// 文字・画像・グラデーションは使わず、Task 5がオフスクリーンに1回だけ描く。

import { CAMPUS_LAYOUT } from './sfcCampusLayout'
import type { CampusBuilding, CampusLayout, CampusPoint, CampusRect, RoofStyle } from './sfcCampusLayout'

export const CAMPUS_PALETTE = {
  grassDark: '#2f6b3a',
  grassMid: '#3f8a46',
  grassLight: '#5aa85a',
  earthDark: '#6b4f33',
  earthMid: '#8a6a45',
  stoneDark: '#8f897e',
  stoneLight: '#b8b2a6',
  waterDeep: '#1f5f8b',
  waterMid: '#2f86b5',
  waterLight: '#5fb3d1',
  rockDark: '#5a3f28',
  rockMid: '#7a5a3a',
  rockLight: '#a07a50',
  roofRed: '#a8463c',
  roofBlue: '#416b9c',
  roofOchre: '#b58a45',
  roofGray: '#6f7377',
  roofBrown: '#6d4c38',
  wallLight: '#d8d2c4',
  wallShadow: '#9a9488',
  trunk: '#5a3f28',
  canopyDark: '#245c33',
  canopyMid: '#2f7a3f',
  canopyLight: '#4f9e52',
  flowerPink: '#e879a8',
  flowerYellow: '#e8c84a',
  flowerWhite: '#f2efe4',
  shadow: '#10231a',
} as const

type Ctx = CanvasRenderingContext2D
type Rng = () => number
type Segment = {
  a: CampusPoint
  b: CampusPoint
  nx: number
  ny: number
  length: number
  width: number
}
type CliffFace = { horizontal: boolean; outer: number; inner: number; alongMin: number; alongMax: number }
const TAU = Math.PI * 2

function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function between(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length]
}

function roofColor(style: RoofStyle): string {
  switch (style) {
    case 'red': return CAMPUS_PALETTE.roofRed
    case 'blue': return CAMPUS_PALETTE.roofBlue
    case 'ochre': return CAMPUS_PALETTE.roofOchre
    case 'brown': return CAMPUS_PALETTE.roofBrown
    case 'gray': return CAMPUS_PALETTE.roofGray
  }
}

function segmentsOf(path: { points: CampusPoint[]; width: number }): Segment[] {
  const out: Segment[] = []
  for (let i = 1; i < path.points.length; i += 1) {
    const a = path.points[i - 1]
    const b = path.points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.max(1, Math.hypot(dx, dy))
    out.push({ a, b, nx: -dy / length, ny: dx / length, length, width: path.width })
  }
  return out
}

function pointSegmentDistance(px: number, py: number, s: Segment): number {
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const t = Math.max(0, Math.min(1, ((px - s.a.x) * dx + (py - s.a.y) * dy) / (s.length * s.length)))
  return Math.hypot(px - (s.a.x + dx * t), py - (s.a.y + dy * t))
}

function inPolygon(px: number, py: number, points: readonly CampusPoint[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]
    const b = points[j]
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function nearBuilding(x: number, y: number, layout: CampusLayout, margin: number): boolean {
  for (const b of layout.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return true
  }
  return false
}

function nearPond(x: number, y: number, layout: CampusLayout, margin: number): boolean {
  if (inPolygon(x, y, layout.pond)) return true
  for (let i = 0; i < layout.pond.length; i += 1) {
    const s: Segment = { a: layout.pond[i], b: layout.pond[(i + 1) % layout.pond.length], nx: 0, ny: 0, length: 1, width: 0 }
    if (pointSegmentDistance(x, y, s) < margin) return true
  }
  return false
}

function nearCliff(x: number, y: number, layout: CampusLayout, margin: number): boolean {
  for (const c of layout.cliffs) {
    if (x > c.x - margin && x < c.x + c.w + margin && y > c.y - margin && y < c.y + c.h + margin) return true
  }
  return false
}

// 道の実質的な舗装範囲（幅に応じた半幅 + 余白）かどうか。
function onPavement(x: number, y: number, layout: CampusLayout, extra: number): boolean {
  for (const path of layout.paths) {
    const margin = path.width / 2 + extra
    for (const s of segmentsOf(path)) {
      if (pointSegmentDistance(x, y, s) < margin) return true
    }
  }
  return false
}

function nearPath(x: number, y: number, layout: CampusLayout, margin: number): boolean {
  for (const path of layout.paths) {
    for (const s of segmentsOf(path)) {
      if (pointSegmentDistance(x, y, s) < margin) return true
    }
  }
  return false
}

function blockedForTree(x: number, y: number, layout: CampusLayout): boolean {
  if (x < 30 || y < 30 || x > layout.width - 30 || y > layout.height - 30) return true
  if (nearBuilding(x, y, layout, 12)) return true
  if (nearPond(x, y, layout, 20)) return true
  if (nearPath(x, y, layout, 18)) return true
  if (nearCliff(x, y, layout, 4)) return true
  return false
}

function polygon(ctx: Ctx, points: readonly CampusPoint[], scale: number, cx: number, cy: number): void {
  if (points.length === 0) return
  ctx.beginPath()
  ctx.moveTo(cx + (points[0].x - cx) * scale, cy + (points[0].y - cy) * scale)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(cx + (points[i].x - cx) * scale, cy + (points[i].y - cy) * scale)
  }
  ctx.closePath()
  ctx.fill()
}

function quad(ctx: Ctx, pts: readonly CampusPoint[]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.fill()
}

function line(ctx: Ctx, ax: number, ay: number, bx: number, by: number, color: string, width: number): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
}

function smallTree(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  ctx.globalAlpha = 0.22
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  ctx.beginPath()
  ctx.arc(x + 3, y + 4, r, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = CAMPUS_PALETTE.trunk
  ctx.fillRect(x - 1, y + r * 0.25, 2, r * 0.8)
  ctx.fillStyle = CAMPUS_PALETTE.canopyDark
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = CAMPUS_PALETTE.canopyMid
  ctx.beginPath()
  ctx.arc(x - r * 0.15, y - r * 0.2, r * 0.78, 0, TAU)
  ctx.fill()
  ctx.fillStyle = CAMPUS_PALETTE.canopyLight
  ctx.beginPath()
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, TAU)
  ctx.fill()
  if (rng() > 0.5) {
    ctx.fillStyle = CAMPUS_PALETTE.flowerWhite
    ctx.fillRect(x - r * 0.5, y - r * 0.6, 2, 2)
  }
}

// 1. 草の基層、斑点、 Larger clumps、葉、 Entrance周りの土、小花。
function drawGrass(ctx: Ctx, layout: CampusLayout, rng: Rng): void {
  ctx.save()
  ctx.globalAlpha = 1
  ctx.fillStyle = CAMPUS_PALETTE.grassDark
  ctx.fillRect(0, 0, layout.width, layout.height)
  const patches = [CAMPUS_PALETTE.grassMid, CAMPUS_PALETTE.grassLight, CAMPUS_PALETTE.grassMid]
  for (let i = 0; i < 1700; i += 1) {
    ctx.fillStyle = patches[i % patches.length]
    ctx.globalAlpha = between(rng, 0.15, 0.4)
    const size = between(rng, 4, 12)
    ctx.fillRect(rng() * layout.width, rng() * layout.height, size, size * between(rng, 0.6, 1.3))
  }
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.grassDark, CAMPUS_PALETTE.grassLight])
    ctx.globalAlpha = between(rng, 0.1, 0.22)
    const size = between(rng, 8, 28)
    ctx.fillRect(rng() * layout.width, rng() * layout.height, size, size * between(rng, 0.5, 1.2))
  }
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 1100; i += 1) {
    const x = rng() * layout.width
    const y = rng() * layout.height
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.grassMid, CAMPUS_PALETTE.grassLight])
    ctx.fillRect(x, y, 1, 3)
    ctx.fillRect(x + 2, y - 1, 1, 5)
    ctx.fillRect(x + 4, y, 1, 4)
  }
  // 各入口の南26pxに踏み固められた土。
  ctx.globalAlpha = 0.25
  if (layout.buildings.length > 0) {
    for (let i = 0; i < 40; i += 1) {
      const b = layout.buildings[i % layout.buildings.length]
      const x = b.entrance.x + between(rng, -18, 18)
      const y = b.entrance.y + between(rng, 0, 26)
      for (let k = 0; k < 3; k += 1) {
        ctx.fillStyle = k === 0 ? CAMPUS_PALETTE.earthDark : CAMPUS_PALETTE.earthMid
        const size = between(rng, 6, 14)
        ctx.fillRect(x + between(rng, -6, 6), y + between(rng, -3, 3), size, size * 0.5)
      }
    }
  }
  // 芝生の小花（舗装・建物・池・崖は除外）。
  let clusters = 0
  for (let attempt = 0; attempt < 120 * 12 && clusters < 120; attempt += 1) {
    const x = rng() * layout.width
    const y = rng() * layout.height
    if (x < 8 || y < 8 || x > layout.width - 8 || y > layout.height - 8) continue
    if (onPavement(x, y, layout, 6) || nearBuilding(x, y, layout, 4) || nearPond(x, y, layout, 6) || nearCliff(x, y, layout, 4)) continue
    clusters += 1
    const color = pick(rng, [CAMPUS_PALETTE.flowerYellow, CAMPUS_PALETTE.flowerWhite, CAMPUS_PALETTE.flowerPink])
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    const count = 3 + Math.floor(rng() * 3)
    for (let k = 0; k < count; k += 1) ctx.fillRect(x + between(rng, -3, 3), y + between(rng, -3, 3), between(rng, 1, 2), between(rng, 1, 2))
  }
  ctx.restore()
}

// 2. 崖: 外側の草原 → ギザギザの境界 → キャンパス側の岩壁（柱・地層・亀裂）→ 影。
function cliffFace(c: CampusRect, layout: CampusLayout): CliffFace {
  if (c.x === 0 && c.w <= 140) return { horizontal: true, outer: c.x, inner: c.x + c.w, alongMin: c.y, alongMax: c.y + c.h }
  if (c.x + c.w === layout.width && c.w <= 140) return { horizontal: true, outer: c.x + c.w, inner: c.x, alongMin: c.y, alongMax: c.y + c.h }
  if (c.y === 0 && c.h <= 100) return { horizontal: false, outer: c.y, inner: c.y + c.h, alongMin: c.x, alongMax: c.x + c.w }
  if (c.y + c.h === layout.height && c.h <= 100) return { horizontal: false, outer: c.y + c.h, inner: c.y, alongMin: c.x, alongMax: c.x + c.w }
  // 内陸の露頭は南面が岩壁。
  return { horizontal: false, outer: c.y, inner: c.y + c.h, alongMin: c.x, alongMax: c.x + c.w }
}

function faceCoord(f: CliffFace, along: number, t: number): CampusPoint {
  const d = f.outer + (f.inner - f.outer) * t
  return f.horizontal ? { x: d, y: along } : { x: along, y: d }
}

function faceBand(ctx: Ctx, f: CliffFace, along: number, t0: number, t1: number, len: number): void {
  const a = faceCoord(f, along, t0)
  const b = faceCoord(f, along, t1)
  ctx.fillRect(
    Math.min(a.x, b.x),
    Math.min(a.y, b.y),
    f.horizontal ? Math.max(1, Math.abs(b.x - a.x)) : len,
    f.horizontal ? len : Math.max(1, Math.abs(b.y - a.y)),
  )
}

function drawCliffs(ctx: Ctx, cliffs: readonly CampusRect[], layout: CampusLayout, rng: Rng): void {
  for (const c of cliffs) {
    const f = cliffFace(c, layout)
    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = CAMPUS_PALETTE.rockDark
    ctx.fillRect(c.x, c.y, c.w, c.h)
    // 台地の境界を6〜10px刻みでジグザグにする。
    const steps: { along: number; len: number; t: number }[] = []
    for (let along = f.alongMin; along < f.alongMax; ) {
      const len = Math.min(between(rng, 6, 10), f.alongMax - along)
      steps.push({ along, len, t: 0.45 + rng() * 0.14 + between(rng, -0.04, 0.04) })
      along += len
    }
    for (const step of steps) {
      ctx.fillStyle = CAMPUS_PALETTE.grassMid
      faceBand(ctx, f, step.along, 0, step.t, step.len + 1)
      ctx.globalAlpha = 0.55
      ctx.fillStyle = CAMPUS_PALETTE.grassLight
      for (let k = 0; k < 2; k += 1) {
        const t = between(rng, 0.05, Math.max(0.06, step.t - 0.05))
        const p = faceCoord(f, step.along + rng() * step.len, t)
        ctx.fillRect(p.x, p.y, f.horizontal ? between(rng, 2, 5) : 2, f.horizontal ? 2 : between(rng, 2, 5))
      }
      ctx.globalAlpha = 0.5
      ctx.fillStyle = CAMPUS_PALETTE.grassDark
      const tip = faceCoord(f, step.along + rng() * step.len, step.t - 0.02)
      ctx.fillRect(tip.x, tip.y, f.horizontal ? 1 : 2, f.horizontal ? 4 : 1)
      ctx.globalAlpha = 1
    }
    // 岩壁: 10〜18pxの柱、その中に短い地層と縦の継ぎ目。
    let stepIndex = 0
    for (let along = f.alongMin; along < f.alongMax; ) {
      const colW = Math.min(between(rng, 10, 18), f.alongMax - along)
      while (stepIndex < steps.length - 1 && steps[stepIndex].along + steps[stepIndex].len <= along) stepIndex += 1
      const boundary = steps[stepIndex].t
      ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.rockMid, CAMPUS_PALETTE.rockLight, CAMPUS_PALETTE.rockDark])
      faceBand(ctx, f, along, boundary, 1, colW)
      const strata = 2 + Math.floor(rng() * 3)
      for (let k = 0; k < strata; k += 1) {
        const t = between(rng, boundary + 0.02, 0.95)
        ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.rockLight, CAMPUS_PALETTE.rockMid, CAMPUS_PALETTE.rockDark])
        faceBand(ctx, f, along + between(rng, 0, Math.max(0, colW - 8)), t, Math.min(1, t + between(rng, 0.03, 0.1)), between(rng, 8, 20))
      }
      // 1pxの縦の継ぎ目と6〜18pxの亀裂。
      const seamFrom = faceCoord(f, along, between(rng, boundary, 0.8))
      const seamTo = faceCoord(f, along, 1)
      line(ctx, seamFrom.x, seamFrom.y, seamTo.x, seamTo.y, CAMPUS_PALETTE.rockDark, 1)
      const crackA = faceCoord(f, along + between(rng, 0, colW), between(rng, boundary, 0.85))
      const crackB = f.horizontal
        ? { x: crackA.x, y: crackA.y + between(rng, -18, 18) }
        : { x: crackA.x + between(rng, -18, 18), y: crackA.y }
      line(ctx, crackA.x, crackA.y, crackB.x, crackB.y, CAMPUS_PALETTE.rockDark, 1)
      along += colW
    }
    // 足元の影、岩块、草から垂れる根。
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    faceBand(ctx, f, f.alongMin, 0.9, 1, f.alongMax - f.alongMin)
    ctx.globalAlpha = 1
    const boulders = 1 + Math.floor(rng() * 3)
    for (let i = 0; i < boulders; i += 1) {
      const p = faceCoord(f, between(rng, f.alongMin + 10, f.alongMax - 10), between(rng, 0.82, 0.93))
      const r = between(rng, 3, 6)
      ctx.fillStyle = CAMPUS_PALETTE.rockDark
      ctx.beginPath()
      ctx.arc(p.x, p.y + 1, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = CAMPUS_PALETTE.rockLight
      ctx.beginPath()
      ctx.arc(p.x, p.y, r * 0.8, 0, TAU)
      ctx.fill()
    }
    const roots = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < roots; i += 1) {
      const along = between(rng, f.alongMin + 8, f.alongMax - 8)
      const edge = faceCoord(f, along, 0.48)
      const hang = faceCoord(f, along + between(rng, -3, 3), 0.57)
      line(ctx, edge.x, edge.y, hang.x, hang.y, CAMPUS_PALETTE.rockDark, 1)
    }
    const trees = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < trees; i += 1) {
      const p = faceCoord(f, between(rng, f.alongMin + 12, f.alongMax - 12), between(rng, 0.12, 0.36))
      smallTree(ctx, p.x, p.y, between(rng, 7, 11), rng)
    }
    ctx.restore()
  }
}

function strokeSegment(ctx: Ctx, s: Segment, color: string, width: number): void {
  line(ctx, s.a.x, s.a.y, s.b.x, s.b.y, color, width)
}

// 3. 道: 石畳の四角い敷石と、土道の削れた中心と土塊。車線表示なし。
function drawPaths(ctx: Ctx, paths: readonly { points: CampusPoint[]; width: number; kind: 'stone' | 'earth' }[], rng: Rng): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const path of paths) {
    for (const s of segmentsOf(path)) {
      ctx.globalAlpha = 1
      strokeSegment(ctx, s, CAMPUS_PALETTE.earthDark, path.width + 8)
      strokeSegment(ctx, s, path.kind === 'stone' ? CAMPUS_PALETTE.stoneDark : CAMPUS_PALETTE.earthMid, path.width)
      if (path.kind === 'stone') {
        for (let u = 2; u < s.length - 2; u += between(rng, 10, 13)) {
          const stepU = Math.min(11, s.length - u - 2)
          for (let v = -path.width / 2 + 2; v < path.width / 2 - 2; v += 11) {
            const spanU = Math.min(11, stepU)
            const spanV = Math.min(11, path.width / 2 - 2 - v)
            const wU = Math.max(4, Math.min(spanU - 1, between(rng, 8, 12)))
            const wV = Math.max(4, Math.min(spanV - 1, between(rng, 8, 12)))
            const j = () => between(rng, -2, 2)
            const corners: CampusPoint[] = [
              { x: s.a.x + (s.b.x - s.a.x) / s.length * (u + j()) + s.nx * (v + j()), y: s.a.y + (s.b.y - s.a.y) / s.length * (u + j()) + s.ny * (v + j()) },
              { x: s.a.x + (s.b.x - s.a.x) / s.length * (u + wU + j()) + s.nx * (v + j()), y: s.a.y + (s.b.y - s.a.y) / s.length * (u + wU + j()) + s.ny * (v + j()) },
              { x: s.a.x + (s.b.x - s.a.x) / s.length * (u + wU + j()) + s.nx * (v + wV + j()), y: s.a.y + (s.b.y - s.a.y) / s.length * (u + wU + j()) + s.ny * (v + wV + j()) },
              { x: s.a.x + (s.b.x - s.a.x) / s.length * (u + j()) + s.nx * (v + wV + j()), y: s.a.y + (s.b.y - s.a.y) / s.length * (u + j()) + s.ny * (v + wV + j()) },
            ]
            ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.stoneDark, '#9a948a', CAMPUS_PALETTE.stoneLight])
            quad(ctx, corners)
            if (rng() < 0.1) {
              ctx.fillStyle = CAMPUS_PALETTE.stoneLight
              const pu = s.a.x + (s.b.x - s.a.x) / s.length * (u + wU / 2) + s.nx * (v + wV / 2)
              const py = s.a.y + (s.b.y - s.a.y) / s.length * (u + wU / 2) + s.ny * (v + wV / 2)
              ctx.fillRect(pu, py, between(rng, 1, 2), between(rng, 1, 2))
            }
          }
        }
      } else {
        ctx.globalAlpha = 0.2
        strokeSegment(ctx, s, CAMPUS_PALETTE.stoneLight, path.width * 0.35)
        ctx.globalAlpha = 1
        for (const off of [-path.width / 2 + 1.5, path.width / 2 - 1.5]) {
          line(
            ctx,
            s.a.x + s.nx * off,
            s.a.y + s.ny * off,
            s.b.x + s.nx * off,
            s.b.y + s.ny * off,
            CAMPUS_PALETTE.earthDark,
            3,
          )
        }
        const clods = Math.floor((s.length * path.width) / 90)
        for (let i = 0; i < clods; i += 1) {
          const t = rng()
          const off = between(rng, -path.width / 2 + 4, path.width / 2 - 4)
          const x = s.a.x + (s.b.x - s.a.x) * t + s.nx * off
          const y = s.a.y + (s.b.y - s.a.y) * t + s.ny * off
          ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.earthDark, CAMPUS_PALETTE.earthMid, CAMPUS_PALETTE.earthDark])
          const size = between(rng, 2, 5)
          ctx.fillRect(x, y, size, size * between(rng, 0.6, 1.2))
        }
      }
    }
  }
  ctx.restore()
}

// 4. 鴨池: 土の岸 → 水の3層 → 波紋と睡蓮 → 葦 → 東岸の木デッキ。
function drawPond(ctx: Ctx, pond: readonly CampusPoint[], rng: Rng): void {
  if (pond.length === 0) return
  const cx = pond.reduce((sum, p) => sum + p.x, 0) / pond.length
  const cy = pond.reduce((sum, p) => sum + p.y, 0) / pond.length
  ctx.save()
  ctx.globalAlpha = 1
  ctx.fillStyle = CAMPUS_PALETTE.earthMid
  polygon(ctx, pond, 1.14, cx, cy)
  ctx.fillStyle = CAMPUS_PALETTE.earthDark
  polygon(ctx, pond, 1.08, cx, cy)
  ctx.fillStyle = CAMPUS_PALETTE.waterDeep
  polygon(ctx, pond, 1, cx, cy)
  ctx.fillStyle = CAMPUS_PALETTE.waterMid
  polygon(ctx, pond, 0.93, cx, cy)
  ctx.fillStyle = CAMPUS_PALETTE.waterLight
  polygon(ctx, pond, 0.86, cx, cy)
  // 1.02〜1.10のリングに2〜4pxの小石を連続して並べる。
  for (let i = 0; i < pond.length; i += 1) {
    const a = pond[i]
    const b = pond[(i + 1) % pond.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const steps = Math.floor(length / 5)
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps
      const scale = between(rng, 1.02, 1.1)
      const px = cx + (a.x + dx * t - cx) * scale
      const py = cy + (a.y + dy * t - cy) * scale
      ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.earthDark, CAMPUS_PALETTE.rockMid, CAMPUS_PALETTE.earthMid])
      const size = between(rng, 2, 4)
      ctx.fillRect(px, py, size, size)
    }
  }
  for (let i = 0; i < 28; i += 1) {
    ctx.globalAlpha = between(rng, 0.3, 0.7)
    ctx.strokeStyle = pick(rng, [CAMPUS_PALETTE.waterLight, CAMPUS_PALETTE.waterMid])
    ctx.lineWidth = between(rng, 1, 3)
    ctx.beginPath()
    ctx.arc(cx + between(rng, -130, 130), cy + between(rng, -80, 80), between(rng, 7, 26), between(rng, 0, 1), between(rng, 3.2, 5.8))
    ctx.stroke()
  }
  for (let i = 0; i < 12; i += 1) {
    const px = cx + between(rng, -100, 100)
    const py = cy + between(rng, -65, 65)
    ctx.globalAlpha = 0.85
    ctx.fillStyle = CAMPUS_PALETTE.canopyMid
    ctx.beginPath()
    ctx.arc(px, py, between(rng, 3, 5), 0, TAU)
    ctx.fill()
    ctx.fillStyle = CAMPUS_PALETTE.waterMid
    ctx.fillRect(px - 1, py, 2, 1)
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < 8; i += 1) {
    const a = pond[i % pond.length]
    const b = pond[(i + 1) % pond.length]
    const t = rng()
    const rx = a.x + (b.x - a.x) * t + between(rng, -4, 4)
    const ry = a.y + (b.y - a.y) * t + between(rng, -4, 4)
    const stems = 3 + Math.floor(rng() * 3)
    for (let k = 0; k < stems; k += 1) {
      const sx = rx + k * 2
      const sh = between(rng, 6, 12)
      ctx.fillStyle = CAMPUS_PALETTE.canopyDark
      ctx.fillRect(sx, ry - sh, 1, sh)
      ctx.fillStyle = CAMPUS_PALETTE.earthDark
      ctx.fillRect(sx - 1, ry - sh - 2, 2, 3)
    }
  }
  // 東岸の木デッキ（回転なし）。
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  ctx.globalAlpha = 0.4
  ctx.fillRect(502, 622, 26, 14)
  ctx.globalAlpha = 1
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? CAMPUS_PALETTE.earthMid : CAMPUS_PALETTE.earthDark
    ctx.fillRect(505, 620 + i * 3, 26, 3)
  }
  ctx.fillStyle = CAMPUS_PALETTE.rockDark
  ctx.fillRect(506, 634, 2, 5)
  ctx.fillRect(528, 634, 2, 5)
  ctx.restore()
}

// 5. 建物: 2.5D。屋根の上に窓を描かず、南面の壁にだけ窓を並べる。
function drawBuildings(ctx: Ctx, buildings: readonly CampusBuilding[], rng: Rng): void {
  for (const b of buildings) {
    const color = roofColor(b.roof)
    const roofH = Math.max(30, Math.round(b.h * 0.62))
    const wallY = b.y + roofH
    const wallH = b.h - roofH
    ctx.save()
    // 地面の影（2層）。
    ctx.globalAlpha = 0.25
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x + 6, b.y + 10, b.w, b.h)
    ctx.globalAlpha = 0.15
    ctx.fillRect(b.x + 3, b.y + 5, b.w, b.h)
    // 屋根。
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.fillRect(b.x, b.y, b.w, roofH)
    ctx.globalAlpha = 0.16
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x, b.y + roofH * 0.65, b.w, roofH * 0.35)
    ctx.globalAlpha = 0.12
    ctx.fillStyle = CAMPUS_PALETTE.wallLight
    ctx.fillRect(b.x, b.y, b.w, 12)
    ctx.globalAlpha = 0.3
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x + 3, b.y + roofH * 0.45, b.w - 6, 2)
    ctx.globalAlpha = 0.14
    for (let x = b.x + 12; x < b.x + b.w - 4; x += 12 + Math.floor(rng() * 3)) {
      ctx.fillRect(x, b.y + 2, 1, roofH - 4)
    }
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x, b.y, b.w, 1)
    ctx.fillRect(b.x, b.y + roofH - 1, b.w, 1)
    ctx.fillRect(b.x, b.y, 1, roofH)
    ctx.fillRect(b.x + b.w - 1, b.y, 1, roofH)
    ctx.globalAlpha = 0.4
    ctx.fillRect(b.x + 1, b.y + roofH - 3, b.w - 2, 3)
    // 屋上設備（屋根の北半分）。窓は作らない。
    const units = 1 + (b.w > 160 ? 1 : 0)
    for (let i = 0; i < units; i += 1) {
      const ux = b.x + 10 + (i * (b.w - 40)) / Math.max(1, units - 1)
      const uy = b.y + 8 + between(rng, 0, Math.max(1, roofH * 0.25))
      ctx.globalAlpha = 0.5
      ctx.fillStyle = CAMPUS_PALETTE.shadow
      ctx.fillRect(ux + 1, uy + 1, 10, 7)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#c9c4b8'
      ctx.fillRect(ux, uy, 10, 7)
      ctx.fillStyle = '#e6e2d8'
      ctx.fillRect(ux, uy, 10, 1)
      ctx.fillStyle = '#6f7377'
      ctx.beginPath()
      ctx.arc(ux + 5, uy + 4, 2, 0, TAU)
      ctx.fill()
    }
    // メディアセンターだけ南半分に太陽光パネル。
    if (b.id === 'mu') {
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const px = b.x + 16 + col * 46
          const py = b.y + roofH * 0.58 + row * 16
          ctx.fillStyle = CAMPUS_PALETTE.roofBlue
          ctx.fillRect(px, py, 8, 5)
          ctx.fillStyle = '#7fb2d9'
          ctx.fillRect(px, py, 8, 1)
        }
      }
    }
    // 南面の壁。
    ctx.globalAlpha = 1
    ctx.fillStyle = CAMPUS_PALETTE.wallLight
    ctx.fillRect(b.x, wallY, b.w, wallH)
    ctx.fillStyle = CAMPUS_PALETTE.wallShadow
    ctx.fillRect(b.x, wallY, 4, wallH)
    ctx.fillRect(b.x + b.w - 4, wallY, 4, wallH)
    ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2)
    // 窓は壁の帯の中だけ。
    const rows = Math.max(1, Math.min(2, Math.floor((wallH - 10) / 9)))
    const cols = Math.floor((b.w - 20) / 18)
    for (let row = 0; row < rows; row += 1) {
      const wy = wallY + 6 + row * 9
      if (wy + 5 > b.y + b.h - 2) continue
      for (let col = 0; col < cols; col += 1) {
        const wx = b.x + 12 + col * 18
        ctx.fillStyle = '#2a3f5f'
        ctx.fillRect(wx, wy, 9, 5)
        ctx.fillStyle = '#7fb2d9'
        ctx.fillRect(wx, wy, 9, 1)
        ctx.fillStyle = '#f0ead9'
        ctx.fillRect(wx - 1, wy + 5, 11, 1)
      }
    }
    // 入口: ドア・庇・階段。
    const doorH = Math.max(10, Math.round(wallH * 0.6))
    const doorY = b.y + b.h - doorH
    const doorX = b.entrance.x - 7
    ctx.fillStyle = CAMPUS_PALETTE.wallShadow
    ctx.fillRect(doorX - 2, doorY - 2, 18, doorH + 2)
    ctx.fillStyle = '#3a2f28'
    ctx.fillRect(doorX, doorY, 14, doorH)
    ctx.fillStyle = CAMPUS_PALETTE.roofOchre
    ctx.fillRect(doorX + 11, doorY + 3, 1, 2)
    ctx.fillStyle = color
    ctx.fillRect(b.entrance.x - 15, b.y + b.h, 30, 4)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.entrance.x - 15, b.y + b.h + 4, 30, 2)
    ctx.globalAlpha = 1
    ctx.fillStyle = CAMPUS_PALETTE.stoneLight
    ctx.fillRect(b.entrance.x - 5, b.y + b.h + 2, 2, 3)
    ctx.fillRect(b.entrance.x + 3, b.y + b.h + 2, 2, 3)
    // 軒の影。
    ctx.globalAlpha = 0.45
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x, wallY - 2, b.w, 3)
    ctx.restore()
  }
}

// 6. 並木の大木: 地面の影 → 幹 → 3つの重なるシルエット → 中 → 明 → ハイライト。
function drawTrees(ctx: Ctx, layout: CampusLayout, rng: Rng): void {
  ctx.save()
  for (const zone of layout.treeZones) {
    const target = Math.round((zone.w * zone.h * zone.density) / 760)
    let placed = 0
    for (let attempt = 0; attempt < target * 8 && placed < target; attempt += 1) {
      const x = zone.x + rng() * zone.w
      const y = zone.y + rng() * zone.h
      if (blockedForTree(x, y, layout)) continue
      placed += 1
      const r = 13 + (rng() + rng()) * 0.5 * 15
      const cherry = Math.abs(x - 900) < 90 && rng() < 0.3
      const dark = cherry ? CAMPUS_PALETTE.flowerPink : CAMPUS_PALETTE.canopyDark
      const mid = cherry ? '#f6b3cc' : CAMPUS_PALETTE.canopyMid
      const light = cherry ? CAMPUS_PALETTE.flowerWhite : CAMPUS_PALETTE.canopyLight
      ctx.globalAlpha = 0.22
      ctx.fillStyle = CAMPUS_PALETTE.shadow
      ctx.beginPath()
      ctx.arc(x + 4, y + 6, r * 0.9, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
      const trunkW = between(rng, 3, 5)
      ctx.fillStyle = CAMPUS_PALETTE.rockDark
      ctx.fillRect(x - trunkW / 2 + 1, y + r * 0.2, trunkW, r * 0.7)
      ctx.fillStyle = CAMPUS_PALETTE.trunk
      ctx.fillRect(x - trunkW / 2, y + r * 0.15, trunkW - 1, r * 0.7)
      ctx.fillStyle = dark
      for (const off of [[0, 0], [-r * 0.45, r * 0.18], [r * 0.45, r * 0.12]]) {
        ctx.beginPath()
        ctx.arc(x + off[0], y + off[1], r * 0.72, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = mid
      for (const off of [[-r * 0.12, -r * 0.18], [r * 0.3, r * 0.05]]) {
        ctx.beginPath()
        ctx.arc(x + off[0], y + off[1], r * 0.58, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = light
      for (const off of [[-r * 0.3, -r * 0.35], [r * 0.15, -r * 0.3]]) {
        ctx.beginPath()
        ctx.arc(x + off[0], y + off[1], r * 0.38, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 0.6
      ctx.fillStyle = light
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath()
        ctx.arc(x + between(rng, -r * 0.6, r * 0.6), y + between(rng, -r * 0.6, 0), between(rng, 2, 4), 0, TAU)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

// 7. 装飾: 舗装修正済みの花・低木・岩・ベンチ・街灯・落ち葉。
function drawProps(ctx: Ctx, layout: CampusLayout, rng: Rng): void {
  ctx.save()
  const pathSegments = layout.paths.flatMap(segmentsOf)
  const flowerColors = [CAMPUS_PALETTE.flowerPink, CAMPUS_PALETTE.flowerYellow, CAMPUS_PALETTE.flowerWhite]
  // 道沿いの花は舗装の縁から外側に置く。
  let flowers = 0
  for (let attempt = 0; attempt < 340 * 20 && flowers < 340; attempt += 1) {
    let x: number
    let y: number
    if (rng() < 0.55) {
      const s = pick(rng, pathSegments)
      const t = rng()
      const side = rng() > 0.5 ? 1 : -1
      const off = side * (s.width / 2 + 4 + between(rng, 2, 22))
      x = s.a.x + (s.b.x - s.a.x) * t + s.nx * off
      y = s.a.y + (s.b.y - s.a.y) * t + s.ny * off
      if (onPavement(x, y, layout, 5)) continue
    } else {
      const z = pick(rng, layout.treeZones)
      x = z.x + rng() * z.w
      y = z.y + rng() * z.h
      if (onPavement(x, y, layout, 5)) continue
    }
    if (x < 8 || y < 8 || x > layout.width - 8 || y > layout.height - 8) continue
    if (nearBuilding(x, y, layout, 4) || nearPond(x, y, layout, 6)) continue
    flowers += 1
    ctx.globalAlpha = 1
    ctx.fillStyle = pick(rng, flowerColors)
    ctx.fillRect(x, y, 3, 3)
    ctx.fillRect(x + 2, y - 2, 2, 2)
  }
  let bushes = 0
  for (let attempt = 0; attempt < 90 * 20 && bushes < 90; attempt += 1) {
    const z = pick(rng, layout.treeZones)
    const x = z.x + rng() * z.w
    const y = z.y + rng() * z.h
    if (onPavement(x, y, layout, 4) || nearBuilding(x, y, layout, 8) || nearPond(x, y, layout, 10)) continue
    bushes += 1
    ctx.globalAlpha = 0.9
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.beginPath()
    ctx.arc(x + 2, y + 3, between(rng, 5, 9), 0, TAU)
    ctx.fill()
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.canopyDark, CAMPUS_PALETTE.canopyMid])
    ctx.beginPath()
    ctx.arc(x, y, between(rng, 5, 9), 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.canopyLight
    ctx.fillRect(x - 3, y - 5, 4, 3)
  }
  let rocks = 0
  for (let attempt = 0; attempt < 50 * 20 && rocks < 50; attempt += 1) {
    const c = pick(rng, layout.cliffs)
    const x = c.x + rng() * c.w
    const y = c.y + rng() * c.h
    if (x < 4 || y < 4 || x > layout.width - 4 || y > layout.height - 4) continue
    if (onPavement(x, y, layout, 4)) continue
    rocks += 1
    const r = between(rng, 3, 8)
    ctx.globalAlpha = 0.3
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(x + 2, y + 2, r * 1.5, r)
    ctx.globalAlpha = 1
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.rockMid, CAMPUS_PALETTE.rockLight])
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
    ctx.fillStyle = CAMPUS_PALETTE.rockLight
    ctx.fillRect(x - r * 0.4, y - r * 0.5, r * 0.6, 2)
  }
  // 並木道に沿ってベンチ8と街灯10。
  const avenue = layout.paths.find((p) => p.width === 120)
  if (avenue) {
    const s = segmentsOf(avenue)[0]
    if (s) {
      for (let i = 0; i < 8; i += 1) {
        const t = (i + 1) / 9
        const off = i % 2 === 0 ? 84 : -84
        const x = s.a.x + (s.b.x - s.a.x) * t + s.nx * off
        const y = s.a.y + (s.b.y - s.a.y) * t + s.ny * off
        ctx.globalAlpha = 1
        ctx.fillStyle = CAMPUS_PALETTE.shadow
        ctx.fillRect(x - 9, y - 2, 18, 2)
        ctx.fillStyle = CAMPUS_PALETTE.trunk
        ctx.fillRect(x - 9, y - 4, 18, 5)
        ctx.fillRect(x - 8, y - 10, 16, 5)
        ctx.fillStyle = CAMPUS_PALETTE.stoneDark
        ctx.fillRect(x - 7, y + 2, 3, 3)
        ctx.fillRect(x + 4, y + 2, 3, 3)
      }
      for (let i = 0; i < 10; i += 1) {
        const t = (i + 0.5) / 10
        const off = i % 2 === 0 ? -92 : 92
        const x = s.a.x + (s.b.x - s.a.x) * t + s.nx * off
        const y = s.a.y + (s.b.y - s.a.y) * t + s.ny * off
        ctx.globalAlpha = 0.25
        ctx.fillStyle = '#f3d27a'
        ctx.beginPath()
        ctx.arc(x, y - 17, 4, 0, TAU)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.fillStyle = CAMPUS_PALETTE.stoneDark
        ctx.fillRect(x - 2, y - 2, 4, 18)
        ctx.fillStyle = CAMPUS_PALETTE.trunk
        ctx.fillRect(x - 1, y - 16, 2, 16)
        ctx.fillStyle = CAMPUS_PALETTE.flowerYellow
        ctx.fillRect(x - 2, y - 18, 4, 3)
      }
    }
  }
  // 落ち葉はリトライで240枚を必ず置く（舗装上でも可）。
  let leaves = 0
  for (let attempt = 0; attempt < 240 * 20 && leaves < 240; attempt += 1) {
    let x: number
    let y: number
    if (rng() < 0.6) {
      const s = pick(rng, pathSegments)
      const t = rng()
      const off = (rng() > 0.5 ? 1 : -1) * between(rng, 20, 46)
      x = s.a.x + (s.b.x - s.a.x) * t + s.nx * off
      y = s.a.y + (s.b.y - s.a.y) * t + s.ny * off
    } else {
      const z = pick(rng, layout.treeZones)
      x = z.x + rng() * z.w
      y = z.y + rng() * z.h
    }
    if (x < 4 || y < 4 || x > layout.width - 4 || y > layout.height - 4) continue
    leaves += 1
    ctx.globalAlpha = between(rng, 0.35, 0.75)
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.roofOchre, CAMPUS_PALETTE.earthMid, CAMPUS_PALETTE.rockMid, '#c9a14a'])
    ctx.fillRect(x, y, between(rng, 2, 5), between(rng, 2, 4))
  }
  ctx.restore()
}

export function drawCampusBase(ctx: Ctx, layout: CampusLayout = CAMPUS_LAYOUT): void {
  const rng = mulberry32(0x5fc0a5)
  drawGrass(ctx, layout, rng)
  drawCliffs(ctx, layout.cliffs, layout, rng)
  drawPaths(ctx, layout.paths, rng)
  drawPond(ctx, layout.pond, rng)
  drawBuildings(ctx, layout.buildings, rng)
  drawTrees(ctx, layout, rng)
  drawProps(ctx, layout, rng)
}
