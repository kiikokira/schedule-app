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
import { generateDayPlan, effectiveSpeed, learnSpeed, slotsForDate, parseTimeToMin, findAtRiskBooks, type ScheduledBook, type PlanSlot } from '../lib/dayplan'
import { todayStr, formatJaDate, daysBetween, parseDate, calcCycleDonePairs, calcCycleDailyTarget, currentCycleRound, type BookData } from '../lib/progress'
import { getNotifySettings } from '../lib/notify'
import { buildSlotsPayload } from '../lib/slotNotify'
import { publishSlotsOnce, syncSlotSchedules } from '../lib/slotsPublish'
import { isLeapBook } from '../lib/leap'
import { loadFocusPeriods, selectedBookIds } from '../data/focusPeriods'
import { loadOverridePresets, type OverridePreset } from '../data/overridePresets'
import CoverImage from '../components/CoverImage'

type Props = {
  onBack: () => void
  onSettings: () => void
  today?: string
  onSchool?: () => void
  onRebalance?: (bookId: string) => void
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

type CyclesPin = { startMin: number; endMin: number; bookId: string; onTrain?: boolean }

type DisplayedRow = {
  slot: PlanSlot
  planIndex: number | null
  rangeKey: string | null
  savedBookId: string | undefined
}

function rangeKeyOf(startMin: number, endMin: number): string {
  return `${startMin}-${endMin}`
}

// 反復本の固定を自動割当に上書き合成する。ページ枠の重なりはくり抜き、
// 反復枠を挿入する。自動割当ロジック自体は変えない。
function overlayCyclesPins(
  slots: PlanSlot[],
  pins: CyclesPin[],
  books: BookData[],
): PlanSlot[] {
  if (pins.length === 0) return slots
  const byId = new Map(books.map((b) => [b.id, b]))
  const sortedPins = [...pins].sort((a, b) => a.startMin - b.startMin)
  const out: PlanSlot[] = []
  const slicePages = (s: PlanSlot, from: number, to: number): number => {
    const minutes = to - from
    if (minutes <= 0) return 0
    const book = byId.get(s.bookId)
    if (book) {
      return Math.max(Math.floor(minutes / effectiveSpeed(book.minutesPerPage, book.subject)), 0)
    }
    const total = s.endMin - s.startMin
    return total > 0 ? Math.round((s.pages * minutes) / total) : 0
  }
  for (const s of slots) {
    let cur = s.startMin
    for (const p of sortedPins) {
      if (p.endMin <= cur || p.startMin >= s.endMin) continue
      if (p.startMin > cur) {
        const end = Math.min(p.startMin, s.endMin)
        out.push({ ...s, startMin: cur, endMin: end, pages: slicePages(s, cur, end) })
      }
      cur = Math.max(cur, p.endMin)
    }
    if (cur < s.endMin) {
      out.push({ ...s, startMin: cur, pages: slicePages(s, cur, s.endMin) })
    }
  }
  const covered: { startMin: number; endMin: number }[] = []
  for (const p of sortedPins) {
    // 既に別の固定で埋まった部分を除いて挿入する
    const pieces: { startMin: number; endMin: number }[] = []
    let cur = p.startMin
    const blockers = covered
      .filter((c) => c.endMin > cur && c.startMin < p.endMin)
      .sort((a, b) => a.startMin - b.startMin)
    for (const c of blockers) {
      if (c.startMin > cur) pieces.push({ startMin: cur, endMin: Math.min(c.startMin, p.endMin) })
      cur = Math.max(cur, c.endMin)
    }
    if (cur < p.endMin) pieces.push({ startMin: cur, endMin: p.endMin })
    const book = byId.get(p.bookId)
    for (const piece of pieces) {
      const minutes = piece.endMin - piece.startMin
      const pages =
        book && book.studyMode !== 'cycles'
          ? Math.max(Math.floor(minutes / effectiveSpeed(book.minutesPerPage, book.subject)), 0)
          : 0
      out.push({ startMin: piece.startMin, endMin: piece.endMin, bookId: p.bookId, pages, onTrain: p.onTrain })
      covered.push(piece)
    }
  }
  return out.sort((a, b) => a.startMin - b.startMin)
}

export default function TodayPlanScreen({ onBack, onSettings, today: todayProp, onSchool, onRebalance }: Props) {
  const { books: allBooks, saveBook } = useBooks()
  const { records, addProgress } = useRecords()
  const { cycleRecords, addCycle } = useCycleRecords()
  const today = todayProp ?? todayStr()
  // テスト期間中は選択本だけを対象にする（選択外は計画に出さない）
  const [focusPeriods] = useState(loadFocusPeriods)
  const focusIds = selectedBookIds(focusPeriods, today)
  const books = focusIds === null ? allBooks : allBooks.filter((b) => focusIds.includes(b.id))
  const focusTitles = focusPeriods
    .filter((p) => p.startDate <= today && today <= p.endDate)
    .map((p) => p.title)
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof listAvailability>>>([])
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [bookOverrides, setBookOverrides] = useState<Record<number, string>>({})
  const [pinOverrides, setPinOverrides] = useState<Record<string, { bookId: string; onTrain?: boolean }>>({})
  const [cycleInputs, setCycleInputs] = useState<Record<string, string>>({})
  const [cycleErrors, setCycleErrors] = useState<Record<string, string>>({})
  const [dayRows, setDayRows] = useState<DayRow[]>([])
  const [dayRowsInit, setDayRowsInit] = useState(false)
  const [dayMessage, setDayMessage] = useState<string | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [presets, setPresets] = useState<OverridePreset[]>(() => loadOverridePresets())
  const [presetId, setPresetId] = useState('')

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
  const allPageBooks = allBooks.filter((b) => b.studyMode !== 'cycles')
  const allCycleBooks = allBooks.filter((b) => b.studyMode === 'cycles')
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
  // 期限に間に合わない本の警告用。開始前の本も含めて将来の期限と調整する。
  // 期限自体は変えず、不足分の再配分は見直し先の再調整画面に任せる。
  const risks = findAtRiskBooks({ books: scheduled, availability, today })

  // ページ本の差し替え（従来通り、planned の index 基準）
  const pageApplied: PlanSlot[] = planned.today.slots.map((s, i) => {
    const overrideId = bookOverrides[i]
    if (!overrideId || overrideId === s.bookId) return s
    const book = books.find((b) => b.id === overrideId)
    if (!book || book.studyMode === 'cycles') return s
    const minutes = s.endMin - s.startMin
    const mpp = effectiveSpeed(book.minutesPerPage, book.subject)
    return { ...s, bookId: overrideId, pages: Math.max(Math.floor(minutes / mpp), 0) }
  })

  // 保存済みの反復固定（空き時間の bookId 指定）
  const savedPins: CyclesPin[] = useMemo(() => {
    if (!availabilityLoaded) return []
    return slotsForDate(availability, today)
      .filter((s) => s.bookId && cycleBooks.some((b) => b.id === s.bookId))
      .map((s) => ({ startMin: s.startMin, endMin: s.endMin, bookId: s.bookId as string, onTrain: s.onTrain }))
  }, [availabilityLoaded, availability, today, cycleBooks])

  // 有効な固定の一覧。セッション指定が保存済みに優先する。
  const effectivePins: CyclesPin[] = useMemo(() => {
    const byRange = new Map<string, CyclesPin>()
    for (const p of savedPins) byRange.set(rangeKeyOf(p.startMin, p.endMin), p)
    for (const [key, pin] of Object.entries(pinOverrides)) {
      const [startMin, endMin] = key.split('-').map(Number)
      if (Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) {
        byRange.set(key, { startMin, endMin, bookId: pin.bookId, onTrain: pin.onTrain })
      }
    }
    return [...byRange.values()]
  }, [savedPins, pinOverrides])

  // 今日だけ上書きが曜日設定を隠している時間帯。上書きが優先される仕様のため、
  // 欠けた分は通知してワンタップで上書きに追加できるようにする。
  const shadowedSlots = useMemo(() => {
    const overrides = availability.filter((a) => a.date === today)
    if (overrides.length === 0) return []
    const todayWeekday = parseDate(today).getDay()
    return availability.filter(
      (a) =>
        a.weekday === todayWeekday &&
        !overrides.some((d) => d.start === a.start && d.end === a.end),
    )
  }, [availability, today])

  const handleMergeShadowed = async () => {
    for (const s of shadowedSlots) {
      await saveAvailabilitySlot(
        {
          id: crypto.randomUUID(),
          weekday: null,
          date: today,
          start: s.start,
          end: s.end,
          bookId: s.bookId,
          onTrain: s.onTrain,
        },
        true,
      )
    }
    await refreshAvailability()
  }

  const displayedRows: DisplayedRow[] = useMemo(() => {
    const savedByRange = new Map(savedPins.map((p) => [rangeKeyOf(p.startMin, p.endMin), p.bookId]))
    const merged = overlayCyclesPins(pageApplied, effectivePins, books)
    const rows: DisplayedRow[] = merged.map((slot) => {
      const key = rangeKeyOf(slot.startMin, slot.endMin)
      const isPin = effectivePins.some(
        (p) => p.startMin === slot.startMin && p.endMin === slot.endMin && p.bookId === slot.bookId,
      )
      const planIndex = isPin
        ? null
        : pageApplied.findIndex(
            (s) => s.startMin === slot.startMin && s.endMin === slot.endMin && s.bookId === slot.bookId,
          )
      return {
        slot,
        planIndex: planIndex !== null && planIndex >= 0 ? planIndex : null,
        rangeKey: isPin ? key : null,
        savedBookId: isPin ? savedByRange.get(key) : undefined,
      }
    })
    // 設定にあるのに割当が付かなかった時間帯は未割当枠として並べる（欠落防止）。
    // 汽車しぼり等で割当先が無い時間もここに現れ、本を選び直せる。
    // 表示上は上書きと曜日設定を統合する（計画分配自体は上書き優先のまま）。
    const covered = merged.map((s) => ({ startMin: s.startMin, endMin: s.endMin }))
    const displayBase = slotsForDate(availability, today)
    for (const a of shadowedSlots) {
      const startMin = parseTimeToMin(a.start)
      const endMin = parseTimeToMin(a.end)
      if (displayBase.some((b) => b.startMin === startMin && b.endMin === endMin)) continue
      displayBase.push({ startMin, endMin, onTrain: a.onTrain })
    }
    for (const s of displayBase) {
      let cur = s.startMin
      const blockers = covered
        .filter((c) => c.endMin > cur && c.startMin < s.endMin)
        .sort((a, b) => a.startMin - b.startMin)
      const gaps: { startMin: number; endMin: number }[] = []
      for (const c of blockers) {
        if (c.startMin > cur) gaps.push({ startMin: cur, endMin: Math.min(c.startMin, s.endMin) })
        cur = Math.max(cur, c.endMin)
      }
      if (cur < s.endMin) gaps.push({ startMin: cur, endMin: s.endMin })
      for (const g of gaps) {
        rows.push({
          slot: { startMin: g.startMin, endMin: g.endMin, bookId: '', pages: 0, onTrain: s.onTrain },
          planIndex: null,
          rangeKey: rangeKeyOf(g.startMin, g.endMin),
          savedBookId: undefined,
        })
      }
    }
    rows.sort((a, b) => a.slot.startMin - b.slot.startMin || a.slot.endMin - b.slot.endMin)
    return rows
  }, [pageApplied, effectivePins, savedPins, books, availability, today, shadowedSlots])

  const displayedSlots: PlanSlot[] = useMemo(
    () => displayedRows.map((r) => r.slot),
    [displayedRows],
  )

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

  // リマインダー用: その日の空き時間帯と終了予定をntfyへ送り、
  // 各枠の開始10分前に届くよう予約投稿する。
  const notify = getNotifySettings()
  const notifyEnabled = notify.enabled
  const notifyTopic = notify.topic
  const slotsPayload = useMemo(
    () =>
      availabilityLoaded
        ? buildSlotsPayload(today, slotsForDate(availability, today), displayedSlots, books)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availabilityLoaded, availability, today, planned, books, bookOverrides, pinOverrides],
  )

  useEffect(() => {
    if (!notifyEnabled || !notifyTopic.trim() || !slotsPayload) return
    void publishSlotsOnce(notifyTopic, slotsPayload)
    // 開始10分前に届くよう予約投稿する。題付き（本の名前入り）として記録し、
    // 起動時の無題予約で上書きされないようにする。直近に過ぎた分はその場で送る。
    void syncSlotSchedules(notifyTopic, slotsPayload, undefined, undefined, true)
  }, [notifyEnabled, notifyTopic, slotsPayload])

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
    setPinOverrides({})
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
    // 重なる時間帯は同じ予約IDで上書きし合い片方が届かなくなるため保存しない。
    // スケジュール画面の曜日設定と同じ検査にする。
    const sorted = [...rows].sort((a, b) => parseTimeToMin(a.start) - parseTimeToMin(b.start))
    for (let i = 1; i < sorted.length; i++) {
      if (parseTimeToMin(sorted[i].start) < parseTimeToMin(sorted[i - 1].end)) {
        setDayMessage('時間帯が重複しないようにしてください')
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
    setPinOverrides({})
    setDayRowsInit(false)
    setDayMessage('今日だけの時間と本を上書きしました')
    await refreshAvailability()
  }

  useEffect(() => {
    if (overrideOpen) setPresets(loadOverridePresets())
  }, [overrideOpen])

  const loadPresetById = (id: string) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    setDayRows(preset.rows.map((r) => ({ ...r })))
    setDayMessage(`プリセット「${preset.name}」を入力しました`)
  }

  const applyPreset = () => {
    loadPresetById(presetId)
  }

  const handlePresetSelect = (id: string) => {
    setPresetId(id)
    if (!id) return
    loadPresetById(id)
  }

  const handleCycleRecord = async (slotKey: string, book: BookData) => {
    const totalUnits = book.totalUnits ?? 0
    const targetRounds = book.targetRounds ?? 0
    const unit = isLeapBook(book) ? '語' : '区画'
    const from = Number(cycleInputs[`${slotKey}-from`] ?? '')
    const to = Number(cycleInputs[`${slotKey}-to`] ?? '')
    const roundInput = (cycleInputs[`${slotKey}-round`] ?? '').trim()
    const mine = cycleRecords.filter((r) => r.bookId === book.id)
    const round = roundInput === '' ? currentCycleRound(book, mine) : Number(roundInput)
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to < from ||
      to > totalUnits
    ) {
      setCycleErrors((p) => ({ ...p, [slotKey]: `${unit}の範囲を正しく入力してください` }))
      return
    }
    if (!Number.isInteger(round) || round < 1 || round > targetRounds) {
      setCycleErrors((p) => ({ ...p, [slotKey]: '周回は1〜目標周回の範囲で入力してください' }))
      return
    }
    try {
      await addCycle({ id: crypto.randomUUID(), bookId: book.id, date: today, unitFrom: from, unitTo: to, round, recordedAt: new Date().toISOString() })
    } catch {
      setCycleErrors((p) => ({ ...p, [slotKey]: '記録に失敗しました。もう一度お試しください' }))
      return
    }
    setCycleErrors((p) => {
      const next = { ...p }
      delete next[slotKey]
      return next
    })
    setCycleInputs((p) => {
      const next = { ...p }
      delete next[`${slotKey}-from`]
      delete next[`${slotKey}-to`]
      delete next[`${slotKey}-round`]
      return next
    })
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
      {availability.length > 0 && risks.length > 0 && (
        <div
          data-testid="deadline-risk-section"
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #f0a0a0',
            fontSize: 14,
          }}
        >
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>期限に間に合わない本があります</p>
          {risks.map((r) => {
            const book = books.find((b) => b.id === r.bookId) ?? allBooks.find((b) => b.id === r.bookId)
            return (
              <div
                key={r.bookId}
                data-testid={`deadline-risk-${r.bookId}`}
                style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}
              >
                <span>
                  {book?.title ?? r.bookId} あと{r.remainingPages}ページ（{r.shortfallPages}ページ不足）
                </span>
                {onRebalance && (
                  <button
                    data-testid={`deadline-risk-rebalance-${r.bookId}`}
                    type="button"
                    onClick={() => onRebalance(r.bookId)}
                  >
                    見直す
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {focusIds !== null && (
        <p data-testid="focus-period-notice" style={{ fontWeight: 700 }}>
          テスト期間中のため{focusTitles.join('・')}の選択本だけ表示しています
        </p>
      )}
      {planned.notice && (
        <p data-testid="plan-notice" style={{ color: 'var(--text-dim)' }}>
          {planned.notice}
        </p>
      )}
      {shadowedSlots.length > 0 && (
        <div
          data-testid="override-shadow-notice"
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fff8e1',
            border: '1px solid #f0d060',
            fontSize: 13,
          }}
        >
          <p style={{ margin: '0 0 8px' }}>
            今日は上書き表示中のため、曜日設定の次の時間は表示されません：
            {shadowedSlots.map((s) => `${s.start}〜${s.end}`).join('、')}
          </p>
          <button data-testid="override-shadow-merge" type="button" onClick={() => void handleMergeShadowed()}>
            上書きに追加して表示する
          </button>
        </div>
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
          {displayedRows.map((row, i) => {
            const { slot: s } = row
            const book = books.find((b) => b.id === s.bookId) ?? allBooks.find((b) => b.id === s.bookId)
            const isCycles = book?.studyMode === 'cycles'
            // 未割当行と対象外の本が付いた行では全参考書から選べる
            const showAllBooks = s.bookId === '' || !books.some((b) => b.id === s.bookId)
            const inputKey = `${s.bookId}-${s.startMin}-${i}`
            const mine = isCycles && book ? cycleRecords.filter((r) => r.bookId === book.id) : []
            const cycleDone = isCycles && book ? calcCycleDonePairs(book, mine) : 0
            const cycleTarget =
              isCycles && book ? calcCycleDailyTarget(book, cycleDone, daysBetween(today, book.deadline)) : 0
            const cycleRound = isCycles && book ? currentCycleRound(book, mine) : 1
            const handlePick = (pickedId: string) => {
              const picked = books.find((b) => b.id === pickedId)
              if (row.planIndex !== null) {
                if (picked && picked.studyMode === 'cycles') {
                  setPinOverrides((p) => ({
                    ...p,
                    [rangeKeyOf(s.startMin, s.endMin)]: { bookId: pickedId, onTrain: s.onTrain },
                  }))
                  setBookOverrides((p) => {
                    const next = { ...p }
                    delete next[row.planIndex as number]
                    return next
                  })
                } else {
                  setBookOverrides((p) => ({ ...p, [row.planIndex as number]: pickedId }))
                }
              } else if (row.rangeKey) {
                setPinOverrides((p) => ({
                  ...p,
                  [row.rangeKey as string]: { bookId: pickedId, onTrain: s.onTrain },
                }))
              }
            }
            const showReset =
              row.planIndex !== null
                ? !!bookOverrides[row.planIndex] &&
                  bookOverrides[row.planIndex] !== planned.today.slots[row.planIndex]?.bookId
                : !!(
                    row.rangeKey &&
                    pinOverrides[row.rangeKey] &&
                    pinOverrides[row.rangeKey].bookId !== row.savedBookId
                  )
            const handleReset = () => {
              if (row.planIndex !== null) {
                setBookOverrides((p) => {
                  const next = { ...p }
                  delete next[row.planIndex as number]
                  return next
                })
              } else if (row.rangeKey) {
                setPinOverrides((p) => {
                  const next = { ...p }
                  delete next[row.rangeKey as string]
                  return next
                })
              }
            }
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
                    {s.onTrain ? '【汽車】' : ''}{isCycles ? '【反復】' : ''}{book?.title ?? (s.bookId === '' ? '未割当' : s.bookId)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      data-testid={`plan-book-select-${i}`}
                      value={s.bookId}
                      onChange={(e) => handlePick(e.target.value)}
                      aria-label="この時間にする本を選び直す"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <option value="" disabled>
                        本を選ぶ
                      </option>
                      {(showAllBooks ? allPageBooks : pageBooks).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.trainFit === 'train' ? '【汽車】' : b.trainFit === 'home' ? '【自宅】' : ''}{b.title}
                        </option>
                      ))}
                      {(showAllBooks ? allCycleBooks : cycleBooks).map((b) => (
                        <option key={b.id} value={b.id}>
                          【反復】{b.title}
                        </option>
                      ))}
                    </select>
                    {showReset && (
                      <button
                        data-testid={`plan-reset-${i}`}
                        type="button"
                        onClick={handleReset}
                      >
                        元に戻す
                      </button>
                    )}
                  </div>
                  {book && !isCycles && (
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
                  {book && isCycles && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        data-testid={`plan-cycle-from-${s.bookId}`}
                        type="number"
                        inputMode="numeric"
                        value={cycleInputs[`${inputKey}-from`] ?? ''}
                        onChange={(e) =>
                          setCycleInputs((p) => ({ ...p, [`${inputKey}-from`]: e.target.value }))
                        }
                        placeholder={isLeapBook(book) ? '開始語' : '開始区画'}
                        style={{ flex: 1, width: 'auto', minWidth: 0, margin: 0 }}
                      />
                      <input
                        data-testid={`plan-cycle-to-${s.bookId}`}
                        type="number"
                        inputMode="numeric"
                        value={cycleInputs[`${inputKey}-to`] ?? ''}
                        onChange={(e) =>
                          setCycleInputs((p) => ({ ...p, [`${inputKey}-to`]: e.target.value }))
                        }
                        placeholder={isLeapBook(book) ? '終了語' : '終了区画'}
                        style={{ flex: 1, width: 'auto', minWidth: 0, margin: 0 }}
                      />
                      <input
                        data-testid={`plan-cycle-round-${s.bookId}`}
                        type="number"
                        inputMode="numeric"
                        value={cycleInputs[`${inputKey}-round`] ?? ''}
                        onChange={(e) =>
                          setCycleInputs((p) => ({ ...p, [`${inputKey}-round`]: e.target.value }))
                        }
                        placeholder={`周回（今${cycleRound}周目）`}
                        style={{ flex: 1, width: 'auto', minWidth: 0, margin: 0 }}
                      />
                      <button
                        data-testid={`plan-cycle-record-${s.bookId}`}
                        type="button"
                        style={{ flexShrink: 0 }}
                        onClick={() => void handleCycleRecord(inputKey, book)}
                      >
                        記録
                      </button>
                    </div>
                  )}
                  {book && isCycles && cycleErrors[inputKey] && (
                    <div data-testid={`plan-cycle-error-${s.bookId}`} style={{ color: 'var(--danger)', fontSize: 13 }}>
                      {cycleErrors[inputKey]}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, color: 'var(--text-dim)' }}>
                    <div data-testid="plan-row-hours">
                      {fmt(s.startMin)}-{fmt(s.endMin)}
                    </div>
                    {isCycles ? (
                      <div data-testid="plan-row-units">今日やる{book && isLeapBook(book) ? '語' : '区画'} {cycleTarget}{book && isLeapBook(book) ? '語' : '区画'}</div>
                    ) : (
                      <div data-testid="plan-row-pages">予定 {s.pages}ページ</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {(Object.keys(bookOverrides).length > 0 || Object.keys(pinOverrides).length > 0) && (
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
        <button
          data-testid="today-override-toggle"
          type="button"
          style={{ marginBottom: 8 }}
          onClick={() => setOverrideOpen((v) => !v)}
        >
          {overrideOpen ? '閉じる' : '開く'}
        </button>
        {overrideOpen && (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              急な予定が入ったときは、ここで今日の時間と本を変えられます。曜日ごとの設定には影響しません。
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <select
                data-testid="today-override-preset-select"
                value={presetId}
                onChange={(e) => handlePresetSelect(e.target.value)}
                aria-label="プリセット"
              >
                <option value="">プリセットを選ぶ</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button data-testid="today-override-preset-apply" type="button" onClick={applyPreset}>
                適用
              </button>
            </div>
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
              {cycleBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  【反復】{b.title}
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
          </>
        )}
      </div>
      {cycleBooks.length > 0 && (
        <div data-testid="cycle-today-list" style={{ marginTop: 16 }}>
          {cycleBooks.map((book) => {
            const mine = cycleRecords.filter((r) => r.bookId === book.id)
            const done = calcCycleDonePairs(book, mine)
            const target = calcCycleDailyTarget(book, done, daysBetween(today, book.deadline))
            const unit = isLeapBook(book) ? '語' : '区画'
            return (
              <div key={book.id}>
                {book.title} 今日やる{unit} {target}{unit}
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
      <div data-testid="school-events-section" style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 16 }}>学校の日程</h2>
        <button
          data-testid="school-events-toggle"
          type="button"
          style={{ marginBottom: 8 }}
          onClick={() => onSchool?.()}
        >
          開く
        </button>
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