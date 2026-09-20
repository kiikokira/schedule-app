import { describe, it, expect } from 'vitest'
import { validateBackup } from './backup'

const book = {
  id: 'b1',
  title: '単語帳',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const record = { id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 10 }

it('accepts a well-formed backup', () => {
  const data: unknown = { exportedAt: '2026-01-05T00:00:00.000Z', books: [book], records: [record] }
  expect(validateBackup(data)).toBe(true)
})

it('rejects missing records array', () => {
  const data = { exportedAt: '2026-01-05T00:00:00.000Z', books: [book] }
  expect(validateBackup(data)).toBe(false)
})

it('rejects books with invalid page count', () => {
  const data = { exportedAt: '2026-01-05T00:00:00.000Z', books: [{ ...book, totalPages: 0 }], records: [] }
  expect(validateBackup(data)).toBe(false)
})

it('rejects records referencing missing book', () => {
  const data = { exportedAt: '2026-01-05T00:00:00.000Z', books: [], records: [record] }
  expect(validateBackup(data)).toBe(false)
})