import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import HomeScreen from './HomeScreen'
import { saveSchedule, resetSchedule, loadSchedule } from '../data/scheduleStore'
import { addDaysToDate, type ScheduleEntry } from '../data/schedule'

const pad = (n: number) => String(n).padStart(2, '0')
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HomeScreen', () => {
  it('shows a 学習スケジュール section with the default schedule books', () => {
    render(<HomeScreen onOpenBook={() => {}} />)
    expect(screen.getByText('学習スケジュール')).toBeInTheDocument()
    expect(screen.getByText('英文法ポラリス2（応用レベル）')).toBeInTheDocument()
    expect(screen.getByText('関正生のThe Rules英語長文問題集2 入試標準')).toBeInTheDocument()
  })

  it('shows today date as 月日（曜日）without a year', () => {
    render(<HomeScreen onOpenBook={() => {}} />)
    const d = new Date()
    const expected = `今日は ${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
    expect(screen.getByTestId('today-date')).toHaveTextContent(expected)
    expect(screen.getByTestId('today-date')).not.toHaveTextContent(String(d.getFullYear()))
  })

  it('shows the deadline of each scheduled book', () => {
    render(<HomeScreen onOpenBook={() => {}} />)
    const row = screen.getByTestId('schedule-row-eibunpo-polaris-2')
    expect(row).toHaveTextContent('2026-09-30')
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

  it('shows required pages per day on a book card using today record', async () => {
    await db.books.add({ ...book, id: 'b1', totalPages: 100, deadline: daysAhead(6) })
    await db.records.add({
      id: 'r1',
      bookId: 'b1',
      date: localDateStr(new Date()),
      pages: 40,
    })
    render(<HomeScreen onOpenBook={() => {}} />)
    const card = await screen.findByTestId('book-card-b1')
    // (100 - 40) / 今日を除く5日 = 1日12ページ
    expect(card).toHaveTextContent('期限まで1日あたり 12 ページ')
  })

  it('shows required pages per day on a book card with no today record', async () => {
    await db.books.add({ ...book, id: 'b1', totalPages: 100, deadline: daysAhead(6) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: daysAgo(1), pages: 40 })
    render(<HomeScreen onOpenBook={() => {}} />)
    const card = await screen.findByTestId('book-card-b1')
    // (100 - 40) / 今日を除く5日 = 1日12ページ
    expect(card).toHaveTextContent('期限まで1日あたり 12 ページ')
  })

  it('updates required pages per day live while typing on the card', async () => {
    await db.books.add({ ...book, id: 'b1', totalPages: 100, deadline: daysAhead(6) })
    render(<HomeScreen onOpenBook={() => {}} />)
    const input = await screen.findByTestId('card-progress-input-b1')
    fireEvent.change(input, { target: { value: '10' } })
    const card = screen.getByTestId('book-card-b1')
    // (100 - 10) / 今日を除く5日 = 1日18ページ
    expect(card).toHaveTextContent('期限まで1日あたり 18 ページ')
  })

  it('records today progress from the card input', async () => {
    await db.books.add({ ...book, id: 'b1', totalPages: 100, deadline: daysAhead(6) })
    render(<HomeScreen onOpenBook={() => {}} />)
    const input = await screen.findByTestId('card-progress-input-b1')
    fireEvent.change(input, { target: { value: '10' } })
    const recordBtn = screen.getByTestId('card-record-b1')
    fireEvent.click(recordBtn)
    const card = screen.getByTestId('book-card-b1')
    await waitFor(() => expect(card).toHaveTextContent('残り 90 ページ'))
  })

  it('does not open the book when tapping the card record button', async () => {
    const onOpen = vi.fn()
    await db.books.add({ ...book, id: 'b1', totalPages: 100, deadline: daysAhead(6) })
    render(<HomeScreen onOpenBook={onOpen} />)
    const recordBtn = await screen.findByTestId('card-record-b1')
    fireEvent.click(recordBtn)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('shows pages per day on a schedule row using the today record and a progress input', async () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: daysAhead(6) },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'eibunpo-polaris-2',
      totalPages: 100,
      startDate: '2026-09-01',
      deadline: daysAhead(6),
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: daysAgo(1), pages: 40 })
    render(<HomeScreen onOpenBook={() => {}} />)
    const row = await screen.findByTestId('schedule-row-eibunpo-polaris-2')
    // (100 - 40) / 今日を除く5日 = 1日12ページ
    await waitFor(() => expect(row).toHaveTextContent('期限まで1日あたり 12 ページ'))
    expect(screen.getByTestId('row-progress-input-eibunpo-polaris-2')).toBeInTheDocument()
  })

  it('updates required pages per day live while typing on the schedule row', async () => {
    const custom: ScheduleEntry[] = [
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAhead(6) },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'porepore',
      totalPages: 100,
      deadline: daysAhead(6),
    })
    render(<HomeScreen onOpenBook={() => {}} />)
    const input = await screen.findByTestId('row-progress-input-porepore')
    fireEvent.change(input, { target: { value: '10' } })
    const row = screen.getByTestId('schedule-row-porepore')
    // (100 - 10) / 今日を除く5日 = 1日18ページ
    expect(row).toHaveTextContent('期限まで1日あたり 18 ページ')
  })

  it('records today progress from the schedule row input after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const custom: ScheduleEntry[] = [
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAhead(6) },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'porepore',
      totalPages: 100,
      deadline: daysAhead(6),
    })
    render(<HomeScreen onOpenBook={() => {}} />)
    const input = await screen.findByTestId('row-progress-input-porepore')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('row-record-porepore'))
    await waitFor(async () => {
      const recs = await db.records.toArray()
      expect(recs).toHaveLength(1)
      expect(recs[0].pages).toBe(10)
    })
  })

  it('does not record from the schedule row when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const custom: ScheduleEntry[] = [
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAhead(6) },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'porepore',
      totalPages: 100,
      deadline: daysAhead(6),
    })
    render(<HomeScreen onOpenBook={() => {}} />)
    const input = await screen.findByTestId('row-progress-input-porepore')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('row-record-porepore'))
    const recs = await db.records.toArray()
    expect(recs).toHaveLength(0)
    expect(screen.getByTestId<HTMLInputElement>('row-progress-input-porepore').value).toBe(
      '10',
    )
  })

  it('asks for confirmation with the book title and pages on the schedule row', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const custom: ScheduleEntry[] = [
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAhead(6) },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'porepore',
      totalPages: 100,
      deadline: daysAhead(6),
    })
    render(<HomeScreen onOpenBook={() => {}} />)
    const input = await screen.findByTestId('row-progress-input-porepore')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('row-record-porepore'))
    expect(confirmSpy).toHaveBeenCalledWith(
      '「ポレポレ英文読解プロセス50」を 10 ページで記録しますか？',
    )
  })

  it('auto-registers an unregistered scheduled book when recording from its row', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const custom: ScheduleEntry[] = [
      { catalogId: 'eibunpo-polaris-2', startDate: daysAgo(5), deadline: daysAhead(6) },
    ]
    saveSchedule(custom)
    render(<HomeScreen onOpenBook={() => {}} />)
    const input = await screen.findByTestId('row-progress-input-eibunpo-polaris-2')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('row-record-eibunpo-polaris-2'))
    await waitFor(async () => {
      const registered = await db.books.toArray()
      expect(registered).toHaveLength(1)
      expect(registered[0].catalogId).toBe('eibunpo-polaris-2')
      const recs = await db.records.toArray()
      expect(recs).toHaveLength(1)
      expect(recs[0].pages).toBe(10)
    })
  })

  it('opens the registered book when tapping the schedule row', async () => {
    const onOpen = vi.fn()
    const custom: ScheduleEntry[] = [
      { catalogId: 'porepore', startDate: '2026-01-01', deadline: daysAhead(6) },
    ]
    saveSchedule(custom)
    await db.books.add({
      ...book,
      id: 'b1',
      catalogId: 'porepore',
      totalPages: 100,
      deadline: daysAhead(6),
    })
    render(<HomeScreen onOpenBook={onOpen} />)
    fireEvent.click(await screen.findByTestId('schedule-row-open-porepore'))
    expect(onOpen).toHaveBeenCalledWith('b1')
  })
})