# Mock History Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 模試履歴グラフ＋バッジ棚で成長実感を足す

**Architecture:** localStorage履歴＋純粋バッジ判定＋chart.js折れ線をRankingScreenに統合。既存順位計算を流用。

**Tech Stack:** React, chart.js/react-chartjs-2, vitest, localStorage

**Spec:** docs/superpowers/specs/2026-10-20-mock-history-design.md

## Global Constraints

- 下バーに何も追加しない
- S判定を付けない（A〜Eまで）
- 表記はすべて「仮想」
- サーバー送信なし、保存は端末内のみ
- 既存全テストのグリーン維持＋ビルド成功

---

### Task 1: 履歴ストア

**Files:**
- Create: `src/lib/mockHistory.ts`
- Test: `src/lib/mockHistory.test.ts`

**Interfaces:**
- Consumes: rank/deviation from `src/lib/ranking.ts`
- Produces: `MockRecord {ym, rank, deviation, pages}`, `loadMockHistory()`, `recordMockIfNeeded(today, rank, deviation, pages)`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 2: バッジ判定

**Files:**
- Create: `src/lib/mockBadges.ts`
- Test: `src/lib/mockBadges.test.ts`

**Interfaces:**
- Consumes: `MockRecord[]` from Task 1
- Produces: `listBadges(history)` -> `{id, name, unlocked, hint}[]` 5件

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 3: 画面統合

**Files:**
- Create: `src/components/MockHistoryChart.tsx`
- Modify: `src/screens/RankingScreen.tsx`
- Test: `src/screens/RankingScreen.test.tsx` に追記

**Interfaces:**
- Consumes: Task 1-2 の関数
- Produces: `data-testid="mock-history"`, `data-testid="mock-history-chart"`, `data-testid="mock-badges"`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**
