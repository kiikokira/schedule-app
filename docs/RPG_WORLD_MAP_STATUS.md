# RPGワールドマップ 進捗ステータス

最終仕様（v4）: `src/RPG_World_Map_OpenCode_Prompt_v4.md`（最上位）。v3仕様の成果（2.5D版）は破壊せず残置。
このファイルは複数フェーズ作業の再開用 ledger。完了/未完了/未検証を区別する。

## v4 実績（2026-11-04・3D再構築）

- Phase 1: `docs/RPG_PROJECT_AUDIT.md` 作成（技術・Git・Blender実名ツール・素材手段・方針）。
- Phase 2: Kenney 16種・ambientCG Grass005（3マップ）・Poly Haven planks（2マップ）をBlenderへ実適用。
- Phase 3: `artifacts/3d/source_blender/world1_grassland_source.blend`（222 objects）→ `world1_grassland.glb` 1.76MB（98 meshes/5 images/22 materials）＋ `world1_graph.json`（nodes16/paths17）。
- Phase 4: `player_character_source.blend`（Sola・21ボーン・rigid skin）→ `player_character.glb` 332KB（anims24/skins1、全名列挙検証）。
- Phase 5: three 0.187 ランタイム `RpgWorld3d.tsx`（GLB並列読込＋進捗UI・Mixer・追従/全体カメラ・D-pad/キー/タップ・保存・クリーンアップ）。
- Phase 6-8: 3D移動（Catmull-Rom中心線・arc・分岐・タップBFS）・特殊（jump/ladder/stairs/slope/fall＋逆走）・ステージ3・W1サムネ実写化。
- Phase 10: 本報告の検証節を参照。受け入れ21項目のうち3D・主人公・操作・カメラ・進行の主要項目を達成（詳細は `docs/RPG_IMPLEMENTATION_REPORT.md`）。
- 未着手: W2〜W9の3D化、水泳経路、App直接遷移配線、カメラコリジョン、GLB更なる軽量化（Draco等）。

## v4 Phase 9 第一弾：W2砂漠（2026-11-04）
- `scripts/blender/build_world2_desert.py`（再現可能・assert付）→ `world2_desert_source.blend`（135 objects）→ `world2_desert.glb` 1.24MB（75 meshes/22 mats/5 images）＋ `world2_graph.json`（nodes16/paths17）。
- 新規素材: ambientCG Ground093C（砂・3マップ・512px）／Kenney砂漠18種（cactus/rock/stone/bridge_stone/fence/sign/cave/steps/flowers/bush/riverRocks/pathCircle/campfire）。
- デューン地形・メサ・涸れ川・オアシス・日干し小屋・遺跡・石橋（raycast実測arc）。ladder rise 2.62m・jump gap 3.01mをassert検証。Cyclesレンダーで目視確認。
- ランタイム多世界化: `RpgWorld3d worldId`＋`WORLD3D_CONFIG`、W2導線・サムネ・ desert-stage対応、W2グラフテスト4件・W2導線テスト1件。
- 残り: 水泳、App直接遷移、カメラコリジョン。

## v4 Phase 9 全世界完成（2026-11-04・W3〜W9）
- 共有kit `scripts/blender/wkit.py` をW2実績から抽出（地形・リボン・Kenney・はしご・橋適合・graph・export検証）。
- W3雪原 / W4海 / W5深森 / W6岩山 / W7浮島 / W8火山 / W9幻想を各専用スクリプトで制作。全てBUILD_OK（assert付）＋Cycles目視。
- 新規PBR: Snow011・Rock030・Rock035（各3マップ・512px・GLB埋込）。Kenney追加40種（パーム・テント・切株・キノコ・崖・滝・丸橋等）。
- W5帯問題を系統 debug：等高線バンドと特定→閾値0.5→0.4＋smooth＋細分化で解消（W5/W6再構築）。
- ランタイム9世界化: `WORLD3D_CONFIG` 1-9・空色・adapter接尾辞方式・解放表自動生成・導線一般化・サムネ実写9種（軽量jpg）。
- テスト: グラフ34件（7世界×3＋既存）・導線14件。全てPASS。
- 実機: 9世界すべて追従表示・キャラ・影・ラベルを確認（W7は接地を数値でも確認）。
- 残り: 水泳、App直接遷移、カメラコリジョン、Draco。

## 調査結果（Step1, 2026-11-04）

- 技術: React 18 + Vite 5 + TS + Vitest（`package.json`）。3D描画ライブラリ未導入（three/R3F なし）。
- RPG実装箇所:
  - `src/lib/rpgWorlds.ts`（9ワールド定義・進行ロジック）+ `src/lib/rpgWorlds.test.ts`
  - `src/components/RpgMap.tsx`（平面SVG 360x220・絵文字装飾・丸ノード）+ test
  - `src/components/RpgAdventure.tsx`（選択→自動再生のみ）+ test
  - `src/components/RpgWorldSelect.tsx`（9カード・絵文字・🔒絵文字ロック）
  - 使用箇所: `src/screens/RankingScreen.tsx` RPGタブ（`levelForExp(season.exp)` 連動、クエストは todayPages>0）
- 保存: `schedule-app-season-v1`（seasonStore, localStorage）。RPG専用保存なし。
- ビルド: `npm.cmd run build` 成功（tsc -b && vite build）。
- テスト: 全量 `npm test` は環境でタイムアウトのため未検証（対象別実行で確認する）。
- git状態: ユーザーの未コミット変更あり（画像の D / ??）。本作業では触らない。`git add` は対象ファイルのみ、コミット/プッシュは許可なしに行わない。
- 方針決定: 新規依存なしの 2.5D SVG 立体表現で Phase 1 を実装（WebGL対応・バンドル・低端末リスク回避）。仕様16.1のフォールバック許容に適合。

## 短い計画（調査後に停止せず実装）

1. `rpgProgress`（保存・移行・破損復旧）TDD
2. `rpgGrassWorld`（草原グラフ・地形高さ・経路探索・検証）TDD
3. `rpgMovement`（deltaTime補間・状態機械）TDD
4. `rpgStageAdapter`（既存機能への薄い接続）TDD
5. `RpgCharacter`（オリジナルSVG・絵文字不使用）
6. `RpgGrassMap`（3/4視点・厚み地形・背景多層・環境アニメ・追従/全体カメラ・D-pad/キー/タップ）
7. `RpgAdventure` 統合（既存テストID維持・レガシー破壊なし・草原立体版への導線）
8. `RpgWorldSelect` 脱絵文字（SVGプレビュー・SVG錠アイコン、testid維持）
9. build + 対象テスト + スクリーンショット + 修正反復
10. 最終報告（PASS/PARTIAL/BLOCKED を正直に）

## Phase 1 状態

- [x] Step1 調査
- [x] Step2 画面骨格と描画基盤（RpgAdventureに立体版導線、RpgGrassMap描画領域・カメラ）
- [x] Step3 草原地形・アセット（上面/側面/厚み・丘・川・橋・はしご・木・岩・小屋・旗・洞窟・城門・看板・草・花・遠景多層）
- [x] Step4 キャラクター（オリジナル「ソラ」SVG・idle/walk/run/turn/ladder/jump/land/swim/ crouch）
- [x] Step5 経路グラフと移動（14ノード/14パス・分岐・タップBFS・deltaTime補間・終端クランプ）
- [x] Step6 特殊アクション（jump準備/上昇/下降/着地・ladder上下・slope/stairs上下・fall・run・逆走対応）
- [x] Step7 ステージ連携（3入口＋StageAdapter→今日の計画/参考書/ランキング誘導、クエスト達成で解放）
- [x] Step8 保存・復元（rpgProgress v1・移行・破損時バックアップ復旧・最終ノード保存）
- [x] Step9 スマホ・PC最適化（D-pad・キー・タップ・Shift走・M全体・SafeArea配慮・44px・reduced-motion）
- [x] Step10 視覚確認と仕上げ（3サイズ撮影・2回修正反復：ヘッダー2行化・ラベル下配置・草追加・岩移動）
- [ ] Step11 残り8ワールド（Phase 2・未着手。W2〜W9は旧簡易マップのまま）

## 変更ファイル（予定）

- 新規: `src/lib/rpgProgress.ts`, `src/lib/rpgProgress.test.ts`
- 新規: `src/lib/rpgGrassWorld.ts`, `src/lib/rpgGrassWorld.test.ts`
- 新規: `src/lib/rpgMovement.ts`, `src/lib/rpgMovement.test.ts`
- 新規: `src/lib/rpgStageAdapter.ts`, `src/lib/rpgStageAdapter.test.ts`
- 新規: `src/components/RpgCharacter.tsx`
- 新規: `src/components/RpgGrassMap.tsx`, `src/components/RpgGrassMap.test.tsx`
- 編集: `src/components/RpgAdventure.tsx`, `src/components/RpgWorldSelect.tsx`
- 編集: `src/styles.css`
- 本ファイル

## 検証コマンド（実績）

- `npm.cmd run build` → 成功（tsc -b && vite build、PWA生成まで正常）
- RPG対象8ファイル: 41/41 PASS（新規 rpgProgress/GrassWorld/Movement/StageAdapter/GrassMap、既存 RpgMap/RpgAdventure/rpgWorlds含む）
- 回帰（Ranking/Settings/Home/MyPage）: 356/357 PASS。1件は `RankingScreen > ライバル行` の日付シード依存の既存失敗（当方差分はRPGタブへのprops追加のみで無関係、git diffで確認）
- SettingsScreen単体は120/120 PASS（jsdomのURL.revokeObjectURL未実装によるunhandled errorは既存の環境起因）
- 全量 `npm test` は環境タイムアウトのため未実施（対象別に確認）
- 視覚確認: Chrome headless実ピクセル撮影（静的SSR＋実CSS/実SVG）
  - 390x844: ワールド選択 / 草原追従 / 草原全体
  - 430x932: ワールド選択 / 草原追従
  - 1440x900: 草原追従 / 草原全体 / ワールド選択
  - 修正反復2回: (1)追従カメラ初期位置・ヘッダー2行化・ラベル下配置・草の質感追加・岩の退避・重複看板整理 (2)はしご逆走・坂/階段逆走・自動連続移動時のアニメ更新
  - ステージパネル・移動中のジャンプ姿勢はピクセル未撮影（rAF遷移後のため）。到着演出→パネル表示とクリア記録はjsdomテストで検証済み（4/4 PASS）

## 未完了・未検証（正直な記録）

- Phase 2（W2〜W9の立体化）未着手。W2〜W9は旧簡易マップ（平面SVG＋絵文字）のまま残る。
- 水泳パス（swim経路）未実装。SWIMアニメ状態は定義済みだが経路がない。建物出入りはステージ到着演出（ENTER_STAGE）で代替。
- Appレベルのステージ遷移（マップ→今日の計画/参考書詳細への画面遷移）は未配線。StageAdapterが既存フローを指名する形で接続し、クエスト達成状態は実データ連動。次の作業でAppルート追加を推奨。
- 旧簡易マップ（RpgMap/RpgWorldSelect旧表示）の絵文字が残存。既存テストが内容を固定しているため互換維持。草原立体版は絵文字ゼロ。
- 全量テスト未検証（環境タイムアウト）。対象別では上記の通り。
- コミット/プッシュ未実施（破壊的操作の許可なしのため。AGENTS.mdの運用ルールと競合するため許可待ち）。
- ユーザーの未コミット変更（画像のD/??）には一切触れていない。
- ブラウザ実機スクショ手段が未確定（取得できなければ「未検証」と明記する）。
