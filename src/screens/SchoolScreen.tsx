import { schoolEventsForMonth } from '../data/schoolEvents'

type Props = {
  onBack: () => void
}

const MONTHS = [10, 11, 12, 1, 2, 3]

export default function SchoolScreen({ onBack }: Props) {
  return (
    <div data-testid="school-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>学校の日程</h1>
      {MONTHS.map((m) => {
        const events = schoolEventsForMonth(m)
        return (
          <div key={m} data-testid={`school-month-${m}`} style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16 }}>{m}月</h2>
            {events.map((e, idx) => {
              const i = events.slice(0, idx).filter((x) => x.day === e.day).length
              return (
                <div
                  key={`${e.month}-${e.day}-${idx}`}
                  data-testid={`school-event-${e.month}-${e.day}-${i}`}
                  style={{ marginBottom: 8 }}
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
