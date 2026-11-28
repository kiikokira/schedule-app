// SFCキャンパスRPGの背景描画。DOM非依存、CanvasRenderingContext2Dのみを受け取る。
// 地形グリッド（sfcCampusGrid.ts）の各マスを8×8単位のタイルで描く。
// 模様はすべて mulberry32 で決定論的に散布し、文字・画像・グラデーションは使わない。

import { CAMPUS_CELL, CAMPUS_COLS, CAMPUS_GRID, CAMPUS_NAMIKI_CELL, CAMPUS_ROWS } from './sfcCampusGrid'
import { BUILDING_NAMES, cellAt, cellAtPoint, isBlockedCell, isRoadCell } from './sfcCampusGridQuery'
import { CAMPUS_LAYOUT } from './sfcCampusLayout'
import type { CampusBuilding, RoofStyle } from './sfcCampusLayout'

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
export type TreeSpot = { x: number; y: number; r: number; cherry: boolean }

const TAU = Math.PI * 2
const DIR4: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIR8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
]
const TREE_CHANCE = 0.05
const TREE_SPACING = 26
const TREE_ENTRANCE_CLEAR = 2
const ENTRANCE_CELLS = CAMPUS_LAYOUT.buildings.map((b) => ({
  col: Math.floor(b.entrance.x / CAMPUS_CELL),
  row: Math.floor(b.entrance.y / CAMPUS_CELL),
}))
let treeCache: TreeSpot[] | null = null

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

function int(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1))
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

function isBuildingChar(ch: string): boolean {
  return isBlockedCell(ch) && ch !== '#' && ch !== '~'
}

// マスの向こう側（dc,dr）に面した帯の矩形。
function edgeRect(x: number, y: number, dc: number, dr: number, t: number): [number, number, number, number] {
  return [
    dc === 1 ? x + CAMPUS_CELL - t : x,
    dr === 1 ? y + CAMPUS_CELL - t : y,
    dc === 0 ? CAMPUS_CELL : t,
    dr === 0 ? CAMPUS_CELL : t,
  ]
}

function drawGrassTile(ctx: Ctx, col: number, row: number, rng: Rng): void {
  const x = col * CAMPUS_CELL
  const y = row * CAMPUS_CELL
  ctx.globalAlpha = 1
  ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.grassMid, CAMPUS_PALETTE.grassMid, CAMPUS_PALETTE.grassDark])
  ctx.fillRect(x, y, CAMPUS_CELL, CAMPUS_CELL)
  if (rng() < 0.4) {
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.grassLight, CAMPUS_PALETTE.grassDark])
    ctx.fillRect(x + int(rng, 0, 5), y + int(rng, 0, 5), 2, 2)
  }
  if (rng() < 0.25) {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.grassLight
    const tx = x + int(rng, 1, 5)
    const ty = y + int(rng, 2, 4)
    ctx.fillRect(tx, ty, 1, 3)
    ctx.fillRect(tx + 2, ty - 1, 1, 4)
  }
}

// 石道: 敷石の目地を薄く入れ、隣が道でない辺だけ土色の1pxで縁取る。交差部は同じタイルなので割り込まない。
function drawRoadTile(ctx: Ctx, col: number, row: number, rng: Rng): void {
  const x = col * CAMPUS_CELL
  const y = row * CAMPUS_CELL
  ctx.globalAlpha = 1
  ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.stoneDark, '#9a948a', CAMPUS_PALETTE.stoneLight])
  ctx.fillRect(x, y, CAMPUS_CELL, CAMPUS_CELL)
  if (rng() < 0.12) {
    ctx.fillStyle = CAMPUS_PALETTE.stoneLight
    ctx.fillRect(x + int(rng, 2, 4), y + int(rng, 2, 4), 2, 2)
  }
  ctx.globalAlpha = 0.45
  ctx.fillStyle = CAMPUS_PALETTE.earthDark
  ctx.fillRect(x, y, CAMPUS_CELL, 1)
  ctx.fillRect(x, y, 1, CAMPUS_CELL)
  ctx.globalAlpha = 1
  for (const [dc, dr] of DIR4) {
    if (isRoadCell(cellAt(col + dc, row + dr))) continue
    ctx.fillStyle = CAMPUS_PALETTE.earthDark
    ctx.fillRect(...edgeRect(x, y, dc, dr, 1))
  }
}

function drawDirtTile(ctx: Ctx, col: number, row: number, rng: Rng): void {
  const x = col * CAMPUS_CELL
  const y = row * CAMPUS_CELL
  ctx.globalAlpha = 1
  ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.earthMid, CAMPUS_PALETTE.earthMid, CAMPUS_PALETTE.earthDark])
  ctx.fillRect(x, y, CAMPUS_CELL, CAMPUS_CELL)
  if (rng() < 0.4) {
    ctx.fillStyle = CAMPUS_PALETTE.rockMid
    ctx.fillRect(x + int(rng, 1, 5), y + int(rng, 1, 5), 2, 1)
  }
}

// 池: 深い水 → 岸の中間色 → 陸側の白い泡の3層。水の中には波紋を散らす。
function drawWaterTile(ctx: Ctx, col: number, row: number, rng: Rng): void {
  const x = col * CAMPUS_CELL
  const y = row * CAMPUS_CELL
  ctx.globalAlpha = 1
  const shore = DIR8.some(([dc, dr]) => cellAt(col + dc, row + dr) !== '~')
  ctx.fillStyle = shore ? CAMPUS_PALETTE.waterMid : CAMPUS_PALETTE.waterDeep
  ctx.fillRect(x, y, CAMPUS_CELL, CAMPUS_CELL)
  if (shore) {
    ctx.fillStyle = CAMPUS_PALETTE.waterLight
    for (const [dc, dr] of DIR4) {
      if (cellAt(col + dc, row + dr) === '~') continue
      ctx.fillRect(...edgeRect(x, y, dc, dr, 1))
    }
  } else if (rng() < 0.15) {
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = CAMPUS_PALETTE.waterLight
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x + 4, y + 4, between(rng, 2, 3), 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function drawCliffTile(ctx: Ctx, col: number, row: number, rng: Rng): void {
  const x = col * CAMPUS_CELL
  const y = row * CAMPUS_CELL
  ctx.globalAlpha = 1
  ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.rockMid, CAMPUS_PALETTE.rockDark, CAMPUS_PALETTE.rockMid])
  ctx.fillRect(x, y, CAMPUS_CELL, CAMPUS_CELL)
  if (rng() < 0.35) {
    ctx.fillStyle = CAMPUS_PALETTE.rockLight
    ctx.fillRect(x + int(rng, 1, 5), y + int(rng, 1, 5), 2, 2)
  }
  ctx.fillStyle = CAMPUS_PALETTE.rockDark
  for (const [dc, dr] of DIR4) {
    if (cellAt(col + dc, row + dr) === '#') continue
    ctx.fillRect(...edgeRect(x, y, dc, dr, 2))
  }
}

function drawTerrain(ctx: Ctx, rng: Rng): void {
  for (let row = 0; row < CAMPUS_ROWS; row += 1) {
    for (let col = 0; col < CAMPUS_COLS; col += 1) {
      const ch = CAMPUS_GRID[row][col]
      if (ch === '.') drawGrassTile(ctx, col, row, rng)
      else if (ch === '=') drawRoadTile(ctx, col, row, rng)
      else if (ch === ':') drawDirtTile(ctx, col, row, rng)
      else if (ch === '~') drawWaterTile(ctx, col, row, rng)
      else if (ch === '#') drawCliffTile(ctx, col, row, rng)
      else {
        ctx.globalAlpha = 1
        ctx.fillStyle = CAMPUS_PALETTE.grassDark
        ctx.fillRect(col * CAMPUS_CELL, row * CAMPUS_CELL, CAMPUS_CELL, CAMPUS_CELL)
      }
    }
  }
}

function roofHeight(b: CampusBuilding): number {
  return Math.max(30, Math.round(b.h * 0.62))
}

function buildingChar(b: CampusBuilding): string {
  if (b.name === '') return 'n'
  const hit = Object.entries(BUILDING_NAMES).find(([, v]) => v.id === b.id)
  return hit ? hit[0] : 'n'
}

// 建物の地面の影。建物の外形の外にもはみ出すため、本体より先に別に描く。
function drawBuildingShadow(ctx: Ctx, b: CampusBuilding): void {
  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  ctx.fillRect(b.x + 6, b.y + 10, b.w, b.h)
  ctx.globalAlpha = 0.15
  ctx.fillRect(b.x + 3, b.y + 5, b.w, b.h)
  ctx.restore()
}

// 矩形のうち、文字 ch のマスに重なる部分だけを塗る。不整形の建物が周囲の道や草を覆わないようにする。
function fillIn(ctx: Ctx, ch: string, x: number, y: number, w: number, h: number): void {
  const c0 = Math.floor(x / CAMPUS_CELL)
  const c1 = Math.floor((x + w - 1) / CAMPUS_CELL)
  const r0 = Math.floor(y / CAMPUS_CELL)
  const r1 = Math.floor((y + h - 1) / CAMPUS_CELL)
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (cellAt(c, r) !== ch) continue
      const x0 = Math.max(x, c * CAMPUS_CELL)
      const y0 = Math.max(y, r * CAMPUS_CELL)
      const x1 = Math.min(x + w, (c + 1) * CAMPUS_CELL)
      const y1 = Math.min(y + h, (r + 1) * CAMPUS_CELL)
      if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
  }
}

// 屋根・壁・窓。bboxではなく、同じ文字の連結マスの上だけに描く。
function drawBuildingBody(ctx: Ctx, b: CampusBuilding, rng: Rng): void {
  const ch = buildingChar(b)
  const fill = (x: number, y: number, w: number, h: number): void => fillIn(ctx, ch, x, y, w, h)
  const color = roofColor(b.roof)
  const roofH = roofHeight(b)
  const wallY = b.y + roofH
  const wallH = b.h - roofH
  ctx.save()
  // 屋根。
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  fill(b.x, b.y, b.w, roofH)
  ctx.globalAlpha = 0.16
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  fill(b.x, b.y + roofH * 0.65, b.w, roofH * 0.35)
  ctx.globalAlpha = 0.12
  ctx.fillStyle = CAMPUS_PALETTE.wallLight
  fill(b.x, b.y, b.w, 12)
  ctx.globalAlpha = 0.3
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  fill(b.x + 3, b.y + roofH * 0.45, b.w - 6, 2)
  ctx.globalAlpha = 0.14
  for (let x = b.x + 12; x < b.x + b.w - 4; x += 12 + Math.floor(rng() * 3)) {
    fill(x, b.y + 2, 1, roofH - 4)
  }
  ctx.globalAlpha = 0.5
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  fill(b.x, b.y, b.w, 1)
  fill(b.x, b.y + roofH - 1, b.w, 1)
  fill(b.x, b.y, 1, roofH)
  fill(b.x + b.w - 1, b.y, 1, roofH)
  ctx.globalAlpha = 0.4
  fill(b.x + 1, b.y + roofH - 3, b.w - 2, 3)
  // 屋上設備（屋根の北半分）。窓は作らない。
  const units = 1 + (b.w > 160 ? 1 : 0)
  for (let i = 0; i < units; i += 1) {
    const ux = b.x + 10 + (i * (b.w - 40)) / Math.max(1, units - 1)
    const uy = b.y + 8 + between(rng, 0, Math.max(1, roofH * 0.25))
    ctx.globalAlpha = 0.5
    ctx.fillStyle = CAMPUS_PALETTE.shadow
    fill(ux + 1, uy + 1, 10, 7)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#c9c4b8'
    fill(ux, uy, 10, 7)
    ctx.fillStyle = '#e6e2d8'
    fill(ux, uy, 10, 1)
    if (cellAtPoint(ux + 5, uy + 4) !== ch) continue
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
        fill(px, py, 8, 5)
        ctx.fillStyle = '#7fb2d9'
        fill(px, py, 8, 1)
      }
    }
  }
  // 南面の壁。
  ctx.globalAlpha = 1
  ctx.fillStyle = CAMPUS_PALETTE.wallLight
  fill(b.x, wallY, b.w, wallH)
  ctx.fillStyle = CAMPUS_PALETTE.wallShadow
  fill(b.x, wallY, 4, wallH)
  fill(b.x + b.w - 4, wallY, 4, wallH)
  fill(b.x, b.y + b.h - 2, b.w, 2)
  // 石積みの目地。大きな壁がのっぺりしないように薄く入れる。
  ctx.globalAlpha = 0.14
  ctx.fillStyle = CAMPUS_PALETTE.wallShadow
  for (let wy = wallY + 7; wy < b.y + b.h - 3; wy += 7) {
    fill(b.x + 2, wy, b.w - 4, 1)
  }
  ctx.globalAlpha = 0.1
  for (let row = 0; wallY + 7 + row * 7 < b.y + b.h - 3; row += 1) {
    const offset = row % 2 === 0 ? 0 : 7
    for (let wx = b.x + 8 + offset; wx < b.x + b.w - 4; wx += 14) {
      fill(wx, wallY + row * 7, 1, 7)
    }
  }
  ctx.globalAlpha = 1
  // 基礎の帯。
  ctx.fillStyle = '#b3ac9e'
  fill(b.x, b.y + b.h - 5, b.w, 3)
  // 窓は壁の帯の中だけ。
  const rows = Math.max(1, Math.min(2, Math.floor((wallH - 10) / 9)))
  const cols = Math.floor((b.w - 20) / 18)
  for (let row = 0; row < rows; row += 1) {
    const wy = wallY + 6 + row * 9
    if (wy + 5 > b.y + b.h - 2) continue
    for (let col = 0; col < cols; col += 1) {
      const wx = b.x + 12 + col * 18
      ctx.fillStyle = '#2a3f5f'
      fill(wx, wy, 9, 5)
      ctx.fillStyle = '#7fb2d9'
      fill(wx, wy, 9, 1)
      ctx.fillStyle = '#f0ead9'
      fill(wx - 1, wy + 5, 11, 1)
    }
  }
  // 軒の影。
  ctx.globalAlpha = 0.45
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  fill(b.x, wallY - 2, b.w, 3)
  ctx.restore()
}

// 入口: ドア・庇・階段。道の側へ出っ張る部分なので、建物の外形の外に描く。
function drawEntrance(ctx: Ctx, b: CampusBuilding): void {
  const color = roofColor(b.roof)
  const wallH = b.h - roofHeight(b)
  const doorH = Math.max(10, Math.round(wallH * 0.6))
  const doorY = b.y + b.h - doorH
  const doorX = b.entrance.x - 7
  ctx.save()
  ctx.globalAlpha = 1
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
  ctx.restore()
}

function drawBuilding(ctx: Ctx, b: CampusBuilding, rng: Rng): void {
  drawBuildingBody(ctx, b, rng)
  drawEntrance(ctx, b)
}

// 木の周囲1マス（3×3）に道・建物・池がないか。
function nearBlocker(col: number, row: number): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const ch = cellAt(col + dc, row + dr)
      if (isRoadCell(ch) || ch === '~' || isBuildingChar(ch)) return true
    }
  }
  return false
}

// 木や低木の置ける点か。建物の入口から2マス以内は歩けなくなるので避ける。
function spotClear(x: number, y: number): boolean {
  const col = Math.floor(x / CAMPUS_CELL)
  const row = Math.floor(y / CAMPUS_CELL)
  if (nearBlocker(col, row)) return false
  return ENTRANCE_CELLS.every((e) => Math.max(Math.abs(e.col - col), Math.abs(e.row - row)) > TREE_ENTRANCE_CLEAR)
}

// 大木の位置。描画と当たり判定（幹）が同じ配置を使うため、一度だけ決めてキャッシュする。
// 幹の根元 (x, y + r*0.5) と樹冠の中心が、どちらも草地のマスの上にあることを条件にする。
export function placeTrees(): TreeSpot[] {
  if (treeCache) return treeCache
  const rng = mulberry32(0x7ee5)
  const spots: TreeSpot[] = []
  for (let row = 0; row < CAMPUS_ROWS; row += 1) {
    for (let col = 0; col < CAMPUS_COLS; col += 1) {
      if (CAMPUS_GRID[row][col] !== '.') continue
      if (rng() > TREE_CHANCE) continue
      const x = (col + rng()) * CAMPUS_CELL
      const y = (row + rng()) * CAMPUS_CELL
      const r = 13 + (rng() + rng()) * 0.5 * 15
      const cherry = rng() < 0.12
      const baseY = y + r * 0.5
      if (cellAtPoint(x, y) !== '.' || cellAtPoint(x, baseY) !== '.') continue
      if (!spotClear(x, y) || !spotClear(x, baseY)) continue
      if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < TREE_SPACING)) continue
      spots.push({ x, y, r, cherry })
    }
  }
  treeCache = spots
  return spots
}

// 6. 並木の大木: 地面の影 → 幹 → 3つの重なるシルエット → 中 → 明 → ハイライト。
function drawTrees(ctx: Ctx, rng: Rng): void {
  ctx.save()
  for (const { x, y, r, cherry } of placeTrees()) {
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
  ctx.restore()
}

// 並木道の看板の周囲で、道から1マス空けた草地のマス（ベンチや街灯の候補）。
function roadsideGrass(): Array<{ col: number; row: number }> {
  const out: Array<{ col: number; row: number }> = []
  const cc = CAMPUS_NAMIKI_CELL.col
  const cr = CAMPUS_NAMIKI_CELL.row
  for (let row = cr - 14; row <= cr + 14; row += 1) {
    for (let col = cc - 14; col <= cc + 14; col += 1) {
      if (cellAt(col, row) !== '.') continue
      const beside = DIR4.some(([dc, dr]) => isRoadCell(cellAt(col + 2 * dc, row + 2 * dr)) && cellAt(col + dc, row + dr) === '.')
      if (beside) out.push({ col, row })
    }
  }
  return out
}

// 7. 装飾: 花・低木・ベンチ・街灯・落ち葉。すべてグリッドで判定し、道・建物・池の上には置かない。
function drawProps(ctx: Ctx, rng: Rng): void {
  ctx.save()
  const width = CAMPUS_LAYOUT.width
  const height = CAMPUS_LAYOUT.height
  const flowerColors = [CAMPUS_PALETTE.flowerPink, CAMPUS_PALETTE.flowerYellow, CAMPUS_PALETTE.flowerWhite]
  let flowers = 0
  for (let attempt = 0; attempt < 340 * 20 && flowers < 340; attempt += 1) {
    const x = Math.floor(rng() * width)
    const y = Math.floor(rng() * height)
    if (cellAtPoint(x, y) !== '.') continue
    flowers += 1
    ctx.globalAlpha = 1
    ctx.fillStyle = pick(rng, flowerColors)
    ctx.fillRect(x, y, 3, 3)
    ctx.fillRect(x + 2, y - 2, 2, 2)
  }
  let bushes = 0
  for (let attempt = 0; attempt < 90 * 20 && bushes < 90; attempt += 1) {
    const x = Math.floor(rng() * width)
    const y = Math.floor(rng() * height)
    if (cellAtPoint(x, y) !== '.' || !spotClear(x, y)) continue
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
  const roadside = roadsideGrass()
  for (let i = 0; i < 8 && roadside.length > 0; i += 1) {
    const cell = roadside[Math.floor(((i + 0.5) / 8) * roadside.length)]
    const x = cell.col * CAMPUS_CELL + CAMPUS_CELL / 2
    const y = cell.row * CAMPUS_CELL + CAMPUS_CELL / 2
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
  for (let i = 0; i < 10 && roadside.length > 0; i += 1) {
    const cell = roadside[Math.floor(((i + 0.5) / 10) * roadside.length)]
    const x = cell.col * CAMPUS_CELL + CAMPUS_CELL / 2
    const y = cell.row * CAMPUS_CELL + CAMPUS_CELL / 2
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#f3d27a'
    ctx.beginPath()
    ctx.arc(x, y - 17, 4, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = CAMPUS_PALETTE.stoneDark
    ctx.fillRect(x - 2, y - 2, 4, 8)
    ctx.fillStyle = CAMPUS_PALETTE.trunk
    ctx.fillRect(x - 1, y - 16, 2, 14)
    ctx.fillStyle = CAMPUS_PALETTE.flowerYellow
    ctx.fillRect(x - 2, y - 18, 4, 3)
  }
  let leaves = 0
  for (let attempt = 0; attempt < 240 * 20 && leaves < 240; attempt += 1) {
    const x = Math.floor(rng() * width)
    const y = Math.floor(rng() * height)
    const ch = cellAtPoint(x, y)
    if (ch !== '.' && ch !== ':') continue
    leaves += 1
    ctx.globalAlpha = between(rng, 0.35, 0.75)
    ctx.fillStyle = pick(rng, [CAMPUS_PALETTE.roofOchre, CAMPUS_PALETTE.earthMid, CAMPUS_PALETTE.rockMid, '#c9a14a'])
    ctx.fillRect(x, y, int(rng, 2, 4), int(rng, 2, 3))
  }
  ctx.restore()
}

function drawSignboard(ctx: Ctx, x: number, y: number): void {
  // 並木道の看板。ホットスポットの目印が宙に浮かないよう、木々の上に描く。
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = CAMPUS_PALETTE.shadow
  ctx.save()
  ctx.translate(x, y + 5)
  ctx.scale(1, 0.3)
  ctx.beginPath()
  ctx.arc(0, 0, 18, 0, TAU)
  ctx.fill()
  ctx.restore()
  ctx.globalAlpha = 1
  // 支柱
  ctx.fillStyle = '#3f2a1a'
  ctx.fillRect(x - 10, y - 12, 3, 17)
  ctx.fillRect(x + 7, y - 12, 3, 17)
  // 板
  ctx.fillStyle = '#7a5230'
  ctx.fillRect(x - 19, y - 30, 38, 20)
  ctx.fillStyle = '#a8794a'
  ctx.fillRect(x - 17, y - 28, 34, 16)
  ctx.fillStyle = '#e8d8b0'
  ctx.fillRect(x - 13, y - 24, 26, 2)
  ctx.fillRect(x - 13, y - 20, 18, 2)
  ctx.fillRect(x - 13, y - 16, 22, 2)
  // 屋根
  ctx.fillStyle = '#5a3f28'
  ctx.fillRect(x - 21, y - 33, 42, 4)
  ctx.restore()
}

export function drawCampusBase(ctx: Ctx): void {
  const rng = mulberry32(0x5fc0a5)
  drawTerrain(ctx, rng)
  for (const b of CAMPUS_LAYOUT.buildings) drawBuildingShadow(ctx, b)
  for (const b of CAMPUS_LAYOUT.buildings) drawBuilding(ctx, b, rng)
  drawTrees(ctx, rng)
  drawProps(ctx, rng)
  drawSignboard(ctx, CAMPUS_NAMIKI_CELL.col * CAMPUS_CELL + CAMPUS_CELL / 2, CAMPUS_NAMIKI_CELL.row * CAMPUS_CELL + CAMPUS_CELL / 2)
}
