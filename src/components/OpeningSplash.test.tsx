import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import OpeningSplash from './OpeningSplash'

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('OpeningSplash', () => {
  it('calls onDone after 5s and blocks pointer events', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<OpeningSplash onDone={onDone} />)
    const overlay = screen.getByTestId('keio-opening')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveStyle({ pointerEvents: 'all' })
    expect(screen.getByTestId('keio-opening-canvas')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(4999) })
    expect(onDone).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('respects reduced motion by finishing immediately', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })
    const onDone = vi.fn()
    render(<OpeningSplash onDone={onDone} />)
    expect(screen.getByTestId('keio-opening')).toBeInTheDocument()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
