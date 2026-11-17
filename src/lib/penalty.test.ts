import { describe, it, expect } from 'vitest'
import { isMissingDay, calcPenaltyPoints, calcDebtForDate, calcOutstanding, calcTotalPoints, calcQuestToday, calcStreak, rankForPoints } from './penalty'

describe('penalty', () => {
  it('1冊欠けでmissingになる', () => { expect(isMissingDay(['a','b'], new Set(['a']))).toBe(true) })
  it('普通は10点×冊数', () => { expect(calcPenaltyPoints(2, 'normal')).toBe(20) })
  it('借金は未記録本の予定合計、上限500', () => {
    const r = calcDebtForDate([{bookId:'a',pages:20},{bookId:'b',pages:30}], [], new Set(['a']))
    expect(r.pageDebt).toBe(30)
  })
  it('超過で借金が減るFIFO', () => {
    expect(calcOutstanding([{date:'2026-11-10',pageDebt:30}], [{date:'2026-11-11',excessPages:10}])).toBe(20)
  })
  it('良い日で-5回復、下限0', () => {
    expect(calcTotalPoints([{date:'2026-11-10',points:10}], 3)).toBe(0)
  })
  it('クエストは今日予定+残高', () => { expect(calcQuestToday(30, 20)).toBe(50) })
  it('計画なし日はstreakを切らない', () => {
    expect(calcStreak([{date:'2026-11-10',isMiss:false,hasPlan:true},{date:'2026-11-11',isMiss:false,hasPlan:false},{date:'2026-11-12',isMiss:false,hasPlan:true}])).toBe(3)
  })
  it('ランクはS0起点', () => { expect(rankForPoints(0)).toBe('S') })

  // Review Focus extras
  it('計画なし日（対象ゼロ）はサボり扱いしない', () => {
    expect(isMissingDay([], new Set())).toBe(false)
  })
  it('全記録ならmissingにならない', () => {
    expect(isMissingDay(['a','b'], new Set(['a','b']))).toBe(false)
  })
  it('直近7日超は呼び出し側で切り捨てて渡す', () => {
    const eight = [
      {date:'2026-11-03',pageDebt:10},
      {date:'2026-11-04',pageDebt:10},
      {date:'2026-11-05',pageDebt:10},
      {date:'2026-11-06',pageDebt:10},
      {date:'2026-11-07',pageDebt:10},
      {date:'2026-11-08',pageDebt:10},
      {date:'2026-11-09',pageDebt:10},
      {date:'2026-11-10',pageDebt:10},
    ]
    expect(calcOutstanding(eight.slice(-7), [])).toBe(70)
  })
  it('pageDebtは上限500で頭打ち', () => {
    const r = calcDebtForDate([{bookId:'a',pages:300},{bookId:'b',pages:400}], [], new Set())
    expect(r.pageDebt).toBe(500)
  })
  it('反復の借金は冊ごとに区画を保持する', () => {
    const r = calcDebtForDate([], [{bookId:'a',units:5},{bookId:'b',units:3}], new Set(['a']))
    expect(r.unitDebt).toEqual({b:3})
  })
  it('severityは純粋値（過去分の遡及変更は起きない）', () => {
    expect(calcPenaltyPoints(1, 'mild')).toBe(5)
    expect(calcPenaltyPoints(1, 'normal')).toBe(10)
    expect(calcPenaltyPoints(1, 'strict')).toBe(20)
  })
  it('罰点は1日上限100で頭打ち', () => {
    expect(calcPenaltyPoints(10, 'strict')).toBe(100)
  })
  it('超過が上回れば残高は0止まり', () => {
    expect(calcOutstanding([{date:'2026-11-10',pageDebt:10}], [{date:'2026-11-11',excessPages:50}])).toBe(0)
  })
  it('直近のサボりでstreakは0になる', () => {
    expect(calcStreak([
      {date:'2026-11-10',isMiss:false,hasPlan:true},
      {date:'2026-11-11',isMiss:false,hasPlan:false},
      {date:'2026-11-12',isMiss:true,hasPlan:true},
    ])).toBe(0)
  })
  it('ランク境界: A1-29 B30-49 C50-99 D100+', () => {
    expect(rankForPoints(1)).toBe('A')
    expect(rankForPoints(29)).toBe('A')
    expect(rankForPoints(30)).toBe('B')
    expect(rankForPoints(49)).toBe('B')
    expect(rankForPoints(50)).toBe('C')
    expect(rankForPoints(99)).toBe('C')
    expect(rankForPoints(100)).toBe('D')
  })
})
