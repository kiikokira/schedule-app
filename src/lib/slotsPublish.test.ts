import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  publishSlotsOnce,
  SLOTS_PUBLISHED_KEY,
  syncSlotSchedules,
  SCHEDULED_KEY,
  slotSequenceId,
  slotEndUnix,
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

describe('slotSequenceId / slotEndUnix', () => {
  it('builds a deterministic id and a JST unix timestamp', () => {
    expect(slotSequenceId('2026-09-27', '21:00')).toBe('slot-2026-09-27-2100')
    expect(slotEndUnix('2026-09-27', '21:00')).toBe(
      Math.floor(new Date('2026-09-27T21:00:00+09:00').getTime() / 1000),
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
      { start: '20:00', end: '21:00', books: ['A'] },
      { start: '21:00', end: '22:00', books: ['B'] },
    ],
  }

  it('schedules only future slot ends with exact delays', async () => {
    const past: SlotsPayload = {
      ...futurePayload,
      slots: [
        { start: '18:00', end: '19:00', books: ['old'] },
        ...futurePayload.slots,
      ],
    }
    const res = await syncSlotSchedules('my-topic', past, okFetch as typeof fetch)
    expect(res.scheduled).toBe(2)
    const posts = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'POST',
    )
    expect(posts).toHaveLength(2)
    const first = new URL(posts[0][0] as string)
    expect(first.pathname).toBe('/my-topic/slot-2026-09-27-2100')
    expect(first.searchParams.get('delay')).toBe(
      String(Math.floor(new Date('2026-09-27T21:00:00+09:00').getTime() / 1000)),
    )
    expect(first.searchParams.get('title')).toBe('学習時間終了 21:00')
  })

  it('does nothing when the content is unchanged', async () => {
    await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    okFetch.mockClear()
    const res = await syncSlotSchedules('my-topic', futurePayload, okFetch as typeof fetch)
    expect(res).toEqual({ scheduled: 0, cancelled: 0 })
    expect(okFetch).not.toHaveBeenCalled()
  })

  it('cancels removed future slots and keeps delivered ones', async () => {
    localStorage.setItem(
      SCHEDULED_KEY,
      JSON.stringify({
        date: '2026-09-27',
        hash: 'old-hash',
        ids: ['slot-2026-09-27-2100', 'slot-2026-09-27-2200'],
      }),
    )
    const changed: SlotsPayload = { ...futurePayload, slots: [futurePayload.slots[0]] }
    const res = await syncSlotSchedules('my-topic', changed, okFetch as typeof fetch)
    expect(res.cancelled).toBe(1)
    const deletes = okFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit).method === 'DELETE',
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe('https://ntfy.sh/my-topic/slot-2026-09-27-2200')
  })
})
