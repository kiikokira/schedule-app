import { db } from '../db/database'
import { loadSchedule, saveSchedule } from './scheduleStore'
import { todayStr } from '../lib/progress'
import type { ScheduleEntry } from './schedule'
import type { AvailabilitySlot, Adjustment } from './dayplanStore'
import type { ChatHistoryEntry } from './chatHistoryStore'
import type { BookData, ProgressRecordData, CycleRecordData } from '../lib/progress'

export const AUTO_SNAPSHOT_ID = 'auto-latest'

const AUTO_BACKUP_DATE_KEY = 'schedule-app-auto-backup-date'

export type AutoSnapshot = {
  id: string
  exportedAt: string
  books: BookData[]
  records: ProgressRecordData[]
  cycleRecords: CycleRecordData[]
  availability: AvailabilitySlot[]
  adjustments: Adjustment[]
  chatMessages: ChatHistoryEntry[]
  schedule: ScheduleEntry[]
}

export async function takeAutoSnapshot(): Promise<AutoSnapshot> {
  const snap: AutoSnapshot = {
    id: AUTO_SNAPSHOT_ID,
    exportedAt: new Date().toISOString(),
    books: await db.books.toArray(),
    records: await db.records.toArray(),
    cycleRecords: await db.cycleRecords.toArray(),
    availability: await db.availability.toArray(),
    adjustments: await db.adjustments.toArray(),
    chatMessages: await db.chatMessages.toArray(),
    schedule: loadSchedule(),
  }
  await db.snapshots.put(snap)
  return snap
}

// 起動時に1日1回だけ自動保存する。二重起動でも1件に保たれる。
export async function takeAutoSnapshotIfNeeded(today: string = todayStr()): Promise<boolean> {
  try {
    if (localStorage.getItem(AUTO_BACKUP_DATE_KEY) === today) return false
  } catch {
    // localStorage が使えなくても保存自体は行う
  }
  await takeAutoSnapshot()
  try {
    localStorage.setItem(AUTO_BACKUP_DATE_KEY, today)
  } catch {
    // 保存できなくてもスナップショットは残っている
  }
  return true
}

export async function loadAutoSnapshot(): Promise<AutoSnapshot | undefined> {
  return db.snapshots.get(AUTO_SNAPSHOT_ID)
}

export async function restoreAutoSnapshot(): Promise<boolean> {
  const snap = await loadAutoSnapshot()
  if (!snap) return false
  await db.transaction(
    'rw',
    db.books,
    db.records,
    db.cycleRecords,
    db.availability,
    db.adjustments,
    db.chatMessages,
    async () => {
      await db.books.clear()
      await db.records.clear()
      await db.cycleRecords.clear()
      await db.availability.clear()
      await db.adjustments.clear()
      await db.chatMessages.clear()
      await db.books.bulkAdd(snap.books)
      await db.records.bulkAdd(snap.records)
      await db.cycleRecords.bulkAdd(snap.cycleRecords)
      await db.availability.bulkAdd(snap.availability)
      await db.adjustments.bulkAdd(snap.adjustments)
      await db.chatMessages.bulkAdd(snap.chatMessages)
    },
  )
  saveSchedule(snap.schedule)
  return true
}
