const ANCHOR = '2026-09-01'
function toUTC(d: string): number { return Date.parse(d + 'T00:00:00Z') }
export function seasonStartForDate(date: string): string {
  const diff = Math.floor((toUTC(date) - toUTC(ANCHOR)) / 86400000)
  const block = Math.floor(diff / 28)
  const t = new Date(toUTC(ANCHOR) + block * 28 * 86400000)
  return t.toISOString().slice(0, 10)
}
export function seasonIdForDate(date: string): string { return seasonStartForDate(date) }
export function seasonDayIndex(date: string): number {
  return Math.floor((toUTC(date) - toUTC(seasonStartForDate(date))) / 86400000)
}
export function isSeasonFinalDay(date: string): boolean { return seasonDayIndex(date) === 27 }
export function decidePromotion(sortedIds: string[]): { promote: string[]; demote: string[] } {
  return { promote: sortedIds.slice(0, 2), demote: sortedIds.slice(-2) }
}
