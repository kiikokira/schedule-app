import { useEffect, useState } from 'react'

export function usePwaReload() {
  const [needsRefresh, setNeedsRefresh] = useState(false)

  useEffect(() => {
    void import('../pwa').then((m) => m.registerSW())
    const handler = () => setNeedsRefresh(true)
    window.addEventListener('sw-need-refresh', handler)
    return () => window.removeEventListener('sw-need-refresh', handler)
  }, [])

  const reload = () => window.location.reload()
  return { needsRefresh, reload }
}