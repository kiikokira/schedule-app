import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import HistoryScreen from './HistoryScreen'
import { db } from '../db/database'
import { appendChatHistory } from '../data/chatHistoryStore'
import { formatDate, formatJaDate } from '../lib/progress'

beforeEach(async () => {
  await db.chatMessages.clear()
  vi.unstubAllGlobals()
})

describe('HistoryScreen', () => {
  it('lists all saved messages', async () => {
    await appendChatHistory({ role: 'user', text: '昔の相談' })
    await appendChatHistory({ role: 'assistant', text: '昔の回答' })
    render(<HistoryScreen onBack={() => {}} />)
    expect(await screen.findByText('昔の相談')).toBeInTheDocument()
    expect(await screen.findByText('昔の回答')).toBeInTheDocument()
  })

  it('shows an empty notice when there is no history', async () => {
    render(<HistoryScreen onBack={() => {}} />)
    expect(await screen.findByTestId('history-empty')).toBeInTheDocument()
  })

  it('hides notices but truncates long texts with an expander', async () => {
    await appendChatHistory({ role: 'assistant', text: 'ペース目標を反映しました', kind: 'notice' })
    const longText = `回答${'い'.repeat(200)}`
    await appendChatHistory({ role: 'assistant', text: longText })
    render(<HistoryScreen onBack={() => {}} />)
    await screen.findByText(/回答い+/)
    expect(screen.queryByText(/反映しました/)).not.toBeInTheDocument()
    expect(screen.queryByText(longText)).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('msg-expand'))
    expect(await screen.findByText(longText)).toBeInTheDocument()
  })

  it('shows the date of each conversation', async () => {
    await db.chatMessages.add({
      id: 'h1',
      at: '2026-09-28T12:00:00.000Z#0000000000',
      role: 'user',
      text: '昨日の相談',
    })
    await db.chatMessages.add({
      id: 'h2',
      at: '2026-09-29T12:00:00.000Z#0000000000',
      role: 'assistant',
      text: '今日の回答',
    })
    render(<HistoryScreen onBack={() => {}} />)
    await screen.findByText('昨日の相談')
    const day1 = formatDate(new Date('2026-09-28T12:00:00.000Z'))
    const day2 = formatDate(new Date('2026-09-29T12:00:00.000Z'))
    expect(screen.getByTestId(`history-date-${day1}`)).toHaveTextContent(formatJaDate(day1))
    expect(screen.getByTestId(`history-date-${day2}`)).toHaveTextContent(formatJaDate(day2))
  })

  it('returns via the fold button', async () => {
    const onBack = vi.fn()
    render(<HistoryScreen onBack={onBack} />)
    await waitFor(() => expect(screen.getByTestId('history-back')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('history-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
