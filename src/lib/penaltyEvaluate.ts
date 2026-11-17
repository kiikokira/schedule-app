import { evaluateDay, getPenaltySettings, listPenalties, type PenaltyEvent } from '../data/penaltyStore'
import type { AvailabilitySlot } from '../data/dayplanStore'
import { addDays, effectiveSpeed, generateDayPlan, slotsForDate, type ScheduledBook } from './dayplan'
import { getNotifySettings, publishPush } from './notify'
import {
  calcCycleDailyTarget,
  calcCycleDonePairs,
  daysBetween,
  type BookData,
  type CycleRecordData,
  type ProgressRecordData,
} from './progress'
import { calcStreak, calcTotalPoints, MAX_PAGE_DEBT, rankForPoints } from './penalty'

export type PlannedDay = {
  planned: { bookId: string; pages: number }[]
  cyclePlanned: { bookId: string; units: number }[]
}

export type EvaluateLoad = {
  books: BookData[]
  records: ProgressRecordData[]
  cycleRecords: CycleRecordData[]
  availability: AvailabilitySlot[]
  focusIds?: string[] | null
  plannedByDate?: (date: string) => PlannedDay
}

// plannedByDate 未指定時の既定: TodayPlanScreen と同じ算出（自動割当の集計＋反復の日次目標）。
function defaultPlannedForDate(
  date: string,
  books: BookData[],
  records: ProgressRecordData[],
  cycleRecords: CycleRecordData[],
  availability: AvailabilitySlot[],
): PlannedDay {
  const scheduled: ScheduledBook[] = books
    .filter((b) => b.studyMode !== 'cycles')
    .map((b) => {
      const done =
        (b.initialDonePages ?? 0) +
        records
          .filter((r) => r.bookId === b.id && r.date <= date)
          .reduce((sum, r) => sum + r.pages, 0)
      return {
        bookId: b.id,
        donePages: done,
        totalPages: b.totalPages,
        minutesPerPage: effectiveSpeed(b.minutesPerPage, b.subject),
        priority: b.priority,
        allottedRatio: b.allottedRatio,
        startDate: b.startDate,
        deadline: b.deadline,
        trainFit: b.trainFit,
      }
    })
  const plan = generateDayPlan({ availability, books: scheduled, today: date })
  const pagesByBook = new Map<string, number>()
  for (const s of plan.today.slots) {
    pagesByBook.set(s.bookId, (pagesByBook.get(s.bookId) ?? 0) + s.pages)
  }
  const planned = [...pagesByBook.entries()]
    .filter(([, pages]) => pages > 0)
    .map(([bookId, pages]) => ({ bookId, pages }))
  const cyclePlanned = books
    .filter((b) => b.studyMode === 'cycles')
    .map((b) => {
      const mine = cycleRecords.filter((r) => r.bookId === b.id && r.date <= date)
      return {
        bookId: b.id,
        units: calcCycleDailyTarget(b, calcCycleDonePairs(b, mine), daysBetween(date, b.deadline)),
      }
    })
    .filter((c) => c.units > 0)
  return { planned, cyclePlanned }
}

// 直近 daysBack 日（当日含む）を走査し、未記録日を penalties に idempotent put する。
// 空き時間なし・対象本なし・未来日は判定しない。遅延記録は次回走査で上書き解消される。
export async function evaluateRecentDays(
  today: string,
  daysBack: number,
  load: EvaluateLoad,
): Promise<void> {
  const severity = getPenaltySettings().severity
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    if (slotsForDate(load.availability, date).length === 0) continue
    const inScope = load.focusIds
      ? load.books.filter((b) => load.focusIds!.includes(b.id))
      : load.books
    const active = inScope.filter((b) => b.startDate <= date)
    if (active.length === 0) continue
    const activeIds = new Set(active.map((b) => b.id))
    const base = load.plannedByDate
      ? load.plannedByDate(date)
      : defaultPlannedForDate(date, active, load.records, load.cycleRecords, load.availability)
    const planned = base.planned.filter((p) => activeIds.has(p.bookId))
    const cyclePlanned = base.cyclePlanned.filter((c) => activeIds.has(c.bookId))
    const targetIds = [
      ...new Set([...planned.map((p) => p.bookId), ...cyclePlanned.map((c) => c.bookId)]),
    ]
    if (targetIds.length === 0) continue
    const recorded = new Set<string>()
    for (const r of load.records) {
      if (r.date === date) recorded.add(r.bookId)
    }
    for (const c of load.cycleRecords) {
      if (c.date === date) recorded.add(c.bookId)
    }
    await evaluateDay(date, targetIds, recorded, planned, cyclePlanned, severity)
  }
}

export type PenaltySummary = {
  outstanding: number
  totalPoints: number
  streak: number
  rank: 'S' | 'A' | 'B' | 'C' | 'D'
  recent: PenaltyEvent[]
}

// HomeScreen バナー用の直近7日集計（借金合算・上限500、罰Pt、連続日、ランク）。
export function summarizeRecentPenalties(events: PenaltyEvent[], today: string): PenaltySummary {
  const cutoff = addDays(today, -6)
  const recent = events
    .filter((e) => e.date >= cutoff && e.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const outstanding = Math.min(
    recent.reduce((sum, e) => sum + e.pageDebt, 0),
    MAX_PAGE_DEBT,
  )
  const totalPoints = calcTotalPoints(
    recent.map((e) => ({ date: e.date, points: e.points })),
    0,
  )
  const missDates = new Set(recent.map((e) => e.date))
  const daily: { date: string; isMiss: boolean; hasPlan: boolean }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i)
    daily.push({ date: d, isMiss: missDates.has(d), hasPlan: true })
  }
  const streak = calcStreak(daily)
  const rank = rankForPoints(totalPoints)
  return { outstanding, totalPoints, streak, rank, recent }
}

export function notifiedKeyFor(date: string): string {
  return `penalty-notified-${date}`
}

// 前日サボりがあれば通知ON時のみ1日1回送る。失敗しても画面動作に影響させない。
export async function maybeNotifyYesterdayMiss(
  today: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const notify = getNotifySettings()
    if (!notify.enabled || !notify.topic.trim()) return
    const yesterday = addDays(today, -1)
    const key = notifiedKeyFor(yesterday)
    try {
      if (localStorage.getItem(key) !== null) return
    } catch {
      return
    }
    const all = await listPenalties()
    const miss = all.find((p) => p.date === yesterday)
    if (!miss || miss.pageDebt <= 0) return
    await publishPush(notify.topic, `昨日は記録なし 借金${miss.pageDebt}ページ`, { title: 'サボり罰' }, fetchImpl)
    try {
      localStorage.setItem(key, '1')
    } catch {
      // 保存失敗は無視する
    }
  } catch {
    // 通知の失敗で呼び出し元を壊さない
  }
}
