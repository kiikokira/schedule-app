import { describe, expect, it } from 'vitest'
import { generateRivals, rivalPagesForDay, DIV_BASE_PAGES } from './seasonRivals'

describe('seasonRivals', () => {
  it('7人生成・同一seedで同一', () => {
    const a = generateRivals('2026-09-01', 10)
    const b = generateRivals('2026-09-01', 10)
    expect(a.length).toBe(7)
    expect(a).toEqual(b)
  })
  it('Div1はDiv10より強い', () => {
    expect(DIV_BASE_PAGES[1]).toBeGreaterThan(DIV_BASE_PAGES[10])
    const weak = generateRivals('2026-09-01', 10)
    const strong = generateRivals('2026-09-01', 1)
    const avg = (rs: { id: string }[]) => rs.reduce((s, r, i) => s + rivalPagesForDay(r as never, i), 0) / rs.length
    expect(avg(strong)).toBeGreaterThan(avg(weak))
  })
  it('名前はAI接頭辞なしの大学＋実在学部で重複なし', () => {
    for (const div of [1, 5, 10]) {
      const names = generateRivals('2026-09-01', div).map((r) => r.name)
      expect(names.length).toBe(7)
      for (const n of names) {
        expect(n.startsWith('AI')).toBe(false)
        expect(n).toMatch(/学部|学群|学域|学院|学環|類/)
      }
      expect(new Set(names).size).toBe(7)
    }
  })
})
