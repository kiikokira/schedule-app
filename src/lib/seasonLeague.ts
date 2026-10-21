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
