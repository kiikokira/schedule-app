import type { BookData } from '../lib/progress'
import { formatDate, parseDate } from '../lib/progress'
import { CATALOG } from './catalog'

export type ScheduleEntry = {
  catalogId: string
  startDate: string
  deadline: string
  note?: string
}

export const SCHEDULE: ScheduleEntry[] = [
  { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
  { catalogId: 'nyumon-kaishaku-70', startDate: '2026-09-01', deadline: '2026-12-31' },
  {
    catalogId: 'sokudoku-eijukugo',
    startDate: '2026-09-01',
    deadline: '2027-03-31',
    note: 'その後も復習',
  },
  { catalogId: 'final-enshu-polaris-2', startDate: '2027-01-01', deadline: '2027-03-31' },
  { catalogId: 'the-rules-1', startDate: '2027-01-01', deadline: '2027-03-31' },
  {
    catalogId: 'eiken-jun1-tanjukugo',
    startDate: '2027-01-01',
    deadline: '2027-06-30',
    note: '以後復習',
  },
  { catalogId: 'final-mondai-nankan', startDate: '2027-04-01', deadline: '2027-06-30' },
  { catalogId: 'the-rules-2', startDate: '2027-04-01', deadline: '2027-06-30' },
  { catalogId: 'lingua-metallica', startDate: '2027-04-01', deadline: '2027-07-31' },
  { catalogId: 'the-rules-3', startDate: '2027-07-01', deadline: '2027-08-31' },
  { catalogId: 'yatteokitai-500', startDate: '2027-07-01', deadline: '2027-08-31' },
  { catalogId: 'the-rules-4', startDate: '2027-09-01', deadline: '2027-10-31' },
  { catalogId: 'porepore', startDate: '2027-09-01', deadline: '2027-11-30' },
  { catalogId: 'yatteokitai-700', startDate: '2027-12-01', deadline: '2028-01-31' },
  { catalogId: 'hyper-training-3', startDate: '2027-12-01', deadline: '2028-01-31' },
  {
    catalogId: 'sfc-eigo-kakomon',
    startDate: '2027-04-01',
    deadline: '2028-02-29',
    note: '2028年2月まで継続',
  },
  {
    catalogId: 'sfc-shoronbun',
    startDate: '2027-04-01',
    deadline: '2028-02-29',
    note: '2028年2月まで継続',
  },
]

export function scheduleEntryOf(catalogId: string): ScheduleEntry | undefined {
  return SCHEDULE.find((e) => e.catalogId === catalogId)
}

export function sortScheduleEntries(
  entries: ScheduleEntry[],
  today: string,
): ScheduleEntry[] {
  return [...entries].sort((a, b) => {
    const aOverdue = a.deadline < today
    const bOverdue = b.deadline < today
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0
  })
}

export function addDaysToDate(date: string, days: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export function suggestDeadline(startDate: string, days = 90): string {
  return addDaysToDate(startDate, days)
}

export type ApplyResult = {
  newBooks: BookData[]
  updatedBooks: BookData[]
}

export function buildApplyResult(
  registered: BookData[],
  now: Date = new Date(),
  entries: ScheduleEntry[] = SCHEDULE,
): ApplyResult {
  const nowIso = now.toISOString()
  const newBooks: BookData[] = []
  const updatedBooks: BookData[] = []

  for (const entry of entries) {
    const catalog = CATALOG.find((c) => c.id === entry.catalogId)
    if (!catalog) continue
    const existing = registered.find(
      (b) => b.catalogId === entry.catalogId || (b.catalogId === undefined && b.title === catalog.title),
    )
    if (existing) {
      updatedBooks.push({
        ...existing,
        catalogId: existing.catalogId ?? entry.catalogId,
        subject: existing.subject ?? catalog.subject,
        coverUrl: existing.coverUrl ?? catalog.coverSrc,
        deadline: entry.deadline,
        updatedAt: nowIso,
      })
    } else {
      newBooks.push({
        id: crypto.randomUUID(),
        title: catalog.title,
        subject: catalog.subject,
        totalPages: catalog.totalPages,
        coverUrl: catalog.coverSrc,
        catalogId: entry.catalogId,
        startDate: entry.startDate,
        deadline: entry.deadline,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }
  }
  return { newBooks, updatedBooks }
}