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

export async function listAdjustments(): Promise<Adjustment[]> {
  return db.adjustments.orderBy('id').toArray()
}

export async function addAdjustment(adjustment: Adjustment): Promise<void> {
  await db.adjustments.add(adjustment)
}