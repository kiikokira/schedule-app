// SFCキャンパスRPGのレイアウト定義。1600x1200のマップ座標（上が北）。
// このファイルが座標の単一の情報源。描画・当たり判定・ホットスポットはここから導出する。

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
  floors: number
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

function building(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  roof: RoofStyle,
  floors: number,
): CampusBuilding {
  // 入口は南側の壁の中央、footprintの外側。
  return { id, name, x, y, w, h, roof, floors, entrance: { x: x + w / 2, y: y + h + 18 } }
}

export const CAMPUS_LAYOUT: CampusLayout = {
  width: 1600,
  height: 1200,
  buildings: [
    building('sigma-cafeteria', 'Σ生協食堂', 360, 150, 160, 90, 'ochre', 2),
    building('kappa', 'κ館', 600, 250, 160, 80, 'gray', 3),
    building('epsilon', 'ε館', 600, 370, 160, 80, 'gray', 3),
    building('iota', 'ι館', 600, 490, 160, 80, 'gray', 3),
    building('omicron', 'ο館', 600, 610, 160, 80, 'gray', 3),
    building('lambda', 'λ館', 600, 730, 140, 90, 'brown', 2),
    building('mu', 'Μメディアセンター', 1000, 560, 240, 160, 'blue', 4),
    building('lounge', '学生ラウンジ', 1000, 780, 110, 70, 'brown', 1),
    building('theta', 'Θ館', 1080, 300, 100, 100, 'red', 2),
    building('omega', 'Ω館', 1220, 410, 120, 100, 'red', 2),
    building('tau', 'τ大学院棟', 1260, 160, 200, 130, 'ochre', 3),
    building('alpha', 'Α本館', 540, 940, 280, 140, 'gray', 4),
    building('beta', 'βヴィレッジ', 1280, 880, 180, 120, 'red', 2),
    building('eta', 'Ηヴィレッジ', 180, 980, 160, 100, 'red', 2),
  ],
  pond: [
    { x: 180, y: 540 },
    { x: 320, y: 500 },
    { x: 450, y: 540 },
    { x: 520, y: 620 },
    { x: 480, y: 720 },
    { x: 360, y: 780 },
    { x: 220, y: 760 },
    { x: 140, y: 680 },
    { x: 140, y: 580 },
  ],
  paths: [
    { points: [{ x: 900, y: 1140 }, { x: 900, y: 140 }], width: 120, kind: 'stone' },
    { points: [{ x: 800, y: 1120 }, { x: 1000, y: 1120 }], width: 90, kind: 'stone' },
    { points: [{ x: 900, y: 240 }, { x: 1300, y: 240 }], width: 60, kind: 'earth' },
    { points: [{ x: 540, y: 640 }, { x: 840, y: 640 }], width: 50, kind: 'earth' },
    { points: [{ x: 960, y: 760 }, { x: 1180, y: 760 }], width: 50, kind: 'stone' },
    { points: [{ x: 900, y: 900 }, { x: 1300, y: 950 }], width: 40, kind: 'earth' },
    { points: [{ x: 840, y: 1000 }, { x: 360, y: 1030 }], width: 40, kind: 'earth' },
  ],
  cliffs: [
    { x: 0, y: 0, w: 120, h: 1200 },
    { x: 0, y: 0, w: 1600, h: 90 },
    { x: 1480, y: 0, w: 120, h: 1200 },
    { x: 0, y: 1120, w: 780, h: 80 },
    { x: 1020, y: 1120, w: 580, h: 80 },
    { x: 460, y: 850, w: 70, h: 50 },
    { x: 1200, y: 780, w: 50, h: 90 },
  ],
  treeZones: [
    { x: 120, y: 90, w: 80, h: 1030, density: 0.55 },
    { x: 120, y: 90, w: 1360, h: 60, density: 0.5 },
    { x: 120, y: 1080, w: 660, h: 40, density: 0.5 },
    { x: 1020, y: 1080, w: 460, h: 40, density: 0.5 },
    { x: 790, y: 140, w: 40, h: 1000, density: 0.9 },
    { x: 970, y: 140, w: 40, h: 1000, density: 0.9 },
    { x: 530, y: 470, w: 70, h: 320, density: 0.7 },
    { x: 1360, y: 300, w: 110, h: 560, density: 0.6 },
    { x: 1150, y: 800, w: 110, h: 150, density: 0.5 },
  ],
}

export function buildingById(id: string): CampusBuilding | undefined {
  return CAMPUS_LAYOUT.buildings.find((b) => b.id === id)
}
