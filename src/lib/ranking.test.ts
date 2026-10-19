import { describe, it, expect } from 'vitest'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, pagesForRank, sampleNearBoard, sampleTopRivals, totalPagesToRank, totalPagesForRank, totalActivity } from './ranking'
import { ALL_UNIVERSITIES } from '../data/universities'

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
    for (const r of rivals) {
      expect(ALL_UNIVERSITIES.some((u) => r.name.startsWith(u))).toBe(true)
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
  it('累計0は最下位で貯めるほど順位が上がり下がらない', () => {
    expect(totalPagesToRank(0)).toBe(200000)
    const r10 = totalPagesToRank(10)
    const r100 = totalPagesToRank(100)
    const r1000 = totalPagesToRank(1000)
    expect(r10).toBeLessThan(200000)
    expect(r100).toBeLessThan(r10)
    expect(r1000).toBeLessThan(r100)
  })
  it('累計ページ↔順位で往復できる', () => {
    for (const pages of [10, 100, 500, 2000]) {
      expect(Math.abs(totalPagesForRank(totalPagesToRank(pages)) - pages) / Math.max(pages, 1)).toBeLessThan(0.3)
    }
  })
  it('累計は記録の合計である（昨日多・今日0でも残る）', () => {
    expect(totalActivity([{ date: '2026-10-17', pages: 50 }, { date: '2026-10-18', pages: 0 }])).toBe(50)
    expect(totalPagesToRank(totalActivity([{ date: '2026-10-17', pages: 50 }, { date: '2026-10-18', pages: 0 }]))).toBe(totalPagesToRank(50))
  })
  it('ライバル名に地方大学が含まれ順位で層が変わる', () => {
    const topNames = sampleTopRivals('2026-10-18', 10).map((r) => r.name).join()
    const bottomBoard = sampleNearBoard(5, 199990, '2026-10-18', 5).filter((r) => !r.you).map((r) => r.name).join()
    expect(topNames + bottomBoard).toMatch(/新潟|金沢|信州|岡山|広島|熊本|鹿児島|琉球|弘前|静岡/)
  })
})
