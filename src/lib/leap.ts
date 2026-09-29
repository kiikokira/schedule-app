export const LEAP_TOTAL_WORDS = 2300
export const LEAP_TARGET_ROUNDS = 3

export type LeapWordRange = { from: number; to: number }

export const LEAP_WORD_RANGES: LeapWordRange[] = [
  { from: 1, to: 400 },
  { from: 401, to: 1000 },
  { from: 1001, to: 1400 },
  { from: 1401, to: 2000 },
  { from: 2001, to: 2300 },
]

export function isLeapBook(book: { catalogId?: string; title?: string }): boolean {
  if (book.catalogId === 'leap') return true
  return book.title?.includes('LEAP') ?? false
}

export function normalizeLeapBook<T extends { catalogId?: string; title?: string; studyMode?: string; totalUnits?: number }>(
  book: T,
): T | null {
  if (book.studyMode !== 'cycles') return null
  if (!isLeapBook(book)) return null
  if (book.totalUnits === LEAP_TOTAL_WORDS) return null
  return { ...book, totalUnits: LEAP_TOTAL_WORDS }
}
