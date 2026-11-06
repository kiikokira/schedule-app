import { describe, it, expect } from 'vitest'
import { migrateV1toV2, RPG_PROGRESS_V2_KEY } from './rpgProgressV2'
import { DEFAULT_RPG_PROGRESS } from './rpgProgress'
describe('rpgProgressV2', () => {
  it('migrates v1 cleared stages and resets node to v3 start', () => {
    const v1 = { ...DEFAULT_RPG_PROGRESS, clearedStageIds: ['w1-stage-1', 'grass-stage-1'], lastKnownNodeId: { '3d-1': 'n5b' } }
    const v2 = migrateV1toV2(v1)
    expect(RPG_PROGRESS_V2_KEY).toBe('schedule-app-rpg-progress-v2')
    expect(v2.clearedStageIds).toContain('w1-stage-1')
    expect(v2.lastKnownNodeId['3d-1']).toBe('n0')
  })
  it('corrupt v1 falls back to defaults', () => {
    const v2 = migrateV1toV2(null as unknown as never)
    expect(v2.clearedStageIds).toEqual([])
  })
})
