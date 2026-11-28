# SFCキャンパスRPG 地図・道・キャラ・移動の作り直し 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 大学部分拡大（バリアフリーマップ2ページ目）から地形グリッドを色で作り、道の割り込みをなくした地図・連続したキャラ・指のドラッグ移動・実際の地形を描いた全体マップにする。

**Architecture:** 開発用スクリプトが `artifacts/sfc-campus-source/daigaku-bubun.png` を読み、1マス=8単位の地形グリッド（`src/lib/sfcCampusGrid.ts`、生成物をコミット）を作る。ゲーム側はグリッドから建物・当たり判定・ホットスポット・ラベルを導出し、同じグリッドを描画（地形タイル）と全体マップに使う。移動は指の位置を基準にしたスティック（純粋関数）で行う。

**Tech Stack:** TypeScript 5.5, React 18, Vite 5, vitest, Canvas 2D。開発依存は `pngjs` のみ追加する。

**Spec:** `docs/superpowers/specs/2026-11-28-sfc-campus-map-fix-design.md`（承認済み。対象は村を除く大学部分拡大のみ）

## Global Constraints

- 1マス = 8単位（`CAMPUS_CELL = 8`）。グリッドは 185 列 × 148 行（`CAMPUS_COLS = 185`, `CAMPUS_ROWS = 148`）。マップは 1480 × 1184 単位（`MAP_W = 1480`, `MAP_H = 1184`）。
- 地形文字（グリッドの各文字）: `.` 草地、`=` 石道、`:` 土（池の岸と外周の内側1マス）、`~` 池、`#` 崖（外周の外側6マス）、`n` 名前のない建物、`S K E I O L M U T W Y A` は名前のある建物（対応は下の表）。
- 建物の文字と ID: `S`=sigma-cafeteria（Σ生協食堂）、`K`=kappa（κ館）、`E`=epsilon（ε館）、`I`=iota（ι館）、`O`=omicron（ο館）、`L`=lambda（λ館）、`M`=mu（Μメディアセンター）、`U`=lounge（学生ラウンジ）、`T`=theta（Θ館）、`W`=omega（Ω館）、`Y`=tau（τ大学院棟）、`A`=alpha（Α本館）。`n` は連結領域ごとに `unnamed-1`, `unnamed-2`, … を割り当てる（名前なし、ラベルなし）。
- ブロックするマス: `#`、`~`、建物の文字すべて。`.`、`=`、`:` は歩ける。木の幹は `placeTrees` の結果から円として作る（グリッドからは導出しない）。
- 当たり判定の半径は `PLAYER_RADIUS = 6`（既存のまま）。`collides`の判定式は変えない。
- 建物の入口は南の辺の中央から2マス外（`entrance = { x: (c0+c1+1)/2 * 8, y: (r1 + 1 + 2) * 8 }`。`c0,c1,r1` は建物の左端列、右端列、下端行、いずれも包含）。入口マスは歩行可能であること。
- A*の刻みは 8（`findPath(..., 8)`、`nearestWalkable(..., 8)`）。
- スティック: 最大半径 `STICK_MAX_PX = 40`（CSS px）、タップ判定は移動量 `< TAP_MAX_PX = 10` かつ時間 `< TAP_MAX_MS = 250`。
- 既存のEXP、クエストの枠（最大4件）、TodayPlan/BookDetailへの遷移は変えない。
- 外部画像（PDFや画像）を背景として描画に使わない。描画はコードで行う。
- 対象ファイルのみ `git add`。`npm run build` が成功してから `main` にプッシュする（AGENTS.md）。

## Review Focus

1. 建物の入口が歩けない（半径判定で入れない） → Task 3 テスト「全入口が歩行可能」。
2. 道網が細い隙間で分断され、一部のホットスポットに行けない → Task 4 テスト「道の全マスが連結」。
3. スティック中に指が離れた・キャンセルされた場合に、キャラが歩き続ける → Task 7 テスト「pointercancel で停止」。
4. ホットスポットの上でドラッグを始めた場合、開くのか歩くのかが不定になる → Task 7 テスト「ドラッグ後はホットスポットを開かない」。
5. 池の中や木の幹に入ってしまう（グリッドの境界ずれ） → Task 4 テスト「池と建物の内部はブロック」、Task 5 テスト「木は草地の上だけ」。

## File Structure

- Create: `scripts/build-campus-grid.mjs`（生成スクリプト、開発用）
- Create: `artifacts/sfc-campus-source/daigaku-bubun.png`（大学部分拡大の入力画像。`pdfx/pages/page-2.png` のコピー）
- Create: `artifacts/sfc-campus-source/preview.txt`（生成結果の文字プレビュー）
- Generate/Overwrite: `src/lib/sfcCampusGrid.ts`（地形グリッドの生成物。手で編集しない）
- Create: `src/lib/sfcCampusGridQuery.ts`（グリッドの問い合わせ：マス判定、建物の導出、入口、ブロック矩形、道の列挙）
- Create: `src/lib/sfcCampusGridQuery.test.ts`
- Modify (rewrite): `src/lib/sfcCampusLayout.ts`（グリッドから導出する建物一覧と名前の対応。旧 paths/pond/cliffs/treeZones は削除）
- Modify (rewrite): `src/lib/sfcCampusMap.ts`（BLOCKERS、HOTSPOTS、LABELS、AREA_LABELS、SPAWN）
- Modify: `src/lib/sfcCampusMap.test.ts`、`src/lib/sfcCampusLayout.test.ts`
- Modify (rewrite): `src/lib/sfcCampusArt.ts`（地形タイル描画。建物・木・小物はグリッドの問い合わせを使う）
- Modify: `src/lib/sfcCampusArt.test.ts`
- Modify (rewrite): `src/lib/sfcCampusSprite.ts`（24×32の一体シルエット、リュックなし）
- Create: `src/lib/sfcCampusSprite.test.ts`（既存があれば更新）
- Create: `src/lib/sfcCampusStick.ts`、`src/lib/sfcCampusStick.test.ts`
- Modify: `src/lib/sfcCampusMovement.ts`（`PolyBlocker` と `insidePolygon`/`segmentDistance` を削除。速度スケール用の引数は使わず、呼び出し側で扱う）
- Modify: `src/lib/sfcCampusMovement.test.ts`（poly のテストを削除）
- Modify: `src/components/SfcCampusCanvas.tsx`（ポインタ操作、スティック、タップ判定、描画の入力変更、デバッグ描画）
- Modify: `src/components/SfcCampusCanvas.test.tsx`
- Create: `src/components/SfcCampusFullMap.tsx`（全体マップ。地形描画を縮小表示）
- Modify: `src/components/SfcCampusRpg.tsx`（D-pad削除、全体マップ差し替え、説明文の更新）
- Modify: `src/components/SfcCampusRpg.test.tsx`
- Modify: `src/screens/RankingScreen.test.tsx`（D-padのテストIDを参照している場合のみ）
- Modify: `package.json`、`package-lock.json`（`pngjs` 開発依存の追加）

## Interfaces（全タスク共通）

- `sfcCampusGrid.ts`（生成物）: `export const CAMPUS_CELL = 8`、`export const CAMPUS_COLS = 185`、`export const CAMPUS_ROWS = 148`、`export const CAMPUS_GRID: readonly string[]`（長さ148、各行は長さ185）、`export const CAMPUS_NAMIKI_CELL: { col: number; row: number }`（並木道の看板のマス）、`export const CAMPUS_KAMOIKE_CELL: { col: number; row: number }`（鴨池のマス）、`export const CAMPUS_SPAWN_CELL: { col: number; row: number }`（正門前の主人公の初期位置）。
- `sfcCampusGridQuery.ts`:
  - `cellAt(col: number, row: number): string`（範囲外は `'#'`）
  - `cellAtPoint(x: number, y: number): string`（`cellAt(floor(x/8), floor(y/8))`）
  - `isRoadCell(ch: string): boolean`（`=` のみ）
  - `isBlockedCell(ch: string): boolean`（`#`、`~`、建物の文字）
  - `buildingsFromGrid(): GridBuilding[]`，`GridBuilding = { id: string; name: string | null; c0: number; c1: number; r0: number; r1: number; entrance: { x: number; y: number } }`（`name` は名前なしは null。`entrance` は単位座標）
  - `blockerRects(): RectBlocker[]`（建物・池・崖の連結マスを縦横に貪欲にまとめた `{kind:'rect', x, y, w, h}`。単位座標）
  - `roadCellCenters(): Point[]`（道マスの中心の一覧）
- `sfcCampusLayout.ts`: `export const CAMPUS_LAYOUT: { width: number; height: number; buildings: CampusBuilding[] }`、`export type CampusBuilding = { id: string; name: string | null; x: number; y: number; w: number; h: number; roof: RoofStyle; entrance: CampusPoint }`、`export function buildingById(id: string): CampusBuilding | undefined`。`RoofStyle` は既存のまま（`'red' | 'blue' | 'ochre' | 'gray' | 'brown'`）。屋根色はID単位の表で決める（名前ありは既存の屋根色を引き継ぎ、名前なしは `'gray'`）。
- `sfcCampusStick.ts`: `export const STICK_MAX_PX = 40`、`export const TAP_MAX_PX = 10`、`export const TAP_MAX_MS = 250`、`export function stickVector(anchor: Point, pointer: Point, maxPx?: number): { dx: number; dy: number }`（長さは `min(1, 距離/maxPx)`、方向は単位ベクトル。距離0のとき `{dx:0, dy:0}`）、`export function isTap(movedPx: number, elapsedMs: number): boolean`。

---

### Task 1: 入力画像と生成スクリプトの骨組み

**Files:**
- Create: `artifacts/sfc-campus-source/daigaku-bubun.png`（`C:\Users\temp_admin\AppData\Local\Temp\pdfx\pages\page-2.png` をコピー）
- Create: `scripts/build-campus-grid.mjs`
- Modify: `package.json`（devDependencies に `pngjs` を追加）

**Interfaces:** Produces: 生成スクリプトの定数 `CROP = { x0: 0.19, x1: 0.928, y0: 0.113, y1: 0.954 }`（ページ幅・高さに対する比率）、`COLS = 185`、`ROWS = 148`、`CELL = 8`。出力は `artifacts/sfc-campus-source/preview.txt`（ASCII）。

- [ ] **Step 1: 画像をコピーし、pngjs を追加する**

`npm install -D pngjs` を実行する。`daigaku-bubun.png` をコピーし、幅と高さを確認する（PNGのIHDRから読む）。

- [ ] **Step 2: 色の分類関数を書く（`classifyPixel(r,g,b)`）**

分類は次の順で判定する。返り値は `'o'`（建物のオレンジ）、`'w'`（白い道）、`'b'`（池の水色）、`'g'`（草地の緑）、`'d'`（濃い線や文字）、`'?'`（その他）。
- `d`: r,g,b すべて `< 110`。
- `o`: `r > 200 && g >= 150 && g <= 205 && b < 110`（黄色のシェブロン `g > 215` は `o` にしない）。
- `w`: r,g,b すべて `> 225`。
- `b`: `b > 200 && r < 150`。
- `g`: `g > r + 25 && g > b + 25`。
- それ以外は `'?'`。

閾値は Step 4 のプレビューで調整してよい（変えたら理由を報告に書く）。

- [ ] **Step 3: セルの分類（多数決）を書く**

セル (c,r) の範囲は、ページの比率 `CROP` を使って次で求める。
`x = (CROP.x0 + (c + 0.5)/COLS * (CROP.x1 - CROP.x0)) * W`、`y` も同様に高さで求める。セル内の 5×5 点を取って分類し、最も多い分類を返す。`'d'` と `'?'` は数えない。すべて `'d'` `'?'` のときは `'?'`。

- [ ] **Step 4: プレビューを出力する**

`node scripts/build-campus-grid.mjs --preview` で、`artifacts/sfc-campus-source/preview.txt` に 185×148 の分類文字を書き出す（`o`、`w`、`b`、`g`、`?`）。出力後、プレビューを読み、建物（`o`の連結）、白い道、池、草地が大学部分拡大と一致するか確認する。一致しない閾値があれば直して再生成する。

- [ ] **Step 5: 検証**

Run: `node scripts/build-campus-grid.mjs --preview && wc -l artifacts/sfc-campus-source/preview.txt`
Expected: 148 行が出力され、各行が 185 文字である。報告にプレビューの要点（池の位置、建物数の目安）を書く。

- [ ] **Step 6: Commit**

```bash
git add artifacts/sfc-campus-source/daigaku-bubun.png scripts/build-campus-grid.mjs package.json package-lock.json
git commit -m "chore(rpg): add the campus source image and grid preview script"
```

---

### Task 2: 地形グリッドの生成（`sfcCampusGrid.ts`）

**Files:**
- Modify: `scripts/build-campus-grid.mjs`
- Generate: `src/lib/sfcCampusGrid.ts`
- Modify: `artifacts/sfc-campus-source/preview.txt`（生成のたびに上書き）

**Interfaces:** Produces: `src/lib/sfcCampusGrid.ts` の定数（上の Interfaces 節）。Consumes: Task 1 の分類関数。

- [ ] **Step 1: 失敗するテストを書く（生成物の検証は Task 3 のテストで行う。ここでは生成物の寸法だけ確認する）**

`src/lib/sfcCampusGrid.test.ts` を作る。

```ts
import { describe, it, expect } from 'vitest'
import { CAMPUS_COLS, CAMPUS_ROWS, CAMPUS_GRID, CAMPUS_CELL } from './sfcCampusGrid'

describe('campus grid', () => {
  it('has the fixed dimensions', () => {
    expect(CAMPUS_CELL).toBe(8)
    expect(CAMPUS_GRID.length).toBe(CAMPUS_ROWS)
    expect(CAMPUS_COLS).toBe(185)
    expect(CAMPUS_ROWS).toBe(148)
    for (const row of CAMPUS_GRID) expect(row.length).toBe(CAMPUS_COLS)
  })
  it('uses only the known terrain characters', () => {
    const allowed = new Set(['.', '=', ':', '~', '#', 'n', 'S', 'K', 'E', 'I', 'O', 'L', 'M', 'U', 'T', 'W', 'Y', 'A'])
    for (const row of CAMPUS_GRID) for (const ch of row) expect(allowed.has(ch)).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/sfcCampusGrid.test.ts`
Expected: FAIL（ファイルがない）

- [ ] **Step 3: 生成処理を完成させる（`scripts/build-campus-grid.mjs`）**

Task 1 の分類結果に次を施す。
1. 建物: `o` の4近傍の連結領域を1棟とする。白文字（`w` が建物の内側）は周囲の `o` の多数決で `o` にする。連結領域の対応は、建物の重心に最も近い名前付き建物の表（`S K E I O L M U T W Y A` の座標リスト）で決める。表は生成スクリプトの中に書く（座標は Step 4 のプレビューで確認して決める）。対応がない連結領域は `n` にする。
2. 道: `w` を `=` にする。道の幅が1マスの箇所は、隣接する道マスを1マス加えて最低2マス幅にする。坂道の矢印（黄色）は `w` に含める（Task 1 の分類で `?` のものは、周囲が道ならば `=` にする）。
3. 池: `b` を `~` にする。池に接する `g` は `:`（土の岸）にする。
4. 外周: 外側の6マスを `#`、その内側の1マスを `:` にする。
5. 草地: 残りの `g`、`?`、`d` は `.` にする。
6. 出力: `src/lib/sfcCampusGrid.ts` に `CAMPUS_GRID` を文字列の配列で書く。`CAMPUS_NAMIKI_CELL`（南北に一番長い道の列の中央付近の道マス）、`CAMPUS_KAMOIKE_CELL`（池の東岸にある歩けるマスのうち池の重心に最も近いもの）、`CAMPUS_SPAWN_CELL`（最下段の道マスの中央）を決めて書く。
7. `artifacts/sfc-campus-source/preview.txt` に最終結果を書く。

- [ ] **Step 4: 生成してプレビューを確認する**

Run: `node scripts/build-campus-grid.mjs`
Expected: `src/lib/sfcCampusGrid.ts` が生成され、名前付き建物が12棟（S K E I O L M U T W Y A）すべて見つかる。見つからない場合は、対応表の座標を直して再生成する。プレビューを読み、建物の形、道の連結、池の位置が元の地図と一致するか確認する。

- [ ] **Step 5: テストを通す**

Run: `npx vitest run src/lib/sfcCampusGrid.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/build-campus-grid.mjs src/lib/sfcCampusGrid.ts src/lib/sfcCampusGrid.test.ts artifacts/sfc-campus-source/preview.txt
git commit -m "feat(rpg): generate the campus terrain grid from the source map"
```

---

### Task 3: グリッドの問い合わせ（`sfcCampusGridQuery.ts`）

**Files:**
- Create: `src/lib/sfcCampusGridQuery.ts`
- Create: `src/lib/sfcCampusGridQuery.test.ts`

**Interfaces:** Consumes: `sfcCampusGrid.ts`（Task 2）、`RectBlocker` と `Point` 型（`sfcCampusMovement.ts`）。Produces: Interfaces 節の `cellAt`、`cellAtPoint`、`isRoadCell`、`isBlockedCell`、`buildingsFromGrid`、`blockerRects`、`roadCellCenters`。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sfcCampusGridQuery.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cellAt, cellAtPoint, isRoadCell, isBlockedCell, buildingsFromGrid, blockerRects, roadCellCenters } from './sfcCampusGridQuery'
import { isWalkable, type WalkOptions } from './sfcCampusMovement'

const NAMED = ['sigma-cafeteria', 'kappa', 'epsilon', 'iota', 'omicron', 'lambda', 'mu', 'lounge', 'theta', 'omega', 'tau', 'alpha']

describe('campus grid query', () => {
  it('treats outside cells as blocked cliffs', () => {
    expect(cellAt(-1, 0)).toBe('#')
    expect(isBlockedCell(cellAt(-1, 0))).toBe(true)
  })
  it('finds every named building exactly once', () => {
    const names = buildingsFromGrid().filter((b) => b.name !== null).map((b) => b.id)
    expect([...names].sort()).toEqual([...NAMED].sort())
  })
  it('puts every building entrance on a walkable road or grass cell', () => {
    const o: WalkOptions = { blockers: blockerRects(), radius: 6, mapW: 1480, mapH: 1184 }
    for (const b of buildingsFromGrid()) {
      expect(isBlockedCell(cellAtPoint(b.entrance.x, b.entrance.y))).toBe(false)
      expect(isWalkable(b.entrance, o)).toBe(true)
    }
  })
  it('connects every road cell to every other road cell', () => {
    const o: WalkOptions = { blockers: blockerRects(), radius: 6, mapW: 1480, mapH: 1184 }
    const centers = roadCellCenters().filter((p) => isWalkable(p, o))
    expect(centers.length).toBeGreaterThan(100)
    // 8マス刻みのBFSで、最初の道マスから全道マスに届くことを確認する
    const seen = new Set<string>([`${centers[0].x},${centers[0].y}`])
    const queue = [centers[0]]
    while (queue.length) {
      const p = queue.shift()!
      for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const q = { x: p.x + dx, y: p.y + dy }
        const key = `${q.x},${q.y}`
        if (!seen.has(key) && isWalkable(q, o) && isRoadCell(cellAtPoint(q.x, q.y))) {
          seen.add(key)
          queue.push(q)
        }
      }
    }
    expect(seen.size).toBe(centers.length)
  })
  it('keeps the pond and buildings blocked', () => {
    const o: WalkOptions = { blockers: blockerRects(), radius: 6, mapW: 1480, mapH: 1184 }
    for (let r = 0; r < 148; r += 1) for (let c = 0; c < 185; c += 1) {
      if (isBlockedCell(cellAt(c, r))) expect(isWalkable({ x: c * 8 + 4, y: r * 8 + 4 }, o)).toBe(false)
    }
  })
  it('keeps the road network connected from the spawn cell', () => {
    expect(isRoadCell(cellAtPoint(0, 0))).toBe(false)
  })
})
```

注意: 最後のテストは実装者が「スポーンのマスが道であること」の確認に置き換えてよい（`CAMPUS_SPAWN_CELL` を使う）。Task 4 で `CAMPUS_SPAWN_CELL` の道判定テストを追加する。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/sfcCampusGridQuery.test.ts`
Expected: FAIL（モジュールがない）

- [ ] **Step 3: 実装する**

- `cellAt`: 範囲外は `'#'`、範囲内は `CAMPUS_GRID[row][col]`。
- `buildingsFromGrid`: 建物の文字（`n` と名前付きの文字）の4近傍連結領域。名前付きは文字から ID を引き、`name` は `sfcCampusLayout.ts` の `BUILDING_NAMES`（Task 4 で作る）から引く。Task 3 の時点では `name` を生成スクリプトが決めた文字の対応表で返すこと。`entrance` は `{ x: (c0 + c1 + 1) / 2 * 8, y: (r1 + 3) * 8 }`（南の辺から2マス外の中心）。
- `blockerRects`: `isBlockedCell` のマスを行ごとに横の連続区間にし、同じ列範囲の行を縦につないで矩形にする。結果は `{ kind: 'rect', x, y, w, h }` で、単位座標（セル×8）。
- `roadCellCenters`: `=` のマスの中心 `{ x: c*8+4, y: r*8+4 }` の配列。

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/lib/sfcCampusGridQuery.test.ts`
Expected: PASS。失敗した場合は、失敗した入口や道の位置を報告に書き、グリッド（Task 2）を直して再生成する（Task 2 の対応表に戻る）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/sfcCampusGridQuery.ts src/lib/sfcCampusGridQuery.test.ts
git commit -m "feat(rpg): query the campus grid for buildings, blockers and road cells"
```

---

### Task 4: 地図データ（layout・map・当たり判定）の作り直し

**Files:**
- Modify (rewrite): `src/lib/sfcCampusLayout.ts`
- Modify (rewrite): `src/lib/sfcCampusMap.ts`
- Modify: `src/lib/sfcCampusMovement.ts`（`PolyBlocker`、`insidePolygon`、`segmentDistance` を削除し、`collides` を矩形と円だけにする）
- Modify: `src/lib/sfcCampusMovement.test.ts`（poly のテストを削除）
- Modify: `src/lib/sfcCampusLayout.test.ts`、`src/lib/sfcCampusMap.test.ts`

**Interfaces:** Consumes: Task 3 の `buildingsFromGrid`、`blockerRects`。Produces: `CAMPUS_LAYOUT`、`buildingById`、`BLOCKERS`、`HOTSPOTS`、`LABELS`、`AREA_LABELS`、`SPAWN`、`MAP_W`、`MAP_H`、`findNearbyHotspot`、`nearestArea`、`BUILDING_NAMES`。

- [ ] **Step 1: テストを書き直す**

`sfcCampusLayout.test.ts`: 必須の名前リストは12棟（βとΗを除く）。寸法は `width === 1480`、`height === 1184`。建物の入口が `entrance` の中心で、建物の外にあること。

`sfcCampusMap.test.ts` の要点:
- `SPAWN` が歩けて、道マスの上にある（`isRoadCell(cellAtPoint(SPAWN.x, SPAWN.y))`）。
- 各ホットスポットの座標が歩ける。鴨池（`kamoike`）が池の岸にある（池のマスから8単位以内で、池ではない）。
- `HOTSPOTS` の id は重複がなく、`beta-village`、`eta-village` を含まない。
- `LABELS` に `βヴィレッジ`、`Ηヴィレッジ` を含まない。
- `CAMPUS_NAMIKI_CELL` の中心が並木道の看板（`namiki-board`）の座標に一致する。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/sfcCampusLayout.test.ts src/lib/sfcCampusMap.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

- `sfcCampusLayout.ts`: `BUILDING_NAMES`（ID→名前）と `BUILDING_ROOFS`（ID→屋根色。既存の屋根色を引き継ぎ、名前なしは `'gray'`）を定義する。`CAMPUS_LAYOUT.buildings` は `buildingsFromGrid()` を `CampusBuilding` の形（`x = c0*8`、`y = r0*8`、`w = (c1-c0+1)*8`、`h = (r1-r0+1)*8`）に変換したもの。`paths`、`pond`、`cliffs`、`treeZones` は削除する。
- `sfcCampusMap.ts`:
  - `BLOCKERS = [...blockerRects(), ...treeTrunkCircles()]`。`treeTrunkCircles` は `placeTrees`（Task 5）の結果から `{kind:'circle', x: t.x, y: t.y + t.r*0.5, r: 5}` を作る。循環参照を避けるため、Task 4 の時点では空配列を返し、Task 5 で接続する。
  - `HOTSPOTS`: `namiki-board` は `CAMPUS_NAMIKI_CELL` の中心、`kamoike` は `CAMPUS_KAMOIKE_CELL` の中心（`r` は 48）、建物系は `buildingById(id).entrance`。id・タイトル・文言・半径は既存の値を維持する（`beta-village`、`eta-village` は削除）。
  - `LABELS`: 名前付き建物の中心（`x: x + w/2`、`y: y + 18`）と `AREA_LABELS`。`AREA_LABELS` から「ヴィレッジ」を削除する。
  - `SPAWN = { x: CAMPUS_SPAWN_CELL.col*8+4, y: CAMPUS_SPAWN_CELL.row*8+4 }`。
- `sfcCampusMovement.ts`: `PolyBlocker` 型、`insidePolygon`、`segmentDistance` を削除し、`collides` の polygon 分岐を削除する。

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/lib/sfcCampusLayout.test.ts src/lib/sfcCampusMap.test.ts src/lib/sfcCampusMovement.test.ts src/lib/sfcCampusGridQuery.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sfcCampusLayout.ts src/lib/sfcCampusMap.ts src/lib/sfcCampusMovement.ts src/lib/sfcCampusMovement.test.ts src/lib/sfcCampusLayout.test.ts src/lib/sfcCampusMap.test.ts
git commit -m "feat(rpg): derive buildings, blockers and hotspots from the terrain grid"
```

---

### Task 5: 地形タイルの描画（`sfcCampusArt.ts`）

**Files:**
- Modify (rewrite): `src/lib/sfcCampusArt.ts`
- Modify: `src/lib/sfcCampusArt.test.ts`

**Interfaces:** Consumes: `CAMPUS_GRID`、`CAMPUS_CELL`、`cellAt`、`isRoadCell`、`buildingsFromGrid`、`CAMPUS_LAYOUT`。Produces: `drawCampusBase(ctx: CanvasRenderingContext2D): void`（既存の署名を維持）、`placeTrees(): TreeSpot[]`（`TreeSpot = { x, y, r, cherry }`、既存の型）。

- [ ] **Step 1: テストを書く**

`sfcCampusArt.test.ts`:
- 同じ結果を2回描くと、ピクセルのハッシュが一致する（既存の決定性テストを維持）。
- `placeTrees()` の各木の根元 `(x, y + r*0.5)` が草地（`cellAtPoint` が `.`）で、道・建物・池の上にない。
- `placeTrees()` の木の数が 100 以上。
- 描画に文字（`fillText`）を使わない（既存の検査を維持）。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/sfcCampusArt.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

- 地形: グリッドの各マスを 8×8 単位で描く。`.` は草の模様（既存の緑3色から、座標の乱数で選ぶ）、`=` は石の模様（縁は隣が道でないときだけ土色の1pxで縁取り）、`:` は土、`~` は池の3層（深・中・浅）と波紋。模様は `mulberry32(seed)` の乱数で決め、同じ入力から同じ結果になるようにする。
- 建物: `buildingsFromGrid()` の各棟を、既存の `drawBuildings` の屋根・壁・窓の描き方で描く（入力だけを新しいものにする）。
- 木: `placeTrees()` は草マスの中心の乱数位置に、既存の大木の見た目で描く。草マスの周囲1マス以内に道がある場合は置かない（道を木で隠さないため）。
- 小物（花、ベンチ、落ち葉）: 既存の `drawProps` を、グリッド問い合わせ（`isRoadCell` と草マス判定）で書き換える。道の上と建物の上には置かない。
- 既存の `nearPond`、`nearBuilding`、`onPavement`、`blockedForTree`、旧 `drawPaths`、`drawCliffs`、`drawPond`、`drawGrass` は削除する。

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/lib/sfcCampusArt.test.ts`
Expected: PASS

- [ ] **Step 5: 目視確認**

開発サーバーでRPGタブを開き、道の交差が割り込まずにつながること、建物の入口の前に道があることを確認する（スクリーンショット）。結果を報告に書く。

- [ ] **Step 6: Commit**

```bash
git add src/lib/sfcCampusArt.ts src/lib/sfcCampusArt.test.ts
git commit -m "feat(rpg): draw the campus from the terrain grid"
```

---

### Task 6: 主人公の描き直し（`sfcCampusSprite.ts`）

**Files:**
- Modify (rewrite): `src/lib/sfcCampusSprite.ts`
- Create: `src/lib/sfcCampusSprite.test.ts`（既存があれば更新）

**Interfaces:** Produces: `drawStudent(ctx, x, y, dir, frame, moving): void`（既存の署名を維持）、`drawHotspotMarker`（既存のまま）。

- [ ] **Step 1: テストを書く**

`sfcCampusSprite.test.ts`:
- スプライトは文字列の定義（12列×16行、1セル2px）で持つ。各方向（`up`、`down`、`left`、`right`）×フレーム（0、1）の計8枚。
- 胴体の行（行 6〜11）では、左端と右端の間に透明のセルがない（連続したシルエット）。
- 背面（`up`）の定義にリュックの色（`B`）がない。
- 8枚すべての行数が16、列数が12。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/sfcCampusSprite.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

- パレット: `.` 透明、`n` 紺 `#1e2a5a`、`w` 白シャツ、`y` 黄 `#eab308`、`s` 肌 `#f2c9a0`、`h` 髪 `#3b2a20`、`k` 靴 `#2a2a3a`、`d` 影（半透明）。
- 8枚の文字列定義を書く（胴体の行は連続させる）。歩行フレーム1では脚を1セルずらす。
- `drawStudent` は定義を読み、セルごとに `fillRect` する（影は既存の楕円の近似のまま）。

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/lib/sfcCampusSprite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sfcCampusSprite.ts src/lib/sfcCampusSprite.test.ts
git commit -m "fix(rpg): redraw the student as one silhouette without a backpack"
```

---

### Task 7: スティック移動とタップ判定

**Files:**
- Create: `src/lib/sfcCampusStick.ts`
- Create: `src/lib/sfcCampusStick.test.ts`
- Modify: `src/components/SfcCampusCanvas.tsx`
- Modify: `src/components/SfcCampusCanvas.test.tsx`

**Interfaces:** Produces: `stickVector`、`isTap`、`STICK_MAX_PX`、`TAP_MAX_PX`、`TAP_MAX_MS`（Interfaces 節）。Canvas の Props: `padRef`（既存）、`onCancel`（既存）。

- [ ] **Step 1: 純粋関数のテストを書く**

`sfcCampusStick.test.ts`:
- `stickVector({x:0,y:0},{x:0,y:0})` は `{dx:0,dy:0}`。
- `stickVector({x:0,y:0},{x:40,y:0})` は `{dx:1,dy:0}`。`{x:20,y:0}` は `{dx:0.5,dy:0}`。`{x:0,y:-80}` は `{dx:0,dy:-1}`（上限1）。
- `isTap(5, 100)` は true。`isTap(12, 100)` は false。`isTap(5, 300)` は false。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/lib/sfcCampusStick.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`sfcCampusStick.ts` に定数と2関数を書く（Interfaces 節どおり）。

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/lib/sfcCampusStick.test.ts`
Expected: PASS

- [ ] **Step 5: Canvas のポインタ処理を書き換える**

`SfcCampusCanvas.tsx` の pointerdown/pointermove/pointerup/pointercancel を次のとおりにする。
- pointerdown: `paused` なら無視。ホットスポットの範囲内なら `tapTarget` に記録する（まだ歩かない）。それ以外は `drag = { id: pointerId, anchor, downAt: now, moved: 0, hotspot }` を記録し、`setPointerCapture` する。
- pointermove: `drag` の pointerId が一致するとき、`padRef.current = stickVector(anchor, pointer)` を更新し、`moved` を最大移動量で更新する。
- pointerup: `drag` が一致したら、`padRef.current = {dx:0,dy:0}`。`isTap(moved, now - downAt)` が true なら、A*で `anchor` の地点へ歩く（ホットスポット上なら `pendingHotspotRef` を立てる。既存の処理）。ドラッグだった場合は何もしない。
- pointercancel と lostpointercapture: `padRef.current = {dx:0,dy:0}` にし、`drag` を消す。
- フレーム処理: `padRef.current` の長さ `m = min(1, hypot(dx,dy))` で速度を `SPEED * m` にする。キーボードの入力は今までどおり（正規化して `SPEED` で動く）。
- ホットスポットのタップは、pointerup のタップ判定が成立したときだけ既存の処理（範囲内は開く、範囲外は歩いて着いたら開く）を行う。ドラッグ後はホットスポットを開かない。
- D-pad の入力は Canvas には関係しない（Task 9 で画面から消す）。

- [ ] **Step 6: テストを追加する**

`SfcCampusCanvas.test.tsx` に、pointerdown → pointermove → pointercancel で `padRef.current` が `{dx:0,dy:0}` に戻ることを確認するテストを追加する（jsdom の PointerEvent は `new Event` で代用してよい。既存の方法に合わせる）。

- [ ] **Step 7: テストと型を通す**

Run: `npx vitest run src/lib/sfcCampusStick.test.ts src/components/SfcCampusCanvas.test.tsx && npx tsc -b`
Expected: PASS、型エラーなし。

- [ ] **Step 8: Commit**

```bash
git add src/lib/sfcCampusStick.ts src/lib/sfcCampusStick.test.ts src/components/SfcCampusCanvas.tsx src/components/SfcCampusCanvas.test.tsx
git commit -m "feat(rpg): move the student with a drag stick on the map"
```

---

### Task 8: 全体マップの描き直し（`SfcCampusFullMap.tsx`）

**Files:**
- Create: `src/components/SfcCampusFullMap.tsx`
- Create: `src/components/SfcCampusFullMap.test.tsx`
- Modify: `src/components/SfcCampusRpg.tsx`（色の箱の描画を削除し、新しいコンポーネントを置く）

**Interfaces:** Consumes: `drawCampusBase`、`HOTSPOTS`、`MAP_W`、`MAP_H`、`LABELS`。Produces: `SfcCampusFullMap({ playerX, playerY, onClose })`。

- [ ] **Step 1: テストを書く**

`SfcCampusFullMap.test.tsx`:
- 表示は `data-testid="sfc-full-map-canvas"` の canvas を含む。
- 自分の位置のマーカー（`data-testid="sfc-full-map-player"`）が、`playerX/MAP_W` と `playerY/MAP_H` の割合で配置される（style の left/top の %）。
- ホットスポットの数だけ `data-testid="sfc-full-map-hotspot"` の要素がある。
- 閉じるボタン（`sfc-map-close`）で `onClose` が呼ばれる。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/components/SfcCampusFullMap.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装する**

- 表示枠: 既存のヘッダー（見出しと閉じるボタン）の下に、縦横比 `MAP_W:MAP_H` の枠を幅いっぱい（最大 380px）に置く。
- canvas: `useEffect` で、オフスクリーンに `MAP_W × MAP_H` で `drawCampusBase` を描き、表示 canvas に `drawImage` で拡大（`imageSmoothingEnabled = false`）する。
- 自分の位置: 枠の上に小さな学生マーカー（白い縁の円、直径 10px）。ホットスポットは金の小さな丸（直径 8px）。
- 建物名の一覧（チップ）は既存の `LABELS` を使って残す。

- [ ] **Step 4: 差し替えと検証**

`SfcCampusRpg.tsx` の全体マップ（`sfc-map-schematic` と色の箱）を `SfcCampusFullMap` に置き換える。自分の位置は `SfcCampusCanvas` の `onPlayerMove` コールバックで受け取り、state に保存する（新しい prop を Canvas に追加する。Task 7 の Canvas と同じ方法で ref を使う）。

Run: `npx vitest run src/components/SfcCampusFullMap.test.tsx src/components/SfcCampusRpg.test.tsx && npx tsc -b`
Expected: PASS（`SfcCampusRpg.test.tsx` の全体マップのテストは新しいIDに合わせて更新する）

- [ ] **Step 5: Commit**

```bash
git add src/components/SfcCampusFullMap.tsx src/components/SfcCampusFullMap.test.tsx src/components/SfcCampusRpg.tsx src/components/SfcCampusCanvas.tsx src/components/SfcCampusRpg.test.tsx
git commit -m "feat(rpg): show the real terrain on the full campus map"
```

---

### Task 9: D-pad の削除と操作説明

**Files:**
- Modify: `src/components/SfcCampusRpg.tsx`
- Modify: `src/components/SfcCampusRpg.test.tsx`
- Modify: `src/screens/RankingScreen.test.tsx`（D-padのIDを参照している場合のみ）

- [ ] **Step 1: テストを更新する**

`SfcCampusRpg.test.tsx` の D-pad のテスト（`sfc-dpad-*`）を削除する。新しいテスト: `sfc-dpad-up` などが存在しないこと。説明文「マップをなぞって移動・近くでE」を含むこと。

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/components/SfcCampusRpg.test.tsx`
Expected: FAIL（D-padが残っている）

- [ ] **Step 3: 実装する**

- D-padの描画（`sfc-dpad-*`）と `handlePointerDown` / `handlePointerUp` / `pressedRef` / `DIRECTIONS` を削除する。
- `padRef` は Canvas のために残す。
- 説明文を「マップをなぞって移動・近くでE（キーボードは矢印/WASD）」に変える。

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/components/SfcCampusRpg.test.tsx src/screens/RankingScreen.test.tsx && npx tsc -b`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SfcCampusRpg.tsx src/components/SfcCampusRpg.test.tsx src/screens/RankingScreen.test.tsx
git commit -m "feat(rpg): remove the D-pad now that the map is dragged"
```

---

### Task 10: 検証、ビルド、プッシュ

**Files:**
- Remove (検証用の一時的な仕組み、コミットしない): `dev-shell-plugin.ts`、`vite.config.ts` の変更（`git checkout -- vite.config.ts`）

- [ ] **Step 1: 全テスト**

Run: `npx vitest run`
Expected: 全件PASS。失敗があれば原因を直してから次へ進む。

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: 成功（`built in` が出る）。

- [ ] **Step 3: 目視確認**

RPGタブで次を確認し、スクリーンショットを撮る。
- 全体マップが地形（道・池・建物・木）を描いている。
- 道が割り込まず、Σ生協食堂の入口から道が出ている。
- キャラが欠けず、リュックがない。
- マップを指でなぞると移動し、指を離すと止まる。
- 並木道の看板、鴨池、建物の入口でEが点灯する。

- [ ] **Step 4: 一時的な仕組みを撤去する**

`dev-shell-plugin.ts` を削除し、`git checkout -- vite.config.ts` で元に戻す。`git status` で、対象ファイル以外が含まれていないことを確認する。

- [ ] **Step 5: コミットとプッシュ**

変更された対象ファイルだけを `git add` し、`git commit`（メッセージ例: `feat(rpg): rebuild the campus map from the reference maps`）。`git push origin main`。デプロイ（GitHub Actions）の結果を確認する。

---

## Self-Review

- 設計の各項目に対応するタスクがある: 地図（T1〜T4）、道の連結（T2、T3、T5）、全体マップ（T8）、キャラ（T6）、ドラッグ移動（T7）、D-pad削除（T9）、Eボタンの維持（T7 の決定経路は既存）、検証とプッシュ（T10）。
- 型の一貫性: `RectBlocker`、`Point`、`WalkOptions`、`TreeSpot`、`CampusBuilding` は Interfaces 節で定義し、全タスクで同じ名前を使う。
- 注意: 設計書の「外周の1マス帯（約48単位）」は、グリッドでは6マスの崖と1マスの土として実装する（Global Constraints に明記）。
</content>
