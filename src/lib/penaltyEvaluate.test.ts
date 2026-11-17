import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../db/database'
import type { AvailabilitySlot } from '../data/dayplanStore'
import { evaluateDay, getPenaltySettings, listPenalties } from '../data/penaltyStore'
import { setNotifySettings } from '../lib/notify'
import type { BookData, ProgressRecordData } from '../lib/progress'
import {
  evaluateRecentDays,
  maybeNotifyYesterdayMiss,
  notifiedKeyFor,
  summarizeRecentPenalties,
} from './penaltyEvaluate'

const TODAY = '2026-11-14'

function book(id: string): BookData {
  const now = new Date().toISOString()
  return {
    id,
    title: `本${id}`,
    totalPages: 100,
    startDate: '2026-11-01',
    deadline: '2026-12-31',
    createdAt: now,
    updatedAt: now,
  }
}

function slotFor(date: string): AvailabilitySlot {
  return { id: `slot-${date}`, weekday: null, date, start: '19:00', end: '20:00' }
}

function weekAvailability(except: string[] = []): AvailabilitySlot[] {
  const out: AvailabilitySlot[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(2026, 10, 14 - i)
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!except.includes(ymd)) out.push(slotFor(ymd))
  }
  return out
}

const plannedByDate = (_date: string) => ({
  planned: [{ bookId: 'b1', pages: 30 }],
  cyclePlanned: [] as { bookId: string; units: number }[],
})

beforeEach(async () => {
  await db.penalties.clear()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('evaluateRecentDays', () => {
  it('直近7日を走査して未記録日に罰を作成する', async () => {
    await evaluateRecentDays(TODAY, 7, {
      books: [book('b1')],
      records: [],
      cycleRecords: [],
      availability: weekAvailability(),
      plannedByDate,
    })
    const all = await listPenalties()
    expect(all).toHaveLength(7)
    expect(all.map((p) => p.date).sort()).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ])
    expect(all[0].missingBookIds).toEqual(['b1'])
    expect(all[0].pageDebt).toBe(30)
  })

  it('超過記録の後は再評価で借金が減る', async () => {
    await evaluateRecentDays(TODAY, 7, {
      books: [book('b1')],
      records: [],
      cycleRecords: [],
      availability: weekAvailability(),
      plannedByDate,
    })
    const before = summarizeRecentPenalties(await listPenalties(), TODAY)
    expect(before.outstanding).toBe(210)
    const records: ProgressRecordData[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(2026, 10, 14 - i)
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      records.push({ id: `r-${ymd}`, bookId: 'b1', date: ymd, pages: 50 })
    }
    await evaluateRecentDays(TODAY, 7, {
      books: [book('b1')],
      records,
      cycleRecords: [],
      availability: weekAvailability(),
      plannedByDate,
    })
    const after = summarizeRecentPenalties(await listPenalties(), TODAY)
    expect(after.outstanding).toBe(0)
  })

  it('空き時間なしの日は判定しない', async () => {
    await evaluateRecentDays(TODAY, 7, {
      books: [book('b1')],
      records: [],
      cycleRecords: [],
      availability: weekAvailability(['2026-11-10']),
      plannedByDate,
    })
    const all = await listPenalties()
    expect(all.map((p) => p.date).sort()).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ])
  })

  it('focus対象外の本は無視する', async () => {
    await evaluateRecentDays(TODAY, 7, {
      books: [book('b1'), book('b2')],
      records: [],
      cycleRecords: [],
      availability: weekAvailability(),
      focusIds: ['b1'],
      plannedByDate: () => ({
        planned: [
          { bookId: 'b1', pages: 30 },
          { bookId: 'b2', pages: 20 },
        ],
        cyclePlanned: [],
      }),
    })
    const all = await listPenalties()
    expect(all).toHaveLength(7)
    for (const p of all) {
      expect(p.missingBookIds).toEqual(['b1'])
      expect(p.pageDebt).toBe(30)
    }
  })

  it('現在の厳しさで評価する', async () => {
    const { setPenaltySettings } = await import('../data/penaltyStore')
    setPenaltySettings({ severity: 'strict', enabledBanner: true })
    expect(getPenaltySettings().severity).toBe('strict')
    await evaluateRecentDays(TODAY, 1, {
      books: [book('b1')],
      records: [],
      cycleRecords: [],
      availability: weekAvailability(),
      plannedByDate,
    })
    const all = await listPenalties()
    expect(all).toHaveLength(1)
    expect(all[0].points).toBe(20)
  })
})

describe('notifiedKeyFor', () => {
  it('penalty-notified-YYYY-MM-DD 形式を返す', () => {
    expect(notifiedKeyFor('2026-11-14')).toBe('penalty-notified-2026-11-14')
  })
})

describe('maybeNotifyYesterdayMiss', () => {
  const okFetch = () => vi.fn(async () => ({ ok: true }) as Response)

  it('通知OFFでは何も送らない', async () => {
    setNotifySettings({ enabled: false, topic: 'my-topic' })
    await evaluateDay('2026-11-13', ['b1'], new Set(), [{ bookId: 'b1', pages: 30 }], [], 'normal')
    const fetchMock = okFetch()
    await maybeNotifyYesterdayMiss(TODAY, fetchMock as unknown as typeof fetch)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('前日サボりなしでは何も送らない', async () => {
    setNotifySettings({ enabled: true, topic: 'my-topic' })
    const fetchMock = okFetch()
    await maybeNotifyYesterdayMiss(TODAY, fetchMock as unknown as typeof fetch)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ONかつ未送信なら昨日分を1回送る', async () => {
    setNotifySettings({ enabled: true, topic: 'my-topic' })
    await evaluateDay('2026-11-13', ['b1'], new Set(), [{ bookId: 'b1', pages: 30 }], [], 'normal')
    const fetchMock = okFetch()
    await maybeNotifyYesterdayMiss(TODAY, fetchMock as unknown as typeof fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://ntfy.sh/my-topic?title=${encodeURIComponent('サボり罰')}`)
    expect(init.body).toBe('昨日は記録なし 借金30ページ')
    expect(localStorage.getItem('penalty-notified-2026-11-13')).toBe('1')
  })

  it('同日2回目は送らない（1日1回dedup）', async () => {
    setNotifySettings({ enabled: true, topic: 'my-topic' })
    await evaluateDay('2026-11-13', ['b1'], new Set(), [{ bookId: 'b1', pages: 30 }], [], 'normal')
    const fetchMock = okFetch()
    await maybeNotifyYesterdayMiss(TODAY, fetchMock as unknown as typeof fetch)
    await maybeNotifyYesterdayMiss(TODAY, fetchMock as unknown as typeof fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('送信失敗でも throw しない', async () => {
    setNotifySettings({ enabled: true, topic: 'my-topic' })
    await evaluateDay('2026-11-13', ['b1'], new Set(), [{ bookId: 'b1', pages: 30 }], [], 'normal')
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    await expect(
      maybeNotifyYesterdayMiss(TODAY, fetchMock as unknown as typeof fetch),
    ).resolves.toBeUndefined()
  })
})
