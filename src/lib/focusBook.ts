import {
  calcCycleDonePairs,
  calcTotalDone,
  cycleGrandTotal,
  type BookData,
  type CycleRecordData,
  type ProgressRecordData,
} from './progress'

// 今集中すべき1冊＝期限が一番近く、同期限なら残量が一番多い本のID。
// 残量が0の本は対象外。全て完了・対象なしの場合は null（呼び出し側は全冊表示にフォールバックする）。
export function selectFocusBookId(
  books: Pick<BookData, 'id' | 'deadline' | 'studyMode' | 'totalPages' | 'totalUnits' | 'targetRounds' | 'initialDonePages' | 'initialDoneUnits'>[],
  records: ProgressRecordData[],
  cycles: CycleRecordData[],
): string | null {
  let best: { id: string; deadline: string; remaining: number } | null = null
  for (const b of books) {
    const remaining =
      b.studyMode === 'cycles'
        ? Math.max(
            cycleGrandTotal({ totalUnits: b.totalUnits, targetRounds: b.targetRounds }) -
              calcCycleDonePairs(
                { initialDoneUnits: b.initialDoneUnits },
                cycles.filter((r) => r.bookId === b.id),
              ),
            0,
          )
        : Math.max(
            b.totalPages -
              calcTotalDone(
                { id: b.id, initialDonePages: b.initialDonePages },
                records.filter((r) => r.bookId === b.id),
              ),
            0,
          )
    if (remaining <= 0) continue
    if (
      best === null ||
      b.deadline < best.deadline ||
      (b.deadline === best.deadline && remaining > best.remaining)
    ) {
      best = { id: b.id, deadline: b.deadline, remaining }
    }
  }
  return best?.id ?? null
}
