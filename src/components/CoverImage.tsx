import { useEffect, useState } from 'react'
import { sanitizeCoverUrl } from '../lib/coverUrl'

type Props = {
  src: string | null
  alt?: string
  width: number
  height: number
}

export default function CoverImage({ src, alt, width, height }: Props) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const safeSrc = sanitizeCoverUrl(src)

  if (!safeSrc || failed) {
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
      src={safeSrc}
      alt={alt ?? ''}
      width={width}
      height={height}
      referrerPolicy="no-referrer"
      style={{ objectFit: 'contain', width, height }}
      onError={() => setFailed(true)}
    />
  )
}