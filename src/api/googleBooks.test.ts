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

const intitleOf = (fetchMock: ReturnType<typeof vi.fn>, callIndex: number) => {
  const url = fetchMock.mock.calls[callIndex][0] as string
  return new URL(url).searchParams.get('q')
}

it('requests up to 40 results by default', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  await searchBooks('LEAP', undefined, fetchMock as unknown as typeof fetch)
  const url = fetchMock.mock.calls[0][0] as string
  expect(new URL(url).searchParams.get('maxResults')).toBe('40')
})

it('rewrites the query to a title-only search', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  await searchBooks('LEAP', 10, fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(intitleOf(fetchMock, 0)).toBe('intitle:LEAP')
})

it('adds intitle searches for known vocabulary book series', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  await searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(intitleOf(fetchMock, 0)).toBe('intitle:英単語')
  expect(intitleOf(fetchMock, 1)).toBe('intitle:パス単')
  expect(intitleOf(fetchMock, 2)).toBe('intitle:単熟語')
})

it('adds 単熟語 for 英熟語 searches', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  await searchBooks('英熟語', 10, fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(intitleOf(fetchMock, 1)).toBe('intitle:単熟語')
})

it('does no extra searches for a non-generic query', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  await searchBooks('英単語ターゲット1900', 10, fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(intitleOf(fetchMock, 0)).toBe('intitle:英単語ターゲット1900')
})

it('passes through a query that already contains a field operator', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  await searchBooks('intitle:LEAP', 10, fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(intitleOf(fetchMock, 0)).toBe('intitle:LEAP')
})

it('merges and dedupes series results after the primary results', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: 'a', volumeInfo: { title: '英単語1000' } },
          { id: 'b', volumeInfo: { title: '必携英単語LEAP' } },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: 'c', volumeInfo: { title: '英検Pass単熟語' } },
          { id: 'd', volumeInfo: { title: '必携英単語LEAP' } },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'e', volumeInfo: { title: '英検Pass単熟語 5級' } }],
      }),
    })
  const result = await searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(result.map((r) => r.title)).toEqual([
    '英単語1000',
    '必携英単語LEAP',
    '英検Pass単熟語',
    '英検Pass単熟語 5級',
  ])
})

it('returns primary results when a series alias search fails', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 'a', volumeInfo: { title: '英単語1000' } }] }),
    })
    .mockRejectedValueOnce(new Error('network'))
    .mockRejectedValueOnce(new Error('network'))
  const result = await searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(result.map((r) => r.title)).toEqual(['英単語1000'])
})

it('throws when the primary search fails even if series searches would succeed', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
  await expect(searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)).rejects.toThrow(
    '検索できませんでした',
  )
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('succeeds on the second attempt after a 429 when an api key is set', async () => {
  vi.useFakeTimers()
  try {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    const promise = searchBooks('LEAP', 10, fetchMock as unknown as typeof fetch, 'k')
    await vi.advanceTimersByTimeAsync(900)
    const result = await promise
    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})