import { DEFAULT_RPG_PROGRESS, RPG_PROGRESS_KEY, RPG_PROGRESS_SCHEMA, type RpgProgressState } from './rpgProgress'
import { normalizeW1Cleared } from './rpgW1Stages'
export const RPG_PROGRESS_V2_KEY = 'schedule-app-rpg-progress-v2'
export const RPG_PROGRESS_V2_BACKUP_KEY = 'schedule-app-rpg-progress-v2.bak'

function uniq(items: (string | number)[]): (string | number)[] {
  return [...new Set(items)]
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

function asNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
}

function normalizeV2(raw: unknown): RpgProgressState {
  const base = { ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { ...DEFAULT_RPG_PROGRESS.lastKnownNodeId, '3d-1': 'n0' } }
  if (raw == null || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const currentWorldId =
    typeof o['currentWorldId'] === 'number' && Number.isFinite(o['currentWorldId'])
      ? Math.min(9, Math.max(1, Math.floor(o['currentWorldId'] as number)))
      : base.currentWorldId
  const lastKnownNodeId =
    o['lastKnownNodeId'] != null && typeof o['lastKnownNodeId'] === 'object' && !Array.isArray(o['lastKnownNodeId'])
      ? (Object.fromEntries(
          Object.entries(o['lastKnownNodeId'] as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        ) as Record<string, string>)
      : { ...base.lastKnownNodeId }
  return {
    schemaVersion: RPG_PROGRESS_SCHEMA,
    currentWorldId,
    unlockedWorldIds: uniq([...base.unlockedWorldIds, ...asNumberArray(o['unlockedWorldIds'])]) as number[],
    visitedWorldIds: asNumberArray(o['visitedWorldIds']),
    clearedStageIds: asStringArray(o['clearedStageIds']),
    unlockedStageIds: uniq([...base.unlockedStageIds, ...asStringArray(o['unlockedStageIds'])]) as string[],
    unlockedPathIds: uniq([...base.unlockedPathIds, ...asStringArray(o['unlockedPathIds'])]) as string[],
    lastKnownNodeId: { ...base.lastKnownNodeId, ...lastKnownNodeId },
    settings: { reducedMotion: false },
  }
}

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
export function saveRpgProgressV2(state: RpgProgressState): void {
  try {
    localStorage.setItem(RPG_PROGRESS_V2_KEY, JSON.stringify({ ...state, schemaVersion: RPG_PROGRESS_SCHEMA }))
  } catch {
    /* ignore: storage full/blocked keeps in-memory progress */
  }
}
export function loadRpgProgressV2(): RpgProgressState {
  try {
    const raw = localStorage.getItem(RPG_PROGRESS_V2_KEY)
    if (raw) {
      try {
        return normalizeV2(JSON.parse(raw))
      } catch {
        return { ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { ...DEFAULT_RPG_PROGRESS.lastKnownNodeId, '3d-1': 'n0' } }
      }
    }
  } catch { /* ignore */ }
  try {
    const old = localStorage.getItem(RPG_PROGRESS_KEY)
    if (old) {
      const v2 = migrateV1toV2(JSON.parse(old))
      try { localStorage.setItem(RPG_PROGRESS_V2_KEY, JSON.stringify(v2)) } catch { /* ignore */ }
      return v2
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { ...DEFAULT_RPG_PROGRESS.lastKnownNodeId, '3d-1': 'n0' } }
}
