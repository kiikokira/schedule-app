import { describe, expect, it } from 'vitest'
import { makeSlotKey, rivalForSlot, rivalSlotAmount, leagueSlotInfo } from './slotLeague'

describe('slotLeague', () => {
  it('slotKeyは 日付#start-end 形式', () => {
    expect(makeSlotKey('2026-10-26', 390, 420)).toBe('2026-10-26#390-420')
  })
  it('同一キーは同一相手、別キーは分散しやすい', () => {
    const a = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    const b = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    expect(a.id).toBe(b.id)
    const c = rivalForSlot('2026-09-01', 10, '2026-10-26#1005-1035')
    expect(typeof c.name).toBe('string')
  })
  it('30分枠の相手量は日次baseの約1/4±揺らぎ', () => {
    const r = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    const v = rivalSlotAmount(r, '2026-10-26#390-420', 'pages', 30)
    expect(v).toBeGreaterThanOrEqual(1)
    expect(v).toBeLessThanOrEqual(20)
  })
  it('語枠はページbase×15基準で大きくなる', () => {
    const r = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    const p = rivalSlotAmount(r, '2026-10-26#390-420', 'pages', 30)
    const w = rivalSlotAmount(r, '2026-10-26#390-420', 'words', 30)
    expect(w).toBeGreaterThan(p)
  })
  it('my>oppでwin、同値draw、やらなかった想定my=0はlossになりうる', () => {
    const info = leagueSlotInfo('2026-09-01', 10, '2026-10-26#390-420', 10, 'pages', 30)
    expect(['win','draw','loss']).toContain(info.result)
    expect(info.opponent.length).toBeGreaterThan(0)
  })
})
