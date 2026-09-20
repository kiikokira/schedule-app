import type { BookData } from '../lib/progress'
import { todayStr } from '../lib/progress'
import { CATALOG } from './catalog'

export type SchedulePhase = {
  id: string
  label: string
  deadline: string
  bookIds: string[]
}

export const SCHEDULE_PHASES: SchedulePhase[] = [
  {
    id: 'high2-spring',
    label: '高2春休み前',
    deadline: '2027-03-31',
    bookIds: ['leap', 'oiwa-eibunpo', 'eibunpo-polaris-1', 'sokudoku-eijukugo'],
  },
  {
    id: 'high2-summer-before',
    label: '高2夏休み前',
    deadline: '2027-07-15',
    bookIds: ['leap', 'sokudoku-eijukugo', 'eibunpo-polaris-2', 'final-enshu-polaris-2'],
  },
  {
    id: 'high2-summer',
    label: '高2夏休み中',
    deadline: '2027-08-31',
    bookIds: ['eiken-jun1-tanjukugo', 'the-rules-1', 'the-rules-2', 'nyumon-kaishaku-70'],
  },
  {
    id: 'high2-winter',
    label: '高2冬休み前',
    deadline: '2027-12-15',
    bookIds: ['levelbetsu-4', 'the-rules-3', 'the-rules-4'],
  },
  {
    id: 'high3-spring',
    label: '高3春休み前',
    deadline: '2028-03-31',
    bookIds: ['lingua-metallica', 'yatteokitai-500', 'porepore'],
  },
  {
    id: 'high3-summer-before',
    label: '高3夏休み前',
    deadline: '2028-07-15',
    bookIds: ['yatteokitai-700', 'final-mondai-nankan'],
  },
  {
    id: 'high3-summer',
    label: '高3夏休み中',
    deadline: '2028-08-31',
    bookIds: ['hyper-training-3', 'yatteokitai-1000'],
  },
]

export function scheduleDeadlineOf(catalogId: string): string | undefined {
  let deadline: string | undefined
  for (const phase of SCHEDULE_PHASES) {
    if (phase.bookIds.includes(catalogId)) deadline = phase.deadline
  }
  return deadline
}

export type ApplyResult = {
  newBooks: BookData[]
  updatedBooks: BookData[]
}

export function buildApplyResult(
  registered: BookData[],
  now: Date = new Date(),
): ApplyResult {
  const nowIso = now.toISOString()
  const today = todayStr(now)
  const newBooks: BookData[] = []
  const updatedBooks: BookData[] = []

  const catalogIds = [...new Set(SCHEDULE_PHASES.flatMap((p) => p.bookIds))]
  for (const id of catalogIds) {
    const catalog = CATALOG.find((c) => c.id === id)
    const deadline = scheduleDeadlineOf(id)
    if (!catalog || !deadline) continue
    const existing = registered.find(
      (b) => b.catalogId === id || (b.catalogId === undefined && b.title === catalog.title),
    )
    if (existing) {
      updatedBooks.push({
        ...existing,
        catalogId: existing.catalogId ?? id,
        subject: existing.subject ?? catalog.subject,
        coverUrl: existing.coverUrl ?? catalog.coverSrc,
        deadline,
        updatedAt: nowIso,
      })
    } else {
      newBooks.push({
        id: crypto.randomUUID(),
        title: catalog.title,
        subject: catalog.subject,
        totalPages: catalog.totalPages,
        coverUrl: catalog.coverSrc,
        catalogId: id,
        startDate: today,
        deadline,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }
  }
  return { newBooks, updatedBooks }
}