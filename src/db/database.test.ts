import { describe, it, expect, beforeEach } from 'vitest'
import {
  db,
  upsertProgress,
  deleteBookCascade,
  updateProgressRecord,
  deleteProgressRecord,
  type DexieBook,
} from './database'

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

describe('updateProgressRecord', () => {
  it('updates the pages of an existing record', async () => {
    const rec = await upsertProgress('b1', '2026-01-05', 10)
    await updateProgressRecord(rec.id, { pages: 25 })
    const stored = await db.records.get(rec.id)
    expect(stored?.pages).toBe(25)
    expect(stored?.date).toBe('2026-01-05')
  })

  it('updates the date of an existing record', async () => {
    const rec = await upsertProgress('b1', '2026-01-05', 10)
    await updateProgressRecord(rec.id, { date: '2026-01-07' })
    const stored = await db.records.get(rec.id)
    expect(stored?.date).toBe('2026-01-07')
    expect(stored?.pages).toBe(10)
  })

  it('merges into an existing record on the target date', async () => {
    const oldRec = await upsertProgress('b1', '2026-01-05', 10)
    await upsertProgress('b1', '2026-01-07', 30)
    await updateProgressRecord(oldRec.id, { date: '2026-01-07', pages: 15 })
    const all = await db.records.where('bookId').equals('b1').toArray()
    expect(all).toHaveLength(1)
    expect(all[0].date).toBe('2026-01-07')
    expect(all[0].pages).toBe(15)
  })

  it('throws when the record does not exist', async () => {
    await expect(updateProgressRecord('missing', { pages: 5 })).rejects.toThrow(
      '見つかりません',
    )
  })
})

describe('deleteProgressRecord', () => {
  it('removes the record from the database', async () => {
    const rec = await upsertProgress('b1', '2026-01-05', 10)
    await upsertProgress('b1', '2026-01-06', 20)
    await deleteProgressRecord(rec.id)
    const all = await db.records.where('bookId').equals('b1').toArray()
    expect(all).toHaveLength(1)
    expect(all[0].date).toBe('2026-01-06')
  })
})