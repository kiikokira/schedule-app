// src/lib/advisorV2.test.ts
import { describe, it, expect } from 'vitest'
import { buildAdvisorReportV2 } from './advisorV2'
import type { BookData } from './progress'

const book = (over: Partial<BookData> & { id: string }): BookData => ({
  title: over.id, subject: '英語長文', totalPages: 100,
  startDate: '2026-10-01', deadline: '2026-11-30',
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...over,
} as BookData)

describe('buildAdvisorReportV2', () => {
  it('attaches velocity and probability without breaking base report', () => {
    const r = buildAdvisorReportV2({
      today: '2026-10-29',
      books: [book({ id: 'b1' })],
      donePagesByBook: { b1: 10 },
      availability: [{ id: 's1', weekday: null, date: '2026-10-29', start: '21:00', end: '23:00' }],
      records: [
        { id: 'x1', bookId: 'b1', date: '2026-10-26', pages: 10 },
        { id: 'x2', bookId: 'b1', date: '2026-10-27', pages: 12 },
        { id: 'x3', bookId: 'b1', date: '2026-10-28', pages: 11 },
      ],
    })
    expect(r.books.length).toBe(1)
    expect(r.velocities['b1'].medianPagesPerDay).toBe(11)
    expect(['high', 'mid', 'low']).toContain(r.velocities['b1'].probability)
  })
})
