import { describe, it, expect } from 'vitest'
import { selectFocusBookId } from './focusBook'
import type { BookData, ProgressRecordData, CycleRecordData } from './progress'

const book = (id: string, over: Partial<BookData> = {}): BookData => ({
  id,
  title: id,
  totalPages: 100,
  startDate: '2026-09-01',
  deadline: '2026-11-30',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
})

const rec = (bookId: string, pages: number): ProgressRecordData => ({
  id: `${bookId}-${pages}`,
  bookId,
  date: '2026-10-29',
  pages,
})

describe('selectFocusBookId', () => {
  it('picks the book with the nearest deadline', () => {
    const books = [
      book('b1', { deadline: '2026-12-31' }),
      book('b2', { deadline: '2026-11-10' }),
      book('b3', { deadline: '2026-11-20' }),
    ]
    expect(selectFocusBookId(books, [], [])).toBe('b2')
  })

  it('breaks deadline ties by most remaining pages', () => {
    const books = [
      book('b1', { deadline: '2026-11-10', totalPages: 100 }),
      book('b2', { deadline: '2026-11-10', totalPages: 200 }),
    ]
    const records = [rec('b1', 10)]
    // b1 remaining 90, b2 remaining 200
    expect(selectFocusBookId(books, records, [])).toBe('b2')
  })

  it('subtracts recorded progress from remaining', () => {
    const books = [
      book('b1', { deadline: '2026-11-10', totalPages: 50 }),
      book('b2', { deadline: '2026-11-20', totalPages: 200 }),
    ]
    const records = [rec('b2', 180)]
    // b1 remaining 50, b2 remaining 20 -> nearest deadline wins anyway
    expect(selectFocusBookId(books, records, [])).toBe('b1')
  })

  it('skips completed books', () => {
    const books = [
      book('b1', { deadline: '2026-11-10', totalPages: 50 }),
      book('b2', { deadline: '2026-11-20', totalPages: 200 }),
    ]
    const records = [rec('b1', 50)]
    expect(selectFocusBookId(books, records, [])).toBe('b2')
  })

  it('compares cycle books by remaining units', () => {
    const books = [
      book('pages', { deadline: '2026-11-10', totalPages: 30 }),
      book('cycles', { deadline: '2026-11-10', studyMode: 'cycles', totalUnits: 100, targetRounds: 3 }),
    ]
    const cycles: CycleRecordData[] = [
      { id: 'c1', bookId: 'cycles', date: '2026-10-29', unitFrom: 1, unitTo: 10, round: 1 },
    ]
    // pages remaining 30, cycles remaining 300 - 10 = 290
    expect(selectFocusBookId(books, [], cycles)).toBe('cycles')
  })

  it('returns null when nothing remains', () => {
    const books = [book('b1', { totalPages: 50 })]
    expect(selectFocusBookId(books, [rec('b1', 50)], [])).toBeNull()
    expect(selectFocusBookId([], [], [])).toBeNull()
  })
})
