# NOW Card Flake Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `shows the NOW card for a bookId entry` のフレイキーを直す

**Architecture:** テストコードのみの修正。`findByTestId` 直後の即時断定を `waitFor` での再照会に変え、非同期の書籍読み込み完了を待つ。実装コード（`HomeScreen.tsx`）には触れない。

**Tech Stack:** React + TypeScript + Vitest + Testing Library

**Spec:** 根本原因（会話で特定済み）。bookIdエントリのNOWカードはタイトルを非同期 `useBooks` 解決後に表示する（`NowNextItem` のタイトルは `catalogBook?.title ?? registered?.title` で、bookId時は前者が常にundefined）。現テストは `findByTestId('now-next-now')`（初回レンダーで即解決）と即時 `toHaveTextContent` のため、読み込み前に断定して `NOW0%` で落ちる。ロゴ変更なしの `main` でも同一失敗を再現済みで、今回の変更とは無関係。

## Global Constraints

- 対象ファイルのみ `git add` する（`src/screens/HomeScreen.test.tsx`）。
- 実装コード（`src/screens/HomeScreen.tsx`）には触れない。
- プッシュ前に `npm run build` が成功すること。
- プッシュはユーザーの許可後（本作業ではプッシュしない）。
- 既存テストの意図・名前は変えず、待機方法だけを変える。

## Review Focus

- 修正後テストが待機なしの即時断定に戻っていないこと。
- 他のNOWカード系テスト（`NOW card for the current book` 等）に影響しないこと。
- `waitFor` がタイムアウトせず安定すること（全件実行の負荷時も）。
- テストが本物の振る舞い（タイトル表示）を検証していること。
- 実装ファイルに差分が出ていないこと。

---

### Task 1: Fix NOW card bookId test race

**Files:**
- Modify: `src/screens/HomeScreen.test.tsx`（`shows the NOW card for a bookId entry` 1件のみ）
- Test: 同ファイル（修正自体がテスト）

**Interfaces:**
- Consumes: `waitFor`（同ファイルで既に他テストが使用）、`screen.getByTestId`
- Produces: 安定した `shows the NOW card for a bookId entry`

- [ ] **Step 1: Run the failing test to confirm the race**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/dist/**' --exclude '**/.worktrees/**' src/screens/HomeScreen.test.tsx -t "NOW card for a bookId entry"`
Expected: FAIL（`Expected: 英単語1000 / Received: NOW0%` のレース失敗、または環境によりPASSのフレイキー。FAILすればそのままStep 2へ。PASSした場合は全件実行で負荷をかけて再現を試み、それでも出なければ報告に記録してStep 2へ進む）

- [ ] **Step 2: Fix the assertion to wait for the loaded title in `src/screens/HomeScreen.test.tsx`**

`shows the NOW card for a bookId entry` の即時断定を以下に置き換える（テスト名・前段の `saveSchedule`/`db.books.add`/`render`/`findByTestId` は不変。`findByTestId` の行は残してよいが断定には使わない）：

```tsx
await waitFor(() =>
  expect(screen.getByTestId('now-next-now')).toHaveTextContent('英単語1000'),
)
```

- [ ] **Step 3: Run the fixed test repeatedly to verify stability**

Run: 上記Step 1と同一コマンドを3回実行
Expected: 3回とも PASS

- [ ] **Step 4: Run full HomeScreen suite and build**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/dist/**' --exclude '**/.worktrees/**' src/screens/HomeScreen.test.tsx`
Expected: PASS（全件。`--exclude` はルート実行時に `.worktrees/` 配下の複製テストを拾う汚染を避けるため）

Run: `npm run build`
Expected: 成功（tsc + vite）

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.test.tsx docs/superpowers/plans/2026-11-10-now-card-flake.md
git commit -m "fix: NOWカードbookIdテストのレースを待機に修正"
```
