// 並木道の看板クエスト（表示専用）。今日の枠を最大4件まで出し、
// タップで TodayPlan（bookIdなし）または BookDetail（bookIdあり）へ飛ばす。
import type { CSSProperties } from 'react'

export type CampusQuestSlot = { title: string; bookId: string | null }

type Props = {
  slots: CampusQuestSlot[]
  slotsDone?: boolean
  todayLabel: string
  bulletin?: string
  onOpenToday: () => void
  onOpenBook: (bookId: string) => void
}

const NAVY = '#1e2a5a'
const GOLD = '#eab308'
const MAX_VISIBLE = 4

const cardStyle: CSSProperties = {
  marginTop: 8,
  padding: 12,
  borderRadius: 12,
  background: '#fff',
  border: `2px solid ${GOLD}`,
  boxShadow: '0 2px 8px rgba(30,42,90,0.25)',
}

const slotButtonStyle: CSSProperties = {
  minHeight: 44,
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: '#f7f9ff',
  color: '#111',
  fontWeight: 800,
  fontSize: 14,
}

export default function CampusQuestBoard({ slots, slotsDone = false, todayLabel, bulletin, onOpenToday, onOpenBook }: Props) {
  const visible = slots.slice(0, MAX_VISIBLE)
  return (
    <section data-testid="campus-quest-board" style={cardStyle}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15, color: NAVY }}>🏫 並木道の看板クエスト</strong>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{todayLabel}</span>
      </div>
      {slotsDone ? (
        <div data-testid="campus-done" style={{ marginTop: 8, fontWeight: 800, color: NAVY, fontSize: 15 }}>
          🎉 全完了！展望デッキで祝おう
        </div>
      ) : slots.length === 0 ? (
        <div data-testid="campus-empty" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 14 }}>今日の枠はまだありません。図書館で自習しよう</div>
          <button
            type="button"
            onClick={onOpenToday}
            style={{ ...slotButtonStyle, marginTop: 8, textAlign: 'center', background: NAVY, color: '#fff', borderColor: NAVY }}
          >
            今日の計画を開く
          </button>
        </div>
      ) : (
        <div data-testid="campus-slots" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((slot, i) => (
            <button
              key={`${slot.title}-${i}`}
              data-testid={`campus-slot-${i}`}
              type="button"
              onClick={() => (slot.bookId ? onOpenBook(slot.bookId) : onOpenToday())}
              style={slotButtonStyle}
            >
              {slot.title}
            </button>
          ))}
        </div>
      )}
      {bulletin ? (
        <div
          data-testid="campus-bulletin"
          style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: NAVY, color: '#fff', fontSize: 13, fontWeight: 700 }}
        >
          📋 {bulletin}
        </div>
      ) : null}
    </section>
  )
}
