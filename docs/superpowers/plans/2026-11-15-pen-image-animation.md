# 新画像ロゴの一筆書きアニメ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供画像を透過化した派生アセットに切り替え、画像サイズ追従の定数で左→右の一筆書きを再生する。

**Architecture:** 白背景除去は純粋関数 `removeWhiteBackground`（単体テスト付き）に切り出し、一時スクリプトで `public/keiologo-x.png` を生成。`OpeningSplash` の描画パイプラインは維持し、サイズ依存定数を高さ比例化＋`MIN_GOLD_PIXELS` 引下げ＋`isGoldPixel` に alpha 条件追加。

**Tech Stack:** React 18 + TypeScript + Canvas 2D, Vitest。アセット生成のみ Node（zlib）の使い捨てスクリプト。

**Spec:** `docs/superpowers/specs/2026-11-15-pen-image-animation-design.md`

## Global Constraints

- 透過化は白抜きのみ（RGB は不変。縁のハローは許容）。
- `drawFrame(..., 1, 1)` は派生アセットと RGB 一致（Task 1 の alpha 正規化の性質を維持）。
- `prefers-reduced-motion`・5秒 `onDone`・`?retry=` 再取得の保証は維持。
- 既存テストの前提を壊さないこと。比例化で振る舞いが変わるテストがある場合は更新してよいが、理由を記録する。
- 旧 `keiologo-pens.png` は削除せず残す。モックHTMLは改修対象外。
- 完了後は `npm.cmd run build` 成功確認、対象ファイルのみ `git add` して `main` へプッシュ。
- PowerShell の ExecutionPolicy により `npm.ps1` は起動不可のため、コマンドは `npm.cmd` を使うこと。

## Review Focus

- 白背景の残骸（alpha=0・RGB高値）が金画素に誤分類され、白い四角が出ないこと → Task 2 のテスト(a)で固定。
- 123×105級の小画像でも上下分割が働き、左右ペンが正しく割り当てられること → Task 2 のテスト(b)で固定。
- 透過化で金の RGB が変わらず、白が完全透明（RGB ゼロ）になること → Task 1 のテストで固定。
- 完成フレーム RGB 一致・reduced-motion・5秒 `onDone` の既存保証が壊れないこと → 同一ファイルの既存テスト（Task 3 の focused 実行で確認）。
- 不完全デコード時に `?retry=` 再取得が低しきい値でも働くこと → 既存 [I4] テスト（Task 3 の focused 実行で確認）。

---

### Task 1: 白背景除去関数＋派生アセット生成

**Files:**
- Create: `src/lib/removeWhiteBackground.ts`
- Create: `src/lib/removeWhiteBackground.test.ts`
- Create: `public/keiologo-x.png`（使い捨て生成スクリプトの出力。スクリプト自体は `C:\Users\TEMP_A~1\AppData\Local\Temp\opencode\` に置きコミットしない）
- Test: `src/lib/removeWhiteBackground.test.ts`

**Interfaces:**
- Consumes: なし（新規）。
- Produces: `removeWhiteBackground(src: Uint8ClampedArray, W: number, H: number): Uint8ClampedArray`（入力は不変、新配列を返す。`min(r,g,b) > 200` の画素は RGB を 0・alpha を 0 にする。それ以外は RGBA 不変）。`public/keiologo-x.png`（123×105・透過。Task 2 が `LOGO_SRC` で参照）。

- [ ] **Step 1: Write the failing test**

```tsx
it('removes near-white background and keeps gold pixels', () => {
  const W = 3
  const H = 1
  const src = new Uint8ClampedArray([
    242, 244, 248, 255, // 背景白 → 透明化
    241, 196, 0, 255, // 金 → 不変
    241, 220, 124, 255, // 縁ブレンド → 保持（ハロー許容）
  ])
  const out = removeWhiteBackground(src, W, H)
  expect(Array.from(out.slice(0, 4))).toEqual([0, 0, 0, 0])
  expect(Array.from(out.slice(4, 8))).toEqual([241, 196, 0, 255])
  expect(Array.from(out.slice(8, 12))).toEqual([241, 220, 124, 255])
  expect(Array.from(src.slice(0, 4))).toEqual([242, 244, 248, 255]) // 入力不変
})
```

`removeWhiteBackground` は `./removeWhiteBackground` から import する。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/lib/removeWhiteBackground.test.ts`
Expected: FAIL（`removeWhiteBackground` 未定義）

- [ ] **Step 3: Implement `removeWhiteBackground` in `src/lib/removeWhiteBackground.ts`**

  シグネチャは Interfaces の通り。しきい値は `WHITE_MIN = 200`（`Math.min(r, g, b) > 200` を透明化）。1画素ずつの単純ループでよい。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/lib/removeWhiteBackground.test.ts`
Expected: PASS

- [ ] **Step 5: Generate `public/keiologo-x.png` with a throwaway script**

  使い捨て Node スクリプト（zlib で `public/スクリーンショット 2026-11-14 221850.png` をデコード→同ルール適用→無フィルタ RGBA で PNG エンコード→`public/keiologo-x.png` に保存）を temp dir に書いて実行し、以下を出力確認する：寸法 123×105、金画素数（透過後に `maxRGB>16 && a>0` の画素が 1000 を十分上回ること）、背景画素の alpha=0。スクリプトはコミットしない。

- [ ] **Step 6: Commit**

```bash
git add src/lib/removeWhiteBackground.ts src/lib/removeWhiteBackground.test.ts public/keiologo-x.png
git commit -m "feat: add bg-removed keiologo-x asset and remover"
```

### Task 2: 新アセット切替＋定数のサイズ追従

**Files:**
- Modify: `src/components/OpeningSplash.tsx`（`LOGO_SRC`、定数、`isGoldPixel`、ソースコメントのみ）
- Modify: `src/components/OpeningSplash.test.tsx`（新規テスト2件追加のみ。既存テストの置換・削除は原則禁止）
- Test: `src/components/OpeningSplash.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `public/keiologo-x.png`、`PenPixel.a === 255` 不変条件（前planより）。
- Produces: 新画像での左→右描画順。`PHASE` 系の時間配分は変更しない。

- [ ] **Step 1: Write the locking tests**

  同ファイルの `describe('OpeningSplash fix round')` の末尾に以下2件を追加する。

```tsx
it('[ximg] fully transparent white remnants are not gold', () => {
  const W = 4
  const H = 1
  const data = new Uint8ClampedArray(W * H * 4)
  const set = (x: number, r: number, g: number, b: number, a: number): void => {
    const o = x * 4
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
    data[o + 3] = a
  }
  set(0, 241, 196, 0, 255)
  set(1, 241, 196, 0, 255)
  set(2, 242, 244, 248, 0) // 除去済み背景
  set(3, 242, 244, 248, 0)
  const model = classifyPenPixels(data, W, H)
  expect(model.px.length).toBe(2)
})
```

```tsx
it('[ximg] small image splits upper/lower and assigns pens', () => {
  const W = 30
  const H = 105
  const data = new Uint8ClampedArray(W * H * 4)
  const gold = (x: number, y: number): void => {
    const o = (y * W + x) * 4
    data[o] = 241
    data[o + 1] = 196
    data[o + 2] = 0
    data[o + 3] = 255
  }
  for (let x = 2; x <= 6; x++) for (let y = 5; y <= 15; y++) gold(x, y)
  for (let x = 20; x <= 26; x++) for (let y = 5; y <= 15; y++) gold(x, y)
  for (let x = 2; x <= 6; x++) for (let y = 80; y <= 95; y++) gold(x, y)
  for (let x = 20; x <= 26; x++) for (let y = 80; y <= 95; y++) gold(x, y)
  const model = classifyPenPixels(data, W, H)
  const nib1At = (x: number, y: number): boolean => {
    const hit = model.px.find((p) => p.i === (y * W + x) * 4)
    if (!hit) throw new Error(`expected gold pixel at (${x},${y})`)
    return hit.nib1
  }
  expect(nib1At(4, 10)).toBe(true) // 上段左 = pen1
  expect(nib1At(23, 10)).toBe(false) // 上段右 = pen2
  expect(nib1At(4, 88)).toBe(false) // 下段左 = pen2
  expect(nib1At(23, 88)).toBe(true) // 下段右 = pen1
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- src/components/OpeningSplash.test.tsx`
Expected: FAIL（`[ximg]` 2件のみ失敗。理由：`isGoldPixel` が alpha を見ないため背景残骸を金と数える、`TOP_BOTTOM_SPLIT_Y=150` が H=105 を上回り全行が上段扱いになる）

- [ ] **Step 3: Implement in `src/components/OpeningSplash.tsx`**

  - `LOGO_SRC` を `'./keiologo-x.png'` に変更し、直上のソースコメントのファイル名も更新する。
  - `TOP_BOTTOM_SPLIT_Y`、`ZONE_Y0`、`ZONE_Y1` を高さ比例にする（`Math.round(H * 150 / 272)`、`Math.round(H * 100 / 272)`、`Math.round(H * 210 / 272)`。H=272 で旧値と一致する式にすること）。
  - `MIN_GOLD_PIXELS` を `20000` から `1000` に変更する。
  - `isGoldPixel` に alpha 条件を追加する（`a > 0 && maxRGB > 16`）。`GOLD_THRESHOLD`・`PHASE` 系・`SLIT/EDGE` の絶対値・描画式は変更しない。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- src/components/OpeningSplash.test.tsx`
Expected: PASS（全テスト。新旧含む。万一既存テストが新定数で壊れた場合は最小限の更新に留め、理由をレポートに記録する）

- [ ] **Step 5: Commit**

```bash
git add src/components/OpeningSplash.tsx src/components/OpeningSplash.test.tsx
git commit -m "feat: switch opening logo to keiologo-x with size-relative constants"
```

### Task 3: focused 検証＋ビルド＋コミット＋プッシュ

**Files:**
- Commit対象: `docs/superpowers/specs/2026-11-15-pen-image-animation-design.md`、本プランファイル（`git status --short` で事前確認し、無関係ファイルは含めない）
- Test: `npm.cmd test -- src/components/OpeningSplash.test.tsx` ＋ `npm.cmd test -- src/lib/removeWhiteBackground.test.ts` ＋ `npm.cmd run build`

**Interfaces:**
- Consumes: Task 1-2 のコミット済み変更。
- Produces: `main` へのプッシュ。

- [ ] **Step 1: Run the focused suites**

Run: `npm.cmd test -- src/components/OpeningSplash.test.tsx src/lib/removeWhiteBackground.test.ts`
Expected: PASS（全件。前planの ruling R4 により、文字通りの全suite PASS は要求しない。失敗は本plan起因の既存衛生問題に限る）

- [ ] **Step 2: Run the build**

Run: `npm.cmd run build`
Expected: 成功（`tsc -b && vite build` がエラーなしで終了）

- [ ] **Step 3: Commit remaining files and push**

```bash
git status --short
git add docs/superpowers/specs/2026-11-15-pen-image-animation-design.md docs/superpowers/plans/2026-11-15-pen-image-animation.md
git commit -m "docs: pen image animation design and plan"
git push origin main
```
