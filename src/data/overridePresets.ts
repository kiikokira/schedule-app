export type OverridePresetRow = {
  start: string
  end: string
  bookId?: string
  onTrain?: boolean
}

export type OverridePreset = {
  id: string
  name: string
  rows: OverridePresetRow[]
}

const STORAGE_KEY = 'schedule-app-override-presets'

function isPresetRow(value: unknown): value is OverridePresetRow {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.start === 'string' &&
    typeof v.end === 'string' &&
    (v.bookId === undefined || typeof v.bookId === 'string') &&
    (v.onTrain === undefined || typeof v.onTrain === 'boolean')
  )
}

function isOverridePreset(value: unknown): value is OverridePreset {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.rows) &&
    v.rows.every(isPresetRow)
  )
}

export function loadOverridePresets(): OverridePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter(isOverridePreset)
  } catch {
    // 不正なデータは無視して空を返す
  }
  return []
}

export function saveOverridePresets(presets: OverridePreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}
