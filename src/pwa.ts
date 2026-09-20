type UpdateSW = (reloadPage?: boolean) => Promise<void> | void

let pendingUpdater: UpdateSW | null = null

export function getPendingUpdater() {
  return pendingUpdater
}

export async function registerSW() {
  const { registerSW } = await import('virtual:pwa-register')
  pendingUpdater = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      window.dispatchEvent(new CustomEvent('sw-need-refresh'))
    },
  })
}