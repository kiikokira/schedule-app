import { describe, it, expect, beforeEach } from 'vitest'
import { loadLastRank, saveLastRank } from './lastRankStore'

describe('lastRankStore', () => {
  beforeEach(() => { localStorage.clear() })
  it('初期は null', () => { expect(loadLastRank()).toBeNull() })
  it('保存→読込できる', () => { saveLastRank(199159); expect(loadLastRank()).toBe(199159) })
  it('壊れた値は null', () => { localStorage.setItem('schedule-app-last-rank', 'abc'); expect(loadLastRank()).toBeNull() })
})
