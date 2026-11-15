import { describe, expect, it } from 'vitest'
import { removeWhiteBackground } from './removeWhiteBackground'

describe('removeWhiteBackground', () => {
  it('removes near-white background and keeps gold pixels', () => {
    const W = 3
    const H = 1
    const src = new Uint8ClampedArray([
      242, 244, 248, 255, // 背景白 → 透明化
      241, 196, 0, 255, // 金 → 不変
      241, 220, 124, 255, // 縁ブレンド → 保持（ハロー許容）
    ])
    const out = removeWhiteBackground(src, W, H)
    expect(Array.from(out.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(out.slice(4, 8))).toEqual([241, 196, 0, 255])
    expect(Array.from(out.slice(8, 12))).toEqual([241, 220, 124, 255])
    expect(Array.from(src.slice(0, 4))).toEqual([242, 244, 248, 255]) // 入力不変
  })
})
