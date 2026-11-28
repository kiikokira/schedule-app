// SFCキャンパスRPGの学生スプライトとホットスポットマーカー。
// DOM非依存。CanvasRenderingContext2D のみを受け取り、2pxグリッドで描く。

export type Direction = 'down' | 'left' | 'right' | 'up'

const NAVY = '#1e2a5a'
const YELLOW = '#eab308'
const WHITE = '#f8fafc'
const SKIN = '#f2c9a0'
const HAIR = '#3b2a20'
const SHOE = '#2a2a3a'
const SHADOW = 'rgba(0,0,0,0.28)'
const TAU = Math.PI * 2

type Ctx = CanvasRenderingContext2D

const PALETTE: Record<string, string> = {
  n: NAVY,
  w: WHITE,
  y: YELLOW,
  s: SKIN,
  h: HAIR,
  k: SHOE,
  d: SHADOW,
}

const WALK_B: readonly string[] = [
  '...nn..nn...',
  '...nn..nn...',
  '...kk..kk...',
]
const WALK_A: readonly string[] = [
  '..nn....nn..',
  '..nn....nn..',
  '..kk....kk..',
]

const DOWN_BODY: readonly string[] = [
  '............',
  '....hhhh....',
  '...hhhhhh...',
  '...hssssh...',
  '...hssssh...',
  '....ssss....',
  '..nnnyynnn..',
  '..nnnwwnnn..',
  '..nnnwwnnn..',
  '..nnnwwnnn..',
  '..snnnnnns..',
  '..snnnnnns..',
]
const UP_BODY: readonly string[] = [
  '............',
  '....hhhh....',
  '...hhhhhh...',
  '...hhhhhh...',
  '...hhhhhh...',
  '....hhhh....',
  '..nnnnnnnn..',
  '..nnnnnnnn..',
  '..nnnnnnnn..',
  '..nnnnnnnn..',
  '..snnnnnns..',
  '..snnnnnns..',
]
const LEFT_BODY: readonly string[] = [
  '............',
  '....hhhh....',
  '...hhhhhh...',
  '..ssshhhh...',
  '..sshshhh...',
  '....ssss....',
  '..nyynnnnn..',
  '..nnnwwnnn..',
  '..nnnwwnnn..',
  '..nnnwwnnn..',
  '..snnnnnns..',
  '..snnnnnns..',
]
const RIGHT_BODY: readonly string[] = [
  '............',
  '....hhhh....',
  '...hhhhhh...',
  '...hhhhsss..',
  '...hhhshss..',
  '....ssss....',
  '..nnnnnyyn..',
  '..nnnwwnnn..',
  '..nnnwwnnn..',
  '..nnnwwnnn..',
  '..snnnnnns..',
  '..snnnnnns..',
]

function makeFrame(body: readonly string[], legs: readonly string[]): readonly string[] {
  return [...body, ...legs, '..dddddddd..']
}

// 4方向 x 2フレーム。胴体は連続したシルエットで、リュックは描かない。
export const SPRITE_FRAMES: Record<Direction, readonly [readonly string[], readonly string[]]> = {
  down: [makeFrame(DOWN_BODY, WALK_B), makeFrame(DOWN_BODY, WALK_A)],
  up: [makeFrame(UP_BODY, WALK_B), makeFrame(UP_BODY, WALK_A)],
  left: [makeFrame(LEFT_BODY, WALK_B), makeFrame(LEFT_BODY, WALK_A)],
  right: [makeFrame(RIGHT_BODY, WALK_B), makeFrame(RIGHT_BODY, WALK_A)],
}

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
  const rows = SPRITE_FRAMES[dir][moving && frame === 1 ? 1 : 0]
  const ox = x - 12
  const oy = y - 32
  ctx.save()
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r]
    for (let c = 0; c < row.length; c += 1) {
      const color = PALETTE[row[c]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(ox + c * 2, oy + r * 2, 2, 2)
    }
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
