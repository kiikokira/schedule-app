import { cancelScheduledPush, publishSlots, schedulePush } from './notify'
import { formatDate } from './progress'
import { slotStartMessage, slotStartTitle, REMINDER_LEAD_MIN, type SlotsPayload } from './slotNotify'

// 同じ内容の公開は繰り返さないための記録キー
export const SLOTS_PUBLISHED_KEY = 'schedule-app-slots-published'

// 予約投稿の同期状態の記録キー
export const SCHEDULED_KEY = 'schedule-app-slots-scheduled'

// 予約IDは(日付 開始時刻)で決定的にする。再送は置換になり、二重送信にならない。
export function slotSequenceId(date: string, start: string): string {
  return `slot-start-${date}-${start.replace(':', '')}`
}

// 空き時間の開始10分前に届くよう予約投稿するためのUNIX秒。
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

type DayState = { hash: string; ids: string[] }
type ScheduledState = { days: Record<string, DayState> }

function isDayState(v: unknown): v is DayState {
  if (!v || typeof v !== 'object') return false
  const dv = v as Partial<DayState>
  return typeof dv.hash === 'string' && Array.isArray(dv.ids) && dv.ids.every((x) => typeof x === 'string')
}

function readScheduledState(): ScheduledState {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY)
    if (!raw) return { days: {} }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { days: {} }
    const daysRaw = parsed.days
    if (daysRaw && typeof daysRaw === 'object' && !Array.isArray(daysRaw)) {
      const days: Record<string, DayState> = {}
      for (const [date, v] of Object.entries(daysRaw as Record<string, unknown>)) {
        if (isDayState(v)) days[date] = { hash: v.hash, ids: [...v.ids] }
      }
      return { days }
    }
    // 移行前の単日形式はその日の分として引き継ぐ（再送は置換になるため安全）
    const legacyDate = parsed.date
    const legacyHash = parsed.hash
    const legacyIds = parsed.ids
    if (
      typeof legacyDate === 'string' &&
      typeof legacyHash === 'string' &&
      Array.isArray(legacyIds) &&
      legacyIds.every((x) => typeof x === 'string')
    ) {
      return { days: { [legacyDate]: { hash: legacyHash, ids: [...legacyIds] } } }
    }
    return { days: {} }
  } catch {
    return { days: {} }
  }
}

// 予約に間に合わなかった直近分をその場で送る猶予（分）。二重送信にならないよう
// 処理済みIDに記録する。
const SALVAGE_WINDOW_MIN = 15
// この先のミリ秒以内の通知は予約投稿する。直近すぎる分は即時送信に回す。
const SCHEDULE_AHEAD_MS = 60_000
// 猶予分の予約投稿の遅延（秒）。即時送信ではなく同じ予約IDで予約するため、
// 重なった同期・複数端末・開き直しでも置換になり二重送信しない。
// ntfyの遅延はUNIX秒で渡す（10秒未満の数値は400になるため使わない）。
const SALVAGE_DELAY_SEC = 15

// その日の時間帯データをntfyへ一度だけ送る。内容が変わった場合は再送する。
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
// アプリが閉じていてもサーバー側で配達される。内容が変わらなければ何もしらない。
// なくなった未来分の予約は取り消す（配達済みには触らない）。
// 予約に間に合わなかった直近分（猶予内）はその場で送る。いずれも
// 決定的な予約IDで管理するため、再送・複数端末でも二重送信にならない。
// 送信に失敗した場合は記録を残さず、次回に再試行できるようにする。
export async function syncSlotSchedules(
  topic: string,
  payload: SlotsPayload,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<{ scheduled: number; salvaged: number; cancelled: number }> {
  // 同期同士を直列化する。起動時と今日の計画表示時の2回の同期が重なると、
  // どちらも書き込み前の状態を読んでサルベージを二重送信してしまうため、
  // 後発は先発の完了（状態書き込み後）まで待ってから判定し直す。
  const previous = syncQueue
  let release!: () => void
  syncQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await runSyncSlotSchedules(topic, payload, fetchImpl, now)
  } finally {
    release()
  }
}

let syncQueue: Promise<void> = Promise.resolve()

async function runSyncSlotSchedules(
  topic: string,
  payload: SlotsPayload,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<{ scheduled: number; salvaged: number; cancelled: number }> {
  const none = { scheduled: 0, salvaged: 0, cancelled: 0 }
  const today = formatDate(now)
  if (payload.date < today) return none
  const hash = `${payload.date}|${JSON.stringify(payload.slots)}`
  const state = readScheduledState()
  const prev = state.days[payload.date]
  if (prev && prev.hash === hash) return none
  const nowMs = now.getTime()
  const storedIds = new Set(prev ? prev.ids : [])
  const future = payload.slots.filter(
    (s) => slotStartUnix(payload.date, s.start) * 1000 - nowMs >= SCHEDULE_AHEAD_MS,
  )
  const salvage = payload.slots.filter((s) => {
    const id = slotSequenceId(payload.date, s.start)
    if (storedIds.has(id)) return false
    const fireMs = slotStartUnix(payload.date, s.start) * 1000
    return fireMs - nowMs < SCHEDULE_AHEAD_MS && nowMs - fireMs < SALVAGE_WINDOW_MIN * 60_000
  })
  const ids = future.map((s) => slotSequenceId(payload.date, s.start))
  let cancelled = 0
  if (prev) {
    const current = new Set(ids)
    for (const id of prev.ids) {
      if (current.has(id)) continue
      const parsed = parseSequenceId(id)
      if (!parsed) continue
      if (parsed.fireUnix * 1000 <= nowMs) continue
      if (await cancelScheduledPush(topic, id, fetchImpl)) cancelled++
    }
  }
  let scheduled = 0
  let failed = false
  for (const slot of future) {
    const fireUnix = slotStartUnix(payload.date, slot.start)
    const result = await schedulePush(topic, slotStartMessage(slot), {
      title: slotStartTitle(slot.start),
      delay: fireUnix,
      sequenceId: slotSequenceId(payload.date, slot.start),
    }, fetchImpl)
    if (result.ok) scheduled++
    else failed = true
  }
  let salvaged = 0
  for (const slot of salvage) {
    const result = await schedulePush(topic, slotStartMessage(slot), {
      title: slotStartTitle(slot.start),
      delay: Math.floor(now.getTime() / 1000) + SALVAGE_DELAY_SEC,
      sequenceId: slotSequenceId(payload.date, slot.start),
    }, fetchImpl)
    if (result.ok) salvaged++
    else failed = true
  }
  if (failed) return { scheduled, salvaged, cancelled }
  const days: Record<string, DayState> = { ...state.days }
  for (const d of Object.keys(days)) {
    if (d < today) delete days[d]
  }
  days[payload.date] = {
    hash,
    ids: [...ids, ...salvage.map((s) => slotSequenceId(payload.date, s.start))],
  }
  try {
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify({ days }))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
  return { scheduled, salvaged, cancelled }
}
