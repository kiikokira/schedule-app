import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import FocusPeriodScreen from './FocusPeriodScreen'
import { db } from '../db/database'
import { loadFocusPeriods, saveFocusPeriods } from '../data/focusPeriods'

beforeEach(async () => {
  await db.books.clear()
  saveFocusPeriods([])
  vi.restoreAllMocks()
})

const seedBooks = async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'leap-1',
    title: 'LEAP',
    catalogId: 'leap',
    totalPages: 576,
    startDate: '2026-09-26',
    deadline: '2026-10-15',
    createdAt: now,
    updatedAt: now,
  } as any)
  await db.books.add({
    id: 'b1',
    title: '文法書',
    totalPages: 100,
    startDate: '2026-09-01',
    deadline: '2026-11-30',
    createdAt: now,
    updatedAt: now,
  } as any)
}

describe('FocusPeriodScreen', () => {
  it('adds a period with the selected books', async () => {
    await seedBooks()
    render(<FocusPeriodScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('focus-book-leap-1')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('focus-title'), { target: { value: '中間テスト' } })
    fireEvent.change(screen.getByTestId('focus-start'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByTestId('focus-end'), { target: { value: '2026-10-14' } })
    fireEvent.click(screen.getByTestId('focus-book-leap-1'))
    fireEvent.click(screen.getByTestId('focus-add'))
    await waitFor(() => expect(loadFocusPeriods()).toHaveLength(1))
    const [saved] = loadFocusPeriods()
    expect(saved.title).toBe('中間テスト')
    expect(saved.startDate).toBe('2026-10-01')
    expect(saved.bookIds).toEqual(['leap-1'])
    expect(screen.getByTestId(`focus-row-${saved.id}`)).toHaveTextContent('中間テスト')
  })

  it('rejects a period without books', async () => {
    await seedBooks()
    render(<FocusPeriodScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('focus-book-leap-1')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('focus-title'), { target: { value: '中間テスト' } })
    fireEvent.change(screen.getByTestId('focus-start'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByTestId('focus-end'), { target: { value: '2026-10-14' } })
    fireEvent.click(screen.getByTestId('focus-add'))
    expect(screen.getByTestId('focus-error')).toHaveTextContent('1冊以上')
    expect(loadFocusPeriods()).toHaveLength(0)
  })

  it('deletes a period after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveFocusPeriods([
      { id: 'f1', title: '中間テスト', startDate: '2026-10-01', endDate: '2026-10-14', bookIds: ['leap-1'] },
    ])
    render(<FocusPeriodScreen onBack={() => {}} />)
    expect(await screen.findByTestId('focus-row-f1')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('focus-delete-f1'))
    await waitFor(() => expect(loadFocusPeriods()).toHaveLength(0))
  })
})
