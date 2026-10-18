import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RankingScreen from './RankingScreen'
import { db } from '../db/database'
import { todayStr } from '../lib/progress'

describe('RankingScreen', () => {
  beforeEach(async () => {
    await db.books.clear()
    await db.records.clear()
  })
  it('近傍ライバルとリーチ表示を出す', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 100,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 10 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    expect(await screen.findByTestId('ranking-page')).toHaveTextContent('仮想全国ランキング')
    expect(await screen.findByTestId('ranking-reach')).toHaveTextContent('ページで')
    expect((await screen.findAllByTestId(/^ranking-rival-/)).length).toBeGreaterThan(0)
  })
  it('戻るボタンでonBackを呼ぶ', async () => {
    const onBack = vi.fn()
    render(<RankingScreen onBack={onBack} today={todayStr()} />)
    fireEvent.click(await screen.findByTestId('ranking-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
