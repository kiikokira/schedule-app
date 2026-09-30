import { useEffect } from 'react'
import { todayStr } from './progress'
import { publishPush } from './notify'
import {
  msUntilNextReminder,
  nextReminderSlot,
  slotStartMessage,
  slotStartTitle,
  type SlotsPayload,
} from './slotNotify'

// アプリを開いている間、その日の残りすべての空き時間の開始10分前にその場で通知を送る。
// 発火のたびに次の通知枠を予約し直す（連鎖タイマー）。
// サーバー側の定期実行より早く届く。タイトルを
// 統一しているため、サーバー側の二重送信防止にもかかる。
export function useSlotStartReminder(
  enabled: boolean,
  topic: string,
  payload: SlotsPayload | null,
): void {
  useEffect(() => {
    if (!enabled || !topic.trim() || !payload) return
    if (payload.date !== todayStr()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      const next = nextReminderSlot(payload.slots, new Date())
      if (!next) return
      const delay = msUntilNextReminder([next], new Date())
      if (delay === null) return
      timer = setTimeout(() => {
        void publishPush(topic, slotStartMessage(next), {
          title: slotStartTitle(next.start),
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
