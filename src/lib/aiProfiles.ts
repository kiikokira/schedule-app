// src/lib/aiProfiles.ts
import { GEMINI_COMPAT_ENDPOINT, GEMINI_EXAMPLE_MODEL, GROQ_ENDPOINT, GROQ_EXAMPLE_MODEL, OPENROUTER_ENDPOINT, OPENROUTER_EXAMPLE_MODEL, getAiSettings } from './ai'

export type AiProfileId = 'gemini-free' | 'groq-free' | 'openrouter-free' | 'custom'
export type AiProfile = { id: AiProfileId; label: string; endpoint: string; model: string; apiKey: string }

const KEY = 'ai-profiles'

function defaults(): AiProfile[] {
  return [
    { id: 'gemini-free', label: 'Gemini無料枠', endpoint: GEMINI_COMPAT_ENDPOINT, model: GEMINI_EXAMPLE_MODEL, apiKey: '' },
    { id: 'groq-free', label: 'Groq無料枠', endpoint: GROQ_ENDPOINT, model: GROQ_EXAMPLE_MODEL, apiKey: '' },
    { id: 'openrouter-free', label: 'OpenRouter無料', endpoint: OPENROUTER_ENDPOINT, model: OPENROUTER_EXAMPLE_MODEL, apiKey: '' },
    { id: 'custom', label: 'カスタム', endpoint: '', model: '', apiKey: '' },
  ]
}

function read(): { profiles: AiProfile[]; activeId: AiProfileId; preferredId: AiProfileId } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { profiles?: AiProfile[]; activeId?: AiProfileId; preferredId?: AiProfileId }
    if (!p.profiles) return null
    return { profiles: p.profiles, activeId: p.activeId ?? 'gemini-free', preferredId: p.preferredId ?? 'gemini-free' }
  } catch { return null }
}

function write(state: { profiles: AiProfile[]; activeId: AiProfileId; preferredId: AiProfileId }): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function migrateLegacySettings(): void {
  if (read()) return
  const legacy = getAiSettings()
  const profiles = defaults()
  let migratedId: AiProfileId = 'gemini-free'
  if (legacy.apiKey) {
    const hit = profiles.find((p) => p.endpoint === legacy.endpoint)
    if (hit) { hit.apiKey = legacy.apiKey; if (legacy.model) hit.model = legacy.model; migratedId = hit.id }
    else { const c = profiles.find((p) => p.id === 'custom')!; c.endpoint = legacy.endpoint; c.apiKey = legacy.apiKey; c.model = legacy.model; migratedId = 'custom' }
  }
  write({ profiles, activeId: migratedId, preferredId: migratedId })
}

export function listProfiles(): AiProfile[] { migrateLegacySettings(); return read()!.profiles }
export function getActiveProfile(): AiProfile { migrateLegacySettings(); const s = read()!; return s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0] }
export function getPreferredProfile(): AiProfile { migrateLegacySettings(); const s = read()!; return s.profiles.find((p) => p.id === s.preferredId) ?? s.profiles[0] }
export function setActiveProfile(id: string): void { const s = read()!; write({ ...s, activeId: id as AiProfileId }) }
export function setPreferredProfile(id: string): void { const s = read()!; write({ ...s, preferredId: id as AiProfileId }) }
export function saveProfileApiKey(id: string, apiKey: string, model?: string): void {
  const s = read()!
  write({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, apiKey, ...(model ? { model } : {}) } : p)) })
}
export function shouldAutoRestore(last429At: number | null, now = Date.now()): boolean {
  if (last429At == null) return false
  return now - last429At >= 60 * 60 * 1000
}
