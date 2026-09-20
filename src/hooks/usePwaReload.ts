import { useEffect, useState } from 'react'
import { registerSW, getPendingUpdater } from '../pwa'

export function usePwaReload() {
  const [needsRefresh, setNeedsRefresh] = useState(false)

  useEffect(() => {
    void registerSW()
    const handler = () => setNeedsRefresh(true)
    window.addEventListener('sw-need-refresh', handler)
    return () => window.removeEventListener('sw-need-refresh', handler)
  }, [])

  const reload = async () => {
    const updater = getPendingUpdater()
    if (typeof updater === 'function') {
      await updater(true)
    }
    window.location.reload()
  }

  return { needsRefresh, reload }
}