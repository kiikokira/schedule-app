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
// 00:10より前の開始は前日に巻き戻る（日付文字列の組み立てではNaNになり
// 通知が欠落するため、日またぎを吸収できるよう通しミリ秒で計算する）。
export function slotStartUnix(date: string, start: string): number {
  const [h, m] = start.split(':').map(Number)
  const dayStart = new Date(`${date}T00:00:00+09:00`).getTime()
  return Math.floor((dayStart + (h * 60 + m - REMINDER_LEAD_MIN) * 60_000) / 1000)
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

type SlotRecord = { h: string; t: 0 | 1 }
type DayState = { slots: Record<string, SlotRecord> }
type ScheduledState = { v: 2; days: Record<string, DayState> }

// 移行前の1世代分の状態（内容が一致すれば黙って引き継ぎ、違えば送り直す）
type LegacyDayState = { hash: string; ids: string[] }

function isSlotRecord(v: unknown): v is SlotRecord {
  if (!v || typeof v !== 'object') return false
  const sv = v as Partial<SlotRecord>
  return typeof sv.h === 'string' && (sv.t === 0 || sv.t === 1)
}

function isDayState(v: unknown): v is DayState {
  if (!v || typeof v !== 'object') return false
  const dv = v as { slots?: unknown }
  if (!dv.slots || typeof dv.slots !== 'object' || Array.isArray(dv.slots)) return false
  return Object.values(dv.slots as Record<string, unknown>).every(isSlotRecord)
}

function isLegacyDayState(v: unknown): v is LegacyDayState {
  if (!v || typeof v !== 'object') return false
  const dv = v as Partial<LegacyDayState>
  return (
    typeof dv.hash === 'string' &&
    Array.isArray(dv.ids) &&
    dv.ids.every((x) => typeof x === 'string')
  )
}

// 未移行の旧形式（単日形式・days形式の {hash, ids}）をその日の分として読み出す。
// 新形式があればそちらを優先する。
function readLegacyDay(date: string, parsed: Record<string, unknown>): LegacyDayState | null {
  const daysRaw = parsed.days
  if (daysRaw && typeof daysRaw === 'object' && !Array.isArray(daysRaw)) {
    const v = (daysRaw as Record<string, unknown>)[date]
    if (isLegacyDayState(v)) return { hash: v.hash, ids: [...v.ids] }
  }
  if (
    typeof parsed.date === 'string' &&
    parsed.date === date &&
    isLegacyDayState({ hash: parsed.hash, ids: parsed.ids })
  ) {
    return {
      hash: parsed.hash as string,
      ids: [...(parsed.ids as string[])],
    }
  }
  return null
}

function readScheduledState(): ScheduledState {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY)
    if (!raw) return { v: 2, days: {} }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { v: 2, days: {} }
    if ((parsed as { v?: unknown }).v === 2) {
      const daysRaw = parsed.days
      if (!daysRaw || typeof daysRaw !== 'object' || Array.isArray(daysRaw)) return { v: 2, days: {} }
      const days: Record<string, DayState> = {}
      for (const [date, v] of Object.entries(daysRaw as Record<string, unknown>)) {
        if (isDayState(v)) {
          const slots: Record<string, SlotRecord> = {}
          for (const [id, r] of Object.entries(v.slots)) slots[id] = { h: r.h, t: r.t }
          days[date] = { slots }
        }
      }
      return { v: 2, days }
    }
    return { v: 2, days: {} }
  } catch {
    return { v: 2, days: {} }
  }
}

function readRawLegacy(date: string): LegacyDayState | null {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if ((parsed as { v?: unknown }).v === 2) return null
    return readLegacyDay(date, parsed)
  } catch {
    return null
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
// アプリが閉じていてもサーバー側で配達される。
// 本番ntfy.shの実測では、同じ予約IDへの再送が置換にならない場合があり
// （再送のたびに重複が増える）、DELETEでの取り消しも効かない。
// そのため再送は「内容が変わった枠だけ」に絞り、取り消しは GET delete で行う。
// なくなった未来分の予約は取り消す（配達済みには触らない）。
// 予約に間に合わなかった直近分（猶予内）はその場で送る。
// 送信に失敗した分は記録を残さず、次回に再試行できるようにする。
export async function syncSlotSchedules(
  topic: string,
  payload: SlotsPayload,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
  titled = false,
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
    return await runSyncSlotSchedules(topic, payload, fetchImpl, now, titled)
  } finally {
    release()
  }
}

let syncQueue: Promise<void> = Promise.resolve()

function slotContentHash(slot: SlotsPayload['slots'][number]): string {
  return JSON.stringify(slot)
}

async function runSyncSlotSchedules(
  topic: string,
  payload: SlotsPayload,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
  titled = false,
): Promise<{ scheduled: number; salvaged: number; cancelled: number }> {
  const none = { scheduled: 0, salvaged: 0, cancelled: 0 }
  const today = formatDate(now)
  if (payload.date < today) return none
  const nowMs = now.getTime()
  const state = readScheduledState()
  let records: Record<string, SlotRecord> = { ...(state.days[payload.date]?.slots ?? {}) }
  // 旧形式の記録は、内容が一致すれば黙って引き継ぎ、違えば送り直す。
  // 内容が違う場合も旧IDは引き継ぎ、なくなった枠の取り消し対象にする。
  if (Object.keys(records).length === 0) {
    const legacy = readRawLegacy(payload.date)
    const freshDayHash = `${payload.date}|${JSON.stringify(payload.slots)}`
    if (legacy) {
      for (const id of legacy.ids) records[id] = { h: '', t: 0 }
    }
    if (legacy && legacy.hash === freshDayHash) {
      records = {}
      for (const s of payload.slots) {
        records[slotSequenceId(payload.date, s.start)] = { h: slotContentHash(s), t: 0 }
      }
      const days: Record<string, DayState> = { ...state.days }
      for (const d of Object.keys(days)) {
        if (d < today) delete days[d]
      }
      days[payload.date] = { slots: records }
      try {
        localStorage.setItem(SCHEDULED_KEY, JSON.stringify({ v: 2, days }))
      } catch {
        // localStorage が利用できない環境では保存しない
      }
      return none
    }
  }
  const mark = titled ? 1 : 0
  const future: typeof payload.slots = []
  const salvage: typeof payload.slots = []
  for (const s of payload.slots) {
    const id = slotSequenceId(payload.date, s.start)
    const rec = records[id]
    const hash = slotContentHash(s)
    if (rec && rec.h === hash) continue
    // 無題（起動時）の同期は題付き（今日の計画）の記録を上書きしない。
    // 毎回の起動で無題予約が再送され重複するのを防ぐ。
    if (!titled && rec && rec.t === 1) continue
    const fireMs = slotStartUnix(payload.date, s.start) * 1000
    if (fireMs - nowMs >= SCHEDULE_AHEAD_MS) future.push(s)
    else if (nowMs - fireMs < SALVAGE_WINDOW_MIN * 60_000) salvage.push(s)
  }
  const current = new Set(payload.slots.map((s) => slotSequenceId(payload.date, s.start)))
  let cancelled = 0
  let failed = false
  let anySuccess = false
  const next: Record<string, SlotRecord> = {}
  // 今回送らない枠の記録はそのまま引き継ぐ。送る枠は成功時に新しい記録で置き換える。
  const posting = new Set([...future, ...salvage].map((s) => slotSequenceId(payload.date, s.start)))
  for (const s of payload.slots) {
    const id = slotSequenceId(payload.date, s.start)
    const rec = records[id]
    if (rec && !posting.has(id)) next[id] = rec
  }
  for (const id of Object.keys(records)) {
    if (current.has(id)) continue
    const parsed = parseSequenceId(id)
    if (!parsed) continue
    if (parsed.fireUnix * 1000 <= nowMs) continue
    if (await cancelScheduledPush(topic, id, fetchImpl)) {
      cancelled++
      anySuccess = true
    } else {
      failed = true
      const rec = records[id]
      if (rec) next[id] = rec
    }
  }
  let scheduled = 0
  for (const slot of future) {
    const id = slotSequenceId(payload.date, slot.start)
    const fireUnix = slotStartUnix(payload.date, slot.start)
    const result = await schedulePush(topic, slotStartMessage(slot), {
      title: slotStartTitle(slot.start),
      delay: fireUnix,
      sequenceId: id,
    }, fetchImpl)
    if (result.ok) {
      scheduled++
      anySuccess = true
      next[id] = { h: slotContentHash(slot), t: mark }
    } else {
      failed = true
      const rec = records[id]
      if (rec) next[id] = rec
    }
  }
  let salvaged = 0
  for (const slot of salvage) {
    const id = slotSequenceId(payload.date, slot.start)
    const result = await schedulePush(topic, slotStartMessage(slot), {
      title: slotStartTitle(slot.start),
      delay: Math.floor(now.getTime() / 1000) + SALVAGE_DELAY_SEC,
      sequenceId: id,
    }, fetchImpl)
    if (result.ok) {
      salvaged++
      anySuccess = true
      next[id] = { h: slotContentHash(slot), t: mark }
    } else {
      failed = true
      const rec = records[id]
      if (rec) next[id] = rec
    }
  }
  if (failed && !anySuccess) return { scheduled, salvaged, cancelled }
  const days: Record<string, DayState> = { ...state.days }
  for (const d of Object.keys(days)) {
    if (d < today) delete days[d]
  }
  days[payload.date] = { slots: next }
  try {
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify({ v: 2, days }))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
  return { scheduled, salvaged, cancelled }
}
