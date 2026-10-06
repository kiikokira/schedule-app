import { useEffect, useState } from 'react'
import ProgressChart from '../components/ProgressChart'
import CoverImage from '../components/CoverImage'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import {
  calcTotalDone,
  calcDailyTarget,
  calcRequiredPerDay,
  daysBetween,
  formatJaDate,
  formatJaTime,
  todayStr,
  parseDate,
  calcCycleDonePairs,
  calcCycleDailyTarget,
  cycleGrandTotal,
  currentCycleRound,
  expandCyclePairs,
  type BookData,
  type ProgressRecordData,
  type CycleRecordData,
} from '../lib/progress'
import { LEAP_WORD_RANGES, isLeapBook } from '../lib/leap'
import { listAvailability, type AvailabilitySlot } from '../data/dayplanStore'

function slotsForRecordDate(slots: AvailabilitySlot[], dateStr: string): AvailabilitySlot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return []
  const weekday = parseDate(dateStr).getDay()
  return slots
    .filter((s) => s.date === dateStr || (s.date === null && s.weekday === weekday))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

function buildRecordedAt(dateStr: string, hhmm: string): string {
  const d = parseDate(dateStr)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString()
}

type Props = {
  bookId: string
  onBack: () => void
  onEdit: (id: string) => void
}

export default function BookDetailScreen({ bookId, onBack, onEdit }: Props) {
  const { books, removeBook } = useBooks()
  const { records, addProgress, updateRecord, deleteRecord } = useRecords()
  const { cycleRecords, addCycle, updateCycle, removeCycle } = useCycleRecords(bookId)
  const [pagesInput, setPagesInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editPages, setEditPages] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [cycleFrom, setCycleFrom] = useState('')
  const [cycleTo, setCycleTo] = useState('')
  const [cycleRoundInput, setCycleRoundInput] = useState('')
  const [cycleDate, setCycleDate] = useState('')
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [cycleEditingId, setCycleEditingId] = useState<string | null>(null)
  const [cycleEditFrom, setCycleEditFrom] = useState('')
  const [cycleEditTo, setCycleEditTo] = useState('')
  const [cycleEditRound, setCycleEditRound] = useState('')
  const [cycleEditDate, setCycleEditDate] = useState('')
  const [cycleEditError, setCycleEditError] = useState<string | null>(null)
  const [cycleEditSlot, setCycleEditSlot] = useState('')
  const [cycleNewSlot, setCycleNewSlot] = useState('')
  const [recordEditSlot, setRecordEditSlot] = useState('')
  const [recordNewSlot, setRecordNewSlot] = useState('')
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [leapBlock, setLeapBlock] = useState<number | null>(null)
  const [showCycleList, setShowCycleList] = useState(false)

  useEffect(() => {
    void listAvailability().then(setAvailability).catch(() => {})
  }, [])

  const book: BookData | undefined = books.find((b) => b.id === bookId)
  const today = todayStr()

  useEffect(() => {
    const tr = records.find((r) => r.bookId === book?.id && r.date === today)
    setPagesInput(tr ? String(tr.pages) : '')
  }, [book?.id, today])

  if (!book) {
    return (
      <div style={{ padding: 16 }}>
        <p>参考書が見つかりません。</p>
        <button onClick={onBack}>戻る</button>
      </div>
    )
  }

  if (book.studyMode === 'cycles') {
    const mine = cycleRecords
      .filter((r) => r.bookId === book.id)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date > b.date ? -1 : 1
        const at = a.recordedAt ?? ''
        const bt = b.recordedAt ?? ''
        if (at === bt) return 0
        return at > bt ? -1 : 1
      })
    const total = cycleGrandTotal(book)
    const done = calcCycleDonePairs(book, mine)
    const round = currentCycleRound(book, mine)
    const remainingDays = daysBetween(today, book.deadline)
    // 今日の目標は日割りノルマから当日分を差し引く（やり過ぎはマイナス表示）。
    // 翌日以降は増えた完了分で割り直されるため均等に均される。
    const doneBeforeToday = calcCycleDonePairs(
      book,
      mine.filter((r) => r.date !== today),
    )
    const target = calcCycleDailyTarget(book, doneBeforeToday, remainingDays) - (done - doneBeforeToday)
    const cyclePairs = expandCyclePairs(mine)
    const cycleTotalUnits = book.totalUnits ?? 0
    const cycleTargetRounds = book.targetRounds ?? 0
    const isLeap = isLeapBook(book)
    const unit = isLeap ? '語' : '区画'
    const roundFieldValue = cycleRoundInput !== '' ? cycleRoundInput : isLeap ? String(round) : ''
    const effectiveDate = isLeap ? today : cycleDate || today
    const dateOutOfRange = effectiveDate < book.startDate || effectiveDate > book.deadline
    const cycleRoundCoverage = Array.from({ length: cycleTargetRounds }, (_, i) => {
      const r = i + 1
      let covered = 0
      for (let u = 1; u <= cycleTotalUnits; u++) {
        if (cyclePairs.has(`${u}:${r}`)) covered++
      }
      return { round: r, covered }
    })

    const handleCycleRecord = async () => {
      const from = Number(cycleFrom)
      const to = Number(cycleTo)
      const roundNum = Number(roundFieldValue)
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > (book.totalUnits ?? 0)) {
        setCycleError(`${unit}の範囲を正しく入力してください`)
        return
      }
      if (isLeap && leapBlock != null) {
        const block = LEAP_WORD_RANGES[leapBlock]
        if (from < block.from || to > block.to) {
          setCycleError(`選択中の範囲（${block.from}-${block.to}語）の中で入力してください`)
          return
        }
      }
      if (!Number.isInteger(roundNum) || roundNum < 1 || roundNum > (book.targetRounds ?? 0)) {
        setCycleError(isLeap ? `目標周回は1〜${book.targetRounds}の範囲で入力してください` : '周回は1〜目標周回の範囲で入力してください')
        return
      }
      setCycleError(null)
      try {
        const recordedAt =
          cycleNewSlot !== ''
            ? buildRecordedAt(effectiveDate, cycleNewSlot)
            : new Date().toISOString()
        await addCycle({ id: crypto.randomUUID(), bookId: book.id, date: effectiveDate, unitFrom: from, unitTo: to, round: roundNum, recordedAt })
      } catch {
        setCycleError('記録に失敗しました。もう一度お試しください')
        return
      }
      setCycleFrom('')
      setCycleTo('')
      setCycleRoundInput('')
      setCycleNewSlot('')
    }

    const handleCycleDeleteBook = async () => {
      if (!window.confirm(`「${book.title}」を削除しますか？`)) return
      setCycleError(null)
      try {
        await removeBook(book.id)
        onBack()
      } catch {
        setCycleError('削除に失敗しました。もう一度お試しください')
      }
    }

    const handleCycleStartEdit = (record: CycleRecordData) => {
      setCycleEditingId(record.id)
      setCycleEditFrom(String(record.unitFrom))
      setCycleEditTo(String(record.unitTo))
      setCycleEditRound(String(record.round))
      setCycleEditDate(record.date)
      setCycleEditSlot('')
      setCycleEditError(null)
    }

    const handleCycleSaveEdit = async (record: CycleRecordData) => {
      const from = Number(cycleEditFrom)
      const to = Number(cycleEditTo)
      const roundNum = Number(cycleEditRound)
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > (book.totalUnits ?? 0)) {
        setCycleEditError(`${unit}の範囲を正しく入力してください`)
        return
      }
      if (!Number.isInteger(roundNum) || roundNum < 1 || roundNum > (book.targetRounds ?? 0)) {
        setCycleEditError('周回は1〜目標周回の範囲で入力してください')
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleEditDate)) {
        setCycleEditError('日付を入力してください')
        return
      }
      setCycleEditError(null)
      try {
        const patch: { date: string; unitFrom: number; unitTo: number; round: number; recordedAt?: string } = { date: cycleEditDate, unitFrom: from, unitTo: to, round: roundNum }
        if (cycleEditSlot !== '') patch.recordedAt = buildRecordedAt(cycleEditDate, cycleEditSlot)
        await updateCycle(record.id, patch)
        setCycleEditingId(null)
        setCycleEditSlot('')
      } catch {
        setCycleEditError('更新に失敗しました。もう一度お試しください')
      }
    }

    const handleCycleRecordDelete = async (record: CycleRecordData) => {
      if (!window.confirm(`${formatJaDate(record.date)}の記録を削除しますか？`)) return
      setCycleError(null)
      try {
        await removeCycle(record.id)
      } catch {
        setCycleError('削除に失敗しました。もう一度お試しください')
      }
    }

    return (
      <div style={{ padding: 16 }}>
        <button onClick={onBack}>← 戻る</button>
        <h1 data-testid="book-title" style={{ fontSize: 20 }}>
          {book.title}
        </h1>
        <CoverImage src={book.coverUrl ?? null} width={96} height={136} />
        <p data-testid="cycle-round-badge" style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', margin: '8px 0' }}>
          今{round}周目
        </p>
        <p data-testid="cycle-summary">
          完了パス <strong style={{ fontSize: 18 }}>{done} / {total}</strong>（全{book.totalUnits}{unit}×{book.targetRounds}周）
        </p>
        <p data-testid="cycle-round-coverage">
          {cycleRoundCoverage.map(({ round: r, covered }) => `${r}周目: ${covered}/${cycleTotalUnits}${unit}`).join(' ')}
        </p>
        <p>
          今日の目標: <strong data-testid="today-target" style={{ fontSize: 24 }}>{target}</strong> {unit}
        </p>
        <p>
          残り <strong style={{ fontSize: 18 }}>{Math.max(total - done, 0)} {unit}</strong> / 期限まで{' '}
          <strong>{Math.max(remainingDays, 0)} 日</strong>
        </p>
        <div style={{ margin: '16px 0' }}>
          <p>反復の記録</p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 4px' }}>
            {isLeap
              ? 'やった範囲の開始語・終了語を入力してください（今日・今の周回で記録）'
              : `やった範囲の開始${unit}・終了${unit}・周回・日付（空なら今日）を入力してください`}
          </p>
          {isLeap && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {LEAP_WORD_RANGES.map(({ from, to }, i) => (
                <button
                  key={`${from}-${to}`}
                  data-testid={`leap-preset-${from}-${to}`}
                  type="button"
                  aria-pressed={leapBlock === i}
                  style={leapBlock === i ? { borderWidth: 2, borderColor: 'var(--accent)', fontWeight: 700 } : undefined}
                  onClick={() => {
                    setLeapBlock(leapBlock === i ? null : i)
                  }}
                >
                  {from}-{to}
                </button>
              ))}
            </div>
          )}
          {isLeap && leapBlock != null && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 4px' }}>
              選択中：{LEAP_WORD_RANGES[leapBlock].from}〜{LEAP_WORD_RANGES[leapBlock].to}語の中で開始語・終了語を入力
            </p>
          )}
          <label htmlFor="cycle-from">開始{unit}</label>
          <input
            id="cycle-from"
            data-testid="cycle-from"
            type="number"
            inputMode="numeric"
            value={cycleFrom}
            onChange={(e) => setCycleFrom(e.target.value)}
            placeholder="例: 1"
          />
          <label htmlFor="cycle-to">終了{unit}</label>
          <input
            id="cycle-to"
            data-testid="cycle-to"
            type="number"
            inputMode="numeric"
            value={cycleTo}
            onChange={(e) => setCycleTo(e.target.value)}
            placeholder="例: 12"
          />
          <label htmlFor="cycle-round">{isLeap ? '目標周回' : '周回'}</label>
          <input
            id="cycle-round"
            data-testid="cycle-round"
            type="number"
            inputMode="numeric"
            value={roundFieldValue}
            onChange={(e) => setCycleRoundInput(e.target.value)}
            placeholder={isLeap ? `例: ${round}` : '例: 1'}
          />
          {isLeap && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 4px' }}>
              目標{book.targetRounds}周中の今{round}周目に記録
            </p>
          )}
          {!isLeap && (
            <>
              <label htmlFor="cycle-date">日付</label>
              <input
                id="cycle-date"
                data-testid="cycle-date"
                type="date"
                value={cycleDate}
                onChange={(e) => { setCycleDate(e.target.value); setCycleNewSlot('') }}
              />
            </>
          )}
          {(() => {
            const newSlots = slotsForRecordDate(availability, effectiveDate)
            if (newSlots.length === 0) return null
            return (
              <>
                <label htmlFor="cycle-slot-new">空き時間から選択</label>
                <select
                  id="cycle-slot-new"
                  data-testid="cycle-slot-new"
                  value={cycleNewSlot}
                  onChange={(e) => setCycleNewSlot(e.target.value)}
                >
                  <option value="">時刻を選ぶ（任意）</option>
                  {newSlots.map((s) => (
                    <option key={s.id} value={s.start}>
                      {s.start}〜{s.end}
                    </option>
                  ))}
                </select>
              </>
            )
          })()}
          <button data-testid="cycle-record" type="button" onClick={() => void handleCycleRecord()}>
            範囲を記録
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>記録するごとに進捗に加算されます（同じ範囲の繰り返しも含む）</p>
          {cycleError && (
            <p data-testid="cycle-error" style={{ color: 'var(--danger)' }}>
              {cycleError}
            </p>
          )}
          {dateOutOfRange && <p data-testid="cycle-date-warning">日付が開始日〜期限日の範囲外です</p>}
        </div>
        {mine.length > 0 && (
          <section style={{ marginTop: 16 }}>
            <button
              data-testid="cycle-list-toggle"
              type="button"
              aria-expanded={showCycleList}
              onClick={() => setShowCycleList((v) => !v)}
              style={{ fontSize: 16, fontWeight: 700 }}
            >
              記録一覧（{mine.length}件） {showCycleList ? '▼' : '▶'}
            </button>
            {showCycleList &&
              (() => {
                const groups = new Map<string, typeof mine>()
                for (const r of mine) {
                  const list = groups.get(r.date)
                  if (list) list.push(r)
                  else groups.set(r.date, [r])
                }
                return [...groups.entries()].map(([date, recs]) => (
                  <div key={date}>
                    <div data-testid={`cycle-date-${date}`} style={{ fontWeight: 700, marginTop: 8 }}>
                      {formatJaDate(date)}
                    </div>
                    {recs.map((record) => (
                      <div
                        key={record.id}
                        data-testid={`cycle-row-${record.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 0',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                        }}
                      >
                        {cycleEditingId === record.id ? (
                          <div
                            data-testid={`cycle-edit-form-${record.id}`}
                            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 1 }}
                          >
                            <label htmlFor={`cycle-edit-from-${record.id}`}>開始{unit}</label>
                            <input
                              id={`cycle-edit-from-${record.id}`}
                              data-testid={`cycle-edit-from-${record.id}`}
                              type="number"
                              inputMode="numeric"
                              value={cycleEditFrom}
                              onChange={(e) => setCycleEditFrom(e.target.value)}
                              placeholder="例: 1"
                              style={{ width: 72 }}
                            />
                            <label htmlFor={`cycle-edit-to-${record.id}`}>終了{unit}</label>
                            <input
                              id={`cycle-edit-to-${record.id}`}
                              data-testid={`cycle-edit-to-${record.id}`}
                              type="number"
                              inputMode="numeric"
                              value={cycleEditTo}
                              onChange={(e) => setCycleEditTo(e.target.value)}
                              placeholder="例: 12"
                              style={{ width: 72 }}
                            />
                            <label htmlFor={`cycle-edit-round-${record.id}`}>周回</label>
                            <input
                              id={`cycle-edit-round-${record.id}`}
                              data-testid={`cycle-edit-round-${record.id}`}
                              type="number"
                              inputMode="numeric"
                              value={cycleEditRound}
                              onChange={(e) => setCycleEditRound(e.target.value)}
                              placeholder="例: 1"
                              style={{ width: 64 }}
                            />
                            <label htmlFor={`cycle-edit-date-${record.id}`}>日付</label>
                            <input
                              id={`cycle-edit-date-${record.id}`}
                              data-testid={`cycle-edit-date-${record.id}`}
                              type="date"
                              value={cycleEditDate}
                              onChange={(e) => { setCycleEditDate(e.target.value); setCycleEditSlot('') }}
                              style={{ flex: '1 1 140px', minWidth: 140 }}
                            />
                            {(() => {
                              const editSlots = slotsForRecordDate(availability, cycleEditDate)
                              if (editSlots.length === 0) return null
                              return (
                                <>
                                  <label htmlFor={`cycle-slot-${record.id}`}>時間</label>
                                  <select
                                    id={`cycle-slot-${record.id}`}
                                    data-testid={`cycle-slot-${record.id}`}
                                    value={cycleEditSlot}
                                    onChange={(e) => setCycleEditSlot(e.target.value)}
                                    style={{ flex: '1 1 140px', minWidth: 140 }}
                                  >
                                    <option value="">空き時間から選択</option>
                                    {editSlots.map((s) => (
                                      <option key={s.id} value={s.start}>
                                        {s.start}〜{s.end}
                                      </option>
                                    ))}
                                  </select>
                                </>
                              )
                            })()}
                            <button
                              data-testid={`cycle-save-${record.id}`}
                              type="button"
                              onClick={() => void handleCycleSaveEdit(record)}
                            >
                              保存
                            </button>
                            <button
                              data-testid={`cycle-cancel-${record.id}`}
                              type="button"
                              onClick={() => { setCycleEditingId(null); setCycleEditSlot('') }}
                            >
                              キャンセル
                            </button>
                            {cycleEditError && (
                              <p
                                data-testid={`cycle-edit-error-${record.id}`}
                                style={{ color: 'var(--danger)', fontSize: 12, flexBasis: '100%' }}
                              >
                                {cycleEditError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <span style={{ flex: 1 }}>
                              {record.unitFrom}-{record.unitTo}
                              {unit} {record.round}周目{record.recordedAt ? ` ${formatJaTime(record.recordedAt)}` : ''}
                            </span>
                            <button
                              data-testid={`cycle-edit-${record.id}`}
                              type="button"
                              onClick={() => handleCycleStartEdit(record)}
                            >
                              編集
                            </button>
                            <button
                              data-testid={`cycle-delete-${record.id}`}
                              type="button"
                              onClick={() => void handleCycleRecordDelete(record)}
                              style={{ color: 'var(--danger)' }}
                            >
                              削除
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              })()}
          </section>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => onEdit(book.id)}>編集</button>
          <button onClick={() => void handleCycleDeleteBook()} style={{ color: 'var(--danger)' }}>
            削除
          </button>
        </div>
      </div>
    )
  }

  const todayRecord = records.find((r) => r.bookId === book.id && r.date === today)

  const done = calcTotalDone(book, records)
  const remainingDays = daysBetween(today, book.deadline)
  const doneBeforeToday = done - (todayRecord?.pages ?? 0)
  const target = calcDailyTarget(book, doneBeforeToday, remainingDays) - (todayRecord?.pages ?? 0)

  const todayPages = (() => {
    const p = Number(pagesInput)
    if (Number.isInteger(p) && p >= 1) return p
    return todayRecord?.pages ?? 0
  })()
  const requiredPerDay = calcRequiredPerDay(
    book,
    doneBeforeToday,
    todayPages,
    remainingDays,
  )

  const bookRecords = records
    .filter((r) => r.bookId === book.id)
    .sort((a, b) => (a.date > b.date ? -1 : 1))
  const todayValues = bookRecords.map((r) => r.pages)

  const handleRecord = async () => {
    const pages = Number(pagesInput)
    if (!Number.isInteger(pages) || pages < 1) {
      setError('ページ数は1以上の整数で入力してください')
      return
    }
    setError(null)
    try {
      const recordedAt = recordNewSlot !== '' ? buildRecordedAt(today, recordNewSlot) : undefined
      await addProgress(book.id, today, pages, recordedAt)
    } catch {
      setError('記録に失敗しました。もう一度お試しください')
      return
    }
    setPagesInput('')
    setRecordNewSlot('')
  }

  const handleDelete = async () => {
    if (!window.confirm(`「${book.title}」を削除しますか？`)) return
    setError(null)
    try {
      await removeBook(book.id)
      onBack()
    } catch {
      setError('削除に失敗しました。もう一度お試しください')
    }
  }

  const handleStartEdit = (record: ProgressRecordData) => {
    setEditingId(record.id)
    setEditDate(record.date)
    setEditPages(String(record.pages))
    setRecordEditSlot('')
    setEditError(null)
  }

  const handleSaveEdit = async (record: ProgressRecordData) => {
    const pages = Number(editPages)
    if (!Number.isInteger(pages) || pages < 1) {
      setEditError('ページ数は1以上の整数で入力してください')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
      setEditError('日付を入力してください')
      return
    }
    setEditError(null)
    try {
      const patch: { date: string; pages: number; recordedAt?: string } = { date: editDate, pages }
      if (recordEditSlot !== '') patch.recordedAt = buildRecordedAt(editDate, recordEditSlot)
      await updateRecord(record.id, patch)
      setEditingId(null)
      setRecordEditSlot('')
    } catch {
      setEditError('更新に失敗しました。もう一度お試しください')
    }
  }

  const handleRecordDelete = async (record: ProgressRecordData) => {
    if (!window.confirm(`${formatJaDate(record.date)}の記録を削除しますか？`)) return
    setEditError(null)
    try {
      await deleteRecord(record.id)
    } catch {
      setEditError('削除に失敗しました。もう一度お試しください')
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack}>← 戻る</button>
      <h1 data-testid="book-title" style={{ fontSize: 20 }}>
        {book.title}
      </h1>
      <CoverImage src={book.coverUrl ?? null} width={96} height={136} />
      <p>
        完了ページ: <span data-testid="done-count">{done}</span> / {book.totalPages}
      </p>
      <p>
        今日の目標: <strong data-testid="today-target">{target}</strong> ページ
      </p>
      <p>
        残り {Math.max(book.totalPages - done, 0)} ページ / 期限まで{' '}
        {Math.max(remainingDays, 0)} 日
      </p>
      <p data-testid="required-per-day">
        今日 {todayPages} ページを進める場合、期限まで1日あたり {requiredPerDay}{' '}
        ページ
      </p>
      <div style={{ margin: '16px 0' }}>
        <p>今日の学習（{todayRecord ? '記録済み・上書きします' : '未記録'}）</p>
        <input
          data-testid="progress-input"
          type="number"
          inputMode="numeric"
          value={pagesInput}
          onChange={(e) => setPagesInput(e.target.value)}
          placeholder="ページ数"
        />
        {(() => {
          const todaySlots = slotsForRecordDate(availability, today)
          if (todaySlots.length === 0) return null
          return (
            <select
              data-testid="record-slot-new"
              aria-label="空き時間から選択"
              value={recordNewSlot}
              onChange={(e) => setRecordNewSlot(e.target.value)}
            >
              <option value="">時刻を選ぶ（任意）</option>
              {todaySlots.map((s) => (
                <option key={s.id} value={s.start}>
                  {s.start}〜{s.end}
                </option>
              ))}
            </select>
          )
        })()}
        <button data-testid="record-progress" type="button" onClick={() => void handleRecord()}>
          今日やったページ数を記録
        </button>
        {error && (
          <p data-testid="record-error" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
      {todayValues.length > 0 && (
        <>
          <h2 style={{ fontSize: 16 }}>進捗の推移</h2>
          <ProgressChart dates={bookRecords.map((r) => r.date)} values={todayValues} />
        </>
      )}
      {bookRecords.length > 0 && (
        <section data-testid="record-list" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>記録一覧</h2>
          {bookRecords.map((record) => (
            <div
              key={record.id}
              data-testid={`record-row-${record.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              {editingId === record.id ? (
                <div
                  data-testid={`record-edit-form-${record.id}`}
                  style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 1 }}
                >
                  <input
                    data-testid={`record-edit-date-${record.id}`}
                    type="date"
                    value={editDate}
                    onChange={(e) => { setEditDate(e.target.value); setRecordEditSlot('') }}
                    style={{ flex: '1 1 140px', minWidth: 140 }}
                  />
                  <input
                    data-testid={`record-edit-pages-${record.id}`}
                    type="number"
                    inputMode="numeric"
                    value={editPages}
                    onChange={(e) => setEditPages(e.target.value)}
                    placeholder="ページ数"
                    style={{ flex: '1 1 80px', minWidth: 80 }}
                  />
                  {(() => {
                    const editSlots = slotsForRecordDate(availability, editDate)
                    if (editSlots.length === 0) return null
                    return (
                      <select
                        data-testid={`record-slot-${record.id}`}
                        aria-label="空き時間から選択"
                        value={recordEditSlot}
                        onChange={(e) => setRecordEditSlot(e.target.value)}
                        style={{ flex: '1 1 140px', minWidth: 140 }}
                      >
                        <option value="">空き時間から選択</option>
                        {editSlots.map((s) => (
                          <option key={s.id} value={s.start}>
                            {s.start}〜{s.end}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                  <button
                    data-testid={`record-save-${record.id}`}
                    type="button"
                    onClick={() => void handleSaveEdit(record)}
                  >
                    保存
                  </button>
                  <button
                    data-testid={`record-cancel-${record.id}`}
                    type="button"
                    onClick={() => { setEditingId(null); setRecordEditSlot('') }}
                  >
                    キャンセル
                  </button>
                  {editError && (
                    <p
                      data-testid={`record-edit-error-${record.id}`}
                      style={{ color: 'var(--danger)', fontSize: 12, flexBasis: '100%' }}
                    >
                      {editError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <span style={{ flex: 1 }}>{formatJaDate(record.date)}</span>
                  <span>
                    {record.pages} ページ
                  </span>
                  <button
                    data-testid={`record-edit-${record.id}`}
                    type="button"
                    onClick={() => handleStartEdit(record)}
                  >
                    編集
                  </button>
                  <button
                    data-testid={`record-delete-${record.id}`}
                    type="button"
                    onClick={() => void handleRecordDelete(record)}
                    style={{ color: 'var(--danger)' }}
                  >
                    削除
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => onEdit(book.id)}>編集</button>
        <button onClick={() => void handleDelete()} style={{ color: 'var(--danger)' }}>
          削除
        </button>
      </div>
    </div>
  )
}
