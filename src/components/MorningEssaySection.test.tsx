import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import MorningEssaySection from './MorningEssaySection'
import { getMorningEssayRecord } from '../data/morningEssayStore'

beforeEach(() => {
  localStorage.clear()
})

describe('MorningEssaySection', () => {
  it('shows the morning choice between essay and book', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    expect(screen.getByTestId('morning-essay-section')).toBeInTheDocument()
    expect(screen.getByTestId('morning-choice-essay')).toBeInTheDocument()
    expect(screen.getByTestId('morning-choice-book')).toBeInTheDocument()
  })

  it('shows the essay panel with prompt and ChatGPT button when essay is chosen', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    expect(screen.getByTestId('morning-prompt-preview')).toHaveTextContent('ベネッセ')
    expect(screen.getByTestId('morning-open-chatgpt')).toBeInTheDocument()
    expect(screen.getByTestId('morning-correction-input')).toBeInTheDocument()
  })

  it('opens ChatGPT with the prompt and copies it', async () => {
    const openSpy = vi.fn()
    const originalOpen = window.open
    window.open = openSpy as unknown as typeof window.open
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    try {
      render(<MorningEssaySection today="2026-10-10" />)
      fireEvent.click(screen.getByTestId('morning-choice-essay'))
      fireEvent.click(screen.getByTestId('morning-open-chatgpt'))
      expect(writeText).toHaveBeenCalled()
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('https://chatgpt.com/'), '_blank')
    } finally {
      window.open = originalOpen
    }
  })

  it('rejects a short paste and accepts a real correction', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.change(screen.getByTestId('morning-correction-input'), { target: { value: 'short' } })
    fireEvent.click(screen.getByTestId('morning-correction-save'))
    expect(screen.getByTestId('morning-correction-error')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('morning-correction-input'), {
      target: { value: '添削結果：とても良い英作文でした。'.repeat(3) },
    })
    fireEvent.click(screen.getByTestId('morning-correction-save'))
    expect(screen.getByTestId('morning-rate')).toHaveTextContent('1/1')
  })

  it('shows the correction rate when essay is chosen', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    expect(screen.getByTestId('morning-rate')).toBeInTheDocument()
  })

  it('edits the prompt text', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-prompt-edit-toggle'))
    const area = screen.getByTestId('morning-prompt-input') as HTMLTextAreaElement
    expect(area.value).toContain('ベネッセ')
    fireEvent.change(area, { target: { value: 'カスタム指示文テスト' } })
    fireEvent.click(screen.getByTestId('morning-prompt-save'))
    expect(screen.getByTestId('morning-prompt-preview')).toHaveTextContent('カスタム指示文テスト')
    expect(getMorningEssayRecord('2026-10-10')?.prompt).toBe('カスタム指示文テスト')
  })

  it('rejects an empty prompt', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-prompt-edit-toggle'))
    fireEvent.change(screen.getByTestId('morning-prompt-input'), { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('morning-prompt-save'))
    expect(screen.getByTestId('morning-prompt-error')).toBeInTheDocument()
  })

  it('backfills a past weekday as done from the week editor', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    // 2026-10-10 is Saturday; Monday 2026-10-05 starts unchecked
    const toggle = screen.getByTestId('morning-day-done-2026-10-05')
    expect(toggle).toHaveTextContent('未')
    fireEvent.click(toggle)
    expect(screen.getByTestId('morning-rate')).toHaveTextContent('1/2')
  })
})
