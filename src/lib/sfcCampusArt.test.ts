import { describe, it, expect } from 'vitest'
import { CAMPUS_PALETTE, drawCampusBase } from './sfcCampusArt'
import { CAMPUS_LAYOUT } from './sfcCampusLayout'
import type { CampusLayout } from './sfcCampusLayout'

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
      expect(y + 5).toBeLessThanOrEqual(b.y + b.h - 1)
    }
    expect(ctx.__ops.some((op) => op[0] === 'setLineDash')).toBe(false)
  })

  it('keeps flowers off the stone pavement', () => {
    const layout: CampusLayout = {
      width: 1600,
      height: 1200,
      buildings: [],
      pond: [],
      paths: [{ points: [{ x: 100, y: 600 }, { x: 1500, y: 600 }], width: 120, kind: 'stone' }],
      cliffs: [{ x: 0, y: 0, w: 40, h: 40 }],
      treeZones: [{ x: 100, y: 100, w: 200, h: 200, density: 0.2 }],
    }
    const ctx = recorder()
    drawCampusBase(ctx, layout)
    const flowers = new Set<string>([CAMPUS_PALETTE.flowerPink, CAMPUS_PALETTE.flowerYellow, CAMPUS_PALETTE.flowerWhite])
    for (const op of ctx.__ops) {
      if (op[0] === 'fillRect' && flowers.has(op[1] as string)) {
        const x = op[2] as number
        const y = op[3] as number
        const dx = Math.max(0, 100 - x, x - 1500)
        const distance = Math.hypot(dx, y - 600)
        expect(distance).toBeGreaterThan(60)
      }
    }
  })
})
