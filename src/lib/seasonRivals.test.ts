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
})
