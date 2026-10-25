import { generateRivals, rivalPagesForDay } from './seasonRivals'

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
