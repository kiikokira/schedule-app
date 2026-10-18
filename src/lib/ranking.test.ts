import { describe, it, expect } from 'vitest'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, pagesForRank, sampleNearBoard, sampleTopRivals } from './ranking'

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
  it('同日の近傍ボード抽出は決定的である', () => {
    const first = sampleNearBoard(20, 150000, '2026-10-18', 15)
    const second = sampleNearBoard(20, 150000, '2026-10-18', 15)
    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(0)
  })
  it('ライバル名は志望大学＋学年である', () => {
    const rivals = sampleNearBoard(20, 150000, '2026-10-18', 15).filter((r) => !r.you)
    const universities = ['東大', '京大', '阪大', '東北大', '名大', '九大', '北大', '早稲田', '慶應', '同志社', '立命館', '明治']
    for (const r of rivals) {
      expect(universities.some((u) => r.name.startsWith(u))).toBe(true)
    }
    expect(rivals.map((r) => r.name).join()).not.toMatch(/都|道|府|県/)
  })
  it('ページ→順位→ページで往復できる', () => {
    for (const pages of [0, 1, 5, 10, 30, 60]) {
      expect(Math.abs(pagesForRank(dailyPagesToRank(pages, '2026-10-18')) - pages)).toBeLessThanOrEqual(1)
    }
  })
  it('近傍ボードの表示順位は1ずつ連続する（同点は同順位）', () => {
    const board = sampleNearBoard(10, 150000, '2026-10-18', 15)
    const ranks = board.map((b) => b.boardRank)
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i] - ranks[i - 1] === 0 || ranks[i] - ranks[i - 1] === 1).toBe(true)
    }
    expect(ranks[0]).toBe(1)
    expect(ranks[ranks.length - 1]).toBeGreaterThan(1)
    const you = board.find((b) => b.you)
    expect(you?.rank).toBe(150000)
    expect(you?.pages).toBe(10)
  })
  it('上位ボードは1位から連番でページ降順である', () => {
    const first = sampleTopRivals('2026-10-18', 10)
    const second = sampleTopRivals('2026-10-18', 10)
    expect(first).toEqual(second)
    expect(first.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (let i = 1; i < first.length; i++) {
      expect(first[i - 1].pages).toBeGreaterThanOrEqual(first[i].pages)
    }
  })
})
