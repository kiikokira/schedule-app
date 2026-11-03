# RPGプロジェクト監査（v4 Phase 1 成果物）

日付: 2026-11-04。要件元: `src/RPG_World_Map_OpenCode_Prompt_v4.md`（最上位仕様）。

## 1. 既存アプリ技術スタック

- React 18 + Vite 5 + TypeScript + Vitest + Dexie（`package.json`）。PWA（vite-plugin-pwa）。
- 3D描画ライブラリは未導入。`three` は未インストール（npm registry到達可、最新 0.187.0 を確認）。
- RPG実装: `src/lib/rpgWorlds.ts`（9ワールド定義・進行）、`src/components/RpgMap.tsx`（平面SVG）、`RpgAdventure.tsx`（選択＋自動再生＋立体SVG導線＝前回v3成果）、`RpgGrassMap.tsx`（2.5D SVG立体）、`RpgWorldSelect.tsx`、`src/lib/rpgProgress.ts`（localStorage保存 v1）、`rpgStageAdapter.ts`。
- 使用箇所: `src/screens/RankingScreen.tsx` RPGタブ（season exp連動）。保存: `schedule-app-season-v1`＋`schedule-app-rpg-progress-v1`（localStorage）。
- ビルド: `npm.cmd run build`（tsc -b && vite build）成功。テスト: 対象別実行で確認（全量は環境タイムアウト）。

## 2. Git状態とバックアップ（作業前）

- HEAD: `b2738a2`（前回v3成果、origin/mainへpush済み）。
- 未コミット: ユーザー由来の画像削除（D `src/S__*.jpg` 等多数）＋未追跡（プロンプト文書・画像・`artifacts/blender_prototype/`・`artifacts/kenney/inbox/`）。**これらには一切触れない。**
- バックアップ方針: 既存追跡ファイルの変更はRPG関連のみ。新規ファイルはuntracked→必要時のみ`git add`。ブランチは切らずmainで作業し、pushは明示許可後のみ（前回v3と同ルール）。
- 前回v3成果（2.5D SVG立体マップ）は破壊せず残す。今回の3Dランタイムは新規追加し、RPGタブ内に3D版導線を追加する。

## 3. Blender MCP（実名ツール・接続済み）

接続: OK。開局ファイル: `artifacts/blender_prototype/grassland_prototype.blend`（保存済み・97 objects）。
Blender: **5.2.3 LTS**。glTFインポート可（`bpy.ops.import_scene.gltf` 存在確認）。

利用可能な実ツール名（捏造なし・本セッションの一覧より）:
- `blender_execute_blender_code`（bpy実行・`result` dict返却）
- `blender_execute_blender_code_for_cli`（background実行）
- `blender_get_blendfile_summary_datablocks` / `_path_info` / `_missing_files` / `_linked_libraries` / `_usage_guess`
- `blender_get_objects_summary` / `blender_get_object_detail_summary`
- `blender_get_screenshot_of_window_as_image` / `..._of_area_as_image` / `..._as_json`
- `blender_jump_to_tab_by_name` / `_by_space_type` / `_to_view3d_object_by_name`
- `blender_render_thumbnail_to_path` / `blender_render_viewport_to_path`
- `blender_search_api_docs` / `blender_search_manual_docs` / `blender_get_python_api_docs`
- 既知の制約（前回記録）: liveレンダーはMCP切断を起こす。レンダーはCycles CPU＋background CLIで行う。

## 4. 外部アセット取得手段（実名ツール・在庫確認済み）

- `ambientcg_search` / `ambientcg_get_files` / `ambientcg_download`（実在。在庫: `artifacts/ambientcg/Grass005`＝Color/Normal/Roughness/AO/Displacementの1K-JPGセット＋.blend/.mtlx/.tres/.usdc）。
- `polyhaven_search` / `polyhaven_get_files` / `polyhaven_download`（実在。在庫: `artifacts/polyhaven/brown_planks_03`＝diff/nor/rough/disp 1k＋.blend）。
- `kenney_search` / `kenney_get_files` / `kenney_download`（実在。在庫: `artifacts/kenney/nature-kit`＝GLB 329件（`Models/GLTF format/*.glb`）＋models.json＋preview.html。CC0）。
- 補助: `.opencode/tools/{ambientcg,polyhaven,kenney}.ts`（取得ロジックの原本）。
- 方針: 新規DLは単品・必要最小限。既存在庫を優先し、`artifacts/index.json`＋`ASSETS.md`を更新する。

## 5. 素材適用計画（Phase 2 確定）

- Kenney（3個以上）: `tree_detailed`系・`rock`系・`bridge_wood`系・`fence`等をBlenderへ`import_scene.gltf`で読み込み、配置・回転・スケール調整のうえW1へ統合。
- ambientCG: Grass005のColor/Normal/Roughnessを地形上面マテリアルへ画像テクスチャ接続（Non-Color指定はNormal/Rough）、土側面には色調整版または別途取得のDirt系を検討（在庫優先、不足時のみDL）。
- Poly Haven: brown_planks系を橋・建物の木部マテリアルへ適用（写実寄りのため色調・ラフネスをスタイライズ側へ寄せる）。HDRIはBlenderライティング検証用に取得検討（実行時には使わず、軽量なSun＋Hemisphereへbake相当の色で置換）。
- すべて`asset_manifest.json`＋`ASSET_CREDITS.md`へ実ファイル・Blender参照・ゲーム参照を記録。

## 6. 3Dランタイム方針（Phase 5 確定）

- `three` をnpm依存追加（0.187.x）。GLTFLoader＋AnimationMixer＋追従/全体カメラ＋D-pad/キー/タップ入力。
- GLB配置: `public/rpg/`（URL安定・サイズ大のためバンドル外）。`world1_grassland.glb`＋`player_character.glb`＋`environment_props.glb`。
- 移動は既存`rpgMovement`のdeltaTime方式を3D座標へ拡張。道メッシュ＝経路中心線から生成し表示と論理を一致。
- `.blend`ソースは`assets/3d/source_blender/`相当（既存構成尊重: `artifacts/blender_prototype/`の隣に`artifacts/blender_w1/`新設ではなく、`artifacts/3d/`へ整理。詳細はPhase 3で確定）。

## 7. 既知の制約・ブロッカー候補

- headless Chrome WebGL: SwiftShaderで`webgl2`取得OKを確認（スクショ可の見込み）。
- 旧簡易マップの絵文字テスト固定: 既存テストを壊さないため旧表示は残し、3D版を新導線で追加する。
- 全量テストのタイムアウト: 対象別実行で代替（前回と同）。
