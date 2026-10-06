export type TrainFit = 'train' | 'either' | 'home'

export type BookData = {
  id: string
  title: string
  subject?: string
  totalPages: number
  coverUrl?: string
  catalogId?: string
  startDate: string
  deadline: string
  createdAt: string
  updatedAt: string
  minutesPerPage?: number
  priority?: number
  allottedRatio?: number
  initialDonePages?: number
  studyMode?: StudyMode
  totalUnits?: number
  targetRounds?: number
  initialDoneUnits?: number
  trainFit?: TrainFit
}

export type ProgressRecordData = {
  id: string
  bookId: string
  date: string
  pages: number
  recordedAt?: string
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(now: Date = new Date()): string {
  return formatDate(now)
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function formatJaDate(iso: string): string {
  const d = parseDate(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
}

export function formatJaFullDate(iso: string): string {
  const d = parseDate(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`
}

// その日に記録した量（通常のページ数＋反復の区画・語数）を通算する。
export function scoreActivityOnDate(
  date: string,
  records: ProgressRecordData[],
  cycles: CycleRecordData[],
): number {
  const pages = records
    .filter((r) => r.date === date)
    .reduce((sum, r) => sum + r.pages, 0)
  const pairs = cycles
    .filter((r) => r.date === date)
    .reduce((sum, r) => {
      if (!Number.isInteger(r.unitFrom) || !Number.isInteger(r.unitTo)) return sum
      if (r.unitFrom < 1 || r.unitTo < r.unitFrom) return sum
      return sum + (r.unitTo - r.unitFrom + 1)
    }, 0)
  return pages + pairs
}

export type StreakResult = { streak: number; todayScore: number; remaining: number }

// 目安（halfQuota）以上の記録がある日が何日連続しているかを数える。
// 今日が未達でも昨日まで連続なら継続扱いにする。
export function calcStreakDays(
  scores: Record<string, number>,
  halfQuota: number,
  today: string,
): StreakResult {
  const qualifies = (date: string): boolean => {
    const score = scores[date] ?? 0
    if (halfQuota <= 0) return score > 0
    return score >= halfQuota
  }
  const todayScore = scores[today] ?? 0
  let streak = 0
  let cursor = qualifies(today) ? today : addDays(today, -1)
  while (qualifies(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  const remaining = halfQuota <= 0 ? 0 : Math.max(halfQuota - todayScore, 0)
  return { streak, todayScore, remaining }
}

export function formatJaTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function daysBetween(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function calcDonePages(records: ProgressRecordData[], bookId: string): number {
  return records
    .filter((r) => r.bookId === bookId)
    .reduce((sum, r) => sum + r.pages, 0)
}

export function calcTotalDone(
  book: { id: string; initialDonePages?: number },
  records: ProgressRecordData[],
): number {
  return (book.initialDonePages ?? 0) + calcDonePages(records, book.id)
}

export function currentRound(donePages: number, totalPages: number): number {
  if (!Number.isInteger(totalPages) || totalPages <= 0) return 1
  if (!Number.isInteger(donePages) || donePages <= 0) return 1
  return Math.floor((donePages - 1) / totalPages) + 1
}

export function calcDailyTarget(
  book: { totalPages: number },
  done: number,
  remainingDays: number,
): number {
  const remaining = Math.max(book.totalPages - done, 0)
  if (remainingDays <= 0) return remaining
  if (remaining <= 0) return 0
  return Math.ceil(remaining / remainingDays)
}

export function calcRequiredPerDay(
  book: { totalPages: number },
  doneBeforeToday: number,
  todayPages: number,
  remainingDays: number,
): number {
  const remainingAfterToday = Math.max(
    book.totalPages - doneBeforeToday - todayPages,
    0,
  )
  const daysLeft = Math.max(remainingDays - 1, 0)
  if (remainingAfterToday <= 0) return 0
  if (daysLeft <= 0) return remainingAfterToday
  return Math.ceil(remainingAfterToday / daysLeft)
}

export function calcScheduleStatus(
  book: { totalPages: number; startDate: string; deadline: string },
  done: number,
  today: string,
): 'scheduled' | 'behind' | 'done' {
  if (done >= book.totalPages) return 'done'
  const totalDays = daysBetween(book.startDate, book.deadline)
  const elapsed = daysBetween(book.startDate, today)
  if (totalDays <= 0) return 'behind'
  const expected = Math.round((book.totalPages * elapsed) / totalDays)
  if (done < expected) return 'behind'
  return 'scheduled'
}

export function recentAvgPagesPerDay(
  records: ProgressRecordData[],
  today: string,
  windowDays = 7,
): number {
  if (windowDays <= 0) return 0
  const from = addDays(today, -(windowDays - 1))
  let total = 0
  for (const r of records) {
    if (r.date >= from && r.date <= today) {
      total += r.pages
    }
  }
  return total / windowDays
}

export type OverallDiagnosis = {
  remainingPages: number
  endDate: string
  requiredPerDay: number
  recentAvgPerDay: number
  behind: boolean
}

export function overallDiagnosis(
  books: BookData[],
  records: ProgressRecordData[],
  today: string,
): OverallDiagnosis {
  const remainingPages = books
    .filter((b) => b.studyMode !== 'cycles')
    .reduce((sum, b) => sum + Math.max(b.totalPages - calcTotalDone(b, records), 0), 0)
  const endDate =
    books.length > 0
      ? books.reduce((latest, b) => (b.deadline > latest ? b.deadline : latest), books[0].deadline)
      : today
  const days = daysBetween(today, endDate)
  const requiredPerDay =
    remainingPages <= 0 ? 0 : days > 0 ? Math.ceil(remainingPages / days) : remainingPages
  const recentAvgPerDay = recentAvgPagesPerDay(records, today)
  return {
    remainingPages,
    endDate,
    requiredPerDay,
    recentAvgPerDay,
    behind: remainingPages > 0 && recentAvgPerDay < requiredPerDay,
  }
}

function addDays(date: string, days: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export type StudyMode = 'pages' | 'cycles'

export type CycleRecordData = {
  id: string
  bookId: string
  date: string
  unitFrom: number
  unitTo: number
  round: number
  recordedAt?: string
}

export function expandCyclePairs(records: CycleRecordData[]): Set<string> {
  const pairs = new Set<string>()
  for (const r of records) {
    if (!Number.isInteger(r.unitFrom) || !Number.isInteger(r.unitTo)) continue
    if (!Number.isInteger(r.round) || r.round < 1) continue
    if (r.unitFrom < 1 || r.unitTo < r.unitFrom) continue
    for (let u = r.unitFrom; u <= r.unitTo; u++) pairs.add(`${u}:${r.round}`)
  }
  return pairs
}

export function calcCycleDonePairs(
  book: { initialDoneUnits?: number },
  records: CycleRecordData[],
): number {
  let done = book.initialDoneUnits ?? 0
  for (const r of records) {
    if (!Number.isInteger(r.unitFrom) || !Number.isInteger(r.unitTo)) continue
    if (!Number.isInteger(r.round) || r.round < 1) continue
    if (r.unitFrom < 1 || r.unitTo < r.unitFrom) continue
    done += r.unitTo - r.unitFrom + 1
  }
  return done
}

export function cycleGrandTotal(book: {
  totalUnits?: number
  targetRounds?: number
}): number {
  return (book.totalUnits ?? 0) * (book.targetRounds ?? 0)
}

export function calcCycleDailyTarget(
  book: { totalUnits?: number; targetRounds?: number },
  donePairs: number,
  remainingDays: number,
): number {
  const remaining = Math.max(cycleGrandTotal(book) - donePairs, 0)
  if (remaining <= 0) return 0
  if (remainingDays <= 0) return remaining
  return Math.ceil(remaining / remainingDays)
}

export function currentCycleRound(
  book: { totalUnits?: number; targetRounds?: number },
  records: CycleRecordData[],
): number {
  const total = book.totalUnits ?? 0
  const rounds = book.targetRounds ?? 0
  if (!Number.isInteger(total) || total <= 0) return 1
  if (!Number.isInteger(rounds) || rounds <= 0) return 1
  const pairs = expandCyclePairs(records)
  for (let r = 1; r <= rounds; r++) {
    let covered = 0
    for (let u = 1; u <= total; u++) if (pairs.has(`${u}:${r}`)) covered++
    if (covered < total) return r
  }
  return rounds
}
