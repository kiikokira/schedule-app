import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ESSAY_PROMPT,
  WEEKLY_ESSAY_GOAL,
  buildChatGptUrl,
  getWeekDays,
  isCorrectionPasteValid,
  countWeeklyCorrections,
  isWeeklyGoalAchieved,
  calcCorrectionRate,
  type MorningEssayRecord,
} from './morningEssay'

describe('morningEssay', () => {
  it('provides the default prompt for Benesse-style material', () => {
    expect(DEFAULT_ESSAY_PROMPT).toContain('ベネッセ')
    expect(DEFAULT_ESSAY_PROMPT).toContain('400字')
  })

  it('builds a ChatGPT URL that carries the prompt', () => {
    const url = buildChatGptUrl('hello prompt')
    expect(url).toContain('https://chatgpt.com/')
    expect(url).toContain(encodeURIComponent('hello prompt'))
  })

  it('rejects empty/short pastes as correction evidence', () => {
    expect(isCorrectionPasteValid('')).toBe(false)
    expect(isCorrectionPasteValid('   ')).toBe(false)
    expect(isCorrectionPasteValid('short')).toBe(false)
  })

  it('accepts a pasted correction of sufficient length', () => {
    expect(isCorrectionPasteValid('添削結果：とても良い英作文でした。'.repeat(3))).toBe(true)
  })

  it('counts weekly corrections Monday to Sunday', () => {
    const records: MorningEssayRecord[] = [
      { date: '2026-10-05', choice: 'essay', correctionDone: true },
      { date: '2026-10-06', choice: 'essay', correctionDone: true },
      { date: '2026-10-07', choice: 'essay', correctionDone: true },
      { date: '2026-10-08', choice: 'book', correctionDone: false },
    ]
    // 2026-10-05 is Monday
    expect(countWeeklyCorrections(records, '2026-10-07')).toBe(3)
    expect(countWeeklyCorrections(records, '2026-10-11')).toBe(3)
    // next week resets
    expect(countWeeklyCorrections(records, '2026-10-12')).toBe(0)
  })

  it('achieves the weekly goal at 3 corrections', () => {
    expect(WEEKLY_ESSAY_GOAL).toBe(3)
    const records: MorningEssayRecord[] = [
      { date: '2026-10-05', choice: 'essay', correctionDone: true },
      { date: '2026-10-06', choice: 'essay', correctionDone: true },
    ]
    expect(isWeeklyGoalAchieved(records, '2026-10-07')).toBe(false)
    const done: MorningEssayRecord[] = [
      ...records,
      { date: '2026-10-07', choice: 'essay', correctionDone: true },
    ]
    expect(isWeeklyGoalAchieved(done, '2026-10-07')).toBe(true)
  })

  it('calculates the correction rate among essay-chosen days', () => {
    const records: MorningEssayRecord[] = [
      { date: '2026-10-05', choice: 'essay', correctionDone: true },
      { date: '2026-10-06', choice: 'essay', correctionDone: false },
      { date: '2026-10-07', choice: 'book', correctionDone: false },
    ]
    const rate = calcCorrectionRate(records, '2026-10-07')
    expect(rate.chosen).toBe(2)
    expect(rate.done).toBe(1)
    expect(rate.rate).toBe(50)
  })

  it('returns Monday-to-Sunday dates for the week', () => {
    // 2026-10-10 is Saturday; week is Mon 2026-10-05 to Sun 2026-10-11
    expect(getWeekDays('2026-10-10')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
  })

  it('judges the goal against a custom target', () => {
    const records: MorningEssayRecord[] = [
      { date: '2026-10-05', choice: 'essay', correctionDone: true },
      { date: '2026-10-06', choice: 'essay', correctionDone: true },
    ]
    expect(isWeeklyGoalAchieved(records, '2026-10-07', 2)).toBe(true)
    expect(isWeeklyGoalAchieved(records, '2026-10-07', 5)).toBe(false)
  })
})
