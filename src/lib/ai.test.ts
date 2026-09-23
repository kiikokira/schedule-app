import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getAiSettings,
  setAiSettings,
  isAiConfigured,
  chatWithModel,
  buildSystemPrompt,
} from './ai'
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
})