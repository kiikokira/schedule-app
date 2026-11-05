/** W1ビスタ拡張用の決定的配置ヘルパー（純粋関数・three非依存）。 */

/** シード付き疑似乱数（mulberry32）。同seed→同列。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type RingPlacement = {
  x: number
  y: number
  z: number
  scale: number
  rotY: number
}

/**
 * ドーナツ域（rMin〜rMax）への決定的な散布。プレイアブル域の内側には置かない。
 * 遠景の丘・小島などの位置決めに使う。
 */
export function ringPlacements(opts: {
  count: number
  rMin: number
  rMax: number
  seed: number
  y: number
  minScale?: number
  maxScale?: number
}): RingPlacement[] {
  const { count, rMin, rMax, seed, y, minScale = 0.7, maxScale = 1.6 } = opts
  const rng = mulberry32(seed)
  const out: RingPlacement[] = []
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const r = rMin + rng() * (rMax - rMin)
    out.push({
      x: Math.cos(a) * r,
      y,
      z: Math.sin(a) * r,
      scale: minScale + rng() * (maxScale - minScale),
      rotY: rng() * Math.PI * 2,
    })
  }
  return out
}
