# RPG_IMPLEMENTATION_REPORT.md（v4 最終報告・証拠付き）

## 1. 技術スタック
React 18 + Vite 5 + TypeScript + Vitest + Dexie + **three 0.187**（新規）。GLTFLoader / AnimationMixer。保存は既存localStorage（`schedule-app-season-v1`＋`schedule-app-rpg-progress-v1`）。

## 2. 変更・追加ファイル
- 新規: `src/lib/rpgWorld3d.ts(+.test.ts)`、`src/components/RpgWorld3d.tsx`、`public/rpg/{world1_grassland.glb, player_character.glb, world1_graph.json, thumb-w1.png}`、`artifacts/3d/*`、`docs/{RPG_PROJECT_AUDIT.md, ASSET_PIPELINE_REPORT.md, RPG_IMPLEMENTATION_REPORT.md}`
- 編集: `RpgAdventure.tsx`（3D導線追加のみ）、`RpgWorldSelect.tsx`（W1サムネイル実写化）、`rpgMovement.ts`（ENTER_CAVE/EXIT_CAVE追加）、`rpgProgress.ts`（3D初期解放パス追加）、`RpgAdventure.test.tsx`（導線テスト追加）、`package.json`（three/@types/three）
- 既存の2.5D SVG立体版・旧簡易マップ・全既存テストは維持。

## 3-6. 素材実使用（証拠は asset_manifest.json）
- Blender: `world1_grassland_source.blend`（地形・道・川・橋配置・はしご・小屋・門・旗）／`player_character_source.blend`（Sola・21ボーン・24クリップ）
- Poly Haven brown_planks_03（diff/rough→W1_Wood）、ambientCG Grass005（Color/NormalGL/Roughness→W1_GrassTop）、Kenney Nature Kit 16種（配置・加工・マテリアル統合）
- GLB: world 1.76MB（98 meshes/5 images embedded）、chara 332KB（anims 24/skins 1）。いずれもJSON chunk列挙で検証。

## 7. Blender MCP実ツール名
`blender_execute_blender_code`（制作全般・検証）／`blender_get_blendfile_summary_{path_info,datablocks}`（接続・内容確認）。レンダーは制約によりbackground CLI（Cycles CPU）を使用し記録。

## 8. アニメーション（GLB内実在名と一致）
Idle/Walk/Run/TurnL/TurnR/JumpStart/JumpLoop/JumpLand/Fall/ClimbUp/ClimbDown/StairsUp/StairsDown/SlopeUp/SlopeDown/SwimEnter/Swim/SwimExit/EnterCave/ExitCave/EnterBuilding/ExitBuilding/EnterStage/ReturnStage。全in-place（移動は経路エンジン）。

## 9. 実装済み
W1（nodes16/paths17・分岐n4・ジャンプp12・はしごp8・階段p6・橋p3・ステージ3・出口門）。W2〜W9は旧表示のまま（Phase 9 未着手）。

## 10. ビルド・テスト
- `npm.cmd run build` 成功（要最終確認）
- 新規 `rpgWorld3d.test.ts` 9件PASS（実JSON検証・経路・arc・正規化）。既存41件＋回帰は最終実行で確認。
- コンポーネント自体はWebGL要のためjsdom対象外。導線テスト（rpg-3d-open/close）PASS。

## 11. スクリーンショット（%TEMP%/opencode/rpg-shots）
3d-light.png（読込完了）／3d-follow-desktop.png（Sola＋影＋追従）／3d-over-desktop.png・3d-over2.png（全体）／3d-panel2.png（丘の小屋パネル＋決定）／3d-follow-430.png（430px）／3d-walk.png・3d-stage.png（移動中）／w1_final.png（Blender Cycles）／sola_rest3.png（キャラ正面）。

## 12. 未実装・未検証・既知の制限
- W2〜W9の3D化未着手。水泳経路なし（SWIM系クリップは定義済み）。Appレベル画面遷移の直接配線なし（StageAdapter指名＋実データ連動まで）。
- 高低差の激しい崖っぷち等で追従カメラが地形にめり込む場合あり（カメラコリジョンなし・v1制限）。
- ジャンプ/はしご/階段の空中・動作中ピクセルは未撮影（到達・パネル・クリアは撮影＋テスト済み。移動サンプリングとクリップ名は単体テスト＋GLB列挙で検証）。
- 全量 `npm test` は環境タイムアウトのため対象別実行。

## 13. 既存アプリへの影響
ホーム・スケジュール・ランキング・設定・保存データは破壊なし（回帰テストで確認）。2.5D版・旧マップも残置。ユーザーの未コミット変更（画像D/??）に不干渉。

## 14. 起動方法
通常通り `npm run dev`／本番は `main` push後のGitHub Pages。RPGは ランキング→RPGタブ→「草原ワールド3Dであそぶ」。
