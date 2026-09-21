import { describe, it, expect } from 'vitest'
import { QUOTES, quoteOf } from './quotes'
import { parseDate } from '../lib/progress'

const addDays = (iso: string, days: number): string => {
  const d = parseDate(iso)
  d.setDate(d.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

describe('quotes', () => {
  it('provides a non-empty text, author, role and explanation for every quote', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(25)
    for (const q of QUOTES) {
      expect(q.text.length).toBeGreaterThan(0)
      expect(q.author.length).toBeGreaterThan(0)
      expect(q.role.length).toBeGreaterThan(0)
      expect(q.explanation.length).toBeGreaterThan(0)
    }
  })

  it('returns the same quote for the same date', () => {
    expect(quoteOf('2026-09-21')).toEqual(quoteOf('2026-09-21'))
  })

  it('returns a different quote on the next day', () => {
    expect(quoteOf('2026-09-21')).not.toEqual(quoteOf('2026-09-22'))
  })

  it('shows a quote until the exam end date and none after it', () => {
    expect(quoteOf('2028-02-05')).not.toBeNull()
    expect(quoteOf('2028-02-06')).toBeNull()
    expect(quoteOf('2030-01-01')).toBeNull()
  })

  it('cycles through every quote across consecutive days', () => {
    const seen = new Set<string>()
    for (let i = 0; i < QUOTES.length; i++) {
      const q = quoteOf(addDays('2026-09-21', i))
      expect(q).not.toBeNull()
      seen.add((q as { text: string }).text)
    }
    expect(seen.size).toBe(QUOTES.length)
  })
})