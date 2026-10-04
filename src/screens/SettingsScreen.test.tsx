import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import SettingsScreen from './SettingsScreen'
import { db } from '../db/database'
import { getAiSettings } from '../lib/ai'
import { takeAutoSnapshot } from '../data/autoBackup'

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await db.books.clear()
  await db.records.clear()
  await db.snapshots.clear()
  localStorage.clear()
})

it('shows the auto backup and restores it', async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'b1',
    title: '本',
    totalPages: 100,
    startDate: '2026-09-01',
    deadline: '2026-11-30',
    createdAt: now,
    updatedAt: now,
  } as any)
  await takeAutoSnapshot()
  expect(await db.snapshots.count()).toBe(1)
  await db.books.clear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<SettingsScreen onDone={() => {}} />)
  await waitFor(() => {
    expect(screen.getByTestId('auto-backup-info')).toHaveTextContent('参考書 1 冊')
  })
  fireEvent.click(screen.getByTestId('auto-backup-restore'))
  await waitFor(async () => {
    expect((await db.books.get('b1'))?.title).toBe('本')
  })
  expect(screen.getByTestId('backup-result')).toHaveTextContent('復元しました')
})

it('locks settings fields until edit is pressed', () => {
  render(<SettingsScreen onDone={() => {}} />)
  expect(screen.getByTestId('google-books-api-key')).toBeDisabled()
  expect(screen.getByTestId('ntfy-topic')).toBeDisabled()
  expect(screen.getByTestId('ai-api-key')).toBeDisabled()
  expect(screen.queryByTestId('save-google-books-api-key')).not.toBeInTheDocument()
  expect(screen.queryByTestId('ntfy-save')).not.toBeInTheDocument()
  expect(screen.queryByTestId('ai-save')).not.toBeInTheDocument()
})

it('cancel restores the stored values', () => {
  localStorage.setItem('google-books-api-key', 'AIza-keep')
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('edit-google-books'))
  fireEvent.change(screen.getByTestId('google-books-api-key'), { target: { value: 'JUNK' } })
  fireEvent.click(screen.getByTestId('cancel-google-books'))
  expect(screen.getByTestId('google-books-api-key')).toHaveValue('AIza-keep')
  expect(screen.getByTestId('google-books-api-key')).toBeDisabled()
  expect(localStorage.getItem('google-books-api-key')).toBe('AIza-keep')
})

it('locks again after saving', () => {
  localStorage.removeItem('schedule-app-ntfy')
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('edit-ntfy'))
  fireEvent.change(screen.getByTestId('ntfy-topic'), { target: { value: 'my-topic' } })
  fireEvent.click(screen.getByTestId('ntfy-save'))
  expect(screen.queryByTestId('ntfy-save')).not.toBeInTheDocument()
  expect(screen.getByTestId('ntfy-topic')).toBeDisabled()
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
  vi.spyOn(window, 'confirm').mockReturnValue(true)
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

it('rejects files larger than 2MB before parsing', async () => {
  const validData = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [],
    records: [],
  }
  const raw = JSON.stringify(validData)
  const file = new File([raw], 'backup.json', { type: 'application/json' })
  Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 + 1 })
  const textSpy = vi.fn(async () => raw)
  Object.defineProperty(file, 'text', { value: textSpy })
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('backup-import'), { target: { files: [file] } })
  await waitFor(() =>
    expect(screen.getByTestId('backup-result')).toHaveTextContent('読み込み失敗: ファイルが大きすぎます（2MBまで）'),
  )
  expect(textSpy).not.toHaveBeenCalled()
  expect(await db.books.count()).toBe(0)
})

it('asks for confirmation before overwriting on import', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
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
  await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith('バックアップから復元しますか？現在のデータは上書きされます。'))
  expect(await db.books.count()).toBe(0)
})

  it('saves the Google Books api key to localStorage', () => {
    localStorage.removeItem('google-books-api-key')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-google-books'))
    fireEvent.change(screen.getByTestId('google-books-api-key'), { target: { value: 'AIza-test' } })
  fireEvent.click(screen.getByTestId('save-google-books-api-key'))
  expect(localStorage.getItem('google-books-api-key')).toBe('AIza-test')
})

  it('saves the ntfy topic and enabled flag to localStorage', () => {
    localStorage.removeItem('schedule-app-ntfy')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ntfy'))
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
    fireEvent.click(screen.getByTestId('edit-ntfy'))
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
    fireEvent.click(screen.getByTestId('edit-ntfy'))
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
    fireEvent.click(screen.getByTestId('edit-ntfy'))
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
    fireEvent.click(screen.getByTestId('edit-ai'))
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
    fireEvent.click(screen.getByTestId('edit-ai'))
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
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'gpt-4o' } })
    fireEvent.click(screen.getByTestId('ai-test'))
    await waitFor(() =>
      expect(screen.getByTestId('ai-test-result')).toHaveTextContent(/401/),
    )
  })

  it('shows the response body on http failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded', code: 429 } }),
      }),
    )
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'm' } })
    fireEvent.click(screen.getByTestId('ai-test'))
    await waitFor(() =>
      expect(screen.getByTestId('ai-test-result')).toHaveTextContent(/Rate limit exceeded/),
    )
  })

  it('includes the underlying error detail on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')))
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'm' } })
    fireEvent.click(screen.getByTestId('ai-test'))
    await waitFor(() =>
      expect(screen.getByTestId('ai-test-result')).toHaveTextContent(/TypeError: Load failed/),
    )
  })

  it('fills the Gemini free-tier preset on selection', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'gemini' } })
    expect(screen.getByTestId('ai-endpoint')).toHaveValue(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    )
    expect(screen.getByTestId('ai-model')).toHaveValue('gemini-2.0-flash')
  })

  it('fills the OpenRouter free preset on selection', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'openrouter' } })
    expect(screen.getByTestId('ai-endpoint')).toHaveValue(
      'https://openrouter.ai/api/v1/chat/completions',
    )
    expect(screen.getByTestId('ai-model')).toHaveValue('qwen/qwen3.8-27b:free')
  })

  it('fills the Groq free preset on selection', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'groq' } })
    expect(screen.getByTestId('ai-endpoint')).toHaveValue(
      'https://api.groq.com/openai/v1/chat/completions',
    )
    expect(screen.getByTestId('ai-model')).toHaveValue('llama-3.1-8b-instant')
  })

  it('overwrites a stale model when switching presets', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'google/gemma-4-31b-it:free' } })
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'groq' } })
    expect(screen.getByTestId('ai-model')).toHaveValue('llama-3.1-8b-instant')
  })

  it('restores the OpenAI preset on selection', () => {
    localStorage.removeItem('ai-settings')
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'gemini' } })
    fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'openai' } })
    expect(screen.getByTestId('ai-endpoint')).toHaveValue(
      'https://api.openai.com/v1/chat/completions',
    )
  })

  it('reports endpoint reachable on ping success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('ai-ping'))
    await waitFor(() =>
      expect(screen.getByTestId('ai-ping-result')).toHaveTextContent(/到達OK/),
    )
  })

  it('reports endpoint unreachable when ping throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('ai-ping'))
    await waitFor(() =>
      expect(screen.getByTestId('ai-ping-result')).toHaveTextContent(/到達NG/),
    )
  })
})

describe('settings UI hardening (task6)', () => {
  it('masks the Google Books api key input', () => {
    render(<SettingsScreen onDone={() => {}} />)
    expect(screen.getByTestId('google-books-api-key')).toHaveAttribute('type', 'password')
  })

  it('warns about plaintext storage and ntfy visibility', () => {
    render(<SettingsScreen onDone={() => {}} />)
    expect(screen.getByText(/平文で保存されます/)).toBeInTheDocument()
    expect(screen.getByTestId('ai-description')).toHaveTextContent(
      /選択したAI事業者のエンドポイントに送信されます/,
    )
    expect(screen.getByTestId('ai-description')).toHaveTextContent(/httpのエンドポイントには送信しません/)
    expect(screen.getByText(/誰でも購読/)).toBeInTheDocument()
  })

  it('generates a random ntfy topic', () => {
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ntfy'))
    fireEvent.click(screen.getByTestId('ntfy-generate'))
    expect((screen.getByTestId('ntfy-topic') as HTMLInputElement).value).toMatch(
      /^my-study-[0-9a-f]{32}$/,
    )
  })

  it('asks confirmation before saving unsafe AI endpoint and aborts on cancel', () => {
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-endpoint'), {
      target: { value: 'http://evil.example.com/v1/chat/completions' },
    })
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByTestId('ai-save'))
    expect(confirmSpy).toHaveBeenCalledWith(
      'httpなど安全でないエンドポイントにはAPIキーを送信しません。保存しますか？（送信時にブロックされます）',
    )
    expect(screen.getByTestId('ai-save')).toBeInTheDocument()
  })

  it('saves a custom https endpoint without confirmation', () => {
    render(<SettingsScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('edit-ai'))
    fireEvent.change(screen.getByTestId('ai-endpoint'), {
      target: { value: 'https://custom.example.com/v1/chat/completions' },
    })
    fireEvent.change(screen.getByTestId('ai-api-key'), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByTestId('ai-model'), { target: { value: 'm' } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByTestId('ai-save'))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(getAiSettings().endpoint).toBe('https://custom.example.com/v1/chat/completions')
  })
})