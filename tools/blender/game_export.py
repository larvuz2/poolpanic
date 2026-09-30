"""Make a GLB game-ready: shrink its textures (JPEG, at most --tex pixels a side), rename the animation clips, and
export again with the skin and the clips. Reports the triangle count and file size.
    tools/blender/run.sh tools/blender/game_export.py -- in.glb out.glb [--tex 1024] [--clip Walk] [--quality 85]
--clip names the first clip (a model with one animation, like a walk from Meshy)."""
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
if clip and bpy.data.actions:
    bpy.data.actions[0].name = clip
for action in bpy.data.actions:
    # A loop should not drift: hold the end values (Blender's default) and keep the clip's own range.
    action.use_fake_user = True
tris = sum(len(p.vertices) - 2 for m in common.meshes() for p in m.data.polygons)
print("TRIANGLES", tris)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_image_format="JPEG",
    export_jpeg_quality=quality,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
)
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
