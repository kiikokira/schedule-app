import { describe, it, expect } from 'vitest'
import { searchCatalog, CATALOG } from './catalog'

describe('catalog', () => {
  it('contains at least 20 English reference books', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(20)
  })

  it('returns all books for an empty query', () => {
    expect(searchCatalog('')).toEqual(CATALOG)
  })

  it('filters books by title substring', () => {
    const result = searchCatalog('ポラリス')
    expect(result.length).toBeGreaterThan(1)
    expect(result.every((b) => b.title.includes('ポラリス'))).toBe(true)
  })

  it('is case-insensitive for latin text', () => {
    const result = searchCatalog('next')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.every((b) => b.title.toLowerCase().includes('next'))).toBe(true)
  })

  it('requires each book to have pages and a subject', () => {
    for (const b of CATALOG) {
      expect(b.totalPages).toBeGreaterThanOrEqual(1)
      expect(b.subject.length).toBeGreaterThan(0)
    }
  })
})