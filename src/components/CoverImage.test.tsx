import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CoverImage from './CoverImage'

describe('CoverImage', () => {
  it('shows placeholder when no src is provided', () => {
    render(<CoverImage src={null} width={40} height={56} />)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('renders the image when src is provided', () => {
    const { container } = render(
      <CoverImage src="https://example.com/polaris.png" width={40} height={56} />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://example.com/polaris.png')
  })

  it('falls back to placeholder when the image fails to load', () => {
    const { container } = render(
      <CoverImage src="https://example.com/broken.png" width={40} height={56} />,
    )
    const img = container.querySelector('img') as HTMLImageElement
    fireEvent.error(img)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('shows placeholder for javascript: URLs', () => {
    render(<CoverImage src="javascript:alert(1)" width={40} height={56} />)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('shows placeholder for http: URLs', () => {
    render(<CoverImage src="http://example.com/cover.jpg" width={40} height={56} />)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('renders the image for https: URLs', () => {
    const { container } = render(
      <CoverImage src="https://example.com/cover.jpg" width={40} height={56} />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  it('shows placeholder for data:image/svg+xml URLs', () => {
    render(
      <CoverImage src="data:image/svg+xml;base64,PHNjcmlwdA==" width={40} height={56} />,
    )
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('renders the image for data:image/png URLs', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo='
    const { container } = render(<CoverImage src={src} width={40} height={56} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', src)
  })
})