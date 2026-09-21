import { useEffect, useState } from 'react'
import BookCard from '../components/BookCard'
import CoverImage from '../components/CoverImage'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { getNotifySettings, publishState } from '../lib/notify'
import {
  calcDonePages,
  calcRequiredPerDay,
  calcScheduleStatus,
  currentRound,
  daysBetween,
  formatJaDate,
  overallDiagnosis,
  todayStr,
  type BookData,
  type ProgressRecordData,
} from '../lib/progress'
import { CATALOG, type CatalogBook } from '../data/catalog'
import { quoteOf } from '../data/quotes'
import { loadSchedule, saveSchedule } from '../data/scheduleStore'
import {
  advanceSchedule,
  selectNowAndNext,
  sortScheduleEntries,
  type ScheduleEntry,
} from '../data/schedule'

const STATUS_LABEL: Record<string, string> = {
  done: '完了',
  behind: '遅れ',
  scheduled: '順調',
}

const ROUND_BADGE_COUNT = 5

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

type NowNextItemProps = {
  label: string
  entry?: ScheduleEntry
  testid: string
  progressPercent?: number
}

function NowNextItem({ label, entry, testid, progressPercent }: NowNextItemProps) {
  if (!entry) return null
  const catalogBook = CATALOG.find((c) => c.id === entry.catalogId)
  return (
    <div
      data-testid={testid}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1,
          color: 'var(--accent)',
          margin: 0,
        }}
      >
        {label}
      </p>
      <CoverImage src={catalogBook?.coverSrc ?? null} width={64} height={90} />
      <p
        style={{
          fontSize: 11,
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {catalogBook?.title}
      </p>
      {progressPercent !== undefined && (
        <div
          data-testid="now-next-progress"
          style={{ width: 64 }}
        >
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'var(--border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'var(--accent)',
              }}
            />
          </div>
          <p style={{ fontSize: 10, textAlign: 'center', margin: 2 }}>
            {progressPercent}%
          </p>
        </div>
      )}
    </div>
  )
}

type ScheduleRowProps = {
  entry: ScheduleEntry
  catalogBook: CatalogBook | undefined
  registered: BookData | undefined
  records: ProgressRecordData[]
  today: string
  hasNext: boolean
  round: number | undefined
  isCompleted?: boolean
  showAdvance?: boolean
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
  round,
  isCompleted = false,
  showAdvance = true,
  onOpen,
  onRecord,
  onAdvance,
}: ScheduleRowProps) {
  const [pagesInput, setPagesInput] = useState('')
  const prefix = isCompleted ? 'completed-row' : 'schedule-row'
  const roundTestId = isCompleted
    ? `completed-round-${entry.catalogId}`
    : `round-badge-${entry.catalogId}`
  const recordTestId = isCompleted
    ? `completed-record-${entry.catalogId}`
    : `row-record-${entry.catalogId}`
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
      if (
        !window.confirm(
          `「${catalogBook?.title ?? entry.catalogId}」を ${pages} ページで記録しますか？`,
        )
      ) {
        return
      }
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
          {round !== undefined && (
            <span
              data-testid={roundTestId}
              style={{
                display: 'inline-block',
                marginLeft: 6,
                fontSize: 11,
                fontWeight: 700,
                lineHeight: '18px',
                padding: '0 8px',
                borderRadius: 999,
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
              }}
            >
              {round}周目中
            </span>
          )}
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
      data-testid={`${prefix}-${entry.catalogId}`}
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
            data-testid={`${prefix}-open-${entry.catalogId}`}
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
        {registered && status === 'done' && hasNext && showAdvance && (
          <button
            data-testid={`advance-next-${entry.catalogId}`}
            type="button"
            onClick={() => void onAdvance(entry.catalogId)}
            style={{ flexShrink: 0 }}
          >
            完了
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
          data-testid={recordTestId}
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
  const todayQuote = quoteOf(today)
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(loadSchedule)
  const completedEntries = schedule.filter((e) => e.completed)
  const scheduled = sortScheduleEntries(
    schedule.filter((e) => !e.completed),
    today,
  )

  const handleAdvance = async (finishedCatalogId: string) => {
    const marked = schedule.map((e) =>
      e.catalogId === finishedCatalogId ? { ...e, completed: true } : e,
    )
    const updatedSchedule = advanceSchedule(marked, today, finishedCatalogId)
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

  const diagnosis = overallDiagnosis(books, records, today)

  const notify = getNotifySettings()
  const notifyEnabled = notify.enabled
  const notifyTopic = notify.topic

  useEffect(() => {
    if (!notifyEnabled || !notifyTopic.trim()) return
    const timer = setTimeout(() => {
      void publishState(notifyTopic, {
        behind: diagnosis.behind,
        requiredPerDay: diagnosis.requiredPerDay,
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [notifyEnabled, notifyTopic, diagnosis.behind, diagnosis.requiredPerDay])

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>参考書スケジュール</h1>
      <p data-testid="today-date" style={{ fontWeight: 700 }}>
        今日は {formatJaDate(today)}
      </p>
      {todayQuote && (
        <div data-testid="today-quote-block">
          <p
            data-testid="today-quote"
            style={{ fontSize: 15, fontStyle: 'italic' }}
          >
            {todayQuote.text}
          </p>
          <p
            data-testid="today-quote-explanation"
            style={{ fontSize: 12, color: 'var(--text-dim)' }}
          >
            （{todayQuote.explanation}）
          </p>
          <p
            data-testid="today-quote-by"
            style={{ fontSize: 12, textAlign: 'right', color: 'var(--text-dim)' }}
          >
            by {todayQuote.author}（{todayQuote.role}）
          </p>
        </div>
      )}

      {(() => {
        const { now, next } = selectNowAndNext(schedule, today)
        if (!now && !next) return null
        const nowCatalogBook = CATALOG.find((c) => c.id === now?.catalogId)
        const nowRegistered = now
          ? findRegistered(books, now.catalogId, nowCatalogBook?.title)
          : undefined
        const nowTotal =
          nowRegistered?.totalPages ?? nowCatalogBook?.totalPages ?? 0
        const nowDone = nowRegistered
          ? calcDonePages(records, nowRegistered.id)
          : 0
        const nowRound = nowTotal > 0 ? currentRound(nowDone, nowTotal) : 1
        const nowInRound =
          nowTotal > 0 ? nowDone - (nowRound - 1) * nowTotal : 0
        const nowPercent =
          nowTotal > 0
            ? Math.min(Math.round((nowInRound / nowTotal) * 100), 100)
            : 0
        const nowProgress = nowRegistered ? nowPercent : undefined
        return (
          <section
            data-testid="now-next-section"
            style={{
              marginBottom: 24,
              padding: 16,
              borderRadius: 12,
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <NowNextItem
                testid="now-next-now"
                label="NOW"
                entry={now}
                progressPercent={nowProgress}
              />
              {next && (
                <>
                  <span
                    data-testid="now-next-arrow"
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      lineHeight: 1,
                    }}
                  >
                    →
                  </span>
                  <NowNextItem
                    testid="now-next-next"
                    label="NEXT"
                    entry={next}
                  />
                </>
              )}
            </div>
          </section>
        )
      })()}

      {books.length > 0 &&
        (diagnosis.behind ? (
          <div
            data-testid="overall-pace-banner"
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 8,
              background: '#fdeaea',
              border: '1px solid #f5c6c6',
              fontSize: 13,
            }}
          >
            現在のペースだと間に合いません。期限まで均等にすると1日{' '}
            {diagnosis.requiredPerDay} ページ
          </div>
        ) : (
          <div
            data-testid="overall-pace-banner-ok"
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text-dim)',
            }}
          >
            現在のペースで間に合いそうです。期限まで1日 {diagnosis.requiredPerDay}{' '}
            ページを続けましょう
          </div>
        ))}

      <section data-testid="schedule-section" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>学習スケジュール</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          期限が近い順。遅れている参考書が上に表示されます。
        </p>
        {scheduled.map((entry, index) => {
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
          const done = registered ? calcDonePages(records, registered.id) : 0
          const total = catalogBook?.totalPages ?? 0
          const round =
            index < ROUND_BADGE_COUNT && total > 0
              ? currentRound(done, total)
              : undefined
          return (
            <ScheduleRow
              key={entry.catalogId}
              entry={entry}
              catalogBook={catalogBook}
              registered={registered}
              records={records}
              today={today}
              hasNext={hasNext}
              round={round}
              onOpen={onOpenBook}
              onRecord={(catalogId, pages) =>
                void handleRowRecord(catalogId, pages)
              }
              onAdvance={(catalogId) => void handleAdvance(catalogId)}
            />
          )
        })}
        {completedEntries.length > 0 && (
          <>
            <h2 style={{ fontSize: 16 }}>完了済みの参考書</h2>
            {completedEntries.map((entry) => {
              const catalogBook = CATALOG.find((c) => c.id === entry.catalogId)
              const registered = findRegistered(
                books,
                entry.catalogId,
                catalogBook?.title,
              )
              const done = registered
                ? calcDonePages(records, registered.id)
                : 0
              const total = catalogBook?.totalPages ?? 0
              const completedRound =
                total > 0 && currentRound(done, total) > 1
                  ? currentRound(done, total)
                  : undefined
              return (
                <ScheduleRow
                  key={entry.catalogId}
                  entry={entry}
                  catalogBook={catalogBook}
                  registered={registered}
                  records={records}
                  today={today}
                  hasNext={false}
                  round={completedRound}
                  isCompleted
                  showAdvance={false}
                  onOpen={onOpenBook}
                  onRecord={(catalogId, pages) =>
                    void handleRowRecord(catalogId, pages)
                  }
                  onAdvance={(catalogId) => void handleAdvance(catalogId)}
                />
              )
            })}
          </>
        )}
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