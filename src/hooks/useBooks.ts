import { useCallback, useEffect, useState } from 'react'
import { db, deleteBookCascade } from '../db/database'
import { normalizeLeapBook } from '../lib/leap'
import { removeBookEntries } from '../data/scheduleStore'
import { unpinBook } from '../data/dayplanStore'
import type { BookData } from '../lib/progress'

export function useBooks() {
  const [books, setBooks] = useState<BookData[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const loaded = await db.books.orderBy('deadline').toArray()
    const fixed = loaded.map((b) => normalizeLeapBook(b) ?? b)
    if (fixed.some((b, i) => b !== loaded[i])) {
      await db.books.bulkPut(fixed)
    }
    setBooks(fixed)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveBook = useCallback(
    async (book: BookData, isNew: boolean) => {
      if (isNew) {
        await db.books.add(book)
      } else {
        await db.books.put(book)
      }
      await refresh()
    },
    [refresh],
  )

  const removeBook = useCallback(
    async (bookId: string) => {
      await deleteBookCascade(bookId)
      removeBookEntries(bookId)
      await unpinBook(bookId)
      await refresh()
    },
    [refresh],
  )

  return { books, loaded, refresh, saveBook, removeBook }
}