import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { evaluateDay, listPenalties, getPenaltySettings, setPenaltySettings } from './penaltyStore'

beforeEach(async () => {
  await db.penalties.clear()
  localStorage.clear()
})

describe('penaltyStore', () => {
  it('未記録があれば保存される', async () => {
    const e = await evaluateDay('2026-11-14', ['a', 'b'], new Set(['a']), [{ bookId: 'a', pages: 10 }, { bookId: 'b', pages: 20 }], [], 'normal')
    expect(e?.missingBookIds).toEqual(['b'])
    expect(e?.pageDebt).toBe(20)
    expect(e?.points).toBe(10)
    expect(await listPenalties()).toHaveLength(1)
  })
  it('全記録ならnullで保存しない', async () => {
    const e = await evaluateDay('2026-11-14', ['a'], new Set(['a']), [{ bookId: 'a', pages: 10 }], [], 'normal')
    expect(e).toBeNull()
  })
  it('同日再評価は上書きで1件のまま', async () => {
    await evaluateDay('2026-11-14', ['a'], new Set(), [{ bookId: 'a', pages: 10 }], [], 'normal')
    await evaluateDay('2026-11-14', ['a', 'b'], new Set(), [{ bookId: 'a', pages: 10 }, { bookId: 'b', pages: 5 }], [], 'normal')
    expect(await listPenalties()).toHaveLength(1)
  })
  it('遅延記録で解消され削除される', async () => {
    await evaluateDay('2026-11-14', ['a'], new Set(), [{ bookId: 'a', pages: 10 }], [], 'normal')
    const e = await evaluateDay('2026-11-14', ['a'], new Set(['a']), [{ bookId: 'a', pages: 10 }], [], 'normal')
    expect(e).toBeNull()
    expect(await listPenalties()).toHaveLength(0)
  })
  it('別日はseverityが遡及変更されない', async () => {
    await evaluateDay('2026-11-13', ['a'], new Set(), [{ bookId: 'a', pages: 10 }], [], 'mild')
    await evaluateDay('2026-11-14', ['a'], new Set(), [{ bookId: 'a', pages: 10 }], [], 'strict')
    const all = await listPenalties()
    expect(all.find((p) => p.date === '2026-11-13')?.points).toBe(5)
    expect(all.find((p) => p.date === '2026-11-14')?.points).toBe(20)
  })
  it('設定の既定はnormal', () => {
    expect(getPenaltySettings().severity).toBe('normal')
  })
  it('severityを保存できる', () => {
    setPenaltySettings({ severity: 'strict', enabledBanner: true })
    expect(getPenaltySettings().severity).toBe('strict')
  })
})
