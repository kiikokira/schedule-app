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
    if (Array.isArray(parsed) && parsed.every(isScheduleEntry)) {
      const migrated = migrateOldDefaults(parsed)
      if (migrated.changed) saveSchedule(migrated.entries)
      return migrated.entries
    }
  } catch {
    // 不正なデータは無視してデフォルトを返す
  }
  return SCHEDULE
}

function migrateOldDefaults(entries: ScheduleEntry[]): {
  entries: ScheduleEntry[]
  changed: boolean
} {
  // 旧既定→新既定の対応表: new値は src/data/schedule.ts SCHEDULE と一致、old値は移行前の既定値（SFC2冊は不変のため除外）。
  const OLD_DEFAULT_TO_NEW: Record<
    string,
    { oldStart: string; oldDeadline: string; newStart: string; newDeadline: string }
  > = {
  'eibunpo-polaris-2': { oldStart: '2026-09-21', oldDeadline: '2026-09-30', newStart: '2026-10-01', newDeadline: '2026-10-10' },
  'nyumon-kaishaku-70': { oldStart: '2026-09-21', oldDeadline: '2026-11-20', newStart: '2026-10-01', newDeadline: '2026-11-30' },
  'sokudoku-eijukugo': { oldStart: '2026-09-21', oldDeadline: '2027-01-31', newStart: '2026-10-01', newDeadline: '2027-02-10' },
  'leap': { oldStart: '2026-09-26', oldDeadline: '2026-10-15', newStart: '2026-10-06', newDeadline: '2026-10-25' },
  'final-enshu-polaris-2': { oldStart: '2026-10-01', oldDeadline: '2026-12-31', newStart: '2026-10-11', newDeadline: '2027-01-10' },
  'the-rules-1': { oldStart: '2026-11-01', oldDeadline: '2027-01-31', newStart: '2026-11-11', newDeadline: '2027-02-10' },
  'eiken-jun1-tanjukugo': { oldStart: '2026-11-01', oldDeadline: '2027-04-30', newStart: '2026-11-11', newDeadline: '2027-05-10' },
  'final-mondai-nankan': { oldStart: '2027-01-01', oldDeadline: '2027-03-31', newStart: '2027-01-11', newDeadline: '2027-04-10' },
  'the-rules-2': { oldStart: '2027-02-01', oldDeadline: '2027-03-31', newStart: '2027-02-11', newDeadline: '2027-04-10' },
  'lingua-metallica': { oldStart: '2027-02-01', oldDeadline: '2027-04-30', newStart: '2027-02-11', newDeadline: '2027-05-10' },
  'the-rules-3': { oldStart: '2027-04-01', oldDeadline: '2027-05-31', newStart: '2027-04-11', newDeadline: '2027-06-10' },
  'yatteokitai-500': { oldStart: '2027-04-15', oldDeadline: '2027-06-15', newStart: '2027-04-25', newDeadline: '2027-06-25' },
  'the-rules-4': { oldStart: '2027-05-15', oldDeadline: '2027-07-15', newStart: '2027-05-25', newDeadline: '2027-07-25' },
  'porepore': { oldStart: '2027-05-15', oldDeadline: '2027-07-31', newStart: '2027-05-25', newDeadline: '2027-08-10' },
  'yatteokitai-700': { oldStart: '2027-06-16', oldDeadline: '2027-08-15', newStart: '2027-06-26', newDeadline: '2027-08-25' },
  'hyper-training-3': { oldStart: '2027-07-16', oldDeadline: '2027-08-31', newStart: '2027-07-26', newDeadline: '2027-08-31' },
  }

  let changed = false
  const next = entries.map((e) => {
    // bookId エントリは移行対象外
    if (e.bookId !== undefined || e.catalogId === undefined) return e
    const mapping = OLD_DEFAULT_TO_NEW[e.catalogId]
    if (!mapping) return e
    if (e.startDate !== mapping.oldStart || e.deadline !== mapping.oldDeadline) return e
    changed = true
    return { ...e, startDate: mapping.newStart, deadline: mapping.newDeadline }
  })
  return { entries: next, changed }
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

// 参考書の開始日・期限日の編集をスケジュール側に反映する。
// bookIdのエントリがあればそれを、なければ同じcatalogIdのエントリを更新する。
export function syncEntryDatesForBook(
  entries: ScheduleEntry[],
  book: { id: string; catalogId?: string; startDate: string; deadline: string },
): ScheduleEntry[] {
  return entries.map((e) => {
    if (e.bookId === book.id) {
      return { ...e, startDate: book.startDate, deadline: book.deadline }
    }
    if (!e.bookId && book.catalogId !== undefined && e.catalogId === book.catalogId) {
      return { ...e, startDate: book.startDate, deadline: book.deadline }
    }
    return e
  })
}