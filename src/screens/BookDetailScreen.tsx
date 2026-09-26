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
  todayStr,
  calcCycleDonePairs,
  calcCycleDailyTarget,
  cycleGrandTotal,
  currentCycleRound,
  expandCyclePairs,
  type BookData,
  type ProgressRecordData,
  type CycleRecordData,
} from '../lib/progress'

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
      .sort((a, b) => (a.date > b.date ? -1 : 1))
    const total = cycleGrandTotal(book)
    const done = calcCycleDonePairs(book, mine)
    const round = currentCycleRound(book, mine)
    const remainingDays = daysBetween(today, book.deadline)
    const target = calcCycleDailyTarget(book, done, remainingDays)
    const effectiveDate = cycleDate || today
    const dateOutOfRange = effectiveDate < book.startDate || effectiveDate > book.deadline
    const cyclePairs = expandCyclePairs(mine)
    const cycleTotalUnits = book.totalUnits ?? 0
    const cycleTargetRounds = book.targetRounds ?? 0
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
      const roundNum = Number(cycleRoundInput)
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > (book.totalUnits ?? 0)) {
        setCycleError('区画の範囲を正しく入力してください')
        return
      }
      if (!Number.isInteger(roundNum) || roundNum < 1 || roundNum > (book.targetRounds ?? 0)) {
        setCycleError('周回は1〜目標周回の範囲で入力してください')
        return
      }
      setCycleError(null)
      try {
        await addCycle({ id: crypto.randomUUID(), bookId: book.id, date: cycleDate || today, unitFrom: from, unitTo: to, round: roundNum })
      } catch {
        setCycleError('記録に失敗しました。もう一度お試しください')
        return
      }
      setCycleFrom('')
      setCycleTo('')
      setCycleRoundInput('')
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
      setCycleEditError(null)
    }

    const handleCycleSaveEdit = async (record: CycleRecordData) => {
      const from = Number(cycleEditFrom)
      const to = Number(cycleEditTo)
      const roundNum = Number(cycleEditRound)
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > (book.totalUnits ?? 0)) {
        setCycleEditError('区画の範囲を正しく入力してください')
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
        await updateCycle(record.id, { date: cycleEditDate, unitFrom: from, unitTo: to, round: roundNum })
        setCycleEditingId(null)
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
        <p data-testid="cycle-summary">
          完了パス {done} / {total}（全{book.totalUnits}区画×{book.targetRounds}周）・今{round}周目
        </p>
        <p data-testid="cycle-round-coverage">
          {cycleRoundCoverage.map(({ round: r, covered }) => `${r}周目: ${covered}/${cycleTotalUnits}区画`).join(' ')}
        </p>
        <p>
          今日の目標: <strong data-testid="today-target">{target}</strong> 区画
        </p>
        <p>
          残り {Math.max(total - done, 0)} 区画 / 期限まで{' '}
          {Math.max(remainingDays, 0)} 日
        </p>
        <div style={{ margin: '16px 0' }}>
          <p>反復の記録</p>
          <input
            data-testid="cycle-from"
            type="number"
            inputMode="numeric"
            value={cycleFrom}
            onChange={(e) => setCycleFrom(e.target.value)}
            placeholder="From"
          />
          <input
            data-testid="cycle-to"
            type="number"
            inputMode="numeric"
            value={cycleTo}
            onChange={(e) => setCycleTo(e.target.value)}
            placeholder="To"
          />
          <input
            data-testid="cycle-round"
            type="number"
            inputMode="numeric"
            value={cycleRoundInput}
            onChange={(e) => setCycleRoundInput(e.target.value)}
            placeholder="周回"
          />
          <input
            data-testid="cycle-date"
            type="date"
            value={cycleDate}
            onChange={(e) => setCycleDate(e.target.value)}
          />
          <button data-testid="cycle-record" type="button" onClick={() => void handleCycleRecord()}>
            範囲を記録
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>同じ区画・同じ周回の再記録は進捗に二重計上されません</p>
          {cycleError && (
            <p data-testid="cycle-error" style={{ color: 'var(--danger)' }}>
              {cycleError}
            </p>
          )}
          {dateOutOfRange && <p data-testid="cycle-date-warning">日付が開始日〜期限日の範囲外です</p>}
        </div>
        {mine.length > 0 && (
          <section style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16 }}>記録一覧</h2>
            {mine.map((record) => (
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
                  <>
                    <input
                      data-testid={`cycle-edit-from-${record.id}`}
                      type="number"
                      inputMode="numeric"
                      value={cycleEditFrom}
                      onChange={(e) => setCycleEditFrom(e.target.value)}
                      placeholder="From"
                      style={{ width: 64 }}
                    />
                    <input
                      data-testid={`cycle-edit-to-${record.id}`}
                      type="number"
                      inputMode="numeric"
                      value={cycleEditTo}
                      onChange={(e) => setCycleEditTo(e.target.value)}
                      placeholder="To"
                      style={{ width: 64 }}
                    />
                    <input
                      data-testid={`cycle-edit-round-${record.id}`}
                      type="number"
                      inputMode="numeric"
                      value={cycleEditRound}
                      onChange={(e) => setCycleEditRound(e.target.value)}
                      placeholder="周回"
                      style={{ width: 64 }}
                    />
                    <input
                      data-testid={`cycle-edit-date-${record.id}`}
                      type="date"
                      value={cycleEditDate}
                      onChange={(e) => setCycleEditDate(e.target.value)}
                      style={{ flex: 1, minWidth: 120 }}
                    />
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
                      onClick={() => setCycleEditingId(null)}
                    >
                      キャンセル
                    </button>
                    {cycleEditError && (
                      <p
                        data-testid={`cycle-edit-error-${record.id}`}
                        style={{ color: 'var(--danger)', fontSize: 12 }}
                      >
                        {cycleEditError}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{formatJaDate(record.date)}</span>
                    <span>
                      {record.unitFrom}-{record.unitTo}区画 {record.round}周目
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
  const target = calcDailyTarget(book, done, remainingDays)

  const doneBeforeToday = done - (todayRecord?.pages ?? 0)
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
      await addProgress(book.id, today, pages)
    } catch {
      setError('記録に失敗しました。もう一度お試しください')
      return
    }
    setPagesInput('')
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
      await updateRecord(record.id, { date: editDate, pages })
      setEditingId(null)
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
                <>
                  <input
                    data-testid={`record-edit-date-${record.id}`}
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    style={{ flex: 1, minWidth: 120 }}
                  />
                  <input
                    data-testid={`record-edit-pages-${record.id}`}
                    type="number"
                    inputMode="numeric"
                    value={editPages}
                    onChange={(e) => setEditPages(e.target.value)}
                    placeholder="ページ数"
                    style={{ width: 80 }}
                  />
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
                    onClick={() => setEditingId(null)}
                  >
                    キャンセル
                  </button>
                  {editError && (
                    <p
                      data-testid={`record-edit-error-${record.id}`}
                      style={{ color: 'var(--danger)', fontSize: 12 }}
                    >
                      {editError}
                    </p>
                  )}
                </>
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
