import { generateRivals, hashSeed, mulberry32, type Rival } from './seasonRivals'
import type { LeagueDayResult } from './seasonLeague'

export const WORDS_PER_PAGE = 15
export const SLOT_DAY_BASE_MIN = 120
export type SlotUnit = 'pages' | 'words' | 'sections'

export function makeSlotKey(date: string, startMin: number, endMin: number): string {
  return `${date}#${startMin}-${endMin}`
}

export function parseSlotKey(key: string): { date: string; startMin: number; endMin: number } | null {
  const m = /^(\d{4}-\d{2}-\d{2})#(\d+)-(\d+)$/.exec(key)
  if (!m) return null
  const startMin = Number(m[2]); const endMin = Number(m[3])
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin) || endMin <= startMin) return null
  return { date: m[1], startMin, endMin }
}

export function rivalForSlot(seasonId: string, div: number, slotKey: string): Rival {
  const rivals = generateRivals(seasonId, div)
  if (rivals.length === 0) return { id: 'r0', name: '—', div, basePages: 20 }
  const h = hashSeed(`slot-opp-${seasonId}-${div}-${slotKey}`)
  return rivals[h % rivals.length]
}

export function rivalSlotAmount(rival: Rival, slotKey: string, unitKind: SlotUnit, slotMinutes: number): number {
  const mins = Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30
  const base = unitKind === 'words' ? rival.basePages * WORDS_PER_PAGE : Math.max(5, rival.basePages)
  const raw = Math.round((base * mins) / SLOT_DAY_BASE_MIN)
  const rand = mulberry32(hashSeed(`slot-amt-${rival.id}-${slotKey}-${unitKind}`))
  const swing = Math.floor(rand() * 21) - 10
  return Math.max(1, raw + swing)
}

export function leagueSlotInfo(seasonId: string, div: number, slotKey: string, myAmount: number, unitKind: SlotUnit, slotMinutes: number): { opponent: string; opponentAmount: number; result: LeagueDayResult } {
  try {
    const rival = rivalForSlot(seasonId, div, slotKey)
    const opp = rivalSlotAmount(rival, slotKey, unitKind, slotMinutes)
    const my = Number.isFinite(myAmount) && myAmount > 0 ? Math.floor(myAmount) : 0
    const result: LeagueDayResult = my > opp ? 'win' : my < opp ? 'loss' : 'draw'
    return { opponent: rival.name, opponentAmount: opp, result }
  } catch {
    return { opponent: '—', opponentAmount: 0, result: 'draw' }
  }
}
