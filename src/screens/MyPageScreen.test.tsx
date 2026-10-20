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
  it('ヒーローに志望校・学部・ニックネームを表示する', async () => {
    const { saveProfile } = await import('../data/profileStore')
    saveProfile({ nickname: 'たろう', grade: '高2', university: '慶應', faculty: '環境情報学部', department: '' })
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={todayStr()} />)
    const hero = await screen.findByTestId('mypage-hero')
    expect(hero).toHaveTextContent('慶應')
    expect(hero).toHaveTextContent('環境情報学部')
    expect(hero).toHaveTextContent('たろう')
  })
  it('ヒーローの大学名は正式名称で表示する（慶應→慶應義塾大学）', async () => {
    const { saveProfile } = await import('../data/profileStore')
    saveProfile({ nickname: 'たろう', grade: '高2', university: '慶應', faculty: '環境情報学部', department: '' })
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={todayStr()} />)
    const hero = await screen.findByTestId('mypage-hero')
    expect(hero).toHaveTextContent('慶應義塾大学環境情報学部')
    const view = await screen.findByTestId('mypage-view')
    expect(view).toHaveTextContent('慶應義塾大学')
  })
  it('志望校未設定なら設定を促す', async () => {
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={todayStr()} />)
    const hero = await screen.findByTestId('mypage-hero')
    expect(hero).toHaveTextContent('未設定')
  })
  it('目標カードに順位・偏差値・次の節目までの差を表示する', async () => {
    const today = todayStr()
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: '単語帳', totalPages: 500, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 50 })
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={today} />)
    const goal = await screen.findByTestId('mypage-goal')
    expect(goal).toHaveTextContent('全国100,000位')
    expect(goal).toHaveTextContent('偏差値')
    expect(goal).toHaveTextContent('あと100ページ')
  })
  it('継続カードに連続日数と7日グラフを表示する', async () => {
    const today = todayStr()
    const now = new Date().toISOString()
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await db.books.add({ id: 'b1', title: '単語帳', totalPages: 100, startDate: yesterday, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: yesterday, pages: 10 })
    await db.records.add({ id: 'r2', bookId: 'b1', date: today, pages: 10 })
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={today} />)
    expect(await screen.findByTestId('mypage-streak')).toHaveTextContent(/連続\d+日/)
    expect(await screen.findByTestId('progress-chart')).toBeInTheDocument()
  })
  it('前回より順位が上がれば +N を強調表示する', async () => {
    localStorage.setItem('schedule-app-last-rank', '199166')
    const today = todayStr()
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: '単語帳', totalPages: 500, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 50 })
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={today} />)
    const delta = await screen.findByTestId('mypage-rank-delta')
    expect(delta).toHaveTextContent('前回比')
    expect(delta).toHaveTextContent('+')
  })
  it('初回は増減を表示しない', async () => {
    const today = todayStr()
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: '単語帳', totalPages: 500, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 50 })
    render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={today} />)
    expect(screen.queryByTestId('mypage-rank-delta')).toBeNull()
  })
})
