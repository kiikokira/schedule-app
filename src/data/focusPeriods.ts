export type FocusPeriod = {
  id: string
  title: string
  startDate: string
  endDate: string
  bookIds: string[]
}

const STORAGE_KEY = 'schedule-app-focus-periods'

function isFocusPeriod(value: unknown): value is FocusPeriod {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.startDate === 'string' &&
    typeof v.endDate === 'string' &&
    Array.isArray(v.bookIds) &&
    v.bookIds.every((b) => typeof b === 'string')
  )
}

export function loadFocusPeriods(): FocusPeriod[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(isFocusPeriod)) return parsed
  } catch {
    // 不正なデータは無視して空を返す
  }
  return []
}

export function saveFocusPeriods(periods: FocusPeriod[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(periods))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

// 今日が範囲内（両端含む）の期間だけ返す。
export function activeFocusPeriods(periods: FocusPeriod[], today: string): FocusPeriod[] {
  return periods.filter((p) => p.startDate <= today && today <= p.endDate)
}

// 期間中は選択本IDの合算、期間外は null（絞り込みなし）を返す。
export function selectedBookIds(periods: FocusPeriod[], today: string): string[] | null {
  const active = activeFocusPeriods(periods, today)
  if (active.length === 0) return null
  const ids: string[] = []
  for (const p of active) {
    for (const id of p.bookIds) {
      if (!ids.includes(id)) ids.push(id)
    }
  }
  return ids
}
