"""Shared kit for W3-W9 world builds (extracted from proven W2 script).
Usage from a world script:
    import sys, os
    sys.path.insert(0, os.path.join(r"C:\\anki\\...", "scripts", "blender"))
    import wkit
    wkit.fresh_scene("W3", sky=(0.6, 0.8, 1.0))
    ...
Conventions (must hold for every world):
- axes: x=east, y=north, z=up. H(x, z) -> height.
- node ids n0..n11, path ids p0..p16, same kinds as W1/W2.
"""
import bpy
import bmesh
import math
import os
import json
import struct
import random
import re
from mathutils import Vector

PROJ = r"C:\anki\スケジュール管理アプリ"
GLB_DIR = PROJ + "\\artifacts\\kenney\\nature-kit\\Models\\GLTF format\\"


def sstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def fresh_scene(prefix, sky=(0.55, 0.80, 1.0)):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.meshes):
        if col.users == 0:
            bpy.data.meshes.remove(col)
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background") or world.node_tree.nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = (sky[0], sky[1], sky[2], 1.0)
    bg.inputs[1].default_value = 1.0
    bpy.context.scene.world = world
    for name, energy, rot in [(prefix + "_Sun", 3.0, (0.9, 0.0, 0.6)), (prefix + "_Fill", 0.7, (0.4, 0.0, -2.2))]:
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
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 32
    return ob


def mat_simple(name, color, rough=0.9, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    if emission is not None:
        try:
            bsdf.inputs["Emission Color"].default_value = (emission[0], emission[1], emission[2], 1.0)
            bsdf.inputs["Emission Strength"].default_value = 2.0
        except KeyError:
            pass
    return m


def load_img(path, colorspace):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = colorspace
    try:
        img.pack()
    except RuntimeError:
        pass
    return img


def shrink_packed(limit=512):
    done = []
    for img in bpy.data.images:
        if img.packed_file is not None and max(img.size[0], img.size[1]) > limit:
            img.scale(limit, limit)
            done.append(img.name)
    return done


def build_ground(mat, c_img, n_img, r_img, uv_scale, tint=None):
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
    color_out = texi.outputs['Color']
    if tint is not None:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1.0
        mix.inputs[6].default_value = (tint[0], tint[1], tint[2], 1.0)
        nt.links.new(texi.outputs['Color'], mix.inputs[7])
        color_out = mix.outputs[2]
    nt.links.new(color_out, bsdf.inputs['Base Color'])
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


def build_terrain(H, name, top_mat, side_mat, size=24.0, n=65):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = {}
    for iz in range(n):
        for ix in range(n):
            x = -size / 2 + size * ix / (n - 1)
            yn = -size / 2 + size * iz / (n - 1)
            verts[(ix, iz)] = bm.verts.new((x, yn, H(x, yn)))
    bm.verts.ensure_lookup_table()
    for iz in range(n - 1):
        for ix in range(n - 1):
            bm.faces.new((verts[(ix, iz)], verts[(ix + 1, iz)], verts[(ix + 1, iz + 1)], verts[(ix, iz + 1)]))
    bnd = []
    for ix in range(n):
        bnd.append(verts[(ix, 0)])
    for iz in range(1, n):
        bnd.append(verts[(n - 1, iz)])
    for ix in range(n - 2, -1, -1):
        bnd.append(verts[(ix, n - 1)])
    for iz in range(n - 2, 0, -1):
        bnd.append(verts[(0, iz)])
    down = [bm.verts.new((v.co.x, v.co.y, -1.4)) for v in bnd]
    for i in range(len(bnd)):
        j = (i + 1) % len(bnd)
        bm.faces.new((bnd[i], bnd[j], down[j], down[i]))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(top_mat)
    mesh.materials.append(side_mat)
    vs = mesh.vertices
    for p in mesh.polygons:
        coords = [vs[i].co for i in p.vertices]
        if any(c.z < -1.3 for c in coords):
            p.material_index = 1
            continue
        nv = Vector((0, 0, 0))
        for i in range(len(coords)):
            a, b = coords[i], coords[(i + 1) % len(coords)]
            nv.x += (a.y - b.y) * (a.z + b.z)
            nv.y += (a.z - b.z) * (a.x + b.x)
            nv.z += (a.x - b.x) * (a.y + b.y)
        p.material_index = 0 if (nv.length and abs(nv.normalized().z) >= 0.4) else 1
    uv = mesh.uv_layers.new(name="UVMap")
    mesh.uv_layers.active = uv
    for p in mesh.polygons:
        for li in p.loop_indices:
            co = vs[mesh.loops[li].vertex_index].co
            uv.data[li].uv = (co.x * 0.12, co.y * 0.12) if p.material_index == 0 else ((co.x + co.y) * 0.12, co.z * 0.35)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    try:
        for p in mesh.polygons:
            p.use_smooth = (p.material_index == 0)
    except AttributeError:
        pass
    ntop = sum(1 for p in mesh.polygons if p.material_index == 0)
    return ntop, len(mesh.polygons)


def build_island(cx, cz, top_y, r_top, r_bot, thick, name, top_mat, side_mat):
    """Flat-topped tapered floating island (closed solid)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    seg = 28
    top_ring = []
    bot_ring = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        top_ring.append(bm.verts.new((cx + r_top * math.cos(a), cz + r_top * math.sin(a), top_y)))
        bot_ring.append(bm.verts.new((cx + r_bot * math.cos(a), cz + r_bot * math.sin(a), top_y - thick)))
    bm.verts.ensure_lookup_table()
    top_face = bm.faces.new(top_ring)
    bot_face = bm.faces.new(list(reversed(bot_ring)))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((top_ring[i], top_ring[j], bot_ring[j], bot_ring[i]))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(top_mat)
    mesh.materials.append(side_mat)
    for p in mesh.polygons:
        p.material_index = 0 if abs(p.normal.z) > 0.5 and p.center.z > top_y - 0.01 else 1
    uv = mesh.uv_layers.new(name="UVMap")
    mesh.uv_layers.active = uv
    vs = mesh.vertices
    for p in mesh.polygons:
        for li in p.loop_indices:
            co = vs[mesh.loops[li].vertex_index].co
            uv.data[li].uv = (co.x * 0.12, co.y * 0.12) if p.material_index == 0 else ((co.x + co.y) * 0.12, co.z * 0.35)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def chaikin(pts, iters=4):
    for _ in range(iters):
        out = [pts[0]]
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            out += [a * 0.75 + b * 0.25, a * 0.25 + b * 0.75]
        out.append(pts[-1])
        pts = out
    return pts


def ribbon(H, name, waypoints, width, lift, material):
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
    return o


def import_glb(H, fname, name, loc, rot_z=0.0, scale=1.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=GLB_DIR + fname)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for o in new:
        o.parent = root
    base = loc[2] if len(loc) > 2 else 0.0
    root.location = (loc[0], loc[1], H(loc[0], loc[1]) + base)
    root.rotation_euler = (0, 0, rot_z)
    root.scale = (scale, scale, scale)
    return root


def scatter(H, items, road_pts, river_fn, seed, min_road=1.6, min_river=2.0):
    rnd = random.Random(seed)
    placed = 0
    for fname, prefix, n, smin, smax in items:
        c = 0
        tries = 0
        while c < n and tries < 80:
            tries += 1
            x = rnd.uniform(-11, 11.5)
            z = rnd.uniform(-10.5, 10.5)
            if any(math.hypot(x - px, z - pz) < min_road for px, pz in road_pts):
                continue
            if river_fn is not None and river_fn(x, z) < min_river:
                continue
            import_glb(H, fname, "%s%d" % (prefix, c), (x, z), rnd.uniform(0, 6.28), rnd.uniform(smin, smax))
            c += 1
            placed += 1
    return placed


def build_ladder(H, x0, z0, x1, z1, wood_mat, prefix):
    Ax, Ay, Az = x0, z0, H(x0, z0)
    Bx, By, Bz = x1, z1, H(x1, z1)
    rise = Bz - Az
    A = Vector((Ax, Ay, Az))
    B = Vector((Bx, By, Bz))
    d = (B - A)
    L = d.length
    d.normalize()
    for side in (-0.28, 0.28):
        mesh = bpy.data.meshes.new(prefix + "_Rail")
        bm = bmesh.new()
        v0 = bm.verts.new((0, 0, 0))
        v1 = bm.verts.new((0.09, 0, 0))
        v2 = bm.verts.new((0.09, 0, L))
        v3 = bm.verts.new((0, 0, L))
        bm.faces.new((v0, v1, v2, v3))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        mesh.materials.append(wood_mat)
        box_uv(mesh)
        ob = bpy.data.objects.new(prefix + "_Rail", mesh)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = Vector((Ax + side, Ay, Az))
        ob.rotation_mode = 'QUATERNION'
        ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    for i in range(1, 6):
        t = i / 6.0
        p = A.lerp(B, t)
        solid_box("%s_Rung%d" % (prefix, i), (p.x, p.y, p.z), (0.62, 0.09, 0.09), wood_mat)
    return rise


def build_flag(H, fx, fz, flag_mat, wood_mat, prefix):
    fh = H(fx, fz)
    solid_box(prefix + "_Pole", (fx, fz, fh + 1.3), (0.12, 0.12, 2.6), wood_mat)
    mesh = bpy.data.meshes.new(prefix + "_Cloth")
    bm = bmesh.new()
    top = fh + 2.6
    vv = [bm.verts.new(p) for p in [(fx, fz, top), (fx + 1.1, fz, top - 0.35), (fx, fz, top - 0.7)]]
    bm.faces.new(vv)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.materials.append(flag_mat)
    box_uv(mesh)
    ob = bpy.data.objects.new(prefix + "_Cloth", mesh)
    bpy.context.scene.collection.objects.link(ob)


def build_arch(H, name, gx, gz, pillar_mat, top_mat):
    gh = H(gx, gz)
    solid_box(name + "_P0", (gx - 0.9, gz, gh + 1.3), (0.28, 0.28, 2.6), pillar_mat)
    solid_box(name + "_P1", (gx + 0.9, gz, gh + 1.3), (0.28, 0.28, 2.6), pillar_mat)
    solid_box(name + "_Top", (gx, gz, gh + 2.75), (2.4, 0.3, 0.35), top_mat)


def fit_bridge(H, root_name, ax, az, bx, bz, ref_node_ids=""):
    br = bpy.data.objects.get(root_name)
    span = math.hypot(bx - ax, bz - az)
    assert br is not None, "bridge root missing: " + root_name
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
    br.location = ((ax + bx) / 2, (az + bz) / 2, max(H(ax, az), H(bx, bz)) + 0.12)
    assert 3.0 < span < 6.0, "bridge span unexpected"
    return span


def deck_arc(H, mx, mz, bank_a, bank_b):
    deps = bpy.context.evaluated_depsgraph_get()
    hit, loc, normal, idx, obj, mat4 = bpy.context.scene.ray_cast(deps, Vector((mx, mz, 5.0)), Vector((0, 0, -1)))
    arc = round(float(loc.z) - (bank_a + bank_b) / 2, 3) if hit else 0.65
    return max(0.3, min(1.2, arc))


def dedupe_materials():
    merged = 0
    for m in list(bpy.data.materials):
        mo = re.match(r'^(.+)\.(\d{3})$', m.name)
        if not mo:
            continue
        base = bpy.data.materials.get(mo.group(1))
        if base is None or base == m:
            continue
        for ob in bpy.data.objects:
            if ob.type != 'MESH' or not ob.data or not hasattr(ob.data, 'materials'):
                continue
            for i, s in enumerate(ob.data.materials):
                if s == m:
                    ob.data.materials[i] = base
                    merged += 1
        if m.users == 0:
            bpy.data.materials.remove(m)
    return merged


def write_graph(gpath, nodes, paths):
    """nodes: {id: {kind?, stageId?, x, z, y}} (yは呼出側でHから計算済み).
    paths: [(id, from, to, kind, speed, extra_dict)]. 参照を検証して保存。"""
    ids = set(nodes.keys())
    for a, b, c, d, e, f in paths:
        assert b in ids, "missing from node: " + b
        assert c in ids, "missing to node: " + c
        assert b != c, "self loop: " + a
    graph = {"nodes": [{"id": k, **v} for k, v in nodes.items()],
             "paths": [{"id": a, "from": b, "to": c, "kind": d, "speed": e, **f} for a, b, c, d, e, f in paths]}
    json.dump(graph, open(gpath, "w"), indent=1)
    return graph


def export_verify(out, required_imgs):
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='EXPORT',
                               export_cameras=False, export_lights=False, export_yup=True)
    with open(out, 'rb') as f:
        f.read(12)
        clen, ctype = struct.unpack('<II', f.read(8))
        js = json.loads(f.read(clen).decode('utf-8'))
    imgs = [i.get('name') or '' for i in js.get('images', [])]
    for req in required_imgs:
        assert any(req in n for n in imgs), "texture missing in GLB: " + req
    assert os.path.getsize(out) > 300000, "glb suspiciously small"
    assert len(js.get('meshes', [])) >= 40, "too few meshes"
    return {"bytes": os.path.getsize(out), "meshes": len(js.get('meshes', [])),
            "materials": len(js.get('materials', [])), "images": imgs}
