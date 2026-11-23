import { describe, it, expect } from 'vitest'
import { GRASS_STAGES } from './rpgGrassWorld'
import { stageActionFor, stageAppRoute, type StageContext } from './rpgStageAdapter'

const ctx: StageContext = { hasBooks: true, firstBookId: 'book-1', todayPages: 0, totalPages: 12 }

describe('rpgStageAdapter', () => {
  it('maps every grass stage to an existing app flow', () => {
    for (const s of GRASS_STAGES) {
      const action = stageActionFor(s.id, ctx)
      expect(action).not.toBeNull()
      expect(['today', 'book', 'ranking']).toContain(action!.target)
    }
  })

  it('sends stage-1 to today plan and stage-2 to the first book', () => {
    expect(stageActionFor('grass-stage-1', ctx)!.target).toBe('today')
    expect(stageActionFor('grass-stage-2', ctx)!.target).toBe('book')
  })

  it('returns null for unknown stages instead of inventing a game', () => {
    expect(stageActionFor('no-such-stage', ctx)).toBeNull()
  })

  it('maps today target to the today route', () => {
    expect(stageAppRoute('today', null)).toEqual({ name: 'today' })
  })

  it('maps book target with id to the detail route', () => {
    expect(stageAppRoute('book', 'book-1')).toEqual({ name: 'detail', bookId: 'book-1' })
  })

  it('maps book target without id to null', () => {
    expect(stageAppRoute('book', null)).toBeNull()
  })

  it('maps ranking target to null (already on ranking screen)', () => {
    expect(stageAppRoute('ranking', null)).toBeNull()
  })
})

describe('campus adapter', () => {
  it('campus-stage-1 goes to today', () => {
    const a = stageActionFor('campus-stage-1', { hasBooks: true, firstBookId: 'b1', todayPages: 0, totalPages: 0 })
    expect(a?.target).toBe('today')
  })
  it('campus-stage-2 goes to book when book exists', () => {
    const a = stageActionFor('campus-stage-2', { hasBooks: true, firstBookId: 'b1', todayPages: 1, totalPages: 10 })
    expect(a?.target).toBe('book')
    expect(a?.bookId).toBe('b1')
  })
  it('locked tap does not move (null when unknown)', () => {
    expect(stageActionFor('campus-stage-99', { hasBooks: false, firstBookId: null, todayPages: 0, totalPages: 0 })).toBeNull()
  })
  it('existing grass stages still work after campus add', () => {
    const a = stageActionFor('grass-stage-1', { hasBooks: false, firstBookId: null, todayPages: 0, totalPages: 0 })
    expect(a?.target).toBe('today')
  })
  it('campus-stage-3 goes to ranking (ground, R-C2)', () => {
    const a = stageActionFor('campus-stage-3', { hasBooks: false, firstBookId: null, todayPages: 0, totalPages: 0 })
    expect(a?.target).toBe('ranking')
  })
  it('campus-stage-4 is a today celebration', () => {
    const a = stageActionFor('campus-stage-4', { hasBooks: false, firstBookId: null, todayPages: 0, totalPages: 0 })
    expect(a?.target).toBe('today')
    expect(a?.hint).toContain('展望デッキで祝おう')
  })
})
