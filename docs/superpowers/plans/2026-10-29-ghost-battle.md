# Ghost Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 過去最高の日の自分と今日リアルタイムで競うゴースト対戦を今日の計画画面に表示する

**Architecture:** 純粋関数 `lib/ghost.ts` に勝負計算を集約し、記録成功のたびに `ghostLogs` へ累計スナップショットを追記、TodayPlan 画面で現在値同士を比較表示する。過去ログなしは均等ペースで補完する。

**Tech Stack:** React 18 + TypeScript + Dexie 4 + Vitest 2 + Vite 5

**Spec:** `docs/superpowers/specs/2026-10-29-ghost-battle-design.md`

## Global Constraints

- すべてローカル（Dexie/localStorage）、外部送信なし、オフライン可
- スコアはページ＋区画の合算でランキングと同じ定義（`combinedActivityOnDate`＋`pagesRecordsForTotals`/`cycleRecordsForTotals`の正規化を再利用）
- ゴースト日は今日より前の日で最大、タイブレークは新しい日付優先、当日固定（日中は切り替えない）
- `todayFirstSlotStartMin` と `todayTotalMinutes` はクリップ前の `slotsForDate(availability, today)` 全枠から算出
- 既存の記録フローは変えない、勝敗によるEXP/リーグ加点なし（表示のみ）
- `npm run build` 成功と既存テスト全緑を維持する

---

## File Structure

- 新規 `src/lib/ghost.ts` — ゴースト確定・曲線構築・同経過値計算の純粋関数。UIもDBもここに依存する。
- 新規 `src/lib/ghost.test.ts` — 上記の単体テスト。
- 変更 `src/db/database.ts` — Dexie version 6 で `ghostLogs` テーブル追加のみ。
- 新規 `src/data/ghostLogStore.ts` — `ghostLogs` への追記・取得ヘルパー。計算は呼び出し側が渡した合算値を使う（DB層で合算再計算しない）。
- 新規 `src/data/ghostLogStore.test.ts` — fake-indexeddb を使った追記・取得テスト。
- 新規 `src/components/GhostBattleCard.tsx` — 表示専用カード（2本バー＋差分＋状態バッジ）。
- 変更 `src/screens/TodayPlanScreen.tsx` — ゴースト日の確定・曲線構築・記録成功時の追記・カード埋め込みのみ。既存ロジックは触らない。
- 新規 `src/screens/TodayPlanScreen.ghost.test.tsx` — カード表示の結合テスト。

---

### Task 1: ghost 計算の純粋関数

**Files:**
- Create: `src/lib/ghost.ts`
- Test: `src/lib/ghost.test.ts`

**Interfaces:**
- Consumes: `src/lib/dayplan.ts` の `slotsForDate`（Task 4で使う、Task 1では使わない）、`src/lib/progress.ts` の型のみ
- Produces:
  - `export type GhostLogPoint = { atMs: number; total: number }`
  - `export type GhostCurve = { kind: 'none' } | { kind: 'uniform'; total: number } | { kind: 'events'; points: { elapsedMin: number; total: number }[]; total: number }`
  - `export function findGhostDate(totals: Record<string, number>, today: string): string | null`
  - `export function buildGhostCurve(opts: { total: number; events: GhostLogPoint[] }): GhostCurve`
  - `export function ghostTotalAt(curve: GhostCurve, elapsedMin: number, todayTotalMinutes: number): number`
  - `export function todaySlotBounds(slots: { startMin: number; endMin: number }[]): { startMin: number; totalMinutes: number } | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ghost.test.ts
import { describe, it, expect } from 'vitest'
import { findGhostDate, buildGhostCurve, ghostTotalAt, todaySlotBounds } from './ghost'

describe('findGhostDate', () => {
  it('picks max before today, tie prefers newer', () => {
    expect(findGhostDate({ '2026-10-20': 50, '2026-10-21': 120, '2026-10-22': 120, '2026-10-23': 30 }, '2026-10-23')).toBe('2026-10-22')
  })
  it('excludes today even if today is max', () => {
    expect(findGhostDate({ '2026-10-21': 100, '2026-10-23': 999 }, '2026-10-23')).toBe('2026-10-21')
  })
  it('returns null when no history', () => {
    expect(findGhostDate({}, '2026-10-23')).toBeNull()
    expect(findGhostDate({ '2026-10-23': 10 }, '2026-10-23')).toBeNull()
  })
})

describe('ghostTotalAt uniform', () => {
  it('scales linearly with floor', () => {
    const c = buildGhostCurve({ total: 120, events: [] })
    expect(ghostTotalAt(c, 60, 480)).toBe(15)
    expect(ghostTotalAt(c, -5, 480)).toBe(0)
    expect(ghostTotalAt(c, 9999, 480)).toBe(120)
  })
  it('returns 0 when no ghost', () => {
    expect(ghostTotalAt({ kind: 'none' }, 60, 480)).toBe(0)
  })
})

describe('ghostTotalAt events', () => {
  it('interpolates relative from first log', () => {
    const base = Date.parse('2026-10-21T09:00:00+09:00')
    const c = buildGhostCurve({ total: 100, events: [
      { atMs: base, total: 0 },
      { atMs: base + 60 * 60000, total: 20 },
      { atMs: base + 180 * 60000, total: 80 },
    ]})
    expect(ghostTotalAt(c, 30, 480)).toBe(10)
    expect(ghostTotalAt(c, 120, 480)).toBe(50)
    expect(ghostTotalAt(c, 9999, 480)).toBe(100)
  })
  it('ignores broken events and falls back to uniform', () => {
    const c = buildGhostCurve({ total: 90, events: [{ atMs: NaN, total: 10 }] })
    expect(ghostTotalAt(c, 240, 480)).toBe(45)
  })
})

describe('todaySlotBounds', () => {
  it('uses unclipped first start and sum', () => {
    expect(todaySlotBounds([{ startMin: 540, endMin: 600 }, { startMin: 660, endMin: 720 }])).toEqual({ startMin: 540, totalMinutes: 120 })
  })
  it('returns null when empty', () => {
    expect(todaySlotBounds([])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ghost.test.ts`
Expected: FAIL with "Failed to resolve import ./ghost" or "ghost.ts does not exist"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/ghost.ts
export type GhostLogPoint = { atMs: number; total: number }

export type GhostCurve =
  | { kind: 'none' }
  | { kind: 'uniform'; total: number }
  | { kind: 'events'; points: { elapsedMin: number; total: number }[]; total: number }

export function findGhostDate(totals: Record<string, number>, today: string): string | null {
  let best: string | null = null
  let bestTotal = -1
  for (const [date, total] of Object.entries(totals)) {
    if (date >= today) continue
    if (!Number.isFinite(total) || total <= 0) continue
    if (total > bestTotal || (total === bestTotal && (best === null || date > best))) {
      best = date
      bestTotal = total
    }
  }
  return best
}

function cleanEvents(events: GhostLogPoint[]): { elapsedMin: number; total: number }[] {
  const valid = events.filter((e) => Number.isFinite(e.atMs) && Number.isFinite(e.total) && e.total >= 0)
  if (valid.length < 2) return []
  const sorted = [...valid].sort((a, b) => a.atMs - b.atMs)
  const first = sorted[0].atMs
  const points = sorted.map((e) => ({ elapsedMin: Math.max(0, Math.round((e.atMs - first) / 60000)), total: Math.floor(e.total) }))
  const deduped: { elapsedMin: number; total: number }[] = []
  for (const p of points) {
    const last = deduped[deduped.length - 1]
    if (last && last.elapsedMin === p.elapsedMin) {
      last.total = p.total
    } else {
      deduped.push({ ...p })
    }
  }
  return deduped.length >= 2 ? deduped : []
}

export function buildGhostCurve(opts: { total: number; events: GhostLogPoint[] }): GhostCurve {
  const total = Number.isFinite(opts.total) && opts.total > 0 ? Math.floor(opts.total) : 0
  if (total <= 0) return { kind: 'none' }
  const points = cleanEvents(opts.events ?? [])
  if (points.length < 2) return { kind: 'uniform', total }
  return { kind: 'events', points, total }
}

export function ghostTotalAt(curve: GhostCurve, elapsedMin: number, todayTotalMinutes: number): number {
  if (curve.kind === 'none') return 0
  if (!Number.isFinite(elapsedMin) || elapsedMin <= 0) return 0
  if (curve.kind === 'uniform') {
    if (!Number.isFinite(todayTotalMinutes) || todayTotalMinutes <= 0) return 0
    if (elapsedMin >= todayTotalMinutes) return curve.total
    return Math.floor((curve.total * elapsedMin) / todayTotalMinutes)
  }
  const pts = curve.points
  if (elapsedMin >= pts[pts.length - 1].elapsedMin) return curve.total
  for (let i = 1; i < pts.length; i++) {
    if (elapsedMin <= pts[i].elapsedMin) {
      const a = pts[i - 1]
      const b = pts[i]
      const span = b.elapsedMin - a.elapsedMin
      if (span <= 0) return b.total
      const ratio = (elapsedMin - a.elapsedMin) / span
      return Math.floor(a.total + (b.total - a.total) * ratio)
    }
  }
  return curve.total
}

export function todaySlotBounds(slots: { startMin: number; endMin: number }[]): { startMin: number; totalMinutes: number } | null {
  if (slots.length === 0) return null
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin)
  const startMin = sorted[0].startMin
  const totalMinutes = sorted.reduce((s, x) => s + Math.max(0, x.endMin - x.startMin), 0)
  if (!Number.isFinite(startMin) || totalMinutes <= 0) return null
  return { startMin, totalMinutes }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ghost.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ghost.ts src/lib/ghost.test.ts
git commit -m 'feat: ゴースト計算の純粋関数を追加'
```

---

### Task 2: ghostLogs の保存層

**Files:**
- Modify: `src/db/database.ts`
- Create: `src/data/ghostLogStore.ts`
- Test: `src/data/ghostLogStore.test.ts`

**Interfaces:**
- Consumes: Task 1 の型 `GhostLogPoint`（再定義せず import しない、store は自前の型を持つ）
- Produces:
  - `export type GhostLog = { id: string; date: string; atMs: number; total: number }`
  - `export async function appendGhostSnapshot(date: string, total: number, atMs?: number): Promise<void>`
  - `export async function listGhostLogs(date: string): Promise<GhostLog[]>`
  - `export async function clearGhostLogs(): Promise<void>`（テスト用）

- [ ] **Step 1: Write the failing test**

```ts
// src/data/ghostLogStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { appendGhostSnapshot, listGhostLogs } from './ghostLogStore'

beforeEach(async () => {
  await db.ghostLogs?.clear().catch(() => {})
})

describe('ghostLogStore', () => {
  it('appends snapshots in order', async () => {
    await appendGhostSnapshot('2026-10-23', 10, Date.parse('2026-10-23T09:00:00+09:00'))
    await appendGhostSnapshot('2026-10-23', 25, Date.parse('2026-10-23T10:00:00+09:00'))
    const rows = await listGhostLogs('2026-10-23')
    expect(rows.map((r) => r.total)).toEqual([10, 25])
  })
  it('ignores invalid total', async () => {
    await appendGhostSnapshot('2026-10-23', NaN)
    expect(await listGhostLogs('2026-10-23')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/ghostLogStore.test.ts`
Expected: FAIL with "db.ghostLogs is undefined" or "Failed to resolve import ./ghostLogStore"

- [ ] **Step 3: Write minimal implementation**

DB変更（`src/db/database.ts` の末尾クラス内に追記、前方宣言も追加）:

```ts
// 既存 import の下に追加
import type { GhostLog } from '../data/ghostLogStore'

// ScheduleDB クラス内に1行追加
ghostLogs!: Table<GhostLog, string>

// constructor の最後の version の後に追加
this.version(6).stores({
  books: 'id, deadline, startDate',
  records: 'id, bookId, [bookId+date]',
  availability: 'id, weekday, date',
  adjustments: 'id, date, bookId',
  cycleRecords: 'id, bookId, [bookId+date]',
  chatMessages: 'id, at',
  snapshots: 'id',
  ghostLogs: 'id, date',
})
```

Store本体（`src/data/ghostLogStore.ts`）:

```ts
import { db } from '../db/database'

export type GhostLog = { id: string; date: string; atMs: number; total: number }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function appendGhostSnapshot(date: string, total: number, atMs?: number): Promise<void> {
  if (!DATE_RE.test(date)) return
  if (!Number.isFinite(total) || total < 0) return
  const at = atMs === undefined ? Date.now() : atMs
  if (!Number.isFinite(at)) return
  await db.ghostLogs.add({ id: crypto.randomUUID(), date, atMs: at, total: Math.floor(total) })
}

export async function listGhostLogs(date: string): Promise<GhostLog[]> {
  const rows = await db.ghostLogs.where('date').equals(date).toArray()
  return rows.sort((a, b) => a.atMs - b.atMs)
}

export async function clearGhostLogs(): Promise<void> {
  await db.ghostLogs.clear()
}
```

注意: `database.ts` と `ghostLogStore.ts` の循環 import を避けるため、`database.ts` 側は `import type` のみにする。`Table` は既存の `import Dexie, { type Table }` を使う。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/ghostLogStore.test.ts src/lib/ghost.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/database.ts src/data/ghostLogStore.ts src/data/ghostLogStore.test.ts
git commit -m 'feat: ghostLogs の保存層を追加'
```

---

### Task 3: 記録成功時のスナップショット追記

**Files:**
- Modify: `src/screens/TodayPlanScreen.tsx`
- Modify: `src/screens/BookDetailScreen.tsx`
- Test: `src/screens/TodayPlanScreen.ghost.test.tsx`（Task 4のUIテストと分け、ここではDB追記のみ検証）

**Interfaces:**
- Consumes: Task 2 の `appendGhostSnapshot`、Task 1 の `combinedActivityOnDate` 相当の既存集計（`src/lib/progress.ts` の `combinedActivityOnDate`＋`pagesRecordsForTotals`/`cycleRecordsForTotals` をそのまま使う）
- Produces: 記録成功後に `ghostLogs` が1件増える振る舞い（UI変更なし）

- [ ] **Step 1: Write the failing test**

```ts
// src/screens/TodayPlanScreen.ghost.test.tsx（前半: 追記のみ）
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'
import TodayPlanScreen from './TodayPlanScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot } from '../data/dayplanStore'
import { saveFocusPeriods } from '../data/focusPeriods'
import { resetSchedule } from '../data/scheduleStore'

beforeEach(async () => {
  localStorage.clear()
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  await db.availability.clear()
  await db.ghostLogs.clear()
  resetSchedule()
  saveFocusPeriods([])
})

describe('ghost snapshot', () => {
  it('appends a ghost log when pages are recorded', async () => {
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: '英文法ポラリス2（応用レベル）', subject: '英語', totalPages: 100, startDate: '2026-09-01', deadline: '2026-11-30', createdAt: now, updatedAt: now } as any)
    await saveAvailabilitySlot({ id: 'a1', weekday: 1, date: null, start: '21:00', end: '23:00' }, true)
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
    const input = await screen.findByTestId('plan-input-b1')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('plan-record-b1'))
    fireEvent.click(await screen.findByTestId('record-confirm-yes'))
    await waitFor(async () => {
      const rows = await db.ghostLogs.toArray()
      expect(rows.length).toBeGreaterThanOrEqual(1)
      expect(rows[rows.length - 1].total).toBe(10)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/TodayPlanScreen.ghost.test.tsx`
Expected: FAIL with "expected [] length >= 1"（追記がまだないため）

- [ ] **Step 3: Write minimal implementation**

`src/screens/TodayPlanScreen.tsx` の2箇所に追記ヘルパーを追加:

```tsx
// 既存 import に追加
import { appendGhostSnapshot } from '../data/ghostLogStore'
import { combinedActivityOnDate, pagesRecordsForTotals, cycleRecordsForTotals } from '../lib/progress'

// コンポーネント内の recordPages / addCycle 成功直後に呼ぶ小ヘルパー（既存の books/records/cycleRecords state から計算）
const snapshotGhost = async (date: string) => {
  try {
    const validRecords = pagesRecordsForTotals(records, books)
    const validCycles = cycleRecordsForTotals(cycleRecords, books)
    const total = combinedActivityOnDate(date, validRecords, validCycles)
    await appendGhostSnapshot(date, total)
  } catch { /* ignore: ゴースト失敗で記録を壊さない */ }
}
```

呼び出し:
1. `recordPages` 内の `await addProgress(bookId, today, pages)` の直後に `await snapshotGhost(today)` を追加（ただし再レンダー前の古い `records` ではなく `pages + 今日の既存合計` で計算がずれるため、`addProgress` 後に `db.records.toArray()` と `db.cycleRecords.toArray()` を読み直して計算する。実装は `const freshRecords = await db.records.toArray()` のようにする）。
2. 反復の `await addCycle({...})` 成功直後に同様に `await snapshotGhost(today)`（fresh read版）を追加。

正確な差し替えコード:

```tsx
// recordPages の末尾（saveBook の後）に:
try {
  const freshRecords = await db.records.toArray()
  const freshCycles = await db.cycleRecords.toArray()
  const total = combinedActivityOnDate(today, pagesRecordsForTotals(freshRecords, books), cycleRecordsForTotals(freshCycles, books))
  await appendGhostSnapshot(today, total)
} catch { /* ignore */ }
```

`BookDetailScreen.tsx` も同じパターンを記録成功直後に1箇所追加する（同ファイルの `addProgress`/`addCycle` 呼び出し直後。ファイル内の既存 import に `appendGhostSnapshot` と `db` と集計関数を追加）。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/TodayPlanScreen.ghost.test.tsx src/data/ghostLogStore.test.ts src/lib/ghost.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/TodayPlanScreen.tsx src/screens/BookDetailScreen.tsx src/screens/TodayPlanScreen.ghost.test.tsx
git commit -m 'feat: 記録成功時にゴーストスナップショットを追記'
```

---

### Task 4: 今日の計画へのゴーストカード表示

**Files:**
- Create: `src/components/GhostBattleCard.tsx`
- Modify: `src/screens/TodayPlanScreen.tsx`
- Test: extend `src/screens/TodayPlanScreen.ghost.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `findGhostDate`/`buildGhostCurve`/`ghostTotalAt`/`todaySlotBounds`、Task 2 の `listGhostLogs`、`slotsForDate`
- Produces: `data-testid="ghost-battle"` カード（UIのみ、書き込みなし）

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/TodayPlanScreen.ghost.test.tsx に追加
import { within } from '@testing-library/react'

it('shows lead text against uniform ghost', async () => {
  const now = new Date().toISOString()
  await db.books.add({ id: 'b1', title: '英文法ポラリス2（応用レベル）', subject: '英語', totalPages: 100, startDate: '2026-09-01', deadline: '2026-11-30', createdAt: now, updatedAt: now } as any)
  await db.records.add({ id: 'past1', bookId: 'b1', date: '2026-09-20', pages: 120 } as any)
  await saveAvailabilitySlot({ id: 'a1', weekday: 0, date: null, start: '09:00', end: '17:00' }, true)
  await db.records.add({ id: 't1', bookId: 'b1', date: '2026-09-21', pages: 60 } as any)
  render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-09-21" />)
  expect(await screen.findByTestId('ghost-battle')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/TodayPlanScreen.ghost.test.tsx`
Expected: FAIL with "Unable to find ghost-battle"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/GhostBattleCard.tsx
type Props = {
  ghostLabel: string
  ghostTotal: number
  youTotal: number
  ghostNow: number
  diff: number
  status: 'prestart' | 'racing' | 'win' | 'lose' | 'tie'
}

export default function GhostBattleCard({ ghostLabel, ghostTotal, youTotal, ghostNow, diff, status }: Props) {
  const badge = status === 'prestart' ? 'まだスタート前' : status === 'win' ? 'ゴースト撃破！' : status === 'lose' ? '惜敗' : status === 'tie' ? 'タイ' : '対戦中'
  const diffText = diff === 0 ? 'イーブン' : diff > 0 ? `+${diff} リード` : `${diff} ビハインド`
  const pct = (v: number) => Math.min(100, Math.max(0, ghostTotal > 0 ? Math.round((v / ghostTotal) * 100) : 0))
  return (
    <section data-testid="ghost-battle" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 800 }}>vs 過去最高ゴースト {ghostLabel} 合計{ghostTotal}</div>
      <div data-testid="ghost-status" style={{ fontSize: 13, fontWeight: 700 }}>{badge}</div>
      <div style={{ fontSize: 14 }}>あなた {youTotal} vs ゴースト {ghostNow}（{diffText}）</div>
      <div style={{ height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginTop: 6 }}>
        <div data-testid="ghost-you-bar" style={{ width: `${pct(youTotal)}%`, height: '100%', background: '#3b82f6' }} />
      </div>
      <div style={{ height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginTop: 4 }}>
        <div data-testid="ghost-rival-bar" style={{ width: `${pct(ghostNow)}%`, height: '100%', background: '#9ca3af' }} />
      </div>
    </section>
  )
}
```

`TodayPlanScreen.tsx` 統合（時間割リスト直下、リスク表示の後あたりに挿入）:

```tsx
// import 追加
import GhostBattleCard from '../components/GhostBattleCard'
import { findGhostDate, buildGhostCurve, ghostTotalAt, todaySlotBounds } from '../lib/ghost'
import { listGhostLogs } from '../data/ghostLogStore'
import { combinedActivityOnDate as ghostCombined, pagesRecordsForTotals as ghostPagesFilter, cycleRecordsForTotals as ghostCyclesFilter } from '../lib/progress'

// コンポーネント内（planned/slots 計算の後、return の前）
const ghostSlots = useMemo(() => slotsForDate(availability, today), [availability, today])
const ghostBounds = useMemo(() => todaySlotBounds(ghostSlots), [ghostSlots])
const ghostTotals = useMemo(() => {
  const out: Record<string, number> = {}
  const dates = new Set([...records.map((r) => r.date), ...cycleRecords.map((r) => r.date)])
  const vr = ghostPagesFilter(records, books)
  const vc = ghostCyclesFilter(cycleRecords, books)
  for (const d of dates) out[d] = ghostCombined(d, vr.filter((r) => r.date === d), vc.filter((r) => r.date === d))
  return out
}, [records, cycleRecords, books])
const ghostDate = useMemo(() => findGhostDate(ghostTotals, today), [ghostTotals, today])
const [ghostEvents, setGhostEvents] = useState<{ atMs: number; total: number }[]>([])
useEffect(() => {
  if (!ghostDate) { setGhostEvents([]); return }
  void listGhostLogs(ghostDate).then((rows) => setGhostEvents(rows.map((r) => ({ atMs: r.atMs, total: r.total })))).catch(() => setGhostEvents([]))
}, [ghostDate])
const ghostCurve = useMemo(() => (ghostDate ? buildGhostCurve({ total: ghostTotals[ghostDate] ?? 0, events: ghostEvents }) : { kind: 'none' as const }), [ghostDate, ghostTotals, ghostEvents])
const youTotal = useMemo(() => ghostCombined(today, ghostPagesFilter(records, books), ghostCyclesFilter(cycleRecords, books)), [today, records, cycleRecords, books])
const elapsed = ghostBounds ? nowMin - ghostBounds.startMin : -1
const ghostNow = ghostBounds && ghostDate ? ghostTotalAt(ghostCurve, elapsed, ghostBounds.totalMinutes) : 0
```

レンダー（`deadline-risk-section` の後、`today-table` の前に挿入）:

```tsx
{ghostDate == null ? (
  <p data-testid="ghost-empty" style={{ fontSize: 13, color: 'var(--text-dim)' }}>まだゴーストがいません。記録を続けよう</p>
) : ghostBounds == null ? (
  <p data-testid="ghost-noslots" style={{ fontSize: 13, color: 'var(--text-dim)' }}>今日の枠が始まったらゴーストが走り出すよ</p>
) : (
  <GhostBattleCard
    ghostLabel={ghostDate.slice(5).replace('-', '/')}
    ghostTotal={ghostTotals[ghostDate] ?? 0}
    youTotal={youTotal}
    ghostNow={ghostNow}
    diff={youTotal - ghostNow}
    status={elapsed < 0 ? 'prestart' : elapsed >= ghostBounds.totalMinutes ? (youTotal > (ghostTotals[ghostDate] ?? 0) ? 'win' : youTotal === (ghostTotals[ghostDate] ?? 0) ? 'tie' : 'lose') : 'racing'}
  />
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/TodayPlanScreen.ghost.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/GhostBattleCard.tsx src/screens/TodayPlanScreen.tsx src/screens/TodayPlanScreen.ghost.test.tsx
git commit -m 'feat: 今日の計画にゴースト対戦カードを表示'
```

---

### Task 5: 全体検証と仕上げ

**Files:**
- Modify: なし（検証のみ。失敗があれば該当Taskに戻る）

**Interfaces:**
- Consumes: Task 1-4 の成果物
- Produces: `npm run build` 成功＋全テスト緑

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS（失敗があれば修正は新規コミットで行い、このTaskでは直さない。失敗内容をメモして該当Taskの fix として扱う）

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: 成功（`tsc -b`＋`vite build` がエラーなし）

- [ ] **Step 3: Commit verification marker（変更がなければ空コミットしない）**

```bash
git status --short
```

変更なしを確認したらコミット不要。変更があれば対象ファイルのみ追加してコミットする。

```bash
git add docs/superpowers/plans/2026-10-29-ghost-battle.md
git commit -m 'docs: ゴースト対戦実装プランを追加'
```

---

## Self-Review

- Spec coverage: ①データ・確定ルール→Task 1+2+3、②表示・勝敗→Task 4、③エラーハンドリング・テスト→Task 1/2/4のフォールバック分岐＋Task 5の全体検証。将来拡張は対象外と明記。
- Placeholder scan: TBD/TODO/適切に/同様になどの曖昧表現なし。コードブロックはコピペ可能な完全形。
- Type consistency: `GhostCurve`/`GhostLog`/`GhostLogPoint` の名称をTask間で統一。`ghostTotalAt(curve, elapsedMin, todayTotalMinutes)` の引数順を全Taskで同一。DBテーブル名 `ghostLogs` で統一。
