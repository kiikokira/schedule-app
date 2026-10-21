import { seasonIdForDate, decidePromotion, isSeasonFinalDay } from '../lib/seasonLeague'
import { pagesToExp } from '../lib/seasonExp'
export type SeasonState = { seasonId: string; div: number; exp: number; days: Record<string, number>; appliedSeasonId?: string }
const KEY = 'schedule-app-season'
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
export function loadSeasonState(today: string): SeasonState {
  const currentId = seasonIdForDate(today)
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as SeasonState
      if (p && typeof p === 'object') {
        const div = clampDiv((p as unknown as Record<string, unknown>)['div'])
        const days = normalizeDays((p as unknown as Record<string, unknown>)['days'])
        const exp = normalizeExp((p as unknown as Record<string, unknown>)['exp'])
        const applied = readApplied(p)
        if ((p as SeasonState).seasonId === currentId) {
          const next: SeasonState = { seasonId: currentId, div, exp, days }
          if (applied) next.appliedSeasonId = applied
          return next
        }
        const rolled: SeasonState = { seasonId: currentId, div, exp: 0, days: {} }
        if (applied) rolled.appliedSeasonId = applied
        return rolled
      }
    }
  } catch { /* ignore */ }
  return { seasonId: seasonIdForDate(today), div: 10, exp: 0, days: {} }
}
export function saveSeasonState(s: SeasonState): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
export function recordSeasonDay(today: string, pages: number, streak: number): SeasonState {
  const s = loadSeasonState(today)
  if (s.days[today] === pages) return s
  const oldPages = s.days[today]
  const oldExp = typeof oldPages === 'number' && Number.isFinite(oldPages) ? pagesToExp(oldPages, streak) : 0
  const exp = Math.max(0, s.exp - oldExp + pagesToExp(pages, streak))
  const next: SeasonState = { ...s, exp, days: { ...s.days, [today]: pages } }
  saveSeasonState(next)
  return next
}
export function applyPromotionIfNeeded(today: string, tableIds: string[], myId: string): SeasonState {
  const s = loadSeasonState(today)
  if (!isSeasonFinalDay(today)) return s
  const applied = s.appliedSeasonId ?? (s as unknown as Record<string, unknown>)['lastAppliedSeasonId']
  if (applied === s.seasonId) return s
  const { promote, demote } = decidePromotion(tableIds)
  let div = s.div
  if (promote.includes(myId)) div = Math.max(1, div - 1)
  else if (demote.includes(myId)) div = Math.min(10, div + 1)
  const next: SeasonState = { seasonId: s.seasonId, div, exp: s.exp, days: s.days, appliedSeasonId: s.seasonId }
  saveSeasonState(next)
  return next
}
