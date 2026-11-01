// src/lib/velocity.ts
import type { ProgressRecordData } from './progress'

export type Confidence = 'high' | 'mid' | 'low'

export function calcVelocity(records: ProgressRecordData[], today: string, windowDays = 14): { medianPagesPerDay: number; activeDays: number; stalled: boolean; confidence: Confidence } {
  const todayMs = new Date(today + 'T00:00:00Z').getTime()
  const inWindow = records.filter((r) => {
    const ms = new Date(r.date + 'T00:00:00Z').getTime()
    const diff = Math.floor((todayMs - ms) / 86400000)
    return diff >= 0 && diff < windowDays && r.pages > 0
  })
  const pages = inWindow.map((r) => r.pages).sort((a, b) => a - b)
  const medianPagesPerDay = pages.length === 0 ? 0 : pages[Math.floor(pages.length / 2)]
  const lastMs = inWindow.length === 0 ? 0 : Math.max(...inWindow.map((r) => new Date(r.date + 'T00:00:00Z').getTime()))
  const daysSinceLast = inWindow.length === 0 ? 99 : Math.floor((todayMs - lastMs) / 86400000)
  const stalled = daysSinceLast >= 3
  const activeDays = inWindow.length
  const confidence: Confidence = activeDays >= 7 ? 'high' : activeDays >= 3 ? 'mid' : 'low'
  return { medianPagesPerDay, activeDays, stalled, confidence }
}

export function estimateCompletion(remainingPages: number, medianPagesPerDay: number, daysUntilDeadline: number): { probability: Confidence; predictedDays: number } {
  if (medianPagesPerDay <= 0) return { probability: 'low', predictedDays: 999 }
  const predictedDays = Math.ceil(remainingPages / medianPagesPerDay)
  const probability: Confidence = predictedDays <= daysUntilDeadline ? 'high' : predictedDays <= Math.ceil(daysUntilDeadline * 1.2) ? 'mid' : 'low'
  return { probability, predictedDays }
}
