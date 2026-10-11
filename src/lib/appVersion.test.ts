import { describe, it, expect } from 'vitest'
import { APP_BUILD_ID, shouldShowUpdateDot } from './appVersion'

describe('appVersion', () => {
  it('exposes a non-empty build id', () => {
    expect(typeof APP_BUILD_ID).toBe('string')
    expect(APP_BUILD_ID.length).toBeGreaterThan(0)
  })

  it('shows no dot on first run', () => {
    expect(shouldShowUpdateDot(null, 'build-2')).toBe(false)
  })

  it('shows no dot when the build is already seen', () => {
    expect(shouldShowUpdateDot('build-2', 'build-2')).toBe(false)
  })

  it('shows the dot on first open after an update', () => {
    expect(shouldShowUpdateDot('build-1', 'build-2')).toBe(true)
  })
})
