import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import MorningEssaySection from './MorningEssaySection'
import { getMorningEssayRecord, saveMorningEssayRecord } from '../data/morningEssayStore'

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
    expect(screen.queryByTestId('morning-prompt-edit-toggle')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('morning-prompt-box'))
    const area = screen.getByTestId('morning-prompt-input') as HTMLTextAreaElement
    expect(area.value).toContain('ベネッセ')
    fireEvent.change(area, { target: { value: 'カスタム指示文テスト' } })
    fireEvent.blur(area)
    expect(screen.getByTestId('morning-prompt-preview')).toHaveTextContent('カスタム指示文テスト')
    expect(getMorningEssayRecord('2026-10-10')?.prompt).toBe('カスタム指示文テスト')
  })

  it('rejects an empty prompt', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-prompt-box'))
    const area = screen.getByTestId('morning-prompt-input') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: '   ' } })
    fireEvent.blur(area)
    expect(screen.getByTestId('morning-prompt-error')).toBeInTheDocument()
  })

  it('backfills a past weekday as done from the week editor', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    // 今日だけが英作文選択日なので今日の行だけ出る
    expect(screen.getByTestId('morning-day-row-2026-10-10')).toBeInTheDocument()
    const toggle = screen.getByTestId('morning-day-done-2026-10-10')
    expect(toggle).toHaveTextContent('未')
    fireEvent.click(toggle)
    expect(screen.getByTestId('morning-rate')).toHaveTextContent('1/1')
  })

  it('lists days with morning records in the week editor', () => {
    saveMorningEssayRecord({ date: '2026-10-06', choice: 'book', correctionDone: false })
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    expect(screen.getByTestId('morning-day-row-2026-10-10')).toBeInTheDocument()
    expect(screen.getByTestId('morning-day-row-2026-10-06')).toBeInTheDocument()
    expect(screen.queryByTestId('morning-day-row-2026-10-05')).not.toBeInTheDocument()
  })

  it('switches a day between essay and book', () => {
    saveMorningEssayRecord({ date: '2026-10-06', choice: 'essay', correctionDone: false })
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    const choice = screen.getByTestId('morning-day-choice-2026-10-06')
    expect(choice).toHaveTextContent('英作文')
    fireEvent.click(choice)
    expect(screen.getByTestId('morning-day-choice-2026-10-06')).toHaveTextContent('参考書')
    expect(screen.getByTestId('morning-rate')).toHaveTextContent('0/1')
    fireEvent.click(screen.getByTestId('morning-day-choice-2026-10-06'))
    expect(screen.getByTestId('morning-day-choice-2026-10-06')).toHaveTextContent('英作文')
  })

  it('removes a day from the editor', () => {
    const originalConfirm = window.confirm
    window.confirm = (() => true) as unknown as typeof window.confirm
    try {
      saveMorningEssayRecord({ date: '2026-10-06', choice: 'book', correctionDone: false })
      render(<MorningEssaySection today="2026-10-10" />)
      fireEvent.click(screen.getByTestId('morning-choice-essay'))
      fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
      fireEvent.click(screen.getByTestId('morning-day-delete-2026-10-06'))
      expect(screen.queryByTestId('morning-day-row-2026-10-06')).not.toBeInTheDocument()
    } finally {
      window.confirm = originalConfirm
    }
  })

  it('keeps a day when removal is cancelled', () => {
    const originalConfirm = window.confirm
    window.confirm = (() => false) as unknown as typeof window.confirm
    try {
      saveMorningEssayRecord({ date: '2026-10-06', choice: 'book', correctionDone: false })
      render(<MorningEssaySection today="2026-10-10" />)
      fireEvent.click(screen.getByTestId('morning-choice-essay'))
      fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
      fireEvent.click(screen.getByTestId('morning-day-delete-2026-10-06'))
      expect(screen.getByTestId('morning-day-row-2026-10-06')).toBeInTheDocument()
    } finally {
      window.confirm = originalConfirm
    }
  })

  it('highlights done days in green in the week editor', () => {
    saveMorningEssayRecord({ date: '2026-10-10', choice: 'essay', correctionDone: true })
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    expect(screen.getByTestId('morning-day-done-2026-10-10')).toHaveStyle({
      background: '#2f9e63',
    })
  })

  it('structures the essay panel for readability', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    expect(screen.getByTestId('morning-prompt-box')).toBeInTheDocument()
    expect(screen.getByTestId('morning-actions')).toHaveStyle({ flexDirection: 'column' })
  })

  it('labels the record blocks with small headings', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    expect(screen.getByTestId('morning-record-heading')).toHaveTextContent('添削の記録')
    expect(screen.getByTestId('morning-week-heading')).toHaveTextContent('今週の記録')
  })

  it('collapses and expands the morning section from the header toggle', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    expect(screen.getByTestId('morning-prompt-box')).toBeInTheDocument()
    const toggle = screen.getByTestId('morning-expand-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('morning-prompt-box')).not.toBeInTheDocument()
    expect(screen.queryByTestId('morning-choice-essay')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByTestId('morning-prompt-box')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens the editor by tapping the prompt box and has no edit button', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    expect(screen.queryByTestId('morning-prompt-edit-toggle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('morning-prompt-input')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('morning-prompt-box'))
    expect(screen.getByTestId('morning-prompt-input')).toBeInTheDocument()
  })

  it('shows the add-day form limited to the week', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    const dateInput = screen.getByTestId('morning-add-date') as HTMLInputElement
    expect(dateInput.min).toBe('2026-10-05')
    expect(dateInput.max).toBe('2026-10-11')
    expect(screen.getByTestId('morning-add-save')).toBeInTheDocument()
  })

  it('adds a past day as essay', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    fireEvent.change(screen.getByTestId('morning-add-date'), { target: { value: '2026-10-05' } })
    fireEvent.click(screen.getByTestId('morning-add-save'))
    expect(screen.getByTestId('morning-day-row-2026-10-05')).toBeInTheDocument()
    expect(screen.getByTestId('morning-day-choice-2026-10-05')).toHaveTextContent('英作文')
    expect(screen.getByTestId('morning-rate')).toHaveTextContent('0/2')
  })

  it('rejects an empty date', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    fireEvent.click(screen.getByTestId('morning-add-save'))
    expect(screen.getByTestId('morning-add-error')).toBeInTheDocument()
  })

  it('rejects a duplicate date without overwriting', () => {
    saveMorningEssayRecord({ date: '2026-10-06', choice: 'essay', correctionDone: true })
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-week-edit-toggle'))
    fireEvent.change(screen.getByTestId('morning-add-date'), { target: { value: '2026-10-06' } })
    fireEvent.click(screen.getByTestId('morning-add-save'))
    expect(screen.getByTestId('morning-add-error')).toBeInTheDocument()
    expect(getMorningEssayRecord('2026-10-06')?.correctionDone).toBe(true)
  })

  it('edits inline in the prompt box and auto-saves on blur with no buttons', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-prompt-box'))
    const box = screen.getByTestId('morning-prompt-box')
    const area = screen.getByTestId('morning-prompt-input') as HTMLTextAreaElement
    expect(box.contains(area)).toBe(true)
    expect(screen.queryByTestId('morning-prompt-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('morning-prompt-save')).not.toBeInTheDocument()
    expect(screen.queryByTestId('morning-prompt-close')).not.toBeInTheDocument()
    fireEvent.change(area, { target: { value: '自動保存テスト指示文' } })
    fireEvent.blur(area)
    expect(screen.getByTestId('morning-prompt-preview')).toHaveTextContent('自動保存テスト指示文')
    expect(getMorningEssayRecord('2026-10-10')?.prompt).toBe('自動保存テスト指示文')
  })

  it('keeps editing with an error when auto-saving empty text', () => {
    render(<MorningEssaySection today="2026-10-10" />)
    fireEvent.click(screen.getByTestId('morning-choice-essay'))
    fireEvent.click(screen.getByTestId('morning-prompt-box'))
    const area = screen.getByTestId('morning-prompt-input') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: '   ' } })
    fireEvent.blur(area)
    expect(screen.getByTestId('morning-prompt-error')).toBeInTheDocument()
    expect(screen.getByTestId('morning-prompt-input')).toBeInTheDocument()
  })
})
