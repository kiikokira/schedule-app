const HTTPS_MAX_LENGTH = 2048
const DATA_URL_MAX_LENGTH = 200000

const ALLOWED_DATA_PREFIXES = [
  'data:image/png',
  'data:image/jpeg',
  'data:image/gif',
  'data:image/webp',
]

export function isSafeCoverUrl(src: string | null | undefined): boolean {
  if (typeof src !== 'string') return false
  if (src.trim() === '') return false
  const lower = src.toLowerCase()
  if (lower.startsWith('https://')) {
    return src.length <= HTTPS_MAX_LENGTH
  }
  if (lower.startsWith('blob:')) {
    return true
  }
  for (const prefix of ALLOWED_DATA_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return src.length <= DATA_URL_MAX_LENGTH
    }
  }
  return false
}

export function sanitizeCoverUrl(src: string | null | undefined): string | null {
  if (!isSafeCoverUrl(src)) return null
  return src as string
}
