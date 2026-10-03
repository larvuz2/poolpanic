"""Give a kid on Coach Panic's skeleton a bucket to carry, and put its clips in his file:
    python3 tools/blender/carry_clips.py in.glb out.glb [--bucket tools/blender/assets/bucket.glb] [--debug-frames 0,10,20]
(plain Python with numpy, no Blender; posing.py poses the skeleton, skinpose.py reads it). The bucket goes where the hands go
because the file gets a node, `BucketMount`, a child of the chest bone (`Spine`) that the clips move, and, with `--bucket`, the
bucket itself (a plain mesh, not skinned: the Meshy 7 bucket made by game_export.py) hangs under it, in two nodes: `BucketFrame`,
which undoes the chest bone's rest pose and the armature's scale so that what is inside it is in metres in the character's own
frame, and `Bucket` (extras: its height), the mesh, standing where the hands hold it at rest. So the viewer and the game show
the same bucket in the same hands, with nothing but the file. Four clips are added:
  - CarryIdle: standing, the bucket hugged to the chest at its middle, the head scanning about (IdleScan's, with the arms
    replaced), loops;
  - CarryWalk and CarryRun: the Walk and Run clips with the arms replaced by the hold, loops: the arms are the same in every
    frame in the chest's own frame, so the hold sways with the body as a carried thing does;
  - BucketDump: one shot, 30 frames (the game plays it over one second): he leans back a little, heaves the bucket up and
    forward while it tips mouth-down (the rim goes past the horizontal), shakes it, and starts to lower it. The legs stay planted.
The numbers that matter are below (HOLD, DUMP): the bucket's pose in the chest's frame (x to his left, y up, z forward, metres
from where the chest bone is at rest) and how far it is tipped forward (degrees), and the hands are on the bucket's two sides
at its middle. A wrist the arm cannot reach is clipped to the reach (two-bone), so a pose that asks for too much shows up as
`REACH` lines in the output: how far short the hands fall of the bucket's sides, in metres."""
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import skinpose  # noqa: E402
from posing import Posing, add_clip, rx  # noqa: E402
from skinpose import Rig, matrix_quat  # noqa: E402

FPS = 24
MOUNT = "BucketMount"
CHEST = "Spine"
ARM_NODES = [s + n for s in ("Left", "Right") for n in ("Shoulder", "Arm", "ForeArm", "Hand")]

# the bucket held at the chest: its middle (x to his left, y up, z forward) from the chest bone's rest position, in the chest's
# frame; the hands on its two sides, `hand_out` from the middle and a little low
HOLD_C = (0.0, -0.06, 0.2)  # (lowered from -0.03: the rim was level with his chin in a walk)
HAND = (0.14, -0.01, 0.0)
POLE = (0.9, -0.6, -0.1)  # the elbows go out and down

# BucketDump: (frame, bucket middle, tip forward in degrees, spine lean, head pitch, shoulders hunch); ease between keys
DUMP_FRAMES = 30
DUMP = [
    (0, HOLD_C, 0.0, 0.0, 0.0),  # it starts where every carrying clip holds the bucket
    (4, (HOLD_C[0], HOLD_C[1] - 0.01, HOLD_C[2] - 0.02), -5.0, -6.0, -4.0),  # a breath in: pulled in toward the chest, leaning back
    (13, (0.0, -0.01, 0.34), 112.0, 28.0, 6.0),  # heaved up and out, tipped mouth-down, leaning over the edge
    (17, (0.0, -0.01, 0.34), 112.0, 28.0, 6.0),
    (19, (0.0, 0.0, 0.35), 124.0, 30.0, 10.0),  # a shake
    (21, (0.0, -0.01, 0.34), 106.0, 28.0, 6.0),
    (23, (0.0, 0.0, 0.35), 122.0, 30.0, 10.0),
    (30, (0.0, -0.02, 0.28), 78.0, 16.0, 6.0),  # starting to bring it down
]


def ease(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * u * (u * (u * 6 - 15) + 10)


def keyed(keys, f, column):
    """The value of column `column` of the keys at frame f (numbers or arrays), eased between keys."""
    if f <= keys[0][0]:
        return np.asarray(keys[0][column], dtype=float)
    for a, b in zip(keys, keys[1:]):
        if f <= b[0]:
            u = ease((f - a[0]) / (b[0] - a[0]))
            va, vb = np.asarray(a[column], dtype=float), np.asarray(b[column], dtype=float)
            return va + (vb - va) * u
    return np.asarray(keys[-1][column], dtype=float)


def trs_to_m(t, q, s=(1, 1, 1)):
    return skinpose.trs_matrix(np.asarray(t, dtype=float), np.asarray(q, dtype=float), np.asarray(s, dtype=float))


def add_mount_node(src, dst):
    """The file with a node MOUNT under the chest bone, at rest where the bone is (a plain node, not a joint)."""
    doc, binary = skinpose.read_glb(src)
    names = {n.get("name"): i for i, n in enumerate(doc["nodes"])}
    if MOUNT not in names:
        doc["nodes"].append({"name": MOUNT, "translation": [0.0, 0.0, 0.0], "rotation": [0.0, 0.0, 0.0, 1.0], "scale": [1.0, 1.0, 1.0]})
        doc["nodes"][names[CHEST]].setdefault("children", []).append(len(doc["nodes"]) - 1)
    write(dst, doc, binary)


def write(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(text) + 8 + len(binary)))
        f.write(struct.pack("<II", len(text), skinpose.CHUNK_JSON) + text)
        f.write(struct.pack("<II", len(binary), skinpose.CHUNK_BIN) + binary)


def add_mount_tracks(path, clip, translations, rotations):
    """Key the mount node through the clip `clip` of the file (one key per frame; translations in the file's units)."""
    doc, binary = skinpose.read_glb(path)
    binary = bytearray(binary)
    node = next(i for i, n in enumerate(doc["nodes"]) if n.get("name") == MOUNT)
    animation = next(a for a in doc["animations"] if a["name"] == clip)

    def add(values, kind, bounds=False):
        n = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[kind]
        binary.extend(b"\0" * (-len(binary) % 4))
        offset = len(binary)
        for v in values:
            binary.extend(struct.pack(f"<{n}f", *np.atleast_1d(v).astype(float)))
        doc["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(values) * n * 4})
        acc = {"bufferView": len(doc["bufferViews"]) - 1, "componentType": 5126, "count": len(values), "type": kind}
        if bounds:
            arr = np.array(values, dtype=float).reshape(len(values), n)
            acc["min"], acc["max"] = [float(x) for x in arr.min(axis=0)], [float(x) for x in arr.max(axis=0)]
        doc["accessors"].append(acc)
        return len(doc["accessors"]) - 1

    times = add([[f / FPS] for f in range(len(translations))], "SCALAR", bounds=True)
    ends = add([[0.0], [(len(translations) - 1) / FPS]], "SCALAR", bounds=True)
    quats, previous = [], None
    for q in rotations:
        q = np.asarray(q, dtype=float)
        if previous is not None and float(q @ previous) < 0:
            q = -q
        quats.append(q)
        previous = q
    for path_name, values, kind in (("translation", translations, "VEC3"), ("rotation", quats, "VEC4")):
        animation["samplers"].append({"input": times, "interpolation": "LINEAR", "output": add(values, kind)})
        animation["channels"].append({"sampler": len(animation["samplers"]) - 1, "target": {"node": node, "path": path_name}})
    animation["samplers"].append({"input": ends, "interpolation": "LINEAR", "output": add([[1.0, 1.0, 1.0], [1.0, 1.0, 1.0]], "VEC3")})
    animation["channels"].append({"sampler": len(animation["samplers"]) - 1, "target": {"node": node, "path": "scale"}})
    doc["buffers"][0]["byteLength"] = len(binary)
    write(path, doc, binary)


def embed_bucket(path, bucket_path):
    """Put the bucket's mesh in the file, under the mount: BucketMount > BucketFrame > Bucket (see the docstring)."""
    rig = Rig(path)
    P = Posing(rig)
    rest = rig.world_matrices(rig.local(None, 0.0))[rig.by_name[CHEST]]
    frame = np.linalg.inv(rest)  # the chest bone's rest pose, undone: the node's own frame is the character's, in metres
    scale = float(np.linalg.norm(frame[:3, 0]))
    rotation = frame[:3, :3] / scale
    assert abs(np.linalg.det(rotation) - 1) < 1e-6 and np.allclose(rotation @ rotation.T, np.eye(3), atol=1e-6), "the bone's rest frame is not a rotation"
    frame_t = frame[:3, 3]

    doc, binary = skinpose.read_glb(path)
    bdoc, bbin = skinpose.read_glb(bucket_path)
    binary = bytearray(binary)
    binary.extend(b"\0" * (-len(binary) % 4))
    base = len(binary)
    binary.extend(bbin)
    count = {k: len(doc.get(k, [])) for k in ("bufferViews", "accessors", "images", "samplers", "textures", "materials", "meshes", "nodes")}
    for view in bdoc["bufferViews"]:
        view = dict(view, buffer=0, byteOffset=view.get("byteOffset", 0) + base)
        doc["bufferViews"].append(view)
    for acc in bdoc["accessors"]:
        acc = dict(acc)
        acc["bufferView"] += count["bufferViews"]
        doc["accessors"].append(acc)
    for img in bdoc.get("images", []):
        doc.setdefault("images", []).append(dict(img, bufferView=img["bufferView"] + count["bufferViews"], name="BucketImage"))
    for smp in bdoc.get("samplers", []):
        doc.setdefault("samplers", []).append(dict(smp))
    for tex in bdoc.get("textures", []):
        tex = dict(tex, source=tex["source"] + count["images"])
        if "sampler" in tex:
            tex["sampler"] += count["samplers"]
        doc.setdefault("textures", []).append(tex)
    for mat in bdoc.get("materials", []):
        mat = json.loads(json.dumps(mat))
        mat["name"] = "BucketMaterial"
        for holder in (mat.get("pbrMetallicRoughness", {}), mat):
            for key, value in holder.items():
                if isinstance(value, dict) and "index" in value and key.endswith("Texture"):
                    value["index"] += count["textures"]
        doc.setdefault("materials", []).append(mat)
    mesh = json.loads(json.dumps(bdoc["meshes"][0]))
    mesh["name"] = "BucketMesh"
    for prim in mesh["primitives"]:
        prim["attributes"] = {k: v + count["accessors"] for k, v in prim["attributes"].items()}
        prim["indices"] += count["accessors"]
        prim["material"] += count["materials"]
    doc["meshes"].append(mesh)
    # the bucket stands on its base at the origin: its middle goes where the hands hold it
    top = next(a for a in bdoc["accessors"] if a.get("type") == "VEC3" and a.get("max"))
    height = float(top["max"][1] - top["min"][1])
    hold = P.P0[CHEST] + np.array(HOLD_C) - np.array([0.0, height / 2, 0.0])
    bucket = {"name": "Bucket", "mesh": count["meshes"], "translation": [float(v) for v in hold], "extras": {"height": round(height, 4)}}
    frame_node = {
        "name": "BucketFrame",
        "children": [count["nodes"] + 1],
        "translation": [float(v) for v in frame_t],
        "rotation": [float(v) for v in matrix_quat(rotation)],
        "scale": [scale, scale, scale],
    }
    doc["nodes"] += [frame_node, bucket]
    mount = next(i for i, n in enumerate(doc["nodes"]) if n.get("name") == MOUNT)
    doc["nodes"][mount].setdefault("children", []).append(count["nodes"])
    doc["buffers"][0]["byteLength"] = len(binary)
    write(path, doc, binary)
    print(f"BUCKET {bucket_path}: {height * 100:.0f} cm high, in the file under {MOUNT}, frame scale {scale:g}")


class Carrier:
    def __init__(self, rig):
        self.rig = rig
        self.P = Posing(rig)
        P = self.P
        self.chest0 = P.P0[CHEST].copy()
        self.c0 = self.chest0 + np.array(HOLD_C)  # where the bucket sits at rest (the node's rest pose is the chest bone's)
        self.rest_bone = self.bone_matrix(reset=True)

    def bone_matrix(self, reset=False):
        """The chest bone's world matrix (metres) in the current pose of P."""
        P = self.P
        if reset:
            P.reset()
        m = np.eye(4)
        m[:3, :3] = P.W[CHEST] @ P.R0[CHEST]
        m[:3, 3] = P.position(CHEST)
        return m

    def pose(self, c, tip, lean=0.0, head=0.0, hunch=0.0):
        """Pose the body leaning `lean` degrees, the bucket's middle at `c` (the chest's frame) tipped `tip` degrees, the hands
        on its sides, and return the wrist errors (m)."""
        P = self.P
        P.reset()
        P.hips(up=0.0, pitch=0.5 * lean)
        P.spine(pitch=0.5 * lean)  # the hips take half the lean, the spine the rest
        P.head(pitch=head)
        P.shoulders(forward=hunch)
        self.finish(c, tip)

    def finish(self, c, tip):
        P = self.P
        W = P.W[CHEST]
        chest = P.position(CHEST)
        Rt = rx(tip)
        errors = []
        for side, o in (("Left", 1.0), ("Right", -1.0)):
            h = np.array([o * HAND[0], HAND[1], HAND[2]])
            goal = np.asarray(c, dtype=float) + Rt @ h  # from the chest bone, in the chest's axes
            shoulder_local = W.T @ (P.position(side + "Arm") - chest)
            wrist = (goal - shoulder_local) * np.array([o, 1.0, 1.0])
            elbow, reached = P.arm(side, wrist=tuple(wrist), pole=POLE, frame_of=CHEST)
            want = P.position(side + "Arm") + W @ (goal - shoulder_local)
            errors.append(float(np.linalg.norm(reached - want)))
        self.tip, self.c = tip, np.asarray(c, dtype=float)
        self.errors = errors

    def mount_local(self):
        """The mount node's local translation (file units) and rotation in the pose of P: it carries the bucket from its rest
        pose (T_b0: at `c0`, not turned) to where it is held (T_b)."""
        P = self.P
        W = P.W[CHEST]
        bone = self.bone_matrix()
        T_b = np.eye(4)
        T_b[:3, :3] = W @ rx(self.tip)
        T_b[:3, 3] = P.position(CHEST) + W @ self.c
        T_b0 = np.eye(4)
        T_b0[:3, 3] = self.c0
        local = np.linalg.inv(bone) @ T_b @ np.linalg.inv(T_b0) @ self.rest_bone
        t = local[:3, 3] / P.armature_scale
        return t, matrix_quat(local[:3, :3])


def main():
    args = sys.argv[1:]
    debug = None
    if "--debug-frames" in args:
        i = args.index("--debug-frames")
        debug = [float(v) for v in args[i + 1].split(",")]
        del args[i : i + 2]
    bucket = None
    if "--bucket" in args:
        i = args.index("--bucket")
        bucket = args[i + 1]
        del args[i : i + 2]
    if len(args) != 2:
        raise SystemExit(__doc__)
    src, dst = args
    current = dst + ".step.glb"
    add_mount_node(src, current)

    # --- the hold: the arms at neutral, the same in every frame of CarryIdle / CarryWalk / CarryRun
    rig = Rig(current)
    carrier = Carrier(rig)
    carrier.pose(HOLD_C, 0.0)
    print("REACH hold: left {:.3f} right {:.3f}".format(*carrier.errors))
    hold = carrier.P.local()
    arm_nodes = {rig.by_name[n] for n in ARM_NODES}
    m_t, m_q = carrier.mount_local()

    def with_hold(base):
        out = dict(base)
        for node in arm_nodes:
            out[node] = hold[node]
        return out

    for name, source in (("CarryIdle", "IdleScan"), ("CarryWalk", "Walk"), ("CarryRun", "Run")):
        if source not in rig.clips:
            print("SKIP", name, "(no", source + ")")
            continue
        n = int(round(rig.length(source) * FPS))
        frames = [with_hold(rig.local(source, f / FPS)) for f in range(n + 1)]
        add_clip(rig, current + ".next", name, frames)
        os.replace(current + ".next", current)
        add_mount_tracks(current, name, [m_t] * len(frames), [m_q] * len(frames))
        rig = Rig(current)
        print("CLIP", name, len(frames), "frames")

    # --- the dump (made twice: the second time with the hips lifted by how far the first sank the feet under the floor, as
    # ground_clips.py does for the others: leaning forward tips the pelvis, which takes the heels a little lower)
    carrier = Carrier(rig)
    lift = 0.0
    for attempt in range(5):
        frames, ts, qs, worst, lowest = [], [], [], 0.0, 0.0
        for f in debug if debug else range(DUMP_FRAMES + 1):
            dump_frame(carrier, f, lift, frames, ts, qs)
            worst = max(worst, *carrier.errors)
            world = rig.world_matrices(frames[-1])
            low = float(rig.skin(rig.skin_matrices(world))[:, 1].min())
            lowest = low if f == (debug[0] if debug else 0) else min(lowest, low)
        print(f"GROUND pass {attempt + 1}: the lowest point of the clip is {lowest * 100:+.1f} cm from the floor with the hips up {lift * 100:.1f} cm")
        if abs(lowest) < 0.001:
            break
        lift -= lowest  # one height for the whole clip, as ground_clips.py does
    add_clip(rig, current + ".next", "Try" if debug else "BucketDump", frames)
    os.replace(current + ".next", current)
    add_mount_tracks(current, "Try" if debug else "BucketDump", ts, qs)
    print(f"REACH dump: the hands fall at most {worst:.3f} m short of the bucket's sides")
    if bucket and not debug:
        embed_bucket(current, bucket)
    os.replace(current, dst)
    print("CARRY", dst, os.path.getsize(dst), "bytes")


def dump_frame(carrier, f, lift, frames, ts, qs):
    """The pose of BucketDump at frame f, appended to `frames` (and the mount's local pose to ts and qs)."""
    c = keyed(DUMP, f, 1)
    tip = float(keyed(DUMP, f, 2))
    lean, head = float(keyed(DUMP, f, 3)), float(keyed(DUMP, f, 4))
    P = carrier.P
    P.reset()
    P.hips(up=lift, pitch=0.5 * lean)
    P.spine(pitch=0.5 * lean)
    P.head(pitch=head)
    P.shoulders(forward=0.3 * lean)
    carrier.finish(c, tip)
    # the legs stay where they stand: the ankles go back to the bind pose's (the hips only lean)
    for side, o in (("Left", 1.0), ("Right", -1.0)):
        hip = P.position(side + "UpLeg")
        planted = P.P0[side + "Foot"]
        d_up, d_shin, knee, ankle = P.leg_dirs(side, (planted - hip) * np.array([o, 1.0, 1.0]), pole=(0.25, 0.0, 1.0))
        P.leg_apply(side, d_up, d_shin, np.array([o * 0.25, 0.0, 1.0]))
    frames.append(P.local())
    t, q = carrier.mount_local()
    ts.append(t)
    qs.append(q)


if __name__ == "__main__":
    main()
