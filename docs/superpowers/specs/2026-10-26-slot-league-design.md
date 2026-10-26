# スロット単位リーグ戦 Design (2026-10-26)

承認済み方式: **案A スロットマッチ拡張**。1日1節→今日の計画の時間帯1枠1試合に変更。Div10〜4は勝ち点ラウンド制、Div3〜1はレーティング制を維持したまま枠ごとに進行。

## 1. 背景・目的

- 現行は1日1試合（記録日の日次合計 vs リーグ平均/最接戦相手）。
- 要望：赤枠の時間帯（例 06:30-07:00、16:45-17:15、17:45-19:00、20:30-21:30）ごとに同じDivの対戦相手1人と競争し、勝敗でレーティング変動。枠終了後に記録欄＋やらなかったボタンを設け、記録量で対戦。

## 2. 用語・前提

- 試合＝1時間帯スロット。試合キー `slotKey = YYYY-MM-DD#startMin-endMin`（例 `2026-10-26#390-420`）。
- 1日複数試合（枠数分）。10試合ラウンドは2〜3日で1ラウンドになりうる。フェーズ（28日）概念は維持。
- 単位：ページ本はページ数、反復本（LEAP等）は語数/区画数をそのまま比較。共通pt換算はしない。
- 未割当枠は本未選択のままでは試合なし。その日のうちに本を選んで終了後に記録すれば対戦成立。

## 3. 対戦相手決め（時間帯ごとに別人）

- `generateRivals(seasonId, div)` の7人から `hash(slotKey + seasonId + div) % 7` で1人を決定的選択。
- 同じ枠は再表示・再起動でも同じ相手。枠が違えば別人になりやすい（衝突時は許容）。
- 1日1人固定にしない。最接戦選択（現行 `leagueDayInfo`）は使わない。

## 4. 相手スコア生成（記録量そのまま比較用）

- 新関数 `rivalSlotAmount(rival, slotKey, unitKind, slotMinutes)`：
  - ページ枠：`base = rival.basePages`、区画枠：同値、語枠：`base = rival.basePages * WORDS_PER_PAGE (15)`。
  - `raw = round(base * slotMinutes / 120)`（120分＝1日分基準。30分枠は1/4）。`max(1, raw)`。
  - 決定的揺らぎ ±10（`mulberry32(hash(seed))`、現行 `rivalPagesForDay` と同思想）。
- 勝敗：`my > opp → win`、`== → draw`、`my < opp → loss`。`やらなかった` は `my=0` 固定で `opp` に関わらず `loss`（不戦敗）。
- 反復本の `from-to` 記録は `to-from+1` 相当量を `my` とする（既存 `calcCycleDonePairs` ではなく枠内記録量）。語/区画の区別は `unitKind` で保持。

## 5. 記録UI・終了後制御（TodayPlanScreen）

- 各 `displayedRow` に `slotKey`、`isPast/isNow/isFuture` を付与。判定：対象日 < 今日→全枠過去、対象日 > 今日→全枠未来、同日→ `endMin <= nowMin` で過去。
- 未来・進行中枠：記録欄・記録/完了/やらなかったボタンは無効化し「終了後に記録できます」表示。
- 終了後枠のみ：ページ本 `[ページ入力][記録][完了][やらなかった]`、反復本 `[開始][終了][周回][記録][やらなかった]` を有効化。
- 確定後はロックし `あなたX - 相手Y（相手名） ○/●` を表示。再記録不可（二重計上防止）。
- 未割当（`bookId==''`）の過去枠は本選択後に同UI。選択なしは無効試合（負けにしない）。
- 変更ファイル：`src/screens/TodayPlanScreen.tsx`（表示制御＋ハンドラ）、新規 `src/lib/slotLeague.ts`（キー・判定ヘルパー）または `dayplan.ts` 拡張。

## 6. ラウンド・レーティング進行・データフロー

- `SeasonState` に `slotMatches: Record<slotKey, { date, my, opp, oppName, result, unit }>` を追加。`days` は全国順位・EXP用に残す。
- 新 `syncLeagueSlot(slotKey, entry)`：
  - Div10〜4：`appendRoundMatches` に1試合として加算（勝3/分1/負0、10枠で昇降格判定、`finalizeRoundEarly`・スキップ表示は枠ベースに）。
  - Div1〜3：`applyMatchRatings` に1試合として加算（現行帯別増減表そのまま、シードは `slotKey:oppRating`）。
  - 日次 `syncLeagueDay` はリーグ進行に使わない（全国・EXP側のみ残す）。`recordSeasonDay` は維持。
- 時間帯編集でキー変動：確定済み旧キーは残す、新キーは新規試合。勝敗付け替えなし。
- Ranking/MyPage の対戦履歴は `slotMatches`（直近5試合）から描画。`leagueDaily`（日次）は廃止または併記しない。
- 変更ファイル：`src/lib/seasonLeague.ts`（`leagueSlotInfo`）、`src/lib/seasonRivals.ts`（`rivalForSlot`/`rivalSlotAmount`）、`src/data/seasonStore.ts`（状態・sync）、`src/screens/RankingScreen.tsx`、`src/screens/HomeScreen.tsx`（sync切替）、`src/screens/MyPageScreen.tsx`（表示があれば）。

## 7. エラー・境界条件

- 未来枠の直接呼出・不正キー・非整数・負値は無視し `slotMatches` に書かない。
- `localStorage` 旧データ：`slotMatches` 欠落時は `{}` として扱いマイグレーション不要。
- 同一枠の二重確定は2回目を無視。日付不正・seasonId不一致の枠は無視。
- 通知（`slotNotify`/`slotsPublish`）の仕様変更なし。

## 8. 非目標 (YAGNI)

- 相手エンブレム画像を作らない。相手名テキスト表示のみ。
- 達成率比較・共通pt比較は作らない（記録量直接比較のみ）。
- 確定後の訂正UIを作らない。再記録・取消は対象外。
- バランスの厳密調整は対象外（120分基準・WORDS_PER_PAGE=15・揺らぎ±10で固定）。

## 9. テスト

- キー生成：日付・分境界、編集時の旧キー残存。
- 相手決め：同一キー同一相手、枠別分散、Div別隔離。
- 相手スコア：枠時間按分、語係数15、Div1/Div10の大小関係、決定的再現性。
- 勝敗：超過・同値・未満、やらなかった＝loss。
- UI：未来/進行中は無効、終了後のみ有効、確定後ロック、未割当の扱い。
- 進行：10枠でラウンド判定、Div3以上レーティング増減9通り、Div2/Div1到達、スキップ表示条件。
- 履歴：直近5件の相手・スコア・勝敗表示。
- 既存の `leagueDayInfo`/`leagueDayResults` 依存テストは新仕様に更新。
