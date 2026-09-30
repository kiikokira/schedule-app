import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadFocusPeriods,
  saveFocusPeriods,
  activeFocusPeriods,
  selectedBookIds,
  type FocusPeriod,
} from './focusPeriods'

beforeEach(() => {
  localStorage.clear()
})

const period = (over: Partial<FocusPeriod> = {}): FocusPeriod => ({
  id: 'f1',
  title: '中間テスト',
  startDate: '2026-10-01',
  endDate: '2026-10-14',
  bookIds: ['leap-1'],
  ...over,
})

describe('focusPeriods', () => {
  it('saves and loads periods', () => {
    expect(loadFocusPeriods()).toEqual([])
    saveFocusPeriods([period()])
    expect(loadFocusPeriods()).toEqual([period()])
  })

  it('ignores broken stored data', () => {
    localStorage.setItem('schedule-app-focus-periods', 'not-json')
    expect(loadFocusPeriods()).toEqual([])
  })

  it('detects active periods including the boundary dates', () => {
    const list = [period()]
    expect(activeFocusPeriods(list, '2026-10-01')).toHaveLength(1)
    expect(activeFocusPeriods(list, '2026-10-14')).toHaveLength(1)
    expect(activeFocusPeriods(list, '2026-09-30')).toHaveLength(0)
    expect(activeFocusPeriods(list, '2026-10-15')).toHaveLength(0)
  })

  it('returns null when no period is active, otherwise the union of books', () => {
    expect(selectedBookIds([period()], '2026-09-30')).toBeNull()
    expect(selectedBookIds([period()], '2026-10-05')).toEqual(['leap-1'])
    const two = [
      period({ id: 'f1', bookIds: ['leap-1'] }),
      period({ id: 'f2', startDate: '2026-10-10', endDate: '2026-10-20', bookIds: ['b1'] }),
    ]
    expect(selectedBookIds(two, '2026-10-12')).toEqual(['leap-1', 'b1'])
  })
})
