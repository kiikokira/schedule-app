import { describe, it, expect, beforeEach } from 'vitest'
import { loadProfile, saveProfile, type Profile } from './profileStore'

describe('profileStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('初期値は空で保存・読込できる', () => {
    expect(loadProfile().university).toBe('')
    const p: Profile = { nickname: 'たろう', grade: '高2', university: '慶應', faculty: '環境情報学部', department: '', playMode: 'both' }
    saveProfile(p)
    expect(loadProfile()).toEqual(p)
  })
  it('通常はロック表示用にそのまま読める', () => {
    saveProfile({ nickname: '', grade: '高3', university: '新潟', faculty: '工学部', department: '', playMode: 'both' })
    expect(loadProfile().faculty).toBe('工学部')
  })
  it('楽しみ方の初期値は両方', () => {
    expect(loadProfile().playMode).toBe('both')
  })
  it('楽しみ方を保存・読込できる', () => {
    saveProfile({ nickname: '', grade: '', university: '', faculty: '', department: '', playMode: 'league' })
    expect(loadProfile().playMode).toBe('league')
  })
  it('旧データ（楽しみ方なし）は両方として読める', () => {
    localStorage.setItem('schedule-app-profile', JSON.stringify({ nickname: 'たろう', grade: '高2', university: '慶應', faculty: '環境情報学部', department: '' }))
    expect(loadProfile().playMode).toBe('both')
  })
})
