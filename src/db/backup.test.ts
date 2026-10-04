import { it, expect, beforeEach } from 'vitest'
import { validateBackup, importBackup } from './backup'
import { db } from './database'

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

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
})

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

it('cycleRecords を含めて保存・復元できる', async () => {
  const data = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [{ ...book, studyMode: 'cycles', totalUnits: 10, targetRounds: 3 }],
    records: [],
    cycleRecords: [
      { id: 'c1', bookId: 'b1', date: '2026-01-05', unitFrom: 1, unitTo: 4, round: 1 },
    ],
  }
  expect(validateBackup(data)).toBe(true)
  await importBackup(data as any)
  expect(await db.cycleRecords.count()).toBe(1)
})

it('cycleRecords のない古いバックアップも受け付ける', () => {
  const old = { exportedAt: '2026-01-05T00:00:00.000Z', books: [book], records: [record] }
  expect(validateBackup(old)).toBe(true)
})

it('rejects books with unsafe coverUrl', () => {
  const data: unknown = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [{ ...book, coverUrl: 'javascript:alert(1)' }],
    records: [],
  }
  expect(validateBackup(data)).toBe(false)
})

it("rejects exportedAt:'not-a-date'", () => {
  const data: unknown = { exportedAt: 'not-a-date', books: [book], records: [record] }
  expect(validateBackup(data)).toBe(false)
})

it('rejects books over the 10000 limit', () => {
  const many = Array(10001).fill(book)
  const data: unknown = { exportedAt: '2026-01-05T00:00:00.000Z', books: many, records: [] }
  expect(validateBackup(data)).toBe(false)
})

it('accepts books at the 10000 boundary', () => {
  const many = Array(10000).fill(book)
  const data: unknown = { exportedAt: '2026-01-05T00:00:00.000Z', books: many, records: [] }
  expect(validateBackup(data)).toBe(true)
})

it('rejects availability with weekday:99', () => {
  const data: unknown = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [book],
    records: [],
    availability: [{ id: 'a1', weekday: 99, date: null, start: '09:00', end: '10:00' }],
  }
  expect(validateBackup(data)).toBe(false)
})

it('rejects chatMessages with text 10001 chars', () => {
  const data: unknown = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [book],
    records: [],
    chatMessages: [{ id: 'm1', text: 'a'.repeat(10001) }],
  }
  expect(validateBackup(data)).toBe(false)
})