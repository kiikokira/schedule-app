import { CAMPUS_CELL, CAMPUS_COLS, CAMPUS_GRID, CAMPUS_ROWS } from './sfcCampusGrid'
import type { Point, RectBlocker } from './sfcCampusMovement'

export type GridBuilding = {
  id: string
  name: string | null
  c0: number
  c1: number
  r0: number
  r1: number
  entrance: { x: number; y: number }
}

export const BUILDING_NAMES: Readonly<Record<string, { id: string; name: string }>> = {
  S: { id: 'sigma-cafeteria', name: 'Σ生協食堂' },
  K: { id: 'kappa', name: 'κ館' },
  E: { id: 'epsilon', name: 'ε館' },
  I: { id: 'iota', name: 'ι館' },
  O: { id: 'omicron', name: 'ο館' },
  L: { id: 'lambda', name: 'λ館' },
  M: { id: 'mu', name: 'Μメディアセンター' },
  U: { id: 'lounge', name: '学生ラウンジ' },
  T: { id: 'theta', name: 'Θ館' },
  W: { id: 'omega', name: 'Ω館' },
  Y: { id: 'tau', name: 'τ大学院棟' },
  A: { id: 'alpha', name: 'Α本館' },
}

const BUILDING_CHARS = new Set(['n', ...Object.keys(BUILDING_NAMES)])

export function cellAt(col: number, row: number): string {
  if (col < 0 || row < 0 || col >= CAMPUS_COLS || row >= CAMPUS_ROWS) return '#'
  return CAMPUS_GRID[row][col]
}

export function cellAtPoint(x: number, y: number): string {
  return cellAt(Math.floor(x / CAMPUS_CELL), Math.floor(y / CAMPUS_CELL))
}

export function isRoadCell(ch: string): boolean {
  return ch === '='
}

export function isBlockedCell(ch: string): boolean {
  return ch === '#' || ch === '~' || BUILDING_CHARS.has(ch)
}

export function buildingsFromGrid(): GridBuilding[] {
  const seen: boolean[][] = CAMPUS_GRID.map((row) => row.split('').map(() => false))
  const out: GridBuilding[] = []
  let unnamed = 0
  for (let r = 0; r < CAMPUS_ROWS; r += 1) {
    for (let c = 0; c < CAMPUS_COLS; c += 1) {
      const ch = CAMPUS_GRID[r][c]
      if (seen[r][c] || !BUILDING_CHARS.has(ch)) continue
      const stack: Array<[number, number]> = [[c, r]]
      seen[r][c] = true
      let c0 = c
      let c1 = c
      let r0 = r
      let r1 = r
      while (stack.length > 0) {
        const [cc, rr] = stack.pop()!
        c0 = Math.min(c0, cc)
        c1 = Math.max(c1, cc)
        r0 = Math.min(r0, rr)
        r1 = Math.max(r1, rr)
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cc + dc
          const nr = rr + dr
          if (nc < 0 || nr < 0 || nc >= CAMPUS_COLS || nr >= CAMPUS_ROWS) continue
          if (seen[nr][nc] || CAMPUS_GRID[nr][nc] !== ch) continue
          seen[nr][nc] = true
          stack.push([nc, nr])
        }
      }
      const named = BUILDING_NAMES[ch]
      let id: string
      if (named) {
        id = named.id
      } else {
        unnamed += 1
        id = `unnamed-${unnamed}`
      }
      out.push({
        id,
        name: named ? named.name : null,
        c0,
        c1,
        r0,
        r1,
        entrance: {
          x: Math.round((c0 + c1) / 2) * CAMPUS_CELL + CAMPUS_CELL / 2,
          y: (r1 + 2) * CAMPUS_CELL + CAMPUS_CELL / 2,
        },
      })
    }
  }
  return out
}

export function blockerRects(): RectBlocker[] {
  const out: RectBlocker[] = []
  type Open = { c0: number; c1: number; r0: number; r1: number }
  let open = new Map<string, Open>()
  for (let r = 0; r <= CAMPUS_ROWS; r += 1) {
    const runs: Array<[number, number]> = []
    if (r < CAMPUS_ROWS) {
      let start = -1
      for (let c = 0; c <= CAMPUS_COLS; c += 1) {
        const blocked = c < CAMPUS_COLS && isBlockedCell(CAMPUS_GRID[r][c])
        if (blocked && start < 0) start = c
        if (!blocked && start >= 0) {
          runs.push([start, c - 1])
          start = -1
        }
      }
    }
    const next = new Map<string, Open>()
    for (const [c0, c1] of runs) {
      const key = `${c0}:${c1}`
      const prev = open.get(key)
      if (prev) {
        prev.r1 = r
        next.set(key, prev)
      } else {
        next.set(key, { c0, c1, r0: r, r1: r })
      }
    }
    for (const [key, rect] of open) {
      if (next.has(key)) continue
      out.push({
        kind: 'rect',
        x: rect.c0 * CAMPUS_CELL,
        y: rect.r0 * CAMPUS_CELL,
        w: (rect.c1 - rect.c0 + 1) * CAMPUS_CELL,
        h: (rect.r1 - rect.r0 + 1) * CAMPUS_CELL,
      })
    }
    open = next
  }
  return out
}

export function roadCellCenters(): Point[] {
  const out: Point[] = []
  for (let r = 0; r < CAMPUS_ROWS; r += 1) {
    for (let c = 0; c < CAMPUS_COLS; c += 1) {
      if (isRoadCell(CAMPUS_GRID[r][c])) {
        out.push({ x: c * CAMPUS_CELL + CAMPUS_CELL / 2, y: r * CAMPUS_CELL + CAMPUS_CELL / 2 })
      }
    }
  }
  return out
}
