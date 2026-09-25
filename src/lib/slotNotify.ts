import { parseTimeToMin, type PlanSlot, type TimeSlot } from './dayplan'
import type { BookData } from './progress'

export type SlotInfo = { start: string; end: string; books: string[] }
export type SlotsPayload = { date: string; slots: SlotInfo[]; savedAt: string }

// 空き時間の終了直後に送る通知のタイトル。アプリとワークフローで共有し、
// 同じ時間帯への二重送信を防ぐキーにも使う。
export function slotEndTitle(end: string): string {
  return `学習時間終了 ${end}`
}

export function slotEndMessage(slot: SlotInfo): string {
  const base = `${slot.start}～${slot.end} の空き時間が終わりました。今日の学習を記録しましたか？`
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

// サーバー側の判定と同じ規則: 当日分だけ、終了から windowMin 分以内のものを返す。
export function dueSlotEnds(
  payload: SlotsPayload,
  today: string,
  nowMin: number,
  windowMin = 15,
): SlotInfo[] {
  if (payload.date !== today) return []
  return payload.slots.filter((s) => {
    const endMin = parseTimeToMin(s.end)
    const elapsed = nowMin - endMin
    return elapsed >= 0 && elapsed < windowMin
  })
}

// その日の残りの終了時刻のうち、直近のものまでのミリ秒。なければ null。
export function msUntilNextSlotEnd(endsMin: number[], now: Date): number | null {
  const base = startOfDay(now)
  const nowMs = now.getTime()
  let best: number | null = null
  for (const m of endsMin) {
    const t = base + m * 60_000
    if (t > nowMs && (best === null || t < best)) best = t
  }
  return best === null ? null : best - nowMs
}

export function nextEndingSlot(slots: SlotInfo[], now: Date): SlotInfo | null {
  const base = startOfDay(now)
  const nowMs = now.getTime()
  let best: SlotInfo | null = null
  let bestMs = Infinity
  for (const s of slots) {
    const t = base + parseTimeToMin(s.end) * 60_000
    if (t > nowMs && t < bestMs) {
      bestMs = t
      best = s
    }
  }
  return best
}
