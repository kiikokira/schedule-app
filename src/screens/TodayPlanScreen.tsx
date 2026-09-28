import { useEffect, useMemo, useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import {
  listAvailability,
  saveAvailabilitySlot,
  deleteAvailabilitySlot,
  type AvailabilitySlot,
} from '../data/dayplanStore'
import { generateDayPlan, effectiveSpeed, learnSpeed, slotsForDate, type ScheduledBook, type PlanSlot } from '../lib/dayplan'
import { todayStr, formatJaDate, daysBetween, calcCycleDonePairs, calcCycleDailyTarget, type BookData } from '../lib/progress'
import { getNotifySettings } from '../lib/notify'
import { buildSlotsPayload } from '../lib/slotNotify'
import { publishSlotsOnce, syncSlotSchedules } from '../lib/slotsPublish'
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
    trainFit: b.trainFit,
  }
}

type DayRow = { start: string; end: string; bookId?: string; onTrain?: boolean }

function minToHHMM(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

export default function TodayPlanScreen({ onBack, onSettings, today: todayProp }: Props) {
  const { books, saveBook } = useBooks()
  const { records, addProgress } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof listAvailability>>>([])
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [bookOverrides, setBookOverrides] = useState<Record<number, string>>({})
  const [dayRows, setDayRows] = useState<DayRow[]>([])
  const [dayRowsInit, setDayRowsInit] = useState(false)
  const [dayMessage, setDayMessage] = useState<string | null>(null)

  const refreshAvailability = async () => {
    const a = await listAvailability()
    setAvailability(a)
    setAvailabilityLoaded(true)
    return a
  }

  useEffect(() => {
    void refreshAvailability()
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

  const displayedSlots: PlanSlot[] = planned.today.slots.map((s, i) => {
    const overrideId = bookOverrides[i]
    if (!overrideId || overrideId === s.bookId) return s
    const book = books.find((b) => b.id === overrideId)
    if (!book) return s
    const minutes = s.endMin - s.startMin
    const mpp = effectiveSpeed(book.minutesPerPage, book.subject)
    return { ...s, bookId: overrideId, pages: Math.max(Math.floor(minutes / mpp), 0) }
  })

  useEffect(() => {
    if (!availabilityLoaded || dayRowsInit) return
    const base = slotsForDate(availability, today)
    setDayRows(
      base.map((s) => ({
        start: minToHHMM(s.startMin),
        end: minToHHMM(s.endMin),
        bookId: s.bookId,
        onTrain: s.onTrain,
      })),
    )
    setDayRowsInit(true)
  }, [availabilityLoaded, availability, today, dayRowsInit])

  // リマインダー用: その日の空き時間帯と終了予定をntfyへ送る。
  // ワークフローが15分ごとに読み、終わった直後の時間帯だけ通知する。
  const notify = getNotifySettings()
  const notifyEnabled = notify.enabled
  const notifyTopic = notify.topic
  const slotsPayload = useMemo(
    () =>
      availabilityLoaded
        ? buildSlotsPayload(today, slotsForDate(availability, today), displayedSlots, books)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availabilityLoaded, availability, today, planned, books, bookOverrides],
  )

  useEffect(() => {
    if (!notifyEnabled || !notifyTopic.trim() || !slotsPayload) return
    void publishSlotsOnce(notifyTopic, slotsPayload)
    // 終了時刻ちょうどに届くよう予約投稿する（アプリが閉じていても配達される）
    void syncSlotSchedules(notifyTopic, slotsPayload)
  }, [notifyEnabled, notifyTopic, slotsPayload])

  // アプリを開いている間は、直近の終了時刻にその場で通知を送る。
  // サーバー側の定期実行（最大15分遅れ）より早く届く。タイトルを
  // 統一しているため、サーバー側の二重送信防止にもかかる。
  useSlotEndReminder(notifyEnabled, notifyTopic, slotsPayload)

  const saveTodayOverrides = async (slotsToSave: PlanSlot[]) => {
    const existing = await listAvailability()
    for (const s of existing.filter((a) => a.date === today)) {
      await deleteAvailabilitySlot(s.id)
    }
    for (const s of slotsToSave) {
      const slot: AvailabilitySlot = {
        id: crypto.randomUUID(),
        weekday: null,
        date: today,
        start: minToHHMM(s.startMin),
        end: minToHHMM(s.endMin),
        bookId: s.bookId,
        onTrain: s.onTrain || undefined,
      }
      await saveAvailabilitySlot(slot, true)
    }
    setBookOverrides({})
    setDayRowsInit(false)
    setDayMessage('今日だけの計画に上書きしました')
    await refreshAvailability()
  }

  const saveDayRows = async () => {
    const rows = dayRows.filter((r) => r.start && r.end)
    for (const r of rows) {
      const [sh, sm] = r.start.split(':').map(Number)
      const [eh, em] = r.end.split(':').map(Number)
      if (!Number.isFinite(sh) || !Number.isFinite(eh)) {
        setDayMessage('開始と終了を入力してください')
        return
      }
      if (eh * 60 + em <= sh * 60 + sm) {
        setDayMessage('終了時刻は開始時刻より後にしてください')
        return
      }
    }
    const existing = await listAvailability()
    for (const s of existing.filter((a) => a.date === today)) {
      await deleteAvailabilitySlot(s.id)
    }
    for (const r of rows) {
      const slot: AvailabilitySlot = {
        id: crypto.randomUUID(),
        weekday: null,
        date: today,
        start: r.start,
        end: r.end,
        bookId: r.bookId || undefined,
        onTrain: r.onTrain || undefined,
      }
      await saveAvailabilitySlot(slot, true)
    }
    setBookOverrides({})
    setDayRowsInit(false)
    setDayMessage('今日だけの時間と本を上書きしました')
    await refreshAvailability()
  }

  const handleRecord = async (slotKey: string, bookId: string) => {
    const raw = inputs[slotKey] ?? ''
    const pages = Number(raw)
    if (!Number.isInteger(pages) || pages < 1) return
    await addProgress(bookId, today, pages)
    setInputs((p) => ({ ...p, [slotKey]: '' }))
    // 速度学習: その日に割り当てられた時間の合計
    const todayMin = displayedSlots
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
      {displayedSlots.length === 0 ? (
        <p data-testid="empty-availability-notice" style={{ color: 'var(--text-dim)' }}>
          今日の割り当てはありません。
          <button data-testid="go-settings" type="button" onClick={onSettings}>
            空き時間を設定
          </button>
        </p>
      ) : (
        <div data-testid="today-table">
          {displayedSlots.map((s, i) => {
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
                    {s.onTrain ? '【汽車】' : ''}{book?.title ?? s.bookId}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      data-testid={`plan-book-select-${i}`}
                      value={s.bookId}
                      onChange={(e) =>
                        setBookOverrides((p) => ({ ...p, [i]: e.target.value }))
                      }
                      aria-label="この時間にする本を選び直す"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      {pageBooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.trainFit === 'train' ? '【汽車】' : b.trainFit === 'home' ? '【自宅】' : ''}{b.title}
                        </option>
                      ))}
                    </select>
                    {bookOverrides[i] && bookOverrides[i] !== planned.today.slots[i]?.bookId && (
                      <button
                        data-testid={`plan-reset-${i}`}
                        type="button"
                        onClick={() =>
                          setBookOverrides((p) => {
                            const next = { ...p }
                            delete next[i]
                            return next
                          })
                        }
                      >
                        元に戻す
                      </button>
                    )}
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
          {Object.keys(bookOverrides).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <button
                data-testid="save-today-override"
                type="button"
                onClick={() => void saveTodayOverrides(displayedSlots)}
              >
                選び直しを今日だけ固定する
              </button>
            </div>
          )}
        </div>
      )}
      <div data-testid="today-override-section" style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 16 }}>今日だけ上書き（時間も本も）</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          急な予定が入ったときは、ここで今日の時間と本を変えられます。曜日ごとの設定には影響しません。
        </p>
        {dayRows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <input
              data-testid={`today-override-start-${i}`}
              type="time"
              value={r.start}
              onChange={(e) =>
                setDayRows((rows) => rows.map((row, ri) => (ri === i ? { ...row, start: e.target.value } : row)))
              }
            />
            <span>〜</span>
            <input
              data-testid={`today-override-end-${i}`}
              type="time"
              value={r.end}
              onChange={(e) =>
                setDayRows((rows) => rows.map((row, ri) => (ri === i ? { ...row, end: e.target.value } : row)))
              }
            />
            <select
              data-testid={`today-override-book-${i}`}
              value={r.bookId ?? ''}
              onChange={(e) =>
                setDayRows((rows) =>
                  rows.map((row, ri) => (ri === i ? { ...row, bookId: e.target.value || undefined } : row)),
                )
              }
              aria-label="この時間にする本"
            >
              <option value="">おまかせ</option>
              {pageBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
              <input
                data-testid={`today-override-train-${i}`}
                type="checkbox"
                checked={!!r.onTrain}
                onChange={(e) =>
                  setDayRows((rows) => rows.map((row, ri) => (ri === i ? { ...row, onTrain: e.target.checked } : row)))
                }
              />
              汽車
            </label>
            <button
              data-testid={`today-override-delete-${i}`}
              type="button"
              onClick={() => setDayRows((rows) => rows.filter((_, ri) => ri !== i))}
            >
              削除
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            data-testid="today-override-add"
            type="button"
            onClick={() => setDayRows((rows) => [...rows, { start: '', end: '' }])}
          >
            時間帯を追加
          </button>
          <button data-testid="today-override-save" type="button" onClick={() => void saveDayRows()}>
            今日だけ上書き保存
          </button>
        </div>
        {dayMessage && (
          <p data-testid="today-override-message" style={{ color: 'var(--accent-strong)' }}>
            {dayMessage}
          </p>
        )}
      </div>
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