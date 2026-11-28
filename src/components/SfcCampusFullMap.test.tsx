import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SfcCampusFullMap from './SfcCampusFullMap'
import { HOTSPOTS, MAP_H, MAP_W } from '../lib/sfcCampusMap'

function fakeCtx() {
  const fn = vi.fn()
  return {
    clearRect: fn, drawImage: fn, save: fn, restore: fn, fillRect: fn,
    beginPath: fn, arc: fn, fill: fn, stroke: fn, rect: fn, roundRect: fn,
    strokeRect: fn, moveTo: fn, lineTo: fn, closePath: fn, fillText: fn,
    strokeText: fn, scale: fn, translate: fn, setTransform: fn,
    measureText: vi.fn(() => ({ width: 8 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineWidth: 1, imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx())
})

describe('SfcCampusFullMap', () => {
  it('shows the terrain canvas, the player and the hotspots', () => {
    render(<SfcCampusFullMap playerX={MAP_W / 2} playerY={MAP_H / 4} onClose={() => {}} />)
    expect(screen.getByTestId('sfc-full-map-canvas')).toBeInTheDocument()
    const player = screen.getByTestId('sfc-full-map-player')
    expect(player.style.left).toBe('50%')
    expect(player.style.top).toBe('25%')
    expect(screen.getAllByTestId('sfc-full-map-hotspot')).toHaveLength(HOTSPOTS.length)
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<SfcCampusFullMap playerX={0} playerY={0} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('sfc-map-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
