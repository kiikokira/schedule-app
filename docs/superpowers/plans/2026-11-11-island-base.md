# 島の土台（円形テラス式） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 円形テラス式の島の土台（3段＋滝の溝と池のくぼみ＋頂上→池の一本道）をBlender生成し、ゲーム用GLBと歩行道データを納品する。

**Architecture:** 既存方式を踏襲する。`scripts/blender/build_island_base.py` を `blender --background --python` で実行し地形＋道床を生成、編集用blend・ゲーム用GLB・道graph JSON・等角プレビューを出力する。共有ヘルパー `scripts/blender/wkit.py` を使い新規依存ゼロ。

**Tech Stack:** Blender 5.2 headless Python（bpy/bmesh）、既存 `wkit` ヘルパー、glTF2.0 GLB、TypeScript vitest、Three.js RpgWorld3d読み込み形式。

**Spec:** `docs/superpowers/specs/2026-11-11-island-base-design.md`

## Global Constraints

- スマホ実機でラグらないことが最終判断。重くなれば段数・分割を削る。
- スタイライズド（参考画像寄りの独自造形）。特定作品の複製はしない。
- Blender 5.2＋Agent Bridgeで対話作成。1世界1アートスタイル。
- AGENTS.md運用：対象ファイルのみadd、push前にnpm run build成功、pushは許可後。
- GLB上限5MB・目標3MB。写真系PBR混ぜ禁止。既存W1・newworldに触れない。

## Review Focus

- 3段テラス＋滝溝＋池くぼみの総トライアングルがスマホ予算を超える → GLB 5MB上限・目標3MBのassertが落ちることを期待する。
- 道床が地形から浮く・埋まる → 道中心線のyが地形H+0.05に追従することのチェックが落ちることを期待する。
- 滝の溝彫りが道を分断する → 道の始終点が連結していることのチェックが落ちることを期待する。
- 写実PBR・外部アセット混入 → マテリアル一覧に画像テクスチャなしのチェックが落ちることを期待する。
- 既存ワールド上書き → `world1*`・`newworld*` の差分ゼロであることを期待する。

---

### Task 1: 土台生成スクリプト（地形3段＋滝溝・池くぼみ＋道床）

**Files:**
- Create: `scripts/blender/build_island_base.py`
- Create: `scripts/blender/check_island_base.py`
- Produces: `artifacts/3d/source_blender/island_base_source.blend`、`public/rpg/island_base.glb`、`artifacts/3d/preview/island-base-iso.png`

**Interfaces:**
- Consumes: `scripts/blender/wkit.py`（`fresh_scene`、`sstep` 等の既存ヘルパー。新規依存追加なし）
- Produces: Task 2が使う高さ関数 `H(x, z)` と道中心線 `ROAD`（同ファイル内の定数・関数として定義し、Task 2がimportして再利用する）

- [ ] **Step 1: 失敗するチェックを書く**

`scripts/blender/check_island_base.py` に `test_glb_exists_and_light` を書く。assert内容：`public/rpg/island_base.glb` が存在し5MB以下（目標3MBは警告表示のみ）、`island_base_source.blend` が存在する。

- [ ] **Step 2: 実行して失敗を確認する**

Run: `python scripts/blender/check_island_base.py`
Expected: FAIL（GLBがまだ存在しない）

- [ ] **Step 3: `build_island_base.py` を実装する**

`blender --background --python scripts/blender/build_island_base.py` で実行できること。仕様：楕円島（中心・半径は定数 `CX/CY/RX/RY`）、3段テラス（定数 `T1/T2/T3` の高さ・半径）、滝溝2本と池くぼみ1つの彫り込み、頂上→池の道中心線 `ROAD`（点列定数）の道床幅2m。マテリアルは頂点色＋単色のみ（画像テクスチャ禁止）。出力3件を上記パスに保存すること。

- [ ] **Step 4: 生成してチェックを通す**

Run: `blender --background --python scripts/blender/build_island_base.py`（Blender 5.2フルパス起動）
Expected: 3件の出力が生成される
Run: `python scripts/blender/check_island_base.py`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add scripts/blender/build_island_base.py scripts/blender/check_island_base.py artifacts/3d/source_blender/island_base_source.blend public/rpg/island_base.glb artifacts/3d/preview/island-base-iso.png
git commit -m "feat: add island base terrain and road bed"
```

---

### Task 2: 歩行道データ（中心線→graph JSON＋追従・連結検証）

**Files:**
- Create: `public/rpg/island_base_graph.json`
- Modify: `scripts/blender/check_island_base.py`（検証2件を追記）
- Test: `python scripts/blender/check_island_base.py`（追記分）

**Interfaces:**
- Consumes: Task 1の `H(x, z)` と `ROAD`（`build_island_base.py` からimport。コピー禁止）
- Produces: `island_base_graph.json`（`{stops, paths}`。Task 3のRPG接続が将来読む形式。`src/lib/rpgWorld3d.ts` の `W3Graph` 互換）

- [ ] **Step 1: 失敗する検証を追記する**

`check_island_base.py` に `test_road_follows_terrain`（全道点のyが `H+0.05±0.02`）と `test_road_connected`（始点＝頂上・終点＝池で全点連結）を追記する。

- [ ] **Step 2: 実行して失敗を確認する**

Run: `python scripts/blender/check_island_base.py`
Expected: FAIL（graph JSONがまだ存在しない）

- [ ] **Step 3: graph JSONを生成する**

`build_island_base.py` に出力処理を追加する（別スクリプトを作らない）。`ROAD` 点列の各点に `H+0.05` のyを付けて `stops`（始点 `s0`／終点 `s1`）と単一 `paths` にし、`public/rpg/island_base_graph.json` に保存すること。

- [ ] **Step 4: 検証を通す**

Run: `blender --background --python scripts/blender/build_island_base.py`
Expected: graph JSONが更新される
Run: `python scripts/blender/check_island_base.py`
Expected: 全テストPASS

- [ ] **Step 5: コミットする**

```bash
git add scripts/blender/build_island_base.py scripts/blender/check_island_base.py public/rpg/island_base_graph.json
git commit -m "feat: add island walkable road graph"
```

---

### Task 3: 検証・軽量化・納品（サイズ・回帰・既存不変）

**Files:**
- Modify: なし（検証のみ。失敗時はTask 1／2に戻る）

**Interfaces:**
- Consumes: Task 1／2の全出力物
- Produces: 納品OK宣言（失敗時は原因Taskへ差し戻す）

- [ ] **Step 1: GLBサイズと内容を確認する**

Run: `python scripts/blender/check_island_base.py`
Expected: 全PASS（GLB 5MB以下。3MB超なら警告を記録して続行）

- [ ] **Step 2: 既存ワールド不変を確認する**

Run: `git status --short public/rpg/world1* public/rpg/newworld* artifacts/3d/source_blender/world*`
Expected: 出力なし（差分ゼロ）

- [ ] **Step 3: 回帰ビルドする**

Run: `npm.cmd run build`
Expected: 成功。失敗時は本変更の影響か既存不具合かを切り分けて報告し、`src/` へ勝手に手を入れないこと。

- [ ] **Step 4: 納品宣言してpush可否を問う**

土台GLB＋道graph＋プレビュー画像の3点を確認し、AGENTS.md通りpush許可を求める。許可なく `git push` しないこと。

## Self-Review

- Spec coverage: 土台3段＋滝溝池くぼみ→Task 1、歩ける一本道→Task 2、GLB納品・5MB・対話作成・既存不変→Task 1〜3。木・建物・RPG配線は非目標としてTaskに含めず。
- Step scan: 各Stepは単一行為＋Expected付き。TBDなし。数値定数はTask 1の実装に委ね、検証条件のみ固定した。
- Type consistency: `H`・`ROAD` の所有はTask 1、Task 2はimportのみ。graph形式 `W3Graph` の呼称はTask 2内で統一。
- Review Focus: 5項目すべてに対応する検証をTask 1 Step 1・Task 2 Step 1・Task 3 Step 1〜2に配置した。
- Proportion: Spec 1頁に対し3タスク。コード転写ではなく検証付き手順に留めた。
