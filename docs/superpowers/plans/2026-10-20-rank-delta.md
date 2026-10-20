# 順位増減の強調表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マイページ「志望校への道のり」カード（赤枠箇所）に、前回アプリを開いた時と比べた自分の順位の増減を「+7」「-36」のように強調表示する。

**Architecture:** 累計ページ由来の順位（`totalPagesToRank`）を localStorage に「前回見た順位」として保存し、次回表示時に差分（前回順位 - 今回順位。正なら順位上昇）を計算して表示する。初回（保存なし）は増減を表示しない。保存の更新は表示確定後に行う。

**Tech Stack:** React 18 + TypeScript + Vitest + localStorage（既存 `profileStore` パターン流用）、通信なし。

**Spec:** なし（本計画書が仕様を兼ねる。表示文言・色・テストIDは各タスクに全文記載）。

## Global Constraints

- 下バー（今日の計画／追加／調整AI／設定）にはボタンを追加しない。
- 表記はすべて「仮想全国ランキング」とし、実在と誤認させない。
- 外部送信なし。保存は端末内（localStorage）のみ。
- テスト実行は `& "C:\Program Files\nodejs\npm.cmd" test -- <file>`（PowerShell では `npm.ps1` が実行不可のため `npm.cmd` を直接呼ぶ）。
- コミットメッセージは `feat:`／`fix:`／`docs:` 接頭辞。

---

### Task 1: 前回順位ストア＋増減計算

**Files:**
- Create: `src/data/lastRankStore.ts`
- Create: `src/data/lastRankStore.test.ts`
- Create: `src/lib/rankDelta.ts`（純粋関数。MyPageからもRanking画面からも使える位置）
- Create: `src/lib/rankDelta.test.ts`

**Interfaces:**
- Consumes: `totalPagesToRank` の結果 rank（number）。
- Produces:
  - `loadLastRank(): number | null` / `saveLastRank(rank: number): void`（KEY=`schedule-app-last-rank`、不正値は null、try/catch で壊れても落ちない）
  - `formatRankDelta(prev: number | null, current: number): string | null`（prev null → null、差分0 → `±0` ではなく null（表示なし）、差分 = prev - current、正なら `+N`、負なら `-N`、N は `toLocaleString()`）
  - `deltaTone(prev: number | null, current: number): 'up' | 'down' | 'flat'`（up=順位上昇（prev > current）、down=下降、flat=差分なし・初回）

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/rankDelta.test.ts
import { describe, it, expect } from 'vitest'
import { formatRankDelta, deltaTone } from './rankDelta'

describe('rankDelta', () => {
  it('初回（prev null）は表示なし', () => {
    expect(formatRankDelta(null, 199159)).toBeNull()
    expect(deltaTone(null, 199159)).toBe('flat')
  })
  it('順位上昇（数字が小さくなる）を +N で表す', () => {
    expect(formatRankDelta(199166, 199159)).toBe('+7')
    expect(deltaTone(199166, 199159)).toBe('up')
  })
  it('順位下降を -N で表す', () => {
    expect(formatRankDelta(199123, 199159)).toBe('-36')
    expect(deltaTone(199123, 199159)).toBe('down')
  })
  it('差分0は表示なし', () => {
    expect(formatRankDelta(199159, 199159)).toBeNull()
    expect(deltaTone(199159, 199159)).toBe('flat')
  })
  it('3桁区切りで表示する', () => {
    expect(formatRankDelta(200000, 198000)).toBe('+2,000')
  })
})
```

```typescript
// src/data/lastRankStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadLastRank, saveLastRank } from './lastRankStore'

describe('lastRankStore', () => {
  beforeEach(() => { localStorage.clear() })
  it('初期は null', () => { expect(loadLastRank()).toBeNull() })
  it('保存→読込できる', () => { saveLastRank(199159); expect(loadLastRank()).toBe(199159) })
  it('壊れた値は null', () => { localStorage.setItem('schedule-app-last-rank', 'abc'); expect(loadLastRank()).toBeNull() })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/lib/rankDelta.test.ts src/data/lastRankStore.test.ts`
Expected: FAIL with "Failed to resolve import"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/rankDelta.ts
export function formatRankDelta(prev: number | null, current: number): string | null {
  if (prev == null) return null
  const diff = prev - current
  if (diff === 0) return null
  const sign = diff > 0 ? '+' : '-'
  return `${sign}${Math.abs(diff).toLocaleString()}`
}

export function deltaTone(prev: number | null, current: number): 'up' | 'down' | 'flat' {
  if (prev == null) return 'flat'
  if (prev > current) return 'up'
  if (prev < current) return 'down'
  return 'flat'
}
```

```typescript
// src/data/lastRankStore.ts
const KEY = 'schedule-app-last-rank'

export function loadLastRank(): number | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 ? n : null
  } catch {
    return null
  }
}

export function saveLastRank(rank: number): void {
  try {
    localStorage.setItem(KEY, String(rank))
  } catch {
    // 保存失敗は無視（表示に影響させない）
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/lib/rankDelta.test.ts src/data/lastRankStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/rankDelta.ts src/lib/rankDelta.test.ts src/data/lastRankStore.ts src/data/lastRankStore.test.ts
git commit -m "feat: rank delta store and format"
```

---

### Task 2: マイページ赤枠カードに増減を強調表示

**Files:**
- Modify: `src/screens/MyPageScreen.tsx`（`mypage-goal` カード内に増減表示を追加）
- Modify: `src/screens/MyPageScreen.test.tsx`（追記）

**Interfaces:**
- Consumes: Task 1 の `loadLastRank`／`saveLastRank`／`formatRankDelta`／`deltaTone`、既存 `totalPagesToRank(totalActivity(records))` の rank。
- Produces: `data-testid="mypage-rank-delta"`（前回あり＋差分ありの時のみ表示。上昇=緑 `#1a7f37` 太字16px、下降=赤 `#d1242f` 太字16px。文言は `前回比 +7` / `前回比 -36`。`flat`・初回は要素自体を表示しない）

- [ ] **Step 1: Write the failing test**

```tsx
it('前回より順位が上がれば +N を強調表示する', async () => {
  localStorage.setItem('schedule-app-last-rank', '199166')
  const today = todayStr()
  const now = new Date().toISOString()
  await db.books.add({ id: 'b1', title: '単語帳', totalPages: 500, startDate: today, deadline: today, createdAt: now, updatedAt: now })
  await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 50 })
  render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={today} />)
  const delta = await screen.findByTestId('mypage-rank-delta')
  expect(delta).toHaveTextContent('前回比')
  expect(delta).toHaveTextContent('+')
})
it('初回は増減を表示しない', async () => {
  const today = todayStr()
  const now = new Date().toISOString()
  await db.books.add({ id: 'b1', title: '単語帳', totalPages: 500, startDate: today, deadline: today, createdAt: now, updatedAt: now })
  await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 50 })
  render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today={today} />)
  expect(screen.queryByTestId('mypage-rank-delta')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/MyPageScreen.test.tsx -t "前回より順位"`
Expected: FAIL with 'Unable to find an element by: [data-testid="mypage-rank-delta"]'

- [ ] **Step 3: Write minimal implementation**

`MyPageScreen.tsx` の変更（`mypage-goal` カード内、`mypage-rank` の直後に追加。保存は `useEffect` で rank 確定後に行い、同回表示のちらつきを避ける）：

```tsx
import { useEffect, useState } from 'react'
import { loadLastRank, saveLastRank } from '../data/lastRankStore'
import { formatRankDelta, deltaTone } from '../lib/rankDelta'

// コンポーネント内（rank の算出後）:
const [prevRank, setPrevRank] = useState<number | null>(() => loadLastRank())
useEffect(() => {
  saveLastRank(rank)
}, [rank])
const deltaText = formatRankDelta(prevRank, rank)
const tone = deltaTone(prevRank, rank)
⋮
{deltaText != null && (
  <div data-testid="mypage-rank-delta" style={{ fontSize: 16, fontWeight: 800, color: tone === 'up' ? '#1a7f37' : '#d1242f' }}>
    前回比 {deltaText}
  </div>
)}
```

注意: `prevRank` はマウント時の値を固定するため state 初期値で一度だけ読む。再レンダーで上書きしないこと。

- [ ] **Step 4: Run test to verify it passes**

Run: `& "C:\Program Files\nodejs\npm.cmd" test -- src/screens/MyPageScreen.test.tsx`
Expected: PASS。続けて `& "C:\Program Files\nodejs\npx.cmd" tsc --noEmit` は使わず `& "C:\Program Files\nodejs\npm.cmd" run build`（`built in` 表示）で検証。

- [ ] **Step 5: Commit**

```bash
git add src/screens/MyPageScreen.tsx src/screens/MyPageScreen.test.tsx
git commit -m "feat: emphasize rank delta on mypage goal card"
```

---

## Self-Review（執筆時チェック済み）

- 仕様カバレッジ：「前回比 +7/-36」「強調表示」「赤枠カード内」「初回は表示なし」を Task 1+2 で網羅。下バー不変・端末内保存のみを Global Constraints で明示。
- プレースホルダなし：テストコード・実装コード・コマンドを全文記載。
- 型整合：`loadLastRank(): number | null`、`saveLastRank(rank: number): void`、`formatRankDelta(prev, current): string | null`、`deltaTone(prev, current): 'up'|'down'|'flat'` を両タスクで同一名・同一シグネチャで使用。
- Task 1 → Task 2 の依存：Task 2 は Task 1 の4関数を import するのみ。Task 1 のファイル構成変更は Task 2 の brief に影響しない。
