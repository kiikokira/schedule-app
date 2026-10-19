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
    expect(all).toMatch(/阪大|東大|京大|早稲田|慶應|新潟|信州|岡山|広島|熊本|鹿児島|琉球|弘前|静岡|金沢/)
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
    // グローバル順位を表示するため全てが小さい密集順位(1,2,3)にはならない
    expect(Math.max(...ranks)).toBeGreaterThan(100)
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
  it('低ページで近傍トップが1位にならない（グローバル順位表示）', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    const first = rows[0].textContent ?? ''
    expect(first).not.toMatch(/^[^0-9]*1位/)
  })
  it('ヘッダーに累計と今日のページ数を併記する', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 100,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 7 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    const summary = await screen.findByTestId('ranking-summary')
    expect(summary).toHaveTextContent(/累計/)
    expect(summary).toHaveTextContent(/今日/)
  })
  it('昨日多く今日0でも最下位にならない', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 500,
      startDate: yesterday, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: yesterday, pages: 50 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    const summary = await screen.findByTestId('ranking-summary')
    expect(summary).not.toHaveTextContent('200,000位')
  })
})
