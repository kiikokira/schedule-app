# 自動敗戦（日またぎ一括）短設計（A案）

- 日付: 2026-11-12
- 要望: 今日の計画で参考書の記録をその日中にしなかった枠は、自動で敗戦扱いにしてほしい。
- 現状: 過去の未確定枠は記録UI＋手動「スキップ」（`syncLeagueSlot(..., {forfeit:true})` → loss確定）が残り続ける。記録し忘れは未確定のまま放置できる。未来枠は「終了後に記録できます」で記録不可、確定済みは「確定済み」表示。
- 目標: 日付が変わったら（`date < 今日`）、book付き・未確定のスロットを自動で敗戦（my=0, result=loss）確定する。手動スキップと同扱い。
- 非目標: 当日中の枠終了直後の即敗戦（B案）はやらない。当日の手動スキップUIの削除はしない。未割当枠の敗戦化はしない。進捗ページ数・ゴースト・通知の変更はしない。
- アンチゴール: 未来枠を敗戦にしない。確定済み枠を上書きしない。削除済み本や未割当で誤って敗戦を増やさない。
- 制約: `syncLeagueSlot` の冪等性（slotMatches存在時は無視）を活かす。`npm run build` と既存テストを壊さない。端末内完結（localStorageのみ）。

## Approaches

- A. 日またぎで一括（採用）: 起動時＋今日の計画表示時に `date < todayStr()` の未確定枠を forfeit 確定する。「その日中」の文言通りで誤爆が少ない。欠点：当日中の終了直後には敗戦にならない。
- B. 枠終了直後に即敗戦（不採用）: 同日でも `endMin <= nowMin` で即 forfeit。取りこぼしなしだが、遅れて記録したい正規フローと衝突するため不採用。
- C. 手動のみ維持（不採用）: 現状維持。要望を満たさないため不採用。

## 設計（A案）

- 新helper `autoForfeitPastSlots(today, availability, books)` を `src/data/seasonStore.ts`（または近傍lib）に足す。`today = todayStr()` をカットオフに使い、表示用 `today` prop とは区別する。
- 走査範囲: シーズン開始〜前日まで、上限30日。`slotsForDate(availability, d)` で各過去日の枠を復元し、`bookId` 付き・`slotMatches[slotKey]` 未存在のみ `syncLeagueSlot(d, slotKey, {my:0, unit, slotMinutes, forfeit:true})` する。
- unit判定: cycles＋LEAP→`words`、cyclesその他→`sections`、それ以外→`pages`。本が削除済みの場合は `pages` で敗戦のみ確定する。未割当（`bookId=''`）は対象外。
- 呼び出し: `App.tsx` 起動時 `useEffect`（`prunePastOverrides` の隣）と `TodayPlanScreen` の `availabilityLoaded` 後 `useEffect` の2箇所。どちらも冪等なので二重実行安全。
- UI: 変更なし（自動確定された枠は既存の「確定済み」表示になる）。当日分の手動スキップボタンは残す。
- テスト: helper単体（過去未確定→loss、未来・確定済み・未割当は不変）＋ `TodayPlanScreen` で過去日表示時に自動確定されること。既存の `today slot gate` テストは維持。

## 残りの決め事（ビルダー向け）

- 走査上限30日でよいか（シーズン全期間に広げると初回に大量lossが付くため30日を既定とする）。
- 削除済み本の枠を敗戦にする方針でよいか（記録不能なので敗戦が自然と判断）。
