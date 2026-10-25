import { seasonIdForDate, seasonDayIndex, tallyToResults, decideRoundOutcome, leagueRankForPages, leaguePopulationFor, leagueDayInfo, ROUND_SIZE, type LeagueDayResult } from '../lib/seasonLeague'
import { generateRivals, rivalPagesForDay } from '../lib/seasonRivals'
import { pagesToExp } from '../lib/seasonExp'
import { leagueRatingDelta, ratingBandForDiff, rivalRatingFor, RATING_START } from '../lib/leagueRating'
import { awardPhaseBadge } from '../lib/leagueBadges'
export type SeasonState = { seasonId: string; div: number; highestDiv: number; rating: number; ratedUpTo: string | null; round: RoundTally; phaseBestDiv: number; exp: number; days: Record<string, number>; appliedSeasonId?: string }
export type RoundTally = { w: number; d: number; l: number; lastDate: string | null }

function normalizeHighestDiv(v: unknown, fallbackDiv: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.min(10, Math.max(1, Math.round(v)))
  return fallbackDiv
}
function normalizeRating(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
}
function normalizeRatedUpTo(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
function normalizeRound(v: unknown): RoundTally {
  if (v == null || typeof v !== 'object') return { w: 0, d: 0, l: 0, lastDate: null }
  const o = v as Record<string, unknown>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)
  const lastDate = normalizeRatedUpTo(o['lastDate'])
  return { w: num(o['w']), d: num(o['d']), l: num(o['l']), lastDate }
}
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

export function startDivForHighest(h: number): number {
  if (!Number.isFinite(h)) return 10
  if (h <= 1) return 3
  if (h === 2) return 4
  if (h === 3) return 5
  if (h === 4) return 6
  if (h === 5) return 7
  if (h === 6) return 8
  return 10
}

function roundPlayed(t: RoundTally): number {
  return t.w + t.d + t.l
}

function resultOfDay(seasonId: string, div: number, dayIndex: number, myPages: number): LeagueDayResult {
  try {
    return leagueDayInfo(seasonId, div, dayIndex, myPages).result
  } catch {
    return 'draw'
  }
}

function oppRatingOf(seasonId: string, div: number, dayIndex: number, myPages: number): number {
  try {
    const rivals = generateRivals(seasonId, div)
    const pages = rivals.map((r) => ({ name: r.name, pages: rivalPagesForDay(r, dayIndex) }))
    let best = pages[0]
    for (const p of pages) {
      if (Math.abs(p.pages - myPages) < Math.abs(best.pages - myPages)) best = p
    }
    const hit = rivals.find((r) => r.name === best.name) ?? rivals[0]
    return rivalRatingFor(hit.id, div)
  } catch {
    return RATING_START
  }
}

export function appendRoundMatches(s: SeasonState, div: number, matches: { date: string; result: LeagueDayResult }[]): SeasonState {
  const t = { ...s.round }
  const ordered = [...matches]
    .filter((m) => typeof m.date === 'string' && (t.lastDate == null || m.date > t.lastDate))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  let next: SeasonState = { ...s, round: t }
  for (const m of ordered) {
    const nt = { ...next.round }
    if (m.result === 'win') nt.w += 1
    else if (m.result === 'draw') nt.d += 1
    else nt.l += 1
    nt.lastDate = m.date
    next = { ...next, round: nt }
    if (roundPlayed(nt) >= ROUND_SIZE) {
      next = applyRoundOutcome(next, div)
    }
  }
  return next
}

function applyRoundOutcome(s: SeasonState, div: number): SeasonState {
  const outcome = decideRoundOutcome(div, tallyToResults(s.round))
  let nextDiv = div
  if (outcome === 'promote') nextDiv = Math.max(1, div - 1)
  else if (outcome === 'relegate') nextDiv = Math.min(10, div + 1)
  const highestDiv = Math.min(s.highestDiv, nextDiv)
  const phaseBestDiv = Math.min(s.phaseBestDiv, nextDiv)
  const rating = nextDiv <= 3 && div > 3 ? RATING_START : s.rating
  return { ...s, div: nextDiv, highestDiv, phaseBestDiv, rating, round: { w: 0, d: 0, l: 0, lastDate: s.round.lastDate } }
}

export function finalizeRoundEarly(s: SeasonState, today: string): SeasonState {
  if (s.div < 4 || s.div > 10) return s
  if (roundPlayed(s.round) >= ROUND_SIZE) return s
  if (decideRoundOutcome(s.div, tallyToResults(s.round)) !== 'promote') return s
  const lastDate = typeof today === 'string' && today.length === 10 && (s.round.lastDate == null || today > s.round.lastDate) ? today : s.round.lastDate
  return applyRoundOutcome({ ...s, round: { ...s.round, lastDate } }, s.div)
}

export function applyMatchRatings(s: SeasonState, div: number, entries: { date: string; result: LeagueDayResult; oppRating: number }[]): SeasonState {
  if (div < 1 || div > 3) return s
  let rating = s.rating
  let ratedUpTo = s.ratedUpTo
  const ordered = [...entries]
    .filter((e) => typeof e.date === 'string' && (ratedUpTo == null || e.date > ratedUpTo))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const e of ordered) {
    const band = ratingBandForDiff(e.oppRating - rating)
    rating = Math.max(0, rating + leagueRatingDelta(band, e.result, e.date))
    ratedUpTo = e.date
  }
  return { ...s, rating, ratedUpTo }
}

export function syncLeagueDay(today: string, days: Record<string, number>, div: number, seasonId: string): SeasonState {
  void seasonId
  let s = loadSeasonState(today)
  if (typeof today !== 'string' || today.length !== 10) return s
  s = { ...s, div, highestDiv: Math.min(s.highestDiv, div), phaseBestDiv: Math.min(s.phaseBestDiv, div) }
  const playedDates = Object.keys(days ?? {}).filter((d) => (days[d] ?? 0) > 0).sort()
  const matches = playedDates.map((date) => {
    const dayIndex = Math.max(0, seasonDayIndex(date))
    const myPages = days[date] ?? 0
    const sid = seasonIdForDate(date)
    return { date, result: resultOfDay(sid, div, dayIndex, myPages), opp: oppRatingOf(sid, div, dayIndex, myPages) }
  })
  s = applyMatchRatings(s, div, matches.map((m) => ({ date: m.date, result: m.result, oppRating: m.opp })))
  s = appendRoundMatches(s, div, matches.map((m) => ({ date: m.date, result: m.result })))
  saveSeasonState(s)
  return s
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
          const highestDiv = normalizeHighestDiv((p as unknown as Record<string, unknown>)['highestDiv'], div)
          const phaseBestDiv = normalizeHighestDiv((p as unknown as Record<string, unknown>)['phaseBestDiv'], div)
          const rating = normalizeRating((p as unknown as Record<string, unknown>)['rating'])
          const ratedUpTo = normalizeRatedUpTo((p as unknown as Record<string, unknown>)['ratedUpTo'])
          const round = normalizeRound((p as unknown as Record<string, unknown>)['round'])
          const next: SeasonState = { seasonId: currentId, div, highestDiv, phaseBestDiv, rating, ratedUpTo, round, exp, days }
          if (applied) next.appliedSeasonId = applied
          return next
        }
        const prevDiv = clampDiv((p as unknown as Record<string, unknown>)['div'])
        const prevHighest = normalizeHighestDiv((p as unknown as Record<string, unknown>)['highestDiv'], prevDiv)
        const prevPhaseBest = normalizeHighestDiv((p as unknown as Record<string, unknown>)['phaseBestDiv'], prevDiv)
        const prevDays = days
        const playedCount = Object.keys(prevDays).filter((d) => (prevDays[d] ?? 0) > 0).length
        const prevCum = Object.values(prevDays).reduce((a, b) => a + b, 0)
        const prevPop = leaguePopulationFor(prevId)
        const finalRank = leagueRankForPages(prevCum, prevPop)
        awardPhaseBadge(prevId, { bestDiv: prevPhaseBest, finalRank, played: playedCount })
        const highestDiv = Math.min(prevHighest, prevDiv)
        const newDiv = startDivForHighest(highestDiv)
        const rolled: SeasonState = { seasonId: currentId, div: newDiv, highestDiv, phaseBestDiv: newDiv, rating: newDiv <= 3 ? RATING_START : 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {}, appliedSeasonId: prevId }
        try {
          localStorage.setItem(KEY, JSON.stringify(rolled))
        } catch { /* ignore */ }
        return rolled
      }
    }
  } catch { /* ignore */ }
  try {
    return { seasonId: seasonIdForDate(today), div: 10, highestDiv: 10, phaseBestDiv: 10, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} }
  } catch {
    return { seasonId: '2026-09-01', div: 10, highestDiv: 10, phaseBestDiv: 10, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} }
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
      return { seasonId: '2026-09-01', div: 10, highestDiv: 10, phaseBestDiv: 10, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} }
    }
  }
}
