import { describe, it, expect } from 'vitest'
import { CLIP_FOR } from './RpgWorld3d'
import type { MoveState } from '../lib/rpgMovement'

// public/rpg/player_character.glb に実在するアニメーション名（GLBバイナリ監査済み）。
// モデル差し替え時はここも更新すること。CLIP_FORの参照先が欠けると待機姿勢のままになる。
const GLB_CLIPS = [
  'ClimbDown', 'ClimbUp', 'EnterBuilding', 'EnterCave', 'EnterStage',
  'ExitBuilding', 'ExitCave', 'Fall', 'Idle', 'JumpLand', 'JumpLoop',
  'JumpStart', 'ReturnStage', 'Run', 'SlopeDown', 'SlopeUp', 'StairsDown',
  'StairsUp', 'Swim', 'SwimEnter', 'SwimExit', 'TurnL', 'TurnR', 'Walk',
]

const ALL_STATES: MoveState[] = [
  'IDLE', 'WALK', 'RUN', 'TURN', 'JUMP_PREPARE', 'JUMP_ASCEND', 'JUMP_AIR',
  'JUMP_DESCEND', 'LAND', 'LADDER_UP', 'LADDER_DOWN', 'SLOPE_UP', 'SLOPE_DOWN',
  'STAIRS_UP', 'STAIRS_DOWN', 'FALL', 'SWIM_ENTER', 'SWIM', 'SWIM_EXIT',
  'ENTER_BUILDING', 'EXIT_BUILDING', 'ENTER_CAVE', 'EXIT_CAVE',
  'ENTER_STAGE', 'RETURN_STAGE', 'EVENT',
]

describe('RpgWorld3d CLIP_FOR coverage', () => {
  it('maps every MoveState to a clip that exists in player_character.glb', () => {
    for (const s of ALL_STATES) {
      expect(CLIP_FOR[s], `missing mapping for ${s}`).toBeDefined()
      expect(GLB_CLIPS, `clip ${CLIP_FOR[s]} for ${s} not in GLB`).toContain(CLIP_FOR[s])
    }
  })
})
