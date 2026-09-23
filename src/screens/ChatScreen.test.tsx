import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import ChatScreen from './ChatScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot } from '../data/dayplanStore'
import { setAiSettings } from '../lib/ai'
import type { BookData } from '../lib/progress'

const TODAY = '2026-09-21' // 月曜

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.availability.clear()
  await db.adjustments.clear()
  localStorage.clear()
  vi.unstubAllGlobals()
})

const fillBook = (over: Partial<BookData> = {}) =>
  db.books.add({
    id: 'b1',
    title: '英単語1000',
    subject: '英単語',
    totalPages: 100,
    startDate: '2026-09-01',
    deadline: '2026-09-28',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  } as BookData)

const addTodaySlot = () =>
  saveAvailabilitySlot(
    { id: 'a1', weekday: null, date: TODAY, start: '21:00', end: '23:00' },
    true,
  )

describe('ChatScreen', () => {
  it('shows the analysis message and proposal card on open', async () => {
    await fillBook()
    await addTodaySlot()
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    expect(await screen.findByTestId('chat-screen')).toBeInTheDocument()
    expect(await screen.findByTestId('analysis-summary')).toHaveTextContent('英単語1000')
    expect(screen.getByTestId('proposal-card')).toBeInTheDocument()
    expect(screen.getByTestId('apply-today')).toBeInTheDocument()
    expect(screen.getByTestId('apply-pace')).toBeInTheDocument()
  })

  it('answers the behind chip', async () => {
    await fillBook()
    await addTodaySlot()
    await db.records.add({ id: 'r1', bookId: 'b1', date: TODAY, pages: 5 })
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    await screen.findByTestId('analysis-summary')
    fireEvent.click(screen.getByTestId('chip-behind'))
    expect(await screen.findByText(/ページ遅れ/)).toBeInTheDocument()
  })

  it('applies the today allocation and records adjustments without touching deadlines', async () => {
    await fillBook()
    await addTodaySlot()
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    await screen.findByTestId('proposal-card')
    fireEvent.click(screen.getByTestId('apply-today'))
    await waitFor(async () => {
      const book = await db.books.get('b1')
      expect(book?.priority).toBe(0)
      expect(book?.deadline).toBe('2026-09-28')
      const adj = await db.adjustments.toArray()
      expect(adj.some((a) => a.bookId === 'b1' && a.kind === 'priority')).toBe(true)
    })
  })

  it('applies pace targets as allottedRatio and keeps the deadline', async () => {
    await fillBook()
    await addTodaySlot()
    await db.records.add({ id: 'r1', bookId: 'b1', date: TODAY, pages: 10 })
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    await screen.findByTestId('proposal-card')
    fireEvent.click(screen.getByTestId('apply-pace'))
    await waitFor(async () => {
      const book = await db.books.get('b1')
      expect(book?.allottedRatio).toBeGreaterThan(0)
      expect(book?.allottedRatio).toBeLessThanOrEqual(1)
      expect(book?.deadline).toBe('2026-09-28')
      const adj = await db.adjustments.toArray()
      expect(adj.some((a) => a.bookId === 'b1' && a.kind === 'ratio')).toBe(true)
    })
  })

  it('disables free text with a notice when no AI is configured', async () => {
    await fillBook()
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    await screen.findByTestId('chat-screen')
    expect(screen.getByTestId('chat-input')).toBeDisabled()
    expect(screen.getByTestId('chat-offline-notice')).toHaveTextContent('オフラインAIモード')
  })

  it('enables free text and replies via the configured LLM', async () => {
    setAiSettings({ endpoint: 'https://example.test', apiKey: 'sk-test', model: 'm' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '今日は英単語1000を優先してください' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await fillBook()
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    await screen.findByTestId('chat-screen')
    expect(screen.queryByTestId('chat-offline-notice')).not.toBeInTheDocument()
    const input = screen.getByTestId('chat-input')
    expect(input).not.toBeDisabled()
    fireEvent.change(input, { target: { value: '今日は何をやるのがいい?' } })
    fireEvent.click(screen.getByTestId('chat-send'))
    expect(await screen.findByText('今日は英単語1000を優先してください')).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test')
    expect(init.headers.Authorization).toBe('Bearer sk-test')
  })

  it('falls back to an offline notice when the LLM call fails', async () => {
    setAiSettings({ endpoint: 'https://example.test', apiKey: 'sk-test', model: 'm' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await fillBook()
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    await screen.findByTestId('chat-screen')
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'こんにちは' } })
    fireEvent.click(screen.getByTestId('chat-send'))
    expect(await screen.findByText(/接続できませんでした/)).toBeInTheDocument()
  })

  it('shows a proposal card again when the replan chip is pressed', async () => {
    await fillBook()
    await addTodaySlot()
    render(<ChatScreen onBack={() => {}} today={TODAY} />)
    await screen.findByTestId('proposal-card')
    fireEvent.click(screen.getByTestId('chip-replan'))
    expect(await screen.findAllByTestId('proposal-card')).toHaveLength(2)
  })
})