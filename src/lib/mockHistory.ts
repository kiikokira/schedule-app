export type MockRecord = { ym: string; rank: number; deviation: number; pages: number }

const KEY = 'schedule-app-mock-history'

export function loadMockHistory(): MockRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MockRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r) => typeof r?.ym === 'string')
  } catch {
    return []
  }
}

function saveMockHistory(h: MockRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(h))
}

export function recordMockIfNeeded(today: string, rank: number, deviation: number, pages: number): MockRecord[] {
  const history = loadMockHistory()
  const day = Number(today.slice(8, 10))
  if (!(day >= 1 && day <= 7)) return history
  const ym = today.slice(0, 7)
  if (history.some((r) => r.ym === ym)) return history
  const next = [...history, { ym, rank, deviation, pages }].sort((a, b) => (a.ym < b.ym ? -1 : 1))
  saveMockHistory(next)
  return next
}
