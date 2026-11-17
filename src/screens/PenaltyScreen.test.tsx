import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { todayStr } from '../lib/progress'
import { addDays } from '../lib/dayplan'
import PenaltyScreen from './PenaltyScreen'

beforeEach(async () => {
  localStorage.clear()
  await db.penalties.clear()
})

describe('PenaltyScreen', () => {
  it('shows penalty page', async () => {
    render(<PenaltyScreen onBack={() => {}} />)
    expect(await screen.findByTestId('penalty-page')).toBeInTheDocument()
  })

  it('shows debt for b1', async () => {
    await db.penalties.add({
      id: '2026-11-14',
      date: '2026-11-14',
      missingBookIds: ['b1'],
      pageDebt: 20,
      unitDebt: {},
      points: 10,
      severity: 'normal',
      createdAt: new Date().toISOString(),
    })
    render(<PenaltyScreen onBack={() => {}} />)
    const debt = await screen.findByTestId('penalty-debt-b1')
    expect(debt).toHaveTextContent('20')
  })

  it('shows history for 2026-11-14', async () => {
    await db.penalties.add({
      id: '2026-11-14',
      date: '2026-11-14',
      missingBookIds: ['b1'],
      pageDebt: 20,
      unitDebt: {},
      points: 10,
      severity: 'normal',
      createdAt: new Date().toISOString(),
    })
    render(<PenaltyScreen onBack={() => {}} />)
    expect(await screen.findByTestId('penalty-history-2026-11-14')).toBeInTheDocument()
  })

  it('history is sorted desc', async () => {
    for (const d of ['2026-11-13', '2026-11-14', '2026-11-15']) {
      await db.penalties.add({
        id: d,
        date: d,
        missingBookIds: ['b1'],
        pageDebt: 10,
        unitDebt: {},
        points: 10,
        severity: 'normal',
        createdAt: new Date().toISOString(),
      })
    }
    render(<PenaltyScreen onBack={() => {}} />)
    await screen.findByTestId('penalty-history-2026-11-15')
    const all = screen.getAllByTestId(/penalty-history-/)
    const dates = all.map((el) => el.getAttribute('data-testid')?.replace('penalty-history-', ''))
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('複数本の借金合計はその日のpageDebtと一致する', async () => {
    await db.penalties.add({
      id: '2026-11-13',
      date: '2026-11-13',
      missingBookIds: ['b1', 'b2'],
      pageDebt: 50,
      unitDebt: {},
      points: 20,
      severity: 'normal',
      createdAt: new Date().toISOString(),
    })
    render(<PenaltyScreen onBack={() => {}} />)
    const d1 = await screen.findByTestId('penalty-debt-b1')
    const d2 = await screen.findByTestId('penalty-debt-b2')
    const num = (el: HTMLElement) => Number((el.textContent ?? '').match(/(\d+)ページ/)?.[1] ?? NaN)
    expect(num(d1) + num(d2)).toBe(50)
  })

  it('集計は直近7日に寄せる(Homeと一致: 古い借金は合計外・履歴は残る)', async () => {
    const today = todayStr()
    const yesterday = addDays(today, -1)
    const old = addDays(today, -10)
    const isoNow = new Date().toISOString()
    await db.penalties.add({
      id: yesterday,
      date: yesterday,
      missingBookIds: ['b1'],
      pageDebt: 20,
      unitDebt: {},
      points: 10,
      severity: 'normal',
      createdAt: isoNow,
    })
    await db.penalties.add({
      id: old,
      date: old,
      missingBookIds: ['b1'],
      pageDebt: 100,
      unitDebt: {},
      points: 10,
      severity: 'normal',
      createdAt: isoNow,
    })
    render(<PenaltyScreen onBack={() => {}} />)
    // 非同期読み込み完了を待ってから集計文言を検証する
    expect(await screen.findByTestId(`penalty-history-${yesterday}`)).toBeInTheDocument()
    const page = await screen.findByTestId('penalty-page')
    expect(page).toHaveTextContent('借金 20ページ')
    // 履歴自体は全期間表示のまま
    expect(await screen.findByTestId(`penalty-history-${old}`)).toBeInTheDocument()
  })

  it('changing severity to strict reflects setPenaltySettings', async () => {
    const { getPenaltySettings } = await import('../data/penaltyStore')
    render(<PenaltyScreen onBack={() => {}} />)
    const select = (await screen.findByTestId('penalty-severity-select')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'strict' } })
    expect(getPenaltySettings().severity).toBe('strict')
  })

  it('back click calls onBack', async () => {
    const onBack = vi.fn()
    render(<PenaltyScreen onBack={onBack} />)
    fireEvent.click(await screen.findByTestId('penalty-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('banner toggle flips enabledBanner', async () => {
    const { getPenaltySettings, setPenaltySettings } = await import('../data/penaltyStore')
    setPenaltySettings({ severity: 'normal', enabledBanner: true })
    render(<PenaltyScreen onBack={() => {}} />)
    const toggle = (await screen.findByTestId('penalty-banner-toggle')) as HTMLInputElement
    expect(getPenaltySettings().enabledBanner).toBe(true)
    fireEvent.click(toggle)
    expect(getPenaltySettings().enabledBanner).toBe(false)
  })
})
