import { describe, it, expect, beforeEach } from 'vitest'
import { loadLastRank, saveLastRank } from './lastRankStore'

describe('lastRankStore', () => {
  beforeEach(() => { localStorage.clear() })
  it('初期は null', () => { expect(loadLastRank()).toBeNull() })
  it('保存→読込できる', () => { saveLastRank(199159); expect(loadLastRank()).toBe(199159) })
  it('壊れた値は null', () => { localStorage.setItem('schedule-app-last-rank', 'abc'); expect(loadLastRank()).toBeNull() })
  it('版が違う基準値は無視する（モデル変更直後の見かけDOWN防止）', () => {
    localStorage.setItem('schedule-app-last-rank', '11994')
    localStorage.setItem('schedule-app-last-rank-model', '1')
    expect(loadLastRank()).toBeNull()
    saveLastRank(17623)
    expect(loadLastRank()).toBe(17623)
  })
})
