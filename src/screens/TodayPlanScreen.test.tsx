import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import TodayPlanScreen from './TodayPlanScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot } from '../data/dayplanStore'
import { resetSchedule } from '../data/scheduleStore'

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  await db.availability.clear()
  resetSchedule()
})

const fillBook = (id: string, over: Record<string, unknown> = {}) => {
  const now = new Date().toISOString()
  return db.books.add({
    id,
    title: id === 'b1' ? '英文法ポラリス2（応用レベル）' : 'システム英単語',
    subject: '英語',
    totalPages: 100,
    catalogId: id === 'b1' ? 'eibunpo-polaris-2' : undefined,
    startDate: '2026-09-01',
    deadline: '2026-11-30',
    createdAt: now,
    updatedAt: now,
    ...over,
  } as any)
}

describe('TodayPlanScreen', () => {
  it('shows the today timetable with the planned book', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    // 2026-09-21 は月曜。today を注入して曜日依存をなくす
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(await screen.findByTestId('plan-row-book')).toHaveTextContent(
      '英文法ポラリス2（応用レベル）',
    )
  })

  it('shows a notice and empty table when there is no availability', async () => {
    await fillBook('b1')
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('empty-availability-notice')).toBeInTheDocument()
  })

  it('records the day pages from a plan row using upsert semantics', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const input = await screen.findByTestId('plan-input-b1')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('plan-record-b1'))
    await waitFor(async () => {
      const recs = await db.records.toArray()
      expect(recs).toHaveLength(1)
      expect(recs[0].pages).toBe(10)
    })
  })

  it('calls onSettings when the settings link is tapped', async () => {
    const onSettings = vi.fn()
    await fillBook('b1')
    render(<TodayPlanScreen onBack={() => {}} onSettings={onSettings} />)
    fireEvent.click(await screen.findByTestId('go-settings'))
    expect(onSettings).toHaveBeenCalled()
  })

  it('shows the book cover at the left of the book name in today rows', async () => {
    await fillBook('b1', { coverUrl: 'https://example.com/polaris-cover.jpg' })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(
      document.querySelector(
        '[data-testid="plan-row-0"] img[src="https://example.com/polaris-cover.jpg"]',
      ),
    ).not.toBeNull()
  })

  it('shows the book cover next to the book name in the upcoming list', async () => {
    await fillBook('b1', { coverUrl: 'https://example.com/polaris-cover.jpg' })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('upcoming-list')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        document.querySelector(
          '[data-testid="upcoming-list"] img[src="https://example.com/polaris-cover.jpg"]',
        ),
      ).not.toBeNull()
    })
  })

  it('shows the planned book title in bold on its own line', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const title = await screen.findByTestId('plan-row-book')
    expect(title).toHaveStyle({ fontWeight: '700' })
    expect(screen.getByTestId('plan-row-hours')).toHaveTextContent('21:00-23:00')
    expect(screen.getByTestId('plan-row-pages')).toHaveTextContent('予定 40ページ')
  })

  it('shows upcoming dates as month/day with weekday', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('upcoming-list')).toBeInTheDocument()
    expect(screen.getByText('9月22日（火）')).toBeInTheDocument()
    expect(screen.getByText('9月28日（月）')).toBeInTheDocument()
  })

  it('displays the full book title horizontally in today rows', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const title = await screen.findByTestId('plan-row-book')
    expect(title).toHaveTextContent('英文法ポラリス2（応用レベル）')
    expect(title).not.toHaveStyle({ whiteSpace: 'nowrap', overflow: 'hidden' })
  })

  it('keeps the book title on its own line, not beside the page input', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const title = await screen.findByTestId('plan-row-book')
    const input = await screen.findByTestId('plan-input-b1')
    expect(title.parentElement).not.toBe(input.parentElement)
    expect(title.contains(input)).toBe(false)
  })

  it('displays the full book title in the upcoming list', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('upcoming-list')).toBeInTheDocument()
    const title = await screen.findAllByTestId('upcoming-title')
    expect(title.length).toBeGreaterThan(0)
    expect(title[0]).toHaveTextContent('英文法ポラリス2（応用レベル）')
    expect(title[0]).not.toHaveStyle({ whiteSpace: 'nowrap', overflow: 'hidden' })
  })

  it('keeps page inputs independent per time slot for the same book', async () => {
    await fillBook('b1', { totalPages: 1000 })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '15:55', end: '16:50' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a2', weekday: 1, date: null, start: '17:45', end: '19:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a3', weekday: 1, date: null, start: '21:00', end: '21:45' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const inputs = await screen.findAllByTestId('plan-input-b1')
    expect(inputs).toHaveLength(3)
    fireEvent.change(inputs[0], { target: { value: '5' } })
    expect((inputs[0] as HTMLInputElement).value).toBe('5')
    expect((inputs[1] as HTMLInputElement).value).toBe('')
    expect((inputs[2] as HTMLInputElement).value).toBe('')
  })

  it('publishes today slot ends for the reminder workflow when notifications are enabled', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '21:45' },
      true,
    )
    localStorage.setItem(
      'schedule-app-ntfy',
      JSON.stringify({ enabled: true, topic: 'my-topic' }),
    )
    localStorage.removeItem('schedule-app-slots-published')
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response,
    )
    vi.stubGlobal('fetch', fetchImpl)
    try {
      render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
      await waitFor(() => {
        expect(fetchImpl).toHaveBeenCalledWith(
          'https://ntfy.sh/my-topic-slots',
          expect.objectContaining({ method: 'POST' }),
        )
      })
      const found = fetchImpl.mock.calls.find(([url]) => url === 'https://ntfy.sh/my-topic-slots')
      expect(found).toBeDefined()
      const [, init] = found!
      const body = JSON.parse((init as RequestInit).body as string)
      expect(body.date).toBe('2026-09-21')
      expect(body.slots).toEqual([
        { start: '21:00', end: '21:45', books: ['英文法ポラリス2（応用レベル）'] },
      ])
    } finally {
      vi.unstubAllGlobals()
      localStorage.removeItem('schedule-app-ntfy')
      localStorage.removeItem('schedule-app-slots-published')
    }
  })

  it('does not publish slots when notifications are disabled', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '21:45' },
      true,
    )
    localStorage.removeItem('schedule-app-ntfy')
    localStorage.removeItem('schedule-app-slots-published')
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response)
    vi.stubGlobal('fetch', fetchImpl)
    try {
      render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
      await screen.findByTestId('today-table')
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('反復本を1日あたり区画数つきで別枠表示する', async () => {
    await fillBook('cycle-1', {
      title: '反復本',
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
    })
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('cycle-today-list')).toHaveTextContent('反復本')
  })
})

