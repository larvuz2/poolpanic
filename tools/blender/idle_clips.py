"""Add two looping idle clips to a rigged humanoid (the walk and any other clips in the file stay):

    IdleScan     4 s   stands alert, breathing, and turns the head left and right as if scanning the place
    IdleScratch  6 s   the same scan, then scratches the head with the right hand and lowers it again

    tools/blender/run.sh tools/blender/idle_clips.py -- in.glb out.glb [--scan 42] [--hang 8] [--forearm-hang 4]
        [--scratch-target X,Y,Z] [--pole X,Y,Z] [--only IdleScan|IdleScratch]

The legs stay in the rest pose (feet together on the floor), so the rig should stand in a T-pose with its feet on the
floor, as Meshy and Tripo give it. Every clip keys every bone, like the walk, so switching between clips in the game
never leaves a bone behind. The first and last frame are the same pose, so each clip loops without a jump.

--scan is how far the head turns to each side (degrees), --hang and --forearm-hang how far the arms stand off the body.
The scratching hand goes to --scratch-target (the wrist, in metres, in the rest pose's coordinates; the default sits
beside the head, found from the mesh) and the elbow points along --pole. For Mixamo-style bone names (Meshy, Tripo,
Mixamo) and this toolkit's own humanoid_rig; the character faces the front (glTF +Z, Blender -Y)."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

args = common.script_args()
scan = math.radians(common.option(args, "--scan", 42.0, float))
hang = math.radians(common.option(args, "--hang", 8.0, float))
forearm_hang = math.radians(common.option(args, "--forearm-hang", 4.0, float))
target_arg = common.option(args, "--scratch-target")
pole_arg = common.option(args, "--pole")
only = common.option(args, "--only")
src, dst = args[0], args[1]

BREATH = 48  # frames per breath (2 s at 24 fps): every clip holds a whole number of them

# `look` is where the head points over time, as frame -> fraction of --scan (+1 is full left, -1 full right); the head
# eases from one key to the next. `scratch` is (raise starts, hand is up, hand starts down, hand is down) in frames.
CLIPS = {
    "IdleScan": {
        "frames": 96,
        "look": [(0, 0), (9, 0), (23, 1), (37, 1), (61, -1), (75, -1), (91, 0), (96, 0)],
    },
    "IdleScratch": {
        "frames": 144,
        "look": [(0, 0), (8, 0), (20, 1), (31, 1), (51, -1), (60, -1), (72, 0), (144, 0)],
        "scratch": (72, 90, 124, 142),
        "rub": (92, 122, 6.8),  # the hand rubs between these frames, one rub every 6.8 frames
    },
}
if only:
    CLIPS = {only: CLIPS[only]}


def smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)


def track(keys, t):
    """Value at frame t of [(frame, value), ...], easing from each key to the next."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0))
    return keys[-1][1]


def rot(axis, angle):
    return Matrix.Rotation(angle, 3, axis)


def rot_axis(axis, angle):
    return Matrix.Rotation(angle, 3, axis)


def rot_part(matrix):
    return matrix.to_3x3().to_quaternion().to_matrix()


common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
armatures = [o for o in scene.objects if o.type == "ARMATURE"]
if not armatures:
    raise SystemExit("No armature in " + src)
arm = armatures[0]
if max(abs(x) for x in arm.rotation_euler) > 1e-4:
    print("WARNING: the armature is rotated; the forward and up axes below assume it is not")
pose = arm.pose.bones
bones = common.humanoid_bones(arm)
chest, neck, head, spine = bones["chest"], bones["neck"], bones["head"], bones["spine"]
sides = {"left": bones["left"], "right": bones["right"]}
for pb in pose:
    pb.rotation_mode = "QUATERNION"
W = arm.matrix_world  # armature space (centimetres, as Meshy's rigs are) to metres


def world(p):
    return W @ p


# Nothing may drive the pose while it is built by hand.
arm.animation_data_create()
arm.animation_data.action = None
for t in arm.animation_data.nla_tracks:
    t.mute = True
kept = [a.name for a in bpy.data.actions]

out = {s: 1.0 if sides[s]["upper"].head_local.x > 0 else -1.0 for s in sides}
rest_dir = {
    s: {
        "upper": (f["fore"].head_local - f["upper"].head_local).normalized(),
        "fore": (f["hand"].head_local - f["fore"].head_local).normalized(),
    }
    for s, f in sides.items()
}
length = {
    s: {
        "upper": (world(f["fore"].head_local) - world(f["upper"].head_local)).length,
        "fore": (world(f["hand"].head_local) - world(f["fore"].head_local)).length,
    }
    for s, f in sides.items()
}

# Where the head is, from the mesh: the vertices the head bone owns, at rest.
mesh = common.meshes()[0]
group = mesh.vertex_groups.get(head.name)
lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
for v in mesh.data.vertices:
    if any(g.group == group.index and g.weight > 0.5 for g in v.groups):
        p = mesh.matrix_world @ v.co
        lo = Vector(map(min, lo, p))
        hi = Vector(map(max, hi, p))
head_w, head_h = max(abs(lo.x), abs(hi.x)), hi.z - lo.z
head_pivot = world(head.head_local)
head_centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2))
side_out = out["right"]  # the right hand does the scratching
if target_arg:
    target = Vector(float(x) for x in target_arg.split(","))
else:  # the back of the head on the scratching side, about four tenths of the way up
    target = Vector((side_out * 0.9 * head_w, hi.y - 0.03, lo.z + 0.42 * head_h))
pole = Vector(float(x) for x in pole_arg.split(",")) if pole_arg else Vector((side_out, 0.25, 0.45))  # out, back and up
print("HEAD width", round(head_w, 3), "height", round(head_h, 3), "wrist target", tuple(round(x, 3) for x in target))
PALM = Vector((0, 0, -1))  # which way the palm faces in a T-pose
WRIST = math.radians(35)  # how far the scratching hand bends at the wrist, toward the head


def swivel_reference(n):
    """A direction at right angles to the shoulder-to-wrist line `n`, toward the back: what a swivel angle is measured from."""
    ref = Vector((0, 1, 0))
    ref = ref - n * ref.dot(n)
    return ref.normalized() if ref.length > 1e-6 else Vector((0, 0, 1))


def swivel_of(n, elbow_dir):
    """How far round the shoulder-to-wrist line the elbow points, from the reference (radians)."""
    ref = swivel_reference(n)
    side = elbow_dir - n * elbow_dir.dot(n)
    side = side.normalized() if side.length > 1e-6 else ref
    return math.atan2(n.dot(ref.cross(side)), ref.dot(side))


def two_bone(shoulder, wrist, a, b, swivel):
    """Directions of the upper arm and forearm that put the wrist on `wrist`, the elbow `swivel` round the line."""
    to = wrist - shoulder
    d = max(abs(a - b) + 1e-4, min(a + b - 1e-4, to.length))
    n = to.normalized()
    x = (a * a - b * b + d * d) / (2 * d)
    h = math.sqrt(max(a * a - x * x, 0.0))
    side = Matrix.Rotation(swivel, 3, n) @ swivel_reference(n)
    elbow = shoulder + n * x + side * h
    return (elbow - shoulder).normalized(), (shoulder + n * d - elbow).normalized()


def set_orientation(bone, orientation):
    """Point the bone as `orientation` says (armature space), wherever its parent has left its head."""
    pb = pose[bone.name]
    m = orientation.to_4x4()
    m.translation = pb.matrix.translation
    pb.matrix = m
    bpy.context.view_layer.update()


def set_turn(bone, turn):
    """Turn the bone from its rest orientation by `turn` (a rotation about the armature's own axes)."""
    set_orientation(bone, turn @ rot_part(bone.matrix_local))


def controls(clip, t):
    n = clip["frames"]
    breath = math.sin(2 * math.pi * t / BREATH)
    yaw = track(clip["look"], t) * scan + math.radians(1.2) * math.sin(2 * math.pi * 2 * t / n)
    pitch = math.radians(1.0) + math.radians(0.7) * breath
    roll = 0.0
    lift = rub = 0.0
    if "scratch" in clip:
        a, b, c, d = clip["scratch"]
        lift = smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)))
        r0, r1, period = clip["rub"]
        window = smooth((t - r0) / 4) * (1 - smooth((t - (r1 - 4)) / 4))
        rub = math.sin(2 * math.pi * (t - r0) / period) * window
        yaw += math.radians(6) * lift  # a puzzled glance away, head tipped toward the hand
        pitch -= math.radians(2) * lift
        roll = -math.radians(6) * lift
    return {"yaw": yaw, "pitch": pitch, "roll": roll, "breath": breath, "lift": lift, "rub": rub, "t": t}


def pose_frame(c):
    for pb in pose:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    yaw, pitch, roll, breath, lift = c["yaw"], c["pitch"], c["roll"], c["breath"], c["lift"]
    # The spine shares a little of the head's turn and the breath; the neck more; the head all of it.
    total = Matrix.Identity(3)
    count = len(spine)
    for i, bone in enumerate(spine):
        share = (i + 1) / count
        total = rot("Z", 0.12 * share * yaw) @ rot("X", -0.012 * share * breath) @ rot("Y", -math.radians(1.5) * share * lift)
        set_turn(bone, total)
    chest_total = total
    head_total = rot("Z", yaw) @ rot("X", pitch) @ rot("Y", roll)
    set_turn(neck, rot("Z", 0.45 * yaw) @ rot("X", 0.4 * pitch) @ rot("Y", 0.4 * roll))
    set_turn(head, head_total)
    for side, found in sides.items():
        o = out[side]
        sway = math.radians(1.5) * math.sin(2 * math.pi * c["t"] / BREATH + (0 if side == "left" else math.pi))
        bend = math.radians(14) + math.radians(2) * breath
        up = chest_total @ rot("X", -sway) @ Vector((o * math.sin(hang), 0, -math.cos(hang)))
        fore = chest_total @ rot("X", -(sway + bend)) @ Vector((o * math.sin(forearm_hang), 0, -math.cos(forearm_hang)))
        s = 0.0
        phi = 0.0
        wrist_turn = Matrix.Identity(3)
        if side == "right" and lift > 0:
            s = lift
            a_len, b_len = length[side]["upper"], length[side]["fore"]
            shoulder = world(pose[found["upper"].name].matrix.translation)
            elbow_hang = shoulder + up * a_len
            wrist_hang = elbow_hang + fore * b_len
            # The goal sits in the head's frame, so the hand goes where the head has turned; the rub moves it a little.
            move = Vector((-side_out * 0.016 * c["rub"], 0.016 * c["rub"], 0.006 * abs(c["rub"])))
            head_at = world(pose[head.name].matrix.translation)
            wrist_goal = head_at + head_total @ (target - head_pivot + move)
            to_head = (head_at + head_total @ (head_centre - head_pivot) - wrist_goal).normalized()
            n_goal = (wrist_goal - shoulder).normalized()
            swivel_goal = swivel_of(n_goal, pole)
            up_goal, fore_goal = two_bone(shoulder, wrist_goal, a_len, b_len, swivel_goal)
            # The twist that turns the palm toward the head once the arm is up, the same whatever the blend so that it
            # grows smoothly as the hand rises (kept between 0 and 360 degrees: this pose needs about half a turn, which
            # would flip sign mid-clip if it were allowed to wrap at 180).
            normal = rest_dir[side]["fore"].rotation_difference(fore_goal).to_matrix() @ PALM
            n1, d1 = normal - fore_goal * normal.dot(fore_goal), to_head - fore_goal * to_head.dot(fore_goal)
            phi = (math.atan2(fore_goal.dot(n1.cross(d1)), n1.dot(d1)) % (2 * math.pi)) * s
            # The wrist travels from where it hangs to the goal, bowing out and forward so the hand passes well clear of
            # the shoulder, and the elbow swings round the shoulder-to-wrist line from behind to out and up: the hand
            # rises along the body, not out like a wave.
            wrist = wrist_hang + (wrist_goal - wrist_hang) * s + Vector((o * 0.15, -0.10, 0)) * math.sin(math.pi * s)
            swivel_hang = swivel_of((wrist_hang - shoulder).normalized(), elbow_hang - shoulder)
            swing = (swivel_goal - swivel_hang + math.pi) % (2 * math.pi) - math.pi  # the short way round
            up, fore = two_bone(shoulder, wrist, a_len, b_len, swivel_hang + swing * s)
            # The hand bends at the wrist toward the head.
            toward = to_head - fore * to_head.dot(fore)
            if toward.length > 1e-6:
                hand_aim = (fore * math.cos(WRIST * s) + toward.normalized() * math.sin(WRIST * s)).normalized()
                wrist_turn = fore.rotation_difference(hand_aim).to_matrix()
        rests = {r: rot_part(found[r].matrix_local) for r in ("upper", "fore", "hand")}
        for role, d, share in (("upper", up, 1 / 3), ("fore", fore, 2 / 3)):
            turn = rest_dir[side][role].rotation_difference(d).to_matrix()
            set_orientation(found[role], rot_axis(d, share * phi) @ turn @ rests[role])
        fore_orientation = rot_part(pose[found["fore"].name].matrix)
        hand_rest = fore_orientation @ rests["fore"].inverted() @ rests["hand"]
        set_orientation(found["hand"], wrist_turn @ rot_axis(fore, (1 / 3) * phi) @ hand_rest)


built = {}
for name, clip in CLIPS.items():
    n = clip["frames"]
    keys = []
    previous = {}
    for f in range(n + 1):
        pose_frame(controls(clip, f % n))  # the last frame is the first again
        row = {}
        for pb in pose:
            q = Quaternion(pb.rotation_quaternion)
            if pb.name in previous and previous[pb.name].dot(q) < 0:
                q.negate()  # the same turn the short way round, so neighbouring frames interpolate
            previous[pb.name] = q
            row[pb.name] = (tuple(pb.location), q, tuple(pb.scale))
        keys.append(row)
    built[name] = keys
    print("BUILT", name, n, "frames")

for name, keys in built.items():
    action = bpy.data.actions.new(name)
    arm.animation_data.action = action
    for f, row in enumerate(keys):
        for pb in pose:
            loc, q, scl = row[pb.name]
            pb.location, pb.rotation_quaternion, pb.scale = loc, q, scl
            pb.keyframe_insert("location", frame=f, group=pb.name)
            pb.keyframe_insert("rotation_quaternion", frame=f, group=pb.name)
            pb.keyframe_insert("scale", frame=f, group=pb.name)
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    arm.animation_data.action = None

common.export_clips(arm, dst)
print("CLIPS", kept + list(built))
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
