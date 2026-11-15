# Keio Opening 一筆書き Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ初回起動時に実ロゴ一筆書きの5秒ブロッキングオープニングを表示する。

**Architecture:** `src/components/OpeningSplash.tsx`（実ロゴCanvas＋rAF約5秒・操作ブロック専用）に表示判定ロジックを持たせ、`src/App.tsx` の初回マウントでのみ条件付き表示する。前回表示時刻は `localStorage` に保存し、6時間経過でのみ再表示する。

**Tech Stack:** React 18 + TypeScript + Canvas 2D + rAF + Vitest (fake timers) + Vite

**Spec:** `docs/superpowers/specs/2026-11-14-keio-opening-design.md`（実ロゴ一筆書き・改訂版）

## Global Constraints

- 対象ファイルのみ `git add` する（無関係ファイルを含めない）。
- プッシュ前に `npm run build` が成功すること。
- 完成したら `main` にプッシュしてスマホ反映まで行う（プッシュ前の許可取りは不要・ユーザーの恒常指示）。
- `src/App.tsx` の初回マウントでのみ判定する（画面遷移では出さない）。
- `public/keiologo-pens.png`（実ロゴ切り出し）をそのまま使う。トレース・自作SVGの上書き・文字・音・外部画像の追加なし。
- 分割は画像ピクセル由来の実測縁（行単位の輪郭検出＋補間）のみ。幾何学的仮定（直線・固定幅）で切らない。
- 描画はCanvas＋rAF。CSSアニメーションに依存しない。
- 高DPIでは3倍バッファ＋双線形補間で滑らかに描画する。
- `prefers-reduced-motion: reduce` では静止画（完成ロゴ表示）ですぐホーム（5秒待たせない）。
- `localStorage` 不可時は表示する側に倒す（初回扱い）。
- 画像の読み込み完了を確認してから解析・再生する（未完成デコードでの描画禁止）。
- 定数: `OPENING_DURATION_MS = 5000`、`OPENING_INTERVAL_MS = 6*60*60*1000`、`OPENING_STORAGE_KEY = 'keio-opening-last-shown'`。

## Review Focus

- 6時間以内の再起動でアニメが出ず即ホームになること（何度も5秒待たされない）を期待する。
- 表示中はタップ・スクロール・フッター操作が一切通らないこと（オーバーレイが全操作をブロック）を期待する。
- 約5秒で必ず消えてホームが触れるようになること（固まって残らない）を期待する。
- 1本目の描画中に2本目の破片が出ないこと（1本目の輪郭内に収まること）を期待する。
- 1本目の描画が終わった時点で欠けがないこと（2本目の描画で埋め合わせが発生しないこと）を期待する。
- 終了形が実画像そのものと一致すること（中間生成物との差し替え・重ね描きがないこと）を期待する。
- OSの「動きを減らす」設定では5秒待たされずすぐホームが出ることを期待する。
- プライベートモード等で `localStorage` が使えなくても起動が壊れず初回扱いで表示されることを期待する。

---

### Task 1: OpeningSplash component

**Files:**
- Create: `src/components/OpeningSplash.tsx`
- Create: `src/components/OpeningSplash.test.tsx`
- Add: `public/keiologo-pens.png`（`public/keiologo.png` からのペン部分切り出し）
- Modify: `src/styles.css`（オーバーレイ土台のみ。キーフレーム方式は使わない）

**Interfaces:**
- Consumes: `public/keiologo-pens.png`（実ロゴ画像そのもの）
- Produces: `OpeningSplash({ onDone }: { onDone: () => void })`、描画中は `data-testid="keio-opening"` の全画面オーバーレイ＋内部 `canvas`（`data-testid="keio-opening-canvas"`）。CSSアニメーション不使用（rAF駆動のため環境差で止まらない）。

**分類アルゴリズム（実測縁ベース・幾何仮定なし・必須）:**
- 画像を行走査し、連続した金ピクセル塊を検出する（途切れ幅のしきい値はゾーン依存：y∈[100,210]では6px未満をスリットとして同一視、それ以外では12px未満。交差部の6-8px帯を測定に残すため）。
- 上部（y<150）：左の塊＝1本目。右の塊との間に黒帯（ゾーン内6px以上・外10px以上）があれば右端を1本目の右縁として記録。
- 下部（y>=150）：右の塊＝1本目。左に黒帯（ゾーン内6px以上・外10px以上）があれば左端を1本目の左縁として記録。
- 測定できない行は両側の測定値から直線補間する（曲線近似なし・階段状の境界禁止）。
- 分類：`Li[y]-1 <= x <= Ri[y]+1` の金ピクセルが1本目、それ以外が2本目。重複なし（2回目での塗りつぶし禁止）。
- t順序：各筆の軸方向投影（1本目：左上→右下、2本目：右上→左下方向）。フェーズ1（0-30%）→保持（30-45%）→フェーズ2（45-83%）→保持→終了（約5秒）。
- 先端グロー・featherは本体を侵さない範囲のみ。

- [ ] **Step 1: Write the failing test**

```tsx
it('calls onDone after 5s and blocks pointer events', () => {
  vi.useFakeTimers()
  const onDone = vi.fn()
  render(<OpeningSplash onDone={onDone} />)
  const overlay = screen.getByTestId('keio-opening')
  expect(overlay).toBeInTheDocument()
  expect(overlay).toHaveStyle({ pointerEvents: 'all' })
  expect(screen.getByTestId('keio-opening-canvas')).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(4999) })
  expect(onDone).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(1) })
  expect(onDone).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})

it('respects reduced motion by finishing immediately', () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })
  const onDone = vi.fn()
  render(<OpeningSplash onDone={onDone} />)
  expect(screen.getByTestId('keio-opening')).toBeInTheDocument()
  expect(onDone).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/OpeningSplash.test.tsx -t "calls onDone after 5s"`
Expected: FAIL with "Unable to find an element by: [data-testid="keio-opening"]" or module not found

- [ ] **Step 3: Implement `OpeningSplash({ onDone }: { onDone: () => void })` in `src/components/OpeningSplash.tsx`**

`data-testid="keio-opening"` の fixed 全画面オーバーレイ（`position:fixed; inset:0; z-index:9999; pointer-events:all`＋スクロール抑止）。`public/keiologo-pens.png` を `Image` で読み、デコード完了を待ってから `getImageData` で解析する（未完成デコードでの描画禁止＋金ピクセル数チェック）。上記分類アルゴリズムで1本目/2本目に分け、rAFでフェーズ1（1本目 tip→base）→保持→フェーズ2（2本目 tip→base）→保持→約 `5000ms` で `onDone` を1回呼ぶ。描画は `devicePixelRatio` 対応の高解像度Canvas＋双線形補間。クリーンアップでrAF解除。`prefers-reduced-motion: reduce` 検出時は静止画（完成ロゴ）を即表示して即 `onDone`（タイマ5秒を待たない）。

- [ ] **Step 4: Add overlay base styles to `src/styles.css`**

オーバーレイ土台（配置・pointer-events・スクロール抑止）のみ。キーフレームによる描画アニメは使わない（rAF駆動のため）。

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/OpeningSplash.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/OpeningSplash.tsx src/components/OpeningSplash.test.tsx src/styles.css public/keiologo-pens.png
git commit -m "feat: 実ロゴ一筆書きの5秒オープニングを追加"
```

### Task 2: App integration with 6h gating

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `OpeningSplash({ onDone })` from Task 1、定数 `OPENING_DURATION_MS = 5000` / `OPENING_INTERVAL_MS = 6*60*60*1000` / `OPENING_STORAGE_KEY = 'keio-opening-last-shown'`（`src/App.tsx` 内定数でよい）
- Produces: 初回マウント時のみ表示判定。表示中は `OpeningSplash` を重ね、終了で非表示。以後の画面遷移では再表示しない。

- [ ] **Step 1: Write the failing test**

```tsx
it('shows opening on first launch and skips within 6h', () => {
  localStorage.clear()
  const { unmount } = render(<App />)
  expect(screen.getByTestId('keio-opening')).toBeInTheDocument()
  unmount()
  localStorage.setItem('keio-opening-last-shown', String(Date.now()))
  render(<App />)
  expect(screen.queryByTestId('keio-opening')).toBeNull()
})

it('shows opening when storage is unavailable', () => {
  const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
  render(<App />)
  expect(screen.getByTestId('keio-opening')).toBeInTheDocument()
  getItem.mockRestore()
  setItem.mockRestore()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx -t "shows opening on first launch"`
Expected: FAIL with "Unable to find an element by: [data-testid="keio-opening"]"

- [ ] **Step 3: Implement gating in `src/App.tsx`**

初回マウント時（`useState` 初期値＋`useEffect` 空依存で1回だけ判定）に `localStorage.getItem('keio-opening-last-shown')` を読む。欠落・parse失敗・`localStorage` 例外時は表示する。表示開始時に `setItem(KEY, String(Date.now()))` を記録。`onDone` で非表示化。`route` 変更では再判定しない。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/App.test.tsx src/components/OpeningSplash.test.tsx`
Expected: PASS（既存テスト全件が5秒待ちで壊れないこと。必要なら既存テストの先頭で `localStorage.setItem('keio-opening-last-shown', String(Date.now()))` によりスキップさせる）

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: 6時間経過時のみオープニングを表示"
```

### Task 3: Build + browser preview before smartphone release

**Files:**
- Modify: なし（検証のみ。失敗があれば該当タスクに戻す）

**Interfaces:**
- Consumes: Task 1-2 の完成コード
- Produces: ブラウザ目視OK＋`main` プッシュ（スマホ反映）

- [ ] **Step 1: Run full tests**

Run: `npm test -- --run`
Expected: PASS（全件。git-ignoredな重複コピー配下のテストは対象外とし、正規 `src/` のみで判定する）

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: 成功（tsc + vite）

- [ ] **Step 3: Browser preview for user check**

Run: `npm run preview -- --port 4173 --strictPort --host 0.0.0.0`
Expected: 起動成功。`http://localhost:4173/`（PC）または同LANのスマホから `http://<PC-IP>:4173/` を開く（`vite preview` は `dist/` をサーバ直下に配信するため `/schedule-app/` 付きURLではアセットが404になる。`base:'./'` のためルートで開くこと）。初回5秒ブロッキング表示（実ロゴ一筆書き：左上→右下→右上→左下）→ホーム操作可能、リロード直後は非表示、6時間条件の動作を目視で確認する。スマホ反映（`main` プッシュ）はこの目視OKが出るまで行わない。目視時は固定フレーム確認（`?p1=1&p2=0` 等）も併用可。

- [ ] **Step 4: Push to main (after preview OK)**

```bash
git push origin main
```

Expected: 成功し、GitHub Actions のデプロイが開始されること
