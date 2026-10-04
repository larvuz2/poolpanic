"""Pose a character on Coach Panic's skeleton from joint angles and end-effector targets, without Blender, and write the
result as the frames of a clip (numpy; used by cannonball_clip.py).
    pose = Posing(Rig("character.glb"))
    pose.hips(up=0.4, pitch=-10)                    # where the pelvis is, and how it is turned
    pose.spine(pitch=25); pose.head(pitch=20)
    pose.arm("Left", wrist=(0.4, -0.3, 0.2), pole=(1, 0, -1))
    pose.leg("Left", ankle=(0.2, 0.1, 0.1), pole=(0, 1, 0))
    local = pose.local()                             # {node: (translation, rotation, scale)}, as Rig.local() makes them
Conventions (glTF world, metres): x to the character's left, y up, z forward. A rotation is a *world delta* of a bone: the
bone's world rotation is W * its bind-pose rotation, so "pitch" is about the world x axis whatever the bone's own axes are
(the bones of a Meshy rig have odd ones), + pitching the top forward. A bone's local rotation, which is what a clip stores, is
R_bind(parent)^T * W(parent)^T * W(bone) * R_bind(bone); a joint's position follows from the parents' rotations and the bind pose.
Angles are in degrees at the interface."""
import math

import numpy as np

import skinpose


def rot_axis(axis, angle):
    a = np.asarray(axis, dtype=float)
    a = a / np.linalg.norm(a)
    c, s = math.cos(angle), math.sin(angle)
    x, y, z = a
    return np.array(
        [
            [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
            [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
            [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)],
        ]
    )


def rx(deg):
    return rot_axis((1, 0, 0), math.radians(deg))


def ry(deg):
    return rot_axis((0, 1, 0), math.radians(deg))


def rz(deg):
    return rot_axis((0, 0, 1), math.radians(deg))


def unit(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


def frame(direction, pole):
    """A frame with its y along `direction` and its x toward `pole` (the part of it at right angles to the direction)."""
    y = unit(direction)
    p = np.asarray(pole, dtype=float)
    x = p - y * float(p @ y)
    if np.linalg.norm(x) < 1e-6:  # a pole along the direction says nothing: any side will do
        x = np.cross(y, np.array([0.0, 0.0, 1.0]))
        if np.linalg.norm(x) < 1e-6:
            x = np.cross(y, np.array([1.0, 0.0, 0.0]))
    x = unit(x)
    return np.stack([x, y, np.cross(x, y)], axis=1)


def aim(rest_direction, rest_pole, direction, pole):
    """The world rotation that turns a bone from lying along `rest_direction` bending toward `rest_pole` to lying along
    `direction` bending toward `pole`. Aiming by a direction and a pole never flips the way a shortest turn does."""
    return frame(direction, pole) @ frame(rest_direction, rest_pole).T


def two_bone(root, end, a, b, pole):
    """The middle joint of a chain of two bones (lengths a, b) from `root` reaching for `end`, bent toward `pole`."""
    to = end - root
    d = max(abs(a - b) + 1e-4, min(a + b - 1e-4, float(np.linalg.norm(to))))
    n = unit(to)
    x = (a * a - b * b + d * d) / (2 * d)
    h = math.sqrt(max(a * a - x * x, 0.0))
    side = np.asarray(pole, dtype=float) - n * float(np.asarray(pole, dtype=float) @ n)
    side = unit(side) if np.linalg.norm(side) > 1e-6 else unit(np.array([0.0, 0.0, 1.0]) - n * n[2])
    return root + n * x + side * h


def hinge_poles(d1, d2, pole):
    """The poles to aim the two bones of a hinge (an elbow, a knee): `d1` is the direction of the upper bone and `d2` of the lower,
    `pole` the way the joint's point goes. Each bone's pole is the direction its front faces, at right angles to the bone in the
    bend's plane, so it turns with the bend and never degenerates: a single pole for both bones does, for the lower one, when
    the joint bends toward the pole's own line (a forearm folded to 90 degrees has the elbow's pole along itself), and then
    the bone's roll flips from one frame to the next as the angle goes through 90. A joint that is straight (to about
    3 degrees) has no plane: both bones take `pole`."""
    c = np.cross(d1, d2)
    n = float(np.linalg.norm(c))
    if n < 0.05:
        return pole, pole
    h = c / n
    return np.cross(d1, h), np.cross(d2, h)


class Posing:
    SPINE = ("Spine02", "Spine01", "Spine")
    ARM_POLE = np.array([0.0, 0.0, -1.0])  # an arm held out bends its elbow toward the back
    LEG_POLE = np.array([0.0, 0.0, 1.0])  # a leg bends its knee forward

    def __init__(self, rig):
        self.rig = rig
        world = rig.world_matrices(rig.local(None, 0.0))
        self.R0, self.P0 = {}, {}
        for name in rig.names:
            m = world[rig.by_name[name]]
            scale = np.linalg.norm(m[:3, 0])
            self.R0[name] = m[:3, :3] / scale
            self.P0[name] = m[:3, 3].copy()
        self.parent = {}
        for name in rig.names:
            p = rig.parent.get(rig.by_name[name])
            self.parent[name] = rig.nodes[p].get("name") if p is not None and rig.nodes[p].get("name") in rig.index else None
        self.root = next(n for n in rig.names if self.parent[n] is None)
        self.armature_scale = float(np.linalg.norm(world[rig.parent[rig.by_name[self.root]]][:3, 0])) if rig.by_name[self.root] in rig.parent else 1.0
        self.length = {
            n: float(np.linalg.norm(self.P0[n] - self.P0[self.parent[n]])) for n in rig.names if self.parent[n]
        }
        self.reset()

    # ---- state -----------------------------------------------------------------------------------------------------------
    def reset(self):
        self.W = {n: np.eye(3) for n in self.rig.names}
        self.shift = np.zeros(3)  # how far the pelvis has moved from the bind pose (world metres)
        self.set = {}  # the bones whose world rotation has been given directly (not inherited)

    def rest_dir(self, a, b):
        return unit(self.P0[b] - self.P0[a])

    def position(self, name):
        """World position of a joint in the current pose."""
        chain = []
        n = name
        while n is not None:
            chain.append(n)
            n = self.parent[n]
        p = self.P0[self.root] + self.shift
        for child, parent in zip(reversed(chain[:-1]), reversed(chain[1:])):
            p = p + self.W[parent] @ (self.P0[child] - self.P0[parent])
        return p

    def _inherit(self):
        """Bones nobody posed follow their parent's world rotation (a hand with its forearm, a toe with its foot, a belly bone
        with the spine)."""
        for n in self.rig.names:  # the rig lists parents first
            if n not in self.set and self.parent[n] is not None:
                self.W[n] = self.W[self.parent[n]].copy()

    # ---- the body ----------------------------------------------------------------------------------------------------------
    def hips(self, up=0.0, forward=0.0, left=0.0, pitch=0.0, yaw=0.0, roll=0.0):
        """The pelvis: moved (metres) and turned (degrees: + pitch tips the top forward, + yaw turns to the left, + roll
        tips the top to the left)."""
        self.shift = np.array([left, up, forward], dtype=float)
        self.W[self.root] = ry(yaw) @ rx(pitch) @ rz(roll)
        self.set[self.root] = True

    def spine(self, pitch=0.0, yaw=0.0, roll=0.0, shares=(0.3, 0.4, 0.3)):
        """The three spine bones share a turn (degrees) on top of the pelvis's, each its `share` of it."""
        parent = self.W[self.root]
        for n, s in zip(self.SPINE, shares):
            parent = parent @ ry(yaw * s) @ rx(pitch * s) @ rz(roll * s)
            self.W[n] = parent
            self.set[n] = True

    def head(self, pitch=0.0, yaw=0.0, roll=0.0, neck=0.4):
        """The neck takes `neck` of the head's turn, the head the rest (degrees: + pitch looks down)."""
        base = self.W["Spine"]
        self.W["neck"] = base @ ry(yaw * neck) @ rx(pitch * neck) @ rz(roll * neck)
        self.W["Head"] = self.W["neck"] @ ry(yaw * (1 - neck)) @ rx(pitch * (1 - neck)) @ rz(roll * (1 - neck))
        for n in ("neck", "Head"):
            self.set[n] = True

    def shoulders(self, forward=0.0, up=0.0):
        """The collar bones, turned forward (a hunch) and up (a shrug), in degrees."""
        for side, sign in (("Left", 1.0), ("Right", -1.0)):
            n = side + "Shoulder"
            self.W[n] = self.W["Spine"] @ ry(-sign * forward) @ rz(sign * up)
            self.set[n] = True

    # ---- limbs -------------------------------------------------------------------------------------------------------------
    def arm(self, side, wrist, pole, reach=None, frame_of="Spine", twist=0.0):
        """The arm of `side`: the wrist goes to `wrist` (world metres from the shoulder joint, in the axes of the bone
        `frame_of`'s turn: x out, y up, z forward, out being toward the arm's own side) and the elbow bends toward `pole`
        (the same axes). Two-bone, so the arm is never stretched: a target out of reach is clipped to the reach."""
        o = 1.0 if side == "Left" else -1.0
        up, fore, hand = side + "Arm", side + "ForeArm", side + "Hand"
        a, b = self.length[fore], self.length[hand]
        shoulder = self.position(up)
        axes = self.W[frame_of]
        flip = np.array([o, 1.0, 1.0])
        goal = shoulder + axes @ (np.asarray(wrist, dtype=float) * flip)
        pole_w = axes @ (np.asarray(pole, dtype=float) * flip)
        elbow = two_bone(shoulder, goal, a, b, pole_w)
        wrist_at = elbow + unit(goal - elbow) * b if np.linalg.norm(goal - shoulder) > a + b else goal
        d_up, d_fore = unit(elbow - shoulder), unit(wrist_at - elbow)
        p_up, p_fore = hinge_poles(d_up, d_fore, pole_w)
        self.W[up] = aim(self.rest_dir(up, fore), self.ARM_POLE, d_up, p_up) @ rot_axis(d_up, math.radians(twist) / 3)
        self.W[fore] = aim(self.rest_dir(fore, hand), self.ARM_POLE, d_fore, p_fore) @ rot_axis(d_fore, math.radians(twist) * 2 / 3)
        self.W[hand] = self.W[fore].copy()  # the hand follows the forearm
        for n in (up, fore, hand):
            self.set[n] = True
        return elbow, wrist_at

    def leg_apply(self, side, d_up, d_shin, pole, plantar=0.0, foot_world=None):
        """Aim the thigh along `d_up` and the shin along `d_shin`, the knee toward `pole` (world vectors), and set the foot:
        turned `plantar` degrees from the shin's line (+ points the toes), or, with `foot_world`, to that world rotation."""
        up, shin_n, ankle_n, toe = side + "UpLeg", side + "Leg", side + "Foot", side + "ToeBase"
        p_up, p_shin = hinge_poles(d_up, d_shin, pole)
        self.W[up] = aim(self.rest_dir(up, shin_n), self.LEG_POLE, d_up, p_up)
        self.W[shin_n] = aim(self.rest_dir(shin_n, ankle_n), self.LEG_POLE, d_shin, p_shin)
        self.W[ankle_n] = self.W[shin_n] @ rx(plantar) if foot_world is None else foot_world
        self.W[toe] = self.W[ankle_n].copy()
        for n in (up, shin_n, ankle_n, toe):
            self.set[n] = True

    def leg_dirs(self, side, ankle, pole=None, frame_of=None):
        """(thigh direction, shin direction, knee, ankle) of a leg whose ankle goes to `ankle` (metres from the hip joint of
        the current pose, x out toward the leg's own side; in the pelvis's axes if `frame_of` is "hips", else world axes)
        with the knee bent toward `pole`. Two-bone, so the leg is never stretched: a target out of reach is clipped."""
        o = 1.0 if side == "Left" else -1.0
        up, shin_n, ankle_n = side + "UpLeg", side + "Leg", side + "Foot"
        a, b = self.length[shin_n], self.length[ankle_n]
        hip = self.position(up)
        axes = self.W[self.root] if frame_of == "hips" else np.eye(3)
        flip = np.array([o, 1.0, 1.0])
        goal = hip + axes @ (np.asarray(ankle, dtype=float) * flip)
        pole_w = axes @ (np.asarray(self.LEG_POLE if pole is None else pole, dtype=float) * flip)
        knee = two_bone(hip, goal, a, b, pole_w)
        reached = knee + unit(goal - knee) * b if np.linalg.norm(goal - hip) > a + b else goal
        return unit(knee - hip), unit(reached - knee), knee, reached

    def leg(self, side, ankle, pole=None, frame_of=None, foot=0.0, foot_world=None):
        """The leg of `side` with its ankle on a target (see leg_dirs); returns the knee and ankle positions."""
        o = 1.0 if side == "Left" else -1.0
        d_up, d_shin, knee, reached = self.leg_dirs(side, ankle, pole, frame_of)
        axes = self.W[self.root] if frame_of == "hips" else np.eye(3)
        pole_w = axes @ (np.asarray(self.LEG_POLE if pole is None else pole, dtype=float) * np.array([o, 1.0, 1.0]))
        self.leg_apply(side, d_up, d_shin, pole_w, foot, foot_world)
        return knee, reached

    def leg_fk(self, side, thigh, shin, frame_of="hips", foot=0.0):
        """The leg of `side` from the directions its two bones point (unit-ish vectors: x out toward its own side, y up, z
        forward, in the pelvis's axes unless `frame_of` is None, for world axes). The knee points away from the way the shin
        folds back against the thigh. Returns the knee and ankle positions."""
        o = 1.0 if side == "Left" else -1.0
        axes = self.W[self.root] if frame_of == "hips" else np.eye(3)
        flip = np.array([o, 1.0, 1.0])
        d_up, d_shin = unit(axes @ (np.asarray(thigh, dtype=float) * flip)), unit(axes @ (np.asarray(shin, dtype=float) * flip))
        fold = d_shin - d_up * float(d_shin @ d_up)
        pole = self.LEG_POLE if np.linalg.norm(fold) < 1e-6 else -unit(fold)
        hip = self.position(side + "UpLeg")
        knee = hip + d_up * self.length[side + "Leg"]
        reached = knee + d_shin * self.length[side + "Foot"]
        self.leg_apply(side, d_up, d_shin, pole, foot)
        return knee, reached

    # ---- the result -------------------------------------------------------------------------------------------------------
    def settle(self):
        self._inherit()

    def local(self):
        """{node: (translation, rotation, scale)} of the pose, in the file's own units and parents (what a clip stores)."""
        self.settle()
        rig = self.rig
        out = dict(rig.local(None, 0.0))  # every node, the armature too; the bones are replaced below
        for n in rig.names:
            node = rig.by_name[n]
            t, _, s = rig.rest_trs[node]
            p = self.parent[n]
            if p is None:
                world_rotation = self.W[n] @ self.R0[n]
                q = skinpose.matrix_quat(world_rotation)
                t = t + self.shift / self.armature_scale
            else:
                q = skinpose.matrix_quat(self.R0[p].T @ self.W[p].T @ self.W[n] @ self.R0[n])
            out[node] = (t, q, s)
        return out


# ---- clips ----------------------------------------------------------------------------------------------------------------


def add_clip(rig, dst, name, frames, fps=24):
    """Write rig's file to `dst` with a clip `name` added (or replaced) made of `frames`, a list of Posing.local() results
    (one pose per frame, 0 to N). Every joint gets a rotation track with a key in every frame; the pelvis' position is keyed
    in every frame; every other position and every scale is the bind pose's, constant (two keys), as in the other clips."""
    import json
    import struct

    doc = json.loads(json.dumps(rig.doc))
    binary = bytearray(rig.binary)
    frames_n = len(frames)

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

    end = (frames_n - 1) / fps
    times = add([[f / fps] for f in range(frames_n)], "SCALAR", bounds=True)
    ends = add([[0.0], [end]], "SCALAR", bounds=True)
    samplers, channels = [], []

    def track(node, path, input_accessor, output_accessor):
        samplers.append({"input": input_accessor, "interpolation": "LINEAR", "output": output_accessor})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": path}})

    for n in rig.names:
        node = rig.by_name[n]
        rest_t, rest_q, rest_s = rig.rest_trs[node]
        quats, previous = [], None
        for pose in frames:
            q = np.array(pose[node][1], dtype=float)
            if previous is not None and float(q @ previous) < 0:
                q = -q
            quats.append(q)
            previous = q
        track(node, "rotation", times, add(quats, "VEC4"))
        if rig.parent.get(node) is not None and rig.nodes[rig.parent[node]].get("name") not in rig.index:  # the root bone
            track(node, "translation", times, add([pose[node][0] for pose in frames], "VEC3"))
        else:
            track(node, "translation", ends, add([rest_t, rest_t], "VEC3"))
        track(node, "scale", ends, add([rest_s, rest_s], "VEC3"))
    doc["animations"] = [a for a in doc.get("animations", []) if a["name"] != name]
    doc["animations"].append({"name": name, "channels": channels, "samplers": samplers})
    doc["animations"].sort(key=lambda a: a["name"])
    doc["buffers"][0]["byteLength"] = len(binary)
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary.extend(b"\0" * (-len(binary) % 4))
    with open(dst, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(text) + 8 + len(binary)))
        f.write(struct.pack("<II", len(text), skinpose.CHUNK_JSON) + text)
        f.write(struct.pack("<II", len(binary), skinpose.CHUNK_BIN) + bytes(binary))
