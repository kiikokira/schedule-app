import { cancelScheduledPush, publishSlots, schedulePush } from './notify'
import { formatDate } from './progress'
import { slotStartMessage, slotStartTitle, REMINDER_LEAD_MIN, type SlotsPayload } from './slotNotify'

// 同じ内容の公開は繰り返さないための記録キー
export const SLOTS_PUBLISHED_KEY = 'schedule-app-slots-published'

// 予約投稿の同期状態の記録キー
export const SCHEDULED_KEY = 'schedule-app-slots-scheduled'

// 予約IDは(日付, 開始時刻)で決定的にする。再送は置換になる。
export function slotSequenceId(date: string, start: string): string {
  return `slot-start-${date}-${start.replace(':', '')}`
}

// 空き時間の開始10分前（JST）のUNIX秒
export function slotStartUnix(date: string, start: string): number {
  const [h, m] = start.split(':').map(Number)
  const fireMin = h * 60 + m - REMINDER_LEAD_MIN
  const fireH = String(Math.floor(fireMin / 60)).padStart(2, '0')
  const fireM = String(fireMin % 60).padStart(2, '0')
  return Math.floor(new Date(`${date}T${fireH}:${fireM}:00+09:00`).getTime() / 1000)
}

// 移行前の終了時刻基準の予約IDを解釈する（残留分の取り消し用）。
// 戻り値は通知の発火UNIX秒。解釈できなければ null。
function parseLegacySequenceId(id: string): { date: string; fireUnix: number } | null {
  const m = id.match(/^slot-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})$/)
  if (!m) return null
  const fireUnix = Math.floor(new Date(`${m[1]}T${m[2]}:${m[3]}:00+09:00`).getTime() / 1000)
  return { date: m[1], fireUnix }
}

function parseSequenceId(id: string): { date: string; fireUnix: number } | null {
  const m = id.match(/^slot-start-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})$/) ?? null
  if (m) {
    return { date: m[1], fireUnix: slotStartUnix(m[1], `${m[2]}:${m[3]}`) }
  }
  return parseLegacySequenceId(id)
}

type ScheduledState = { date: string; hash: string; ids: string[] }

function readScheduledState(): ScheduledState | null {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ScheduledState>
    if (typeof parsed.date !== 'string' || !Array.isArray(parsed.ids)) return null
    return { date: parsed.date, hash: typeof parsed.hash === 'string' ? parsed.hash : '', ids: parsed.ids }
  } catch {
    return null
  }
}

// その日の開始10分前通知の予定をntfyへ一度だけ送る。内容が変わった場合は再送する。
// 送信に失敗した場合は記録を残さず、次回に再試行できるようにする。
export async function publishSlotsOnce(
  topic: string,
  payload: SlotsPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const hash = `${payload.date}|${JSON.stringify(payload.slots)}`
  try {
    if (localStorage.getItem(SLOTS_PUBLISHED_KEY) === hash) return false
  } catch {
    return false
  }
  const ok = await publishSlots(topic, payload, fetchImpl)
  if (!ok) return false
  try {
    localStorage.setItem(SLOTS_PUBLISHED_KEY, hash)
  } catch {
    // localStorage が利用できない環境では保存しない
  }
  return true
}

// その日の残り枠の開始10分前に届くようntfyへ予約投稿する。
// アプリが閉じていてもサーバー側で配達される。内容が変わらなければ何もしない。
// なくなった未来分の予約は取り消す（配達済みには触らない）。
export async function syncSlotSchedules(
  topic: string,
  payload: SlotsPayload,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<{ scheduled: number; cancelled: number }> {
  const none = { scheduled: 0, cancelled: 0 }
  if (payload.date !== formatDate(now)) return none
  const hash = `${payload.date}|${JSON.stringify(payload.slots)}`
  const stored = readScheduledState()
  if (stored && stored.date === payload.date && stored.hash === hash) return none
  const nowMs = now.getTime()
  const future = payload.slots.filter(
    (s) => slotStartUnix(payload.date, s.start) * 1000 - nowMs >= 60_000,
  )
  const ids = future.map((s) => slotSequenceId(payload.date, s.start))
  let cancelled = 0
  if (stored && stored.date === payload.date) {
    const current = new Set(ids)
    for (const id of stored.ids) {
      if (current.has(id)) continue
      const parsed = parseSequenceId(id)
      if (!parsed) continue
      if (parsed.fireUnix * 1000 <= nowMs) continue
      if (await cancelScheduledPush(topic, id, fetchImpl)) cancelled++
    }
  }
  let scheduled = 0
  for (const slot of future) {
    const fireUnix = slotStartUnix(payload.date, slot.start)
    const result = await schedulePush(topic, slotStartMessage(slot), {
      title: slotStartTitle(slot.start),
      delay: fireUnix,
      sequenceId: slotSequenceId(payload.date, slot.start),
    }, fetchImpl)
    if (result.ok) scheduled++
  }
  if (scheduled === 0 && future.length > 0) return none
  try {
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify({ date: payload.date, hash, ids }))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
  return { scheduled, cancelled }
}
