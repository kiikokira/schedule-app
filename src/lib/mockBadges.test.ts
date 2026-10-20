import { describe, it, expect } from 'vitest'
import { listBadges } from './mockBadges'

describe('mockBadges', () => {
  it('初記録で初陣が解除される', () => {
    const b = listBadges([{ ym: '2026-10', rank: 50000, deviation: 55.1, pages: 200 }])
    expect(b.find((x) => x.id === 'first')?.unlocked).toBe(true)
  })
  it('空履歴では全て未解除', () => {
    const b = listBadges([])
    expect(b.length).toBe(5)
    expect(b.every((x) => !x.unlocked)).toBe(true)
  })
  it('3ヶ月連続で連続賞が解除される', () => {
    const b = listBadges([
      { ym: '2026-08', rank: 60000, deviation: 54, pages: 100 },
      { ym: '2026-09', rank: 55000, deviation: 54.5, pages: 150 },
      { ym: '2026-10', rank: 50000, deviation: 55.1, pages: 200 },
    ])
    expect(b.find((x) => x.id === 'streak3')?.unlocked).toBe(true)
  })
  it('前回比+3でジャンプ賞・最高更新で自己ベストが解除される', () => {
    const b = listBadges([
      { ym: '2026-09', rank: 60000, deviation: 52, pages: 100 },
      { ym: '2026-10', rank: 30000, deviation: 57, pages: 300 },
    ])
    expect(b.find((x) => x.id === 'jump')?.unlocked).toBe(true)
    expect(b.find((x) => x.id === 'best')?.unlocked).toBe(true)
  })
  it('20000位以内で上位10%が解除される', () => {
    const b = listBadges([{ ym: '2026-10', rank: 15000, deviation: 60, pages: 500 }])
    expect(b.find((x) => x.id === 'top10')?.unlocked).toBe(true)
  })
})
