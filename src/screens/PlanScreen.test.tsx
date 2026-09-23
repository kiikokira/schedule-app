import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import PlanScreen from './PlanScreen'
import { SCHEDULE, suggestDeadline } from '../data/schedule'
import { todayStr } from '../lib/progress'
import { loadSchedule } from '../data/scheduleStore'
import {
  saveAvailabilitySlot,
  listAvailability,
} from '../data/dayplanStore'

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.availability.clear()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
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

  it('removes a book from the schedule and saves after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('entry-delete-sfc-shoronbun'))
    fireEvent.click(screen.getByTestId('save-schedule'))
    const saved = loadSchedule()
    expect(saved.some((e) => e.catalogId === 'sfc-shoronbun')).toBe(false)
  })

  it('keeps the book in the schedule when delete is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('entry-delete-sfc-shoronbun'))
    fireEvent.click(screen.getByTestId('save-schedule'))
    const saved = loadSchedule()
    expect(saved.some((e) => e.catalogId === 'sfc-shoronbun')).toBe(true)
  })

  it('reverts edited dates only after confirming reset', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(
      screen.getByTestId('entry-deadline-eibunpo-polaris-2'),
      { target: { value: '2026-12-15' } },
    )
    expect(
      screen.getByTestId<HTMLInputElement>('entry-deadline-eibunpo-polaris-2')
        .value,
    ).toBe('2026-12-15')
    fireEvent.click(screen.getByTestId('reset-schedule'))
    expect(
      screen.getByTestId<HTMLInputElement>('entry-deadline-eibunpo-polaris-2')
        .value,
    ).toBe('2026-09-30')
  })

  it('keeps edited dates when reset is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(
      screen.getByTestId('entry-deadline-eibunpo-polaris-2'),
      { target: { value: '2026-12-15' } },
    )
    fireEvent.click(screen.getByTestId('reset-schedule'))
    expect(
      screen.getByTestId<HTMLInputElement>('entry-deadline-eibunpo-polaris-2')
        .value,
    ).toBe('2026-12-15')
  })

  it('keeps the stored schedule when the update confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(
      screen.getByTestId('entry-deadline-eibunpo-polaris-2'),
      { target: { value: '2026-12-15' } },
    )
    fireEvent.click(screen.getByTestId('save-schedule'))
    fireEvent.click(screen.getByTestId('reset-schedule'))
    const saved = loadSchedule()
    const eibunpo = saved.find((e) => e.catalogId === 'eibunpo-polaris-2')
    expect(eibunpo?.deadline).toBe('2026-12-15')
  })

  it('persists the latest schedule to storage after 最新のスケジュールに更新', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(
      screen.getByTestId('entry-deadline-eibunpo-polaris-2'),
      { target: { value: '2026-12-15' } },
    )
    fireEvent.click(screen.getByTestId('save-schedule'))
    expect(
      loadSchedule().find((e) => e.catalogId === 'eibunpo-polaris-2')?.deadline,
    ).toBe('2026-12-15')
    fireEvent.click(screen.getByTestId('reset-schedule'))
    const saved = loadSchedule()
    expect(saved).toHaveLength(17)
    expect(
      saved.find((e) => e.catalogId === 'eibunpo-polaris-2')?.deadline,
    ).toBe('2026-09-30')
    expect(
      saved.find((e) => e.catalogId === 'sfc-shoronbun')?.startDate,
    ).toBe('2027-08-31')
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
    expect(eibunpo?.deadline).toBe('2026-09-30')
    expect(eibunpo?.startDate).toBe('2026-09-21')
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
    expect(eibunpo?.deadline).toBe('2026-09-30')
    expect(eibunpo?.startDate).toBe('2026-04-01')
    expect(eibunpo?.coverUrl).toBe('https://example.com/polaris2.jpg')
  })

  it('adds a registered book to the schedule using its own deadline', async () => {
    await db.books.add({
      id: 'b1',
      title: '英単語1000',
      totalPages: 100,
      coverUrl: 'https://example.com/tango1000.jpg',
      startDate: '2026-01-01',
      deadline: '2026-12-31',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      const select = screen.getByTestId<HTMLSelectElement>('registered-select')
      expect(Array.from(select.options).some((o) => o.value === 'b1')).toBe(true)
    })
    fireEvent.change(screen.getByTestId('registered-select'), {
      target: { value: 'b1' },
    })
    fireEvent.change(screen.getByTestId('registered-add-start'), {
      target: { value: '2026-09-21' },
    })
    fireEvent.click(screen.getByTestId('add-registered-entry'))
    expect(screen.getByTestId('entry-start-b1')).toHaveValue('2026-09-21')
    expect(screen.getByTestId('entry-deadline-b1')).toHaveValue('2026-12-31')
    fireEvent.click(screen.getByTestId('save-schedule'))
    const saved = loadSchedule()
    const entry = saved.find((e) => e.bookId === 'b1')
    expect(entry?.startDate).toBe('2026-09-21')
    expect(entry?.deadline).toBe('2026-12-31')
  })

  it('does not offer an already-added registered book in the dropdown', async () => {
    await db.books.add({
      id: 'b1',
      title: '英単語1000',
      totalPages: 100,
      startDate: '2026-01-01',
      deadline: '2026-12-31',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('registered-select'), {
      target: { value: 'b1' },
    })
    fireEvent.click(screen.getByTestId('add-registered-entry'))
    const select = screen.getByTestId<HTMLSelectElement>('registered-select')
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).not.toContain('b1')
  })

  it('updates only the deadline of a registered book when applying a bookId entry', async () => {
    await db.books.add({
      id: 'b1',
      title: '英単語1000',
      totalPages: 100,
      coverUrl: 'https://example.com/tango1000.jpg',
      startDate: '2026-01-01',
      deadline: '2026-06-01',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      const select = screen.getByTestId<HTMLSelectElement>('registered-select')
      expect(Array.from(select.options).some((o) => o.value === 'b1')).toBe(true)
    })
    fireEvent.change(screen.getByTestId('registered-select'), {
      target: { value: 'b1' },
    })
    fireEvent.click(screen.getByTestId('add-registered-entry'))
    fireEvent.change(screen.getByTestId('entry-deadline-b1'), {
      target: { value: '2026-12-20' },
    })
    fireEvent.click(screen.getByTestId('apply-schedule'))
    expect(await screen.findByTestId('apply-result')).toHaveTextContent(
      '新規 17 冊 / 期限を更新 1 冊',
    )
    const books = await db.books.toArray()
    expect(books).toHaveLength(18)
    const tango = books.find((b) => b.id === 'b1')
    expect(tango?.deadline).toBe('2026-12-20')
    expect(tango?.startDate).toBe('2026-01-01')
    expect(tango?.coverUrl).toBe('https://example.com/tango1000.jpg')
  })

  it('adds a weekday availability slot', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-weekday-select'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByTestId('slot-start-0'), {
      target: { value: '21:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end-0'), {
      target: { value: '23:00' },
    })
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(1)
      expect(slots[0].weekday).toBe(1)
    })
  })

  it('adds multiple weekday slots at once', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-weekday-select'), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByTestId('slot-start-0'), {
      target: { value: '10:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end-0'), {
      target: { value: '12:00' },
    })
    fireEvent.click(screen.getByTestId('slot-row-add'))
    fireEvent.change(screen.getByTestId('slot-start-1'), {
      target: { value: '13:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end-1'), {
      target: { value: '16:00' },
    })
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(2)
      expect(slots.map((s) => s.start).sort()).toEqual(['10:00', '13:00'])
      expect(slots.every((s) => s.weekday === 0)).toBe(true)
    })
    expect((screen.getByTestId('slot-start-0') as HTMLInputElement).value).toBe('')
    expect(screen.queryByTestId('slot-start-1')).not.toBeInTheDocument()
  })

  it('ignores fully empty trailing rows and saves only filled rows', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-weekday-select'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByTestId('slot-start-0'), {
      target: { value: '21:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end-0'), {
      target: { value: '23:00' },
    })
    fireEvent.click(screen.getByTestId('slot-row-add'))
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(1)
      expect(slots[0].start).toBe('21:00')
    })
  })

  it('rejects a partial row and saves nothing', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-weekday-select'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByTestId('slot-start-0'), {
      target: { value: '21:00' },
    })
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      expect(await listAvailability()).toEqual([])
    })
    expect(window.alert).toHaveBeenCalled()
  })

  it('rejects a row whose end is not after start', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-weekday-select'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByTestId('slot-start-0'), {
      target: { value: '23:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end-0'), {
      target: { value: '22:00' },
    })
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      expect(await listAvailability()).toEqual([])
    })
    expect(window.alert).toHaveBeenCalled()
  })

  it('rejects overlapping rows within the same weekday', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-weekday-select'), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByTestId('slot-start-0'), {
      target: { value: '10:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end-0'), {
      target: { value: '12:00' },
    })
    fireEvent.click(screen.getByTestId('slot-row-add'))
    fireEvent.change(screen.getByTestId('slot-start-1'), {
      target: { value: '11:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end-1'), {
      target: { value: '13:00' },
    })
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      expect(await listAvailability()).toEqual([])
    })
    expect(window.alert).toHaveBeenCalled()
  })

  it('copies a weekday group into the weekday form', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(await screen.findByTestId('slot-copy-weekday-1'))
    expect((screen.getByTestId('slot-weekday-select') as HTMLSelectElement).value).toBe('1')
    expect((screen.getByTestId('slot-start-0') as HTMLInputElement).value).toBe('21:00')
    expect((screen.getByTestId('slot-end-0') as HTMLInputElement).value).toBe('23:00')
  })

  it('copies a weekday group and saves it to another weekday', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(await screen.findByTestId('slot-copy-weekday-1'))
    fireEvent.change(screen.getByTestId('slot-weekday-select'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(2)
      expect(slots.map((s) => s.weekday).sort()).toEqual([1, 2])
      expect(slots.filter((s) => s.weekday === 2)[0].start).toBe('21:00')
    })
  })

  it('does not show a copy button for date override groups', async () => {
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-30', start: '10:00', end: '11:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    expect(await screen.findByTestId('slot-group-date-2026-09-30')).toBeInTheDocument()
    expect(screen.queryByTestId('slot-copy-date-2026-09-30')).not.toBeInTheDocument()
  })

  it('deletes a weekday availability slot after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('slot-group-weekday-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('slot-group-weekday-1'))
    await waitFor(() => {
      expect(screen.getByTestId('slot-delete-a1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('slot-delete-a1'))
    await waitFor(async () => {
      expect(await listAvailability()).toEqual([])
    })
  })

  it('keeps a slot when delete confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('slot-group-weekday-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('slot-group-weekday-1'))
    await waitFor(() => {
      expect(screen.getByTestId('slot-delete-a1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('slot-delete-a1'))
    await waitFor(async () => {
      expect(await listAvailability()).toHaveLength(1)
    })
  })

  it('groups weekday slots by day and collapses them by default', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a2', weekday: 1, date: null, start: '09:00', end: '12:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('slot-group-weekday-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('slot-group-weekday-1')).toHaveTextContent(
      '月曜 09:00〜12:00, 21:00〜23:00',
    )
    expect(screen.queryByTestId('slot-delete-a1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('slot-delete-a2')).not.toBeInTheDocument()
  })

  it('expands a weekday group on tap and collapses it again', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('slot-group-weekday-1')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('slot-delete-a1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('slot-group-weekday-1'))
    expect(screen.getByTestId('slot-delete-a1')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('slot-group-weekday-1'))
    expect(screen.queryByTestId('slot-delete-a1')).not.toBeInTheDocument()
  })

  it('orders weekday groups Monday to Sunday with date groups last', async () => {
    await saveAvailabilitySlot(
      { id: 'a-sun', weekday: 0, date: null, start: '10:00', end: '11:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a-mon', weekday: 1, date: null, start: '10:00', end: '11:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a-sat', weekday: 6, date: null, start: '10:00', end: '11:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'a-date', weekday: null, date: '2026-09-30', start: '10:00', end: '11:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('slot-group-weekday-1')).toBeInTheDocument()
    })
    const ids = screen
      .getAllByTestId(/^slot-group-/)
      .map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual([
      'slot-group-weekday-1',
      'slot-group-weekday-6',
      'slot-group-weekday-0',
      'slot-group-date-2026-09-30',
    ])
  })

  it('groups date-override slots by date and expands on tap', async () => {
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-22', start: '07:00', end: '08:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'd2', weekday: null, date: '2026-09-22', start: '20:00', end: '21:30' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      expect(
        screen.getByTestId('slot-group-date-2026-09-22'),
      ).toBeInTheDocument()
    })
    expect(screen.getByTestId('slot-group-date-2026-09-22')).toHaveTextContent(
      '9月22日（火） 07:00〜08:00, 20:00〜21:30',
    )
    expect(screen.queryByTestId('slot-delete-d1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('slot-group-date-2026-09-22'))
    expect(screen.getByTestId('slot-delete-d1')).toBeInTheDocument()
    expect(screen.getByTestId('slot-delete-d2')).toBeInTheDocument()
  })

  it('adds a date-override slot and stores the date', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-date'), {
      target: { value: '2026-09-22' },
    })
    fireEvent.change(screen.getByTestId('slot-date-start-0'), {
      target: { value: '07:00' },
    })
    fireEvent.change(screen.getByTestId('slot-date-end-0'), {
      target: { value: '08:00' },
    })
    fireEvent.click(screen.getByTestId('slot-date-add'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(1)
      expect(slots[0].date).toBe('2026-09-22')
      expect(slots[0].weekday).toBeNull()
    })
  })

  it('adds multiple date-override slots at once', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-date'), {
      target: { value: '2026-09-22' },
    })
    fireEvent.change(screen.getByTestId('slot-date-start-0'), {
      target: { value: '07:00' },
    })
    fireEvent.change(screen.getByTestId('slot-date-end-0'), {
      target: { value: '08:00' },
    })
    fireEvent.click(screen.getByTestId('slot-date-row-add'))
    fireEvent.change(screen.getByTestId('slot-date-start-1'), {
      target: { value: '20:00' },
    })
    fireEvent.change(screen.getByTestId('slot-date-end-1'), {
      target: { value: '21:30' },
    })
    fireEvent.click(screen.getByTestId('slot-date-add'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(2)
      expect(slots.map((s) => s.start).sort()).toEqual(['07:00', '20:00'])
      expect(slots.every((s) => s.date === '2026-09-22' && s.weekday === null)).toBe(true)
    })
  })

  it('edits a weekday slot with new times and saves the update', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(await screen.findByTestId('slot-group-weekday-1'))
    fireEvent.change(screen.getByTestId('slot-edit-start-a1'), {
      target: { value: '20:00' },
    })
    fireEvent.change(screen.getByTestId('slot-edit-end-a1'), {
      target: { value: '22:00' },
    })
    fireEvent.click(screen.getByTestId('slot-save-a1'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(1)
      expect(slots[0].id).toBe('a1')
      expect(slots[0].start).toBe('20:00')
      expect(slots[0].end).toBe('22:00')
    })
    expect(screen.getByTestId('slot-group-weekday-1')).toHaveTextContent(
      '月曜 20:00〜22:00',
    )
  })

  it('rejects an edit whose end time is not after the start time', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(await screen.findByTestId('slot-group-weekday-1'))
    fireEvent.change(screen.getByTestId('slot-edit-start-a1'), {
      target: { value: '23:00' },
    })
    fireEvent.change(screen.getByTestId('slot-edit-end-a1'), {
      target: { value: '22:00' },
    })
    fireEvent.click(screen.getByTestId('slot-save-a1'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(1)
      expect(slots[0].start).toBe('21:00')
      expect(slots[0].end).toBe('23:00')
    })
  })

  it('edits a date-override slot and keeps the date group', async () => {
    await saveAvailabilitySlot(
      { id: 'd1', weekday: null, date: '2026-09-22', start: '07:00', end: '08:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(await screen.findByTestId('slot-group-date-2026-09-22'))
    fireEvent.change(screen.getByTestId('slot-edit-start-d1'), {
      target: { value: '08:00' },
    })
    fireEvent.change(screen.getByTestId('slot-edit-end-d1'), {
      target: { value: '09:30' },
    })
    fireEvent.click(screen.getByTestId('slot-save-d1'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(1)
      expect(slots[0].date).toBe('2026-09-22')
      expect(slots[0].start).toBe('08:00')
      expect(slots[0].end).toBe('09:30')
    })
    expect(screen.getByTestId('slot-group-date-2026-09-22')).toHaveTextContent(
      '9月22日（火） 08:00〜09:30',
    )
  })

  it('calls onDone when the back button is pressed', () => {
    let done = false
    render(<PlanScreen onDone={() => { done = true }} />)
    fireEvent.click(screen.getByTestId('back-button'))
    expect(done).toBe(true)
  })
})