import { useMemo } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import { totalsByBook, todayStr } from '../lib/progress'
import CoverImage from '../components/CoverImage'

type Props = { onBack: () => void; onOpenBook: (id: string) => void; today?: string }

export default function BreakdownScreen({ onBack, onOpenBook, today: todayProp }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  void today
  const rows = useMemo(() => totalsByBook(records, cycleRecords, books), [records, cycleRecords, books])
  return (
    <div data-testid="breakdown-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>累計の内訳</h1>
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
