// SFCキャンパスRPGの背景描画。DOM非依存、CanvasRenderingContext2Dのみを受け取る。
// 手描きのドット絵のような密度を出すため、全て決定論的な mulberry32 で散布する。
// 文字・画像・グラデーションは使わず、Task 5がオフスクリーンに1回だけ描く。

import { CAMPUS_LAYOUT } from './sfcCampusLayout'
import type { CampusBuilding, CampusLayout, CampusPath, CampusPoint, CampusRect, RoofStyle } from './sfcCampusLayout'

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
type Segment = { a: CampusPoint; b: CampusPoint; nx: number; ny: number; length: number }
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

function segmentsOf(path: CampusPath): Segment[] {
  const out: Segment[] = []
  for (let i = 1; i < path.points.length; i += 1) {
    const a = path.points[i - 1]
    const b = path.points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.max(1, Math.hypot(dx, dy))
    out.push({ a, b, nx: -dy / length, ny: dx / length, length })
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
    const s: Segment = { a: layout.pond[i], b: layout.pond[(i + 1) % layout.pond.length], nx: 0, ny: 0, length: 1 }
    if (pointSegmentDistance(x, y, s) < margin) return true
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
  for (const c of layout.cliffs) {
    if (x > c.x - 4 && x < c.x + c.w + 4 && y > c.y - 4 && y < c.y + c.h + 4) return true
  }
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

// 1. 草の基層と、4〜12pxの斑と細い葉。
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
  const blades = [CAMPUS_PALETTE.grassMid, CAMPUS_PALETTE.grassLight]
  ctx.globalAlpha = 0.3
  for (let i = 0; i < 800; i += 1) {
    ctx.fillStyle = blades[i % blades.length]
    ctx.fillRect(rng() * layout.width, rng() * layout.height, between(rng, 1, 3), between(rng, 3, 9))
  }
  ctx.restore()
}

// 2. 崖: 上面の草、横縞の地層、縦のひび、下端と南面の影。
function drawCliffs(ctx: Ctx, cliffs: readonly CampusRect[], rng: Rng): void {
  for (const c of cliffs) {
    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = CAMPUS_PALETTE.rockDark
    ctx.fillRect(c.x, c.y, c.w, c.h)
    ctx.fillStyle = CAMPUS_PALETTE.grassMid
    ctx.fillRect(c.x, c.y, c.w, 10)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.grassLight
    ctx.fillRect(c.x + 2, c.y + 2, Math.max(1, c.w - 4), 4)
    ctx.globalAlpha = 1
    for (let y = c.y + 12; y < c.y + c.h - 8; y += 14) {
      ctx.globalAlpha = between(rng, 0.35, 0.75)
      ctx.fillStyle = rng() > 0.5 ? CAMPUS_PALETTE.rockMid : CAMPUS_PALETTE.rockLight
      ctx.fillRect(c.x + between(rng, 0, 6), y, Math.max(2, c.w - between(rng, 4, 14)), between(rng, 3, 6))
      ctx.globalAlpha = 0.45
      ctx.fillStyle = CAMPUS_PALETTE.rockDark
      ctx.fillRect(c.x, y + 8, c.w, 2)
    }
    const cracks = Math.max(6, Math.floor((c.w + c.h) / 55))
    for (let i = 0; i < cracks; i += 1) {
      ctx.globalAlpha = between(rng, 0.35, 0.7)
      ctx.fillStyle = CAMPUS_PALETTE.rockDark
      ctx.fillRect(c.x + rng() * c.w, c.y + rng() * c.h, between(rng, 1, 3), between(rng, 8, 26))
    }
    // 内陸の段差は南面を暗くして立体に見せる。
    if (c.w < 200 || c.h < 200) {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = CAMPUS_PALETTE.rockDark
      ctx.fillRect(c.x, c.y + c.h * 0.55, c.w, c.h * 0.45)
    }
    ctx.globalAlpha = 0.35
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(c.x, c.y + c.h - 10, c.w, 10)
    ctx.globalAlpha = 0.6
    ctx.fillStyle = CAMPUS_PALETTE.rockLight
    for (let i = 0; i < 10; i += 1) {
      const size = between(rng, 2, 5)
      ctx.fillRect(c.x + rng() * c.w, c.y + rng() * c.h, size, size * 0.6)
    }
    ctx.restore()
  }
}

function strokeSegment(ctx: Ctx, a: CampusPoint, b: CampusPoint, color: string, width: number): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

// 3. 道: 縁 → 本体 → ハイライト → 中心線/車輪跡 → 小石と落ち葉。
function drawPaths(ctx: Ctx, paths: readonly CampusPath[], rng: Rng): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const path of paths) {
    for (const s of segmentsOf(path)) {
      ctx.globalAlpha = 1
      strokeSegment(ctx, s.a, s.b, CAMPUS_PALETTE.earthDark, path.width + 8)
      strokeSegment(ctx, s.a, s.b, path.kind === 'stone' ? CAMPUS_PALETTE.stoneDark : CAMPUS_PALETTE.earthMid, path.width)
      ctx.globalAlpha = 0.35
      strokeSegment(ctx, s.a, s.b, path.kind === 'stone' ? CAMPUS_PALETTE.stoneLight : CAMPUS_PALETTE.earthMid, path.width * 0.55)
      ctx.globalAlpha = 1
      if (path.kind === 'stone') {
        ctx.globalAlpha = 0.7
        ctx.setLineDash([6, 10])
        strokeSegment(ctx, s.a, s.b, CAMPUS_PALETTE.stoneLight, 2)
        ctx.setLineDash([])
      } else {
        ctx.globalAlpha = 0.3
        for (const off of [-path.width * 0.22, path.width * 0.22]) {
          strokeSegment(
            ctx,
            { x: s.a.x + s.nx * off, y: s.a.y + s.ny * off },
            { x: s.b.x + s.nx * off, y: s.b.y + s.ny * off },
            CAMPUS_PALETTE.earthDark,
            2,
          )
        }
      }
      const specks = Math.floor(s.length / 7)
      for (let i = 0; i < specks; i += 1) {
        const t = rng()
        const off = between(rng, -path.width * 0.42, path.width * 0.42)
        const px = s.a.x + (s.b.x - s.a.x) * t + s.nx * off
        const py = s.a.y + (s.b.y - s.a.y) * t + s.ny * off
        ctx.globalAlpha = between(rng, 0.25, 0.6)
        ctx.fillStyle = path.kind === 'stone'
          ? pick(rng, [CAMPUS_PALETTE.stoneLight, CAMPUS_PALETTE.stoneDark, CAMPUS_PALETTE.stoneLight])
          : pick(rng, [CAMPUS_PALETTE.earthDark, CAMPUS_PALETTE.roofOchre, CAMPUS_PALETTE.earthMid])
        const size = between(rng, 2, 6)
        ctx.fillRect(px, py, size, size * between(rng, 0.6, 1.4))
      }
    }
  }
  ctx.restore()
}

// 4. 鴨池: 岸の影 → 水 → 波紋 → 土の岸 → 葦 → 睡蓮。
function drawPond(ctx: Ctx, pond: readonly CampusPoint[], rng: Rng): void {
  if (pond.length === 0) return
  const cx = pond.reduce((sum, p) => sum + p.x, 0) / pond.length
  const cy = pond.reduce((sum, p) => sum + p.y, 0) / pond.length
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  polygon(ctx, pond, 1.07, cx, cy)
  ctx.globalAlpha = 1
  ctx.fillStyle = CAMPUS_PALETTE.waterDeep
  polygon(ctx, pond, 1, cx, cy)
  ctx.globalAlpha = 0.9
  ctx.fillStyle = CAMPUS_PALETTE.waterMid
  polygon(ctx, pond, 0.92, cx, cy)
  ctx.globalAlpha = 0.75
  ctx.fillStyle = CAMPUS_PALETTE.waterLight
  polygon(ctx, pond, 0.8, cx, cy)
  for (let i = 0; i < 24; i += 1) {
    ctx.globalAlpha = between(rng, 0.3, 0.7)
    ctx.strokeStyle = pick(rng, [CAMPUS_PALETTE.waterLight, CAMPUS_PALETTE.waterMid])
    ctx.lineWidth = between(rng, 1, 3)
    ctx.beginPath()
    ctx.arc(cx + between(rng, -140, 140), cy + between(rng, -90, 90), between(rng, 8, 28), between(rng, 0, 1), between(rng, 3.2, 5.8))
    ctx.stroke()
  }
  ctx.globalAlpha = 0.8
  for (let i = 0; i < pond.length; i += 1) {
    const a = pond[i]
    const b = pond[(i + 1) % pond.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const nx = -dy / length
    const ny = dx / length
    const count = Math.floor(length / 8)
    for (let k = 0; k < count; k += 1) {
      const t = rng()
      const off = between(rng, 2, 12)
      ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.earthMid, CAMPUS_PALETTE.rockMid, CAMPUS_PALETTE.rockLight])
      const size = between(rng, 2, 6)
      ctx.fillRect(a.x + dx * t + nx * off, a.y + dy * t + ny * off, size, size)
    }
    for (let k = 0; k < 3; k += 1) {
      const t = rng()
      const rx = a.x + dx * t + nx * between(rng, -4, 8)
      const ry = a.y + dy * t + ny * between(rng, -4, 8)
      ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.canopyDark, CAMPUS_PALETTE.canopyMid])
      for (let j = 0; j < 3; j += 1) {
        ctx.fillRect(rx + j * 2, ry - between(rng, 6, 16), 2, between(rng, 10, 20))
      }
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const px = cx + between(rng, -110, 110)
    const py = cy + between(rng, -70, 70)
    ctx.globalAlpha = 0.85
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.canopyMid, CAMPUS_PALETTE.canopyDark])
    ctx.beginPath()
    ctx.arc(px, py, between(rng, 5, 10), 0, TAU)
    ctx.fill()
    if (rng() > 0.55) {
      ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.flowerPink, CAMPUS_PALETTE.flowerWhite])
      ctx.beginPath()
      ctx.arc(px, py, between(rng, 1.5, 3), 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}

// 5. 建物: 影 → 南面の壁と窓 → 屋根の面/影/瓦 → 屋上設備。
function drawBuildings(ctx: Ctx, buildings: readonly CampusBuilding[], rng: Rng): void {
  for (const b of buildings) {
    const color = roofColor(b.roof)
    const roofY = b.y + 4
    const roofH = b.h - 20
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x + 10, b.y + 14, b.w, b.h)
    ctx.globalAlpha = 1
    ctx.fillStyle = CAMPUS_PALETTE.wallShadow
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.fillStyle = CAMPUS_PALETTE.wallLight
    ctx.fillRect(b.x + 2, b.y + b.h - 12, b.w - 4, 10)
    // 南面の窓。
    for (let row = 0; row < Math.max(1, b.floors - 1); row += 1) {
      const wy = b.y + b.h - 10 - row * 7
      const cols = Math.floor((b.w - 16) / 22)
      for (let col = 0; col < cols; col += 1) {
        const wx = b.x + 8 + col * 22
        ctx.globalAlpha = 0.55
        ctx.fillStyle = CAMPUS_PALETTE.shadow
        ctx.fillRect(wx, wy, 10, 4)
        ctx.globalAlpha = 0.8
        ctx.fillStyle = CAMPUS_PALETTE.stoneLight
        ctx.fillRect(wx + 1, wy + 1, 4, 2)
      }
    }
    // 入口の庇。
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.fillRect(b.entrance.x - 16, b.y + b.h - 7, 32, 7)
    ctx.globalAlpha = 0.4
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.entrance.x - 16, b.y + b.h - 2, 32, 3)
    // 屋根: 面 → 南側の影 → 北側のハイライト → 棟と瓦。
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.fillRect(b.x + 3, roofY, b.w - 6, roofH)
    ctx.globalAlpha = 0.22
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x + 3, roofY + roofH * 0.45, b.w - 6, roofH * 0.55)
    ctx.globalAlpha = 0.16
    ctx.fillStyle = CAMPUS_PALETTE.flowerWhite
    ctx.fillRect(b.x + 5, roofY + 2, b.w - 10, Math.max(3, roofH * 0.2))
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = CAMPUS_PALETTE.shadow
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(b.x + 6, roofY + roofH * 0.34)
    ctx.lineTo(b.x + b.w - 6, roofY + roofH * 0.34)
    ctx.stroke()
    ctx.globalAlpha = 0.2
    ctx.lineWidth = 1
    for (let x = b.x + 10; x < b.x + b.w - 6; x += 11) {
      ctx.beginPath()
      ctx.moveTo(x, roofY + 2)
      ctx.lineTo(x, roofY + roofH - 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.4
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.fillRect(b.x + 3, roofY + roofH - 3, b.w - 6, 3)
    // floorsが増えるほど屋根に並ぶ天窓の段を増やす。
    const rows = Math.max(1, b.floors)
    const rowH = Math.max(6, (roofH - 12) / rows)
    for (let row = 0; row < rows; row += 1) {
      const wy = roofY + 6 + row * rowH
      const cols = Math.max(2, Math.floor((b.w - 20) / 26))
      for (let col = 0; col < cols; col += 1) {
        const wx = b.x + 10 + col * 26
        ctx.globalAlpha = 0.55
        ctx.fillStyle = CAMPUS_PALETTE.shadow
        ctx.fillRect(wx, wy, 12, 7)
        ctx.globalAlpha = 0.75
        ctx.fillStyle = CAMPUS_PALETTE.waterLight
        ctx.fillRect(wx + 1, wy + 1, 9, 4)
      }
    }
    // 空調・太陽光パネル。
    ctx.globalAlpha = 1
    const units = Math.max(2, Math.floor(b.w / 70))
    for (let i = 0; i < units; i += 1) {
      const ux = b.x + 12 + (i * (b.w - 40)) / Math.max(1, units - 1)
      const uy = roofY + roofH - between(rng, 12, 20)
      ctx.fillStyle = CAMPUS_PALETTE.stoneDark
      ctx.fillRect(ux, uy, 16, 10)
      ctx.strokeStyle = CAMPUS_PALETTE.stoneLight
      ctx.lineWidth = 1
      ctx.strokeRect(ux, uy, 16, 10)
      ctx.fillStyle = CAMPUS_PALETTE.wallLight
      ctx.fillRect(ux + 3, uy + 3, 10, 4)
    }
    ctx.restore()
  }
}

// 6. 樹木: 影 → 幹 → 3段の樹冠 → ハイライト。障害物は12/20/18px避ける。
function drawTrees(ctx: Ctx, layout: CampusLayout, rng: Rng): void {
  ctx.save()
  for (const zone of layout.treeZones) {
    const target = Math.round((zone.w * zone.h * zone.density) / 900)
    let placed = 0
    for (let attempt = 0; attempt < target * 8 && placed < target; attempt += 1) {
      const x = zone.x + rng() * zone.w
      const y = zone.y + rng() * zone.h
      if (blockedForTree(x, y, layout)) continue
      placed += 1
      const r = between(rng, 10, 22)
      ctx.globalAlpha = 0.25
      ctx.fillStyle = CAMPUS_PALETTE.shadow
      ctx.beginPath()
      ctx.arc(x + 3, y + 4, r * 0.9, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = CAMPUS_PALETTE.trunk
      ctx.fillRect(x - 2, y, between(rng, 2, 4), r * 0.65)
      ctx.fillStyle = CAMPUS_PALETTE.canopyDark
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = CAMPUS_PALETTE.canopyMid
      ctx.beginPath()
      ctx.arc(x - r * 0.1, y - r * 0.15, r * 0.8, 0, TAU)
      ctx.fill()
      ctx.fillStyle = CAMPUS_PALETTE.canopyLight
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.45, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 0.5
      ctx.fillStyle = CAMPUS_PALETTE.flowerWhite
      ctx.fillRect(x - r * 0.4, y - r * 0.5, between(rng, 2, 4), between(rng, 2, 4))
      if (rng() > 0.65) {
        ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.flowerPink, CAMPUS_PALETTE.flowerYellow])
        ctx.fillRect(x + r * 0.25, y - r * 0.2, 2, 2)
      }
    }
  }
  ctx.restore()
}

// 7. 草花・低木・岩・ベンチ・街灯・落ち葉。
function drawProps(ctx: Ctx, layout: CampusLayout, rng: Rng): void {
  ctx.save()
  const pathSegments = layout.paths.flatMap(segmentsOf)
  const flowerColors = [CAMPUS_PALETTE.flowerPink, CAMPUS_PALETTE.flowerYellow, CAMPUS_PALETTE.flowerWhite]
  let flowers = 0
  for (let attempt = 0; attempt < 340 * 8 && flowers < 340; attempt += 1) {
    let x: number
    let y: number
    if (rng() < 0.55) {
      const s = pick(rng, pathSegments)
      const t = rng()
      const off = (rng() > 0.5 ? 1 : -1) * between(rng, 8, 34)
      x = s.a.x + (s.b.x - s.a.x) * t + s.nx * off
      y = s.a.y + (s.b.y - s.a.y) * t + s.ny * off
    } else {
      const z = pick(rng, layout.treeZones)
      x = z.x + rng() * z.w
      y = z.y + rng() * z.h
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
  for (let attempt = 0; attempt < 90 * 8 && bushes < 90; attempt += 1) {
    const z = pick(rng, layout.treeZones)
    const x = z.x + rng() * z.w
    const y = z.y + rng() * z.h
    if (nearBuilding(x, y, layout, 8) || nearPond(x, y, layout, 10)) continue
    bushes += 1
    ctx.globalAlpha = 0.9
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    ctx.beginPath()
    ctx.arc(x + 2, y + 3, between(rng, 5, 9), 0, TAU)
    ctx.fill()
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.canopyDark, CAMPUS_PALETTE.canopyMid])
    ctx.beginPath()
    ctx.arc(x, y, between(rng, 5, 10), 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.canopyLight
    ctx.fillRect(x - 3, y - 5, 4, 3)
  }
  let rocks = 0
  for (let attempt = 0; attempt < 50 * 8 && rocks < 50; attempt += 1) {
    const c = pick(rng, layout.cliffs)
    const x = c.x + rng() * c.w
    const y = c.y + rng() * c.h
    if (x < 4 || y < 4 || x > layout.width - 4 || y > layout.height - 4) continue
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
  // 並木道（幅120の石畳）に沿ってベンチ8個と街灯10個。
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
        ctx.globalAlpha = 1
        ctx.fillStyle = CAMPUS_PALETTE.stoneDark
        ctx.fillRect(x - 2, y - 2, 4, 18)
        ctx.fillStyle = CAMPUS_PALETTE.trunk
        ctx.fillRect(x - 1, y - 16, 2, 16)
        ctx.globalAlpha = 0.6
        ctx.fillStyle = CAMPUS_PALETTE.flowerYellow
        ctx.beginPath()
        ctx.arc(x, y - 17, 4, 0, TAU)
        ctx.fill()
      }
    }
  }
  // 落ち葉は道の縁と樹木帯に skew なく散布。
  for (let i = 0; i < 240; i += 1) {
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
    ctx.globalAlpha = between(rng, 0.35, 0.75)
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.roofOchre, CAMPUS_PALETTE.earthMid, CAMPUS_PALETTE.rockMid, CAMPUS_PALETTE.flowerYellow])
    ctx.fillRect(x, y, between(rng, 2, 5), between(rng, 2, 4))
  }
  ctx.restore()
}

export function drawCampusBase(ctx: Ctx, layout: CampusLayout = CAMPUS_LAYOUT): void {
  const rng = mulberry32(0x5fc0a5)
  drawGrass(ctx, layout, rng)
  drawCliffs(ctx, layout.cliffs, rng)
  drawPaths(ctx, layout.paths, rng)
  drawPond(ctx, layout.pond, rng)
  drawBuildings(ctx, layout.buildings, rng)
  drawTrees(ctx, layout, rng)
  drawProps(ctx, layout, rng)
}
