import { useEffect } from 'react'
import { parseTimeToMin } from './dayplan'
import { publishPush } from './notify'
import { todayStr } from './progress'
import {
  msUntilNextSlotEnd,
  nextEndingSlot,
  slotEndMessage,
  slotEndTitle,
  type SlotsPayload,
} from './slotNotify'

// アプリを開いている間、直近の空き時間の終了時刻にその場で通知を送る。
// サーバー側の定期実行（最大15分遅れ）より早く届く。タイトルを
// 統一しているため、サーバー側の二重送信防止にもかかる。
export function useSlotEndReminder(
  enabled: boolean,
  topic: string,
  payload: SlotsPayload | null,
): void {
  useEffect(() => {
    if (!enabled || !topic.trim() || !payload) return
    if (payload.date !== todayStr()) return
    const now = new Date()
    const next = nextEndingSlot(payload.slots, now)
    if (!next) return
    const delay = msUntilNextSlotEnd([parseTimeToMin(next.end)], now)
    if (delay === null) return
    const timer = setTimeout(() => {
      void publishPush(topic, slotEndMessage(next), {
        title: slotEndTitle(next.end),
      })
    }, delay)
    return () => clearTimeout(timer)
  }, [enabled, topic, payload])
}
