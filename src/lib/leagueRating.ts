import { hashSeed, mulberry32 } from './seasonRivals'
import type { LeagueDayResult } from './seasonLeague'

export const RATING_START = 1200
export const RATING_DIV2 = 1500
export const RATING_DIV1 = 1800
export const RATING_FLOOR = 0

export type RatingBand = 'above' | 'even' | 'below'

export function ratingBandForDiff(diff: number): RatingBand {
  if (diff >= 100) return 'above'
  if (diff <= -100) return 'below'
  return 'even'
}

function intIn(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

export function leagueRatingDelta(band: RatingBand, result: LeagueDayResult, seed: string): number {
  const rand = mulberry32(hashSeed(`league-rating-${seed}`))
  if (band === 'above') {
    if (result === 'win') return intIn(rand, 20, 30)
    if (result === 'loss') return -intIn(rand, 5, 15)
    return intIn(rand, 0, 5)
  }
  if (band === 'below') {
    if (result === 'win') return intIn(rand, 5, 10)
    if (result === 'loss') return -intIn(rand, 15, 25)
    return -intIn(rand, 0, 5)
  }
  if (result === 'win') return intIn(rand, 10, 20)
  if (result === 'loss') return -intIn(rand, 10, 20)
  return 0
}

export function rivalRatingFor(rivalId: string, div: number): number {
  const rand = mulberry32(hashSeed(`rival-rating-${div}-${rivalId}`))
  return 1000 + Math.floor(rand() * 401)
}
