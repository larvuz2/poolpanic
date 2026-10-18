"""Decimate a game-exported model to a triangle budget and export it again (JPEG textures).
    tools/blender/run.sh tools/blender/decimate.py -- in.glb out.glb 11000
Run it on an unrigged model (after game_export.py, before rig_from_template.py): the weights are made after."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402

args = common.script_args()
src, dst, tris = args[0], args[1], int(args[2])
common.clean_scene()
common.import_model(src)
for o in common.meshes():
    n = sum(len(p.vertices) - 2 for p in o.data.polygons)
    mod = o.modifiers.new("dec", "DECIMATE")
    mod.ratio = min(1.0, tris / n)
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="dec")
    print("TRIS", n, "->", sum(len(p.vertices) - 2 for p in o.data.polygons))
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=88)
