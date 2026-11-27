import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SfcCampusCanvas from './SfcCampusCanvas'

function fakeCtx() {
  const fn = vi.fn()
  return {
    save: fn, restore: fn, setTransform: fn, clearRect: fn, drawImage: fn,
    fillRect: fn, beginPath: fn, arc: fn, fill: fn, stroke: fn, rect: fn, roundRect: fn, strokeRect: fn,
    moveTo: fn, lineTo: fn, closePath: fn, fillText: fn, strokeText: fn,
    scale: fn, translate: fn, setLineDash: fn,
    measureText: vi.fn(() => ({ width: 8 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineWidth: 1, imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx())
})

describe('SfcCampusCanvas', () => {
  it('renders the map canvas', () => {
    const padRef = { current: { dx: 0, dy: 0 } }
    render(<SfcCampusCanvas padRef={padRef as never} />)
    expect(screen.getByTestId('sfc-campus-canvas')).toBeInTheDocument()
  })
})
