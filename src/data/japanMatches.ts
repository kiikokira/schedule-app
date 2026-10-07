// JFA公式発表ベースのA代表（SAMURAI BLUE）日程。
// 自動収集ワークフロー（Plan B）の生成物。手編集時は形式を守ること。
// 初回データは2026-10-05にJFA公式（jfa.jp/eng/international_match および
// KIRIN CUP SOCCER 2026 特設）から調査：10/5決勝・日本vsニュージーランド
// 19:30国立、11/14・日本vsブラジル（シンガポール／現地18:15＝日本時間19:15）。
export type JapanMatch = {
  id: string
  date: string // "YYYY-MM-DD"
  kickoff: string // "HH:MM" 日本時間
  opponent: string
  competition: string
  venue?: string
  homeAway: 'home' | 'away' | 'neutral'
}

export const generatedAt = '2026-10-07T00:00:00+09:00'

export const JAPAN_MATCHES: JapanMatch[] = [
  {
    id: '2026-10-05-vs-new-zealand',
    date: '2026-10-05',
    kickoff: '19:30',
    opponent: 'ニュージーランド',
    competition: 'KIRIN CUP SOCCER 2026',
    venue: '国立競技場',
    homeAway: 'home',
  },
  {
    id: '2026-11-14-vs-brazil',
    date: '2026-11-14',
    kickoff: '19:15',
    opponent: 'ブラジル',
    competition: 'MIZUHO BLUE CHALLENGE',
    venue: 'シンガポール・ナショナルスタジアム',
    homeAway: 'neutral',
  },
  {
    id: '2026-11-17-vs-paraguay',
    date: '2026-11-17',
    kickoff: '21:10',
    opponent: 'パラグアイ',
    competition: 'MIZUHO BLUE CHALLENGE',
    venue: 'シンガポール・ナショナルスタジアム',
    homeAway: 'neutral',
  },
]

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// 観戦確保枠：キックオフ10分前〜キックオフ＋125分（45＋15＋45＋AT想定10＋余裕10）。
// 日跨ぎ分は切り捨てる（endMin <= 1440 の既存制約に合わせる）。
export function matchWindow(m: Pick<JapanMatch, 'kickoff'>): { start: string; end: string } {
  const start = toMin(m.kickoff) - 10
  const end = Math.min(toMin(m.kickoff) + 125, 1440)
  return { start: toHHMM(Math.max(start, 0)), end: toHHMM(end) }
}

export function daysUntil(date: string, today: string): number {
  const ms = new Date(`${date}T00:00:00+09:00`).getTime() - new Date(`${today}T00:00:00+09:00`).getTime()
  return Math.round(ms / 86400000)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateJapanMatches(data: unknown): data is JapanMatch[] {
  if (!Array.isArray(data)) return false
  const ids = new Set<string>()
  for (const m of data) {
    if (!m || typeof m.id !== 'string' || ids.has(m.id)) return false
    ids.add(m.id)
    if (typeof m.date !== 'string' || !DATE_RE.test(m.date)) return false
    const [y, mo, d] = m.date.split('-').map(Number)
    const dt = new Date(y, mo - 1, d)
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return false
    if (typeof m.kickoff !== 'string' || !TIME_RE.test(m.kickoff)) return false
    if (typeof m.opponent !== 'string' || m.opponent.length === 0 || m.opponent.length > 100) return false
    if (typeof m.competition !== 'string' || m.competition.length > 100) return false
    if (m.venue !== undefined && (typeof m.venue !== 'string' || m.venue.length > 100)) return false
    if (m.homeAway !== 'home' && m.homeAway !== 'away' && m.homeAway !== 'neutral') return false
  }
  return true
}
