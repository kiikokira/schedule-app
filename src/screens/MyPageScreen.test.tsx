import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import MyPageScreen from './MyPageScreen'
import { db } from '../db/database'
import { todayStr } from '../lib/progress'

describe('MyPageScreen', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.books.clear()
    await db.records.clear()
  })
  it('初期はロック表示で編集ボタンがある', async () => {
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={todayStr()} />)
    expect(await screen.findByTestId('mypage-page')).toBeInTheDocument()
    expect(await screen.findByTestId('mypage-edit')).toBeInTheDocument()
    // ロック中は保存ボタンなし
    expect(screen.queryByTestId('mypage-save')).toBeNull()
  })
  it('編集→志望校・学部を選んで保存するとロック表示に戻る', async () => {
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={todayStr()} />)
    fireEvent.click(await screen.findByTestId('mypage-edit'))
    expect(await screen.findByTestId('mypage-save')).toBeInTheDocument()
    const univ = screen.getByTestId('mypage-univ') as HTMLSelectElement
    fireEvent.change(univ, { target: { value: '慶應' } })
    const faculty = await screen.findByTestId('mypage-faculty')
    fireEvent.change(faculty, { target: { value: '環境情報学部' } })
    fireEvent.click(screen.getByTestId('mypage-save'))
    expect(await screen.findByTestId('mypage-edit')).toBeInTheDocument()
    expect(await screen.findByTestId('mypage-page')).toHaveTextContent('慶應')
    expect(await screen.findByTestId('mypage-page')).toHaveTextContent('環境情報学部')
  })
  it('実績（累計・今日・順位）を表示する', async () => {
    const today = todayStr()
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: '単語帳', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 12 })
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={today} />)
    expect(await screen.findByTestId('mypage-total')).toHaveTextContent('12')
    expect(await screen.findByTestId('mypage-today')).toHaveTextContent('12')
  })
})
