import { SCHEDULE, type ScheduleEntry } from './schedule'

const STORAGE_KEY = 'schedule-app-schedule'

function isScheduleEntry(value: unknown): value is ScheduleEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.catalogId === 'string' &&
    typeof v.startDate === 'string' &&
    typeof v.deadline === 'string' &&
    (v.note === undefined || typeof v.note === 'string') &&
    (v.completed === undefined || typeof v.completed === 'boolean')
  )
}

export function loadSchedule(): ScheduleEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SCHEDULE
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(isScheduleEntry)) return parsed
  } catch {
    // 不正なデータは無視してデフォルトを返す
  }
  return SCHEDULE
}

export function saveSchedule(entries: ScheduleEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

export function resetSchedule(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 何もしない
  }
}

export function addEntry(
  entries: ScheduleEntry[],
  entry: ScheduleEntry,
): ScheduleEntry[] {
  if (entries.some((e) => e.catalogId === entry.catalogId)) return entries
  return [...entries, entry]
}

export function removeEntry(
  entries: ScheduleEntry[],
  catalogId: string,
): ScheduleEntry[] {
  return entries.filter((e) => e.catalogId !== catalogId)
}

export function updateEntry(
  entries: ScheduleEntry[],
  catalogId: string,
  patch: Partial<Pick<ScheduleEntry, 'startDate' | 'deadline'>>,
): ScheduleEntry[] {
  return entries.map((e) =>
    e.catalogId === catalogId ? { ...e, ...patch } : e,
  )
}