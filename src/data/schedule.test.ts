import { describe, it, expect } from 'vitest'
import { SCHEDULE_PHASES, scheduleDeadlineOf, buildApplyResult } from './schedule'
import { CATALOG } from './catalog'

describe('schedule', () => {
  it('contains 7 phases ending at high3 summer vacation', () => {
    expect(SCHEDULE_PHASES).toHaveLength(7)
    expect(SCHEDULE_PHASES[6].label).toBe('高3夏休み中')
    expect(SCHEDULE_PHASES[6].deadline).toBe('2028-08-31')
  })

  it('all catalog ids in the schedule exist', () => {
    const ids = new Set(CATALOG.map((c) => c.id))
    for (const phase of SCHEDULE_PHASES) {
      for (const id of phase.bookIds) {
        expect(ids.has(id)).toBe(true)
      }
    }
  })

  it('reuses the latest deadline for books appearing in multiple phases', () => {
    expect(scheduleDeadlineOf('leap')).toBe('2027-07-15')
    expect(scheduleDeadlineOf('sokudoku-eijukugo')).toBe('2027-07-15')
    expect(scheduleDeadlineOf('the-rules-2')).toBe('2027-08-31')
  })

  it('creates new books with today as start date when none are registered', () => {
    const now = new Date(2026, 8, 20, 10, 0, 0)
    const { newBooks, updatedBooks } = buildApplyResult([], now)
    expect(updatedBooks).toHaveLength(0)
    expect(newBooks).toHaveLength(20)
    const leap = newBooks.find((b) => b.catalogId === 'leap')
    expect(leap?.startDate).toBe('2026-09-20')
    expect(leap?.deadline).toBe('2027-07-15')
    expect(leap?.coverUrl).toMatch(/^https:\/\//)
  })

  it('updates only the deadline for an already registered book matched by catalogId', () => {
    const now = new Date(2026, 8, 20, 10, 0, 0)
    const existing: Parameters<typeof buildApplyResult>[0] = [
      {
        id: 'b1',
        title: '改訂版 必携 英単語 LEAP',
        totalPages: 576,
        catalogId: 'leap',
        startDate: '2026-04-01',
        deadline: '2026-06-01',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]
    const { newBooks, updatedBooks } = buildApplyResult(existing, now)
    expect(newBooks).toHaveLength(19)
    expect(updatedBooks).toHaveLength(1)
    expect(updatedBooks[0].id).toBe('b1')
    expect(updatedBooks[0].deadline).toBe('2027-07-15')
    expect(updatedBooks[0].startDate).toBe('2026-04-01')
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
    expect(newBooks).toHaveLength(19)
    expect(updatedBooks).toHaveLength(1)
    expect(updatedBooks[0].catalogId).toBe('porepore')
    expect(updatedBooks[0].deadline).toBe('2028-03-31')
  })
})