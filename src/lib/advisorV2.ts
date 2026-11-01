// src/lib/advisorV2.ts
import { buildAdvisorReport, type AdvisorReport } from './advisor'
import { calcVelocity, estimateCompletion, type Confidence } from './velocity'
import type { AvailabilitySlot } from '../data/dayplanStore'
import type { BookData, ProgressRecordData } from './progress'

export type AdvisorReportV2 = AdvisorReport & {
  velocities: Record<string, { medianPagesPerDay: number; probability: Confidence; stalled: boolean }>
}

export function buildAdvisorReportV2(params: {
  today: string
  books: BookData[]
  donePagesByBook: Record<string, number>
  availability: AvailabilitySlot[]
  records: ProgressRecordData[]
}): AdvisorReportV2 {
  const { today, books, donePagesByBook, availability, records } = params
  const base = buildAdvisorReport({ today, books, donePagesByBook, availability })
  const velocities: AdvisorReportV2['velocities'] = {}
  for (const b of base.books) {
    const recs = records.filter((r) => r.bookId === b.bookId)
    const v = calcVelocity(recs, today)
    const est = estimateCompletion(b.remainingPages, v.medianPagesPerDay, b.daysUntilDeadline)
    velocities[b.bookId] = { medianPagesPerDay: v.medianPagesPerDay, probability: v.confidence === 'low' ? 'low' : est.probability, stalled: v.stalled }
  }
  return { ...base, velocities }
}
