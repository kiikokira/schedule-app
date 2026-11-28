// SFCキャンパスRPGのマップデータ。当たり判定・ホットスポット・ラベルは
// 地形グリッドと CAMPUS_LAYOUT から導出し、座標の二重管理を避ける。

import { CAMPUS_CELL, CAMPUS_KAMOIKE_CELL, CAMPUS_NAMIKI_CELL, CAMPUS_SPAWN_CELL } from './sfcCampusGrid'
import { blockerRects } from './sfcCampusGridQuery'
import { CAMPUS_LAYOUT, buildingById } from './sfcCampusLayout'
import type { Blocker } from './sfcCampusMovement'

export type HotspotKind = 'quest' | 'today' | 'info'
export type Hotspot = { id: string; x: number; y: number; r: number; title: string; text: string; kind: HotspotKind }
export type MapLabel = { text: string; x: number; y: number; kind: 'building' | 'area' }

export const MAP_W = CAMPUS_LAYOUT.width
export const MAP_H = CAMPUS_LAYOUT.height
export const ZOOM = 2
export const PLAYER_RADIUS = 6

function cellCenter(cell: { col: number; row: number }): { x: number; y: number } {
  return { x: cell.col * CAMPUS_CELL + CAMPUS_CELL / 2, y: cell.row * CAMPUS_CELL + CAMPUS_CELL / 2 }
}

function entranceOf(id: string): { x: number; y: number } {
  return buildingById(id)!.entrance
}

export const SPAWN = cellCenter(CAMPUS_SPAWN_CELL)

export const BLOCKERS: Blocker[] = blockerRects()

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'namiki-board', ...cellCenter(CAMPUS_NAMIKI_CELL), r: 48, kind: 'quest', title: '並木道の看板',
    text: '今日の学習枠が貼られている。近づいてEで確認しよう。',
  },
  {
    id: 'media-center', ...entranceOf('mu'), r: 44, kind: 'today', title: 'Μメディアセンター',
    text: '自習席と資料がそろう。今日の計画をここから開ける。',
  },
  {
    id: 'main-building', ...entranceOf('alpha'), r: 48, kind: 'info', title: 'Α本館',
    text: 'SFCの顔。講義室と事務局が入っている。',
  },
  {
    id: 'sigma-cafeteria', ...entranceOf('sigma-cafeteria'), r: 40, kind: 'info', title: 'Σ生協食堂',
    text: '昼どきは行列。ここで英気を養おう。',
  },
  {
    id: 'student-lounge', ...entranceOf('lounge'), r: 40, kind: 'info', title: '学生ラウンジ',
    text: 'グループ学習に使える開けた空間。',
  },
  {
    id: 'kamoike', ...cellCenter(CAMPUS_KAMOIKE_CELL), r: 48, kind: 'info', title: '鴨池',
    text: '鴨が泳ぐ池。岸をのんびり歩ける。',
  },
  {
    id: 'grad-theta', ...entranceOf('theta'), r: 40, kind: 'info', title: 'Θ館',
    text: '大学院の研究棟。静かな廊下が続く。',
  },
  {
    id: 'grad-omega', ...entranceOf('omega'), r: 40, kind: 'info', title: 'Ω館',
    text: '実験室が集まる棟。',
  },
  {
    id: 'grad-tau', ...entranceOf('tau'), r: 44, kind: 'info', title: 'τ大学院棟',
    text: '北東の大学院棟。遠くまで見渡せる。',
  },
]

export const AREA_LABELS: MapLabel[] = [
  { text: '並木道', ...cellCenter(CAMPUS_NAMIKI_CELL), kind: 'area' },
  { text: '鴨池', ...cellCenter(CAMPUS_KAMOIKE_CELL), kind: 'area' },
  { text: '本館前', ...entranceOf('alpha'), kind: 'area' },
  { text: '生協食堂前', ...entranceOf('sigma-cafeteria'), kind: 'area' },
  { text: '大学院棟', ...entranceOf('tau'), kind: 'area' },
  { text: 'メディアセンター前', ...entranceOf('mu'), kind: 'area' },
]

export const LABELS: MapLabel[] = [
  ...CAMPUS_LAYOUT.buildings
    .filter((b) => b.name !== '')
    .map((b) => ({
      text: b.name,
      x: b.x + b.w / 2,
      y: b.y + 18,
      kind: 'building' as const,
    })),
  ...AREA_LABELS,
]

export function findNearbyHotspot(x: number, y: number): Hotspot | null {
  let best: Hotspot | null = null
  let bestD = Infinity
  for (const h of HOTSPOTS) {
    const d = Math.hypot(x - h.x, y - h.y)
    if (d <= h.r && d < bestD) {
      best = h
      bestD = d
    }
  }
  return best
}

export function nearestArea(x: number, y: number): string {
  let best = 'SFCキャンパス'
  let bestD = Infinity
  for (const a of AREA_LABELS) {
    const d = Math.hypot(x - a.x, y - a.y)
    if (d < bestD) {
      best = a.text
      bestD = d
    }
  }
  return best
}
