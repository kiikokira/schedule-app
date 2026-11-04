"""Build W4 sea world (beach island + lagoon + jetty).
Run: blender --background --python build_world4_sea.py
"""
import sys
import os
import math

sys.path.insert(0, os.path.join(r"C:\anki\スケジュール管理アプリ", "scripts", "blender"))
import wkit
import bpy
import bmesh
from wkit import sstep


def H(x, z):
    base = (0.40 * math.sin(x * 0.32 + 0.4) * math.cos(z * 0.30)
            + 0.15 * math.sin(x * 0.80 + z * 0.55 + 1.2))
    dm = math.hypot(x - 4.5, z + 4.5)
    hill = 2.4 * (1.0 - sstep(2.8, 5.0, dm))
    dk = math.hypot(x - 10.8, z + 5.6)
    knoll = 1.8 * (1.0 - sstep(0.8, 2.4, dk))
    h = base + hill + knoll
    if -2.0 < z < 11.0:
        xc = -0.5 + 0.7 * math.sin(z * 0.45)
        h -= 0.90 * (1.0 - sstep(0.8, 1.8, abs(x - xc)))
    dl = math.hypot(x + 5.0, z - 4.0)
    h -= 0.60 * (1.0 - sstep(1.2, 2.6, dl))
    if 8.8 < x < 10.4 and -6.8 < z < -4.4:
        h = min(h, 0.30)
    edge = max(abs(x), abs(z))
    if edge > 9.5:
        h = h * 0.3 + 0.10
    if edge > 11.0:
        h -= (edge - 11.0) * 1.5
    return h


wkit.fresh_scene("W4", sky=(0.55, 0.82, 1.0))
wkit.make_cam("W4_Overview", (0, -20, 13), (0, 0, 0))
wkit.make_cam("W4_Closeup", (1.0, -3.0, 4.5), (0.5, 3.0, 0.0))
bpy.context.scene.camera = bpy.data.objects["W4_Overview"]

m_top = wkit.mat_simple("W4_SandTop", (0.87, 0.74, 0.53))
m_side = wkit.mat_simple("W4_SandSide", (0.66, 0.52, 0.34))
m_road = wkit.mat_simple("W4_Road", (0.80, 0.68, 0.50))
m_case = wkit.mat_simple("W4_RoadEdge", (0.55, 0.42, 0.28))
m_water = wkit.mat_simple("W4_Water", (0.20, 0.60, 0.88), 0.3)
m_water.blend_method = 'BLEND'
m_water.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.85
m_wood = wkit.mat_simple("W4_Wood", (0.55, 0.36, 0.20))
m_leaf = wkit.mat_simple("W4_Leaf", (0.25, 0.60, 0.30))
m_blue = wkit.mat_simple("W4_GateBlue", (0.20, 0.40, 0.95))
m_yellow = wkit.mat_simple("W4_FlagYellow", (0.95, 0.75, 0.20), 0.6)

AMB = wkit.PROJ + "\\artifacts\\ambientcg\\Ground093C\\"
POLY = wkit.PROJ + "\\artifacts\\polyhaven\\brown_planks_03\\"
sand_c = wkit.load_img(AMB + "Ground093C_1K-JPG_Color.jpg", 'sRGB')
sand_n = wkit.load_img(AMB + "Ground093C_1K-JPG_NormalGL.jpg", 'Non-Color')
sand_r = wkit.load_img(AMB + "Ground093C_1K-JPG_Roughness.jpg", 'Non-Color')
wood_c = wkit.load_img(POLY + "brown_planks_03_diff_1k.jpg", 'sRGB')
wood_r = wkit.load_img(POLY + "brown_planks_03_rough_1k.jpg", 'Non-Color')
wkit.build_ground(m_top, sand_c, sand_n, sand_r, 6.0)
wkit.build_ground(m_side, sand_c, sand_n, sand_r, 2.0)
wkit.build_ground(m_wood, wood_c, None, wood_r, 1.5)
wkit.shrink_packed(512)
print("OK materials+textures")

ntop, ntotal = wkit.build_terrain(H, "W4_Terrain", m_top, m_side)
print("OK terrain top=%d total=%d" % (ntop, ntotal))
assert ntop > 1500, "terrain top faces too few"

# surrounding sea plane
mesh = bpy.data.meshes.new("W4_Sea")
bm = bmesh.new()
S = 200.0
vv = [bm.verts.new(p) for p in [(-S, -S, -0.35), (S, -S, -0.35), (S, S, -0.35), (-S, S, -0.35)]]
bm.faces.new(vv)
bm.to_mesh(mesh)
bm.free()
mesh.update()
mesh.materials.append(m_water)
ob = bpy.data.objects.new("W4_Sea", mesh)
bpy.context.scene.collection.objects.link(ob)

groups = [
    [(-9, 7.5), (-6, 7), (-3, 5.5), (-1.8, 4.2)],
    [(2.3, 3.2), (4.5, 1.5), (5.5, -0.5), (4.2, -5.2)],
    [(4.5, 1.5), (6.8, -0.2)],
    [(6.2, -3.0), (5.0, -6.8)],
    [(4.2, -5.2), (5.0, -6.8)],
    [(4.2, -5.2), (6.2, -3.0)],
    [(5.0, -6.8), (7.8, -5.8)],
    [(10.8, -5.6), (8.0, -9.5), (3.5, -10.5), (-4, -10)],
]
for i, g in enumerate(groups):
    wkit.ribbon(H, "W4_RoadCase_%d" % i, g, 1.9, 0.03, m_case)
    wkit.ribbon(H, "W4_Road_%d" % i, g, 1.5, 0.06, m_road)
wkit.ribbon(H, "W4_Inlet", [(-0.5 + 0.7 * math.sin(z * 0.45), z) for z in [x * 0.5 for x in range(-4, 23)]], 2.0, -0.25, m_water)
mesh = bpy.data.meshes.new("W4_Lagoon")
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, radius=2.0, segments=24)
for v in bm.verts:
    v.co = (v.co.x - 5.0, v.co.y + 4.0, -0.12)
bm.to_mesh(mesh)
bm.free()
mesh.update()
mesh.materials.append(m_water)
ob = bpy.data.objects.new("W4_Lagoon", mesh)
bpy.context.scene.collection.objects.link(ob)
print("OK roads+inlet+lagoon+sea")

wkit.import_glb(H, "tree_palmShort.glb", "K_Palm1", (-7.5, 4.5), 0.4)
wkit.import_glb(H, "tree_palmTall.glb", "K_Palm2", (8.5, 0.5), 2.1, 1.0)
wkit.import_glb(H, "tree_palmDetailedShort.glb", "K_Palm3", (-4.0, 8.8), 1.2)
wkit.import_glb(H, "tree_palmBend.glb", "K_Palm4", (2.0, -8.5), 2.9, 0.9)
wkit.import_glb(H, "rock_smallFlatA.glb", "K_RockS1", (-2.5, -4.0), 1.2)
wkit.import_glb(H, "rock_smallFlatB.glb", "K_RockS2", (7.0, -8.0), 2.6, 0.8)
wkit.import_glb(H, "rock_tallB.glb", "K_RockTall", (-11.0, -6.5), 0.0, 1.1)
wkit.import_glb(H, "stone_smallFlatA.glb", "K_StoneS1", (9.5, -9.0), 0.8)
wkit.import_glb(H, "bridge_wood.glb", "K_Bridge", (0.25, 3.7, 0.0))
wkit.import_glb(H, "fence_simple.glb", "K_Fence1", (3.2, -7.8), 0.3)
wkit.import_glb(H, "fence_simple.glb", "K_Fence2", (6.8, -7.9), -0.3)
wkit.import_glb(H, "fence_gate.glb", "K_GateStart", (-9, 8.6), 1.5708)
wkit.import_glb(H, "fence_gate.glb", "K_GateExit", (-4, -10.9), 0.0)
wkit.import_glb(H, "sign.glb", "K_Sign", (3.6, 0.6), 0.9)
wkit.import_glb(H, "cliff_cave_rock.glb", "K_Cave", (8.0, -10.8, 0.1), 3.1416)
wkit.import_glb(H, "cliff_steps_rock.glb", "K_Steps", (4.9, -2.8, 0.0), 2.6, 0.9)
wkit.import_glb(H, "tent_smallOpen.glb", "K_Tent", (5.0, -7.6, 0.0), 3.1416, 1.2)
wkit.import_glb(H, "campfire_stones.glb", "K_Camp", (10.8, -6.8), 0.0, 1.0)
wkit.import_glb(H, "plant_bushSmall.glb", "K_Bsh0", (-7.0, 1.5), 0.7)
wkit.import_glb(H, "plant_bushSmall.glb", "K_Bsh1", (9.0, 2.5), 1.9, 1.2)
span = wkit.fit_bridge(H, "K_Bridge", -1.8, 4.2, 2.3, 3.2)
print("OK kenney bridge_span=%.2f" % span)

rise = wkit.build_ladder(H, 6.8, -0.2, 6.2, -3.0, m_wood, "W4_Ladder")
print("ladder rise=%.2f" % rise)
assert rise > 1.5, "ladder too flat"
# wooden jetty into lagoon
jx, jz = -5.0, 4.0
jh = H(jx, jz)
wkit.solid_box("W4_JettyDeck", (jx - 1.5, jz, jh + 0.35), (3.0, 1.2, 0.15), m_wood)
for px in (-2.6, -1.4, -0.2):
    wkit.solid_box("W4_JettyPost%d" % int(px * 10), (jx + px - 1.5 + 1.5, jz - 0.4, jh - 0.2), (0.14, 0.14, 1.0), m_wood)
    wkit.solid_box("W4_JettyPostB%d" % int(px * 10), (jx + px - 1.5 + 1.5, jz + 0.4, jh - 0.2), (0.14, 0.14, 1.0), m_wood)
wkit.build_flag(H, 10.8, -5.6, m_yellow, m_wood, "W4_Flag")
wkit.build_arch(H, "W4_ArchStart", -9, 8.6, m_blue, m_wood)
wkit.build_arch(H, "W4_ArchExit", -4, -10.9, m_blue, m_wood)
arc = wkit.deck_arc(H, 0.25, 3.7, H(-1.8, 4.2), H(2.3, 3.2))
print("deck arc=%.3f" % arc)
wkit.dedupe_materials()

NODES = {
    "n0": {"kind": "start", "x": -9, "z": 7.5},
    "n1": {"x": -6, "z": 7},
    "n2": {"x": -3, "z": 5.5},
    "n3a": {"x": -1.8, "z": 4.2},
    "n3b": {"x": 2.3, "z": 3.2},
    "n4": {"kind": "branch", "x": 4.5, "z": 1.5},
    "n5a": {"x": 5.5, "z": -0.5},
    "n5b": {"x": 4.2, "z": -5.2},
    "n5c": {"kind": "ladder_bottom", "x": 6.8, "z": -0.2},
    "n5d": {"kind": "ladder_top", "x": 6.2, "z": -3.0},
    "n6": {"kind": "stage", "stageId": "sea-stage-1", "x": 5.0, "z": -6.8},
    "n7": {"kind": "jump_from", "x": 7.8, "z": -5.8},
    "n8": {"kind": "stage", "stageId": "sea-stage-2", "x": 10.8, "z": -5.6},
    "n9": {"kind": "stage", "stageId": "sea-stage-3", "x": 8.0, "z": -9.5},
    "n10": {"x": 3.5, "z": -10.5},
    "n11": {"kind": "gate", "x": -4, "z": -10},
}
for k, v in NODES.items():
    v["y"] = round(H(v["x"], v["z"]) + 0.08, 3)
    assert abs(v["y"]) < 10 and v["y"] == v["y"], "bad height " + k
PATHS = [
    ("p0", "n0", "n1", "walk", 2.2, {}), ("p1", "n1", "n2", "walk", 2.2, {}),
    ("p2", "n2", "n3a", "walk", 2.2, {}), ("p3", "n3a", "n3b", "bridge", 2.0, {"arcHeight": arc}),
    ("p4", "n3b", "n4", "walk", 2.2, {}), ("p5", "n4", "n5a", "walk", 2.2, {}),
    ("p6", "n5a", "n5b", "stairs_up", 1.3, {}), ("p7", "n4", "n5c", "walk", 2.2, {}),
    ("p8", "n5c", "n5d", "ladder_up", 1.0, {}), ("p9", "n5d", "n6", "walk", 2.2, {}),
    ("p10", "n5b", "n6", "walk", 2.2, {}), ("p11", "n6", "n7", "run", 3.6, {}),
    ("p12", "n7", "n8", "jump", 3.2, {"oneWay": True, "arcHeight": 1.6}),
    ("p13", "n8", "n9", "slope_down", 1.8, {}), ("p14", "n9", "n10", "walk", 2.2, {}),
    ("p15", "n10", "n11", "walk", 2.2, {}), ("p16", "n5b", "n5d", "walk", 2.2, {}),
]
jg = math.hypot(NODES["n8"]["x"] - NODES["n7"]["x"], NODES["n8"]["z"] - NODES["n7"]["z"])
print("jump_gap=%.2f" % jg)
assert 1.5 < jg < 4.0, "jump gap out of range"
wkit.write_graph(wkit.PROJ + "\\artifacts\\3d\\world4_graph.json", NODES, PATHS)
bpy.ops.wm.save_as_mainfile(filepath=wkit.PROJ + "\\artifacts\\3d\\source_blender\\world4_sea_source.blend")
stats = wkit.export_verify(wkit.PROJ + "\\artifacts\\3d\\models\\world4_sea.glb", ["Ground093C", "brown_planks"])
print("GLB bytes=%d meshes=%d materials=%d images=%s" % (stats["bytes"], stats["meshes"], stats["materials"], stats["images"]))
print("BUILD_W4_OK")
