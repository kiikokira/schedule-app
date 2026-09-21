# アイコン選定 — 保留メモ(2026-09-21)

## 状態
- アプリアイコンの最終選定は**保留中**。アイコンの実装(192/512 PNG 差し替え)は未実施。
- 既存アイコン `public/icons/icon-192.png` / `icon-512.png` は現状のまま稼働。

## 選定候補(6案、ブラウザで確認可)
Visual Companion セッション `icon-1789962876` の画面に一覧済み。

| 案 | 内容 |
|----|------|
| A  | 開いた本×緑チェック(青グラデ) |
| C  | 本→本 の進行矢印(紫、NOW→NEXT 連動) |
| D  | 進捗リング×本(緑) |
| E  | ページ枠×達成87%×チェック(青) |
| J  | 本×進捗バー(白基調+緑) |
| H  | ゴール旗×本(緑) |

未決定のため取捨のみ。別系統として growth(No.65「伸びてる」/100案)・line(折れ線グラフ/100案)・appstore(透け感20案)も探索済み。

## 再開時の手順
1. `content/icons-final.html`(または該当ファミリー画面)で最終1案を決定
2. 案のSVGから `public/icons/icon-192.png` と `icon-512.png` を生成して差し替え
3. `npm run test` / `npm run build` → commit & push → デプロイ反映を確認
4. 反映後はホーム画面のアイコンはキャッシュのため再追加が必要な場合あり(ユーザー側操作)

## 関連ファイル
- `.superpowers/brainstorm/icon-1789962876/content/icons-final.html` — 最終選定画面(6案)
- 同 `content/icon-family.html` — 第1段階(9系統)選択画面
- `public/icons/icon-192.png` / `icon-512.png` — 差し替え対象