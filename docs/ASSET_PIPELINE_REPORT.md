# ASSET_PIPELINE_REPORT.md

## 工程記録（Blender MCP実操作）

- Blender **5.2.3 LTS**、glTF I/O使用。作業は `blender_execute_blender_code` の小分割実行。
- 新規 `artifacts/3d/source_blender/world1_grassland_source.blend` にSave-Asしてから制作（既存prototype・起動シーン非破壊）。
- 地形: 49x49グリッド解析H(x,z)（丘・ knoll・川カーブ・ジャンプ切欠き・縁スカート）。上面2068面/側面428面を法線で自動分離。
- 道: 8 waypoint群→Chaikin平滑→中心線リボン（表面1.5m/縁1.9m）。同一点列を `world1_graph.json`（nodes16/paths17）へ出力し表示と論理を一致。
- Kenney 16種を `import_scene.gltf` で読込・配置。橋は実測スパン適合＋yaw整合。重複マテリアル91件統合（113→22）。
- PBR: Grass005（Color sRGB / Normal Non-Color+NormalMap / Rough Non-Color、UVx6）、Planks（diff sRGB / rough Non-Color、UVx1.5）。画像はpackのうえGLBへ埋込。モバイル最適化で512px縮小（原本は `artifacts/{ambientcg,polyhaven}` に untouched）。
- 主人公Sola: 新規 `player_character_source.blend`、22パーツ＋21ボーン。rigid bone parenting（`matrix_parent_inverse` 未設定バグを特定・修正）。24アクションをNLA stash（全in-place）。
- GLB検証: JSON chunkを読んで meshes/materials/images/animations を列挙確認（world: 98 meshes/5 images、chara: 24 anims/1 skin）。
- レンダー: live renderはMCP切断のため **Cycles CPU + background CLI** で `w1_final.png` 等を出力。thumb-w1.pngとして選択画面で使用。

## 遭遇した問題と対処

1. 地形軸混入（高さをYに入れた）→頂点分布の統計で検出→正しい軸で再構築。
2. GrassTopマテリアル消失→material_index判定がZでなくYを見ていた→Newell法線＋Z判定に修正。
3. UV欠落で木部真っ黒→box-project UV付与スクリプト。
4. 橋デッキの青＝Kenney stone天板と判明（川ではない）→自作デッキ削除・p3にarcHeight 0.65付与。
5. キャラ分解表示→bone parentingのparent_inverse未設定→全22件修正＋再export。
6. ヘッドレスでchara未達→計測の罠（--timeoutは待たない）。timeline計測で「world parseが支配的」と特定→1.76MB最適化＋並列ロード＋進捗UI。
