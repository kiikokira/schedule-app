import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadMorningEssayRecords,
  saveMorningEssayRecords,
  saveMorningEssayRecord,
  getMorningEssayRecord,
} from './morningEssayStore'

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
})
