// src/components/LeagueBadge.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import LeagueBadge from './LeagueBadge'

it('Div数字と期ラベルを表示する', () => {
  render(<LeagueBadge div={1} seasonLabel="26-09" />)
  const badge = screen.getByTestId('league-badge')
  expect(badge).toHaveTextContent('1')
  expect(badge).toHaveTextContent('26-09')
  expect(badge.getAttribute('data-div')).toBe('1')
})

it('裁E��中はスロチE��番号・新規�Eドット�EクリチE��でonClick', () => {
  const onClick = vi.fn()
  render(<LeagueBadge div={2} seasonLabel="26-09" equipped slotNumber={2} isNew onClick={onClick} />)
  expect(screen.getByTestId('league-badge-slot')).toHaveTextContent('2')
  expect(screen.getByTestId('league-badge-new')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('league-badge'))
  expect(onClick).toHaveBeenCalledTimes(1)
})
