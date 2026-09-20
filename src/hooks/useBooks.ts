import { useCallback, useEffect, useState } from 'react'
import { db, deleteBookCascade } from '../db/database'
import type { BookData } from '../lib/progress'

export function useBooks() {
  const [books, setBooks] = useState<BookData[]>([])

  const refresh = useCallback(async () => {
    setBooks(await db.books.orderBy('deadline').toArray())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveBook = useCallback(
    async (book: BookData, isNew: boolean) => {
      if (isNew) {
        await db.books.add(book)
      } else {
        await db.books.update(book.id, book)
      }
      await refresh()
    },
    [refresh],
  )

  const removeBook = useCallback(
    async (bookId: string) => {
      await deleteBookCascade(bookId)
      await refresh()
    },
    [refresh],
  )

  return { books, refresh, saveBook, removeBook }
}