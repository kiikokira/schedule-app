import { describe, it, expect, beforeEach } from 'vitest'
import { loadProfile, saveProfile, type Profile } from './profileStore'

describe('profileStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('初期値は空で保存・読込できる', () => {
    expect(loadProfile().university).toBe('')
    const p: Profile = { nickname: 'たろう', grade: '高2', university: '慶應', faculty: '環境情報学部', department: '' }
    saveProfile(p)
    expect(loadProfile()).toEqual(p)
  })
  it('通常はロック表示用にそのまま読める', () => {
    saveProfile({ nickname: '', grade: '高3', university: '新潟', faculty: '工学部', department: '' })
    expect(loadProfile().faculty).toBe('工学部')
  })
})
