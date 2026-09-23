import { describe, it, expect } from 'vitest'
import { buildAdvisorReport, answerBehind, answerPriority, answerPace } from './advisor'
import { daysBetween, type BookData } from './progress'
import type { AvailabilitySlot } from '../data/dayplanStore'

const TODAY = '2026-09-23' // 水曜
const WED_SLOT: AvailabilitySlot = { id: 's1', weekday: null, date: TODAY, start: '21:00', end: '23:00' }

function book(over: Partial<BookData> & { id: string }): BookData {
  return {
    title: over.id,
    subject: '英語長文',
    totalPages: 100,
    startDate: '2026-09-01',
    deadline: '2026-11-30',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  } as BookData
}

describe('buildAdvisorReport', () => {
  it('reports an on-track book as ok with a focus-free proposal', () => {
    const report = buildAdvisorReport({
      today: TODAY,
      books: [book({ id: 'b1', totalPages: 100, startDate: TODAY, deadline: '2026-11-30' })],
      donePagesByBook: { b1: 0 },
      availability: [WED_SLOT],
    })
    const a = report.books[0]
    expect(a.status).toBe('ok')
    expect(a.remainingPages).toBe(100)
    expect(a.daysUntilDeadline).toBe(daysBetween(TODAY, '2026-11-30'))
    expect(a.needPerDay).toBeGreaterThan(0)
    expect(a.behindPages).toBe(0)
    expect(report.proposal.focus).toHaveLength(0)
  })

  it('marks a behind book when done is less than expected so far', () => {
    const report = buildAdvisorReport({
      today: TODAY,
      books: [book({ id: 'b1', totalPages: 100, deadline: '2026-09-28' })],
      donePagesByBook: { b1: 0 },
      availability: [WED_SLOT],
    })
    const a = report.books[0]
    expect(a.behindPages).toBeGreaterThan(0)
    expect(a.status).toBe('behind')
    expect(report.proposal.focus).toContain('b1')
  })

  it('marks a critically behind book when today cannot cover the daily need', () => {
    const report = buildAdvisorReport({
      today: TODAY,
      books: [book({ id: 'b1', totalPages: 100, deadline: '2026-09-24' })],
      donePagesByBook: { b1: 0 },
      availability: [WED_SLOT],
    })
    expect(report.books[0].status).toBe('critical')
  })

  it('computes pace ratios from the daily need and today total minutes', () => {
    const report = buildAdvisorReport({
      today: TODAY,
      books: [
        book({ id: 'b1', totalPages: 100, deadline: '2026-09-28' }),
        book({ id: 'b2', totalPages: 100, deadline: '2026-11-30' }),
      ],
      donePagesByBook: { b1: 10, b2: 0 },
      availability: [WED_SLOT],
    })
    const r1 = report.proposal.ratios.find((r) => r.bookId === 'b1')!.ratio
    const r2 = report.proposal.ratios.find((r) => r.bookId === 'b2')!.ratio
    expect(r1).toBeGreaterThan(0)
    expect(r1).toBeGreaterThan(r2)
    expect(r1).toBeLessThanOrEqual(1)
  })

  it('puts a book with a big surplus into relax', () => {
    const report = buildAdvisorReport({
      today: TODAY,
      books: [book({ id: 'b1', totalPages: 200, startDate: '2026-09-20', deadline: '2026-12-31' })],
      donePagesByBook: { b1: 50 },
      availability: [WED_SLOT],
    })
    expect(report.books[0].status).toBe('ok')
    expect(report.proposal.relax).toContain('b1')
  })

  it('returns an empty summary when no active books exist', () => {
    const report = buildAdvisorReport({ today: TODAY, books: [], donePagesByBook: {}, availability: [] })
    expect(report.summaryText).toBe('登録された参考書がありません。参考書を追加してください。')
    expect(report.proposal.focus).toHaveLength(0)
  })
})

describe('template answers', () => {
  const behind = buildAdvisorReport({
    today: TODAY,
    books: [book({ id: 'b1', title: '英単語1000', totalPages: 100, deadline: '2026-09-28' })],
    donePagesByBook: { b1: 0 },
    availability: [WED_SLOT],
  })

  it('answerBehind lists behind books', () => {
    expect(answerBehind(behind)).toContain('英単語1000')
  })

  it('answerPriorit lists the behind book first', () => {
    expect(answerPriority(behind)).toContain('英単語1000')
    expect(answerPriority(behind)).toContain('期限まで')
  })

  it('answerPace compares needed vs planned pages per day', () => {
    expect(answerPace(behind)).toContain('1日')
    expect(answerPace(behind)).toContain('ページ必要')
  })

  it('answerBehind with no behind books reports none', () => {
    const ok = buildAdvisorReport({
      today: TODAY,
      books: [book({ id: 'b1', totalPages: 100, startDate: TODAY, deadline: '2026-12-31' })],
      donePagesByBook: { b1: 0 },
      availability: [WED_SLOT],
    })
    expect(answerBehind(ok)).toBe('遅れている本はありません。このペースなら期限に間に合います。')
  })
})