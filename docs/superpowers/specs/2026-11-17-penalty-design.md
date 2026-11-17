# 罰・取り返しセンター 設計書

- 日付: 2026-11-17
- 状態: 承認待ち（builderチェック済み・回答反映済み）
- 要求: その日の参考書の記録をしなかったら罰を設ける
- なぜ: さぼり防止と取り返し促進
- 採用: 案L-A フルセット（案A/Bは不採用、理由は§4）

## 1. intent / why

今日の計画に出た参考書で、その日の「記録」（ページ記録 / 反復記録）が1件もない日を「サボり」とみなし、目に見える罰と取り返し導線を出す。

成功像: サボった翌日にホームと今日の計画を開いた瞬間に赤く気づき、借金（繰越ノルマ）が分かり、その日のうちに返せる。

## 2. goals / non-goals / anti-goals

Goals:
- 未記録日の検出（ページ本 + 反復本、focus期間考慮）
- 罰表示（ホーム冒頭バナー、今日の計画冒頭警告）
- 借金（未達量の繰越）の可視化と返済クエスト表示
- 罰ポイント・連続記録・ランクの表示
- 罰センター画面（一覧・履歴・設定）
- 厳しさ設定（甘口・普通・鬼）
- 朝のntfy通知で前日サボりを知らせる（通知ON時のみ）

Non-goals:
- 課金・SNS晒し・外部共有
- 自動で計画を書き換える強制上乗せ（表示のみ、自動割当ロジックは変えない）
- クラウド同期・アカウント

Anti-goals:
- 借金が無限に溜まって破綻させること（上限・丸めで頭打ちにする）
- 罰でデータを消す・上書きすること
- 見慣れて無視されるだけの飾りバナーにすること（返済導線必須）

## 3. constraints

- React + Vite + Vitest、Dexie (IndexedDB)、日本語UI
- TDD必須: 先に失敗テストを書き RED確認してから実装。reportにRED/GREEN証拠
- テストはworktreeでのみ実行（`.worktrees` / `.superpowers` 配下の重複テスト除外）
- data-testidは指定値を一字一句そのまま
- 既存パターン遵守: 開閉ボタン、window.confirmはvi.spyOn、localStorage/fake-indexeddb使用、YAGNI
- PDF/jpg等のバイナリをコミットしない。1タスク1コミット以上
- 既存の記録ロジックを壊さない: `useRecords/addProgress`、`useCycleRecords/addCycle`、`generateDayPlan` の振る舞い維持

## 4. approaches

検討した3案:

A. 見える化のみ（小規模）: 赤バナー + 不足表示のみ。長所: 安全・即作れる。短所: 痛み弱くすぐ慣れる。さぼり防止にならない恐れ。

B. 借金自動上乗せ（中規模）: 未記録量を翌日予定に自動加算。長所: 強制力強い。短所: 溜まると破綻、返済ロジック複雑、計画破壊リスク。

C. 罰センター フルセット（大規模、採用）: 判定エンジン + 罰Pt + 借金表示（加算はしない） + 取り返しクエスト + 履歴画面 + 厳しさ設定 + 通知。長所: 防止（警告・ランク降格・居座り）と促進（返すべき量リスト）を分担でき、拡張しやすい。短所: 工数大。
採用理由: ユーザー指定「もっと大規模な機能」かつ「さぼり防止と取り返し」の両立にはCしかない。Bの自動加算は破綻リスクのため表示に留める。

## 5. 決めた仕様（builderはこの通り作る）

### 5.1 判定定義
- 対象日Dの「今日の計画に出た本」= focus期間フィルタ後の pageBooks + cycleBooks（`TodayPlanScreen` と同じ算出。曜日上書き・空き時間なし日は対象外）
- ページ本: `records` に `bookId+D` が1件もない → 未記録
- 反復本: `cycleRecords` に `bookId+D` が1件もない → 未記録
- 1冊でも未記録があればその日は「サボり日」。全冊未記録かどうかは区別表示のみ
- 未来日・計画なし日は判定しない

### 5.2 純粋ロジック `src/lib/penalty.ts`（新規）
- `isMissingDay(targetBookIds: string[], recordsByDate: Set<string>): boolean`
  - 1冊でも未記録ならtrue（ユーザー決定）
- `calcDebtForDate(planned: {bookId,pages}[], cyclePlanned: {bookId,units}[], records, cycleRecords, date): {pageDebt, unitDebtByBook}`
  - pageDebt = その日の予定ページ合計のうち未記録本分の合計（上限500で頭打ち）
  - 反復は冊ごとに区画数を保持
- `calcPenaltyPoints(missingCount: number, severity: Severity): number`
  - 甘口=5、普通=10、鬼=20 × missingCount（上限100/日）
- `calcOutstanding(pageDebts: {date,pageDebt}[], repayments: {date,excessPages}[]): number`
  - 決定事項Q1-A: 借金は後日の超過記録で自動で減る。超過分 = max(当日記録-当日予定,0) を古い借金からFIFO充当。残高は直近7日分合算、上限500
- `calcTotalPoints(dailyPoints: {date,points}[], goodDays: string[]): number`
  - 決定事項Q3: 記録日に-5回復、下限0。`max(sum(points)-5*goodDays, 0)`
- `calcQuestToday(todayPlanned:number, outstanding:number): number`
  - 決定事項Q4: `今日予定 + 未返済合計(直近7日、上限500)`。表示例 `50p(30+借20)`
- `calcStreak(dailyStatus: {date, isMiss, hasPlan}[]): number`
  - 私の判断: サボりなし日連続。計画なし日はスキップ（途切れさせない）。1冊欠けでもリセット0
- `rankForPoints(totalPoints:number): 'S'|'A'|'B'|'C'|'D'` 既定 S:0、C:50、D:100超で降格方向（微調整はbuilder可）
- すべて純粋関数、Vitest境界テスト必須

### 5.3 永続化
- Dexie version 6: `penalties: 'id, date'` `{id, date, missingBookIds: string[], pageDebt:number, unitDebt: Record<bookId,number>, points:number, severity:Severity, createdAt}`
- 1日1件、同日再計算はput上書き
- 設定 `penalty-settings` (localStorage): `{severity: 'mild'|'normal'|'strict', enabledBanner:boolean}` 既定 normal
- 既存テーブルに触らない。cascade削除時はpenaltiesの該当bookIdを配列から除去（枠残し方針は `unpinBook` に倣う）

### 5.4 UI
ホーム `HomeScreen` 冒頭（決定事項Q2: 未返済がある間ずっと出す）:
- 直近7日以内に未返済サボり残あり → `data-testid="penalty-banner"` 赤系 (`#fef2f2` border `#f0a0a0`) で `サボり残あり! 借金 Xページ | 罰Pt Y | 連続 Z日 [取り返しクエストを見る]`
- 私の判断: `enabledBanner=false` の時はHome+Today両バナー非表示。トグルは罰センターに `data-testid="penalty-banner-toggle"` で追加
- ボタン `data-testid="penalty-open"` → Route `{name:'penalty'}` へ
- 記録あり日は `data-testid="penalty-banner-ok"` 薄表示「連続Z日継続中」

今日の計画 `TodayPlanScreen` 冒頭:
- 未返済あり時 `data-testid="penalty-yesterday-warning"` で借金と今日の返済目安を表示。自動加算はしない
- 当日分の `displayedSlots` 下に `data-testid="penalty-today-debt"` で「今日返すべき借金 +X」を表示（任意）

新画面 `src/screens/PenaltyScreen.tsx`:
- `data-testid="penalty-page"` 全体、`data-testid="penalty-back"` で今日に戻る
- 借金一覧 `data-testid="penalty-debt-{bookId}"`、履歴 `data-testid="penalty-history-{date}"`、設定 select `data-testid="penalty-severity-select"`（甘口・普通・鬼）
- App.tsx Route追加 `{name:'penalty'}`、Today/Homeからの遷移

テキストスケッチ:
```
[罰センター]
 連続 3日 | 罰Pt 20 | ランク B
 借金: 英語 +20p / 数学 +5区画
 [今日返すべき: 英語 50p(30+借20)]
 履歴: 11/15 サボり +10pt ...
 厳しさ: [普通 v]
```

### 5.5 通知・評価タイミング（私の判断を含む）
- 評価実行: App起動時 + Home/Today表示時に直近7日を走査し `penalties` にidempotent put。同日再計算は上書き。遅延記録は次回評価で上書き/解消
- 通知ON時のみ、App起動時に前日サボりを `publishPush(topic, "昨日は記録なし 借金Xページ", {title:"サボり罰"})`
- 私の判断: 当日送信済みは `localStorage penalty-notified-{date}` で1日1回にdedup。既存 `getNotifySettings/publishSlotsOnce` 流用、失敗しても画面動作に影響させない

## 6. builderに残すこと
- ランク閾値・ポイント配点の微調整（既定値から大きく変えないこと）
- バナーの文言の微調整（意味は変えないこと）
- 借金上限500の妥当性確認（テストで裏付けがあれば変更可）
- 明示的に残す: 自動割当への加算はしない、判定式の変更はしない

## 7. テスト観点（plan時に細分化）
- `penalty.ts` 純粋 tests: 全記録/1冊欠け/全欠け/計画なし/上限頭打ち/厳しさ別点数/streak跨ぎ
- `PenaltyScreen.test`: 表示・遷移・設定切替
- `HomeScreen` 追加tests: バナー出し分け
- `TodayPlanScreen` 追加tests: 前日警告
- DB version 6 migration test（既存データ保持）
- ベースライン: `src/screens/HomeScreen.test.tsx` のNOW系は時刻依存で揺れるため触らない
