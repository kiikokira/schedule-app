// SFCキャンパスRPGの学生スプライトとホットスポットマーカー。
// DOM非依存。CanvasRenderingContext2D のみを受け取り、2pxグリッドで描く。

export type Direction = 'down' | 'left' | 'right' | 'up'

const NAVY = '#1e2a5a'
const YELLOW = '#eab308'
const WHITE = '#f8fafc'
const SKIN = '#f2c9a0'
const HAIR = '#3b2a20'
const BACKPACK = '#7c3f2a'
const SHADOW = 'rgba(0,0,0,0.28)'
const TAU = Math.PI * 2

type Ctx = CanvasRenderingContext2D

/**
 * 24x32の学生を描く。足元が (x, y)。
 * 4方向 x 2フレーム。frame===1 && moving のとき脚を1pxずらす。
 */
export function drawStudent(
  ctx: Ctx,
  x: number,
  y: number,
  dir: Direction,
  frame: 0 | 1,
  moving: boolean,
): void {
  const ox = x - 12
  const oy = y - 32
  const step = moving && frame === 1 ? 1 : 0
  const back = dir === 'up'
  const left = dir === 'left'
  const right = dir === 'right'

  // cell 単位 = 2px。dx は歩行の1pxオフセット用。
  const px = (cx: number, cy: number, w: number, h: number, color: string, dx = 0): void => {
    ctx.fillStyle = color
    ctx.fillRect(ox + cx * 2 + dx, oy + cy * 2, w * 2, h * 2)
  }

  ctx.save()

  // 影: (x-8, y-2, 16, 4) の楕円を2段のfillRectで近似
  px(3, 15, 6, 1, SHADOW)
  px(2, 16, 8, 1, SHADOW)

  // 脚と靴（歩行フレームで前後の脚を1pxずつずらす）
  px(4, 12, 2, 2, NAVY, -step)
  px(6, 12, 2, 2, NAVY, step)
  px(4, 14, 2, 1, HAIR, -step)
  px(6, 14, 2, 1, HAIR, step)

  // ブレザー・白シャツ・黄マフラー
  px(3, 7, 6, 5, NAVY)
  if (!back) {
    px(5, 7, 2, 4, WHITE)
    px(4, 6, 4, 1, YELLOW)
    px(5, 7, 2, 1, YELLOW)
    // 横を向くとマフラーの裾が後ろに流れる
    if (left) px(8, 7, 1, 2, YELLOW)
    if (right) px(3, 7, 1, 2, YELLOW)
  }

  // 腕と手（向きで前後に出る腕を入れ替える）
  if (left || right) {
    const front = left ? 2 : 9
    const rear = left ? 9 : 2
    px(front, 7, 1, 4, NAVY, left ? -step : step)
    px(rear, 9, 1, 3, NAVY)
    px(front, 11, 1, 1, SKIN, left ? -step : step)
    px(rear, 12, 1, 1, SKIN)
  } else {
    px(2, 8, 1, 3, NAVY)
    px(9, 8, 1, 3, NAVY)
    px(2, 11, 1, 1, SKIN)
    px(9, 11, 1, 1, SKIN)
  }

  // 頭（肌と髪）
  px(4, 2, 4, 4, SKIN)
  if (back) {
    // 背面は髪で頭を覆い、顔は描かない
    px(4, 1, 4, 5, HAIR)
    px(3, 2, 1, 3, HAIR)
    px(8, 2, 1, 3, HAIR)
  } else if (left) {
    px(5, 1, 3, 2, HAIR)
    px(8, 2, 1, 3, HAIR)
    px(4, 3, 1, 1, HAIR)
    px(4, 4, 1, 1, HAIR) // 横顔の目
  } else if (right) {
    px(4, 1, 3, 2, HAIR)
    px(3, 2, 1, 3, HAIR)
    px(7, 3, 1, 1, HAIR)
    px(7, 4, 1, 1, HAIR) // 横顔の目
  } else {
    px(4, 1, 4, 2, HAIR)
    px(3, 2, 1, 2, HAIR)
    px(8, 2, 1, 2, HAIR)
    px(5, 3, 1, 1, HAIR)
    px(4, 4, 1, 1, HAIR)
    px(7, 4, 1, 1, HAIR)
  }

  // リュックは背面（up）でのみ見える
  if (back) {
    px(4, 6, 4, 1, BACKPACK)
    px(3, 7, 6, 5, BACKPACK)
    px(4, 8, 4, 1, NAVY)
    px(4, 11, 4, 1, NAVY)
  }

  ctx.restore()
}

/**
 * ホットスポットのマーカー。金の丸に紺の縁、中央に ! または i。
 * active なら半径を1px大きくし、t で上下に1px揺らす。
 */
export function drawHotspotMarker(
  ctx: Ctx,
  x: number,
  y: number,
  active: boolean,
  t: number,
): void {
  ctx.save()
  const radius = active ? 9 : 8
  const bob = Math.round(Math.sin(t * TAU))
  const cy = y + bob

  ctx.fillStyle = NAVY
  ctx.beginPath()
  ctx.arc(x, cy, radius + 2, 0, TAU)
  ctx.fill()

  ctx.fillStyle = YELLOW
  ctx.beginPath()
  ctx.arc(x, cy, radius, 0, TAU)
  ctx.fill()

  ctx.fillStyle = NAVY
  ctx.font = 'bold 9px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(active ? '!' : 'i', x, cy)

  ctx.restore()
}
