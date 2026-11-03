import { describe, it, expect } from 'vitest'
import { GRASS_PATHS, grassPathLength, positionAlongGrassPath } from './rpgGrassWorld'
import { advanceAlongPath, pathKindToAnim, pathKindToAnimDirected, canCancelState, type MoveState } from './rpgMovement'

describe('rpgMovement', () => {
  it('advances with deltaTime and clamps at the end', () => {
    const p = GRASS_PATHS[0]
    const len = grassPathLength(p)
    const mid = advanceAlongPath(0, p.moveSpeed, 0.5, len)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(len)
    const end = advanceAlongPath(len - 1, 1000, 1, len)
    expect(end).toBe(len)
  })

  it('maps path kinds to animation states', () => {
    expect(pathKindToAnim('walk')).toBe('WALK')
    expect(pathKindToAnim('ladder_up')).toBe('LADDER_UP')
    expect(pathKindToAnim('jump')).toBe('JUMP_ASCEND')
    expect(pathKindToAnim('swim')).toBe('SWIM')
    expect(pathKindToAnim('enter_building')).toBe('ENTER_BUILDING')
  })

  it('never lets jump poses pass the landing node', () => {
    const jump = GRASS_PATHS.find((p) => p.kind === 'jump')!
    const pose = positionAlongGrassPath(jump, grassPathLength(jump) + 500)
    expect(pose.t).toBe(1)
  })

  it('locks input during jump and landing', () => {
    const locked: MoveState[] = ['JUMP_ASCEND', 'JUMP_AIR', 'JUMP_DESCEND', 'LAND', 'ENTER_STAGE']
    for (const s of locked) expect(canCancelState(s)).toBe(false)
    expect(canCancelState('WALK')).toBe(true)
    expect(canCancelState('IDLE')).toBe(true)
  })

  it('uses descending anims when a path is traversed backwards', () => {
    expect(pathKindToAnimDirected('ladder_up', true)).toBe('LADDER_DOWN')
    expect(pathKindToAnimDirected('ladder_up', false)).toBe('LADDER_UP')
    expect(pathKindToAnimDirected('slope_up', true)).toBe('SLOPE_DOWN')
    expect(pathKindToAnimDirected('stairs_up', true)).toBe('STAIRS_DOWN')
  })
})
