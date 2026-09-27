import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import HistoryScreen from './HistoryScreen'
import { db } from '../db/database'
import { appendChatHistory } from '../data/chatHistoryStore'

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

  it('returns via the fold button', async () => {
    const onBack = vi.fn()
    render(<HistoryScreen onBack={onBack} />)
    await waitFor(() => expect(screen.getByTestId('history-back')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('history-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
