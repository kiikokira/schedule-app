import { describe, it, expect } from 'vitest'
import {
  formatMin,
  REMINDER_LEAD_MIN,
  slotStartTitle,
  slotStartMessage,
  buildSlotsPayload,
  dueSlotStarts,
  msUntilNextReminder,
  nextReminderSlot,
  reminderTimeMin,
  type SlotInfo,
} from './slotNotify'

describe('formatMin', () => {
  it('formats minutes since midnight as HH:MM', () => {
    expect(formatMin(0)).toBe('00:00')
    expect(formatMin(9 * 60 + 5)).toBe('09:05')
    expect(formatMin(21 * 60 + 45)).toBe('21:45')
  })
})

describe('slotStartTitle', () => {
  it('builds a dedupeable title from the slot start', () => {
    expect(slotStartTitle('21:00')).toBe('学習開始10分前 21:00')
    expect(REMINDER_LEAD_MIN).toBe(10)
  })
})

describe('slotStartMessage', () => {
  it('includes the time range and book titles', () => {
    expect(
      slotStartMessage({ start: '21:00', end: '21:45', books: ['英文法ポラリス2'] }),
    ).toBe('21:00～21:45 の学習が10分後に始まります。準備しましょう（英文法ポラリス2）')
  })

  it('omits the parenthesis when no book is planned', () => {
    expect(slotStartMessage({ start: '21:00', end: '21:45', books: [] })).toBe(
      '21:00～21:45 の学習が10分後に始まります。準備しましょう',
    )
  })
})

describe('reminderTimeMin', () => {
  it('is 10 minutes before the slot start', () => {
    expect(reminderTimeMin({ start: '21:00' })).toBe(21 * 60 - 10)
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

describe('dueSlotStarts', () => {
  const payload = {
    date: '2026-09-21',
    savedAt: '2026-09-21T00:00:00.000Z',
    slots: [
      { start: '15:55', end: '16:50', books: [] },
      { start: '21:00', end: '21:45', books: [] },
    ] as SlotInfo[],
  }

  it('returns slots whose start is coming up within the window', () => {
    // 15:55開始の10分前=15:45ちょうど
    expect(dueSlotStarts(payload, '2026-09-21', 15 * 60 + 45)).toHaveLength(1)
    expect(dueSlotStarts(payload, '2026-09-21', 15 * 60 + 45)[0].start).toBe('15:55')
  })

  it('returns nothing long before the start or outside the window', () => {
    expect(dueSlotStarts(payload, '2026-09-21', 15 * 60 + 20)).toHaveLength(0)
    expect(dueSlotStarts(payload, '2026-09-21', 16 * 60 + 10)).toHaveLength(0)
  })

  it('returns nothing when the payload is for another date', () => {
    expect(dueSlotStarts(payload, '2026-09-22', 15 * 60 + 45)).toHaveLength(0)
  })
})

describe('msUntilNextReminder', () => {
  const at = (h: number, m: number) => new Date(2026, 8, 21, h, m, 0, 0)

  it('returns the ms until 10 minutes before the next slot start', () => {
    const slots: SlotInfo[] = [
      { start: '17:00', end: '17:30', books: [] },
      { start: '21:45', end: '22:00', books: [] },
    ]
    // 17:00開始→通知16:50。16:49時点であと60秒
    expect(msUntilNextReminder(slots, at(16, 49))).toBe(60_000)
  })

  it('returns null when no reminders remain today', () => {
    const slots: SlotInfo[] = [{ start: '17:00', end: '17:30', books: [] }]
    expect(msUntilNextReminder(slots, at(16, 50))).toBeNull()
    expect(msUntilNextReminder([], at(10, 0))).toBeNull()
  })
})

describe('nextReminderSlot', () => {
  const slots: SlotInfo[] = [
    { start: '15:55', end: '16:50', books: ['英文法ポラリス2'] },
    { start: '21:00', end: '21:45', books: [] },
  ]
  const at = (h: number, m: number) => new Date(2026, 8, 21, h, m, 0, 0)

  it('returns the slot whose reminder comes next', () => {
    // 15:55開始→通知15:45。16:00時点では21:00開始分（通知20:50）が次
    expect(nextReminderSlot(slots, at(16, 0))?.start).toBe('21:00')
    expect(nextReminderSlot(slots, at(15, 0))?.start).toBe('15:55')
  })

  it('returns null when no reminders remain today', () => {
    expect(nextReminderSlot(slots, at(20, 50))).toBeNull()
    expect(nextReminderSlot([], at(10, 0))).toBeNull()
  })
})
