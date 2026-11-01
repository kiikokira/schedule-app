// src/lib/velocity.test.ts
import { describe, it, expect } from 'vitest'
import { calcVelocity, estimateCompletion } from './velocity'

describe('calcVelocity', () => {
  it('returns median pace and detects stall', () => {
    const v = calcVelocity([
      { id: 'r1', bookId: 'b1', date: '2026-10-26', pages: 10 },
      { id: 'r2', bookId: 'b1', date: '2026-10-27', pages: 20 },
      { id: 'r3', bookId: 'b1', date: '2026-10-28', pages: 30 },
    ], '2026-10-29')
    expect(v.medianPagesPerDay).toBe(20)
    expect(v.stalled).toBe(false)
    expect(['high', 'mid', 'low']).toContain(v.confidence)
  })
  it('marks stalled when 3+ days without records', () => {
    const v = calcVelocity([
      { id: 'r1', bookId: 'b1', date: '2026-10-20', pages: 5 },
    ], '2026-10-29')
    expect(v.stalled).toBe(true)
  })
})

describe('estimateCompletion', () => {
  it('marks high when predicted days fit deadline', () => {
    expect(estimateCompletion(20, 10, 5).probability).toBe('high')
    expect(estimateCompletion(100, 5, 5).probability).toBe('low')
  })
})
