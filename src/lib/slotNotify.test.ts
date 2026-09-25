import { describe, it, expect } from 'vitest'
import {
  formatMin,
  slotEndTitle,
  slotEndMessage,
  buildSlotsPayload,
  dueSlotEnds,
  msUntilNextSlotEnd,
  nextEndingSlot,
  type SlotInfo,
} from './slotNotify'

describe('formatMin', () => {
  it('formats minutes since midnight as HH:MM', () => {
    expect(formatMin(0)).toBe('00:00')
    expect(formatMin(9 * 60 + 5)).toBe('09:05')
    expect(formatMin(21 * 60 + 45)).toBe('21:45')
  })
})

describe('slotEndTitle', () => {
  it('builds a dedupeable title from the slot end', () => {
    expect(slotEndTitle('21:45')).toBe('学習時間終了 21:45')
  })
})

describe('slotEndMessage', () => {
  it('includes the time range and book titles', () => {
    expect(
      slotEndMessage({ start: '21:00', end: '21:45', books: ['英文法ポラリス2'] }),
    ).toBe('21:00～21:45 の空き時間が終わりました。今日の学習を記録しましたか？（英文法ポラリス2）')
  })

  it('omits the parenthesis when no book is planned', () => {
    expect(slotEndMessage({ start: '21:00', end: '21:45', books: [] })).toBe(
      '21:00～21:45 の空き時間が終わりました。今日の学習を記録しましたか？',
    )
  })
})

describe('buildSlotsPayload', () => {
  const books = [
    {
      id: 'b1',
      title: '英文法ポラリス2',
      totalPages: 100,
      startDate: '2026-09-01',
      deadline: '2026-11-30',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ] as any[]

  it('maps each availability slot to its end and planned book titles', () => {
    const payload = buildSlotsPayload(
      '2026-09-21',
      [{ startMin: 15 * 60 + 55, endMin: 16 * 60 + 50 }],
      [{ startMin: 15 * 60 + 55, endMin: 16 * 60 + 50, bookId: 'b1', pages: 20 }],
      books as any,
    )
    expect(payload.date).toBe('2026-09-21')
    expect(payload.slots).toEqual([
      { start: '15:55', end: '16:50', books: ['英文法ポラリス2'] },
    ])
    expect(typeof payload.savedAt).toBe('string')
  })

  it('keeps slots with no planned books as empty book lists', () => {
    const payload = buildSlotsPayload(
      '2026-09-21',
      [{ startMin: 21 * 60, endMin: 21 * 60 + 45 }],
      [],
      [],
    )
    expect(payload.slots).toEqual([{ start: '21:00', end: '21:45', books: [] }])
  })

  it('sorts slots by start time', () => {
    const payload = buildSlotsPayload(
      '2026-09-21',
      [
        { startMin: 21 * 60, endMin: 21 * 60 + 45 },
        { startMin: 15 * 60 + 55, endMin: 16 * 60 + 50 },
      ],
      [],
      [],
    )
    expect(payload.slots.map((s) => s.start)).toEqual(['15:55', '21:00'])
  })
})

describe('dueSlotEnds', () => {
  const payload = {
    date: '2026-09-21',
    savedAt: '2026-09-21T00:00:00.000Z',
    slots: [
      { start: '15:55', end: '16:50', books: [] },
      { start: '21:00', end: '21:45', books: [] },
    ] as SlotInfo[],
  }

  it('returns slots whose end just passed within the window', () => {
    expect(dueSlotEnds(payload, '2026-09-21', 16 * 60 + 55)).toHaveLength(1)
    expect(dueSlotEnds(payload, '2026-09-21', 16 * 60 + 55)[0].end).toBe('16:50')
  })

  it('returns nothing for future ends or ends outside the window', () => {
    expect(dueSlotEnds(payload, '2026-09-21', 16 * 60 + 49)).toHaveLength(0)
    expect(dueSlotEnds(payload, '2026-09-21', 17 * 60 + 10)).toHaveLength(0)
  })

  it('returns nothing when the payload is for another date', () => {
    expect(dueSlotEnds(payload, '2026-09-22', 16 * 60 + 55)).toHaveLength(0)
  })
})

describe('msUntilNextSlotEnd', () => {
  const at = (h: number, m: number) => new Date(2026, 8, 21, h, m, 0, 0)

  it('returns the ms until the next slot end', () => {
    expect(msUntilNextSlotEnd([16 * 60 + 50, 21 * 60 + 45], at(16, 49))).toBe(60_000)
  })

  it('returns null when no slot ends remain today', () => {
    expect(msUntilNextSlotEnd([16 * 60 + 50], at(16, 50))).toBeNull()
    expect(msUntilNextSlotEnd([], at(10, 0))).toBeNull()
  })
})

describe('nextEndingSlot', () => {
  const slots: SlotInfo[] = [
    { start: '15:55', end: '16:50', books: ['英文法ポラリス2'] },
    { start: '21:00', end: '21:45', books: [] },
  ]
  const at = (h: number, m: number) => new Date(2026, 8, 21, h, m, 0, 0)

  it('returns the next ending slot', () => {
    expect(nextEndingSlot(slots, at(16, 0))?.end).toBe('16:50')
    expect(nextEndingSlot(slots, at(17, 0))?.end).toBe('21:45')
  })

  it('returns null when nothing ends later today', () => {
    expect(nextEndingSlot(slots, at(21, 45))).toBeNull()
    expect(nextEndingSlot([], at(10, 0))).toBeNull()
  })
})
