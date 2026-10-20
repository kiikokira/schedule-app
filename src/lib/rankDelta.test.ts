import { describe, it, expect } from 'vitest'
import { formatRankDelta, deltaTone } from './rankDelta'

describe('rankDelta', () => {
  it('初回（prev null）は表示なし', () => {
    expect(formatRankDelta(null, 199159)).toBeNull()
    expect(deltaTone(null, 199159)).toBe('flat')
  })
  it('順位上昇（数字が小さくなる）を +N で表す', () => {
    expect(formatRankDelta(199166, 199159)).toBe('+7')
    expect(deltaTone(199166, 199159)).toBe('up')
  })
  it('順位下降を -N で表す', () => {
    expect(formatRankDelta(199123, 199159)).toBe('-36')
    expect(deltaTone(199123, 199159)).toBe('down')
  })
  it('差分0は±0でキープ表示する', () => {
    expect(formatRankDelta(199159, 199159)).toBe('±0')
    expect(deltaTone(199159, 199159)).toBe('flat')
  })
  it('3桁区切りで表示する', () => {
    expect(formatRankDelta(200000, 198000)).toBe('+2,000')
  })
})
