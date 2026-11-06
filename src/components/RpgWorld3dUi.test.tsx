import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RpgAdventure from './RpgAdventure'

beforeEach(() => {
  localStorage.clear()
})

describe('RpgWorld3d view controls', () => {
  it('toggles expanded canvas size', () => {
    render(<RpgAdventure level={15} token="🌱" />)
    expect(screen.getByTestId('rpg-3d-canvas')).toHaveAttribute('data-expanded', 'false')
    fireEvent.click(screen.getByTestId('rpg-3d-expand'))
    expect(screen.getByTestId('rpg-3d-expand')).toHaveTextContent('標準にもどす')
    expect(screen.getByTestId('rpg-3d-canvas')).toHaveAttribute('data-expanded', 'true')
    fireEvent.click(screen.getByTestId('rpg-3d-expand'))
    expect(screen.getByTestId('rpg-3d-canvas')).toHaveAttribute('data-expanded', 'false')
  })

  it('hides the stage button when the current node has no stage', () => {
    render(<RpgAdventure level={15} token="🌱" />)
    // 初期ノードn0にステージはないため決定ボタンは表示されない
    expect(screen.getByTestId('rpg-world3d')).toHaveAttribute('data-node', 'n0')
    expect(screen.queryByTestId('rpg-3d-decide')).toBeNull()
  })

  it('shows W1 strict progress legend and next stage', () => {
    render(<RpgAdventure level={5} token="🌱" />)
    expect(screen.getByTestId('rpg-w1-legend')).toHaveTextContent('ロック中')
    expect(screen.getByTestId('rpg-w1-progress')).toHaveTextContent('村入口の広場')
  })

  it('shows W1 pad legend for circular stops', () => {
    render(<RpgAdventure level={5} token="🌱" />)
    expect(screen.getByTestId('rpg-w1-legend')).toHaveTextContent('青円')
  })

  it('shows yellow-ring legend for W1 v3', () => {
    render(<RpgAdventure level={5} token="🌱" />)
    const legend = screen.getByTestId('w1-legend')
    expect(legend).toHaveTextContent('青黄')
    expect(legend).toHaveTextContent('赤黄')
    expect(legend).toHaveTextContent('黒黄')
    expect(legend).toHaveTextContent('半透明')
  })
})
