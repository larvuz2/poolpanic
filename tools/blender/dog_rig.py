"""Rig a four-legged dog mesh from Meshy and give it the loose dog's clips (4 November 2026, the creator: "the dog: we need to
build on the dog… add Coach Waters so it's in the same world as the dog, and we rig it and animate it").
    tools/blender/run.sh tools/blender/dog_rig.py -- body.glb dog.glb

The mesh stands on the floor facing the front (Blender -Y, glTF +Z), as game_export.py leaves it, about a metre to the top of
its head. Its skeleton is its own (a dog is not a person): Root; Hips, Spine, Chest along the back; Neck and Head; an ear on
each side; a tail of three; and on each leg three bones (upper, lower, paw: FrontL/FrontR/BackL/BackR + 1, 2, 3). Where they go
is measured from the mesh: the four legs are found under the belly (the low vertices, a cluster at each corner), the head
above the chest, the tail behind the hips, the ears at the head's sides. Every vertex is weighted by where it is (a leg by
height along it, the tail by how far along, the back by how far forward), smoothed over the surface, two bones at most.

The clips (30 frames a second, all in place, the game moves the dog): Idle (standing, looking about, tail wagging), Walk (a
lateral walk), Run (a trot, quick), Sniff (nose down, wagging), Swim (paddling with the head up; the game sinks him), Shake
(shaking water off, nose to tail), Leap (stretched out in the air, held).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector, Quaternion  # noqa: E402
import common  # noqa: E402

args = common.script_args()
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
V = [v.co.copy() for v in me.vertices]


def smooth(a, b, x):
    if a == b:
        return 1.0 if x >= a else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mean(points):
    n = max(1, len(points))
    return Vector((sum(p.x for p in points) / n, sum(p.y for p in points) / n, sum(p.z for p in points) / n))


H = max(p.z for p in V)
ylo, yhi = min(p.y for p in V), max(p.y for p in V)

# ---- measure: the legs, the body, the head, the tail ----------------------------------------------------------------------
low = [p for p in V if p.z < 0.16 * H]
ymid = (min(p.y for p in low) + max(p.y for p in low)) / 2
feet = {}
for name, front, left in (("FrontL", True, True), ("FrontR", True, False), ("BackL", False, True), ("BackR", False, False)):
    pts = [p for p in low if (p.y < ymid) == front and (p.x > 0) == left]
    feet[name] = mean(pts)
front_y = (feet["FrontL"].y + feet["FrontR"].y) / 2
back_y = (feet["BackL"].y + feet["BackR"].y) / 2
# the belly: the lowest body point between the legs
mid = [p for p in V if abs(p.y - (front_y + back_y) / 2) < 0.06 and abs(p.x) < 0.06]
belly = min(p.z for p in mid)
top_mid = max(p.z for p in mid)
back_z = (belly + top_mid) / 2  # the spine runs through the middle of the body
# the head: everything high and in front of the front legs
head_pts = [p for p in V if p.z > top_mid + 0.05 and p.y < front_y + 0.05]
head_c = mean(head_pts)
nose = min(head_pts, key=lambda p: p.y)
head_half = max(abs(p.x) for p in head_pts)
# the tail: behind the back legs and above the belly
tail_pts = [p for p in V if p.y > back_y + 0.1 and p.z > belly]
tail_tip = max(tail_pts, key=lambda p: (p - Vector((0, back_y, back_z))).length)
tail_root = Vector((0, back_y + 0.1, back_z + 0.06))
print(
    f"DOG H {H:.2f} belly {belly:.2f} back {back_z:.2f} front_y {front_y:.2f} back_y {back_y:.2f} "
    f"head {tuple(round(c, 2) for c in head_c)} nose {nose.y:.2f} tail_tip {tuple(round(c, 2) for c in tail_tip)}"
)
for n, f in feet.items():
    print("FOOT", n, tuple(round(c, 3) for c in f))

# ---- the armature -----------------------------------------------------------------------------------------------------------
arm_data = bpy.data.armatures.new("DogRig")
rig = bpy.data.objects.new("Dog", arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
UP, FWD = Vector((0, 0, 1)), Vector((0, -1, 0))


def bone(name, head, tail, parent=None, roll_to=UP, connect=False):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.align_roll(roll_to)
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    return b


shoulder_z = back_z
neck_base = Vector((0, front_y - 0.04, top_mid - 0.02))
head_base = Vector((0, head_c.y + 0.06, head_c.z - 0.08))
bone("Root", (0, 0, 0), (0, -0.2, 0))
bone("Hips", (0, back_y, back_z), (0, (back_y + front_y) / 2, back_z), "Root")
bone("Spine", (0, (back_y + front_y) / 2, back_z), (0, front_y, back_z + 0.02), "Hips", connect=True)
bone("Chest", (0, front_y, back_z + 0.02), neck_base, "Spine", connect=True)
bone("Neck", neck_base, head_base, "Chest", connect=True)
bone("Head", head_base, (0, nose.y, head_base.z - 0.02), "Neck", connect=True)
for side, s in (("L", 1), ("R", -1)):
    ear_top = Vector((s * head_half * 0.78, head_c.y + 0.02, head_c.z + 0.1))
    bone("Ear" + side, ear_top, ear_top + Vector((s * 0.03, 0.01, -0.2)), "Head", roll_to=FWD)
tail_mid = tail_root.lerp(tail_tip, 0.5)
bone("Tail1", tail_root, tail_root.lerp(tail_tip, 0.33), "Hips")
bone("Tail2", tail_root.lerp(tail_tip, 0.33), tail_root.lerp(tail_tip, 0.66), "Tail1", connect=True)
bone("Tail3", tail_root.lerp(tail_tip, 0.66), tail_tip, "Tail2", connect=True)
joints = {}
for name, f in feet.items():
    front = name.startswith("Front")
    x = f.x
    top = Vector((x, f.y + (0.0 if front else 0.0), shoulder_z))
    knee = Vector((x, f.y + (0.015 if front else -0.03), belly * 0.55))
    ankle = Vector((x, f.y + (0.0 if front else 0.03), 0.09 * H))
    toe = Vector((x, f.y - 0.07, 0.02))
    parent = "Chest" if front else "Hips"
    bone(name + "1", top, knee, parent, roll_to=FWD)
    bone(name + "2", knee, ankle, name + "1", roll_to=FWD, connect=True)
    bone(name + "3", ankle, toe, name + "2", roll_to=UP, connect=True)
    joints[name] = (top, knee, ankle, toe)
bpy.ops.object.mode_set(mode="OBJECT")

# ---- the weights --------------------------------------------------------------------------------------------------------
names = [b.name for b in arm_data.bones if b.name != "Root"]
groups = {n: mesh.vertex_groups.new(name=n) for n in names}
leg_top = belly + 0.06  # above this a leg gives way to the body


def leg_of(p):
    best, d = None, 1e9
    for name, f in feet.items():
        dd = math.hypot(p.x - f.x, p.y - f.y)
        if dd < d:
            best, d = name, dd
    return best, d


def body_weights(p):
    w = {}
    # head and neck: in front of the chest and above the shoulders
    fwd = -p.y
    head = smooth(-head_base.y - 0.03, -head_base.y + 0.04, fwd) * smooth(back_z, top_mid, p.z)
    neck = smooth(-neck_base.y - 0.03, -neck_base.y + 0.05, fwd) * smooth(back_z - 0.05, top_mid, p.z) * (1 - head)
    ear = 0.0
    if head > 0.5 and abs(p.x) > head_half * 0.62 and p.z < head_c.z + 0.12:
        ear = smooth(head_half * 0.62, head_half * 0.8, abs(p.x))
    if ear > 0:
        w["EarL" if p.x > 0 else "EarR"] = ear * head
    w["Head"] = head * (1 - ear)
    w["Neck"] = neck
    rest = max(0.0, 1 - head - neck)
    # the tail: behind the hips' end
    tail = smooth(tail_root.y - 0.03, tail_root.y + 0.05, p.y) * smooth(belly, back_z, p.z)
    if tail > 0:
        along = (p - tail_root).dot((tail_tip - tail_root).normalized()) / (tail_tip - tail_root).length
        t2 = smooth(0.25, 0.42, along)
        t3 = smooth(0.58, 0.75, along)
        w["Tail1"] = rest * tail * (1 - t2)
        w["Tail2"] = rest * tail * (t2 - t3)
        w["Tail3"] = rest * tail * t3
    rest *= 1 - tail
    # the back: Hips at the back legs, Chest at the front, Spine between
    u = (p.y - front_y) / (back_y - front_y)  # 0 at the front legs, 1 at the back
    hips = smooth(0.55, 0.9, u)
    chest = 1 - smooth(0.1, 0.45, u)
    w["Hips"] = w.get("Hips", 0) + rest * hips
    w["Chest"] = w.get("Chest", 0) + rest * chest
    w["Spine"] = rest * max(0.0, 1 - hips - chest)
    return w


weights = []
for p in V:
    leg, d = leg_of(p)
    w = {}
    legness = (1 - smooth(leg_top - 0.06, leg_top + 0.04, p.z)) * (1 - smooth(0.09, 0.14, d))
    if legness > 0:
        top, knee, ankle, toe = joints[leg]
        b2 = smooth(knee.z + 0.03, knee.z - 0.03, p.z)
        b3 = smooth(ankle.z + 0.02, ankle.z - 0.02, p.z)
        w[leg + "1"] = legness * (1 - b2)
        w[leg + "2"] = legness * (b2 - b3)
        w[leg + "3"] = legness * b3
    for n, x in body_weights(p).items():
        w[n] = w.get(n, 0) + (1 - legness) * x
    w = {n: x for n, x in w.items() if x > 0.002}
    weights.append(w)

# smooth over the surface (welded: a UV seam is two vertices at one place), three passes, then two bones at most
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
by_place = {}
for v in bm.verts:
    by_place.setdefault(tuple(round(c, 5) for c in v.co), []).append(v.index)
neighbours = [set() for _ in bm.verts]
for e in bm.edges:
    a, b = e.verts[0].index, e.verts[1].index
    neighbours[a].add(b)
    neighbours[b].add(a)
for same in by_place.values():
    for i in same:
        for j in same:
            if i != j:
                neighbours[i] |= neighbours[j] | {j}
bm.free()
for _ in range(3):
    nxt = []
    for i, w in enumerate(weights):
        acc = dict((n, x * 2) for n, x in w.items())
        for j in neighbours[i]:
            for n, x in weights[j].items():
                acc[n] = acc.get(n, 0) + x
        total = sum(acc.values()) or 1
        nxt.append({n: x / total for n, x in acc.items()})
    weights = nxt
for v, w in zip(me.vertices, weights):
    top = sorted(w.items(), key=lambda kv: -kv[1])[:2]
    total = sum(x for _, x in top) or 1
    for n, x in top:
        groups[n].add([v.index], x / total, "REPLACE")
mod = mesh.modifiers.new("Armature", "ARMATURE")
mod.object = rig
mesh.parent = rig

# ---- the clips ----------------------------------------------------------------------------------------------------------
scene = bpy.context.scene
scene.render.fps = 30
pose = rig.pose.bones
for pb in pose:
    pb.rotation_mode = "QUATERNION"
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
LEGS = ["FrontL", "FrontR", "BackL", "BackR"]


def rot(*turns):
    q = Quaternion()
    for axis, deg in turns:
        q = q @ Quaternion(axis, math.radians(deg))
    return q


def clip(name, n, pose_at, loop=True):
    """pose_at(t) -> {bone: quaternion or (quaternion, location)} for t in [0, 1]."""
    action = bpy.data.actions.new(name)
    rig.animation_data_create().action = action
    for f in range(n + 1):
        t = f / n
        poses = pose_at(t)
        for pb in pose:
            value = poses.get(pb.name, Quaternion())
            loc = None
            if isinstance(value, tuple):
                value, loc = value
            pb.rotation_quaternion = value
            pb.keyframe_insert("rotation_quaternion", frame=f)
            if pb.name in ("Root", "Hips"):
                pb.location = loc or Vector()
                pb.keyframe_insert("location", frame=f)
    return action


S = lambda t, k=1, ph=0: math.sin(2 * math.pi * (k * t + ph))  # noqa: E731
C = lambda t, k=1, ph=0: math.cos(2 * math.pi * (k * t + ph))  # noqa: E731


def gait(t, phases, swing, bend, paw):
    """Each leg swings forward and back (its upper bone), bending at the knee and curling the paw while it comes forward."""
    out = {}
    for leg in LEGS:
        ph = phases[leg]
        a = swing * S(t, 1, ph)
        forward = max(0.0, C(t, 1, ph))  # moving forward: the leg is off the floor
        front = leg.startswith("Front")
        out[leg + "1"] = rot((X, a))
        out[leg + "2"] = rot((X, (-1 if front else 1) * bend * forward))
        out[leg + "3"] = rot((X, paw * forward * (1 if front else -1)))
    return out


def wag(t, speed, amount, lift=25):
    return {
        "Tail1": rot((X, lift), (Z, amount * S(t, speed))),
        "Tail2": rot((Z, amount * 0.8 * S(t, speed, -0.08))),
        "Tail3": rot((Z, amount * 0.6 * S(t, speed, -0.16))),
    }


def idle(t):
    p = wag(t, 4, 28)
    p["Neck"] = rot((Z, 14 * S(t, 1)), (X, 3 * S(t, 2)))
    p["Head"] = rot((Z, 8 * S(t, 1, -0.1)), (Y, 6 * S(t, 1, 0.2)))
    p["Chest"] = rot((X, 1.5 * S(t, 2)))
    for e, s in (("EarL", 1), ("EarR", -1)):
        p[e] = rot((X, 6 * S(t, 2, 0.3)))
    return p


def walk(t):
    p = gait(t, {"FrontL": 0, "BackR": 0.25, "FrontR": 0.5, "BackL": 0.75}, 24, 40, 30)
    p.update(wag(t, 2, 22))
    p["Root"] = (Quaternion(), Vector((0, 0, 0.012 * C(t, 2))))
    p["Neck"] = rot((X, 4 * S(t, 2)))
    p["Head"] = rot((X, -3 * S(t, 2)))
    p["Hips"] = (rot((Y, 3 * S(t, 1))), Vector())
    for e in ("EarL", "EarR"):
        p[e] = rot((X, 10 * S(t, 2, 0.25)))
    return p


def run(t):
    p = gait(t, {"FrontL": 0, "BackR": 0, "FrontR": 0.5, "BackL": 0.5}, 38, 65, 45)
    p.update(wag(t, 1, 10, lift=10))
    p["Root"] = (Quaternion(), Vector((0, 0, 0.035 * abs(C(t, 1)))))
    p["Spine"] = rot((X, 4 * S(t, 2)))
    p["Neck"] = rot((X, -8 + 5 * S(t, 2)))
    p["Head"] = rot((X, 6 - 4 * S(t, 2)))
    for e in ("EarL", "EarR"):
        p[e] = rot((X, -30 + 15 * S(t, 2, 0.2)))
    return p


def sniff(t):
    p = wag(t, 4, 24)
    p["Chest"] = rot((X, -8))
    p["Neck"] = rot((X, -38), (Z, 12 * S(t, 1)))
    p["Head"] = rot((X, -18 + 4 * S(t, 6)))
    p["FrontL1"] = rot((X, -6))
    p["FrontR1"] = rot((X, -6))
    for e in ("EarL", "EarR"):
        p[e] = rot((X, 12))
    return p


def swim(t):
    p = {}
    for leg, ph in (("FrontL", 0), ("FrontR", 0.5), ("BackL", 0.5), ("BackR", 0)):
        front = leg.startswith("Front")
        p[leg + "1"] = rot((X, (30 if front else 22) * S(t, 1, ph) + (25 if front else -10)))
        p[leg + "2"] = rot((X, (-1 if front else 1) * 45 * max(0.0, C(t, 1, ph))))
        p[leg + "3"] = rot((X, (1 if front else -1) * 25))
    p["Hips"] = (rot((X, 14)), Vector())
    p["Neck"] = rot((X, 22))
    p["Head"] = rot((X, -12 + 3 * S(t, 2)))
    p.update(wag(t, 1, 12, lift=-5))
    for e in ("EarL", "EarR"):
        p[e] = rot((X, -15))
    return p


def shake(t):
    a = 26 * S(t, 4)
    p = {
        "Chest": rot((Y, a)),
        "Spine": rot((Y, -a * 0.6)),
        "Hips": (rot((Y, a * 0.5)), Vector()),
        "Neck": rot((Y, a * 0.6)),
        "Head": rot((Y, a * 0.7)),
        "EarL": rot((Y, -a * 2.2)),
        "EarR": rot((Y, -a * 2.2)),
    }
    p.update(wag(t, 4, 30))
    return p


def leap(t):
    p = {
        "FrontL1": rot((X, 55)),
        "FrontR1": rot((X, 50)),
        "FrontL2": rot((X, -20)),
        "FrontR2": rot((X, -20)),
        "BackL1": rot((X, -45)),
        "BackR1": rot((X, -40)),
        "BackL2": rot((X, 20)),
        "BackR2": rot((X, 20)),
        "Neck": rot((X, 12)),
        "EarL": rot((X, -40)),
        "EarR": rot((X, -40)),
        "Tail1": rot((X, 5)),
    }
    return p


clip("Idle", 60, idle)
clip("Walk", 24, walk)
clip("Run", 14, run)
clip("Sniff", 40, sniff)
clip("Swim", 22, swim)
clip("Shake", 24, shake)
clip("Leap", 10, leap)

bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
mesh.select_set(True)
common.export_clips(rig, dst, use_selection=True)
print("EXPORTED", dst, os.path.getsize(dst), "bytes", len(me.polygons), "triangles")
