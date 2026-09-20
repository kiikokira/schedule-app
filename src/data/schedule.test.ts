import { describe, it, expect } from 'vitest'
import { SCHEDULE, scheduleEntryOf, buildApplyResult } from './schedule'
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

  it('starts 英文法ポラリス2 in Sep 2026 and finishes by Nov 2026', () => {
    expect(scheduleEntryOf('eibunpo-polaris-2')).toEqual({
      catalogId: 'eibunpo-polaris-2',
      startDate: '2026-09-01',
      deadline: '2026-11-30',
    })
  })

  it('schedules やっておきたい700 and ハイパートレーニング3 in the final prep', () => {
    expect(scheduleEntryOf('yatteokitai-700')).toMatchObject({
      startDate: '2027-12-01',
      deadline: '2028-01-31',
    })
    expect(scheduleEntryOf('hyper-training-3')).toMatchObject({
      startDate: '2027-12-01',
      deadline: '2028-01-31',
    })
  })

  it('keeps Eiken EX for reviews after its completion', () => {
    expect(scheduleEntryOf('eiken-jun1-tanjukugo')).toMatchObject({
      deadline: '2027-06-30',
      note: expect.any(String) as string,
    })
  })

  it('includes SFC past papers and essays running to Feb 2028', () => {
    expect(scheduleEntryOf('sfc-eigo-kakomon')).toMatchObject({
      startDate: '2027-04-01',
      deadline: '2028-02-29',
    })
    expect(scheduleEntryOf('sfc-shoronbun')).toMatchObject({
      startDate: '2027-04-01',
      deadline: '2028-02-29',
    })
  })

  it('creates new books with the scheduled start and deadline when none are registered', () => {
    const now = new Date(2026, 8, 20, 10, 0, 0)
    const { newBooks, updatedBooks } = buildApplyResult([], now)
    expect(updatedBooks).toHaveLength(0)
    expect(newBooks).toHaveLength(17)
    const polaris2 = newBooks.find((b) => b.catalogId === 'eibunpo-polaris-2')
    expect(polaris2?.startDate).toBe('2026-09-01')
    expect(polaris2?.deadline).toBe('2026-11-30')
    expect(polaris2?.coverUrl).toMatch(/^https:\/\//)
    const kakomon = newBooks.find((b) => b.catalogId === 'sfc-eigo-kakomon')
    expect(kakomon?.deadline).toBe('2028-02-29')
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
    expect(updatedBooks[0].deadline).toBe('2026-11-30')
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
    expect(updatedBooks[0].deadline).toBe('2027-11-30')
  })
})