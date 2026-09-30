"""Turntable preview of a model: a PNG still and an MP4 you can watch on any device.
    tools/blender/run.sh tools/blender/turntable.py -- model.glb out_dir [--frames 48] [--size 480]
        [--engine eevee|workbench|cycles] [--animation NAME] [--still-frame N] [--no-mp4]
        [--static] [--angle DEGREES] [--loops N] [--samples N]
With --animation the named clip plays while the camera circles (the clip loops over the turn).
With --static the camera stays put (--angle 0 is the front, 90 the side) and the video is the clip alone, looping
--loops times (default 4), one frame per frame of the clip. A clip whose last key is a copy of its first (see
polish_walk.py) repeats without a jump."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402

args = common.script_args()
frames = common.option(args, "--frames", None, int)
size = common.option(args, "--size", 480, int)
engine = common.option(args, "--engine", "eevee")
clip = common.option(args, "--animation")
still_frame = common.option(args, "--still-frame", 1, int)
mp4 = not common.flag(args, "--no-mp4")
static = common.flag(args, "--static")
angle = common.option(args, "--angle", 0, float)
loops = common.option(args, "--loops", 4, int)
samples = common.option(args, "--samples", None, int)  # EEVEE's anti-aliasing samples per frame (default 16)
path, out = args[0], args[1]
os.makedirs(out, exist_ok=True)

common.clean_scene()
common.import_model(path)
scene = bpy.context.scene
first = 1
if static and clip and clip in bpy.data.actions:
    # Play the clip from its first frame, round and round, with the camera still.
    action = bpy.data.actions[clip]
    lo_f, hi_f = action.frame_range
    first = int(round(lo_f))
    curves = [fc for fc in action.fcurves if len(fc.keyframe_points) > 1]
    closed = all(abs(fc.evaluate(lo_f) - fc.evaluate(hi_f)) < 1e-3 for fc in curves)
    period = int(round(hi_f - lo_f)) + (0 if closed else 1)
    for fc in curves:
        fc.modifiers.new("CYCLES")
    frames = frames or period * loops
frames = frames or 48
ms = common.meshes()
if not ms:
    raise SystemExit("No meshes in " + path)
lo, hi = common.world_bounds(ms)
center = (lo + hi) / 2
radius = max((hi - lo).length / 2, 0.01)
common.set_engine(scene, engine)
if samples and hasattr(scene.eevee, "taa_render_samples"):
    scene.eevee.taa_render_samples = samples
common.studio_lights(scene)
scene.view_settings.view_transform = "Standard"  # the model's own colours, not AgX's washed-out look
cam, marker = common.add_camera(scene, center, radius * 2.7)
# The camera rides an empty at the model's centre; the empty makes one turn over the clip.
pivot = bpy.data.objects.new("pivot", None)
pivot.location = center
scene.collection.objects.link(pivot)
cam.parent = pivot
cam.matrix_parent_inverse = pivot.matrix_world.inverted()
scene.frame_start, scene.frame_end = first, first + frames - 1
pivot.rotation_euler = (0, 0, math.radians(angle))
if not static:
    pivot.keyframe_insert("rotation_euler", frame=first)
    pivot.rotation_euler = (0, 0, math.radians(360 * (frames - 1) / frames))
    pivot.keyframe_insert("rotation_euler", frame=first + frames - 1)
    for fc in pivot.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
if clip and clip in bpy.data.actions:
    for arm in [o for o in scene.objects if o.type == "ARMATURE"]:
        arm.animation_data_create().action = bpy.data.actions[clip]
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.resolution_percentage = 100

scene.frame_set(still_frame if not static or still_frame != 1 else first)
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(out, "still.png")
bpy.ops.render.render(write_still=True)
print("STILL", scene.render.filepath)
if mp4:
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.fps = 24
    scene.render.filepath = os.path.join(out, "turntable.mp4")
    bpy.ops.render.render(animation=True)
    print("VIDEO", scene.render.filepath)
