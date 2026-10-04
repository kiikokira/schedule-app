import { useEffect } from 'react'
import { schoolEventsForMonth, formatSchoolEventDate, schoolYearOfMonth, type SchoolEvent } from '../data/schoolEvents'
import { todayStr } from '../lib/progress'

type Props = {
  onBack: () => void
  today?: string
}

const MONTHS = [10, 11, 12, 1, 2, 3]

// PDFの文字色に対応する tone→color 対応表（plain は既定文字色）。
const TONE_COLOR: Record<SchoolEvent['tone'], string | undefined> = {
  exam: '#c02727',
  info: '#1d4ed8',
  green: '#15803d',
  plain: undefined,
}

export default function SchoolScreen({ onBack, today: todayProp }: Props) {
  const today = todayProp ?? todayStr()
  const todayMonth = Number(today.slice(5, 7))
  const todayDay = Number(today.slice(8, 10))
  // 別ページ遷移時に前画面のスクロール位置が残り途中から表示されるため、先頭から表示する
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <div data-testid="school-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>学校の日程</h1>
      {MONTHS.map((m) => {
        const events = schoolEventsForMonth(m)
        const year = schoolYearOfMonth(today, m)
        return (
          <div key={m} data-testid={`school-month-${m}`} style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16, backgroundColor: '#1e3a8a', color: '#fff', padding: '4px 8px' }}>{m}月</h2>
            {events.map((e, idx) => {
              const i = events.slice(0, idx).filter((x) => x.day === e.day).length
              const isToday = e.month === todayMonth && e.day === todayDay
              return (
                <div
                  key={`${e.month}-${e.day}-${idx}`}
                  data-testid={`school-event-${e.month}-${e.day}-${i}`}
                  style={{
                    marginBottom: 8,
                    color: TONE_COLOR[e.tone],
                    ...(isToday
                      ? {
                          backgroundColor: '#fef3c7',
                          borderLeft: '4px solid #eab308',
                          borderRadius: 4,
                          padding: '4px 4px 4px 8px',
                        }
                      : undefined),
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {formatSchoolEventDate(year, e.month, e.day)}
                    {isToday && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          backgroundColor: '#eab308',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '2px 6px',
                        }}
                      >
                        今日
                      </span>
                    )}
                  </div>
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
