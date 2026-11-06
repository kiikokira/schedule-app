import { describe, it, expect, beforeEach } from 'vitest'
import { migrateV1toV2, loadRpgProgressV2, saveRpgProgressV2, RPG_PROGRESS_V2_KEY, RPG_PROGRESS_V2_BACKUP_KEY } from './rpgProgressV2'
import { DEFAULT_RPG_PROGRESS, RPG_PROGRESS_KEY } from './rpgProgress'

beforeEach(() => {
  localStorage.clear()
})
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
  it('v2-hit returns stored v2 without touching v1', () => {
    const stored = { ...DEFAULT_RPG_PROGRESS, clearedStageIds: ['w1-stage-1', 'w1-stage-2'], lastKnownNodeId: { '3d-1': 'n4' } }
    localStorage.setItem(RPG_PROGRESS_V2_KEY, JSON.stringify(stored))
    localStorage.setItem(RPG_PROGRESS_KEY, JSON.stringify({ ...DEFAULT_RPG_PROGRESS, clearedStageIds: [] }))
    const v2 = loadRpgProgressV2()
    expect(v2.clearedStageIds).toEqual(['w1-stage-1', 'w1-stage-2'])
    expect(v2.lastKnownNodeId['3d-1']).toBe('n4')
  })
  it('v1-absorb migrates and persists to v2', () => {
    const v1 = { ...DEFAULT_RPG_PROGRESS, clearedStageIds: ['w1-stage-1'], lastKnownNodeId: { '3d-1': 'n5b' } }
    localStorage.setItem(RPG_PROGRESS_KEY, JSON.stringify(v1))
    const v2 = loadRpgProgressV2()
    expect(v2.clearedStageIds).toContain('w1-stage-1')
    expect(v2.lastKnownNodeId['3d-1']).toBe('n0')
    const persisted = JSON.parse(localStorage.getItem(RPG_PROGRESS_V2_KEY) ?? 'null')
    expect(persisted).not.toBeNull()
    expect(persisted.clearedStageIds).toContain('w1-stage-1')
  })
  it('defaults when no keys present', () => {
    const v2 = loadRpgProgressV2()
    expect(v2.clearedStageIds).toEqual([])
    expect(v2.lastKnownNodeId['3d-1']).toBe('n0')
    expect(v2.currentWorldId).toBe(1)
  })
  it('saveRpgProgressV2 round-trips through v2 key', () => {    const s = { ...DEFAULT_RPG_PROGRESS, clearedStageIds: ['w1-stage-1'], lastKnownNodeId: { '3d-1': 'n6' } }
    saveRpgProgressV2(s)
    const v2 = loadRpgProgressV2()
    expect(v2.clearedStageIds).toContain('w1-stage-1')
    expect(v2.lastKnownNodeId['3d-1']).toBe('n6')
  })
  it('corrupt v2 payload is backed up before returning defaults (V1 parity)', () => {
    localStorage.setItem(RPG_PROGRESS_V2_KEY, '{broken-json')
    const v2 = loadRpgProgressV2()
    expect(v2.clearedStageIds).toEqual([])
    expect(v2.lastKnownNodeId['3d-1']).toBe('n0')
    expect(localStorage.getItem(RPG_PROGRESS_V2_BACKUP_KEY)).toBe('{broken-json')
  })
  it('garbage v2 falls back to validated defaults', () => {
    localStorage.setItem(
      RPG_PROGRESS_V2_KEY,
      JSON.stringify({
        currentWorldId: NaN,
        clearedStageIds: ['w1-stage-1', 42, null],
        visitedWorldIds: [1, 'x', NaN],
        lastKnownNodeId: { '3d-1': 99, '3d-2': 'n3' },
      }),
    )
    const v2 = loadRpgProgressV2()
    expect(v2.currentWorldId).toBe(1)
    expect(v2.clearedStageIds).toEqual(['w1-stage-1'])
    expect(v2.visitedWorldIds).toEqual([1])
    expect(v2.lastKnownNodeId['3d-1']).toBe('n0')
    expect(v2.lastKnownNodeId['3d-2']).toBe('n3')
  })
})
