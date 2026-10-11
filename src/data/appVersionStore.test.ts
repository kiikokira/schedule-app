import { describe, it, expect, beforeEach } from 'vitest'
import { loadLastSeenBuildId, saveLastSeenBuildId } from './appVersionStore'

beforeEach(() => {
  localStorage.clear()
})

describe('appVersionStore', () => {
  it('returns null when nothing is seen yet', () => {
    expect(loadLastSeenBuildId()).toBeNull()
  })

  it('round-trips the last seen build id', () => {
    saveLastSeenBuildId('build-9')
    expect(loadLastSeenBuildId()).toBe('build-9')
  })
})
