# 反復学習（区画×周回）実装計画

> **実装担当エージェントへ:** 必須サブスキル: superpowers:subagent-driven-development（推奨）または superpowers:executing-plans を使い、この計画をタスクごとに実装すること。ステップはチェックボックス（`- [ ]`）形式で管理する。

**目標:** 本ごとに選べる「反復モード（区画×周回）」を追加し、範囲＋周回数の記録を毎日の目標に反映する。

**方針:** ページ記録（`records`）とは別の新テーブル `cycleRecords` に範囲＋周回を保存し、進捗は (区画, 周回) ペアの重複なし件数で数える。時間割・AI・全体診断の中心ロジックには手を入れず、反復本はそこから除外して別枠で表示する。

**技術スタック:** React 18 + TypeScript + Dexie (IndexedDB) + Vitest (jsdom, fake-indexeddb)。テスト実行は `cmd /c "npm run test -- --run <パス>"`。

**仕様書:** `docs/superpowers/specs/2026-09-25-study-cycles-design.md`

## 全体制約

- TDD: 先に失敗テストを書き、失敗を確認してから最小実装する。
- 既存の通常ページ本の動作・既存テスト全緑を維持する。
- `studyMode` 未設定は通常ページとして扱う（既存互換）。
- 1タスク＝1つの独立テスト可能な成果物。終わりにコミットする。

---

## ファイル構成

- 変更: `src/lib/progress.ts` — 型追加＋区画進捗計算の純粋関数。
- テスト: `src/lib/progress.test.ts`（既存ファイルに追記）。
- 変更: `src/db/database.ts` — Dexie v3 `cycleRecords` テーブル＋CRUDヘルパー。
- 新規: `src/hooks/useCycleRecords.ts` — `useRecords` と同形のフック。
- テスト: `src/db/cycleRecords.test.ts`（新規）。
- 変更: `src/db/backup.ts` / テスト: `src/db/backup.test.ts`（既存に追記）— export/import/validate に `cycleRecords` を含める。
- 変更: `src/screens/BookFormScreen.tsx` / テスト: `src/screens/BookFormScreen.test.tsx`（既存に追記）。
- 変更: `src/screens/BookDetailScreen.tsx` / テスト: `src/screens/BookDetailScreen.test.tsx`（既存に追記）。
- 変更: `src/screens/HomeScreen.tsx` / テスト: `src/screens/HomeScreen.test.tsx`（既存に追記）。
- 変更: `src/screens/TodayPlanScreen.tsx` / テスト: `src/screens/TodayPlanScreen.test.tsx`（既存に追記）。
- 変更: `src/screens/ChatScreen.tsx`（既存テストで回帰確認）。

## 共通インターフェース（全タスクでこの名前を使う）

```typescript
// src/lib/progress.ts に追加
export type StudyMode = 'pages' | 'cycles'
export type CycleRecordData = {
  id: string
  bookId: string
  date: string       // yyyy-MM-dd
  unitFrom: number   // 開始区画（1以上の整数）
  unitTo: number     // 終了区画（unitFrom 以上の整数）
  round: number      // 周回（1以上の整数）
}
// BookData に追加（すべて optional）
studyMode?: StudyMode
totalUnits?: number
targetRounds?: number
initialDoneUnits?: number
```

```typescript
// src/lib/progress.ts に追加する関数（シグネチャ固定）
export function expandCyclePairs(records: CycleRecordData[]): Set<string>
export function calcCycleDonePairs(
  book: { initialDoneUnits?: number },
  records: CycleRecordData[],
): number
export function cycleGrandTotal(book: { totalUnits?: number; targetRounds?: number }): number
export function calcCycleDailyTarget(
  book: { totalUnits?: number; targetRounds?: number },
  donePairs: number,
  remainingDays: number,
): number
export function currentCycleRound(
  book: { totalUnits?: number; targetRounds?: number },
  records: CycleRecordData[],
): number
```

```typescript
// src/db/database.ts に追加（シグネチャ固定）
export async function listCycleRecords(bookId: string): Promise<CycleRecordData[]>
export async function addCycleRecord(rec: CycleRecordData): Promise<void>
export async function updateCycleRecord(
  id: string,
  patch: { date?: string; unitFrom?: number; unitTo?: number; round?: number },
): Promise<void>
export async function deleteCycleRecord(id: string): Promise<void>
```

ペアキーは `${unit}:${round}` とする。`expandCyclePairs` は各レコードの `unitFrom..unitTo` を展開してキーを集める（不正範囲のレコードは無視する）。

---

### タスク1: 区画進捗計算 (progress.ts)

**ファイル:**
- 変更: `src/lib/progress.ts`
- テスト: `src/lib/progress.test.ts`（追記）

**入出力:**
- 使うもの: 既存 `BookData`、`daysBetween`。
- 作るもの: 共通インターフェースの5関数＋型。タスク3〜6が使う。

- [ ] **ステップ1: 失敗テストを書く**

```typescript
import {
  expandCyclePairs,
  calcCycleDonePairs,
  cycleGrandTotal,
  calcCycleDailyTarget,
  currentCycleRound,
  type CycleRecordData,
} from './progress'

describe('cycle progress', () => {
  const rec = (id: string, unitFrom: number, unitTo: number, round: number): CycleRecordData => ({
    id, bookId: 'b1', date: '2026-01-05', unitFrom, unitTo, round,
  })

  it('重なった範囲を二重計上せず distinct で数える', () => {
    const records = [rec('r1', 1, 5, 1), rec('r2', 4, 8, 1)]
    expect(expandCyclePairs(records).size).toBe(8)
    expect(calcCycleDonePairs({}, records)).toBe(8)
  })

  it('初期完了分を加算し総量と毎日の目標を計算する', () => {
    const book = { totalUnits: 10, targetRounds: 3, initialDoneUnits: 10 }
    expect(cycleGrandTotal(book)).toBe(30)
    // 完了 10 + 記録 8 = 18、残り 12 / 6日 = 2区画/日
    const done = calcCycleDonePairs(book, [rec('r1', 1, 8, 2)])
    expect(done).toBe(18)
    expect(calcCycleDailyTarget(book, done, 6)).toBe(2)
  })

  it('未完の最小周回を返す', () => {
    const book = { totalUnits: 5, targetRounds: 3 }
    const records = [rec('r1', 1, 5, 1), rec('r2', 1, 2, 2)]
    expect(currentCycleRound(book, records)).toBe(2)
  })

  it('完了時は0、期限切れ時は残り全部を返す', () => {
    const book = { totalUnits: 10, targetRounds: 1 }
    expect(calcCycleDailyTarget(book, 10, 5)).toBe(0)
    expect(calcCycleDailyTarget(book, 4, 0)).toBe(6)
  })
})
```

- [ ] **ステップ2: テストを実行し失敗を確認する**

実行: `cmd /c "npm run test -- --run src/lib/progress.test.ts"`
期待: FAIL（`expandCyclePairs is not a function` 等の import 失敗）

- [ ] **ステップ3: 通るための最小実装を書く**

```typescript
export type StudyMode = 'pages' | 'cycles'

export type CycleRecordData = {
  id: string
  bookId: string
  date: string
  unitFrom: number
  unitTo: number
  round: number
}

export function expandCyclePairs(records: CycleRecordData[]): Set<string> {
  const pairs = new Set<string>()
  for (const r of records) {
    if (!Number.isInteger(r.unitFrom) || !Number.isInteger(r.unitTo)) continue
    if (!Number.isInteger(r.round) || r.round < 1) continue
    if (r.unitFrom < 1 || r.unitTo < r.unitFrom) continue
    for (let u = r.unitFrom; u <= r.unitTo; u++) pairs.add(`${u}:${r.round}`)
  }
  return pairs
}

export function calcCycleDonePairs(
  book: { initialDoneUnits?: number },
  records: CycleRecordData[],
): number {
  return (book.initialDoneUnits ?? 0) + expandCyclePairs(records).size
}

export function cycleGrandTotal(book: {
  totalUnits?: number
  targetRounds?: number
}): number {
  return (book.totalUnits ?? 0) * (book.targetRounds ?? 0)
}

export function calcCycleDailyTarget(
  book: { totalUnits?: number; targetRounds?: number },
  donePairs: number,
  remainingDays: number,
): number {
  const remaining = Math.max(cycleGrandTotal(book) - donePairs, 0)
  if (remaining <= 0) return 0
  if (remainingDays <= 0) return remaining
  return Math.ceil(remaining / remainingDays)
}

export function currentCycleRound(
  book: { totalUnits?: number; targetRounds?: number },
  records: CycleRecordData[],
): number {
  const total = book.totalUnits ?? 0
  const rounds = book.targetRounds ?? 0
  if (!Number.isInteger(total) || total <= 0) return 1
  if (!Number.isInteger(rounds) || rounds <= 0) return 1
  const pairs = expandCyclePairs(records)
  for (let r = 1; r <= rounds; r++) {
    let covered = 0
    for (let u = 1; u <= total; u++) if (pairs.has(`${u}:${r}`)) covered++
    if (covered < total) return r
  }
  return rounds
}
```

`BookData` 型に以下4行を追加する：

```typescript
  studyMode?: StudyMode
  totalUnits?: number
  targetRounds?: number
  initialDoneUnits?: number
```

- [ ] **ステップ4: テストを実行し成功を確認する**

実行: `cmd /c "npm run test -- --run src/lib/progress.test.ts"`
期待: PASS（全テスト緑）

- [ ] **ステップ5: コミットする**

```bash
git add src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat: add cycle (section x round) progress math"
```

---

### タスク2: cycleRecords テーブル＋バックアップ対応

**ファイル:**
- 変更: `src/db/database.ts`
- 新規: `src/hooks/useCycleRecords.ts`
- 新規: `src/db/cycleRecords.test.ts`
- 変更: `src/db/backup.ts`、`src/db/backup.test.ts`（追記）

**入出力:**
- 使うもの: タスク1の `CycleRecordData` 型。
- 作るもの: DBヘルパー4関数＋`useCycleRecords` フック。タスク4が使う。

- [ ] **ステップ1: 失敗テストを書く**（`src/db/cycleRecords.test.ts` を新規作成）

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { db, addCycleRecord, listCycleRecords, updateCycleRecord, deleteCycleRecord } from './database'
import type { CycleRecordData } from '../lib/progress'

const rec = (id: string, extra: Partial<CycleRecordData> = {}): CycleRecordData => ({
  id, bookId: 'b1', date: '2026-01-05', unitFrom: 1, unitTo: 3, round: 1, ...extra,
})

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
})

describe('cycleRecords', () => {
  it('本ごとに記録を追加・取得できる', async () => {
    await addCycleRecord(rec('r1'))
    await addCycleRecord(rec('r2', { bookId: 'b2' }))
    expect((await listCycleRecords('b1')).map((r) => r.id)).toEqual(['r1'])
  })

  it('記録を更新・削除できる', async () => {
    await addCycleRecord(rec('r1'))
    await updateCycleRecord('r1', { unitTo: 5, round: 2 })
    const got = await db.cycleRecords.get('r1')
    expect(got?.unitTo).toBe(5)
    expect(got?.round).toBe(2)
    await deleteCycleRecord('r1')
    expect(await db.cycleRecords.get('r1')).toBeUndefined()
  })
})
```

バックアップの追記テスト（`src/db/backup.test.ts` に追加）：

```typescript
it('cycleRecords を含めて保存・復元できる', async () => {
  const data = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [{ ...book, studyMode: 'cycles', totalUnits: 10, targetRounds: 3 }],
    records: [],
    cycleRecords: [
      { id: 'c1', bookId: 'b1', date: '2026-01-05', unitFrom: 1, unitTo: 4, round: 1 },
    ],
  }
  expect(validateBackup(data)).toBe(true)
  await importBackup(data as any)
  expect(await db.cycleRecords.count()).toBe(1)
})

it('cycleRecords のない古いバックアップも受け付ける', () => {
  const old = { exportedAt: '2026-01-05T00:00:00.000Z', books: [book], records: [record] }
  expect(validateBackup(old)).toBe(true)
})
```

（`book`、`record` は当該ファイルの既存fixture名に合わせること。合わなければ既存定義を流用し、新規定義は作らない。）

- [ ] **ステップ2: テストを実行し失敗を確認する**

実行: `cmd /c "npm run test -- --run src/db/cycleRecords.test.ts src/db/backup.test.ts"`
期待: FAIL（`db.cycleRecords is undefined`／新形式が弾かれる等）

- [ ] **ステップ3: 通るための最小実装を書く**

`src/db/database.ts` の変更：

```typescript
import type { BookData, ProgressRecordData, CycleRecordData } from '../lib/progress'
```

クラスに `cycleRecords!: Table<CycleRecordData, string>` を追加し、version 3 を追加する（Dexieは各versionで全storeを列挙する必要があるため既存分も再掲）：

```typescript
this.version(3).stores({
  books: 'id, deadline, startDate',
  records: 'id, bookId, [bookId+date]',
  availability: 'id, weekday, date',
  adjustments: 'id, date, bookId',
  cycleRecords: 'id, bookId, [bookId+date]',
})
```

ファイル末尾にヘルパーを追加：

```typescript
export async function listCycleRecords(bookId: string): Promise<CycleRecordData[]> {
  return db.cycleRecords.where('bookId').equals(bookId).toArray()
}

export async function addCycleRecord(rec: CycleRecordData): Promise<void> {
  await db.cycleRecords.add(rec)
}

export async function updateCycleRecord(
  id: string,
  patch: { date?: string; unitFrom?: number; unitTo?: number; round?: number },
): Promise<void> {
  await db.cycleRecords.update(id, patch)
}

export async function deleteCycleRecord(id: string): Promise<void> {
  await db.cycleRecords.delete(id)
}
```

`src/hooks/useCycleRecords.ts` を新規作成（`useRecords` と同形）：

```typescript
import { useCallback, useEffect, useState } from 'react'
import { db, addCycleRecord, updateCycleRecord, deleteCycleRecord } from '../db/database'
import type { CycleRecordData } from '../lib/progress'

export function useCycleRecords(bookId?: string) {
  const [cycleRecords, setCycleRecords] = useState<CycleRecordData[]>([])

  const refresh = useCallback(async () => {
    setCycleRecords(
      bookId ? await db.cycleRecords.where('bookId').equals(bookId).toArray() : await db.cycleRecords.toArray(),
    )
  }, [bookId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addCycle = useCallback(
    async (rec: CycleRecordData) => {
      await addCycleRecord(rec)
      await refresh()
    },
    [refresh],
  )

  const updateCycle = useCallback(
    async (id: string, patch: { date?: string; unitFrom?: number; unitTo?: number; round?: number }) => {
      await updateCycleRecord(id, patch)
      await refresh()
    },
    [refresh],
  )

  const removeCycle = useCallback(
    async (id: string) => {
      await deleteCycleRecord(id)
      await refresh()
    },
    [refresh],
  )

  return { cycleRecords, refresh, addCycle, updateCycle, removeCycle }
}
```

`src/db/backup.ts` の変更：`BackupData` に `cycleRecords: CycleRecordData[]` を追加し、`exportBackup` に `cycleRecords: await db.cycleRecords.toArray()` を追加する。`validateBackup` は `cycleRecords` が無い古い形式も許容し（欠落時は `[]` 扱い）、ある場合は各件の `id/bookId/date/unitFrom/unitTo/round` と `unitFrom <= unitTo`・`round >= 1`・bookId存在を検証する。`importBackup` のtransactionに `db.cycleRecords` を加え、clear＋bulkAdd（欠落時は空配列）し、戻り値は従来通り `{ books, records }` とする。

- [ ] **ステップ4: テストを実行し成功を確認する**

実行: `cmd /c "npm run test -- --run src/db/cycleRecords.test.ts src/db/backup.test.ts src/db/database.test.ts"`
期待: PASS

- [ ] **ステップ5: コミットする**

```bash
git add src/db/database.ts src/hooks/useCycleRecords.ts src/db/cycleRecords.test.ts src/db/backup.ts src/db/backup.test.ts
git commit -m "feat: add cycleRecords table and backup support"
```

---

### タスク3: 登録・編集フォームの反復モード

**ファイル:**
- 変更: `src/screens/BookFormScreen.tsx`
- テスト: `src/screens/BookFormScreen.test.tsx`（追記）

**入出力:**
- 使うもの: タスク1の型（`studyMode/totalUnits/targetRounds/initialDoneUnits`）。
- 作るもの: 反復本の `BookData`。タスク4・5が読む。

- [ ] **ステップ1: 失敗テストを書く**

```typescript
it('反復モードで全区画数・目標周回を保存できる', async () => {
  render(<BookFormScreen book={null} onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('book-title'), { target: { value: 'LEAP' } })
  fireEvent.change(screen.getByTestId('book-pages'), { target: { value: '576' } })
  fireEvent.click(screen.getByTestId('book-mode-cycles'))
  fireEvent.change(screen.getByTestId('book-total-units'), { target: { value: '20' } })
  fireEvent.change(screen.getByTestId('book-target-rounds'), { target: { value: '3' } })
  fireEvent.change(screen.getByTestId('book-initial-units'), { target: { value: '20' } })
  fireEvent.change(screen.getByTestId('book-start'), { target: { value: '2026-09-01' } })
  fireEvent.change(screen.getByTestId('book-deadline'), { target: { value: '2026-11-30' } })
  fireEvent.click(screen.getByTestId('book-save'))
  await waitFor(async () => {
    const books = await db.books.toArray()
    const created = books.find((b) => b.title === 'LEAP')
    expect(created?.studyMode).toBe('cycles')
    expect(created?.totalUnits).toBe(20)
    expect(created?.targetRounds).toBe(3)
    expect(created?.initialDoneUnits).toBe(20)
  })
})

it('総量を超える初期完了分は拒否する', () => {
  render(<BookFormScreen book={null} onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('book-title'), { target: { value: 'LEAP' } })
  fireEvent.change(screen.getByTestId('book-pages'), { target: { value: '576' } })
  fireEvent.click(screen.getByTestId('book-mode-cycles'))
  fireEvent.change(screen.getByTestId('book-total-units'), { target: { value: '20' } })
  fireEvent.change(screen.getByTestId('book-target-rounds'), { target: { value: '3' } })
  fireEvent.change(screen.getByTestId('book-initial-units'), { target: { value: '61' } })
  fireEvent.change(screen.getByTestId('book-start'), { target: { value: '2026-09-01' } })
  fireEvent.change(screen.getByTestId('book-deadline'), { target: { value: '2026-11-30' } })
  fireEvent.click(screen.getByTestId('book-save'))
  expect(screen.getByTestId('book-error')).toHaveTextContent(/区画/)
})
```

- [ ] **ステップ2: テストを実行し失敗を確認する**

実行: `cmd /c "npm run test -- --run src/screens/BookFormScreen.test.tsx"`
期待: FAIL（`book-mode-cycles` が見つからない）

- [ ] **ステップ3: 通るための最小実装を書く**

state を3つ追加する（初期値は `book` から）：

```typescript
const [studyMode, setStudyMode] = useState<'pages' | 'cycles'>(book?.studyMode ?? 'pages')
const [totalUnits, setTotalUnits] = useState(
  book?.totalUnits != null ? String(book.totalUnits) : '',
)
const [targetRounds, setTargetRounds] = useState(
  book?.targetRounds != null ? String(book.targetRounds) : '',
)
const [initialUnits, setInitialUnits] = useState(
  book?.initialDoneUnits != null ? String(book.initialDoneUnits) : '',
)
```

`handleSave` の `initialDonePages` 処理の直後に追加する：

```typescript
let totalUnitsNum: number | undefined
let targetRoundsNum: number | undefined
let initialDoneUnits: number | undefined
if (studyMode === 'cycles') {
  const tu = Number(totalUnits)
  const tr = Number(targetRounds)
  if (!Number.isInteger(tu) || tu < 1) {
    setError('全区画数は1以上の整数で入力してください')
    return
  }
  if (!Number.isInteger(tr) || tr < 1) {
    setError('目標周回は1以上の整数で入力してください')
    return
  }
  totalUnitsNum = tu
  targetRoundsNum = tr
  if (initialUnits.trim() !== '') {
    const v = Number(initialUnits)
    if (!Number.isInteger(v) || v < 0 || v > tu * tr) {
      setError('すでに終わった区画数は0以上かつ総量以下で入力してください')
      return
    }
    initialDoneUnits = v > 0 ? v : undefined
  }
}
```

`next: BookData` に追加する：

```typescript
studyMode: studyMode === 'cycles' ? 'cycles' : undefined,
totalUnits: totalUnitsNum,
targetRounds: targetRoundsNum,
initialDoneUnits: studyMode === 'cycles' ? initialDoneUnits : book?.initialDoneUnits,
```

（通常モードに戻しても反対側のページ側 `initialDonePages` は既存ロジックのまま保持する。反復→通常へ戻す場合も `initialDoneUnits` は保持し、再び反復に戻すと復活する。）

JSX（「すでに進めたページ数」の下あたり）に以下を追加する：

```tsx
<div>
  <span>学習方式</span>
  <button data-testid="book-mode-pages" type="button" aria-pressed={studyMode === 'pages'} onClick={() => setStudyMode('pages')}>
    通常ページ
  </button>
  <button data-testid="book-mode-cycles" type="button" aria-pressed={studyMode === 'cycles'} onClick={() => setStudyMode('cycles')}>
    反復（区画×周回）
  </button>
</div>
{studyMode === 'cycles' && (
  <>
    <div>
      <label htmlFor="book-total-units">全区画数</label>
      <input id="book-total-units" data-testid="book-total-units" type="number" inputMode="numeric" min={1} value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} placeholder="例: 20" />
    </div>
    <div>
      <label htmlFor="book-target-rounds">目標周回</label>
      <input id="book-target-rounds" data-testid="book-target-rounds" type="number" inputMode="numeric" min={1} value={targetRounds} onChange={(e) => setTargetRounds(e.target.value)} placeholder="例: 3" />
    </div>
    <div>
      <label htmlFor="book-initial-units">すでに終わった区画数</label>
      <input id="book-initial-units" data-testid="book-initial-units" type="number" inputMode="numeric" min={0} value={initialUnits} onChange={(e) => setInitialUnits(e.target.value)} placeholder="例: 20" />
    </div>
  </>
)}
```

- [ ] **ステップ4: テストを実行し成功を確認する**

実行: `cmd /c "npm run test -- --run src/screens/BookFormScreen.test.tsx"`
期待: PASS

- [ ] **ステップ5: コミットする**

```bash
git add src/screens/BookFormScreen.tsx src/screens/BookFormScreen.test.tsx
git commit -m "feat: add cycle mode inputs to book form"
```

---

### タスク4: 詳細画面の反復表示・記録CRUD

**ファイル:**
- 変更: `src/screens/BookDetailScreen.tsx`
- テスト: `src/screens/BookDetailScreen.test.tsx`（追記）

**入出力:**
- 使うもの: タスク1の計算関数、タスク2の `useCycleRecords`。
- 作るもの: なし（末端画面）。

- [ ] **ステップ1: 失敗テストを書く**

```typescript
it('反復の進捗を表示し範囲＋周回を記録できる', async () => {
  await db.books.add({
    ...book,
    totalPages: 576,
    studyMode: 'cycles',
    totalUnits: 20,
    targetRounds: 3,
    startDate: daysFromNow(0),
    deadline: daysFromNow(6),
  })
  render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
  // 総量 60、残り 60 / 6日 = 10区画/日
  expect(await screen.findByTestId('cycle-summary')).toHaveTextContent('今1周目')
  expect(screen.getByTestId('today-target')).toHaveTextContent('10')
  fireEvent.change(screen.getByTestId('cycle-from'), { target: { value: '1' } })
  fireEvent.change(screen.getByTestId('cycle-to'), { target: { value: '4' } })
  fireEvent.change(screen.getByTestId('cycle-round'), { target: { value: '1' } })
  fireEvent.click(screen.getByTestId('cycle-record'))
  await waitFor(() => expect(screen.getByTestId('cycle-summary')).toHaveTextContent('4 / 60'))
})

it('From＞To の範囲は拒否する', async () => {
  await db.books.add({
    ...book,
    studyMode: 'cycles',
    totalUnits: 20,
    targetRounds: 3,
    startDate: daysFromNow(0),
    deadline: daysFromNow(6),
  })
  render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
  fireEvent.change(await screen.findByTestId('cycle-from'), { target: { value: '5' } })
  fireEvent.change(screen.getByTestId('cycle-to'), { target: { value: '2' } })
  fireEvent.click(screen.getByTestId('cycle-record'))
  expect(screen.getByTestId('cycle-error')).toHaveTextContent(/範囲/)
})
```

- [ ] **ステップ2: テストを実行し失敗を確認する**

実行: `cmd /c "npm run test -- --run src/screens/BookDetailScreen.test.tsx"`
期待: FAIL（`cycle-summary` が見つからない）

- [ ] **ステップ3: 通るための最小実装を書く**

import に追加する：

```typescript
import {
  calcCycleDonePairs,
  calcCycleDailyTarget,
  cycleGrandTotal,
  currentCycleRound,
  daysBetween as daysBetweenFn,
} from '../lib/progress'
```

（`daysBetween` が既存importにあればそれを使い、重複importは作らない。）

`useCycleRecords(book.id)` から `cycleRecords, addCycle, updateCycle, removeCycle` を取得する。反復モード分岐の最小構成：

```tsx
if (book.studyMode === 'cycles') {
  const total = cycleGrandTotal(book)
  const done = calcCycleDonePairs(book, cycleRecords.filter((r) => r.bookId === book.id))
  const round = currentCycleRound(book, cycleRecords.filter((r) => r.bookId === book.id))
  const target = calcCycleDailyTarget(book, done, daysBetween(today, book.deadline))
  // ...記録フォーム（cycle-from / cycle-to / cycle-round / cycle-date）と
  // 一覧（cycle-row-*）、エラー（cycle-error）、概要（cycle-summary）を描画する。
  // 既存ページ用の done-count・グラフ・記録一覧ブロックはこの分岐では描画しない。
}
```

記録追加の検証（ボタンハンドラ内）：

```typescript
const from = Number(cycleFrom)
const to = Number(cycleTo)
const roundNum = Number(cycleRoundInput)
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > (book.totalUnits ?? 0)) {
  setCycleError('区画の範囲を正しく入力してください')
  return
}
if (!Number.isInteger(roundNum) || roundNum < 1 || roundNum > (book.targetRounds ?? 0)) {
  setCycleError('周回は1〜目標周回の範囲で入力してください')
  return
}
await addCycle({ id: crypto.randomUUID(), bookId: book.id, date: cycleDate || today, unitFrom: from, unitTo: to, round: roundNum })
```

概要の文言は `完了パス {done} / {total}（全{totalUnits}区画×{targetRounds}周）・今{round}周目` とし、`data-testid="cycle-summary"` を付ける。今日の目標の `data-testid="today-target"` は既存と同じtestidで区画数を出す（ページ／区画の混同を避けるため単位ラベルに「区画」を付ける）。一覧行のtestidは `cycle-row-{id}`、編集・削除に `updateCycle`・`removeCycle` を使う。日付範囲外（開始日〜期限日以外）は警告文のみ表示し記録は許可する。

- [ ] **ステップ4: テストを実行し成功を確認する**

実行: `cmd /c "npm run test -- --run src/screens/BookDetailScreen.test.tsx"`
期待: PASS

- [ ] **ステップ5: コミットする**

```bash
git add src/screens/BookDetailScreen.tsx src/screens/BookDetailScreen.test.tsx
git commit -m "feat: show and record cycle progress on detail screen"
```

---

### タスク5: ホーム表示＋全体診断の除外

**ファイル:**
- 変更: `src/screens/HomeScreen.tsx`
- 変更: `src/lib/progress.ts`（`overallDiagnosis` の1行）
- テスト: `src/screens/HomeScreen.test.tsx`（追記）、`src/lib/progress.test.ts`（1件追記）

**入出力:**
- 使うもの: タスク1の関数。
- 作るもの: なし（表示のみ）。

- [ ] **ステップ1: 失敗テストを書く**

`src/lib/progress.test.ts` に追加：

```typescript
it('反復本を残りページから除外する', () => {
  const books = [
    makeBook({ id: 'b1', totalPages: 100, deadline: '2026-02-11' }),
    makeBook({ id: 'b2', totalPages: 576, studyMode: 'cycles', totalUnits: 20, targetRounds: 3, deadline: '2026-02-11' }),
  ]
  const d = overallDiagnosis(books, [], '2026-01-11')
  expect(d.remainingPages).toBe(100)
})
```

`src/screens/HomeScreen.test.tsx` に追加（登録・解決パターンは既存テストを流用）：

```typescript
it('反復本の進捗を区画単位で表示する', async () => {
  // 反復本を登録し、ホーム行に「区画」と「今○周目」が出ること
  const now = new Date().toISOString()
  await db.books.add({
    id: 'cycle-1',
    title: '反復本',
    totalPages: 576,
    studyMode: 'cycles',
    totalUnits: 20,
    targetRounds: 3,
    startDate: '2026-09-01',
    deadline: '2026-12-31',
    createdAt: now,
    updatedAt: now,
  })
  render(<HomeScreen onOpenBook={() => {}} />)
  expect(await screen.findByText(/区画/)).toBeInTheDocument()
})
```

- [ ] **ステップ2: テストを実行し失敗を確認する**

実行: `cmd /c "npm run test -- --run src/lib/progress.test.ts src/screens/HomeScreen.test.tsx"`
期待: FAIL（診断が676を返す／「区画」文言がない）

- [ ] **ステップ3: 通るための最小実装を書く**

`overallDiagnosis` の残り集計を1行変更する：

```typescript
const remainingPages = books
  .filter((b) => b.studyMode !== 'cycles')
  .reduce((sum, b) => sum + Math.max(b.totalPages - calcTotalDone(b, records), 0), 0)
```

`HomeScreen.tsx` の `ScheduleRow` 内：`registered.studyMode === 'cycles'` の場合、`done` の代わりに当該bookの `cycleRecords` 由来の完了パス・総量・今周回・1日あたり区画数を表示する。`cycleRecords` は `useCycleRecords()`（引数なし＝全件）で取得し、`records` とは別変数で扱う。進捗バーの分母は総量（区画パス）、ステータス判定 `calcScheduleStatus` には `{ totalPages: 総量 }` と完了パス数を渡す（ページ換算はしない）。行内の単位文言は「○区画」とする。

- [ ] **ステップ4: テストを実行し成功を確認する**

実行: `cmd /c "npm run test -- --run src/lib/progress.test.ts src/screens/HomeScreen.test.tsx"`
期待: PASS

- [ ] **ステップ5: コミットする**

```bash
git add src/screens/HomeScreen.tsx src/lib/progress.ts src/lib/progress.test.ts src/screens/HomeScreen.test.tsx
git commit -m "feat: show cycle progress on home and exclude from diagnosis"
```

---

### タスク6: 今日の計画の別枠＋AI除外＋全緑化

**ファイル:**
- 変更: `src/screens/TodayPlanScreen.tsx`
- 変更: `src/screens/ChatScreen.tsx`
- テスト: `src/screens/TodayPlanScreen.test.tsx`（追記、既存パターン流用）

**入出力:**
- 使うもの: タスク1・2。
- 作るもの: 完成機能。

- [ ] **ステップ1: 失敗テストを書く**

```typescript
it('反復本を1日あたり区画数つきで別枠表示する', async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'cycle-1',
    title: '反復本',
    totalPages: 576,
    studyMode: 'cycles',
    totalUnits: 20,
    targetRounds: 3,
    startDate: '2026-09-01',
    deadline: '2026-12-31',
    createdAt: now,
    updatedAt: now,
  })
  render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} />)
  expect(await screen.findByTestId('cycle-today-list')).toHaveTextContent('反復本')
})
```

- [ ] **ステップ2: テストを実行し失敗を確認する**

実行: `cmd /c "npm run test -- --run src/screens/TodayPlanScreen.test.tsx"`
期待: FAIL（`cycle-today-list` が見つからない）

- [ ] **ステップ3: 通るための最小実装を書く**

`TodayPlanScreen.tsx`：時間割に渡す本から反復本を除外する：

```typescript
const pageBooks = books.filter((b) => b.studyMode !== 'cycles')
const cycleBooks = books.filter((b) => b.studyMode === 'cycles')
```

`doneByBook` は `pageBooks` ベースに切り替えるだけ（反復本は対象外になったため初期値の変更は不要）。`generateDayPlan` には `pageBooks` 由来の予定を渡す。`data-testid="cycle-today-list"` の別枠セクションを追加し、各反復本について `calcCycleDailyTarget(book, 完了パス, daysBetween(today, book.deadline))` を「今日やる区画 ○区画」として表示する（完了パスは `useCycleRecords()` 全件から当該book分を `calcCycleDonePairs` で算出）。

`ChatScreen.tsx`：`loadReport` 内でレポート対象から反復本を除外する：

```typescript
const targetBooks = allBooks.filter((b) => b.studyMode !== 'cycles')
const donePagesByBook = Object.fromEntries(
  targetBooks.map((b) => [b.id, calcTotalDone(b, allRecords)]),
)
return buildAdvisorReport({ today, books: targetBooks, donePagesByBook, availability })
```

- [ ] **ステップ4: 全テストが緑であることを確認する**

実行: `cmd /c "npm run test -- --run"`
期待: PASS（全ファイル緑）。続けて `cmd /c "npx tsc --noEmit"` が無出力であること。

- [ ] **ステップ5: コミットしてプッシュする**

```bash
git add src/screens/TodayPlanScreen.tsx src/screens/TodayPlanScreen.test.tsx src/screens/ChatScreen.tsx
git commit -m "feat: separate cycle quota on today plan and exclude from AI"
git push origin main
```

（プッシュはスマホ反映のための運用ルール。デプロイはmainへのプッシュで自動実行される。）

---

## 自己レビュー

- 仕様カバー: §1→タスク1・2、§2→タスク3・4・5（ホーム）、§3→タスク5（診断）・タスク6（時間割・AI・対象外）、§4→タスク2（移行・バックアップ）・各タスクの検証・テスト。仕様の全要件に対応するタスクがある。
- プレースホルダ検査: 「適切に」「同様に」等の丸投げ表現なし。各ステップに実コード・実コマンド・期待結果を記載した。
- 型一貫性: `CycleRecordData`、`calcCycleDonePairs(book, records)`、`cycleGrandTotal`、`calcCycleDailyTarget`、`currentCycleRound`、`expandCyclePairs`、`listCycleRecords/addCycleRecord/updateCycleRecord/deleteCycleRecord`、`useCycleRecords` の名前・引数順は全タスクで統一した。testid（`book-mode-cycles`、`cycle-summary`、`cycle-today-list` 等）はタスク間で重複なく一貫している。
