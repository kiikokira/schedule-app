import { describe, it, expect, beforeEach } from 'vitest'
import { db, upsertProgress, deleteBookCascade, type DexieBook } from './database'

const book: DexieBook = {
  id: 'b1',
  title: '単語帳',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
})

describe('upsertProgress', () => {
  it('creates a record when none exists for the day', async () => {
    const rec = await upsertProgress('b1', '2026-01-05', 10)
    expect(rec.pages).toBe(10)
    const all = await db.records.where('bookId').equals('b1').toArray()
    expect(all).toHaveLength(1)
  })
  it('overwrites the same-day record', async () => {
    await upsertProgress('b1', '2026-01-05', 10)
    await upsertProgress('b1', '2026-01-05', 15)
    const all = await db.records.where('bookId').equals('b1').toArray()
    expect(all).toHaveLength(1)
    expect(all[0].pages).toBe(15)
  })
})

describe('deleteBookCascade', () => {
  it('deletes the book and its records', async () => {
    await db.books.add(book)
    await upsertProgress('b1', '2026-01-05', 10)
    await deleteBookCascade('b1')
    expect(await db.books.get('b1')).toBeUndefined()
    const records = await db.records.toArray()
    expect(records).toHaveLength(0)
  })
})