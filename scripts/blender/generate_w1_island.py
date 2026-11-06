# W1 浮島 v2 生成スクリプト（単一座標源・Blender用）
# 使い方: blender --background --python scripts/blender/generate_w1_island.py
# 出力: public/rpg/world1_v2.glb + public/rpg/world1_v2_graph.json
# 既存 public/rpg/world1_v2_graph.json（16ノード/17パス/8ステージ）と同一座標を使うこと。
# 地形メッシュ中心線＝グラフ中心線を崩さない（Chaikin/Catmull-Rom近似の前提）。
# 本スクリプト未実行でも、アプリは procedural フォールバックで遊べる。

import json
import os

OUT_GLB = "public/rpg/world1_v2.glb"
OUT_GRAPH = "public/rpg/world1_v2_graph.json"

# v1由来の16ノード座標（yは地形高さで上書きする）
NODES = [
    ("n0", -24, 18), ("n1", -17, 17), ("n2", -11, 13), ("n3a", -8, 9),
    ("n3b", 2, 5), ("n4", 8, 2), ("n5a", 10, -4), ("n5b", 9, -12),
    ("n5c", 14, -1), ("n5d", 13, -8), ("n6", 7, -18), ("n7", 12, -20),
    ("n8", 17, -20), ("n9", 12, -25), ("n10", 4, -26), ("n11", -6, -25),
]
STAGES = {
    "n1": "w1-stage-1", "n4": "w1-stage-2", "n6": "w1-stage-3",
    "n7": "w1-stage-4", "n8": "w1-stage-5", "n9": "w1-stage-6",
    "n10": "w1-stage-7", "n11": "w1-stage-8",
}

print("W1 island v2 generator placeholder")
print(f"nodes={len(NODES)} stages={len(STAGES)} -> {OUT_GLB}, {OUT_GRAPH}")
print("NOTE: full Blender mesh generation lands here; runtime currently uses")
print("procedural fallback (buildWorld1Terrain + skirt/forts) with the same graph.")
