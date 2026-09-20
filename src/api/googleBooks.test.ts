import { it, expect, vi } from 'vitest'
import { searchBooks, type SearchResultItem } from './googleBooks'

const mockJson = {
  totalItems: 1,
  items: [
    {
      id: 'vol1',
      volumeInfo: {
        title: '英単語1000',
        authors: ['太郎'],
        pageCount: 320,
        imageLinks: { thumbnail: 'http://t.co/x' },
      },
    },
    {
      id: 'vol2',
      volumeInfo: {
        title: '英熟語500',
      },
    },
  ],
}

it('returns mapped result items with nullable fields', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockJson,
  })
  const result = await searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)
  expect(result).toEqual([
    { id: 'vol1', title: '英単語1000', authors: ['太郎'], pageCount: 320, thumbnail: 'https://t.co/x' },
    { id: 'vol2', title: '英熟語500', authors: [], pageCount: null, thumbnail: null },
  ] as SearchResultItem[])
})

it('throws a friendly error when network fails', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
  await expect(searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)).rejects.toThrow(
    '検索できませんでした',
  )
})

it('throws when response is not ok', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 })
  await expect(searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)).rejects.toThrow(
    '検索できませんでした',
  )
})

it('appends the api key when provided', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  await searchBooks('英単語', 10, fetchMock as unknown as typeof fetch, 'secret-key')
  const url = (fetchMock.mock.calls[0][0] as string) ?? ''
  expect(url).toContain('key=secret-key')
})

it('retries up to 3 times on 429 when an api key is set, then throws', async () => {
  vi.useFakeTimers()
  try {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    const assertion = expect(
      searchBooks('英単語', 10, fetchMock as unknown as typeof fetch, 'k'),
    ).rejects.toThrow('検索できませんでした')
    await vi.advanceTimersByTimeAsync(900)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  } finally {
    vi.useRealTimers()
  }
})

it('succeeds on the second attempt after a 429 when an api key is set', async () => {
  vi.useFakeTimers()
  try {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    const promise = searchBooks('英単語', 10, fetchMock as unknown as typeof fetch, 'k')
    await vi.advanceTimersByTimeAsync(900)
    const result = await promise
    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})