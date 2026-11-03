# 3D素材ガイド（AI自律活用用）

このファイルは、ゲーム制作時にAIが素材を自律選択するための運用ガイドである。
機械可読の在庫索引は `artifacts/index.json` を見ること。両者は対で保守する。

## 在庫

| サイト | 素材 | パス | 内容 | 主な用途 |
| --- | --- | --- | --- | --- |
| Poly Haven | Brown Planks 03 | `artifacts/polyhaven/brown_planks_03` | 木材PBR（1K、CC0） | 床・壁 |
| ambientCG | Grass 005 | `artifacts/ambientcg/Grass005` | 芝生PBR（1K-JPG、CC0） | 草原・地面 |
| Kenney | Nature Kit | `artifacts/kenney/nature-kit` | GLB 329件＋プレビュー（CC0） | 木・岩・植物・柵ほか自然物 |

詳細（ファイル一覧・容量・SHA-256）は各 `manifest.json`、Kenneyのモデル一覧は `models.json`、
目視確認は `artifacts/kenney/nature-kit/preview.html` を見ること。

## サイトの使い分け

- Poly Haven：リアルなPBRテクスチャ・HDRI・自然物モデル
- ambientCG：地面・岩・草・砂・雪・木材のPBRテクスチャ
- Kenney：ゲーム向けスタイライズドモデル（木・岩・植物・建物・小物）。取得済みNature Kitを積極活用

## 既存優先フロー

1. `artifacts/index.json` で既存素材を確認し、足りる場合は新規取得しない
2. 不足時のみ各 `*_search` → `*_get_files`（容量・形式・ライセンス確認）→ `*_download`（単品のみ）
3. 同じ素材の重複ダウンロード禁止。新規取得後は `index.json` に追記する
4. Kenneyは公式ページの手動ダウンロード＋inbox取込が主経路（寄付フローは自動突破しない）

## スタイル統一規則

- リアル系（Poly Haven/ambientCG）とローポリ系（Kenney）を無計画に混ぜない。1世界1アートスタイル
- ゲーム向け3DはGLB優先。BLEND等の元データと区別して保管する
- テクスチャは1K/2K推奨。8K等の大容量は標準で取得しない
- モデル原寸はm単位・小規模であることを前提にスケールを確認する
- 素材のゲーム本体への自動配置は行わない（配置はBlender等で手動確認）

## 自動化できること・不足

自動化できること：

- 既存在庫の検索・選択（`index.json`＋manifest＋`models.json`）
- 3サイト横断の素材探し（` *_search`／` *_get_files`、日英対応）
- 安全な単品取得と展開・manifest記録（` *_download`、上書き禁止・SHA-256・ZIP安全展開）

不足（手動判断が必要）：

- `index.json` の更新（新規取得時の手動追記）
- Kenney実ZIPの手動ダウンロード（公式導線のため）
- 世界観・アートスタイルの最終判断、スケール・配置調整、Blender作業
- Summer Engine 等への組込判断（破壊的変更の可能性あり）

## 保守運用

- 新規素材の取得・削除時は `index.json` と本ファイルの在庫表を更新する
- 各サイトの連携ツール（`.opencode/tools/*.ts`）とmanifestの形式は変えない
- ホーム・スケジュール・ランキング・設定・RPG・ワールドマップ・Blender連携は本作業の対象外
