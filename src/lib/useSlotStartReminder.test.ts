import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSlotStartReminder } from './useSlotStartReminder'
import type { SlotsPayload } from './slotNotify'

const payload: SlotsPayload = {
  date: '2026-09-21',
  savedAt: '2026-09-21T00:00:00.000Z',
  slots: [{ start: '21:00', end: '21:05', books: ['英文法ポラリス2'] }],
}

const mainTitle = `https://ntfy.sh/my-topic?title=${encodeURIComponent('学習開始10分前 21:00')}`

beforeEach(() => {
  vi.useFakeTimers()
  // 通知予定=21:00開始の10分前=20:50。その2分前から開始
  vi.setSystemTime(new Date(2026, 8, 21, 20, 48, 0))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useSlotStartReminder', () => {
  it('sends a push 10 minutes before the slot starts', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    renderHook(() => useSlotStartReminder(true, 'my-topic', payload))
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    expect(fetchImpl).toHaveBeenCalledWith(
      mainTitle,
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = fetchImpl.mock.calls[0]
    expect((init as RequestInit).body as string).toContain('21:00～21:05')
  })

  it('does nothing when disabled or without a topic', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    renderHook(() => useSlotStartReminder(false, 'my-topic', payload))
    renderHook(() => useSlotStartReminder(true, '  ', payload))
    renderHook(() => useSlotStartReminder(true, 'my-topic', null))
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does nothing when the payload is for another date', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    renderHook(() =>
      useSlotStartReminder(true, 'my-topic', { ...payload, date: '2026-09-22' }),
    )
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends pushes 10 minutes before every remaining slot in the day', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    const multi: SlotsPayload = {
      date: '2026-09-21',
      savedAt: '2026-09-21T00:00:00.000Z',
      slots: [
        { start: '21:00', end: '21:05', books: ['A'] },
        { start: '21:10', end: '21:15', books: ['B'] },
      ],
    }
    renderHook(() => useSlotStartReminder(true, 'my-topic', multi))
    // 通知予定=20:50と21:00。20:48から12分進めると両方発火
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000)
    const titles = fetchImpl.mock.calls.map(([url]) =>
      new URL(url as string).searchParams.get('title'),
    )
    expect(titles).toContain('学習開始10分前 21:00')
    expect(titles).toContain('学習開始10分前 21:10')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('cancels the timer on unmount', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    const { unmount } = renderHook(() => useSlotStartReminder(true, 'my-topic', payload))
    unmount()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('skips a reminder that fires more than 2 minutes late', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    renderHook(() => useSlotStartReminder(true, 'my-topic', payload))
    // 通知予定20:50を過ぎた21:30に時計を進めて発火させる（抑制されたタイマー想定）
    vi.setSystemTime(new Date(2026, 8, 21, 21, 30, 0))
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
