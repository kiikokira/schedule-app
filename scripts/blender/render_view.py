"""Background render helper. Usage:
blender --background <blend> --python render_view.py -- <out_png> <camera_name>
"""
import bpy
import sys

argv = sys.argv
try:
    idx = argv.index("--")
    out, cam = argv[idx + 1], argv[idx + 2]
except (ValueError, IndexError):
    print("USAGE: -- <out_png> <camera_name>")
    raise SystemExit(2)

bpy.context.scene.camera = bpy.data.objects[cam]
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.context.scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED:", out)
