import Dexie, { type Table } from 'dexie'
import type { BookData, ProgressRecordData, CycleRecordData } from '../lib/progress'
import type { AvailabilitySlot, Adjustment } from '../data/dayplanStore'

export type DexieBook = BookData
export type DexieRecord = ProgressRecordData

class ScheduleDB extends Dexie {
  books!: Table<DexieBook, string>
  records!: Table<DexieRecord, string>
  availability!: Table<AvailabilitySlot, string>
  adjustments!: Table<Adjustment, string>
  cycleRecords!: Table<CycleRecordData, string>

  constructor() {
    super('schedule-app')
    this.version(1).stores({
      books: 'id, deadline, startDate',
      records: 'id, bookId, [bookId+date]',
    })
    this.version(2).stores({
      books: 'id, deadline, startDate',
      records: 'id, bookId, [bookId+date]',
      availability: 'id, weekday, date',
      adjustments: 'id, date, bookId',
    })
    this.version(3).stores({
      books: 'id, deadline, startDate',
      records: 'id, bookId, [bookId+date]',
      availability: 'id, weekday, date',
      adjustments: 'id, date, bookId',
      cycleRecords: 'id, bookId, [bookId+date]',
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

export type RecordPatch = {
  date?: string
  pages?: number
}

export async function updateProgressRecord(
  id: string,
  patch: RecordPatch,
): Promise<DexieRecord> {
  const existing = await db.records.get(id)
  if (!existing) throw new Error('記録が見つかりません')
  if (patch.date && patch.date !== existing.date) {
    const clash = await db.records
      .where('[bookId+date]')
      .equals([existing.bookId, patch.date])
      .first()
    if (clash && clash.id !== id) {
      await db.records.delete(clash.id)
    }
  }
  const changes: Partial<DexieRecord> = {}
  if (patch.date !== undefined) changes.date = patch.date
  if (patch.pages !== undefined) changes.pages = patch.pages
  await db.records.update(id, changes)
  return (await db.records.get(id)) as DexieRecord
}

export async function deleteProgressRecord(id: string): Promise<void> {
  await db.records.delete(id)
}

export async function listCycleRecords(bookId: string): Promise<CycleRecordData[]> {
  return db.cycleRecords.where('bookId').equals(bookId).toArray()
}

export async function addCycleRecord(rec: CycleRecordData): Promise<void> {
  await db.cycleRecords.add(rec)
}

export async function updateCycleRecord(
  id: string,
  patch: { date?: string; unitFrom?: number; unitTo?: number; round?: number },
): Promise<void> {
  await db.cycleRecords.update(id, patch)
}

export async function deleteCycleRecord(id: string): Promise<void> {
  await db.cycleRecords.delete(id)
}