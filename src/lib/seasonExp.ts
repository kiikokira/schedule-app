export function comboMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 1.5
  if (streakDays >= 3) return 1.2
  return 1
}
export function pagesToExp(pages: number, streakDays: number): number {
  return Math.round(pages * 10 * comboMultiplier(streakDays))
}
export function levelForExp(exp: number): number {
  return Math.floor(exp / 1000) + 1
}
