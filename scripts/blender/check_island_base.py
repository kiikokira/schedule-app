"""Check for island base terrain outputs (Task 1 of island-base plan).

Run: python scripts/blender/check_island_base.py  (stdlib only)
Expected BEFORE build: FAIL (outputs missing).
Expected AFTER build:  all PASS.

Asserts:
- public/rpg/island_base.glb exists and is <= 5MB
  (over 3MB prints a warning only, per brief)
- artifacts/3d/source_blender/island_base_source.blend exists
- artifacts/3d/preview/island-base-iso.png exists
"""
import os
import sys

PROJ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GLB_PATH = os.path.join(PROJ, "public", "rpg", "island_base.glb")
BLEND_PATH = os.path.join(PROJ, "artifacts", "3d", "source_blender", "island_base_source.blend")
PREVIEW_PATH = os.path.join(PROJ, "artifacts", "3d", "preview", "island-base-iso.png")

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


def main():
    tests = [
        ("test_glb_exists_and_light", test_glb_exists_and_light),
        ("test_source_blend_exists", test_source_blend_exists),
        ("test_preview_exists", test_preview_exists),
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
