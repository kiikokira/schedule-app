export async function registerSW() {
  const { registerSW } = await import('virtual:pwa-register')
  await registerSW({
    immediate: true,
    onNeedRefresh: () => {
      window.dispatchEvent(new CustomEvent('sw-need-refresh'))
    },
  })
}