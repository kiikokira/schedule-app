import { describe, it, expect } from 'vitest'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, sampleNearRivals } from './ranking'

describe('ranking', () => {
  it('ページ数が多いほど上位になり1〜200000に収まる', () => {
    expect(RANK_POPULATION).toBe(200000)
    const a = dailyPagesToRank(30, '2026-10-18')
    const b = dailyPagesToRank(10, '2026-10-18')
    expect(a).toBeGreaterThanOrEqual(1)
    expect(a).toBeLessThanOrEqual(200000)
    expect(a).toBeLessThan(b)
  })
  it('1位の偏差値は80付近の高値になる', () => {
    expect(rankToDeviation(1)).toBeGreaterThan(75)
  })
  it('同日の近傍ライバル抽出は決定的である', () => {
    const first = sampleNearRivals(20, '2026-10-18', 30)
    const second = sampleNearRivals(20, '2026-10-18', 30)
    expect(first).toEqual(second)
    expect(first).toHaveLength(30)
  })
  it('ライバル名は志望大学＋学年である', () => {
    const rivals = sampleNearRivals(20, '2026-10-18', 30)
    const universities = ['東大', '京大', '阪大', '東北大', '名大', '九大', '北大', '早稲田', '慶應', '同志社', '立命館', '明治']
    for (const r of rivals) {
      expect(universities.some((u) => r.name.startsWith(u))).toBe(true)
    }
    expect(rivals.map((r) => r.name).join()).not.toMatch(/都|道|府|県/)
  })
})
