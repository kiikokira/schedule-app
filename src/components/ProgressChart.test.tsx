import { describe, it, expect } from 'vitest'
import { buildProgressChartConfig } from './ProgressChart'

describe('buildProgressChartConfig', () => {
  it('点とタップ判定を大きくしてスマホで当たりやすくする', () => {
    const { dataset, options } = buildProgressChartConfig(['2026-10-13', '2026-10-14'], [0, 10])
    expect(dataset.pointRadius).toBeGreaterThanOrEqual(5)
    expect(dataset.pointHitRadius).toBeGreaterThanOrEqual(20)
    expect(dataset.pointHoverRadius).toBeGreaterThanOrEqual(7)
    expect(options.interaction?.mode).toBe('nearest')
    expect(options.interaction?.intersect).toBe(false)
  })

  it('ツールチップにページ数を分かりやすく表示する', () => {
    const { options } = buildProgressChartConfig(['2026-10-13'], [10])
    const label = (options.plugins?.tooltip as any)?.callbacks?.label as ((c: { parsed: { y: number } }) => string) | undefined
    expect(label).toBeDefined()
    expect(label!({ parsed: { y: 10 } })).toContain('10ページ')
  })
})
