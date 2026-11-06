import { describe, it, expect } from 'vitest'
import {
  W1_STAGE_ORDER,
  normalizeW1Cleared,
  w1NextStage,
  w1StageStatus,
  w1CanEnter,
  w1IsComplete,
  w1AllowedNodeIds,
} from './rpgW1Stages'

describe('rpgW1Stages strict order', () => {
  it('initial: only stage-1 is next', () => {
    expect(w1NextStage([])).toBe('w1-stage-1')
    expect(w1StageStatus('w1-stage-1', [])).toBe('next')
    expect(w1StageStatus('w1-stage-2', [])).toBe('locked')
    expect(w1StageStatus('w1-stage-8', [])).toBe('locked')
  })

  it('clears turn blue one by one', () => {
    let cleared: string[] = []
    for (let i = 0; i < W1_STAGE_ORDER.length; i++) {
      const next = w1NextStage(cleared)!
      expect(w1StageStatus(next, cleared)).toBe('next')
      cleared = [...cleared, next]
      expect(w1StageStatus(next, cleared)).toBe('cleared')
    }
    expect(w1NextStage(cleared)).toBeNull()
    expect(w1IsComplete(cleared)).toBe(true)
  })

  it('never skips: stage-3 locked after stage-1', () => {
    const cleared = ['w1-stage-1']
    expect(w1NextStage(cleared)).toBe('w1-stage-2')
    expect(w1CanEnter('w1-stage-2', cleared)).toBe(true)
    expect(w1CanEnter('w1-stage-3', cleared)).toBe(false)
    expect(w1CanEnter('w1-stage-8', cleared)).toBe(false)
  })

  it('cleared stages stay enterable', () => {
    const cleared = ['w1-stage-1', 'w1-stage-2']
    expect(w1CanEnter('w1-stage-1', cleared)).toBe(true)
    expect(w1CanEnter('w1-stage-2', cleared)).toBe(true)
  })

  it('migrates legacy grass stages to new order', () => {
    expect(normalizeW1Cleared(['grass-stage-1'])).toEqual(['w1-stage-1', 'w1-stage-2', 'w1-stage-3'])
    expect(w1NextStage(['grass-stage-1'])).toBe('w1-stage-4')
    expect(normalizeW1Cleared(['grass-stage-3'])).toHaveLength(6)
  })

  it('allowed nodes include next red but exclude locked stages', () => {
    const allowed = w1AllowedNodeIds(['w1-stage-1'])
    expect(allowed.has('n4')).toBe(true) // next s2 node
    expect(allowed.has('n8')).toBe(false) // locked s5
    expect(allowed.has('n11')).toBe(false) // locked final
  })
})
