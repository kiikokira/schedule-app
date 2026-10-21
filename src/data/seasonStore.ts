import { seasonIdForDate, decidePromotion, isSeasonFinalDay } from '../lib/seasonLeague'
import { pagesToExp } from '../lib/seasonExp'
export type SeasonState = { seasonId: string; div: number; exp: number; days: Record<string, number> }
const KEY = 'schedule-app-season'
export function loadSeasonState(today: string): SeasonState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as SeasonState
      if (p.seasonId === seasonIdForDate(today)) return p
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
  const next: SeasonState = { ...s, exp: s.exp + pagesToExp(pages, streak), days: { ...s.days, [today]: pages } }
  saveSeasonState(next)
  return next
}
export function applyPromotionIfNeeded(today: string, tableIds: string[], myId: string): SeasonState {
  const s = loadSeasonState(today)
  if (!isSeasonFinalDay(today)) return s
  const { promote, demote } = decidePromotion(tableIds)
  let div = s.div
  if (promote.includes(myId)) div = Math.max(1, div - 1)
  else if (demote.includes(myId)) div = Math.min(10, div + 1)
  const next: SeasonState = { seasonId: s.seasonId, div, exp: s.exp, days: s.days }
  saveSeasonState(next)
  return next
}
