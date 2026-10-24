import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from './db/database'
import { todayStr } from './lib/progress'
import App from './App'

it('renders app title', () => {
  render(<App />)
  expect(screen.getByText('スケジュール管理')).toBeInTheDocument()
})

it('does not show a mypage button in the footer nav', () => {
  render(<App />)
  expect(screen.queryByTestId('nav-mypage')).toBeNull()
})

it('navigates to the today plan screen from home', async () => {
  render(<App />)
  // 空き時間が無いので empty 表示でも遷移自体を確認
  fireEvent.click(screen.getByTestId('nav-today'))
  expect(await screen.findByTestId('today-plan-screen')).toBeInTheDocument()
})

it('prunes past overrides before rendering the availability screens', async () => {
  await db.availability.add({
    id: 'today-a',
    weekday: null,
    date: todayStr(),
    start: '21:00',
    end: '23:00',
  })
  await db.availability.add({
    id: 'past-b',
    weekday: null,
    date: '2020-01-01',
    start: '21:00',
    end: '23:00',
  })
  render(<App />)
  await waitFor(async () => {
    const ids = (await db.availability.toArray()).map((s) => s.id).sort()
    expect(ids).toEqual(['today-a'])
  })
})

it('navigates to the adjustment AI screen from home', async () => {
  render(<App />)
  fireEvent.click(screen.getByTestId('nav-ai'))
  expect(await screen.findByTestId('chat-screen')).toBeInTheDocument()
})

it('navigates between the AI chat and history screens', async () => {
  render(<App />)
  fireEvent.click(screen.getByTestId('nav-ai'))
  await screen.findByTestId('chat-screen')
  fireEvent.click(await screen.findByTestId('history-toggle'))
  expect(await screen.findByTestId('history-screen')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('history-back'))
  expect(await screen.findByTestId('chat-screen')).toBeInTheDocument()
})

it('does not show school schedule in the today plan screen', async () => {
  render(<App />)
  fireEvent.click(screen.getByTestId('nav-today'))
  await screen.findByTestId('today-plan-screen')
  expect(screen.queryByTestId('school-events-section')).not.toBeInTheDocument()
  expect(screen.queryByTestId('school-events-toggle')).not.toBeInTheDocument()
})

it('does not show japan nav on home', async () => {
  render(<App />)
  expect(screen.queryByTestId('nav-japan')).toBeNull()
})

it('navigates to the japan match screen from plan via japan toggle', async () => {
  render(<App />)
  fireEvent.click(screen.getByTestId('nav-plan'))
  fireEvent.click(await screen.findByTestId('japan-toggle'))
  expect(await screen.findByTestId('japan-page')).toBeInTheDocument()
})

it('navigates to the school page from plan via school toggle', async () => {
  render(<App />)
  fireEvent.click(screen.getByTestId('nav-plan'))
  fireEvent.click(await screen.findByTestId('school-toggle'))
  expect(await screen.findByTestId('school-page')).toBeInTheDocument()
})

it('navigates to the ranking screen from home via ranking open', async () => {
  render(<App />)
  fireEvent.click(await screen.findByTestId('ranking-open'))
  expect(await screen.findByTestId('ranking-page')).toBeInTheDocument()
})

it('shows no update dot', () => {
  localStorage.setItem('schedule-app-last-seen-build', 'old-build')
  render(<App />)
  expect(screen.queryByTestId('update-dot')).not.toBeInTheDocument()
})

it('navigates mypage -> breakdown -> back', async () => {
  render(<App />)
  fireEvent.click(await screen.findByTestId('mypage-open'))
  fireEvent.click(await screen.findByTestId('mypage-breakdown-open'))
  expect(await screen.findByTestId('breakdown-page')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('breakdown-back'))
  expect(await screen.findByTestId('mypage-page')).toBeInTheDocument()
})

it('navigates breakdown row -> book detail', async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  const today = todayStr()
  const now = new Date().toISOString()
  await db.books.add({ id: 'b1', title: 'LEAP', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
  await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
  render(<App />)
  fireEvent.click(await screen.findByTestId('mypage-open'))
  fireEvent.click(await screen.findByTestId('mypage-breakdown-open'))
  fireEvent.click(await screen.findByTestId('breakdown-row-b1'))
  expect(await screen.findByTestId('book-title')).toHaveTextContent('LEAP')
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
})
