# Exam Countdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ホーム最上部に2028-02-18入試までの残り日数と約か月を黒・大型で表示する

**Architecture:** HomeScreenに固定日付定数と既存daysBetween再利用の表示ブロックを追加するのみ。新規ファイルなし、ロジック分離なし。

**Tech Stack:** React + TypeScript + Vitest, 既存 `daysBetween`, `todayStr` 利用

**Spec:** brainstorm短設計（会話承認済み・ファイルなし）。要件：左小「入学試験日まであと」＋右大「○日」＋後「(約○か月)」、「あと」重複なし、黒で太さ・大きさ強調、位置はAppヘッダー下・志望校見出し上。

## Global Constraints

- 対象ファイルのみ `git add` する（無関係ファイルを含めない）。
- プッシュ前に `npm run build` が成功すること。
- プッシュはユーザーの許可後（スマホGitHub Pages反映のため本作業ではプッシュしない）。
- コピーは「入学試験日まであと」を左ラベルの1回のみにし、右日数に「あと」を付けない。
- 色は赤を使わず黒で、大きさ・太さで強調する。
- 試験日は `2028-02-18` 固定とし、既存 `EXAM_END_DATE='2028-02-05'` には触れない。

## Review Focus

- 試験日を過ぎた日にマイナス表示にならず `0日` で止まることを期待する。
- 今日が試験当日でも `0日（約0か月）` と壊れず出ることを期待する。
- 画面幅の狭いスマホでも折り返しでレイアウトが崩れないことを期待する。
- 既存の `h1` 見出し・ranking-card のテストが壊れないことを期待する。
- 日付計算がタイムゾーンで1日ずれないこと（既存 `daysBetween` 前提）を期待する。

---

### Task 1: Exam countdown display

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Test: `src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `todayStr(): string`, `daysBetween(from: string, to: string): number` from `src/lib/progress.ts`
- Produces: `data-testid="exam-countdown"` ブロック（HomeScreen先頭、`h1`志望校見出しの直上）

- [ ] **Step 1: Write the failing tests**

```tsx
it('shows exam countdown with days and approximate months without duplicate あと', () => {
  render(<HomeScreen onOpenBook={() => {}} />)
  const block = screen.getByTestId('exam-countdown')
  const days = daysBetween(todayStr(), '2028-02-18')
  const months = Math.floor(Math.max(days, 0) / 30)
  expect(block).toHaveTextContent('入学試験日まであと')
  expect(block).toHaveTextContent(`${Math.max(days, 0)}日`)
  expect(block).toHaveTextContent(`約${months}か月`)
  expect(block.textContent?.match(/あと/g)?.length).toBe(1)
})

it('clamps exam countdown to 0 days after the exam date', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2028, 1, 20))
  try {
    render(<HomeScreen onOpenBook={() => {}} />)
    const block = screen.getByTestId('exam-countdown')
    expect(block).toHaveTextContent('0日')
    expect(block).toHaveTextContent('約0か月')
  } finally {
    vi.useRealTimers()
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/HomeScreen.test.tsx -t "exam countdown"`
Expected: FAIL with "Unable to find an element by: [data-testid=\"exam-countdown\"]"

- [ ] **Step 3: Implement countdown block in `src/screens/HomeScreen.tsx`**

Signature・配置： `EXAM_COUNTDOWN_DATE = '2028-02-18'` をファイル内定数に追加し、`today` から `daysBetween(today, EXAM_COUNTDOWN_DATE)` で残日数、`Math.floor(Math.max(days,0)/30)` で約か月を算出。`return` 直後の最上部、`h1` の直上に `display:flex; align-items:baseline; gap:8px; flex-wrap:wrap` の `div data-testid="exam-countdown"` を追加。左spanは `fontSize:12, color:var(--text-dim)` で「入学試験日まであと」、中央spanは `fontSize:32, fontWeight:800, color:#111` で `{days}日`、右spanは `fontSize:12, color:var(--text-dim)` で `(約{months}か月)`。`days<0` は `0` に丸める。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/HomeScreen.test.tsx -t "exam countdown"`
Expected: PASS

- [ ] **Step 5: Run full HomeScreen suite and build**

Run: `npm test -- src/screens/HomeScreen.test.tsx`
Expected: PASS（既存テスト全件）

Run: `npm run build`
Expected: 成功（tsc + vite）

- [ ] **Step 6: Commit**

```bash
git add src/screens/HomeScreen.tsx src/screens/HomeScreen.test.tsx docs/superpowers/plans/2026-11-09-exam-countdown.md
git commit -m "feat: ホーム上部に入試カウントダウンを追加"
```
