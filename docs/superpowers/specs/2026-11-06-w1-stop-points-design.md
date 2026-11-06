# W1円形停止点システム（Phase 1）設計書

日付: 2026-11-06 / 対象: ワールド1のみ / 先行実装: 8ステージ厳密順次（commit 145f857）

## 背景と目的

W1は16ノード/17パス/8ステージ・厳密順次・procedural冒険者・青赤灰ゲート済み。
今回（Phase 1）はその上に「円形停止点」を追加する：全16ノード位置に3D円形台座を
接地配置し、キャラクターを必ず円中心で停止させる。ステージ解放（青/赤/灰）と
内部連動させる。見た目だけのデモにしない。

## スコープ（Phase 1に含める）

- StopPoint登録表（16点、独立ID、半径、接続、stage対応）
- 3D円形台座（外周リング＋内側敷石＋中央マーク、状態形状付き）
- 中心停止（速度ゼロ・idle切替・接地、タップはdwell継続・D-padは待機）
- 青赤灰の台座連動（色＋形状、色覚非依存）
- 既存進行・保存・カメラの流用、W2〜9不変、回帰テスト＋build

## 非目標（Phase 2以降）

- 多段テラス・崖整形、個別立体石の石畳化、滝・川・水辺演出
- W2〜9への停止点展開、新規保存キー、新規ライブラリ

## アーキテクチャ

```text
world1_v2_graph.json（単一座標源）
  └─ rpgW1Stops.ts（派生登録・純粋関数・テスト可能）
       ├─ RpgWorld3d W1分岐（台座生成・接地配置・マーカー置換）
       ├─ 移動制御（D-pad待機 / タップdwell / locked全層禁止）
       └─ w1CanEnter / normalizeW1Cleared（既存進行ロジック流用）
```

`buildWorld1Terrain` 本体は変更しない。W1専用追加は `rpgW1Stops.ts` と
RpgWorld3d内W1分岐に閉じる。`RpgWorld3d.tsx` 本体への変更はW1条件分岐のみ。

## StopPoint登録表

ID規則 `stop_<nodeId>`。座標はグラフから参照し複製しない。

| stop ID | node | type | 半径 | stage |
|---|---|---|---|---|
| stop_n0 | n0 | start | 2.2 | - |
| stop_n1 | n1 | stage | 2.4 | w1-stage-1 |
| stop_n2 | n2 | stop | 2.0 | - |
| stop_n3a | n3a | bridge | 2.0 | - |
| stop_n3b | n3b | bridge | 2.0 | - |
| stop_n4 | n4 | stage/junction | 2.4 | w1-stage-2 |
| stop_n5a | n5a | stairs | 2.0 | - |
| stop_n5b | n5b | stop | 2.0 | - |
| stop_n5c | n5c | stairs | 2.0 | - |
| stop_n5d | n5d | stairs | 2.0 | - |
| stop_n6 | n6 | stage | 2.4 | w1-stage-3 |
| stop_n7 | n7 | stage/challenge | 2.4 | w1-stage-4 |
| stop_n8 | n8 | stage | 2.4 | w1-stage-5 |
| stop_n9 | n9 | stage | 2.4 | w1-stage-6 |
| stop_n10 | n10 | stage/fort | 2.4 | w1-stage-7 |
| stop_n11 | n11 | stage/final | 2.6 | w1-stage-8 |

- `canStop`: 全点 true（通常点も停止する）
- `connectedPathIds`: グラフから自動算出（手書きしない）
- `canEnter`: stage点は `w1CanEnter(stageId, cleared)` に委譲、非stage点は常時 true
- 進行・unlock・移行（旧grass-stage対応）は現行 `rpgW1Stages.ts` を変更せず流用

## 3D円形台座

- 構造（3層）: 外周リング（大きな石の円、幅0.35）＋ 内側敷石（小さな石、既存DIDirt同系色）＋ 中央マーク（ステージ点のみ）
- 接地: 中心Y = 地形高さ + 0.05、縁は地形に追従（段差0.5未満）、浮遊・埋没テストで全点検証
- 状態表現（色＋形状）:
  - cleared（青）: 青リング＋中央に青のraised disc
  - next（赤）: 赤リング＋脈動する外周glowリング
  - locked（灰）: 灰リング＋小さな灰色ポスト＋箱（鍵相当）
- 既存stage gem（八面体）は中央マークに置換。不可視hit球は残しタップ判定維持
- 道路は現行リボンのまま石畳色寄せのみ（個別石化はPhase 2）

## 移動・停止セマンティクス

到着の定義: ノード座標（＝円中心）に速度ゼロ、歩行→idle切替、台座高さに接地。

| 操作 | 挙動 |
|---|---|
| D-pad / WASD（1区間） | 円中心で停止し次の入力まで待機 |
| D-pad長押し継続 | 各円でdwell後に同方向へ自動継続（指を離したら停止、locked先には進まない） |
| タップ連続移動 | 各中間円で0.4秒dwell（減速→中心停止→idle呼吸→自動継続） |
| Enter / 決定ボタン / ステージパネル | locked円は開始不可（表示＋内部判定の両方） |
| locked円への経路 | タップ経路がlocked円を通過する場合はその手前円で停止 |

ジャンプ・はしご・橋の特殊移動は維持。経路は円単位に分割し、円中心→道→円中心の
連鎖が崩れないこと。キャラクターが草原・崖・水を歩かないこと（現行道路拘束維持）。

## 進行・保存・カメラ・UI

- 進行: `normalizeW1Cleared` / `w1NextStage` / `w1CanEnter` / `w1IsComplete` を流用。新規保存キーなし
- 保存: `schedule-app-rpg-progress-v1` 継続（`clearedStageIds`、`lastKnownNodeId['3d-1']`）
- カメラ: 現行の斜め俯瞰＋追従＋全体表示を維持。全体表示の画角は変えない（円が丸く見える）
- UI: 既存の青赤灰凡例を円形台座対応の文言に更新。W2〜9の表示・動作は不変
- 操作: D-pad / WASD / Enter / タップ / ピンチの既存対応を維持

## エラーハンドリング

- グラフ取得失敗時は現行フォールバック（v1グラフ）を維持し、台座生成前にvalidateする
- locked判定は表示層だけでなく移動・決定・クリア記録の全層で実施（URL/状態改変での突破不可）
- 地形高さNaN・ノード欠落時は該当台座を生成せず、移動・進行ロジックは停止しない
- reduced-motion時は脈動・dwell演出を抑制し、停止・待機の意味は維持する

## テスト

- 純粋（`rpgW1Stops.test.ts`）: 16点・ID規則・半径・接続自動算出・stage対応、全点canStop、locked円を含む経路の手前停止、旧セーブ移行の維持
- 3D/接地: 全パッドの埋没・浮遊なし（既存burial/floatテストの条件を流用）
- UI/挙動: 青赤灰の色＋形状、タップdwell継続・D-pad待機・locked不可（タップ/キー/決定/クリア記録）
- 回帰: 既存RPGテスト群＋`npm run build` 成功
- 手動（依頼§10の今回分）: 円形配置・丸く見える・中心停止・道路歩行・道路外不出・青赤灰・橋階段接地・全景表示・スマホ操作・既存機能無傷

## 移行・互換性

- 既存W1セーブ（w1-stage-* / grass-stage-*）は `normalizeW1Cleared` で吸収し、台座状態に反映する
- `public/rpg/world1_v2_graph.json` の幾何は変更しない（座標移動なし）
- W1専用コードは他ワールドに影響しないこと。`WORLD3D_CONFIG` のW2〜9定義は不変
