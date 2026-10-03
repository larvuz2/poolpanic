"""Does Karen's right arm pass through her bag? Poses every frame of every clip and counts right-arm vertices that end
up inside the bag's (deformed) bounding box.
    tools/blender/run.sh tools/blender/karen_bagcheck.py -- karen.glb"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
import numpy as np  # noqa: E402

args = common.script_args()
common.clean_scene()
common.import_model(args[0])
scene = bpy.context.scene
mesh = common.meshes()[0]
arm = [o for o in scene.objects if o.type == "ARMATURE"][0]
names = [g.name for g in mesh.vertex_groups]
rest = np.array([v.co[:] for v in mesh.data.vertices])
H = rest[:, 2].max() - rest[:, 2].min()
W = np.zeros((len(rest), len(names)))
for v in mesh.data.vertices:
    for g in v.groups:
        W[v.index, g.group] = g.weight
share = lambda keys: sum(W[:, names.index(k)] for k in keys if k in names)
torso = share(["hips", "spine", "chest", "shoulder.R"])
rarm = share(["upper_arm.R", "forearm.R", "hand.R"])
# the bag: on her right (-X), hanging below the armpit, belonging to the torso
bag = (rest[:, 0] < -0.09 * H) & (rest[:, 2] > 0.33 * H) & (rest[:, 2] < 0.55 * H) & (torso > 0.6)  # the bag itself, not its strap
arm_v = (rarm > 0.7) & (np.abs(rest[:, 0]) > 0.17 * H)  # past the shoulder
print(f"BAG vertices={bag.sum()} right-arm vertices={arm_v.sum()}")
worst = 0
for action in sorted(bpy.data.actions, key=lambda a: a.name):
    arm.animation_data_create().action = action
    lo, hi = action.frame_range
    inside_max = 0
    for f in range(int(lo), int(hi) + 1, 2):
        scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        pos = np.array([v.co[:] for v in mesh.evaluated_get(dg).data.vertices])
        b = pos[bag]
        mn, mx = b.min(0), b.max(0)
        shrink = (mx - mn) * 0.12
        mn, mx = mn + shrink, mx - shrink
        a = pos[arm_v]
        hit = ((a > mn) & (a < mx)).all(axis=1)
        inside = int(hit.sum())
        if os.environ.get('BAGDEBUG') and inside > 5 and action.name in ('Walk', 'Defeated'):
            print('   ', action.name, f, inside, 'rest x of the hits', np.round(np.abs(rest[arm_v][hit][:, 0]) / H, 2).min(), np.round(np.abs(rest[arm_v][hit][:, 0]) / H, 2).max())
        inside_max = max(inside_max, inside)
    worst = max(worst, inside_max)
    print(f"  {action.name:10s} most right-arm vertices inside the bag: {inside_max}")
print("BAGCHECK", "clear" if worst == 0 else f"{worst} vertices inside")
