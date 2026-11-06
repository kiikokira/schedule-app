import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildW1StopPad, w1PadY, W1_PAD_COLORS } from './rpgW1Pads'

describe('rpgW1Pads', () => {
  it('builds ring + inner + center layers', () => {
    const g = buildW1StopPad('next', 2.4)
    expect(g.children.length).toBe(3)
    for (const c of g.children) {
      expect(c instanceof THREE.Mesh).toBe(true)
    }
  })

  it('uses status colors on the ring', () => {
    expect(W1_PAD_COLORS.cleared).toBe('#2f7bff')
    expect(W1_PAD_COLORS.next).toBe('#ef2d2d')
    expect(W1_PAD_COLORS.locked).toBe('#9aa3b2')
  })

  it('has no NaN vertices and sits above terrain', () => {
    const g = buildW1StopPad('cleared', 2.0)
    g.updateMatrixWorld(true)
    const y = w1PadY(-17, 17)
    expect(Number.isFinite(y)).toBe(true)
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const pos = o.geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          expect(Number.isNaN(pos.getY(i))).toBe(false)
        }
      }
    })
  })
})
