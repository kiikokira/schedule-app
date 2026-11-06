import { DEFAULT_RPG_PROGRESS, type RpgProgressState } from './rpgProgress'
import { normalizeW1Cleared } from './rpgW1Stages'
export const RPG_PROGRESS_V2_KEY = 'schedule-app-rpg-progress-v2'
export const RPG_PROGRESS_V2_BACKUP_KEY = 'schedule-app-rpg-progress-v2.bak'
export function migrateV1toV2(v1: unknown): RpgProgressState {
  if (v1 == null || typeof v1 !== 'object') return { ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { ...DEFAULT_RPG_PROGRESS.lastKnownNodeId, '3d-1': 'n0' } }
  const o = v1 as RpgProgressState
  const cleared = normalizeW1Cleared([...(o.clearedStageIds ?? [])])
  return {
    ...DEFAULT_RPG_PROGRESS,
    currentWorldId: 1,
    clearedStageIds: [...cleared],
    unlockedStageIds: [...DEFAULT_RPG_PROGRESS.unlockedStageIds],
    unlockedPathIds: [...DEFAULT_RPG_PROGRESS.unlockedPathIds],
    lastKnownNodeId: { ...(o.lastKnownNodeId ?? {}), '3d-1': 'n0' },
    settings: { reducedMotion: false },
  }
}
export function loadRpgProgressV2(): RpgProgressState {
  try {
    const raw = localStorage.getItem(RPG_PROGRESS_V2_KEY)
    if (raw) return { ...DEFAULT_RPG_PROGRESS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  try {
    const old = localStorage.getItem('schedule-app-rpg-progress-v1')
    if (old) {
      const v2 = migrateV1toV2(JSON.parse(old))
      try { localStorage.setItem(RPG_PROGRESS_V2_KEY, JSON.stringify(v2)) } catch { /* ignore */ }
      return v2
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { ...DEFAULT_RPG_PROGRESS.lastKnownNodeId, '3d-1': 'n0' } }
}
