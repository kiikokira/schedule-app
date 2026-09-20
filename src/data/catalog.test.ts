import { describe, it, expect } from 'vitest'
import { searchCatalog, CATALOG } from './catalog'

describe('catalog', () => {
  it('contains 45 English reference books', () => {
    expect(CATALOG.length).toBe(45)
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

  it('requires each book to have pages, a subject, and cover url', () => {
    for (const b of CATALOG) {
      expect(b.totalPages).toBeGreaterThanOrEqual(1)
      expect(b.subject.length).toBeGreaterThan(0)
      expect(b.coverSrc).toBeTruthy()
      expect(b.coverSrc).toMatch(/^https:\/\//)
    }
  })

  it('unique ids across the catalog', () => {
    const ids = CATALOG.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes the newly added 英文法ポラリス2', () => {
    const book = CATALOG.find((b) => b.id === 'eibunpo-polaris-2')
    expect(book).toBeDefined()
    expect(book?.title).toBe('英文法ポラリス2（応用レベル）')
    expect(book?.totalPages).toBe(320)
  })

  it('includes the newly added The Rules series', () => {
    const rules1 = CATALOG.find((b) => b.id === 'the-rules-1')
    const rules4 = CATALOG.find((b) => b.id === 'the-rules-4')
    expect(rules1).toBeDefined()
    expect(rules1?.coverSrc).toMatch(/^https:\/\//)
    expect(rules4).toBeDefined()
    expect(rules4?.totalPages).toBe(224)
  })
})