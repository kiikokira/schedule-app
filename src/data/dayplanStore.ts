import { db } from '../db/database'

export type AvailabilitySlot = {
  id: string
  weekday: number | null
  date: string | null
  start: string
  end: string
  // その時間はこの本を優先する指定。未設定なら自動割り当て。
  bookId?: string
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

// 参考書の削除に連動して、その本に固定された時間帯の固定を外す。枠自体は残す。
export async function unpinBook(bookId: string): Promise<void> {
  const all = await listAvailability()
  for (const slot of all) {
    if (slot.bookId === bookId) {
      const next = { ...slot }
      delete next.bookId
      await saveAvailabilitySlot(next, false)
    }
  }
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