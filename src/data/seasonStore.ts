import { seasonIdForDate, decidePromotion, isSeasonFinalDay } from '../lib/seasonLeague'
import { generateRivals, rivalPagesForDay } from '../lib/seasonRivals'
import { pagesToExp } from '../lib/seasonExp'
export type SeasonState = { seasonId: string; div: number; exp: number; days: Record<string, number>; appliedSeasonId?: string }
// NOTE: Dexie導入は見送り（完全オフライン/localStorageのみで運用）。将来Dexie化する場合は
// seasons/seasonDays/rivals/player の4テーブル相当をこのモジュールのI/O境界に集約して移行する。
// KEY versioned: v1へ改名。旧キー schedule-app-season が残っていれば初回のみ移行して読み替える。
const KEY = 'schedule-app-season-v1'
const LEGACY_KEY = 'schedule-app-season'
function clampDiv(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 10
  return Math.min(10, Math.max(1, Math.round(v)))
}
function normalizeDays(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val
  }
  return out
}
function normalizeExp(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
}
function readApplied(p: unknown): string | undefined {
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>
    if (typeof o['appliedSeasonId'] === 'string') return o['appliedSeasonId'] as string
    if (typeof o['lastAppliedSeasonId'] === 'string') return o['lastAppliedSeasonId'] as string
  }
  return undefined
}
function readRaw(): string | null {
  try {
    const v1 = localStorage.getItem(KEY)
    if (v1 != null) return v1
    const legacy = localStorage.getItem(LEGACY_KEY)
    return legacy
  } catch {
    return null
  }
}

function resolvePendingDiv(prevSeasonId: string, prevDiv: number, prevDays: Record<string, number>, prevApplied: string | undefined): { div: number; applied: string | undefined } {
  if (prevApplied === prevSeasonId) return { div: prevDiv, applied: prevApplied }
  const vals = Object.values(prevDays ?? {})
  // Best-effort: empty or sparse (fewer than 7 recorded days) keeps div to avoid
  // demoting on insufficient data (e.g. single-day smoke data in tests).
  if (vals.length === 0) return { div: prevDiv, applied: prevApplied ?? prevSeasonId }
  if (vals.length < 7) return { div: prevDiv, applied: prevApplied ?? prevSeasonId }
  try {
    const rivals = generateRivals(prevSeasonId, prevDiv)
    const myCum = vals.reduce((s, v) => s + v, 0)
    const rows = [
      { id: '__you__', cum: myCum },
      ...rivals.map((r) => {
        let cum = 0
        for (let d = 0; d <= 27; d++) cum += rivalPagesForDay(r, d)
        return { id: r.id, cum }
      }),
    ].sort((a, b) => b.cum - a.cum)
    const { promote, demote } = decidePromotion(rows.map((r) => r.id))
    let div = prevDiv
    if (promote.includes('__you__')) div = Math.max(1, div - 1)
    else if (demote.includes('__you__')) div = Math.min(10, div + 1)
    return { div, applied: prevSeasonId }
  } catch {
    return { div: prevDiv, applied: prevApplied ?? prevSeasonId }
  }
}

export function loadSeasonState(today: string): SeasonState {
  let currentId: string
  try {
    currentId = seasonIdForDate(today)
  } catch {
    currentId = '2026-09-01'
  }
  try {
    const raw = readRaw()
    if (raw) {
      const p = JSON.parse(raw) as SeasonState
      if (p && typeof p === 'object') {
        const div = clampDiv((p as unknown as Record<string, unknown>)['div'])
        const days = normalizeDays((p as unknown as Record<string, unknown>)['days'])
        const exp = normalizeExp((p as unknown as Record<string, unknown>)['exp'])
        const applied = readApplied(p)
        const prevId = typeof (p as SeasonState).seasonId === 'string' ? (p as SeasonState).seasonId : currentId
        if (prevId === currentId) {
          const next: SeasonState = { seasonId: currentId, div, exp, days }
          if (applied) next.appliedSeasonId = applied
          return next
        }
        // Rollover: previous season ended without opening final day.
        // Best-effort: apply pending promotion from stored days before reset.
        const pending = resolvePendingDiv(prevId, div, days, applied)
        const rolled: SeasonState = { seasonId: currentId, div: pending.div, exp: 0, days: {} }
        if (pending.applied) rolled.appliedSeasonId = pending.applied
        try {
          localStorage.setItem(KEY, JSON.stringify(rolled))
        } catch { /* ignore */ }
        return rolled
      }
    }
  } catch { /* ignore */ }
  try {
    return { seasonId: seasonIdForDate(today), div: 10, exp: 0, days: {} }
  } catch {
    return { seasonId: '2026-09-01', div: 10, exp: 0, days: {} }
  }
}
export function saveSeasonState(s: SeasonState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}
export function recordSeasonDay(today: string, pages: number, streak: number): SeasonState {
  try {
    const s = loadSeasonState(today)
    if (typeof today !== 'string' || today.length !== 10) return s
    const safePages = typeof pages === 'number' && Number.isFinite(pages) && pages >= 0 ? Math.floor(pages) : 0
    const safeStreak = typeof streak === 'number' && Number.isFinite(streak) && streak >= 0 ? Math.floor(streak) : 0
    if (s.days[today] === safePages) return s
    const oldPages = s.days[today]
    const oldExp = typeof oldPages === 'number' && Number.isFinite(oldPages) ? pagesToExp(oldPages, safeStreak) : 0
    const exp = Math.max(0, s.exp - oldExp + pagesToExp(safePages, safeStreak))
    const next: SeasonState = { ...s, exp, days: { ...s.days, [today]: safePages } }
    saveSeasonState(next)
    return next
  } catch {
    try {
      return loadSeasonState(today)
    } catch {
      return { seasonId: '2026-09-01', div: 10, exp: 0, days: {} }
    }
  }
}
export function applyPromotionIfNeeded(today: string, tableIds: string[], myId: string): SeasonState {
  try {
    const s = loadSeasonState(today)
    try {
      if (!isSeasonFinalDay(today)) return s
    } catch {
      return s
    }
    const applied = s.appliedSeasonId ?? (s as unknown as Record<string, unknown>)['lastAppliedSeasonId']
    if (applied === s.seasonId) return s
    if (!Array.isArray(tableIds) || tableIds.length < 4) return s
    const { promote, demote } = decidePromotion(tableIds)
    let div = s.div
    if (promote.includes(myId)) div = Math.max(1, div - 1)
    else if (demote.includes(myId)) div = Math.min(10, div + 1)
    const next: SeasonState = { seasonId: s.seasonId, div, exp: s.exp, days: s.days, appliedSeasonId: s.seasonId }
    saveSeasonState(next)
    return next
  } catch {
    try {
      return loadSeasonState(today)
    } catch {
      return { seasonId: '2026-09-01', div: 10, exp: 0, days: {} }
    }
  }
}
