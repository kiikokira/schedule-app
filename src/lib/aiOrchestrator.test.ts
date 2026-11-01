// src/lib/aiOrchestrator.test.ts
import { describe, it, expect } from 'vitest'
import { buildSystemPromptV2, FREE_FALLBACK_ORDER, runFreeChat } from './aiOrchestrator'
import type { AdvisorReportV2 } from './advisorV2'

const fakeReport = { summaryText: '順調', books: [], proposal: { focus: [], relax: [], ratios: [], todayMessage: '', paceMessage: '' }, velocities: {} } as unknown as AdvisorReportV2

describe('orchestrator', () => {
  it('builds v2 prompt with free-first instruction', () => {
    const s = buildSystemPromptV2(fakeReport)
    expect(s).toContain('期限')
    expect(s).toContain('操作案JSON')
  })
  it('falls back on 429 to next free profile', async () => {
    const out = await runFreeChat(
      { id: 'groq-free' },
      'sys', [{ role: 'user', content: 'hi' }],
      {
        'groq-free': async () => ({ ok: false, reason: 'http', status: 429 } as const),
        'gemini-free': async () => ({ ok: true, text: 'ok' } as const),
        'openrouter-free': async () => ({ ok: false, reason: 'http', status: 429 } as const),
      },
    )
    expect(out.profileId).toBe('gemini-free')
    expect(out.result.ok).toBe(true)
  })
  it('exposes fallback order starting with groq', () => {
    expect(FREE_FALLBACK_ORDER[0]).toBe('groq-free')
  })
})
