import { describe, it, expect } from 'vitest'
import { isSafeCoverUrl, sanitizeCoverUrl } from './coverUrl'

describe('isSafeCoverUrl', () => {
  it('allows https: URLs within length limit', () => {
    expect(isSafeCoverUrl('https://example.com/cover.jpg')).toBe(true)
  })

  it('rejects http: URLs', () => {
    expect(isSafeCoverUrl('http://example.com/cover.jpg')).toBe(false)
  })

  it('rejects javascript: URLs', () => {
    expect(isSafeCoverUrl('javascript:alert(1)')).toBe(false)
  })

  it('allows blob: URLs', () => {
    expect(isSafeCoverUrl('blob:https://example.com/uuid')).toBe(true)
  })

  it('allows data:image/png URLs', () => {
    expect(isSafeCoverUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
  })

  it('rejects data:image/svg+xml URLs', () => {
    expect(isSafeCoverUrl('data:image/svg+xml;base64,PHNjcmlwdA==')).toBe(false)
  })

  it('rejects data:text/html URLs', () => {
    expect(isSafeCoverUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects empty and whitespace-only strings', () => {
    expect(isSafeCoverUrl('')).toBe(false)
    expect(isSafeCoverUrl('   ')).toBe(false)
  })

  it('rejects null and undefined', () => {
    expect(isSafeCoverUrl(null)).toBe(false)
    expect(isSafeCoverUrl(undefined)).toBe(false)
  })

  it('rejects other schemes', () => {
    expect(isSafeCoverUrl('ftp://example.com/cover.jpg')).toBe(false)
    expect(isSafeCoverUrl('covers/polaris.png')).toBe(false)
  })

  it('rejects https: URLs longer than 2048 chars', () => {
    const long = 'https://example.com/' + 'a'.repeat(2048)
    expect(long.length).toBeGreaterThan(2048)
    expect(isSafeCoverUrl(long)).toBe(false)
  })

  it('rejects huge data URLs', () => {
    const huge = 'data:image/png;base64,' + 'a'.repeat(200000)
    expect(huge.length).toBeGreaterThan(200000)
    expect(isSafeCoverUrl(huge)).toBe(false)
  })
})

describe('sanitizeCoverUrl', () => {
  it('returns safe URLs as-is and null for unsafe', () => {
    expect(sanitizeCoverUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg')
    expect(sanitizeCoverUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeCoverUrl(null)).toBeNull()
    expect(sanitizeCoverUrl(undefined)).toBeNull()
  })
})
