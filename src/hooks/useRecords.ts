import { useCallback, useEffect, useState } from 'react'
import { db, upsertProgress } from '../db/database'
import type { ProgressRecordData } from '../lib/progress'

export function useRecords() {
  const [records, setRecords] = useState<ProgressRecordData[]>([])

  const refresh = useCallback(async () => {
    setRecords(await db.records.toArray())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addProgress = useCallback(
    async (bookId: string, date: string, pages: number) => {
      await upsertProgress(bookId, date, pages)
      await refresh()
    },
    [refresh],
  )

  return { records, refresh, addProgress }
}