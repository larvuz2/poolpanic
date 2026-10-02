"""Make Carl's Cannonball clip and put it in his file:
    python3 tools/blender/cannonball_clip.py in.glb out.glb [--debug-frames 16,20,28]
(plain Python with numpy, no Blender; posing.py poses the skeleton, skinpose.py skins and measures it). The clip is made for
one body: a very round man whose belly is wider than his shoulders and sits right over short legs, so a textbook tuck, the
knees up to the chest, is out of the question: the knees can only come up as far as the belly lets them, and the arms are too
short to reach round it to the shins. The pose respects the volume instead:
  - he drops into a deep crouch with his feet wide and the arms swung back, the belly leaning forward over his knees;
  - he explodes upward: the legs drive, the arms swing up in front, the chest rises first and the belly follows;
  - in the air the thighs come up under and beside the belly (as far as it lets them), the knees out, the lower legs folded
    underneath and the feet pointed; the arms come down and out, the elbows wide, and the hands hold on to the belly's flanks at
    the knees; the shoulders round, the back curls a little (it never folds over the legs) and the head tucks to look at the
    water; the belly stays big, forward and in the middle;
  - he hangs a moment at the top with the whole shape held, and then drops, the speed growing as a heavy body's does;
  - he hits the water bottom first (frame 37): the pose holds, the pelvis rocks back, the water throws his arms out and the
    head up, and the body sinks and slows while the belly goes on without it.
The jump is real: the hips follow a parabola (takeoff at 2.9 m/s, 0.42 m up, g = 9.8) and the water is 0.25 m below the deck
(the floor of the clip's world, where the feet start): the tucked body's lowest part, the feet under the belly, reaches it 10
frames after the top. The clip does not loop. It is not grounded (ground_clips.py would lift it
by the depth he sinks); belly_jiggle.py gives the belly its own motion afterwards (`--oneshot Cannonball`)."""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import posing  # noqa: E402
from posing import Posing, add_clip, ry, rx, unit  # noqa: E402
from skinpose import Rig, matrix_quat, quat_matrix, slerp  # noqa: E402

FPS = 24
G = 9.8 / FPS**2  # metres per frame per frame
DOWN, PUSH, TAKEOFF, APEX, END = 13, 14, 20, 27, 54  # the bottom of the crouch, the push begins, the feet leave the deck, the top, the last frame
TIP = 0.07  # how far the heels come up (the ankles with them) as he rises on his toes to leave the deck
HEEL_FROM = 19  # the frame the heels start to come up (in the last frame: the knee takes the rest of the push)
TAKEOFF_Y = TIP  # how far the hips are above where they stand when the feet leave the floor: on tiptoe, the legs straight
JUMP = 0.5 * G * (APEX - TAKEOFF) ** 2  # how high he goes above where he left the floor
WATER_Y = -0.25  # the water's surface, below the deck the clip starts on
LOW_POINT = 0.12  # the lowest part of the tucked body (the feet under the belly) above the floor when the hips stand where they stand
CONTACT = WATER_Y - LOW_POINT  # the hips' height (above where they stand) at which that lowest part reaches the water
FALL = math.sqrt(2 * (TAKEOFF_Y + JUMP - CONTACT) / G)  # frames from the top of the jump to the water
HIT = APEX + FALL  # the frame the water is reached (37)


# ---- curves -------------------------------------------------------------------------------------------------------------


def ease(u, kind):
    u = min(max(u, 0.0), 1.0)
    if kind == "in":
        return u * u
    if kind == "out":
        return 1 - (1 - u) ** 2
    if kind == "linear":
        return u
    return u * u * u * (u * (u * 6 - 15) + 10)  # inout: smoother step


def curve(keys, f):
    """Keys (frame, value[, ease]) with values that are numbers or arrays; the ease of a key shapes the way into it."""
    if f <= keys[0][0]:
        return np.asarray(keys[0][1], dtype=float)
    for a, b in zip(keys, keys[1:]):
        if f <= b[0]:
            u = (f - a[0]) / (b[0] - a[0])
            kind = b[2] if len(b) > 2 else "inout"
            return np.asarray(a[1], dtype=float) + (np.asarray(b[1], dtype=float) - np.asarray(a[1], dtype=float)) * ease(u, kind)
    return np.asarray(keys[-1][1], dtype=float)


def curve_polar(keys, f):
    """curve() for keys that are vectors from a pivot (a wrist from its shoulder): the direction turns the short way round at an
    even rate and the length changes linearly, so a swung arm goes round the shoulder, stays long, and does not cut through it."""
    if f <= keys[0][0]:
        return np.asarray(keys[0][1], dtype=float)
    for a, b in zip(keys, keys[1:]):
        if f <= b[0]:
            u = ease((f - a[0]) / (b[0] - a[0]), b[2] if len(b) > 2 else "inout")
            va, vb = np.asarray(a[1], dtype=float), np.asarray(b[1], dtype=float)
            la, lb = float(np.linalg.norm(va)), float(np.linalg.norm(vb))
            da, db = va / la, vb / lb
            angle = math.acos(float(np.clip(da @ db, -1.0, 1.0)))
            d = db if angle < 1e-6 else (math.sin((1 - u) * angle) * da + math.sin(u * angle) * db) / math.sin(angle)
            return d * (la + (lb - la) * u)
    return np.asarray(keys[-1][1], dtype=float)


def hips_up(f):
    """The height of the hips above where they stand: down into the crouch, driven up, a parabola in the air, then into the
    water and slowing."""
    takeoff_y = TAKEOFF_Y
    v0 = G * (APEX - TAKEOFF)
    if f <= 6:
        return 0.0
    if f <= DOWN:
        return -0.16 * ease((f - 6) / (DOWN - 6), "inout")
    if f <= PUSH:  # a beat at the bottom
        return -0.16
    if f <= TAKEOFF:  # the push: from the bottom of the crouch to the takeoff, arriving with the takeoff's speed
        t = (f - PUSH) / (TAKEOFF - PUSH)
        h00, h10, h01, h11 = 2 * t**3 - 3 * t**2 + 1, t**3 - 2 * t**2 + t, -2 * t**3 + 3 * t**2, t**3 - t**2
        return h00 * -0.16 + h01 * takeoff_y + h11 * v0 * (TAKEOFF - PUSH)
    t = f - TAKEOFF
    y = takeoff_y + v0 * t - 0.5 * G * t * t
    if y > CONTACT or f < APEX:
        return y
    # the water: the fall's speed at the surface, then a body being slowed down
    v_c = G * FALL
    k = 0.22  # the water takes this share of the speed per frame
    dt = f - HIT
    return CONTACT - (v_c / k) * (1 - math.exp(-k * dt))


# ---- the pose through time ----------------------------------------------------------------------------------------------

HANG = (0.42, -0.34, 0.02)  # the wrist of an arm held out past the belly, from its shoulder (out, up, forward), chest axes
POLE_HANG = (0.3, -0.3, -1.0)

AP = APEX
MID = (TAKEOFF + APEX) / 2  # halfway up: the tuck is under way

KEYS = {
    "pelvis_pitch": [(0, 0), (6, 0), (DOWN, 14), (PUSH, 14), (20, 2, "out"), (MID, -3), (AP, -6), (HIT, -6), (HIT + 4, -14, "out"), (END, -8)],
    "spine_pitch": [(0, 0), (6, 0), (DOWN, 16), (PUSH, 16), (20, -3, "out"), (MID + 0.5, 16), (AP + 1, 30), (HIT, 34), (HIT + 4, 22, "out"), (END, 26)],
    "head_pitch": [(0, 0), (6, -3), (DOWN, 10), (PUSH, 10), (20, -8, "out"), (MID + 1.5, 22), (AP + 1, 28), (HIT, 34), (HIT + 4, 10, "out"), (END, 16)],
    "hunch": [(0, 0), (DOWN, 4), (PUSH, 4), (20, 0), (AP, 14), (HIT, 16), (HIT + 4, 8), (END, 8)],
    "shrug": [(0, 0), (DOWN, 2), (PUSH, 2), (20, 0), (AP, 6), (HIT, 6), (HIT + 4, 12), (END, 10)],
    "wrist": [  # out, up, forward in the chest's axes, as the way from the shoulder (turned round the shoulder: curve_polar)
        (0, HANG),
        (6, HANG),
        (DOWN, (0.34, -0.28, -0.40)),  # swung back and out
        (PUSH, (0.34, -0.28, -0.40)),
        (20, (0.30, 0.15, 0.48)),  # up and forward with the push
        (MID, (0.38, -0.15, 0.20)),
        (AP, (0.30, -0.40, 0.05)),  # elbows out, the forearms down along the belly's flanks: the arms go round it
        (HIT, (0.30, -0.40, 0.05)),
        (HIT + 5, (0.49, 0.02, 0.05), "out"),  # thrown out by the water
        (END, (0.47, 0.20, 0.00)),
    ],
    "elbow": [
        (0, POLE_HANG),
        (6, POLE_HANG),
        (DOWN, (0.5, 0.0, -1.0)),
        (PUSH, (0.5, 0.0, -1.0)),
        (20, (0.8, 0.5, -0.3)),
        (MID, (1.0, 0.2, -0.5)),
        (AP, (1.0, 0.1, -0.2)),
        (HIT, (1.0, 0.1, -0.2)),
        (HIT + 5, POLE_HANG),  # (an arm flung out straight bends its elbow back, as the pole says)
        (END, POLE_HANG),
    ],
    "stance": [(0, 0.0), (6, 0.0), (DOWN, 0.10), (PUSH, 0.10), (20, 0.03, "out"), (22, 0.03)],  # how far out each planted foot is
    "toe_out": [(0, 0.0), (6, 0.0), (DOWN, 18.0), (PUSH, 18.0), (20, 6.0)],
    "air": [(0, 0.0), (20, 0.0), (21, 1.0)],  # 0: the feet stand where they stand; 1: the legs are as the tuck says (the feet have left the deck)
    "lift": [(0, 0.0), (19, 0.0), (21, 1.0)],  # 0: the foot flat on the floor; 1: it follows the shin, pointed by `plantar` (the heel goes first)
    "plantar": [(0, 0.0), (19, 0.0), (21, 40.0), (END, 35.0)],
    # the legs in the air: the thigh's and shin's directions (out, up, forward), in the pelvis' axes: straight at the takeoff, tucked at the top
    "thigh": [(20, (0.15, -0.95, 0.0)), (AP, (0.7, 0.10, 0.70)), (END, (0.7, 0.10, 0.70))],
    "shin": [(20, (0.15, -0.95, 0.0)), (AP, (-0.15, -0.6, -0.78)), (END, (-0.15, -0.6, -0.78))],
}


def build(P, f):
    """The pose at frame f (fractions allowed)."""
    rig = P.rig
    k = lambda name: curve(KEYS[name], f)
    P.reset()
    P.hips(up=float(hips_up(f)), pitch=float(k("pelvis_pitch")))
    P.spine(pitch=float(k("spine_pitch")))
    P.head(pitch=float(k("head_pitch")))
    P.shoulders(forward=float(k("hunch")), up=float(k("shrug")))
    for side in ("Left", "Right"):
        P.arm(side, wrist=tuple(curve_polar(KEYS["wrist"], f)), pole=tuple(k("elbow")))
    air = float(k("air"))
    stance = float(k("stance"))
    for side, o in (("Left", 1.0), ("Right", -1.0)):
        hip = P.position(side + "UpLeg")
        heel = TIP * float(ease((f - HEEL_FROM) / (TAKEOFF - HEEL_FROM), "inout"))  # the heel comes up before the toes leave
        planted = P.P0[side + "Foot"] + np.array([o * stance, heel, 0.0])
        d_up, d_shin, knee, ankle = P.leg_dirs(side, (planted - hip) * np.array([o, 1.0, 1.0]), pole=(0.25, 0.0, 1.0))
        pole_ik = np.array([o * 0.25, 0.0, 1.0])
        if air > 0:
            # the tuck's directions, in the pelvis' axes (the right leg mirrored)
            axes = P.W[P.root]
            flip = np.array([o, 1.0, 1.0])
            t_f = unit(axes @ (np.asarray(curve_polar(KEYS["thigh"], f)) * flip))
            s_f = unit(axes @ (np.asarray(curve_polar(KEYS["shin"], f)) * flip))
            d_up = unit((1 - air) * d_up + air * t_f)
            d_shin = unit((1 - air) * d_shin + air * s_f)
        fold = d_shin - d_up * float(d_shin @ d_up)
        pole = pole_ik if np.linalg.norm(fold) < 1e-6 else -unit(fold)
        P.leg_apply(side, d_up, d_shin, pole, plantar=float(k("plantar")))
        lift = float(k("lift"))
        if lift < 1.0:  # the foot turns from lying flat on the floor to following the shin: the heel comes up first
            ankle, toe = side + "Foot", side + "ToeBase"
            q_flat, q_shin = matrix_quat(ry(o * float(k("toe_out")))), matrix_quat(P.W[ankle])
            P.W[ankle] = quat_matrix(slerp(q_flat, q_shin if float(q_flat @ q_shin) >= 0 else -q_shin, lift))
            P.W[toe] = P.W[ankle].copy()
    return P.local()


def main():
    args = sys.argv[1:]
    debug = None
    if "--debug-frames" in args:
        i = args.index("--debug-frames")
        debug = [float(v) for v in args[i + 1].split(",")]
        del args[i : i + 2]
    if len(args) != 2:
        raise SystemExit(__doc__)
    src, dst = args
    rig = Rig(src)
    P = Posing(rig)
    frames = [build(P, f) for f in (debug if debug else range(END + 1))]
    add_clip(rig, dst, "Try" if debug else "Cannonball", frames)
    print(f"CANNONBALL {dst}: {len(frames)} frames; hips {min(hips_up(f) for f in range(END + 1)):+.2f}..{max(hips_up(f) for f in range(END + 1)):+.2f} m; water reached at frame {HIT:.1f}")
    if not debug:  # the lowest point of the skinned body at the top of the jump is what LOW_POINT says it is
        played = Rig(dst)
        for f in (APEX, APEX + 4):
            _, verts = played.pose("Cannonball", f / FPS)
            low = float(verts[:, 1].min()) - hips_up(f)
            if abs(low - LOW_POINT) > 0.02:
                print(f"WARNING frame {f}: the tucked body hangs {low:.2f} m above the floor with the hips standing, LOW_POINT says {LOW_POINT:.2f}")


if __name__ == "__main__":
    main()
