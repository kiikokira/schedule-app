# 累計内訳一覧 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マイページ「累計の内訳」を別画面の一覧（1行1冊＋表紙、行タップで詳細へ）にする。

**Architecture:** `App` に `breakdown` ルートを1件追加し、新 `BreakdownScreen` で一覧描画する。集計式・DBは不変で `coverUrl` の受け渡しだけ足す。既存カードは導線ボタン化する。

**Tech Stack:** React 18 + TypeScript + vitest + Testing Library, Dexie (IndexedDB), `CoverImage` 既存コンポーネント。

**Spec:** docs/superpowers/specs/2026-10-24-breakdown-design.md

## Global Constraints

- 1行1冊表示し、行内に書名・合計・ページ・反復を出す。
- 表紙は `CoverImage` 40x56、欠損・不正時はプレースホルダ。
- 行タップで詳細画面（`detail` ルート）へ遷移できる。
- 一覧からマイページに戻れる。
- DBスキーマ変更なし、集計式の正規化は現行のまま。
- テストID: `mypage-breakdown-open`（遷移導線）、`breakdown-page`、`breakdown-row-<bookId>`、`breakdown-back`。

---

## File Structure

- Modify: `src/lib/progress.ts` — `BookTotals` に `coverUrl` を足し、`totalsByBook` の第3引数型に `coverUrl` を含める。責務は集計値への表紙URL付与のみ。
- Modify: `src/lib/progress.test.ts` — 上記の回帰テスト追加。
- Create: `src/screens/BreakdownScreen.tsx` — 一覧画面本体（取得・描画・遷移コールバック呼び出しのみ）。
- Create: `src/screens/BreakdownScreen.test.tsx` — 画面の描画・遷移テスト。
- Modify: `src/App.tsx` — `Route` に `breakdown` を追加し遷移配線する。
- Modify: `src/screens/MyPageScreen.tsx` — 内訳カードに導線ボタンを追加する（集計ロジック不変）。
- Modify: `src/screens/MyPageScreen.test.tsx` — 導線の最小更新。
- Modify: `src/App.test.tsx` — 遷移テスト追加（マイページ→一覧→戻る）。

---

### Task 1: totalsByBook が coverUrl を運ぶ

**Files:**
- Modify: `src/lib/progress.ts:128-150`
- Test: `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `BookData { id, title, coverUrl?, studyMode }`（既存型、変更なし）。
- Produces: `BookTotals = { bookId: string; title: string; pages: number; units: number; total: number; coverUrl?: string }`（`coverUrl` 追加）。

- [ ] **Step 1: Write the failing test**

```ts
it('totalsByBook carries coverUrl', () => {
  const books = [{ id: 'b1', title: 'LEAP', studyMode: 'pages' as const, coverUrl: 'https://example.com/leap.jpg' }]
  const records = [{ id: 'r1', bookId: 'b1', date: '2026-10-24', pages: 5 }]
  const rows = totalsByBook(records as never, [], books as never)
  expect(rows[0]).toMatchObject({ bookId: 'b1', total: 5, coverUrl: 'https://example.com/leap.jpg' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/lib/progress.test.ts -t "carries coverUrl" --reporter=verbose`
Expected: FAIL（`coverUrl` が undefined／型不一致）

- [ ] **Step 3: Write minimal implementation**

```ts
export type BookTotals = { bookId: string; title: string; pages: number; units: number; total: number; coverUrl?: string }

export function totalsByBook(
  records: ProgressRecordData[],
  cycles: CycleRecordData[],
  books: Pick<BookData, 'id' | 'title' | 'studyMode' | 'coverUrl'>[],
): BookTotals[] {
```

および map 内の return に `coverUrl: (b as { coverUrl?: string }).coverUrl` を追加する（ソート・filterは触らない）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/lib/progress.test.ts --reporter=basic`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat: carry coverUrl in totalsByBook"
```

### Task 2: BreakdownScreen 新規作成（1行1冊＋表紙＋詳細遷移）

**Files:**
- Create: `src/screens/BreakdownScreen.tsx`
- Test: `src/screens/BreakdownScreen.test.tsx`

**Interfaces:**
- Consumes: `totalsByBook`（Task 1 の `coverUrl` 付き）、`CoverImage`、`useBooks` / `useRecords` / `useCycleRecords`。
- Produces: `BreakdownScreen({ onBack: () => void; onOpenBook: (id: string) => void; today?: string })`。行ボタン `data-testid="breakdown-row-<bookId>"`、戻る `data-testid="breakdown-back"`、頁 `data-testid="breakdown-page"`。

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BreakdownScreen from './BreakdownScreen'
import { db } from '../db/database'

describe('BreakdownScreen', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.books.clear()
    await db.records.clear()
    await db.cycleRecords.clear()
  })
  it('renders one row per book with cover and total', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: 'LEAP', totalPages: 100, coverUrl: 'https://example.com/leap.jpg', startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
    render(<BreakdownScreen onBack={() => {}} onOpenBook={() => {}} today={today} />)
    expect(await screen.findByTestId('breakdown-row-b1')).toHaveTextContent('LEAP')
    expect(screen.getByTestId('breakdown-row-b1')).toHaveTextContent('5')
  })
  it('calls onOpenBook with bookId on row tap', async () => {
    const today = '2026-10-24'
    const now = new Date().toISOString()
    await db.books.add({ id: 'b1', title: 'LEAP', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 5 })
    const onOpen = vi.fn()
    render(<BreakdownScreen onBack={() => {}} onOpenBook={onOpen} today={today} />)
    fireEvent.click(await screen.findByTestId('breakdown-row-b1'))
    expect(onOpen).toHaveBeenCalledWith('b1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/screens/BreakdownScreen.test.tsx --reporter=verbose`
Expected: FAIL with "Failed to resolve import ./BreakdownScreen"／file not found

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useMemo } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import { pagesRecordsForTotals, cycleRecordsForTotals, totalsByBook, todayStr } from '../lib/progress'
import CoverImage from '../components/CoverImage'

type Props = { onBack: () => void; onOpenBook: (id: string) => void; today?: string }

export default function BreakdownScreen({ onBack, onOpenBook, today: todayProp }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  void today
  const rows = useMemo(() => totalsByBook(
    pagesRecordsForTotals(records, books),
    cycleRecordsForTotals(cycleRecords, books),
    books,
  ), [records, cycleRecords, books])
  return (
    <div data-testid="breakdown-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>累計の内訳</h1>
      {rows.length === 0 && <div>まだ記録がありません</div>}
      {rows.map((o) => (
        <button key={o.bookId} data-testid={`breakdown-row-${o.bookId}`} type="button" onClick={() => onOpenBook(o.bookId)} style={{ display: 'flex', gap: 12, width: '100%', textAlign: 'left', marginTop: 8 }}>
          <CoverImage src={o.coverUrl ?? null} width={40} height={56} />
          <span>
            <span style={{ fontWeight: 800 }}>{o.title}</span>
            <span>：{o.total.toLocaleString()}（ページ{o.pages.toLocaleString()}＋反復{o.units.toLocaleString()}）</span>
          </span>
        </button>
      ))}
      <button data-testid="breakdown-back" type="button" onClick={onBack} style={{ marginTop: 12 }}>戻る</button>
    </div>
  )
}
```

注意: `totalsByBook` には正規化済み配列ではなく生 `records` / `cycleRecords` を渡す（関数内で正規化するため。MyPageScreen と同一方式）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/screens/BreakdownScreen.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/BreakdownScreen.tsx src/screens/BreakdownScreen.test.tsx
git commit -m "feat: add breakdown list screen"
```

### Task 3: App配線＋マイページ導線

**Files:**
- Modify: `src/App.tsx:26-42,147-149`
- Modify: `src/screens/MyPageScreen.tsx:36,49,212-224`
- Test: `src/App.test.tsx`, `src/screens/MyPageScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2 の `BreakdownScreen`。
- Produces: ルート遷移 `mypage -> breakdown -> mypage`、`breakdown row -> detail`。導線 `data-testid="mypage-breakdown-open"`。

- [ ] **Step 1: Write the failing test**

`src/App.test.tsx` に追加:

```tsx
it('navigates mypage -> breakdown -> back', async () => {
  render(<App />)
  fireEvent.click(await screen.findByTestId('mypage-open'))
  fireEvent.click(await screen.findByTestId('mypage-breakdown-open'))
  expect(await screen.findByTestId('breakdown-page')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('breakdown-back'))
  expect(await screen.findByTestId('mypage-page')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/App.test.tsx -t "breakdown" --reporter=verbose`
Expected: FAIL（`mypage-breakdown-open` が無い）

- [ ] **Step 3: Write minimal implementation**

`src/App.tsx`:

```ts
| { name: 'mypage' }
| { name: 'breakdown' }
```

```tsx
import BreakdownScreen from './screens/BreakdownScreen'
{route.name === 'breakdown' && (
  <BreakdownScreen onBack={() => setRoute({ name: 'mypage' })} onOpenBook={(id) => setRoute({ name: 'detail', bookId: id })} />
)}
```

`src/screens/MyPageScreen.tsx`: Props に `onBreakdown: () => void` を追加し、内訳セクションに導線を追加する:

```tsx
type Props = { onBack: () => void; onRanking: () => void; onBreakdown: () => void; today?: string }
<button data-testid="mypage-breakdown-open" type="button" onClick={onBreakdown}>詳しく見る</button>
```

`App.tsx` の mypage 描画を `onBreakdown={() => setRoute({ name: 'breakdown' })}` に更新する。既存テスト用に `onBreakdown` は任意化せず、全呼び出しを更新する。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/App.test.tsx src/screens/MyPageScreen.test.tsx src/screens/BreakdownScreen.test.tsx src/lib/progress.test.ts --reporter=basic`
Expected: PASS（既存の内訳テストが導線追加で落ちたら最小限だけ直す）

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/screens/MyPageScreen.tsx src/screens/MyPageScreen.test.tsx
git commit -m "feat: route mypage breakdown to list screen"
```

- [ ] **Step 6: Full verify**

Run: `cmd /c npx.cmd tsc -b --pretty false`
Run: `cmd /c npx.cmd vitest run src/App.test.tsx src/screens/MyPageScreen.test.tsx src/screens/BreakdownScreen.test.tsx src/lib/progress.test.ts --reporter=basic`
Expected: tsc clean、全PASS
