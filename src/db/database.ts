import Dexie, { type Table } from 'dexie'
import type { BookData, ProgressRecordData } from '../lib/progress'

export type DexieBook = BookData
export type DexieRecord = ProgressRecordData

class ScheduleDB extends Dexie {
  books!: Table<DexieBook, string>
  records!: Table<DexieRecord, string>

  constructor() {
    super('schedule-app')
    this.version(1).stores({
      books: 'id, deadline, startDate',
      records: 'id, bookId, [bookId+date]',
    })
  }
}

export const db = new ScheduleDB()

export async function upsertProgress(
  bookId: string,
  date: string,
  pages: number,
): Promise<ProgressRecordData> {
  const existing = await db.records.where('[bookId+date]').equals([bookId, date]).first()
  if (existing) {
    await db.records.update(existing.id, { pages })
    return { ...existing, pages }
  }
  const id = crypto.randomUUID()
  const record: ProgressRecordData = { id, bookId, date, pages }
  await db.records.add(record)
  return record
}

export async function deleteBookCascade(bookId: string): Promise<void> {
  await db.transaction('rw', db.books, db.records, async () => {
    await db.records.where('bookId').equals(bookId).delete()
    await db.books.delete(bookId)
  })
}