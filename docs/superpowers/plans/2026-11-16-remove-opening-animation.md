# 起動アニメ撤去 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 起動時のロゴアニメ表示を完全に撤去し、開いてすぐホームが表示されるようにする。

**Architecture:** `App.tsx` から表示ロジック一式を削除し、参照がなくなるファイル群（コンポーネント・テスト・lib・アセット・dead CSS）を `git rm` で削除する。復活用フラグは残さない（git履歴から戻せる）。

**Tech Stack:** React 18 + TypeScript、Vitest。

**Spec:** 本プランファイル自体が仕様（ショートデザインは会話で承認済み：App表示ロジック撤去＋参照ゼロのファイル削除＋`App.test.tsx` の opening 2件削除、復活フラグなし）

## Global Constraints

- `HomeScreen` が使う `public/keiologo.png`（1507×406）は残す。削除対象は参照がゼロになるファイルのみ。
- ユーザーが置いた `public/スクリーンショット 2026-11-14 221850.png`（untracked）は触らない。
- 復活用のフラグ・分岐は残さない。
- 完了後は `npm.cmd run build` 成功確認、対象ファイルのみ `git add`/`git rm` して `main` へプッシュ。
- PowerShell の ExecutionPolicy により `npm.ps1` は起動不可のため、コマンドは `npm.cmd` を使うこと。

## Review Focus

- 起動直後にアニメが出ずホームが即表示されること（localStorage 空でも） → Task 1 の新規テストで固定。
- localStorage に opening 時刻が書き込まれないこと → Task 1 の新規テストで固定。
- storage 不可時もアニメが出ないこと → Task 1 の新規テストで固定。
- `HomeScreen` の `keiologo.png` ロゴ表示が残ること → 既存 `HomeScreen.test.tsx`（Task 3 の focused 実行で確認）。
- 削除ファイルへの参照残りがないこと（import エラーが出ない） → Task 3 の `tsc` 付き build で検出。

---

### Task 1: App.tsx から表示ロジック撤去＋テスト更新

**Files:**
- Modify: `src/App.tsx`（`OpeningSplash` の import・`OPENING_STORAGE_KEY`・`OPENING_INTERVAL_MS`・`shouldShowOpening`・`showOpening` state・記録 effect・render 分岐を削除。`useCallback` の import も不要になれば削除。`useState`/`useEffect` は他で使うため残す）
- Modify: `src/App.test.tsx`（`beforeEach` の `keio-opening-last-shown` 行と opening テスト2件 `shows opening on first launch and skips within 6h`・`shows opening when storage is unavailable` を削除し、新規テスト1件を追加）
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: なし。
- Produces: アニメなしの `App`。Task 2 は `OpeningSplash` への参照ゼロを前提にファイルを削除する。

- [ ] **Step 1: Remove the opening logic from `src/App.tsx`**

  `import OpeningSplash ...` 行、`OPENING_STORAGE_KEY`・`OPENING_INTERVAL_MS` の export、`shouldShowOpening` 関数全体、`showOpening`/`handleOpeningDone` の state・callback、表示開始時の記録 effect（`localStorage.setItem(OPENING_STORAGE_KEY ...)` の effect 全体）、`{showOpening && <OpeningSplash onDone={handleOpeningDone} />}` の render 分岐を削除する。他の effect・route 処理は変更しない。

- [ ] **Step 2: Run test to verify the old opening tests fail**

Run: `npm.cmd test -- src/App.test.tsx`
Expected: FAIL（削除したはずの opening テスト2件が `keio-opening` 不在で失敗する。他のテストは PASS のこと）

- [ ] **Step 3: Update `src/App.test.tsx` and add the locking test**

  `beforeEach` の `localStorage.setItem('keio-opening-last-shown', ...)` 行（opening スキップ専用のため）と opening テスト2件を削除し、以下を追加する。

```tsx
it('renders home immediately without any opening animation', () => {
  localStorage.clear()
  render(<App />)
  expect(screen.queryByTestId('keio-opening')).toBeNull()
  expect(screen.getByText('スケジュール管理')).toBeInTheDocument()
  expect(localStorage.getItem('keio-opening-last-shown')).toBeNull()
  const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
  render(<App />)
  expect(screen.queryByTestId('keio-opening')).toBeNull()
  getItem.mockRestore()
  setItem.mockRestore()
})
```

  `vi` は既存 import 行に存在することを確認して使う。`beforeEach` が他で使われていなければ import 行からも外す（未使用 import のビルドエラーを避けるため）。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/App.test.tsx`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: remove opening animation, show home immediately"
```

### Task 2: 参照ゼロのファイル群を削除

**Files:**
- Delete: `src/components/OpeningSplash.tsx`、`src/components/OpeningSplash.test.tsx`、`src/lib/removeWhiteBackground.ts`、`src/lib/removeWhiteBackground.test.ts`、`public/keiologo-x.png`、`public/keiologo-pens.png`
- Modify: `src/styles.css`（`.keio-opening` と `.keio-opening canvas` の dead rule 削除）
- Test: `src/App.test.tsx`（回帰確認用）

**Interfaces:**
- Consumes: Task 1 の完了（`OpeningSplash` への参照ゼロ）。
- Produces: 死にコードなしの worktree。Task 3 が focused 検証＋push する。

- [ ] **Step 1: Verify zero references, then delete**

  まず参照確認：`Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts | Select-String -Pattern 'OpeningSplash|removeWhiteBackground|keiologo-x|keiologo-pens|keio-opening'` の出力が空であることを確認する（`keiologo.png` と `keio-opening-last-shown` への言及は対象外。後者は存在しないはず）。空でなければ BLOCKED で報告する。
  確認後に削除を実行する。

- [ ] **Step 2: Delete the files and dead CSS**

```bash
git rm src/components/OpeningSplash.tsx src/components/OpeningSplash.test.tsx src/lib/removeWhiteBackground.ts src/lib/removeWhiteBackground.test.ts public/keiologo-x.png public/keiologo-pens.png
```

  続いて `src/styles.css` から `.keio-opening { ... }` と `.keio-opening canvas { ... }` の2ルールを削除する（他の rule は変更しない）。

- [ ] **Step 3: Run test to verify nothing breaks**

Run: `npm.cmd test -- src/App.test.tsx`
Expected: PASS（全件）

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "chore: remove orphaned opening animation files and styles"
```

  注意：`git rm` がステージ済みのため `git add` は `src/styles.css` のみ。`git status --short` で対象外の変更が混ざっていないか確認する。

### Task 3: focused 検証＋ビルド＋コミット＋プッシュ

**Files:**
- Commit対象: 本プランファイル `docs/superpowers/plans/2026-11-16-remove-opening-animation.md`（`git status --short` で事前確認し、無関係ファイルは含めない）
- Test: `npm.cmd test -- src/App.test.tsx src/screens/HomeScreen.test.tsx` ＋ `npm.cmd run build`

**Interfaces:**
- Consumes: Task 1-2 のコミット済み変更。
- Produces: `main` へのプッシュ。

- [ ] **Step 1: Run the focused suites**

Run: `npm.cmd test -- src/App.test.tsx src/screens/HomeScreen.test.tsx`
Expected: PASS（全件。前planの ruling R4 を継承し、文字通りの全suite PASS は要求しない）

- [ ] **Step 2: Run the build**

Run: `npm.cmd run build`
Expected: 成功（`tsc -b && vite build` がエラーなしで終了。削除ファイルへの参照残りがあればここで検出される）

- [ ] **Step 3: Commit the plan file and push**

```bash
git status --short
git add docs/superpowers/plans/2026-11-16-remove-opening-animation.md
git commit -m "docs: remove opening animation plan"
git push origin main
```
