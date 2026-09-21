import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getNotifySettings,
  setNotifySettings,
  stateTopicOf,
  publishPush,
  publishState,
} from './notify'

beforeEach(() => {
  localStorage.removeItem('schedule-app-ntfy')
  vi.restoreAllMocks()
})

describe('getNotifySettings / setNotifySettings', () => {
  it('returns disabled and empty topic by default', () => {
    expect(getNotifySettings()).toEqual({ enabled: false, topic: '' })
  })

  it('persists and reloads the settings', () => {
    setNotifySettings({ enabled: true, topic: 'my-schedule' })
    expect(getNotifySettings()).toEqual({ enabled: true, topic: 'my-schedule' })
  })

  it('trims the saved topic', () => {
    setNotifySettings({ enabled: true, topic: '  my-topic  ' })
    expect(getNotifySettings().topic).toBe('my-topic')
  })
})

describe('stateTopicOf', () => {
  it('appends -state to the topic', () => {
    expect(stateTopicOf('my-topic')).toBe('my-topic-state')
  })
})

describe('publishPush', () => {
  const okFetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      ({ ok: true }) as Response,
  )

  it('posts the message to the ntfy topic and returns success', async () => {
    const ok = await publishPush(
      'my-topic',
      '今日の学習を記録しましたか？',
      {},
      okFetch as typeof fetch,
    )
    expect(ok).toBe(true)
    expect(okFetch).toHaveBeenCalledWith(
      'https://ntfy.sh/my-topic',
      expect.objectContaining({ method: 'POST', body: '今日の学習を記録しましたか？' }),
    )
  })

  it('returns false when the request fails', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        throw new Error('network down')
      },
    )
    expect(await publishPush('my-topic', 'hi', {}, fetchImpl as typeof fetch)).toBe(false)
  })

  it('returns false when the response is not ok', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: false }) as Response,
    )
    expect(await publishPush('my-topic', 'hi', {}, fetchImpl as typeof fetch)).toBe(false)
  })

  it('sends a title header', async () => {
    await publishPush('my-topic', 'hi', { title: '遅れています' }, okFetch as typeof fetch)
    const [, init] = okFetch.mock.calls[0]
    expect((init?.headers as Record<string, string>).Title).toBe('遅れています')
  })
})

describe('publishState', () => {
  it('posts the diagnosis to the -state topic with a TTL header', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: true }) as Response,
    )
    const ok = await publishState(
      'my-topic',
      { behind: true, requiredPerDay: 6 },
      fetchImpl as typeof fetch,
    )
    expect(ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://ntfy.sh/my-topic-state',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-TTL': '172800' }),
      }),
    )
    const [, init] = fetchImpl.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    expect(body.behind).toBe(true)
    expect(body.requiredPerDay).toBe(6)
  })
})