import { useEffect, useMemo, useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import { listAvailability } from '../data/dayplanStore'
import { generateDayPlan, effectiveSpeed, learnSpeed, slotsForDate, type ScheduledBook } from '../lib/dayplan'
import { todayStr, formatJaDate, daysBetween, calcCycleDonePairs, calcCycleDailyTarget, type BookData } from '../lib/progress'
import { getNotifySettings } from '../lib/notify'
import { buildSlotsPayload } from '../lib/slotNotify'
import { publishSlotsOnce } from '../lib/slotsPublish'
import { useSlotEndReminder } from '../lib/useSlotEndReminder'
import CoverImage from '../components/CoverImage'

type Props = {
  onBack: () => void
  onSettings: () => void
  today?: string
}

function toScheduledBook(b: BookData): ScheduledBook {
  return {
    bookId: b.id,
    donePages: 0,
    totalPages: b.totalPages,
    minutesPerPage: effectiveSpeed(b.minutesPerPage, b.subject),
    priority: b.priority,
    allottedRatio: b.allottedRatio,
    startDate: b.startDate,
    deadline: b.deadline,
  }
}

export default function TodayPlanScreen({ onBack, onSettings, today: todayProp }: Props) {
  const { books, saveBook } = useBooks()
  const { records, addProgress } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof listAvailability>>>([])
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  const [inputs, setInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    void listAvailability().then((a) => {
      setAvailability(a)
      setAvailabilityLoaded(true)
    })
  }, [])

  const pageBooks = books.filter((b) => b.studyMode !== 'cycles')
  const cycleBooks = books.filter((b) => b.studyMode === 'cycles')
  const doneByBook = new Map(pageBooks.map((b) => [b.id, b.initialDonePages ?? 0]))
  for (const r of records) {
    const done = doneByBook.get(r.bookId)
    if (done !== undefined) doneByBook.set(r.bookId, done + r.pages)
  }
  const scheduled = pageBooks
    .map((b) => ({ ...toScheduledBook(b), donePages: doneByBook.get(b.id) ?? 0 }))
    .map((sb) => sb)
  // スケジュールに含まれていない登録本も対象にする
  const planned = generateDayPlan({ availability, books: scheduled, today })

  // リマインダー用: その日の空き時間帯と終了予定をntfyへ送る。
  // ワークフローが15分ごとに読み、終わった直後の時間帯だけ通知する。
  const notify = getNotifySettings()
  const notifyEnabled = notify.enabled
  const notifyTopic = notify.topic
  const slotsPayload = useMemo(
    () =>
      availabilityLoaded
        ? buildSlotsPayload(today, slotsForDate(availability, today), planned.today.slots, books)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availabilityLoaded, availability, today, planned, books],
  )

  useEffect(() => {
    if (!notifyEnabled || !notifyTopic.trim() || !slotsPayload) return
    void publishSlotsOnce(notifyTopic, slotsPayload)
  }, [notifyEnabled, notifyTopic, slotsPayload])

  // アプリを開いている間は、直近の終了時刻にその場で通知を送る。
  // サーバー側の定期実行（最大15分遅れ）より早く届く。タイトルを
  // 統一しているため、サーバー側の二重送信防止にもかかる。
  useSlotEndReminder(notifyEnabled, notifyTopic, slotsPayload)

  const handleRecord = async (slotKey: string, bookId: string) => {
    const raw = inputs[slotKey] ?? ''
    const pages = Number(raw)
    if (!Number.isInteger(pages) || pages < 1) return
    await addProgress(bookId, today, pages)
    setInputs((p) => ({ ...p, [slotKey]: '' }))
    // 速度学習: その日に割り当てられた時間の合計
    const todayMin = planned.today.slots
      .filter((s) => s.bookId === bookId)
      .reduce((sum, s) => sum + (s.endMin - s.startMin), 0)
    if (todayMin > 0) {
      const book = books.find((b) => b.id === bookId)
      if (book) {
        const current = effectiveSpeed(book.minutesPerPage, book.subject)
        const next = learnSpeed(current, todayMin, pages)
        if (next !== current) {
          await saveBook(
            { ...book, minutesPerPage: next, updatedAt: new Date().toISOString() },
            false,
          )
        }
      }
    }
  }

  return (
    <div data-testid="today-plan-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>今日の計画</h1>
      {planned.notice && (
        <p data-testid="plan-notice" style={{ color: 'var(--text-dim)' }}>
          {planned.notice}
        </p>
      )}
      {planned.today.slots.length === 0 ? (
        <p data-testid="empty-availability-notice" style={{ color: 'var(--text-dim)' }}>
          今日の割り当てはありません。
          <button data-testid="go-settings" type="button" onClick={onSettings}>
            空き時間を設定
          </button>
        </p>
      ) : (
        <div data-testid="today-table">
          {planned.today.slots.map((s, i) => {
            const book = books.find((b) => b.id === s.bookId)
            const inputKey = `${s.bookId}-${s.startMin}-${i}`
            return (
              <div
                key={`${s.startMin}-${s.bookId}-${i}`}
                data-testid={`plan-row-${i}`}
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}
              >
                <CoverImage src={book?.coverUrl ?? null} width={48} height={68} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div
                    data-testid="plan-row-book"
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {book?.title ?? s.bookId}
                  </div>
                  {book && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        data-testid={`plan-input-${s.bookId}`}
                        type="number"
                        inputMode="numeric"
                        value={inputs[inputKey] ?? ''}
                        onChange={(e) =>
                          setInputs((p) => ({ ...p, [inputKey]: e.target.value }))
                        }
                        placeholder="ページ"
                        style={{ flex: 1, width: 'auto', minWidth: 0, margin: 0 }}
                      />
                      <button
                        data-testid={`plan-record-${s.bookId}`}
                        type="button"
                        style={{ flexShrink: 0 }}
                        onClick={() => void handleRecord(inputKey, s.bookId)}
                      >
                        記録
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, color: 'var(--text-dim)' }}>
                    <div data-testid="plan-row-hours">
                      {fmt(s.startMin)}-{fmt(s.endMin)}
                    </div>
                    <div data-testid="plan-row-pages">予定 {s.pages}ページ</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {cycleBooks.length > 0 && (
        <div data-testid="cycle-today-list" style={{ marginTop: 16 }}>
          {cycleBooks.map((book) => {
            const mine = cycleRecords.filter((r) => r.bookId === book.id)
            const done = calcCycleDonePairs(book, mine)
            const target = calcCycleDailyTarget(book, done, daysBetween(today, book.deadline))
            return (
              <div key={book.id}>
                {book.title} 今日やる区画 {target}区画
              </div>
            )
          })}
        </div>
      )}
      <div data-testid="upcoming-list" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>今後数日</h2>
        {planned.upcoming.map((u) => (
          <div key={u.date} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{formatJaDate(u.date)}</div>
            {u.items.map((it) => {
              const book = books.find((b) => b.id === it.bookId)
              return (
                <div
                  key={it.bookId}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: 8,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    marginTop: 4,
                    fontSize: 15,
                  }}
                >
                  <CoverImage src={book?.coverUrl ?? null} width={40} height={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div data-testid="upcoming-title">
                      {book?.title ?? it.bookId}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                      {it.minutes}分・{it.pages}ページ
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <button data-testid="today-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}

function fmt(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}