import { describe, it, expect } from 'vitest'
import { stickVector, isTap } from './sfcCampusStick'

describe('stickVector', () => {
  it('returns zero when the pointer has not moved', () => {
    expect(stickVector({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ dx: 0, dy: 0 })
  })
  it('scales the distance up to the maximum', () => {
    const right = stickVector({ x: 0, y: 0 }, { x: 40, y: 0 })
    expect(right.dx).toBeCloseTo(1)
    expect(right.dy).toBeCloseTo(0)
    const half = stickVector({ x: 0, y: 0 }, { x: 20, y: 0 })
    expect(half.dx).toBeCloseTo(0.5)
    expect(half.dy).toBeCloseTo(0)
  })
  it('caps the magnitude at one', () => {
    const up = stickVector({ x: 0, y: 0 }, { x: 0, y: -80 })
    expect(up.dx).toBeCloseTo(0)
    expect(up.dy).toBeCloseTo(-1)
  })
})

describe('isTap', () => {
  it('accepts a short, small movement', () => {
    expect(isTap(5, 100)).toBe(true)
  })
  it('rejects a long movement or a long press', () => {
    expect(isTap(12, 100)).toBe(false)
    expect(isTap(5, 300)).toBe(false)
  })
})
