# Slot League Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 今日の計画の時間帯1枠を1試合にし、枠終了後の記録量で同Divの別人相手と勝敗・ラウンド/レーティングを進める

**Architecture:** 新規 `src/lib/slotLeague.ts` に枠キー・相手決め・相手スコア・勝敗判定を集約し、`src/data/seasonStore.ts` に `slotMatches` を追加して枠単位でラウンド/レーティングを進行。UIは `TodayPlanScreen` の終了後ゲート＋やらなかった確定、履歴は `RankingScreen` を枠ベースに切替。

**Tech Stack:** React 18 + TypeScript 5 + Vite 5 + Vitest 2 + localStorage (seasonStore)

**Spec:** `docs/superpowers/specs/2026-10-26-slot-league-design.md`

## Global Constraints

- 試合キー形式 `YYYY-MM-DD#startMin-endMin` を厳守（例 `2026-10-26#390-420`）。
- 対戦相手は `generateRivals(seasonId, div)` の7人から決定的選択、枠ごとに別人になりやすいこと。
- 勝敗は記録量そのまま比較（`my > opp → win`、`== → draw`、`< → loss`、やらなかったは `my=0` で `loss`）。
- Div10〜4は勝ち点制（勝3/分1/負0・10枠1ラウンド）維持、Div3〜1は現行レーティング増減表維持。
- 未来・進行中枠は記録不可、終了後のみ記録可＋確定後ロック（二重計上防止）。
- `npm test` 改め `npx vitest run` で全緑を維持すること。

---

### Task 1: slotLeague core lib

**Files:**
- Create: `src/lib/slotLeague.ts`
- Test: `src/lib/slotLeague.test.ts`

**Interfaces:**
- Consumes: `src/lib/seasonRivals.ts:generateRivals, hashSeed, mulberry32`, `src/lib/seasonLeague.ts:type LeagueDayResult`
- Produces: `makeSlotKey(date,startMin,endMin): string`, `parseSlotKey(key): {date,startMin,endMin} | null`, `rivalForSlot(seasonId,div,slotKey): Rival`, `rivalSlotAmount(rival,slotKey,unitKind,slotMinutes): number`, `leagueSlotInfo(seasonId,div,slotKey,myAmount,unitKind,slotMinutes): {opponent,opponentAmount,result}` — Task 2,3,4が利用

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { makeSlotKey, rivalForSlot, rivalSlotAmount, leagueSlotInfo } from './slotLeague'

describe('slotLeague', () => {
  it('slotKeyは 日付#start-end 形式', () => {
    expect(makeSlotKey('2026-10-26', 390, 420)).toBe('2026-10-26#390-420')
  })
  it('同一キーは同一相手、別キーは分散しやすい', () => {
    const a = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    const b = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    expect(a.id).toBe(b.id)
    const c = rivalForSlot('2026-09-01', 10, '2026-10-26#1005-1035')
    expect(typeof c.name).toBe('string')
  })
  it('30分枠の相手量は日次baseの約1/4±揺らぎ', () => {
    const r = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    const v = rivalSlotAmount(r, '2026-10-26#390-420', 'pages', 30)
    expect(v).toBeGreaterThanOrEqual(1)
    expect(v).toBeLessThanOrEqual(20)
  })
  it('語枠はページbase×15基準で大きくなる', () => {
    const r = rivalForSlot('2026-09-01', 10, '2026-10-26#390-420')
    const p = rivalSlotAmount(r, '2026-10-26#390-420', 'pages', 30)
    const w = rivalSlotAmount(r, '2026-10-26#390-420', 'words', 30)
    expect(w).toBeGreaterThan(p)
  })
  it('my>oppでwin、同値draw、やらなかった想定my=0はlossになりうる', () => {
    const info = leagueSlotInfo('2026-09-01', 10, '2026-10-26#390-420', 10, 'pages', 30)
    expect(['win','draw','loss']).toContain(info.result)
    expect(info.opponent.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/slotLeague.test.ts`
Expected: FAIL with "Failed to resolve import ./slotLeague" / "not defined"

- [ ] **Step 3: Write minimal implementation**

```ts
import { generateRivals, hashSeed, mulberry32, type Rival } from './seasonRivals'
import type { LeagueDayResult } from './seasonLeague'

export const WORDS_PER_PAGE = 15
export const SLOT_DAY_BASE_MIN = 120
export type SlotUnit = 'pages' | 'words' | 'sections'

export function makeSlotKey(date: string, startMin: number, endMin: number): string {
  return `${date}#${startMin}-${endMin}`
}

export function parseSlotKey(key: string): { date: string; startMin: number; endMin: number } | null {
  const m = /^(\d{4}-\d{2}-\d{2})#(\d+)-(\d+)$/.exec(key)
  if (!m) return null
  const startMin = Number(m[2]); const endMin = Number(m[3])
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin) || endMin <= startMin) return null
  return { date: m[1], startMin, endMin }
}

export function rivalForSlot(seasonId: string, div: number, slotKey: string): Rival {
  const rivals = generateRivals(seasonId, div)
  if (rivals.length === 0) return { id: 'r0', name: '—', div, basePages: 20 }
  const h = hashSeed(`slot-opp-${seasonId}-${div}-${slotKey}`)
  return rivals[h % rivals.length]
}

export function rivalSlotAmount(rival: Rival, slotKey: string, unitKind: SlotUnit, slotMinutes: number): number {
  const mins = Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30
  const base = unitKind === 'words' ? rival.basePages * WORDS_PER_PAGE : Math.max(5, rival.basePages)
  const raw = Math.round((base * mins) / SLOT_DAY_BASE_MIN)
  const rand = mulberry32(hashSeed(`slot-amt-${rival.id}-${slotKey}-${unitKind}`))
  const swing = Math.floor(rand() * 21) - 10
  return Math.max(1, raw + swing)
}

export function leagueSlotInfo(seasonId: string, div: number, slotKey: string, myAmount: number, unitKind: SlotUnit, slotMinutes: number): { opponent: string; opponentAmount: number; result: LeagueDayResult } {
  try {
    const rival = rivalForSlot(seasonId, div, slotKey)
    const opp = rivalSlotAmount(rival, slotKey, unitKind, slotMinutes)
    const my = Number.isFinite(myAmount) && myAmount > 0 ? Math.floor(myAmount) : 0
    const result: LeagueDayResult = my > opp ? 'win' : my < opp ? 'loss' : 'draw'
    return { opponent: rival.name, opponentAmount: opp, result }
  } catch {
    return { opponent: '—', opponentAmount: 0, result: 'draw' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/slotLeague.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slotLeague.ts src/lib/slotLeague.test.ts
git commit -m "feat: add slot league core (slot key, opponent, amount)"
```

### Task 2: seasonStore slotMatches + syncLeagueSlot

**Files:**
- Modify: `src/data/seasonStore.ts`
- Test: `src/data/seasonStore.slot.test.ts`

**Interfaces:**
- Consumes: Task 1 `leagueSlotInfo, parseSlotKey`, `src/lib/seasonLeague.ts:appendRoundMatches, tallyToResults`, `src/lib/leagueRating.ts:applyMatchRatings相当`
- Produces: `SeasonState.slotMatches: Record<string, {date,my,opp,oppName,result,unit}>`, `syncLeagueSlot(today, slotKey, entry): SeasonState`, `recordSlotMatch(...): SeasonState` — Task 3,4が利用

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

describe('seasonStore slot', () => {
  it('syncLeagueSlotで1枠1試合がラウンドに加算される', async () => {
    const { loadSeasonState, saveSeasonState } = await import('./seasonStore')
    const { seasonIdForDate } = await import('../lib/seasonLeague')
    localStorage.clear()
    const today = '2026-10-26'
    const st0 = loadSeasonState(today)
    saveSeasonState({ ...st0, div: 10 })
    const { syncLeagueSlot } = await import('./seasonStore')
    const st1 = syncLeagueSlot(today, '2026-10-26#390-420', { my: 10, unit: 'pages', slotMinutes: 30 })
    expect(Object.keys(st1.slotMatches ?? {}).toContain('2026-10-26#390-420'))
    expect((st1.round.w + st1.round.d + st1.round.l)).toBe(1)
    void seasonIdForDate
  })
  it('同一枠の二重確定は2回目を無視する', async () => {
    const { syncLeagueSlot } = await import('./seasonStore')
    const today = '2026-10-26'
    const a = syncLeagueSlot(today, '2026-10-26#390-420', { my: 10, unit: 'pages', slotMinutes: 30 })
    const b = syncLeagueSlot(today, '2026-10-26#390-420', { my: 99, unit: 'pages', slotMinutes: 30 })
    expect(b.slotMatches['2026-10-26#390-420'].my).toBe(a.slotMatches['2026-10-26#390-420'].my)
  })
  it('やらなかった(my=0)はlossで勝ち点0', async () => {
    localStorage.clear()
    const { loadSeasonState, saveSeasonState, syncLeagueSlot } = await import('./seasonStore')
    const st0 = loadSeasonState('2026-10-27')
    saveSeasonState({ ...st0, div: 10 })
    const st1 = syncLeagueSlot('2026-10-27', '2026-10-27#390-420', { my: 0, unit: 'pages', slotMinutes: 30, forfeit: true })
    expect(st1.slotMatches['2026-10-27#390-420'].result).toBe('loss')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/seasonStore.slot.test.ts`
Expected: FAIL (`syncLeagueSlot is not a function` / `slotMatches undefined`)

- [ ] **Step 3: Write minimal implementation**

`src/data/seasonStore.ts` に以下を追加（既存importに `leagueSlotInfo, makeSlotKey` 系と `SlotUnit` を足す）：

```ts
import { leagueSlotInfo, parseSlotKey, rivalForSlot, type SlotUnit } from '../lib/slotLeague'
import { rivalRatingFor } from '../lib/leagueRating'

export type SlotMatchEntry = { date: string; my: number; opp: number; oppName: string; result: LeagueDayResult; unit: SlotUnit }
```

`SeasonState` に `slotMatches: Record<string, SlotMatchEntry>` を追加し、`normalizeSlotMatches()` で旧データは `{}` 扱い。`loadSeasonState` の2箇所のreturnに `slotMatches: {}` と既存読込対応を入れる。`saveSeasonState` はそのまま。

```ts
function normalizeSlotMatches(v: unknown): Record<string, SlotMatchEntry> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, SlotMatchEntry> = {}
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    if (typeof o['date'] !== 'string' || typeof o['result'] !== 'string') continue
    out[k] = e as SlotMatchEntry
  }
  return out
}

export function syncLeagueSlot(today: string, slotKey: string, input: { my: number; unit: SlotUnit; slotMinutes: number; forfeit?: boolean }): SeasonState {
  let s = loadSeasonState(today)
  if (typeof slotKey !== 'string' || !slotKey.includes('#')) return s
  const parsed = parseSlotKey(slotKey)
  if (!parsed) return s
  if (s.slotMatches?.[slotKey]) return s
  const seasonId = seasonIdForDate(parsed.date)
  const my = input.forfeit ? 0 : (Number.isFinite(input.my) && input.my >= 0 ? Math.floor(input.my) : 0)
  const info = leagueSlotInfo(seasonId, s.div, slotKey, my, input.unit, input.slotMinutes)
  const result: LeagueDayResult = input.forfeit ? 'loss' : info.result
  const entry: SlotMatchEntry = { date: parsed.date, my, opp: info.opponentAmount, oppName: info.opponent, result, unit: input.unit }
  const rival = rivalForSlot(seasonId, s.div, slotKey)
  const oppRating = rivalRatingFor(rival.id, s.div)
  const stamp = `${parsed.date}${slotKey.slice(10)}`
  let next: SeasonState = { ...s, slotMatches: { ...(s.slotMatches ?? {}), [slotKey]: entry } }
  next = appendRoundMatches(next, next.div, [{ date: stamp, result }])
  next = applyMatchRatings(next, next.div, [{ date: stamp, result, oppRating }])
  saveSeasonState(next)
  return next
}
```

※ `oppRating` は実装時に `rivalForSlot(seasonId, s.div, slotKey)` → `rivalRatingFor(rival.id, s.div)` で求めた値を使うこと（テストの勝敗数には影響しない）。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/seasonStore.slot.test.ts src/data/seasonStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/seasonStore.ts src/data/seasonStore.slot.test.ts
git commit -m "feat: add slotMatches and syncLeagueSlot"
```

### Task 3: TodayPlanScreen 終了後ゲート＋記録/やらなかった

**Files:**
- Modify: `src/screens/TodayPlanScreen.tsx:610-830`
- Test: `src/screens/TodayPlanScreen.test.tsx`（追記）

**Interfaces:**
- Consumes: Task 1 `makeSlotKey`, Task 2 `syncLeagueSlot, loadSeasonState`
- Produces: 終了後枠のみ記録可UI、確定後ロック表示（Task 4は表示だけ参照）

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import TodayPlanScreen from './TodayPlanScreen'

describe('today slot gate', () => {
  it('未来枠は「終了後に記録できます」と表示し記録ボタンが無効', () => {
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-10-26" />)
    // 実装後に data-testid="slot-gate-future" が存在することを期待
    expect(document.body.innerHTML).toBeDefined()
  })
})
```

※既存 `TodayPlanScreen.test.tsx` のパターン（`render`＋`today` prop）に合わせ、実装時に `slot-gate-future` / `slot-missed` / `slot-locked` の3 testidを断言に置き換える。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/TodayPlanScreen.test.tsx -t "slot gate"`
Expected: FAIL（testidが存在しない）または既存テストのみPASSで新規断言がFAIL

- [ ] **Step 3: Write minimal implementation**

`displayedRows` のmap内に以下を追加：

```tsx
import { makeSlotKey } from '../lib/slotLeague'
import { loadSeasonState, syncLeagueSlot } from '../data/seasonStore'

const slotKey = makeSlotKey(today, s.startMin, s.endMin)
const slotMinutes = s.endMin - s.startMin
const isPast = today < todayStr() ? true : today > todayStr() ? false : s.endMin <= nowMin
const locked = (() => { try { return !!loadSeasonState(today).slotMatches?.[slotKey] } catch { return false } })()
const unitKind = isCycles ? (isLeapBook(book as never) ? 'words' as const : 'sections' as const) : 'pages' as const
```

表示分岐：

```tsx
{!isPast && <div data-testid="slot-gate-future">終了後に記録できます</div>}
{isPast && !locked && (
  <>
    {/* 既存の記録/完了ボタンはこのブロック内に移動 */}
    <button data-testid={`slot-missed-${s.bookId}`} type="button" onClick={() => {
      syncLeagueSlot(today, slotKey, { my: 0, unit: unitKind, slotMinutes, forfeit: true })
      setDayMessage(`やらなかったとして記録しました（${fmt(s.startMin)}-${fmt(s.endMin)}）`)
    }}>やらなかった</button>
  </>
)}
{locked && <div data-testid="slot-locked">確定済み</div>}
```

`handleRecord`/`handleComplete`/`handleCycleRecord` の成功直後に `syncLeagueSlot(today, slotKey, { my: pagesOrUnits, unit: unitKind, slotMinutes })` を呼ぶ。未割当（`s.bookId===''`) の過去枠は本選択前は記録UIを出さず、選択後に上記分岐が出る。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/TodayPlanScreen.test.tsx`
Expected: PASS（既存＋新規）

- [ ] **Step 5: Commit**

```bash
git add src/screens/TodayPlanScreen.tsx src/screens/TodayPlanScreen.test.tsx
git commit -m "feat: gate slot recording to after end with forfeit"
```

### Task 4: Ranking履歴を枠ベースに切替

**Files:**
- Modify: `src/screens/RankingScreen.tsx:156-180, 381-470`
- Test: `src/screens/RankingScreen.test.tsx`（追記）

**Interfaces:**
- Consumes: Task 2 `SeasonState.slotMatches`
- Produces: 直近5枠の相手・スコア・勝敗表示、ラウンド状態の枠数ベース表示

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
describe('ranking slot history', () => {
  it('slotMatches直近5件を表示する', async () => {
    const { loadSeasonState, saveSeasonState, syncLeagueSlot } = await import('../data/seasonStore')
    localStorage.clear()
    const today = '2026-10-26'
    const st0 = loadSeasonState(today)
    saveSeasonState({ ...st0, div: 10 })
    syncLeagueSlot(today, '2026-10-26#390-420', { my: 10, unit: 'pages', slotMinutes: 30 })
    const st1 = loadSeasonState(today)
    expect(Object.keys(st1.slotMatches).length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/RankingScreen.test.tsx -t "slot history"`
Expected: FAIL（該当テストなし）→ 新規テストファイルとして `src/screens/RankingScreen.slot.test.tsx` に書けば確実にFAIL→PASSを確認できる

- [ ] **Step 3: Write minimal implementation**

`leagueDaily` を以下に置換：

```ts
const leagueDaily = useMemo(() => {
  try {
    const entries = Object.entries(seasonState.slotMatches ?? {})
      .sort(([a],[b]) => (a < b ? -1 : 1))
      .slice(-5)
      .map(([key, m]) => ({ date: m.date, pages: m.my, average: 0, opponent: m.oppName, opponentPages: m.opp, result: m.result }))
    return entries
  } catch { return [] }
}, [seasonState.slotMatches])
```

ラウンド表示 `played` は `seasonState.round` のまま（Task 2で枠加算済みのため変更不要）。履歴スコアは `leaguePointsForPages` 換算をやめ raw `m.my-m.opp`＋単位接尾辞（語/区画/ページ）で表示。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/RankingScreen.test.tsx src/lib/slotLeague.test.ts src/data/seasonStore.slot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/RankingScreen.tsx src/screens/RankingScreen.test.tsx
git commit -m "feat: show slot-based league history"
```

### Task 5: Home同期切替＋旧日次リーグの無効化

**Files:**
- Modify: `src/screens/HomeScreen.tsx:604-613`, `src/data/seasonStore.ts:syncLeagueDay`
- Test: `src/screens/HomeScreen.test.tsx` 既存確認のみ

**Interfaces:**
- Consumes: Task 2 `slotMatches`
- Produces: 日次 `syncLeagueDay` はリーグ進行なし（全国/EXPのみ）、リーグ進行は枠確定時のみ

- [ ] **Step 1: Write the failing test**

既存テストで担保：`npx vitest run src/screens/HomeScreen.test.tsx` がPASSすることを確認し、以下を手動断言として追加しない（回帰のみ）。

- [ ] **Step 2: Run test to verify current behavior**

Run: `npx vitest run src/screens/HomeScreen.test.tsx`
Expected: PASS（現状）

- [ ] **Step 3: Write minimal implementation**

`HomeScreen.tsx` の `useEffect` を以下に変更：

```ts
useEffect(() => {
  try {
    const pages = combinedActivityOnDate(today, validRecords, validCycles)
    recordSeasonDay(today, pages, streak.streak) // 全国・EXP用に残す
    // リーグ進行は syncLeagueSlot（枠確定時）のみ。syncLeagueDayは呼ばない
  } catch { /* national-only fallback */ }
}, [validRecords, validCycles, today, streak.streak])
```

`seasonStore.ts` の `syncLeagueDay` は残すがリーグ進行2行（`applyMatchRatings`/`appendRoundMatches`）をコメントアウトし、将来削除予定として `// DEPRECATED: slot-based only` を付与。`recordSeasonDay` は変更なし。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/HomeScreen.test.tsx src/data/seasonStore.test.ts`
Expected: PASS（旧 `syncLeagueDay` 依存テストがFAILしたら当該期待値を枠ベースに更新）

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx src/data/seasonStore.ts
git commit -m "feat: stop daily league progression, slot-only"
```

### Task 6: 全体検証＋旧テスト更新

**Files:**
- Modify: `src/lib/seasonLeague.test.ts`, `src/screens/RankingScreen.test.tsx` 内の旧日次期待値
- Test: 全体 `npx vitest run`

- [ ] **Step 1: Write the failing test**

Run: `npx vitest run`
Expected: FAIL（旧 `leagueDayInfo`/`leagueDayResults` 前提のテストが残っていればFAIL箇所を特定）

- [ ] **Step 2: Fix old expectations to slot-based**

旧日次ヘルパー `leagueDayInfo`/`leagueDayResults` を残すが、テストの期待値を枠ベースに更新：`leagueSlotInfo` で同値検証を追加し、日次平均テストは削除せず `slotLeague.test.ts` に移譲する旨のコメントを付与。

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: PASS（全ファイル）

- [ ] **Step 4: Run typecheck and build**

Run: `npx tsc --noEmit`
Expected: PASS（エラーなし）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: align legacy tests to slot league"
```
