"""Add a character's own clips (what the person does while waiting to be assigned to a lane) to a rigged humanoid:
    tools/blender/run.sh tools/blender/character_clips.py -- in.glb out.glb --character marco [--only WaitWatch]
(`--character shared` is the clips every character gets, made on Coach Panic: Panic and Swim. transplant_clips.py then
moves them to the others. `--character coach` is the clip only Coach Panic has: SwimRing, swimming with the life ring.)
The clips of the file stay, the new ones are added under their own names, and each one loops (its last frame is its
first again). The legs stay planted: the feet are held where they stand, and the knees bend to follow the hips. Every bone
is keyed in every frame, like the other clips, so switching clips never leaves a bone behind.

A clip is a list of keys per control, eased from one to the next (see CLIPS below). The body is posed from them in
the rig's own space: x to the character's left, y to the back, z up. Arms are placed by where the wrist goes and which way
the elbow points (two-bone IK), so the same pose fits a tall swimmer and a child:
    "armL" / "armR"   {"space": "chest", "tgt": (x, y, z), "pole": (x, y, z), "twist": degrees}
                      chest: the wrist in fractions of the arm's reach from its shoulder, x out from the body, y back, z up;
                      head:  the wrist in fractions of the head's half sizes from its centre (a hand at the goggles).
                      "hang" is the relaxed arm of the idle clips.
    "hips"            metres the hips move (x, y, z), "hips_turn" / "spine" / "head": (yaw, pitch, roll) degrees
                      (yaw + turns left, pitch + looks down, roll + tips the head to its left)
    "look"            0..1: how much the head looks at the left wrist ("look_wrist": "L"/"R") rather than where "head" points
    "shrug"           0..1: shoulders up
    "breath"          how much the body breathes (the hips and spine rise a few millimetres every "breath_frames"); 1 by default
    "footL" / "footR" (forward, out, lift) metres the foot goes from where it stands (a tap lifts it a little)"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

BREATH = 48  # frames per breath (2 s at 24 fps)
HANG = math.radians(8.0)
FORE_HANG = math.radians(4.0)
BEND = math.radians(14.0)

# ---- the clips --------------------------------------------------------------------------------------------------------
# Keys are (frame, value). Frames run 0 to `frames`; the last key of each control should equal its first so the clip loops.
HANGING = "hang"


def panic_clip():
    """Panic: jumping on the spot without a pause, arms thrown up and flapping, head tipped back and shaking. Two hops make
    the loop (1 s at 24 fps, 0.5 s a hop), the second a mirror of the first, so the swimmer twists and kicks one way and then
    the other. A hop is the real thing: the feet leave the floor for most of it (the hips follow a parabola and the feet rise
    with them, a little more, so the knees bend in the air) and the hips sink into the knees on landing. The legs are
    straight only when standing, so a bent knee is a foot closer to the hips: on the floor the hips go down, in the air the
    foot comes up. The numbers are in metres on the Coach (hips 0.82 m, legs 0.63 m) and become a child's or a giant's
    through transplant_clips.py's scale."""
    hop, frames = 12, 24
    height = 0.22  # how high the hips rise above standing
    depth = 0.085  # how much shorter the legs are at the bottom of a landing
    tuck = 0.09  # ... and at the top of a hop
    base = 0.015  # ... and at the moment of landing and of take-off (the knees are never locked, and a knee that goes
    # from straight to bent in one frame would pop)
    contact = 0.32  # the share of a hop spent on the floor
    tau = 2 * math.pi

    def flight(p):
        """None on the floor, else 0 to 1 through the air (the share of the flight)."""
        return None if p < contact else (p - contact) / (1 - contact)

    def shorter(p, more=1.0):
        """How much shorter the legs are than standing, in metres."""
        q = flight(p)
        if q is None:
            return base + (depth - base) * math.sin(math.pi * p / contact)
        return base + (tuck * more - base) * math.sin(math.pi * q)

    def hips_z(p):
        q = flight(p)
        if q is None:
            return -shorter(p)
        return -base + (height + base) * 4 * q * (1 - q)

    def foot(side, f):
        p = (f % hop) / hop
        mirror = 1.0 if (f % frames) < hop else -1.0  # which hop of the two this is
        q = flight(p)
        if q is None:
            return (0.0, 0.03, 0.0)
        air = math.sin(math.pi * q)
        more = 1.0 + 0.4 * mirror * (1.0 if side == "L" else -1.0)  # one knee comes up higher, then the other
        return (-0.05 * air * more, 0.03 + 0.03 * air, hips_z(p) + shorter(p, more))  # the heels kick back, the feet part

    def arm(side, f):
        lag = 0.0 if side == "L" else 3.0  # frames: the right arm trails, so the two never flap together
        s = ((f - lag) % hop) / hop
        lift = 0.5 + 0.5 * math.cos(tau * (s - 0.66))  # highest just after the top of the hop, lowest as the body lands
        wave = 0.07 * math.sin(tau * (2 * s + (0.0 if side == "L" else 0.4)))  # the hands wave from side to side
        up, low = (0.18, 0.04, 0.97), (0.50, -0.06, 0.52)
        tgt = tuple(low[i] + (up[i] - low[i]) * lift for i in range(3))
        pole_up, pole_low = (0.9, 0.7, 0.0), (0.6, 0.3, -0.9)
        pole = tuple(pole_low[i] + (pole_up[i] - pole_low[i]) * lift for i in range(3))
        return {"space": "chest", "tgt": (tgt[0] + wave, tgt[1], tgt[2]), "pole": pole, "twist": 0}

    keys = {name: [] for name in ("hips", "hips_turn", "spine", "head", "shrug", "armL", "armR", "footL", "footR")}
    for f in range(frames + 1):
        p = (f % hop) / hop
        w = tau * (f % frames) / frames  # once round per two hops
        keys["hips"].append((f, (0.012 * math.sin(w), 0.0, hips_z(p))))
        keys["hips_turn"].append((f, (8 * math.sin(w), 0.0, 3 * math.sin(w + 1.0))))
        keys["spine"].append((f, (0.0, 7 * math.cos(tau * (p - 0.13)), 3 * math.sin(w))))
        keys["head"].append((f, (14 * math.sin(w + 1.2), -8 - 6 * math.cos(tau * (p - 0.63)), 7 * math.sin(w + 2.4))))
        keys["shrug"].append((f, 0.35 + 0.3 * math.cos(tau * (p - 0.7))))
        keys["armL"].append((f, arm("L", f)))
        keys["armR"].append((f, arm("R", f)))
        keys["footL"].append((f, foot("L", f)))
        keys["footR"].append((f, foot("R", f)))
    return {"frames": frames, "breath_frames": 12, **keys}


def swim_clip():
    """Swim: the freestyle crawl. It is made standing, as every clip is: the game lays the swimmer on its front (the head
    leads, the belly is down), so what the body does about its own long axis is what a swimmer does about the water. One
    stroke cycle is 24 frames (1 s at 24 fps; the game plays it faster or slower with the swimmer's speed) and both arms
    make it:
      - an arm is a windmill about the shoulder. In the water that is the pull, the hand deep under the chest with the elbow
        bent and high, and then the recovery, the hand skimming the surface close to the body while the elbow leads out to
        the side, and the hand reaching forward to enter ahead of the head. The other arm is half a cycle behind;
      - the body rolls about its long axis toward the pulling arm (the shoulders first, the hips a little after);
      - the head stays still in the water, which means turning against the roll, and once a cycle turns out to the side of
        the recovering arm to breathe;
      - the legs flutter in a six-beat kick (three kicks a leg to each cycle), straight, with a little bend."""
    frames = 24
    tau = 2 * math.pi
    bend = 0.035  # metres: how much shorter a leg is at its most bent
    kick = 0.13  # metres: how far a foot goes forward and back of where it hangs

    def smooth(u):
        u = max(0.0, min(1.0, u))
        return u * u * u * (u * (u * 6 - 15) + 10)

    def breath(f):
        """0 with the face in the water, 1 with it turned out to breathe (frames 2 to 10, to the right)."""
        return smooth((f - 1.5) / 3.0) * (1.0 - smooth((f - 8.0) / 3.0))

    def arm(side, f):
        """The hand goes round the shoulder once a cycle: overhead (alpha 0), down in front of the body (the pull: deep, the
        hand 0.55 of the reach below the chest, the elbow bent), by the thigh (alpha pi), and back up (the recovery: shallow,
        the hand skimming the water 0.15 below the shoulder and 0.4 out, so the elbow is what leads and sticks out)."""
        alpha = tau * f / frames + (0.0 if side == "L" else math.pi)
        s = math.sin(alpha)
        pull = s >= 0
        x = 0.12 + (0.12 if pull else 0.34) * s * s  # out from the body: the recovery swings wide
        y = -(0.55 if pull else 0.15) * abs(s)  # in front of the body (under it, in the water): the pull is deep
        z = 0.97 * math.cos(alpha)  # up the body (ahead of the head, in the water) and back down it
        return {"space": "chest", "tgt": (x, y, z), "pole": (0.7, 0.8, 0.0), "twist": 0}

    keys = {name: [] for name in ("hips_turn", "spine", "head", "armL", "armR", "footL", "footR")}
    for f in range(frames + 1):
        w = tau * (f % frames) / frames
        hips_yaw = -24 * math.sin(w)  # to the left (a negative turn is to the right) while the left arm pulls
        spine_yaw = -26 * math.sin(w + 0.35)  # the shoulders lead the hips
        keys["hips_turn"].append((f, (hips_yaw, 0.0, 0.0)))
        keys["spine"].append((f, (spine_yaw, 0.0, 0.0)))
        head_yaw = -0.8 * (hips_yaw + spine_yaw) - 62 * breath(f % frames)  # against the roll, and out to breathe
        keys["head"].append((f, (head_yaw, -18.0 - 6 * breath(f % frames), 3 * math.sin(w))))
        keys["armL"].append((f, arm("L", f)))
        keys["armR"].append((f, arm("R", f)))
        for side in ("L", "R"):
            theta = 3 * w + (0.0 if side == "L" else math.pi)
            keys["foot" + side].append((f, (kick * math.sin(theta), 0.0, bend * (0.5 + 0.5 * math.sin(theta + 0.8)))))
    return {"frames": frames, "breath": 0.0, **keys}  # (the hips stay where they are: no breathing on top)


def swim_ring_clip():
    """SwimRing: Coach Panic swimming with the life ring, which floats ahead of him and which he holds at the very front. Made
    standing, like every clip: the game lays him on his front, so "up the body" is ahead of him in the water. The arms are held
    straight up the body (a little bent, the hands a little apart, on the ring) and do not move at all: every key of both arms
    is the same. The body does not roll and the head looks ahead over the ring; only the legs kick, in the Swim's six-beat
    flutter (three kicks a leg to each cycle)."""
    frames = 24
    tau = 2 * math.pi
    bend = 0.035  # metres: how much shorter a leg is at its most bent
    kick = 0.13  # metres: how far a foot goes forward and back of where it hangs
    hold = {"space": "chest", "tgt": (0.10, -0.03, 0.99), "pole": (1.0, 0.25, 0.0), "twist": 0}
    keys = {name: [] for name in ("hips_turn", "spine", "head", "armL", "armR", "footL", "footR")}
    for f in range(frames + 1):
        w = tau * (f % frames) / frames
        keys["hips_turn"].append((f, (0.0, 0.0, 0.0)))
        keys["spine"].append((f, (0.0, 0.0, 0.0)))
        keys["head"].append((f, (0.0, -22.0, 0.0)))  # a negative pitch looks up: ahead, over the ring, when he lies on his front
        keys["armL"].append((f, hold))
        keys["armR"].append((f, hold))
        for side in ("L", "R"):
            theta = 3 * w + (0.0 if side == "L" else math.pi)
            keys["foot" + side].append((f, (kick * math.sin(theta), 0.0, bend * (0.5 + 0.5 * math.sin(theta + 0.8)))))
    return {"frames": frames, "breath": 0.0, **keys}  # (the hips stay where they are: no breathing on top)


CLIPS = {
    # What every character does, made on the Coach and moved to the others (transplant_clips.py).
    "shared": {
        "Panic": panic_clip(),
        "Swim": swim_clip(),
    },
    # What only Coach Panic does.
    "coach": {
        "SwimRing": swim_ring_clip(),
    },
    "marco": {
        # Impatient, waiting to be given a lane: a long look at his watch, a sigh, looking around for whoever is coming, the
        # foot tapping, a second quick look at the watch.
        "WaitWatch": {
            "frames": 240,
            "hips": [(0, (0, 0, 0)), (100, (0, 0, 0)), (122, (0.014, 0.0, -0.006)), (188, (0.014, 0.0, -0.006)), (210, (0, 0, 0)), (240, (0, 0, 0))],
            "hips_turn": [(0, (0, 0, 0)), (100, (0, 0, 0)), (122, (0, 0, 2.5)), (188, (0, 0, 2.5)), (210, (0, 0, 0)), (240, (0, 0, 0))],
            "head": [(0, (0, 0, 0)), (110, (0, 0, 0)), (122, (46, -3, 0)), (136, (46, -3, 0)), (156, (-50, -2, 0)), (170, (-50, -2, 0)), (188, (0, 0, 0)), (240, (0, 0, 0))],
            "look": [(0, 0), (22, 0), (42, 1), (86, 1), (104, 0), (188, 0), (196, 1), (216, 1), (232, 0), (240, 0)],
            "look_wrist": "L",
            "spine": [(0, (0, 0, 0)), (100, (0, 0, 0)), (122, (10, 0, 0)), (136, (10, 0, 0)), (156, (-12, 0, 0)), (170, (-12, 0, 0)), (190, (0, 0, 0)), (240, (0, 0, 0))],
            "shrug": [(0, 0), (84, 0), (92, 1), (100, 1), (110, 0), (240, 0)],
            "armL": [
                (0, HANGING),
                (20, HANGING),
                (42, {"space": "chest", "tgt": (-0.30, -0.52, -0.15), "pole": (0.3, 0.2, -1.0), "twist": 0}),
                (88, {"space": "chest", "tgt": (-0.30, -0.52, -0.15), "pole": (0.3, 0.2, -1.0), "twist": 0}),
                (112, HANGING),
                (188, HANGING),
                (198, {"space": "chest", "tgt": (-0.30, -0.52, -0.15), "pole": (0.3, 0.2, -1.0), "twist": 0}),
                (216, {"space": "chest", "tgt": (-0.30, -0.52, -0.15), "pole": (0.3, 0.2, -1.0), "twist": 0}),
                (232, HANGING),
                (240, HANGING),
            ],
            "armR": [
                (0, HANGING),
                (96, HANGING),
                (112, {"space": "chest", "tgt": (0.10, 0.04, -0.72), "pole": (1.0, 0.5, 0.0), "twist": 0}),
                (186, {"space": "chest", "tgt": (0.10, 0.04, -0.72), "pole": (1.0, 0.5, 0.0), "twist": 0}),
                (206, HANGING),
                (240, HANGING),
            ],
            "footR": [
                (0, (0, 0, 0)), (124, (0, 0, 0)), (128, (0.04, 0, 0.05)), (132, (0.04, 0, 0)), (136, (0.04, 0, 0.05)),
                (140, (0.04, 0, 0)), (144, (0.04, 0, 0.05)), (148, (0.04, 0, 0)), (156, (0, 0, 0)), (240, (0, 0, 0)),
            ],
        },
    },
    "berta": {
        # A friendly senior waiting for her lane: hands clasped over her belly, rocking gently from foot to foot, looking
        # about with interest, a pat of her flowered cap, and a little wave at someone she knows.
        "WaitChat": {
            "frames": 240,
            "hips": [(0, (0, 0, 0)), (24, (0.02, 0, -0.004)), (72, (-0.02, 0, -0.004)), (120, (0.02, 0, -0.004)), (168, (-0.02, 0, -0.004)), (216, (0.02, 0, -0.004)), (240, (0, 0, 0))],
            "hips_turn": [(0, (0, 0, 0)), (24, (0, 0, 2.5)), (72, (0, 0, -2.5)), (120, (0, 0, 2.5)), (168, (0, 0, -2.5)), (216, (0, 0, 2.5)), (240, (0, 0, 0))],
            "head": [(0, (0, 0, 0)), (20, (0, 0, 0)), (44, (-38, -2, 0)), (72, (-38, -2, 0)), (100, (30, -3, 0)), (124, (30, -3, 0)), (140, (4, -6, 0)), (150, (4, -6, 0)),
                     (176, (-12, -3, 0)), (200, (22, -2, 0)), (222, (0, 0, 0)), (240, (0, 0, 0))],
            "spine": [(0, (0, 0, 0)), (44, (-8, 0, 0)), (72, (-8, 0, 0)), (100, (6, 0, 0)), (124, (6, 0, 0)), (150, (0, 0, 0)), (240, (0, 0, 0))],
            "armL": [(0, "clasp"), (240, "clasp")],
            "armR": [
                (0, "clasp"), (130, "clasp"),
                (148, {"space": "head", "tgt": (1.15, 0.1, 1.0), "pole": (1.0, 0.5, -0.4), "twist": 0}),
                (158, {"space": "head", "tgt": (1.05, 0.15, 1.1), "pole": (1.0, 0.5, -0.4), "twist": 0}),
                (166, {"space": "head", "tgt": (1.15, 0.1, 1.0), "pole": (1.0, 0.5, -0.4), "twist": 0}),
                (186, "clasp"), (192, "clasp"),
                (204, {"space": "chest", "tgt": (0.50, -0.45, 0.10), "pole": (0.6, 0.6, -1.0), "twist": 0}),
                (210, {"space": "chest", "tgt": (0.62, -0.42, 0.16), "pole": (0.6, 0.6, -1.0), "twist": 0}),
                (216, {"space": "chest", "tgt": (0.46, -0.45, 0.12), "pole": (0.6, 0.6, -1.0), "twist": 0}),
                (222, {"space": "chest", "tgt": (0.62, -0.42, 0.16), "pole": (0.6, 0.6, -1.0), "twist": 0}),
                (228, "clasp"), (240, "clasp"),
            ],
        },
    },
    "nico": {
        # A kid who cannot keep still: bouncing on his knees, arms swinging, craning around, then a hand shot up high so
        # that whoever hands out the lanes sees him.
        "WaitFidget": {
            "frames": 192,
            "breath_frames": 24,
            "hips": [(0, (0, 0, 0)), (12, (0, 0, -0.03)), (24, (0, 0, 0)), (36, (0, 0, -0.03)), (48, (0, 0, 0)), (60, (0, 0, -0.03)), (72, (0, 0, 0)),
                     (84, (0, 0, -0.03)), (96, (0, 0, 0)), (108, (0, 0, -0.045)), (120, (0, 0, 0.0)), (132, (0, 0, -0.045)), (144, (0, 0, 0)), (156, (0, 0, -0.03)), (168, (0, 0, 0)), (180, (0, 0, -0.03)), (192, (0, 0, 0))],
            "head": [(0, (0, 0, 0)), (16, (-30, -8, -4)), (40, (-30, -8, -4)), (56, (26, -12, 4)), (80, (26, -12, 4)), (96, (0, -14, 0)), (150, (0, -14, 0)), (166, (0, 0, 0)), (192, (0, 0, 0))],
            "spine": [(0, (0, 0, 0)), (16, (-10, 0, 0)), (40, (-10, 0, 0)), (56, (10, 0, 0)), (80, (10, 0, 0)), (96, (0, 0, 0)), (192, (0, 0, 0))],
            "armL": [
                (0, HANGING), (6, {"space": "chest", "tgt": (0.12, 0.30, -0.9), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (18, {"space": "chest", "tgt": (0.12, -0.30, -0.88), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (30, {"space": "chest", "tgt": (0.12, 0.30, -0.9), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (42, {"space": "chest", "tgt": (0.12, -0.30, -0.88), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (54, {"space": "chest", "tgt": (0.12, 0.30, -0.9), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (66, {"space": "chest", "tgt": (0.12, -0.30, -0.88), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (84, HANGING), (192, HANGING),
            ],
            "armR": [
                (0, HANGING), (6, {"space": "chest", "tgt": (0.12, -0.30, -0.88), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (18, {"space": "chest", "tgt": (0.12, 0.30, -0.9), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (30, {"space": "chest", "tgt": (0.12, -0.30, -0.88), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (42, {"space": "chest", "tgt": (0.12, 0.30, -0.9), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (54, {"space": "chest", "tgt": (0.12, -0.30, -0.88), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (66, {"space": "chest", "tgt": (0.12, 0.30, -0.9), "pole": (0.3, 0.7, -0.2), "twist": 0}),
                (84, HANGING), (100, HANGING),
                (116, {"space": "chest", "tgt": (0.20, -0.10, 0.99), "pole": (0.8, 0.9, 0.0), "twist": 0}),
                (124, {"space": "chest", "tgt": (0.06, -0.10, 0.99), "pole": (0.8, 0.9, 0.0), "twist": 0}),
                (132, {"space": "chest", "tgt": (0.24, -0.10, 0.98), "pole": (0.8, 0.9, 0.0), "twist": 0}),
                (140, {"space": "chest", "tgt": (0.06, -0.10, 0.99), "pole": (0.8, 0.9, 0.0), "twist": 0}),
                (148, {"space": "chest", "tgt": (0.24, -0.10, 0.98), "pole": (0.8, 0.9, 0.0), "twist": 0}),
                (168, HANGING), (192, HANGING),
            ],
        },
    },
    "valentina": {
        # The aqua-aerobics instructor warming up while she waits: a stretch overhead, side bends, shoulder rolls, hands on
        # her hips and a hip circle, and a look round at who is here.
        "WaitWarmUp": {
            "frames": 288,
            "hips": [(0, (0, 0, 0)), (150, (0, 0, 0)), (160, (0.03, 0, 0)), (172, (0, 0.03, 0)), (184, (-0.03, 0, 0)), (196, (0, -0.03, 0)), (208, (0.03, 0, 0)), (220, (0, 0.03, 0)), (232, (-0.03, 0, 0)), (244, (0, -0.03, 0)), (256, (0, 0, 0)), (288, (0, 0, 0))],
            "head": [(0, (0, 0, 0)), (30, (0, -6, 0)), (84, (0, -6, 0)), (108, (0, 0, 0)), (150, (0, 0, 0)), (160, (30, 0, 0)), (190, (30, 0, 0)), (220, (-32, 0, 0)), (250, (-32, 0, 0)), (268, (0, 0, 0)), (288, (0, 0, 0))],
            "spine": [(0, (0, 0, 0)), (30, (0, -6, 0)), (44, (0, -6, -14)), (62, (0, -6, 14)), (80, (0, -6, 0)), (108, (0, 0, 0)), (288, (0, 0, 0))],
            "shrug": [(0, 0), (110, 0), (116, 1), (122, 0), (128, 1), (134, 0), (140, 1), (146, 0), (288, 0)],
            "armL": [
                (0, HANGING), (30, {"space": "chest", "tgt": (0.04, -0.05, 0.98), "pole": (0.2, 1.0, 0.0), "twist": 0}),
                (80, {"space": "chest", "tgt": (0.04, -0.05, 0.98), "pole": (0.2, 1.0, 0.0), "twist": 0}),
                (108, HANGING), (150, HANGING),
                (166, {"space": "chest", "tgt": (0.06, 0.05, -0.72), "pole": (1.0, 0.5, 0.0), "twist": 0}),
                (262, {"space": "chest", "tgt": (0.06, 0.05, -0.72), "pole": (1.0, 0.5, 0.0), "twist": 0}),
                (280, HANGING), (288, HANGING),
            ],
            "armR": [
                (0, HANGING), (30, {"space": "chest", "tgt": (0.04, -0.05, 0.98), "pole": (0.2, 1.0, 0.0), "twist": 0}),
                (80, {"space": "chest", "tgt": (0.04, -0.05, 0.98), "pole": (0.2, 1.0, 0.0), "twist": 0}),
                (108, HANGING), (150, HANGING),
                (166, {"space": "chest", "tgt": (0.06, 0.05, -0.72), "pole": (1.0, 0.5, 0.0), "twist": 0}),
                (262, {"space": "chest", "tgt": (0.06, 0.05, -0.72), "pole": (1.0, 0.5, 0.0), "twist": 0}),
                (280, HANGING), (288, HANGING),
            ],
        },
    },
    "bruno": {
        # A nervous beginner who has never done this: arms hugged round himself, a tug at his goggles, a check of the life
        # vest strap, weight shifting from foot to foot, quick worried glances round, shoulders up by his ears.
        "WaitNervous": {
            "frames": 240,
            "breath_frames": 24,
            "hips": [(0, (0, 0, 0)), (20, (0.016, 0, -0.004)), (60, (-0.016, 0, -0.004)), (100, (0.016, 0, -0.004)), (140, (-0.016, 0, -0.004)), (180, (0.016, 0, -0.004)), (220, (-0.016, 0, -0.004)), (240, (0, 0, 0))],
            "hips_turn": [(0, (0, 0, 0)), (20, (0, 0, 2)), (60, (0, 0, -2)), (100, (0, 0, 2)), (140, (0, 0, -2)), (180, (0, 0, 2)), (220, (0, 0, -2)), (240, (0, 0, 0))],
            "head": [(0, (0, 4, 0)), (24, (0, 4, 0)), (34, (-40, 2, 0)), (46, (-40, 2, 0)), (58, (36, 2, 0)), (70, (36, 2, 0)), (84, (0, 8, 0)), (150, (0, 8, 0)), (160, (-44, 0, 0)), (170, (-44, 0, 0)), (182, (24, 0, 0)), (192, (24, 0, 0)), (206, (0, 4, 0)), (240, (0, 4, 0))],
            "spine": [(0, (0, 6, 0)), (84, (0, 6, 0)), (240, (0, 6, 0))],
            "shrug": [(0, 0.5), (240, 0.5)],
            "armL": [
                (0, "hug"), (84, "hug"),
                (100, {"space": "head", "tgt": (0.95, -0.8, -0.5), "pole": (0.8, 0.3, -0.8), "twist": 0}),
                (124, {"space": "head", "tgt": (0.95, -0.8, -0.5), "pole": (0.8, 0.3, -0.8), "twist": 0}),
                (140, "hug"), (240, "hug"),
            ],
            "armR": [
                (0, "hug"), (84, "hug"),
                (100, {"space": "head", "tgt": (0.95, -0.8, -0.5), "pole": (0.8, 0.3, -0.8), "twist": 0}),
                (112, {"space": "head", "tgt": (0.95, -0.8, -0.5), "pole": (0.8, 0.3, -0.8), "twist": 0}),
                (132, {"space": "chest", "tgt": (-0.25, -0.50, -0.30), "pole": (0.5, 0.3, -1.0), "twist": 0}),
                (150, {"space": "chest", "tgt": (-0.25, -0.50, -0.30), "pole": (0.5, 0.3, -1.0), "twist": 0}),
                (166, "hug"), (240, "hug"),
            ],
        },
    },
}


# ---- the rig -----------------------------------------------------------------------------------------------------------
args = common.script_args()
who = common.option(args, "--character")
only = common.option(args, "--only")
src, dst = args[0], args[1]
if who not in CLIPS:
    raise SystemExit(f"--character must be one of {sorted(CLIPS)}")
todo = {n: c for n, c in CLIPS[who].items() if not only or n in only.split(",")}


def smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)


def between(keys, t):
    """The two keys' values around frame t and the eased fraction from the first to the second."""
    if t <= keys[0][0]:
        return keys[0][1], keys[0][1], 0.0
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return v0, v1, smooth((t - t0) / (t1 - t0))
    return keys[-1][1], keys[-1][1], 0.0


def lerp(a, b, u):
    if isinstance(a, (tuple, list)):
        return tuple(x + (y - x) * u for x, y in zip(a, b))
    return a + (b - a) * u


def rot(axis, angle):
    return Matrix.Rotation(angle, 3, axis)


def rot_part(matrix):
    return matrix.to_3x3().to_quaternion().to_matrix()


def turn_of(yaw_pitch_roll):
    yaw, pitch, roll = (math.radians(v) for v in yaw_pitch_roll)
    return rot("Z", yaw) @ rot("X", pitch) @ rot("Y", roll)


common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
arm = next((o for o in scene.objects if o.type == "ARMATURE"), None)
if arm is None:
    raise SystemExit("No armature in " + src)
pose = arm.pose.bones
bones = common.humanoid_bones(arm)
hips, chest, neck, head, spine = bones["hips"], bones["chest"], bones["neck"], bones["head"], bones["spine"]
sides = {"L": bones["left"], "R": bones["right"]}
for pb in pose:
    pb.rotation_mode = "QUATERNION"
W = arm.matrix_world  # armature space (centimetres) to metres


def world(p):
    return W @ p


arm.animation_data_create()
arm.animation_data.action = None
for t in arm.animation_data.nla_tracks:
    t.mute = True

out = {s: 1.0 if sides[s]["upper"].head_local.x > 0 else -1.0 for s in sides}
rest_dir = {
    s: {
        "upper": (f["fore"].head_local - f["upper"].head_local).normalized(),
        "fore": (f["hand"].head_local - f["fore"].head_local).normalized(),
        "thigh": (f["shin"].head_local - f["thigh"].head_local).normalized(),
        "shin": (f["foot"].head_local - f["shin"].head_local).normalized(),
    }
    for s, f in sides.items()
}
length = {
    s: {
        "upper": (world(f["fore"].head_local) - world(f["upper"].head_local)).length,
        "fore": (world(f["hand"].head_local) - world(f["fore"].head_local)).length,
        "thigh": (world(f["shin"].head_local) - world(f["thigh"].head_local)).length,
        "shin": (world(f["foot"].head_local) - world(f["shin"].head_local)).length,
    }
    for s, f in sides.items()
}
rests = {b.name: rot_part(b.matrix_local) for b in arm.data.bones}
ankle_rest = {s: world(f["foot"].head_local) for s, f in sides.items()}

# the head's box at rest, from the vertices the head bone owns
mesh = common.meshes()[0]
group = mesh.vertex_groups.get(head.name)
lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
for v in mesh.data.vertices:
    if any(g.group == group.index and g.weight > 0.5 for g in v.groups):
        p = mesh.matrix_world @ v.co
        lo = Vector(map(min, lo, p))
        hi = Vector(map(max, hi, p))
head_half = (hi - lo) / 2
head_centre = (hi + lo) / 2
head_pivot = world(head.head_local)


def set_orientation(bone, orientation):
    pb = pose[bone.name]
    m = orientation.to_4x4()
    m.translation = pb.matrix.translation
    pb.matrix = m
    bpy.context.view_layer.update()


def set_turn(bone, turn):
    set_orientation(bone, turn @ rests[bone.name])


def side_of(n, pole):
    """The part of `pole` at right angles to the line `n`: the way the middle joint of the chain sticks out."""
    side = pole - n * pole.dot(n)
    return side.normalized() if side.length > 1e-6 else Vector((0, 0, 1)) - n * n.z


def two_bone(root, end, a, b, pole):
    """Directions of the upper and lower bone that put the end of the chain on `end`, the middle joint toward `pole`."""
    to = end - root
    d = max(abs(a - b) + 1e-4, min(a + b - 1e-4, to.length))
    n = to.normalized()
    x = (a * a - b * b + d * d) / (2 * d)
    h = math.sqrt(max(a * a - x * x, 0.0))
    middle = root + n * x + side_of(n, pole) * h
    return (middle - root).normalized(), (root + n * d - middle).normalized()


def frame_of(direction, pole, other):
    """A frame with its y along the bone and its x toward the way the joint bends: `pole`, helped by the neighbouring bone's
    direction `other` (pointing so that it agrees with the pole in a bent joint). It turns smoothly with both, so a bone
    aimed by it never flips the way a shortest-turn rotation does near the opposite direction."""
    def across(v):
        return v - direction * v.dot(direction)

    x = across(pole) + 0.6 * across(other)
    x = x.normalized() if x.length > 1e-6 else side_of(direction, Vector((0, 0, 1)))
    c = x.cross(direction)
    return Matrix(((x.x, direction.x, c.x), (x.y, direction.y, c.y), (x.z, direction.z, c.z)))


ARM_POLE = Vector((0, 1, 0))  # an arm held out bends its elbow toward the back
LEG_POLE = Vector((0, -1, 0))  # a leg bends its knee forward


def aim(bone, direction, pole, other, rest_direction, rest_pole, rest_other, twist=0.0):
    """Orient the bone along `direction` with its bend toward `pole`, as it is at rest along `rest_direction`; `twist`
    turns it about its own axis. `other` is the direction of the bone next to it, up the chain for a lower bone and
    reversed for an upper one."""
    turn = frame_of(direction, pole, other) @ frame_of(rest_direction, rest_pole, rest_other).inverted()
    set_orientation(bone, Matrix.Rotation(twist, 3, direction) @ turn @ rests[bone.name])


def hang_spec(side):
    """The relaxed arm of the idle clips, as a wrist target in fractions of the reach."""
    a, b = length[side]["upper"], length[side]["fore"]
    wrist = Vector(
        (
            a * math.sin(HANG) + b * math.sin(FORE_HANG),
            -b * math.cos(FORE_HANG) * math.sin(BEND),
            -a * math.cos(HANG) - b * math.cos(FORE_HANG) * math.cos(BEND),
        )
    ) / (a + b)
    return {"space": "chest", "tgt": tuple(wrist), "pole": (0.3, 0.7, -0.2), "twist": 0}


POSES = {
    "clasp": {"space": "chest", "tgt": (-0.36, -0.60, -0.62), "pole": (0.6, 0.4, -1.0), "twist": 0},  # hands together over the belly
    "hug": {"space": "chest", "tgt": (-0.72, -0.50, -0.28), "pole": (0.3, 0.2, -1.0), "twist": 0},  # arms folded round himself
}


def spec_of(value, side):
    if value == HANGING:
        return hang_spec(side)
    return POSES[value] if isinstance(value, str) else value


def blend_specs(keys, t, side):
    a, b, u = between(keys, t)
    return spec_of(a, side), spec_of(b, side), u


def pose_frame(clip, t):
    def num(name, default):
        if name not in clip:
            return default
        a, b, u = between(clip[name], t)
        return lerp(a, b, u)

    breath = clip.get("breath", 1.0) * math.sin(2 * math.pi * t / clip.get("breath_frames", BREATH))
    for pb in pose:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()

    # hips: where they go (the legs follow below) and how they turn
    move = Vector(num("hips", (0, 0, 0)))
    move.z += 0.0015 * breath
    hips_turn = turn_of(num("hips_turn", (0, 0, 0)))
    to_armature = W.to_3x3().inverted() @ move
    pose[hips.name].location = rests[hips.name].inverted() @ to_armature
    bpy.context.view_layer.update()
    set_turn(hips, hips_turn)

    # spine: the turn is shared up the chain, the chest takes all of it; a little breathing on top
    yaw, pitch, roll = num("spine", (0, 0, 0))
    count = len(spine)
    chest_turn = hips_turn
    for i, bone in enumerate(spine):
        share = (i + 1) / count
        total = hips_turn @ turn_of((yaw * share, pitch * share - 0.7 * share * breath, roll * share))
        set_turn(bone, total)
        chest_turn = total
    # shoulders follow the chest; a shrug lifts them
    shrug = num("shrug", 0.0)
    for side, f in sides.items():
        set_turn(f["shoulder"], chest_turn @ rot("Y", -out[side] * math.radians(10) * shrug))

    # where the left or right wrist is going, for the head to look at
    reach = {s: length[s]["upper"] + length[s]["fore"] for s in sides}

    def shoulder_at(side):
        return world(pose[sides[side]["upper"].name].matrix.translation)

    def chest_goal(side, spec):
        x, y, z = spec["tgt"]
        return shoulder_at(side) + chest_turn @ (Vector((out[side] * x, y, z)) * reach[side])

    head_yaw, head_pitch, head_roll = num("head", (0, 0, 0))
    weight = num("look", 0.0)
    look_side = clip.get("look_wrist")
    if look_side and weight > 0:
        a, b, u = blend_specs(clip["arm" + look_side], t, look_side)
        goal = chest_goal(look_side, a if u < 0.5 or b["space"] != "chest" else b)
        if a["space"] == "chest" and b["space"] == "chest":
            goal = chest_goal(look_side, a) * (1 - u) + chest_goal(look_side, b) * u
        eye = world(pose[neck.name].matrix.translation) + chest_turn @ Vector((0, -0.04, head_half.z * 0.7))
        v = chest_turn.inverted() @ (goal - eye)
        look_yaw = math.degrees(math.atan2(v.x, -v.y))
        look_pitch = math.degrees(math.atan2(-v.z, math.hypot(v.x, v.y)))
        head_yaw = head_yaw + (look_yaw - head_yaw) * weight
        head_pitch = head_pitch + (look_pitch - head_pitch) * weight
        head_roll = head_roll + (math.copysign(1, look_yaw) * 4 - head_roll) * weight
    head_turn = chest_turn @ turn_of((head_yaw, head_pitch, head_roll))
    neck_turn = chest_turn @ turn_of((0.45 * head_yaw, 0.4 * head_pitch, 0.4 * head_roll))
    set_turn(neck, neck_turn)
    set_turn(head, head_turn)
    head_at = world(pose[head.name].matrix.translation)

    # arms: the wrist goes to its target, the elbow toward its pole
    for side, f in sides.items():
        o = out[side]
        a_len, b_len = length[side]["upper"], length[side]["fore"]
        a, b, u = blend_specs(clip.get("arm" + side, [(0, HANGING)]), t, side)
        shoulder = shoulder_at(side)

        def goal_of(spec):
            x, y, z = spec["tgt"]
            if spec["space"] == "head":
                offset = Vector((o * x * head_half.x, y * head_half.y, z * head_half.z))
                return head_at + head_turn @ (head_centre + offset - head_pivot)
            return shoulder + chest_turn @ (Vector((o * x, y, z)) * reach[side])

        va, vb = goal_of(a) - shoulder, goal_of(b) - shoulder
        ua, ub = va.normalized(), vb.normalized()
        swing = Quaternion((1, 0, 0, 0)).slerp(ua.rotation_difference(ub), u)  # round the shoulder, not through it
        goal = shoulder + (swing @ ua) * (va.length + (vb.length - va.length) * u)
        pole_arm = Vector(lerp(a["pole"], b["pole"], u))
        pole = chest_turn @ Vector((o * pole_arm.x, pole_arm.y, pole_arm.z))
        twist = math.radians(lerp(a["twist"], b["twist"], u))
        breathing = Vector((0, 0, 0.004 * breath))
        goal = goal + chest_turn @ breathing
        up, fore = two_bone(shoulder, goal, a_len, b_len, pole)
        rd = rest_dir[side]
        aim(f["upper"], up, pole, -fore, rd["upper"], ARM_POLE, -rd["fore"], twist / 3)
        aim(f["fore"], fore, pole, up, rd["fore"], ARM_POLE, rd["upper"], twist * 2 / 3)
        fore_orientation = rot_part(pose[f["fore"].name].matrix)
        hand_rest = fore_orientation @ rests[f["fore"].name].inverted() @ rests[f["hand"].name]
        set_orientation(f["hand"], Matrix.Rotation(twist / 3, 3, fore) @ hand_rest)

    # legs: the feet stay where they stand (a foot may lift for a tap), the knees bend to the hips
    for side, f in sides.items():
        o = out[side]
        forward, outward, lift = num("foot" + side, (0, 0, 0))
        ankle = ankle_rest[side] + Vector((o * outward, -forward, lift))
        hip = world(pose[f["thigh"].name].matrix.translation)
        up, down = two_bone(hip, ankle, length[side]["thigh"], length[side]["shin"], LEG_POLE)
        rd = rest_dir[side]
        aim(f["thigh"], up, LEG_POLE, -down, rd["thigh"], LEG_POLE, -rd["shin"])
        aim(f["shin"], down, LEG_POLE, up, rd["shin"], LEG_POLE, rd["thigh"])
        set_orientation(f["foot"], rests[f["foot"].name])


built = {}
for name, clip in todo.items():
    n = clip["frames"]
    keys = []
    previous = {}
    for frame in range(n + 1):
        pose_frame(clip, frame % n)  # the last frame is the first again
        row = {}
        for pb in pose:
            q = Quaternion(pb.rotation_quaternion)
            if pb.name in previous and previous[pb.name].dot(q) < 0:
                q.negate()
            previous[pb.name] = q
            row[pb.name] = (tuple(pb.location), q, tuple(pb.scale))
        keys.append(row)
    built[name] = keys
    print("BUILT", name, n, "frames")

for name, keys in built.items():
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
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
print("CLIPS", sorted(a.name for a in bpy.data.actions))
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
