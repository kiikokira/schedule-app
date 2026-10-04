import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SchoolScreen from './SchoolScreen'

describe('SchoolScreen', () => {
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
})
