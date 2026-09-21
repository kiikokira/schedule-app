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

it('saves the Google Books api key to localStorage', () => {
  localStorage.removeItem('google-books-api-key')
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('google-books-api-key'), { target: { value: 'AIza-test' } })
  fireEvent.click(screen.getByTestId('save-google-books-api-key'))
  expect(localStorage.getItem('google-books-api-key')).toBe('AIza-test')
})

it('saves the ntfy topic and enabled flag to localStorage', () => {
  localStorage.removeItem('schedule-app-ntfy')
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('ntfy-topic'), { target: { value: 'my-topic' } })
  fireEvent.click(screen.getByTestId('ntfy-enabled'))
  fireEvent.click(screen.getByTestId('ntfy-save'))
  expect(localStorage.getItem('schedule-app-ntfy')).toBe(
    JSON.stringify({ enabled: true, topic: 'my-topic' }),
  )
})

it('normalizes a pasted ntfy URL before saving', () => {
  localStorage.removeItem('schedule-app-ntfy')
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('ntfy-topic'), {
    target: { value: 'https://ntfy.sh/my-topic' },
  })
  fireEvent.click(screen.getByTestId('ntfy-save'))
  expect(localStorage.getItem('schedule-app-ntfy')).toBe(
    JSON.stringify({ enabled: false, topic: 'my-topic' }),
  )
})

it('sends a test notification to the ntfy topic', async () => {
  const fetchImpl = vi.fn(async () => ({ ok: true } as Response))
  vi.stubGlobal('fetch', fetchImpl)
  localStorage.setItem(
    'schedule-app-ntfy',
    JSON.stringify({ enabled: true, topic: 'my-topic' }),
  )
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('ntfy-test'))
  await waitFor(() =>
    expect(screen.getByTestId('ntfy-result')).toHaveTextContent('テスト通知を送信しました'),
  )
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://ntfy.sh/my-topic',
    expect.objectContaining({ method: 'POST' }),
  )
})

it('sends a test notification to the normalized URL when a full address is pasted', async () => {
  const fetchImpl = vi.fn(async () => ({ ok: true } as Response))
  vi.stubGlobal('fetch', fetchImpl)
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('ntfy-topic'), {
    target: { value: 'https://ntfy.sh/my-topic' },
  })
  fireEvent.click(screen.getByTestId('ntfy-test'))
  await waitFor(() =>
    expect(screen.getByTestId('ntfy-result')).toHaveTextContent('テスト通知を送信しました'),
  )
  expect(fetchImpl).toHaveBeenCalledWith('https://ntfy.sh/my-topic', expect.anything())
})

it('reports a network failure when the request throws', async () => {
  const fetchImpl = vi.fn(async () => {
    throw new Error('network down')
  })
  vi.stubGlobal('fetch', fetchImpl)
  localStorage.setItem(
    'schedule-app-ntfy',
    JSON.stringify({ enabled: true, topic: 'my-topic' }),
  )
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('ntfy-test'))
  await waitFor(() =>
    expect(screen.getByTestId('ntfy-result')).toHaveTextContent(/送信に失敗しました（ネットワーク/),
  )
})

it('reports an http failure with the status', async () => {
  const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }) as Response)
  vi.stubGlobal('fetch', fetchImpl)
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('ntfy-topic'), { target: { value: 'wrong/topic' } })
  fireEvent.click(screen.getByTestId('ntfy-test'))
  await waitFor(() =>
    expect(screen.getByTestId('ntfy-result')).toHaveTextContent(/HTTP 404/),
  )
})