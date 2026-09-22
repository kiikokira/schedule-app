import { render, screen, fireEvent } from '@testing-library/react'
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