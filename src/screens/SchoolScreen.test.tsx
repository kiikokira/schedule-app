import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SchoolScreen from './SchoolScreen'

describe('SchoolScreen', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    document.querySelector('.app-header')?.remove()
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

  it('shows the date line only once when a day has multiple events', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-05" />)
    const first = screen.getByTestId('school-event-11-4-0')
    const second = screen.getByTestId('school-event-11-4-1')
    expect(first).toHaveTextContent('11月4日')
    expect(first).toHaveTextContent('英化週間')
    expect(second).not.toHaveTextContent('11月4日')
    expect(second).toHaveTextContent('校内選考')
  })

  it('marks every row when multiple events share today', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-11-04" />)
    expect(within(screen.getByTestId('school-event-11-4-0')).getByText('今日')).toBeInTheDocument()
    expect(within(screen.getByTestId('school-event-11-4-1')).getByText('今日')).toBeInTheDocument()
  })

  it('shows a today placeholder row on days without events', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-02" />)
    const row = screen.getByTestId('school-event-10-2-0')
    expect(within(row).getByText('今日')).toBeInTheDocument()
    expect(row).toHaveTextContent('予定なし')
  })

  it('places the today placeholder in chronological order', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-10-18" />)
    const month = screen.getByTestId('school-month-10')
    const ids = within(month)
      .getAllByTestId(/^school-event-10-/, { exact: false })
      .map((el) => el.getAttribute('data-testid'))
    const placeholder = ids.indexOf('school-event-10-18-0')
    expect(placeholder).toBeGreaterThan(-1)
    expect(ids.indexOf('school-event-10-17-0')).toBeLessThan(placeholder)
    expect(ids.indexOf('school-event-10-20-0')).toBeGreaterThan(placeholder)
    expect(screen.getByTestId('school-event-10-18-0')).toHaveTextContent('10月18日（日）')
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

  it('jump button scrolls to today event row just below the sticky header', () => {
    const headerEl = document.createElement('div')
    headerEl.className = 'app-header'
    document.body.appendChild(headerEl)
    render(<SchoolScreen onBack={() => {}} today="2026-10-08" />)
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    const row = screen.getByTestId('school-event-10-8-0') as HTMLElement
    vi.spyOn(headerEl, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 60 } as DOMRect)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 500 } as DOMRect)
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })
    fireEvent.click(screen.getByTestId('school-jump-today'))
    // 500 + 100 - 60(header) - 8(余白) = 532。block:'start'のままだとヘッダー裏に隠れる。
    expect(scrollTo).toHaveBeenCalledWith({ top: 532, behavior: 'smooth' })
  })

  it('jump button scrolls to the today placeholder row when today has no events', () => {
    const headerEl = document.createElement('div')
    headerEl.className = 'app-header'
    document.body.appendChild(headerEl)
    render(<SchoolScreen onBack={() => {}} today="2026-10-04" />)
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    const row = screen.getByTestId('school-event-10-4-0') as HTMLElement
    vi.spyOn(headerEl, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 60 } as DOMRect)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 400 } as DOMRect)
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    fireEvent.click(screen.getByTestId('school-jump-today'))
    expect(scrollTo).toHaveBeenCalledWith({ top: 332, behavior: 'smooth' })
  })

  it('jump button is hidden outside the covered months', () => {
    render(<SchoolScreen onBack={() => {}} today="2026-07-01" />)
    expect(screen.queryByTestId('school-jump-today')).not.toBeInTheDocument()
  })
})
