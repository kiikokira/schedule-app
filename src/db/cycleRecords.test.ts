import { describe, it, expect, beforeEach } from 'vitest'
import { db, addCycleRecord, listCycleRecords, updateCycleRecord, deleteCycleRecord } from './database'
import type { CycleRecordData } from '../lib/progress'

const rec = (id: string, extra: Partial<CycleRecordData> = {}): CycleRecordData => ({
  id, bookId: 'b1', date: '2026-01-05', unitFrom: 1, unitTo: 3, round: 1, ...extra,
})

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
})

describe('cycleRecords', () => {
  it('本ごとに記録を追加・取得できる', async () => {
    await addCycleRecord(rec('r1'))
    await addCycleRecord(rec('r2', { bookId: 'b2' }))
    expect((await listCycleRecords('b1')).map((r) => r.id)).toEqual(['r1'])
  })

  it('記録を更新・削除できる', async () => {
    await addCycleRecord(rec('r1'))
    await updateCycleRecord('r1', { unitTo: 5, round: 2 })
    const got = await db.cycleRecords.get('r1')
    expect(got?.unitTo).toBe(5)
    expect(got?.round).toBe(2)
    await deleteCycleRecord('r1')
    expect(await db.cycleRecords.get('r1')).toBeUndefined()
  })
})
