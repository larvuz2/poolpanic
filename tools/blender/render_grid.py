"""Render many frames of many clips from several views in one Blender session (for contact sheets: Blender starts once).
    tools/blender/run.sh tools/blender/render_grid.py -- model.glb out_dir --clips MonkeyWalk,MonkeyRun [--frames 0,3,6,9]
        [--count 4] [--views side,front,top] [--size 360] [--target 0,0,0.3] [--distance 1.8] [--floor] [--water 0.25]
        [--engine eevee|workbench]
Writes out_dir/<clip>_<view>_f<frame>.png. --frames picks the frames of every clip; --count spreads that many over each clip
instead. Views: front (azimuth 0, the model faces +Z in glTF), side (90, its left side), back (180), three (-35, a three-quarter
view of its right), top (the game's camera: high, from the front-left, 55 degrees down). --floor adds a grey floor at 0 (to
see the feet on it); --water H adds a translucent blue sheet at height H metres (to see what shows above a waterline)."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import common  # noqa: E402

args = common.script_args()
clips = [c for c in common.option(args, "--clips", "").split(",") if c]
frames_opt = common.option(args, "--frames")
count = common.option(args, "--count", 4, int)
views = common.option(args, "--views", "side,front,top").split(",")
size = common.option(args, "--size", 360, int)
target = Vector([float(v) for v in common.option(args, "--target", "0,0,0.3").split(",")])
distance = common.option(args, "--distance", 1.8, float)
floor = common.flag(args, "--floor")
water = common.option(args, "--water", None, float)
engine = common.option(args, "--engine", "eevee")
path, out = args[0], args[1]
os.makedirs(out, exist_ok=True)

VIEWS = {"front": (0, 12), "side": (90, 12), "back": (180, 12), "three": (-35, 15), "top": (-35, 55)}

common.clean_scene()
common.import_model(path)
scene = bpy.context.scene
common.set_engine(scene, engine)
common.studio_lights(scene)
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
if floor:
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    plane = bpy.context.active_object
    mat = bpy.data.materials.new("floor")
    mat.diffuse_color = (0.55, 0.57, 0.6, 1)
    plane.data.materials.append(mat)
if water is not None:
    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, water))
    sheet = bpy.context.active_object
    mat = bpy.data.materials.new("water")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.25, 0.65, 0.75, 1)
    bsdf.inputs["Alpha"].default_value = 0.55
    mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else mat.blend_method
    sheet.data.materials.append(mat)

cam_data = bpy.data.cameras.new("grid")
cam_data.lens = 50
cam = bpy.data.objects.new("grid", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
marker = bpy.data.objects.new("look-at", None)
marker.location = target
scene.collection.objects.link(marker)
track = cam.constraints.new("TRACK_TO")
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"
track.target = marker

arms = [o for o in scene.objects if o.type == "ARMATURE"]
for clip in clips:
    if clip not in bpy.data.actions:
        print("MISSING", clip)
        continue
    action = bpy.data.actions[clip]
    lo, hi = (int(round(v)) for v in action.frame_range)
    for arm in arms:
        data = arm.animation_data_create()
        for nla in data.nla_tracks:
            nla.mute = True
        data.action = action
    if frames_opt:
        frames = [lo + int(f) for f in frames_opt.split(",")]
    else:
        n = hi - lo
        frames = [lo + round(i * n / count) for i in range(count)]
    for view in views:
        az, el = VIEWS[view]
        a, e = math.radians(az), math.radians(el)
        # glTF +Z (the model's front) is Blender -Y: azimuth 0 puts the camera there, 90 on the model's left (+X)
        cam.location = target + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * distance
        for f in frames:
            scene.frame_set(f)
            scene.render.filepath = os.path.join(out, f"{clip}_{view}_f{f - lo:02d}.png")
            bpy.ops.render.render(write_still=True)
    print("CLIP", clip, "frames", lo, hi)
