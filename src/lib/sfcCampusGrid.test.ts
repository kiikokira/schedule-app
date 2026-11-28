import { describe, it, expect } from 'vitest'
import { CAMPUS_COLS, CAMPUS_ROWS, CAMPUS_GRID, CAMPUS_CELL } from './sfcCampusGrid'

describe('campus grid', () => {
  it('has the fixed dimensions', () => {
    expect(CAMPUS_CELL).toBe(8)
    expect(CAMPUS_GRID.length).toBe(CAMPUS_ROWS)
    expect(CAMPUS_COLS).toBe(185)
    expect(CAMPUS_ROWS).toBe(148)
    for (const row of CAMPUS_GRID) expect(row.length).toBe(CAMPUS_COLS)
  })
  it('uses only the known terrain characters', () => {
    const allowed = new Set(['.', '=', ':', '~', '#', 'n', 'S', 'K', 'E', 'I', 'O', 'L', 'M', 'U', 'T', 'W', 'Y', 'A'])
    for (const row of CAMPUS_GRID) for (const ch of row) expect(allowed.has(ch)).toBe(true)
  })
})
