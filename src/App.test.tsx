import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from './db/database'
import { todayStr } from './lib/progress'
import App from './App'

it('renders app title', () => {
  render(<App />)
  expect(screen.getByText('スケジュール管理')).toBeInTheDocument()
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

it('navigates to the school page from the today plan screen and back', async () => {
  render(<App />)
  fireEvent.click(screen.getByTestId('nav-today'))
  await screen.findByTestId('today-plan-screen')
  fireEvent.click(await screen.findByTestId('school-events-toggle'))
  expect(await screen.findByTestId('school-page')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('school-back'))
  expect(await screen.findByTestId('today-plan-screen')).toBeInTheDocument()
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
