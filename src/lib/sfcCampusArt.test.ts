import { describe, it, expect } from 'vitest'
import { CAMPUS_PALETTE, drawCampusBase, placeTrees } from './sfcCampusArt'
import { CAMPUS_LAYOUT } from './sfcCampusLayout'
import { cellAt, cellAtPoint, isBlockedCell, isRoadCell } from './sfcCampusGridQuery'

type Op = unknown[]

function recorder() {
  const ops: Op[] = []
  let fill = ''
  const ctx = new Proxy({}, {
    get(_target, key) {
      if (key === '__ops') return ops
      if (key === 'fillStyle') return fill
      return (...args: unknown[]) => {
        ops.push([String(key), fill, ...args])
      }
    },
    set(_target, key, value) {
      if (key === 'fillStyle') fill = String(value)
      return true
    },
  })
  return ctx as unknown as CanvasRenderingContext2D & { __ops: Op[] }
}

function isBuildingCell(ch: string): boolean {
  return isBlockedCell(ch) && ch !== '#' && ch !== '~'
}

describe('drawCampusBase', () => {
  it('draws a rich, deterministic campus with no text or images', () => {
    const a = recorder()
    const b = recorder()
    drawCampusBase(a)
    drawCampusBase(b)
    expect(a.__ops.length).toBeGreaterThan(1500)
    expect(a.__ops).toEqual(b.__ops)
    const methods = new Set(a.__ops.map((op) => op[0]))
    expect(methods.has('fillRect')).toBe(true)
    expect(methods.has('fill')).toBe(true)
    expect(methods.has('fillText')).toBe(false)
    expect(methods.has('strokeText')).toBe(false)
    expect(methods.has('drawImage')).toBe(false)
    expect(JSON.stringify(a.__ops)).toContain(CAMPUS_PALETTE.grassDark)
  })

  it('draws windows only inside the south wall and never dashes a path', () => {
    const ctx = recorder()
    drawCampusBase(ctx)
    const windows = ctx.__ops.filter((op) => op[0] === 'fillRect' && op[1] === '#2a3f5f')
    expect(windows.length).toBeGreaterThan(20)
    for (const op of windows) {
      const x = op[2] as number
      const y = op[3] as number
      const b = CAMPUS_LAYOUT.buildings.find((building) =>
        x >= building.x && x <= building.x + building.w && y >= building.y && y <= building.y + building.h)
      expect(b).toBeDefined()
      if (!b) continue
      const wallY = b.y + Math.max(30, Math.round(b.h * 0.62))
      expect(y).toBeGreaterThanOrEqual(wallY)
      expect(y).toBeLessThan(b.y + b.h - 2)
    }
    expect(ctx.__ops.some((op) => op[0] === 'setLineDash')).toBe(false)
  })

  it('keeps flowers on grass cells only', () => {
    const ctx = recorder()
    drawCampusBase(ctx)
    const flowers = new Set<string>([CAMPUS_PALETTE.flowerPink, CAMPUS_PALETTE.flowerYellow, CAMPUS_PALETTE.flowerWhite])
    const anchors = ctx.__ops.filter((op) =>
      op[0] === 'fillRect' && flowers.has(op[1] as string) && op[4] === 3 && op[5] === 3)
    expect(anchors.length).toBeGreaterThan(100)
    for (const op of anchors) {
      expect(cellAtPoint(op[2] as number, op[3] as number)).toBe('.')
    }
  })
})

describe('placeTrees', () => {
  it('places at least 100 trees', () => {
    expect(placeTrees().length).toBeGreaterThanOrEqual(100)
  })

  it('plants every trunk on grass, away from roads, buildings and water', () => {
    for (const t of placeTrees()) {
      const bx = t.x
      const by = t.y + t.r * 0.5
      expect(cellAtPoint(bx, by)).toBe('.')
      const col = Math.floor(bx / 8)
      const row = Math.floor(by / 8)
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const ch = cellAt(col + dc, row + dr)
          expect(isRoadCell(ch)).toBe(false)
          expect(isBuildingCell(ch)).toBe(false)
          expect(ch).not.toBe('~')
        }
      }
    }
  })
})
