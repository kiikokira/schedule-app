import { describe, it, expect } from 'vitest'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, pagesForRank, sampleNearBoard, sampleTopRivals, totalPagesToRank, totalPagesForRank, totalActivity, nextRankMilestone, RIVAL_GRADES, populationDailyGain } from './ranking'
import { ALL_UNIVERSITIES, TOP_UNIVERSITIES, LOCAL_UNIVERSITIES } from '../data/universities'

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
      expect(ALL_UNIVERSITIES).toContain(r.name)
      expect(RIVAL_GRADES).toContain(r.grade)
      expect(r.faculty.length).toBeGreaterThan(0)
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
  it('上位ボードのメンバーは日が変わっても入れ替わらない', () => {
    const d1 = sampleTopRivals('2026-10-18', 10)
    const d2 = sampleTopRivals('2026-10-19', 10)
    expect(d2.map((r) => r.name)).toEqual(d1.map((r) => r.name))
  })
  it('上位ボードのページは日ごとに微増し減らない', () => {
    const d1 = sampleTopRivals('2026-10-18', 10)
    const d2 = sampleTopRivals('2026-10-19', 10)
    for (let i = 0; i < d1.length; i++) {
      expect(d2[i].pages).toBeGreaterThanOrEqual(d1[i].pages)
    }
  })
  it('608ページ前後で偏差値54.5前後になる（実測・2年7月英語54.5相当の学習量）', () => {
    const dev = rankToDeviation(totalPagesToRank(608))
    expect(dev).toBeGreaterThan(53)
    expect(dev).toBeLessThan(56)
  })
  it('序盤は上がりにくい（100ページで偏差値40未満・300ページで50未満）', () => {
    expect(rankToDeviation(totalPagesToRank(100))).toBeLessThan(40)
    expect(rankToDeviation(totalPagesToRank(300))).toBeLessThan(50)
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
  it('ライバル名は順位の層に対応する（上位は難関校・下位は地方大）', () => {
    const topNames = sampleTopRivals('2026-10-18', 10).map((r) => r.name)
    for (const n of topNames) {
      expect(TOP_UNIVERSITIES.some((u) => n.startsWith(u))).toBe(true)
    }
    const bottom = sampleNearBoard(5, 199990, '2026-10-18', 5).filter((r) => !r.you).map((r) => r.name)
    expect(bottom.length).toBeGreaterThan(0)
    for (const n of bottom) {
      expect(LOCAL_UNIVERSITIES.some((u) => n.startsWith(u))).toBe(true)
    }
  })
  it('次の節目順位を返す（1位ならnull）', () => {
    expect(nextRankMilestone(199159)).toBe(100000)
    expect(nextRankMilestone(90000)).toBe(50000)
    expect(nextRankMilestone(500)).toBe(100)
    expect(nextRankMilestone(1)).toBeNull()
  })
  it('近傍ボードは順位の昇順に並び1ずつ変化する（上が良い順位）', () => {
    const board = sampleNearBoard(10, 150000, '2026-10-18', 15)
    const ranks = board.map((b) => b.rank)
    expect(ranks[0]).toBeLessThan(ranks[ranks.length - 1])
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i] - ranks[i - 1]).toBe(1)
    }
  })
  it('ライバルのページにジッターはなく順位の関数に一致する', () => {
    const board = sampleNearBoard(10, 150000, '2026-10-18', 15).filter((b) => !b.you)
    for (const b of board) {
      expect(b.pages).toBe(totalPagesForRank(b.rank))
    }
  })
  it('記録なしで日が進むと順位が下がる（起点日は不変）', () => {
    expect(totalPagesToRank(777, '2026-10-27')).toBe(51553)
    expect(totalPagesToRank(777, '2026-10-28')).toBeGreaterThan(51553)
    expect(totalPagesToRank(777, '2026-11-03')).toBeGreaterThan(totalPagesToRank(777, '2026-10-28'))
    expect(totalPagesToRank(777, '2026-09-01')).toBe(51553)
  })
  it('人口の1日の伸びは日替わりで変動し固定でない', () => {
    const gains = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.parse('2026-10-27T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)
      return populationDailyGain(d)
    })
    for (const g of gains) {
      expect(g).toBeGreaterThanOrEqual(6)
      expect(g).toBeLessThanOrEqual(10)
    }
    expect(new Set(gains).size).toBeGreaterThan(1)
    expect(totalPagesToRank(777, '2026-10-27')).toBe(totalPagesToRank(777, '2026-10-27'))
  })
  it('日付付きでも累計ページ↔順位で往復できる', () => {
    for (const pages of [500, 2000]) {
      const rank = totalPagesToRank(pages, '2026-11-03')
      expect(Math.abs(totalPagesForRank(rank, '2026-11-03') - pages) / pages).toBeLessThan(0.3)
    }
  })
})
