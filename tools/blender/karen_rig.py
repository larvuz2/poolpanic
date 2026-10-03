"""Rig and animate Karen (the complaining visitor) from an image-to-3D mesh.
    tools/blender/run.sh tools/blender/karen_rig.py -- raw.glb out.glb [--tris 18000] [--tex 1024] [--height 1.8]
        [--debug DIR]   (renders the armature over the mesh and a few poses into DIR, for checking the fit)

The mesh is a T-pose character facing the front (Blender -Y), as Hunyuan, Tripo and Meshy produce. Steps: join the
pieces, decimate, scale to `--height` metres with the feet at the origin, shrink the texture, fit a 19-bone armature
by body proportions measured from the source image (`KAREN` below), automatic weights, then five clips:

    Idle       loops   impatient foot tap, one hand on the hip, breathing
    Walk       loops   a furious march: stiff swinging arms, leaning forward
    Complain   loops   left arm up and waving, right arm up and waving, a shrug, all with a yapping chin
    Point      loops   right arm out and jabbing at whatever she is facing (the game turns her towards the target)
    Defeated   once    the fight goes out of her: arms drop, shoulders slump, a long sigh

Poses are written as directions ("aim this arm along that vector") in the chest's frame, not as bone-local angles, so
they read the same whatever the bone roll is. See `Rig` below."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

# Fractions of the body's height (z) and width (x, y) for this particular body, read off the front view.
KAREN = {
    "hip": 0.405,
    "spine": 0.47,
    "chest": 0.55,
    "chest_top": 0.625,
    "neck": 0.672,
    "head_top": 1.0,
    "hip_x": 0.058,
    "knee": 0.205,
    "ankle": 0.058,
    "toe": 0.075,  # how far the foot reaches forward
    "clav_x": 0.022,
    "shoulder_x": 0.098,
    "shoulder_z": 0.640,
    "elbow_x": 0.262,
    "wrist_x": 0.368,
    "hand_x": 0.47,
}
FPS = 24  # the Anim Bench artifact reads clips as 24 frames a second

args = common.script_args()
tris = common.option(args, "--tris", 18000, int)
tex_size = common.option(args, "--tex", 1024, int)
height = common.option(args, "--height", 1.8, float)
debug = common.option(args, "--debug")
src, dst = args[0], args[1]

common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
scene.render.fps = FPS
body = common.meshes()
bpy.ops.object.select_all(action="DESELECT")
for m in body:
    m.select_set(True)
bpy.context.view_layer.objects.active = body[0]
if len(body) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = "Karen"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Decimate, scale to height, stand on the origin.
count = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
if tris and count > tris:
    mod = mesh.modifiers.new("decimate", "DECIMATE")
    mod.ratio = tris / count
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="decimate")
lo, hi = common.world_bounds([mesh])
k = height / (hi.z - lo.z)
mesh.scale = (k, k, k)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
lo, hi = common.world_bounds([mesh])
import numpy as np  # noqa: E402

pts0 = np.array([v.co[:] for v in mesh.data.vertices])
torso_y = float(np.median(pts0[(pts0[:, 2] > lo.z + 0.2 * (hi.z - lo.z)) & (pts0[:, 2] < lo.z + 0.6 * (hi.z - lo.z)), 1]))
mesh.location = (-(lo.x + hi.x) / 2, -torso_y, -lo.z)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
lo, hi = common.world_bounds([mesh])
H = hi.z - lo.z
for img in bpy.data.images:
    if img.size[0] > tex_size:
        img.scale(tex_size, tex_size)
for mat in mesh.data.materials:
    if mat and mat.node_tree:
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                node.inputs["Metallic"].default_value = 0.0
                node.inputs["Roughness"].default_value = 0.7
print(f"KAREN mesh tris={sum(len(p.vertices) - 2 for p in mesh.data.polygons)} height={H:.2f}")


def at(x, z, y=0.0):
    return Vector((x * H, y * H, z * H))


def build_armature():
    P = KAREN
    arm_data = bpy.data.armatures.new("Armature")
    arm = bpy.data.objects.new("Armature", arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    bones = arm_data.edit_bones

    def bone(name, head, tail, parent=None, connect=False):
        b = bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = bones[parent]
            b.use_connect = connect
        return b

    bone("hips", at(0, P["hip"] - 0.03), at(0, P["hip"] + 0.02))
    bone("spine", at(0, P["hip"] + 0.02), at(0, P["spine"]), "hips", True)
    bone("chest", at(0, P["spine"]), at(0, P["chest_top"]), "spine", True)
    bone("neck", at(0, P["chest_top"]), at(0, P["neck"]), "chest", True)
    bone("head", at(0, P["neck"]), at(0, P["head_top"]), "neck", True)
    for side, s in (("L", 1), ("R", -1)):
        bone("thigh." + side, at(s * P["hip_x"], P["hip"] - 0.02), at(s * P["hip_x"], P["knee"]), "hips")
        bone("shin." + side, bones["thigh." + side].tail, at(s * P["hip_x"], P["ankle"]), "thigh." + side, True)
        bone("foot." + side, bones["shin." + side].tail, at(s * P["hip_x"], P["ankle"] * 0.4, -P["toe"]), "shin." + side, True)
        bone("shoulder." + side, at(s * P["clav_x"], P["chest_top"] - 0.01), at(s * P["shoulder_x"], P["shoulder_z"]), "chest")
        bone("upper_arm." + side, bones["shoulder." + side].tail, at(s * P["elbow_x"], P["shoulder_z"] - 0.004), "shoulder." + side, True)
        bone("forearm." + side, bones["upper_arm." + side].tail, at(s * P["wrist_x"], P["shoulder_z"] - 0.01), "upper_arm." + side, True)
        bone("hand." + side, bones["forearm." + side].tail, at(s * P["hand_x"], P["shoulder_z"] - 0.016), "forearm." + side, True)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


arm = build_armature()

# Skin weights. Blender's bone-heat solver gives up on this mesh (pieces that do not touch: eyes, glasses, earrings), so
# the weights come from distance: how far each vertex is from every bone's segment, in units of that bone's thickness,
# raised to a power so that the nearest bone wins by a wide margin; the four strongest are kept (glTF's limit). Left
# and right bones never share a vertex away from the middle line.
RADIUS = {
    "hips": 0.13, "spine": 0.11, "chest": 0.12, "neck": 0.06, "head": 0.13, "shoulder": 0.07,
    "upper_arm": 0.05, "forearm": 0.05, "hand": 0.07, "thigh": 0.06, "shin": 0.045, "foot": 0.05,
}
POWER = 4.0
SMOOTH = 3  # passes of averaging each vertex's weights with its neighbours' (softens elbows and knees)


def skin(mesh, arm):
    import numpy as np

    pts = np.array([v.co[:] for v in mesh.data.vertices])
    names = [b.name for b in arm.data.bones]
    d = np.zeros((len(pts), len(names)))
    for i, b in enumerate(arm.data.bones):
        a, c = np.array(b.head_local[:]), np.array(b.tail_local[:])
        ab = c - a
        t = np.clip(((pts - a) @ ab) / (ab @ ab), 0, 1)
        d[:, i] = np.linalg.norm(pts - (a + t[:, None] * ab), axis=1)
        d[:, i] /= RADIUS[b.name.split(".")[0]] * H
    arm_part = ("shoulder", "upper_arm", "forearm", "hand")

    def ramp(x, a, b):
        t = np.clip((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    # The arms proper (out from the body, below the hair): only arm bones may move them, fading in over a few
    # centimetres so that no seam shows where the rule starts.
    zr = pts[:, 2] / H
    outer = ramp(np.abs(pts[:, 0]) / H, 0.10, 0.17) * ramp(zr, 0.555, 0.585) * (1 - ramp(zr, 0.68, 0.70))
    for i, n in enumerate(names):
        if n.endswith(".L"):
            d[pts[:, 0] < -0.02 * H, i] = 1e6
        elif n.endswith(".R"):
            d[pts[:, 0] > 0.02 * H, i] = 1e6
    w = 1.0 / np.maximum(d, 0.05) ** POWER
    for i, n in enumerate(names):
        if n.split(".")[0] not in arm_part:
            w[:, i] *= 1 - outer
    w /= w.sum(axis=1, keepdims=True)
    edges = np.array([e.vertices[:] for e in mesh.data.edges])
    for _ in range(SMOOTH):
        total = w.copy()
        count = np.ones((len(pts), 1))
        np.add.at(total, edges[:, 0], w[edges[:, 1]])
        np.add.at(total, edges[:, 1], w[edges[:, 0]])
        np.add.at(count, edges[:, 0], 1)
        np.add.at(count, edges[:, 1], 1)
        w = 0.5 * w + 0.5 * total / count
    keep = np.argsort(-w, axis=1)[:, :4]
    out = np.zeros_like(w)
    rows = np.arange(len(pts))[:, None]
    out[rows, keep] = w[rows, keep]
    out /= out.sum(axis=1, keepdims=True)
    groups = {n: mesh.vertex_groups.new(name=n) for n in names}
    for vi in range(len(pts)):
        for j in keep[vi]:
            if out[vi, j] > 0.002:
                groups[names[j]].add([vi], float(out[vi, j]), "REPLACE")
    mesh.parent = arm
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


skin(mesh, arm)
weighted = sum(1 for v in mesh.data.vertices if any(g.weight > 0 for g in v.groups))
print(f"RIG bones={len(arm.data.bones)} weighted={weighted}/{len(mesh.data.vertices)} groups={len(mesh.vertex_groups)}")


# ----------------------------------------------------------------------------------------------------------------
# Posing by direction. Every bone has an "absolute" rotation: how far it is turned from rest, in rest-frame world axes
# (X to her left, Y backwards, Z up; she faces -Y). `rel` composes with the parent's, `aim` turns a bone so that it
# points along a vector (written in another bone's frame, so arms follow the chest), and bones nobody mentions just
# follow their parent. `apply` converts all of it to the bone-local quaternions Blender wants.
def rx(a):
    return Matrix.Rotation(a, 3, "X")  # + bows forward


def ry(a):
    return Matrix.Rotation(a, 3, "Y")  # + rolls (her right shoulder dips for +)


def rz(a):
    return Matrix.Rotation(a, 3, "Z")  # + turns her to her left


def unit(*v):
    return Vector(v).normalized()


def mix(a, b, t):
    return (a * (1 - t) + b * t).normalized()


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


class Rig:
    def __init__(self, arm):
        self.arm = arm
        self.order = [b.name for b in arm.pose.bones]
        self.rest = {b.name: b.bone.matrix_local.to_3x3() for b in arm.pose.bones}
        self.dir = {b.name: (b.bone.tail_local - b.bone.head_local).normalized() for b in arm.pose.bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in arm.pose.bones}
        self.reset()
        self.hips_offset = Vector((0, 0, 0))
        for b in arm.pose.bones:
            b.rotation_mode = "QUATERNION"

    def reset(self):
        self.abs = {}
        self.hips_offset = Vector((0, 0, 0))

    def get(self, name):
        if name in self.abs:
            return self.abs[name]
        parent = self.parent[name]
        return self.get(parent) if parent else Matrix.Identity(3)

    def rel(self, name, R):
        parent = self.parent[name]
        self.abs[name] = (self.get(parent) if parent else Matrix.Identity(3)) @ R

    def aim(self, name, vec, frame="chest", twist=0.0):
        world = self.get(frame) @ vec.normalized()
        R = self.dir[name].rotation_difference(world).to_matrix()
        if twist:
            R = Matrix.Rotation(twist, 3, world) @ R
        self.abs[name] = R

    def apply(self, frame):
        for name in self.order:
            pb = self.arm.pose.bones[name]
            parent = self.parent[name]
            Rp = self.get(parent) if parent else Matrix.Identity(3)
            Ra = self.get(name)
            Rr = self.rest[name]
            local = Rr.inverted() @ Rp.inverted() @ Ra @ Rr
            pb.rotation_quaternion = local.to_quaternion()
            pb.keyframe_insert("rotation_quaternion", frame=frame)
        hips = self.arm.pose.bones["hips"]
        hips.location = self.rest["hips"].inverted() @ self.hips_offset
        hips.keyframe_insert("location", frame=frame)


rig = Rig(arm)
TAU = 2 * math.pi


def side_sign(side):
    return 1 if side == "L" else -1


# Arm shapes as (upper arm, forearm) directions in the chest frame, for the left arm; the right mirrors in x.
SHAPES = {
    "down": (unit(0.30, 0.0, -0.95), unit(0.20, -0.30, -0.93)),
    "hip": (unit(0.55, 0.10, -0.83), unit(-0.30, -0.18, -0.94)),  # elbow out, hand on the hip
    "up": (unit(0.56, -0.30, 0.78), unit(0.12, -0.22, 0.97)),  # hand up by the ear, ready to wag
    "point": (unit(0.12, -0.92, 0.38), unit(0.05, -0.97, 0.24)),
}


FOREARM_MID = unit(0.25, -0.85, 0.15)  # forearm out in front: the way from hanging to raised


def arm_pose(side, shape, wag=0.0, jab=0.0):
    """Aim an arm at a blend of the shapes (a dict of weights), with a wag (side to side).

    The upper arm blends directly. The forearm cannot: "down" and "up" point opposite ways, so a straight blend between
    them passes through nothing and the forearm flips in a frame. It goes by way of "out in front" instead."""
    s = side_sign(side)
    up = Vector((0, 0, 0))
    for key, w in shape.items():
        up = up + SHAPES[key][0] * w
    up = up.normalized()
    low = unit(0, 0, -1)
    for key in ("down", "hip"):
        low = low + SHAPES[key][1] * shape.get(key, 0.0)
    low = low.normalized()
    raised = shape.get("up", 0.0)
    fore = low.slerp(FOREARM_MID, smooth(raised * 2))
    fore = fore.slerp(SHAPES["up"][1], smooth(raised * 2 - 1))
    if wag:
        fore = (fore + Vector((0.55 * wag, 0.12 * abs(wag), 0.0))).normalized()
    mirror = lambda v: Vector((v.x * s, v.y, v.z))
    rig.aim("upper_arm." + side, mirror(up))
    rig.aim("forearm." + side, mirror(fore))


def legs(phase, amp=0.5, bend=0.8, stance=0.03):
    """Walking legs. phase 0..tau; the left leg leads when sin(phase) > 0."""
    for side, ph in (("L", 0.0), ("R", math.pi)):
        s = side_sign(side)
        swing = math.sin(phase + ph)
        lift = max(0.0, math.cos(phase + ph))
        a = amp * swing
        rig.aim("thigh." + side, unit(s * stance, -math.sin(a), -math.cos(a)), frame="hips")
        b = a - bend * lift
        rig.aim("shin." + side, unit(s * stance, -math.sin(b), -math.cos(b)), frame="hips")
        pitch = 0.45 * lift - 0.25 * max(0.0, -swing)
        rig.aim("foot." + side, unit(0.0, -math.cos(pitch), math.sin(pitch)), frame="hips")
    return


def stand_legs(tap=0.0, shift=0.0):
    """Standing legs. `tap` lifts the right foot (an impatient tap); `shift` moves the weight to one leg."""
    for side in ("L", "R"):
        s = side_sign(side)
        t = tap if side == "R" else 0.0
        rig.aim("thigh." + side, unit(s * (0.035 + 0.02 * shift), -0.05 - 0.2 * t, -1), frame="hips")
        rig.aim("shin." + side, unit(s * 0.03, -0.02 + 0.0, -1) if t == 0 else unit(s * 0.03, 0.55 * t, -1), frame="hips")
        rig.aim("foot." + side, unit(0.0, -1.0, 0.45 * t if side == "R" else 0.0), frame="hips")


def torso(lean=0.0, twist=0.0, roll=0.0, head_pitch=0.0, head_turn=0.0, head_roll=0.0, split=0.5):
    rig.rel("hips", rz(twist * 0.35) @ ry(roll * 0.3))
    rig.rel("spine", rx(lean * split))
    rig.rel("chest", rz(twist * 0.65) @ ry(roll * 0.7) @ rx(lean * (1 - split)))
    rig.rel("neck", rx(-lean * 0.5) @ rz(-twist * 0.4))
    rig.rel("head", rx(head_pitch - lean * 0.45) @ rz(head_turn - twist * 0.2) @ ry(head_roll))


def shoulders(shrug=0.0):
    for side in ("L", "R"):
        s = side_sign(side)
        rig.aim("shoulder." + side, unit(s, 0.0, 0.0 + 0.28 * shrug), frame="chest")


# ---- Clips: each takes t in [0, 1) and poses the rig -------------------------------------------------------------
def idle(t):
    ph = t * TAU
    breath = math.sin(ph)
    tap = max(0.0, math.sin(ph * 4)) ** 2 * (1 if t < 0.75 else 0)  # four taps, then a pause
    torso(lean=0.05 + 0.015 * breath, twist=0.05 * math.sin(ph), roll=0.04 * math.sin(ph), head_pitch=-0.03, head_turn=0.22 * math.sin(ph), head_roll=0.07 * math.sin(ph + 1))
    shoulders(shrug=0.08 * breath)
    stand_legs(tap=tap, shift=0.3 * math.sin(ph))
    arm_pose("L", {"hip": 1.0})
    arm_pose("R", {"down": 1.0})
    rig.hips_offset = Vector((0.012 * math.sin(ph), 0, -0.006 * breath))


def walk(t):
    ph = t * TAU
    torso(lean=0.13, twist=0.16 * math.sin(ph), roll=0.05 * math.sin(ph), head_pitch=0.02, head_turn=0.05 * math.sin(ph * 2))
    shoulders(shrug=0.25)
    legs(ph, amp=0.55, bend=0.85)
    for side, p0 in (("L", math.pi), ("R", 0.0)):  # arms swing against the legs
        s = math.sin(ph + p0)
        a = 0.42 * s
        s_ = side_sign(side)
        up = unit(s_ * 0.34, -math.sin(a), -math.cos(a))
        fore = unit(s_ * 0.2, -math.sin(a + 0.8 + 0.3 * s), -math.cos(a + 0.8 + 0.3 * s))
        rig.aim("upper_arm." + side, up)
        rig.aim("forearm." + side, fore)
    rig.hips_offset = Vector((0.012 * math.sin(ph), 0, -0.028 * abs(math.cos(ph)) + 0.01))


def complain(t):
    ph = t * TAU
    left = smooth((t - 0.02) / 0.14) - smooth((t - 0.33) / 0.14)
    right = smooth((t - 0.38) / 0.14) - smooth((t - 0.70) / 0.14)
    shrug = smooth((t - 0.86) / 0.07) - smooth((t - 0.96) / 0.04)
    wag = math.sin(t * TAU * 6)
    yap = 0.07 * math.sin(t * TAU * 13)
    torso(
        lean=0.12 + 0.03 * math.sin(t * TAU * 6),
        twist=0.22 * (right - left),
        roll=0.1 * (right - left),
        head_pitch=yap + 0.08 * shrug,
        head_turn=0.45 * math.sin(t * TAU * 3) * (1 - shrug),
        head_roll=0.1 * (left - right),
    )
    shoulders(shrug=0.9 * shrug)
    stand_legs(tap=0.0, shift=left - right)
    for side, w in (("L", left), ("R", right)):
        shape = {"up": w, "hip": (1 - w) * (1 - shrug), "down": (1 - w) * shrug}
        arm_pose(side, shape, wag=wag * w)
    rig.hips_offset = Vector((0.01 * (left - right), 0, -0.01 * abs(wag) * (left + right)))


def point(t):
    ph = t * TAU
    jab = max(0.0, math.sin(ph * 3)) ** 2
    torso(lean=0.17 + 0.05 * jab, twist=-0.2, roll=0.05, head_pitch=0.1 * jab - 0.02, head_turn=0.12 * math.sin(ph * 2))
    shoulders(shrug=0.35)
    stand_legs(shift=-0.5)
    arm_pose("L", {"hip": 1.0})
    # The pointing arm: out along the aim, with the forearm folding back and snapping out on every jab.
    up, fore = SHAPES["point"]
    rig.aim("upper_arm.R", Vector((-up.x, up.y, up.z)))
    bent = mix(fore, unit(0.3, -0.35, 0.9), 0.55 * (1 - jab))
    rig.aim("forearm.R", Vector((-bent.x, bent.y, bent.z)))
    rig.hips_offset = Vector((0, -0.01 * jab, -0.012 * jab))


def defeated(t):
    """From the angry hands-on-hips stance down to a slump. t runs 0..1 once."""
    drop = smooth(t / 0.55)
    sigh = math.sin(smooth((t - 0.45) / 0.4) * math.pi) * 0.5 + smooth((t - 0.45) / 0.4) * 0.5
    torso(lean=0.06 + 0.17 * drop, twist=0.0, head_pitch=0.35 * drop, head_turn=0.3 * math.sin(t * TAU * 1.5) * (1 - drop * 0.6), head_roll=0.06)
    shoulders(shrug=-0.5 * drop)
    stand_legs(shift=0.0)
    arm_pose("L", {"hip": 1 - drop, "down": drop})
    arm_pose("R", {"down": 1.0})
    rig.hips_offset = Vector((0, 0, -0.035 * sigh))


CLIPS = [
    ("Idle", idle, 48, True),  # 2.0 s
    ("Walk", walk, 26, True),  # 1.08 s a double step
    ("Complain", complain, 62, True),  # 2.6 s: left arm, right arm, a shrug
    ("Point", point, 36, True),  # 1.5 s: three jabs
    ("Defeated", defeated, 43, False),  # 1.8 s, once
]


def build_clip(name, fn, frames, loop):
    action = bpy.data.actions.new(name)
    arm.animation_data_create().action = action
    scene.frame_start, scene.frame_end = 1, frames
    rig.reset()
    last = frames if not loop else frames + 1  # a looping clip closes on its first frame
    for f in range(last):
        rig.reset()
        fn(f / frames if loop else f / (frames - 1))
        rig.apply(1 + f)
    if loop:
        scene.frame_end = frames + 1
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return action


bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
actions = []
for name, fn, frames, loop in CLIPS:
    actions.append((name, build_clip(name, fn, frames, loop)))
bpy.ops.object.mode_set(mode="OBJECT")
ad = arm.animation_data
ad.action = None
for name, action in actions:
    track = ad.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
print("CLIPS", ", ".join(f"{n}={a.frame_range[1]:.0f}f" for n, a in actions))

if debug:
    os.makedirs(debug, exist_ok=True)
    common.set_engine(scene, "workbench")
    common.studio_lights(scene)
    scene.render.resolution_x = scene.render.resolution_y = 600
    center = Vector((0, 0, H * 0.5))
    cam, _ = common.add_camera(scene, center, H * 1.55, elevation_deg=4)
    arm.show_in_front = True
    arm.data.display_type = "OCTAHEDRAL"
    mesh.display_type = "SOLID"
    scene.display.shading.show_xray = False
    cam.location = center + Vector((H * 0.75, -H * 1.25, H * 0.1))  # three quarters, from her left
    shots = [("rest", None, 1)] + [(n, n, f) for n, f in (("Idle", 1), ("Walk", 4), ("Walk", 10), ("Complain", 11), ("Complain", 37), ("Complain", 56), ("Point", 3), ("Point", 7), ("Defeated", 1), ("Defeated", 43))]
    ad.nla_tracks  # keep tracks; play one action at a time by muting the others
    for i, (label, clip, frame) in enumerate(shots):
        for tr in ad.nla_tracks:
            tr.mute = clip is None or tr.name != clip
        arm.data.pose_position = "POSE" if clip else "REST"
        arm.hide_render = clip is not None  # bones only on the rest pose; the poses are the mesh alone
        scene.frame_set(frame)
        scene.render.filepath = os.path.join(debug, f"{i:02d}_{label}_{frame}.png")
        bpy.ops.render.render(write_still=True)
    # A side view of the rest pose too, for the depth of the bones.
    arm.hide_render = False
    arm.data.pose_position = "REST"
    cam.location = center + Vector((H * 1.55, 0, 0))
    scene.render.filepath = os.path.join(debug, "99_side_rest.png")
    bpy.ops.render.render(write_still=True)
    for tr in ad.nla_tracks:
        tr.mute = False
    arm.data.pose_position = "POSE"
    # The preview rig (camera, look-at marker, lights) must not end up in the glTF.
    for obj in [o for o in scene.objects if o.type in ("CAMERA", "LIGHT") or (o.type == "EMPTY")]:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_image_format="JPEG",
    export_jpeg_quality=88,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_skins=True,
    export_optimize_animation_size=True,
)
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
