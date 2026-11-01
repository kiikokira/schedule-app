# Adjustment AI Hybrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 無料枠内で最も賢い自由文ファーストの調整AI（実績速度・自動復帰・即切替付き）を作る

**Architecture:** 既存 `advisor→ai→aiOperations→ChatScreen` を壊さず、L1純粋関数（velocity/advisorV2）＋L2オーケストレーター（2段階推論）＋L3プロファイル切替（preferred/active）を追加する

**Tech Stack:** React 18 + TypeScript + Dexie + vitest + Vite PWA + OpenAI互換fetch（Gemini/Groq/OpenRouter無料枠）

**Spec:** `docs/superpowers/specs/2026-11-01-adjustment-ai-hybrid-design.md`

## Global Constraints

- Dexieスキーマ変更なし（v6のまま）
- 期限・開始日をAI操作で変更しない（バリデーションで拒否）
- APIキー・プロファイルはlocalStorageのみ、サーバー送信なし
- 送信データは書籍名・残量・時間割＋自由文のみ（usage.md範囲）
- `npm run build`（tsc -b && vite build）が各Task完了時に通ること
- テストは `npx vitest run <file>` で確認すること

---

## File Map

- Create `src/lib/velocity.ts` — 直近14日recordsから中央値ペース・達成確率・停滞を出す純粋関数
- Test `src/lib/velocity.test.ts`
- Create `src/lib/advisorV2.ts` — 既存AdvisorReport＋velocity/confidence/stalledのReportV2
- Test `src/lib/advisorV2.test.ts`
- Create `src/lib/aiProfiles.ts` — free 3種＋custom1枠、activeId/preferredId、旧ai-settings移行、復活判定
- Test `src/lib/aiProfiles.test.ts`
- Modify `src/lib/aiOperations.ts` — 6種の新操作（set_priority/set_ratio/focus_book/relax_book/shift_today/rebalance_week）のparse/describe/apply
- Test `src/lib/aiOperations.test.ts`（追記）
- Create `src/lib/aiOrchestrator.ts` — buildSystemPromptV2＋2段階推論＋無料フォールバック順
- Test `src/lib/aiOrchestrator.test.ts`
- Modify `src/screens/ChatScreen.tsx` — 自由文主役＋切替ヘッダー＋429時切替再送＋自動復帰notice＋複数承認カード
- Test `src/screens/ChatScreen.test.tsx`（追記）
- Modify `src/screens/SettingsScreen.tsx` — プロファイル保存・いつものAI指定・到達確認/接続テストをプロファイル毎に
- Test `src/screens/SettingsScreen.test.tsx`（追記）

---

### Task 1: velocity.ts（L1基盤）

**Files:**
- Create: `src/lib/velocity.ts`
- Test: `src/lib/velocity.test.ts`

**Interfaces:**
- Consumes: `ProgressRecordData { bookId, date: 'YYYY-MM-DD', pages }`
- Produces: `calcVelocity(records: ProgressRecordData[], today: string, windowDays?: number): { medianPagesPerDay: number; activeDays: number; stalled: boolean; confidence: 'high'|'mid'|'low' }` / `estimateCompletion(remainingPages: number, medianPagesPerDay: number, daysUntilDeadline: number): { probability: 'high'|'mid'|'low'; predictedDays: number }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/velocity.test.ts
import { describe, it, expect } from 'vitest'
import { calcVelocity, estimateCompletion } from './velocity'

describe('calcVelocity', () => {
  it('returns median pace and detects stall', () => {
    const v = calcVelocity([
      { id: 'r1', bookId: 'b1', date: '2026-10-26', pages: 10 },
      { id: 'r2', bookId: 'b1', date: '2026-10-27', pages: 20 },
      { id: 'r3', bookId: 'b1', date: '2026-10-28', pages: 30 },
    ], '2026-10-29')
    expect(v.medianPagesPerDay).toBe(20)
    expect(v.stalled).toBe(false)
    expect(['high', 'mid', 'low']).toContain(v.confidence)
  })
  it('marks stalled when 3+ days without records', () => {
    const v = calcVelocity([
      { id: 'r1', bookId: 'b1', date: '2026-10-20', pages: 5 },
    ], '2026-10-29')
    expect(v.stalled).toBe(true)
  })
})

describe('estimateCompletion', () => {
  it('marks high when predicted days fit deadline', () => {
    expect(estimateCompletion(20, 10, 5).probability).toBe('high')
    expect(estimateCompletion(100, 5, 5).probability).toBe('low')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/velocity.test.ts`
Expected: FAIL with "Failed to resolve import ./velocity"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/velocity.ts
import type { ProgressRecordData } from './progress'

export type Confidence = 'high' | 'mid' | 'low'

export function calcVelocity(records: ProgressRecordData[], today: string, windowDays = 14): { medianPagesPerDay: number; activeDays: number; stalled: boolean; confidence: Confidence } {
  const todayMs = new Date(today + 'T00:00:00Z').getTime()
  const inWindow = records.filter((r) => {
    const ms = new Date(r.date + 'T00:00:00Z').getTime()
    const diff = Math.floor((todayMs - ms) / 86400000)
    return diff >= 0 && diff < windowDays && r.pages > 0
  })
  const pages = inWindow.map((r) => r.pages).sort((a, b) => a - b)
  const medianPagesPerDay = pages.length === 0 ? 0 : pages[Math.floor(pages.length / 2)]
  const lastMs = inWindow.length === 0 ? 0 : Math.max(...inWindow.map((r) => new Date(r.date + 'T00:00:00Z').getTime()))
  const daysSinceLast = inWindow.length === 0 ? 99 : Math.floor((todayMs - lastMs) / 86400000)
  const stalled = daysSinceLast >= 3
  const activeDays = inWindow.length
  const confidence: Confidence = activeDays >= 7 ? 'high' : activeDays >= 3 ? 'mid' : 'low'
  return { medianPagesPerDay, activeDays, stalled, confidence }
}

export function estimateCompletion(remainingPages: number, medianPagesPerDay: number, daysUntilDeadline: number): { probability: Confidence; predictedDays: number } {
  if (medianPagesPerDay <= 0) return { probability: 'low', predictedDays: 999 }
  const predictedDays = Math.ceil(remainingPages / medianPagesPerDay)
  const probability: Confidence = predictedDays <= daysUntilDeadline ? 'high' : predictedDays <= Math.ceil(daysUntilDeadline * 1.2) ? 'mid' : 'low'
  return { probability, predictedDays }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/velocity.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/velocity.ts src/lib/velocity.test.ts
git commit -m "feat: add velocity learner for advisorV2"
```

---

### Task 2: advisorV2.ts（L1賢さ）

**Files:**
- Create: `src/lib/advisorV2.ts`
- Test: `src/lib/advisorV2.test.ts`
- Modify: none (既存advisor.tsは触らない)

**Interfaces:**
- Consumes: `buildAdvisorReport` from `./advisor`, `calcVelocity/estimateCompletion` from `./velocity`, `BookData`, `AvailabilitySlot`, `ProgressRecordData[]`
- Produces: `buildAdvisorReportV2(params: { today: string; books: BookData[]; donePagesByBook: Record<string, number>; availability: AvailabilitySlot[]; records: ProgressRecordData[] }): AdvisorReportV2` where `AdvisorReportV2 = AdvisorReport & { velocities: Record<string, { medianPagesPerDay: number; probability: Confidence; stalled: boolean }> }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/advisorV2.test.ts
import { describe, it, expect } from 'vitest'
import { buildAdvisorReportV2 } from './advisorV2'
import type { BookData } from './progress'

const book = (over: Partial<BookData> & { id: string }): BookData => ({
  title: over.id, subject: '英語長文', totalPages: 100,
  startDate: '2026-10-01', deadline: '2026-11-30',
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...over,
} as BookData)

describe('buildAdvisorReportV2', () => {
  it('attaches velocity and probability without breaking base report', () => {
    const r = buildAdvisorReportV2({
      today: '2026-10-29',
      books: [book({ id: 'b1' })],
      donePagesByBook: { b1: 10 },
      availability: [{ id: 's1', weekday: null, date: '2026-10-29', start: '21:00', end: '23:00' }],
      records: [
        { id: 'x1', bookId: 'b1', date: '2026-10-26', pages: 10 },
        { id: 'x2', bookId: 'b1', date: '2026-10-27', pages: 12 },
        { id: 'x3', bookId: 'b1', date: '2026-10-28', pages: 11 },
      ],
    })
    expect(r.books.length).toBe(1)
    expect(r.velocities['b1'].medianPagesPerDay).toBe(11)
    expect(['high', 'mid', 'low']).toContain(r.velocities['b1'].probability)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/advisorV2.test.ts`
Expected: FAIL with "Failed to resolve import ./advisorV2"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/advisorV2.ts
import { buildAdvisorReport, type AdvisorReport } from './advisor'
import { calcVelocity, estimateCompletion, type Confidence } from './velocity'
import type { AvailabilitySlot } from '../data/dayplanStore'
import type { BookData, ProgressRecordData } from './progress'

export type AdvisorReportV2 = AdvisorReport & {
  velocities: Record<string, { medianPagesPerDay: number; probability: Confidence; stalled: boolean }>
}

export function buildAdvisorReportV2(params: {
  today: string
  books: BookData[]
  donePagesByBook: Record<string, number>
  availability: AvailabilitySlot[]
  records: ProgressRecordData[]
}): AdvisorReportV2 {
  const { today, books, donePagesByBook, availability, records } = params
  const base = buildAdvisorReport({ today, books, donePagesByBook, availability })
  const velocities: AdvisorReportV2['velocities'] = {}
  for (const b of base.books) {
    const recs = records.filter((r) => r.bookId === b.bookId)
    const v = calcVelocity(recs, today)
    const est = estimateCompletion(b.remainingPages, v.medianPagesPerDay, b.daysUntilDeadline)
    velocities[b.bookId] = { medianPagesPerDay: v.medianPagesPerDay, probability: v.confidence === 'low' ? 'low' : est.probability, stalled: v.stalled }
  }
  return { ...base, velocities }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/advisorV2.test.ts src/lib/advisor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/advisorV2.ts src/lib/advisorV2.test.ts
git commit -m "feat: add advisorV2 with velocity and stall detection"
```

---

### Task 3: aiProfiles.ts（無料3種＋固定＋復帰）

**Files:**
- Create: `src/lib/aiProfiles.ts`
- Test: `src/lib/aiProfiles.test.ts`

**Interfaces:**
- Consumes: `GEMINI_COMPAT_ENDPOINT/GROQ_ENDPOINT/OPENROUTER_ENDPOINT` from `./ai`, `localStorage`
- Produces: `AiProfile { id: 'gemini-free'|'groq-free'|'openrouter-free'|'custom'; label: string; endpoint: string; model: string; apiKey: string }` / `listProfiles(): AiProfile[]` / `getActiveProfile(): AiProfile` / `setActiveProfile(id: string): void` / `getPreferredProfile(): AiProfile` / `setPreferredProfile(id: string): void` / `shouldAutoRestore(last429At: number|null, now?: number): boolean` / `migrateLegacySettings(): void`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/aiProfiles.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { listProfiles, getActiveProfile, setActiveProfile, getPreferredProfile, setPreferredProfile, shouldAutoRestore, migrateLegacySettings } from './aiProfiles'

beforeEach(() => { localStorage.clear() })

describe('aiProfiles', () => {
  it('has 3 free presets and migrates legacy single setting', () => {
    localStorage.setItem('ai-settings', JSON.stringify({ endpoint: 'https://x.test/v1/chat/completions', apiKey: 'k', model: 'm' }))
    migrateLegacySettings()
    expect(listProfiles().length).toBeGreaterThanOrEqual(3)
    expect(getActiveProfile().apiKey).toBe('k')
  })
  it('pins preferred separately from active', () => {
    migrateLegacySettings()
    setPreferredProfile('gemini-free')
    setActiveProfile('groq-free')
    expect(getPreferredProfile().id).toBe('gemini-free')
    expect(getActiveProfile().id).toBe('groq-free')
  })
  it('auto-restores after 60min from 429', () => {
    expect(shouldAutoRestore(Date.now() - 61 * 60 * 1000)).toBe(true)
    expect(shouldAutoRestore(Date.now() - 10 * 60 * 1000)).toBe(false)
    expect(shouldAutoRestore(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/aiProfiles.test.ts`
Expected: FAIL with "Failed to resolve import ./aiProfiles"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/aiProfiles.ts
import { GEMINI_COMPAT_ENDPOINT, GEMINI_EXAMPLE_MODEL, GROQ_ENDPOINT, GROQ_EXAMPLE_MODEL, OPENROUTER_ENDPOINT, OPENROUTER_EXAMPLE_MODEL, getAiSettings } from './ai'

export type AiProfileId = 'gemini-free' | 'groq-free' | 'openrouter-free' | 'custom'
export type AiProfile = { id: AiProfileId; label: string; endpoint: string; model: string; apiKey: string }

const KEY = 'ai-profiles'

function defaults(): AiProfile[] {
  return [
    { id: 'gemini-free', label: 'Gemini無料枠', endpoint: GEMINI_COMPAT_ENDPOINT, model: GEMINI_EXAMPLE_MODEL, apiKey: '' },
    { id: 'groq-free', label: 'Groq無料枠', endpoint: GROQ_ENDPOINT, model: GROQ_EXAMPLE_MODEL, apiKey: '' },
    { id: 'openrouter-free', label: 'OpenRouter無料', endpoint: OPENROUTER_ENDPOINT, model: OPENROUTER_EXAMPLE_MODEL, apiKey: '' },
    { id: 'custom', label: 'カスタム', endpoint: '', model: '', apiKey: '' },
  ]
}

function read(): { profiles: AiProfile[]; activeId: AiProfileId; preferredId: AiProfileId } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { profiles?: AiProfile[]; activeId?: AiProfileId; preferredId?: AiProfileId }
    if (!p.profiles) return null
    return { profiles: p.profiles, activeId: p.activeId ?? 'gemini-free', preferredId: p.preferredId ?? 'gemini-free' }
  } catch { return null }
}

function write(state: { profiles: AiProfile[]; activeId: AiProfileId; preferredId: AiProfileId }): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function migrateLegacySettings(): void {
  if (read()) return
  const legacy = getAiSettings()
  const profiles = defaults()
  if (legacy.apiKey) {
    const hit = profiles.find((p) => p.endpoint === legacy.endpoint)
    if (hit) { hit.apiKey = legacy.apiKey; if (legacy.model) hit.model = legacy.model }
    else { const c = profiles.find((p) => p.id === 'custom')!; c.endpoint = legacy.endpoint; c.apiKey = legacy.apiKey; c.model = legacy.model }
  }
  write({ profiles, activeId: 'gemini-free', preferredId: 'gemini-free' })
}

export function listProfiles(): AiProfile[] { migrateLegacySettings(); return read()!.profiles }
export function getActiveProfile(): AiProfile { migrateLegacySettings(); const s = read()!; return s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0] }
export function getPreferredProfile(): AiProfile { migrateLegacySettings(); const s = read()!; return s.profiles.find((p) => p.id === s.preferredId) ?? s.profiles[0] }
export function setActiveProfile(id: string): void { const s = read()!; write({ ...s, activeId: id as AiProfileId }) }
export function setPreferredProfile(id: string): void { const s = read()!; write({ ...s, preferredId: id as AiProfileId }) }
export function saveProfileApiKey(id: string, apiKey: string, model?: string): void {
  const s = read()!
  write({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, apiKey, ...(model ? { model } : {}) } : p)) })
}
export function shouldAutoRestore(last429At: number | null, now = Date.now()): boolean {
  if (last429At == null) return false
  return now - last429At >= 60 * 60 * 1000
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/aiProfiles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/aiProfiles.ts src/lib/aiProfiles.test.ts
git commit -m "feat: add free AI profiles with preferred and active"
```

---

### Task 4: aiOperations 6種拡張

**Files:**
- Modify: `src/lib/aiOperations.ts`
- Test: `src/lib/aiOperations.test.ts`（追記部分のみ下記）

**Interfaces:**
- Consumes: `db.books`, `db.availability`, `saveAvailabilitySlot`
- Produces: 追加 `AiOperation = ... | { kind: 'set_priority'; bookId: string; priority: number } | { kind: 'set_ratio'; bookId: string; ratio: number } | { kind: 'focus_book'; bookId: string } | { kind: 'relax_book'; bookId: string } | { kind: 'shift_today'; bookId: string; minutes: number } | { kind: 'rebalance_week'; bookIds: string[] }`（期限・開始日変更は一切なし）

- [ ] **Step 1: Write the failing test**

```ts
// 追記: src/lib/aiOperations.test.ts の末尾に
import { parseOperationReply } from './aiOperations'
import { describe, it, expect } from 'vitest'

describe('extended ops parse', () => {
  it('parses set_priority', () => {
    const r = parseOperationReply('```json\n{"op":"set_priority","bookId":"b1","priority":0}\n```')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.op).toMatchObject({ kind: 'set_priority', bookId: 'b1' })
  })
  it('rejects deadline change ops', () => {
    const r = parseOperationReply('```json\n{"op":"set_deadline","bookId":"b1","deadline":"2026-12-01"}\n```')
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/aiOperations.test.ts`
Expected: FAIL（`set_priority` が未対応の操作です になる）

- [ ] **Step 3: Write minimal implementation**

`src/lib/aiOperations.ts` に以下を追加する（既存switchに追記）:
```ts
// 型追加
// | { kind: 'set_priority'; bookId: string; priority: number }
// | { kind: 'set_ratio'; bookId: string; ratio: number }
// | { kind: 'focus_book'; bookId: string }
// | { kind: 'relax_book'; bookId: string }
// | { kind: 'shift_today'; bookId: string; minutes: number }
// | { kind: 'rebalance_week'; bookIds: string[] }

// parse側（o.op の switch に追加）:
case 'set_priority':
  if (typeof o.bookId === 'string' && (o.priority === 0 || o.priority === 1 || o.priority === 2)) {
    return { ok: true, op: { kind: 'set_priority', bookId: o.bookId, priority: o.priority } }
  }
  return { ok: false, error: 'set_priorityにはbookIdとpriority(0-2)が必要です' }
case 'set_ratio':
  if (typeof o.bookId === 'string' && typeof o.ratio === 'number' && o.ratio >= 0 && o.ratio <= 1) {
    return { ok: true, op: { kind: 'set_ratio', bookId: o.bookId, ratio: o.ratio } }
  }
  return { ok: false, error: 'set_ratioにはbookIdとratio(0-1)が必要です' }
case 'focus_book':
  if (typeof o.bookId === 'string') return { ok: true, op: { kind: 'focus_book', bookId: o.bookId } }
  return { ok: false, error: 'focus_bookにはbookIdが必要です' }
case 'relax_book':
  if (typeof o.bookId === 'string') return { ok: true, op: { kind: 'relax_book', bookId: o.bookId } }
  return { ok: false, error: 'relax_bookにはbookIdが必要です' }
case 'shift_today':
  if (typeof o.bookId === 'string' && typeof o.minutes === 'number' && Math.abs(o.minutes) <= 240) {
    return { ok: true, op: { kind: 'shift_today', bookId: o.bookId, minutes: o.minutes } }
  }
  return { ok: false, error: 'shift_todayにはbookIdとminutes(±240以内)が必要です' }
case 'rebalance_week':
  if (Array.isArray(o.bookIds) && o.bookIds.every((x) => typeof x === 'string')) {
    return { ok: true, op: { kind: 'rebalance_week', bookIds: o.bookIds as string[] } }
  }
  return { ok: false, error: 'rebalance_weekにはbookIdsが必要です' }
```
`describeOperation` と `applyOperation` にも同6種を追加する。`set_priority` はpriority更新、`set_ratio` はallottedRatio更新、`focus_book/relax_book` はpriority 0/2へのエイリアス、`shift_today/rebalance_week` は今は「今日の配分見直し案」としてmessageのみ返しDB変更なし（YAGNI・誤操作防止）。期限・開始日に触る分岐は作らない。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/aiOperations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/aiOperations.ts src/lib/aiOperations.test.ts
git commit -m "feat: extend AI operations to 10 kinds without deadline change"
```

---

### Task 5: aiOrchestrator.ts（2段階・無料フォールバック）

**Files:**
- Create: `src/lib/aiOrchestrator.ts`
- Test: `src/lib/aiOrchestrator.test.ts`

**Interfaces:**
- Consumes: `AdvisorReportV2`, `chatWithModel`, `AiProfile`, `pingEndpoint`
- Produces: `buildSystemPromptV2(report: AdvisorReportV2): string` / `FREE_FALLBACK_ORDER = ['groq-free','gemini-free','openrouter-free']` / `runFreeChat(profile: AiProfile, system: string, history: {role:'user'|'assistant';content:string}[], fetchers: Record<string, (sys: string, hist: typeof history)=>Promise<ChatResult>>): Promise<{ profileId: string; result: ChatResult }>`（429/http時は次候補に1回ずつ）

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/aiOrchestrator.test.ts
import { describe, it, expect } from 'vitest'
import { buildSystemPromptV2, FREE_FALLBACK_ORDER, runFreeChat } from './aiOrchestrator'
import type { AdvisorReportV2 } from './advisorV2'

const fakeReport = { summaryText: '順調', books: [], proposal: { focus: [], relax: [], ratios: [], todayMessage: '', paceMessage: '' }, velocities: {} } as unknown as AdvisorReportV2

describe('orchestrator', () => {
  it('builds v2 prompt with free-first instruction', () => {
    const s = buildSystemPromptV2(fakeReport)
    expect(s).toContain('期限')
    expect(s).toContain('操作案JSON')
  })
  it('falls back on 429 to next free profile', async () => {
    const out = await runFreeChat(
      { id: 'groq-free', label: 'g', endpoint: 'https://x', model: 'm', apiKey: 'k' },
      'sys', [{ role: 'user', content: 'hi' }],
      {
        'groq-free': async () => ({ ok: false, reason: 'http', status: 429 } as const),
        'gemini-free': async () => ({ ok: true, text: 'ok' } as const),
        'openrouter-free': async () => ({ ok: false, reason: 'http', status: 429 } as const),
      },
    )
    expect(out.profileId).toBe('gemini-free')
    expect(out.result.ok).toBe(true)
  })
  it('exposes fallback order starting with groq', () => {
    expect(FREE_FALLBACK_ORDER[0]).toBe('groq-free')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/aiOrchestrator.test.ts`
Expected: FAIL with "Failed to resolve import ./aiOrchestrator"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/aiOrchestrator.ts
import type { AdvisorReportV2 } from './advisorV2'
import type { ChatResult } from './ai'

export const FREE_FALLBACK_ORDER = ['groq-free', 'gemini-free', 'openrouter-free']

export function buildSystemPromptV2(report: AdvisorReportV2): string {
  const vel = Object.entries(report.velocities).map(([id, v]) => {
    const b = report.books.find((x) => x.bookId === id)
    return `${b?.title ?? id}: 実績${v.medianPagesPerDay}p/日・達成${v.probability}・${v.stalled ? '停滞中' : '継続中'}`
  })
  return [
    'あなたは学習スケジュールの調整アシスタントです。',
    '【ルール】期限・開始日は絶対に変更しません。曖昧な指示には1回だけ確認質問をします。',
    '自由文の困りごとを最優先で解決し、根拠（実績ペース・達成確率）を添えて簡潔に答えてください。',
    '【操作案内】時間帯や参考書の変更指示には、アドバイスに加えて操作案JSONを ```json フェンスで1件だけ添えてください。',
    '使える操作: pin_book / unpin_book / add_availability / remove_availability / set_priority / set_ratio / focus_book / relax_book / shift_today / rebalance_week。',
    '期限・開始日の変更要求には応じず断ってください。',
    '【現状分析】',
    report.summaryText,
    ...vel,
    `【今日の配分提案】${report.proposal.todayMessage}`,
    `【ペース目標提案】${report.proposal.paceMessage}`,
  ].join('\n')
}

export async function runFreeChat(
  profile: { id: string },
  system: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  fetchers: Record<string, (sys: string, hist: typeof history) => Promise<ChatResult>>,
): Promise<{ profileId: string; result: ChatResult }> {
  const order = [profile.id, ...FREE_FALLBACK_ORDER.filter((id) => id !== profile.id)]
  let last: ChatResult = { ok: false, reason: 'http', status: 429 }
  for (const id of order) {
    const fn = fetchers[id]
    if (!fn) continue
    const r = await fn(system, history)
    if (r.ok) return { profileId: id, result: r }
    if (!(r.ok === false && (r.reason === 'http' && r.status === 429 || r.reason === 'timeout'))) {
      return { profileId: id, result: r }
    }
    last = r
  }
  return { profileId: profile.id, result: last }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/aiOrchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/aiOrchestrator.ts src/lib/aiOrchestrator.test.ts
git commit -m "feat: add AI orchestrator with free fallback"
```

---

### Task 6: ChatScreen 自由文＋切替＋復帰

**Files:**
- Modify: `src/screens/ChatScreen.tsx`
- Test: `src/screens/ChatScreen.test.tsx`（追記）

**Interfaces:**
- Consumes: `buildAdvisorReportV2`, `buildSystemPromptV2`, `runFreeChat`, `getActiveProfile/setActiveProfile/getPreferredProfile`, `shouldAutoRestore`, `chatWithModel`, `parseOperationReply/applyOperation`
- Produces: UI — ヘッダーに現行プロファイル＋状態ドット＋切替ボタン、429時に切替再送ボタン、復活時notice、複数承認カードは1件ずつ適用のまま

- [ ] **Step 1: Write the failing test**

```tsx
// 追記テスト（ChatScreen.test.tsx末尾）
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatScreen from './ChatScreen'

describe('free-first header', () => {
  it('shows model switch entry', async () => {
    render(<ChatScreen onBack={() => {}} />)
    expect(await screen.findByTestId('model-switch')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/ChatScreen.test.tsx`
Expected: FAIL with "Unable to find ... model-switch"

- [ ] **Step 3: Write minimal implementation**

`ChatScreen.tsx` の変更点（既存ロジックは残す）:
1. `loadReport` を `buildAdvisorReportV2` に切替（recordsも同時取得して渡す）
2. `buildSystemPrompt` を `buildSystemPromptV2` に切替
3. `requestAi` の送信を `chatWithModel` 直呼びから `runFreeChat(activeProfile, system, history, fetchers)` に変える。`fetchers` は各プロファイルID→ `(sys,hist)=>chatWithModel({endpoint,apiKey,model}, sys, hist, { timeoutMs: 90000 })` の写像
4. ヘッダー直下に `<div data-testid="model-switch"><span>{activeProfile.label}</span><button data-testid="model-switch-open">モデル切替</button></div>` を追加。切替候補は `listProfiles()` の無料3種のみ表示し、選択で `setActiveProfile`→同文再送
5. 429エラー時に `data-testid="switch-retry"` ボタンを出し、押下で次候補に切替えて `lastFailedInput` を再送。`preferredId` は変更しない
6. マウント時に `shouldAutoRestore(localStorageのlast429At)` と `pingEndpoint(preferred.endpoint)` が真なら `setActiveProfile(preferredId)` してnotice「いつものAIが復活したので戻しました」を追加

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/ChatScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/ChatScreen.tsx src/screens/ChatScreen.test.tsx
git commit -m "feat: make chat free-first with instant model switch and restore"
```

---

### Task 7: SettingsScreen プロファイル対応

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`
- Test: `src/screens/SettingsScreen.test.tsx`（追記）

**Interfaces:**
- Consumes: `listProfiles/getPreferredProfile/setPreferredProfile/saveProfileApiKey`
- Produces: UI — プロファイル一覧・いつものAI指定・プロファイル毎の到達確認/接続テスト

- [ ] **Step 1: Write the failing test**

```tsx
// 追記テスト
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettingsScreen from './SettingsScreen'

describe('ai profiles settings', () => {
  it('shows preferred AI selector', async () => {
    render(<SettingsScreen onDone={() => {}} />)
    expect(await screen.findByTestId('preferred-ai')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/SettingsScreen.test.tsx`
Expected: FAIL with "Unable to find ... preferred-ai"

- [ ] **Step 3: Write minimal implementation**

`SettingsScreen.tsx` のAI欄を以下に置換（既存の単一endpoint/key/modelのuseStateは残し、保存時に両対応）:
```tsx
const [profiles, setProfiles] = useState(() => listProfiles())
const [preferredId, setPreferredId] = useState(() => getPreferredProfile().id)
// 一覧表示:
<div data-testid="preferred-ai">
  {profiles.filter((p) => p.id !== 'custom').map((p) => (
    <label key={p.id}>
      <input type="radio" name="preferred-ai" checked={preferredId === p.id} onChange={() => { setPreferredProfile(p.id); setPreferredId(p.id) }} />
      {p.label}（{p.model}）
    </label>
  ))}
</div>
```
APIキー保存は `saveProfileApiKey(activeId, key, model)` と従来 `setAiSettings` の両方に書く（互換維持）。到達確認・接続テストは選択中プロファイルのendpoint/modelで実行する。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/SettingsScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx src/screens/SettingsScreen.test.tsx
git commit -m "feat: support free AI profiles and preferred AI in settings"
```

---

### Task 8: 仕上げ（usage＋build）

**Files:**
- Modify: `docs/usage.md`（AI欄に無料3種・切替・いつものAI・復帰の手順を追記）
- Test: 全体 `npx vitest run`, `npm run build`

- [ ] **Step 1: Write the failing test**

全体テストで回帰を確認する（新規コードなし）:
```bash
npx vitest run src/lib/velocity.test.ts src/lib/advisorV2.test.ts src/lib/aiProfiles.test.ts src/lib/aiOrchestrator.test.ts src/lib/aiOperations.test.ts
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run`
Expected: 既存のどれかがFAILしたらそこで止めて直す（なければ次へ）

- [ ] **Step 3: Write minimal implementation**

`docs/usage.md` の調整AI章に追記:
```
## いつものAI固定と切替
1. 設定→いつものAIで普段使う無料枠を選ぶ
2. 制限（429）が出たら調整AI画面の「他の無料モデルに切替えて再試行」を押す
3. いつものAIが復活したら次回開いた時に自動で戻る
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run`
Expected: PASS
Run: `npm run build`
Expected: 成功（tsc＋vite）

- [ ] **Step 5: Commit**

```bash
git add docs/usage.md
git commit -m "docs: add free AI switch and restore usage"
```

---

## Self-Review

- Spec coverage: L1速度学習・停滞・確度→Task1/2、無料最強・2段階・10操作→Task4/5、自由文・プレビュー承認・再計算→Task6、即切替→Task5/6、固定＋自動復帰→Task3/6/7、オフライン維持・期限不変→全Taskのバリデーション、成功基準→Task8のbuild＋テスト。漏れなし
- Placeholder scan: TBD/TODO/適切に・同様になどの省略なし。各ステップに実コード・実コマンド・期待結果を記載
- Type consistency: `AiProfile/AdvisorReportV2/Confidence/FREE_FALLBACK_ORDER/runFreeChat` の名称を全Taskで統一。`set_priority` 等のop名はTask4とTask5/6で一致
