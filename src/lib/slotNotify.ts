import { parseTimeToMin, type PlanSlot, type TimeSlot } from './dayplan'
import type { BookData } from './progress'

export type SlotInfo = { start: string; end: string; books: string[] }
export type SlotsPayload = { date: string; slots: SlotInfo[]; savedAt: string }

// 空き時間の開始10分前に送る通知のリードタイム（分）。
export const REMINDER_LEAD_MIN = 10

// 開始10分前通知のタイトル。アプリとワークフローで共有し、
// 同じ時間帯への二重送信を防ぐキーにも使う。
export function slotStartTitle(start: string): string {
  return `学習開始10分前 ${start}`
}

export function slotStartMessage(slot: SlotInfo): string {
  const base = `${slot.start}～${slot.end} の学習が10分後に始まります。準備しましょう`
  return slot.books.length > 0 ? `${base}（${slot.books.join('、')}）` : base
}

export function formatMin(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

function startOfDay(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// 通知を送る時刻（開始の10分前）を分で返す。深夜帯は前日になるため呼び出し側で除外する。
export function reminderTimeMin(slot: Pick<SlotInfo, 'start'>): number {
  return parseTimeToMin(slot.start) - REMINDER_LEAD_MIN
}

export function buildSlotsPayload(
  date: string,
  availability: TimeSlot[],
  planned: PlanSlot[],
  books: BookData[],
): SlotsPayload {
  const byId = new Map(books.map((b) => [b.id, b.title]))
  const slots: SlotInfo[] = [...availability]
    .sort((a, b) => a.startMin - b.startMin)
    .map((s) => {
      const titles: string[] = []
      for (const p of planned) {
        if (p.startMin >= s.startMin && p.endMin <= s.endMin) {
          const title = byId.get(p.bookId) ?? p.bookId
          if (!titles.includes(title)) titles.push(title)
        }
      }
      return { start: formatMin(s.startMin), end: formatMin(s.endMin), books: titles }
    })
  return { date, slots, savedAt: new Date().toISOString() }
}

// サーバー側の判定と同じ規則: 当日分だけ、通知時刻から windowMin 分以内のものを返す。
export function dueSlotStarts(
  payload: SlotsPayload,
  today: string,
  nowMin: number,
  windowMin = 15,
): SlotInfo[] {
  if (payload.date !== today) return []
  return payload.slots.filter((s) => {
    const early = nowMin - reminderTimeMin(s)
    return early >= 0 && early < windowMin
  })
}

// その日の残りの通知時刻のうち、直近のものまでのミリ秒。なければ null。
export function msUntilNextReminder(slots: SlotInfo[], now: Date): number | null {
  const base = startOfDay(now)
  const nowMs = now.getTime()
  let best: number | null = null
  for (const s of slots) {
    const t = base + reminderTimeMin(s) * 60_000
    if (t > nowMs && (best === null || t < best)) best = t
  }
  return best === null ? null : best - nowMs
}

export function nextReminderSlot(slots: SlotInfo[], now: Date): SlotInfo | null {
  const base = startOfDay(now)
  const nowMs = now.getTime()
  let best: SlotInfo | null = null
  let bestMs = Infinity
  for (const s of slots) {
    const t = base + reminderTimeMin(s) * 60_000
    if (t > nowMs && t < bestMs) {
      bestMs = t
      best = s
    }
  }
  return best
}
