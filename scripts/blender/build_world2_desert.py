"""Build W2 desert world (fresh scene, no touch of W1 files).
Run: blender --background --python build_world2_desert.py
Outputs: artifacts/3d/source_blender/world2_desert_source.blend
         artifacts/3d/models/world2_desert.glb
         artifacts/3d/world2_graph.json
Lessons from W1 applied: correct axes (x=east, y=north, z=up),
Newell-Z material split, UVs on every textured mesh, texture
colorspaces, parent_inverse for bone parenting (n/a here),
numeric asserts before export, GLB JSON verification.
"""
import bpy
import bmesh
import math
import os
import json
import struct
import random
from mathutils import Vector

PROJ = r"C:\anki\スケジュール管理アプリ"
print("BLEND:", bpy.data.filepath)


def sstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def H(x, z):
    """Terrain height. x=east, z=north."""
    base = (0.50 * math.sin(x * 0.35 + 1.0) * math.cos(z * 0.30)
            + 0.20 * math.sin(x * 0.90 + z * 0.50 + 0.7))
    dm = math.hypot(x - 4.0, z + 5.0)
    mesa = 2.8 * (1.0 - sstep(3.2, 5.2, dm))
    dk = math.hypot(x - 10.8, z + 5.6)
    knoll = 2.0 * (1.0 - sstep(0.8, 2.4, dk))
    h = base + mesa + knoll
    if -2.0 < z < 11.0:
        xc = -0.5 + 0.7 * math.sin(z * 0.45)
        h -= 0.90 * (1.0 - sstep(0.8, 1.8, abs(x - xc)))
    do_ = math.hypot(x + 6.0, z - 3.0)
    h -= 0.55 * (1.0 - sstep(1.0, 2.2, do_))
    if 8.8 < x < 10.4 and -6.8 < z < -4.4:
        h = min(h, 0.30)
    edge = max(abs(x), abs(z))
    if edge > 11.0:
        h -= (edge - 11.0) * 1.5
    return h


# ---------------------------------------------------------------- fresh scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.meshes):
    if col.users == 0:
        bpy.data.meshes.remove(col)

world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
world.use_nodes = True
bg = world.node_tree.nodes.get("Background") or world.node_tree.nodes.new("ShaderNodeBackground")
bg.inputs[0].default_value = (0.55, 0.80, 1.0, 1.0)
bg.inputs[1].default_value = 1.0
bpy.context.scene.world = world
for name, energy, rot in [("W2_Sun", 3.0, (0.9, 0.0, 0.6)), ("W2_Fill", 0.7, (0.4, 0.0, -2.2))]:
    ld = bpy.data.lights.new(name=name, type='SUN')
    ld.energy = energy
    ob = bpy.data.objects.new(name=name, object_data=ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = rot


def make_cam(name, loc, look):
    cd = bpy.data.cameras.new(name=name)
    cd.lens = 35
    ob = bpy.data.objects.new(name=name, object_data=cd)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


make_cam("W2_Overview", (0, -20, 13), (0, 0, 0))
make_cam("W2_Closeup", (1.0, -3.0, 4.5), (0.5, 3.0, 0.0))
bpy.context.scene.camera = bpy.data.objects["W2_Overview"]
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 32


# ---------------------------------------------------------------- materials
def mat_simple(name, color, rough=0.9):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    return m


def load_img(path, colorspace):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = colorspace
    try:
        img.pack()
    except RuntimeError:
        pass
    return img


def build_ground(mat, c_img, n_img, r_img, uv_scale):
    nt = mat.node_tree
    for n in [n for n in nt.nodes if n.type not in ('OUTPUT_MATERIAL',)]:
        nt.nodes.remove(n)
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (uv_scale, uv_scale, 1.0)
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    texi = nt.nodes.new('ShaderNodeTexImage')
    texi.image = c_img
    nt.links.new(mp.outputs['Vector'], texi.inputs['Vector'])
    nt.links.new(texi.outputs['Color'], bsdf.inputs['Base Color'])
    if n_img:
        texim = nt.nodes.new('ShaderNodeTexImage')
        texim.image = n_img
        nt.links.new(mp.outputs['Vector'], texim.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = 0.6
        nt.links.new(texim.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if r_img:
        texr = nt.nodes.new('ShaderNodeTexImage')
        texr.image = r_img
        nt.links.new(mp.outputs['Vector'], texr.inputs['Vector'])
        nt.links.new(texr.outputs['Color'], bsdf.inputs['Roughness'])


def box_uv(mesh, scale=0.5):
    uv = mesh.uv_layers.get("UVMap") or mesh.uv_layers.new(name="UVMap")
    mesh.uv_layers.active = uv
    vs = mesh.vertices
    for p in mesh.polygons:
        nx, ny, nz = abs(p.normal.x), abs(p.normal.y), abs(p.normal.z)
        for li in p.loop_indices:
            co = vs[mesh.loops[li].vertex_index].co
            if nx >= ny and nx >= nz:
                u, v = co.y, co.z
            elif ny >= nx and ny >= nz:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            uv.data[li].uv = (u * scale, v * scale)


m_top = mat_simple("W2_SandTop", (0.85, 0.70, 0.48))
m_topside = mat_simple("W2_SandRock", (0.62, 0.45, 0.30))
m_side = mat_simple("W2_DirtSide", (0.45, 0.32, 0.22))
m_road = mat_simple("W2_Road", (0.78, 0.64, 0.45))
m_case = mat_simple("W2_RoadEdge", (0.50, 0.38, 0.24))
m_wadi = mat_simple("W2_WadiBed", (0.70, 0.55, 0.36))
m_water = mat_simple("W2_Water", (0.25, 0.62, 0.90), 0.35)
m_water.blend_method = 'BLEND'
m_water.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.85
m_wood = mat_simple("W2_Wood", (0.55, 0.36, 0.20))
m_adobe = mat_simple("W2_Adobe", (0.82, 0.66, 0.47))
m_stone = mat_simple("W2_Stone", (0.62, 0.58, 0.52))
m_blue = mat_simple("W2_GateBlue", (0.20, 0.40, 0.95))
m_yellow = mat_simple("W2_FlagYellow", (0.95, 0.75, 0.20), 0.6)

AMB = PROJ + "\\artifacts\\ambientcg\\Ground093C\\"
POLY = PROJ + "\\artifacts\\polyhaven\\brown_planks_03\\"
sand_c = load_img(AMB + "Ground093C_1K-JPG_Color.jpg", 'sRGB')
sand_n = load_img(AMB + "Ground093C_1K-JPG_NormalGL.jpg", 'Non-Color')
sand_r = load_img(AMB + "Ground093C_1K-JPG_Roughness.jpg", 'Non-Color')
wood_c = load_img(POLY + "brown_planks_03_diff_1k.jpg", 'sRGB')
wood_r = load_img(POLY + "brown_planks_03_rough_1k.jpg", 'Non-Color')
build_ground(m_top, sand_c, sand_n, sand_r, 6.0)
build_ground(m_topside, sand_c, sand_n, sand_r, 2.0)
build_ground(m_wood, wood_c, None, wood_r, 1.5)
for img in (sand_c, sand_n, sand_r, wood_c, wood_r):
    if max(img.size[0], img.size[1]) > 512:
        img.scale(512, 512)
print("OK materials+textures")


# ---------------------------------------------------------------- terrain
N, SIZE = 49, 24.0
mesh = bpy.data.meshes.new("W2_Terrain")
bm = bmesh.new()
verts = {}
for iz in range(N):
    for ix in range(N):
        x = -SIZE / 2 + SIZE * ix / (N - 1)
        yn = -SIZE / 2 + SIZE * iz / (N - 1)
        verts[(ix, iz)] = bm.verts.new((x, yn, H(x, yn)))
bm.verts.ensure_lookup_table()
for iz in range(N - 1):
    for ix in range(N - 1):
        bm.faces.new((verts[(ix, iz)], verts[(ix + 1, iz)], verts[(ix + 1, iz + 1)], verts[(ix, iz + 1)]))
bnd = []
for ix in range(N):
    bnd.append(verts[(ix, 0)])
for iz in range(1, N):
    bnd.append(verts[(N - 1, iz)])
for ix in range(N - 2, -1, -1):
    bnd.append(verts[(ix, N - 1)])
for iz in range(N - 2, 0, -1):
    bnd.append(verts[(0, iz)])
down = [bm.verts.new((v.co.x, v.co.y, -1.4)) for v in bnd]
for i in range(len(bnd)):
    j = (i + 1) % len(bnd)
    bm.faces.new((bnd[i], bnd[j], down[j], down[i]))
bm.to_mesh(mesh)
bm.free()
mesh.update()
mesh.materials.append(m_top)
mesh.materials.append(m_side)
vs = mesh.vertices
for p in mesh.polygons:
    coords = [vs[i].co for i in p.vertices]
    if any(c.z < -1.3 for c in coords):
        p.material_index = 1
        continue
    n = Vector((0, 0, 0))
    for i in range(len(coords)):
        a, b = coords[i], coords[(i + 1) % len(coords)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    p.material_index = 0 if (n.length and abs(n.normalized().z) >= 0.5) else 1
uv = mesh.uv_layers.new(name="UVMap")
mesh.uv_layers.active = uv
for p in mesh.polygons:
    for li in p.loop_indices:
        co = vs[mesh.loops[li].vertex_index].co
        uv.data[li].uv = (co.x * 0.12, co.y * 0.12) if p.material_index == 0 else ((co.x + co.y) * 0.12, co.z * 0.35)
ob = bpy.data.objects.new("W2_Terrain", mesh)
bpy.context.scene.collection.objects.link(ob)
ntop = sum(1 for p in mesh.polygons if p.material_index == 0)
print("OK terrain top=%d total=%d" % (ntop, len(mesh.polygons)))
assert ntop > 1500, "terrain top faces too few"


# ---------------------------------------------------------------- ribbons
def chaikin(pts, iters=3):
    for _ in range(iters):
        out = [pts[0]]
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            out += [a * 0.75 + b * 0.25, a * 0.25 + b * 0.75]
        out.append(pts[-1])
        pts = out
    return pts


def ribbon(name, waypoints, width, lift, material):
    pts = chaikin([Vector((x, z)) for x, z in waypoints])
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    lp = rp = None
    for i, p in enumerate(pts):
        nxt = pts[min(i + 1, len(pts) - 1)]
        prv = pts[max(i - 1, 0)]
        d = Vector((nxt.x - prv.x, nxt.y - prv.y))
        if d.length < 1e-6:
            d = Vector((1, 0))
        d.normalize()
        nx, ny = -d.y, d.x
        hl = H(p.x + nx * width / 2, p.y + ny * width / 2) + lift
        hr = H(p.x - nx * width / 2, p.y - ny * width / 2) + lift
        hm = (hl + hr) / 2
        if abs(hl - hr) > 0.35:
            s = 1 if hl > hr else -1
            hl, hr = hm + 0.175 * s, hm - 0.175 * s
        vl = bm.verts.new((p.x + nx * width / 2, p.y + ny * width / 2, hl))
        vr = bm.verts.new((p.x - nx * width / 2, p.y - ny * width / 2, hr))
        if lp is not None:
            bm.faces.new((lp, rp, vr, vl))
        lp, rp = vl, vr
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    uv2 = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            uv2.data[li].uv = (co.x * 0.5, co.y * 0.5)
    mesh.materials.append(material)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)


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
    ribbon("W2_RoadCase_%d" % i, g, 1.9, 0.03, m_case)
    ribbon("W2_Road_%d" % i, g, 1.5, 0.06, m_road)
# dry wadi bed (no water surface; oasis pond has the water)
ribbon("W2_Wadi", [(-0.5 + 0.7 * math.sin(z * 0.45), z) for z in [x * 0.5 for x in range(-4, 23)]], 1.8, 0.02, m_wadi)
# oasis pond disc
mesh = bpy.data.meshes.new("W2_Oasis")
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, radius=1.6, segments=20)
for v in bm.verts:
    v.co = (v.co.x - 6.0, v.co.y + 3.0, -0.15)
bm.to_mesh(mesh)
bm.free()
mesh.update()
mesh.materials.append(m_water)
ob = bpy.data.objects.new("W2_Oasis", mesh)
bpy.context.scene.collection.objects.link(ob)
print("OK roads+wadi+oasis")


# ---------------------------------------------------------------- Kenney imports
GLB = PROJ + "\\artifacts\\kenney\\nature-kit\\Models\\GLTF format\\"
imported = []


def import_glb(fname, name, loc, rot_z=0.0, scale=1.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=GLB + fname)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for o in new:
        o.parent = root
    root.location = (loc[0], loc[1], H(loc[0], loc[1]) + (loc[2] if len(loc) > 2 else 0.0))
    root.rotation_euler = (0, 0, rot_z)
    root.scale = (scale, scale, scale)
    imported.extend(o.name for o in new)
    return root


rnd = random.Random(7)
import_glb("cactus_tall.glb", "K_CactusT1", (-7.5, 4.5), 0.4)
import_glb("cactus_tall.glb", "K_CactusT2", (8.5, 0.5), 2.1, 1.1)
import_glb("cactus_short.glb", "K_CactusS1", (-4.0, 8.8), 1.2)
import_glb("cactus_short.glb", "K_CactusS2", (2.0, -8.5), 2.9, 0.9)
import_glb("cactus_short.glb", "K_CactusS3", (-8.5, -3.0), 0.2, 1.15)
import_glb("rock_largeB.glb", "K_RockBig", (11.5, -2.0), 0.5)
import_glb("rock_smallB.glb", "K_RockS1", (-2.5, -4.0), 1.2)
import_glb("rock_smallB.glb", "K_RockS2", (7.0, -8.0), 2.6, 0.8)
import_glb("rock_tallB.glb", "K_RockTall", (-11.0, -6.5), 0.0, 1.1)
import_glb("stone_largeA.glb", "K_StoneBig", (9.5, -9.0), 0.8)
import_glb("stone_smallA.glb", "K_StoneS1", (6.0, -9.8), 0.3)
import_glb("bridge_stone.glb", "K_Bridge", (0.25, 3.7, 0.0))
import_glb("fence_simple.glb", "K_Fence1", (3.2, -7.8), 0.3)
import_glb("fence_simple.glb", "K_Fence2", (6.8, -7.9), -0.3)
import_glb("fence_gate.glb", "K_GateStart", (-9, 8.6), 1.5708)
import_glb("fence_gate.glb", "K_GateExit", (-4, -10.9), 0.0)
import_glb("sign.glb", "K_Sign", (3.6, 0.6), 0.9)
import_glb("cliff_cave_stone.glb", "K_Cave", (8.0, -10.8, 0.1), 3.1416)
import_glb("cliff_steps_stone.glb", "K_Steps", (4.9, -2.8, 0.0), 2.6, 0.9)
import_glb("flower_yellowB.glb", "K_Fly0", (-5.0, 6.0), 0.5)
import_glb("flower_yellowB.glb", "K_Fly1", (1.0, -6.0), 2.0, 1.1)
import_glb("plant_bushSmall.glb", "K_Bsh0", (-7.0, 1.5), 0.7)
import_glb("plant_bushSmall.glb", "K_Bsh1", (9.0, 2.5), 1.9, 1.2)
import_glb("plant_bushSmall.glb", "K_Bsh2", (0.5, -9.0), 0.2, 0.9)
import_glb("ground_riverRocks.glb", "K_WadiRocks", (-0.5, 6.5), 0.0, 1.0)
import_glb("path_stoneCircle.glb", "K_Plaza1", (8.0, -9.5), 0.0, 1.2)
import_glb("path_stoneCircle.glb", "K_Plaza2", (6.5, -9.0), 0.0, 0.9)
import_glb("campfire_stones.glb", "K_Camp", (10.8, -6.8), 0.0, 1.0)

# bridge fit: span n3a(-1.8,4.2)->n3b(2.3,3.2)
br = bpy.data.objects.get("K_Bridge")
ax, az, bx, bz = -1.8, 4.2, 2.3, 3.2
span = math.hypot(bx - ax, bz - az)
mx, mz = (ax + bx) / 2, (az + bz) / 2
ws = []
for o in br.children_recursive:
    if o.type == 'MESH':
        ws += [o.matrix_world @ v.co for v in o.data.vertices]
xs = [v.x for v in ws]
ys = [v.y for v in ws]
cur = max(max(xs) - min(xs), max(ys) - min(ys))
assert 0.5 < cur < 8.0, "bridge measure out of range: %s" % cur
s = span / cur
assert s < 6.0, "bridge scale too large: %s" % s
br.scale = (s, s, s)
theta = math.atan2(bz - az, bx - ax)
br.rotation_euler = (0, 0, theta - math.pi / 2 if br.dimensions.y > br.dimensions.x else theta)
br.location = (mx, mz, max(H(ax, az), H(bx, bz)) + 0.12)
print("OK kenney imports=%d bridge_span=%.2f" % (len(imported), span))
assert 3.0 < span < 6.0, "bridge span unexpected"


# ---------------------------------------------------------------- original structures
def solid_box(name, center_xyz, size_xyz, material):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size_xyz
    cx, cy, cz = center_xyz
    for v in bm.verts:
        v.co = Vector((cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(material)
    box_uv(mesh)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box_uv(mesh, scale=0.5):
    uv = mesh.uv_layers.get("UVMap") or mesh.uv_layers.new(name="UVMap")
    mesh.uv_layers.active = uv
    vs = mesh.vertices
    for p in mesh.polygons:
        nx, ny, nz = abs(p.normal.x), abs(p.normal.y), abs(p.normal.z)
        for li in p.loop_indices:
            co = vs[mesh.loops[li].vertex_index].co
            if nx >= ny and nx >= nz:
                u, v = co.y, co.z
            elif ny >= nx and ny >= nz:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            uv.data[li].uv = (u * scale, v * scale)


# ladder n5c(6.8,-0.2) -> n5d(6.2,-3.0)
Ax, Ay, Az = 6.8, -0.2, H(6.8, -0.2)
Bx, By, Bz = 6.2, -3.0, H(6.2, -3.0)
rise = Bz - Az
print("ladder rise=%.2f" % rise)
assert rise > 1.5, "ladder too flat"
A = Vector((Ax, Ay, Az))
B = Vector((Bx, By, Bz))
d = (B - A)
L = d.length
d.normalize()
for k, side in enumerate((-0.28, 0.28)):
    mesh = bpy.data.meshes.new("W2_LadderRail")
    bm = bmesh.new()
    v0 = bm.verts.new((0, 0, 0))
    v1 = bm.verts.new((0.09, 0, 0))
    v2 = bm.verts.new((0.09, 0, L))
    v3 = bm.verts.new((0, 0, L))
    bm.faces.new((v0, v1, v2, v3))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(m_wood)
    box_uv(mesh)
    ob = bpy.data.objects.new("W2_LadderRail", mesh)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector((Ax + side, Ay, Az))
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
for i in range(1, 6):
    t = i / 6.0
    p = A.lerp(B, t)
    solid_box("W2_LadderRung%d" % i, (p.x, p.y, p.z), (0.62, 0.09, 0.09), m_wood)

# adobe hut at n6 (5.0,-6.8)
hx, hz = 5.0, -6.8
hb = H(hx, hz)
solid_box("W2_HutBase", (hx, hz, hb + 1.0), (2.6, 2.2, 2.0), m_adobe)
solid_box("W2_HutRoof", (hx, hz, hb + 2.15), (3.0, 2.6, 0.3), m_wood)
for bxoff in (-1.0, -0.33, 0.33, 1.0):
    solid_box("W2_Beam%d" % int(bxoff * 100), (hx + bxoff, hz + 1.15, hb + 2.0), (0.16, 0.5, 0.16), m_wood)
solid_box("W2_HutDoor", (hx, hz + 1.12, hb + 0.7), (0.8, 0.1, 1.4), m_wood)
# flag at knoll n8 (10.8,-5.6)
fx, fz = 10.8, -5.6
fh = H(fx, fz)
solid_box("W2_FlagPole", (fx, fz, fh + 1.3), (0.12, 0.12, 2.6), m_wood)
mesh = bpy.data.meshes.new("W2_Flag")
bm = bmesh.new()
top = fh + 2.6
vv = [bm.verts.new(p) for p in [(fx, fz, top), (fx + 1.1, fz, top - 0.35), (fx, fz, top - 0.7)]]
bm.faces.new(vv)
bm.to_mesh(mesh)
bm.free()
mesh.update()
mesh.materials.append(m_yellow)
box_uv(mesh)
ob = bpy.data.objects.new("W2_Flag", mesh)
bpy.context.scene.collection.objects.link(ob)
# ruins at n9 (8.0,-9.5): 2 standing + 1 fallen pillars + lintel
rx, rz = 8.0, -9.5
rh = H(rx, rz)
solid_box("W2_RuinP0", (rx - 1.1, rz, rh + 1.4), (0.5, 0.5, 2.8), m_stone)
solid_box("W2_RuinP1", (rx + 1.1, rz, rh + 1.4), (0.5, 0.5, 2.8), m_stone)
fall = solid_box("W2_RuinFallen", (rx + 2.6, rz + 0.4, rh + 0.25), (2.2, 0.5, 0.5), m_stone)
fall.rotation_euler = (0, 0, 0.35)
solid_box("W2_RuinTop", (rx, rz, rh + 3.0), (2.9, 0.6, 0.4), m_stone)
# start/exit arches
for name, gx, gz in [("W2_ArchStart", -9, 8.6), ("W2_ArchExit", -4, -10.9)]:
    gh = H(gx, gz)
    solid_box(name + "_P0", (gx - 0.9, gz, gh + 1.3), (0.28, 0.28, 2.6), m_blue)
    solid_box(name + "_P1", (gx + 0.9, gz, gh + 1.3), (0.28, 0.28, 2.6), m_blue)
    solid_box(name + "_Top", (gx, gz, gh + 2.75), (2.4, 0.3, 0.35), m_wood)

# deck crown measurement for game arc
deps = bpy.context.evaluated_depsgraph_get()
origin = Vector((mx, mz, 5.0))
hit, loc, normal, idx, obj, mat4 = bpy.context.scene.ray_cast(deps, origin, Vector((0, 0, -1)))
deck_y = round(float(loc.z), 3) if hit else None
print("deck_y=%s banks=%.2f,%.2f" % (deck_y, H(ax, az), H(bx, bz)))
arc_h = round(deck_y - (H(ax, az) + H(bx, bz)) / 2, 3) if hit else 0.65
arc_h = max(0.3, min(1.2, arc_h))

# dedupe Kenney duplicate materials
merged = 0
for m in list(bpy.data.materials):
    import re
    mo = re.match(r'^(.+)\.(\d{3})$', m.name)
    if not mo:
        continue
    base = bpy.data.materials.get(mo.group(1))
    if base is None or base == m:
        continue
    for ob2 in bpy.data.objects:
        if ob2.type != 'MESH' or not ob2.data or not hasattr(ob2.data, 'materials'):
            continue
        for i, s in enumerate(ob2.data.materials):
            if s == m:
                ob2.data.materials[i] = base
                merged += 1
    if m.users == 0:
        bpy.data.materials.remove(m)
print("OK structures merged=%d objects=%d" % (merged, len(bpy.data.objects)))

# ---------------------------------------------------------------- graph + export + verify
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
    "n6": {"kind": "stage", "stageId": "desert-stage-1", "x": 5.0, "z": -6.8},
    "n7": {"kind": "jump_from", "x": 7.8, "z": -5.8},
    "n8": {"kind": "stage", "stageId": "desert-stage-2", "x": 10.8, "z": -5.6},
    "n9": {"kind": "stage", "stageId": "desert-stage-3", "x": 8.0, "z": -9.5},
    "n10": {"x": 3.5, "z": -10.5},
    "n11": {"kind": "gate", "x": -4, "z": -10},
}
for k, v in NODES.items():
    v["y"] = round(H(v["x"], v["z"]) + 0.08, 3)
    assert abs(v["y"]) < 10 and v["y"] == v["y"], "bad height %s" % k
PATHS = [
    ("p0", "n0", "n1", "walk", 2.2, {}), ("p1", "n1", "n2", "walk", 2.2, {}),
    ("p2", "n2", "n3a", "walk", 2.2, {}), ("p3", "n3a", "n3b", "bridge", 2.0, {"arcHeight": arc_h}),
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
graph = {"nodes": [{"id": k, **v} for k, v in NODES.items()],
         "paths": [{"id": a, "from": b, "to": c, "kind": d, "speed": e, **f} for a, b, c, d, e, f in PATHS]}
gpath = os.path.join(PROJ, "artifacts", "3d", "world2_graph.json")
json.dump(graph, open(gpath, "w"), indent=1)

bpath = os.path.join(PROJ, "artifacts", "3d", "source_blender", "world2_desert_source.blend")
bpy.ops.wm.save_as_mainfile(filepath=bpath)
out = os.path.join(PROJ, "artifacts", "3d", "models", "world2_desert.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='EXPORT',
                           export_cameras=False, export_lights=False, export_yup=True)
with open(out, 'rb') as f:
    f.read(12)
    clen, ctype = struct.unpack('<II', f.read(8))
    js = json.loads(f.read(clen).decode('utf-8'))
imgs = [i.get('name') for i in js.get('images', [])]
print("GLB bytes=%d meshes=%d materials=%d images=%s" % (
    os.path.getsize(out), len(js.get('meshes', [])), len(js.get('materials', [])), imgs))
assert os.path.getsize(out) > 500000, "glb suspiciously small"
assert len(js.get('meshes', [])) >= 60, "too few meshes"
assert any('Ground093C' in (n or '') for n in imgs), "sand texture missing in GLB"
assert any('brown_planks' in (n or '') for n in imgs), "planks texture missing in GLB"
print("BUILD_W2_OK")
