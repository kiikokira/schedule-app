import { describe, it, expect } from 'vitest'
import { formalUniversityName } from './universities'

describe('formalUniversityName', () => {
  it('慶應を慶應義塾大学に変換する', () => {
    expect(formalUniversityName('慶應')).toBe('慶應義塾大学')
  })

  it('既に正式名称ならそのまま返す', () => {
    expect(formalUniversityName('慶應義塾大学')).toBe('慶應義塾大学')
  })

  it('その他の大学はそのまま返す', () => {
    expect(formalUniversityName('早稲田')).toBe('早稲田')
  })
})
