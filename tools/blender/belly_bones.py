"""Add belly bones to a character rigged on Coach Panic's skeleton (rig_from_template.py), for a body whose stomach should
move by itself while the rest of him walks, runs, hops and lands:
    tools/blender/run.sh tools/blender/belly_bones.py -- rigged.glb out.glb [--front 0.2] [--tex-quality 90]
The 24 bones stay as they are (names, hierarchy, rest orientations, the clips of the file) and three bones are added, each
a child of a bone that already carries that part of the torso, so at rest, and whenever the new bones are not moved, nothing
changes:
    BellyUpper   child of Spine01   the belly just under the chest
    BellyMid     child of Spine02   the middle of it, where it sticks out the most
    BellyLower   child of Hips      the part that hangs over the waistband
Each is a short bone at the belly's middle line, pointing forward to the front of the belly. They are weighted by where a
vertex is: the front of the belly (a back, a flank behind the middle, the chest, the thighs and the arms keep the skin they
had), shared between the three by height. Moving one of them moves that part of the belly, in its parent's axes; the three
together make a belly that bounces and sways, and belly_jiggle.py writes that motion into every clip. A vertex keeps at most
four bones (the skin's limit): the smallest of the old and the new weights go first.
Before that the legs' hold on the torso is loosened (`--keep-legs 0` skips it): the automatic weights of a Meshy body give the
thigh bones most of the back and the behind, high up the waist, which is harmless on a slim body but on a round one makes the
whole lower back swing with a thigh (a flap of back skin over the trunks when the knee comes up). A vertex's share on the
leg bones is cut, from just over the crotch to a hand's breadth higher, to what a behind really takes from a thigh, and given
to the pelvis and the lower spine by height.
Bind pose and the clips of the file are kept; no new clip is added (the new bones are keyed by belly_jiggle.py)."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

args = common.script_args()
front_start = common.option(args, "--front", 0.2, float)  # metres in front of the spine's middle where the belly's weight is full
keep_legs = common.option(args, "--keep-legs", 1, int)  # 0: leave the legs' weights on the torso as they are
tex_quality = common.option(args, "--tex-quality", None, int)
src, dst = args[0], args[1]

# (name, parent bone, height as a share of the body's height)
BELLY = [("BellyLower", "Hips", 0.34), ("BellyMid", "Spine02", 0.447), ("BellyUpper", "Spine01", 0.547)]
TORSO = ("Hips", "Spine02", "Spine01", "Spine")


def smooth(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == "ARMATURE")
mesh = common.meshes()[0]
if any(b.name == BELLY[0][0] for b in arm.data.bones):
    raise SystemExit("The character already has belly bones")
for name, parent, _ in BELLY:
    if parent not in arm.data.bones:
        raise SystemExit(f"No {parent} bone: this is not a character on Coach Panic's skeleton")
arm.data.pose_position = "REST"
bpy.context.view_layer.update()


def to_gltf(v):
    return (v[0], v[2], -v[1])


def to_blender(g):
    return Vector((g[0], -g[2], g[1]))


# the body in its bind pose, glTF axes
deps = bpy.context.evaluated_depsgraph_get()
ev = mesh.evaluated_get(deps)
data = ev.to_mesh()
co = np.empty(len(data.vertices) * 3)
data.vertices.foreach_get("co", co)
M = np.array(ev.matrix_world)
world = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
V = np.c_[world[:, 0], world[:, 2], -world[:, 1]]
ev.to_mesh_clear()
height = float(V[:, 1].max())
groups = [g.name for g in mesh.vertex_groups]
if keep_legs:
    # a vertex above the thigh's root keeps only what a behind takes from a thigh: at most 0.55 of it from just over the
    # crotch, fading to nothing a hand's breadth higher; the rest goes to the pelvis (low) and the lower spine (higher)
    leg_groups = [i for i, n in enumerate(groups) if n.endswith(("UpLeg", "Leg"))]
    hips_g, spine_g = groups.index("Hips"), groups.index("Spine02")
    y_root = to_gltf(arm.matrix_world @ arm.data.bones["LeftUpLeg"].head_local)[1]
    y_c = y_root - 0.049 * height
    moved = 0
    for i, v in enumerate(mesh.data.vertices):
        row = {g.group: g.weight for g in v.groups}
        legs = sum(w for g, w in row.items() if g in leg_groups)
        if legs <= 0:
            continue
        allowed = 0.55 * (1.0 - float(smooth((V[i, 1] - (y_c + 0.03 * height)) / (0.15 * height))))
        if legs <= allowed:
            continue
        scale = allowed / legs
        freed = legs - allowed
        up = float(smooth((V[i, 1] - 0.29 * height) / (0.2 * height)))  # 0 low in the pelvis, 1 up the waist
        for g in leg_groups:
            if g in row:
                row[g] *= scale
        row[hips_g] = row.get(hips_g, 0.0) + freed * (1 - up)
        row[spine_g] = row.get(spine_g, 0.0) + freed * up
        for g in list(row):
            if g in leg_groups or g in (hips_g, spine_g):
                if row[g] > 1e-5:
                    mesh.vertex_groups[g].add([i], row[g], "REPLACE")
                else:
                    mesh.vertex_groups[g].remove([i])
        moved += 1
    print(f"LEGS {moved} vertices had more than their share of leg weight (the crotch is at {y_c:.2f} m)")
dominant = []
old = []
for v in mesh.data.vertices:
    row = {g.group: g.weight for g in v.groups}
    old.append(row)
    dominant.append(max(row, key=row.get) if row else -1)
dominant = np.array(dominant)
torso_groups = [i for i, n in enumerate(groups) if n in TORSO]
is_torso = np.isin(dominant, torso_groups)

# where the belly is: its middle line (the spine bone's depth) and how far its front sticks out at each bone's height
W = arm.matrix_world
spine_mid = to_gltf(W @ arm.data.bones["Spine02"].head_local)
z0 = spine_mid[2]
layout = []
for name, parent, share in BELLY:
    y = share * height
    band = is_torso & (np.abs(V[:, 1] - y) < 0.03) & (np.abs(V[:, 0]) < 0.2)
    if band.sum() < 3:
        raise SystemExit(f"{name}: no belly found at {y:.2f} m")
    front = float(V[band][:, 2].max())
    layout.append((name, parent, y, front))
    print(f"BONE {name}: parent {parent}, height {y:.3f} m, from z {z0:+.3f} to the belly front at {front:+.3f}")

# ---- the bones ---------------------------------------------------------------------------------------------------------
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
inverse = arm.matrix_world.inverted()
for name, parent, y, front in layout:
    eb = arm.data.edit_bones.new(name)
    eb.head = inverse @ to_blender((0.0, y, z0))
    eb.tail = inverse @ to_blender((0.0, y, front))
    eb.roll = 0.0
    eb.parent = arm.data.edit_bones[parent]
    eb.use_connect = False
    eb.use_deform = True
bpy.ops.object.mode_set(mode="OBJECT")

# ---- the weights -------------------------------------------------------------------------------------------------------
y, z, x = V[:, 1], V[:, 2], np.abs(V[:, 0])
# how much of a vertex is belly: its height (not the chest, not the thighs), how far forward it is, how far from the sides
belly = (
    smooth((y - 0.253 * height) / (0.088 * height))
    * (1 - smooth((y - 0.565 * height) / (0.094 * height)))
    * smooth((z - (z0 - 0.10)) / (0.10 + front_start))
    * (1 - smooth((x - 0.21 * height) / (0.082 * height)))
    * is_torso
)
# shared between the three bones by height
centres = np.array([share * height for _, _, share in BELLY])
sigma = 0.065 * height
share_of = np.exp(-((y[:, None] - centres[None, :]) ** 2) / (2 * sigma**2))
share_of /= share_of.sum(axis=1, keepdims=True)
for name, _, _ in BELLY:
    mesh.vertex_groups.new(name=name)
new_groups = {name: mesh.vertex_groups[name] for name, _, _ in BELLY}
changed = 0
for i, v in enumerate(mesh.data.vertices):
    b = float(belly[i])
    if b < 0.01:
        continue
    changed += 1
    for g, w in old[i].items():
        mesh.vertex_groups[g].add([i], w * (1 - b), "REPLACE")
    for k, (name, _, _) in enumerate(BELLY):
        w = b * float(share_of[i, k])
        if w > 0.005:
            new_groups[name].add([i], w, "REPLACE")
print(f"WEIGHTS {changed} of {len(mesh.data.vertices)} vertices take part in the belly (strongest {belly.max():.2f})")
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.01)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
arm.data.pose_position = "POSE"  # the clips are exported as played, not as the bind pose

options = {}
if tex_quality:
    options = {"export_image_format": "JPEG", "export_jpeg_quality": tex_quality}
common.export_clips(arm, dst, **options)
print(f"BELLY {dst}: {len(arm.data.bones)} bones, {len(mesh.vertex_groups)} weight groups, {os.path.getsize(dst)} bytes")
