import type { AvailabilitySlot } from '../data/dayplanStore'
import { daysBetween, parseDate } from './progress'

export const DEFAULT_MINUTES_PER_PAGE = 2

const SUBJECT_MINUTES_PER_PAGE: Record<string, number> = {
  英単語: 1,
  英熟語: 1,
  英文法: 2,
  英語: 3,
  英語長文: 3,
  小論文: 3,
  英作文: 3,
}

export function minutesPerPageFor(
  subject: string | undefined,
  minutesPerPage: number | undefined,
): number {
  if (minutesPerPage !== undefined && Number.isFinite(minutesPerPage) && minutesPerPage > 0) {
    return minutesPerPage
  }
  if (subject && SUBJECT_MINUTES_PER_PAGE[subject] !== undefined) {
    return SUBJECT_MINUTES_PER_PAGE[subject]
  }
  return DEFAULT_MINUTES_PER_PAGE
}

export type TimeSlot = { startMin: number; endMin: number }

export function parseTimeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function slotsForDate(
  availability: AvailabilitySlot[],
  date: string,
): TimeSlot[] {
  const dateOverrides = availability
    .filter((a) => a.date === date)
    .sort((a, b) => parseTimeToMin(a.start) - parseTimeToMin(b.start))
  if (dateOverrides.length > 0) {
    return dateOverrides
      .map((a) => ({ startMin: parseTimeToMin(a.start), endMin: parseTimeToMin(a.end) }))
      .filter((s) => s.endMin > s.startMin && s.endMin <= 1440)
  }
  const d = parseDate(date)
  const weekday = d.getDay()
  return availability
    .filter((a) => a.weekday === weekday)
    .sort((a, b) => parseTimeToMin(a.start) - parseTimeToMin(b.start))
    .map((a) => ({ startMin: parseTimeToMin(a.start), endMin: parseTimeToMin(a.end) }))
    .filter((s) => s.endMin > s.startMin && s.endMin <= 1440)
}

export type ScheduledBook = {
  bookId: string
  donePages: number
  totalPages: number
  minutesPerPage: number
  priority?: number
  allottedRatio?: number
  startDate: string
  deadline: string
}

export type PlanSlot = { startMin: number; endMin: number; bookId: string; pages: number }

export type DayPlan = {
  date: string
  slots: PlanSlot[]
  totalMinutes: number
  totalPages: number
}

export type DaySummary = {
  date: string
  items: { bookId: string; minutes: number; pages: number }[]
}

export type PlanOutput = {
  today: DayPlan
  upcoming: DaySummary[]
  notice: string | null
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function activeBooks(books: ScheduledBook[], today: string): ScheduledBook[] {
  return books.filter(
    (b) => b.totalPages > 0 && b.totalPages - b.donePages > 0 && b.startDate <= today,
  )
}

function dailyNeedOf(b: ScheduledBook, today: string): number {
  const remaining = Math.max(b.totalPages - b.donePages, 0)
  const duration = Math.max(daysBetween(today, b.deadline), 1)
  return Math.ceil(remaining / duration)
}

function deficitOf(b: ScheduledBook, today: string): number {
  const elapsedBeforeToday = Math.max(daysBetween(b.startDate, today) - 1, 0)
  if (elapsedBeforeToday <= 0) return 0
  const expected = dailyNeedOf(b, today) * elapsedBeforeToday
  return Math.max(expected - b.donePages, 0)
}

function comparePriority(a: ScheduledBook, b: ScheduledBook): number {
  const ap = a.priority ?? 0
  const bp = b.priority ?? 0
  if (ap !== bp) return ap - bp
  if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1
  return 0
}

export function planScore(slots: PlanSlot[]): number {
  if (slots.length === 0) return 0
  let switches = 0
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].bookId !== slots[i - 1].bookId) switches += 1
  }
  return slots.length - switches * 2
}

export function improvePlan(slots: PlanSlot[], maxIterations = 200): PlanSlot[] {
  let current = slots
  for (let i = 0; i < maxIterations; i++) {
    const merged: PlanSlot[] = []
    for (const s of current) {
      const last = merged[merged.length - 1]
      if (last && last.bookId === s.bookId && last.endMin === s.startMin) {
        last.endMin = s.endMin
        last.pages += s.pages
      } else {
        merged.push({ ...s })
      }
    }
    current = merged
  }
  return current
}

function capOf(b: ScheduledBook, totalMin: number): number {
  if (b.allottedRatio !== undefined && b.allottedRatio > 0 && b.allottedRatio < 1) {
    return Math.floor(totalMin * b.allottedRatio)
  }
  return totalMin
}

function buildDayPlan(
  date: string,
  books: ScheduledBook[],
  today: string,
  availability: AvailabilitySlot[],
): DayPlan {
  const slots = slotsForDate(availability, date)
  const totalMin = slots.reduce((sum, s) => sum + (s.endMin - s.startMin), 0)

  const targets = books
    .map((b) => ({
      book: b,
      need: dailyNeedOf(b, today) + (date === today ? deficitOf(b, today) : 0),
    }))
    .filter((t) => t.need > 0)
    .sort((x, y) => comparePriority(x.book, y.book))

  const wantOf = (t: { book: ScheduledBook; need: number }) =>
    Math.min(t.need * t.book.minutesPerPage, capOf(t.book, totalMin))

  // 15分スロット単位で優先度順に詰め込む(1回あたりの割当=15分)
  const assigned = new Map<string, number>()
  let remaining = totalMin
  let guard = 0
  for (let cur = 0; cur < totalMin && guard < 200; cur += 15, guard += 1) {
    const cand = targets.filter((t) => (assigned.get(t.book.bookId) ?? 0) < wantOf(t))
    if (cand.length === 0) break
    const t = cand[0]
    const take = Math.min(15, remaining)
    assigned.set(t.book.bookId, (assigned.get(t.book.bookId) ?? 0) + take)
    remaining -= take
  }

  const result = distributeMinutes(slots, targets, assigned)
  const improved = improvePlan(result)
  return {
    date,
    slots: improved,
    totalMinutes: totalMin,
    totalPages: improved.reduce((sum, s) => sum + s.pages, 0),
  }
}

function distributeMinutes(
  slots: TimeSlot[],
  targets: { book: ScheduledBook; need: number }[],
  assigned: Map<string, number>,
): PlanSlot[] {
  const result: PlanSlot[] = []
  let targetIndex = 0
  let remainingForTarget = assigned.get(targets[0]?.book.bookId ?? '') ?? 0
  for (const s of slots) {
    let left = s.endMin - s.startMin
    let c = s.startMin
    while (left > 0 && targetIndex < targets.length) {
      const bookId = targets[targetIndex].book.bookId
      const mpp = targets[targetIndex].book.minutesPerPage
      const take = Math.min(left, remainingForTarget)
      if (take > 0) {
        result.push({
          startMin: c,
          endMin: c + take,
          bookId,
          pages: Math.max(Math.floor(take / mpp), 0),
        })
        c += take
        left -= take
        remainingForTarget -= take
      }
      if (remainingForTarget <= 0) {
        if (targetIndex < targets.length - 1) {
          targetIndex += 1
          remainingForTarget = assigned.get(targets[targetIndex].book.bookId) ?? 0
        } else {
          break
        }
      }
    }
  }
  return result
}

export function generateDayPlan(params: {
  availability: AvailabilitySlot[]
  books: ScheduledBook[]
  today: string
  horizonDays?: number
}): PlanOutput {
  const { availability, books, today, horizonDays = 7 } = params
  const active = activeBooks(books, today)
  const todayPlan = buildDayPlan(today, active, today, availability)

  const anyDeficit = active.some((b) => deficitOf(b, today) > 0)
  const noAvailability = slotsForDate(availability, today).length === 0
  const notice = noAvailability
    ? '今日の空き時間がありません'
    : anyDeficit
      ? '前日までの不足分を今日の空き時間に再配置しました'
      : null

  const upcoming: DaySummary[] = []
  for (let i = 1; i <= horizonDays; i++) {
    const date = addDays(today, i)
    const plan = buildDayPlan(date, active, date, availability)
    const itemsMap = new Map<string, { minutes: number; pages: number }>()
    for (const s of plan.slots) {
      const cur = itemsMap.get(s.bookId) ?? { minutes: 0, pages: 0 }
      cur.minutes += s.endMin - s.startMin
      cur.pages += s.pages
      itemsMap.set(s.bookId, cur)
    }
    upcoming.push({
      date,
      items: Array.from(itemsMap.entries()).map(([bookId, v]) => ({
        bookId,
        minutes: v.minutes,
        pages: v.pages,
      })),
    })
  }

  return { today: todayPlan, upcoming, notice }
}