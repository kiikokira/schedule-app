import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import TodayPlanScreen from './TodayPlanScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot, listAvailability } from '../data/dayplanStore'
import { saveFocusPeriods } from '../data/focusPeriods'
import { resetSchedule } from '../data/scheduleStore'

beforeEach(async () => {
  localStorage.clear()
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  await db.availability.clear()
  resetSchedule()
  saveFocusPeriods([])
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

  it('lists cycles books in the reselect dropdown without changing their mode', async () => {
    await fillBook('b1')
    await fillBook('cycle-1', {
      title: '反復本',
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const select = (await screen.findByTestId('plan-book-select-0')) as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.text)
    expect(options.some((t) => t.includes('反復本'))).toBe(true)
    fireEvent.change(select, { target: { value: 'cycle-1' } })
    expect(await screen.findByTestId('plan-row-units')).toHaveTextContent('区画')
    const book = await db.books.get('cycle-1')
    expect(book?.studyMode).toBe('cycles')
  })

  it('records cycle units from a cycles slot chosen in the dropdown', async () => {
    await fillBook('b1')
    await fillBook('cycle-1', {
      title: '反復本',
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const select = (await screen.findByTestId('plan-book-select-0')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'cycle-1' } })
    fireEvent.change(await screen.findByTestId('plan-cycle-from-cycle-1'), {
      target: { value: '1' },
    })
    fireEvent.change(await screen.findByTestId('plan-cycle-to-cycle-1'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByTestId('plan-cycle-record-cycle-1'))
    await waitFor(async () => {
      const recs = await db.cycleRecords.toArray()
      expect(recs).toHaveLength(1)
      expect(recs[0].unitFrom).toBe(1)
      expect(recs[0].unitTo).toBe(5)
    })
  })

  it('keeps a saved cycles pin as a 反復枠 on reload', async () => {
    await fillBook('b1')
    await fillBook('cycle-1', {
      title: '反復本',
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'cycle-1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(await screen.findByTestId('plan-row-units')).toHaveTextContent('区画')
    expect(screen.getByTestId('plan-row-book')).toHaveTextContent('反復本')
  })

  it('LEAPは語単位で表示する', async () => {
    await fillBook('leap-1', {
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'leap-1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(await screen.findByTestId('plan-row-units')).toHaveTextContent('語')
    expect(screen.getByTestId('plan-cycle-from-leap-1')).toHaveAttribute('placeholder', '開始語')
    expect(screen.getByTestId('plan-cycle-to-leap-1')).toHaveAttribute('placeholder', '終了語')
  })

  it('割当が付かない設定時間も未割当枠として表示し本を選べる', async () => {
    await fillBook('b1', { trainFit: 'home' })
    await fillBook('leap-1', {
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 2, date: null, start: '16:45', end: '17:15' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'w2', weekday: 2, date: null, start: '17:45', end: '19:00', onTrain: true },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    await screen.findByTestId('today-table')
    const rows = screen.getAllByTestId(/plan-row-\d+/)
    const target = rows.find((r) => r.textContent?.includes('未割当'))
    expect(target?.textContent).toContain('17:45-19:00')
    const { within } = await import('@testing-library/react')
    fireEvent.change(within(target as HTMLElement).getByRole('combobox'), {
      target: { value: 'leap-1' },
    })
    await waitFor(() => expect(screen.queryByText(/未割当/)).not.toBeInTheDocument())
    expect(screen.getByTestId('today-table')).toHaveTextContent('反復')
  })

  it('上書き時は上書き前の曜日設定の時間は並ばない', async () => {
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 2, date: null, start: '17:45', end: '19:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-29', start: '07:00', end: '07:30' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    await screen.findByTestId('today-table')
    const rows = screen.getAllByTestId(/plan-row-\d+/)
    expect(rows.some((r) => r.textContent?.includes('17:45-19:00'))).toBe(false)
  })

  it('上書きで欠けても黄色い通知は出さない', async () => {
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 2, date: null, start: '06:30', end: '07:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'w2', weekday: 2, date: null, start: '17:45', end: '19:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-29', start: '07:00', end: '07:30' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    await screen.findByTestId('today-table')
    expect(screen.queryByTestId('override-shadow-notice')).not.toBeInTheDocument()
    expect(screen.queryByTestId('override-shadow-merge')).not.toBeInTheDocument()
  })

  it('上書きが曜日設定をすべて含む場合は通知しない', async () => {
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 2, date: null, start: '17:45', end: '19:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-29', start: '17:45', end: '19:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    await screen.findByTestId('today-plan-screen')
    expect(screen.queryByTestId('override-shadow-notice')).not.toBeInTheDocument()
  })

  it('今日だけ上書きは初期は折りたたまれ開閉できる', async () => {
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    await screen.findByTestId('today-override-section')
    expect(screen.queryByTestId('today-override-add')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('today-override-toggle'))
    expect(await screen.findByTestId('today-override-add')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('today-override-toggle'))
    expect(screen.queryByTestId('today-override-add')).not.toBeInTheDocument()
  })

  it('テスト期間中は選択本だけを今日の計画に表示する', async () => {
    await fillBook('b1')
    await fillBook('leap-1', {
      title: 'LEAP',
      catalogId: 'leap',
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    saveFocusPeriods([
      { id: 'f1', title: '中間テスト', startDate: '2026-10-01', endDate: '2026-10-14', bookIds: ['leap-1'] },
    ])
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-05" />)
    expect(await screen.findByTestId('focus-period-notice')).toHaveTextContent('中間テスト')
    // 割当済みの行タイトルには出ない（未割当行の選択肢には出る）
    const titles = screen.queryAllByTestId('plan-row-book')
    expect(titles.some((t) => t.textContent?.includes('英文法ポラリス2（応用レベル）'))).toBe(false)
  })

  it('未割当行の本選択は未選択状態を明示する', async () => {
    await fillBook('leap-1', {
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 2, date: null, start: '20:30', end: '21:45' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    await screen.findByTestId('today-table')
    const rows = screen.getAllByTestId(/plan-row-\d+/)
    const target = rows.find((r) => r.textContent?.includes('未割当'))
    expect(target?.textContent).toContain('20:30-21:45')
    const { within } = await import('@testing-library/react')
    const select = within(target as HTMLElement).getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(select.options[select.selectedIndex]?.value).toBe('')
  })

  it('テスト期間中の未割当枠では対象外の本も選べる', async () => {
    await fillBook('b1', { trainFit: 'home', coverUrl: 'https://example.com/polaris-cover.jpg' })
    await fillBook('leap-1', {
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
    })
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 1, date: null, start: '20:30', end: '21:45' },
      true,
    )
    saveFocusPeriods([
      { id: 'f1', title: '中間テスト', startDate: '2026-10-01', endDate: '2026-10-14', bookIds: ['leap-1'] },
    ])
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-05" />)
    await screen.findByTestId('today-table')
    const rows = screen.getAllByTestId(/plan-row-\d+/)
    const target = rows.find((r) => r.textContent?.includes('未割当'))
    expect(target?.textContent).toContain('20:30-21:45')
    const { within } = await import('@testing-library/react')
    const select = within(target as HTMLElement).getByRole('combobox') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toContain('b1')
    fireEvent.change(select, { target: { value: 'b1' } })
    await waitFor(() => expect(screen.queryByText(/未割当/)).not.toBeInTheDocument())
    const updated = screen.getAllByTestId(/plan-row-\d+/).find((r) => r.textContent?.includes('20:30-21:45'))
    expect(updated?.textContent).toContain('英文法ポラリス2（応用レベル）')
    expect(updated?.querySelector('img[src="https://example.com/polaris-cover.jpg"]')).not.toBeNull()
  })

  it('テスト期間中の未割当枠で本を選ぶと表紙とタイトルが付く', async () => {
    await fillBook('leap-1', {
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      coverUrl: 'https://example.com/leap-cover.jpg',
    })
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 1, date: null, start: '20:30', end: '21:45' },
      true,
    )
    saveFocusPeriods([
      { id: 'f1', title: '中間テスト', startDate: '2026-10-01', endDate: '2026-10-14', bookIds: ['leap-1'] },
    ])
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-05" />)
    await screen.findByTestId('today-table')
    const rows = screen.getAllByTestId(/plan-row-\d+/)
    const target = rows.find((r) => r.textContent?.includes('未割当'))
    expect(target?.textContent).toContain('20:30-21:45')
    const { within } = await import('@testing-library/react')
    fireEvent.change(within(target as HTMLElement).getByRole('combobox'), {
      target: { value: 'leap-1' },
    })
    await waitFor(() => expect(screen.queryByText(/未割当/)).not.toBeInTheDocument())
    const rowsAfter = screen.getAllByTestId(/plan-row-\d+/)
    const updated = rowsAfter.find((r) => r.textContent?.includes('20:30-21:45'))
    expect(updated?.textContent).toContain('改訂版 必携 英単語 LEAP')
    expect(updated?.querySelector('img[src="https://example.com/leap-cover.jpg"]')).not.toBeNull()
  })

  it('プリセットは選択・適用だけでき保存UIは出さない', async () => {
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    expect(screen.getByTestId('today-override-preset-select')).toBeInTheDocument()
    expect(screen.getByTestId('today-override-preset-apply')).toBeInTheDocument()
    expect(screen.queryByTestId('today-override-preset-name')).not.toBeInTheDocument()
    expect(screen.queryByTestId('today-override-preset-save')).not.toBeInTheDocument()
    expect(screen.queryByTestId('today-override-preset-delete')).not.toBeInTheDocument()
  })

  it('プリセット適用で上書きフォームに入る', async () => {
    const { saveOverridePresets } = await import('../data/overridePresets')
    saveOverridePresets([
      { id: 'p1', name: '夜勉', rows: [{ start: '09:00', end: '10:00', bookId: 'b1' }] },
    ])
    await fillBook('b1')
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.change(screen.getByTestId('today-override-preset-select'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByTestId('today-override-preset-apply'))
    expect(screen.getByTestId('today-override-start-0')).toHaveValue('09:00')
    expect(screen.getByTestId('today-override-end-0')).toHaveValue('10:00')
  })

  it('プリセット適用後のその場編集は原本に影響しない', async () => {
    const { saveOverridePresets, loadOverridePresets } = await import('../data/overridePresets')
    saveOverridePresets([
      { id: 'p1', name: '夜勉', rows: [{ start: '09:00', end: '10:00' }] },
    ])
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.change(screen.getByTestId('today-override-preset-select'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByTestId('today-override-preset-apply'))
    fireEvent.change(screen.getByTestId('today-override-start-0'), { target: { value: '11:00' } })
    expect(screen.getByTestId('today-override-start-0')).toHaveValue('11:00')
    expect(loadOverridePresets()[0].rows[0].start).toBe('09:00')
  })

  it('プリセットを選び直すと上書きフォームが上書きされる', async () => {
    const { saveOverridePresets } = await import('../data/overridePresets')
    saveOverridePresets([
      { id: 'p1', name: '午前', rows: [{ start: '09:00', end: '10:00' }] },
      { id: 'p2', name: '午後', rows: [{ start: '14:00', end: '15:00' }] },
    ])
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.change(screen.getByTestId('today-override-preset-select'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByTestId('today-override-preset-apply'))
    expect(screen.getByTestId('today-override-start-0')).toHaveValue('09:00')
    fireEvent.change(screen.getByTestId('today-override-preset-select'), { target: { value: 'p2' } })
    expect(screen.getByTestId('today-override-start-0')).toHaveValue('14:00')
  })

  it('選び直し後のその場編集は原本に影響しない', async () => {
    const { saveOverridePresets, loadOverridePresets } = await import('../data/overridePresets')
    saveOverridePresets([
      { id: 'p1', name: '午前', rows: [{ start: '09:00', end: '10:00' }] },
      { id: 'p2', name: '午後', rows: [{ start: '14:00', end: '15:00' }] },
    ])
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.change(screen.getByTestId('today-override-preset-select'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByTestId('today-override-preset-apply'))
    fireEvent.change(screen.getByTestId('today-override-preset-select'), { target: { value: 'p2' } })
    expect(screen.getByTestId('today-override-start-0')).toHaveValue('14:00')
    fireEvent.change(screen.getByTestId('today-override-start-0'), { target: { value: '16:00' } })
    expect(screen.getByTestId('today-override-start-0')).toHaveValue('16:00')
    expect(loadOverridePresets().find((p) => p.id === 'p2')?.rows[0].start).toBe('14:00')
  })

  it('今日の計画に学校の日程セクションを表示しない', async () => {
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-05" />)
    await screen.findByTestId('today-back')
    expect(screen.queryByTestId('school-events-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('school-events-toggle')).not.toBeInTheDocument()
    expect(screen.queryByText('学校の日程')).not.toBeInTheDocument()
  })

  it('期限に間に合わない本があると警告を出して見直しに進める', async () => {
    await fillBook('b1', { totalPages: 500, deadline: '2026-09-22' })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '22:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a2', weekday: 2, date: null, start: '21:00', end: '22:00' },
      true,
    )
    const onRebalance = vi.fn()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" onRebalance={onRebalance} />)
    const section = await screen.findByTestId('deadline-risk-section')
    expect(section).toHaveTextContent('英文法ポラリス2（応用レベル）')
    fireEvent.click(screen.getByTestId('deadline-risk-rebalance-b1'))
    expect(onRebalance).toHaveBeenCalledWith('b1')
  })

  it('explains how to clear the deadline warning', async () => {
    await fillBook('b1', { totalPages: 500, deadline: '2026-09-22' })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '22:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('deadline-risk-hint')).toHaveTextContent(
      '記録を進める・期限を延ばす・空き時間を増やすと解消します',
    )
  })

  it('期限に余裕があれば警告を出さない', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    await screen.findByTestId('today-table')
    expect(screen.queryByTestId('deadline-risk-section')).not.toBeInTheDocument()
  })

  it('空き時間がなければ期限警告を出さない', async () => {
    await fillBook('b1', { totalPages: 500, deadline: '2026-09-22' })
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    await screen.findByTestId('empty-availability-notice')
    expect(screen.queryByTestId('deadline-risk-section')).not.toBeInTheDocument()
  })

  it('今日だけ上書きは重なる時間帯を保存しない', async () => {
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-05" />)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.click(screen.getByTestId('today-override-add'))
    fireEvent.click(screen.getByTestId('today-override-add'))
    fireEvent.change(screen.getByTestId('today-override-start-0'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByTestId('today-override-end-0'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByTestId('today-override-start-1'), { target: { value: '09:30' } })
    fireEvent.change(screen.getByTestId('today-override-end-1'), { target: { value: '10:30' } })
    fireEvent.click(screen.getByTestId('today-override-save'))
    expect(await screen.findByTestId('today-override-message')).toHaveTextContent(
      '時間帯が重複しないようにしてください',
    )
    expect(await listAvailability()).toHaveLength(0)
  })

  it('highlights only the row containing the current time', async () => {
    const toHHMM = (min: number) =>
      `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const aStart = Math.max(0, nowMin - 30)
    const aEnd = Math.min(1440, nowMin + 30)
    const bStart = aStart >= 90 ? aStart - 90 : aEnd + 30
    const bEnd = aStart >= 90 ? aStart - 30 : aEnd + 90
    await fillBook('b1', { totalPages: 3000 })
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: toHHMM(aStart), end: toHHMM(aEnd) },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a2', weekday: 1, date: null, start: toHHMM(bStart), end: toHHMM(bEnd) },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    await screen.findByTestId('today-table')
    const badges = await screen.findAllByTestId('plan-now-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveTextContent(/あと\d+分/)
  })

  it('records the planned pages with one tap after confirm', async () => {
    const originalConfirm = window.confirm
    window.confirm = (() => true) as unknown as typeof window.confirm
    try {
      await fillBook('b1')
      await saveAvailabilitySlot(
        { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
        true,
      )
      render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
      const row = await screen.findByTestId('plan-row-0')
      const planned = Number(
        within(row).getByTestId('plan-row-pages').textContent?.replace(/[^0-9]/g, '') ?? '0',
      )
      expect(planned).toBeGreaterThan(0)
      fireEvent.click(within(row).getByTestId('plan-done-b1'))
      await waitFor(async () => {
        const recs = await db.records.toArray()
        expect(recs).toHaveLength(1)
        expect(recs[0].pages).toBe(planned)
      })
    } finally {
      window.confirm = originalConfirm
    }
  })

  it('ずらした上書きでは上書き前の時間は残らない（重複なし）', async () => {
    await fillBook('b1', { trainFit: 'home' })
    await fillBook('b2', { trainFit: 'home' })
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 2, date: null, start: '16:45', end: '17:15' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'w2', weekday: 2, date: null, start: '18:00', end: '19:00', onTrain: true },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'w3', weekday: 2, date: null, start: '20:30', end: '21:30' },
      true,
    )
    // 18:00-19:00 を 17:45-19:00 にずらした上書き保存後のDB状態
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-29', start: '16:45', end: '17:15' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd2', weekday: null, date: '2026-09-29', start: '17:45', end: '19:00', onTrain: true },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd3', weekday: null, date: '2026-09-29', start: '20:30', end: '21:30' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    await screen.findByTestId('today-table')
    const rows = screen.getAllByTestId(/plan-row-\d+/)
    const shifted = rows.filter((r) => r.textContent?.includes('17:45-19:00'))
    expect(shifted).toHaveLength(1)
    expect(rows.some((r) => r.textContent?.includes('18:00-19:00'))).toBe(false)
    expect(screen.queryByTestId('override-shadow-notice')).not.toBeInTheDocument()
  })

  it('選び直し後に時間をずらして上書きしても本の指定は残る', async () => {
    await fillBook('b1', { trainFit: 'home' })
    await fillBook('b2', { trainFit: 'home' })
    await saveAvailabilitySlot(
      { id: 'w1', weekday: 2, date: null, start: '16:45', end: '17:15' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'w2', weekday: 2, date: null, start: '18:00', end: '19:00', onTrain: true },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'w3', weekday: 2, date: null, start: '20:30', end: '21:30' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-29" />)
    await screen.findByTestId('today-table')
    // 未割当の汽車枠で本を選び直す（セッションの固定）
    const before = screen.getAllByTestId(/plan-row-\d+/)
    const target = before.find((r) => r.textContent?.includes('18:00-19:00'))
    expect(target?.textContent).toContain('未割当')
    fireEvent.change(within(target as HTMLElement).getByRole('combobox'), {
      target: { value: 'b1' },
    })
    await waitFor(() => expect(screen.queryByText(/未割当/)).not.toBeInTheDocument())
    // 上書きフォームで 18:00 → 17:45 にずらして保存
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.change(screen.getByTestId('today-override-start-1'), { target: { value: '17:45' } })
    fireEvent.click(screen.getByTestId('today-override-save'))
    await waitFor(async () => {
      const all = await listAvailability()
      const shifted = all.filter((a) => a.date === '2026-09-29' && a.start === '17:45')
      expect(shifted).toHaveLength(1)
      expect(shifted[0].bookId).toBe('b1')
    })
  })

  it('cancelling the confirm records nothing', async () => {
    const originalConfirm = window.confirm
    window.confirm = (() => false) as unknown as typeof window.confirm
    try {
      await fillBook('b1')
      await saveAvailabilitySlot(
        { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
        true,
      )
      render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
      const row = await screen.findByTestId('plan-row-0')
      fireEvent.click(within(row).getByTestId('plan-done-b1'))
      await waitFor(async () => {
        expect(await db.records.toArray()).toHaveLength(0)
      })
    } finally {
      window.confirm = originalConfirm
    }
  })
})

describe('today slot gate', () => {
  it('未来枠は「終了後に記録できます」と表示し記録UIを隠す', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'f1', weekday: null, date: '2099-01-01', start: '21:00', end: '23:00', bookId: 'b1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2099-01-01" />)
    expect(await screen.findByTestId('slot-gate-future')).toHaveTextContent('終了後に記録できます')
    expect(screen.queryByTestId('plan-record-b1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('slot-missed-b1')).not.toBeInTheDocument()
  })

  it('過去の未確定枠は記録とやらなかったボタンを出す', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'p1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'b1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    await screen.findByTestId('today-table')
    expect(screen.getByTestId('plan-record-b1')).toBeInTheDocument()
    expect(screen.getByTestId('slot-missed-b1')).toHaveTextContent('やらなかった')
    expect(screen.queryByTestId('slot-gate-future')).not.toBeInTheDocument()
    expect(screen.queryByTestId('slot-locked')).not.toBeInTheDocument()
  })

  it('やらなかったで不戦敗が確定し確定済みになる', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'p1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'b1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    fireEvent.click(await screen.findByTestId('slot-missed-b1'))
    const { loadSeasonState } = await import('../data/seasonStore')
    const st = loadSeasonState('2026-09-21')
    expect(st.slotMatches['2026-09-21#1260-1380']?.result).toBe('loss')
    expect(st.slotMatches['2026-09-21#1260-1380']?.my).toBe(0)
    expect(await screen.findByTestId('slot-locked')).toHaveTextContent('確定済み')
  })

  it('確定済み枠は確定済み表示し記録UIを隠す', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'p1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'b1' },
      true,
    )
    const { syncLeagueSlot } = await import('../data/seasonStore')
    syncLeagueSlot('2026-09-21', '2026-09-21#1260-1380', { my: 10, unit: 'pages', slotMinutes: 120 })
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    expect(await screen.findByTestId('slot-locked')).toHaveTextContent('確定済み')
    expect(screen.queryByTestId('plan-record-b1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('slot-missed-b1')).not.toBeInTheDocument()
  })

  it('記録成功でリーグ枠が確定する', async () => {
    await fillBook('b1')
    await saveAvailabilitySlot(
      { id: 'p1', weekday: null, date: '2026-09-21', start: '21:00', end: '23:00', bookId: 'b1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const input = await screen.findByTestId('plan-input-b1')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('plan-record-b1'))
    await waitFor(async () => {
      const { loadSeasonState } = await import('../data/seasonStore')
      const st = loadSeasonState('2026-09-21')
      expect(st.slotMatches['2026-09-21#1260-1380']?.my).toBe(10)
    })
  })

  it('未割当の過去枠は本選択前は記録UIを出さない', async () => {
    await fillBook('b1', { trainFit: 'home' })
    await saveAvailabilitySlot(
      { id: 'u1', weekday: null, date: '2026-09-21', start: '18:00', end: '19:00', onTrain: true },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    await screen.findByTestId('today-table')
    expect(screen.queryByTestId('plan-record-b1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('slot-missed-b1')).not.toBeInTheDocument()
  })
})

