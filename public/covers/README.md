# 表紙画像を置く場所

ここ（`public/covers/`）に参考書の表紙画像を置くと、参考書一覧の候補に表示されます。

## 手順

1. 表紙画像ファイルをここへ追加する
   - GitHub のリポジトリ画面から `public/covers/` → 「Add file」→「Upload files」
   - ファイル名は半角英数字（例: `polaris1.png`）
2. `src/data/catalog.ts` の該当する参考書に `coverSrc` を指定する
   ```
   { id: 'eibunpo-polaris-1', title: '英文法ポラリス1 Final', subject: '文法', totalPages: 360, coverSrc: 'covers/polaris1.png' },
   ```

画像を指定していない本は、自動的にプレースホルダ（未設定）表示になります。

### 注意

- 画像の推奨サイズ: 縦横比 約3:4（例: 300×400px）
- PNG / JPG が使えます
- ファイルはアプリのデータと一緒に GitHub Pages へ公開されます。著作権に注意してください（個人利用の範囲を想定しています）