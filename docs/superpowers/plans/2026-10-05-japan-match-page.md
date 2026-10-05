# 日本代表戦ページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SAMURAI BLUEの試合日程・カウントダウンを表示し、「観る」選択でその日の学習時間を自動確保するページを作る。

**Architecture:** JFA公式発表ベースの静的データ＋当日上書き枠の流用。ブラウザの外部通信は増やさない。`SchoolScreen`/`schoolEvents`パターンを踏襲する。

**Tech Stack:** React 18, TypeScript, Dexie (IndexedDB), Vitest + Testing Library + fake-indexeddb, VitePWA.

**Spec:** `docs/superpowers/specs/2026-10-05-japan-match-page-design.md`

## Global Constraints

- TDD必須: 先に失敗テストを書きRED確認、それから最小実装しGREEN確認。証拠をレポートに残す。
- テスト実行は `cmd /c npm test -- --run`（作業ディレクトリから。`npm.ps1`直接実行はExecutionPolicyで失敗するため必ず`cmd /c`経由）。
- 作業は `superpowers:using-git-worktrees` で作った分離ワークツリー（ブランチ名 `japan-match`）で行い、`main`を直接変更しない。
- YAGNI: 指示以外の機能追加・リファクタをしない。`public/llm-probe.html`・写真・動画ファイルに触れない。
- 新規の日付指定上書き枠は既存バックアップ検証を必ず通る形にする：`weekday: null`、`date: "YYYY-MM-DD"`（実在日）、`start/end: "HH:MM"`（`00:00`〜`24:00`、開始＜終了）。
- 既存テスト全件グリーンを維持する。コミットメッセージは `japan(taskN): ...` 形式。
- Subagentはさらにsubagentを起動しない。

---

## File Map

- Create: `src/data/japanMatches.ts` — 試合型・初期データ・窓関数・バリデーション（1つの責務：日程データ）
- Create: `src/data/japanMatches.test.ts` — 上記のテスト
- Create: `src/lib/matchBlock.ts` — 観戦枠の差し引き・観る/観ない/復元操作（1つの責務：確保ロジック）
- Create: `src/lib/matchBlock.test.ts` — 上記のテスト
- Create: `src/screens/JapanMatchScreen.tsx` — ページ表示＋操作（`SchoolScreen`パターン踏襲）
- Create: `src/screens/JapanMatchScreen.test.tsx` — 上記のテスト
- Modify: `src/App.tsx` — `Route`に`{ name: 'japan' }`追加、描画分岐、ホームフッターに`nav-japan`ボタン追加

---

### Task 1: 日程データ＋観戦枠の導出

**Files:**
- Create: `src/data/japanMatches.ts`
- Test: `src/data/japanMatches.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `JapanMatch`, `JAPAN_MATCHES`, `matchWindow(m) -> { start: string; end: string }`, `validateJapanMatches(data: unknown) -> boolean`, `daysUntil(date: string, today: string) -> number`（Task 2・3が使用）

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { JAPAN_MATCHES, matchWindow, validateJapanMatches, daysUntil } from './japanMatches'

describe('japanMatches', () => {
  it('ships the 2026-10-05 final vs New Zealand at 19:30', () => {
    const m = JAPAN_MATCHES.find((x) => x.id === '2026-10-05-kirin-cup-final')
    expect(m).toMatchObject({ date: '2026-10-05', kickoff: '19:30', opponent: 'ニュージーランド' })
  })
  it('derives a 19:20-21:35 window for a 19:30 kickoff', () => {
    expect(matchWindow({ id: 'x', date: '2026-10-05', kickoff: '19:30', opponent: 'NZ', competition: 'K', homeAway: 'home' })).toEqual({ start: '19:20', end: '21:35' })
  })
  it('counts days until the match', () => {
    expect(daysUntil('2026-11-14', '2026-10-05')).toBe(40)
    expect(daysUntil('2026-10-05', '2026-10-05')).toBe(0)
  })
  it('rejects malformed data', () => {
    expect(validateJapanMatches([{ id: 'x', date: '2026-13-99' }])).toBe(false)
    expect(validateJapanMatches(JAPAN_MATCHES)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- --run src/data/japanMatches.test.ts`
Expected: FAIL with "Failed to resolve import" (module does not exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
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

export const generatedAt = '2026-10-05T00:00:00+09:00'

export const JAPAN_MATCHES: JapanMatch[] = [
  {
    id: '2026-10-05-kirin-cup-final',
    date: '2026-10-05',
    kickoff: '19:30',
    opponent: 'ニュージーランド',
    competition: 'KIRIN CUP SOCCER 2026 決勝',
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npm test -- --run src/data/japanMatches.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/data/japanMatches.ts src/data/japanMatches.test.ts
git commit -m "japan(task1): match data and window derivation"
```

---

### Task 2: 観る/観ない/復元の確保ロジック

**Files:**
- Create: `src/lib/matchBlock.ts`
- Test: `src/lib/matchBlock.test.ts`

**Interfaces:**
- Consumes: `JapanMatch`, `matchWindow` (Task 1); `AvailabilitySlot`, `listAvailability`, `saveAvailabilitySlot` from `../data/dayplanStore`; `db` from `../db/database`; `slotsForDate` from `./dayplan`
- Produces: `subtractWindow(slots, start, end)`, `watchMatch(matchId)`, `skipMatch(matchId)`, `restoreMatch(matchId)`, `getWatchDecision(matchId)`（Task 3が使用）

仕様（exact）：
- `subtractWindow(slots: { startMin: number; endMin: number }[], start: string, end: string)`：分単位に直した窓と重なる部分を除外し、残りを返す。接触（端点一致）は重なりとみなさない。例：枠09:00-12:00・窓10:00-11:00 → 09:00-10:00と11:00-12:00。窓が枠を覆う → 空配列。窓が枠外 → そのまま。
- 決定の保存先：`localStorage` キー `schedule-app-japan-watch`（`{ [matchId]: 'watch' | 'skip' }` のJSON。壊れていたら `{}` 扱い）。
- バックアップ保存先：`localStorage` キー `schedule-app-japan-backup`（`{ [matchId]: AvailabilitySlot[] }`。壊れていたら `{}` 扱い）。
- `watchMatch(matchId)`：`JAPAN_MATCHES` から試合を探す（無ければ `{ ok: false, error: '試合が見つかりません' }`）。`listAvailability()` で全枠取得 → `slotsForDate(all, match.date)` で有効枠を求める → `matchWindow` で差し引き → 残りを `date: match.date, weekday: null` の新規枠（`id: crypto.randomUUID()`、`bookId`・`onTrain` は元の枠から引き継ぐ）として保存する。保存前に、その日の既存の日付指定枠を全削除し、削除した枠をバックアップに記録する（既存バックアップがあれば上書き）。決定を `'watch'` で保存。戻り値 `{ ok: true }`。
- `skipMatch(matchId)`：バックアップがあれば日付指定枠をバックアップに戻す（バックアップに無いIDの日付指定枠は削除）。決定を `'skip'` で保存。戻り値 `{ ok: true }`。試合が無ければ `{ ok: false, error: '試合が見つかりません' }`。
- `restoreMatch(matchId)`：`skipMatch` と同じ復元処理を行い、決定記録を消す。戻り値 `{ ok: true }`。
- 日付指定枠の列挙は `db.availability.where('date').equals(match.date)` で行う。

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { subtractWindow, watchMatch, skipMatch, restoreMatch, getWatchDecision } from './matchBlock'

const min = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

describe('subtractWindow', () => {
  it('splits a slot around the window', () => {
    expect(subtractWindow([{ startMin: min('09:00'), endMin: min('12:00') }], '10:00', '11:00')).toEqual([
      { startMin: min('09:00'), endMin: min('10:00') },
      { startMin: min('11:00'), endMin: min('12:00') },
    ])
  })
  it('drops a fully covered slot and keeps untouched ones', () => {
    expect(subtractWindow([{ startMin: min('10:00'), endMin: min('11:00') }], '09:00', '12:00')).toEqual([])
  })
  it('treats touching edges as no overlap', () => {
    expect(subtractWindow([{ startMin: min('09:00'), endMin: min('10:00') }], '10:00', '11:00')).toEqual([
      { startMin: min('09:00'), endMin: min('10:00') },
    ])
  })
})

describe('watch/skip/restore', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.availability.clear()
    await db.availability.add({ id: 'w1', weekday: 1, date: null, start: '19:00', end: '22:00' })
  })
  it('watchMatch removes the match window and records the decision', async () => {
    const res = await watchMatch('2026-11-14-vs-brazil')
    expect(res).toEqual({ ok: true })
    expect(getWatchDecision('2026-11-14-vs-brazil')).toBe('watch')
    const day = await db.availability.where('date').equals('2026-11-14').toArray()
    expect(day.map((s) => `${s.start}-${s.end}`).toEqual(['19:05-19:15', '21:20-22:00'])
  })
  it('restoreMatch brings back the original slots', async () => {
    await watchMatch('2026-11-14-vs-brazil')
    const res = await restoreMatch('2026-11-14-vs-brazil')
    expect(res).toEqual({ ok: true })
    expect(getWatchDecision('2026-11-14-vs-brazil')).toBeNull()
    const day = await db.availability.where('date').equals('2026-11-14').toArray()
    expect(day).toEqual([])
  })
  it('skipMatch only records the decision', async () => {
    const res = await skipMatch('2026-11-14-vs-brazil')
    expect(res).toEqual({ ok: true })
    expect(getWatchDecision('2026-11-14-vs-brazil')).toBe('skip')
    expect(await db.availability.where('date').equals('2026-11-14').count()).toBe(0)
  })
  it('rejects unknown matches', async () => {
    expect(await watchMatch('no-such-match')).toEqual({ ok: false, error: '試合が見つかりません' })
  })
})
```

注意：2026-11-14は金曜。`weekday: 1`（月曜）の枠は `slotsForDate(all, '2026-11-14')` では有効にならない。
テストを成立させるため、`beforeEach` の枠は `weekday` ではなく `date: '2026-11-14'` の日付指定枠にすること。
正しくは：`await db.availability.add({ id: 'd1', weekday: null, date: '2026-11-14', start: '19:00', end: '22:00' })`。
窓は 19:05-21:20（19:15−10分〜19:15＋125分）。残りは 19:00-19:05 ではなく上記テストの期待値が正しいか再計算すること：
開始 19:00-22:00（1140-1320分）、窓 19:05-21:20（1145-1280分）→ 残り 1140-1145（19:00-19:05）と 1280-1320（21:20-22:00）。
よって期待値は `['19:00-19:05', '21:20-22:00']` が正しい。上記コードの `'19:05-19:15'` は誤りのため、実装者は正しい値に直してテストを書くこと。

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- --run src/lib/matchBlock.test.ts`
Expected: FAIL with "Failed to resolve import" (module does not exist yet)

- [ ] **Step 3: Write minimal implementation**（上記仕様の通り。`bookId`・`onTrain` は分割後の両片に引き継ぐ）

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npm test -- --run src/lib/matchBlock.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchBlock.ts src/lib/matchBlock.test.ts
git commit -m "japan(task2): watch block and restore logic"
```

---

### Task 3: ページ＋配線

**Files:**
- Create: `src/screens/JapanMatchScreen.tsx`
- Test: `src/screens/JapanMatchScreen.test.tsx`
- Modify: `src/App.tsx`（Route追加・描画分岐・フッターのホーム欄に代表戦ボタン追加）

**Interfaces:**
- Consumes: Task 1（`JAPAN_MATCHES`, `daysUntil`, `matchWindow`）、Task 2（`watchMatch`, `skipMatch`, `restoreMatch`, `getWatchDecision`）、`todayStr` from `../lib/progress`

仕様（exact）：
- `type Props = { onBack: () => void; today?: string }`（`today` はテスト用。未指定時は `todayStr()`）。
- `data-testid="japan-page"`。見出し「日本代表戦」。末尾に「JFA公式発表ベース・更新：`generatedAt`の日付」。
- 青基調：ページ見出し帯 `backgroundColor: '#1d4ed8', color: '#fff'`。カウントダウンは大きく太字。
- 直近の試合（`date >= today` の最小日）を先頭に「次の試合」として表示：`data-testid="japan-next"`、対戦相手・大会・会場・キックオフ・`あとX日`（Xは `daysUntil`。0なら「今日」）。
- 全試合カード：`data-testid="japan-match-<id>"`。中に `観る` ボタン（`data-testid="japan-watch-<id>"`）、`観ない` ボタン（`data-testid="japan-skip-<id>"`）。
- 決定済み（watch）なら `data-testid="japan-blocked-<id>"` で「観戦のため確保中」を表示し、`元に戻す` ボタン（`data-testid="japan-restore-<id>"`）を出す。
- ボタン押下は対応する Task 2 関数を `await` し、完了後に決定状態を再読込して再描画する。失敗時（`ok: false`）は `data-testid="japan-error"` にエラーメッセージを出す。
- マウント時に `window.scrollTo(0, 0)`（`SchoolScreen` と同じ。テストでは `window.scrollTo = vi.fn()`）。
- `App.tsx`：`Route` に `| { name: 'japan' }` を追加。`route.name === 'japan'` で `<JapanMatchScreen onBack={() => setRoute({ name: 'home' })} />` を描画。ホームフッター欄に `<button data-testid="nav-japan" onClick={() => setRoute({ name: 'japan' })}>代表戦</button>` を追加（`nav-ai` の次）。

- [ ] **Step 1: Write the failing test**（`JapanMatchScreen.test.tsx`。DBを使う操作系は `fake-indexeddb`（`test/setup.ts` で自動）＋ `db.availability.clear()` の `beforeEach` を使う）

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import JapanMatchScreen from './JapanMatchScreen'
import { db } from '../db/database'

describe('JapanMatchScreen', () => {
  beforeEach(async () => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    localStorage.clear()
    await db.availability.clear()
  })
  it('shows the page with the next match and countdown', () => {
    render(<JapanMatchScreen onBack={() => {}} today="2026-10-05" />)
    expect(screen.getByTestId('japan-page')).toBeInTheDocument()
    expect(screen.getByTestId('japan-next')).toHaveTextContent('ニュージーランド')
    expect(screen.getByTestId('japan-next')).toHaveTextContent('今日')
  })
  it('counts down to the Brazil match', () => {
    render(<JapanMatchScreen onBack={() => {}} today="2026-10-05" />)
    expect(screen.getByTestId('japan-match-2026-11-14-vs-brazil')).toHaveTextContent('あと40日')
  })
  it('watch blocks the match window and restore brings it back', async () => {
    await db.availability.add({ id: 'd1', weekday: null, date: '2026-11-14', start: '19:00', end: '22:00' })
    render(<JapanMatchScreen onBack={() => {}} today="2026-10-05" />)
    fireEvent.click(screen.getByTestId('japan-watch-2026-11-14-vs-brazil'))
    expect(await screen.findByTestId('japan-blocked-2026-11-14-vs-brazil')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('japan-restore-2026-11-14-vs-brazil'))
    expect(await screen.findByTestId('japan-watch-2026-11-14-vs-brazil')).toBeInTheDocument()
  })
  it('calls onBack when the back button is tapped', () => {
    const onBack = vi.fn()
    render(<JapanMatchScreen onBack={onBack} today="2026-10-05" />)
    fireEvent.click(screen.getByTestId('japan-back'))
    expect(onBack).toHaveBeenCalled()
  })
})
```

`App.tsx` の配線テスト（`src/App.test.tsx` に追加。既存の TodayPlan 遷移テストと同型）:

```tsx
it('navigates to the japan match screen from home', async () => {
  render(<App />)
  fireEvent.click(screen.getByTestId('nav-japan'))
  expect(await screen.findByTestId('japan-page')).toBeInTheDocument()
})
```

（`App.test.tsx` の既存 import/`beforeEach` 流儀に従うこと。`window.scrollTo` は既存テストと同様に未実装警告が出るだけで失敗しない）

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- --run src/screens/JapanMatchScreen.test.tsx`
Expected: FAIL with "Failed to resolve import"

- [ ] **Step 3: Write minimal implementation**（上記仕様の通り。文言は仕様の exact 値を使う）

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npm test -- --run src/screens/JapanMatchScreen.test.tsx src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/JapanMatchScreen.tsx src/screens/JapanMatchScreen.test.tsx src/App.tsx src/App.test.tsx
git commit -m "japan(task3): match page and wiring"
```

---

### Task 4: JFA照合・最終検証

**Files:** 変更は原則なし（データ誤りがあった場合のみ `src/data/japanMatches.ts` を修正）

- [ ] **Step 1: JFA公式と照合する**。`https://www.jfa.jp/eng/international_match/` および各特設ページで、データ内の全試合の日付・キックオフ（日本時間）・対戦相手・大会・会場を確認する。11/14ブラジル戦は現地18:15（SGT）＝日本時間19:15であることを確認する。誤りがあればテストの期待値を先に直してREDを確認し、データを直してGREENを確認する（TDDのRED→GREENを残すこと）。
- [ ] **Step 2: フルスイートを実行する**。Run: `cmd /c npm test -- --run`。Expected: 全ファイルPASS（既知の `window.scrollTo`・`revokeObjectURL` のjsdomノイズを除く）。
- [ ] **Step 3: 型検査を実行する**。Run: `cmd /c npx tsc -b`。Expected: 出力なし（exit 0）。
- [ ] **Step 4: Commit**（データ修正があった場合のみ）。```bash
git add src/data/japanMatches.ts src/data/japanMatches.test.ts
git commit -m "japan(task4): verify fixtures against JFA"
```
