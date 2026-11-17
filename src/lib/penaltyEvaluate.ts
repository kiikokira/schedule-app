import { evaluateDay, getPenaltySettings, listPenalties, upsertPenalty, type PenaltyEvent } from '../data/penaltyStore'
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
import { calcOutstanding, calcStreak, calcTotalPoints, MAX_PAGE_DEBT, rankForPoints } from './penalty'

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
  // I2超過充当用に日別の予定合計と記録合計を集める(反復は区画単位のためページ超過には含めない)。
  const plannedTotals = new Map<string, number>()
  const recordedTotals = new Map<string, number>()
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
    plannedTotals.set(date, planned.reduce((sum, p) => sum + p.pages, 0))
    recordedTotals.set(
      date,
      load.records
        .filter((r) => r.date === date && activeIds.has(r.bookId))
        .reduce((sum, r) => sum + r.pages, 0),
    )
    await evaluateDay(date, targetIds, recorded, planned, cyclePlanned, severity)
  }
  // Q1-A: 超過分 max(記録-予定,0) を古い借金からFIFO充当する。
  // evaluateDay の全記録削除は維持し、古い events の pageDebt だけ減らす
  // (points/履歴は残す)。毎走査で evaluateDay が pageDebt を復元してから
  // 充当し直すため冪等。表示上限500は summarize 側の責務とし、ここでは素直に引き直す。
  const repayments = [...plannedTotals.entries()]
    .map(([date, plannedTotal]) => ({
      date,
      excessPages: Math.max((recordedTotals.get(date) ?? 0) - plannedTotal, 0),
    }))
    .filter((r) => r.excessPages > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (repayments.length > 0) {
    const windowStart = addDays(today, -(daysBack - 1))
    const debts = (await listPenalties())
      .filter((p) => p.date >= windowStart && p.date <= today)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    if (debts.length > 0) {
      const pageDebts = debts.map((d) => ({ date: d.date, pageDebt: d.pageDebt }))
      const after = calcOutstanding(pageDebts, repayments)
      let remaining = pageDebts.reduce((sum, d) => sum + d.pageDebt, 0) - after
      for (const d of debts) {
        if (remaining <= 0) break
        const take = Math.min(d.pageDebt, remaining)
        if (take <= 0) continue
        d.pageDebt -= take
        remaining -= take
        await upsertPenalty(d)
      }
    }
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
// I4: 当日分はクエスト二重計上防止のため既定で除外する(includeToday=trueで含める)。
// I1: 良い日(計画ありの非サボり日)を数えて calcTotalPoints に渡し-5回復する。
// I2: 超過充当は評価走査で pageDebt に反映済みのため、ここでは残高を合算するのみ。
export function summarizeRecentPenalties(
  events: PenaltyEvent[],
  today: string,
  includeToday = false,
): PenaltySummary {
  const cutoff = addDays(today, -6)
  const recent = events
    .filter((e) => e.date >= cutoff && (includeToday ? e.date <= today : e.date < today))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const outstanding = Math.min(
    calcOutstanding(
      recent.map((e) => ({ date: e.date, pageDebt: e.pageDebt })),
      [],
    ),
    MAX_PAGE_DEBT,
  )
  const missDates = new Set(recent.map((e) => e.date))
  const daily: { date: string; isMiss: boolean; hasPlan: boolean }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i)
    daily.push({ date: d, isMiss: missDates.has(d), hasPlan: true })
  }
  const goodDayCount = daily.filter((d) => d.hasPlan && !d.isMiss).length
  const totalPoints = calcTotalPoints(
    recent.map((e) => ({ date: e.date, points: e.points })),
    goodDayCount,
  )
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
    const result = await publishPush(notify.topic, `昨日は記録なし 借金${miss.pageDebt}ページ`, { title: 'サボり罰' }, fetchImpl)
    // I3: 送信失敗時は済フラグを残さず次回起動時に再送させる
    if (!result.ok) return
    try {
      localStorage.setItem(key, '1')
    } catch {
      // 保存失敗は無視する
    }
  } catch {
    // 通知の失敗で呼び出し元を壊さない
  }
}
