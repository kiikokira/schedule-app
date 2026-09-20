import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CoverImage from './CoverImage'

describe('CoverImage', () => {
  it('shows placeholder when no src is provided', () => {
    render(<CoverImage src={null} width={40} height={56} />)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('renders the image when src is provided', () => {
    const { container } = render(<CoverImage src="covers/polaris.png" width={40} height={56} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'covers/polaris.png')
  })

  it('falls back to placeholder when the image fails to load', () => {
    const { container } = render(<CoverImage src="covers/broken.png" width={40} height={56} />)
    const img = container.querySelector('img') as HTMLImageElement
    fireEvent.error(img)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })
})