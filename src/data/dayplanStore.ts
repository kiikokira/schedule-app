import { db } from '../db/database'

export type AvailabilitySlot = {
  id: string
  weekday: number | null
  date: string | null
  start: string
  end: string
}

export type Adjustment = {
  id: string
  date: string
  bookId: string
  kind: 'priority' | 'ratio'
  value: number
}

export async function listAvailability(): Promise<AvailabilitySlot[]> {
  return db.availability.orderBy('id').toArray()
}

export async function saveAvailabilitySlot(
  slot: AvailabilitySlot,
  isNew: boolean,
): Promise<void> {
  if (isNew) {
    await db.availability.add(slot)
  } else {
    await db.availability.put(slot)
  }
}

export async function deleteAvailabilitySlot(id: string): Promise<void> {
  await db.availability.delete(id)
}

// アプリ起動時に過去日の「当日上書き」だけを自動削除する。
// 曜日ごと(weekday)や date が null のエントリには一切影響しない。
export async function prunePastOverrides(today: string): Promise<number> {
  return db.availability
    .filter(
      (slot) => slot.date !== null && slot.date < today,
    )
    .delete()
}

export async function listAdjustments(): Promise<Adjustment[]> {
  return db.adjustments.orderBy('id').toArray()
}

export async function addAdjustment(adjustment: Adjustment): Promise<void> {
  await db.adjustments.add(adjustment)
}