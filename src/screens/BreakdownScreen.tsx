import { useMemo } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import { totalsByBook, todayStr, pagesRecordsForTotals, cycleRecordsForTotals } from '../lib/progress'
import CoverImage from '../components/CoverImage'

type Props = { onBack: () => void; onOpenBook: (id: string) => void; today?: string }

export default function BreakdownScreen({ onBack, onOpenBook, today: todayProp }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  // today は将来の期間絞り込み用の予約prop（現行は全期間集計）
  void today
  const rows = useMemo(() => totalsByBook(records, cycleRecords, books), [records, cycleRecords, books])
  const validRecords = pagesRecordsForTotals(records, books)
  const validCycles = cycleRecordsForTotals(cycleRecords, books)
  const excludedCount = records.length - validRecords.length + (cycleRecords.length - validCycles.length)
  return (
    <div data-testid="breakdown-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>累計の内訳</h1>
      {excludedCount > 0 && (
        <div data-testid="breakdown-excluded" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          集計外 {excludedCount}件あり（削除済み本・形式違いは数えないよ）
        </div>
      )}
      {rows.length === 0 && <div>まだ記録がありません</div>}
      {rows.map((o) => (
        <button key={o.bookId} data-testid={`breakdown-row-${o.bookId}`} type="button" onClick={() => onOpenBook(o.bookId)} style={{ display: 'flex', gap: 12, width: '100%', textAlign: 'left', marginTop: 8 }}>
          <CoverImage src={o.coverUrl ?? null} width={40} height={56} />
          <span>
            <span style={{ fontWeight: 800 }}>{o.title}</span>
            <span>：{o.total.toLocaleString()}（ページ{o.pages.toLocaleString()}＋反復{o.units.toLocaleString()}）</span>
          </span>
        </button>
      ))}
      <button data-testid="breakdown-back" type="button" onClick={onBack} style={{ marginTop: 12 }}>戻る</button>
    </div>
  )
}
