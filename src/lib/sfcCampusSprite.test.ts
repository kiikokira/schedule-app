import { describe, it, expect, vi } from 'vitest'
import { SPRITE_FRAMES, drawStudent, drawHotspotMarker, type Direction } from './sfcCampusSprite'

function fakeCtx() {
  const calls: string[] = []
  const fn = (name: string) => vi.fn(() => { calls.push(name) })
  const ctx = {
    save: fn('save'), restore: fn('restore'), fillRect: fn('fillRect'),
    beginPath: fn('beginPath'), arc: fn('arc'), fill: fn('fill'),
    fillText: fn('fillText'), measureText: vi.fn(() => ({ width: 8 })),
    fillStyle: '', font: '', textAlign: '', textBaseline: '',
  } as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

describe('drawStudent', () => {
  it('draws pixels for every direction and frame', () => {
    const dirs: Direction[] = ['down', 'left', 'right', 'up']
    for (const dir of dirs) {
      for (const frame of [0, 1] as const) {
        const { ctx, calls } = fakeCtx()
        drawStudent(ctx, 100, 100, dir, frame, true)
        expect(calls.filter((c) => c === 'fillRect').length).toBeGreaterThan(5)
        expect(calls.filter((c) => c === 'save').length).toBe(calls.filter((c) => c === 'restore').length)
      }
    }
  })
  it('does not throw when idle', () => {
    const { ctx } = fakeCtx()
    expect(() => drawStudent(ctx, 50, 50, 'down', 0, false)).not.toThrow()
  })
})

describe('SPRITE_FRAMES', () => {
  const dirs: Direction[] = ['down', 'left', 'right', 'up']

  it('has eight 12x16 frames', () => {
    for (const dir of dirs) {
      for (const frame of [0, 1] as const) {
        const rows = SPRITE_FRAMES[dir][frame]
        expect(rows.length).toBe(16)
        for (const row of rows) expect(row.length).toBe(12)
      }
    }
  })

  it('has no gaps in the body rows', () => {
    for (const dir of dirs) {
      for (const frame of [0, 1] as const) {
        const rows = SPRITE_FRAMES[dir][frame]
        for (let r = 6; r <= 11; r += 1) {
          const cells = rows[r].split('')
          const first = cells.findIndex((c) => c !== '.')
          const last = cells.length - 1 - [...cells].reverse().findIndex((c) => c !== '.')
          expect(first).toBeGreaterThanOrEqual(0)
          for (let c = first; c <= last; c += 1) expect(cells[c]).not.toBe('.')
        }
      }
    }
  })

  it('has no backpack on the back-facing frames', () => {
    for (const frame of [0, 1] as const) {
      expect(SPRITE_FRAMES.up[frame].join('')).not.toContain('B')
    }
  })
})

describe('drawHotspotMarker', () => {
  it('draws a marker', () => {
    const { ctx, calls } = fakeCtx()
    drawHotspotMarker(ctx, 20, 30, true, 0.5)
    expect(calls).toContain('arc')
    expect(calls).toContain('fillText')
  })
})
