"""Polish a walk cycle for the game: a seamless loop and natural arms.

Loop: the clip is retimed so its first key lands on frame 0 and its last key, a copy of the first, on a whole frame N
(a clip whose last key is not a copy of the first gets one added), so the loop has no hitch. A game loops the clip
from 0 to N; a player showing it should show frames 0 to N-1 and then start again.

Arms: they hang close to the body and swing opposite the legs, with the elbow bending a little more as the arm comes
forward. The legs, hips and spine keep the clip's own motion; only the shoulders, arms, forearms and hands are
rewritten. For Mixamo-style rigs (Meshy, Tripo, Mixamo: LeftArm, LeftForeArm, LeftHand ...) and for this toolkit's own
humanoid_rig (upper_arm.L ...).

    tools/blender/run.sh tools/blender/polish_walk.py -- in.glb out.glb [--clip NAME] [--hang 9] [--forearm-hang 5]
        [--swing 20] [--swing-back 26] [--elbow-min 10] [--elbow-max 34] [--no-arms] [--keep-timing]

Degrees throughout. --hang is how far the upper arm stands off the body (0 is straight down), --forearm-hang the same
for the forearm, --swing the most the arm swings forward, --swing-back the most it swings back, --elbow-min/-max the
elbow's bend (back of the swing / front of the swing). The character faces the front (glTF +Z, Blender -Y) and the
armature is not rotated, as the glTF importer leaves it. The arms' phase follows the feet: an arm is at its furthest
forward when the opposite foot is. --keep-timing leaves the clip's times alone (no retiming, no loop closing)."""
import math
import os
import re
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

args = common.script_args()
clip = common.option(args, "--clip")
hang = math.radians(common.option(args, "--hang", 9.0, float))
forearm_hang = math.radians(common.option(args, "--forearm-hang", 5.0, float))
swing_fwd = math.radians(common.option(args, "--swing", 20.0, float))
swing_back = math.radians(common.option(args, "--swing-back", 26.0, float))
elbow_min = math.radians(common.option(args, "--elbow-min", 10.0, float))
elbow_max = math.radians(common.option(args, "--elbow-max", 34.0, float))
arms = not common.flag(args, "--no-arms")
retime = not common.flag(args, "--keep-timing")
src, dst = args[0], args[1]

# What each bone may be called once lower-cased with everything but letters removed ("upper_arm.L" is "upperarml").
ALIASES = {
    "shoulder": ("{side}shoulder", "{side}clavicle", "shoulder{c}", "clavicle{c}"),
    "upper": ("{side}arm", "{side}upperarm", "upperarm{c}"),
    "fore": ("{side}forearm", "forearm{c}"),
    "hand": ("{side}hand", "hand{c}"),
    "foot": ("{side}foot", "foot{c}"),
}
HIPS = ("hips", "pelvis", "root")


def key(name):
    return re.sub(r"[^a-z]", "", name.split(":")[-1].lower())


def find(armature, names):
    by_key = {key(b.name): b for b in armature.data.bones}
    for n in names:
        if n in by_key:
            return by_key[n]
    return None


def side_bones(armature, side):
    words = {"left": ("left", "l"), "right": ("right", "r")}[side]
    return {
        role: find(armature, [p.format(side=words[0], c=words[1]) for p in patterns])
        for role, patterns in ALIASES.items()
    }


def close_and_retime(action):
    """First key to frame 0, last key (a copy of the first) to a whole frame N. Returns N."""
    curves = [fc for fc in action.fcurves if len(fc.keyframe_points) > 1]
    t0 = min(fc.keyframe_points[0].co.x for fc in curves)
    t1 = max(fc.keyframe_points[-1].co.x for fc in curves)
    closed = all(abs(fc.keyframe_points[0].co.y - fc.keyframe_points[-1].co.y) < 1e-4 for fc in curves)
    if not closed:
        times = sorted({kp.co.x for fc in curves for kp in fc.keyframe_points})
        step = statistics.median(b - a for a, b in zip(times, times[1:]))
        for fc in curves:
            first = fc.keyframe_points[0].co.y
            kp = fc.keyframe_points.insert(t1 + step, first, options={"FAST"})
            kp.interpolation = "LINEAR"
        t1 += step
    n = max(1, round(t1 - t0))
    scale = n / (t1 - t0)
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.co.x = (kp.co.x - t0) * scale
            kp.handle_left.x = (kp.handle_left.x - t0) * scale
            kp.handle_right.x = (kp.handle_right.x - t0) * scale
        fc.update()
    print("LOOP", "closed" if closed else "closing key added", "length", round(t1 - t0, 2), "->", n, "frames")
    return n


common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
armatures = [o for o in scene.objects if o.type == "ARMATURE"]
if not armatures:
    raise SystemExit("No armature in " + src)
arm = armatures[0]
if max(abs(x) for x in arm.rotation_euler) > 1e-4:
    print("WARNING: the armature is rotated; the forward and up axes below assume it is not")
action = bpy.data.actions.get(clip) if clip else (bpy.data.actions[0] if bpy.data.actions else None)
if not action:
    raise SystemExit("No animation clip in " + src)
arm.animation_data_create().action = action
if retime:
    n = close_and_retime(action)
    lo, hi = 0, n
else:
    lo, hi = int(round(action.frame_range[0])), int(round(action.frame_range[1]))
scene.frame_start, scene.frame_end = lo, hi

if arms:
    pose = arm.pose.bones
    hips = find(arm, HIPS)
    sides = {s: side_bones(arm, s) for s in ("left", "right")}
    for s, found in sides.items():
        missing = [role for role, b in found.items() if b is None]
        if missing:
            raise SystemExit(f"Cannot find the {s} {', '.join(missing)} bone (bones: {[b.name for b in arm.data.bones]})")
    if hips is None:
        raise SystemExit("Cannot find the hips bone")
    frames = list(range(lo, hi + 1))
    chest = sides["left"]["shoulder"].parent
    if chest is None:
        raise SystemExit("The shoulders have no parent bone to follow")

    # Which way is out for each arm: +1 where the shoulder lies on +X (the character's left).
    out = {s: 1.0 if sides[s]["upper"].head_local.x > 0 else -1.0 for s in sides}
    # Rest directions (armature space) of the upper arm and forearm: toward the next joint.
    rest_dir = {
        s: {
            "upper": (f["fore"].head_local - f["upper"].head_local).normalized(),
            "fore": (f["hand"].head_local - f["fore"].head_local).normalized(),
        }
        for s, f in sides.items()
    }

    def rx(angle):
        return Matrix.Rotation(angle, 3, "X")

    # The clip's own rotations of these bones are replaced: drop them so what is set below is what is evaluated.
    chain = [found[r] for found in sides.values() for r in ("shoulder", "upper", "fore", "hand")]
    chain_names = {b.name for b in chain}
    for fc in list(action.fcurves):
        m = re.match(r'pose\.bones\["(.+)"\]\.rotation_quaternion', fc.data_path)
        if m and m.group(1) in chain_names:
            action.fcurves.remove(fc)
    for b in chain:
        pose[b.name].rotation_mode = "QUATERNION"

    # Pass 1: the feet's phase, from the clip as it is (they are not touched).
    fwd = {"left": [], "right": []}
    for f in frames:
        scene.frame_set(f)
        hip_y = pose[hips.name].head.y
        for s in fwd:
            fwd[s].append(-(pose[sides[s]["foot"].name].head.y - hip_y))  # forward is -Y
    peak = max(abs(v) for vs in fwd.values() for v in vs) or 1.0

    # Pass 2: aim the arms frame by frame, in order down each chain, and remember the result.
    solved = {b.name: [] for b in chain}
    for i, f in enumerate(frames):
        scene.frame_set(f)
        chest_pose = pose[chest.name].matrix.to_3x3().to_quaternion().to_matrix()
        chest_rest = chest.matrix_local.to_3x3().to_quaternion().to_matrix()
        torso = chest_pose @ chest_rest.inverted()  # how far the chest has turned from its rest pose
        for s, found in sides.items():
            other = "right" if s == "left" else "left"
            phase = max(-1.0, min(1.0, fwd[other][i] / peak))  # forward when the opposite foot is forward
            theta = swing_fwd * phase if phase >= 0 else swing_back * phase
            bend = elbow_min + (elbow_max - elbow_min) * (phase + 1) / 2
            o = out[s]
            aim = {
                "upper": torso @ rx(-theta) @ Vector((o * math.sin(hang), 0, -math.cos(hang))),
                "fore": torso @ rx(-(theta + bend)) @ Vector((o * math.sin(forearm_hang), 0, -math.cos(forearm_hang))),
            }
            pose[found["shoulder"].name].rotation_quaternion = Quaternion((1, 0, 0, 0))  # follows the chest
            bpy.context.view_layer.update()
            for role in ("upper", "fore"):
                bone = found[role]
                pb = pose[bone.name]
                rest = bone.matrix_local.to_3x3().to_quaternion().to_matrix()
                turn = rest_dir[s][role].rotation_difference(aim[role]).to_matrix()  # the shortest turn onto the aim
                target = (turn @ rest).to_4x4()
                target.translation = pb.matrix.translation
                pb.matrix = target
                bpy.context.view_layer.update()
            pose[found["hand"].name].rotation_quaternion = Quaternion((1, 0, 0, 0))  # keeps its angle to the forearm
            bpy.context.view_layer.update()
            for role in ("shoulder", "upper", "fore", "hand"):
                q = Quaternion(pose[found[role].name].rotation_quaternion)
                last = solved[found[role].name]
                if last and last[-1].dot(q) < 0:
                    q.negate()  # the same turn by the short way round, so neighbouring frames interpolate
                last.append(q)

    for b in chain:
        pb = pose[b.name]
        for f, q in zip(frames, solved[b.name]):
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f)
        for fc in action.fcurves:
            if fc.data_path == f'pose.bones["{b.name}"].rotation_quaternion':
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
    print("ARMS swing", math.degrees(swing_fwd), "fwd", math.degrees(swing_back), "back; hang", math.degrees(hang))

scene.frame_set(lo)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
)
print("CLIP", action.name, "frames", lo, "to", hi)
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
