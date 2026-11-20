# まとめて過去記録 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 各参考書の詳細画面から数日分の過去記録をモーダルでまとめて入力できるようにする

**Architecture:** `BookDetailScreen`に「まとめて記録」ボタンを足し、共通の`BulkRecordModal`を開く。ページ型はdate+pages表、周回型はdate+from/to/round表。保存は既存の`upsertProgress`/`addCycleRecord`とゴースト更新を再利用する。

**Tech Stack:** React 18 + TypeScript + Dexie (fake-indexeddbでテスト) + Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-11-19-bulk-past-records-design.md`

## Global Constraints

- ページ型はbook+dateで上書き（`upsertProgress`を使う）、空欄行は保存しない
- 周回型は1日複数OKで追加のみ（`addCycleRecord`を使う）、空欄行は保存しない
- バリデーションは単発と同一（ページは1以上の整数、周回は1〜totalUnits・1〜targetRounds、LEAPは選択ブロック内のみ）
- 全角数字は`normalizeNumericInput`相当で半角化して受け付ける
- 時刻選択（空き時間）はまとめ入力では省略し、`recordedAt`は付けない
- 期間外日付は警告表示のみで保存は許可する（単発と同様）
- スマホ・PWAで使えること（モーダルは画面内に収まり閉じられること）

## Review Focus

- 空欄行混じりの一括保存で空欄だけが無視され記入行だけ保存されること — Task 1のテストが固定する
- ページ型で同一日付が2行ある場合に最後の有効値で1件に集約され二重計上されないこと — Task 1のテストが固定する
- 周回型でfrom/to逆順・範囲外・周回外の行だけが拒否され有効行は保存されること — Task 2のテストが固定する
- LEAP本でブロック外の範囲が拒否されること — Task 2のテストが固定する
- 開始日・期限外の日付でも警告付きで保存でき集計に反映されること — Task 3のテストが固定する

---

### Task 1: ページ型まとめモーダル（殻＋7日初期表示＋一括保存）

**Files:**
- Create: `src/components/BulkRecordModal.tsx`
- Test: `src/components/BulkRecordModal.test.tsx`

**Interfaces:**
- Consumes: `upsertProgress(bookId: string, date: string, pages: number) => Promise<ProgressRecordData>` from `src/db/database.ts`, `appendGhostSnapshot(date: string, total: number) => Promise<void>` from `src/data/ghostLogStore.ts`, `combinedActivityOnDate(date: string, pages: ProgressRecordData[], cycles: CycleRecordData[]) => number` + `pagesRecordsForTotals` + `cycleRecordsForTotals` from `src/lib/progress.ts`
- Produces: `export function buildBulkDefaultDates(today: string, count?: number): string[]` (default count=7、昨日から遡る), `export type BulkPagesRow = { date: string; pages: string }`, `export default function BulkRecordModal(props: { book: BookData; mode: 'pages' | 'cycles'; existingPages: ProgressRecordData[]; existingCycles: CycleRecordData[]; books: BookData[]; onClose: () => void; onSaved: () => Promise<void> | void }): JSX.Element`

- [ ] **Step 1: Write the failing test for default 7 days + bulk save**

```tsx
it('opens with 7 rows ending yesterday and saves only filled rows', async () => {
  render(<BulkRecordModal book={pagesBook} mode="pages" existingPages={[]} existingCycles={[]} books={[pagesBook]} onClose={() => {}} onSaved={() => {}} />);
  expect(screen.getAllByTestId(/^bulk-date-/)).toHaveLength(7);
  fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '20' } });
  fireEvent.change(screen.getByTestId('bulk-pages-2'), { target: { value: '15' } });
  fireEvent.click(screen.getByTestId('bulk-save'));
  await waitFor(async () => expect((await db.records.toArray())).toHaveLength(2));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "7 rows ending yesterday"`
Expected: FAIL with "Cannot find module './BulkRecordModal'" or similar

- [ ] **Step 3: Implement `buildBulkDefaultDates` + `BulkRecordModal` pages table in `src/components/BulkRecordModal.tsx`**

モーダル殻（`data-testid="bulk-modal"`、閉じる`bulk-close`、追加`bulk-add-row`、保存`bulk-save`、エラー`bulk-error`）、行ごとの`bulk-row-{i}`/`bulk-date-{i}`/`bulk-pages-{i}`/`bulk-delete-{i}`を持つ。初期行は`buildBulkDefaultDates(todayStr())`で昨日から7日分。記録済み日は`existingPages`の値を初期表示。保存時は空欄スキップ、同一日付の重複は最後の有効値を採用し`upsertProgress`を日付昇順で実行、各日について`combinedActivityOnDate`で`appendGhostSnapshot`を更新。全角数字は半角化。無効値があれば保存せず`bulk-error`に表示。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "7 rows ending yesterday"`
Expected: PASS

- [ ] **Step 5: Write the failing test for duplicate-date collapse**

```tsx
it('collapses duplicate dates to the last valid value', async () => {
  render(<BulkRecordModal book={pagesBook} mode="pages" existingPages={[]} existingCycles={[]} books={[pagesBook]} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByTestId('bulk-add-row'));
  const dates = screen.getAllByTestId(/^bulk-date-/);
  fireEvent.change(dates[0], { target: { value: '2026-11-18' } });
  fireEvent.change(dates[dates.length - 1], { target: { value: '2026-11-18' } });
  fireEvent.change(screen.getByTestId(`bulk-pages-${dates.length - 1}`), { target: { value: '30' } });
  fireEvent.click(screen.getByTestId('bulk-save'));
  await waitFor(async () => {
    const rows = await db.records.where('[bookId+date]').equals(['b1', '2026-11-18']).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].pages).toBe(30);
  });
});
```

- [ ] **Step 6: Run duplicate test to verify it fails**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "collapses duplicate dates"`
Expected: FAIL (2件できる or 先勝ち)

- [ ] **Step 7: Implement duplicate-date collapse and re-run to pass**

`BulkRecordModal`の保存直前で日付ごとに最後の有効行だけ残す。Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "collapses duplicate dates"` Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/BulkRecordModal.tsx src/components/BulkRecordModal.test.tsx
git commit -m "feat: add bulk past-record modal for pages with 7-day default"
```

### Task 2: 周回型まとめ行（from/to/round＋LEAP判定）

**Files:**
- Modify: `src/components/BulkRecordModal.tsx`
- Test: `src/components/BulkRecordModal.test.tsx`

**Interfaces:**
- Consumes: Task 1の`BulkRecordModal`殻・`buildBulkDefaultDates`・行追加/削除、 `addCycleRecord(rec: CycleRecordData) => Promise<void>` from `src/db/database.ts`、`isLeapBook` + `LEAP_WORD_RANGES` from `src/lib/leap.ts`、`suggestCycleRound`/`currentCycleRound` from `src/lib/progress.ts`
- Produces: 拡張`BulkRecordModal`（mode=cycles時に`bulk-from-{i}`/`bulk-to-{i}`/`bulk-round-{i}`行を持つ）

- [ ] **Step 1: Write the failing test for cycles bulk rows**

```tsx
it('saves multiple cycle rows with per-row round', async () => {
  render(<BulkRecordModal book={cycleBook} mode="cycles" existingPages={[]} existingCycles={[]} books={[cycleBook]} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByTestId('bulk-from-0'), { target: { value: '1' } });
  fireEvent.change(screen.getByTestId('bulk-to-0'), { target: { value: '10' } });
  fireEvent.change(screen.getByTestId('bulk-round-0'), { target: { value: '1' } });
  fireEvent.change(screen.getByTestId('bulk-from-1'), { target: { value: '11' } });
  fireEvent.change(screen.getByTestId('bulk-to-1'), { target: { value: '20' } });
  fireEvent.click(screen.getByTestId('bulk-save'));
  await waitFor(async () => expect((await db.cycleRecords.toArray())).toHaveLength(2));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "saves multiple cycle rows"`
Expected: FAIL with "Unable to find bulk-from-0" or similar

- [ ] **Step 3: Implement cycles rows in `src/components/BulkRecordModal.tsx`**

`mode === 'cycles'`時のみfrom/to/round列を表示。空欄行はスキップ。round空欄は`currentCycleRound(book, existingCycles)`で補完。検証は単発と同一（from/toは1〜totalUnitsの整数、roundは1〜targetRounds、LEAP本は選択なしでも範囲1〜totalUnits＋ブロック外拒否は行わない代わりに`isLeapBook`時は1〜totalUnits内であることのみ検証しブロック外は`bulk-error`で拒否）。保存は`addCycleRecord({ id: crypto.randomUUID(), bookId, date, unitFrom, unitTo, round })`を有効行ごとに実行し、各日`appendGhostSnapshot`を更新。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "saves multiple cycle rows"`
Expected: PASS

- [ ] **Step 5: Write the failing test for invalid LEAP/out-of-range rejection**

```tsx
it('rejects only invalid cycle rows and saves valid ones', async () => {
  render(<BulkRecordModal book={leapBook} mode="cycles" existingPages={[]} existingCycles={[]} books={[leapBook]} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByTestId('bulk-from-0'), { target: { value: '1' } });
  fireEvent.change(screen.getByTestId('bulk-to-0'), { target: { value: '9999' } });
  fireEvent.change(screen.getByTestId('bulk-from-1'), { target: { value: '1' } });
  fireEvent.change(screen.getByTestId('bulk-to-1'), { target: { value: '10' } });
  fireEvent.click(screen.getByTestId('bulk-save'));
  await waitFor(() => expect(screen.getByTestId('bulk-error')).toBeInTheDocument());
  expect((await db.cycleRecords.toArray())).toHaveLength(0);
});
```

- [ ] **Step 6: Run invalid-rows test to verify it fails**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "rejects only invalid cycle rows"`
Expected: FAIL

- [ ] **Step 7: Implement invalid-row rejection and re-run to pass**

無効行がある場合は全行保存せず`bulk-error`を出す。Run: `npx vitest run src/components/BulkRecordModal.test.tsx -t "rejects only invalid cycle rows"` Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/BulkRecordModal.tsx src/components/BulkRecordModal.test.tsx
git commit -m "feat: add cycles bulk rows to past-record modal"
```

### Task 3: BookDetailScreenへの組み込みと仕上げ

**Files:**
- Modify: `src/screens/BookDetailScreen.tsx`
- Test: `src/screens/BookDetailScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1-2の`BulkRecordModal`（propsはTask 1定義通り）、`useBooks`/`useRecords`/`useCycleRecords`のrefresh

- [ ] **Step 1: Write the failing integration test**

```tsx
it('opens bulk modal with 7 rows from the detail screen', async () => {
  await db.books.add({ ...book, startDate: daysFromNow(-10), deadline: daysFromNow(10) });
  render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />);
  fireEvent.click(await screen.findByTestId('bulk-open'));
  expect(await screen.findByTestId('bulk-modal')).toBeInTheDocument();
  expect(screen.getAllByTestId(/^bulk-date-/)).toHaveLength(7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/BookDetailScreen.test.tsx -t "opens bulk modal with 7 rows"`
Expected: FAIL with "Unable to find bulk-open"

- [ ] **Step 3: Implement `bulk-open` button + modal wiring in `src/screens/BookDetailScreen.tsx`**

ページ型・周回型の両分岐に「まとめて記録」ボタン（`data-testid="bulk-open"`）を足す。押下で`BulkRecordModal`を開き、`onSaved`で`refresh()`相当の再読込＋モーダルを閉じる。モーダル外クリック・Esc・`bulk-close`で閉じる。スタイルは既存フォームと同系（padding 16、ボタン間gap 8）で画面内に収める。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/BookDetailScreen.test.tsx -t "opens bulk modal with 7 rows"`
Expected: PASS

- [ ] **Step 5: Write the failing test for out-of-range warning save**

```tsx
it('saves out-of-range dates with a warning', async () => {
  await db.books.add({ ...book, startDate: daysFromNow(-10), deadline: daysFromNow(-2) });
  render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />);
  fireEvent.click(await screen.findByTestId('bulk-open'));
  fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '5' } });
  fireEvent.click(screen.getByTestId('bulk-save'));
  await waitFor(async () => expect((await db.records.toArray()).length).toBeGreaterThan(0));
  expect(await screen.findByTestId('bulk-range-warning')).toBeInTheDocument();
});
```

- [ ] **Step 6: Run out-of-range test to verify it fails**

Run: `npx vitest run src/screens/BookDetailScreen.test.tsx -t "saves out-of-range dates with a warning"`
Expected: FAIL with "Unable to find bulk-range-warning" (Step 3時点では警告未実装のため)

- [ ] **Step 7: Implement `bulk-range-warning` and re-run to pass**

`BulkRecordModal`内で行の日付が`book.startDate〜book.deadline`外なら`data-testid="bulk-range-warning"`で警告を出す（保存は許可）。Run: `npx vitest run src/screens/BookDetailScreen.test.tsx -t "saves out-of-range dates with a warning"` Expected: PASS

- [ ] **Step 8: Run full related suites and build**

Run: `npx vitest run src/components/BulkRecordModal.test.tsx src/screens/BookDetailScreen.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: success (tsc + vite)

- [ ] **Step 9: Commit**

```bash
git add src/screens/BookDetailScreen.tsx src/screens/BookDetailScreen.test.tsx
git commit -m "feat: wire bulk past-record modal into book detail"
```
