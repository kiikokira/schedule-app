import { describe, expect, it } from 'vitest'
import { pagesToExp, levelForExp, comboMultiplier } from './seasonExp'

describe('seasonExp', () => {
  it('10ページ=100EXP基準、連続で倍率', () => {
    expect(pagesToExp(10, 0)).toBe(100)
    expect(pagesToExp(10, 7)).toBe(150)
  })
  it('レベルは1000EXPごと', () => {
    expect(levelForExp(0)).toBe(1)
    expect(levelForExp(1000)).toBe(2)
  })
  it('コンボ倍率は3日1.2・7日1.5', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(3)).toBe(1.2)
    expect(comboMultiplier(7)).toBe(1.5)
  })
})
