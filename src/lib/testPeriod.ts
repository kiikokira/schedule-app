import { schoolEventsForMonth, schoolYearOfMonth, type SchoolEvent } from '../data/schoolEvents'

export type TestPeriod = {
  name: string
  startDate: string
  endDate: string
}

// 学校行事は10月〜3月のみ。年度をまたぐので月の並びを固定する。
const EVENT_MONTHS = [10, 11, 12, 1, 2, 3]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoOf(today: string, event: SchoolEvent): string {
  const year = schoolYearOfMonth(today, event.month)
  return `${year}-${pad2(event.month)}-${pad2(event.day)}`
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// 学校の日程の「◯◯試験発表」から、同じ接頭辞の最後の試験日の前日までを
// テスト期間とする（最後の試験日は対象外）。今日が期間内ならその期間を返す。
export function testPeriodForDate(today: string): TestPeriod | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const events = EVENT_MONTHS.flatMap((month) => schoolEventsForMonth(month))
  const periods: TestPeriod[] = []
  for (const announce of events) {
    if (announce.tone !== 'exam' || !announce.text.endsWith('試験発表')) continue
    const prefix = announce.text.slice(0, -'発表'.length)
    const startDate = isoOf(today, announce)
    let lastExamDate: string | null = null
    for (const event of events) {
      if (event === announce) continue
      if (event.tone !== 'exam') continue
      if (!event.text.startsWith(prefix)) continue
      if (event.text.endsWith('発表')) continue
      const iso = isoOf(today, event)
      if (lastExamDate === null || iso > lastExamDate) lastExamDate = iso
    }
    if (lastExamDate === null) continue
    const endDate = shiftIso(lastExamDate, -1)
    if (endDate < startDate) continue
    periods.push({
      name: prefix.replace('試験', 'テスト'),
      startDate,
      endDate,
    })
  }
  return periods.find((p) => p.startDate <= today && today <= p.endDate) ?? null
}
