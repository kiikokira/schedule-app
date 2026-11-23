import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'

export type CarouselProps = {
  itemCount: number
  renderItem: (index: number) => ReactNode
  autoPlayIntervalMs?: number
  ariaLabel?: string
  onIndexChange?: (index: number) => void
}

const DEFAULT_AUTOPLAY_INTERVAL_MS = 5000
const SWIPE_THRESHOLD_PX = 30

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  } catch {
    return false
  }
}

export default function Carousel({
  itemCount,
  renderItem,
  autoPlayIntervalMs = DEFAULT_AUTOPLAY_INTERVAL_MS,
  ariaLabel,
  onIndexChange,
}: CarouselProps) {
  const [index, setIndex] = useState(0)
  const [stops, setStops] = useState({ hover: false, focus: false, touch: false })
  const [reducedMotion] = useState(prefersReducedMotion)
  const indexRef = useRef(0)
  const onIndexChangeRef = useRef(onIndexChange)
  const touchStartX = useRef<number | null>(null)
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange
  }, [onIndexChange])

  const showControls = itemCount > 1
  const paused = stops.hover || stops.focus || stops.touch

  const goTo = useCallback(
    (next: number) => {
      const target = itemCount > 0 ? ((next % itemCount) + itemCount) % itemCount : 0
      indexRef.current = target
      setIndex(target)
      onIndexChangeRef.current?.(target)
    },
    [itemCount],
  )

  useEffect(() => {
    if (!showControls || paused || reducedMotion) return undefined
    const timer = window.setInterval(() => {
      goTo(indexRef.current + 1)
    }, autoPlayIntervalMs)
    return () => window.clearInterval(timer)
  }, [showControls, paused, reducedMotion, autoPlayIntervalMs, goTo])

  const stop = (key: 'hover' | 'focus' | 'touch', value: boolean) =>
    setStops((prev) => ({ ...prev, [key]: value }))

  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
    stop('touch', true)
  }

  const finishTouch = (event: ReactTouchEvent<HTMLElement>) => {
    const start = touchStartX.current
    const end = event.changedTouches[0]?.clientX ?? null
    touchStartX.current = null
    if (start !== null && end !== null && showControls) {
      const dx = end - start
      if (dx <= -SWIPE_THRESHOLD_PX) goTo(indexRef.current + 1)
      else if (dx >= SWIPE_THRESHOLD_PX) goTo(indexRef.current - 1)
    }
    stop('touch', false)
  }

  const slides = Array.from({ length: Math.max(itemCount, 0) }, (_, i) => i)

  return (
    <section
      data-testid="carousel"
      className="carousel"
      aria-label={ariaLabel}
      style={{ position: 'relative', maxWidth: '100%', overflow: 'hidden' }}
      onMouseEnter={() => stop('hover', true)}
      onMouseLeave={() => stop('hover', false)}
      onFocus={() => stop('focus', true)}
      onBlur={() => stop('focus', false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={finishTouch}
      onTouchCancel={() => {
        touchStartX.current = null
        stop('touch', false)
      }}
    >
      <div className="carousel-viewport" style={{ overflow: 'hidden', maxWidth: '100%' }}>
        <div
          className="carousel-track"
          style={{
            display: 'flex',
            transform: `translateX(-${index * 100}%)`,
            transition: reducedMotion ? 'none' : 'transform 0.3s ease',
          }}
        >
          {slides.map((i) => (
            <div
              key={i}
              className="carousel-slide"
              style={{ flex: '0 0 100%', minWidth: '100%' }}
              aria-hidden={i !== index}
            >
              {renderItem(i)}
            </div>
          ))}
        </div>
      </div>
      {showControls && (
        <>
          <button
            type="button"
            className="carousel-prev"
            data-testid="carousel-prev"
            aria-label="前へ"
            onClick={() => goTo(indexRef.current - 1)}
          >
            ←
          </button>
          <button
            type="button"
            className="carousel-next"
            data-testid="carousel-next"
            aria-label="次へ"
            onClick={() => goTo(indexRef.current + 1)}
          >
            →
          </button>
          <div className="carousel-dots">
            {slides.map((i) => (
              <button
                key={i}
                type="button"
                className="carousel-dot"
                data-testid={`carousel-dot-${i}`}
                aria-label={`${i + 1}枚目に移動`}
                aria-selected={i === index}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
