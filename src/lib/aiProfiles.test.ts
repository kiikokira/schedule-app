// src/lib/aiProfiles.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { listProfiles, getActiveProfile, setActiveProfile, getPreferredProfile, setPreferredProfile, shouldAutoRestore, migrateLegacySettings } from './aiProfiles'

beforeEach(() => { localStorage.clear() })

describe('aiProfiles', () => {
  it('has 3 free presets and migrates legacy single setting', () => {
    localStorage.setItem('ai-settings', JSON.stringify({ endpoint: 'https://x.test/v1/chat/completions', apiKey: 'k', model: 'm' }))
    migrateLegacySettings()
    expect(listProfiles().length).toBeGreaterThanOrEqual(3)
    expect(getActiveProfile().apiKey).toBe('k')
  })
  it('pins preferred separately from active', () => {
    migrateLegacySettings()
    setPreferredProfile('gemini-free')
    setActiveProfile('groq-free')
    expect(getPreferredProfile().id).toBe('gemini-free')
    expect(getActiveProfile().id).toBe('groq-free')
  })
  it('auto-restores after 60min from 429', () => {
    expect(shouldAutoRestore(Date.now() - 61 * 60 * 1000)).toBe(true)
    expect(shouldAutoRestore(Date.now() - 10 * 60 * 1000)).toBe(false)
    expect(shouldAutoRestore(null)).toBe(false)
  })
})
