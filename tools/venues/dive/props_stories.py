"""The Jumping Pool's stories at the edge of play, in game coordinates, all of them against the hedges, behind the stations or on
the towers, never where a guest walks or waits:
- the CHICKEN-OUT ZONE beside each HIGH tower: a little white hen house with a red roof and a ramp, rubber chickens on it and a
  basket of them (NO SHAME. SOME SHAME.);
- the judges' table against the far hedge: a green skirt, three empty chairs, the scorecards up (9.5, 10, 2), a bell, a megaphone,
  JUDGES · THEIR DECISION IS FINAL. AND HURTFUL.;
- the SPLASH-O-METER on its post in the far corner (DRIP to CARL, the needle at CARL);
- the HALL OF FAME · GREATEST BELLY FLOPS under a little roof against the far hedge (GPT Image 2.5: six of our characters
  mid-flop; 10 · CARL), the club's poster and the diving rules on the end hedges by the gates;
- the SPLASH ZONE's poncho stand, BEWARE OF THE PEACOCKS;
- the peacocks on the hedges (one with its tail fanned), a duck in swim goggles up on the HIGH tower's landing, a mallard and its
  ducklings walking in at the near gate.

    blender -b -P tools/venues/dive/props_stories.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
M = dict(
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    awning=tmat_tile("awning", "#2f6b4a", 0.8),
    marble=tmat_tile("marble", "#f1ece4", 0.25),
    white=sm("white"),
    cream=sm("cream"),
    racing=sm("racing"),
    red=sm("red"),
    yellow=sm("yellow"),
    lemon=sm("lemon"),
    brass=sm("brass"),
    gold=sm("gold"),
    ink=sm("ink"),
    navy=sm("navy"),
    rope=sm("rope"),
    straw=sm("straw", "#d9b56a", 0.9),
    poncho=sm("poncho", "#ffd23f", 0.35),
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


lb = box
R0 = ROOM
FARX = R0["maxX"] - HEDGE_T  # the far hedge's inner face
ENDZ = R0["maxZ"] - HEDGE_T  # the end hedges' inner faces (±)

# ================================================================================================================================
# THE CHICKEN-OUT ZONE beside each HIGH tower (its front to the pool)
# ================================================================================================================================
for s in (-1, 1):
    cx, cz = 5.6, s * 13.6
    o = [
        lb("Coop", -0.45, 0.45, 0.25, 1.0, -0.4, 0.4, M["white"], 0.02),
        lb("CoopTrim", -0.47, 0.47, 0.98, 1.03, -0.42, 0.42, M["red"], 0.01),
        lb("CoopDoor", -0.15, 0.15, 0.3, 0.7, 0.4, 0.42, M["ink"], 0.0),
        prism("CoopRoof", [(-0.55, 1.0), (0.55, 1.0), (0.0, 1.4)], -0.5, 0.5, M["red"]),
    ]
    for dx in (-0.4, 0.4):
        for dz in (-0.35, 0.35):
            o.append(lb("CoopLeg", dx - 0.03, dx + 0.03, 0.0, 0.25, dz - 0.03, dz + 0.03, M["white"], 0.005))
    ramp = lb("CoopRamp", -0.12, 0.12, -0.02, 0.02, 0.0, 0.7, M["teak"], 0.0)
    ramp.rotation_euler = (0.42, 0, 0)  # (Blender's x tilt: its far end down to the deck)
    ramp.location = g(0.0, 0.25, 0.42)
    o.append(ramp)
    o.append(card("CoopChicken", "rubber_chicken", 0.26, 0.15, 1.18, 0.0, 0.0))
    o.append(card("RampChicken", "rubber_chicken", 0.22, 0.0, 0.08, 0.85, 0.4))
    o.append(cyl("Basket", 0.22, 0.22, g(0.0, 0.0, -0.75), M["straw"], 14, r2=0.26))
    for k in range(5):
        a = k * 1.3
        o.append(sphere("BasketChicken", 0.07, g(0.1 * math.cos(a), 0.25, -0.75 + 0.1 * math.sin(a)), M["lemon"], 8, 5, scale=(1.5, 0.8, 0.8)))
    o.append(cyl("SignPost", 0.03, 1.6, g(0.0, 0.0, 0.7), M["white"], 8))
    o.append(face("ChickenSign", 0.9, 0.38, 0.0, 1.45, 0.72, 0.0, signmat("chicken", 0.5)))
    add("chicken", yawed(o, cx, cz, PI if s > 0 else 0.0, "ChickenCoop"))

# ================================================================================================================================
# THE JUDGES' TABLE against the far hedge (facing the pool, -x)
# ================================================================================================================================
jz = -11.6
o = [
    lb("JudgesTable", -1.3, 1.3, 0.72, 0.76, -0.35, 0.35, M["teak"], 0.01),
    lb("JudgesSkirt", -1.3, 1.3, 0.05, 0.72, 0.33, 0.36, M["racing"], 0.0),
    face("JudgesSign", 1.6, 0.5, 0.0, 0.45, 0.37, 0.0, signmat("judges", 0.5)),
]
for k, dx in enumerate((-0.8, 0.0, 0.8)):
    o.append(lb("JudgeChair", dx - 0.22, dx + 0.22, 0.45, 0.5, -0.75, -0.35, M["white"], 0.02))
    o.append(lb("JudgeChairBack", dx - 0.22, dx + 0.22, 0.5, 1.05, -0.78, -0.73, M["white"], 0.02))
    o.append(rod("CardStick", (dx, 0.76, 0.1), (dx, 1.25, 0.1), 0.012, M["teak"]))
    o.append(face("Scorecard", 0.32, 0.32, dx, 1.38, 0.112, 0.0, signmat(f"score_{k}", 0.5)))
o += [
    cyl("JudgesBell", 0.08, 0.06, g(1.1, 0.76, 0.0), M["brass"], 14, r2=0.02),
    cyl("Megaphone", 0.05, 0.4, g(-1.05, 0.8, 0.0), M["red"], 12, r2=0.14, rot=(0, PI / 2, 0.4)),
    cyl("WaterJug", 0.07, 0.22, g(0.45, 0.76, -0.1), sm("glass"), 12),
]
add("judges", yawed(o, FARX - 0.45, jz, -PI / 2, "JudgesTable"))

# ================================================================================================================================
# THE SPLASH-O-METER in the far corner; THE HALL OF FAME against the far hedge; THE PONCHOS; THE PEACOCK WARNING
# ================================================================================================================================
o = [
    cyl("MeterPost", 0.06, 1.6, g(0, 0, -0.1), M["white"], 10),
    lb("MeterBack", -0.7, 0.7, 1.3, 2.7, -0.06, 0.0, M["racing"], 0.02),
    face("MeterDial", 1.3, 1.3, 0.0, 2.0, 0.005, 0.0, signmat("splashometer", 0.5)),
]
add("stories", yawed(o, FARX - 0.25, -14.3, -PI / 2, "SplashOMeter"))
o = [
    lb("FameBoard", -1.2, 1.2, 0.7, 2.6, -0.08, 0.0, M["racing"], 0.02),
    face("Fame", 2.24, 1.68, 0.0, 1.62, 0.005, 0.0, signmat("halloffame", 0.5)),
    prism("FameRoof", [(-1.35, 2.6), (1.35, 2.6), (0.0, 2.95)], -0.35, 0.12, M["racing"]),
    face("FamePlate", 1.6, 0.36, 0.0, 0.48, 0.005, 0.0, signmat("halloffame_plate", 0.5)),
    lb("FamePlateBack", -0.82, 0.82, 0.29, 0.67, -0.06, 0.0, M["racing"], 0.01),
]
for x in (-1.1, 1.1):
    o.append(lb("FamePost", x - 0.06, x + 0.06, 0.0, 2.7, -0.14, -0.02, M["white"], 0.01))
add("stories", yawed(o, FARX - 0.3, 10.0, -PI / 2, "HallOfFame"))
o = [cyl("PonchoStand", 0.04, 1.9, g(0, 0, 0), M["white"], 8), cyl("PonchoFoot", 0.25, 0.04, g(0, 0, 0), M["white"], 14)]
for k in range(3):
    a = k * 2 * PI / 3
    o.append(rod("PonchoHook", (0, 1.75, 0), (0.25 * math.cos(a), 1.8, 0.25 * math.sin(a)), 0.012, M["brass"]))
    o.append(cyl("Poncho", 0.08, 0.95, g(0.3 * math.cos(a), 0.85, 0.3 * math.sin(a)), M["poncho"], 10, r2=0.2))
o.append(face("PonchoSign", 0.8, 0.27, 0.0, 2.1, 0.06, 0.0, signmat("ponchos", 0.5)))
add("stories", yawed(o, FARX - 0.35, 3.6, -PI / 2, "Ponchos"))
add("stories", face("Peacocks", 1.2, 0.29, FARX - 0.02, 0.95, -5.4, -PI / 2, signmat("peacocks", 0.5)))
# the club's poster and the diving rules on the end hedges by the gates, facing in
for s in (-1, 1):
    th = 0.0 if s < 0 else PI
    zf = s * (ENDZ - 0.03)
    for name, sign, w, h, x, y in (("Poster", "poster", 0.9, 1.2, -5.0, 1.15), ("Rules", "rules", 0.76, 1.07, -3.2, 1.1)):
        add("stories",
            face(name, w, h, x, y, zf - s * 0.02, th, signmat(sign, 0.5)),
            box(name + "Frame", x - w / 2 - 0.05, x + w / 2 + 0.05, y - h / 2 - 0.05, y + h / 2 + 0.05, zf - s * 0.015, zf, M["racing"], 0.01))
        for dx in (-w / 2 + 0.05, w / 2 - 0.05):
            add("stories", rod(name + "Stake", (x + dx, 0.0, zf - s * 0.01), (x + dx, y - h / 2, zf - s * 0.01), 0.02, M["white"]))

# ================================================================================================================================
# THE BIRDS: peacocks on the hedges, a duck in swim goggles on the HIGH tower's landing, a mallard and its ducklings at the gate
# ================================================================================================================================
add("birds",
    card("PeacockFan", "peacock_fan", 0.95, FARX + 0.35, HEDGE_H, -2.2, -PI / 2 + 0.3),
    card("PeacockWalk", "peacock_walk", 0.7, 1.5, HEDGE_H, ENDZ + 0.35, PI + 0.2),
    card("PeacockWalk", "peacock_walk", 0.7, 7.5, HEDGE_H, -(ENDZ + 0.35), 0.3),
    card("PeacockFan", "peacock_fan", 0.8, R0["minX"] + 0.35, HEDGE_H, 9.5, PI / 2 - 0.2))
for b in BOARDS:
    if b["h"] == 2:
        back = b["backZ"] + b["side"] * 0.2
        add("birds", card("TowerDuck", "duck_goggles", 0.34, b["x"] - 0.4, 4.09, back + b["side"] * 0.6, -PI / 2 + 0.5))
for s in (-1, 1):
    zg = s * (R0["maxZ"] + 1.2)
    add("birds", card("Mallard", "duck", 0.4, GATE_X + 0.5, GROUND_Y, zg, 0.0 if s < 0 else PI))
    for k in range(3):
        add("birds", card("Duckling", "duckling", 0.2, GATE_X + 0.5 - 0.45 - k * 0.32, GROUND_Y, zg + s * 0.1 * (k % 2), 0.0 if s < 0 else PI))

for k, v in parts.items():
    print("GROUP", k, tris(v))
if LOOK:
    look("stories_far", g(12, 1.5, 0), 14, 15, 270, (1280, 720), 16, 35)
    look("stories_coop", g(5.6, 0.8, 13.6), 4, 20, 270, (1280, 720), 16, 35)
for k, v in parts.items():
    save_part("stories_" + k, v)
