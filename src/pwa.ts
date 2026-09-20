export async function registerSW() {
  const { registerSW } = await import('virtual:pwa-register')
  registerSW({
    immediate: true,
  })
}