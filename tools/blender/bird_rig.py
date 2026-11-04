"""Rig a bird mesh from Meshy for flight and give it its clips (the Lazy River's macaws, 4 November 2026: "they're blocky.
Let's make the 3D model, rig them, and animate them. Simple flying animation").
    tools/blender/run.sh tools/blender/bird_rig.py -- body.glb macaw.glb [--span 1.5] [--neck 0.32] [--frames 20]

The mesh comes as Meshy makes a bird from a picture of one flying at the viewer: upright, wings spread out to the sides, the
head up, the face to the front (Blender -Y), the tail hanging down. It is laid level for flight (the body pitched forward a
quarter turn, so the head leads and the tail trails), and the head, which that would leave looking at the ground, is turned
back up to look ahead (`--neck`: where the neck is, as a share of the height from the bottom of the body to the top of the
head). Then it is scaled to `--span` metres from wingtip to wingtip and given eight bones: Root, Body, Head, Tail, and two on
each wing (WingL1, WingL2, WingR1, WingR2), every vertex weighted by where it is (the wings by how far out it is, the body,
head and tail by how far forward), smoothed, two bones at most. The clips: Fly (one wingbeat, `--frames` long, a quicker
downstroke and the outer wing lagging the inner) and Glide (wings held out, a slow sway), both loops.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector, Matrix, Quaternion  # noqa: E402
import common  # noqa: E402

args = common.script_args()
span = common.option(args, "--span", 1.5, float)
neck_share = common.option(args, "--neck", 0.32, float)
frames = common.option(args, "--frames", 20, int)
src, dst = args[0], args[1]

common.clean_scene()
common.import_model(src)
parts = common.meshes()
bpy.ops.object.select_all(action="DESELECT")
for m in parts:
    m.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
if len(parts) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = mesh.data


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---- lay it level, head up again ----------------------------------------------------------------------------------------
verts = me.vertices
xs = [v.co.x for v in verts]
zs = [v.co.z for v in verts]
half = max(abs(min(xs)), abs(max(xs)))
zlo, zhi = min(zs), max(zs)
core = [v.co for v in verts if abs(v.co.x) < half * 0.16]
czlo, czhi = min(c.z for c in core), max(c.z for c in core)
neck_z = czlo + (czhi - czlo) * (1 - neck_share)
head_w = half * 0.16
pivot = Vector((0, sum(c.y for c in core) / len(core), neck_z))
pitch = Matrix.Rotation(math.radians(90), 4, "X")  # head (+Z) to the front (-Y)
for v in verts:
    p = v.co.copy()
    # the head: turned back up about the neck, smoothly across the neck and only near the middle (not the wings)
    t = smooth(neck_z - 0.04, neck_z + 0.06, p.z) * (1 - smooth(head_w, head_w * 1.6, abs(p.x)))
    if t > 0:
        q = Matrix.Rotation(math.radians(-90 * t), 4, "X")
        p = pivot + (q @ (p - pivot))
    v.co = pitch @ p
me.update()

# ---- size and place: wingtip to wingtip `span`, the body's middle at the origin -----------------------------------------
xs = [v.co.x for v in verts]
k = span / (max(xs) - min(xs))
for v in verts:
    v.co *= k
core = [v.co for v in verts if abs(v.co.x) < span * 0.08]
centre = Vector(
    (0, (min(c.y for c in core) + max(c.y for c in core)) / 2, (min(c.z for c in core) + max(c.z for c in core)) / 2)
)
for v in verts:
    v.co -= centre
me.update()

core = [v.co for v in verts if abs(v.co.x) < span * 0.08]
ylo, yhi = min(c.y for c in core), max(c.y for c in core)  # front (head, -Y) to back (tail, +Y)
length = yhi - ylo
shoulder = span * 0.09  # where the wing starts
elbow = span * 0.27  # its middle joint
head_y = ylo + length * 0.28  # in front of this: the head
tail_y = ylo + length * 0.62  # behind this: the tail
print(f"BIRD span {span:.2f} length {length:.2f} shoulder {shoulder:.2f} elbow {elbow:.2f}")

# ---- the armature -------------------------------------------------------------------------------------------------------
arm_data = bpy.data.armatures.new("BirdRig")
rig = bpy.data.objects.new("Bird", arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None, up=Vector((0, 0, 1))):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.align_roll(up)
    if parent:
        b.parent = eb[parent]
    return b


bone("Root", (0, 0.05, -0.15), (0, -0.1, -0.15))
bone("Body", (0, tail_y * 0.6, 0), (0, head_y, 0), "Root")
bone("Head", (0, head_y, 0.02), (0, ylo, 0.02), "Body")
bone("Tail", (0, tail_y, 0), (0, yhi, 0), "Body")
for side, s in (("L", 1), ("R", -1)):
    bone("Wing" + side + "1", (s * shoulder, 0, 0.02), (s * elbow, 0, 0.02), "Body")
    bone("Wing" + side + "2", (s * elbow, 0, 0.02), (s * span / 2, 0, 0.02), "Wing" + side + "1")
bpy.ops.object.mode_set(mode="OBJECT")

# ---- the weights --------------------------------------------------------------------------------------------------------
groups = {name: mesh.vertex_groups.new(name=name) for name in ["Body", "Head", "Tail", "WingL1", "WingL2", "WingR1", "WingR2"]}
weights = []
for v in verts:
    p = v.co
    ax = abs(p.x)
    side = "L" if p.x > 0 else "R"
    w = {}
    wing = smooth(shoulder * 0.7, shoulder * 1.3, ax)
    outer = smooth(elbow - 0.06, elbow + 0.06, ax)
    if wing > 0:
        w["Wing" + side + "1"] = wing * (1 - outer)
        w["Wing" + side + "2"] = wing * outer
    rest = 1 - wing
    if rest > 0:
        head = 1 - smooth(head_y - 0.04, head_y + 0.04, p.y)
        tail = smooth(tail_y - 0.04, tail_y + 0.06, p.y)
        w["Head"] = rest * head
        w["Tail"] = rest * tail
        w["Body"] = rest * (1 - head - tail)
    w = {n: x for n, x in w.items() if x > 0.001}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:2]
    total = sum(x for _, x in top) or 1
    weights.append([(n, x / total) for n, x in top])
for v, ws in zip(verts, weights):
    for n, x in ws:
        groups[n].add([v.index], x, "REPLACE")
mod = mesh.modifiers.new("Armature", "ARMATURE")
mod.object = rig
mesh.parent = rig

# ---- the clips ----------------------------------------------------------------------------------------------------------
scene = bpy.context.scene
scene.render.fps = 30
pose = rig.pose.bones
for pb in pose:
    pb.rotation_mode = "QUATERNION"


def key(name, frame, axis, degrees, loc=None):
    pb = pose[name]
    pb.rotation_quaternion = Quaternion(axis, math.radians(degrees))
    pb.keyframe_insert("rotation_quaternion", frame=frame)
    if loc is not None:
        pb.location = Vector(loc)
        pb.keyframe_insert("location", frame=frame)


X = Vector((1, 0, 0))


def clip(name, n, wing1, wing2, body_bob, tail_pitch, head_pitch):
    action = bpy.data.actions.new(name)
    rig.animation_data_create().action = action
    for f in range(n + 1):
        t = f / n
        for side in ("L", "R"):
            # (a wing's bones lie along it, rolled so their own X axis runs front to back, mirrored between the two wings:
            # the same turn raises both)
            key("Wing" + side + "1", f, X, wing1(t))
            key("Wing" + side + "2", f, X, wing2(t))
        key("Body", f, X, 0, loc=(0, 0, body_bob(t)))
        key("Tail", f, X, tail_pitch(t))
        key("Head", f, X, head_pitch(t))
        key("Root", f, X, 0)
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return action


def beat(t):
    # the wing's angle over one beat: up at 0, down by 0.42 (a quicker downstroke), up again at 1
    if t < 0.42:
        u = t / 0.42
        return 55 - 95 * (0.5 - 0.5 * math.cos(math.pi * u))
    u = (t - 0.42) / 0.58
    return -40 + 95 * (0.5 - 0.5 * math.cos(math.pi * u))


clip(
    "Fly",
    frames,
    wing1=beat,
    wing2=lambda t: beat((t - 0.08) % 1) * 0.6 + 8,
    body_bob=lambda t: 0.035 * math.cos(2 * math.pi * (t - 0.42)),
    tail_pitch=lambda t: 6 * math.sin(2 * math.pi * t),
    head_pitch=lambda t: -3 * math.sin(2 * math.pi * t),
)
clip(
    "Glide",
    60,
    wing1=lambda t: 6 + 4 * math.sin(2 * math.pi * t),
    wing2=lambda t: 3 + 5 * math.sin(2 * math.pi * t + 0.6),
    body_bob=lambda t: 0.02 * math.sin(2 * math.pi * t),
    tail_pitch=lambda t: 4 * math.sin(2 * math.pi * t + 1),
    head_pitch=lambda t: 0,
)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
mesh.select_set(True)
common.export_clips(rig, dst, use_selection=True)
print("EXPORTED", dst, os.path.getsize(dst), "bytes", len(me.polygons), "triangles")
