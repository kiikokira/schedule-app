import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import Carousel from './Carousel'

afterEach(() => {
  vi.useRealTimers()
})

describe('Carousel', () => {
  it('shows first item with arrows and dots', () => {
    render(<Carousel itemCount={3} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={10000} />)
    expect(screen.getByTestId('carousel')).toBeInTheDocument()
    expect(screen.getByText('card-0')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-prev')).toHaveAttribute('aria-label', '前へ')
    expect(screen.getByTestId('carousel-next')).toHaveAttribute('aria-label', '次へ')
    expect(screen.getByTestId('carousel-dot-0')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('carousel-dot-1')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('carousel-dot-1')).toHaveAttribute('aria-label', '2枚目に移動')
    fireEvent.click(screen.getByTestId('carousel-next'))
    expect(screen.getByText('card-1')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-dot-1')).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByTestId('carousel-dot-2'))
    expect(screen.getByText('card-2')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-dot-2')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('carousel-dot-0')).toHaveAttribute('aria-selected', 'false')
  })

  it('auto-plays and loops with fake timers', () => {
    vi.useFakeTimers()
    render(<Carousel itemCount={2} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={5000} />)
    expect(screen.getByText('card-0')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-dot-0')).toHaveAttribute('aria-selected', 'true')
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('card-1')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-dot-1')).toHaveAttribute('aria-selected', 'true')
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('card-0')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-dot-0')).toHaveAttribute('aria-selected', 'true')
  })

  it('moves on swipe left and right', () => {
    render(<Carousel itemCount={3} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={10000} />)
    const region = screen.getByTestId('carousel')
    fireEvent.touchStart(region, { touches: [{ clientX: 100 }] })
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 40 }] })
    expect(screen.getByText('card-1')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-dot-1')).toHaveAttribute('aria-selected', 'true')
    fireEvent.touchStart(region, { touches: [{ clientX: 40 }] })
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 100 }] })
    expect(screen.getByText('card-0')).toBeInTheDocument()
    expect(screen.getByTestId('carousel-dot-0')).toHaveAttribute('aria-selected', 'true')
  })

  it('hides controls for a single item', () => {
    render(<Carousel itemCount={1} renderItem={() => <div>only</div>} />)
    expect(screen.getByText('only')).toBeInTheDocument()
    expect(screen.queryByTestId('carousel-prev')).not.toBeInTheDocument()
    expect(screen.queryByTestId('carousel-dot-0')).not.toBeInTheDocument()
  })

  it('clears timer on unmount without warnings', () => {
    vi.useFakeTimers()
    const { unmount } = render(
      <Carousel itemCount={2} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={1000} />,
    )
    unmount()
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
  })

  it('wraps around when arrows are spammed and reports each index change', () => {
    const onIndexChange = vi.fn()
    render(
      <Carousel
        itemCount={3}
        renderItem={(i) => <div>card-{i}</div>}
        autoPlayIntervalMs={10000}
        onIndexChange={onIndexChange}
      />,
    )
    fireEvent.click(screen.getByTestId('carousel-prev'))
    expect(screen.getByTestId('carousel-dot-2')).toHaveAttribute('aria-selected', 'true')
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByTestId('carousel-next'))
    }
    expect(screen.getByTestId('carousel-dot-0')).toHaveAttribute('aria-selected', 'true')
    expect(onIndexChange).toHaveBeenLastCalledWith(0)
    expect(onIndexChange).not.toHaveBeenCalledWith(-1)
    expect(onIndexChange).not.toHaveBeenCalledWith(3)
  })

  it('reconciles active index when itemCount shrinks so the single card shows', () => {
    const { rerender } = render(
      <Carousel itemCount={4} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={10000} />,
    )
    fireEvent.click(screen.getByTestId('carousel-dot-3'))
    expect(screen.getByText('card-3')).toBeInTheDocument()
    rerender(<Carousel itemCount={1} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={10000} />)
    expect(screen.getByText('card-0')).toBeInTheDocument()
    expect(screen.queryByTestId('carousel-dot-0')).not.toBeInTheDocument()
    // 縮小前のindex(3)のままだとスライド0がaria-hidden=true・trackが-300%のまま空白になる
    expect(screen.getByText('card-0').closest('.carousel-slide')).toHaveAttribute('aria-hidden', 'false')
    expect(document.querySelector('.carousel-track')).toHaveStyle({ transform: 'translateX(-0%)' })
  })

  it('places arrows in a controls row below the card, not over the content', () => {
    render(<Carousel itemCount={3} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={10000} />)
    const controls = screen.getByTestId('carousel-controls')
    expect(controls).toContainElement(screen.getByTestId('carousel-prev'))
    expect(controls).toContainElement(screen.getByTestId('carousel-next'))
    expect(controls).toContainElement(screen.getByTestId('carousel-dot-0'))
  })
  it('keeps buttons out of the viewport', () => {
    render(<Carousel itemCount={3} renderItem={(i) => <div>card-{i}</div>} autoPlayIntervalMs={10000} />)
    expect(within(screen.getByTestId('carousel-viewport')).queryByRole('button')).not.toBeInTheDocument()
  })
})
