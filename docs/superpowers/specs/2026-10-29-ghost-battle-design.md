# ゴースト対戦 デザイン仕様（2026-10-29）

## 概要
過去最高の日の自分（ゴースト）と今日の自分を「今日の計画」画面でリアルタイム比較する。
常に最強の自分が相手。記録ボタンを押すたびに抜きつ抜かれつが分かる。

## 要件確認済み（Q1-Q6）
- Q1: 過去最高の日の時間帯ペース vs 今日のリアルタイム比較
- Q2: A 自動・過去最高日をゴースト（毎日更新）
- Q3: C これから時刻付きログを取る、過去分は均等ペースで暫定
- Q4: A 「今日の計画」画面に組み込み
- Q5: A 今日の最初の空き枠開始＝ヨーイドン
- Q6: A ページ＋区画の合算（ランキングと同じ集計）

採用アプローチ: 案2 ハイブリッド・イベントログ方式

## ① データとゴースト確定ルール
- 新テーブル `ghostLogs`（Dexie v6追加）: `{ id: string, date: string(YYYY-MM-DD), atMs: number, total: number }`
  - `total` はその日の合算累計（`combinedActivityOnDate` と同一定義: ページ＋区画、studyMode正規化込み）。
  - ページ記録・区画記録の追加/更新/削除が成功するたびに、その日の最新合算を1件追記。追記のみ、更新・削除なし。
  - 既存データのバックフィルなし。
- ゴースト日: `date < today` の範囲で合算最大の日。タイブレークは新しい日付を優先。
  - 当日固定: 画面表示中は日を切り替えない。今日が過去最高を抜いてもゴースト日は変えず「撃破！」表示にする。
  - 履歴なし（今日より前の記録なし）: ゴーストなし。
- ゴースト曲線:
  - `ghostTotal` はゴースト日の最終合算（`combinedActivityOnDate(ghostDate)` と同値。`ghostLogs` 最終スナップショットと一致する想定）。
  - ログあり（そのゴースト日に `ghostLogs` が2件以上）: 初ログ時刻を0分とする相対経過の折れ線を線形補間。`ghostElapsed = atMs - firstAtMs`。最終区間以降は `ghostTotal` で頭打ち。
  - ログなし/1件のみ: 均等フォールバック `ghost(now) = floor(ghostTotal * elapsed / todayTotalMinutes)`。
  - `elapsed = nowMin - todayFirstSlotStartMin`。`elapsed < 0` は開始前、`elapsed > todayTotalMinutes` は終了後としてクリップ。
  - `todayFirstSlotStartMin` と `todayTotalMinutes` は当日上書きクリップ前の `slotsForDate(availability, today)` 全枠から算出（開始時刻固定・分母固定のため）。日中の枠編集でスタート位置やゴール距離は変えない。
- すべてローカル（Dexie）。外部送信なし、オフライン可。

## ② 今日画面の表示・勝敗ルール
- 場所: `TodayPlanScreen` の時間割リスト直下にカード1枚追加（`data-testid="ghost-battle"`）。既存の記録フローは変えない。
- 表示要素（最小限）:
  - ヘッダー: `vs 過去最高ゴースト M/D 合計X`（Xは合算）。
  - 2本バー: あなた（今日累計） vs ゴースト（同経過時点推定値）。数値＋差分1行（`+12 リード` / `-8 ビハインド` / `イーブン`）。
  - 状態バッジ: `まだスタート前` / `対戦中` / `ゴースト撃破！` / `惜敗` / `タイ`。
  - 終了後（今日の最終枠終了以降）: 確定結果を固定表示。
- 計算:
  - `あなた = combinedActivityOnDate(today, validRecords, validCycles)`
  - `ゴースト = ghostTotalAt(elapsed, curve)`（①の曲線）。
  - 更新タイミング: 記録操作成功時（state更新による再レンダー）＋既存の1分タイマーに相乗り。新規タイマーは作らない。
- スコープ外（やらないこと）: 勝敗によるEXP/リーグ加点、通知、ゴーストの手動保存・複数持ち・名前付け、専用対戦画面。これらは将来拡張とする。

## ③ エラーハンドリング
- 履歴なし: カードを出さず `まだゴーストがいません。記録を続けよう` の1行のみ。
- 今日枠なし/開始前: `今日の枠が始まったらゴーストが走り出すよ` 表示、計算しない。
- ログ破損（atMs不正・total負数・逆行）: 当該イベントを無視して均等ペースに切替。例外を投げない、コンソール警告のみ。
- 記録削除・編集: 次回追記で累計が自動補正。過去ログの書き換えはしない。
- 枠変更（当日上書き等）: `todayFirstSlotStartMin` と `todayTotalMinutes` を再計算するだけで追従。ゴースト日は変えない。

## コンポーネント・実装方針
- 新規: `src/lib/ghost.ts`（純粋関数: `findGhostDate`, `buildGhostCurve`, `ghostTotalAt`, `ghostStatusFor`）。
- 変更:
  - `src/db/database.ts`: version 6 で `ghostLogs` 追加（`id, date` インデックス）。
  - `src/hooks/useRecords.ts` / `useCycleRecords.ts` または呼び出し側: 書き込み成功後に `ghostLogs` へ追記するヘルパー経由に寄せる（重複追記を避けるため1箇所に集約）。
  - `src/screens/TodayPlanScreen.tsx`: ゴーストカード追加のみ。既存ロジックの変更は最小限。
- 既存パターン遵守: `combinedActivityOnDate` / `pagesRecordsForTotals` / `cycleRecordsForTotals` の正規化を再利用。`slotLeague`/`seasonStore` には触れない。

## テスト
- `src/lib/ghost.test.ts`:
  - 最高日選択（今日除外・当日固定・タイ時は新しい日）。
  - 均等計算（開始前0、終了後=合計、端数切り捨て）。
  - ログ補間（初ログ基準・区間線形・範囲外クリップ・破損無視）。
  - 枠なし/開始前の非表示判定。
- `src/screens/TodayPlanScreen.ghost.test.tsx`:
  - リード/ビハインド文言、ゴーストなし文言、開始前文言、終了後確定表示。
- 受け入れ条件: 既存テスト全緑＋ `npm run build` 成功。

## 将来拡張（今回やらない）
- 手動ゴースト保存・複数ゴースト・名前付け、専用対戦画面、EXP/リーグ連動、通知、週単位ゴースト。
