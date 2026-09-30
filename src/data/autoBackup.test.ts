import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { loadSchedule, saveSchedule } from './scheduleStore'
import {
  AUTO_SNAPSHOT_ID,
  loadAutoSnapshot,
  restoreAutoSnapshot,
  takeAutoSnapshot,
  takeAutoSnapshotIfNeeded,
} from './autoBackup'

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  await db.availability.clear()
  await db.adjustments.clear()
  await db.chatMessages.clear()
  await db.snapshots.clear()
  localStorage.clear()
})

const seed = async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'b1',
    title: '本',
    totalPages: 100,
    startDate: '2026-09-01',
    deadline: '2026-11-30',
    createdAt: now,
    updatedAt: now,
  } as any)
  await db.records.add({ id: 'r1', bookId: 'b1', date: '2026-09-29', pages: 5 })
  saveSchedule([{ bookId: 'b1', startDate: '2026-09-01', deadline: '2026-09-30' }])
}

describe('autoBackup', () => {
  it('1日1回だけ保存し常に1件に保つ', async () => {
    await seed()
    expect(await takeAutoSnapshotIfNeeded('2026-09-30')).toBe(true)
    expect(await takeAutoSnapshotIfNeeded('2026-09-30')).toBe(false)
    expect(await db.snapshots.count()).toBe(1)
    expect((await db.snapshots.get(AUTO_SNAPSHOT_ID))?.books).toHaveLength(1)
    expect(await takeAutoSnapshotIfNeeded('2026-10-01')).toBe(true)
    expect(await db.snapshots.count()).toBe(1)
  })

  it('削除したデータを復元できる', async () => {
    await seed()
    await takeAutoSnapshot()
    await db.books.clear()
    await db.records.clear()
    saveSchedule([])
    await restoreAutoSnapshot()
    expect((await db.books.get('b1'))?.title).toBe('本')
    expect(await db.records.count()).toBe(1)
    expect(loadSchedule()).toHaveLength(1)
  })

  it('スナップショットが無ければ復元しない', async () => {
    expect(await loadAutoSnapshot()).toBeUndefined()
    await expect(restoreAutoSnapshot()).resolves.toBe(false)
  })
})
