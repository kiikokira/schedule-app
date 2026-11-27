import { describe, it, expect } from 'vitest'
import { visibleSlots, questPanelState, questSummary, type CampusQuestSlot } from './sfcCampusQuests'

const slot = (n: number): CampusQuestSlot => ({ title: `本${n}`, bookId: `b${n}` })

describe('campus quests', () => {
  it('shows at most 4 slots', () => {
    expect(visibleSlots([1, 2, 3, 4, 5].map(slot)).length).toBe(4)
  })
  it('classifies the panel state', () => {
    expect(questPanelState([], false)).toBe('empty')
    expect(questPanelState([], true)).toBe('done')
    expect(questPanelState([slot(1)], false)).toBe('slots')
    expect(questPanelState([slot(1)], true)).toBe('done')
  })
  it('summarizes for the HUD', () => {
    expect(questSummary([], false)).toBe('枠なし')
    expect(questSummary([], true)).toBe('全完了')
    expect(questSummary([slot(1), slot(2)], false)).toBe('2件')
    expect(questSummary([1, 2, 3, 4, 5].map(slot), false)).toBe('4件')
  })
})
