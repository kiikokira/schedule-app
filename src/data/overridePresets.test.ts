import { describe, it, expect, beforeEach } from 'vitest'
import { loadOverridePresets, saveOverridePresets } from './overridePresets'

beforeEach(() => {
  localStorage.clear()
})

describe('overridePresets', () => {
  it('saves and loads presets with a name and rows', () => {
    saveOverridePresets([
      {
        id: 'p1',
        name: '休日午前',
        rows: [
          { start: '09:00', end: '10:00', bookId: 'b1' },
          { start: '10:15', end: '11:00', onTrain: true },
        ],
      },
    ])
    expect(loadOverridePresets()).toEqual([
      {
        id: 'p1',
        name: '休日午前',
        rows: [
          { start: '09:00', end: '10:00', bookId: 'b1' },
          { start: '10:15', end: '11:00', onTrain: true },
        ],
      },
    ])
  })

  it('returns empty when nothing is stored', () => {
    expect(loadOverridePresets()).toEqual([])
  })

  it('drops invalid entries and keeps valid ones', () => {
    localStorage.setItem(
      'schedule-app-override-presets',
      JSON.stringify([
        { id: 'p1', name: 'ok', rows: [{ start: '09:00', end: '10:00' }] },
        { id: 'p2', name: 123, rows: [] },
        { id: 'p3' },
        'junk',
      ]),
    )
    expect(loadOverridePresets()).toEqual([
      { id: 'p1', name: 'ok', rows: [{ start: '09:00', end: '10:00' }] },
    ])
  })
})
