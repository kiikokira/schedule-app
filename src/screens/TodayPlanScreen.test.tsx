import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('上書き時も曜日設定の時間は未割当で必ず並ぶ', async () => {
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
    const target = rows.find((r) => r.textContent?.includes('17:45-19:00'))
    expect(target?.textContent).toContain('未割当')
  })

  it('上書きで欠けた曜日設定の時間を通知し追加できる', async () => {
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
    expect(await screen.findByTestId('override-shadow-notice')).toHaveTextContent('17:45〜19:00')
    fireEvent.click(screen.getByTestId('override-shadow-merge'))
    await waitFor(async () => {
      const all = await listAvailability()
      expect(all.filter((a) => a.date === '2026-09-29')).toHaveLength(2)
    })
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

  it('学校の日程は初期は畳まれ展開すると今月の行事が見える', async () => {
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-05" />)
    expect(screen.getByTestId('school-events-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('school-events-list')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('school-events-toggle'))
    expect(await screen.findByTestId('school-events-list')).toBeInTheDocument()
    expect(screen.getByText('中間試験発表')).toBeInTheDocument()
  })

  it('学校の日程は他の月の行事を表示しない', async () => {
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-05" />)
    fireEvent.click(screen.getByTestId('school-events-toggle'))
    expect(await screen.findByTestId('school-events-list')).toBeInTheDocument()
    expect(screen.queryByText('期末試験①')).not.toBeInTheDocument()
  })
})

