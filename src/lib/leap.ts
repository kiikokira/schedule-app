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
