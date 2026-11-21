# 帰り汽車スタート 残課題修正

## Context

2026-11-20 に実装した帰り汽車スタート（`bf3fe48`）の最終再レビューで残った Minor 2件をまとめて直す。
対象は `src/screens/TodayPlanScreen.tsx` と `src/screens/TodayPlanScreen.trainStart.test.tsx` のみ。
スタート/リセット/マーカー/リーグ同期の既存仕様は変えない。

## Global Constraints

- 汽車枠の時間（17:33–19:11）、二度押し後勝ち、曜日設定を書き換えない、マーカー方式は不変。
- 変更ファイルは上記2つに限定する（`src/lib` と `src/data` は触らない）。
- TDD: 先に失敗するテストを追加して確認し、実装後に通す。
- 対象テスト・全テスト・`npm run build` を通す。
- コミットは変更したファイルのみ。コミットメッセージ: `fix: clear train start notice and key league per slot`。

## Task 1: 通知の後始末と枠ごとのリーグキー

### 1-A 通知の後始末（残課題1）

現状 `trainStartNotice` は設定後クリアされず、手動の「今日だけ上書き」保存後も残る。また日付が変わっても前日の通知とバックアップ状態が残る。

- `saveTodayOverrides` と `saveDayRows` の保存成功時に `setTrainStartNotice(null)` を追加する（手動保存が優先。既存の `clearTrainStartBackup` / `setTrainStartBackup(null)` の近く）。
- 既存の `useEffect(..., [today])`（`refreshAvailability` を呼んでいるもの）で、`setTrainStartNotice(null)` と `setTrainStartBackup(loadTrainStartBackup(today))` を行う。理由: 画面を開いたまま日付が変わったとき、前日の通知・前日のバックアップで今日の上書きを壊さないため。
- スタート/リセットの成功・失敗メッセージの挙動は変えない（押した直後は出る）。

### 1-B 枠ごとのリーグキー（残課題2）

現状 `trainOriginKey` は「最初の origin 付き onTrain 枠」のキーを全 onTrain 行に使うため、複数の汽車枠があると他の行のキーが狂う。

- `trainOriginKey`（単一文字列）を `trainOriginKeyByRange: Map<string, string>` に置き換える。
  - `slotsForDate(availability, today)` を走査し、`onTrain && originStartMin != null && originEndMin != null` の枠について `rangeKeyOf(startMin, endMin)` → `makeSlotKey(today, originStartMin, originEndMin)` を入れる。
  - `useMemo` の依存は `[availability, today]`。
- 行ループ内の `slotKey` を次にする:
  - `const slotKey = trainOriginKeyByRange.get(pageKey) ?? makeSlotKey(today, s.startMin, s.endMin)`
  - `pageKey` は同ループで既に定義済み（`rangeKeyOf(s.startMin, s.endMin)`）。
  - `s.onTrain` 条件は不要。origin の無い枠は従来どおり自範囲キー。
- これにより、記録・スキップ・`locked` 判定が枠ごとに正しい元キーを使う。

### Tests（`TodayPlanScreen.trainStart.test.tsx`）

1. 既存の「drops the reset marker when a manual today override is saved」を拡張し、手動保存後に `train-start-notice` が消えることを assert する。
2. 新規: 日付変更で通知と前日のリセットボタンが消える。
   - 18:30 にスタート → 通知とリセットあり。
   - `rerender` で `today="2026-11-22"` に変更。
   - `train-start-notice` と `train-start-reset` が消える。`schedule-app-train-start:2026-11-21` は残る（今日のデータは消さない）。
3. 新規: 複数の origin 付き汽車枠で、スキップした枠の元キーだけが記録される。
   - 20:00（両枠終了後）に、未割当の日付上書きを2件保存:
     - 09:00–10:00, onTrain, originStart 08:30, originEnd 10:00
     - 17:45–19:11, onTrain, originStart 17:33, originEnd 19:11
   - 描画後、各 row の select で b1 を選ぶ。
   - 2行目（17:45）の `slot-missed-b1` を押し、`record-confirm-yes` を押す。
   - `loadSeasonState(TODAY).slotMatches` に `2026-11-21#1053-1151` があり、`2026-11-21#1065-1151` が無いことを assert。
   - 続けて1行目もスキップし、`2026-11-21#510-600` があることを assert。
   - 期待値: 08:30=510, 10:00=600, 17:33=1053, 19:11=1151, 17:45=1065。
   - 注意: `autoForfeitPastSlots` がマウント時に走るため、最初は bookId を付けず、描画後に UI で本を選ぶ（既存のスキップテストと同じ手法）。これで自動確定を避ける。

## Verification

- `npm test -- --run src/screens/TodayPlanScreen.trainStart.test.tsx`
- `npm test -- --run`（全テスト。既知の FocusPeriodScreen flaky が負荷時に落ちる場合は単体再実行で確認）
- `npm run build`
- 変更ファイルのみ `git add` して1コミット。
