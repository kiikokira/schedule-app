import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../db/database'
import PlanScreen from './PlanScreen'
import { SCHEDULE, suggestDeadline } from '../data/schedule'
import { todayStr } from '../lib/progress'
import { loadSchedule } from '../data/scheduleStore'

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  localStorage.clear()
})

describe('PlanScreen', () => {
  it('shows all schedule books with start and end dates', () => {
    render(<PlanScreen onDone={() => {}} />)
    expect(screen.getByText('学習スケジュールを登録')).toBeInTheDocument()
    for (const entry of SCHEDULE) {
      expect(screen.getByTestId(`entry-start-${entry.catalogId}`)).toHaveValue(
        entry.startDate,
      )
      expect(
        screen.getByTestId(`entry-deadline-${entry.catalogId}`),
      ).toHaveValue(entry.deadline)
    }
  })

  it('shows a suggested deadline when adding a book from the catalog', () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('catalog-select'), {
      target: { value: 'leap' },
    })
    const start = screen.getByTestId<HTMLInputElement>('add-start')
    if (start.value === '') fireEvent.change(start, {
      target: { value: todayStr() },
    })
    expect(screen.getByTestId<HTMLInputElement>('add-deadline').value).toBe(
      suggestDeadline(start.value, 90),
    )
  })

  it('adds a book from the catalog to the schedule', () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('catalog-select'), {
      target: { value: 'leap' },
    })
    fireEvent.change(screen.getByTestId('add-start'), {
      target: { value: '2026-09-01' },
    })
    fireEvent.click(screen.getByTestId('add-entry'))
    expect(
      screen.getByTestId('entry-start-leap'),
    ).toHaveValue('2026-09-01')
    expect(screen.getByTestId('entry-deadline-leap')).toHaveValue(
      suggestDeadline('2026-09-01', 90),
    )
  })

  it('saves edited dates to localStorage', () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(
      screen.getByTestId('entry-deadline-eibunpo-polaris-2'),
      { target: { value: '2026-12-15' } },
    )
    fireEvent.click(screen.getByTestId('save-schedule'))
    expect(screen.getByTestId('save-result')).toHaveTextContent('保存しました')
    const saved = loadSchedule()
    const entry = saved.find((e) => e.catalogId === 'eibunpo-polaris-2')
    expect(entry?.deadline).toBe('2026-12-15')
  })

  it('removes a book from the schedule and saves', () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('entry-delete-sfc-shoronbun'))
    fireEvent.click(screen.getByTestId('save-schedule'))
    const saved = loadSchedule()
    expect(saved.some((e) => e.catalogId === 'sfc-shoronbun')).toBe(false)
  })

  it('registers all schedule books when none exist', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('apply-schedule'))
    expect(await screen.findByTestId('apply-result')).toHaveTextContent(
      '新規 17 冊',
    )
    const books = await db.books.toArray()
    expect(books).toHaveLength(17)
    const eibunpo = books.find((b) => b.catalogId === 'eibunpo-polaris-2')
    expect(eibunpo?.deadline).toBe('2026-11-30')
    expect(eibunpo?.startDate).toBe('2026-09-01')
    expect(eibunpo?.coverUrl).toMatch(/^https:\/\//)
  })

  it('updates deadline of an existing registered book keeping start and cover', async () => {
    await db.books.add({
      id: 'b1',
      title: '英文法ポラリス2（応用レベル）',
      catalogId: 'eibunpo-polaris-2',
      subject: '英文法',
      totalPages: 280,
      coverUrl: 'https://example.com/polaris2.jpg',
      startDate: '2026-04-01',
      deadline: '2026-06-01',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('apply-schedule'))
    expect(await screen.findByTestId('apply-result')).toHaveTextContent(
      '新規 16 冊 / 期限を更新 1 冊',
    )
    const books = await db.books.toArray()
    const eibunpo = books.find((b) => b.id === 'b1')
    expect(eibunpo?.deadline).toBe('2026-11-30')
    expect(eibunpo?.startDate).toBe('2026-04-01')
    expect(eibunpo?.coverUrl).toBe('https://example.com/polaris2.jpg')
  })

  it('calls onDone when the back button is pressed', () => {
    let done = false
    render(<PlanScreen onDone={() => { done = true }} />)
    fireEvent.click(screen.getByTestId('back-button'))
    expect(done).toBe(true)
  })
})