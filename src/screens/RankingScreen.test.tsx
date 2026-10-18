import { render, screen, fireEvent, within } from '@testing-library/react'
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
  it('ライバル行に順位と志望大学を表示する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row).toHaveTextContent(/[\d,]+位/)
    }
    const all = rows.map((r) => r.textContent ?? '').join()
    expect(all).toMatch(/阪大|東大|京大|早稲田|慶應/)
    expect(all).not.toMatch(/都|道|府|県/)
  })
  it('追い越す表記を使い抜くとは書かない', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    expect(await screen.findByTestId('ranking-reach')).toHaveTextContent('追い越す')
    expect(screen.getByTestId('ranking-page')).not.toHaveTextContent('を抜く')
  })
  it('近傍ボードの表示順位は1ずつ連続する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    const ranks = rows.map((r) => Number((r.textContent?.match(/([\d,]+)位/)?.[1] ?? '').replace(/,/g, '')))
    expect(ranks.length).toBeGreaterThan(1)
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i] - ranks[i - 1] === 0 || ranks[i] - ranks[i - 1] === 1).toBe(true)
    }
  })
  it('1位からの上位ボードを表示する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const top = await screen.findByTestId('ranking-top')
    expect(within(top).getByTestId('ranking-top-0')).toHaveTextContent('1位')
    expect(top).toHaveTextContent('ページ')
  })
  it('月初めの週に模試ウィーク確定と根拠を表示する', async () => {
    render(<RankingScreen onBack={() => {}} today="2026-10-05" />)
    expect(await screen.findByTestId('ranking-mockweek')).toHaveTextContent('全国模試ウィーク')
    expect(screen.getByTestId('ranking-sources')).toHaveTextContent('文部科学省')
  })
})
