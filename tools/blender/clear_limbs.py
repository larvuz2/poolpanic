"""Keep a character's arms and legs out of its body in every clip (a belly the Coach's slim clips never had to go round):
    python3 tools/blender/clear_limbs.py in.glb out.glb [--only Walk,Run] [--oneshot Cannonball] [--arms-only Cannonball]
        [--overlap 0.015] [--arm-max 50] [--knee-min 0.3]
(plain Python with numpy and scipy, no Blender). A clip taken from another body (retarget_clips.py) hangs the arms by the
body's sides, swings them past the hips and kicks the heels up behind; on a wide belly and a wide behind that puts them
inside the body. This tool plays every clip on the skinned mesh and, frame by frame, finds how much it has to change to be
clear, then writes that into the clip.
How. The torso is a volume, not a surface (skinpose.Volume: the filled body in its bind pose, restricted to the part nearer
the spine's bones than any limb's, carried by the skin weights). The limb is the vertices its bones carry, beyond a few
centimetres of the joint it hangs from (an armpit is where an arm meets the body, so it overlaps by nature).
  Arms (all but the part nearest the shoulder) are kept out of what lies lower than the shoulders (a raised arm meets the neck
  and the upper chest by nature, a hanging one the belly): the whole arm is swung outward about the shoulder, by the shortest
  turn, which is about the axis out of the chest for an arm that hangs and the vertical one for an arm held forward. The arm
  bone's local rotation is multiplied by that turn, so the swing and the bend the clip has stay as they are.
  Legs: the shin and foot are kept out of the hips and behind (a Run's heel kick goes into a wide behind): the knee's bend is
  scaled down, the knee's local rotation moved a share of the way back to its rest, until the shin is clear.
The least change that leaves the limb no more than `--overlap` metres (1.5 cm: skin pressing on skin; a thick arm rests on a
round belly even in a T-pose) inside the torso is found frame by frame (a scan, then bisection), against the torso as it is
before the turn. The skin of the armpit and the flank follows the arm's own weights, so in the finished clip it is dragged out a
little with the arm: the report also says how deep the arm is against the torso so deformed (the upper arm, which rests on
the belly's flank, is up to about 5 cm in a few frames; the forearm and hand stay out),
smoothed in time (the biggest change wins in a short window, then a blur, so a limb never snaps and is never closer than
found), and written back as that bone's rotation keys. A clip that is already clear is left as it is, byte for byte, and the
loop of a looping clip stays closed (the smoothing wraps); a one-shot clip (`--oneshot`, a jump that does not repeat) has its own
last frame and no wrapping. `--arms-only` leaves the legs of the clips it names alone (a tuck puts the shins under the belly on
purpose). Only the arm and knee bones' rotation keys change."""
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import skinpose  # noqa: E402
from skinpose import Rig, Volume  # noqa: E402

FPS = 24
SKIP = 0.13  # metres from the shoulder: the armpit and the shoulder cap overlap the torso by nature
TORSO_BELOW = 0.05  # the torso an arm is kept out of is what lies this far below the shoulder joints and lower
KNEE_SKIP = 0.0  # metres from the knee (the shin's own top is on the thigh, not on the torso)


def args_of(argv):
    options = {"--only": None, "--oneshot": [], "--arms-only": [], "--overlap": 0.015, "--arm-max": 50.0, "--knee-min": 0.3}
    rest = []
    i = 0
    while i < len(argv):
        if argv[i] in options:
            options[argv[i]] = argv[i + 1].split(",") if argv[i] in ("--only", "--oneshot", "--arms-only") else float(argv[i + 1])
            i += 2
        else:
            rest.append(argv[i])
            i += 1
    return options, rest


class Solver:
    def __init__(self, rig, volume):
        self.rig = rig
        self.volume = volume
        dom = rig.dominant
        self.arms, self.legs = {}, {}
        for side, sign in (("Left", 1.0), ("Right", -1.0)):
            arm = rig.by_name[side + "Arm"]
            self.arms[side] = {
                "vertices": np.where(np.isin(dom, [rig.index[side + n] for n in ("Arm", "ForeArm", "Hand")]))[0],
                "node": arm,
                "elbow": rig.by_name[side + "ForeArm"],
                "hand": rig.by_name[side + "Hand"],
                "parent": rig.parent[arm],
                "out": np.array([sign, 0.0, 0.0]),  # away from the body's middle line
                "forward": np.array([0.0, 0.0, sign]),  # the fallback axis: out of the chest, turning a hanging arm outward
            }
            knee = rig.by_name[side + "Leg"]
            self.legs[side] = {
                "vertices": np.where(np.isin(dom, [rig.index[side + n] for n in ("Leg", "Foot", "ToeBase")]))[0],
                "node": knee,
                "rest": rig.rest_trs[knee][1],
            }

    # -- arms ------------------------------------------------------------------------------------------------------------
    def swing_axis(self, side, world):
        """The axis (in the shoulder bone's frame) a positive turn swings the arm outward about, in this pose."""
        info = self.arms[side]
        d = world[info["elbow"]][:3, 3] - world[info["node"]][:3, 3]  # the upper arm's direction: it is what hangs by the belly
        d = d / np.linalg.norm(d)
        a = np.cross(d, info["out"])
        a = info["forward"] if np.linalg.norm(a) < 0.25 else a / np.linalg.norm(a)
        return np.linalg.inv(world[info["parent"]][:3, :3]) @ a

    def arm_depth(self, side, local, tree, turn, axis=None):
        """How far the arm's worst vertex is inside the torso (metres, <= 0 when clear), with the arm turned out by `turn`
        radians about `axis`."""
        rig, info = self.rig, self.arms[side]
        trs = local
        if turn:
            trs = dict(local)
            t, q, s = trs[info["node"]]
            trs[info["node"]] = (t, skinpose.quat_multiply(skinpose.axis_angle_quat(axis, turn), q), s)
        world = rig.world_matrices(trs)
        points = rig.skin(rig.skin_matrices(world), info["vertices"])
        keep = np.linalg.norm(points - world[info["node"]][:3, 3], axis=1) > SKIP
        return float(-self.volume.signed(tree, points[keep]).min())

    def arm_depth_dragged(self, side, local, turn, axis):
        """The same depth, with the torso as the turned pose deforms it: the skin of the armpit and the flank follows the
        arm's own weights, so it is dragged out a little with the arm. (arm_turn works on the torso as it is before the turn,
        which is what is kept off the arm; this is what the finished clip measures.)"""
        rig, info = self.rig, self.arms[side]
        trs = dict(local)
        t, q, s = trs[info["node"]]
        trs[info["node"]] = (t, skinpose.quat_multiply(skinpose.axis_angle_quat(axis, turn), q), s)
        world = rig.world_matrices(trs)
        points = rig.skin(rig.skin_matrices(world), info["vertices"])
        keep = np.linalg.norm(points - world[info["node"]][:3, 3], axis=1) > SKIP
        return float(-self.volume.signed(self.volume.tree(rig.skin_matrices(world)), points[keep]).min())

    def arm_turn(self, side, local, tree, margin, limit, step=3.0):
        """(the least outward turn in radians that leaves the arm no more than `margin` metres inside the torso, the axis it is about):
        scanned outward in `step` degrees, then refined, so a clear gap behind a blocked one is not taken for the answer."""
        axis = self.swing_axis(side, self.rig.world_matrices(local))
        d0 = self.arm_depth(side, local, tree, 0.0)
        if d0 <= margin:
            return 0.0, axis
        previous, best = 0.0, (d0, 0.0)
        for degrees in np.arange(step, limit + 1e-9, step):
            turn = math.radians(degrees)
            d = self.arm_depth(side, local, tree, turn, axis)
            if d <= margin:
                lo, hi = previous, turn
                for _ in range(4):
                    mid = (lo + hi) / 2
                    lo, hi = (lo, mid) if self.arm_depth(side, local, tree, mid, axis) <= margin else (mid, hi)
                return hi, axis
            if d < best[0]:
                best = (d, turn)
            previous = turn
        return best[1], axis  # nothing clears it: the turn that comes nearest

    # -- legs ------------------------------------------------------------------------------------------------------------
    def knee_depth(self, side, local, tree, share):
        """How far the shin and foot's worst vertex is inside the torso with the knee's bend scaled to `share` (1: as is)."""
        rig, info = self.rig, self.legs[side]
        trs = local
        if share < 1.0:
            trs = dict(local)
            t, q, s = trs[info["node"]]
            trs[info["node"]] = (t, skinpose.slerp(info["rest"], q if np.dot(info["rest"], q) >= 0 else -q, share), s)
        world = rig.world_matrices(trs)
        points = rig.skin(rig.skin_matrices(world), info["vertices"])
        return float(-self.volume.signed(tree, points).min())

    def knee_share(self, side, local, tree, margin, floor, step=0.05):
        """The largest share of the knee's bend (1: all of it) that leaves the shin and foot no more than `margin` metres inside the torso."""
        d0 = self.knee_depth(side, local, tree, 1.0)
        if d0 <= margin:
            return 1.0
        previous, best = 1.0, (d0, 1.0)
        for share in np.arange(1.0 - step, floor - 1e-9, -step):
            d = self.knee_depth(side, local, tree, share)
            if d <= margin:
                lo, hi = share, previous  # lo is clear, hi is not
                for _ in range(4):
                    mid = (lo + hi) / 2
                    lo, hi = (mid, hi) if self.knee_depth(side, local, tree, mid) <= margin else (lo, mid)
                return lo
            if d < best[0]:
                best = (d, share)
            previous = share
        return best[1]


def smooth_amounts(amounts, loops=True, width=2, blur=2):
    """The biggest amount within `width` frames either side, then a short blur (wrapping if the clip loops)."""
    n = len(amounts)
    pad = lambda a, k: np.concatenate([a[-k:], a, a[:k]]) if loops else np.concatenate([np.full(k, a[0]), a, np.full(k, a[-1])])
    a = pad(np.asarray(amounts, dtype=float), width)
    a = np.array([a[i : i + 2 * width + 1].max() for i in range(n)])
    kernel = np.array([math.exp(-0.5 * (k / (blur * 0.6)) ** 2) for k in range(-blur, blur + 1)])
    kernel /= kernel.sum()
    a = pad(a, blur)
    return np.array([float(a[i : i + 2 * blur + 1] @ kernel) for i in range(n)])


def write_rotations(doc, binary, node, clip_name, values):
    """Overwrite the rotation keys of `node` in clip `clip_name` (an Nx4 array); the accessor must be its own."""
    animation = next(a for a in doc["animations"] if a["name"] == clip_name)
    channel = next(c for c in animation["channels"] if c["target"]["node"] == node and c["target"]["path"] == "rotation")
    sampler = animation["samplers"][channel["sampler"]]
    uses = sum(1 for a in doc["animations"] for s in a["samplers"] if s["output"] == sampler["output"])
    if uses != 1:
        raise SystemExit(f"{clip_name}: the rotation keys of node {node} are shared with another track")
    acc = doc["accessors"][sampler["output"]]
    view = doc["bufferViews"][acc["bufferView"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or 16
    assert acc["componentType"] == 5126 and acc["type"] == "VEC4" and acc["count"] == len(values)
    for k, q in enumerate(values):
        struct.pack_into("<4f", binary, start + k * stride, *[float(v) for v in q])
    if "min" in acc:
        acc["min"] = [float(min(v[c] for v in values)) for c in range(4)]
        acc["max"] = [float(max(v[c] for v in values)) for c in range(4)]


def write_glb(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(text), skinpose.CHUNK_JSON) + text)
        f.write(struct.pack("<II", len(binary), skinpose.CHUNK_BIN) + binary)


def solve_clip(solver, name, margin, arm_max, knee_min, loops=True, legs=True):
    """Per frame and side: the arm's outward turn and its axis, the knee's share of its bend; and the worst depths before
    and after."""
    rig = solver.rig
    frames = int(round(rig.length(name) * FPS)) + (0 if loops else 1)  # a looping clip's last frame is its first again
    turns = {s: [] for s in solver.arms}
    axes = {s: [] for s in solver.arms}
    shares = {s: [] for s in solver.legs}
    before = {("arm", s): -1.0 for s in solver.arms} | {("leg", s): -1.0 for s in solver.legs}
    locals_, trees = [], []
    for f in range(frames):
        local = rig.local(name, f / FPS)
        tree = solver.volume.tree(rig.skin_matrices(rig.world_matrices(local)))
        locals_.append(local)
        trees.append(tree)
        for side in solver.arms:
            before[("arm", side)] = max(before[("arm", side)], solver.arm_depth(side, local, tree, 0.0))
            turn, axis = solver.arm_turn(side, local, tree, margin, arm_max)
            turns[side].append(turn)
            axes[side].append(axis)
            if legs:
                before[("leg", side)] = max(before[("leg", side)], solver.knee_depth(side, local, tree, 1.0))
                shares[side].append(solver.knee_share(side, local, tree, margin, knee_min))
            else:
                shares[side].append(1.0)
    turn_s = {s: smooth_amounts(t, loops) for s, t in turns.items()}
    reduce_s = {s: smooth_amounts(1.0 - np.asarray(v), loops) for s, v in shares.items()}  # how much of the bend is taken away
    after = {k: -1.0 for k in before}
    dragged = {s: -1.0 for s in solver.arms}
    for f in range(frames):
        for side in solver.arms:
            after[("arm", side)] = max(after[("arm", side)], solver.arm_depth(side, locals_[f], trees[f], turn_s[side][f], axes[side][f]))
            dragged[side] = max(dragged[side], solver.arm_depth_dragged(side, locals_[f], turn_s[side][f], axes[side][f]))
            if legs:
                after[("leg", side)] = max(after[("leg", side)], solver.knee_depth(side, locals_[f], trees[f], 1.0 - reduce_s[side][f]))
    return turn_s, axes, reduce_s, before, after, dragged


def main():
    options, rest = args_of(sys.argv[1:])
    if len(rest) != 2:
        raise SystemExit(__doc__)
    src, dst = rest
    only, margin = options["--only"], options["--overlap"]
    rig = Rig(src)
    world0 = rig.world_matrices(rig.local(None, 0.0))
    shoulder = max(world0[rig.by_name[side + "Arm"]][1, 3] for side in ("Left", "Right"))
    volume = Volume(rig, below=shoulder - TORSO_BELOW)
    solver = Solver(rig, volume)
    doc, binary = rig.doc, bytearray(rig.binary)
    names = only or sorted(rig.clips)
    changed = 0
    cm = lambda v: "clear" if v <= margin else f"{v * 100:+.1f}"
    for name in names:
        if name not in rig.clips:
            raise SystemExit(f"{src} has no clip {name}; it has {sorted(rig.clips)}")
        loops = name not in options["--oneshot"]
        legs = name not in options["--arms-only"]
        frames = int(round(rig.length(name) * FPS)) + (0 if loops else 1)
        turn_s, axes, reduce_s, before, after, dragged = solve_clip(solver, name, margin, options["--arm-max"], options["--knee-min"], loops, legs)
        leg_note = (
            f"legs {cm(before[('leg', 'Left')])}/{cm(before[('leg', 'Right')])} -> {cm(after[('leg', 'Left')])}/{cm(after[('leg', 'Right')])} cm"
            f" (knee bend cut by up to {100 * max(reduce_s['Left'].max(), reduce_s['Right'].max()):.0f}%)"
            if legs
            else "legs left alone"
        )
        print(
            f"CLEAR {name:12s} arms {cm(before[('arm', 'Left')])}/{cm(before[('arm', 'Right')])} -> {cm(after[('arm', 'Left')])}/{cm(after[('arm', 'Right')])} cm"
            f" (turned out up to {math.degrees(max(turn_s['Left'].max(), turn_s['Right'].max())):.1f}°; with the torso dragged by the arm's own skin: {cm(dragged['Left'])}/{cm(dragged['Right'])}); " + leg_note
        )
        touched = False
        for side, info in solver.arms.items():
            if turn_s[side].max() < 1e-6:
                continue
            times, values = rig.clips[name][(info["node"], "rotation")]
            offsets = list(turn_s[side]) + ([turn_s[side][0]] if loops else [])  # a loop's closing key
            around = list(axes[side]) + ([axes[side][0]] if loops else [])
            new = []
            for t, q in zip(times, values):
                f = min(int(round(t * FPS)), len(offsets) - 1)
                r = skinpose.quat_multiply(skinpose.axis_angle_quat(around[f], offsets[f]), q)
                new.append(-r if new and float(np.dot(r, new[-1])) < 0 else r)  # one side, so a viewer takes the short way
            write_rotations(doc, binary, info["node"], name, new)
            touched = True
        for side, info in solver.legs.items():
            if reduce_s[side].max() < 1e-6:
                continue
            times, values = rig.clips[name][(info["node"], "rotation")]
            cut = list(reduce_s[side]) + ([reduce_s[side][0]] if loops else [])
            new = []
            for t, q in zip(times, values):
                f = min(int(round(t * FPS)), len(cut) - 1)
                q = q if np.dot(info["rest"], q) >= 0 else -q
                r = skinpose.slerp(info["rest"], q, 1.0 - cut[f])
                new.append(-r if new and float(np.dot(r, new[-1])) < 0 else r)
            write_rotations(doc, binary, info["node"], name, new)
            touched = True
        changed += touched
    write_glb(dst, doc, binary)
    print(f"CLEARED {dst}: {changed} of {len(names)} clips changed, {os.path.getsize(dst)} bytes")


if __name__ == "__main__":
    main()
