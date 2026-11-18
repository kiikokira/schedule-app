# 罰センター見やすさ改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 罰センターを見やすくする（数字強調＋間隔拡大、C+D）

**Architecture:** `PenaltyScreen.tsx` の見た目のみ変更。ロジック・集計・testid不変。2x2サマリーカード＋返済ヘッダー＋行カード化で階層を作る。

**Tech Stack:** React + TypeScript + inline style（既存踏襲）、Vitest、Vite build

**Spec:** docs/superpowers/specs/2026-11-18-penalty-readability-design.md

## Global Constraints
- ロジック変更禁止（`penalty.ts` / `penaltyEvaluate.ts` / 按分計算に触らない）
- 全 `data-testid` を維持する（`penalty-page`, `penalty-debt-*`, `penalty-history-*`, `penalty-severity-select`, `penalty-banner-toggle`, `penalty-back`）
- 360px幅で折返し可、固定幅なし
- 既存CSS変数を使う（`--surface`, `--border`, `--text-dim`, `--danger` 流用可、ハードコード赤は `#c44b4b` のみ）
- タップ高さ44px維持（select / checkbox / button）
- 仕上げに `npm run build` 成功必須

## Review Focus（各行の担保タスク）
- 借金0件時に「完済」表示が崩れず読めること → Task 2 Step 4で空状態目視（借金0・履歴0の両方）
- 履歴が0件・100件でも崩れないこと（最新3件強調の境界） → Task 2 Step 4で件数境界目視＋既存ソートテストPASS
- ランクS〜D全色でコントラスト確保 → Task 1 Step 3で5色目視（白文字＋濃色のみ使用）
- 360px幅で2x2がはみ出さないこと → Task 1 Step 3で360px目視（grid 1fr 1fr＋固定幅なし）
- 既存テスト文言マッチが壊れないこと → Task 1 Step 3・Task 2 Step 4で既存PenaltyScreenテストPASS

---

### Task 1: サマリー＋返済ヘッダーのヒーロー化

**Files:**
- Modify: `src/screens/PenaltyScreen.tsx`
- Test: `src/screens/PenaltyScreen.test.tsx`（既存のみ）

**Interfaces:**
- Consumes: `summarizeRecentPenalties(events, todayStr())` の `{ outstanding, totalPoints, streak, rank }`（変更なし）
- Produces: サマリー2x2グリッド＋返済ヘッダーの表示仕様（Task 2はこの余白 scale に合わせる: セクション間24px、カードradius 8-12px）

- [ ] **Step 1: 既存テストの現状確認**

Run: `npm test -- src/screens/PenaltyScreen.test.tsx --run`
Expected: PASS（8件前後、変更前の基準）

- [ ] **Step 2: サマリーを2x2グリッド＋返済ヘッダーに変更**

Implement `PenaltyScreen.tsx` の要約部のみ:
- 外枠 `div[data-testid=penalty-page]` の padding を 20に、セクション間は marginTop 24で統一
- 要約 `p` を削除し、4枚白カードの grid（`display:grid, gridTemplateColumns:1fr 1fr, gap:8`）に置換。各カード: 背景白、border `#e5e0e0`、radius 10、padding 12。ラベル12px `#6b7280`、値20px 800
- ランク値のみ色バッジ化（S:#16a34a, A:#2563eb, B:#ca8a04, C:#ea580c, D:#dc2626、白文字、radius 999、padding 2 8）。借金0なら緑バッジ「完済！」併記ではなく値0＋バッジなしでも可、仕様は「借金0なら値緑化」
- サマリー直下に返済ヘッダー `今日返す: +{outstanding}ページ` を16px 800で追加（outstandingは既存変数をそのまま表示）
- `data-testid` は追加しても既存は削除・改名しない

- [ ] **Step 3: 目視＋テスト＋ビルド確認**

Run: `npm test -- src/screens/PenaltyScreen.test.tsx --run`
Expected: PASS
Run: `npm run build`
Expected: 成功。目視（360px幅）で2x2がはみ出さないこと

- [ ] **Step 4: Commit**

```bash
git add src/screens/PenaltyScreen.tsx
git commit -m "style(penalty): hero summary with 2x2 cards and quest header"
```

### Task 2: 借金一覧＋履歴＋設定の行カード化と間隔拡大

**Files:**
- Modify: `src/screens/PenaltyScreen.tsx`
- Test: `src/screens/PenaltyScreen.test.tsx`（既存のみ）

**Interfaces:**
- Consumes: Task 1の余白 scale（セクション間24px、カードradius 8-12、値太字20px基準）
- Produces: 完成した罰センター表示全体

- [ ] **Step 1: 借金一覧を行カード＋多い順＋先頭バッジに変更**

Implement `PenaltyScreen.tsx` の借金一覧部のみ:
- `[...debtByBook.entries()]` をページ数降順ソートして表示（テストの按分合計は不変、順序のみ変更）
- 各行を白カード化（背景白、border、radius 8、padding 12、marginBottom 8、lineHeight 1.6）
- 本名14px通常、借金ページ数16px 800、区画は12pxグレー小バッジ（`+X区画`）
- 先頭行のみ「まずこれ」赤バッジ（`#dc2626` 白文字、12px、radius 999）を先頭に付与。借金0件時は現文言「借金はありません」維持

- [ ] **Step 2: 履歴を3要素分離＋最新3件強調に変更**

Implement `PenaltyScreen.tsx` の履歴部のみ:
- 各行を白カード化（padding 10-12、marginBottom 8、lineHeight 1.6）
- 1行内を「日付12px `#6b7280`｜ +XXpt赤バッジ（`#dc2626`背景白文字、12px 700）｜ 借金Xページ14px 700」の3要素に分離（flex gap 8、折返し可）
- `sorted` の index >=3 は opacity 0.75で薄くする。ソート順・testid（`penalty-history-{date}`）は不変

- [ ] **Step 3: 設定の余白分離**

Implement `PenaltyScreen.tsx` の設定部のみ:
- sectionの marginTop 24＋上 border（`1px solid #e5d5d5`）＋paddingTop 16で分離
- 見出し16px 700＋下線なし、select・checkbox・buttonは現行維持（44pxタップ）。「今日に戻る」buttonの marginTop 20

- [ ] **Step 4: 最終確認**

Run: `npm test -- src/screens/PenaltyScreen.test.tsx --run`
Expected: PASS
Run: `npm run build`
Expected: 成功。スクショ相当（借金・履歴・設定）が詰まらず読めること

- [ ] **Step 5: Commit**

```bash
git add src/screens/PenaltyScreen.tsx
git commit -m "style(penalty): card rows for debts/history and section spacing"
```
