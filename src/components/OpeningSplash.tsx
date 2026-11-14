import { useEffect } from 'react'

export const OPENING_DURATION_MS = 5000

type OpeningSplashProps = {
  onDone: () => void
}

function isReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function OpeningSplash({ onDone }: OpeningSplashProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (isReducedMotion()) {
      onDone()
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
    const timer = setTimeout(onDone, OPENING_DURATION_MS)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
  }, [onDone])

  return (
    <div
      data-testid="keio-opening"
      className="keio-opening"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'all' }}
      role="presentation"
      aria-hidden="true"
    >
      <div className="keio-opening-pens">
        <svg
          data-testid="keio-opening-pen-left"
          className="keio-opening-pen keio-opening-pen-left"
          viewBox="0 0 60 220"
          width="60"
          height="220"
        >
          <rect x="20" y="8" width="20" height="140" rx="6" fill="#F2C200" />
          <rect x="20" y="8" width="20" height="26" rx="6" fill="#C79A00" />
          <polygon points="20,148 40,148 30,200" fill="#F2C200" />
          <polygon points="26,168 34,168 30,200" fill="#1c2330" />
          <circle cx="30" cy="200" r="3" fill="#1c2330" />
        </svg>
        <svg
          data-testid="keio-opening-pen-right"
          className="keio-opening-pen keio-opening-pen-right"
          viewBox="0 0 60 220"
          width="60"
          height="220"
        >
          <rect x="20" y="8" width="20" height="140" rx="6" fill="#F2C200" />
          <rect x="20" y="8" width="20" height="26" rx="6" fill="#C79A00" />
          <polygon points="20,148 40,148 30,200" fill="#F2C200" />
          <polygon points="26,168 34,168 30,200" fill="#1c2330" />
          <circle cx="30" cy="200" r="3" fill="#1c2330" />
        </svg>
      </div>
    </div>
  )
}
