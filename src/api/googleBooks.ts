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

const SERIES_ALIASES: Record<string, string[]> = {
  英単語: ['パス単', '単熟語'],
  英熟語: ['単熟語'],
}

function buildSearchTerms(query: string): string[] {
  const trimmed = query.trim()
  const primary = trimmed.includes(':') ? trimmed : `intitle:${trimmed}`
  const aliases = SERIES_ALIASES[trimmed]
  return aliases ? [primary, ...aliases.map((a) => `intitle:${a}`)] : [primary]
}

function titleKey(item: SearchResultItem): string {
  return item.title.toLowerCase().replace(/\s+/g, '')
}

function parseItems(data: unknown): SearchResultItem[] {
  const payload = data as {
    items?: { id?: string; volumeInfo?: VolumeInfo }[]
  }
  if (!Array.isArray(payload.items)) return []
  return payload.items
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

async function searchOne(
  term: string,
  limit: number,
  fetchImpl: typeof fetch,
  apiKey: string,
): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({ q: term, maxResults: String(limit), langRestrict: 'ja' })
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
      return parseItems(await res.json())
    }
    if (res.status !== 429 && res.status < 500) break
    if (attempt < attempts - 1) {
      await sleep(300 * (attempt + 1))
    }
  }
  throw new Error('検索できませんでした')
}

export async function searchBooks(
  query: string,
  limit = 40,
  fetchImpl: typeof fetch = fetch,
  apiKey = getBooksApiKey(),
): Promise<SearchResultItem[]> {
  const terms = buildSearchTerms(query)
  const primary = await searchOne(terms[0], limit, fetchImpl, apiKey)
  if (terms.length === 1) return primary

  const seen = new Set(primary.map(titleKey))
  const extra: SearchResultItem[] = []
  for (const term of terms.slice(1)) {
    try {
      for (const item of await searchOne(term, limit, fetchImpl, apiKey)) {
        const key = titleKey(item)
        if (!seen.has(key)) {
          seen.add(key)
          extra.push(item)
        }
      }
    } catch {
      // 系列の追加検索に失敗しても主検索の結果は返す
    }
  }
  return [...primary, ...extra]
}