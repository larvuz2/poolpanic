"""What is painted on or inlaid in the deck, modelled in place (Godot coordinates, placed at the origin): nothing here stands up,
so the coach and the guests walk over all of it.
- no footprints at the queue slots (the creator, 30 October 2026: "I don't want any footprints. Just keep normal floor", for
  every venue to come too);
- a mosaic compass rose inlaid at the far end (x 0, z 11.1), in tinted mosaic tiles (GD_mosaic_*);
- the depth on the coping (1.85 m at the blocks, 1.1 m at the far end, between on the sides), NO DIVING at the shallow end;
- the lane numbers at the far end, NO RUNNING by the far wall, rubber mats at the ladders and in front of the changing rooms'
  doors in the back wall.
Writes godot/assets/venue/props/floor_markings.glb.

    blender -b -P godot/tools/blender/props_floor.py
"""

import os, sys, math, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lib import *

reset()
VENUE_JSON = json.load(open(os.path.join(GODOT, "data", "club-venue.json")))
Y = 0.003  # painted lines sit 3 mm over the deck
paint_coral = mat("paint_coral", "#ef6a4c", 0.5)
paint_navy = mat("paint_navy", "#1d3557", 0.5)
paint_cream = mat("paint_cream", "#f4ead2", 0.5)
paint_yellow = mat("paint_yellow", "#f2b33d", 0.5)
rubber = mat("mat_rubber", "#2f4a5e", 0.85)
parts = []


def flat_poly(name, pts_g, y, m, depth=0.002):
    """A flat shape on the deck from Godot (x, z) points, `depth` thick, its top at y."""
    pts = [(x, -z) for x, z in pts_g]  # Blender (x, y) = Godot (x, -z)
    return extrude_shape(name, pts, depth, (0, 0, y - depth), m)


def disc(name, cx, cz, r, y, m, n=40, sq=1.0, rot=0.0):
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        x, z = r * math.cos(a), r * sq * math.sin(a)
        pts.append((cx + x * math.cos(rot) - z * math.sin(rot), cz + x * math.sin(rot) + z * math.cos(rot)))
    return flat_poly(name, pts, y, m)


def floor_text(name, body, x, z, size, m, rot_deg=0.0, face="BarlowCondensed-Black"):
    """Text painted on the deck, reading left to right on screen (along +Z) unless rotated."""
    o = text(name, body, size, 0.002, g(x, Y + 0.001, z), (0, 0, math.radians(-90 + rot_deg)), m, face=face)
    return o


# ---- the mosaic compass rose at the far end ----------------------------------------------------------------------------------
cx, cz = 0.0, 11.05
mos = {c: gdmat("mosaic_" + c, h, 0.2) for c, h in [("navy", "#1d3557"), ("cream", "#f3e6c9"), ("coral", "#ef6a4c"), ("sea", "#2f8c88"), ("mustard", "#f2b33d")]}
parts.append(disc("RoseRim", cx, cz, 1.25, Y - 0.0005, mos["navy"], 72))
parts.append(disc("RoseField", cx, cz, 1.1, Y, mos["cream"], 72))
for k in range(16):  # a ring of little wave dots
    a = 2 * math.pi * k / 16
    parts.append(disc(f"RoseDot{k}", cx + 1.0 * math.cos(a), cz + 1.0 * math.sin(a), 0.04, Y + 0.0006, mos["sea"], 12))
for k in range(8):  # the eight points of the compass, long ones coral and short ones sea
    a = math.pi / 2 + k * math.pi / 4
    long_ = k % 2 == 0
    r = 0.92 if long_ else 0.55
    w = 0.16 if long_ else 0.12
    tip = (cx + r * math.cos(a), cz + r * math.sin(a))
    l = (cx + w * math.cos(a + math.pi / 2), cz + w * math.sin(a + math.pi / 2))
    rr = (cx + w * math.cos(a - math.pi / 2), cz + w * math.sin(a - math.pi / 2))
    m = mos["coral"] if long_ else mos["sea"]
    parts.append(flat_poly(f"RosePointA{k}", [(cx, cz), l, tip], Y + 0.0008 + k * 0.00005, m))
    parts.append(flat_poly(f"RosePointB{k}", [(cx, cz), tip, rr], Y + 0.0008 + k * 0.00005, mos["navy"] if long_ else mos["cream"]))
parts.append(disc("RoseHub", cx, cz, 0.12, Y + 0.0015, mos["mustard"], 32))
# the compass letters (north toward the window wall, +X, which is screen up)
for letter, dx, dz in (("N", 1.05, 0), ("S", -1.05, 0), ("E", 0, 1.05), ("W", 0, -1.05)):
    pass  # (the dots and points read better than letters at this distance)

# ---- the depth on the coping, NO DIVING at the shallow end, the lane numbers ----------------------------------------------------
COP_Y = 0.012 + 0.002
for x, z, label, rot in [(-4.4, -8.5, "1.85 m", 0), (4.4, -8.5, "1.85 m", 0), (-4.4, 8.5, "1.1 m", 0), (4.4, 8.5, "1.1 m", 0)]:
    parts.append(text(f"Depth{x}{z}", label, 0.16, 0.002, g(x, COP_Y, z), (0, 0, math.radians(-90 + rot)), paint_navy))
for x in (-5.17, 5.17):
    for z, label in ((-4.5, "1.7 m"), (0.0, "1.5 m"), (4.5, "1.3 m")):
        parts.append(text(f"DepthSide{x}{z}", label, 0.14, 0.002, g(x, COP_Y, z), (0, 0, math.radians(-90)), paint_navy))
# NO DIVING: a circle-and-bar with a diver, on the deck at the shallow end corners
for x in (-3.4, 3.4):
    z = 9.45
    ring_pts_o = [(x + 0.24 * math.cos(2 * math.pi * k / 40), z + 0.24 * math.sin(2 * math.pi * k / 40)) for k in range(40)]
    parts.append(disc(f"NoDiveRing{x}", x, z, 0.25, Y, paint_coral, 40))
    parts.append(disc(f"NoDiveField{x}", x, z, 0.205, Y + 0.0004, paint_cream, 40))
    parts.append(flat_poly(f"NoDiveFigure{x}", [(x - 0.12, z - 0.04), (x + 0.05, z + 0.1), (x + 0.12, z + 0.06), (x - 0.04, z - 0.07)], Y + 0.0008, paint_navy))
    parts.append(disc(f"NoDiveHead{x}", x - 0.13, z - 0.08, 0.035, Y + 0.0008, paint_navy, 16))
    a = math.radians(45)
    parts.append(flat_poly(f"NoDiveBar{x}", [(x - 0.17, z - 0.14), (x - 0.14, z - 0.17), (x + 0.17, z + 0.14), (x + 0.14, z + 0.17)], Y + 0.0012, paint_coral))
for k, lx in enumerate((-3.2, 0.0, 3.2)):
    parts.append(floor_text(f"LaneNo{k}", str(k + 1), lx, 9.75, 0.5, paint_navy))
parts.append(floor_text("NoRunning", "NO RUNNING", 0.0, 12.35, 0.42, paint_coral))
parts.append(flat_poly("NoRunningLine", [(-1.8, 12.08), (1.8, 12.08), (1.8, 12.12), (-1.8, 12.12)], Y, paint_coral))

# ---- an anchor in the mosaic on the near side, the club's emblem -------------------------------------------------------------
ax, az = -7.5, -1.6
parts.append(disc("AnchorRim", ax, az, 0.95, Y - 0.0005, mos["navy"], 64))
parts.append(disc("AnchorField", ax, az, 0.82, Y, mos["sea"], 64))
parts.append(disc("AnchorRing", ax, az, 0.74, Y + 0.0003, mos["cream"], 64))
parts.append(disc("AnchorInner", ax, az, 0.66, Y + 0.0005, mos["sea"], 64))
# the anchor itself, in cream, pointing up the screen (+x): a shank, a stock, the crown's arms and a ring
def ap(points):  # (along +x, along +z) -> (x, z)
    return [(ax + u, az + v) for u, v in points]
parts.append(flat_poly("AnchorShank", ap([(-0.42, -0.035), (0.38, -0.035), (0.38, 0.035), (-0.42, 0.035)]), Y + 0.0009, mos["cream"]))
parts.append(flat_poly("AnchorStock", ap([(0.24, -0.22), (0.3, -0.22), (0.3, 0.22), (0.24, 0.22)]), Y + 0.0011, mos["cream"]))
parts.append(disc("AnchorEye", ax + 0.45, az, 0.075, Y + 0.0012, mos["cream"], 24))
parts.append(disc("AnchorEyeHole", ax + 0.45, az, 0.035, Y + 0.0014, mos["sea"], 16))
arm = []
for k in range(17):
    a = math.pi * (0.15 + 0.7 * k / 16)
    arm.append((-0.42 + 0.3 * (1 - math.sin(a)), 0.36 * math.cos(a)))
inner = [(-0.42 + 0.06 + 0.24 * (1 - math.sin(math.pi * (0.15 + 0.7 * k / 16))), 0.29 * math.cos(math.pi * (0.15 + 0.7 * k / 16))) for k in reversed(range(17))]
parts.append(flat_poly("AnchorArms", ap(arm + inner), Y + 0.001, mos["cream"]))
for s_ in (-1, 1):
    parts.append(flat_poly(f"AnchorFluke{s_}", ap([(-0.31, s_ * 0.26), (-0.12, s_ * 0.40), (-0.3, s_ * 0.40)]), Y + 0.0013, mos["coral"]))

# ---- DEEP END and SHALLOW END painted along both long sides ---------------------------------------------------------------------
for x in (-6.75, 6.75):
    parts.append(floor_text(f"DeepEnd{x}", "DEEP END", x, -6.2, 0.34, paint_navy))
    parts.append(floor_text(f"ShallowEnd{x}", "SHALLOW END", x, 6.2, 0.34, paint_navy))

# ---- rubber mats: at the top of each ladder and in front of the changing rooms' doors -----------------------------------------------------------
def mat_pad(name, cx, cz, w, d):
    o = gbox_flat(name, cx, cz, w, d)
    return o


def gbox_flat(name, cx, cz, sx, sz, h=0.012):
    o = box(name, (sx, sz, h), g(cx, h / 2, cz), rubber, 0.005)
    return o


for name, x, z, w, d in [("MatLadderA", -6.0, 5.0, 0.8, 1.1), ("MatLadderB", 6.0, -4.1, 0.8, 1.1), ("MatDoorMen", -10.7, -16.2, 1.3, 0.8), ("MatDoorWomen", 10.7, -16.2, 1.3, 0.8)]:
    parts.append(gbox_flat(name, x, z, w, d))
    # drainage ribs on the mat
    for r in range(5):
        off = -d / 2 + 0.15 + r * (d - 0.3) / 4
        parts.append(box(f"{name}Rib{r}", (w - 0.12, 0.03, 0.006), g(x, 0.014, z + off), mat("mat_rib", "#3c5d74", 0.8), 0.002))

root = parent_all(parts, "FloorMarkings")
export(os.path.join(VENUE, "props", "floor_markings.glb"), [root])
