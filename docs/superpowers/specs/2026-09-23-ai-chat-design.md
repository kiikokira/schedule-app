# 調整AIチャット機能 設計書

- 日付: 2026-09-23
- 状態: 設計合意済み

## 1. 目的と背景

現在のアプリは「参考書ごとの期限・進捗から今日の配分を自動計算する」自動エンジンを持つ。今回、
ユーザーと「高性能なAI」が**できるだけ少ない会話**で、これからのスケジュール（進捗の調整）を
決定できる仕組みを追加する。

要件（ユーザー指定）:

- 今日の学習配分と、進捗ペースの再調整の両方を決定し、アプリに反映できる
- **期限を動かさない**（もともと決めた期限は不変）
- オフラインでも動く（無料・待ち時間なし）
- 計画にブレがない（同じ状況なら同じ提案）
- オンライン時は高精度LLMで自由文でも相談できる

制約の組み合わせ上、「超高性能・完全理解・無料・オフライン」を1つのAIで同時に満たすことは
不可能なため、ハイブリッド方式を採用する。

## 2. 前提・制約

- サーバーレス PWA（React + TypeScript + Vite、Dexie/IndexedDB、GitHub Pages）
- 使用端末: iPhone 13（Safari）。オフライン動作必須
- **数値の決定と反映は常に内蔵の決定論的エンジンが行う**
  - LLM（オンライン時）は「話の理解とアドバイス」のみ担当し、計画の数値を出さない
  - これにより計画のブレをゼロにする
- 依存パッケージは追加しない（すべて自前実装）

## 3. 用語

| 用語 | 意味 |
| --- | --- |
| 内蔵プランナー | 純関数のアドバイザ。本の進捗・期限・空き時間から現状分析と配分提案を決定論的に生成する |
| 定型文 | オフライン時に押して使う質問ボタン。4種 |
| ペース | 各本の1日あたり学習量（ページ数）。期限を固定した上で配分比率で調整する |
| 配分比率 (allottedRatio) | RebalanceScreen と同じ「本ごとの1日分学習時間の上限比率(0-1)」 |
| 優先度 (priority) | RebalanceScreen と同じ「優先(0)/公平均分(1)/軽視(2)/スキップ(3)」 |
| 調整記録 (adjustments) | 優先度・配分比率の変更履歴（既存テーブル） |

## 4. アーキテクチャ

```
[ChatScreen] ── 内蔵プランナー(advisor.ts) ──> 分析・提案カード（決定論的・オフライン可）
      │                       ▲
      ├─ 定型文 ──────────────┘
      ├─ 適用ボタン ──> 保存（saveBook + adjustments）＝配分/ペースの反映
      └─ 自由文(LLM設定時) ─> ai.ts ─> OpenAI互換API（システムプロンプトに分析を同梱）
```

- チャット画面を開くと、アドバイザが自動で「現状分析＋提案カード」を最初のメッセージとして表示する
  （ユーザーが聞く前に答える = 最小会話）
- 提案カードの適用ボタンで、決定をそのままアプリへ反映する
- 反映後はアドバイザを再実行し、文章と提案を更新する
- メッセージ履歴は保存しない（セッション内のみ。画面を閉じれば消える）

## 5. 画面設計

### 5.1 画面と導線

- ホームのフッターに「調整AI」ボタン（testid: `nav-ai`）→ ルート `ai` → `ChatScreen` を表示
- `ChatScreen`（testid: `chat-screen`）: 見出し「調整AI」、メッセージ一覧、クイックチップ、
  入力欄（LLM設定時のみ有効）、戻るボタン
- フッターに「ホーム」を出せるよう App の既存パターンに従う

### 5.2 メッセージ構成

1. **現状分析メッセージ**（開いた直後に自動表示）: 全体の1行要約＋本ごとの内訳
2. **提案カード**: 「今日の配分を反映」「ペース目標を反映」の2ボタン
3. **クイックチップ（定型文・4種）**:
   - 「遅れている本は?」
   - 「今日は何を優先すべき?」
   - 「ペースは間に合っている?」
   - 「配分を見直して」
4. **自由文入力**（オンラインLLM設定時のみ）: 送信するとLLMが回答。未設定/オフライン時は
   「オフラインAIモードです。定型文、または設定でオンラインAIを登録すると自由文で相談できます」を
   表示し、入力欄は無効化

### 5.3 オフライン時

- 定型文と内蔵プランナーのみで動作（無料・即応答・ブレなし）
- 未対応の自由文の入力はできない（案内を表示）

## 6. 内蔵決定論プランナー `src/lib/advisor.ts`

### 6.1 入力

```
buildAdvisorReport(params: {
  today: string
  books: BookData[]              // 登録済み参考書
  donePagesByBook: Record<string, number>  // records から集計した本ごとの累計ページ
  availability: AvailabilitySlot[]
}): AdvisorReport
```

- `donePagesByBook` は既存の進捗集計ロジックから算出する（不足している場合は mini ヘルパーを
  advisor 内に置く。true source は records テーブル）

### 6.2 出力

```
type AdvisorReport = {
  summaryText: string
  books: AdvisorBook[]
  proposal: AdvisorProposal
}

type AdvisorBook = {
  bookId: string
  title: string
  remainingPages: number
  daysUntilDeadline: number
  needPerDay: number          // ceil(残ページ / max(残日数, 1))
  donePages: number
  expectedSoFar: number       // 経過日数分の必要ページ（遅れ判定用）
  behindPages: number         // max(expectedSoFar - donePages, 0)
  status: 'ok' | 'behind' | 'critical'
  plannedTodayMinutes: number // 今日の空き時間で配分される想定分
  plannedTodayPages: number   // 同上のページ数
}

type AdvisorProposal = {
  focus: string[]             // 優先(0)を推す本の bookId
  relax: string[]             // 軽視(2)を推す本の bookId（必要ペースに余裕がある本）
  ratios: { bookId: string; ratio: number }[]  // ペース目標に合わせた配分比率案
  todayMessage: string        // 「今日の配分を反映」で伝える内容
  paceMessage: string         // 「ペース目標を反映」で伝える内容
}
```

### 6.3 判定ルール（決定論的）

- `needPerDay` = `ceil(remainingPages / max(daysBetween(today, deadline), 1))`
- 遅れ: 開始日〜前日までの経過日数 `n` に対し `expectedSoFar = needPerDay * n`、
  `behindPages = max(expectedSoFar - donePages, 0)`
- `status`:
  - `behindPages > 0` かつ今日の予定ページが `needPerDay` 未満 → `critical`
  - `behindPages > 0` → `behind`
  - それ以外 → `ok`
- `plannedTodayMinutes` / `plannedTodayPages` は既存の `generateDayPlan`（現在の priority・ratio・
  所要速度・空き時間）で算出した今日の配分から取得する
- `focus`: `critical` の本を優先、次に `behind` の本
- `relax`: 前日までに既に `expectedSoFar` を終えていて `needPerDay` が小さい本（余裕がある本）を選定
- `ratios`: 各本について `needPerDay * minutesPerPage / max(今日の学習可能総分, 1)` を
  0〜1 にクランプ。minimal な決定論的計算で、既存 `generateDayPlan`（`capOf`）と整合させる
- `summaryText` / `todayMessage` / `paceMessage` は日本語の定型テンプレートで生成（状況により言い回し変更）

### 6.4 定型文の回答生成

- 「遅れている本は?」→ 遅れ/危険の本一覧と理由。1冊もなければ「遅れている本はありません」
- 「今日は何を優先すべき?」→ `focus` の順に優先すべき本と、その根拠（残り・残日数・遅れページ）
- 「ペースは間に合っている?」→ 各本の「必要な1日ページ」vs「今の予定」の比較と判定
- 「配分を見直して」→ 提案カードを再表示（最新の状態で再計算）

## 7. オンラインLLM接続（任意設定）

### 7.1 設定 `src/lib/ai.ts`

- `getAiSettings()` / `setAiSettings()` を localStorage に保存（Google Books APIキーと同様の運用）
- 項目: `endpoint`（初期値 `https://api.openai.com/v1/chat/completions`）、`apiKey`、`model`
- `chatWithModel(settings, systemPrompt, messages)`:
  OpenAI互換の chat/completions に POST。結果 `{ text }` または `{ error: 'network' | status }`
  を返す。ネットワーク不可は即座に `network` エラー

### 7.2 設定画面の追加（SettingsScreen）

- セクション「調整AI（オンライン）」: エンドポイントURL / APIキー / モデル名 入力＋保存ボタン
- 説明文: 「未設定でもオフラインの内蔵AIは動きます。期限は変更されません。APIキーはこの端末内だけに保存されます」

### 7.3 システムプロンプトの原則

- `buildAdvisorReport` の結果（要約・本ごとの内訳・提案）をコンパクトな日本語/JSONとして同梱
- 指示: 「スケジュールの期限は絶対に変更してはいけない」「会話は最短で」
  「具体的な配分・ペースの数値は提示せず、アドバイスのみ答える」
  （数値は常に内蔵エンジンが決定する）
- `temperature: 0`
- LLMの回答はプレーンテキストで表示（マークダウン整形はしない）
- LLMの応答中は「考え中…」を表示し、エラー時はオフライン案内にフォールバック

## 8. 反映の仕組み（適用ボタン）

期限・開始日は一切変更しない。変更対象は `priority` と `allottedRatio` のみ。

### 8.1 今日の配分を反映

- `proposal.focus` の本: `priority = 0`、`proposal.relax` の本: `priority = 2`
- 該当しない本は変更しない
- `saveBook` で保存し、`addAdjustment({ kind: 'priority', value })` を記録（RebalanceScreen と同一経路）

### 8.2 ペース目標を反映

- `proposal.ratios` の比率を `allottedRatio` として保存（現状と異なる本のみ）
- `addAdjustment({ kind: 'ratio', value })` を記録
- 反映後、配分は既存エンジン（`generateDayPlan`）で再計算され、今日・今後数日の予定に反映される

## 9. データモデル

- 変更なし。設定は localStorage、`priority` / `allottedRatio` / `adjustments` は既存

## 10. 異常系とエッジケース

- 本が0冊 / 今日の空き時間なし: 分析メッセージでその旨を案内し、提案カードは出さない
- 期限が今日: `daysUntilDeadline = 1`、`needPerDay = remainingPages`
- LLM設定なし・ネットワーク不通: 入力欄無効＋案内（定型文・内蔵AIで継続）
- LLMが不正な応答/タイムアウト: エラー表示し、オフラインの内蔵AI利用を案内

## 11. テスト方針

- `src/lib/advisor.test.ts`: 決定論の確認
  - 順調な本（behind=0・focusなし）、遅れている本（behind>0・focus対象）、
    危険（critical）の各ケース
  - `ratios` の計算・`summaryText` の文言・定型文4種の回答
- `src/screens/ChatScreen.test.tsx`:
  - 開くと分析メッセージ＋提案カードが出る
  - チップ「遅れている本は?」等で回答が出る
  - 「今日の配分を反映」で books.priority と adjustments が更新される
  - 「ペース目標を反映」で allottedRatio と adjustments が更新され、期限が不変
  - LLM未設定時は入力欄が無効・案内表示
  - LLM設定時は fetch をモックして送信→回答表示、ネットワーク失敗時はフォールバック
- `src/screens/SettingsScreen.test.tsx` 追加: AI設定の保存・初期値
- フルスイートでの回帰確認（既存の HomeScreen の並列タイミングフレークは既知）

## 12. スコープ外（今回はやらない）

- メッセージ履歴の永続化
- LLMが自主的に数値を決定・反映する（決定と反映は常に内蔵エンジン）
- 期限・開始日の変更（ユーザー指定で永久に不可）
- ローカルLLMの同梱（重くなるため不採用）
- 過去日の空き時間再現や、特定日指定の細かい配分指示