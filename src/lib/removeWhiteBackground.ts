export const WHITE_MIN = 200

export function removeWhiteBackground(
  src: Uint8ClampedArray,
  W: number,
  H: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length)
  const count = W * H
  for (let i = 0; i < count; i++) {
    const o = i * 4
    const r = src[o]
    const g = src[o + 1]
    const b = src[o + 2]
    const a = src[o + 3]
    if (Math.min(r, g, b) > WHITE_MIN) {
      out[o] = 0
      out[o + 1] = 0
      out[o + 2] = 0
      out[o + 3] = 0
    } else {
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = a
    }
  }
  return out
}
