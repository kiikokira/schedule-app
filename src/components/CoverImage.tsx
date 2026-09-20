import { useEffect, useState } from 'react'

type Props = {
  src: string | null
  alt?: string
  width: number
  height: number
}

export default function CoverImage({ src, alt, width, height }: Props) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div
        data-testid="cover-placeholder"
        className="cover-placeholder"
        style={{ width, height }}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt ?? ''}
      width={width}
      height={height}
      style={{ objectFit: 'contain', width, height }}
      onError={() => setFailed(true)}
    />
  )
}