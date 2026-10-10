import type { MorningEssayRecord } from '../lib/morningEssay'

const STORAGE_KEY = 'schedule-app-morning-essay'

function isMorningEssayRecord(value: unknown): value is MorningEssayRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.date === 'string' &&
    (v.choice === 'essay' || v.choice === 'book') &&
    typeof v.correctionDone === 'boolean' &&
    (v.correctionText === undefined || typeof v.correctionText === 'string') &&
    (v.prompt === undefined || typeof v.prompt === 'string')
  )
}

export function loadMorningEssayRecords(): MorningEssayRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter(isMorningEssayRecord)
  } catch {
    // 不正なデータは無視して空を返す
  }
  return []
}

export function saveMorningEssayRecords(records: MorningEssayRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

export function getMorningEssayRecord(date: string): MorningEssayRecord | undefined {
  return loadMorningEssayRecords().find((r) => r.date === date)
}

export function saveMorningEssayRecord(record: MorningEssayRecord): void {
  const all = loadMorningEssayRecords()
  const idx = all.findIndex((r) => r.date === record.date)
  if (idx === -1) all.push(record)
  else all[idx] = record
  saveMorningEssayRecords(all)
}
