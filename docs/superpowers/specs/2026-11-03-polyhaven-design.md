# Poly Haven連携 設計書（2026-11-03）

## 背景・目的
- OpenCodeからPoly Haven公式API（https://api.polyhaven.com/）に接続し、HDRIs/Textures/Modelsを検索・ファイル確認・単品ダウンロードする。
- 既存機能（ホーム/スケジュール/ランキング/設定・Blender連携・opencode.json）を壊さない。

## 調査結果
- Vite+React+TS（schedule-app 0.1.0）、Node v24.16、npm 11.13。
- `.opencode/`なし、opencode.jsonはMCP summer-engine+context7のみ。
- Blender接続中：artifacts/blender_prototype/grassland_prototype.blend。
- Poly Haven API：キー不要、User-Agent必須、CC0、エンドポイント /search /info/{slug} /files/{slug} /assets /taxonomy。
- llms.txt要件：出典表示（Powered by Poly Haven）、アセットページリンク https://polyhaven.com/a/{slug}。

## 決定事項（ユーザー承認済み）
- 保存先：artifactsのみ → `artifacts/polyhaven/{slug}/`
- 形式優先：.blend優先（Blender中心）、glTF/テクスチャもget_filesで提示。

## アーキテクチャ
- 新規1ファイル：`.opencode/tools/polyhaven.ts`
- `import { tool } from "@opencode-ai/plugin"`、3エクスポート → ツール名 `polyhaven_search / polyhaven_get_files / polyhaven_download`。
- native fetchのみ、新規依存なし。User-Agent: `schedule-app-polyhaven/0.1.0 (+https://kiikokira.github.io/schedule-app/)`。
- opencode.json・package.json・src/ 無改変。

## 機能仕様
### polyhaven_search(query, type?, limit?)
- JP→EN小辞書（レンガ→brick、木→wood、草原→grass、空→sky、岩→rock、海→ocean、砂→sand、金属→metal、布→fabric等）で英訳併用＋元クエリでも検索しマージ・重複排除。
- `GET /search?q=&t=` → slug一覧 → `GET /info/{slug}`（並列数制限・失敗時スキップ）で整形。
- 返却：name/slug/id、type、thumbnailURL、pageURL、categories、description、ライセンスCC0明記。

### polyhaven_get_files(slug)
- `GET /files/{slug}` + `GET /info/{slug}`。
- 返却：形式・解像度・容量(bytes+MB)・URL・関連マップ・.blend優先ソート済み一覧＋推奨ファイル。
- ダウンロード前確認用に容量合計も表示。

### polyhaven_download(slug, resolution?, format?, includeRelated=true)
- 1回1アセットのみ。内部でfiles取得→候補選択（指定なければ.blend優先→最高解像度）。
- 安全性：保存先は `artifacts/polyhaven/{slug}/` のみ（`..`・絶対パス・外部パス拒否）、公式ドメイン（dl.polyhaven.org / api.polyhaven.com / polyhaven.com）のみ許可、既存ファイルは上書きせずエラー、通信エラーは最大3回リトライ。
- 関連テクスチャ（includeRelated=true時）は同一フォルダに取得、欠け防止。
- 成功時 `manifest.json` 作成：id/name/pageURL/license(CC0)/files/取得日時/Powered by Poly Haven。

## エラーハンドリング
- API失敗時は日本語メッセージ＋status code返却。429/5xxはリトライ、404はslug誤り案内。
- 不正slug（[^a-z0-9_])拒否、不正URL拒否。

## テスト計画（要件6項目）
1. 接続確認（/types取得）
2. 日本語検索（「レンガ」「草原」等）
3. 素材情報表示
4. 形式・容量取得
5. 単品ダウンロード（小容量テクスチャ/HDRIで検証、.blendは大容量のためget_files確認のみの場合あり）
6. artifactsからの利用確認（manifest+ファイル存在）＋ `npm run build` 回帰。

## Self-review
- プレースホルダなし、保存先・形式・共存方針に矛盾なし、単一プランで実装可能な範囲。
- スコープ外：全件一括DL、src/へのUI追加、Blenderへの自動インポート（将来拡張）。
