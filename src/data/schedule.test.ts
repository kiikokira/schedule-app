import { describe, it, expect } from 'vitest'
import {
  SCHEDULE,
  scheduleEntryOf,
  buildApplyResult,
  addDaysToDate,
  advanceSchedule,
  selectNowAndNext,
  type ScheduleEntry,
} from './schedule'
import { CATALOG } from './catalog'

describe('schedule', () => {
  it('contains 17 per-book entries with start and deadline dates', () => {
    expect(SCHEDULE).toHaveLength(17)
    for (const entry of SCHEDULE) {
      expect(entry.catalogId).toBeTruthy()
      expect(entry.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(entry.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(entry.startDate <= entry.deadline).toBe(true)
    }
  })

  it('all catalog ids in the schedule exist', () => {
    const ids = new Set(CATALOG.map((c) => c.id))
    for (const entry of SCHEDULE) {
      expect(ids.has(entry.catalogId)).toBe(true)
    }
  })

  it('starts 英文法ポラリス2 on 2026-09-21 and finishes by Sep 2026', () => {
    expect(scheduleEntryOf('eibunpo-polaris-2')).toEqual({
      catalogId: 'eibunpo-polaris-2',
      startDate: '2026-09-21',
      deadline: '2026-09-30',
    })
  })

  it('schedules やっておきたい700 and ハイパートレーニング3 in the final prep', () => {
    expect(scheduleEntryOf('yatteokitai-700')).toMatchObject({
      startDate: '2027-06-16',
      deadline: '2027-08-15',
    })
    expect(scheduleEntryOf('hyper-training-3')).toMatchObject({
      startDate: '2027-07-16',
      deadline: '2027-08-31',
    })
  })

  it('keeps Eiken EX until the end of Apr 2027', () => {
    expect(scheduleEntryOf('eiken-jun1-tanjukugo')).toMatchObject({
      startDate: '2026-11-01',
      deadline: '2027-04-30',
    })
  })

  it('runs SFC past papers and essays from the end of Aug until the exam', () => {
    expect(scheduleEntryOf('sfc-eigo-kakomon')).toMatchObject({
      startDate: '2027-08-31',
      deadline: '2028-02-05',
    })
    expect(scheduleEntryOf('sfc-shoronbun')).toMatchObject({
      startDate: '2027-08-31',
      deadline: '2028-02-05',
    })
  })

  it('creates new books with the scheduled start and deadline when none are registered', () => {
    const now = new Date(2026, 8, 20, 10, 0, 0)
    const { newBooks, updatedBooks } = buildApplyResult([], now)
    expect(updatedBooks).toHaveLength(0)
    expect(newBooks).toHaveLength(17)
    const polaris2 = newBooks.find((b) => b.catalogId === 'eibunpo-polaris-2')
    expect(polaris2?.startDate).toBe('2026-09-21')
    expect(polaris2?.deadline).toBe('2026-09-30')
    expect(polaris2?.coverUrl).toMatch(/^https:\/\//)
    const kakomon = newBooks.find((b) => b.catalogId === 'sfc-eigo-kakomon')
    expect(kakomon?.deadline).toBe('2028-02-05')
    expect(kakomon?.subject).toBeTruthy()
  })

  it('updates only the deadline for an already registered book matched by catalogId', () => {
    const now = new Date(2026, 8, 20, 10, 0, 0)
    const existing: Parameters<typeof buildApplyResult>[0] = [
      {
        id: 'b1',
        title: '英文法ポラリス2（応用レベル）',
        totalPages: 320,
        catalogId: 'eibunpo-polaris-2',
        startDate: '2026-06-01',
        deadline: '2026-09-01',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ]
    const { newBooks, updatedBooks } = buildApplyResult(existing, now)
    expect(newBooks).toHaveLength(16)
    expect(updatedBooks).toHaveLength(1)
    expect(updatedBooks[0].id).toBe('b1')
    expect(updatedBooks[0].deadline).toBe('2026-09-30')
    expect(updatedBooks[0].startDate).toBe('2026-06-01')
  })

  it('matches an old registered book by exact title when catalogId is missing', () => {
    const now = new Date(2026, 8, 20, 10, 0, 0)
    const existing: Parameters<typeof buildApplyResult>[0] = [
      {
        id: 'b2',
        title: 'ポレポレ英文読解プロセス50',
        totalPages: 129,
        startDate: '2026-02-11',
        deadline: '2026-08-01',
        createdAt: '2026-02-11T00:00:00.000Z',
        updatedAt: '2026-02-11T00:00:00.000Z',
      },
    ]
    const { newBooks, updatedBooks } = buildApplyResult(existing, now)
    expect(newBooks).toHaveLength(16)
    expect(updatedBooks).toHaveLength(1)
    expect(updatedBooks[0].catalogId).toBe('porepore')
    expect(updatedBooks[0].deadline).toBe('2027-07-31')
  })
})

describe('advanceSchedule', () => {
  const entries: ScheduleEntry[] = [
    { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
    { catalogId: 'nyumon-kaishaku-70', startDate: '2026-09-01', deadline: '2026-12-31' },
    { catalogId: 'the-rules-1', startDate: '2027-01-01', deadline: '2027-03-31' },
  ]

  it('pulls the start and deadline of the next book forward by the day it finished', () => {
    const today = '2026-11-10'
    const result = advanceSchedule(entries, today, 'eibunpo-polaris-2')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(entries[0])
    const next = result[1]
    expect(next.startDate).toBe(today)
    expect(next.deadline).toBe(addDaysToDate(today, 121))
    expect(result[2]).toEqual(entries[2])
  })

  it('computes the new deadline from the next book’s original duration', () => {
    const today = '2026-11-10'
    const result = advanceSchedule(entries, today, 'eibunpo-polaris-2')
    const originalDuration = 121
    expect(result[1].deadline).toBe(addDaysToDate(today, originalDuration))
  })

  it('does not change anything when the finished book is the last in the schedule', () => {
    const today = '2026-11-10'
    const result = advanceSchedule(entries, today, 'the-rules-1')
    expect(result).toEqual(entries)
  })

  it('does not change anything when the catalog id is unknown', () => {
    const today = '2026-11-10'
    const result = advanceSchedule(entries, today, 'no-such-book')
    expect(result).toEqual(entries)
  })
})

describe('selectNowAndNext', () => {
  const mini: ScheduleEntry[] = [
    { catalogId: 'a', startDate: '2026-09-01', deadline: '2026-09-30' },
    { catalogId: 'b', startDate: '2026-09-15', deadline: '2026-10-31' },
  ]

  it('picks the active book with the least buffer left as now and the next in order as next', () => {
    // 2026-09-21: a has 9 days left, b has 40 days left -> a is now, b is next
    expect(selectNowAndNext(SCHEDULE, '2026-09-21')).toEqual({
      now: expect.objectContaining({ catalogId: 'eibunpo-polaris-2' }),
      next: expect.objectContaining({ catalogId: 'nyumon-kaishaku-70' }),
    })
  })

  it('moves now to the next book once the first one is past its deadline', () => {
    // eibunpo grad 2026-09-30 で終了後、2026-10-01 は解釈編が最優先
    expect(selectNowAndNext(SCHEDULE, '2026-10-01')).toEqual({
      now: expect.objectContaining({ catalogId: 'nyumon-kaishaku-70' }),
      next: expect.objectContaining({ catalogId: 'sokudoku-eijukugo' }),
    })
  })

  it('breaks ties by schedule order', () => {
    // a と b が同時期限(残り0)ならスケジュール順で先の a
    const tied: ScheduleEntry[] = [
      { catalogId: 'b', startDate: '2026-09-01', deadline: '2026-09-30' },
      { catalogId: 'a', startDate: '2026-09-01', deadline: '2026-09-30' },
    ]
    expect(selectNowAndNext(tied, '2026-09-30').now?.catalogId).toBe('b')
  })

  it('returns no next when now is the last schedule entry', () => {
    const result = selectNowAndNext(mini, '2026-10-01')
    expect(result.now?.catalogId).toBe('b')
    expect(result.next).toBeUndefined()
  })

  it('treats the soonest upcoming book as now when nothing is active yet', () => {
    const result = selectNowAndNext(mini, '2026-08-01')
    expect(result.now?.catalogId).toBe('a')
    expect(result.next?.catalogId).toBe('b')
  })

  it('returns no books when the whole schedule is over', () => {
    expect(selectNowAndNext(mini, '2026-11-01')).toEqual({})
  })
})