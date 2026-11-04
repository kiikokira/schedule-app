import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { WORLD_DEFS } from '../lib/rpgWorlds'
import RpgWorldSelect from './RpgWorldSelect'
import RpgAdventure from './RpgAdventure'

afterEach(() => {
  vi.useRealTimers()
})

describe('RpgWorldSelect', () => {
  it('shows 9 world cards and locks the unreached ones', () => {
    const onSelect = vi.fn()
    render(<RpgWorldSelect worlds={WORLD_DEFS} unlocked={1} selected={1} onSelect={onSelect} disabled={false} />)
    expect(screen.getByTestId('rpg-world-select')).toBeInTheDocument()
    for (let id = 1; id <= 9; id++) {
      expect(screen.getByTestId(`rpg-world-card-${id}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('rpg-world-card-2')).toHaveAttribute('data-locked', 'true')
    fireEvent.click(screen.getByTestId('rpg-world-card-2'))
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('rpg-world-card-1'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})

describe('RpgAdventure', () => {
  it('shows the 3D world by default without the 2D map or manual buttons', () => {
    render(<RpgAdventure level={15} token="🌱" />)
    expect(screen.getByTestId('rpg-world3d')).toBeInTheDocument()
    expect(screen.queryByTestId('rpg-map')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rpg-play')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rpg-3d-open')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rpg-grass-open')).not.toBeInTheDocument()
  })

  it('spins once and then enters the selected world in 3D', () => {
    vi.useFakeTimers()
    render(<RpgAdventure level={15} token="🌱" />)
    fireEvent.click(screen.getByTestId('rpg-world-card-1'))
    expect(screen.getByTestId('rpg-entering')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByTestId('rpg-world3d')).toBeInTheDocument()
  })

  it.each([
    [1, 3], [2, 13], [3, 23], [4, 33], [5, 43], [6, 53], [7, 63], [8, 73], [9, 83],
  ])('renders the 3D view directly for level %i (world %i)', (_world, level) => {
    const { unmount } = render(<RpgAdventure level={level} token="🌱" />)
    expect(screen.getByTestId('rpg-world3d')).toBeInTheDocument()
    expect(screen.queryByTestId('rpg-map')).not.toBeInTheDocument()
    unmount()
  })
})
