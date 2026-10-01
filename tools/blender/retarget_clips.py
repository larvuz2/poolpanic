"""Put the clips of a template character (Coach Panic) on a character rigged with the same skeleton (rig_from_template.py):
    tools/blender/run.sh tools/blender/retarget_clips.py -- rigged.glb out.glb [--template dist/assets/coach-panic.glb]
        [--scale K] [--only Run,Walk] [--tex-quality 90]
Both skeletons have the same bone names, hierarchy and rest orientations, so a bone's rotation keys mean the same on
either: they are copied by name, unchanged. What does not carry over is distance: the hips' travel (their bob and sway,
any translation key) is multiplied by K, the ratio of the two hip heights unless --scale says otherwise, so a child
bobs less and a tall swimmer more. The template's bone offsets are not copied (the new bones keep their own). Each clip
keeps its name and length, and the character keeps its mesh, skin and bones. The result has the template's clips (or
--only) and no others: a clip already in rigged.glb is dropped (merge_clips.py adds clips of other files)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402

args = common.script_args()
here = os.path.dirname(os.path.abspath(__file__))
template_path = common.option(args, "--template", os.path.join(here, "..", "..", "dist", "assets", "coach-panic.glb"))
scale_option = common.option(args, "--scale", None, float)
only = common.option(args, "--only")
tex_quality = common.option(args, "--tex-quality", None, int)
src, dst = args[0], args[1]


def root_height(arm):
    """How high the root bone (the hips) stands, in metres."""
    roots = [b for b in arm.data.bones if b.parent is None]
    if len(roots) != 1:
        raise SystemExit(f"{arm.name} has {len(roots)} root bones, expected one")
    return roots[0].head_local.z * arm.matrix_world.to_scale().z


# ---- 1. the template's clips ---------------------------------------------------------------------------------------------
common.clean_scene()
common.import_model(template_path)
scene = bpy.context.scene
template = next(o for o in scene.objects if o.type == "ARMATURE")
template_bones = {b.name for b in template.data.bones}
template_height = root_height(template)
template_actions = set(bpy.data.actions)
clips = {a.name: a for a in template_actions}
if only:
    clips = {n: clips[n] for n in only.split(",") if n in clips}
    missing = [n for n in only.split(",") if n not in clips]
    if missing:
        raise SystemExit(f"The template has no clips {missing}; it has {sorted(a.name for a in template_actions)}")
if not clips:
    raise SystemExit("The template has no clips")
for action in template_actions:
    action.use_fake_user = True
for obj in list(scene.objects):
    bpy.data.objects.remove(obj)

# ---- 2. the character ----------------------------------------------------------------------------------------------------
common.import_model(src)
arm = next((o for o in scene.objects if o.type == "ARMATURE"), None)
if arm is None:
    raise SystemExit(f"{src} has no armature: rig it first (rig_from_template.py)")
bones = {b.name for b in arm.data.bones}
if bones != template_bones:
    raise SystemExit(f"The skeletons differ, so the clips do not fit: {sorted(bones ^ template_bones)}")
for action in set(bpy.data.actions) - template_actions:
    print("DROPPED", action.name, "(the template's clips replace it)")
    bpy.data.actions.remove(action)
k = scale_option if scale_option else root_height(arm) / template_height
print(f"HIPS {root_height(arm):.3f} m against the template's {template_height:.3f} m: travel scaled by {k:.3f}")

# ---- 3. the clips, copied under their own names, with the travel scaled ---------------------------------------------------
for name, action in clips.items():
    mine = action.copy()
    for fc in mine.fcurves:
        if fc.data_path.endswith(".location"):  # a bone's offset from its rest position, in the bone's own axes
            for key in fc.keyframe_points:
                key.co[1] *= k
                key.handle_left[1] *= k
                key.handle_right[1] *= k
            fc.update()
    mine.use_fake_user = True
    action.name = name + ".template"
    mine.name = name
    print(f"CLIP {name}: frames {mine.frame_range[0]:.0f}-{mine.frame_range[1]:.0f}, {len(mine.fcurves)} curves")
for action in template_actions:
    bpy.data.actions.remove(action)

options = {}
if tex_quality:
    options = {"export_image_format": "JPEG", "export_jpeg_quality": tex_quality}
common.export_clips(arm, dst, **options)
print(f"RETARGETED {dst}: {len(clips)} clips on {len(arm.data.bones)} bones, {os.path.getsize(dst)} bytes")
