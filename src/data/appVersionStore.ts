const STORAGE_KEY = 'schedule-app-last-seen-build'

export function loadLastSeenBuildId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveLastSeenBuildId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}
