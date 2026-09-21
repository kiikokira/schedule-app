import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSchedule,
  saveSchedule,
  addEntry,
  removeEntry,
  updateEntry,
  resetSchedule,
} from './scheduleStore'
import type { ScheduleEntry } from './schedule'

const THE_SCHEDULE: ScheduleEntry[] = [
  { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
  {
    catalogId: 'sfc-eigo-kakomon',
    startDate: '2027-04-01',
    deadline: '2028-02-29',
    note: '2028年2月まで継続',
  },
]

beforeEach(() => {
  localStorage.clear()
})

describe('scheduleStore', () => {
  it('loads the default schedule when nothing is stored', () => {
    const entries = loadSchedule()
    expect(entries).toHaveLength(17)
  })

  it('saves and loads a customized schedule', () => {
    saveSchedule(THE_SCHEDULE)
    expect(loadSchedule()).toEqual(THE_SCHEDULE)
  })

  it('falls back to default when stored data is invalid', () => {
    localStorage.setItem('schedule-app-schedule', '{broken')
    expect(loadSchedule()).toHaveLength(17)
  })

  it('adds a new entry to the schedule', () => {
    const entries = addEntry(
      [],
      { catalogId: 'leap', startDate: '2026-09-01', deadline: '2026-12-31' },
    )
    expect(entries).toEqual([
      { catalogId: 'leap', startDate: '2026-09-01', deadline: '2026-12-31' },
    ])
  })

  it('does not add a duplicate catalogId entry', () => {
    const entries = addEntry(
      [...THE_SCHEDULE],
      { catalogId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
    )
    expect(entries).toHaveLength(THE_SCHEDULE.length)
  })

  it('removes an entry by catalogId', () => {
    const entries = removeEntry(THE_SCHEDULE, 'eibunpo-polaris-2')
    expect(entries).toEqual([THE_SCHEDULE[1]])
  })

  it('updates start and deadline of an entry', () => {
    const entries = updateEntry(THE_SCHEDULE, 'sfc-eigo-kakomon', {
      startDate: '2027-05-01',
      deadline: '2028-02-10',
    })
    expect(entries.find((e) => e.catalogId === 'sfc-eigo-kakomon')).toEqual({
      catalogId: 'sfc-eigo-kakomon',
      startDate: '2027-05-01',
      deadline: '2028-02-10',
      note: '2028年2月まで継続',
    })
  })

  it('saves and loads a bookId entry referencing a registered book', () => {
    saveSchedule([
      { bookId: 'custom-1', startDate: '2026-09-01', deadline: '2026-11-30' },
    ])
    expect(loadSchedule()).toEqual([
      { bookId: 'custom-1', startDate: '2026-09-01', deadline: '2026-11-30' },
    ])
  })

  it('does not add a duplicate bookId entry', () => {
    const entries = addEntry(
      [{ bookId: 'custom-1', startDate: '2026-09-01', deadline: '2026-11-30' }],
      { bookId: 'custom-1', startDate: '2026-09-01', deadline: '2026-11-30' },
    )
    expect(entries).toHaveLength(1)
  })

  it('dedupes catalogId and bookId entries by the same underlying key only', () => {
    const entries = addEntry(
      THE_SCHEDULE,
      { bookId: 'eibunpo-polaris-2', startDate: '2026-09-01', deadline: '2026-11-30' },
    )
    expect(entries).toHaveLength(THE_SCHEDULE.length)
  })

  it('allows a bookId entry to coexist with catalog entries', () => {
    const entries = addEntry(
      THE_SCHEDULE,
      { bookId: 'custom-1', startDate: '2026-09-01', deadline: '2026-11-30' },
    )
    expect(entries).toHaveLength(THE_SCHEDULE.length + 1)
  })

  it('removes a bookId entry by key', () => {
    const entries = removeEntry(
      [{ bookId: 'custom-1', startDate: '2026-09-01', deadline: '2026-11-30' }],
      'custom-1',
    )
    expect(entries).toHaveLength(0)
  })

  it('updates the deadlines of a bookId entry', () => {
    const entries = updateEntry(
      [{ bookId: 'custom-1', startDate: '2026-09-01', deadline: '2026-11-30' }],
      'custom-1',
      { deadline: '2026-12-31' },
    )
    expect(entries[0].deadline).toBe('2026-12-31')
  })

  it('resets to the default schedule', () => {
    saveSchedule(THE_SCHEDULE)
    resetSchedule()
    expect(loadSchedule()).toHaveLength(17)
  })
})