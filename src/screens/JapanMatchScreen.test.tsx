import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import JapanMatchScreen from './JapanMatchScreen'
import { db } from '../db/database'

describe('JapanMatchScreen', () => {
  beforeEach(async () => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    localStorage.clear()
    await db.availability.clear()
  })
  it('shows the page with the next match and countdown', () => {
    render(<JapanMatchScreen onBack={() => {}} today="2026-10-05" />)
    expect(screen.getByTestId('japan-page')).toBeInTheDocument()
    expect(screen.getByTestId('japan-next')).toHaveTextContent('ニュージーランド')
    expect(screen.getByTestId('japan-next')).toHaveTextContent('今日')
  })
  it('counts down to the Brazil match', () => {
    render(<JapanMatchScreen onBack={() => {}} today="2026-10-05" />)
    expect(screen.getByTestId('japan-match-2026-11-14-vs-brazil')).toHaveTextContent('あと40日')
  })
  it('watch blocks the match window and restore brings it back', async () => {
    await db.availability.add({ id: 'd1', weekday: null, date: '2026-11-14', start: '19:00', end: '22:00' })
    render(<JapanMatchScreen onBack={() => {}} today="2026-10-05" />)
    fireEvent.click(screen.getByTestId('japan-watch-2026-11-14-vs-brazil'))
    expect(await screen.findByTestId('japan-blocked-2026-11-14-vs-brazil')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('japan-restore-2026-11-14-vs-brazil'))
    expect(await screen.findByTestId('japan-watch-2026-11-14-vs-brazil')).toBeInTheDocument()
  })
  it('calls onBack when the back button is tapped', () => {
    const onBack = vi.fn()
    render(<JapanMatchScreen onBack={onBack} today="2026-10-05" />)
    fireEvent.click(screen.getByTestId('japan-back'))
    expect(onBack).toHaveBeenCalled()
  })
  it('hides past matches when today is after all fixtures', () => {
    render(<JapanMatchScreen onBack={() => {}} today="2026-12-01" />)
    expect(screen.queryByTestId('japan-match-2026-11-14-vs-brazil')).toBeNull()
    expect(screen.queryByTestId('japan-next')).toBeNull()
  })
})
