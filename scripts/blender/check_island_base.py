"""Check for island base terrain outputs (Task 1 of island-base plan).

Run: python scripts/blender/check_island_base.py  (stdlib only)
Expected BEFORE build: FAIL (outputs missing).
Expected AFTER build:  all PASS.

Asserts:
- public/rpg/island_base.glb exists and is <= 5MB
  (over 3MB prints a warning only, per brief)
- artifacts/3d/source_blender/island_base_source.blend exists
- artifacts/3d/preview/island-base-iso.png exists
- (Task 2) public/rpg/island_base_graph.json: every stop y == H+0.05
  within +/-0.02, start s0 == ROAD top, end s1 == ROAD pond end,
  all stops linked via paths.
"""
import json
import os
import sys

PROJ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GLB_PATH = os.path.join(PROJ, "public", "rpg", "island_base.glb")
BLEND_PATH = os.path.join(PROJ, "artifacts", "3d", "source_blender", "island_base_source.blend")
PREVIEW_PATH = os.path.join(PROJ, "artifacts", "3d", "preview", "island-base-iso.png")
GRAPH_PATH = os.path.join(PROJ, "public", "rpg", "island_base_graph.json")

sys.path.insert(0, os.path.join(PROJ, "scripts", "blender"))
from build_island_base import H, ROAD, POND, FALLS_A, FALLS_B, falls_dist, seg_dist

MAX_BYTES = 5 * 1024 * 1024
WARN_BYTES = 3 * 1024 * 1024


def test_glb_exists_and_light():
    """Assert the GLB exists and is light enough for smartphones."""
    assert os.path.isfile(GLB_PATH), "missing GLB: %s" % GLB_PATH
    size = os.path.getsize(GLB_PATH)
    assert size > 0, "GLB is empty: %s" % GLB_PATH
    if size > WARN_BYTES:
        print("WARNING: GLB over 3MB target: %d bytes (%.2fMB)" % (size, size / 1024 / 1024))
    assert size <= MAX_BYTES, "GLB exceeds 5MB: %d bytes (%.2fMB)" % (size, size / 1024 / 1024)
    return {"path": GLB_PATH, "bytes": size}


def test_source_blend_exists():
    assert os.path.isfile(BLEND_PATH), "missing source blend: %s" % BLEND_PATH
    return {"path": BLEND_PATH, "bytes": os.path.getsize(BLEND_PATH)}


def test_preview_exists():
    assert os.path.isfile(PREVIEW_PATH), "missing preview: %s" % PREVIEW_PATH
    return {"path": PREVIEW_PATH, "bytes": os.path.getsize(PREVIEW_PATH)}


def _load_graph():
    assert os.path.isfile(GRAPH_PATH), "missing graph JSON: %s" % GRAPH_PATH
    with open(GRAPH_PATH) as f:
        graph = json.load(f)
    stops = graph.get("stops", graph.get("nodes"))
    assert isinstance(stops, list) and len(stops) >= 2, "graph needs >=2 stops/nodes"
    assert isinstance(graph.get("paths"), list) and len(graph["paths"]) >= 1, "graph needs >=1 path"
    return graph, stops


def test_road_follows_terrain():
    """Every road stop y must equal H(x, z) + 0.05 within +/-0.02."""
    _, stops = _load_graph()
    for s in stops:
        expect = H(s["x"], s["z"]) + 0.05
        assert abs(s["y"] - expect) <= 0.02, \
            "stop %s off terrain: y=%.3f H+0.05=%.3f" % (s.get("id"), s["y"], expect)
    return {"path": GRAPH_PATH, "bytes": os.path.getsize(GRAPH_PATH)}


def test_road_connected():
    """Start stop s0 == ROAD top, end stop s1 == ROAD pond end, all stops linked."""
    graph, stops = _load_graph()
    assert stops[0]["id"] == "s0", "first stop must be s0, got %s" % stops[0].get("id")
    assert stops[-1]["id"] == "s1", "last stop must be s1, got %s" % stops[-1].get("id")
    for key, pt in (("start/top", ROAD[0]), ("end/pond", ROAD[-1])):
        s = stops[0] if key.startswith("start") else stops[-1]
        assert abs(s["x"] - pt[0]) < 1e-9 and abs(s["z"] - pt[1]) < 1e-9, \
            "%s stop xz (%s, %s) != ROAD %s (%s, %s)" % (key, s["x"], s["z"], key, pt[0], pt[1])
    adj = {}
    for p in graph["paths"]:
        adj.setdefault(p["from"], set()).add(p["to"])
        adj.setdefault(p["to"], set()).add(p["from"])
    seen, stack = set(["s0"]), ["s0"]
    while stack:
        cur = stack.pop()
        for nxt in adj.get(cur, ()):
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    missing = [s["id"] for s in stops if s["id"] not in seen]
    assert not missing, "stops not linked to s0: %s" % missing
    return {"path": GRAPH_PATH, "bytes": os.path.getsize(GRAPH_PATH)}


def _load_glb_json():
    import json as _json
    import struct as _struct
    assert os.path.isfile(GLB_PATH), "missing GLB: %s" % GLB_PATH
    with open(GLB_PATH, "rb") as f:
        f.read(12)
        clen, _ctype = _struct.unpack("<II", f.read(8))
        js = _json.loads(f.read(clen).decode("utf-8"))
    return js


def _tree_nodes():
    import math as _math
    js = _load_glb_json()
    prefixes = ("ISLB_TreeBroadleaf", "ISLB_TreeAutumn", "ISLB_TreeConifer", "ISLB_Bush")
    out = []
    for n in js.get("nodes", []):
        name = n.get("name", "")
        if not any(name.startswith(p) for p in prefixes):
            continue
        t = n.get("translation", [0, 0, 0])
        bx, bz_up, by = float(t[0]), float(t[1]), float(-t[2])
        out.append((name, bx, by, bz_up))
    return out


def test_tree_counts():
    js = _load_glb_json()
    names = [n.get("name", "") for n in js.get("nodes", [])]
    caps = {"ISLB_TreeBroadleaf": 14, "ISLB_TreeAutumn": 8,
            "ISLB_TreeConifer": 10, "ISLB_Bush": 24}
    for prefix, cap in caps.items():
        c = sum(1 for nm in names if nm.startswith(prefix))
        assert c > 0, "%s missing: 0 nodes" % prefix
        assert c <= cap, "%s too many: %d > %d" % (prefix, c, cap)
    return {"path": GLB_PATH, "bytes": os.path.getsize(GLB_PATH)}


def test_trees_grounded():
    import math as _math
    trees = _tree_nodes()
    assert trees, "no tree/bush nodes found"
    for name, bx, by, bz_up in trees:
        expect = H(bx, by)
        assert abs(bz_up - expect) <= 0.3, \
            "%s floats/buried: y=%.3f H=%.3f at (%.2f,%.2f)" % (name, bz_up, expect, bx, by)
    return {"path": GLB_PATH, "bytes": os.path.getsize(GLB_PATH)}


def test_trees_clear():
    import math as _math
    trees = _tree_nodes()
    assert trees, "no tree/bush nodes found"
    pcx, pcz, pr = POND[0], POND[1], POND[2]
    for name, bx, by, bz_up in trees:
        d_road = float("inf")
        for i in range(len(ROAD) - 1):
            d_road = min(d_road, seg_dist(bx, by, ROAD[i][0], ROAD[i][1],
                                          ROAD[i + 1][0], ROAD[i + 1][1]))
        d_falls = falls_dist(bx, by)
        d_pond = _math.hypot(bx - pcx, by - pcz) - pr
        d_min = min(d_road, d_falls, d_pond)
        assert d_min >= 1.5, \
            "%s too close: road=%.2f falls=%.2f pond_edge=%.2f" % (name, d_road, d_falls, d_pond)
    return {"path": GLB_PATH, "bytes": os.path.getsize(GLB_PATH)}


def test_no_images():
    js = _load_glb_json()
    imgs = js.get("images", [])
    assert imgs == [], "image textures forbidden: %s" % (imgs,)
    return {"path": GLB_PATH, "bytes": os.path.getsize(GLB_PATH)}


def test_water_blend_limited():
    """(Task 2) GLB materials with alphaMode==BLEND <=3 AND images still empty."""
    js = _load_glb_json()
    mats = js.get("materials", [])
    blends = [m.get("name", "") for m in mats if m.get("alphaMode") == "BLEND"]
    assert len(blends) <= 3, "too many BLEND materials: %d (%s)" % (len(blends), blends)
    imgs = js.get("images", [])
    assert imgs == [], "image textures forbidden: %s" % (imgs,)
    return {"path": GLB_PATH, "bytes": os.path.getsize(GLB_PATH)}


def main():
    tests = [
        ("test_glb_exists_and_light", test_glb_exists_and_light),
        ("test_source_blend_exists", test_source_blend_exists),
        ("test_preview_exists", test_preview_exists),
        ("test_road_follows_terrain", test_road_follows_terrain),
        ("test_road_connected", test_road_connected),
        ("test_tree_counts", test_tree_counts),
        ("test_trees_grounded", test_trees_grounded),
        ("test_trees_clear", test_trees_clear),
        ("test_no_images", test_no_images),
        ("test_water_blend_limited", test_water_blend_limited),
    ]
    failed = 0
    for name, fn in tests:
        try:
            info = fn()
            print("PASS %s (%s, %d bytes)" % (name, info["path"], info["bytes"]))
        except AssertionError as e:
            print("FAIL %s: %s" % (name, e))
            failed += 1
    print("CHECK_ISLAND_BASE_%s (%d/%d passed)" % ("OK" if failed == 0 else "FAILED", len(tests) - failed, len(tests)))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
