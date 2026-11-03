import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_RPG_PROGRESS,
  loadRpgProgress,
  saveRpgProgress,
  markWorldVisited,
  clearRpgStage,
  RPG_PROGRESS_KEY,
} from './rpgProgress'

beforeEach(() => {
  localStorage.clear()
})

describe('rpgProgress', () => {
  it('returns defaults when nothing is saved', () => {
    expect(loadRpgProgress()).toEqual(DEFAULT_RPG_PROGRESS)
  })

  it('round-trips save and load', () => {
    const next = markWorldVisited(loadRpgProgress(), 1)
    saveRpgProgress(next)
    const loaded = loadRpgProgress()
    expect(loaded.visitedWorldIds).toContain(1)
    expect(loaded.currentWorldId).toBe(1)
  })

  it('clears a stage and unlocks its configured next paths', () => {
    const cleared = clearRpgStage(loadRpgProgress(), 'grass-stage-1', ['g-p5', 'g-p6'])
    expect(cleared.clearedStageIds).toContain('grass-stage-1')
    expect(cleared.unlockedPathIds).toEqual(expect.arrayContaining(['g-p5', 'g-p6']))
  })

  it('migrates corrupt data to safe defaults without throwing', () => {
    localStorage.setItem(RPG_PROGRESS_KEY, '{broken-json')
    expect(() => loadRpgProgress()).not.toThrow()
    expect(loadRpgProgress().schemaVersion).toBe(1)
  })

  it('ignores unknown future fields but keeps known progress', () => {
    localStorage.setItem(
      RPG_PROGRESS_KEY,
      JSON.stringify({ ...DEFAULT_RPG_PROGRESS, currentWorldId: 1, visitedWorldIds: [1], futureField: { x: 1 } }),
    )
    const loaded = loadRpgProgress()
    expect(loaded.currentWorldId).toBe(1)
    expect(loaded.visitedWorldIds).toContain(1)
  })
})
