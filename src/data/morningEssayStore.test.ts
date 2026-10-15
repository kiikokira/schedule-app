import { describe, it, expect, beforeEach } from 'vitest'
import * as store from './morningEssayStore'

const {
  deleteMorningEssayRecord,
  loadMorningEssayGoal,
  loadMorningEssayRecords,
  saveMorningEssayGoal,
  saveMorningEssayRecords,
  saveMorningEssayRecord,
  getMorningEssayRecord,
} = store

beforeEach(() => {
  localStorage.clear()
})

describe('morningEssayStore', () => {
  it('returns empty when nothing is saved', () => {
    expect(loadMorningEssayRecords()).toEqual([])
  })

  it('upserts a record by date', () => {
    saveMorningEssayRecord({ date: '2026-10-10', choice: 'essay', correctionDone: false })
    saveMorningEssayRecord({ date: '2026-10-10', choice: 'essay', correctionDone: true, correctionText: '添削'.repeat(20) })
    const all = loadMorningEssayRecords()
    expect(all).toHaveLength(1)
    expect(getMorningEssayRecord('2026-10-10')?.correctionDone).toBe(true)
  })

  it('keeps records for different dates', () => {
    saveMorningEssayRecords([
      { date: '2026-10-10', choice: 'essay', correctionDone: true },
      { date: '2026-10-11', choice: 'book', correctionDone: false },
    ])
    expect(loadMorningEssayRecords()).toHaveLength(2)
    expect(getMorningEssayRecord('2026-10-11')?.choice).toBe('book')
  })

  it('defaults the weekly goal to 3', () => {
    expect(loadMorningEssayGoal()).toBe(3)
  })

  it('round-trips a custom weekly goal', () => {
    saveMorningEssayGoal(5)
    expect(loadMorningEssayGoal()).toBe(5)
  })

  it('rejects out-of-range goals', () => {
    saveMorningEssayGoal(0)
    expect(loadMorningEssayGoal()).toBe(3)
    saveMorningEssayGoal(8)
    expect(loadMorningEssayGoal()).toBe(3)
  })

  it('deletes a record by date', () => {
    saveMorningEssayRecords([
      { date: '2026-10-10', choice: 'essay', correctionDone: true },
      { date: '2026-10-11', choice: 'book', correctionDone: false },
    ])
    deleteMorningEssayRecord('2026-10-10')
    expect(loadMorningEssayRecords()).toHaveLength(1)
    expect(getMorningEssayRecord('2026-10-10')).toBeUndefined()
    expect(getMorningEssayRecord('2026-10-11')?.choice).toBe('book')
  })

  it('defaults the section to expanded', () => {
    expect(store.loadMorningExpanded()).toBe(true)
  })

  it('round-trips the collapsed state', () => {
    store.saveMorningExpanded(false)
    expect(store.loadMorningExpanded()).toBe(false)
    store.saveMorningExpanded(true)
    expect(store.loadMorningExpanded()).toBe(true)
  })
})
