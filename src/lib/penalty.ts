export type Severity = 'mild' | 'normal' | 'strict'

const POINTS_PER_SEVERITY: Record<Severity, number> = {
  mild: 5,
  normal: 10,
  strict: 20,
}

export const MAX_POINTS_PER_DAY = 100
export const MAX_PAGE_DEBT = 500
export const RECOVERY_PER_GOOD_DAY = 5

export function isMissingDay(targetBookIds: string[], recordedBookIds: Set<string>): boolean {
  return targetBookIds.some((id) => !recordedBookIds.has(id))
}

export function calcDebtForDate(
  planned: { bookId: string, pages: number }[],
  cyclePlanned: { bookId: string, units: number }[],
  recordedBookIds: Set<string>,
): { pageDebt: number, unitDebt: Record<string, number> } {
  const raw = planned
    .filter((p) => !recordedBookIds.has(p.bookId))
    .reduce((sum, p) => sum + p.pages, 0)
  const pageDebt = Math.min(raw, MAX_PAGE_DEBT)
  const unitDebt: Record<string, number> = {}
  for (const c of cyclePlanned) {
    if (!recordedBookIds.has(c.bookId)) {
      unitDebt[c.bookId] = (unitDebt[c.bookId] ?? 0) + c.units
    }
  }
  return { pageDebt, unitDebt }
}

export function calcPenaltyPoints(missingCount: number, severity: Severity): number {
  return Math.min(Math.max(missingCount, 0) * POINTS_PER_SEVERITY[severity], MAX_POINTS_PER_DAY)
}

export function calcOutstanding(
  pageDebts: { date: string, pageDebt: number }[],
  repayments: { date: string, excessPages: number }[],
): number {
  const debt = pageDebts.reduce((sum, d) => sum + d.pageDebt, 0)
  const repaid = repayments.reduce((sum, r) => sum + r.excessPages, 0)
  return Math.max(debt - repaid, 0)
}

export function calcTotalPoints(
  dailyPoints: { date: string, points: number }[],
  goodDayCount: number,
): number {
  const sum = dailyPoints.reduce((total, d) => total + d.points, 0)
  return Math.max(sum - RECOVERY_PER_GOOD_DAY * goodDayCount, 0)
}

export function calcQuestToday(todayPlanned: number, outstanding: number): number {
  return todayPlanned + outstanding
}

export function calcStreak(daily: { date: string, isMiss: boolean, hasPlan: boolean }[]): number {
  let streak = 0
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i]
    if (d.hasPlan && d.isMiss) break
    streak += 1
  }
  return streak
}

export function rankForPoints(total: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (total <= 0) return 'S'
  if (total <= 29) return 'A'
  if (total <= 49) return 'B'
  if (total <= 99) return 'C'
  return 'D'
}
