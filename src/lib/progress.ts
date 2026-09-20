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
}

export type ProgressRecordData = {
  id: string
  bookId: string
  date: string
  pages: number
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