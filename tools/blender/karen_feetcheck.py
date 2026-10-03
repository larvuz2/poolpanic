"""Are Karen's soles on the floor? For every frame of every clip, finds the lower of her two feet (the planted one) and
measures how far its toe end sits above its heel end, as an angle; flat is 0. A tap or a swinging foot may leave the
floor, so the planted foot is the one that counts. Also renders a side view of Idle and a few Walk frames.
    tools/blender/run.sh tools/blender/karen_feetcheck.py -- karen.glb [out_dir]"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

args = common.script_args()
out = args[1] if len(args) > 1 else None
common.clean_scene()
common.import_model(args[0])
scene = bpy.context.scene
mesh = common.meshes()[0]
arm = [o for o in scene.objects if o.type == "ARMATURE"][0]
names = [g.name for g in mesh.vertex_groups]
rest = np.array([v.co[:] for v in mesh.data.vertices])
W = np.zeros((len(rest), len(names)))
for v in mesh.data.vertices:
    for g in v.groups:
        W[v.index, g.group] = g.weight
feet = {side: W[:, names.index("foot." + side)] > 0.6 for side in ("L", "R")}
# flip-flop soles only: the lowest part of each foot at rest
sole = {}
for side, m in feet.items():
    z = rest[:, 2]
    sole[side] = m & (z < z[m].min() + 0.025)
print("FEET vertices", {k: int(v.sum()) for k, v in feet.items()}, "sole", {k: int(v.sum()) for k, v in sole.items()})


def tilt(pos, side):
    """Angle of the foot's underside: a line through its sole points, front to back (y), in degrees, + is toe up."""
    p = pos[sole[side]]
    y, z = p[:, 1], p[:, 2]
    slope = np.polyfit(-y, z, 1)[0]  # forward is -Y; toe up means z rises going forward
    return math.degrees(math.atan(slope))


worst_all = 0
rest_tilt = {s: tilt(rest, s) for s in feet}
print("REST tilt", {k: round(v, 1) for k, v in rest_tilt.items()})
for action in sorted(bpy.data.actions, key=lambda a: a.name):
    arm.animation_data_create().action = action
    lo, hi = action.frame_range
    worst = 0
    heights = []
    for f in range(int(lo), int(hi) + 1):
        scene.frame_set(f)
        pos = np.array([v.co[:] for v in mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices])
        low = {s: pos[sole[s]][:, 2].mean() for s in feet}
        planted = min(low, key=low.get)
        # a foot that is clearly in the air (more than 3 cm up) is not planted: count the lower foot anyway
        heights.append(pos[sole[planted]][:, 2].min())
        angle = tilt(pos, planted) - rest_tilt[planted]
        worst = max(worst, abs(angle))
    print(f"  {action.name:10s} planted foot's worst tilt: {worst:5.1f} degrees; its sole is {min(heights) * 100:+.1f} to {max(heights) * 100:+.1f} cm from the floor")
    worst_all = max(worst_all, worst)
print("FEETCHECK", "flat" if worst_all < 10 else f"{worst_all:.0f} degrees off")
if out:
    os.makedirs(out, exist_ok=True)
    common.set_engine(scene, "workbench")
    common.studio_lights(scene)
    scene.render.resolution_x, scene.render.resolution_y = 700, 500
    for o in scene.objects:
        if o.type == "ARMATURE":
            o.hide_render = True
    c = Vector((0, 0, 0.18))
    cam, _ = common.add_camera(scene, c, 1.5, elevation_deg=3)
    cam.location = c + Vector((1.5, 0, 0.05))  # from her left, the side view
    for name, frames in (("Idle", (1, 12, 36)), ("Walk", (1, 7, 14, 21)), ("Complain", (10,)), ("Defeated", (43,))):
        arm.animation_data.action = bpy.data.actions[name]
        for f in frames:
            scene.frame_set(f)
            scene.render.filepath = os.path.join(out, f"{name}_{f:02d}.png")
            bpy.ops.render.render(write_still=True)
