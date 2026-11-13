# 自動敗戦（日またぎ一括） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** その日中に記録されなかった参考書枠を、日またぎで自動敗戦（手動スキップと同扱い）にする。

**Architecture:** `seasonStore` に冪等な `autoForfeitPastSlots()` を追加し、`App` 起動時と `TodayPlanScreen` 表示時に過去日（`date < todayStr()`）の未確定・book付き枠を `syncLeagueSlot(..., forfeit:true)` で確定する。UI変更なし。

**Tech Stack:** TypeScript, React, Vitest, Dexie(local)/localStorage, Vite

**Spec:** `docs/superpowers/specs/2026-11-12-auto-forfeit-design.md`

## Global Constraints

- `npm run build` が成功すること。
- 既存テストを壊さないこと。
- 端末内完結（localStorageのみ、外部送信なし）。
- 未来枠を敗戦にしない。確定済み枠を上書きしない。未割当枠は対象外。
- 変更ファイルのみ `git add` し、無関係ファイルを含めない。

## Review Focus

- 未来日（`date >= today`）の未記録枠が敗戦にならないこと。
- 既に確定済み（`slotMatches` あり）の枠が上書きされないこと。
- 未割当（`bookId` 空）の枠が敗戦にならないこと。
- 削除済み本の枠でも落ちずに敗戦確定できること（`pages` 扱い）。
- 曜日繰り返し枠の過去日が `slotsForDate` 復元で敗戦になること。

---

### Task 1: autoForfeitPastSlots helper + 単体テスト

**Files:**
- Modify: `src/data/seasonStore.ts`
- Test: `src/data/seasonStore.slot.test.ts`

**Interfaces:**
- Consumes: `slotsForDate(availability, date)` from `src/lib/dayplan.ts`, `makeSlotKey(date, startMin, endMin)` + `SlotUnit` from `src/lib/slotLeague.ts`, `isLeapBook(book)` from `src/lib/leap.ts`, `syncLeagueSlot`, `loadSeasonState` (既存), `BookData` from `src/lib/progress.ts`, `AvailabilitySlot` from `src/data/dayplanStore.ts`
- Produces: `export function autoForfeitPastSlots(today: string, availability: AvailabilitySlot[], books: BookData[]): string[]` — 敗戦確定した slotKey 一覧を返す。副作用として `syncLeagueSlot(..., {my:0, unit, slotMinutes, forfeit:true})` を呼ぶ。

- [ ] **Step 1: Write the failing test**

```ts
it('過去の未確定・book付き枠を自動敗戦にする', async () => {
  const { autoForfeitPastSlots, loadSeasonState } = await import('./seasonStore')
  const { saveAvailabilitySlot } = await import('./dayplanStore')
  // setup: localStorage.clear + 過去日 2026-09-21 のbook付き枠 + 今日 2026-09-22
  // autoForfeitPastSlots('2026-09-22', availability, books)
  // expect(loadSeasonState('2026-09-22').slotMatches['2026-09-21#1260-1380']?.result).toBe('loss')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/seasonStore.slot.test.ts -t "自動敗戦" -v`
Expected: FAIL with "autoForfeitPastSlots is not a function"

- [ ] **Step 3: Implement `autoForfeitPastSlots(today: string, availability: AvailabilitySlot[], books: BookData[]): string[]` in `src/data/seasonStore.ts`**

走査は `today` の前日まで過去30日分。各日 `slotsForDate()` で復元し、`bookId` 付き・`slotMatches` 未存在のみ forfeit。unit は cycles＋LEAP→`words`、cyclesその他→`sections`、それ以外・本なし→`pages`。`slotMinutes = endMin - startMin`。`syncLeagueSlot` の冪等に依存し、二重実行安全にする。

- [ ] **Step 4: 境界テストを追加し、全テストが通ることを確認**

追加ケース（同ファイル内）: 未来枠は不変、確定済みは上書きなし、未割当は対象外、削除済み本の枠も `pages` で敗戦になる、曜日枠の過去日も敗戦になる。

Run: `npx vitest run src/data/seasonStore.slot.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/seasonStore.ts src/data/seasonStore.slot.test.ts
git commit -m "feat: auto forfeit past unrecorded slots"
```

### Task 2: 起動時・今日の計画表示時の自動実行配線

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/screens/TodayPlanScreen.tsx`
- Test: `src/screens/TodayPlanScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `autoForfeitPastSlots(today, availability, books)`。`todayStr()` をカットオフに使い、表示用 `today` prop と区別する。
- Produces: 起動時・表示時の副作用のみ。新規 export なし。

- [ ] **Step 1: Write the failing test**

```tsx
it('過去日の未確定枠は表示時に自動で確定済みになる', async () => {
  // 2026-09-21 のbook付き枠を用意し、today="2026-09-22" で描画
  // 本物の todayStr() が 2026-09-22 より未来でも、cutoff は表示日ではなく実日付のため、
  // テストでは autoForfeitPastSlots を直接呼ばず画面効果で検証する:
  // expect(await screen.findByTestId('slot-locked')).toBeInTheDocument()
})
```

注：`todayStr()` が実日付に依存するため、テストでは `vi.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00'))` で固定する。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/TodayPlanScreen.test.tsx -t "自動で確定済み" -v`
Expected: FAIL（`slot-locked` が見つからない）

- [ ] **Step 3: Implement wiring**

`src/App.tsx` の `prunePastOverrides` の隣の起動時 `useEffect` で `listAvailability()` 後に `autoForfeitPastSlots(todayStr(), availability, books)` を呼ぶ。`src/screens/TodayPlanScreen.tsx` では `availabilityLoaded` 後の `useEffect` で同helperを呼び、確定後に `seasonTick` を進めて「確定済み」表示に反映する。

- [ ] **Step 4: Run tests to verify it passes**

Run: `npx vitest run src/screens/TodayPlanScreen.test.tsx src/data/seasonStore.slot.test.ts -v`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/screens/TodayPlanScreen.tsx src/screens/TodayPlanScreen.test.tsx
git commit -m "feat: run auto forfeit on startup and today plan view"
```
