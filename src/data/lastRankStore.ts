const KEY = 'schedule-app-last-rank'

export function loadLastRank(): number | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 ? n : null
  } catch {
    return null
  }
}

export function saveLastRank(rank: number): void {
  try {
    localStorage.setItem(KEY, String(rank))
  } catch {
  }
}
