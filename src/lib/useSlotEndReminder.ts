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

// アプリを開いている間、その日の残りすべての空き時間の終了時刻にその場で通知を送る。
// 発火のたびに次の終了枠を予約し直す（連鎖タイマー）。
// サーバー側の定期実行より早く届く。タイトルを
// 統一しているため、サーバー側の二重送信防止にもかかる。
export function useSlotEndReminder(
  enabled: boolean,
  topic: string,
  payload: SlotsPayload | null,
): void {
  useEffect(() => {
    if (!enabled || !topic.trim() || !payload) return
    if (payload.date !== todayStr()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      const next = nextEndingSlot(payload.slots, new Date())
      if (!next) return
      const delay = msUntilNextSlotEnd([parseTimeToMin(next.end)], new Date())
      if (delay === null) return
      timer = setTimeout(() => {
        void publishPush(topic, slotEndMessage(next), {
          title: slotEndTitle(next.end),
        })
        schedule()
      }, delay)
    }
    schedule()
    return () => {
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [enabled, topic, payload])
}
