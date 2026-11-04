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
  it('shows the map of the level world by default', () => {
    render(<RpgAdventure level={15} token="🌱" />)
    expect(screen.getByTestId('rpg-map')).toHaveAttribute('data-world', '2')
    expect(screen.getByTestId('rpg-token')).toBeInTheDocument()
  })

  it('spins once and then enters the selected world', () => {
    vi.useFakeTimers()
    render(<RpgAdventure level={15} token="🌱" />)
    fireEvent.click(screen.getByTestId('rpg-world-card-1'))
    expect(screen.getByTestId('rpg-entering')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByTestId('rpg-map')).toHaveAttribute('data-world', '1')
  })

  it('advances the token to the target on manual play', () => {
    vi.useFakeTimers()
    render(<RpgAdventure level={3} token="🌱" />)
    fireEvent.click(screen.getByTestId('rpg-play'))
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByTestId('rpg-node-2')).toHaveAttribute('data-current', 'true')
    expect(screen.getByTestId('rpg-token')).toBeInTheDocument()
  })

  it('opens the explorable grass world from world 1', () => {
    render(<RpgAdventure level={3} token="🌱" />)
    fireEvent.click(screen.getByTestId('rpg-grass-open'))
    expect(screen.getByTestId('rpg-grass-map')).toBeInTheDocument()
    expect(screen.getByTestId('rpg-grass-pad')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rpg-grass-close'))
    expect(screen.getByTestId('rpg-map')).toBeInTheDocument()
  })

  it('opens the 3D grass world from world 1', () => {
    render(<RpgAdventure level={3} token="🌱" />)
    fireEvent.click(screen.getByTestId('rpg-3d-open'))
    expect(screen.getByTestId('rpg-world3d')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rpg-3d-close'))
    expect(screen.getByTestId('rpg-map')).toBeInTheDocument()
  })

  it('opens the 3D desert world from world 2', () => {
    render(<RpgAdventure level={13} token="🌱" />)
    fireEvent.click(screen.getByTestId('rpg-3d-open'))
    expect(screen.getByTestId('rpg-world3d')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rpg-3d-close'))
    expect(screen.getByTestId('rpg-map')).toBeInTheDocument()
  })
})
