export const RPG_PROGRESS_SCHEMA = 1
export const RPG_PROGRESS_KEY = 'schedule-app-rpg-progress-v1'
const RPG_PROGRESS_BACKUP_KEY = 'schedule-app-rpg-progress-v1.bak'

export type RpgProgressState = {
  schemaVersion: number
  currentWorldId: number
  unlockedWorldIds: number[]
  visitedWorldIds: number[]
  clearedStageIds: string[]
  unlockedStageIds: string[]
  unlockedPathIds: string[]
  lastKnownNodeId: Record<string, string>
  settings: { reducedMotion: boolean }
}

export const DEFAULT_RPG_PROGRESS: RpgProgressState = {
  schemaVersion: RPG_PROGRESS_SCHEMA,
  currentWorldId: 1,
  unlockedWorldIds: [1],
  visitedWorldIds: [],
  clearedStageIds: [],
  unlockedStageIds: ['grass-stage-1'],
  // 2.5D SVG版 (g-*) と3D版 (p*) の両方の初期解放パスを保持する。ID衝突なし。
  unlockedPathIds: ['g-p0', 'g-p1', 'g-p2a', 'g-p3a', 'g-p4a', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p7', 'p8', 'p9', 'p10', 'w4-swim-walk', 'w4-swim'],
  lastKnownNodeId: { '1': 'g-n0' },
  settings: { reducedMotion: false },
}

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

function normalize(raw: unknown): RpgProgressState {
  const base = { ...DEFAULT_RPG_PROGRESS }
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
    // 旧セーブ救済: 3D化 (p*/w4-swim*) で追加された初期パスを既存セーブにもマージする。
    // 従来は非空なら旧配列をそのまま採用していたため、旧ユーザーは3Dで一切移動できなかった。
    unlockedPathIds: uniq([...base.unlockedPathIds, ...asStringArray(o['unlockedPathIds'])]) as string[],
    lastKnownNodeId: { ...base.lastKnownNodeId, ...lastKnownNodeId },
    settings: { reducedMotion: false },
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(RPG_PROGRESS_KEY)
  } catch {
    return null
  }
}

export function loadRpgProgress(): RpgProgressState {
  const raw = readRaw()
  if (!raw) return { ...DEFAULT_RPG_PROGRESS }
  try {
    return normalize(JSON.parse(raw))
  } catch {
    try {
      localStorage.setItem(RPG_PROGRESS_BACKUP_KEY, raw)
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_RPG_PROGRESS }
  }
}

export function saveRpgProgress(state: RpgProgressState): void {
  try {
    localStorage.setItem(RPG_PROGRESS_KEY, JSON.stringify({ ...state, schemaVersion: RPG_PROGRESS_SCHEMA }))
  } catch {
    /* ignore: storage full/blocked keeps in-memory progress */
  }
}

export function markWorldVisited(state: RpgProgressState, worldId: number): RpgProgressState {
  const id = Math.min(9, Math.max(1, Math.floor(worldId)))
  return {
    ...state,
    currentWorldId: id,
    unlockedWorldIds: uniq([...state.unlockedWorldIds, id]) as number[],
    visitedWorldIds: uniq([...state.visitedWorldIds, id]) as number[],
  }
}

export function clearRpgStage(state: RpgProgressState, stageId: string, unlockPaths: string[] = []): RpgProgressState {
  return {
    ...state,
    clearedStageIds: uniq([...state.clearedStageIds, stageId]) as string[],
    unlockedPathIds: uniq([...state.unlockedPathIds, ...unlockPaths]) as string[],
  }
}
