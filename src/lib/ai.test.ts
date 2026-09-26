import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getAiSettings,
  setAiSettings,
  isAiConfigured,
  chatWithModel,
  buildSystemPrompt,
} from './ai'
import { GEMINI_COMPAT_ENDPOINT, GEMINI_EXAMPLE_MODEL, OPENROUTER_ENDPOINT, OPENROUTER_EXAMPLE_MODEL, pingEndpoint } from './ai'
import { buildAdvisorReport } from './advisor'
import type { AvailabilitySlot } from '../data/dayplanStore'
import type { BookData } from './progress'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ai settings', () => {
  it('returns the default endpoint when nothing is stored', () => {
    const s = getAiSettings()
    expect(s.endpoint).toBe('https://api.openai.com/v1/chat/completions')
    expect(s.apiKey).toBe('')
    expect(s.model).toBe('')
    expect(isAiConfigured(s)).toBe(false)
  })

  it('round-trips saved settings', () => {
    setAiSettings({ endpoint: 'https://example.test/v1/chat/completions', apiKey: 'key', model: 'gpt-5-mini' })
    const s = getAiSettings()
    expect(s.endpoint).toBe('https://example.test/v1/chat/completions')
    expect(s.apiKey).toBe('key')
    expect(s.model).toBe('gpt-5-mini')
    expect(isAiConfigured(s)).toBe(true)
  })

  it('clears settings when apiKey is empty', () => {
    setAiSettings({ endpoint: 'https://example.test', apiKey: '', model: '' })
    expect(getAiSettings().apiKey).toBe('')
    expect(isAiConfigured(getAiSettings())).toBe(false)
  })
})

it('exposes the Gemini OpenAI-compatible endpoint and example model', () => {
  expect(GEMINI_COMPAT_ENDPOINT).toBe(
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  )
  expect(typeof GEMINI_EXAMPLE_MODEL).toBe('string')
  expect(GEMINI_EXAMPLE_MODEL.length).toBeGreaterThan(0)
})

it('exposes the OpenRouter endpoint and a free example model', () => {
  expect(OPENROUTER_ENDPOINT).toBe('https://openrouter.ai/api/v1/chat/completions')
  expect(OPENROUTER_EXAMPLE_MODEL.endsWith(':free')).toBe(true)
})

describe('chatWithModel', () => {
  it('posts to the endpoint and returns the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'こんにちは' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await chatWithModel(
      { endpoint: 'https://example.test/v1/chat/completions', apiKey: 'key', model: 'm' },
      'sys',
      [{ role: 'user', content: 'こんにちは' }],
    )
    expect(res).toEqual({ ok: true, text: 'こんにちは' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer key')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('m')
    expect(body.temperature).toBe(0)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'こんにちは' })
  })

  it('returns a network failure when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    const res = await chatWithModel(
      { endpoint: 'https://example.test', apiKey: 'k', model: 'm' },
      'sys',
      [],
    )
    expect(res).toEqual({ ok: false, reason: 'network' })
  })

  it('returns an http failure for non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const res = await chatWithModel(
      { endpoint: 'https://example.test', apiKey: 'k', model: 'm' },
      'sys',
      [],
    )
    expect(res).toEqual({ ok: false, reason: 'http', status: 401 })
  })

  it('sends max_tokens to cap usage on mobile和高性能モデル', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hi' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await chatWithModel(
      { endpoint: 'https://example.test', apiKey: 'k', model: 'm' },
      'sys',
      [],
    )
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.max_tokens).toBe(800)
  })

  it('returns timeout when the model takes too long', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      }),
    )
    const res = await chatWithModel(
      { endpoint: 'https://example.test', apiKey: 'k', model: 'm' },
      'sys',
      [],
      { timeoutMs: 20 },
    )
    expect(res).toEqual({ ok: false, reason: 'timeout' })
  })

  it('sends OpenRouter headers when the endpoint is OpenRouter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hi' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await chatWithModel(
      { endpoint: OPENROUTER_ENDPOINT, apiKey: 'k', model: 'm:free' },
      'sys',
      [],
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['HTTP-Referer']).toBe('https://kiikokira.github.io/schedule-app/')
    expect(init.headers['X-OpenRouter-Title']).toBeTruthy()
  })

  it('omits OpenRouter headers for generic endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hi' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await chatWithModel(
      { endpoint: 'https://example.test', apiKey: 'k', model: 'm' },
      'sys',
      [],
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['HTTP-Referer']).toBeUndefined()
    expect(init.headers['X-OpenRouter-Title']).toBeUndefined()
  })
})

describe('pingEndpoint', () => {
  it('reports reachable when any HTTP response arrives (even 401)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', fetchMock)
    const res = await pingEndpoint('https://openrouter.ai/api/v1/chat/completions', { timeoutMs: 50 })
    expect(res).toEqual({ ok: true, reachable: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/models')
    expect(init.method).toBe('GET')
  })

  it('reports unreachable when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    const res = await pingEndpoint('https://openrouter.ai/api/v1/chat/completions', { timeoutMs: 50 })
    expect(res).toEqual({ ok: true, reachable: false })
  })

  it('reports unreachable on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      }),
    )
    const res = await pingEndpoint('https://openrouter.ai/api/v1/chat/completions', { timeoutMs: 20 })
    expect(res).toEqual({ ok: true, reachable: false })
  })
})

describe('buildSystemPrompt', () => {
  it('contains the rule that deadlines must not change and includes the summary', () => {
    const TODAY = '2026-09-23'
    const slot: AvailabilitySlot = { id: 's', weekday: null, date: TODAY, start: '21:00', end: '23:00' }
    const book = {
      id: 'b1',
      title: '英単語1000',
      totalPages: 100,
      startDate: '2026-09-01',
      deadline: '2026-09-28',
      createdAt: 'x',
      updatedAt: 'x',
    } as BookData
    const report = buildAdvisorReport({ today: TODAY, books: [book], donePagesByBook: { b1: 0 }, availability: [slot] })
    const prompt = buildSystemPrompt(report)
    expect(prompt).toContain('期限内は絶対に変更してはいけません')
    expect(prompt).toContain('英単語1000')
  })

  it('反復モードの本が集計対象外である旨を含む', () => {
    const TODAY = '2026-09-23'
    const slot: AvailabilitySlot = { id: 's', weekday: null, date: TODAY, start: '21:00', end: '23:00' }
    const book = {
      id: 'b1',
      title: '英単語1000',
      totalPages: 100,
      startDate: '2026-09-01',
      deadline: '2026-09-28',
      createdAt: 'x',
      updatedAt: 'x',
    } as BookData
    const report = buildAdvisorReport({ today: TODAY, books: [book], donePagesByBook: { b1: 0 }, availability: [slot] })
    const prompt = buildSystemPrompt(report)
    expect(prompt).toContain('反復モード')
    expect(prompt).toContain('対象外')
  })
})
