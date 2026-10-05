# 日本代表戦ページ 設計書（2026-10-05）

## 背景・目的

サッカー日本代表（A代表・SAMURAI BLUE）の試合をほぼ毎回観るユーザーが、
試合日のスケジュール上書きを手作業せずに済むようにする。
試合日程・カウントダウンをわくわくするページで見せ、「観る」選択で
その日の学習時間を自動確保する。

## スコープ

- 対象は男子A代表（SAMURAI BLUE）のみ。なでしこ・世代別・フットサルは対象外。
- 日程ソースはJFA公式発表のみ。API-Football等の外部APIは使わない。
- ユーザーの作業はゼロ。初回データ投入も自動収集の初回実行もAI/開発者が行う。

## アーキテクチャ

静的データ内蔵＋定期自動更新。実行時（ブラウザ）の外部通信は増やさない。

- `src/data/japanMatches.ts`：試合データ＋窓関数（手書きではなく定期生成物）
- `src/screens/JapanMatchScreen.tsx`：表示＋観る/観ない操作
- `src/lib/matchBlock.ts`（新規）：観戦枠の差し引き・復元ロジック（純関数＋DB操作）
- `.github/workflows/japan-matches.yml`（新規）：毎日定期実行の収集ジョブ
- `scripts/fetch-japan-matches.mjs`（新規）：JFA取得・抽出・データファイル生成

## コンポーネント

### §1 データ `src/data/japanMatches.ts`

```ts
export type JapanMatch = {
  id: string            // "2026-10-05-kirin-cup" のように一意
  date: string          // "YYYY-MM-DD"
  kickoff: string       // "HH:MM"（日本時間）
  opponent: string      // "ウルグアイ" 等
  competition: string   // "KIRIN CHALLENGE CUP 2026" 等
  venue?: string
  homeAway: 'home' | 'away' | 'neutral'
}
export const JAPAN_MATCHES: JapanMatch[] = [...]
```

観戦確保枠の導出 `matchWindow(m: JapanMatch): { start: string; end: string }`：
開始＝キックオフ10分前、終了＝キックオフ＋125分
（前半45＋HT15＋後半45＋後半AT想定10＋余裕10＝「後半アディショナルタイム＋10分」の固定値近似）。
日跨ぎ（23時台キックオフ等）は `endMin <= 1440` の既存制約に合わせ、当日中に収まらない分は切り捨てを明記する。

`generatedAt: string`（ISO、最終収集時刻）も同ファイルに持つ。ページ末尾に
「JFA公式発表ベース・◯月◯日更新」と表示する。

### §2 ページ `src/screens/JapanMatchScreen.tsx`

`SchoolScreen` パターン踏襲（`data-testid` 命名・今日マーカー・戻るボタン）。
SAMURAI BLUEの青基調、大きな「あとX日」カウントダウン、対戦カード表示。
各試合に「観る」「観ない」ボタン。決定状態は localStorage
（`schedule-app-japan-watch`：`{ [matchId]: 'watch' | 'skip' }`）に保存。
試合枠自体に観戦の表記は付けない（空き時間が減るだけ）。
ページ上で「観戦のため確保中」バッジは表示してよい。

### §3 観る/観ないフロー `src/lib/matchBlock.ts`

- 「観る」：その日の有効枠（`slotsForDate` と同じ解決）を求め、試合枠と重なる部分を
  差し引いた残りを**日付指定の上書き枠**として保存する。
  日付指定枠が1件でもある日は曜日繰り返し枠が無視される既存仕様により、
  試合時間は確実に学習対象外になる。これがユーザーの言う「除外の印」であり、
  専用の除外テーブルは作らない。
- 変更前のその日の日付指定枠は localStorage（`schedule-app-japan-backup`：
  `{ [matchId]: AvailabilitySlot[] }`）に退避し、「元に戻す」ボタンで復元する。
- 「観ない」：枠は変えず決定のみ記録する。過去に「観る」で作った上書き枠が
  あれば復元して消す（＝「観ない」への変更は取り消しと等価）。
- 既存の `prunePastOverrides` が試合翌日の起動時に上書き枠を自動掃除するため、
  後片付け操作は不要。バックアップも試合後は参照されない。

### §4 配線

- `App.tsx` に `{ name: 'japan' }` ルート追加、ホームに「代表戦」導線ボタン。
  既存画面・既存ルートの変更なし。

### §5 テスト・異常系

- `matchWindow` の境界テスト（10分前・125分後、日跨ぎ切り捨て）。
- 重なり分割の単体テスト（内包・跨ぎ・接触・無関係）。
- 観る→復元の往復テスト（バックアップ一致）。
- 画面のカウントダウン・ボタン表示テスト。
- 日程データの形式バリデーション（`date`/`kickoff` 正規表現＋実在日）。
- CSP・送信先の変更なし。APIキー等の秘密情報は扱わない。

### §6 自動収集 `.github/workflows/japan-matches.yml`＋`scripts/fetch-japan-matches.mjs`

- 毎日 21:30 UTC（＝朝 6:30 JST）に定期実行。
- 公開JFAページ（A代表・SAMURAI BLUE試合一覧）を取得し、日程・対戦相手・
  大会・会場・キックオフを抽出する。一覧に時刻が無い場合は詳細ページを辿る。
- `src/data/japanMatches.ts` を再生成し、差分があれば自動コミット＋push
  （`permissions: contents: write`）。push を起点に既存の Pages デプロイが走る。
- 抽出失敗時はコミットせずワークフローを失敗させる（既存データは残るため
  ページは動き続ける）。壊れたら開発者が抽出部を修正する。
- 初回データ（今日 2026-10-05 の KIRIN CUP 等の直近数試合）は実装時に
  JFA公式から調査して投入する。

## 前提・フォールバック

- JFAページが Actions から取得可能であることは実装時に検証する。
  取得不可・抽出不能の場合は手動データ運用に切り替える（ページ機能自体は不変）。
- 当面の事務局運用：新日程発表後の取り込み漏れに気づいたらユーザーが一言知らせる。
