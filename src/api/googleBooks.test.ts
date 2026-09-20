import { describe, it, expect, vi } from 'vitest'
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
    { id: 'vol1', title: '英単語1000', authors: ['太郎'], pageCount: 320, thumbnail: 'http://t.co/x' },
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