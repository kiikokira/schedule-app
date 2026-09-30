import { db } from './database'
import { saveSchedule } from '../data/scheduleStore'
import type { BookData, ProgressRecordData, CycleRecordData } from '../lib/progress'
import type { AvailabilitySlot, Adjustment } from '../data/dayplanStore'
import type { ChatHistoryEntry } from '../data/chatHistoryStore'
import type { ScheduleEntry } from '../data/schedule'

export type BackupData = {
  exportedAt: string
  books: BookData[]
  records: ProgressRecordData[]
  cycleRecords: CycleRecordData[]
}

export async function exportBackup(): Promise<BackupData> {
  return {
    exportedAt: new Date().toISOString(),
    books: await db.books.toArray(),
    records: await db.records.toArray(),
    cycleRecords: await db.cycleRecords.toArray(),
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
  const cycles = (d as Partial<BackupData>).cycleRecords ?? []
  if (!Array.isArray(cycles)) return false
  for (const c of cycles) {
    if (!c || typeof c.id !== 'string') return false
    if (typeof c.bookId !== 'string' || !bookIds.has(c.bookId)) return false
    if (typeof c.date !== 'string') return false
    if (typeof c.unitFrom !== 'number' || typeof c.unitTo !== 'number') return false
    if (typeof c.round !== 'number') return false
    if (c.unitFrom > c.unitTo) return false
    if (c.round < 1) return false
  }
  // 自動バックアップ由来の拡張項目は任意（旧形式ファイルも読める）
  for (const key of ['availability', 'adjustments', 'chatMessages', 'schedule'] as const) {
    const v = (d as Record<string, unknown>)[key]
    if (v !== undefined && !Array.isArray(v)) return false
  }
  return true
}

export async function importBackup(
  data: BackupData,
): Promise<{ books: number; records: number }> {
  const cycleRecords = (data as Partial<BackupData>).cycleRecords ?? []
  const ext = data as Partial<{
    availability: AvailabilitySlot[]
    adjustments: Adjustment[]
    chatMessages: ChatHistoryEntry[]
    schedule: ScheduleEntry[]
  }>
  // Dexieの型付けは1トランザクション5テーブルまでのため2回に分ける
  await db.transaction('rw', db.books, db.records, db.cycleRecords, async () => {
    await db.books.clear()
    await db.records.clear()
    await db.cycleRecords.clear()
    await db.books.bulkAdd(data.books)
    await db.records.bulkAdd(data.records)
    await db.cycleRecords.bulkAdd(cycleRecords)
  })
  if (ext.availability || ext.adjustments || ext.chatMessages) {
    await db.transaction('rw', db.availability, db.adjustments, db.chatMessages, async () => {
      await db.availability.clear()
      await db.adjustments.clear()
      await db.chatMessages.clear()
      await db.availability.bulkAdd(ext.availability ?? [])
      await db.adjustments.bulkAdd(ext.adjustments ?? [])
      await db.chatMessages.bulkAdd(ext.chatMessages ?? [])
    })
  }
  if (ext.schedule) saveSchedule(ext.schedule)
  return { books: data.books.length, records: data.records.length }
}