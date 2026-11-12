"""Island base terrain: 3-terrace stylized island + falls/pond + road bed.

Run: blender --background --python scripts/blender/build_island_base.py
Outputs: artifacts/3d/source_blender/island_base_source.blend,
         public/rpg/island_base.glb,
         artifacts/3d/preview/island-base-iso.png

Design (Task 1 of island-base plan):
- ellipse island (CX/CY/RX/RY) with wobbled coast + cliff falloff
- 3 terraces T1/T2/T3 as (height, radius_m) steps blended with sstep
- 2 waterfall channels (FALLS_A north outlet, FALLS_B southeast outlet)
  + 1 pond hollow (POND) carved out of H
- road bed: ROAD centerline (top -> pond), 2m wide ribbon, lift 0.06
- materials: flat colors ONLY (mat_simple, no image textures)
- H(x, z) and ROAD are module level (pure python, no bpy) so Task 2
  can `from build_island_base import H, ROAD` with no side effects.

Structure follows scripts/blender/build_world1_isle.py + wkit.py.
Axes: x=east, y=north, z=up. H(x, z) -> height.
"""
import math

# ---------------------------------------------------------------- constants
CX, CY = 0.0, 0.0          # island center (x=east, y=north)
RX, RY = 26.0, 28.0        # ellipse radii

T1 = (2.0, 18.0)           # (height, radius_m): lower terrace
T2 = (4.2, 11.5)           # mid terrace
T3 = (6.6, 5.5)            # top terrace
RISER = 1.5                # terrace riser half-width (sstep blend)

POND = (12.0, 10.0, 3.2, 1.6)   # (cx, cz, full-depth radius, depth)

FALLS_A = [(0.0, 5.0), (-2.0, 11.0), (-4.0, 17.0), (-6.0, 23.0),
           (-7.0, 27.5)]   # top terrace -> north coast outlet
FALLS_B = [(5.0, -4.0), (9.0, -9.0), (13.0, -14.0), (17.0, -19.0),
           (20.0, -24.0)]  # mid terrace -> southeast coast outlet
FALLS_DEPTH = 1.8
FALLS_FULL, FALLS_FADE = 0.7, 2.0

ROAD = [(0.0, 0.0), (3.0, 2.5), (6.0, 5.0), (9.0, 7.5),
        (12.0, 10.0)]      # top -> pond centerline (2m-wide bed)


# ---------------------------------------------------------------- pure height field (no bpy: safe for Task 2 import)
def sstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def seg_dist(px, pz, ax, az, bx, bz):
    vx, vz = bx - ax, bz - az
    L2 = vx * vx + vz * vz
    t = 0.0 if L2 < 1e-9 else max(0.0, min(1.0, ((px - ax) * vx + (pz - az) * vz) / L2))
    return math.hypot(px - (ax + t * vx), pz - (az + t * vz))


def falls_dist(x, z):
    d = float("inf")
    for line in (FALLS_A, FALLS_B):
        for i in range(len(line) - 1):
            d = min(d, seg_dist(x, z, line[i][0], line[i][1],
                                line[i + 1][0], line[i + 1][1]))
    return d


def coast_rn(x, z):
    dx, dz = (x - CX) / RX, (z - CY) / RY
    th = math.atan2(z - CY, x - CX)
    wob = 1.0 + 0.025 * math.sin(3 * th + 1.0) + 0.015 * math.sin(5 * th + 2.5)
    return (dx * dx + dz * dz) / (wob * wob)


def H_base(x, z):
    d = math.hypot(x - CX, z - CY)
    h = T1[0]
    h += (T2[0] - T1[0]) * (1.0 - sstep(T2[1] - RISER, T2[1] + RISER, d))
    h += (T3[0] - T2[0]) * (1.0 - sstep(T3[1] - RISER, T3[1] + RISER, d))
    h += 0.30 * math.sin(x * 0.35 + 1.0) * math.cos(z * 0.30)
    h += 0.15 * math.sin(x * 0.80 + z * 0.50)
    rn = coast_rn(x, z)
    if rn > 1.0:
        h -= (rn - 1.0) * 30.0
    return h


def H(x, z):
    h = H_base(x, z)
    h -= FALLS_DEPTH * (1.0 - sstep(FALLS_FULL, FALLS_FADE, falls_dist(x, z)))
    dp = math.hypot(x - POND[0], z - POND[1])
    h -= POND[3] * (1.0 - sstep(POND[2], POND[2] + 2.0, dp))
    return h


# ---------------------------------------------------------------- blender build (side effects only as __main__)
if __name__ == "__main__":
    import os
    import sys
    import json
    import struct

    PROJ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    sys.path.insert(0, os.path.join(PROJ, "scripts", "blender"))
    import wkit

    print("BLEND:", __import__("bpy").data.filepath)
    import bpy
    import bmesh
    from mathutils import Vector

    # ---------------------------------------------------------- scene setup
    wkit.fresh_scene("ISLB", sky=(0.55, 0.80, 1.0))
    bpy.context.scene.render.engine = 'CYCLES'
    cam_iso = wkit.make_cam("ISLB_Iso", (36, -40, 32), (0, 2, 1))
    bpy.context.scene.camera = cam_iso
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 360

    # ---------------------------------------------------------- materials (flat only)
    m_grass = wkit.mat_simple("ISLB_Grass", (0.42, 0.68, 0.30))
    m_cliff = wkit.mat_simple("ISLB_Cliff", (0.45, 0.36, 0.28))
    m_road = wkit.mat_simple("ISLB_Road", (0.66, 0.60, 0.50))
    m_rbed = wkit.mat_simple("ISLB_PondBed", (0.72, 0.62, 0.44))
    m_water = wkit.mat_simple("ISLB_Water", (0.25, 0.60, 0.90), 0.25)
    m_water.blend_method = 'BLEND'
    m_water.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.78
    m_falls = wkit.mat_simple("ISLB_Falls", (0.85, 0.94, 1.0), 0.3)
    m_foam = wkit.mat_simple("ISLB_Foam", (0.95, 0.97, 1.0), 0.9,
                             emission=(0.7, 0.8, 0.9))

    # ---------------------------------------------------------- terrain (3 terraces + carves)
    ntop, ntotal = wkit.build_terrain(H, "ISLB_Terrain", m_grass, m_cliff,
                                      size=64.0, n=81)
    print("OK terrain top=%d total=%d" % (ntop, ntotal))
    assert ntop > 2000, "terrain top faces too few"

    # ---------------------------------------------------------- road bed (top -> pond, 2m wide)
    wkit.ribbon(H, "ISLB_Road", ROAD, 2.0, 0.06, m_road)
    print("OK road")

    # road-vs-falls clearance (road samples must stay out of channels)
    road_samples = [(p.x, p.y) for p in
                    wkit.chaikin([Vector((x, z)) for x, z in ROAD], iters=4)]
    for i, (px, pz) in enumerate(road_samples):
        d = falls_dist(px, pz)
        assert d > 1.5, "road sample %d too close to falls: %.2f" % (i, d)
    print("OK road-falls clearance (%d samples)" % len(road_samples))

    # ---------------------------------------------------------- falls water strips
    def H_lift(x, z):
        return H(x, z) + 0.30

    wkit.ribbon(H_lift, "ISLB_FallsA", FALLS_A, 1.2, 0.0, m_falls)
    wkit.ribbon(H_lift, "ISLB_FallsB", FALLS_B, 1.2, 0.0, m_falls)
    print("OK falls strips")

    # ---------------------------------------------------------- pond bed + water
    pcx, pcz, pr, pdep = POND
    bottom = H(pcx, pcz)
    water_z = bottom + 0.7
    assert water_z < H_base(pcx + pr + 2.5, pcz), "pond water above rim"
    bed = bpy.data.meshes.new("ISLB_PondBed")
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=pr + 0.4, segments=24)
    for v in bm.verts:
        wx, wy = v.co.x + pcx, v.co.y + pcz
        v.co = (wx, wy, H(wx, wy) + 0.05)
    bm.to_mesh(bed)
    bm.free()
    bed.update()
    bed.materials.append(m_rbed)
    wkit.box_uv(bed)
    bpy.context.scene.collection.objects.link(bpy.data.objects.new("ISLB_PondBed", bed))
    wat = bpy.data.meshes.new("ISLB_PondWater")
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=pr, segments=24)
    for v in bm.verts:
        v.co = (v.co.x + pcx, v.co.y + pcz, water_z)
    bm.to_mesh(wat)
    bm.free()
    wat.update()
    wat.materials.append(m_water)
    bpy.context.scene.collection.objects.link(bpy.data.objects.new("ISLB_PondWater", wat))
    # foam where falls meet the sea + where road meets the pond shore
    for i, (fx, fz) in enumerate([FALLS_A[-1], FALLS_B[-1]]):
        wkit.solid_box("ISLB_Foam%d" % i, (fx, fz, -0.8), (2.0, 2.0, 0.35), m_foam)
    print("OK pond (bottom=%.2f water=%.2f)" % (bottom, water_z))

    # ---------------------------------------------------------- sea disc (stylized base)
    sea = bpy.data.meshes.new("ISLB_Sea")
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=60.0, segments=48)
    for v in bm.verts:
        v.co = (v.co.x + CX, v.co.y + CY, -1.0)
    bm.to_mesh(sea)
    bm.free()
    sea.update()
    sea.materials.append(m_water)
    bpy.context.scene.collection.objects.link(bpy.data.objects.new("ISLB_Sea", sea))
    print("OK sea")

    # ---------------------------------------------------------- vegetation (Task 1: low-poly trees + bushes)
    import random as _rnd
    m_trunk = wkit.mat_simple("ISLB_Trunk", (0.45, 0.32, 0.20))
    m_leaf = wkit.mat_simple("ISLB_Leaf", (0.38, 0.65, 0.30))
    m_autumn = wkit.mat_simple("ISLB_Autumn", (0.85, 0.42, 0.20))
    m_conifer = wkit.mat_simple("ISLB_Conifer", (0.25, 0.50, 0.28))
    m_bushA = wkit.mat_simple("ISLB_BushA", (0.38, 0.68, 0.32))
    m_bushB = wkit.mat_simple("ISLB_BushB", (0.30, 0.58, 0.28))

    def _blob_tree(base_name, trunk_r1, trunk_r2, trunk_h, canopy_r, canopy_z, leaf_mat):
        mesh = bpy.data.meshes.new(base_name)
        bm = bmesh.new()
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=7,
                                  radius1=trunk_r1, radius2=trunk_r2, depth=trunk_h)
        for v in g['verts']:
            v.co.z += trunk_h / 2.0
        n_trunk = len(bm.faces)
        g2 = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=canopy_r)
        for v in g2['verts']:
            v.co = Vector((v.co.x, v.co.y * 0.95, v.co.z * 0.9 + canopy_z))
        for i, f in enumerate(bm.faces):
            f.material_index = 0 if i < n_trunk else 1
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        mesh.materials.append(m_trunk)
        mesh.materials.append(leaf_mat)
        wkit.box_uv(mesh)
        return mesh

    def _conifer_tree(base_name):
        mesh = bpy.data.meshes.new(base_name)
        bm = bmesh.new()
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=7,
                                  radius1=0.16, radius2=0.12, depth=0.9)
        for v in g['verts']:
            v.co.z += 0.45
        n_trunk = len(bm.faces)
        tiers = [(1.05, 0.75, 0.9, 1.15), (0.75, 0.45, 0.8, 1.75), (0.45, 0.02, 0.7, 2.30)]
        for r1, r2, dep, zc in tiers:
            gt = bmesh.ops.create_cone(bm, cap_ends=True, segments=7,
                                       radius1=r1, radius2=r2, depth=dep)
            for v in gt['verts']:
                v.co.z += zc
        for i, f in enumerate(bm.faces):
            f.material_index = 0 if i < n_trunk else 1
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        mesh.materials.append(m_trunk)
        mesh.materials.append(m_conifer)
        wkit.box_uv(mesh)
        return mesh

    def _bush_mesh(base_name, mat, radius=0.65):
        mesh = bpy.data.meshes.new(base_name)
        bm = bmesh.new()
        g = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
        for v in g['verts']:
            v.co = Vector((v.co.x, v.co.y * 0.9, v.co.z * 0.6 + 0.35))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        mesh.materials.append(mat)
        wkit.box_uv(mesh)
        return mesh

    mesh_broad = _blob_tree("ISLB_Base_Broadleaf", 0.18, 0.13, 1.2, 1.05, 1.90, m_leaf)
    mesh_autumn = _blob_tree("ISLB_Base_Autumn", 0.17, 0.12, 1.1, 0.95, 1.75, m_autumn)
    mesh_conifer = _conifer_tree("ISLB_Base_Conifer")
    mesh_bushA = _bush_mesh("ISLB_Base_BushA", m_bushA, 0.65)
    mesh_bushB = _bush_mesh("ISLB_Base_BushB", m_bushB, 0.60)

    road_pts = [(p.x, p.y) for p in wkit.chaikin([Vector((x, z)) for x, z in ROAD], iters=4)]

    def water_dist(x, z):
        return min(falls_dist(x, z), math.hypot(x - POND[0], z - POND[1]) - POND[2])

    rng = _rnd.Random(11)
    placed_xz = []
    veg_items = [
        (mesh_broad, "ISLB_TreeBroadleaf_", 14, 0.9, 1.15, 0),
        (mesh_autumn, "ISLB_TreeAutumn_", 8, 0.9, 1.15, 0),
        (mesh_conifer, "ISLB_TreeConifer_", 10, 0.9, 1.2, 0),
        (mesh_bushA, "ISLB_Bush_", 12, 0.8, 1.2, 0),
        (mesh_bushB, "ISLB_Bush_", 12, 0.8, 1.2, 12),
    ]
    for base_mesh, prefix, want, smin, smax, start_idx in veg_items:
        c, tries = 0, 0
        while c < want and tries < 200:
            tries += 1
            x = rng.uniform(-11, 11.5)
            z = rng.uniform(-10.5, 10.5)
            if coast_rn(x, z) > 0.9:
                continue
            if any(math.hypot(x - px, z - pz) < 1.6 for px, pz in road_pts):
                continue
            if water_dist(x, z) < 2.0:
                continue
            if any(math.hypot(x - qx, z - qz) < 1.2 for qx, qz in placed_xz):
                continue
            s = rng.uniform(smin, smax)
            rot = rng.uniform(0, 6.28)
            ob = bpy.data.objects.new("%s%d" % (prefix, start_idx + c), base_mesh)
            ob.location = (x, z, H(x, z))
            ob.rotation_euler = (0, 0, rot)
            ob.scale = (s, s, s)
            bpy.context.scene.collection.objects.link(ob)
            placed_xz.append((x, z))
            c += 1
        print("OK veg %s: %d/%d (tries %d)" % (prefix, c, want, tries))
        assert c == want, "veg placement short: %s %d/%d" % (prefix, c, want)
    print("OK vegetation total=%d" % len(placed_xz))

    wkit.dedupe_materials()

    # ---------------------------------------------------------- save blend
    blend_path = os.path.join(PROJ, "artifacts", "3d", "source_blender",
                              "island_base_source.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("BLEND saved:", blend_path, os.path.getsize(blend_path))

    # ---------------------------------------------------------- export GLB (flat colors: 0 images)
    out = os.path.join(PROJ, "public", "rpg", "island_base.glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                              export_materials='EXPORT', export_cameras=False,
                              export_lights=False, export_yup=True)
    with open(out, 'rb') as f:
        f.read(12)
        clen, ctype = struct.unpack('<II', f.read(8))
        js = json.loads(f.read(clen).decode('utf-8'))
    nimg = len(js.get('images', []))
    nmesh = len(js.get('meshes', []))
    nbyte = os.path.getsize(out)
    print("GLB bytes=%d meshes=%d images=%d" % (nbyte, nmesh, nimg))
    assert nimg == 0, "image textures forbidden in island base"
    assert nmesh >= 5, "too few meshes"
    assert nbyte <= 5 * 1024 * 1024, "GLB exceeds 5MB"
    if nbyte > 3 * 1024 * 1024:
        print("WARNING: GLB over 3MB target")

    # ---------------------------------------------------------- iso preview
    preview_dir = os.path.join(PROJ, "artifacts", "3d", "preview")
    os.makedirs(preview_dir, exist_ok=True)
    preview_path = os.path.join(preview_dir, "island-base-iso.png")
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print("PREVIEW:", preview_path, os.path.getsize(preview_path))

    # ---------------------------------------------------------- walk graph (Task 2: ROAD centerline -> stops+paths)
    sx0, sz0 = ROAD[0]
    sx1, sz1 = ROAD[-1]
    stops = [
        {"id": "s0", "kind": "start", "label": "top",
         "x": sx0, "z": sz0, "y": round(H(sx0, sz0) + 0.05, 3)},
        {"id": "s1", "kind": "stop", "label": "pond",
         "x": sx1, "z": sz1, "y": round(H(sx1, sz1) + 0.05, 3)},
    ]
    gpath = os.path.join(PROJ, "public", "rpg", "island_base_graph.json")
    graph = {"stops": stops, "nodes": [dict(s) for s in stops],
             "paths": [{"id": "p0", "from": "s0", "to": "s1",
                        "kind": "walk", "speed": 2.2}]}
    with open(gpath, "w") as f:
        json.dump(graph, f, indent=1)
    print("OK graph (%s)" % gpath)
    print("BUILD_ISLAND_BASE_OK")
