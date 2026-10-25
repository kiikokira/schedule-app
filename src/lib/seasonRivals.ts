export type Rival = { id: string; name: string; div: number; basePages: number }
export const DIV_BASE_PAGES: Record<number, number> = { 10: 20, 9: 30, 8: 40, 7: 50, 6: 60, 5: 75, 4: 90, 3: 110, 2: 130, 1: 150 }
const NAMES = ['かなた', 'みれい', 'そうた', 'ゆず', 'はる', 'あおい', 'れん']
export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function generateRivals(seasonId: string, div: number): Rival[] {
  const base = DIV_BASE_PAGES[div] ?? 20
  return NAMES.map((name, i) => {
    const rand = mulberry32(hashSeed(`rival-${seasonId}-${div}-${i}`))
    const jitter = Math.floor(rand() * (div <= 3 ? 12 : 24)) - (div <= 3 ? 6 : 12)
    return { id: `r${div}-${i}`, name, div, basePages: Math.max(5, base + jitter) }
  })
}
export function rivalPagesForDay(rival: Rival, dayIndex: number): number {
  const rand = mulberry32(hashSeed(`day-${rival.id}-${dayIndex}`))
  const swing = Math.floor(rand() * 21) - 10
  return Math.max(0, rival.basePages + swing)
}
