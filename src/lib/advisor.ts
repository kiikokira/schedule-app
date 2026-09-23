import type { AvailabilitySlot } from '../data/dayplanStore'
import { generateDayPlan, effectiveSpeed, type ScheduledBook } from './dayplan'
import { daysBetween, type BookData } from './progress'

export type AdvisorStatus = 'ok' | 'behind' | 'critical'

export type AdvisorBook = {
  bookId: string
  title: string
  deadline: string
  remainingPages: number
  daysUntilDeadline: number
  needPerDay: number
  donePages: number
  expectedSoFar: number
  behindPages: number
  status: AdvisorStatus
  plannedTodayMinutes: number
  plannedTodayPages: number
}

export type AdvisorRatio = { bookId: string; ratio: number }

export type AdvisorProposal = {
  focus: string[]
  relax: string[]
  ratios: AdvisorRatio[]
  todayMessage: string
  paceMessage: string
}

export type AdvisorReport = {
  summaryText: string
  books: AdvisorBook[]
  proposal: AdvisorProposal
}

function toScheduledBook(b: BookData, done: number): ScheduledBook {
  return {
    bookId: b.id,
    donePages: done,
    totalPages: b.totalPages,
    minutesPerPage: effectiveSpeed(b.minutesPerPage, b.subject),
    priority: b.priority,
    allottedRatio: b.allottedRatio,
    startDate: b.startDate,
    deadline: b.deadline,
  }
}

export function buildAdvisorReport(params: {
  today: string
  books: BookData[]
  donePagesByBook: Record<string, number>
  availability: AvailabilitySlot[]
}): AdvisorReport {
  const { today, books, donePagesByBook, availability } = params
  const active = books.filter(
    (b) =>
      b.totalPages > 0 &&
      b.totalPages - (donePagesByBook[b.id] ?? 0) > 0 &&
      b.startDate <= today,
  )

  const planned = generateDayPlan({
    availability,
    books: active.map((b) => toScheduledBook(b, donePagesByBook[b.id] ?? 0)),
    today,
  })

  const booksReport: AdvisorBook[] = active.map((b) => {
    const done = donePagesByBook[b.id] ?? 0
    const remainingPages = Math.max(b.totalPages - done, 0)
    const daysUntilDeadline = Math.max(daysBetween(today, b.deadline), 1)
    const needPerDay = Math.ceil(remainingPages / daysUntilDeadline)
    const elapsed = Math.max(daysBetween(b.startDate, today) - 1, 0)
    const expectedSoFar = needPerDay * elapsed
    const behindPages = Math.max(expectedSoFar - done, 0)
    const todaySlots = planned.today.slots.filter((s) => s.bookId === b.id)
    const plannedTodayMinutes = todaySlots.reduce((sum, s) => sum + (s.endMin - s.startMin), 0)
    const plannedTodayPages = todaySlots.reduce((sum, s) => sum + s.pages, 0)
    const status: AdvisorStatus =
      behindPages > 0 && plannedTodayPages < needPerDay ? 'critical' : behindPages > 0 ? 'behind' : 'ok'
    return {
      bookId: b.id,
      title: b.title,
      deadline: b.deadline,
      remainingPages,
      daysUntilDeadline,
      needPerDay,
      donePages: done,
      expectedSoFar,
      behindPages,
      status,
      plannedTodayMinutes,
      plannedTodayPages,
    }
  })

  const totalMin = Math.max(planned.today.totalMinutes, 1)
  const byId = new Map(booksReport.map((a) => [a.bookId, a]))
  const focus = booksReport
    .filter((a) => a.status !== 'ok')
    .sort((a, b) => (a.status === 'critical' ? -1 : 0) - (b.status === 'critical' ? -1 : 0))
    .map((a) => a.bookId)
  const relax = booksReport
    .filter((a) => a.status === 'ok')
    .filter((a) => a.donePages - a.expectedSoFar >= a.needPerDay * 7)
    .map((a) => a.bookId)
  const ratios: AdvisorRatio[] = active.map((b) => {
    const info = byId.get(b.id)!
    const mpp = effectiveSpeed(b.minutesPerPage, b.subject)
    const ratio = Math.min(Math.max((info.needPerDay * mpp) / totalMin, 0), 1)
    return { bookId: b.id, ratio: Number(ratio.toFixed(2)) }
  })

  const proposal: AdvisorProposal = {
    focus,
    relax,
    ratios,
    todayMessage: todayMessageOf(focus, relax, byId),
    paceMessage: paceMessageOf(ratios, byId),
  }
  const summaryText = summaryOf(booksReport, focus)

  return { summaryText, books: booksReport, proposal }
}

function todayMessageOf(
  focus: string[],
  relax: string[],
  byId: Map<string, AdvisorBook>,
): string {
  if (focus.length === 0 && relax.length === 0) return '現状の配分で問題ありません。'
  const parts: string[] = []
  if (focus.length > 0) {
    parts.push(`優先: ${focus.map((id) => `${byId.get(id)!.title}（今日 ${byId.get(id)!.plannedTodayPages}ページ）`).join('、')}`)
  }
  if (relax.length > 0) {
    parts.push(`控える: ${relax.map((id) => byId.get(id)!.title).join('、')}`)
  }
  return parts.join(' / ')
}

function paceMessageOf(ratios: AdvisorRatio[], byId: Map<string, AdvisorBook>): string {
  return `期限までの必要ペースに合わせて配分比率を調整します: ${ratios
    .map((r) => `${byId.get(r.bookId)!.title} ${r.ratio}`)
    .join('、')}`
}

function summaryOf(booksReport: AdvisorBook[], focus: string[]): string {
  if (booksReport.length === 0) return '登録された参考書がありません。参考書を追加してください。'
  const behindCount = booksReport.filter((a) => a.status !== 'ok').length
  if (behindCount === 0) {
    return `全${booksReport.length}冊とも順調です。このペースなら期限に間に合います。`
  }
  const focusTitles = focus.map((id) => booksReport.find((a) => a.bookId === id)!.title).join('、')
  return `全${booksReport.length}冊のうち${behindCount}冊が遅れています。今日は「${focusTitles}」を優先すると期限に間に合いやすくなります。`
}

export function answerBehind(report: AdvisorReport): string {
  const bad = report.books.filter((a) => a.status !== 'ok')
  if (bad.length === 0) return '遅れている本はありません。このペースなら期限に間に合います。'
  return bad
    .map((a) => `${a.title}: 期限まで${a.daysUntilDeadline}日・残り${a.remainingPages}ページ（約${a.behindPages}ページ遅れ）`)
    .join('\n')
}

export function answerPriority(report: AdvisorReport): string {
  const byId = new Map(report.books.map((a) => [a.bookId, a]))
  const order = [
    ...report.proposal.focus,
    ...report.books
      .filter((a) => !report.proposal.focus.includes(a.bookId))
      .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))
      .map((a) => a.bookId),
  ]
  return order
    .map((id) => {
      const a = byId.get(id)!
      const note = a.behindPages > 0 ? `（${a.behindPages}ページ遅れ）` : ''
      return `${a.title}: 期限まで${a.daysUntilDeadline}日・残り${a.remainingPages}ページ${note}`
    })
    .join('\n')
}

export function answerPace(report: AdvisorReport): string {
  return report.books
    .map((a) => {
      const judge =
        a.status === 'ok'
          ? '間に合っています'
          : a.status === 'behind'
            ? 'やや遅れています'
            : 'このままだと期限に届きません'
      return `${a.title}: 期限までに1日 ${a.needPerDay}ページ必要 / 今日の予定 ${a.plannedTodayPages}ページ（${judge}）`
    })
    .join('\n')
}