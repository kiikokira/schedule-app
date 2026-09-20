export type SearchResultItem = {
  id: string
  title: string
  authors: string[]
  pageCount: number | null
  thumbnail: string | null
}

type VolumeInfo = {
  title?: string
  authors?: string[]
  pageCount?: number
  imageLinks?: { thumbnail?: string }
}

const API_URL = 'https://www.googleapis.com/books/v1/volumes'
const API_KEY_STORAGE_KEY = 'google-books-api-key'

export function getBooksApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setBooksApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim())
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY)
    }
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function searchBooks(
  query: string,
  limit = 10,
  fetchImpl: typeof fetch = fetch,
  apiKey = getBooksApiKey(),
): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(limit), langRestrict: 'ja' })
  if (apiKey) params.set('key', apiKey)
  const url = `${API_URL}?${params.toString()}`

  const attempts = apiKey ? 3 : 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    let res: Response
    try {
      res = await fetchImpl(url)
    } catch {
      break
    }
    if (res.ok) {
      const data = (await res.json()) as unknown as {
        items?: { id?: string; volumeInfo?: VolumeInfo }[]
      }
      if (!Array.isArray(data.items)) return []
      return data.items
        .filter((item) => item.volumeInfo && item.id)
        .map((item) => {
          const info = item.volumeInfo as VolumeInfo
          return {
            id: item.id as string,
            title: info.title ?? '(タイトルなし)',
            authors: info.authors ?? [],
            pageCount: typeof info.pageCount === 'number' ? info.pageCount : null,
            thumbnail: info.imageLinks?.thumbnail
              ? info.imageLinks.thumbnail.replace(/^http:/, 'https:')
              : null,
          }
        })
    }
    if (res.status !== 429 && res.status < 500) break
    if (attempt < attempts - 1) {
      await sleep(300 * (attempt + 1))
    }
  }
  throw new Error('検索できませんでした')
}