import { db } from '../db/database'
import { calcDebtForDate, calcPenaltyPoints, type Severity } from '../lib/penalty'

export type PenaltyEvent = {
  id: string
  date: string
  missingBookIds: string[]
  pageDebt: number
  unitDebt: Record<string, number>
  points: number
  severity: Severity
  createdAt: string
}

export type PenaltySettings = {
  severity: Severity
  enabledBanner: boolean
}

const SETTINGS_KEY = 'penalty-settings'

const DEFAULT_SETTINGS: PenaltySettings = {
  severity: 'normal',
  enabledBanner: true,
}

const SEVERITIES: Severity[] = ['mild', 'normal', 'strict']

export function getPenaltySettings(): PenaltySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<PenaltySettings>
    return {
      severity: SEVERITIES.includes(parsed.severity as Severity) ? (parsed.severity as Severity) : 'normal',
      enabledBanner: parsed.enabledBanner ?? true,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function setPenaltySettings(s: PenaltySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export async function listPenalties(): Promise<PenaltyEvent[]> {
  return db.penalties.orderBy('date').toArray()
}

export async function upsertPenalty(e: PenaltyEvent): Promise<void> {
  await db.penalties.put(e)
}

export async function evaluateDay(
  date: string,
  targetBookIds: string[],
  recordedBookIds: Set<string>,
  planned: { bookId: string, pages: number }[],
  cyclePlanned: { bookId: string, units: number }[],
  severity: Severity,
): Promise<PenaltyEvent | null> {
  const missingBookIds = targetBookIds.filter((id) => !recordedBookIds.has(id))
  if (missingBookIds.length === 0) {
    await db.penalties.delete(date)
    return null
  }
  const { pageDebt, unitDebt } = calcDebtForDate(planned, cyclePlanned, recordedBookIds)
  const event: PenaltyEvent = {
    id: date,
    date,
    missingBookIds,
    pageDebt,
    unitDebt,
    points: calcPenaltyPoints(missingBookIds.length, severity),
    severity,
    createdAt: new Date().toISOString(),
  }
  await db.penalties.put(event)
  return event
}
