# ページ範囲記録 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常本の記録を「何ページ」から「開始〜終了ページ」に変えページ数は自動計算する

**Architecture:** pages式の保存則（book+dateでupsert上書き・1日1件）を維持し、`ProgressRecordData`に任意の`pageFrom/pageTo`を追加して`pages=終了-開始+1`で保存する。単発・編集・まとめて記録を2欄化し、一覧は範囲表示する。

**Tech Stack:** React 18 + TypeScript + Vite + Dexie (IndexedDB) + Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-11-20-page-range-design.md`

## Global Constraints

- pages式の保存則を維持する（book+dateでupsert上書き、1日1件）。
- pagesは正として残し互換維持する（旧記録は範囲なしでも表示・集計できる）。
- pageFrom/pageToは任意追加でDexieスキーマ変更なしとする。
- バリデーションは開始≦終了かつ1〜総ページの整数とする。
- 全角数字正規化・iPhone入力配慮を再利用する（text入力＋正規化）。
- 期間外日付は警告のみで保存許可（現行通り）とする。
- スマホ・PWAで使えること。

## Review Focus

- 開始＞終了の逆順入力はエラーになり保存されないことを期待する。
- 範囲が1〜総ページを外れる（0・総ページ+1）はエラーになることを期待する。
- 全角数字（例：１２０〜１３６）は半角として受け付けられることを期待する。
- 範囲なし旧記録（pagesのみ）は「17ページ」のまま表示・集計されることを期待する。
- まとめて記録で同じ日付に別範囲2行があるときは後ろの行が優先され1件になることを期待する。

---

### Task 1: データモデルと範囲ヘルパー

**Files:**
- Modify: `src/lib/progress.ts`
- Modify: `src/db/database.ts`
- Modify: `src/db/backup.ts`
- Test: `src/lib/progress.test.ts` (新規なら作成、既存があれば追記)
- Test: `src/db/backup.test.ts`

**Interfaces:**
- Consumes: なし（基盤タスク）
- Produces: `ProgressRecordData { pageFrom?: number; pageTo?: number }`, `rangePages(from: number, to: number): number`, `validatePageRange(from: number, to: number, totalPages: number): string | null`, `upsertProgress(bookId, date, pages, recordedAt?, pageFrom?, pageTo?)`, `RecordPatch { pageFrom?: number; pageTo?: number }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/progress.test.ts
import { describe, it, expect } from 'vitest'
import { rangePages, validatePageRange } from './progress'
describe('page range helper', () => {
  it('120-136は17ページになる', () => {
    expect(rangePages(120, 136)).toBe(17)
  })
  it('開始＞終了はエラー', () => {
    expect(validatePageRange(136, 120, 320)).not.toBeNull()
  })
  it('範囲外はエラー', () => {
    expect(validatePageRange(0, 10, 320)).not.toBeNull()
    expect(validatePageRange(1, 321, 320)).not.toBeNull()
  })
  it('正常範囲はnull', () => {
    expect(validatePageRange(120, 136, 320)).toBeNull()
  })
})
```

```typescript
// src/db/backup.test.ts 追記ケース
it('範囲付きpages記録を受け入れる', () => {
  expect(validateBackup({ ...base, records: [{ id: 'r1', bookId: 'b1', date: '2026-11-20', pages: 17, pageFrom: 120, pageTo: 136 }] })).toBe(true)
})
it('開始＞終了の範囲記録を拒否する', () => {
  expect(validateBackup({ ...base, records: [{ id: 'r1', bookId: 'b1', date: '2026-11-20', pages: 17, pageFrom: 136, pageTo: 120 }] })).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/progress.test.ts src/db/backup.test.ts`
Expected: FAIL with "rangePages is not defined / validatePageRange is not defined"

- [ ] **Step 3: Implement `rangePages` and `validatePageRange` in `src/lib/progress.ts`, extend `ProgressRecordData` with `pageFrom?: number; pageTo?: number`**

Approach: `rangePages = to - from + 1`。`validatePageRange`は整数・1〜totalPages・from≦toを検査し、エラーメッセージ文字列かnullを返す。

- [ ] **Step 4: Extend `upsertProgress` and `RecordPatch`/`updateProgressRecord` in `src/db/database.ts` to persist `pageFrom/pageTo`, extend `validateBackup` in `src/db/backup.ts` to accept optional range and reject `pageFrom > pageTo` or out-of-range types**

`upsertProgress(bookId: string, date: string, pages: number, recordedAt?: string, pageFrom?: number, pageTo?: number)`とし、既存レコード更新時は範囲も上書きする。backupは`pages>=1`維持＋`pageFrom/pageTo`があれば整数・`pageFrom<=pageTo`を要求する。

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/progress.test.ts src/db/backup.test.ts src/db/database.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/progress.ts src/db/database.ts src/db/backup.ts src/lib/progress.test.ts src/db/backup.test.ts
git commit -m "feat: add page range model and validation"
```

### Task 2: 詳細画面の単発・編集・一覧を範囲化

**Files:**
- Modify: `src/screens/BookDetailScreen.tsx`
- Modify: `src/hooks/useRecords.ts`
- Test: `src/screens/BookDetailScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `rangePages`, `validatePageRange`, `ProgressRecordData.pageFrom/pageTo`, `upsertProgress(..., pageFrom, pageTo)`
- Produces: UI testid `record-from`, `record-to`, `record-range-preview`, 既存 `progress-input` の廃止ではなく置換（後続タスクは新testidを使う）

- [ ] **Step 1: Write the failing test**

```tsx
it('範囲120-136で17ページとして記録され一覧に範囲表示される', async () => {
  renderDetail(pagesBook)
  fireEvent.change(await screen.findByTestId('record-from'), { target: { value: '120' } })
  fireEvent.change(screen.getByTestId('record-to'), { target: { value: '136' } })
  expect(screen.getByTestId('record-range-preview')).toHaveTextContent('17')
  fireEvent.click(screen.getByTestId('record-progress'))
  await waitFor(async () => {
    const recs = await db.records.toArray()
    expect(recs[0].pages).toBe(17)
    expect(recs[0].pageFrom).toBe(120)
    expect(recs[0].pageTo).toBe(136)
  })
  expect(await screen.findByTestId('record-list')).toHaveTextContent('120〜136')
})
it('開始＞終了は保存されずエラー表示', async () => {
  renderDetail(pagesBook)
  fireEvent.change(await screen.findByTestId('record-from'), { target: { value: '136' } })
  fireEvent.change(screen.getByTestId('record-to'), { target: { value: '120' } })
  fireEvent.click(screen.getByTestId('record-progress'))
  expect(await screen.findByTestId('record-error')).toBeInTheDocument()
  expect(await db.records.count()).toBe(0)
})
it('範囲なし旧記録はページ表示のまま', async () => {
  await db.records.add({ id: 'r1', bookId: 'b1', date: daysFromNow(-1), pages: 17 })
  renderDetail(pagesBook)
  expect(await screen.findByTestId('record-list')).toHaveTextContent('17ページ')
})
it('全角数字でも範囲記録できる', async () => {
  renderDetail(pagesBook)
  fireEvent.change(await screen.findByTestId('record-from'), { target: { value: '１２０' } })
  fireEvent.change(screen.getByTestId('record-to'), { target: { value: '１３６' } })
  fireEvent.click(screen.getByTestId('record-progress'))
  await waitFor(async () => {
    const recs = await db.records.toArray()
    expect(recs[0].pages).toBe(17)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/BookDetailScreen.test.tsx -t "範囲120-136"`
Expected: FAIL with "Unable to find testid record-from"

- [ ] **Step 3: Implement range inputs in `src/screens/BookDetailScreen.tsx` (pages分岐のみ)**

`pagesInput`単欄を`recordFrom/recordTo`の2欄（text＋全角正規化、既存`handleNumericInputChange`再利用）に置換する。プレビュー`record-range-preview`に`rangePages`結果を表示する。`handleRecord`は`validatePageRange(from,to,book.totalPages)`を通し、`addProgress(book.id,targetDate,pages,recordedAt,from,to)`で保存する。`useRecords.addProgress`の署名を Task 1 に合わせて中継する。編集フォームは`record-edit-from-<id>/record-edit-to-<id>`の2欄化＋保存時も範囲検証する。一覧行は範囲ありなら`120〜136（17p）`、なしなら`17ページ`と表示する。「前回と同じ」は前回範囲のfrom/toを復元し、「つづきから入力」（前回終了+1を開始に）は単発のみ追加する。目標セット・ステッパー・日付・空き時間・ゴースト更新の既存動作は変えない。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/BookDetailScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/BookDetailScreen.tsx src/hooks/useRecords.ts src/screens/BookDetailScreen.test.tsx
git commit -m "feat: record pages by range in detail screen"
```

### Task 3: まとめて記録（pages側）を範囲化して仕上げ

**Files:**
- Modify: `src/components/BulkRecordModal.tsx`
- Modify: `src/screens/BookDetailScreen.tsx` (bulk連携の既存pages参照があれば調整)
- Test: `src/components/BulkRecordModal.test.tsx`
- Test: `src/screens/BookDetailScreen.test.tsx` (bulk経由の範囲ケース追記)

**Interfaces:**
- Consumes: Task 1 の `validatePageRange`/`rangePages`/`upsertProgress`範囲対応、Task 2 の一覧表示則
- Produces: なし（末端タスク）。`npm run build`成功で完了。

- [ ] **Step 1: Write the failing test**

```tsx
it('bulkで開始〜終了の2行が範囲保存される', async () => {
  renderModal()
  fireEvent.change(screen.getByTestId('bulk-from-0'), { target: { value: '120' } })
  fireEvent.change(screen.getByTestId('bulk-to-0'), { target: { value: '136' } })
  fireEvent.click(screen.getByTestId('bulk-save'))
  await waitFor(async () => { expect(await db.records.count()).toBe(1) })
  const saved = await db.records.toArray()
  expect(saved[0].pages).toBe(17)
  expect(saved[0].pageFrom).toBe(120)
  expect(saved[0].pageTo).toBe(136)
})
it('bulkの同日重複は後ろの行が優先される', async () => {
  renderModal()
  fireEvent.change(screen.getByTestId('bulk-date-0'), { target: { value: '2026-11-18' } })
  fireEvent.change(screen.getByTestId('bulk-from-0'), { target: { value: '1' } })
  fireEvent.change(screen.getByTestId('bulk-to-0'), { target: { value: '10' } })
  fireEvent.change(screen.getByTestId('bulk-date-1'), { target: { value: '2026-11-18' } })
  fireEvent.change(screen.getByTestId('bulk-from-1'), { target: { value: '20' } })
  fireEvent.change(screen.getByTestId('bulk-to-1'), { target: { value: '25' } })
  fireEvent.click(screen.getByTestId('bulk-save'))
  await waitFor(async () => {
    const rows = await db.records.where('[bookId+date]').equals(['b1', '2026-11-18']).toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].pages).toBe(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/BulkRecordModal.test.tsx -t "bulkで開始"`
Expected: FAIL with "Unable to find testid bulk-from-0"

- [ ] **Step 3: Implement pages rows as range in `src/components/BulkRecordModal.tsx`**

`BulkPagesRow`を`{ date, from, to }`に変える（`pages`は廃止）。既存プリフィルは`hit.pageFrom/pageTo`があれば復元し、なければ空欄にする。`handleSave`のpages分岐は各行で`validatePageRange(from,to,book.totalPages)`を通し、`pages=rangePages(from,to)`を`byDate`に`{ pages, from, to }`で保持して後勝ち上書きし、`upsertProgress(book.id,date,pages,undefined,from,to)`で日ごとに保存する。入力欄testidは`bulk-from-<i>/bulk-to-<i>`、プレースホルダは`開始ページ/終了ページ`、空欄行スキップ・日付形式チェック・範囲外警告・ゴースト更新・保存ロックの既存動作は維持する。BookDetailScreen側のbulk呼び出しはmode分岐そのままでよいが、参照が残っていれば調整する。

- [ ] **Step 4: Run tests and build to verify it passes**

Run: `npm test -- src/components/BulkRecordModal.test.tsx src/screens/BookDetailScreen.test.tsx src/db/backup.test.ts`
Expected: PASS
Run: `npm run build`
Expected: success (tsc + vite)

- [ ] **Step 5: Commit**

```bash
git add src/components/BulkRecordModal.tsx src/screens/BookDetailScreen.tsx src/components/BulkRecordModal.test.tsx src/screens/BookDetailScreen.test.tsx
git commit -m "feat: record pages by range in bulk modal"
```
