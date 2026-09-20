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

export async function searchBooks(
  query: string,
  limit = 10,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchResultItem[]> {
  const url = `${API_URL}?q=${encodeURIComponent(query)}&maxResults=${limit}&langRestrict=ja`
  let res: Response
  try {
    res = await fetchImpl(url)
  } catch {
    throw new Error('検索できませんでした')
  }
  if (!res.ok) throw new Error('検索できませんでした')
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