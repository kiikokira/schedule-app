import { db } from './database'
import { saveSchedule } from '../data/scheduleStore'
import { isSafeCoverUrl } from '../lib/coverUrl'
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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isRealDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function validateBackup(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Partial<BackupData>
  if (typeof d.exportedAt !== 'string' || isNaN(Date.parse(d.exportedAt))) return false
  if (!Array.isArray(d.books) || !Array.isArray(d.records)) return false
  const cycles = (d as Partial<BackupData>).cycleRecords ?? []
  if (!Array.isArray(cycles)) return false
  if (d.books.length > 10000 || d.records.length > 50000 || cycles.length > 50000) return false
  const bookIds = new Set<string>()
  for (const b of d.books) {
    if (!b || typeof b.id !== 'string' || b.id.length > 200) return false
    if (typeof b.title !== 'string' || b.title.length > 200) return false
    if (typeof b.totalPages !== 'number' || b.totalPages < 1) return false
    if (typeof b.startDate !== 'string' || typeof b.deadline !== 'string') return false
    const subject = (b as { subject?: unknown }).subject
    if (subject !== undefined && (typeof subject !== 'string' || subject.length > 2000)) return false
    const note = (b as { note?: unknown }).note
    if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) return false
    const coverUrl = (b as { coverUrl?: unknown }).coverUrl
    if (coverUrl !== undefined && coverUrl !== null) {
      if (typeof coverUrl !== 'string' || !isSafeCoverUrl(coverUrl)) return false
    }
    bookIds.add(b.id)
  }
  for (const r of d.records) {
    if (!r || typeof r.id !== 'string' || r.id.length > 200) return false
    if (typeof r.bookId !== 'string' || r.bookId.length > 200 || !bookIds.has(r.bookId)) return false
    if (typeof r.date !== 'string' || typeof r.pages !== 'number' || r.pages < 1) return false
  }
  for (const c of cycles) {
    if (!c || typeof c.id !== 'string' || c.id.length > 200) return false
    if (typeof c.bookId !== 'string' || c.bookId.length > 200 || !bookIds.has(c.bookId)) return false
    if (typeof c.date !== 'string') return false
    if (typeof c.unitFrom !== 'number' || typeof c.unitTo !== 'number') return false
    if (typeof c.round !== 'number') return false
    if (c.unitFrom > c.unitTo) return false
    if (c.round < 1) return false
  }
  // 自動バックアップ由来の拡張項目は任意（旧形式ファイルも読める）
  const ext = d as Record<string, unknown>
  const availability = ext['availability'] as unknown
  const adjustments = ext['adjustments'] as unknown
  const chatMessages = ext['chatMessages'] as unknown
  const schedule = ext['schedule'] as unknown
  for (const v of [availability, adjustments, chatMessages, schedule]) {
    if (v !== undefined && !Array.isArray(v)) return false
  }
  if (Array.isArray(availability)) {
    if (availability.length > 5000) return false
    for (const a of availability) {
      if (typeof a !== 'object' || a === null) return false
      const slot = a as Record<string, unknown>
      if (typeof slot['id'] !== 'string' || (slot['id'] as string).length > 200) return false
      const weekday = slot['weekday']
      if (weekday !== null && !(typeof weekday === 'number' && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) return false
      const date = slot['date']
      if (date !== null && !(typeof date === 'string' && isRealDateString(date))) return false
      if (typeof slot['start'] !== 'string' || !TIME_RE.test(slot['start'] as string)) return false
      if (typeof slot['end'] !== 'string' || !TIME_RE.test(slot['end'] as string)) return false
      if (slot['bookId'] !== undefined && (typeof slot['bookId'] !== 'string' || (slot['bookId'] as string).length > 200)) return false
    }
  }
  if (Array.isArray(adjustments)) {
    if (adjustments.length > 5000) return false
    for (const j of adjustments) {
      if (typeof j !== 'object' || j === null) return false
      const adj = j as Record<string, unknown>
      if (typeof adj['id'] !== 'string' || (adj['id'] as string).length > 200) return false
      if (typeof adj['date'] !== 'string') return false
      if (typeof adj['bookId'] !== 'string' || (adj['bookId'] as string).length > 200) return false
      if (adj['kind'] !== 'priority' && adj['kind'] !== 'ratio') return false
      if (typeof adj['value'] !== 'number' || !Number.isFinite(adj['value'] as number)) return false
    }
  }
  if (Array.isArray(chatMessages)) {
    if (chatMessages.length > 1000) return false
    for (const m of chatMessages) {
      if (typeof m !== 'object' || m === null) return false
      const msg = m as Record<string, unknown>
      if (typeof msg['id'] !== 'string' || (msg['id'] as string).length > 200) return false
      if (typeof msg['text'] !== 'string' || (msg['text'] as string).length > 10000) return false
      if (msg['role'] !== undefined && msg['role'] !== 'user' && msg['role'] !== 'assistant' && msg['role'] !== 'system') return false
    }
  }
  if (Array.isArray(schedule)) {
    if (schedule.length > 5000) return false
    for (const s of schedule) {
      if (typeof s !== 'object' || s === null) return false
      const entry = s as Record<string, unknown>
      if (entry['id'] !== undefined && (typeof entry['id'] !== 'string' || (entry['id'] as string).length > 200)) return false
      if (entry['title'] !== undefined && (typeof entry['title'] !== 'string' || (entry['title'] as string).length > 200)) return false
    }
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