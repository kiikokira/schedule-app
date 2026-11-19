import { useState, type ChangeEvent, type CompositionEvent } from 'react'
import {
  formatDate,
  parseDate,
  todayStr,
  combinedActivityOnDate,
  pagesRecordsForTotals,
  cycleRecordsForTotals,
  type BookData,
  type ProgressRecordData,
  type CycleRecordData,
} from '../lib/progress'
import { appendGhostSnapshot } from '../data/ghostLogStore'
import { db, upsertProgress } from '../db/database'

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

export type BulkPagesRow = { date: string; pages: string }

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
}

export default function BulkRecordModal({ book, mode, existingPages, books, onClose, onSaved }: Props): JSX.Element {
  const [rows, setRows] = useState<BulkPagesRow[]>(() =>
    buildBulkDefaultDates(todayStr()).map((date) => {
      const hit = existingPages.find((r) => r.bookId === book.id && r.date === date)
      return { date, pages: hit ? String(hit.pages) : '' }
    }),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const setRow = (i: number, patch: Partial<BulkPagesRow>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { date: '', pages: '' }])
  }

  const deleteRow = (i: number) => {
    setRows((prev) => prev.filter((_, j) => j !== i))
  }

  const isOutOfRange = (date: string): boolean => {
    const d = date.trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && (d < book.startDate || d > book.deadline)
  }

  const handleSave = async () => {
    if (mode === 'cycles') {
      setError('周回型の一括入力はこのバージョンでは未対応です')
      return
    }
    // 記入あり行だけを対象にする。ページ数が空の行は保存しない。
    const byDate = new Map<string, number>()
    for (const row of rows) {
      const pagesRaw = normalizeNumericInput(row.pages.trim())
      if (pagesRaw === '') continue
      const date = row.date.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setError('日付を YYYY-MM-DD 形式で入力してください')
        return
      }
      const pages = Number(pagesRaw)
      if (!Number.isInteger(pages) || pages < 1) {
        setError('ページ数は1以上の整数で入力してください')
        return
      }
      // 同じ日が複数行あるときは後ろの行を優先する
      byDate.set(date, pages)
    }
    if (byDate.size === 0) {
      setError('保存する行がありません。ページ数を入力してください')
      return
    }
    setError(null)
    setSaving(true)
    const dates = [...byDate.keys()].sort()
    // 日ごとにupsertし、成功したらその日のゴーストを更新してから次の日へ進む。
    // 途中失敗は保存済み分を巻き戻さず、エラーで明示する。
    // 期間外日付も警告のみで保存は許可（単発と同様）。recordedAtは付けない。
    const savedDates: string[] = []
    const failedDates: string[] = []
    for (const date of dates) {
      try {
        await upsertProgress(book.id, date, byDate.get(date) as number)
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
    setSaving(false)
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
    onClose()
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
          <button data-testid="bulk-close" type="button" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        {mode === 'cycles' ? (
          <p data-testid="bulk-cycles-placeholder" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
            周回型のまとめて入力はこのバージョンでは未対応です（行の入力は今後の更新で追加予定）。
          </p>
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
                  data-testid={`bulk-pages-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label={`${i + 1}行目のページ数`}
                  value={row.pages}
                  onChange={(e) => handleNumericInputChange(e, (v) => setRow(i, { pages: v }))}
                  onCompositionEnd={(e) => handleNumericCompositionEnd(e, (v) => setRow(i, { pages: v }))}
                  placeholder="ページ数"
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
