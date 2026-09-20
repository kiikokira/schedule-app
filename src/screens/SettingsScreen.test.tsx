import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import SettingsScreen from './SettingsScreen'
import { db } from '../db/database'

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await db.books.clear()
  await db.records.clear()
})

it('exports a JSON file on export click', async () => {
  const createSpy = vi.fn(() => 'blob:test')
  vi.stubGlobal('URL', { createObjectURL: createSpy, revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('backup-export'))
  await waitFor(() => expect(createSpy).toHaveBeenCalled())
})

it('shows result message after import', async () => {
  const validData = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [],
    records: [],
  }
  const raw = JSON.stringify(validData)
  const file = new File([raw], 'backup.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: vi.fn(async () => raw) })
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('backup-import'), { target: { files: [file] } })
  await waitFor(() => expect(screen.getByTestId('backup-result')).toHaveTextContent(/読み込みました/))
})