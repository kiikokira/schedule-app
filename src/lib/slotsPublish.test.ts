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

  it('rolls the reminder back to the previous day for slots starting before 00:10', () => {
    // 00:05開始→前日23:55通知。NaNにならず予約できること（欠落防止）
    expect(slotStartUnix('2026-09-27', '00:05')).toBe(
      Math.floor(new Date('2026-09-26T23:55:00+09:00').getTime() / 1000),
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
    await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    okFetch.mockClear()
    const changed: SlotsPayload = { ...futurePayload, slots: [futurePayload.slots[0]] }
    const res = await syncSlotSchedules('my-topic', changed, okFetch as typeof fetch)
    expect(res.cancelled).toBe(1)
    const deletes = okFetch.mock.calls.filter(
      ([url]) => String(url).endsWith('/delete'),
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe('https://ntfy.sh/my-topic/slot-start-2026-09-27-2130/delete')
    expect((deletes[0][1] as RequestInit).method).toBe('GET')
  })

  it('cancels legacy end-based schedules from before the migration', async () => {
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        v: 2,
        days: {
          '2026-09-27': {
            slots: { 'slot-2026-09-27-2100': { h: 'x', t: 0 } },
          },
        },
      }),
    )
    // 21:00終了の旧予約は未来（現在20:00）のため取り消し対象
    const res = await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    expect(res.cancelled).toBe(1)
    const deletes = okFetch.mock.calls.filter(
      ([url]) => String(url).endsWith('/delete'),
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe('https://ntfy.sh/my-topic/slot-2026-09-27-2100/delete')
  })

  it('schedules recent-past reminders with a short delay instead of dropping them', async () => {
    // 20:05開始→19:55通知は5分過ぎ。予約対象外だが15秒後の予約投稿で送る。
    // 同じ予約IDのため重なっても置換になり二重送信しない
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
    expect(url.pathname).toBe('/my-topic/slot-start-2026-09-27-2005')
    expect(url.searchParams.get('delay')).toBe(
      String(Math.floor(new Date(2026, 8, 27, 20, 0, 0).getTime() / 1000) + 15),
    )
    expect(url.searchParams.get('title')).toBe('学習開始10分前 20:05')
  })

  it('does not resend a salvaged slot handled before', async () => {
    const late: SlotsPayload = {
      ...futurePayload,
      date: '2026-09-27',
      slots: [{ start: '20:05', end: '20:30', books: ['A'] }],
    }
    const first = await syncSlotSchedules('my-topic', late, okFetch as typeof fetch)
    expect(first).toEqual({ scheduled: 0, salvaged: 1, cancelled: 0 })
    okFetch.mockClear()
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

  it('adopts the previous day-hash state silently when content matches', async () => {
    const dayHash = `2026-09-27|${JSON.stringify(futurePayload.slots)}`
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        date: '2026-09-27',
        hash: dayHash,
        ids: [
          'slot-start-2026-09-27-2030',
          'slot-start-2026-09-27-2130',
        ],
      }),
    )
    const res = await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 0, salvaged: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
  })

  it('resyncs from the previous state shape when content changed', async () => {
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
      ([url]) => String(url).endsWith('/delete'),
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe('https://ntfy.sh/my-topic/slot-start-2026-09-27-2130/delete')
  })

  it('migrates the previous days-map state shape', async () => {
    const dayHash = `2026-09-27|${JSON.stringify(futurePayload.slots)}`
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        days: {
          '2026-09-27': {
            hash: dayHash,
            ids: [
              'slot-start-2026-09-27-2030',
              'slot-start-2026-09-27-2130',
            ],
          },
        },
      }),
    )
    const res = await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 0, salvaged: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
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

  it('schedules midnight slots instead of dropping them', async () => {
    // 現在2026-09-27 20:00。翌28日00:05開始→27日23:55通知は未来のため予約する
    const midnight: SlotsPayload = {
      date: '2026-09-28',
      savedAt: '2026-09-27T00:00:00.000Z',
      slots: [{ start: '00:05', end: '00:30', books: ['A'] }],
    }
    const res = await syncSlotSchedules('my-topic', midnight, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 1, salvaged: 0, cancelled: 0 })
    const posts = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'POST',
    )
    expect(posts).toHaveLength(1)
    const url = new URL(posts[0][0] as string)
    expect(url.pathname).toBe('/my-topic/slot-start-2026-09-28-0005')
    expect(url.searchParams.get('delay')).toBe(
      String(Math.floor(new Date('2026-09-27T23:55:00+09:00').getTime() / 1000)),
    )
  })

  it('sends a salvage reminder only once when syncs overlap', async () => {
    // アプリ起動時と今日の計画表示時の2回の同期が重なっても二重送信しない
    const late: SlotsPayload = {
      date: '2026-09-27',
      savedAt: '2026-09-27T00:00:00.000Z',
      slots: [{ start: '20:05', end: '20:30', books: ['A'] }],
    }
    const [first, second] = await Promise.all([
      syncSlotSchedules('my-topic', late, okFetch as typeof fetch),
      syncSlotSchedules('my-topic', late, okFetch as typeof fetch),
    ])
    const posts = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'POST',
    )
    expect(posts).toHaveLength(1)
    expect(first.salvaged + second.salvaged).toBe(1)
  })

  it('untitled syncs never clobber titled ones for the same slots', async () => {
    // 今日の計画（titled）が予約した枠を、起動時（untitled）が上書きしない。
    // 毎回のアプリ起動で無題予約が再送され重複する噴水を止める。
    const syncTitled = (p: SlotsPayload) =>
      syncSlotSchedules('my-topic', p, okFetch as typeof fetch, undefined, true)
    const syncUntitled = (p: SlotsPayload) =>
      syncSlotSchedules('my-topic', p, okFetch as typeof fetch, undefined, false)
    await syncTitled(futurePayload)
    expect(okFetch).toHaveBeenCalled()
    okFetch.mockClear()
    const untitled: SlotsPayload = {
      ...futurePayload,
      slots: futurePayload.slots.map((s) => ({ ...s, books: [] as string[] })),
    }
    const res = await syncUntitled(untitled)
    expect(res).toEqual({ scheduled: 0, salvaged: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
  })

  it('titled syncs upgrade untitled ones once and stay quiet afterwards', async () => {
    const syncTitled = (p: SlotsPayload) =>
      syncSlotSchedules('my-topic', p, okFetch as typeof fetch, undefined, true)
    const untitled: SlotsPayload = {
      ...futurePayload,
      slots: futurePayload.slots.map((s) => ({ ...s, books: [] as string[] })),
    }
    await syncSlotSchedules('my-topic', untitled, okFetch as typeof fetch, undefined, false)
    okFetch.mockClear()
    const upgraded = await syncTitled(futurePayload)
    expect(upgraded.scheduled).toBe(2)
    okFetch.mockClear()
    const quiet = await syncTitled(futurePayload)
    expect(quiet).toEqual({ scheduled: 0, salvaged: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
  })

  it('reposts only slots whose content changed', async () => {
    const syncTitled = (p: SlotsPayload) =>
      syncSlotSchedules('my-topic', p, okFetch as typeof fetch, undefined, true)
    await syncTitled(futurePayload)
    okFetch.mockClear()
    const changed: SlotsPayload = {
      ...futurePayload,
      slots: futurePayload.slots.map((s, i) =>
        i === 0 ? { ...s, books: ['Z'] } : s,
      ),
    }
    const res = await syncTitled(changed)
    expect(res).toEqual({ scheduled: 1, salvaged: 0, cancelled: 0 })
    const posts = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'POST',
    )
    expect(posts).toHaveLength(1)
    const url = new URL(posts[0][0] as string)
    expect(url.pathname).toBe('/my-topic/slot-start-2026-09-27-2030')
    expect(url.searchParams.get('delay')).toBe(
      String(Math.floor(new Date('2026-09-27T20:20:00+09:00').getTime() / 1000)),
    )
  })
})
