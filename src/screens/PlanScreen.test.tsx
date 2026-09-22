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
    fireEvent.change(screen.getByTestId('slot-start'), {
      target: { value: '21:00' },
    })
    fireEvent.change(screen.getByTestId('slot-end'), {
      target: { value: '23:00' },
    })
    fireEvent.click(screen.getByTestId('slot-add'))
    await waitFor(async () => {
      const slots = await listAvailability()
      expect(slots).toHaveLength(1)
      expect(slots[0].weekday).toBe(1)
    })
  })

  it('deletes a weekday availability slot', async () => {
    await saveAvailabilitySlot(
      { id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' },
      true,
    )
    render(<PlanScreen onDone={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('slot-delete-a1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('slot-delete-a1'))
    await waitFor(async () => {
      expect(await listAvailability()).toEqual([])
    })
  })

  it('adds a date-override slot and stores the date', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('slot-date'), {
      target: { value: '2026-09-22' },
    })
    fireEvent.change(screen.getByTestId('slot-date-start'), {
      target: { value: '07:00' },
    })
    fireEvent.change(screen.getByTestId('slot-date-end'), {
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

  it('calls onDone when the back button is pressed', () => {
    let done = false
    render(<PlanScreen onDone={() => { done = true }} />)
    fireEvent.click(screen.getByTestId('back-button'))
    expect(done).toBe(true)
  })
})