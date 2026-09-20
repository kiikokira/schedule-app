import { db } from './database'
import type { BookData, ProgressRecordData } from '../lib/progress'

export type BackupData = {
  exportedAt: string
  books: BookData[]
  records: ProgressRecordData[]
}

export async function exportBackup(): Promise<BackupData> {
  return {
    exportedAt: new Date().toISOString(),
    books: await db.books.toArray(),
    records: await db.records.toArray(),
  }
}

export function validateBackup(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Partial<BackupData>
  if (typeof d.exportedAt !== 'string') return false
  if (!Array.isArray(d.books) || !Array.isArray(d.records)) return false
  const bookIds = new Set<string>()
  for (const b of d.books) {
    if (!b || typeof b.id !== 'string') return false
    if (typeof b.title !== 'string') return false
    if (typeof b.totalPages !== 'number' || b.totalPages < 1) return false
    if (typeof b.startDate !== 'string' || typeof b.deadline !== 'string') return false
    bookIds.add(b.id)
  }
  for (const r of d.records) {
    if (!r || typeof r.id !== 'string') return false
    if (typeof r.bookId !== 'string' || !bookIds.has(r.bookId)) return false
    if (typeof r.date !== 'string' || typeof r.pages !== 'number' || r.pages < 1) return false
  }
  return true
}

export async function importBackup(
  data: BackupData,
): Promise<{ books: number; records: number }> {
  await db.transaction('rw', db.books, db.records, async () => {
    await db.books.clear()
    await db.records.clear()
    await db.books.bulkAdd(data.books)
    await db.records.bulkAdd(data.records)
  })
  return { books: data.books.length, records: data.records.length }
}