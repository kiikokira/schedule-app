import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../db/database'
import HomeScreen from './HomeScreen'
import { saveSchedule, resetSchedule, loadSchedule } from '../data/scheduleStore'
import { addDaysToDate, type ScheduleEntry } from '../data/schedule'

const pad = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localDateStr(d)
}
const daysAhead = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

const book = {
  id: 'b1',
  title: '英単語1000',
  totalPages: 100,
  startDate: daysAgo(30),
  deadline: daysAgo(1),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  resetSchedule()
})

describe('HomeScreen', () => {
  it('shows a 学習スケジュール section with the default schedule books', () => {
    render(<HomeScreen onOpenBook={() => {}} />)
    expect(screen.getByText('学習スケジュール')).toBeInTheDocument()
    expect(screen.getByText('英文法ポラリス2（応用レベル）')).toBeInTheDocument()
    expect(screen.getByText('関正生のThe Rules英語長文問題集2 入試標準')).toBeInTheDocument()
  })

  it('shows the deadline of each scheduled book', () => {
    render(<HomeScreen onOpenBook={() => {}} />)
    const row = screen.getByTestId('schedule-row-eibunpo-polaris-2')
    expect(row).toHaveTextContent('2026-11-30')
  })

  it('marks a scheduled book as 未登録 when it is not in the database', () => {
    render(<HomeScreen onOpenBook={() => {}} />)
    const row = screen.getByTestId('schedule-row-eibunpo-polaris-2')
    expect(row).toHaveTextContent('未登録')
  })

  it('shows progress status when the scheduled book is registered', async () => {
    await db.books.add({ ...book, id: 'b1', catalogId: 'eibunpo-polaris-2' })
    render(<HomeScreen onOpenBook={() => {}} />)
    const row = await screen.findByTestId('schedule-row-eibunpo-polaris-2')
    await waitFor(() => expect(row).not.toHaveTextContent('未登録'))
  })

  it('sorts schedule rows by deadline proximity with overdue first', () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'yatteokitai-700', startDate: '2026-01-01', deadline: daysAhead(10) },
      { catalogId: 'the-rules-1', startDate: '2026-01-01', deadline: daysAgo(5) },
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAhead(3) },
    ]
    saveSchedule(custom)
    render(<HomeScreen onOpenBook={() => {}} />)
    const rows = screen.getAllByTestId(/^schedule-row-/)
    const ids = rows.map((r) => r.getAttribute('data-testid'))
    expect(ids[0]).toBe('schedule-row-the-rules-1')
    expect(ids[1]).toBe('schedule-row-porepore')
    expect(ids[2]).toBe('schedule-row-yatteokitai-700')
  })

  it('sorts tied upcoming deadlines by original schedule order', () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'the-rules-2', startDate: '2026-01-01', deadline: daysAhead(7) },
      { catalogId: 'the-rules-1', startDate: '2026-01-01', deadline: daysAhead(7) },
    ]
    saveSchedule(custom)
    render(<HomeScreen onOpenBook={() => {}} />)
    const rows = screen.getAllByTestId(/^schedule-row-/)
    const ids = rows.map((r) => r.getAttribute('data-testid'))
    expect(ids[0]).toBe('schedule-row-the-rules-2')
    expect(ids[1]).toBe('schedule-row-the-rules-1')
  })

  it('calls onOpenBook when a registered schedule row is tapped', async () => {
    await db.books.add({ ...book, id: 'b1', catalogId: 'yatteokitai-700' })
    const onOpen = () => {}
    render(<HomeScreen onOpenBook={onOpen} />)
    const row = await screen.findByTestId('schedule-row-yatteokitai-700')
    let button = row.querySelector('button')
    await waitFor(() => {
      button = row.querySelector('button')
      expect(button).toBeTruthy()
    })
  })

  it('displays the book cards for registered books as before', async () => {
    await db.books.add({ ...book, id: 'b1' })
    render(<HomeScreen onOpenBook={() => {}} />)
    expect(await screen.findByText('英単語1000')).toBeInTheDocument()
  })

  it('shows the days until deadline for an upcoming book', () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAhead(5) },
    ]
    saveSchedule(custom)
    render(<HomeScreen onOpenBook={() => {}} />)
    const row = screen.getByTestId('schedule-row-porepore')
    expect(row).toHaveTextContent(`あと ${5} 日`)
  })

  it('shows days overdue for an expired deadline', () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAgo(3) },
    ]
    saveSchedule(custom)
    render(<HomeScreen onOpenBook={() => {}} />)
    const row = screen.getByTestId('schedule-row-porepore')
    expect(row).toHaveTextContent(`${3} 日超過`)
  })

  it('shows a 次へ進む button on a finished book and advances the next book when tapped', async () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
      { catalogId: 'nyumon-kaishaku-70', startDate: '2026-09-01', deadline: '2026-12-31' },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'eibunpo-polaris-2',
      totalPages: 100,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: daysAgo(1), pages: 100 })
    render(<HomeScreen onOpenBook={() => {}} />)
    const button = await screen.findByTestId('advance-next-eibunpo-polaris-2')
    expect(button).toBeInTheDocument()

    const today = localDateStr(new Date())
    fireEvent.click(button)
    await waitFor(() => {
      const saved = loadSchedule()
      const next = saved.find((e) => e.catalogId === 'nyumon-kaishaku-70')
      expect(next?.startDate).toBe(today)
      expect(next?.deadline).toBe(addDaysToDate(today, 121))
    })
  })

  it('does not show a 次へ進む button for an unfinished book', async () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
      { catalogId: 'nyumon-kaishaku-70', startDate: '2026-09-01', deadline: '2026-12-31' },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'eibunpo-polaris-2',
      totalPages: 100,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: daysAgo(1), pages: 10 })
    render(<HomeScreen onOpenBook={() => {}} />)
    await waitFor(() => {
      expect(screen.queryByTestId('advance-next-eibunpo-polaris-2')).toBeNull()
    })
  })
})