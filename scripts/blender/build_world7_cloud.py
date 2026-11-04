"""Build W7 floating islands world (separate island meshes + pads, no ribbons).
Run: blender --background --python build_world7_cloud.py
Island rule: top nodes sit >=0.6m inside edges; approach lines stay outside.
"""
import sys
import os
import math

sys.path.insert(0, os.path.join(r"C:\anki\スケジュール管理アプリ", "scripts", "blender"))
import wkit
import bpy
import bmesh
from wkit import sstep

ISLANDS = [
    ("A", -6.0, 4.0, 0.0, 5.5, 4.0, 3.5),
    ("B", 5.0, -1.0, 2.2, 6.0, 4.5, 4.0),
    ("Mesa", 5.2, -4.2, 4.2, 2.2, 1.6, 2.5),
    ("C", 10.8, -5.5, 1.6, 2.5, 1.8, 3.0),
    ("D", 2.5, -9.8, 0.8, 5.5, 4.0, 3.5),
    ("Estep", 9.0, -7.2, 1.2, 1.5, 1.0, 2.5),
]


def H(x, z):
    best = -5.0
    for _, cx, cz, ty, rt, rb, th in ISLANDS:
        d = math.hypot(x - cx, z - cz)
        if d < rt:
            if ty > best:
                best = ty
    return best


wkit.fresh_scene("W7", sky=(0.55, 0.78, 1.0))
wkit.make_cam("W7_Overview", (0, -20, 13), (0, 0, 0))
wkit.make_cam("W7_Closeup", (1.0, -3.0, 4.5), (0.5, 3.0, 0.0))
bpy.context.scene.camera = bpy.data.objects["W7_Overview"]

m_top = wkit.mat_simple("W7_CloudTop", (0.88, 0.95, 0.88))
m_side = wkit.mat_simple("W7_CloudSide", (0.62, 0.68, 0.80))
m_grass = wkit.mat_simple("W7_GrassTop", (0.45, 0.78, 0.45))
m_road = wkit.mat_simple("W7_Road", (0.92, 0.88, 0.78))
m_water = wkit.mat_simple("W7_Water", (0.45, 0.75, 0.95), 0.3)
m_water.blend_method = 'BLEND'
m_water.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.85
m_wood = wkit.mat_simple("W7_Wood", (0.60, 0.42, 0.24))
m_white = wkit.mat_simple("W7_White", (0.94, 0.96, 0.99))
m_blue = wkit.mat_simple("W7_GateBlue", (0.20, 0.40, 0.95))
m_yellow = wkit.mat_simple("W7_FlagYellow", (0.95, 0.75, 0.20), 0.6)

AMB = wkit.PROJ + "\\artifacts\\ambientcg\\Grass005\\"
POLY = wkit.PROJ + "\\artifacts\\polyhaven\\brown_planks_03\\"
grass_c = wkit.load_img(AMB + "Grass005_1K-JPG_Color.jpg", 'sRGB')
grass_n = wkit.load_img(AMB + "Grass005_1K-JPG_NormalGL.jpg", 'Non-Color')
grass_r = wkit.load_img(AMB + "Grass005_1K-JPG_Roughness.jpg", 'Non-Color')
wood_c = wkit.load_img(POLY + "brown_planks_03_diff_1k.jpg", 'sRGB')
wood_r = wkit.load_img(POLY + "brown_planks_03_rough_1k.jpg", 'Non-Color')
wkit.build_ground(m_grass, grass_c, grass_n, grass_r, 6.0, tint=(0.85, 1.0, 0.85))
wkit.build_ground(m_wood, wood_c, None, wood_r, 1.5)
wkit.shrink_packed(512)
print("OK materials+textures")

for tag, cx, cz, ty, rt, rb, th in ISLANDS:
    if tag == "Estep":
        wkit.build_island(cx, cz, ty, rt, rb, th, "W7_Isle_" + tag, m_side, m_side)
    elif tag in ("Mesa",):
        wkit.build_island(cx, cz, ty, rt, rb, th, "W7_Isle_" + tag, m_grass, m_side)
    else:
        wkit.build_island(cx, cz, ty, rt, rb, th, "W7_Isle_" + tag, m_grass, m_side)
print("OK islands=%d" % len(ISLANDS))

# drifting cloud puffs below and around
for i, (px, py, pz, ps) in enumerate([(-8, -3, 6, 2.2), (2, -4, -8, 2.8), (10, -2, 2, 2.0), (-2, -5, -12, 2.5), (6, -3, 10, 1.8)]):
    mesh = bpy.data.meshes.new("W7_Puff%d" % i)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=ps)
    for v in bm.verts:
        v.co = (v.co.x + px, v.co.y + pz, v.co.z * 0.55 + py)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(m_white)
    ob = bpy.data.objects.new("W7_Puff%d" % i, mesh)
    bpy.context.scene.collection.objects.link(ob)

wkit.import_glb(H, "tree_pineDefaultA.glb", "K_Pine1", (-7.5, 4.5), 0.4)
wkit.import_glb(H, "tree_oak.glb", "K_Oak1", (3.0, 1.0), 1.2, 1.0)
wkit.import_glb(H, "rock_smallA.glb", "K_Rock1", (10.5, -5.0), 0.5, 0.9)
wkit.import_glb(H, "flower_redA.glb", "K_Flr0", (-5.0, 6.0), 0.5)
wkit.import_glb(H, "flower_yellowA.glb", "K_Fly0", (6.0, -1.0), 2.0, 1.0)
wkit.import_glb(H, "plant_bushSmall.glb", "K_Bsh0", (-3.0, 2.0), 0.7)
wkit.import_glb(H, "bridge_woodRound.glb", "K_Bridge", (0.35, 4.0, 0.0))
wkit.import_glb(H, "fence_simple.glb", "K_Fence1", (4.0, -5.5), 0.3)
wkit.import_glb(H, "sign.glb", "K_Sign", (4.0, 2.2), 0.9)
wkit.import_glb(H, "cliff_steps_rock.glb", "K_Steps", (4.9, -2.8, 0.0), 2.2, 0.9)
wkit.import_glb(H, "path_stoneCircle.glb", "K_Pad0", (-9, 7.5, 0.05), 0.0, 1.2)
wkit.import_glb(H, "path_stoneCircle.glb", "K_Pad1", (4.5, 1.5, 0.05), 0.0, 1.2)
wkit.import_glb(H, "path_stoneCircle.glb", "K_Pad2", (5.0, -6.0, 0.05), 0.0, 1.2)
wkit.import_glb(H, "path_stoneCircle.glb", "K_Pad3", (10.6, -5.2, 0.05), 0.0, 1.2)
wkit.import_glb(H, "path_stoneCircle.glb", "K_Pad4", (2.5, -9.8, 0.05), 0.0, 1.4)
span = wkit.fit_bridge(H, "K_Bridge", -1.8, 4.5, 2.5, 3.5)
print("OK kenney bridge_span=%.2f" % span)

rise = wkit.build_ladder(H, 6.8, -0.2, 6.2, -3.0, m_wood, "W7_Ladder")
print("ladder rise=%.2f" % rise)
assert rise > 1.5, "ladder too flat"
wkit.solid_box("W7_HutBase", (5.0, -6.0, 4.2 + 0.8), (1.8, 1.6, 1.6), m_white)
wkit.solid_box("W7_HutRoof", (5.0, -6.0, 4.2 + 1.75), (2.2, 2.0, 0.25), m_wood)
wkit.solid_box("W7_HutDoor", (5.0, -5.18, 4.2 + 0.55), (0.6, 0.1, 1.1), m_wood)
wkit.build_flag(H, 10.6, -5.2, m_yellow, m_wood, "W7_Flag")
wkit.build_arch(H, "W7_ArchStart", -9, 7.5, m_white, m_wood)
wkit.build_arch(H, "W7_ArchExit", -2.0, -10.0, m_white, m_wood)
arc = wkit.deck_arc(H, 0.35, 4.0, H(-1.8, 4.5), H(2.5, 3.5))
print("deck arc=%.3f" % arc)
wkit.dedupe_materials()

NODES = {
    "n0": {"kind": "start", "x": -9, "z": 7.5},
    "n1": {"x": -6, "z": 7},
    "n2": {"x": -3, "z": 5.5},
    "n3a": {"x": -1.8, "z": 4.5},
    "n3b": {"x": 2.5, "z": 3.5},
    "n4": {"kind": "branch", "x": 4.5, "z": 1.5},
    "n5a": {"x": 5.5, "z": -0.5},
    "n5b": {"x": 4.2, "z": -5.2},
    "n5c": {"kind": "ladder_bottom", "x": 6.8, "z": -0.2},
    "n5d": {"kind": "ladder_top", "x": 6.2, "z": -3.0},
    "n6": {"kind": "stage", "stageId": "cloud-stage-1", "x": 5.0, "z": -6.0},
    "n7": {"kind": "jump_from", "x": 8.0, "z": -5.0},
    "n8": {"kind": "stage", "stageId": "cloud-stage-2", "x": 10.6, "z": -5.2},
    "n9": {"kind": "stage", "stageId": "cloud-stage-3", "x": 7.5, "z": -9.0},
    "n10": {"x": 3.0, "z": -10.0},
    "n11": {"kind": "gate", "x": -2.0, "z": -10.0},
}
for k, v in NODES.items():
    v["y"] = round(H(v["x"], v["z"]) + 0.08, 3)
    assert abs(v["y"]) < 12 and v["y"] == v["y"], "bad height " + k
    assert v["y"] > -1.0, "node off-island: " + k
PATHS = [
    ("p0", "n0", "n1", "walk", 2.2, {"arcHeight": 0.15}), ("p1", "n1", "n2", "walk", 2.2, {"arcHeight": 0.15}),
    ("p2", "n2", "n3a", "walk", 2.2, {"arcHeight": 0.15}), ("p3", "n3a", "n3b", "bridge", 2.0, {"arcHeight": arc}),
    ("p4", "n3b", "n4", "walk", 2.2, {"arcHeight": 0.15}), ("p5", "n4", "n5a", "walk", 2.2, {"arcHeight": 0.15}),
    ("p6", "n5a", "n5b", "stairs_up", 1.3, {}), ("p7", "n4", "n5c", "walk", 2.2, {"arcHeight": 0.15}),
    ("p8", "n5c", "n5d", "ladder_up", 1.0, {}), ("p9", "n5d", "n6", "walk", 2.2, {"arcHeight": 0.15}),
    ("p10", "n5b", "n6", "walk", 2.2, {"arcHeight": 0.15}), ("p11", "n6", "n7", "run", 3.6, {"arcHeight": 0.15}),
    ("p12", "n7", "n8", "jump", 3.2, {"oneWay": True, "arcHeight": 1.6}),
    ("p13", "n8", "n9", "slope_down", 1.8, {"arcHeight": 0.2}), ("p14", "n9", "n10", "walk", 2.2, {"arcHeight": 0.15}),
    ("p15", "n10", "n11", "walk", 2.2, {"arcHeight": 0.15}), ("p16", "n5b", "n5d", "walk", 2.2, {"arcHeight": 0.15}),
]
jg = math.hypot(NODES["n8"]["x"] - NODES["n7"]["x"], NODES["n8"]["z"] - NODES["n7"]["z"])
print("jump_gap=%.2f" % jg)
assert 1.5 < jg < 4.0, "jump gap out of range"
wkit.write_graph(wkit.PROJ + "\\artifacts\\3d\\world7_graph.json", NODES, PATHS)
bpy.ops.wm.save_as_mainfile(filepath=wkit.PROJ + "\\artifacts\\3d\\source_blender\\world7_cloud_source.blend")
stats = wkit.export_verify(wkit.PROJ + "\\artifacts\\3d\\models\\world7_cloud.glb", ["Grass005", "brown_planks"])
print("GLB bytes=%d meshes=%d materials=%d images=%s" % (stats["bytes"], stats["meshes"], stats["materials"], stats["images"]))
print("BUILD_W7_OK")
