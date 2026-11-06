// src/lib/rpgW1Visual.test.ts
import { describe, it, expect } from 'vitest'
import { w1VisualFor, isPathBeyondNext, W1_YELLOW_RING } from './rpgW1Visual'
describe('rpgW1Visual', () => {
  it('maps cleared/next/future correctly', () => {
    expect(w1VisualFor('w1-stage-1', ['w1-stage-1'])).toBe('cleared')
    expect(w1VisualFor('w1-stage-2', ['w1-stage-1'])).toBe('next')
    expect(w1VisualFor('w1-stage-3', ['w1-stage-1'])).toBe('future')
  })
  it('non-stage nodes are cleared (no yellow dims)', () => {
    expect(w1VisualFor(undefined, [])).toBe('cleared')
  })
  it('yellow ring constant exists', () => {
    expect(W1_YELLOW_RING).toBe('#ffd233')
  })
  it('paths beyond next are marked translucent', () => {
    expect(isPathBeyondNext('n6', 'n7', ['w1-stage-1'])).toBe(true)
    expect(isPathBeyondNext('n0', 'n1', [])).toBe(false)
  })
})
