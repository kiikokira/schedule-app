import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SfcCampusRpg from './SfcCampusRpg'

// jsdom は touch-action を computed style に反映しないため、テスト内だけで
// inline style の touchAction を getComputedStyle に橋渡しする。
{
  const original = window.getComputedStyle
  window.getComputedStyle = function (element: Element, pseudoElt?: string | null): CSSStyleDeclaration {
    const declaration = original.call(window, element, pseudoElt)
    const touchAction = element instanceof HTMLElement ? element.style.touchAction : ''
    if (touchAction && !Object.prototype.hasOwnProperty.call(declaration, 'touchAction')) {
      Object.defineProperty(declaration, 'touchAction', { value: touchAction, configurable: true })
    }
    return declaration
  }
}

vi.mock('./SfcCampusCanvas', () => ({
  default: () => <div data-testid="sfc-campus-canvas" />,
}))

const base = {
  level: 3, title: '街の守り手', expInLevel: 250, todayPages: 12, totalPages: 3456,
  slots: [], slotsDone: false, bulletin: '入試まで100日',
  onOpenToday: vi.fn(), onOpenBook: vi.fn(),
}

describe('SfcCampusRpg', () => {
  it('shows the HUD and the map', () => {
    render(<SfcCampusRpg {...base} />)
    expect(screen.getByTestId('sfc-hud-level')).toHaveTextContent('Lv.3')
    expect(screen.getByTestId('sfc-hud-exp')).toHaveTextContent('250')
    expect(screen.getByTestId('sfc-hud-pages')).toHaveTextContent('12')
    expect(screen.getByTestId('sfc-campus-canvas')).toBeInTheDocument()
  })
  it('opens the quest panel with at most 4 slots', () => {
    const slots = [1, 2, 3, 4, 5].map((n) => ({ title: `本${n}`, bookId: `b${n}` }))
    render(<SfcCampusRpg {...base} slots={slots} />)
    fireEvent.click(screen.getByTestId('sfc-quest-button'))
    expect(screen.getByTestId('campus-slots').children.length).toBe(4)
  })
  it('shows the empty state and opens today', () => {
    const onOpenToday = vi.fn()
    render(<SfcCampusRpg {...base} onOpenToday={onOpenToday} />)
    fireEvent.click(screen.getByTestId('sfc-quest-button'))
    expect(screen.getByTestId('campus-empty')).toHaveTextContent('図書館')
    fireEvent.click(screen.getByText('今日の計画を開く'))
    expect(onOpenToday).toHaveBeenCalled()
  })
  it('shows the celebration when all slots are done', () => {
    render(<SfcCampusRpg {...base} slotsDone />)
    fireEvent.click(screen.getByTestId('sfc-quest-button'))
    expect(screen.getByTestId('campus-done')).toHaveTextContent('全完了')
  })
  it('opens a book or today from a slot', () => {
    const onOpenBook = vi.fn()
    const onOpenToday = vi.fn()
    render(
      <SfcCampusRpg
        {...base}
        slots={[{ title: '本A', bookId: 'b1' }, { title: '学習', bookId: null }]}
        onOpenBook={onOpenBook}
        onOpenToday={onOpenToday}
      />,
    )
    fireEvent.click(screen.getByTestId('sfc-quest-button'))
    fireEvent.click(screen.getByTestId('campus-slot-0'))
    expect(onOpenBook).toHaveBeenCalledWith('b1')
    fireEvent.click(screen.getByTestId('campus-slot-1'))
    expect(onOpenToday).toHaveBeenCalled()
  })
  it('opens the full map overlay with building names', () => {
    render(<SfcCampusRpg {...base} />)
    fireEvent.click(screen.getByTestId('sfc-map-button'))
    expect(screen.getByTestId('sfc-map-overlay')).toHaveTextContent('Α本館')
    expect(screen.getByTestId('sfc-map-overlay')).toHaveTextContent('鴨池')
  })
  it('does not render the old 3D RPG', () => {
    render(<SfcCampusRpg {...base} />)
    expect(screen.queryByTestId('rpg-3d-canvas')).toBeNull()
    expect(screen.queryByTestId('rpg-hero')).toBeNull()
  })
  it('renders touch-safe 44px D-pad buttons', () => {
    render(<SfcCampusRpg {...base} />)
    expect(screen.getByTestId('sfc-dpad-up')).toHaveStyle({ touchAction: 'none', width: '44px', height: '44px' })
    expect(screen.getByTestId('sfc-dpad-left')).toHaveStyle({ touchAction: 'none' })
  })
})
