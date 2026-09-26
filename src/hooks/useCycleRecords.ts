import { useCallback, useEffect, useState } from 'react'
import { db, addCycleRecord, updateCycleRecord, deleteCycleRecord } from '../db/database'
import type { CycleRecordData } from '../lib/progress'

export function useCycleRecords(bookId?: string) {
  const [cycleRecords, setCycleRecords] = useState<CycleRecordData[]>([])

  const refresh = useCallback(async () => {
    setCycleRecords(
      bookId ? await db.cycleRecords.where('bookId').equals(bookId).toArray() : await db.cycleRecords.toArray(),
    )
  }, [bookId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addCycle = useCallback(
    async (rec: CycleRecordData) => {
      await addCycleRecord(rec)
      await refresh()
    },
    [refresh],
  )

  const updateCycle = useCallback(
    async (id: string, patch: { date?: string; unitFrom?: number; unitTo?: number; round?: number }) => {
      await updateCycleRecord(id, patch)
      await refresh()
    },
    [refresh],
  )

  const removeCycle = useCallback(
    async (id: string) => {
      await deleteCycleRecord(id)
      await refresh()
    },
    [refresh],
  )

  return { cycleRecords, refresh, addCycle, updateCycle, removeCycle }
}
