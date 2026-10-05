// JFA公式 (jfa.jp/eng/international_match) からSAMURAI BLUEの日程を抽出し、
// src/data/japanMatches.ts を生成するスクリプト。依存追加なし (Node 20標準のみ)。
// 直接実行時のみ動作する。テストから純粋関数をimportできるようexportしている。

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const LIST_URL = 'https://www.jfa.jp/eng/international_match/'
const USER_AGENT = 'schedule-app-bot'

// 対戦相手の英語→日本語対応表 (exact初期値)。表に無い相手はエラー終了し、データは更新しない。
export const OPPONENT_MAP = {
  Uruguay: 'ウルグアイ',
  Venezuela: 'ベネズエラ',
  Ecuador: 'エクアドル',
  'New Zealand': 'ニュージーランド',
  Panama: 'パナマ',
  Brazil: 'ブラジル',
  Netherlands: 'オランダ',
  Sweden: 'スウェーデン',
  Tunisia: 'チュニジア',
  England: 'イングランド',
  Scotland: 'スコットランド',
  Iceland: 'アイスランド',
  Spain: 'スペイン',
  France: 'フランス',
  Germany: 'ドイツ',
  Argentina: 'アルゼンチン',
  Belgium: 'ベルギー',
  Portugal: 'ポルトガル',
  Italy: 'イタリア',
  Croatia: 'クロアチア',
  Morocco: 'モロッコ',
  Mexico: 'メキシコ',
  Colombia: 'コロンビア',
  Paraguay: 'パラグアイ',
  Korea: '韓国',
}

// homeAway判定表。国外都市→neutral、欧州等の相手国開催→away、国内→home、未知→neutral+警告。
export const VENUE_HINTS = {
  home: [
    'Japan',
    '日本',
    '国立',
    'National Stadium',
    'Tokyo',
    'Osaka',
    'Aichi',
    'Suita',
    'Toyota',
    'Saitama',
    'Hiroshima',
    'Kobe',
    'Sendai',
    'Nagoya',
    'Yokohama',
    'Kashima',
    'Oita',
  ],
  neutralCities: ['Singapore', 'UAE', 'Qatar', 'Saudi', 'Dubai', 'Abu Dhabi', 'Doha', 'Al-Maktoum', 'Bangkok'],
  europe: [
    'England',
    'Scotland',
    'Germany',
    'France',
    'Spain',
    'Netherlands',
    'Italy',
    'Portugal',
    'Belgium',
    'Croatia',
    'Sweden',
    'Iceland',
  ],
}

const MONTHS = {
  January: '01',
  February: '02',
  March: '03',
  April: '04',
  May: '05',
  June: '06',
  July: '07',
  August: '08',
  September: '09',
  October: '10',
  November: '11',
  December: '12',
}

const DATE_RE = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/

function toIsoDate(m) {
  return `${m[4]}-${MONTHS[m[3]]}-${m[2].padStart(2, '0')}`
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// "Brazil National Team" → "Brazil"。"TBC"等のプレースホルダはnull。
function cleanOpponentName(alt) {
  const name = (alt || '').replace(/\s+/g, ' ').trim().replace(/\s+(women's\s+)?national\s+team\s*$/i, '').trim()
  if (!name || /^(TBC|TBD)$/i.test(name)) return null
  if (/SAMURAI BLUE/i.test(name)) return null
  return name
}

function isJapanFlag(src, alt) {
  return /flagJapan\.gif/i.test(src || '') || /SAMURAI BLUE/i.test(alt || '') || /日本代表/.test(alt || '')
}

function extractDetailPath(block) {
  const m = block.match(/\(\/eng\/samuraiblue\/[^)]*\)|href="(\/eng\/samuraiblue\/[^"]*)"/)
  if (!m) return null
  const path = m[1] || m[0].slice(1, -1)
  if (path === '/eng/samuraiblue/') return null
  return path
}

function parseHtmlBlock(block) {
  const dm = block.match(DATE_RE)
  if (!dm) return null
  let competition = ''
  const titleLi = block.match(/<li class="match-title-image">(.*?)<\/li>/s)
  if (titleLi) {
    const alt = titleLi[1].match(/alt="([^"]*)"/)
    competition = alt ? alt[1].trim() : stripTags(titleLi[1])
  }
  const names = [...block.matchAll(/<li class="match-name">(.*?)<\/li>/gs)].map((m) => stripTags(m[1]))
  const venue = (names[1] || '').trim()
  const opponents = new Set()
  for (const m of block.matchAll(/<img src="([^"]*\/flag\/[^"]*)" alt="([^"]*)">/g)) {
    if (isJapanFlag(m[1], m[2])) continue
    const name = cleanOpponentName(m[2])
    if (name) opponents.add(name)
    else if (!/photo-no-image|TBC/i.test(`${m[1]} ${m[2]}`)) opponents.add('')
  }
  const named = [...opponents].filter(Boolean)
  return {
    date: toIsoDate(dm),
    opponentEn: named.length === 1 ? named[0] : null,
    competition,
    venue,
    detailPath: extractDetailPath(block),
  }
}

// フィクスチャ等の簡易Markdown形式 (`#### SAMURAI BLUE` 見出し) の1ブロックを抜く。
function parseMarkdownBlock(block) {
  const dm = block.match(DATE_RE)
  if (!dm) return null
  const comp = block.match(/!\[([^\]]+)\]\(\/international_match\/img\/[^)]*\)/)
  let venue = ''
  for (const m of block.matchAll(/^-\s+(.*)$/gm)) {
    const line = m[1].trim()
    if (!line || DATE_RE.test(line)) continue
    if (line.includes('![') || line.includes('](/') || line.includes('詳細はこちら')) continue
    if (/\bvs\b/i.test(line) || /SAMURAI BLUE/i.test(line)) continue
    venue = line
    break
  }
  const opponents = new Set()
  for (const m of block.matchAll(/!\[([^\]]+)\]\([^)]*\/flag\/[^)]*\)/g)) {
    if (/SAMURAI BLUE/i.test(m[1])) continue
    const name = cleanOpponentName(m[1])
    if (name) opponents.add(name)
  }
  const named = [...opponents].filter(Boolean)
  return {
    date: toIsoDate(dm),
    opponentEn: named.length === 1 ? named[0] : null,
    competition: comp ? comp[1].trim() : '',
    venue,
    detailPath: extractDetailPath(block),
  }
}

// JFA一覧ページからSAMURAI BLUEのブロックのみを抜く (フットサル・なでしこを除外)。
// 過去試合はHTMLコメント化されているため、コメント除去後に残った有効ブロックが対象。
export function parseListPage(html) {
  const active = html.replace(/<!--[\s\S]*?-->/g, '')
  if (active.includes('samuraiblue outer-inner')) {
    const rows = []
    const re = /<div class="samuraiblue outer-inner">([\s\S]*?)<\/ul>\s*<\/div>\s*<\/div>/g
    let m
    while ((m = re.exec(active)) !== null) {
      const row = parseHtmlBlock(m[1])
      if (row) rows.push(row)
    }
    return rows
  }
  return active
    .split(/^####\s+SAMURAI BLUE\s*$/m)
    .slice(1)
    .map(parseMarkdownBlock)
    .filter(Boolean)
}

// 詳細ページから "Kick Off at HH:MM" を抜く。日本開催は日本時間そのまま。
// シンガポール開催の (Local Time) 表記は+1時間して日本時間にする。
// 2試合併記ページでは dateEn (例 "Friday, 14 November 2025") にひもづく時刻を取る。
export function parseDetailKickoff(html, dateEn) {
  let scope = html
  if (dateEn) {
    const i = html.indexOf(dateEn)
    if (i !== -1) scope = html.slice(i)
  }
  const m = scope.match(/Kick Off at\s+(\d{1,2}):(\d{2})/)
  if (!m) return null
  let hh = Number(m[1])
  const mm = m[2]
  const after = scope.slice(m.index, m.index + 80)
  if (/local\s*time/i.test(after) && html.includes('Singapore')) {
    hh = (hh + 1) % 24
  }
  return `${String(hh).padStart(2, '0')}:${mm}`
}

// 詳細ページの "vs X National Team" から対戦相手(英語)を補完する。一覧側がnull時のみ使用。
export function parseDetailOpponent(html) {
  for (const m of html.matchAll(/vs\s+([^<>]{1,80}?)\s*(?:National Team)?\s*(?:<br|<\/)/gi)) {
    const name = cleanOpponentName(m[1])
    if (name) return name
  }
  return null
}

export function resolveHomeAway(venue, opponentEn) {
  const v = (venue || '').toLowerCase()
  const opp = (opponentEn || '').toLowerCase()
  if (!v) {
    console.warn(`unknown venue "${venue}"; assuming neutral`)
    return 'neutral'
  }
  // 対戦相手国と同一開催と読める場合。欧州等の国外ならaway、それ以外はneutral。
  if (opp && v.includes(opp)) {
    return VENUE_HINTS.europe.some((c) => v.includes(c.toLowerCase())) ? 'away' : 'neutral'
  }
  if (VENUE_HINTS.neutralCities.some((c) => v.includes(c.toLowerCase()))) return 'neutral'
  if (VENUE_HINTS.home.some((h) => v.includes(h.toLowerCase()))) return 'home'
  console.warn(`unknown venue "${venue}"; assuming neutral`)
  return 'neutral'
}

function slugifyEn(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// RawMatch + キックオフ(日本時間) → JapanMatch。未知の相手はエラー終了させる。
export function toJapanMatch(raw, kickoff) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) throw new Error(`invalid date "${raw.date}"`)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(kickoff)) throw new Error(`invalid kickoff "${kickoff}"`)
  const opponent = OPPONENT_MAP[raw.opponentEn]
  if (!opponent) {
    throw new Error(`unknown opponent "${raw.opponentEn}" (not in OPPONENT_MAP); data not updated`)
  }
  const competition = (raw.competition || '').replace(/^SAMURAI BLUE\s+/i, '').trim()
  if (!competition) throw new Error(`missing competition for ${raw.date}`)
  const match = {
    id: `${raw.date}-vs-${slugifyEn(raw.opponentEn)}`,
    date: raw.date,
    kickoff,
    opponent,
    competition,
    homeAway: resolveHomeAway(raw.venue, raw.opponentEn),
  }
  if (raw.venue) match.venue = raw.venue
  return match
}

function q(s) {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

// japanMatches.ts 全文を生成する。既存ファイル形式 (JAPAN_MATCHES + generatedAt) と一致させる。
export function renderDataFile(matches, generatedAt) {
  const entries = matches
    .map((m) => {
      const lines = [
        '  {',
        `    id: ${q(m.id)},`,
        `    date: ${q(m.date)},`,
        `    kickoff: ${q(m.kickoff)},`,
        `    opponent: ${q(m.opponent)},`,
        `    competition: ${q(m.competition)},`,
      ]
      if (m.venue !== undefined) lines.push(`    venue: ${q(m.venue)},`)
      lines.push(`    homeAway: ${q(m.homeAway)},`, '  },')
      return lines.join('\n')
    })
    .join('\n')
  return `// JFA公式発表ベースのA代表（SAMURAI BLUE）日程。
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

export const generatedAt = ${q(generatedAt)}

export const JAPAN_MATCHES: JapanMatch[] = [
${entries}
]

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (min: number): string =>
  \`\${String(Math.floor(min / 60)).padStart(2, '0')}:\${String(min % 60).padStart(2, '0')}\`

// 観戦確保枠：キックオフ10分前〜キックオフ＋125分（45＋15＋45＋AT想定10＋余裕10）。
// 日跨ぎ分は切り捨てる（endMin <= 1440 の既存制約に合わせる）。
export function matchWindow(m: Pick<JapanMatch, 'kickoff'>): { start: string; end: string } {
  const start = toMin(m.kickoff) - 10
  const end = Math.min(toMin(m.kickoff) + 125, 1440)
  return { start: toHHMM(Math.max(start, 0)), end: toHHMM(end) }
}

export function daysUntil(date: string, today: string): number {
  const ms = new Date(\`\${date}T00:00:00+09:00\`).getTime() - new Date(\`\${today}T00:00:00+09:00\`).getTime()
  return Math.round(ms / 86400000)
}

const DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/
const TIME_RE = /^([01]\\d|2[0-3]):[0-5]\\d$/

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
`
}

// 空の抽出結果でデータファイルを白紙化しないためのガード。不正扱いで非ゼロ終了させる。
export function buildDataFile(matches, generatedAt) {
  if (matches.length === 0) throw new Error('no upcoming matches found; data not updated')
  return renderDataFile(matches, generatedAt)
}

// ゼロ件時のメイン経路判定 (純粋・単体テスト可能)。page parses fine なら keep/0、
// SAMURAI BLUE節自体が無い (構造破壊) なら throw → main は exit 1。
export function decideOutcome(rows, html) {
  if (rows.length > 0) return { action: 'write' }
  const src = html || ''
  if (!/SAMURAI BLUE/i.test(src) && !/samuraiblue/i.test(src)) {
    throw new Error('SAMURAI BLUE section missing; data not updated')
  }
  return { action: 'keep', reason: 'no upcoming fixtures' }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function dateEnOf(iso) {
  const [y, mo, d] = iso.split('-').map(Number)
  const w = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
  return `${WEEKDAYS[w]}, ${d} ${MONTH_NAMES[mo - 1]} ${y}`
}

function jstNow() {
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return {
    date: `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`,
    iso: `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}T${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())}+09:00`,
  }
}

function fail(msg) {
  console.error(`fetch-japan-matches: ${msg}`)
  process.exit(1)
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) fail(`GET ${url} → HTTP ${res.status}`)
  return res.text()
}

async function main() {
  const listHtml = await fetchText(LIST_URL)
  const today = jstNow().date
  // 未来 (含む今日JST) の試合のみ残す。
  const raws = parseListPage(listHtml).filter((r) => r.date >= today)
  if (raws.length === 0) {
    try {
      const decision = decideOutcome(raws, listHtml)
      console.log(`fetch-japan-matches: ${decision.reason}; data not updated`)
      return
    } catch (e) {
      fail(e.message)
    }
  }
  const matches = []
  for (const raw of raws) {
    if (!raw.detailPath) fail(`no detail page for ${raw.date} (opponent: ${raw.opponentEn}); data not updated`)
    const detailHtml = await fetchText(new URL(raw.detailPath, LIST_URL).toString())
    const kickoff = parseDetailKickoff(detailHtml, dateEnOf(raw.date))
    if (!kickoff) fail(`no kickoff found for ${raw.date}; data not updated`)
    const opponentEn = raw.opponentEn || parseDetailOpponent(detailHtml)
    if (!opponentEn) fail(`unknown opponent for ${raw.date}; data not updated`)
    try {
      matches.push(toJapanMatch({ ...raw, opponentEn }, kickoff))
    } catch (e) {
      fail(e.message)
    }
  }
  matches.sort((a, b) => (a.date < b.date ? -1 : 1))
  // validateJapanMatches相当の検査を自前で行い、不正があれば非ゼロ終了。
  const ids = new Set()
  for (const m of matches) {
    if (
      !m.id ||
      ids.has(m.id) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(m.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.kickoff) ||
      !m.opponent ||
      !m.competition ||
      !['home', 'away', 'neutral'].includes(m.homeAway)
    ) {
      fail(`invalid match data: ${JSON.stringify(m)}`)
    }
    ids.add(m.id)
  }
  let out
  try {
    out = buildDataFile(matches, jstNow().iso)
  } catch (e) {
    fail(e.message)
  }
  const target = fileURLToPath(new URL('../src/data/japanMatches.ts', import.meta.url))
  let current = null
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    fail(`cannot read ${target}`)
  }
  // 差分が無ければファイルに触らず exit 0。
  if (current === out) {
    console.log('fetch-japan-matches: no changes')
    return
  }
  // generatedAtのみの差分は無視するため、日時を現行値で再描画して比較する。
  const gen = current.match(/export const generatedAt = '([^']*)'/)
  if (gen && renderDataFile(matches, gen[1]) === current) {
    console.log('fetch-japan-matches: no changes')
    return
  }
  writeFileSync(target, out)
  console.log(`fetch-japan-matches: updated ${matches.length} match(es)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
