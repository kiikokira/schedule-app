import { describe, it, expect } from 'vitest'
import { formalUniversityName, facultiesFor, LOCAL_UNIVERSITIES, FACULTIES_BY_UNIV } from './universities'

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

describe('facultiesFor（実在学部のみ）', () => {
  it('駒澤に存在しない農学部・情報学部を含まない', () => {
    const f = facultiesFor('駒澤')
    expect(f).not.toContain('農学部')
    expect(f).not.toContain('情報学部')
    expect(f).toContain('仏教学部')
  })

  it('高知は旧名の農学部・存在しない国際学部ではなく農林海洋科学部を使う', () => {
    const f = facultiesFor('高知')
    expect(f).not.toContain('農学部')
    expect(f).not.toContain('国際学部')
    expect(f).toContain('農林海洋科学部')
  })

  it('日大に存在しない総合科学部を含まない', () => {
    expect(facultiesFor('日大')).not.toContain('総合科学部')
  })

  it('全ての地方大学が実在学部マスタに登録されている', () => {
    for (const u of LOCAL_UNIVERSITIES) {
      expect(FACULTIES_BY_UNIV[u]).toBeDefined()
      expect(facultiesFor(u).length).toBeGreaterThan(0)
    }
  })
})
