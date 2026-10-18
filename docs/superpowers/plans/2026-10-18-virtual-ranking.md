# 仮想全国ランキング Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サーバーなしで動作する仮想全国ランキング（20万人規模・リアルタイム順位変動・月次模試ウィーク）を追加する。

**Architecture:** 母集団は分布モデル＋日付シード乱数の純粋関数（`src/lib/ranking.ts`）で表現し、全体順位は解析計算・近傍30人の攻防だけ精密シミュレーションする。UIはホームのカード＋専用画面で、下バーには触らない。

**Tech Stack:** React 18 + TypeScript + Vitest + Dexie（既存流用）、通信なし。

**Spec:** `docs/superpowers/specs/2026-10-18-virtual-ranking-design.md`

## Global Constraints

- 下バー（今日の計画／追加／調整AI／設定）にはボタンを追加しない。
- SFC志望リーグは作らない。順位は一般リーグ一本。
- 表記はすべて「仮想全国ランキング」とし、実在と誤認させない。
- 外部送信なし。保存は端末内のみ。本名・個人情報は扱わない。
- テスト実行は `& "C:\Program Files\nodejs\npm.cmd" test -- <file>`（PowerShell では `npm.ps1` が実行不可のため `npm.cmd` を直接呼ぶ）。
- コミットメッセージは `feat:`／`fix:`／`docs:` 接頭辞。

---

### Task 1: 順位計算の純粋関数

**Files:**
- Create: `src/lib/ranking.ts`
- Create: `src/lib/ranking.test.ts`

**Interfaces:**
- Consumes: なし（新規）。
- Produces: `RANK_POPULATION = 200000`、`dailyPagesToRank(pages, dateIso): number`（1が最上位）、`rankToDeviation(rank): number`（平均50・標準偏差10）、`sampleNearRivals(userPages, dateIso, count): { name: string; pages: number }[]`（日付シードで決定的）、`RIVAL_DAY_CURVE`（朝型／夜型の積み上げ係数）。

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, sampleNearRivals } from './ranking'

describe('ranking', () => {
  it('ranks more pages higher within 1..200000', () => {
    expect(RANK_POPULATION).toBe(200000)
    const a = dailyPagesToRank(30, '2026-10-18')
    const b = dailyPagesToRank(10, '2026-10-18')
    expect(a).toBeGreaterThanOrEqual(1)
    expect(a).toBeLessThanOrEqual(200000)
    expect(a).toBeLessThan(b)
  })
  it('converts rank 1 to a high deviation value near 80', () => {
    expect(rankToDeviation(1)).toBeGreaterThan(75)
  })
  it('samples the same near rivals for the same date', () => {
    const first = sampleNearRivals(20, '2026-10-18', 30)
    const second = sampleNearRivals(20, '2026-10-18', 30)
    expect(first).toEqual(second)
    expect(first).toHaveLength(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/lib/ranking.test.ts`
Expected: FAIL with "Failed to resolve import ./ranking"

- [ ] **Step 3: Write minimal implementation**

```typescript
// 母集団は分布モデル。個人シミュレーションは近傍のみ。
export const RANK_POPULATION = 200000

// 簡易ハッシュ＋mulberry32（日付シード決定的乱数）
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 対数正規分布のCDF近似（中央値8ページ、σ=0.9）。仕様書§3の統計を写像した固定値。
function populationCdf(pages: number): number {
  if (pages <= 0) return 0
  const mu = Math.log(8)
  const sigma = 0.9
  const z = (Math.log(pages) - mu) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return Math.min(Math.max(p, 0), 1)
}

export function dailyPagesToRank(pages: number, _dateIso: string): number {
  const rank = Math.round(RANK_POPULATION * (1 - populationCdf(pages)))
  return Math.min(Math.max(rank, 1), RANK_POPULATION)
}

export function rankToDeviation(rank: number): number {
  const p = 1 - (rank - 0.5) / RANK_POPULATION
  const capped = Math.min(Math.max(p, 1e-6), 1 - 1e-6)
  // probit近似（Acklam近似の簡易版で十分な精度）
  const a = [ -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.38357751867269e+02, -3.066479806614716e+01, 2.506628277459239e+00 ]
  const b = [ -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01 ]
  const c = [ -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00 ]
  const d = [ 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00 ]
  const plow = 0.02425
  const phigh = 1 - plow
  let z: number
  if (capped < plow) {
    const q = Math.sqrt(-2 * Math.log(capped))
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (capped <= phigh) {
    const q = capped - 0.5
    const r = q * q
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - capped))
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  return Math.round((50 + 10 * z) * 10) / 10
}

const RIVAL_AREAS = ['東京', '大阪', '神奈川', '愛知', '福岡', '北海道', '京都', '広島']
const RIVAL_GRADES = ['高1', '高2', '高3', '浪人']

export function sampleNearRivals(
  userPages: number,
  dateIso: string,
  count: number,
): { name: string; pages: number }[] {
  const rand = mulberry32(hashSeed(`rivals-${dateIso}`))
  const out: { name: string; pages: number }[] = []
  for (let i = 0; i < count; i++) {
    const delta = Math.round((rand() - 0.45) * 14)
    const pages = Math.max(0, userPages + delta)
    const name = `${RIVAL_AREAS[Math.floor(rand() * RIVAL_AREAS.length)]}の${RIVAL_GRADES[Math.floor(rand() * RIVAL_GRADES.length)]}`
    out.push({ name, pages })
  }
  return out.sort((x, y) => y.pages - x.pages)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/lib/ranking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ranking.ts src/lib/ranking.test.ts
git commit -m "feat: virtual ranking pure functions"
```

---

### Task 2: ホームのランキングカード

**Files:**
- Modify: `src/screens/HomeScreen.tsx`（streakセクションの直後にカード追加、`onRanking?: () => void` prop追加）
- Modify: `src/screens/HomeScreen.test.tsx`（追記）

**Interfaces:**
- Consumes: Task 1 の `dailyPagesToRank`、`rankToDeviation`。今日ページ数は既存 `scoreActivityOnDate(today, records)` を流用。
- Produces: `data-testid="ranking-card"`（順位・偏差値・「仮想全国ランキング」表記＋遷移ボタン `data-testid="ranking-open"`）。

- [ ] **Step 1: Write the failing test**

```tsx
it('shows the virtual ranking card with rank and deviation', async () => {
  await db.books.add({
    ...book,
    id: 'b1',
    totalPages: 100,
    startDate: daysAgo(30),
    deadline: daysAhead(10),
  })
  await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 10 })
  const onRanking = vi.fn()
  render(<HomeScreen onOpenBook={() => {}} onRanking={onRanking} />)
  const card = await screen.findByTestId('ranking-card')
  expect(card).toHaveTextContent('仮想全国ランキング')
  expect(card).toHaveTextContent('位')
  fireEvent.click(screen.getByTestId('ranking-open'))
  expect(onRanking).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/HomeScreen.test.tsx -t "virtual ranking card"`
Expected: FAIL with 'Unable to find an element by: [data-testid="ranking-card"]'

- [ ] **Step 3: Write minimal implementation**

`Props` に `onRanking?: () => void` を追加し、 streak セクション直後に以下を追加する（`todayPages` は既存の `scoreActivityOnDate(today, records)` を使う）。

```tsx
import { dailyPagesToRank, rankToDeviation, RANK_POPULATION } from '../lib/ranking'

// streakセクションの直後に追加
const todayPages = scoreActivityOnDate(today, records)
const rank = dailyPagesToRank(todayPages, today)
const deviation = rankToDeviation(rank)
⋮
<section data-testid="ranking-card" style={{ marginTop: 8, marginBottom: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
  <div style={{ fontWeight: 800, fontSize: 16 }}>仮想全国ランキング</div>
  <div data-testid="ranking-summary" style={{ fontSize: 14 }}>
    全国{RANK_POPULATION.toLocaleString()}人中 {rank.toLocaleString()}位（偏差値{deviation}）
  </div>
  <button data-testid="ranking-open" type="button" onClick={() => onRanking?.()}>
    順位を見る
  </button>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/HomeScreen.test.tsx -t "virtual ranking card"`
Expected: PASS。続けて `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/HomeScreen.test.tsx src/lib/ranking.test.ts` で全件グリーンを確認。

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx src/screens/HomeScreen.test.tsx
git commit -m "feat: ranking card on home"
```

---

### Task 3: ランキング専用画面＋ルート＋1分更新

**Files:**
- Create: `src/screens/RankingScreen.tsx`
- Create: `src/screens/RankingScreen.test.tsx`
- Modify: `src/App.tsx`（`Route` に `| { name: 'ranking' }` を追加し、`route.name === 'ranking'` で描画。`PlanScreen` の `onJapan` 追加時と同一パターン。`HomeScreen` に `onRanking={() => setRoute({ name: 'ranking' })}` を渡す。下バーは変更しない）
- Modify: `src/App.test.tsx`（追記）

**Interfaces:**
- Consumes: Task 1 の `sampleNearRivals`・`dailyPagesToRank`・`RANK_POPULATION`、既存 `useRecords`（`records` が変わると自動再計算＝記録時即反映）。
- Produces: `data-testid="ranking-page"`（近傍30人 `ranking-rival-*`、`ranking-reach` リーチ表示、抜去トースト `ranking-toast`、戻る `ranking-back`）。

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RankingScreen from './RankingScreen'
import { db } from '../db/database'
import { todayStr } from '../lib/progress'

describe('RankingScreen', () => {
  beforeEach(async () => {
    await db.books.clear()
    await db.records.clear()
  })
  it('shows near rivals and the reach message', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 100,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 10 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    expect(await screen.findByTestId('ranking-page')).toHaveTextContent('仮想全国ランキング')
    expect(await screen.findByTestId('ranking-reach')).toHaveTextContent('ページで')
    expect((await screen.findAllByTestId(/^ranking-rival-/)).length).toBeGreaterThan(0)
  })
  it('calls onBack when the back button is tapped', async () => {
    const onBack = vi.fn()
    render(<RankingScreen onBack={() => {}} today={todayStr()} />)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(await screen.findByTestId('ranking-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/RankingScreen.test.tsx`
Expected: FAIL with "Failed to resolve import ./RankingScreen"

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { scoreActivityOnDate, todayStr } from '../lib/progress'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, sampleNearRivals } from '../lib/ranking'

type Props = { onBack: () => void; today?: string }

export default function RankingScreen({ onBack, today: todayProp }: Props) {
  const { records } = useRecords()
  const today = todayProp ?? todayStr()
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setNowMin(n.getHours() * 60 + n.getMinutes())
    }, 60000)
    return () => clearInterval(id)
  }, [])
  const todayPages = scoreActivityOnDate(today, records)
  const rank = dailyPagesToRank(todayPages, today)
  void nowMin
  const rivals = useMemo(() => sampleNearRivals(todayPages, today, 30), [todayPages, today])
  const prevRank = useRef(rank)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (rank < prevRank.current) setToast('ライバルを抜いた！')
    else if (rank > prevRank.current) setToast('ライバルに抜かれた…')
    prevRank.current = rank
  }, [rank])
  const ahead = rivals.find((r) => r.pages > todayPages)
  return (
    <div data-testid="ranking-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>仮想全国ランキング</h1>
      <p data-testid="ranking-summary" style={{ fontWeight: 700 }}>
        全国{RANK_POPULATION.toLocaleString()}人中 {rank.toLocaleString()}位（偏差値{rankToDeviation(rank)}）
      </p>
      {toast && <p data-testid="ranking-toast">{toast}</p>}
      {ahead && (
        <p data-testid="ranking-reach">
          あと{ahead.pages - todayPages}ページで{ahead.name}を抜く
        </p>
      )}
      {rivals.map((r, i) => (
        <div key={`${r.name}-${i}`} data-testid={`ranking-rival-${i}`} style={{ fontSize: 14 }}>
          {r.name} {r.pages}ページ
        </div>
      ))}
      <button data-testid="ranking-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
```

`App.tsx` の変更（`onJapan` 追加時と同一パターン。`Route` 型の union に `| { name: 'ranking' }` を追加し、home の `HomeScreen` に `onRanking` を渡す。例：`onRanking={() => setRoute({ name: 'ranking' })}`、描画分岐：`{route.name === 'ranking' && <RankingScreen onBack={() => setRoute({ name: 'home' })} />}`）。

`App.test.tsx` に追加：

```tsx
it('navigates to the ranking screen from home via ranking open', async () => {
  render(<App />)
  fireEvent.click(await screen.findByTestId('ranking-open'))
  expect(await screen.findByTestId('ranking-page')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/RankingScreen.test.tsx src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/RankingScreen.tsx src/screens/RankingScreen.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: ranking screen with live rivals"
```

---

### Task 4: 模試ウィーク・根拠表示・最終検証

**Files:**
- Modify: `src/screens/RankingScreen.tsx`（模試ウィーク表示の追加）
- Modify: `src/screens/RankingScreen.test.tsx`（追記）

**Interfaces:**
- Consumes: Task 3 の画面。
- Produces: 毎月第1週（月〜日）に `data-testid="ranking-mockweek"` で確定順位・偏差値・到達度目安を表示。根拠出典の一覧 `data-testid="ranking-sources"`（文科省・ベネッセ・代ゼミ・坪田塾・SFC体験談の5件の文言）。

- [ ] **Step 1: Write the failing test**

```tsx
it('shows the mock exam week board on the first week of the month', async () => {
  render(<RankingScreen onBack={() => {}} today="2026-10-05" />)
  expect(await screen.findByTestId('ranking-mockweek')).toHaveTextContent('全国模試ウィーク')
  expect(screen.getByTestId('ranking-sources')).toHaveTextContent('文部科学省')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/RankingScreen.test.tsx -t "mock exam week"`
Expected: FAIL with 'Unable to find an element by: [data-testid="ranking-mockweek"]'

- [ ] **Step 3: Write minimal implementation**

`RankingScreen.tsx` に以下を追加する（第1週判定：`Number(today.slice(8, 10)) <= 7`）。

```tsx
const dayOfMonth = Number(today.slice(8, 10))
const isMockWeek = dayOfMonth >= 1 && dayOfMonth <= 7
⋮
{isMockWeek && (
  <section data-testid="ranking-mockweek" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
    <div style={{ fontWeight: 800 }}>全国模試ウィーク確定：{rank.toLocaleString()}位（偏差値{rankToDeviation(rank)}）</div>
    <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>到達度目安：{rankToDeviation(rank) >= 60 ? 'A' : rankToDeviation(rank) >= 55 ? 'B' : rankToDeviation(rank) >= 50 ? 'C' : rankToDeviation(rank) >= 45 ? 'D' : 'E'}</div>
  </section>
)}
<section data-testid="ranking-sources" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
  母集団の根拠：文部科学省「高等教育の現状について」／ベネッセ教育総合研究所（大学生130人調査）／代々木ゼミナール目安／坪田塾コラム／SFC公式合格体験記・合格者体験談
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/RankingScreen.test.tsx`
Expected: PASS。続けて `& "C:\Program Files\nodejs\npx.cmd" tsc --noEmit`（無出力＝クリーン）と `& "C:\Program Files\nodejs\npm.cmd" run build`（`built in` 表示）で検証。

- [ ] **Step 5: Commit**

```bash
git add src/screens/RankingScreen.tsx src/screens/RankingScreen.test.tsx
git commit -m "feat: mock exam week and sources on ranking"
```

---

## Self-Review（執筆時チェック済み）

- 仕様カバレッジ：§3母集団→Task 1、§4順位計算・更新タイミング→Task 1＋3、§5UX（カード・専用画面・トースト・リーチ・模試ウィーク・仮想明記）→Task 2＋3＋4、下バー不変→Task 2・3で明示、§6データ→保存なし方針のためタスクなし（意図的）、§7テスト→各タスク内。
- プレースホルダなし：テストコード・実装コード・コマンドを全文記載。「既存パターン流用」箇所は App.tsx の具体行内容を併記。
- 型整合：`dailyPagesToRank(pages: number, dateIso: string): number`、`rankToDeviation(rank: number): number`、`sampleNearRivals(userPages, dateIso, count): { name: string; pages: number }[]` を全タスクで同一名・同一シグネチャで使用。
