import { WEEKLY_ESSAY_GOAL, type MorningEssayRecord } from '../lib/morningEssay'

const STORAGE_KEY = 'schedule-app-morning-essay'
const GOAL_KEY = 'schedule-app-morning-essay-goal'

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

export function loadMorningEssayGoal(): number {
  try {
    const raw = localStorage.getItem(GOAL_KEY)
    if (!raw) return WEEKLY_ESSAY_GOAL
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1 || n > 7) return WEEKLY_ESSAY_GOAL
    return n
  } catch {
    return WEEKLY_ESSAY_GOAL
  }
}

export function saveMorningEssayGoal(goal: number): void {
  if (!Number.isInteger(goal) || goal < 1 || goal > 7) return
  try {
    localStorage.setItem(GOAL_KEY, String(goal))
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}
