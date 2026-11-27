// 並木道の看板クエストの表示状態。今日の枠を最大4件まで扱う。

export type CampusQuestSlot = { title: string; bookId: string | null }
export const MAX_QUEST_SLOTS = 4

export function visibleSlots(slots: readonly CampusQuestSlot[]): CampusQuestSlot[] {
  return slots.slice(0, MAX_QUEST_SLOTS)
}

export function questPanelState(slots: readonly CampusQuestSlot[], slotsDone: boolean): 'done' | 'empty' | 'slots' {
  if (slotsDone) return 'done'
  return slots.length === 0 ? 'empty' : 'slots'
}

export function questSummary(slots: readonly CampusQuestSlot[], slotsDone: boolean): string {
  if (slotsDone) return '全完了'
  if (slots.length === 0) return '枠なし'
  return `${Math.min(slots.length, MAX_QUEST_SLOTS)}件`
}
