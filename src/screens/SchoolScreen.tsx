import { schoolEventsForMonth, type SchoolEvent } from '../data/schoolEvents'

type Props = {
  onBack: () => void
}

const MONTHS = [10, 11, 12, 1, 2, 3]

// PDFの文字色に対応する tone→color 対応表（plain は既定文字色）。
const TONE_COLOR: Record<SchoolEvent['tone'], string | undefined> = {
  exam: '#c02727',
  info: '#1d4ed8',
  green: '#15803d',
  plain: undefined,
}

export default function SchoolScreen({ onBack }: Props) {
  return (
    <div data-testid="school-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>学校の日程</h1>
      {MONTHS.map((m) => {
        const events = schoolEventsForMonth(m)
        return (
          <div key={m} data-testid={`school-month-${m}`} style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16, backgroundColor: '#1e3a8a', color: '#fff', padding: '4px 8px' }}>{m}月</h2>
            {events.map((e, idx) => {
              const i = events.slice(0, idx).filter((x) => x.day === e.day).length
              return (
                <div
                  key={`${e.month}-${e.day}-${idx}`}
                  data-testid={`school-event-${e.month}-${e.day}-${i}`}
                  style={{ marginBottom: 8, color: TONE_COLOR[e.tone] }}
                >
                  <div style={{ fontWeight: 700 }}>{e.month}月{e.day}日</div>
                  <div>{e.text}</div>
                </div>
              )
            })}
          </div>
        )
      })}
      <button data-testid="school-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
