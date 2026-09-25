import { entryKey, SCHEDULE, type ScheduleEntry } from './schedule'

const STORAGE_KEY = 'schedule-app-schedule'

function isScheduleEntry(value: unknown): value is ScheduleEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (typeof v.catalogId === 'string' || typeof v.bookId === 'string') &&
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
  if (entries.some((e) => entryKey(e) === entryKey(entry))) return entries
  return [...entries, entry]
}

export function removeEntry(
  entries: ScheduleEntry[],
  key: string,
): ScheduleEntry[] {
  return entries.filter((e) => entryKey(e) !== key)
}

// 参考書の削除に連動して、その参考書を指すスケジュールエントリを消す。
// catalogId のエントリは学習計画自体なので残す。
export function removeBookEntries(bookId: string): ScheduleEntry[] {
  const cleaned = loadSchedule().filter((e) => e.bookId !== bookId)
  saveSchedule(cleaned)
  return cleaned
}

export function updateEntry(
  entries: ScheduleEntry[],
  key: string,
  patch: Partial<Pick<ScheduleEntry, 'startDate' | 'deadline'>>,
): ScheduleEntry[] {
  return entries.map((e) =>
    entryKey(e) === key ? { ...e, ...patch } : e,
  )
}