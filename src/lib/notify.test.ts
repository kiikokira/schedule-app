import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getNotifySettings,
  setNotifySettings,
  stateTopicOf,
  slotsTopicOf,
  normalizeTopic,
  publishPush,
  publishState,
  publishSlots,
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

describe('slotsTopicOf', () => {
  it('appends -slots to the topic', () => {
    expect(slotsTopicOf('my-topic')).toBe('my-topic-slots')
  })
})

describe('normalizeTopic', () => {
  it('trims whitespace', () => {
    expect(normalizeTopic('  my-topic  ')).toBe('my-topic')
  })

  it('strips a pasted https://ntfy.sh/ prefix', () => {
    expect(normalizeTopic('https://ntfy.sh/my-topic')).toBe('my-topic')
  })

  it('strips a pasted http://ntfy.sh/ prefix', () => {
    expect(normalizeTopic('http://ntfy.sh/my-topic')).toBe('my-topic')
  })

  it('strips a pasted ntfy.sh/ prefix and trailing slashes', () => {
    expect(normalizeTopic('ntfy.sh/my-topic/')).toBe('my-topic')
  })

  it('keeps a plain topic unchanged', () => {
    expect(normalizeTopic('my-topic')).toBe('my-topic')
  })
})

describe('publishPush', () => {
  const okFetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      ({ ok: true }) as Response,
  )

  it('posts the message to the ntfy topic and returns success', async () => {
    const result = await publishPush(
      'my-topic',
      '今日の学習を記録しましたか？',
      {},
      okFetch as typeof fetch,
    )
    expect(result.ok).toBe(true)
    expect(okFetch).toHaveBeenCalledWith(
      'https://ntfy.sh/my-topic?title=%E5%8F%82%E8%80%83%E6%9B%B8%E3%82%B9%E3%82%B1%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E7%AE%A1%E7%90%86',
      expect.objectContaining({ method: 'POST', body: '今日の学習を記録しましたか？' }),
    )
  })

  it('keeps the message body without custom headers so no CORS preflight is needed', async () => {
    await publishPush('my-topic', 'hi', { title: '遅れています' }, okFetch as typeof fetch)
    const [url, init] = okFetch.mock.calls[0]
    expect(url).toBe('https://ntfy.sh/my-topic?title=%E9%81%85%E3%82%8C%E3%81%A6%E3%81%84%E3%81%BE%E3%81%99')
    expect(init).toBeDefined()
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers).not.toHaveProperty('Title')
    expect(headers['Content-Type']).toBe('text/plain')
  })

  it('returns a network failure when the request throws', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        throw new Error('network down')
      },
    )
    const result = await publishPush('my-topic', 'hi', {}, fetchImpl as typeof fetch)
    expect(result).toEqual({ ok: false, reason: 'network', status: null })
  })

  it('returns an http failure with the status when the response is not ok', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: false, status: 404 }) as Response,
    )
    const result = await publishPush('my-topic', 'hi', {}, fetchImpl as typeof fetch)
    expect(result).toEqual({ ok: false, reason: 'http', status: 404 })
  })

  it('publishes to the normalized URL when a full address is pasted', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: true }) as Response,
    )
    await publishPush('https://ntfy.sh/my-topic', 'hi', {}, fetchImpl as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/ntfy\.sh\/my-topic\?title=/),
      expect.anything(),
    )
  })

  it('omits a query string when no title is given', async () => {
    const result = await publishPush(
      'my-topic',
      'hi',
      { title: '' },
      okFetch as typeof fetch,
    )
    expect(result.ok).toBe(true)
    expect(okFetch.mock.calls[0][0]).toBe('https://ntfy.sh/my-topic')
  })
})

describe('publishState', () => {
  it('posts the diagnosis to the -state topic using only safelisted headers', async () => {
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
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ntfy.sh/my-topic-state')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers).not.toHaveProperty('X-TTL')
    expect(headers['Content-Type']).toBe('text/plain')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.behind).toBe(true)
    expect(body.requiredPerDay).toBe(6)
  })
})

describe('publishSlots', () => {
  it('posts the slots payload to the -slots topic using only safelisted headers', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: true }) as Response,
    )
    const ok = await publishSlots(
      'my-topic',
      {
        date: '2026-09-21',
        slots: [{ start: '21:00', end: '21:45', books: ['英文法ポラリス2'] }],
        savedAt: '2026-09-21T00:00:00.000Z',
      },
      fetchImpl as typeof fetch,
    )
    expect(ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ntfy.sh/my-topic-slots')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers).not.toHaveProperty('X-TTL')
    expect(headers['Content-Type']).toBe('text/plain')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.date).toBe('2026-09-21')
    expect(body.slots).toHaveLength(1)
  })

  it('returns false when the request throws', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        throw new Error('network down')
      },
    )
    const ok = await publishSlots(
      'my-topic',
      { date: '2026-09-21', slots: [], savedAt: '2026-09-21T00:00:00.000Z' },
      fetchImpl as typeof fetch,
    )
    expect(ok).toBe(false)
  })
})