import { useRef, useState, type ChangeEvent, type CompositionEvent } from 'react'
import {
  formatDate,
  parseDate,
  todayStr,
  combinedActivityOnDate,
  pagesRecordsForTotals,
  cycleRecordsForTotals,
  currentCycleRound,
  rangePages,
  validatePageRange,
  type BookData,
  type ProgressRecordData,
  type CycleRecordData,
} from '../lib/progress'
import { isLeapBook, LEAP_WORD_RANGES } from '../lib/leap'
import { appendGhostSnapshot } from '../data/ghostLogStore'
import { db, upsertProgress, addCycleRecord } from '../db/database'

// 昨日から遡って count 日分のISO日付（新しい順）。今日は単発フォーム担当のため含めない。
export function buildBulkDefaultDates(today: string, count = 7): string[] {
  const base = parseDate(today)
  const dates: string[] = []
  for (let i = 1; i <= count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)
    dates.push(formatDate(d))
  }
  return dates
}

export type BulkPagesRow = { date: string; from: string; to: string }

export type BulkCyclesRow = { date: string; from: string; to: string; round: string }

// iPhone日本語キーボードの全角数字を半角に寄せる（BookDetailScreenと同一方針）。
// type="number" は全角を空文字にサニタイズして入力が消えたように見えるため、
// text入力＋正規化で受け付けて送信時の数値検証はそのまま行う。
function normalizeNumericInput(s: string): string {
  return s.replace(/[０-９]/g, (ch) => String('０１２３４５６７８９'.indexOf(ch)))
}

function isComposingEvent(e: ChangeEvent<HTMLInputElement>): boolean {
  return (e.nativeEvent as { isComposing?: boolean } | undefined)?.isComposing === true
}

function handleNumericInputChange(e: ChangeEvent<HTMLInputElement>, set: (v: string) => void): void {
  const v = e.target.value
  if (isComposingEvent(e)) {
    set(v)
    return
  }
  set(normalizeNumericInput(v))
}

function handleNumericCompositionEnd(e: CompositionEvent<HTMLInputElement>, set: (v: string) => void): void {
  set(normalizeNumericInput(e.currentTarget.value))
}

type Props = {
  book: BookData
  mode: 'pages' | 'cycles'
  existingPages: ProgressRecordData[]
  existingCycles: CycleRecordData[]
  books: BookData[]
  onClose: () => void
  onSaved: () => Promise<void> | void
  /** 保存中フラグの変化を親に通知する（親が保存中のEsc/背景クリック/✕をロックするため）。省略時は何もしない。 */
  onSavingChange?: (saving: boolean) => void
}

export default function BulkRecordModal({ book, mode, existingPages, existingCycles, books, onClose, onSaved, onSavingChange = () => {} }: Props): JSX.Element {
  const [rows, setRows] = useState<BulkPagesRow[]>(() =>
    buildBulkDefaultDates(todayStr()).map((date) => {
      const hit = existingPages.find((r) => r.bookId === book.id && r.date === date)
      return {
        date,
        from: hit?.pageFrom !== undefined ? String(hit.pageFrom) : '',
        to: hit?.pageTo !== undefined ? String(hit.pageTo) : '',
      }
    }),
  )
  // 周回型は1日複数OKの追加のみなので、既存記録のプリフィルはせず空行で開く。
  const [cycleRows, setCycleRows] = useState<BulkCyclesRow[]>(() =>
    buildBulkDefaultDates(todayStr()).map((date) => ({ date, from: '', to: '', round: '' })),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // savingを実際に切り替えたときだけ親に通知する（保存中のdismissibleロック用）。
  const savingRef = useRef(false)
  const setSavingAndNotify = (v: boolean) => {
    setSaving(v)
    if (savingRef.current !== v) {
      savingRef.current = v
      onSavingChange(v)
    }
  }

  const setRow = (i: number, patch: Partial<BulkPagesRow>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { date: '', from: '', to: '' }])
  }

  const deleteRow = (i: number) => {
    setRows((prev) => prev.filter((_, j) => j !== i))
  }

  const setCycleRow = (i: number, patch: Partial<BulkCyclesRow>) => {
    setCycleRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const addCycleRow = () => {
    setCycleRows((prev) => [...prev, { date: '', from: '', to: '', round: '' }])
  }

  const deleteCycleRow = (i: number) => {
    setCycleRows((prev) => prev.filter((_, j) => j !== i))
  }

  // LEAPは語、それ以外は区画（BookDetailScreenと同一の単位表記）
  const unit = isLeapBook(book) ? '語' : '区画'

  const isOutOfRange = (date: string): boolean => {
    const d = date.trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && (d < book.startDate || d > book.deadline)
  }

  const handleCyclesSave = async () => {
    const totalUnits = book.totalUnits ?? 0
    const targetRounds = book.targetRounds ?? 0
    const mine = existingCycles.filter((r) => r.bookId === book.id)
    // 部分保存後に行参照で保存済み行を編集状態から除去できるよう、元の行を保持する
    type Prepared = { row: BulkCyclesRow; date: string; unitFrom: number; unitTo: number; round: number }
    const prepared: Prepared[] = []
    for (const row of cycleRows) {
      const fromRaw = normalizeNumericInput(row.from.trim())
      const toRaw = normalizeNumericInput(row.to.trim())
      const roundRaw = normalizeNumericInput(row.round.trim())
      // from/toが両方空の行は未記入としてスキップする（空欄行は保存しない）
      if (fromRaw === '' && toRaw === '') continue
      const date = row.date.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setError('日付を YYYY-MM-DD 形式で入力してください')
        return
      }
      const from = Number(fromRaw)
      const to = Number(toRaw)
      // バリデーションは単発と同一: 1..totalUnits の整数
      if (
        !Number.isInteger(from) || !Number.isInteger(to) ||
        from < 1 || from > totalUnits || to < 1 || to > totalUnits
      ) {
        setError(`${unit}の範囲は1〜${totalUnits}の整数で入力してください（開始・終了の両方が必要）`)
        return
      }
      // LEAP本は両端が同じブロック（LEAP_WORD_RANGES）に収まる範囲だけ記録できる。
      // bulkにブロック選択UIは無いため範囲から所属を判定し、ブロックをまたぐ行は
      // 境界での2行分割を案内して拒否する。逆順入力(from>to)は単発と同様に許容する。
      if (isLeapBook(book)) {
        const lo = Math.min(from, to)
        const hi = Math.max(from, to)
        if (!LEAP_WORD_RANGES.some((b) => b.from <= lo && hi <= b.to)) {
          const block = LEAP_WORD_RANGES.find((b) => b.from <= lo && lo <= b.to)
          const hint = block && block.to < hi ? `（例: ${lo}-${block.to} と ${block.to + 1}-${hi} の2行に分ける）` : ''
          setError(`LEAPは同じブロック内の範囲だけ記録できます。ブロックをまたぐ行は2行に分けてください${hint}`)
          return
        }
      }
      // 周回が空なら今の周回で補完する（既存記録のみが対象。同じ入力中の行は考慮しない）
      let round: number
      if (roundRaw === '') {
        round = currentCycleRound(book, mine)
      } else {
        round = Number(roundRaw)
        if (!Number.isInteger(round) || round < 1 || round > targetRounds) {
          setError(`周回は1〜${targetRounds}の整数で入力してください`)
          return
        }
      }
      prepared.push({ row, date, unitFrom: from, unitTo: to, round })
    }
    if (prepared.length === 0) {
      setError('保存する行がありません。範囲を入力してください')
      return
    }
    setError(null)
    setSavingAndNotify(true)
    // 周回型は1日複数OKで追加のみ（addCycleRecord）。行ごとに追加し失敗を収集する。
    // 期間外日付も警告のみで保存は許可（単発と同様）。recordedAtは付けない。
    const savedRows: Prepared[] = []
    const failedRows: Prepared[] = []
    // onSaved/onClose 完了までボタンをロックし、二重クリックでの重複追加を防ぐ。
    // rejection は finally でロック解除＋エラー表示（未処理rejectionにしない）。
    try {
      for (const p of prepared) {
        try {
          await addCycleRecord({
            id: crypto.randomUUID(),
            bookId: book.id,
            date: p.date,
            unitFrom: p.unitFrom,
            unitTo: p.unitTo,
            round: p.round,
          })
        } catch {
          failedRows.push(p)
          continue
        }
        savedRows.push(p)
      }
      // 保存した日ごとに1回、ゴーストスナップショットを追記する（失敗しても記録は壊さない）
      for (const date of [...new Set(savedRows.map((r) => r.date))].sort()) {
        try {
          const freshRecords = await db.records.toArray()
          const freshCycles = await db.cycleRecords.toArray()
          const total = combinedActivityOnDate(
            date,
            pagesRecordsForTotals(freshRecords, books),
            cycleRecordsForTotals(freshCycles, books),
          )
          await appendGhostSnapshot(date, total)
        } catch { /* ignore: ゴースト失敗で記録を壊さない */ }
      }
      // 失敗行は日付だけでなく「日付 開始-終了」で識別する（同一日付の複数行でも曖昧にならない）
      const rowLabel = (r: Prepared) => `${r.date} ${r.unitFrom}-${r.unitTo}`
      if (failedRows.length > 0) {
        setError(
          savedRows.length > 0
            ? `一部だけ保存しました。保存済み: ${savedRows.map(rowLabel).join(', ')} / 失敗: ${failedRows.map(rowLabel).join(', ')}`
            : '保存に失敗しました。もう一度お試しください',
        )
        // 保存済み行を編集状態から削除する。行に残るのは失敗行（と未記入行）だけになり、
        // 「まとめて保存」再試行は失敗行のみを送信するので重複追加が起きない。
        if (savedRows.length > 0) {
          const savedRefs = new Set(savedRows.map((r) => r.row))
          setCycleRows((prev) => prev.filter((r) => !savedRefs.has(r)))
        }
        await onSaved()
        return
      }
      await onSaved()
      // 閉じる前にロック解除を通知する（親の閉じる経路はsaving中ガードを持つため）
      setSavingAndNotify(false)
      onClose()
    } catch {
      setError((prev) => prev ?? '保存に失敗しました。もう一度お試しください')
    } finally {
      setSavingAndNotify(false)
    }
  }

  const handleSave = async () => {
    if (mode === 'cycles') {
      await handleCyclesSave()
      return
    }
    // 記入あり行だけを対象にする。開始・終了が両方空の行は保存しない。
    const byDate = new Map<string, { pages: number; from: number; to: number }>()
    const totalPages = book.totalPages ?? 0
    for (const row of rows) {
      const fromRaw = normalizeNumericInput(row.from.trim())
      const toRaw = normalizeNumericInput(row.to.trim())
      if (fromRaw === '' && toRaw === '') continue
      const date = row.date.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setError('日付を YYYY-MM-DD 形式で入力してください')
        return
      }
      const from = Number(fromRaw)
      const to = Number(toRaw)
      // バリデーションは単発と同一: 開始≦終了かつ1〜総ページの整数
      const rangeError = validatePageRange(from, to, totalPages)
      if (rangeError !== null) {
        setError(rangeError)
        return
      }
      // 同じ日が複数行あるときは後ろの行を優先する
      byDate.set(date, { pages: rangePages(from, to), from, to })
    }
    if (byDate.size === 0) {
      setError('保存する行がありません。範囲を入力してください')
      return
    }
    setError(null)
    setSavingAndNotify(true)
    const dates = [...byDate.keys()].sort()
    // 日ごとにupsertし、成功したらその日のゴーストを更新してから次の日へ進む。
    // 途中失敗は保存済み分を巻き戻さず、エラーで明示する。
    // 期間外日付も警告のみで保存は許可（単発と同様）。recordedAtは付けない。
    const savedDates: string[] = []
    const failedDates: string[] = []
    // onSaved/onClose 完了までボタンをロックし、二重クリックでの重複保存を防ぐ。
    // rejection は finally でロック解除＋エラー表示（未処理rejectionにしない）。
    try {
      for (const date of dates) {
        try {
          const entry = byDate.get(date) as { pages: number; from: number; to: number }
          await upsertProgress(book.id, date, entry.pages, undefined, entry.from, entry.to)
        } catch {
          failedDates.push(date)
          continue
        }
        savedDates.push(date)
        // 保存した日のゴーストスナップショットを追記する（失敗しても記録は壊さない）
        try {
          const freshRecords = await db.records.toArray()
          const freshCycles = await db.cycleRecords.toArray()
          const total = combinedActivityOnDate(
            date,
            pagesRecordsForTotals(freshRecords, books),
            cycleRecordsForTotals(freshCycles, books),
          )
          await appendGhostSnapshot(date, total)
        } catch { /* ignore: ゴースト失敗で記録を壊さない */ }
      }
      if (failedDates.length > 0) {
        setError(
          savedDates.length > 0
            ? `一部だけ保存しました。保存済み: ${savedDates.join(', ')} / 失敗: ${failedDates.join(', ')}`
            : '保存に失敗しました。もう一度お試しください',
        )
        await onSaved()
        return
      }
      await onSaved()
      // 閉じる前にロック解除を通知する（親の閉じる経路はsaving中ガードを持つため）
      setSavingAndNotify(false)
      onClose()
    } catch {
      setError((prev) => prev ?? '保存に失敗しました。もう一度お試しください')
    } finally {
      setSavingAndNotify(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        zIndex: 1000,
      }}
    >
      <div
        data-testid="bulk-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title}のまとめて入力`}
        style={{
          background: 'var(--card, #fff)',
          color: 'var(--text, inherit)',
          borderRadius: 12,
          padding: 16,
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>まとめて過去記録</h2>
          <button
            data-testid="bulk-close"
            type="button"
            disabled={saving}
            onClick={() => {
              // 保存中は✕で閉じられない（書き込み途中のdismissを防ぐ）
              if (!saving) onClose()
            }}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        {mode === 'cycles' ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0' }}>
              範囲を記入した行だけ保存されます。同じ日付に複数行OK（すべて追加）。周回が空なら今の周回で補完。
            </p>
            {cycleRows.some((row) => isOutOfRange(row.date)) && (
              <p
                data-testid="bulk-range-warning"
                style={{ fontSize: 12, color: 'var(--warning, #b45309)', margin: '0 0 8px' }}
              >
                開始日〜期限日の範囲外の日付があります（保存できます）
              </p>
            )}
            {cycleRows.map((row, i) => (
              <div
                key={i}
                data-testid={`bulk-row-${i}`}
                style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}
              >
                <input
                  data-testid={`bulk-date-${i}`}
                  type="date"
                  aria-label={`${i + 1}行目の日付`}
                  value={row.date}
                  onChange={(e) => setCycleRow(i, { date: e.target.value })}
                  style={{ flex: '1 1 130px', minWidth: 120 }}
                />
                <input
                  data-testid={`bulk-from-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label={`${i + 1}行目の開始${unit}`}
                  value={row.from}
                  onChange={(e) => handleNumericInputChange(e, (v) => setCycleRow(i, { from: v }))}
                  onCompositionEnd={(e) => handleNumericCompositionEnd(e, (v) => setCycleRow(i, { from: v }))}
                  placeholder={`開始${unit}`}
                  style={{ flex: '1 1 64px', minWidth: 56, fontSize: 16 }}
                />
                <input
                  data-testid={`bulk-to-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label={`${i + 1}行目の終了${unit}`}
                  value={row.to}
                  onChange={(e) => handleNumericInputChange(e, (v) => setCycleRow(i, { to: v }))}
                  onCompositionEnd={(e) => handleNumericCompositionEnd(e, (v) => setCycleRow(i, { to: v }))}
                  placeholder={`終了${unit}`}
                  style={{ flex: '1 1 64px', minWidth: 56, fontSize: 16 }}
                />
                <input
                  data-testid={`bulk-round-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label={`${i + 1}行目の周回`}
                  value={row.round}
                  onChange={(e) => handleNumericInputChange(e, (v) => setCycleRow(i, { round: v }))}
                  onCompositionEnd={(e) => handleNumericCompositionEnd(e, (v) => setCycleRow(i, { round: v }))}
                  placeholder="周回"
                  style={{ flex: '1 1 56px', minWidth: 48, fontSize: 16 }}
                />
                {isOutOfRange(row.date) && (
                  <span data-testid={`bulk-date-warning-${i}`} style={{ fontSize: 12, color: 'var(--warning, #b45309)' }}>
                    開始日〜期限日の範囲外です（保存できます）
                  </span>
                )}
                <button
                  data-testid={`bulk-delete-${i}`}
                  type="button"
                  onClick={() => deleteCycleRow(i)}
                  aria-label={`${i + 1}行目を削除`}
                  style={{ color: 'var(--danger)' }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button data-testid="bulk-add-row" type="button" onClick={addCycleRow}>
              行を追加
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0' }}>
              記入した行だけ保存されます。同じ日付は book+date で上書き（後ろの行が優先）。
            </p>
            {rows.some((row) => isOutOfRange(row.date)) && (
              <p
                data-testid="bulk-range-warning"
                style={{ fontSize: 12, color: 'var(--warning, #b45309)', margin: '0 0 8px' }}
              >
                開始日〜期限日の範囲外の日付があります（保存できます）
              </p>
            )}
            {rows.map((row, i) => (
              <div
                key={i}
                data-testid={`bulk-row-${i}`}
                style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}
              >
                <input
                  data-testid={`bulk-date-${i}`}
                  type="date"
                  aria-label={`${i + 1}行目の日付`}
                  value={row.date}
                  onChange={(e) => setRow(i, { date: e.target.value })}
                  style={{ flex: '1 1 140px', minWidth: 130 }}
                />
                <input
                  data-testid={`bulk-from-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label={`${i + 1}行目の開始ページ`}
                  value={row.from}
                  onChange={(e) => handleNumericInputChange(e, (v) => setRow(i, { from: v }))}
                  onCompositionEnd={(e) => handleNumericCompositionEnd(e, (v) => setRow(i, { from: v }))}
                  placeholder="開始ページ"
                  style={{ flex: '1 1 80px', minWidth: 70, fontSize: 16 }}
                />
                <input
                  data-testid={`bulk-to-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label={`${i + 1}行目の終了ページ`}
                  value={row.to}
                  onChange={(e) => handleNumericInputChange(e, (v) => setRow(i, { to: v }))}
                  onCompositionEnd={(e) => handleNumericCompositionEnd(e, (v) => setRow(i, { to: v }))}
                  placeholder="終了ページ"
                  style={{ flex: '1 1 80px', minWidth: 70, fontSize: 16 }}
                />
                {isOutOfRange(row.date) && (
                  <span data-testid={`bulk-date-warning-${i}`} style={{ fontSize: 12, color: 'var(--warning, #b45309)' }}>
                    開始日〜期限日の範囲外です（保存できます）
                  </span>
                )}
                <button
                  data-testid={`bulk-delete-${i}`}
                  type="button"
                  onClick={() => deleteRow(i)}
                  aria-label={`${i + 1}行目を削除`}
                  style={{ color: 'var(--danger)' }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button data-testid="bulk-add-row" type="button" onClick={addRow}>
              行を追加
            </button>
          </>
        )}
        {error && (
          <p data-testid="bulk-error" style={{ color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </p>
        )}
        <button
          data-testid="bulk-save"
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          style={{ marginTop: 12, fontSize: 16, fontWeight: 700 }}
        >
          まとめて保存
        </button>
      </div>
    </div>
  )
}
