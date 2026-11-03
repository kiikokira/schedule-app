import type { GrassPathKind } from './rpgGrassWorld'

export type MoveState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'TURN'
  | 'JUMP_PREPARE'
  | 'JUMP_ASCEND'
  | 'JUMP_AIR'
  | 'JUMP_DESCEND'
  | 'LAND'
  | 'LADDER_UP'
  | 'LADDER_DOWN'
  | 'SLOPE_UP'
  | 'SLOPE_DOWN'
  | 'STAIRS_UP'
  | 'STAIRS_DOWN'
  | 'FALL'
  | 'SWIM_ENTER'
  | 'SWIM'
  | 'SWIM_EXIT'
  | 'ENTER_BUILDING'
  | 'EXIT_BUILDING'
  | 'ENTER_CAVE'
  | 'EXIT_CAVE'
  | 'ENTER_STAGE'
  | 'RETURN_STAGE'
  | 'EVENT'

export function advanceAlongPath(dist: number, speed: number, deltaSec: number, length: number): number {
  const dt = Math.min(0.1, Math.max(0, deltaSec))
  const next = dist + Math.max(0, speed) * dt
  return Math.min(length, next)
}

export function pathKindToAnim(kind: GrassPathKind): MoveState {
  switch (kind) {
    case 'run':
      return 'RUN'
    case 'jump':
      return 'JUMP_ASCEND'
    case 'ladder_up':
      return 'LADDER_UP'
    case 'ladder_down':
      return 'LADDER_DOWN'
    case 'slope_up':
      return 'SLOPE_UP'
    case 'slope_down':
      return 'SLOPE_DOWN'
    case 'stairs_up':
      return 'STAIRS_UP'
    case 'stairs_down':
      return 'STAIRS_DOWN'
    case 'fall':
      return 'FALL'
    case 'swim':
      return 'SWIM'
    case 'enter_building':
      return 'ENTER_BUILDING'
    case 'exit_building':
      return 'EXIT_BUILDING'
    case 'bridge':
      return 'WALK'
    default:
      return 'WALK'
  }
}

const LOCKED: Set<MoveState> = new Set([  'JUMP_PREPARE',
  'JUMP_ASCEND',
  'JUMP_AIR',
  'JUMP_DESCEND',
  'LAND',
  'FALL',
  'ENTER_STAGE',
  'ENTER_CAVE',
  'EXIT_CAVE',
  'RETURN_STAGE',
  'EVENT',
])

export function canCancelState(state: MoveState): boolean {
  return !LOCKED.has(state)
}

// 逆向きに進む場合は下り・戻りのアニメにする（はしご・坂・階段・建物）。
export function pathKindToAnimDirected(kind: GrassPathKind, reversed: boolean): MoveState {
  if (!reversed) return pathKindToAnim(kind)
  switch (kind) {
    case 'ladder_up':
      return 'LADDER_DOWN'
    case 'slope_up':
      return 'SLOPE_DOWN'
    case 'stairs_up':
      return 'STAIRS_DOWN'
    case 'enter_building':
      return 'EXIT_BUILDING'
    default:
      return pathKindToAnim(kind)
  }
}
