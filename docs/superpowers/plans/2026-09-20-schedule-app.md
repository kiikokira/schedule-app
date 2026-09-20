# 参考書スケジュール管理アプリ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参考書の進捗を記録し「今日の目標ページ数」を自動計算して見える化する、iPhone 向け PWA を構築する。

**Architecture:** サーバーレスのフロントエンドのみ。React + TypeScript + Vite（PWA プラグイン）で作る SPA。データは Dexie.js（IndexedDB）へ端末内保存。参考書の追加は Google Books API（ブラウザから直接・CORS対応・キー不要）の検索から自動入力、ヒットしない場合は手入力でフォールバック。完成後は GitHub Pages に公開し、iPhone の Safari でホーム画面追加して利用する。

**Tech Stack:** React 18 / TypeScript 5 / Vite 5 / vite-plugin-pwa / Dexie.js 4 / Chart.js（折れ線グラフ）/ Vitest + React Testing Library / GitHub Pages（`gh-pages` デプロイ）

**Spec:** `docs/superpowers/specs/2026-09-20-schedule-app-design.md`

## Global Constraints

- iPhone 13 の Safari を保証対象にする。日本語 UI のテキストはコピー可。
- 画面サイズはスマホ縦持ち想定（幅 390px 基準）で操作しやすい大きさのボタン。
- ページ数は 1 以上の整数（`totalPages`、進捗記録の `pages` とも）。
- 1 つの参考書・日付の進捗記録は最大 1 件（同日は上書き）。
- 期限は開始日より後の日付でなければならない。
- データは端末内のみ。アカウント・サーバー同期・プッシュ通知は作らない。
- 依存ライブラリは本計画に記載されたもののみを追加する。
- コードにコメントは書かない（自動生成の定形コメント除く）。
- 毎タスク終了時に git コミットする。

---

### Task 1: Vite プロジェクトの雛形とテスト基盤

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/vite-env.d.ts`
- Create: `test/setup.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: なし（初期構築）
- Produces: `npm run dev` / `npm run build` / `npm test` が動作する基盤。後続タスクは `src/App.tsx` と `src/` 配下にファイルを追加する。

- [ ] **Step 1: 依存を定義した package.json を作成**

```json
{
  "name": "schedule-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chart.js": "^4.4.3",
    "dexie": "^4.0.8",
    "react": "^18.3.1",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vite-plugin-pwa": "^0.20.1",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: vite.config.ts を作成（vitest 設定と PWA は後続タスクで追加）**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
```

- [ ] **Step 3: tsconfig.json を作成**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

- [ ] **Step 4: index.html を作成（最終的に PWA で「ホーム画面に追加」可能にするため lang・viewport を設定）**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#2563eb" />
    <title>スケジュール管理</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: .gitignore を作成**

```gitignore
node_modules/
dist/
*.local
.DS_Store
```

- [ ] **Step 6: 最小の src/main.tsx / src/App.tsx / src/vite-env.d.ts を作成**

`src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`src/App.tsx`:

```tsx
export default function App() {
  return <div>スケジュール管理</div>
}
```

`src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 7: テストセットアップを作成**

`test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

// jsdom には IndexedDB が無いため、fake-indexeddb で代替する
import 'fake-indexeddb/auto'

// jsdom には Canvas が無いため、グラフ描画はダミーに差し替える
vi.mock('react-chartjs-2', () => ({
  Line: function LineMock(props: { children?: ReactNode }) {
    return <div data-testid="line-mock">{props.children}</div>
  },
}))

// vite-plugin-pwa の仮想モジュールは vitest では解決されないためモックする
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn().mockResolvedValue({}),
}))
```

- [ ] **Step 8: 失敗テストを作成**

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

it('renders app title', () => {
  render(<App />)
  expect(screen.getByText('スケジュール管理')).toBeInTheDocument()
})
```

- [ ] **Step 9: テストを実行して失敗を確認**

Run: `npm test`
Expected: 成功（`App` がタイトルを表示するため PASS）。タイトル未実装なら FAIL してから実装する。

- [ ] **Step 10: 動作確認**

Run: `npm run dev` を起動せず、`npm run build` でビルド成功を確認。
Expected: `tsc -b` と `vite build` が成功し、`dist/` が生成される。

- [ ] **Step 11: コミット**

```bash
git add .
git commit -m "feat: scaffold vite react project with test setup"
```

---

### Task 2: 目標計算ロジック（純粋関数）

**Files:**
- Create: `src/lib/progress.ts`
- Test: `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: なし（純粋関数）
- Produces:
  - `type BookData = { id: string; title: string; subject?: string; totalPages: number; coverUrl?: string; startDate: string; deadline: string; createdAt: string; updatedAt: string }`
  - `type ProgressRecordData = { id: string; bookId: string; date: string; pages: number }`
  - `calcDonePages(records: ProgressRecordData[], bookId: string): number`  — 指定参考書の累計ページ
  - `todayStr(now?: Date): string` — `yyyy-MM-dd` 形式（ローカル日付）
  - `daysBetween(from: string, to: string): number` — `from` から `to` までの日数（境界含む、`deadline - today` を意図）
  - `calcDailyTarget(book: { totalPages: number }, done: number, remainingDays: number): number` — ⌈残り ÷ 残り日数⌉（`remainingDays <= 0` なら `remaining`）
  - `calcScheduleStatus(book: { totalPages: number; startDate: string; deadline: string }, done: number, today: string): 'scheduled' | 'behind' | 'done'`
  - 日付の唯一の正規化・書式関数 `formatDate(d: Date): string` / `parseDate(s: string): Date`

- [ ] **Step 1: 失敗テストを作成**

`src/lib/progress.test.ts`（日付はローカルタイムゾーンで生成するため `new Date(2026, 0, 5)` を使う）

```typescript
import { describe, it, expect } from 'vitest'
import {
  formatDate,
  parseDate,
  todayStr,
  daysBetween,
  calcDailyTarget,
  calcScheduleStatus,
  calcDonePages,
  type BookData,
  type ProgressRecordData,
} from './progress'

const makeBook = (overrides: Partial<BookData> = {}): BookData => ({
  id: 'b1',
  title: '単語帳',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('formatDate / parseDate / todayStr', () => {
  it('formats local date as yyyy-MM-dd', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('parses yyyy-MM-dd to local date', () => {
    const d = parseDate('2026-01-05')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(5)
  })
  it('todayStr returns 10-char date', () => {
    expect(todayStr(new Date(2026, 2, 3))).toBe('2026-03-03')
  })
})

describe('daysBetween', () => {
  it('counts inclusive days from today to deadline', () => {
    expect(daysBetween('2026-01-05', '2026-01-11')).toBe(6)
  })
  it('returns 0 when deadline equals today', () => {
    expect(daysBetween('2026-01-05', '2026-01-05')).toBe(0)
  })
  it('returns negative when deadline passed', () => {
    expect(daysBetween('2026-01-10', '2026-01-05')).toBe(-5)
  })
})

describe('calcDailyTarget', () => {
  it('divides remaining pages by remaining days, rounding up', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 40, 6)).toBe(10) // 60/6
  })
  it('rounds up fractional target', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 97, 6)).toBe(1) // 3/6 -> 0.5 -> 1
  })
  it('returns full remaining when days <= 0', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 90, 0)).toBe(10)
    expect(calcDailyTarget({ totalPages: 100 }, 90, -3)).toBe(10)
  })
  it('returns 0 when book finished', () => {
    expect(calcDailyTarget({ totalPages: 100 }, 100, 6)).toBe(0)
  })
})

describe('calcScheduleStatus', () => {
  it('is done when done >= totalPages', () => {
    const book = makeBook({ totalPages: 100 })
    expect(calcScheduleStatus(book, 100, '2026-01-05')).toBe('done')
  })
  it('is behind when behind expected pace', () => {
    // 全体 10 日(1/1-1/11) の 5 日目(1/5)。予定 50 ページ。実績 30。
    const book = makeBook({ totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
    expect(calcScheduleStatus(book, 30, '2026-01-05')).toBe('behind')
  })
  it('is scheduled when on/above expected pace', () => {
    const book = makeBook({ totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
    expect(calcScheduleStatus(book, 50, '2026-01-05')).toBe('scheduled')
    expect(calcScheduleStatus(book, 60, '2026-01-05')).toBe('scheduled')
  })
  it('is scheduled when deadline not reached and done is 0 early on', () => {
    const book = makeBook({ totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
    expect(calcScheduleStatus(book, 0, '2026-01-01')).toBe('scheduled')
  })
})

describe('calcDonePages', () => {
  it('sums pages for the given book only', () => {
    const records: ProgressRecordData[] = [
      { id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 10 },
      { id: 'r2', bookId: 'b1', date: '2026-01-06', pages: 20 },
      { id: 'r3', bookId: 'b2', date: '2026-01-05', pages: 99 },
    ]
    expect(calcDonePages(records, 'b1')).toBe(30)
  })
  it('returns 0 when no records', () => {
    expect(calcDonePages([], 'b1')).toBe(0)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（モジュール未作成のため）

- [ ] **Step 3: 実装**

`src/lib/progress.ts`:

```typescript
export type BookData = {
  id: string
  title: string
  subject?: string
  totalPages: number
  coverUrl?: string
  startDate: string
  deadline: string
  createdAt: string
  updatedAt: string
}

export type ProgressRecordData = {
  id: string
  bookId: string
  date: string
  pages: number
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(now: Date = new Date()): string {
  return formatDate(now)
}

export function daysBetween(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function calcDonePages(records: ProgressRecordData[], bookId: string): number {
  return records
    .filter((r) => r.bookId === bookId)
    .reduce((sum, r) => sum + r.pages, 0)
}

export function calcDailyTarget(
  book: { totalPages: number },
  done: number,
  remainingDays: number,
): number {
  const remaining = Math.max(book.totalPages - done, 0)
  if (remainingDays <= 0) return remaining
  if (remaining <= 0) return 0
  return Math.ceil(remaining / remainingDays)
}

export function calcScheduleStatus(
  book: { totalPages: number; startDate: string; deadline: string },
  done: number,
  today: string,
): 'scheduled' | 'behind' | 'done' {
  if (done >= book.totalPages) return 'done'
  const totalDays = daysBetween(book.startDate, book.deadline)
  const elapsed = daysBetween(book.startDate, today)
  if (totalDays <= 0) return 'behind'
  const expected = Math.round((book.totalPages * elapsed) / totalDays)
  if (done < expected) return 'behind'
  return 'scheduled'
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat: add progress calculation pure logic"
```

---

### Task 3: Dexie データ層

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/backup.ts`
- Test: `src/db/backup.test.ts`
- Test: `src/db/database.test.ts`

**Interfaces:**
- Consumes: `BookData`, `ProgressRecordData`（Task 2）
- Produces:
  - `db`（Dexie インスタンス、`books`・`records` の2テーブル）
  - `upsertProgress(bookId: string, date: string, pages: number): Promise<ProgressRecordData>`
    — 既存の同日記録があれば上書き（`bookId+date` 一意）
  - `deleteBookCascade(bookId: string): Promise<void>` — 参考書とその進捗を削除
  - ```ts
    type BackupData = { exportedAt: string; books: BookData[]; records: ProgressRecordData[] }
    exportBackup(): Promise<BackupData>
    importBackup(data: BackupData): Promise<{ books: number; records: number }>
    validateBackup(data: unknown): data is BackupData
    ```

- [ ] **Step 1: 失敗テスト（backup 検証）を作成**

`src/db/backup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateBackup } from './backup'

const book = {
  id: 'b1',
  title: '単語帳',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const record = { id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 10 }

it('accepts a well-formed backup', () => {
  const data: unknown = { exportedAt: '2026-01-05T00:00:00.000Z', books: [book], records: [record] }
  expect(validateBackup(data)).toBe(true)
})

it('rejects missing records array', () => {
  const data = { exportedAt: '2026-01-05T00:00:00.000Z', books: [book] }
  expect(validateBackup(data)).toBe(false)
})

it('rejects books with invalid page count', () => {
  const data = { exportedAt: '2026-01-05T00:00:00.000Z', books: [{ ...book, totalPages: 0 }], records: [] }
  expect(validateBackup(data)).toBe(false)
})

it('rejects records referencing missing book', () => {
  const data = { exportedAt: '2026-01-05T00:00:00.000Z', books: [], records: [record] }
  expect(validateBackup(data)).toBe(false)
})
```

- [ ] **Step 2: database の失敗テストを作成**

`src/db/database.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { db, upsertProgress, deleteBookCascade, type DexieBook } from './database'

const book: DexieBook = {
  id: 'b1',
  title: '単語帳',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
})

describe('upsertProgress', () => {
  it('creates a record when none exists for the day', async () => {
    const rec = await upsertProgress('b1', '2026-01-05', 10)
    expect(rec.pages).toBe(10)
    const all = await db.records.where('bookId').equals('b1').toArray()
    expect(all).toHaveLength(1)
  })
  it('overwrites the same-day record', async () => {
    await upsertProgress('b1', '2026-01-05', 10)
    await upsertProgress('b1', '2026-01-05', 15)
    const all = await db.records.where('bookId').equals('b1').toArray()
    expect(all).toHaveLength(1)
    expect(all[0].pages).toBe(15)
  })
})

describe('deleteBookCascade', () => {
  it('deletes the book and its records', async () => {
    await db.books.add(book)
    await upsertProgress('b1', '2026-01-05', 10)
    await deleteBookCascade('b1')
    expect(await db.books.get('b1')).toBeUndefined()
    const records = await db.records.toArray()
    expect(records).toHaveLength(0)
  })
})
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npm test src/db`
Expected: FAIL（モジュール未作成）

- [ ] **Step 4: `src/db/database.ts` を実装**

```typescript
import Dexie, { type Table } from 'dexie'
import type { BookData, ProgressRecordData } from '../lib/progress'

export type DexieBook = BookData
export type DexieRecord = ProgressRecordData

class ScheduleDB extends Dexie {
  books!: Table<DexieBook, string>
  records!: Table<DexieRecord, string>

  constructor() {
    super('schedule-app')
    this.version(1).stores({
      books: 'id, deadline, startDate',
      records: 'id, bookId, [bookId+date]',
    })
  }
}

export const db = new ScheduleDB()

export async function upsertProgress(
  bookId: string,
  date: string,
  pages: number,
): Promise<ProgressRecordData> {
  const existing = await db.records.where('[bookId+date]').equals([bookId, date]).first()
  if (existing) {
    await db.records.update(existing.id, { pages })
    return { ...existing, pages }
  }
  const id = crypto.randomUUID()
  const record: ProgressRecordData = { id, bookId, date, pages }
  await db.records.add(record)
  return record
}

export async function deleteBookCascade(bookId: string): Promise<void> {
  await db.transaction('rw', db.books, db.records, async () => {
    await db.records.where('bookId').equals(bookId).delete()
    await db.books.delete(bookId)
  })
}
```

- [ ] **Step 5: `src/db/backup.ts` を実装**

```typescript
import { db } from './database'
import type { BookData, ProgressRecordData } from '../lib/progress'

export type BackupData = {
  exportedAt: string
  books: BookData[]
  records: ProgressRecordData[]
}

export async function exportBackup(): Promise<BackupData> {
  return {
    exportedAt: new Date().toISOString(),
    books: await db.books.toArray(),
    records: await db.records.toArray(),
  }
}

export function validateBackup(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Partial<BackupData>
  if (typeof d.exportedAt !== 'string') return false
  if (!Array.isArray(d.books) || !Array.isArray(d.records)) return false
  const bookIds = new Set<string>()
  for (const b of d.books) {
    if (!b || typeof b.id !== 'string') return false
    if (typeof b.title !== 'string') return false
    if (typeof b.totalPages !== 'number' || b.totalPages < 1) return false
    if (typeof b.startDate !== 'string' || typeof b.deadline !== 'string') return false
    bookIds.add(b.id)
  }
  for (const r of d.records) {
    if (!r || typeof r.id !== 'string') return false
    if (typeof r.bookId !== 'string' || !bookIds.has(r.bookId)) return false
    if (typeof r.date !== 'string' || typeof r.pages !== 'number' || r.pages < 1) return false
  }
  return true
}

export async function importBackup(
  data: BackupData,
): Promise<{ books: number; records: number }> {
  await db.transaction('rw', db.books, db.records, async () => {
    await db.books.clear()
    await db.records.clear()
    await db.books.bulkAdd(data.books)
    await db.records.bulkAdd(data.records)
  })
  return { books: data.books.length, records: data.records.length }
}
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/db/database.ts src/db/backup.ts src/db/backup.test.ts src/db/database.test.ts
git commit -m "feat: add dexie data layer and backup"
```

---

### Task 4: Google Books 検索クライアント

**Files:**
- Create: `src/api/googleBooks.ts`
- Test: `src/api/googleBooks.test.ts`

**Interfaces:**
- Consumes: なし（外部APIクライアント）
- Produces:
  - ```ts
    type SearchResultItem = { id: string; title: string; authors: string[]; pageCount: number | null; thumbnail: string | null }
    searchBooks(query: string, limit?: number, fetchImpl?: typeof fetch): Promise<SearchResultItem[]>
    ```
  - `fetchImpl` はテストで HTTP をモックするための注入引数（既定は `fetch`）。

- [ ] **Step 1: 失敗テストを作成**

`src/api/googleBooks.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { searchBooks, type SearchResultItem } from './googleBooks'

const mockJson = {
  totalItems: 1,
  items: [
    {
      id: 'vol1',
      volumeInfo: {
        title: '英単語1000',
        authors: ['太郎'],
        pageCount: 320,
        imageLinks: { thumbnail: 'http://t.co/x' },
      },
    },
    {
      id: 'vol2',
      volumeInfo: {
        title: '英熟語500',
      },
    },
  ],
}

it('returns mapped result items with nullable fields', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockJson,
  })
  const result = await searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)
  expect(result).toEqual([
    { id: 'vol1', title: '英単語1000', authors: ['太郎'], pageCount: 320, thumbnail: 'http://t.co/x' },
    { id: 'vol2', title: '英熟語500', authors: [], pageCount: null, thumbnail: null },
  ] as SearchResultItem[])
})

it('throws a friendly error when network fails', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
  await expect(searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)).rejects.toThrow(
    '検索できませんでした',
  )
})

it('throws when response is not ok', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 })
  await expect(searchBooks('英単語', 10, fetchMock as unknown as typeof fetch)).rejects.toThrow(
    '検索できませんでした',
  )
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test src/api`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: `src/api/googleBooks.ts` を実装**

```typescript
export type SearchResultItem = {
  id: string
  title: string
  authors: string[]
  pageCount: number | null
  thumbnail: string | null
}

type VolumeInfo = {
  title?: string
  authors?: string[]
  pageCount?: number
  imageLinks?: { thumbnail?: string }
}

const API_URL = 'https://www.googleapis.com/books/v1/volumes'

export async function searchBooks(
  query: string,
  limit = 10,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchResultItem[]> {
  const url = `${API_URL}?q=${encodeURIComponent(query)}&maxResults=${limit}&langRestrict=ja`
  let res: Response
  try {
    res = await fetchImpl(url)
  } catch {
    throw new Error('検索できませんでした')
  }
  if (!res.ok) throw new Error('検索できませんでした')
  const data = (await res.json()) as unknown as {
    items?: { id?: string; volumeInfo?: VolumeInfo }[]
  }
  if (!Array.isArray(data.items)) return []
  return data.items
    .filter((item) => item.volumeInfo && item.id)
    .map((item) => {
      const info = item.volumeInfo as VolumeInfo
      return {
        id: item.id as string,
        title: info.title ?? '(タイトルなし)',
        authors: info.authors ?? [],
        pageCount: typeof info.pageCount === 'number' ? info.pageCount : null,
        thumbnail: info.imageLinks?.thumbnail ?? null,
      }
    })
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test src/api`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/api/googleBooks.ts src/api/googleBooks.test.ts
git commit -m "feat: add google books search client"
```

---

### Task 5: 状態管理とカスタムフック

**Files:**
- Create: `src/hooks/useBooks.ts`
- Create: `src/hooks/useRecords.ts`

**Interfaces:**
- Consumes: `db`（Task 3）、`deleteBookCascade`（Task 3）
- Produces:
  - `useBooks(): { books: BookData[]; saveBook(book: BookData, isNew: boolean): Promise<void>; removeBook(bookId: string): Promise<void> }`
  - `useRecords(): { records: ProgressRecordData[]; addProgress(bookId: string, date: string, pages: number): Promise<void>; refresh(): Promise<void> }`

- [ ] **Step 1: `src/hooks/useBooks.ts` を実装**

```typescript
import { useCallback, useEffect, useState } from 'react'
import { db, deleteBookCascade } from '../db/database'
import type { BookData } from '../lib/progress'

export function useBooks() {
  const [books, setBooks] = useState<BookData[]>([])

  const refresh = useCallback(async () => {
    setBooks(await db.books.orderBy('deadline').toArray())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveBook = useCallback(async (book: BookData, isNew: boolean) => {
    if (isNew) {
      await db.books.add(book)
    } else {
      await db.books.update(book.id, book)
    }
    await refresh()
  }, [refresh])

  const removeBook = useCallback(async (bookId: string) => {
    await deleteBookCascade(bookId)
    await refresh()
  }, [refresh])

  return { books, refresh, saveBook, removeBook }
}
```

- [ ] **Step 2: `src/hooks/useRecords.ts` を実装**

```typescript
import { useCallback, useEffect, useState } from 'react'
import { db, upsertProgress } from '../db/database'
import type { ProgressRecordData } from '../lib/progress'

export function useRecords() {
  const [records, setRecords] = useState<ProgressRecordData[]>([])

  const refresh = useCallback(async () => {
    setRecords(await db.records.toArray())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addProgress = useCallback(
    async (bookId: string, date: string, pages: number) => {
      await upsertProgress(bookId, date, pages)
      await refresh()
    },
    [refresh],
  )

  return { records, refresh, addProgress }
}
```

- [ ] **Step 3: ビルドで型チェック**

Run: `npm run build`
Expected: 成功（型チェック通過）

- [ ] **Step 4: コミット**

```bash
git add src/hooks/useBooks.ts src/hooks/useRecords.ts
git commit -m "feat: add state management hooks"
```

---

### Task 6: 参考書一覧画面（ホーム）

**Files:**
- Create: `src/components/BookCard.tsx`
- Create: `src/screens/HomeScreen.tsx`
- Test: `src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `useBooks`（Task 5）、`useRecords`（Task 5）、`calcDonePages`, `calcDailyTarget`, `calcScheduleStatus`, `daysBetween`, `todayStr`, `BookData`, `ProgressRecordData`（Task 2）
- Produces:
  - `BookCard({ book, done, records, onOpen }: { book: BookData; done: number; records: ProgressRecordData[]; onOpen: (id: string) => void })`
  - `HomeScreen({ onOpenBook }: { onOpenBook: (id: string) => void })` — カードをクリックで詳細へ

- [ ] **Step 1: 失敗テストを作成**

`src/screens/HomeScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import HomeScreen from './HomeScreen'

const book = {
  id: 'b1',
  title: '英単語1000',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
})

it('shows book title and today target on the card', async () => {
  await db.books.add(book)
  render(<HomeScreen onOpenBook={() => {}} />)
  expect(await screen.findByText('英単語1000')).toBeInTheDocument()
})

it('shows 遅れ status when behind pace', async () => {
  await db.books.add({ ...book, totalPages: 100 })
  await db.records.add({ id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 10 })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-05T09:00:00'))
  render(<HomeScreen onOpenBook={() => {}} />)
  const card = await screen.findByTestId('book-card-b1')
  expect(card).toHaveTextContent('遅れ')
  vi.useRealTimers()
})

it('calls onOpenBook when card clicked', async () => {
  await db.books.add(book)
  const onOpen = vi.fn()
  render(<HomeScreen onOpenBook={onOpen} />)
  const card = await screen.findByTestId('book-card-b1')
  card.click()
  expect(onOpen).toHaveBeenCalledWith('b1')
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test src/screens`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 3: `src/components/BookCard.tsx` を実装**

```tsx
import type { BookData, ProgressRecordData } from '../lib/progress'
import { calcDonePages, calcDailyTarget, daysBetween, todayStr, calcScheduleStatus } from '../lib/progress'

type Props = {
  book: BookData
  records: ProgressRecordData[]
  onOpen: (id: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  done: '完了',
  behind: '遅れ',
  scheduled: '順調',
}

export default function BookCard({ book, records, onOpen }: Props) {
  const done = calcDonePages(records, book.id)
  const remaining = Math.max(book.totalPages - done, 0)
  const remainingDays = daysBetween(todayStr(), book.deadline)
  const target = calcDailyTarget(book, done, remainingDays)
  const status = calcScheduleStatus(book, done, todayStr())
  const progress = book.totalPages > 0 ? (done / book.totalPages) * 100 : 0

  return (
    <button
      data-testid={`book-card-${book.id}`}
      onClick={() => onOpen(book.id)}
      className={`book-card ${status === 'behind' ? 'behind' : ''}`}
      style={{
        display: 'block',
        width: '100%',
        marginBottom: '12px',
        padding: '12px',
        textAlign: 'left',
        border: '1px solid #ddd',
        borderRadius: '8px',
        background: status === 'behind' ? '#fff0f0' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" width={56} height={80} style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ width: 56, height: 80, background: '#eee', borderRadius: 4 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{book.title}</div>
          <div>残り {remaining} ページ</div>
          <div>
            今日の目標 <strong>{target}</strong> ページ
          </div>
          <div>
            期限 {book.deadline}（残り{Math.max(remainingDays, 0)}日） / {STATUS_LABEL[status]}
          </div>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 8,
          borderRadius: 4,
          background: '#eee',
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: status === 'done' ? '#16a34a' : '#2563eb',
          }}
        />
      </div>
    </button>
  )
}
```

- [ ] **Step 4: `src/screens/HomeScreen.tsx` を実装**

```tsx
import BookCard from '../components/BookCard'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'

type Props = {
  onOpenBook: (id: string) => void
}

export default function HomeScreen({ onOpenBook }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>参考書スケジュール</h1>
      <p style={{ color: '#666' }}>
        今日の目標を毎日見て、参考書を期限内に終わらせよう。
      </p>
      {books.length === 0 ? (
        <p style={{ color: '#888' }}>参考書がありません。「＋」から追加してください。</p>
      ) : (
        books.map((book) => (
          <BookCard key={book.id} book={book} records={records} onOpen={onOpenBook} />
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm test src/screens`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/BookCard.tsx src/screens/HomeScreen.tsx src/screens/HomeScreen.test.tsx
git commit -m "feat: add home book list screen"
```

---

### Task 7: 参考書の追加・編集（検索＋手入力）

**Files:**
- Create: `src/screens/BookFormScreen.tsx`
- Test: `src/screens/BookFormScreen.test.tsx`

**Interfaces:**
- Consumes: `searchBooks`（Task 4）、`useBooks`（Task 5）、`BookData`・`todayStr`（Task 2）
- Produces:
  - `BookFormScreen({ book: BookData | null, onDone: () => void }: { book: BookData | null; onDone: () => void })`
    — `book === null` なら新規追加、そうでなければ編集。
  - フォーム要素の id は `book-title` `book-subject` `book-pages` `book-start` `book-deadline`。
  - 検索入力 id は `book-search-input`、検索実行ボタン id は `book-search-btn`。
  - 検索結果の追加ボタンはテキスト「追加」を持つ。保存を確定するボタンは id `book-save`。

- [ ] **Step 1: 失敗テストを作成**

`src/screens/BookFormScreen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BookFormScreen from './BookFormScreen'

beforeEach(() => {
  vi.restoreAllMocks()
})

it('validates required fields before save', async () => {
  render(<BookFormScreen book={null} onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('book-save'))
  expect(screen.getByTestId('book-error')).toHaveTextContent('タイトルを入力してください')
})

it('shows search results and fills page count when selected', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        {
          id: 'v1',
          volumeInfo: { title: '英単語1000', authors: ['Taro'], pageCount: 320, imageLinks: { thumbnail: 'http://t.co/x' } },
        },
      ],
    }),
  } as Response)

  render(<BookFormScreen book={null} onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('book-search-input'), { target: { value: '英単語' } })
  fireEvent.click(screen.getByTestId('book-search-btn'))
  expect(await screen.findByText('英単語1000')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '追加' }))
  expect((screen.getByTestId('book-title') as HTMLInputElement).value).toBe('英単語1000')
  expect((screen.getByTestId('book-pages') as HTMLInputElement).value).toBe('320')
})

it('validates page count is a positive integer', async () => {
  render(<BookFormScreen book={null} onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('book-title'), { target: { value: '単語帳' } })
  fireEvent.change(screen.getByTestId('book-pages'), { target: { value: 'abc' } })
  fireEvent.click(screen.getByTestId('book-save'))
  expect(screen.getByTestId('book-error')).toHaveTextContent(/ページ数/)
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test src/screens/BookFormScreen.test.tsx`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 3: `src/screens/BookFormScreen.tsx` を実装**

```tsx
import { useState } from 'react'
import { searchBooks, type SearchResultItem } from '../api/googleBooks'
import { useBooks } from '../hooks/useBooks'
import { todayStr, type BookData } from '../lib/progress'

type Props = {
  book: BookData | null
  onDone: () => void
}

export default function BookFormScreen({ book, onDone }: Props) {
  const { saveBook } = useBooks()
  const [title, setTitle] = useState(book?.title ?? '')
  const [subject, setSubject] = useState(book?.subject ?? '英語')
  const [totalPages, setTotalPages] = useState(book?.totalPages ? String(book.totalPages) : '')
  const [coverUrl, setCoverUrl] = useState<string | null>(book?.coverUrl ?? null)
  const [startDate, setStartDate] = useState(book?.startDate ?? todayStr())
  const [deadline, setDeadline] = useState(book?.deadline ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')

  const runSearch = async () => {
    if (!query.trim()) return
    setSearchError('')
    try {
      setResults(await searchBooks(query))
    } catch (e) {
      setResults([])
      setSearchError(e instanceof Error ? e.message : '検索できませんでした')
    }
  }

  const pickResult = (item: SearchResultItem) => {
    setTitle(item.title)
    if (item.pageCount) setTotalPages(String(item.pageCount))
    setCoverUrl(item.thumbnail)
  }

  const handleSave = async () => {
    setError('')
    if (!title.trim()) {
      setError('タイトルを入力してください')
      return
    }
    const pages = Number(totalPages)
    if (!Number.isInteger(pages) || pages < 1) {
      setError('ページ数は1以上の整数で入力してください')
      return
    }
    if (!deadline) {
      setError('期限日を入力してください')
      return
    }
    if (deadline <= startDate) {
      setError('期限は開始日より後を指定してください')
      return
    }
    const now = new Date().toISOString()
    const isNew = book === null
    const next: BookData = {
      id: book?.id ?? crypto.randomUUID(),
      title: title.trim(),
      subject: subject.trim() || undefined,
      totalPages: pages,
      coverUrl: coverUrl ?? undefined,
      startDate,
      deadline,
      createdAt: book?.createdAt ?? now,
      updatedAt: now,
    }
    await saveBook(next, isNew)
    onDone()
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>{book ? '参考書を編集' : '参考書を追加'}</h1>
      {book === null && (
        <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16 }}>本を検索して追加</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              data-testid="book-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="タイトルを入力"
            />
            <button data-testid="book-search-btn" type="button" onClick={() => void runSearch()}>
              検索
            </button>
          </div>
          {searchError && <p style={{ color: '#b91c1c' }}>{searchError}</p>}
          {results.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" width={40} height={56} />
              ) : (
                <div style={{ width: 40, height: 56, background: '#eee' }} />
              )}
              <div style={{ flex: 1 }}>
                <div>{item.title}</div>
                <div style={{ color: '#666', fontSize: 12 }}>
                  {item.pageCount ? `${item.pageCount}ページ` : 'ページ数不明'}
                </div>
              </div>
              <button type="button" onClick={() => pickResult(item)}>
                追加
              </button>
            </div>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="book-title">タイトル</label>
        <input id="book-title" data-testid="book-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-subject">科目</label>
        <input id="book-subject" data-testid="book-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-pages">総ページ数</label>
        <input id="book-pages" data-testid="book-pages" type="number" inputMode="numeric" value={totalPages} onChange={(e) => setTotalPages(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-start">開始日</label>
        <input id="book-start" data-testid="book-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div>
        <label htmlFor="book-deadline">期限日</label>
        <input id="book-deadline" data-testid="book-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      {error && <p data-testid="book-error" style={{ color: '#b91c1c' }}>{error}</p>}
      <button data-testid="book-save" type="button" onClick={() => void handleSave()}>
        {book ? '保存' : '登録する'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test src/screens/BookFormScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/screens/BookFormScreen.tsx src/screens/BookFormScreen.test.tsx
git commit -m "feat: add book add/edit screen with search"
```

---

### Task 8: 参考書詳細画面と進捗記録

**Files:**
- Create: `src/screens/BookDetailScreen.tsx`
- Create: `src/components/ProgressChart.tsx`
- Test: `src/screens/BookDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `useBooks`（Task 5）、`useRecords`（Task 5）、`calcDonePages`・`calcDailyTarget`・`daysBetween`・`todayStr`（Task 2）、Chart.js（`react-chartjs-2`）
- Produces:
  - `ProgressChart({ dates, values }: { dates: string[]; values: number[] })` — 日次ページ数の折れ線グラフ（`data-testid="progress-chart"`）
  - `BookDetailScreen({ bookId, onBack, onEdit }: { bookId: string; onBack: () => void; onEdit: (id: string) => void })` — 大きな「今日やったページ数を記録」ボタン、目標表示、グラフ

- [ ] **Step 1: 失敗テストを作成**

`src/screens/BookDetailScreen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import BookDetailScreen from './BookDetailScreen'

const book = {
  id: 'b1',
  title: '英単語1000',
  totalPages: 100,
  startDate: '2026-01-01',
  deadline: '2026-01-11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  vi.restoreAllMocks()
})

it('shows today target and remaining pages', async () => {
  await db.books.add({ ...book, totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-05T09:00:00'))
  render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
  expect(await screen.findByTestId('book-title')).toHaveTextContent('英単語1000')
  // 100ページ / 期限まで6日 = 17ページ（切り上げ）
  expect(screen.getByTestId('today-target')).toHaveTextContent('17')
  vi.useRealTimers()
})

it('records today progress and shows updated total', async () => {
  await db.books.add({ ...book, totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-05T09:00:00'))
  render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
  fireEvent.change(screen.getByTestId('progress-input'), { target: { value: '10' } })
  fireEvent.click(screen.getByTestId('record-progress'))
  expect(await screen.findByTestId('done-count')).toHaveTextContent('10')
  vi.useRealTimers()
})

it('overwrites same-day record', async () => {
  await db.books.add({ ...book, totalPages: 100, startDate: '2026-01-01', deadline: '2026-01-11' })
  await db.records.add({ id: 'r1', bookId: 'b1', date: '2026-01-05', pages: 4 })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-05T09:00:00'))
  render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
  fireEvent.change(screen.getByTestId('progress-input'), { target: { value: '7' } })
  fireEvent.click(screen.getByTestId('record-progress'))
  expect(await screen.findByTestId('done-count')).toHaveTextContent('7')
  vi.useRealTimers()
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test src/screens/BookDetailScreen.test.tsx`
Expected: FAIL

- [ ] **Step 3: `src/components/ProgressChart.tsx` を実装**

```tsx
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

type Props = {
  dates: string[]
  values: number[]
}

export default function ProgressChart({ dates, values }: Props) {
  return (
    <div data-testid="progress-chart" style={{ height: 200 }}>
      <Line
        data={{
          labels: dates,
          datasets: [
            {
              label: '1日当たりのページ数',
              data: values,
              borderColor: '#2563eb',
              backgroundColor: '#2563eb',
            },
          ],
        }}
        options={{ responsive: true, maintainAspectRatio: false }}
      />
    </div>
  )
}
```

- [ ] **Step 4: `src/screens/BookDetailScreen.tsx` を実装**

```tsx
import { useState } from 'react'
import ProgressChart from '../components/ProgressChart'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import {
  calcDonePages,
  calcDailyTarget,
  daysBetween,
  todayStr,
  type BookData,
} from '../lib/progress'

type Props = {
  bookId: string
  onBack: () => void
  onEdit: (id: string) => void
}

export default function BookDetailScreen({ bookId, onBack, onEdit }: Props) {
  const { books, removeBook } = useBooks()
  const { records, addProgress } = useRecords()
  const [pagesInput, setPagesInput] = useState('')
  const book: BookData | undefined = books.find((b) => b.id === bookId)

  if (!book) {
    return (
      <div style={{ padding: 16 }}>
        <p>参考書が見つかりません。</p>
        <button onClick={onBack}>戻る</button>
      </div>
    )
  }

  const today = todayStr()
  const done = calcDonePages(records, book.id)
  const remainingDays = daysBetween(today, book.deadline)
  const target = calcDailyTarget(book, done, remainingDays)
  const todayRecord = records.find((r) => r.bookId === book.id && r.date === today)

  const todayValues = records
    .filter((r) => r.bookId === book.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => r.pages)

  const handleRecord = async () => {
    const pages = Number(pagesInput)
    if (!Number.isInteger(pages) || pages < 1) return
    await addProgress(book.id, today, pages)
    setPagesInput('')
  }

  const handleDelete = async () => {
    if (!window.confirm(`「${book.title}」を削除しますか？`)) return
    await removeBook(book.id)
    onBack()
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack}>← 戻る</button>
      <h1 data-testid="book-title" style={{ fontSize: 20 }}>
        {book.title}
      </h1>
      {book.coverUrl && <img src={book.coverUrl} alt="" width={96} height={136} />}
      <p>
        完了ページ: <span data-testid="done-count">{done}</span> / {book.totalPages}
      </p>
      <p>
        今日の目標: <strong data-testid="today-target">{target}</strong> ページ
      </p>
      <p>
        残り {Math.max(book.totalPages - done, 0)} ページ / 期限まで{' '}
        {Math.max(remainingDays, 0)} 日
      </p>
      <div style={{ margin: '16px 0' }}>
        <p>今日の学習（{todayRecord ? '記録済み・上書きします' : '未記録'}）</p>
        <input
          data-testid="progress-input"
          type="number"
          inputMode="numeric"
          value={todayRecord?.pages ? String(todayRecord.pages) : pagesInput}
          onChange={(e) => setPagesInput(e.target.value)}
          placeholder="ページ数"
        />
        <button data-testid="record-progress" type="button" onClick={() => void handleRecord()}>
          今日やったページ数を記録
        </button>
      </div>
      {todayValues.length > 0 && (
        <>
          <h2 style={{ fontSize: 16 }}>進捗の推移</h2>
          <ProgressChart
            dates={records.filter((r) => r.bookId === book.id).sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => r.date)}
            values={todayValues}
          />
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => onEdit(book.id)}>編集</button>
        <button onClick={() => void handleDelete()} style={{ color: '#b91c1c' }}>
          削除
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm test src/screens/BookDetailScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/screens/BookDetailScreen.tsx src/components/ProgressChart.tsx src/screens/BookDetailScreen.test.tsx
git commit -m "feat: add book detail screen with progress recording"
```

---

### Task 9: 設定画面（バックアップ）

**Files:**
- Create: `src/screens/SettingsScreen.tsx`
- Test: `src/screens/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `exportBackup`, `importBackup`, `validateBackup`（Task 3）
- Produces:
  - `SettingsScreen({ onDone }: { onDone: () => void })` — バックアップ書き出し/読み込み/全削除
  - 操作対象となる要素の id: 書き出しボタン `backup-export`、読み込みファイルボタン `backup-import`、全削除ボタン `delete-all`、結果表示 `backup-result`。

- [ ] **Step 1: 失敗テストを作成**

`src/screens/SettingsScreen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsScreen from './SettingsScreen'

beforeEach(() => {
  vi.restoreAllMocks()
})

it('exports a JSON file on export click', async () => {
  const createSpy = vi.fn(() => ({ url: 'blob:test', click: vi.fn(), revokeObjectURL: null }))
  vi.stubGlobal('URL', { createObjectURL: createSpy, revokeObjectURL: vi.fn() })
  const anchor = document.createElement('a')
  document.body.appendChild(anchor)
  anchor.click = vi.fn()
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('backup-export'))
  expect(createSpy).toHaveBeenCalled()
})

it('shows result message after import', async () => {
  const validData = {
    exportedAt: '2026-01-05T00:00:00.000Z',
    books: [],
    records: [],
  }
  const file = new File([JSON.stringify(validData)], 'backup.json', { type: 'application/json' })
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('backup-import'), { target: { files: [file] } })
  await waitFor(() => expect(screen.getByTestId('backup-result')).toHaveTextContent(/入しました/))
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test src/screens/SettingsScreen.test.tsx`
Expected: FAIL

- [ ] **Step 3: `src/screens/SettingsScreen.tsx` を実装**

```tsx
import { useRef, useState } from 'react'
import { exportBackup, importBackup, validateBackup } from '../db/backup'

type Props = {
  onDone: () => void
}

export default function SettingsScreen({ onDone }: Props) {
  const [result, setResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setResult('書き出しました')
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    setResult(null)
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (!validateBackup(parsed)) {
        setResult('読み込み失敗: 不正なバックアップデータです')
        return
      }
      const { books, records } = await importBackup(parsed)
      setResult(`読み込みました（参考書 ${books} 冊 / 進捗 ${records} 件）`)
    } catch {
      setResult('読み込み失敗: ファイルを開けませんでした')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteAll = async () => {
    if (!window.confirm('すべてのデータを削除しますか？この操作は戻せません。')) return
    const { db } = await import('../db/database')
    await db.transaction('rw', db.books, db.records, async () => {
      await db.books.clear()
      await db.records.clear()
    })
    setResult('すべてのデータを削除しました')
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>設定</h1>
      <button data-testid="backup-export" type="button" onClick={() => void handleExport()}>
        バックアップを書き出す
      </button>
      <div>
        <label htmlFor="backup-import">バックアップから読み込み</label>
        <input
          id="backup-import"
          data-testid="backup-import"
          type="file"
          accept="application/json,.json"
          ref={fileInputRef}
          onChange={(e) => void handleImportFile(e.target.files?.[0])}
        />
      </div>
      <button data-testid="delete-all" type="button" onClick={() => void handleDeleteAll()} style={{ color: '#b91c1c' }}>
        すべてのデータを削除
      </button>
      <p>
        <button onClick={onDone}>戻る</button>
      </p>
      {result && (
        <p data-testid="backup-result" style={{ color: '#2563eb' }}>
          {result}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test src/screens/SettingsScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/screens/SettingsScreen.tsx src/screens/SettingsScreen.test.tsx
git commit -m "feat: add settings screen with backup"
```

---

### Task 10: アプリのナビゲーション統合と PWA 化

**Files:**
- Create: `src/App.tsx`（置き換え）
- Create: `src/styles.css`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `src/pwa.ts`
- Create: `src/hooks/usePwaReload.ts`
- Modify: `vite.config.ts`（PWA プラグイン追加）
- Modify: `src/vite-env.d.ts`（PWA 型参照追加）

**Interfaces:**
- Consumes: `HomeScreen`（Task 6）、`BookFormScreen`（Task 7）、`BookDetailScreen`（Task 8）、`SettingsScreen`（Task 9）、`useBooks`（Task 5）
- Produces: 最終的な `App`（画面遷移）、`usePwaReload(): { needsRefresh: boolean; reload(): void }`

**アイコン画像について:** アイコン PNG 2枚は Task 10 の Step 1 で PowerShell を使い 192×192 と 512×512 の単色 PNG（青 #2563eb、中央に白の「書」）を生成して `public/icons/` に置く。生成できない環境では、直接 PNG Base64 を書き出すスクリプトで代替する。

- [ ] **Step 1: アイコン PNG を生成**

Run（PowerShell）:

```powershell
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force public\icons | Out-Null
$white = [System.Drawing.Brushes]::White

function New-Icon($size, $fontSize, $outPath) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(37, 99, 235))
  $font = New-Object System.Drawing.Font ('Meiryo', $fontSize, [System.Drawing.FontStyle]::Bold)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'
  $sf.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $g.DrawString('書', $font, $white, $rect, $sf)
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $font.Dispose()
}

New-Icon 512 340 (Join-Path $PWD 'public\icons\icon-512.png')
New-Icon 192 128 (Join-Path $PWD 'public\icons\icon-192.png')
```

Expected: `public/icons/icon-192.png` と `public/icons/icon-512.png` が生成される。

- [ ] **Step 2: `src/pwa.ts` を作成（PWA アップデート通知用の registerSW）**

```typescript
export async function registerSW() {
  const { registerSW } = await import('virtual:pwa-register')
  await registerSW({
    immediate: true,
    onNeedRefresh: () => {
      window.dispatchEvent(new CustomEvent('sw-need-refresh'))
    },
  })
}
```

- [ ] **Step 3: `src/hooks/usePwaReload.ts` を作成**

```typescript
import { useEffect, useState } from 'react'

export function usePwaReload() {
  const [needsRefresh, setNeedsRefresh] = useState(false)

  useEffect(() => {
    void import('../pwa').then((m) => m.registerSW())
    const handler = () => setNeedsRefresh(true)
    window.addEventListener('sw-need-refresh', handler)
    return () => window.removeEventListener('sw-need-refresh', handler)
  }, [])

  const reload = () => window.location.reload()
  return { needsRefresh, reload }
}
```

- [ ] **Step 4: `src/App.tsx` を統合置き換え**

```tsx
import { useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import BookDetailScreen from './screens/BookDetailScreen'
import BookFormScreen from './screens/BookFormScreen'
import SettingsScreen from './screens/SettingsScreen'
import { useBooks } from './hooks/useBooks'
import { usePwaReload } from './hooks/usePwaReload'
import './styles.css'

type Route =
  | { name: 'home' }
  | { name: 'detail'; bookId: string }
  | { name: 'add' }
  | { name: 'edit'; bookId: string }
  | { name: 'settings' }

export default function App() {
  const { books } = useBooks()
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const { needsRefresh, reload } = usePwaReload()

  const editBook =
    route.name === 'edit' ? books.find((b) => b.id === route.bookId) : undefined

  return (
    <>
      {needsRefresh && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: 8,
            background: '#f59e0b',
          }}
        >
          アプリが更新されました。
          <button onClick={reload}>更新する</button>
        </div>
      )}
      <div className="app-header">
        <span className="app-title">スケジュール管理</span>
      </div>
      {route.name === 'home' && (
        <HomeScreen onOpenBook={(id) => setRoute({ name: 'detail', bookId: id })} />
      )}
      {route.name === 'detail' && (
        <BookDetailScreen
          bookId={route.bookId}
          onBack={() => setRoute({ name: 'home' })}
          onEdit={(id) => setRoute({ name: 'edit', bookId: id })}
        />
      )}
      {route.name === 'edit' && editBook && (
        <BookFormScreen book={editBook} onDone={() => setRoute({ name: 'home' })} />
      )}
      {route.name === 'add' && <BookFormScreen book={null} onDone={() => setRoute({ name: 'home' })} />}
      <footer className="app-footer">
        {route.name === 'home' && (
          <button data-testid="nav-add" onClick={() => setRoute({ name: 'add' })}>
            ＋ 参考書を追加
          </button>
        )}
        {route.name !== 'home' && (
          <button data-testid="nav-home" onClick={() => setRoute({ name: 'home' })}>
            ホーム
          </button>
        )}
        {route.name !== 'settings' && (
          <button data-testid="nav-settings" onClick={() => setRoute({ name: 'settings' })}>
            設定
          </button>
        )}
      </footer>
    </>
  )
}
```

- [ ] **Step 5: `src/styles.css` を作成**

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Meiryo', sans-serif;
  background: #f8fafc;
  color: #0f172a;
}
.app-header {
  padding: 16px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  position: sticky;
  top: 0;
}
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  z-index: 5;
}
.app-footer button { flex: 1; min-height: 44px; }
button { min-height: 44px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-size: 16px; }
input, select { min-height: 44px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 8px; width: 100%; margin: 4px 0 12px; }
label { font-size: 14px; color: #475569; }
main { padding-bottom: 80px; }
```

- [ ] **Step 6: vite.config.ts に PWA プラグインを追加**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: '参考書スケジュール管理',
        short_name: 'スケジュール管理',
        description: '参考書の進捗を記録して今日の目標を自動計算',
        lang: 'ja',
        start_url: '.',
        display: 'standalone',
        background_color: '#2563eb',
        theme_color: '#2563eb',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
```

- [ ] **Step 7: `src/vite-env.d.ts` に PWA 型参照を追加**

`virtual:pwa-register` を TypeScript で解決するため、ファイル末尾に追記する。

```typescript
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 8: 全テスト・ビルドが通ることを確認**

Run: `npm test`
Expected: 全 PASS

Run: `npm run build`
Expected: 成功、`dist/` に `sw.js`・`manifest.webmanifest` を含む PWA 成果物が生成される

- [ ] **Step 9: コミット**

```bash
git add .
git commit -m "feat: integrate screens as pwa app"
```

---

### Task 11: GitHub Pages へのデプロイと動作確認

**Files:**
- Modify: `package.json`（`homepage` フィールド追加）
- Create: `.github/workflows/deploy.yml`
- Create: `docs/usage.md`（iPhone での利用手順）

**Interfaces:**
- Consumes: 完了した PWA アプリ
- Produces: 公開 URL と利用手順

- [ ] **Step 1: package.json に homepage を追加**

```json
"homepage": "https://<あなたのGitHubユーザー名>.github.io/schedule-app/",
```

※リポジトリ名が `schedule-app` でない場合はその名前を使う。`<あなたのGitHubユーザー名>` は実際の GitHub ユーザー名に置き換える。

- [ ] **Step 2: GitHub Actions ワークフローを作成**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: 利用手順ドキュメントを作成**

`docs/usage.md`:

```markdown
# iPhone での利用手順

1. 公開後の URL（https://<あなたのGitHubユーザー名>.github.io/schedule-app/）を iPhone の Safari で開く
2. Safari の共有ボタン →「ホーム画面に追加」→「追加」
3. ホーム画面のアイコンから起動（フルスクリーン・オフライン対応）
4. 初回起動後、ホーム画面で「＋ 参考書を追加」→ 検索で参考書を追加
```

- [ ] **Step 4: GitHub リポジトリの Settings → Pages で Source を「GitHub Actions」に設定**

Expected: 公開 URL でアプリが開ける

- [ ] **Step 5: コミット**

```bash
git add .
git commit -m "chore: add github pages deploy workflow and usage docs"
```

---

## 補足: アイコン生成の代替手段

Step 1 の PowerShell スクリプトが実行できない場合は、次の Node ワンライナーで PNG を生成する（`pngjs` を devDependencies に一時追加して実行）。

```bash
npm i -D pngjs
```

生成スクリプト（`scripts/gen-icons.mjs`）:

```js
import { PNG } from 'pngjs'
import fs from 'node:fs'
const sizes = [192, 512]
for (const size of sizes) {
  const png = new PNG({ width: size, height: size })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 37
    png.data[i + 1] = 99
    png.data[i + 2] = 235
    png.data[i + 3] = 255
  }
  fs.writeFileSync(`public/icons/icon-${size}.png`, PNG.sync.write(png))
}
```

```bash
node scripts/gen-icons.mjs
```