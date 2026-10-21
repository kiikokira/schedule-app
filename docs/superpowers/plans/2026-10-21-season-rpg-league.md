# 統合シーズン制 RPG+リーグ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4週間28節・Div10〜Div1のRPG+リーグを完全ローカルで動かしスマホに届ける

**Architecture:** 純粋関数3本（日程・ライバル・EXP）＋localStorage永続化1本＋RankingタブUI＋Home/MyPage追記の6層。既存books/recordsは読み専、フッター変更なし。

**Tech Stack:** React 18, TypeScript, Dexieなし（localStorageのみ）, vitest + jsdom, vite build + GitHub Pages deploy

**Spec:** docs/superpowers/specs/2026-10-21-season-rpg-league-design.md

## Global Constraints

- 完全オフライン、サーバー送信なし、保存は端末内のみ
- ホーム画面フッターに新規欄を追加しない（今日の計画 / スケジュールで参考書を追加 / 調整AI / ＋参考書を追加 / 設定の5つのみ）
- 実況文を作らない（順位表と前日比▲▼のみ）
- Div10スタート、上に行くほど難化、1シーズン=4週間28節
- eFootball式：デイリーptで毎日順位変動、星取表あり
- 既存全テストのグリーン維持＋`npm run build`成功
- 昇格2/降格2、Div10降格なし、Div1昇格なし

---

### Task 1: シーズン日程コア

**Files:**
- Create: `src/lib/seasonLeague.ts`
- Test: `src/lib/seasonLeague.test.ts`

**Interfaces:**
- Consumes: なし（日付文字列のみ）
- Produces: `seasonIdForDate(date: string): string`, `seasonStartForDate(date: string): string`, `seasonDayIndex(date: string): number`, `isSeasonFinalDay(date: string): boolean`, `decidePromotion(sortedIds: string[]): { promote: string[], demote: string[] }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { seasonIdForDate, seasonDayIndex, isSeasonFinalDay, decidePromotion } from './seasonLeague'

describe('seasonLeague', () => {
  it('anchor 2026-09-01から28日ブロックでseasonIdが決まる', () => {
    expect(seasonIdForDate('2026-09-01')).toBe('2026-09-01')
    expect(seasonIdForDate('2026-09-28')).toBe('2026-09-01')
    expect(seasonIdForDate('2026-09-29')).toBe('2026-09-29')
  })
  it('day indexは0-27、最終日は27', () => {
    expect(seasonDayIndex('2026-09-01')).toBe(0)
    expect(seasonDayIndex('2026-09-28')).toBe(27)
    expect(isSeasonFinalDay('2026-09-28')).toBe(true)
    expect(isSeasonFinalDay('2026-09-27')).toBe(false)
  })
  it('8人中上位2昇格・下位2降格', () => {
    const ids = ['a','b','c','d','e','f','g','h']
    expect(decidePromotion(ids)).toEqual({ promote: ['a','b'], demote: ['g','h'] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/seasonLeague.test.ts`
Expected: FAIL with "Cannot find module './seasonLeague'"

- [ ] **Step 3: Write minimal implementation**

```ts
const ANCHOR = '2026-09-01'
function toUTC(d: string): number { return Date.parse(d + 'T00:00:00Z') }
export function seasonStartForDate(date: string): string {
  const diff = Math.floor((toUTC(date) - toUTC(ANCHOR)) / 86400000)
  const block = Math.floor(diff / 28)
  const t = new Date(toUTC(ANCHOR) + block * 28 * 86400000)
  return t.toISOString().slice(0, 10)
}
export function seasonIdForDate(date: string): string { return seasonStartForDate(date) }
export function seasonDayIndex(date: string): number {
  return Math.floor((toUTC(date) - toUTC(seasonStartForDate(date))) / 86400000)
}
export function isSeasonFinalDay(date: string): boolean { return seasonDayIndex(date) === 27 }
export function decidePromotion(sortedIds: string[]): { promote: string[]; demote: string[] } {
  return { promote: sortedIds.slice(0, 2), demote: sortedIds.slice(-2) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/seasonLeague.test.ts`
Expected: PASS 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/seasonLeague.ts src/lib/seasonLeague.test.ts
git commit -m "feat: シーズン日程コア28節判定"
```

### Task 2: ライバル生成（Div難化）

**Files:**
- Create: `src/lib/seasonRivals.ts`
- Test: `src/lib/seasonRivals.test.ts`

**Interfaces:**
- Consumes: `seasonIdForDate` from Task 1（型のみ、importして使う）
- Produces: `Rival { id, name, div, basePages }`, `DIV_BASE_PAGES: Record<number, number>`, `generateRivals(seasonId: string, div: number): Rival[]`, `rivalPagesForDay(rival: Rival, dayIndex: number): number`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { generateRivals, rivalPagesForDay, DIV_BASE_PAGES } from './seasonRivals'

describe('seasonRivals', () => {
  it('7人生成・同一seedで同一', () => {
    const a = generateRivals('2026-09-01', 10)
    const b = generateRivals('2026-09-01', 10)
    expect(a.length).toBe(7)
    expect(a).toEqual(b)
  })
  it('Div1はDiv10より強い', () => {
    expect(DIV_BASE_PAGES[1]).toBeGreaterThan(DIV_BASE_PAGES[10])
    const weak = generateRivals('2026-09-01', 10)
    const strong = generateRivals('2026-09-01', 1)
    const avg = (rs: { id: string }[]) => rs.reduce((s, r, i) => s + rivalPagesForDay(r as never, i), 0) / rs.length
    expect(avg(strong)).toBeGreaterThan(avg(weak))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/seasonRivals.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```ts
import { seasonIdForDate } from './seasonLeague'
export type Rival = { id: string; name: string; div: number; basePages: number }
export const DIV_BASE_PAGES: Record<number, number> = { 10: 20, 9: 30, 8: 40, 7: 50, 6: 60, 5: 75, 4: 90, 3: 110, 2: 130, 1: 150 }
const NAMES = ['カナタ', 'ミレイ', 'ソウタ', 'ユズ', 'ハル', 'アオイ', 'レン']
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function generateRivals(seasonId: string, div: number): Rival[] {
  void seasonIdForDate
  const base = DIV_BASE_PAGES[div] ?? 20
  return NAMES.map((name, i) => {
    const rand = mulberry32(hashSeed(`rival-${seasonId}-${div}-${i}`))
    const jitter = Math.floor(rand() * (div <= 3 ? 12 : 24)) - (div <= 3 ? 6 : 12)
    return { id: `r${div}-${i}`, name: `AI${name}`, div, basePages: Math.max(5, base + jitter) }
  })
}
export function rivalPagesForDay(rival: Rival, dayIndex: number): number {
  const rand = mulberry32(hashSeed(`day-${rival.id}-${dayIndex}`))
  const swing = Math.floor(rand() * 21) - 10
  return Math.max(0, rival.basePages + swing)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/seasonRivals.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seasonRivals.ts src/lib/seasonRivals.test.ts
git commit -m "feat: Div難化ライバル生成"
```

### Task 3: EXP・レベル

**Files:**
- Create: `src/lib/seasonExp.ts`
- Test: `src/lib/seasonExp.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `pagesToExp(pages: number, streakDays: number): number`, `levelForExp(exp: number): number`, `comboMultiplier(streakDays: number): number`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { pagesToExp, levelForExp, comboMultiplier } from './seasonExp'

describe('seasonExp', () => {
  it('10ページ=100EXP基準、連続で倍率', () => {
    expect(pagesToExp(10, 0)).toBe(100)
    expect(pagesToExp(10, 7)).toBe(150)
  })
  it('レベルは1000EXPごと', () => {
    expect(levelForExp(0)).toBe(1)
    expect(levelForExp(1000)).toBe(2)
  })
  it('コンボ倍率は3日1.2・7日1.5', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(3)).toBe(1.2)
    expect(comboMultiplier(7)).toBe(1.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/seasonExp.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
export function comboMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 1.5
  if (streakDays >= 3) return 1.2
  return 1
}
export function pagesToExp(pages: number, streakDays: number): number {
  return Math.round(pages * 10 * comboMultiplier(streakDays))
}
export function levelForExp(exp: number): number {
  return Math.floor(exp / 1000) + 1
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/seasonExp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seasonExp.ts src/lib/seasonExp.test.ts
git commit -m "feat: EXPレベル換算"
```

### Task 4: シーズン永続化ストア

**Files:**
- Create: `src/data/seasonStore.ts`
- Test: `src/data/seasonStore.test.ts`

**Interfaces:**
- Consumes: Task 1-3（`seasonIdForDate`, `generateRivals`, `pagesToExp`）
- Produces: `SeasonState { seasonId, div, exp, days: Record<string, number> }`, `loadSeasonState(today: string): SeasonState`, `saveSeasonState(s: SeasonState): void`, `recordSeasonDay(today: string, pages: number, streak: number): SeasonState`, `applyPromotionIfNeeded(today: string, tableIds: string[], myId: string): SeasonState`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { loadSeasonState, recordSeasonDay } from './seasonStore'

describe('seasonStore', () => {
  beforeEach(() => localStorage.clear())
  it('初回はDiv10、記録でexp加算', () => {
    const s0 = loadSeasonState('2026-09-01')
    expect(s0.div).toBe(10)
    const s1 = recordSeasonDay('2026-09-01', 10, 0)
    expect(s1.exp).toBe(100)
    expect(s1.days['2026-09-01']).toBe(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/seasonStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import { seasonIdForDate, decidePromotion, isSeasonFinalDay } from '../lib/seasonLeague'
import { pagesToExp } from '../lib/seasonExp'
export type SeasonState = { seasonId: string; div: number; exp: number; days: Record<string, number> }
const KEY = 'schedule-app-season'
export function loadSeasonState(today: string): SeasonState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as SeasonState
      if (p.seasonId === seasonIdForDate(today)) return p
    }
  } catch { /* ignore */ }
  return { seasonId: seasonIdForDate(today), div: 10, exp: 0, days: {} }
}
export function saveSeasonState(s: SeasonState): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
export function recordSeasonDay(today: string, pages: number, streak: number): SeasonState {
  const s = loadSeasonState(today)
  if (s.days[today] === pages) return s
  const next: SeasonState = { ...s, exp: s.exp + pagesToExp(pages, streak), days: { ...s.days, [today]: pages } }
  saveSeasonState(next)
  return next
}
export function applyPromotionIfNeeded(today: string, tableIds: string[], myId: string): SeasonState {
  const s = loadSeasonState(today)
  if (!isSeasonFinalDay(today)) return s
  const { promote, demote } = decidePromotion(tableIds)
  let div = s.div
  if (promote.includes(myId)) div = Math.max(1, div - 1)
  else if (demote.includes(myId)) div = Math.min(10, div + 1)
  const next: SeasonState = { seasonId: s.seasonId, div, exp: s.exp, days: s.days }
  saveSeasonState(next)
  return next
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/seasonStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/seasonStore.ts src/data/seasonStore.test.ts
git commit -m "feat: シーズン永続化Div10開始"
```

### Task 5: Rankingリーグ・RPGタブUI

**Files:**
- Modify: `src/screens/RankingScreen.tsx`
- Test: `src/screens/RankingScreen.test.tsx`に追記

**Interfaces:**
- Consumes: Task 1,2,4（seasonId、rivals、store）
- Produces: `data-testid="league-tab"`, `data-testid="league-board"`, `data-testid="league-row-you"`, `data-testid="rpg-tab"`, `data-testid="rpg-level"`（全国タブ既存維持、フッター変更なし）

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import RankingScreen from './RankingScreen'
it('リーグタブでDiv10順位表が出る', () => {
  localStorage.clear()
  render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
  fireEvent.click(screen.getByTestId('league-tab'))
  expect(screen.getByTestId('league-board')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/RankingScreen.test.tsx`
Expected: FAIL with "Unable to find league-tab"

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react'
import { seasonIdForDate, seasonDayIndex } from '../lib/seasonLeague'
import { generateRivals, rivalPagesForDay } from '../lib/seasonRivals'
import { loadSeasonState } from '../data/seasonStore'
import { levelForExp } from '../lib/seasonExp'
import { scoreActivityOnDate } from '../lib/progress'
import { useRecords } from '../hooks/useRecords'

const [tab, setTab] = useState<'national' | 'league' | 'rpg'>('national')
// 見出し下にタブ追加:
<button data-testid="league-tab" type="button" onClick={() => setTab('league')}>リーグ</button>
<button data-testid="rpg-tab" type="button" onClick={() => setTab('rpg')}>RPG</button>
// league表示:
const st = loadSeasonState(today)
const rivals = generateRivals(seasonIdForDate(today), st.div)
const myPages = scoreActivityOnDate(today, records)
const rows = [
  { id: 'you', name: 'あなた', pages: myPages, you: true },
  ...rivals.map((r) => ({ id: r.id, name: r.name, pages: rivalPagesForDay(r, seasonDayIndex(today)), you: false })),
].sort((a, b) => b.pages - a.pages)
// <div data-testid="league-board">{rows.map(...)}</div> 自分行に data-testid="league-row-you"
// rpg表示: <div data-testid="rpg-level">Lv.{levelForExp(st.exp)}</div>
// 実況文は作らない。前日比▲▼のみ表示。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/RankingScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/RankingScreen.tsx src/screens/RankingScreen.test.tsx
git commit -m "feat: RankingにリーグRPGタブ"
```

### Task 6: Home・MyPage追記（フッター不変）

**Files:**
- Modify: `src/screens/HomeScreen.tsx`, `src/screens/MyPageScreen.tsx`
- Test: `src/screens/HomeScreen.test.tsx`, `src/screens/MyPageScreen.test.tsx`に追記

**Interfaces:**
- Consumes: Task 4の`loadSeasonState`
- Produces: `data-testid="season-banner"`（Homeランキングカード内）、`data-testid="mypage-season"`（MyPage目標カード内）

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import HomeScreen from './HomeScreen'
it('シーズンバナーが出る', () => {
  render(<HomeScreen onOpenBook={() => {}} onRanking={() => {}} onMyPage={() => {}} />)
  expect(screen.getByTestId('season-banner')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/HomeScreen.test.tsx`
Expected: FAIL with "Unable to find season-banner"

- [ ] **Step 3: Write minimal implementation**

```tsx
import { loadSeasonState } from '../data/seasonStore'
import { levelForExp } from '../lib/seasonExp'
import { seasonDayIndex } from '../lib/seasonLeague'
// HomeScreen.tsx ranking-card内（639-645行付近）に追記:
const season = loadSeasonState(today)
const remain = 28 - seasonDayIndex(today)
<div data-testid="season-banner">今季Div.{season.div} 残り{remain}節 順位はリーグタブで</div>
// MyPageScreen.tsx mypage-goal内（132-189行付近）に追記:
<div data-testid="mypage-season">Lv.{levelForExp(season.exp)} Div.{season.div} EXP.{season.exp}</div>
// フッター（App.tsx）には一切触らない。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/HomeScreen.test.tsx src/screens/MyPageScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx src/screens/MyPageScreen.tsx src/screens/HomeScreen.test.tsx src/screens/MyPageScreen.test.tsx
git commit -m "feat: Home MyPageにシーズン表示"
```

### Task 7: ビルド・デプロイ（スマホ反映）

**Files:**
- Modify: なし（確認のみ。失敗時は直前のTaskを修正）

**Interfaces:**
- Consumes: Task 1-6すべて
- Produces: スマホで開ける公開URL更新

- [ ] **Step 1: 全テスト実行**

Run: `npm test -- --run`
Expected: 全PASS

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: `dist/`生成成功、エラーなし

- [ ] **Step 3: mainへpushしてPagesデプロイ**

```bash
git push origin main
```

ActionsのDeploy to GitHub Pagesが緑になるのを確認。スマホはホーム画面のPWAアイコンから開き直す（オフラインキャッシュ更新のため2回開く）。

- [ ] **Step 4: スマホ確認報告**

公開URL（https://kiikokira.github.io/schedule-app/）でleague-tabとseason-bannerが見えることを報告して完了。
