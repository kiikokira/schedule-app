import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publishSlotsOnce, SLOTS_PUBLISHED_KEY } from './slotsPublish'
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
