import { describe, it, expect, vi } from 'vitest'
import { drawStudent, drawHotspotMarker, type Direction } from './sfcCampusSprite'

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

describe('drawHotspotMarker', () => {
  it('draws a marker', () => {
    const { ctx, calls } = fakeCtx()
    drawHotspotMarker(ctx, 20, 30, true, 0.5)
    expect(calls).toContain('arc')
    expect(calls).toContain('fillText')
  })
})
