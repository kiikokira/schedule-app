import { generateRivals, rivalPagesForDay, hashSeed, mulberry32 } from './seasonRivals'

// リーグpt換算率。記録ページ数をそのままptにすると数回の記録で数百ptになり
// 一気に上がって見えるため、自分・ライバル共通で緩やかにする。
// 正の線形変換なので順位・勝敗・前日比の正負は不変（平等性維持）。
// 変更時はこの1箇所だけ変える。
export const LEAGUE_PT_RATE = 0.2

export function leaguePointsForPages(pages: number): number {
  if (!Number.isFinite(pages) || pages <= 0) return 0
  return Math.round(pages * LEAGUE_PT_RATE)
}

const ANCHOR = '2026-09-01'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function isValidDateString(d: unknown): d is string {
  if (typeof d !== 'string' || !DATE_RE.test(d)) return false
  const t = Date.parse(d + 'T00:00:00Z')
  if (!Number.isFinite(t)) return false
  const iso = new Date(t).toISOString().slice(0, 10)
  return iso === d
}
export function toUTC(d: string): number {
  if (!isValidDateString(d)) return NaN
  return Date.parse(d + 'T00:00:00Z')
}
export function parseSeasonDate(d: string): number {
  return toUTC(d)
}
export function seasonStartForDate(date: string): string {
  try {
    if (!isValidDateString(date)) return ANCHOR
    const diff = Math.floor((toUTC(date) - toUTC(ANCHOR)) / 86400000)
    if (!Number.isFinite(diff)) return ANCHOR
    const block = Math.floor(diff / 28)
    if (!Number.isFinite(block)) return ANCHOR
    const t = new Date(toUTC(ANCHOR) + block * 28 * 86400000)
    if (Number.isNaN(t.getTime())) return ANCHOR
    return t.toISOString().slice(0, 10)
  } catch {
    return ANCHOR
  }
}
export function seasonIdForDate(date: string): string {
  try {
    return seasonStartForDate(date)
  } catch {
    return ANCHOR
  }
}
export function seasonDayIndex(date: string): number {
  try {
    if (!isValidDateString(date)) return 0
    const start = seasonStartForDate(date)
    const diff = Math.floor((toUTC(date) - toUTC(start)) / 86400000)
    if (!Number.isFinite(diff)) return 0
    return Math.min(27, Math.max(0, diff))
  } catch {
    return 0
  }
}
export function isSeasonFinalDay(date: string): boolean {
  try {
    return seasonDayIndex(date) === 27
  } catch {
    return false
  }
}
export function decidePromotion(sortedIds: string[]): { promote: string[]; demote: string[] } {
  if (!Array.isArray(sortedIds) || sortedIds.length < 4) return { promote: [], demote: [] }
  return { promote: sortedIds.slice(0, 2), demote: sortedIds.slice(-2) }
}
export function seasonEndForDate(date: string): string {
  try {
    const start = seasonStartForDate(date)
    const t = toUTC(start) + 27 * 86400000
    if (!Number.isFinite(t)) return start
    return new Date(t).toISOString().slice(0, 10)
  } catch {
    return seasonStartForDate(date)
  }
}
export type LeagueDayResult = 'win' | 'draw' | 'loss'
export type LeagueDayInfo = { average: number; opponent: string; opponentPages: number; result: LeagueDayResult }
// 節ごとの対戦情報：リーグ平均・最接戦相手（当日ptが自分に最も近いライバル）・勝敗
export function leagueDayInfo(seasonId: string, div: number, dayIndex: number, myPages: number): LeagueDayInfo {
  try {
    const rivals = generateRivals(seasonId, div)
    if (rivals.length === 0) return { average: 0, opponent: '—', opponentPages: 0, result: 'draw' }
    const pages = rivals.map((r) => ({ name: r.name, pages: rivalPagesForDay(r, dayIndex) }))
    const average = Math.round(pages.reduce((s, p) => s + p.pages, 0) / pages.length)
    let opponent = pages[0]
    for (const p of pages) {
      if (Math.abs(p.pages - myPages) < Math.abs(opponent.pages - myPages)) opponent = p
    }
    const result: LeagueDayResult = myPages > average ? 'win' : myPages < average ? 'loss' : 'draw'
    return { average, opponent: opponent.name, opponentPages: opponent.pages, result }
  } catch {
    return { average: 0, opponent: '—', opponentPages: 0, result: 'draw' }
  }
}
// 1日1節として当日の自分pt vs リーグ当日平均で勝敗を判定する
export function leagueDayResults(seasonId: string, div: number, myDaily: number[]): LeagueDayResult[] {
  try {
    const rivals = generateRivals(seasonId, div)
    if (rivals.length === 0) return myDaily.map(() => 'draw' as const)
    return myDaily.map((mine, i) => {
      const avg = Math.round(rivals.reduce((s, r) => s + rivalPagesForDay(r, i), 0) / rivals.length)
      if (mine > avg) return 'win' as const
      if (mine < avg) return 'loss' as const
      return 'draw' as const
    })
  } catch {
    return myDaily.map(() => 'draw' as const)
  }
}
export const ROUND_SIZE = 10
export const ROUND_WIN_POINTS = { win: 3, draw: 1, loss: 0 } as const
export const PROMOTION_LINES: Record<number, number> = { 10: 3, 9: 6, 8: 9, 7: 12, 6: 15, 5: 18, 4: 22 }
export const STAY_LINES: Partial<Record<number, number>> = { 8: 6, 7: 9, 5: 15, 4: 19 }
export type RoundOutcome = 'promote' | 'stay' | 'relegate' | 'undecided'
export function roundPoints(results: LeagueDayResult[]): number {
  return results.reduce((s, r) => s + ROUND_WIN_POINTS[r], 0)
}
export function tallyToResults(tally: { w: number; d: number; l: number }): LeagueDayResult[] {
  return [...Array(tally.w).fill('win'), ...Array(tally.d).fill('draw'), ...Array(tally.l).fill('loss')] as LeagueDayResult[]
}
export function decideRoundOutcome(div: number, results: LeagueDayResult[]): RoundOutcome {
  const promo = PROMOTION_LINES[div]
  if (promo === undefined) return 'undecided'
  const played = results.slice(0, ROUND_SIZE)
  const pts = roundPoints(played)
  const remaining = Math.max(0, ROUND_SIZE - played.length)
  const minFinal = pts
  const maxFinal = pts + 3 * remaining
  if (minFinal >= promo) return 'promote'
  const stay = STAY_LINES[div]
  if (stay === undefined) return played.length >= ROUND_SIZE || maxFinal < promo ? 'stay' : 'undecided'
  if (maxFinal < stay) return 'relegate'
  if (minFinal >= stay && maxFinal < promo) return 'stay'
  if (played.length >= ROUND_SIZE) return pts >= promo ? 'promote' : pts < stay ? 'relegate' : 'stay'
  return 'undecided'
}
export function leaguePopulationFor(seasonId: string): number {
  let key = seasonId
  try {
    key = seasonIdForDate(seasonId)
  } catch {
    key = seasonId
  }
  const rand = mulberry32(hashSeed(`league-pop-${key}`))
  return 2000000 + Math.floor(rand() * 3000001)
}
function lognormalCdf(pages: number, median: number, sigma: number): number {
  if (pages <= 0) return 0
  const z = (Math.log(pages) - Math.log(median)) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return Math.min(Math.max(p, 0), 1)
}
export function leagueRankForPages(pages: number, population: number): number {
  const pop = Math.max(1, Math.round(population))
  if (pages <= 0) return pop
  const rank = Math.round(pop * (1 - lognormalCdf(pages, 300, 0.9)))
  return Math.min(Math.max(rank, 1), pop)
}
// Div3〜1用：レーティング基準の順位。母集団popで変動（固定にしない）。
// 平均pop=300万で1900→約100万、2000→約60万（必ず70万切り）。 continuity at 1900.
export function leagueRankForRating(rating: number, population: number): number {
  const pop = Math.max(1, Math.round(population))
  if (!Number.isFinite(rating) || rating <= 1200) return pop
  const A1 = 0.001569
  const A2 = 0.00511
  const base1900 = Math.exp(-A1 * 700)
  let rank: number
  if (rating <= 1900) {
    rank = pop * Math.exp(-A1 * (rating - 1200))
  } else {
    rank = pop * base1900 * Math.exp(-A2 * (rating - 1900))
    if (rating >= 2000) rank = Math.min(rank, 699999)
  }
  return Math.min(Math.max(Math.round(rank), 1), pop)
}
