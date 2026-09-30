import { db } from '../db/database'

export type AvailabilitySlot = {
  id: string
  weekday: number | null
  date: string | null
  start: string
  end: string
  // その時間はこの本を優先する指定。未設定なら自動割り当て。
  bookId?: string
  // 汽車で移動中の時間帯。trueなら汽車向きの本だけ自動割当する。
  onTrain?: boolean
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

export type PinBackup = { id: string; bookId?: string }

// 渡された枠すべてを指定本に固定し、元の固定を復元用に返す。
export function applyBulkPin(
  slots: AvailabilitySlot[],
  bookId: string,
): { slots: AvailabilitySlot[]; backup: PinBackup[] } {
  return {
    slots: slots.map((s) => ({ ...s, bookId })),
    backup: slots.map((s) => ({ id: s.id, bookId: s.bookId })),
  }
}

// 一括固定前の状態に戻す。無くなった枠・増えた枠はそのままにする。
export function restoreBulkPin(
  slots: AvailabilitySlot[],
  backup: PinBackup[],
): AvailabilitySlot[] {
  const prev = new Map(backup.map((b) => [b.id, b.bookId]))
  return slots.map((s) => {
    if (!prev.has(s.id)) return s
    const next = { ...s }
    const bookId = prev.get(s.id)
    if (bookId === undefined) delete next.bookId
    else next.bookId = bookId
    return next
  })
}

const PIN_BACKUP_KEY = 'schedule-app-pin-backup'

export function savePinBackup(backup: PinBackup[]): void {
  try {
    localStorage.setItem(PIN_BACKUP_KEY, JSON.stringify(backup))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

export function loadPinBackup(): PinBackup[] | null {
  try {
    const raw = localStorage.getItem(PIN_BACKUP_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    if (!parsed.every((b) => typeof b === 'object' && b !== null && typeof (b as PinBackup).id === 'string')) {
      return null
    }
    return parsed as PinBackup[]
  } catch {
    return null
  }
}

export function clearPinBackup(): void {
  try {
    localStorage.removeItem(PIN_BACKUP_KEY)
  } catch {
    // 何もしない
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