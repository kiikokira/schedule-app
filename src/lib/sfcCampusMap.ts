// SFCキャンパスRPGのマップデータ。当たり判定・ホットスポット・ラベルは
// CAMPUS_LAYOUT から導出し、座標の二重管理を避ける。

import { CAMPUS_LAYOUT, buildingById } from './sfcCampusLayout'
import { placeTrees } from './sfcCampusArt'
import type { Blocker } from './sfcCampusMovement'

export type HotspotKind = 'quest' | 'today' | 'info'
export type Hotspot = { id: string; x: number; y: number; r: number; title: string; text: string; kind: HotspotKind }
export type MapLabel = { text: string; x: number; y: number; kind: 'building' | 'area' }

export const MAP_W = CAMPUS_LAYOUT.width
export const MAP_H = CAMPUS_LAYOUT.height
export const ZOOM = 2
export const PLAYER_RADIUS = 6
export const SPAWN = { x: 900, y: 1130 }

// 池は描画と同じ多角形で判定する（水の内側と岸からの距離で衝突）。
const POND_BLOCKER: Blocker = { kind: 'poly', points: CAMPUS_LAYOUT.pond }

// 大木の幹は、描画で使う配置の根元に円を置く。
const TREE_BLOCKERS: Blocker[] = placeTrees(CAMPUS_LAYOUT).map((t) => ({
  kind: 'circle' as const,
  x: t.x,
  y: t.y + t.r * 0.5,
  r: 5,
}))

export const BLOCKERS: Blocker[] = [
  ...CAMPUS_LAYOUT.buildings.map((b) => ({
    kind: 'rect' as const,
    x: b.x - 6,
    y: b.y - 6,
    w: b.w + 12,
    h: b.h + 12,
  })),
  POND_BLOCKER,
  ...CAMPUS_LAYOUT.cliffs.map((c) => ({ kind: 'rect' as const, x: c.x, y: c.y, w: c.w, h: c.h })),
  ...TREE_BLOCKERS,
]

function entranceOf(id: string): { x: number; y: number } {
  return buildingById(id)!.entrance
}

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'namiki-board', x: 960, y: 420, r: 48, kind: 'quest', title: '並木道の看板',
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
    id: 'kamoike', x: 515, y: 650, r: 48, kind: 'info', title: '鴨池',
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
  {
    id: 'beta-village', ...entranceOf('beta'), r: 44, kind: 'info', title: 'βヴィレッジ',
    text: '学生が暮らすヴィレッジ。',
  },
  {
    id: 'eta-village', ...entranceOf('eta'), r: 44, kind: 'info', title: 'Ηヴィレッジ',
    text: '西のヴィレッジ。池のほとりに建つ。',
  },
]

export const AREA_LABELS: MapLabel[] = [
  { text: '並木道', x: 900, y: 500, kind: 'area' },
  { text: '鴨池', x: 330, y: 640, kind: 'area' },
  { text: '本館前', x: 680, y: 1110, kind: 'area' },
  { text: '生協食堂前', x: 440, y: 280, kind: 'area' },
  { text: '大学院棟', x: 1360, y: 230, kind: 'area' },
  { text: 'ヴィレッジ', x: 1370, y: 940, kind: 'area' },
  { text: 'メディアセンター前', x: 1120, y: 760, kind: 'area' },
]

export const LABELS: MapLabel[] = [
  ...CAMPUS_LAYOUT.buildings.map((b) => ({
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
