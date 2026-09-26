import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import SettingsScreen from './SettingsScreen'
import { db } from '../db/database'
import { getAiSettings } from '../lib/ai'

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
    expect.stringMatching(/^https:\/\/ntfy\.sh\/my-topic\?title=/),
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
  expect(fetchImpl).toHaveBeenCalledWith(
    expect.stringMatching(/^https:\/\/ntfy\.sh\/my-topic\?title=/),
    expect.anything(),
  )
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

describe('adjustment AI settings', () => {
  it('shows the default AI settings', () => {
    render(<SettingsScreen onDone={() => {}} />)
    expect(screen.getByTestId('ai-endpoint')).toHaveValue('https://api.openai.com/v1/chat/completions')
    expect(screen.getByTestId('ai-api-key')).toHaveValue('')
  })

  it('saves AI settings', () => {
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'gpt-5-mini' } })
    fireEvent.click(screen.getByTestId('ai-save'))
    const saved = getAiSettings()
    expect(saved.apiKey).toBe('sk-test')
    expect(saved.model).toBe('gpt-5-mini')
    expect(screen.getByTestId('backup-result')).toHaveTextContent('調整AIの設定を保存しました')
  })

  it('mentions mobile data and high-accuracy models', () => {
    render(<SettingsScreen onDone={() => {}} />)
    expect(screen.getByTestId('ai-description')).toHaveTextContent(/モバイル回線/)
    expect(screen.getByTestId('ai-description')).toHaveTextContent(/高精度/)
  })

  it('reports a successful AI connection test', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      }),
    )
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'gpt-4o' } })
    fireEvent.click(screen.getByTestId('ai-test'))
    await waitFor(() =>
      expect(screen.getByTestId('ai-test-result')).toHaveTextContent(/接続テスト成功/),
    )
  })

  it('reports an AI connection failure with status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'gpt-4o' } })
    fireEvent.click(screen.getByTestId('ai-test'))
    await waitFor(() =>
      expect(screen.getByTestId('ai-test-result')).toHaveTextContent(/401/),
    )
  })

  it('fills the Gemini free-tier preset on selection', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'gemini' } })
    expect(screen.getByTestId('ai-endpoint')).toHaveValue(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    )
    expect(screen.getByTestId('ai-model')).toHaveValue('gemini-2.0-flash')
  })

  it('fills the OpenRouter free preset on selection', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'openrouter' } })
    expect(screen.getByTestId('ai-endpoint')).toHaveValue(
      'https://openrouter.ai/api/v1/chat/completions',
    )
    expect(screen.getByTestId('ai-model')).toHaveValue('qwen/qwen3.8-27b:free')
  })

  it('restores the OpenAI preset on selection', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'gemini' } })
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'openai' } })
    expect(screen.getByTestId('ai-endpoint')).toHaveValue(
      'https://api.openai.com/v1/chat/completions',
    )
  })
})