import { describe, it, expect } from 'vitest'
import { CAMPUS_PALETTE, drawCampusBase } from './sfcCampusArt'

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
})
