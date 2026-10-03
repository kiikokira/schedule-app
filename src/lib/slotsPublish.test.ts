import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  publishSlotsOnce,
  SLOTS_PUBLISHED_KEY,
  syncSlotSchedules,
  SCHEDULED_KEY,
  slotSequenceId,
  slotStartUnix,
} from './slotsPublish'
import type { SlotsPayload } from './slotNotify'

const payload: SlotsPayload = {
  date: '2026-09-21',
  savedAt: '2026-09-21T00:00:00.000Z',
  slots: [{ start: '20:50', end: '21:00', books: ['A'] }],
}

const okFetch = vi.fn(
  async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
)

beforeEach(() => {
  localStorage.clear()
  okFetch.mockClear()
})

describe('publishSlotsOnce', () => {
  it('publishes once and skips while the content is unchanged', async () => {
    expect(await publishSlotsOnce('my-topic', payload, okFetch as typeof fetch)).toBe(true)
    expect(okFetch).toHaveBeenCalledTimes(1)
    expect(await publishSlotsOnce('my-topic', payload, okFetch as typeof fetch)).toBe(false)
    expect(okFetch).toHaveBeenCalledTimes(1)
  })

  it('republishes when the slots change', async () => {
    await publishSlotsOnce('my-topic', payload, okFetch as typeof fetch)
    const changed: SlotsPayload = {
      ...payload,
      slots: [...payload.slots, { start: '21:00', end: '21:10', books: ['B'] }],
    }
    expect(await publishSlotsOnce('my-topic', changed, okFetch as typeof fetch)).toBe(true)
    expect(okFetch).toHaveBeenCalledTimes(2)
  })

  it('does not mark as published when the send fails', async () => {
    const failFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        throw new Error('network down')
      },
    )
    expect(await publishSlotsOnce('my-topic', payload, failFetch as typeof fetch)).toBe(false)
    expect(localStorage.getItem(SLOTS_PUBLISHED_KEY)).toBeNull()
    expect(await publishSlotsOnce('my-topic', payload, okFetch as typeof fetch)).toBe(true)
  })
})

describe('slotSequenceId / slotStartUnix', () => {
  it('builds a deterministic id and a JST unix timestamp 10 minutes before start', () => {
    expect(slotSequenceId('2026-09-27', '21:00')).toBe('slot-start-2026-09-27-2100')
    expect(slotStartUnix('2026-09-27', '21:00')).toBe(
      Math.floor(new Date('2026-09-27T20:50:00+09:00').getTime() / 1000),
    )
  })
})

describe('syncSlotSchedules', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 20, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const futurePayload: SlotsPayload = {
    date: '2026-09-27',
    savedAt: '2026-09-27T00:00:00.000Z',
    slots: [
      { start: '20:30', end: '21:00', books: ['A'] },
      { start: '21:30', end: '22:00', books: ['B'] },
    ],
  }

  it('schedules only future reminders with exact delays', async () => {
    const past: SlotsPayload = {
      ...futurePayload,
      slots: [
        // 通知済み（19:50開始→19:40通知は15分窓の外）の枠は対象外
        { start: '19:50', end: '20:00', books: ['old'] },
        ...futurePayload.slots,
      ],
    }
    const res = await syncSlotSchedules('my-topic', past, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 2, salvaged: 0, cancelled: 0 })
    const posts = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'POST',
    )
    expect(posts).toHaveLength(2)
    const first = new URL(posts[0][0] as string)
    // 20:30開始→20:20通知
    expect(first.pathname).toBe('/my-topic/slot-start-2026-09-27-2030')
    expect(first.searchParams.get('delay')).toBe(
      String(Math.floor(new Date('2026-09-27T20:20:00+09:00').getTime() / 1000)),
    )
    expect(first.searchParams.get('title')).toBe('学習開始10分前 20:30')
  })

  it('does nothing when the content is unchanged', async () => {
    await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    okFetch.mockClear()
    const res = await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 0, salvaged: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
  })

  it('cancels removed future slots and keeps delivered ones', async () => {
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        days: {
          '2026-09-27': {
            hash: 'old-hash',
            ids: ['slot-start-2026-09-27-2030', 'slot-start-2026-09-27-2130'],
          },
        },
      }),
    )
    const changed: SlotsPayload = { ...futurePayload, slots: [futurePayload.slots[0]] }
    const res = await syncSlotSchedules('my-topic', changed, okFetch as typeof fetch)
    expect(res.cancelled).toBe(1)
    const deletes = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'DELETE',
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe('https://ntfy.sh/my-topic/slot-start-2026-09-27-2130')
  })

  it('cancels legacy end-based schedules from before the migration', async () => {
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        days: {
          '2026-09-27': { hash: 'old-hash', ids: ['slot-2026-09-27-2100'] },
        },
      }),
    )
    // 21:00終了の旧予約は未来（現在20:00）のため取り消し対象
    const res = await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    expect(res.cancelled).toBe(1)
    const deletes = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'DELETE',
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe('https://ntfy.sh/my-topic/slot-2026-09-27-2100')
  })

  it('sends recent-past reminders immediately instead of dropping them', async () => {
    // 20:05開始→19:55通知は5分過ぎ。予約対象外だが即時送信する
    const late: SlotsPayload = {
      ...futurePayload,
      date: '2026-09-27',
      slots: [{ start: '20:05', end: '20:30', books: ['A'] }],
    }
    const res = await syncSlotSchedules('my-topic', late, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 0, salvaged: 1, cancelled: 0 })
    const posts = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'POST',
    )
    expect(posts).toHaveLength(1)
    const url = new URL(posts[0][0] as string)
    expect(url.pathname).toBe('/my-topic')
    expect(url.searchParams.get('delay')).toBeNull()
    expect(url.searchParams.get('title')).toBe('学習開始10分前 20:05')
  })

  it('does not resend a salvaged slot handled before', async () => {
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        days: {
          '2026-09-27': { hash: 'old-hash', ids: ['slot-start-2026-09-27-2005'] },
        },
      }),
    )
    const late: SlotsPayload = {
      ...futurePayload,
      date: '2026-09-27',
      slots: [{ start: '20:05', end: '20:30', books: ['A'] }],
    }
    const res = await syncSlotSchedules('my-topic', late, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 0, salvaged: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
  })

  it('does not record state when a send fails so a later sync retries', async () => {
    const failFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        throw new Error('network down')
      },
    )
    const res = await syncSlotSchedules('my-topic', futurePayload, failFetch as typeof fetch)
    expect(res.scheduled).toBe(0)
    expect(localStorage.getItem(SCHEDULED_KEY)).toBeNull()
  })

  it('migrates the previous single-day state shape', async () => {
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        date: '2026-09-27',
        hash: 'old-hash',
        ids: ['slot-start-2026-09-27-2130'],
      }),
    )
    const changed: SlotsPayload = { ...futurePayload, slots: [futurePayload.slots[0]] }
    const res = await syncSlotSchedules('my-topic', changed, okFetch as typeof fetch)
    expect(res.cancelled).toBe(1)
    const deletes = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'DELETE',
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe('https://ntfy.sh/my-topic/slot-start-2026-09-27-2130')
  })

  it('schedules future-date payloads so unopened days are covered', async () => {
    // 現在2026-09-27 20:00。翌28日06:30開始→06:20通知は未来のため予約する
    const tomorrow: SlotsPayload = {
      date: '2026-09-28',
      savedAt: '2026-09-27T00:00:00.000Z',
      slots: [{ start: '06:30', end: '07:00', books: ['A'] }],
    }
    const res = await syncSlotSchedules('my-topic', tomorrow, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 1, salvaged: 0, cancelled: 0 })
    const posts = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'POST',
    )
    expect(posts).toHaveLength(1)
    const url = new URL(posts[0][0] as string)
    expect(url.pathname).toBe('/my-topic/slot-start-2026-09-28-0630')
    expect(url.searchParams.get('delay')).toBe(
      String(Math.floor(new Date('2026-09-28T06:20:00+09:00').getTime() / 1000)),
    )
  })

  it('skips past-date payloads', async () => {
    const yesterday: SlotsPayload = {
      date: '2026-09-26',
      savedAt: '2026-09-26T00:00:00.000Z',
      slots: [{ start: '06:30', end: '07:00', books: ['A'] }],
    }
    const res = await syncSlotSchedules('my-topic', yesterday, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 0, salvaged: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
  })
})
