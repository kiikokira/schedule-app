import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSlotEndReminder } from './useSlotEndReminder'
import type { SlotsPayload } from './slotNotify'

const payload: SlotsPayload = {
  date: '2026-09-21',
  savedAt: '2026-09-21T00:00:00.000Z',
  slots: [{ start: '20:55', end: '21:00', books: ['英文法ポラリス2'] }],
}

const mainTitle = `https://ntfy.sh/my-topic?title=${encodeURIComponent('学習時間終了 21:00')}`

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 21, 20, 58, 0))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useSlotEndReminder', () => {
  it('sends a push right at the slot end', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    renderHook(() => useSlotEndReminder(true, 'my-topic', payload))
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    expect(fetchImpl).toHaveBeenCalledWith(
      mainTitle,
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = fetchImpl.mock.calls[0]
    expect((init as RequestInit).body as string).toContain('20:55～21:00')
  })

  it('does nothing when disabled or without a topic', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    renderHook(() => useSlotEndReminder(false, 'my-topic', payload))
    renderHook(() => useSlotEndReminder(true, '  ', payload))
    renderHook(() => useSlotEndReminder(true, 'my-topic', null))
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does nothing when the payload is for another date', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    renderHook(() =>
      useSlotEndReminder(true, 'my-topic', { ...payload, date: '2026-09-22' }),
    )
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends pushes for every remaining slot in the day', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    const multi: SlotsPayload = {
      date: '2026-09-21',
      savedAt: '2026-09-21T00:00:00.000Z',
      slots: [
        { start: '20:50', end: '21:00', books: ['A'] },
        { start: '21:00', end: '21:10', books: ['B'] },
      ],
    }
    renderHook(() => useSlotEndReminder(true, 'my-topic', multi))
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000)
    const titles = fetchImpl.mock.calls.map(([url]) =>
      new URL(url as string).searchParams.get('title'),
    )
    expect(titles).toContain('学習時間終了 21:00')
    expect(titles).toContain('学習時間終了 21:10')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('cancels the timer on unmount', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    const { unmount } = renderHook(() => useSlotEndReminder(true, 'my-topic', payload))
    unmount()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
