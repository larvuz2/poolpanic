"""The snow monkey's clips, on a macaque rigged with Coach Waters' skeleton (rig_from_template.py):
    python3 tools/blender/monkey_clips.py rigged.glb out.glb [--only MonkeyWalk,MonkeyRun] [--debug-frames 0,3]
(plain Python with numpy, no Blender: posing.py poses the skeleton, skinpose.py skins and measures it.)

The skeleton is a biped's, so walking on all fours is a pose of it: the pelvis pitched forward until the back lies flat, the
neck and head pitched back up so the monkey looks ahead, the hands on the ground under the shoulders (two-bone IK, the palms
flat and the fingers forward, the elbows pointing back), the feet on the ground under the hips (the knees forward). Every clip is
made in place (the game moves the monkey) and loops unless said otherwise. Measured on the body: the leg's reach, the arm's
reach, how far the sole and the palm sit below the ankle and the wrist joints, so the same script fits another monkey.

- MonkeyWalk (12 frames, 0.5 s): a diagonal-sequence walk (left hind, right fore, right hind, left fore, a quarter cycle apart),
  each foot 58% of the cycle on the ground, the back level with a little sway and roll, the head steady and looking ahead,
  the tail end up. Natural ground speed `WALK_SPEED`.
- MonkeyRun (10 frames, 0.42 s): a half bound: the hind feet land together (a little apart), then the hands; the back flexes and
  stretches with the stride, the body flies between the pushes. Natural ground speed `RUN_SPEED`.
- MonkeyIdle (96 frames, 4 s): sitting on its haunches, hands on the knees, looking left and right, a quick scratch behind the
  right ear, a little shiver.
- MonkeySoak (96 frames, 4 s): sitting on the pool floor (the hips at `SOAK_HIPS` above it), upright, leaning back a little, the
  forearms resting forward on the knees, eyes up (the head tipped back), slow deep breaths and a slow sway. The game sinks it so
  the waterline is at the chin (`CHIN` is printed).
- MonkeyHop (16 frames, one shot): from standing on all fours, a crouch, a push off the hind legs and a short forward dive that
  ends 0.35 m lower (into the water), the arms reaching ahead. Made in place: the game carries it forward."""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from posing import Posing, add_clip, ry, rx, rz, unit  # noqa: E402
from skinpose import Rig, matrix_quat, quat_matrix, slerp  # noqa: E402

FPS = 24
WALK_FRAMES, RUN_FRAMES = 12, 10
SOAK_HIPS = 0.07  # the hips joint above the pool floor, sitting


def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def wave(f, period, phase=0.0):
    return math.sin(2 * math.pi * (f / period + phase))


class Monkey:
    def __init__(self, rig):
        self.rig = rig
        self.P = Posing(rig)
        P = self.P
        L = P.length
        self.leg = L["LeftLeg"] + L["LeftFoot"]  # hip to ankle
        self.arm = L["LeftForeArm"] + L["LeftHand"]  # shoulder to wrist
        # how far the sole is below the ankle joint, and the palm below the wrist joint, in the bind pose
        world, verts = rig.pose(None, 0.0)
        ankle = P.P0["LeftFoot"]
        foot = verts[np.isin(rig.dominant, [rig.index["LeftFoot"], rig.index["LeftToeBase"]])]
        self.sole = float(ankle[1] - foot[:, 1].min()) if len(foot) else 0.03
        wrist = P.P0["LeftHand"]
        hand = verts[rig.dominant == rig.index["LeftHand"]]
        self.palm = float(wrist[1] - hand[:, 1].min()) if len(hand) else 0.02
        self.hip_y0 = float(P.P0["LeftUpLeg"][1])
        print(f"BODY leg {self.leg:.3f} arm {self.arm:.3f} sole {self.sole:.3f} palm {self.palm:.3f} hips {self.hip_y0:.3f}")

    # ---- helpers ------------------------------------------------------------------------------------------------------
    def place_hips(self, height, pitch, forward=0.0, roll=0.0, yaw=0.0, left=0.0):
        """Pitch the pelvis and put its hip joints (their middle) at `height` above the floor."""
        P = self.P
        P.hips(up=0.0, pitch=pitch, roll=roll, yaw=yaw)
        y = 0.5 * (P.position("LeftUpLeg")[1] + P.position("RightUpLeg")[1])
        P.hips(up=height - y, forward=forward, pitch=pitch, roll=roll, yaw=yaw, left=left)

    def arm_world(self, side, goal, pole):
        P = self.P
        o = 1.0 if side == "Left" else -1.0
        shoulder = P.position(side + "Arm")
        axes = P.W["Spine"]
        flip = np.array([o, 1.0, 1.0])
        local = (axes.T @ (np.asarray(goal, dtype=float) - shoulder)) * flip
        lpole = (axes.T @ np.asarray(pole, dtype=float)) * flip
        P.arm(side, wrist=tuple(local), pole=tuple(lpole))

    def hand_flat(self, side, amount=1.0, yaw=0.0):
        """The hand lies flat, palm down, fingers forward (amount 1), or follows the forearm (0)."""
        P = self.P
        o = 1.0 if side == "Left" else -1.0
        n = side + "Hand"
        q_flat = matrix_quat(ry(-o * 90 + yaw))
        q_fore = matrix_quat(P.W[side + "ForeArm"])
        if float(q_flat @ q_fore) < 0:
            q_fore = -q_fore
        P.W[n] = quat_matrix(slerp(q_fore, q_flat, amount))
        P.set[n] = True

    def leg_world(self, side, ankle_goal, pole=(0.0, 0.0, 1.0), flat=1.0, plantar=25.0, toe_yaw=0.0):
        P = self.P
        o = 1.0 if side == "Left" else -1.0
        hip = P.position(side + "UpLeg")
        rel = (np.asarray(ankle_goal, dtype=float) - hip) * np.array([o, 1.0, 1.0])
        polev = np.asarray(pole, dtype=float) * np.array([o, 1.0, 1.0])
        d_up, d_shin, knee, ankle = P.leg_dirs(side, rel, pole=polev)
        P.leg_apply(side, d_up, d_shin, np.asarray(pole, dtype=float) * np.array([o, 1, 1]), plantar=plantar)
        if flat > 0:
            a, t = side + "Foot", side + "ToeBase"
            q_flat = matrix_quat(ry(o * toe_yaw))
            q_shin = matrix_quat(P.W[a])
            if float(q_flat @ q_shin) < 0:
                q_shin = -q_shin
            P.W[a] = quat_matrix(slerp(q_shin, q_flat, flat))
            P.W[t] = P.W[a].copy()
        return knee, ankle

    # ---- on all fours -------------------------------------------------------------------------------------------------
    def quad(self, f, n, spec):
        """One frame of a four-footed gait. spec: phases {limb: offset}, duty, stride (m), lift (m), hip and shoulder heights
        (fractions of the reach), pitch, and the body's bob/flex/roll."""
        P = self.P
        P.reset()
        u = (f % n) / n
        bob = spec.get("bob", 0.0) * wave(u, 1.0, spec.get("bob_phase", 0.0)) if spec.get("bob_twice") is None else spec.get("bob", 0.0) * wave(u, 0.5, spec.get("bob_phase", 0.0))
        flex = spec.get("flex", 0.0) * wave(u, 1.0, spec.get("flex_phase", 0.0))
        roll = spec.get("roll", 0.0) * wave(u, 1.0, 0.25)
        yaw = spec.get("yaw", 0.0) * wave(u, 1.0, 0.0)
        hip_h = self.sole + self.leg * spec["hip"] + bob
        self.place_hips(hip_h, spec["pitch"] + flex * 0.4, roll=roll, yaw=yaw)
        P.spine(pitch=spec["spine"] + flex, roll=-roll * 0.5, yaw=-yaw * 0.6)
        # the shoulders' height: what the spine's pitch made it; the head looks ahead
        tot = spec["pitch"] + flex * 0.4 + spec["spine"] + flex
        P.head(pitch=spec["look"] - tot, yaw=spec.get("head_yaw", 0.0) * wave(u, 1.0, 0.1), neck=0.55)
        P.shoulders(forward=spec.get("hunch", 0.0))
        stride, lift, duty = spec["stride"], spec["lift"], spec["duty"]
        for limb, phase in spec["phases"].items():
            side = "Left" if limb[0] == "L" else "Right"
            o = 1.0 if side == "Left" else -1.0
            p = (u - phase) % 1.0
            if p < duty:  # on the ground, sliding back under the body as it goes forward
                s = p / duty
                dz = stride / 2 - stride * s
                dy = 0.0
                ground = 1.0
            else:  # swinging forward
                s = (p - duty) / (1 - duty)
                dz = -stride / 2 + stride * smooth(s)
                dy = lift * math.sin(math.pi * s)
                ground = 1.0 - math.sin(math.pi * min(1.0, s * 1.4)) if s < 0.7 else 0.0
            if limb[1] == "H":
                hip = P.position(side + "UpLeg")
                goal = np.array([hip[0] + o * spec.get("feet_out", 0.02), self.sole + dy, hip[2] + spec.get("feet_fwd", 0.0) + dz])
                # (the foot stays flat as it lifts and swings: a toe pointed down would go through the floor)
                self.leg_world(side, goal, pole=(0.15, 0.25, 1.0), flat=1.0, plantar=35.0, toe_yaw=8.0)
            else:
                shoulder = P.position(side + "Arm")
                goal = np.array([shoulder[0] + o * spec.get("hands_out", 0.03), self.palm + dy, shoulder[2] + spec.get("hands_fwd", 0.03) + dz])
                self.arm_world(side, goal, pole=(o * 0.35, 0.2, -1.0))
                self.hand_flat(side, 0.8 + 0.2 * max(ground, 0.0), yaw=o * -10)
        return P.local()

    def shoulder_height(self, spec):
        """Where the shoulders end up for a gait's body pose (to fit the hands' reach)."""
        P = self.P
        P.reset()
        self.place_hips(self.sole + self.leg * spec["hip"], spec["pitch"])
        P.spine(pitch=spec["spine"])
        return 0.5 * (P.position("LeftArm")[1] + P.position("RightArm")[1])

    def fit_pitch(self, spec, reach=0.86):
        """The spine's pitch that puts the shoulders where the arms reach the ground at `reach` of their length."""
        want = self.palm + self.arm * reach
        lo, hi = -40.0, 60.0
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            spec["spine"] = mid
            if self.shoulder_height(spec) > want:
                lo = mid
            else:
                hi = mid
        spec["spine"] = 0.5 * (lo + hi)
        return spec["spine"]

    # ---- sitting ------------------------------------------------------------------------------------------------------
    def sit(self, f, n, soak=False):
        P = self.P
        P.reset()
        u = f / n
        breath = wave(u, 1.0 if soak else 2.0)
        if soak:
            hips_h = SOAK_HIPS + 0.006 * breath
            sway = 3.0 * wave(u, 1.0, 0.15)
            self.place_hips(hips_h, -12 + 1.5 * breath, roll=sway * 0.5)
            P.spine(pitch=-6 - 2.0 * breath, roll=sway)
            P.head(pitch=-16 + 2.5 * wave(u, 1.0, 0.3), yaw=8 * wave(u, 1.0, 0.6), roll=4 * wave(u, 1.0, 0.4), neck=0.4)
            P.shoulders(forward=6, up=3 + 2 * breath)
        else:
            shiver = 1.4 * math.sin(2 * math.pi * f * 6 / 24) * (1.0 if (f % 48) < 16 else 0.15)
            self.place_hips(SOAK_HIPS + 0.004 * breath, 8, roll=shiver * 0.4)
            P.spine(pitch=10 + 1.5 * breath, roll=shiver)
            # looking about: left, right, a glance up
            look_yaw = 45 * math.sin(2 * math.pi * u) * (1 if u < 0.75 else 0.4)
            P.head(pitch=-10 + 6 * wave(u, 1.0, 0.3), yaw=look_yaw, roll=shiver * 2, neck=0.45)
            P.shoulders(forward=10, up=4 + abs(shiver) * 2)
        # the legs folded: the feet planted in front of the hips, the knees up and out
        for side, o in (("Left", 1.0), ("Right", -1.0)):
            hip = P.position(side + "UpLeg")
            goal = np.array([hip[0] + o * 0.07, (SOAK_HIPS if soak else SOAK_HIPS) - 0.07 + self.sole, hip[2] + 0.17])
            goal[1] = max(goal[1], self.sole)
            self.leg_world(side, goal, pole=(0.6, 0.8, 0.6), flat=1.0, toe_yaw=20)
        # the arms: on the knees (soak: resting forward on them, relaxed), the idle's right hand scratching behind the ear
        for side, o in (("Left", 1.0), ("Right", -1.0)):
            knee = P.position(side + "Leg")
            goal = knee + np.array([o * -0.01, 0.03, 0.06 if soak else 0.04])
            if not soak and side == "Right":
                k = smooth((u - 0.55) / 0.06) * (1 - smooth((u - 0.8) / 0.06))
                if k > 0:
                    head = P.position("Head")
                    ear = head + P.W["Head"] @ np.array([-0.09, 0.07, -0.02])
                    ear = ear + np.array([0, 0.012 * math.sin(2 * math.pi * f * 3 / 24), 0])
                    goal = goal * (1 - k) + ear * k
            self.arm_world(side, goal, pole=(o * 0.6, -0.2, -0.6))
            self.hand_flat(side, 0.6, yaw=o * -30)
        return P.local()

    # ---- the hop ------------------------------------------------------------------------------------------------------
    def hop(self, f, walk_spec):
        """One shot: crouch (0-5), push (5-8), fly forward and down (8-15), into the water 0.35 m below the floor."""
        P = self.P
        spec = dict(walk_spec)
        drop = 0.0
        if f <= 5:
            spec["hip"] = walk_spec["hip"] - 0.18 * smooth(f / 5)
            spec["pitch"] = walk_spec["pitch"] + 6 * smooth(f / 5)
        elif f <= 8:
            k = smooth((f - 5) / 3)
            spec["hip"] = walk_spec["hip"] - 0.18 + 0.3 * k
            spec["pitch"] = walk_spec["pitch"] + 6 - 18 * k
        else:
            t = (f - 8) / 7
            spec["hip"] = walk_spec["hip"] + 0.12
            spec["pitch"] = walk_spec["pitch"] - 12 + 30 * smooth(t)
            drop = 0.08 * math.sin(math.pi * min(t * 1.6, 1.0)) - 0.35 * t * t
        P.reset()
        hip_h = self.sole + self.leg * spec["hip"] + drop
        self.place_hips(hip_h, spec["pitch"])
        P.spine(pitch=spec["spine"])
        tot = spec["pitch"] + spec["spine"]
        P.head(pitch=spec["look"] + (10 if f > 8 else 0) - tot, neck=0.55)
        air = smooth((f - 7) / 2)
        for side, o in (("Left", 1.0), ("Right", -1.0)):
            hip = P.position(side + "UpLeg")
            shoulder = P.position(side + "Arm")
            foot_ground = np.array([hip[0] + o * 0.03, self.sole, hip[2]])
            foot_air = hip + np.array([o * 0.03, -self.leg * 0.6, -self.leg * 0.55])
            self.leg_world(side, foot_ground * (1 - air) + foot_air * air, pole=(0.15, 0.25, 1.0), flat=1 - air, plantar=50)
            hand_ground = np.array([shoulder[0] + o * 0.03, self.palm, shoulder[2] + 0.03])
            hand_air = shoulder + np.array([o * 0.06, -0.05, self.arm * 0.95])
            self.arm_world(side, hand_ground * (1 - air) + hand_air * air, pole=(o * 0.35, 0.2, -1.0))
            self.hand_flat(side, 1 - air * 0.7, yaw=o * -10)
        return P.local()


WALK = {
    "phases": {"LH": 0.0, "RF": 0.25, "RH": 0.5, "LF": 0.75},
    "duty": 0.58,
    "stride": 0.25,
    "lift": 0.05,
    "hip": 0.80,
    "pitch": 82.0,
    "spine": 0.0,
    "look": 8.0,
    "bob": 0.008,
    "bob_twice": True,
    "roll": 3.0,
    "yaw": 3.0,
    "head_yaw": 4.0,
    "hunch": 0.0,
}
RUN = {
    "phases": {"LH": 0.0, "RH": 0.07, "LF": 0.48, "RF": 0.58},
    "duty": 0.36,
    "stride": 0.34,
    "lift": 0.08,
    "hip": 0.78,
    "pitch": 80.0,
    "spine": 0.0,
    "look": 0.0,
    "bob": 0.05,
    "bob_phase": 0.15,
    "flex": 18.0,
    "flex_phase": 0.0,
    "roll": 1.5,
    "yaw": 2.0,
}


def ground_speed(spec, frames):
    """The ground speed the feet's stance implies: each foot slides `stride` back in `duty` of the cycle."""
    return spec["stride"] / (spec["duty"] * frames / FPS)


def main():
    args = sys.argv[1:]
    only = None
    debug = None
    if "--only" in args:
        i = args.index("--only")
        only = args[i + 1].split(",")
        del args[i : i + 2]
    if "--debug-frames" in args:
        i = args.index("--debug-frames")
        debug = [float(v) for v in args[i + 1].split(",")]
        del args[i : i + 2]
    src, dst = args
    rig = Rig(src)
    m = Monkey(rig)
    for name, spec, reach in (("walk", WALK, 0.84), ("run", RUN, 0.80)):
        m.fit_pitch(spec, reach)
        print(f"FIT {name}: spine pitch {spec['spine']:.1f} (pelvis {spec['pitch']:.0f}), shoulders at {m.shoulder_height(spec):.3f}")
    clips = {
        "MonkeyWalk": (lambda f: m.quad(f, WALK_FRAMES, WALK), WALK_FRAMES),
        "MonkeyRun": (lambda f: m.quad(f, RUN_FRAMES, RUN), RUN_FRAMES),
        "MonkeyIdle": (lambda f: m.sit(f, 96), 96),
        "MonkeySoak": (lambda f: m.sit(f, 96, soak=True), 96),
        "MonkeyHop": (lambda f: m.hop(f, WALK), 15),
    }
    path = src
    for name, (make, n) in clips.items():
        if only and name not in only:
            continue
        frames = [make(f) for f in (debug if debug else range(n + 1))]
        add_clip(rig, dst, name, frames)
        rig = Rig(dst)
        m.rig = rig
        m.P.rig = rig
        path = dst
        print(f"CLIP {name}: {len(frames)} frames ({n} a loop)")
    print(f"SPEED walk {ground_speed(WALK, WALK_FRAMES):.2f} m/s, run {ground_speed(RUN, RUN_FRAMES):.2f} m/s")
    # the chin above the clip's floor in MonkeySoak (frame 0): the lowest point of the face's front
    if (not only or "MonkeySoak" in only) and not debug:
        rig = Rig(dst)
        t = 0.0
        world, verts = rig.pose("MonkeySoak", t)
        head = rig.index["Head"]
        hw = world[rig.joint_nodes[head]]
        hp = hw[:3, 3]
        fwd = unit(hw[:3, :3] @ np.array([0, 0, 1.0]))
        sel = (rig.dominant == head) & (((verts - hp) @ fwd) > 0.02)
        chin = float(verts[sel][:, 1].min()) if sel.any() else float("nan")
        eyes = float(verts[sel][:, 1].max())
        print(f"CHIN MonkeySoak: chin {chin:.3f} m above the floor (the face's front, head-weighted, spans {chin:.3f}..{eyes:.3f})")


if __name__ == "__main__":
    main()
