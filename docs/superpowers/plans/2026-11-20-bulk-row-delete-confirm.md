# 行削除の確認 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** まとめて過去記録モーダルの行削除×ボタン押下時に削除確認を出す

**Architecture:** `BulkRecordModal.tsx` の `deleteRow` / `deleteCycleRow` に `window.confirm` ガードを追加するのみ。既存の記録削除確認（BookDetailScreenの `〜の記録を削除しますか？`）と同方式。

**Tech Stack:** React 18 + TypeScript + Vitest + Testing Library

**Spec:** 本プラン本文（ユーザーのスクリーンショット付き要求：赤枠の各行×で確認を取る。モーダル右上の閉じる×は対象外）

## Global Constraints

- ページ型・周回型の両方の行削除×に確認を付ける（`bulk-delete-{i}` の両分岐）
- `window.confirm('この行を削除しますか？')` でキャンセル時は行を残す（既存の削除確認と同方式）
- 空欄行でも確認を出す（要求通り一律。入力の有無で分岐しない）
- モーダルを閉じる×・Esc・背景タップの挙動は変えない（保存中ロック含む）
- 保存・バリデーション・ゴースト等の既存挙動は一切変えない

## Review Focus

- キャンセル時に行が残り、保存対象に含まれること — Task 1のテストが固定する
- OK時に行が消えること（既存テスト `bulk-delete-0` 利用箇所の維持） — Task 1のテストが固定する

---

### Task 1: 行削除に削除確認を追加

**Files:**
- Modify: `src/components/BulkRecordModal.tsx`
- Test: `src/components/BulkRecordModal.test.tsx`

**Interfaces:**
- Consumes: なし（新規依存なし）。`window.confirm` は既存テストの `vi.spyOn(window, 'confirm')` 方式で検証する
- Produces: 変更なし（props/testidの追加・変更なし）

- [ ] **Step 1: Write the failing tests**

```tsx
it('asks for confirmation before deleting a pages row', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<BulkRecordModal book={pagesBook} mode="pages" existingPages={[]} existingCycles={[]} books={[pagesBook]} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByTestId('bulk-delete-0'));
  expect(confirmSpy).toHaveBeenCalledWith('この行を削除しますか？');
  expect(screen.getAllByTestId(/^bulk-row-/)).toHaveLength(7);
  confirmSpy.mockRestore();
});

it('deletes the row when confirmed', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<BulkRecordModal book={pagesBook} mode="pages" existingPages={[]} existingCycles={[]} books={[pagesBook]} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByTestId('bulk-delete-0'));
  expect(screen.getAllByTestId(/^bulk-row-/)).toHaveLength(6);
  confirmSpy.mockRestore();
});

it('asks for confirmation before deleting a cycles row', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<BulkRecordModal book={cycleBook} mode="cycles" existingPages={[]} existingCycles={[]} books={[cycleBook]} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByTestId('bulk-delete-0'));
  expect(confirmSpy).toHaveBeenCalledWith('この行を削除しますか？');
  expect(screen.getAllByTestId(/^bulk-row-/)).toHaveLength(7);
  confirmSpy.mockRestore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "confirmation"`
Expected: FAIL (confirm never called)

- [ ] **Step 3: Implement confirm guard in `src/components/BulkRecordModal.tsx`**

`deleteRow` と `deleteCycleRow` の先頭で `if (!window.confirm('この行を削除しますか？')) return;` を行う。他の挙動は変えない。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx`
Expected: PASS (全件。確認テスト3件＋既存20件＋詳細画面に影響なし)

- [ ] **Step 5: Run full related suites and build**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx src/screens/BookDetailScreen.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: success

- [ ] **Step 6: Commit**

```bash
git add src/components/BulkRecordModal.tsx src/components/BulkRecordModal.test.tsx
git commit -m "feat: confirm before deleting a bulk-record row"
```
