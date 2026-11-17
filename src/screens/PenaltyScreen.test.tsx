import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
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
