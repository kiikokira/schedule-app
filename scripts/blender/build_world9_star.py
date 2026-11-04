"""Build W9 fantasy world (mirrored layout, pastel + emissive crystals).
Run: blender --background --python build_world9_star.py
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
    base = (0.38 * math.sin(x * 0.34 + 1.7) * math.cos(z * 0.30)
            + 0.16 * math.sin(x * 0.80 + z * 0.50 + 0.9))
    dm = math.hypot(x + 4.5, z + 5.0)
    hill = 2.5 * (1.0 - sstep(3.0, 5.2, dm))
    dk = math.hypot(x + 10.8, z + 5.6)
    knoll = 1.9 * (1.0 - sstep(0.8, 2.4, dk))
    h = base + hill + knoll
    if -2.0 < z < 11.0:
        xc = 0.5 - 0.7 * math.sin(z * 0.45)
        h -= 0.90 * (1.0 - sstep(0.8, 1.8, abs(x - xc)))
    dp = math.hypot(x - 6.5, z - 2.5)
    h -= 0.45 * (1.0 - sstep(1.0, 2.2, dp))
    if -10.4 < x < -8.8 and -6.8 < z < -4.4:
        h = min(h, 0.30)
    edge = max(abs(x), abs(z))
    if edge > 11.0:
        h -= (edge - 11.0) * 1.5
    return h


wkit.fresh_scene("W9", sky=(0.62, 0.58, 0.86))
wkit.make_cam("W9_Overview", (0, -20, 13), (0, 0, 0))
wkit.make_cam("W9_Closeup", (-1.0, -3.0, 4.5), (-0.5, 3.0, 0.0))
bpy.context.scene.camera = bpy.data.objects["W9_Overview"]

m_top = wkit.mat_simple("W9_PastelTop", (0.72, 0.70, 0.85))
m_side = wkit.mat_simple("W9_DreamSide", (0.48, 0.42, 0.60))
m_road = wkit.mat_simple("W9_Road", (0.85, 0.78, 0.88))
m_case = wkit.mat_simple("W9_RoadEdge", (0.55, 0.48, 0.68))
m_water = wkit.mat_simple("W9_Water", (0.55, 0.70, 0.95), 0.3)
m_water.blend_method = 'BLEND'
m_water.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.85
m_wood = wkit.mat_simple("W9_Wood", (0.55, 0.42, 0.55))
m_crystal = wkit.mat_simple("W9_Crystal", (0.40, 0.80, 0.95), 0.2, emission=(0.30, 0.70, 1.0))
m_bloom = wkit.mat_simple("W9_Bloom", (0.95, 0.60, 0.85), 0.6, emission=(0.90, 0.40, 0.80))
m_blue = wkit.mat_simple("W9_GateBlue", (0.30, 0.40, 0.95))
m_yellow = wkit.mat_simple("W9_FlagYellow", (0.95, 0.85, 0.30), 0.6)

AMB = wkit.PROJ + "\\artifacts\\ambientcg\\Grass005\\"
POLY = wkit.PROJ + "\\artifacts\\polyhaven\\brown_planks_03\\"
grass_c = wkit.load_img(AMB + "Grass005_1K-JPG_Color.jpg", 'sRGB')
grass_n = wkit.load_img(AMB + "Grass005_1K-JPG_NormalGL.jpg", 'Non-Color')
grass_r = wkit.load_img(AMB + "Grass005_1K-JPG_Roughness.jpg", 'Non-Color')
wood_c = wkit.load_img(POLY + "brown_planks_03_diff_1k.jpg", 'sRGB')
wood_r = wkit.load_img(POLY + "brown_planks_03_rough_1k.jpg", 'Non-Color')
wkit.build_ground(m_top, grass_c, grass_n, grass_r, 6.0, tint=(0.80, 0.72, 1.0))
wkit.build_ground(m_wood, wood_c, None, wood_r, 1.5)
wkit.shrink_packed(512)
print("OK materials+textures")

ntop, ntotal = wkit.build_terrain(H, "W9_Terrain", m_top, m_side)
print("OK terrain top=%d total=%d" % (ntop, ntotal))
assert ntop > 1500, "terrain top faces too few"

groups = [
    [(9, 7.5), (6, 7), (3, 5.5), (1.8, 4.2)],
    [(-2.3, 3.2), (-4.5, 1.5), (-5.5, -0.5), (-4.2, -5.2)],
    [(-4.5, 1.5), (-6.8, -0.2)],
    [(-6.2, -3.0), (-5.0, -6.8)],
    [(-4.2, -5.2), (-5.0, -6.8)],
    [(-4.2, -5.2), (-6.2, -3.0)],
    [(-5.0, -6.8), (-7.8, -5.8)],
    [(-10.8, -5.6), (-8.0, -9.5), (-3.5, -10.5), (4, -10)],
]
for i, g in enumerate(groups):
    wkit.ribbon(H, "W9_RoadCase_%d" % i, g, 1.9, 0.05, m_case)
    wkit.ribbon(H, "W9_Road_%d" % i, g, 1.5, 0.10, m_road)
wkit.ribbon(H, "W9_Stream", [(0.5 - 0.7 * math.sin(z * 0.45), z) for z in [x * 0.5 for x in range(-4, 23)]], 1.6, -0.25, m_water)
print("OK roads+stream")


def crystal_cluster(cx, cz, n, r_spread, smin, smax, mat, prefix, seed):
    import random
    rnd = random.Random(seed)
    for i in range(n):
        a = rnd.uniform(0, 6.28)
        d = rnd.uniform(0.3, r_spread)
        x, z = cx + d * math.cos(a), cz + d * math.sin(a)
        s = rnd.uniform(smin, smax)
        mesh = bpy.data.meshes.new("%s_C%d" % (prefix, i))
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.35 * s)
        for v in bm.verts:
            v.co = (v.co.x + x, v.co.y + z, v.co.z * 2.2 + H(x, z) + 0.5 * s)
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        mesh.materials.append(mat)
        wkit.box_uv(mesh, scale=1.0)
        ob = bpy.data.objects.new("%s_C%d" % (prefix, i), mesh)
        bpy.context.scene.collection.objects.link(ob)


def bloom_dot(x, z, mat, prefix, i):
    mesh = bpy.data.meshes.new("%s_B%d" % (prefix, i))
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.12)
    for v in bm.verts:
        v.co = (v.co.x + x, v.co.y + z, v.co.z + H(x, z) + 0.35)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(mat)
    wkit.box_uv(mesh)
    ob = bpy.data.objects.new("%s_B%d" % (prefix, i), mesh)
    bpy.context.scene.collection.objects.link(ob)


crystal_cluster(-8.0, -9.5, 9, 2.0, 0.8, 1.6, m_crystal, "W9_CaveCry", 101)
crystal_cluster(2.0, 7.0, 4, 1.5, 0.5, 1.0, m_crystal, "W9_StartCry", 202)
for i, (bx, bz) in enumerate([(-6, 5), (-2, -1), (6, -8), (-8, -6), (0, 8)]):
    bloom_dot(bx, bz, m_bloom, "W9_Bloom", i)

wkit.import_glb(H, "mushroom_redGroup.glb", "K_Mush1", (-7.5, 4.5), 0.4, 1.2)
wkit.import_glb(H, "mushroom_tanGroup.glb", "K_Mush2", (8.5, 0.5), 2.1, 1.1)
wkit.import_glb(H, "mushroom_redTall.glb", "K_Mush3", (-4.0, 8.8), 1.2)
wkit.import_glb(H, "mushroom_tanTall.glb", "K_Mush4", (2.0, -8.5), 2.9, 0.9)
wkit.import_glb(H, "rock_smallTopA.glb", "K_Rock1", (-2.5, -4.0), 1.2)
wkit.import_glb(H, "stone_smallTopA.glb", "K_Stone1", (7.0, -8.0), 2.6, 0.8)
wkit.import_glb(H, "bridge_stoneRound.glb", "K_Bridge", (-0.25, 3.7, 0.0))
wkit.import_glb(H, "fence_simple.glb", "K_Fence1", (-3.2, -7.8), 0.3)
wkit.import_glb(H, "fence_simple.glb", "K_Fence2", (-6.8, -7.9), -0.3)
wkit.import_glb(H, "fence_gate.glb", "K_GateStart", (9, 8.6), 1.5708)
wkit.import_glb(H, "fence_gate.glb", "K_GateExit", (4, -10.9), 0.0)
wkit.import_glb(H, "sign.glb", "K_Sign", (-3.6, 0.6), 0.9)
wkit.import_glb(H, "plant_bushSmall.glb", "K_Bsh0", (-7.0, 1.5), 0.7)
wkit.import_glb(H, "plant_bushSmall.glb", "K_Bsh1", (9.0, 2.5), 1.9, 1.2)
wkit.import_glb(H, "cliff_steps_rock.glb", "K_Steps", (-4.9, -2.8, 0.0), 0.5, 0.9)
span = wkit.fit_bridge(H, "K_Bridge", 1.8, 4.2, -2.3, 3.2)
print("OK kenney bridge_span=%.2f" % span)

rise = wkit.build_ladder(H, -6.8, -0.2, -6.2, -3.0, m_wood, "W9_Ladder")
print("ladder rise=%.2f" % rise)
assert rise > 1.5, "ladder too flat"
hx, hz = -5.0, -6.8
hb = H(hx, hz)
wkit.solid_box("W9_HutBase", (hx, hz, hb + 0.8), (2.2, 1.8, 1.6), m_blue)
mesh = bpy.data.meshes.new("W9_CrystalRoof")
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.4)
for v in bm.verts:
    v.co = (v.co.x + hx, v.co.y + hz, v.co.z * 0.9 + hb + 2.6)
bm.to_mesh(mesh)
bm.free()
mesh.update()
mesh.materials.append(m_crystal)
wkit.box_uv(mesh)
ob = bpy.data.objects.new("W9_CrystalRoof", mesh)
bpy.context.scene.collection.objects.link(ob)
wkit.solid_box("W9_HutDoor", (hx, hz + 0.92, hb + 0.5), (0.7, 0.1, 1.0), m_wood)
wkit.build_flag(H, -10.8, -5.6, m_yellow, m_wood, "W9_Flag")
wkit.build_arch(H, "W9_ArchStart", 9, 8.6, m_blue, m_wood)
wkit.build_arch(H, "W9_ArchExit", 4, -10.9, m_blue, m_wood)
arc = wkit.deck_arc(H, -0.25, 3.7, H(1.8, 4.2), H(-2.3, 3.2))
print("deck arc=%.3f" % arc)
wkit.dedupe_materials()

NODES = {
    "n0": {"kind": "start", "x": 9, "z": 7.5},
    "n1": {"x": 6, "z": 7},
    "n2": {"x": 3, "z": 5.5},
    "n3a": {"x": 1.8, "z": 4.2},
    "n3b": {"x": -2.3, "z": 3.2},
    "n4": {"kind": "branch", "x": -4.5, "z": 1.5},
    "n5a": {"x": -5.5, "z": -0.5},
    "n5b": {"x": -4.2, "z": -5.2},
    "n5c": {"kind": "ladder_bottom", "x": -6.8, "z": -0.2},
    "n5d": {"kind": "ladder_top", "x": -6.2, "z": -3.0},
    "n6": {"kind": "stage", "stageId": "star-stage-1", "x": -5.0, "z": -6.8},
    "n7": {"kind": "jump_from", "x": -7.8, "z": -5.8},
    "n8": {"kind": "stage", "stageId": "star-stage-2", "x": -10.8, "z": -5.6},
    "n9": {"kind": "stage", "stageId": "star-stage-3", "x": -8.0, "z": -9.5},
    "n10": {"x": -3.5, "z": -10.5},
    "n11": {"kind": "gate", "x": 4, "z": -10},
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
wkit.write_graph(wkit.PROJ + "\\artifacts\\3d\\world9_graph.json", NODES, PATHS)
bpy.ops.wm.save_as_mainfile(filepath=wkit.PROJ + "\\artifacts\\3d\\source_blender\\world9_star_source.blend")
stats = wkit.export_verify(wkit.PROJ + "\\artifacts\\3d\\models\\world9_star.glb", ["Grass005", "brown_planks"])
print("GLB bytes=%d meshes=%d materials=%d images=%s" % (stats["bytes"], stats["meshes"], stats["materials"], stats["images"]))
print("BUILD_W9_OK")
