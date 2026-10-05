import { JAPAN_MATCHES, matchWindow } from '../data/japanMatches'
import { listAvailability, type AvailabilitySlot } from '../data/dayplanStore'
import { db } from '../db/database'
import { slotsForDate } from './dayplan'

const WATCH_KEY = 'schedule-app-japan-watch'
const BACKUP_KEY = 'schedule-app-japan-backup'

export type WatchDecision = 'watch' | 'skip'
export type WatchResult = { ok: true } | { ok: false; error: string }

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const toHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// 窓と重なる部分を除外する。接触（端点一致）は重なりとみなさない。
export function subtractWindow<T extends { startMin: number; endMin: number }>(
  slots: T[],
  start: string,
  end: string,
): T[] {
  const wStart = toMin(start)
  const wEnd = toMin(end)
  const out: T[] = []
  for (const s of slots) {
    const cutStart = Math.max(s.startMin, wStart)
    const cutEnd = Math.min(s.endMin, wEnd)
    if (cutStart >= cutEnd) {
      out.push(s)
      continue
    }
    if (s.startMin < cutStart) out.push({ ...s, startMin: s.startMin, endMin: cutStart })
    if (cutEnd < s.endMin) out.push({ ...s, startMin: cutEnd, endMin: s.endMin })
  }
  return out
}

function readMap(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeMap(key: string, value: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

export function getWatchDecision(matchId: string): WatchDecision | null {
  const v = readMap(WATCH_KEY)[matchId]
  return v === 'watch' || v === 'skip' ? v : null
}

function saveWatchDecision(matchId: string, decision: WatchDecision): void {
  const map = readMap(WATCH_KEY)
  map[matchId] = decision
  writeMap(WATCH_KEY, map)
}

function clearWatchDecision(matchId: string): void {
  const map = readMap(WATCH_KEY)
  delete map[matchId]
  writeMap(WATCH_KEY, map)
}

// 日付指定枠をバックアップ時点に戻す：バックアップに無いIDの日付指定枠は削除し、
// バックアップにあってDBに無いものは再挿入する。バックアップが無ければ何もしない。
async function restoreDateSlots(matchId: string, date: string): Promise<void> {
  const raw = readMap(BACKUP_KEY)[matchId]
  if (!Array.isArray(raw)) return
  const backup = raw as AvailabilitySlot[]
  const ids = new Set(backup.map((s) => s?.id))
  const current = await db.availability.where('date').equals(date).toArray()
  const currentIds = new Set(current.map((s) => s.id))
  for (const s of current) {
    if (!ids.has(s.id)) await db.availability.delete(s.id)
  }
  const missing = backup.filter((s) => s && typeof s.id === 'string' && !currentIds.has(s.id))
  if (missing.length > 0) await db.availability.bulkAdd(missing)
}

export async function watchMatch(matchId: string): Promise<WatchResult> {
  const match = JAPAN_MATCHES.find((m) => m.id === matchId)
  if (!match) return { ok: false, error: '試合が見つかりません' }
  const all = await listAvailability()
  const slotWindow = matchWindow(match)
  const rest = subtractWindow(slotsForDate(all, match.date), slotWindow.start, slotWindow.end)
  const existing = await db.availability.where('date').equals(match.date).toArray()
  const backup = readMap(BACKUP_KEY)
  backup[matchId] = existing
  writeMap(BACKUP_KEY, backup)
  await db.availability.where('date').equals(match.date).delete()
  for (const s of rest) {
    const slot: AvailabilitySlot = {
      id: crypto.randomUUID(),
      weekday: null,
      date: match.date,
      start: toHHMM(s.startMin),
      end: toHHMM(s.endMin),
    }
    if (s.bookId !== undefined) slot.bookId = s.bookId
    if (s.onTrain !== undefined) slot.onTrain = s.onTrain
    await db.availability.add(slot)
  }
  saveWatchDecision(matchId, 'watch')
  return { ok: true }
}

export async function skipMatch(matchId: string): Promise<WatchResult> {
  const match = JAPAN_MATCHES.find((m) => m.id === matchId)
  if (!match) return { ok: false, error: '試合が見つかりません' }
  const backup = readMap(BACKUP_KEY)[matchId]
  if (Array.isArray(backup)) {
    await restoreDateSlots(matchId, match.date)
  }
  saveWatchDecision(matchId, 'skip')
  return { ok: true }
}

export async function restoreMatch(matchId: string): Promise<WatchResult> {
  const match = JAPAN_MATCHES.find((m) => m.id === matchId)
  if (!match) return { ok: false, error: '試合が見つかりません' }
  await restoreDateSlots(matchId, match.date)
  clearWatchDecision(matchId)
  return { ok: true }
}
