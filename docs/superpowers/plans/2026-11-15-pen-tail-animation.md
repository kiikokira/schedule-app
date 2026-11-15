# ペン尻欠け修正＋左→右一筆書き固定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 起動ロゴ（`OpeningSplash`）のペン尻が黒背景に溶けて消えかけに見える問題を直し、左ペン先→下端→右ペン先→下端の描画順を固定する。

**Architecture:** 実画像素ピクセル方式（`classifyPenPixels` + `drawFrame`）は維持し、分類時に金画素の alpha を 255 に正規化する（RGB 不変）。描画順は現行ロジックのままで回帰テストで固定する。

**Tech Stack:** React 18 + TypeScript + Canvas 2D, Vitest + Testing Library。

**Spec:** `docs/superpowers/specs/2026-11-15-pen-tail-animation-design.md`

## Global Constraints

- `public/keiologo-pens.png` はそのまま使う（実画像主義、トレース・描き直しなし）。
- `drawFrame(model, ..., 1, 1)` は元画像と RGB ピクセル一致（alpha のみ金の縁を 255 に正規化）。
- `prefers-reduced-motion` 対応・5秒で必ず `onDone` の保証は壊さない。
- 既存テスト `src/components/OpeningSplash.test.tsx` を維持・拡張する。
- モックHTML（`.superpowers/brainstorm/pen-options*.html`）は改修対象外。
- 16行の底辺空きパディング（y=256〜271）は仕様として残す（クロップしない）。
- 完了後は `npm.cmd run build` 成功を確認し、対象ファイルのみ `git add` して `main` にプッシュする（AGENTS.md 運用ルール）。

## Review Focus

- 実PNG由来の半透明の金の縁（RGB=241,196,0・alpha=16〜143）が完成フレームで不透明に描かれること → Task 1 のテストで固定。
- 左ペンが完了（p1=1）した時点で右ペン（p2=0）が一切描画されないこと → Task 2 のテストで固定。
- `drawFrame(1,1)` で全画素が RGB 一致すること → 既存 [C1] テスト（Task 3 の全 suite で確認）。
- reduced-motion 環境で静止完成形を即表示して `onDone` すること → 既存テスト（Task 3 の全 suite で確認）。
- 初回デコード不完全時は同画像の再読込ではなく `?retry=` 付き URL で再取得すること → 既存 [I4] テスト（Task 3 の全 suite で確認）。

---

### Task 1: 金画素 alpha 正規化（尻の消えかけ修正）

**Files:**
- Modify: `src/components/OpeningSplash.tsx`（`classifyPenPixels` 内の `px.push` の `a` フィールドのみ）
- Modify: `src/components/OpeningSplash.test.tsx`（新規テスト追加のみ）
- Test: `src/components/OpeningSplash.test.tsx`

**Interfaces:**
- Consumes: 既存 `classifyPenPixels(srcData: Uint8ClampedArray, W: number, H: number): PenModel`、`PenPixel` 型（`{ i, t1, t2, nib1, r, g, b, a }`）。
- Produces: `classifyPenPixels` が返す全 `PenPixel` の `a` が `255`（RGB は入力値のまま）。後続タスクはこの不変条件を利用する。

- [ ] **Step 1: Write the failing test**

  `src/components/OpeningSplash.test.tsx` の `describe('OpeningSplash fix round')` の末尾に以下を追加する（`makeSrcData` は金画素を alpha=255 で作るため使わず、生配列を自作する）。

```tsx
it('[tail] feathered gold edges (low alpha) are normalized to opaque', () => {
  const W = 4
  const H = 2
  const data = new Uint8ClampedArray(W * H * 4)
  const set = (x: number, y: number, a: number): void => {
    const o = (y * W + x) * 4
    data[o] = 241
    data[o + 1] = 196
    data[o + 2] = 0
    data[o + 3] = a
  }
  for (let x = 0; x < W; x++) set(x, 0, 255) // 上段: 不透明な金
  set(1, 1, 48)
  set(2, 1, 16) // 下段: 実PNGの尻の縁を再現した半透明の金
  const model = classifyPenPixels(data, W, H)
  expect(model.px.length).toBe(6)
  for (const p of model.px) {
    expect(p.a).toBe(255)
    expect([p.r, p.g, p.b]).toEqual([241, 196, 0])
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/components/OpeningSplash.test.tsx`
Expected: FAIL（`[tail]` テストのみ失敗：`p.a` が 48 / 16 のまま。既存テストは PASS）

- [ ] **Step 3: Implement alpha normalization in `classifyPenPixels` in `src/components/OpeningSplash.tsx`**

  `px.push` の `a` フィールドを `srcData[i + 3]` から `255` に変える（金画素は `isGoldPixel` を通過した画素のみなので、条件分岐は追加しない。RGB フィールドは変更しない）。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/components/OpeningSplash.test.tsx`
Expected: PASS（全テスト、既存 [C1]/[C2]/[I4]/[I5] を含む）

- [ ] **Step 5: Commit**

```bash
git add src/components/OpeningSplash.tsx src/components/OpeningSplash.test.tsx
git commit -m "fix: normalize gold pixel alpha so pen tails render opaque"
```

### Task 2: 左→右描画順の回帰テスト固定（ロジック変更なし想定）

**Files:**
- Modify: `src/components/OpeningSplash.test.tsx`（新規テスト追加のみ）
- Test: `src/components/OpeningSplash.test.tsx`

**Interfaces:**
- Consumes: 既存 `phaseProgress(el: number): { p1: number; p2: number }`、既存 `drawFrame`、Task 1 の不変条件（`a === 255`）。
- Produces: 描画順の仕様ピン留め（`el=0.35` で p1=1・p2=0、`drawFrame(..., 1, 0)` で nib1 のみ描画）。コード変更は不要の見込み。もしテストが失敗したら Task 1 に差し戻さず、このタスク内で `PHASE1_END`/`PHASE2_START` の最小修正に留める。

- [ ] **Step 1: Write the locking tests**

  同ファイルの `describe('OpeningSplash fix round')` の末尾に以下を追加する。

```tsx
it('[order] left pen finishes before right pen starts', () => {
  expect(phaseProgress(0.35)).toEqual({ p1: 1, p2: 0 })
  const early = phaseProgress(0.2)
  expect(early.p1).toBeGreaterThan(0)
  expect(early.p1).toBeLessThan(1)
  expect(early.p2).toBe(0)
  const late = phaseProgress(0.5)
  expect(late.p1).toBe(1)
  expect(late.p2).toBeGreaterThan(0)
})
```

```tsx
it('[order] drawFrame(1, 0) paints only the left (nib1) pen', () => {
  const W = 2
  const H = 1
  const model: PenModel = {
    W,
    H,
    px: [
      { i: 0, t1: 0.9, t2: 0.9, nib1: true, r: 241, g: 196, b: 0, a: 255 },
      { i: 4, t1: 0.1, t2: 0.1, nib1: false, r: 241, g: 196, b: 0, a: 255 },
    ],
  }
  let composed: { data: Uint8ClampedArray } | null = null
  const bctx = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: (img: { data: Uint8ClampedArray }) => { composed = img },
  }
  const cv = {
    width: 6, height: 3,
    getContext: () => ({ imageSmoothingEnabled: true, imageSmoothingQuality: 'high', clearRect: () => {}, fillRect: () => {}, drawImage: () => {} }),
  }
  drawFrame(model, {} as unknown as HTMLCanvasElement, bctx as unknown as CanvasRenderingContext2D, cv as unknown as HTMLCanvasElement, 1, 0)
  const d = (composed as unknown as { data: Uint8ClampedArray }).data
  expect(d[3]).toBe(255) // nib1 (left pen) fully painted
  expect(d[7]).toBe(0) // nib2 (right pen) untouched
})
```

  `phaseProgress` と `PenModel` 型は同ファイルから import する（既存 import 行に `phaseProgress` を追加）。

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- src/components/OpeningSplash.test.tsx`
Expected: PASS（現行ロジックは既に左→右順のため。新規テストが失敗した場合のみ `PHASE1_END`/`PHASE2_START`/`PHASE2_END` を仕様値 `0.3`/`0.45`/`0.83` に保ったまま最小修正し、再実行して PASS を確認）

- [ ] **Step 3: Commit**

```bash
git add src/components/OpeningSplash.test.tsx
git commit -m "test: lock left-to-right pen draw order in OpeningSplash"
```

### Task 3: 全テスト＋ビルド確認＋コミット＋プッシュ

**Files:**
- Modify: なし（新規ファイルなし。Task 1-2 で作った変更と `docs/superpowers/specs/2026-11-15-pen-tail-animation-design.md`・本プランファイルが対象）
- Test: 全 suite＋`npm.cmd run build`

**Interfaces:**
- Consumes: Task 1-2 のコミット済み変更。
- Produces: `main` へのプッシュ（スマホ反映）。AGENTS.md 運用ルールに従う。

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test`
Expected: PASS（全ファイル）

- [ ] **Step 2: Run the build**

Run: `npm.cmd run build`
Expected: 成功（`tsc -b && vite build` がエラーなしで終了）

- [ ] **Step 3: Commit remaining files and push**

```bash
git status --short
git add docs/superpowers/specs/2026-11-15-pen-tail-animation-design.md docs/superpowers/plans/2026-11-15-pen-tail-animation.md
git commit -m "docs: pen tail animation design and plan"
git push origin main
```

注意：`git add` は上記の対象ファイルのみに限定し、無関係ファイル（`dist/` 等のビルド成果物や一時ファイル）は含めない。`git status --short` で事前確認すること。`C:\Users\TEMP_A~1\AppData\Local\Temp\opencode\pngprobe*.cjs` はリポジトリ外の一時ファイルのためコミット対象外。
