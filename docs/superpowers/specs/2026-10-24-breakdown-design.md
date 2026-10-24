# 累計の内訳 別画面表示 — Design (2026-10-24)

承認済み方式: **A: 新ルート＋専用画面**（マイページ→内訳一覧→戻る、行タップで詳細へ）。

## 1. 背景・目的

- マイページの「累計の内訳」は複数冊が1カード内に詰め込まれ、見づらい。
- タップで別ページに飛ばし、1行1冊＋表紙で見やすくする。

## 2. 成功条件

- マイページ内訳カードのタップで内訳一覧画面に遷移できる。
- 一覧は1行1冊で、書名・合計・ページ・反復・表紙が見える。
- 表紙が無い／壊れている本は既存プレースホルダ表示になる。
- 各行タップでその参考書の詳細画面へ遷移できる。
- 一覧からマイページに戻れる。
- 既存の集計値（合計・除外件数）と矛盾しない。

## 3. 非目標 (YAGNI)

- 並び替え・絞り込み・検索は作らない（現行は合計降順のみ）。
- 表紙の新規取得・アップロードは作らない（既存 `coverUrl` を使うだけ）。
- モーダル展開は採用しない。

## 4. アーキテクチャ

- `App.tsx` の `Route` に `{ name: 'breakdown' }` を追加する。
- 新規 `src/screens/BreakdownScreen.tsx`（props: `onBack`, `onOpenBook(bookId)`, `today?`）。
- マイページ側は集計ロジックを変えず、内訳カードをボタン化して遷移のみ担う。
- フッター挙動は他サブ画面と同一（`home` 以外はホーム／設定ボタンのみ）。

### 画面遷移

- マイページ（`mypage-breakdown-open` をタップ）→ `breakdown`
- `breakdown` の戻る → `mypage`
- `breakdown` の行（`breakdown-row-<bookId>`）タップ → `detail`

## 5. コンポーネント

### BreakdownScreen

- 入力: `useBooks` / `useRecords` / `useCycleRecords`（マイページと同一ソース）。
- 表示: `totalsByBook` 結果を1行1冊で描画。
  - 左: `CoverImage` 40x56（`book.coverUrl ?? null`、欠損時はプレースホルダ）。
  - 右: 書名、合計、内訳（ページ＋反復）。
  - 行全体を `button` 化し、詳細遷移可能にする。
- 空状態: 0件時は「まだ記録がありません」系の文言、集計外がある場合は件数注記を維持。

### MyPageScreen（変更点のみ）

- 既存 `mypage-breakdown` セクションを維持しつつ、一覧への導線ボタン `mypage-breakdown-open` を追加する（カード全体タップ可）。
- 集計ロジック・文言は変えない。

## 6. データフロー

- `BookTotals` に `coverUrl?: string` を追加する。
- `totalsByBook(records, cycles, books)` の第3引数に `coverUrl` を含め、`bookId` で結合する（DBスキーマ変更なし）。
- `BreakdownScreen` はマイページと同じ正規化済み集計（`pagesRecordsForTotals` / `cycleRecordsForTotals`）を使う。

## 7. エラーハンドリング

- 記録0件: 一覧に空表示（落ちない）。
- 表紙URLが不正・取得失敗: `CoverImage` の既存フォールバック（プレースホルダ）。
- 削除済み本・形式違い: 集計外として数え、一覧には出さない（現行通り）。

## 8. テスト

- 新規 `BreakdownScreen.test.tsx`:
  - 複数冊が1行1冊で描画される（件数・書名・合計）。
  - 表紙ありは `img`、無しは `cover-placeholder`。
  - 行タップで `onOpenBook(bookId)` が呼ばれる。
  - 0件でも落ちない。
- `App.test.tsx` または画面遷移テスト: マイページ→一覧→戻る。
- 既存 `MyPageScreen.test.tsx` の内訳テストは維持（導線追加に合わせて最小更新）。

## 9. 影響範囲

- 変更: `App.tsx`（ルート1件追加）、`MyPageScreen.tsx`（導線のみ）、`progress.ts`（`coverUrl` 受け渡しのみ）、新規2ファイル（画面＋テスト）。
- 変更しない: 集計式、DB、偏差値・ランキング系。
