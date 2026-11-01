import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WORLD_DEFS } from '../lib/rpgWorlds'
import RpgMap from './RpgMap'

afterEach(() => {
  vi.useRealTimers()
})

describe('RpgMap', () => {
  it('renders the map and the token on the node for the level', () => {
    render(<RpgMap world={WORLD_DEFS[0]} level={5} token="🌱" playing={null} />)
    expect(screen.getByTestId('rpg-map')).toBeInTheDocument()
    expect(screen.getByTestId('rpg-token')).toHaveTextContent('🌱')
    expect(screen.getByTestId('rpg-node-4')).toHaveAttribute('data-current', 'true')
  })

  it('keeps cleared nodes marked and shows the wooden W sign', () => {
    render(<RpgMap world={WORLD_DEFS[0]} level={5} token="🌱" playing={null} />)
    expect(screen.getByTestId('rpg-node-0')).toHaveAttribute('data-cleared', 'true')
    expect(screen.getByTestId('rpg-sign')).toHaveTextContent('W1')
  })

  it('marks ladder and jump edges with their kinds', () => {
    render(<RpgMap world={WORLD_DEFS[0]} level={5} token="🌱" playing={null} />)
    const world = WORLD_DEFS[0]
    const ladder = world.edges.find((e) => e.kind === 'ladder')!
    const jump = world.edges.find((e) => e.kind === 'jump')!
    expect(screen.getByTestId(`rpg-edge-${ladder.from}-${ladder.to}`)).toHaveAttribute('data-kind', 'ladder')
    expect(screen.getByTestId(`rpg-edge-${jump.from}-${jump.to}`)).toHaveAttribute('data-kind', 'jump')
  })

  it('shows the moving token with the edge motion while playing', () => {
    render(<RpgMap world={WORLD_DEFS[0]} level={5} token="🌱" playing={{ nodeIndex: 3, edgeKind: 'jump' }} />)
    const token = screen.getByTestId('rpg-token')
    expect(token).toHaveAttribute('data-motion', 'jump')
    expect(token).toBeInTheDocument()
  })
})
