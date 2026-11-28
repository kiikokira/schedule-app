// マップ上で指を置いた位置を基準にした移動スティックの計算。DOM非依存。
export type Point = { x: number; y: number }

export const STICK_MAX_PX = 40
export const TAP_MAX_PX = 10
export const TAP_MAX_MS = 250

export function stickVector(
  anchor: Point,
  pointer: Point,
  maxPx: number = STICK_MAX_PX,
): { dx: number; dy: number } {
  const vx = pointer.x - anchor.x
  const vy = pointer.y - anchor.y
  const dist = Math.hypot(vx, vy)
  if (dist <= 0 || maxPx <= 0) return { dx: 0, dy: 0 }
  const scale = Math.min(1, dist / maxPx) / dist
  return { dx: vx * scale, dy: vy * scale }
}

export function isTap(movedPx: number, elapsedMs: number): boolean {
  return movedPx < TAP_MAX_PX && elapsedMs < TAP_MAX_MS
}
