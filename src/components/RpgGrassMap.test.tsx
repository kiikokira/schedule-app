import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RpgGrassMap from './RpgGrassMap'
import { DEFAULT_RPG_PROGRESS } from '../lib/rpgProgress'

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

const baseProps = {
  todayPages: 0,
  totalPages: 12,
  firstBookId: 'book-1' as string | null,
  hasBooks: true,
}

describe('RpgGrassMap', () => {
  it('renders the 3/4 grass world with character at the start node', () => {
    render(<RpgGrassMap {...baseProps} initialProgress={{ ...DEFAULT_RPG_PROGRESS }} />)
    expect(screen.getByTestId('rpg-grass-map')).toBeInTheDocument()
    expect(screen.getByTestId('rpg-grass-char')).toHaveAttribute('data-node', 'g-n0')
    expect(screen.getByTestId('rpg-char')).toBeInTheDocument()
    expect(screen.getByTestId('rpg-grass-pad')).toBeInTheDocument()
    expect(screen.getByTestId('rpg-grass-node-g-n5')).toBeInTheDocument()
  })

  it('shows the stage panel when starting on a stage node', () => {
    render(
      <RpgGrassMap
        {...baseProps}
        initialNodeId="g-n5"
        initialProgress={{ ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { '1': 'g-n5' } }}
      />,
    )
    fireEvent.click(screen.getByTestId('rpg-grass-decide'))
    // パネルは到着演出の後（rAF）に表示される。rAFを進める。
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            expect(screen.queryByTestId('rpg-grass-stage')).not.toBeNull()
            resolve()
          }, 700)
        })
      })
    })
  })

  it('passes bookId as the third onStageAction arg on stage-2 decide', () => {
    localStorage.clear()
    const onStageAction = vi.fn()
    render(
      <RpgGrassMap
        {...baseProps}
        todayPages={3}
        initialNodeId="g-n6"
        initialProgress={{ ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { '1': 'g-n6' } }}
        onStageAction={onStageAction}
      />,
    )
    fireEvent.click(screen.getByTestId('rpg-grass-decide'))
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const clearBtn = screen.queryByTestId('rpg-grass-clear')
        expect(clearBtn).not.toBeNull()
        fireEvent.click(clearBtn!)
        setTimeout(() => {
          expect(onStageAction).toHaveBeenCalledWith('grass-stage-2', 'book', 'book-1')
          resolve()
        }, 100)
      }, 800)
    })
  })

  it('toggles between follow and overview camera', () => {
    render(<RpgGrassMap {...baseProps} initialProgress={{ ...DEFAULT_RPG_PROGRESS }} />)
    const btn = screen.getByTestId('rpg-grass-camera')
    expect(btn).toHaveTextContent('全体をみる')
    fireEvent.click(btn)
    expect(screen.getByTestId('rpg-grass-camera')).toHaveTextContent('追従にもどる')
  })

  it('records a quest clear and unlocks new paths', () => {
    localStorage.clear()
    render(
      <RpgGrassMap
        {...baseProps}
        todayPages={3}
        initialNodeId="g-n5"
        initialProgress={{ ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { '1': 'g-n5' } }}
      />,
    )
    fireEvent.click(screen.getByTestId('rpg-grass-decide'))
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const clearBtn = screen.queryByTestId('rpg-grass-clear')
        expect(clearBtn).not.toBeNull()
        fireEvent.click(clearBtn!)
        setTimeout(() => {
          expect(screen.queryByTestId('rpg-grass-cleared')).not.toBeNull()
          resolve()
        }, 100)
      }, 800)
    })
  })
})
