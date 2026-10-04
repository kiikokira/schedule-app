import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SchoolScreen from './SchoolScreen'

describe('SchoolScreen', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })
  it('shows the October and March month sections', () => {
    render(<SchoolScreen onBack={() => {}} />)
    expect(screen.getByTestId('school-page')).toBeInTheDocument()
    expect(screen.getByTestId('school-month-10')).toBeInTheDocument()
    expect(screen.getByTestId('school-month-3')).toBeInTheDocument()
    expect(screen.getByTestId('school-month-10')).toHaveTextContent('10月')
    expect(screen.getByTestId('school-month-3')).toHaveTextContent('3月')
  })

  it('calls onBack when the back button is tapped', () => {
    const onBack = vi.fn()
    render(<SchoolScreen onBack={onBack} />)
    fireEvent.click(screen.getByTestId('school-back'))
    expect(onBack).toHaveBeenCalled()
  })

  it('renders exam events in red', () => {
    render(<SchoolScreen onBack={() => {}} />)
    expect(screen.getByTestId('school-event-10-8-0')).toHaveStyle({ color: '#c02727' })
  })

  it('renders month headers as navy bars with white text', () => {
    render(<SchoolScreen onBack={() => {}} />)
    const header = screen.getByTestId('school-month-10').querySelector('h2')
    expect(header).toHaveStyle({ backgroundColor: '#1e3a8a', color: '#fff' })
  })

  it('shows school event dates with weekday', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-05" />)
    expect(screen.getByText('10月1日（木）')).toBeInTheDocument()
    expect(screen.getByText('2月10日（水）')).toBeInTheDocument()
  })

  it('mounts scrolled to top so the list starts from the top', () => {
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    render(<SchoolScreen onBack={() => {}} today="2026-10-05" />)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('marks the row matching today with a badge', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-08" />)
    expect(within(screen.getByTestId('school-event-10-8-0')).getByText('今日')).toBeInTheDocument()
    expect(within(screen.getByTestId('school-event-10-9-0')).queryByText('今日')).not.toBeInTheDocument()
  })

  it('marks every row when multiple events share today', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-11-04" />)
    expect(within(screen.getByTestId('school-event-11-4-0')).getByText('今日')).toBeInTheDocument()
    expect(within(screen.getByTestId('school-event-11-4-1')).getByText('今日')).toBeInTheDocument()
  })

  it('shows no marker on days without events', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-02" />)
    expect(screen.queryByText('今日')).not.toBeInTheDocument()
  })

  it('shows today date line under the title', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-04" />)
    expect(screen.getByTestId('school-today-line')).toHaveTextContent('10月4日')
  })

  it('marks the current month section', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-04" />)
    expect(within(screen.getByTestId('school-month-10')).getByText('今月')).toBeInTheDocument()
    expect(within(screen.getByTestId('school-month-11')).queryByText('今月')).not.toBeInTheDocument()
  })

  it('shows the today line even outside the covered months', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-07-01" />)
    expect(screen.getByTestId('school-today-line')).toHaveTextContent('7月1日')
    expect(screen.queryByText('今月')).not.toBeInTheDocument()
  })

  it('jump button scrolls to today event row', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-08" />)
    const row = screen.getByTestId('school-event-10-8-0') as HTMLElement
    const spy = vi.fn()
    row.scrollIntoView = spy
    fireEvent.click(screen.getByTestId('school-jump-today'))
    expect(spy).toHaveBeenCalled()
  })

  it('jump button scrolls to the month section when today has no events', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-04" />)
    const month = screen.getByTestId('school-month-10')
    const spy = vi.fn()
    ;(month as HTMLElement).scrollIntoView = spy
    fireEvent.click(screen.getByTestId('school-jump-today'))
    expect(spy).toHaveBeenCalled()
  })

  it('jump button is hidden outside the covered months', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-07-01" />)
    expect(screen.queryByTestId('school-jump-today')).not.toBeInTheDocument()
  })
})
