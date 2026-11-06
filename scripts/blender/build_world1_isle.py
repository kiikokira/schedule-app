"""W1 natural floating island (Task 5 of 2026-11-06-w1-isle-rebuild).

Run: blender --background --python scripts/blender/build_world1_isle.py
Outputs: public/rpg/world1_isle.glb + public/rpg/thumb-w1.jpg,
         rewrites y in public/rpg/world1_v3_graph.json (topology untouched).

Design (spec 2026-11-06-w1-isle-rebuild-design.md sections 3-5):
- natural 2-terrace island (no geometric primitives), ellipse coast + wobble
  + SSW bay, steep cliff falloff, inverted-cone skirt below (floating island)
- river: north pond -> stone-arch bridge (p3) -> upper west gorge (cave falls
  tributary, log bridge) -> south -> red bridge (n9-n10) -> cliff outlet falls
- bridges: 1 Kenney stone arch + 2 red-tinted Kenney wood bridges via fit_bridge
- landmarks: 3 original hobbit huts (S1), original well (S2), stone arch gate +
  Kenney obelisk statue (S5 hill), fenced pasture + hay (S4), Kenney trees
  (tall N/E), rocks/grass/yellow flowers scatter (road 2m / river 2m clear)
- graph: v3 xz kept, y = H + 0.05. No new libs, no Draco, no PBR textures
  (single stylized art style, Kenney + original low-poly only).
"""
import sys
import os
import math
import json
import random

PROJ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, os.path.join(PROJ, "scripts", "blender"))
import wkit
from wkit import sstep
from mathutils import Vector

print("BLEND:", __import__("bpy").data.filepath)
import bpy
import bmesh

# ---------------------------------------------------------------- height field
CX, CY = -3.0, -5.0          # island center (x=east, y=north)
RX, RY = 30.0, 33.0          # ellipse radii
BAY_TH, BAY_A, BAY_W = -1.71, 0.35, 0.35   # SSW bay (pier cove)
RIVER = [(-1, 12), (-2, 4.5), (0, -1), (2, -5), (4, -9), (5, -12),
         (4, -15), (3.5, -18), (4, -21), (6, -23.5), (6, -27)]
RCARVE = (0.8, 2.2, 1.7)     # full-depth half-width, fade-out, depth


def seg_dist(px, pz, ax, az, bx, bz):
    vx, vz = bx - ax, bz - az
    L2 = vx * vx + vz * vz
    t = 0.0 if L2 < 1e-9 else max(0.0, min(1.0, ((px - ax) * vx + (pz - az) * vz) / L2))
    return math.hypot(px - (ax + t * vx), pz - (az + t * vz))


def river_dist(x, z):
    return min(seg_dist(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1])
               for i in range(len(RIVER) - 1))


def coast_rn(x, z):
    dx, dz = (x - CX) / RX, (z - CY) / RY
    th = math.atan2(z - CY, x - CX)
    dth = (th - BAY_TH + math.pi) % (2 * math.pi) - math.pi
    pinch = BAY_A * math.exp(-((dth / BAY_W) ** 2))
    wob = 1.0 + 0.025 * math.sin(3 * th + 1.0) + 0.015 * math.sin(5 * th + 2.5)
    return (dx * dx + dz * dz + pinch) / (wob * wob)


def H_base(x, z):
    h = 3.0
    h += 0.50 * math.sin(x * 0.30 + 1.0) * math.cos(z * 0.28)
    h += 0.25 * math.sin(x * 0.70 + z * 0.40 + 0.7)
    dmid = math.hypot(x - 2.0, z - 2.0)      # mid terrace (stone loop, well)
    h += 2.5 * (1.0 - sstep(8.0, 11.0, dmid))
    dupp = math.hypot(x - 12.0, z + 13.0)    # upper terrace (pasture, statue)
    h += 6.0 * (1.0 - sstep(5.5, 9.5, dupp))
    rn = coast_rn(x, z)
    if rn > 1.0:
        h -= (rn - 1.0) * 35.0
    return h


def H(x, z):
    h = H_base(x, z)
    d = river_dist(x, z)
    h -= RCARVE[2] * (1.0 - sstep(RCARVE[0], RCARVE[1], d))
    return h


def H_water(x, z):
    return H_base(x, z) - 0.75


def H_bed(x, z):
    return H_base(x, z) - 1.55


# ---------------------------------------------------------------- scene setup
wkit.fresh_scene("W1", sky=(0.55, 0.80, 1.0))
bpy.context.scene.render.engine = 'CYCLES'
cam_over = wkit.make_cam("W1_Overview", (-3, -74, 62), (-3, -4, 2))
bpy.context.scene.camera = cam_over
bpy.context.scene.render.resolution_x = 640
bpy.context.scene.render.resolution_y = 360

# ---------------------------------------------------------------- materials
m_grass = wkit.mat_simple("W1_Grass", (0.42, 0.68, 0.30))
m_cliff = wkit.mat_simple("W1_Cliff", (0.45, 0.36, 0.28))
m_skirt = wkit.mat_simple("W1_Skirt", (0.38, 0.29, 0.23))
m_road = wkit.mat_simple("W1_Road", (0.62, 0.60, 0.57))
m_rbed = wkit.mat_simple("W1_RiverBed", (0.72, 0.62, 0.44))
m_water = wkit.mat_simple("W1_Water", (0.25, 0.60, 0.90), 0.25)
m_water.blend_method = 'BLEND'
m_water.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.78
m_falls = wkit.mat_simple("W1_Falls", (0.85, 0.94, 1.0), 0.3)
m_foam = wkit.mat_simple("W1_Foam", (0.95, 0.97, 1.0), 0.9,
                         emission=(0.7, 0.8, 0.9))
m_wood = wkit.mat_simple("W1_Wood", (0.50, 0.34, 0.20))
m_red = wkit.mat_simple("W1_RedWood", (0.75, 0.16, 0.12))
m_wall = wkit.mat_simple("W1_HutWall", (0.88, 0.80, 0.64))
m_thatch = wkit.mat_simple("W1_Thatch", (0.72, 0.55, 0.28))
m_door = wkit.mat_simple("W1_Door", (0.30, 0.18, 0.10))
m_win = wkit.mat_simple("W1_Window", (1.0, 0.85, 0.40), 0.4,
                        emission=(1.0, 0.7, 0.3))
m_stone = wkit.mat_simple("W1_Stone", (0.60, 0.59, 0.57))
m_hay = wkit.mat_simple("W1_Hay", (0.90, 0.75, 0.35))
m_dark = wkit.mat_simple("W1_Dark", (0.20, 0.20, 0.22))

# ---------------------------------------------------------------- terrain
ntop, ntotal = wkit.build_terrain(H, "W1_Terrain", m_grass, m_cliff, size=76.0, n=91)
print("OK terrain top=%d total=%d" % (ntop, ntotal))
assert ntop > 3000, "terrain top faces too few"

# skirt: inverted cone below (floating island bottom, closed)
mesh = bpy.data.meshes.new("W1_Skirt")
bm = bmesh.new()
SEG = 72
rim = []
for i in range(SEG):
    th = 2 * math.pi * i / SEG
    rx = CX + RX * math.cos(th) * 1.03
    rz = CY + RY * math.sin(th) * 1.03
    rim.append(bm.verts.new((rx, rz, -1.5)))
bm.verts.ensure_lookup_table()
apex = bm.verts.new((CX, CY, -18.0))
for i in range(SEG):
    bm.faces.new((rim[i], rim[(i + 1) % SEG], apex))
bm.to_mesh(mesh)
bm.free()
mesh.update()
mesh.materials.append(m_skirt)
wkit.box_uv(mesh)
ob = bpy.data.objects.new("W1_Skirt", mesh)
bpy.context.scene.collection.objects.link(ob)
print("OK skirt")


def beam(name, p0, p1, w, h, mat):
    A, B = Vector(p0), Vector(p1)
    d = B - A
    L = d.length
    d.normalize()
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * h, v.co.z * L))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(mat)
    wkit.box_uv(mesh)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = (A + B) / 2
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    return ob


def cyl(name, cx, cy, cz, r, h, mat, seg=12):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg,
                          radius1=r, radius2=r, depth=h)
    for v in bm.verts:
        v.co = Vector((v.co.x + cx, v.co.y + cy, v.co.z + cz))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(mat)
    wkit.box_uv(mesh)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------- roads (v3 node waypoints, width 1.4 / lift 0.06)
ROADS = {
    "RW": [(-20, 16), (-14, 14), (-9, 10), (-6, 6), (-4.5, 5.2)],
    "RM": [(0.5, 3.8), (2, 3), (7, 0)],
    "RUP": [(7, 0), (9, -6), (8, -13), (6, -17), (11, -19), (15, -18),
            (10, -23), (2, -24), (-7, -22)],
    "RB": [(7, 0), (12, -2), (11, -9)],
    "RL1": [(11, -9), (6, -17)],
    "RL2": [(8, -13), (11, -9)],
}
for name, pts in ROADS.items():
    wkit.ribbon(H, "W1_Road_" + name, pts, 1.4, 0.06, m_road)
print("OK roads")

# road samples for clearance checks
road_samples = []
for pts in ROADS.values():
    sm = wkit.chaikin([Vector((x, z)) for x, z in pts], iters=4)
    road_samples += [(p.x, p.y) for p in sm]


def road_dist(x, z):
    return min(math.hypot(x - px, z - pz) for px, pz in road_samples)


XCROSS = [(-2, 4.5), (6, -23.5)]  # bridged river crossings (stone, red2)
for i, (px, pz) in enumerate(road_samples):
    d = river_dist(px, pz)
    if d < 1.8 and all(math.hypot(px - cx, pz - cz) > 2.5 for cx, cz in XCROSS):
        raise AssertionError("road %d too close to river: %.2f at (%.1f,%.1f)"
                             % (i, d, px, pz))
print("OK road-river clearance")

# ---------------------------------------------------------------- river water + bed + pond
wkit.ribbon(H_water, "W1_RiverWater", RIVER, 1.6, 0.0, m_water)
wkit.ribbon(H_bed, "W1_RiverBed", RIVER, 2.2, 0.0, m_rbed)
pond = bpy.data.meshes.new("W1_Pond")
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, radius=1.8, segments=20)
for v in bm.verts:
    v.co = (v.co.x - 1.0, v.co.y + 13.0, H_base(-1, 13) - 0.75)
bm.to_mesh(pond)
bm.free()
pond.update()
pond.materials.append(m_water)
ob = bpy.data.objects.new("W1_Pond", pond)
bpy.context.scene.collection.objects.link(ob)
print("OK water")

# ---------------------------------------------------------------- bridges (fit_bridge: width ~ road, both ends grounded)
wkit.import_glb(H, "bridge_stone.glb", "K_BridgeStone", (-4.5, 5.2))
wkit.import_glb(H, "bridge_wood.glb", "K_BridgeRed1", (1.5, -19.5))
wkit.import_glb(H, "bridge_wood.glb", "K_BridgeRed2", (7.6, -23.35))
for tint_name in ("K_BridgeRed1", "K_BridgeRed2"):
    root = bpy.data.objects.get(tint_name)
    for o in root.children_recursive:
        if o.type == 'MESH':
            o.data.materials.clear()
            o.data.materials.append(m_red)
wkit.fit_bridge(H, "K_BridgeStone", -4.5, 5.2, 0.5, 3.8)
wkit.fit_bridge(H, "K_BridgeRed1", 1.5, -19.5, 5.9, -19.5)
wkit.fit_bridge(H, "K_BridgeRed2", 7.6, -23.35, 4.4, -23.65)
print("OK bridges")
# both-ends-grounded assert (deck is flat at max bank + 0.12)
for root_name, ax, az, bx, bz in [("K_BridgeStone", -4.5, 5.2, 0.5, 3.8),
                                  ("K_BridgeRed1", 1.5, -19.5, 5.9, -19.5),
                                  ("K_BridgeRed2", 7.6, -23.35, 4.4, -23.65)]:
    root = bpy.data.objects.get(root_name)
    deck = max(H(ax, az), H(bx, bz)) + 0.12
    for ex, ez in ((ax, az), (bx, bz)):
        gap = abs(deck - H(ex, ez))
        assert gap < 0.8, "%s end floats: %.2f" % (root_name, gap)
print("OK bridge grounding")

# ---------------------------------------------------------------- landmarks
# hobbit huts x3 near S1 village entrance (original low-poly)
def hobbit(name, hx, hz, rot):
    hb = H(hx, hz)
    wkit.solid_box(name + "_Base", (hx, hz, hb + 1.0), (2.6, 2.2, 2.0), m_wall)
    roof = bpy.data.meshes.new(name + "_Roof")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=2.3, depth=1.5)
    for v in bm.verts:
        v.co = Vector((v.co.x + hx, v.co.y + hz, v.co.z + hb + 2.75))
    bm.to_mesh(roof)
    bm.free()
    roof.update()
    roof.materials.append(m_thatch)
    wkit.box_uv(roof)
    ro = bpy.data.objects.new(name + "_Roof", roof)
    bpy.context.scene.collection.objects.link(ro)
    ro.rotation_euler = (0, 0, rot + math.pi / 4)
    dx, dz = math.cos(rot), math.sin(rot)
    cyl(name + "_Door", hx + dx * 1.15, hz + dz * 1.15, hb + 0.55, 0.45, 1.1, m_door)
    cyl(name + "_Win", hx - dz * 0.8 + dx * 1.1, hz + dx * 0.8 + dz * 1.1,
        hb + 1.3, 0.30, 0.15, m_win)
    wkit.solid_box(name + "_Chim", (hx - dx * 0.6, hz - dz * 0.6, hb + 3.1),
                   (0.35, 0.35, 1.0), m_stone)


hobbit("W1_HutA", -16, 11, 0.5)
hobbit("W1_HutB", -12, 16.5, 2.4)
hobbit("W1_HutC", -18, 12, 4.0)
print("OK hobbits")

# well near S2 (original: stone ring + posts + pyramid roof)
wx, wz, wb = 9.5, 1.5, H(9.5, 1.5)
cyl("W1_WellRing", wx, wz, wb + 0.4, 0.7, 0.8, m_stone, seg=14)
cyl("W1_WellHole", wx, wz, wb + 0.82, 0.5, 0.06, m_dark, seg=14)
wkit.solid_box("W1_WellP0", (wx - 0.8, wz, wb + 1.3), (0.14, 0.14, 1.8), m_wood)
wkit.solid_box("W1_WellP1", (wx + 0.8, wz, wb + 1.3), (0.14, 0.14, 1.8), m_wood)
wroof = bpy.data.meshes.new("W1_WellRoof")
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=1.3, depth=0.9)
for v in bm.verts:
    v.co = Vector((v.co.x + wx, v.co.y + wz, v.co.z + wb + 2.6))
bm.to_mesh(wroof)
bm.free()
wroof.update()
wroof.materials.append(m_red)
wkit.box_uv(wroof)
wro = bpy.data.objects.new("W1_WellRoof", wroof)
bpy.context.scene.collection.objects.link(wro)
wro.rotation_euler = (0, 0, math.pi / 4)
print("OK well")

# stone arch gate on S5 road + obelisk statue on guardian hill
wkit.build_arch(H, "W1_Gate", 13, -18.7, m_stone, m_stone)
wkit.import_glb(H, "statue_obelisk.glb", "K_Statue", (16.8, -16.3), 0.6)
print("OK gate+statue")

# fenced pasture (S4) + hay bales
pad_cx, pad_cz, pad_w, pad_d = 14.0, -15.0, 3.4, 2.8
pad_fences = []
for k in range(3):
    fx = pad_cx - pad_w / 2 + pad_w * (k + 0.5) / 3
    pad_fences.append((fx, pad_cz - pad_d / 2, 0.0))
    pad_fences.append((fx, pad_cz + pad_d / 2, 0.0))
pad_fences.append((pad_cx - pad_w / 2, pad_cz, math.pi / 2))
pad_fences.append((pad_cx + pad_w / 2, pad_cz, math.pi / 2))
for i, (px, pz, ang) in enumerate(pad_fences):
    wkit.import_glb(H, "fence_simple.glb", "K_PadF%d" % i, (px, pz), ang)
cyl("W1_Hay0", 13.5, -15, H(13.5, -15) + 0.45, 0.6, 0.9, m_hay)
cyl("W1_Hay1", 14.5, -14.5, H(14.5, -14.5) + 0.45, 0.6, 0.9, m_hay)
cyl("W1_Hay2", 11, -16, H(11, -16) + 0.45, 0.6, 0.9, m_hay)
print("OK pasture+hay")

# cave waterfall (upper west gorge tributary) + log bridge + outlet falls
wkit.import_glb(H, "cliff_cave_stone.glb", "K_Cave", (6.2, -9.5), -math.pi / 2)
wkit.import_glb(H, "cliff_waterfall_stone.glb", "K_FallsRock", (5.0, -9.0), -math.pi / 2)
fb = H_base(5.2, -9.3)
beam("W1_FallsStrip", (5.2, -9.3, fb + 0.5), (4.4, -9.2, fb - 3.0), 1.0, 0.25, m_falls)
wkit.solid_box("W1_FallsFoam", (4.4, -9.2, H(4, -9) + 0.35), (1.3, 1.3, 0.3), m_foam)
wkit.import_glb(H, "log_large.glb", "K_Log", (1.0, -3.0), 1.1, 1.2)
oh = H_base(6, -26.8)
beam("W1_OutletStrip", (6, -26.8, oh + 0.2), (6, -29.2, oh - 6.5), 1.6, 0.3, m_falls)
wkit.solid_box("W1_OutletFoam", (6, -29.2, oh - 6.4), (2.0, 2.0, 0.35), m_foam)
print("OK falls+log")

# pier south of S8 (original planks on posts, jutting past the bay coast)
pier0, pier1 = (-7, -29.0), (-7, -32.5)
ph0 = H(pier0[0], pier0[1])
beam("W1_PierDeck", (pier0[0], pier0[1], ph0 + 0.35), (pier1[0], pier1[1], ph0 + 0.15),
     1.6, 0.18, m_wood)
for i, t in enumerate((0.15, 0.5, 0.85)):
    px = pier0[0] + (pier1[0] - pier0[0]) * t
    pz = pier0[1] + (pier1[1] - pier0[1]) * t
    top = ph0 + 0.3 - 0.2 * t
    wkit.solid_box("W1_PierPost%d" % i, (px - 0.6, pz, top - 1.5), (0.18, 0.18, 3.0), m_wood)
    wkit.solid_box("W1_PierPost%dB" % i, (px + 0.6, pz, top - 1.5), (0.18, 0.18, 3.0), m_wood)
print("OK pier")

# ---------------------------------------------------------------- scatter (Kenney; road 2m / river 2m clearance)
AVOID = [(-16, 11, 3), (-12, 16.5, 3), (-18, 12, 3), (9.5, 1.5, 2.5),
         (16.8, -16.3, 2.5), (13, -18.7, 2.5), (14, -15, 3.5), (6.2, -9.5, 2.5),
         (-1, 13, 3), (-7, -30.5, 3), (11, -16, 2), (4, -9, 2)]


def clear(x, z):
    if coast_rn(x, z) > 0.88:
        return False
    if road_dist(x, z) < 2.0:
        return False
    if river_dist(x, z) < 2.0:
        return False
    return all(math.hypot(x - ax, z - az) > r for ax, az, r in AVOID)


placed = 0
rnd = random.Random(11)
# feature trees/rocks (fixed, hand-checked)
for fname, prefix, spots in [
        ("tree_tall.glb", "K_TTall", [(16, -8), (14, -4), (18, -12)]),
        ("tree_pineTallA.glb", "K_Pine", [(9, -4), (13, -6), (16, -10), (10, -16),
                                          (15, -12), (7, -9), (12, -4), (17, -8)]),
        ("tree_detailed.glb", "K_Broad", [(-17, 9), (-10, 15), (-14, 8), (18, -5),
                                          (8, 5), (-19, 15)]),
        ("tree_oak.glb", "K_Oak", [(-8, 13), (13, -11), (-11, 6)]),
        ("rock_tallC.glb", "K_Peak", [(14, -7), (15.2, -6.2), (12.8, -7.8)]),
        ("stone_largeA.glb", "K_SL", [(15, -5), (-13, 8), (0, -12)]),
        ("rock_smallB.glb", "K_SR", [(-15, 13), (10, 2), (5, -6), (12, -21), (-5, -20)]),
        ("tree_cone.glb", "K_Cone", [(16, -14), (-18, 8), (6, 8)])]:
    for j, (sx, sz) in enumerate(spots):
        if not clear(sx, sz):
            print("SKIP %s%d at (%.1f,%.1f)" % (prefix, j, sx, sz))
            continue
        wkit.import_glb(H, fname, "%s%d" % (prefix, j), (sx, sz),
                        rnd.uniform(0, 6.28), rnd.uniform(0.9, 1.2))
        placed += 1
# small dressing: seeded rejection sampling (road 2m / river 2m via clear())
RANDOM_ITEMS = [("plant_bushSmall.glb", "K_Bush", 8, 0.9, 1.2),
                ("grass_large.glb", "K_Grass", 14, 0.9, 1.3),
                ("flower_yellowB.glb", "K_Flw", 12, 0.9, 1.1),
                ("rock_smallB.glb", "K_Rock", 6, 0.8, 1.1),
                ("fence_simple.glb", "K_HutF", 4, 1.0, 1.0)]
for fname, prefix, want, smin, smax in RANDOM_ITEMS:
    got, tries = 0, 0
    while got < want and tries < 120:
        tries += 1
        sx = rnd.uniform(-24, 20)
        sz = rnd.uniform(-30, 20)
        if not clear(sx, sz):
            continue
        wkit.import_glb(H, fname, "%sR%d" % (prefix, got), (sx, sz),
                        rnd.uniform(0, 6.28), rnd.uniform(smin, smax))
        got += 1
        placed += 1
    print("scatter %s: %d/%d" % (prefix, got, want))
print("OK scatter placed=%d" % placed)
assert placed >= 40, "too few scatter placed"

wkit.dedupe_materials()

# ---------------------------------------------------------------- graph y rewrite (topology untouched)
gpath = os.path.join(PROJ, "public", "rpg", "world1_v3_graph.json")
graph = json.load(open(gpath))
for n in graph["nodes"]:
    y = round(H(n["x"], n["z"]) + 0.05, 3)
    assert abs(y) < 30 and y == y, "bad height %s" % n["id"]
    assert coast_rn(n["x"], n["z"]) < 0.92, "node off-island %s" % n["id"]
    cd = river_dist(n["x"], n["z"])
    assert cd > 2.2, "node in riverbed %s (%.2f)" % (n["id"], cd)
    n["y"] = y
json.dump(graph, open(gpath, "w"), indent=2)
print("OK graph y rewrite")

# ---------------------------------------------------------------- export + verify + thumb
out = os.path.join(PROJ, "public", "rpg", "world1_isle.glb")
info = wkit.export_verify(out, [])
print("GLB bytes=%d meshes=%d materials=%d" % (info["bytes"], info["meshes"], info["materials"]))
assert info["bytes"] <= 2 * 1024 * 1024, "GLB exceeds 2MB"

bpy.context.scene.render.image_settings.file_format = 'JPEG'
bpy.context.scene.render.image_settings.quality = 90
bpy.context.scene.render.filepath = os.path.join(PROJ, "public", "rpg", "thumb-w1.jpg")
bpy.ops.render.render(write_still=True)
print("THUMB:", os.path.getsize(os.path.join(PROJ, "public", "rpg", "thumb-w1.jpg")))
print("BUILD_W1_ISLE_OK")
