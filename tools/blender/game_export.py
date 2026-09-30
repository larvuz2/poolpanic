"""Make a GLB game-ready: shrink its textures (JPEG, at most --tex pixels a side) and export again with the skin and all
of the clips (each under its own name). Reports the triangle count and file size.
    tools/blender/run.sh tools/blender/game_export.py -- in.glb out.glb [--tex 1024] [--quality 85] [--clip Walk]
--clip names the clip of a model with a single animation, like a walk straight from Meshy (polish_walk.py names its own)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402

args = common.script_args()
tex = common.option(args, "--tex", 1024, int)
clip = common.option(args, "--clip")
quality = common.option(args, "--quality", 85, int)
src, dst = args[0], args[1]

common.clean_scene()
common.import_model(src)
for image in bpy.data.images:
    if image.size[0] > tex or image.size[1] > tex:
        scale = tex / max(image.size)
        image.scale(max(1, int(image.size[0] * scale)), max(1, int(image.size[1] * scale)))
    print("IMAGE", image.name, tuple(image.size))
if clip:
    if len(bpy.data.actions) == 1:
        bpy.data.actions[0].name = clip
    else:
        print("WARNING: --clip only names a file's single clip; this one has", len(bpy.data.actions))
tris = sum(len(p.vertices) - 2 for m in common.meshes() for p in m.data.polygons)
print("TRIANGLES", tris)
print("CLIPS", sorted(a.name for a in bpy.data.actions))
armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
options = {"export_image_format": "JPEG", "export_jpeg_quality": quality}
if armatures:
    common.export_clips(armatures[0], dst, **options)
else:
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=False, **options)
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
