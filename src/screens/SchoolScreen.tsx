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
  const hasTodayMonth = MONTHS.includes(todayMonth)
  // 自動スクロールはしない（先頭表示の要求を維持）。押したときだけ今日へ移動する。
  // stickyヘッダー（.app-header）の裏に隠れないよう、ヘッダー高さ分を差し引いて
  // 今日の行の上端がヘッダー直下に来る位置までスクロールする（画像の状態）。
  const jumpToToday = () => {
    const el = document.querySelector(
      `[data-testid="school-event-${todayMonth}-${todayDay}-0"]`,
    ) as HTMLElement | null
    const month = document.querySelector(`[data-testid="school-month-${todayMonth}"]`) as HTMLElement | null
    const target = el ?? month
    if (!target) return
    const header = document.querySelector('.app-header')
    const headerH = header?.getBoundingClientRect().height ?? 0
    const y = target.getBoundingClientRect().top + window.scrollY - headerH - 8
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
  // 別ページ遷移時に前画面のスクロール位置が残り途中から表示されるため、先頭から表示する
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <div data-testid="school-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>学校の日程</h1>
      <p data-testid="school-today-line" style={{ fontWeight: 700 }}>
        今日：
        {formatSchoolEventDate(schoolYearOfMonth(today, todayMonth), todayMonth, todayDay)}
        {hasTodayMonth && (
          <button
            data-testid="school-jump-today"
            type="button"
            style={{ marginLeft: 8 }}
            onClick={jumpToToday}
          >
            ▼ 今日へ移動
          </button>
        )}
      </p>
      {MONTHS.map((m) => {
        const events = schoolEventsForMonth(m)
        const year = schoolYearOfMonth(today, m)
        // 行事のない日の今日も日程内の位置が分かるよう、同形式の行を日付順に挿入する。
        const isTodayMonth = m === todayMonth
        const hasTodayEvent = events.some((e) => e.day === todayDay)
        const display =
          isTodayMonth && !hasTodayEvent
            ? [...events, { month: m, day: todayDay, text: '予定なし', tone: 'plain' as const }].sort(
                (a, b) => a.day - b.day,
              )
            : events
        return (
          <div key={m} data-testid={`school-month-${m}`} style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16, backgroundColor: '#1e3a8a', color: '#fff', padding: '4px 8px' }}>
              {m}月
              {m === todayMonth && (
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
                  今月
                </span>
              )}
            </h2>
            {display.map((e, idx) => {
              const i = display.slice(0, idx).filter((x) => x.day === e.day).length
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
