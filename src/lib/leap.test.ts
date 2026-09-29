import { describe, it, expect } from 'vitest'
import {
  LEAP_TARGET_ROUNDS,
  LEAP_TOTAL_WORDS,
  LEAP_WORD_RANGES,
  isLeapBook,
  normalizeLeapBook,
} from './leap'
import type { BookData } from './progress'

const leapCycles = (over: Partial<BookData> = {}): BookData => ({
  id: 'leap-1',
  title: '改訂版 必携 英単語 LEAP',
  catalogId: 'leap',
  totalPages: 576,
  studyMode: 'cycles',
  totalUnits: 2300,
  targetRounds: 3,
  startDate: '2026-09-26',
  deadline: '2026-10-15',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
})

describe('leap', () => {
  it('5つの範囲が1-2300を漏れなく分ける', () => {
    expect(LEAP_WORD_RANGES).toEqual([
      { from: 1, to: 400 },
      { from: 401, to: 1000 },
      { from: 1001, to: 1400 },
      { from: 1401, to: 2000 },
      { from: 2001, to: 2300 },
    ])
    expect(LEAP_TOTAL_WORDS).toBe(2300)
    expect(LEAP_TARGET_ROUNDS).toBe(3)
  })

  it('catalogIdまたはタイトルでLEAPを判定する', () => {
    expect(isLeapBook({ catalogId: 'leap' })).toBe(true)
    expect(isLeapBook({ title: '改訂版 必携 英単語 LEAP' })).toBe(true)
    expect(isLeapBook({ title: '反復本' })).toBe(false)
    expect(isLeapBook({})).toBe(false)
  })

  it('語数がずれたLEAP反復本を2300語に補正する', () => {
    const fixed = normalizeLeapBook(leapCycles({ totalUnits: 23, targetRounds: 4 }))
    expect(fixed?.totalUnits).toBe(2300)
    expect(fixed?.targetRounds).toBe(4)
  })

  it('正しいLEAP・LEAP以外・ページ式は補正しない', () => {
    expect(normalizeLeapBook(leapCycles())).toBeNull()
    expect(normalizeLeapBook(leapCycles({ title: '反復本', catalogId: undefined }))).toBeNull()
    expect(
      normalizeLeapBook(leapCycles({ studyMode: undefined, totalUnits: undefined })),
    ).toBeNull()
  })
})
