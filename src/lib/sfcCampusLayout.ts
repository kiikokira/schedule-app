// SFCキャンパスRPGのレイアウト。1マス=8単位のマップ座標（上が北）。
// 建物は地形グリッド（sfcCampusGrid.ts）から導出する。描画・当たり判定・ホットスポットはここから導出する。

import { CAMPUS_CELL, CAMPUS_COLS, CAMPUS_ROWS } from './sfcCampusGrid'
import { buildingsFromGrid } from './sfcCampusGridQuery'

export { BUILDING_NAMES } from './sfcCampusGridQuery'

export type CampusPoint = { x: number; y: number }
export type RoofStyle = 'red' | 'blue' | 'ochre' | 'gray' | 'brown'
export type CampusBuilding = {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  roof: RoofStyle
  entrance: CampusPoint
}
export type CampusPath = { points: CampusPoint[]; width: number; kind: 'stone' | 'earth' }
export type TreeZone = { x: number; y: number; w: number; h: number; density: number }
export type CampusRect = { x: number; y: number; w: number; h: number }
export type CampusLayout = {
  width: number
  height: number
  buildings: CampusBuilding[]
  pond: CampusPoint[]
  paths: CampusPath[]
  cliffs: CampusRect[]
  treeZones: TreeZone[]
}

const ROOFS: Readonly<Record<string, RoofStyle>> = {
  'sigma-cafeteria': 'ochre',
  kappa: 'gray',
  epsilon: 'gray',
  iota: 'gray',
  omicron: 'gray',
  lambda: 'brown',
  mu: 'blue',
  lounge: 'brown',
  theta: 'red',
  omega: 'red',
  tau: 'ochre',
  alpha: 'gray',
}

export const CAMPUS_LAYOUT: CampusLayout = {
  width: CAMPUS_COLS * CAMPUS_CELL,
  height: CAMPUS_ROWS * CAMPUS_CELL,
  buildings: buildingsFromGrid().map((g) => ({
    id: g.id,
    name: g.name ?? '',
    x: g.c0 * CAMPUS_CELL,
    y: g.r0 * CAMPUS_CELL,
    w: (g.c1 - g.c0 + 1) * CAMPUS_CELL,
    h: (g.r1 - g.r0 + 1) * CAMPUS_CELL,
    roof: ROOFS[g.id] ?? 'gray',
    entrance: g.entrance,
  })),
  // 旧レイアウトの項目。sfcCampusArt.ts がまだ参照するため空配列で残す（Task 5 で削除する）。
  pond: [],
  paths: [],
  cliffs: [],
  treeZones: [],
}

export function buildingById(id: string): CampusBuilding | undefined {
  return CAMPUS_LAYOUT.buildings.find((b) => b.id === id)
}
