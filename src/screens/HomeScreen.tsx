import { useState } from 'react'
import BookCard from '../components/BookCard'
import CoverImage from '../components/CoverImage'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import {
  calcDonePages,
  calcRequiredPerDay,
  calcScheduleStatus,
  daysBetween,
  todayStr,
  type BookData,
  type ProgressRecordData,
} from '../lib/progress'
import { CATALOG, type CatalogBook } from '../data/catalog'
import { loadSchedule, saveSchedule } from '../data/scheduleStore'
import {
  advanceSchedule,
  sortScheduleEntries,
  type ScheduleEntry,
} from '../data/schedule'

const STATUS_LABEL: Record<string, string> = {
  done: '完了',
  behind: '遅れ',
  scheduled: '順調',
}

type Props = {
  onOpenBook: (id: string) => void
}

function findRegistered(
  books: BookData[],
  catalogId: string,
  title: string | undefined,
): BookData | undefined {
  return books.find(
    (b) =>
      b.catalogId === catalogId ||
      (b.catalogId === undefined && title !== undefined && b.title === title),
  )
}

type ScheduleRowProps = {
  entry: ScheduleEntry
  catalogBook: CatalogBook | undefined
  registered: BookData | undefined
  records: ProgressRecordData[]
  today: string
  hasNext: boolean
  onOpen: (id: string) => void
  onRecord: (catalogId: string, pages: number) => void
  onAdvance: (catalogId: string) => void
}

function ScheduleRow({
  entry,
  catalogBook,
  registered,
  records,
  today,
  hasNext,
  onOpen,
  onRecord,
  onAdvance,
}: ScheduleRowProps) {
  const [pagesInput, setPagesInput] = useState('')
  const done = registered ? calcDonePages(records, registered.id) : 0
  const status = registered
    ? calcScheduleStatus(
        { ...registered, startDate: entry.startDate, deadline: entry.deadline },
        done,
        today,
      )
    : 'unregistered'
  const remainingDays = daysBetween(today, entry.deadline)
  const daysLabel =
    remainingDays >= 0 ? `あと ${remainingDays} 日` : `${-remainingDays} 日超過`
  const todayRecord = registered
    ? records.find((r) => r.bookId === registered.id && r.date === today)
    : undefined
  const todayRecordPages = todayRecord?.pages ?? 0
  const previewTodayPages = (() => {
    const p = Number(pagesInput)
    if (Number.isInteger(p) && p >= 1) return p
    return todayRecordPages
  })()
  const totalPages = registered?.totalPages ?? catalogBook?.totalPages ?? 0
  const requiredPerDay = calcRequiredPerDay(
    { totalPages },
    done - todayRecordPages,
    previewTodayPages,
    remainingDays,
  )

  const handleRecord = () => {
    const pages = Number(pagesInput)
    if (Number.isInteger(pages) && pages >= 1) {
      setPagesInput('')
      onRecord(entry.catalogId, pages)
    }
  }

  const infoBlock = (
    <>
      <CoverImage src={catalogBook?.coverSrc ?? null} width={40} height={56} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>
          {catalogBook?.title ?? entry.catalogId}
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          期限 {entry.deadline}（{daysLabel}）
          {entry.note ? `（${entry.note}）` : ''} /{' '}
          {status === 'unregistered' ? '未登録' : STATUS_LABEL[status]}
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          期限まで1日あたり {requiredPerDay} ページ
        </div>
      </div>
    </>
  )

  return (
    <div
      data-testid={`schedule-row-${entry.catalogId}`}
      style={{
        padding: '8px 12px',
        marginBottom: 8,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: status === 'behind' ? '#fdeaea' : 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {registered ? (
          <button
            data-testid={`schedule-row-open-${entry.catalogId}`}
            type="button"
            onClick={() => onOpen(registered.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {infoBlock}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {infoBlock}
          </div>
        )}
        {registered && status === 'done' && hasNext && (
          <button
            data-testid={`advance-next-${entry.catalogId}`}
            type="button"
            onClick={() => void onAdvance(entry.catalogId)}
            style={{ flexShrink: 0 }}
          >
            次へ進む
          </button>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          data-testid={`row-progress-input-${entry.catalogId}`}
          type="number"
          inputMode="numeric"
          value={pagesInput}
          onChange={(e) => setPagesInput(e.target.value)}
          placeholder="今日のページ数"
          style={{ flex: 1, minWidth: 96 }}
        />
        <button
          data-testid={`row-record-${entry.catalogId}`}
          type="button"
          onClick={() => void handleRecord()}
        >
          記録
        </button>
      </div>
    </div>
  )
}

export default function HomeScreen({ onOpenBook }: Props) {
  const { books, saveBook } = useBooks()
  const { records, addProgress } = useRecords()
  const today = todayStr()
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(loadSchedule)
  const scheduled = sortScheduleEntries(schedule, today)

  const handleAdvance = async (finishedCatalogId: string) => {
    const updatedSchedule = advanceSchedule(schedule, today, finishedCatalogId)
    if (updatedSchedule === schedule) return
    saveSchedule(updatedSchedule)
    setSchedule(updatedSchedule)
    const finishedIndex = schedule.findIndex(
      (e) => e.catalogId === finishedCatalogId,
    )
    const nextEntry =
      finishedIndex !== -1 ? updatedSchedule[finishedIndex + 1] : undefined
    if (!nextEntry) return
    const nextCatalogBook = CATALOG.find((c) => c.id === nextEntry.catalogId)
    const nextRegistered = findRegistered(
      books,
      nextEntry.catalogId,
      nextCatalogBook?.title,
    )
    if (nextRegistered) {
      await saveBook(
        {
          ...nextRegistered,
          startDate: nextEntry.startDate,
          deadline: nextEntry.deadline,
          updatedAt: new Date().toISOString(),
        },
        false,
      )
    }
  }

  const handleRowRecord = async (catalogId: string, pages: number) => {
    const entry = schedule.find((e) => e.catalogId === catalogId)
    const catalogBook = CATALOG.find((c) => c.id === catalogId)
    if (!entry || !catalogBook) return
    const registeredBook = findRegistered(books, catalogId, catalogBook.title)
    let bookId = registeredBook?.id
    if (!bookId) {
      const nowIso = new Date().toISOString()
      const newBook: BookData = {
        id: crypto.randomUUID(),
        title: catalogBook.title,
        subject: catalogBook.subject,
        totalPages: catalogBook.totalPages,
        coverUrl: catalogBook.coverSrc,
        catalogId,
        startDate: entry.startDate,
        deadline: entry.deadline,
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      await saveBook(newBook, true)
      bookId = newBook.id
    }
    await addProgress(bookId, today, pages)
  }

  const sortedBooks = [...books].sort((a, b) => {
    const sa = calcScheduleStatus(a, calcDonePages(records, a.id), today)
    const sb = calcScheduleStatus(b, calcDonePages(records, b.id), today)
    if (sa === 'behind' && sb !== 'behind') return -1
    if (sa !== 'behind' && sb === 'behind') return 1
    return 0
  })

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>参考書スケジュール</h1>
      <p style={{ color: 'var(--text-dim)' }}>
        今日の目標を毎日見て、参考書を期限内に終わらせよう。
      </p>

      <section data-testid="schedule-section" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>学習スケジュール</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          期限が近い順。遅れている参考書が上に表示されます。
        </p>
        {scheduled.map((entry) => {
          const catalogBook = CATALOG.find((c) => c.id === entry.catalogId)
          const registered = findRegistered(
            books,
            entry.catalogId,
            catalogBook?.title,
          )
          const originalIndex = schedule.findIndex(
            (e) => e.catalogId === entry.catalogId,
          )
          const hasNext =
            originalIndex !== -1 && originalIndex + 1 < schedule.length
          return (
            <ScheduleRow
              key={entry.catalogId}
              entry={entry}
              catalogBook={catalogBook}
              registered={registered}
              records={records}
              today={today}
              hasNext={hasNext}
              onOpen={onOpenBook}
              onRecord={(catalogId, pages) =>
                void handleRowRecord(catalogId, pages)
              }
              onAdvance={(catalogId) => void handleAdvance(catalogId)}
            />
          )
        })}
      </section>

      <section>
        <h2 data-testid="book-list-heading" style={{ fontSize: 16 }}>
          登録済みの参考書
        </h2>
        {sortedBooks.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>
            参考書がありません。「＋」から追加してください。
          </p>
        ) : (
          sortedBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              records={records}
              onOpen={onOpenBook}
              onRecord={(bookId, pages) => void addProgress(bookId, today, pages)}
            />
          ))
        )}
      </section>
    </div>
  )
}