"""The Rooftop Pool's furniture, in game coordinates, every piece where the game's plan has it (kit.PLAN):
- the sunbeds (teak frames, thick cream linen cushions, a raised back to the near wall: a guest lies on one at 0.5 m, the game's
  towels on it) and the two VIP cabanas (teak posts, a linen canopy and valances, curtains gathered at the posts and drawn along
  the back, a day bed piled with pillows; velvet ropes on brass stanchions and VIP ONLY behind them);
- the parasols furled for the evening, the festoons between them (`Light_Festoon`), the side tables (marble on brass, a candle in
  a hurricane glass: `Light_Lantern`);
- the lounge: three rattan sofas with linen cushions round a granite fire table of glass beads (the flames and their light are
  the game's);
- the Sky Bar: a teal zellige counter with a Calacatta top and a brass foot rail, stools, the back bar (bronze, a mirror, three lit
  shelves of bottles: `Light_Kiosk`), the menu, the tip jar for the pigeon fund, a pigeon with a cherry (SKY BAR's neon, the
  margaritas and the bartender are the game's);
- the DJ: the riser, the booth with DJ SPLASH on its front, decks, a mixer and headphones, the speakers on their stands, a truss
  over the LED wall with par cans (the LED wall, its light and beams, the riser's lit edge and the DJ are the game's);
- the palms in white concrete planters, clipped bay balls in bronze pots by the lifts, rattan lanterns (`Light_Lantern`), ice
  buckets of champagne by the cabanas;
- the stations: WATER CARE and EYE CARE (zellige cabinets, marble tops, brass plates), the skimmer's board on the near rail, the
  waste bin, the rings' boards (`LifeRing`), the net's board, the torch on a brass pedestal (`Flashlight`), the fuse box's service
  column and DANGER, the dog treats' table.

    blender -b -P tools/venues/roof/props_furniture.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import palm  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(185)
M = dict(
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    linen=tmat_tile("linen", "#efe6d2", 0.85),
    rattan=tmat_tile("rattan", "#c79a5a", 0.8),
    marble=tmat_tile("marble", "#f1ece4", 0.25),
    zellige=tmat_tile("zellige", "#1f6a6c", 0.2),
    granite=tmat_tile("granite", "#151618", 0.25),
    concrete=tmat_tile("concrete", "#ece8e0", 0.7),
    bronze_t=tmat_tile("bronze", "#5a4632", 0.4),
    bronze=sm("bronze"),
    brass=sm("brass"),
    gold=sm("gold"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    black=sm("black"),
    ink=sm("ink"),
    charcoal=sm("charcoal"),
    teal=sm("teal"),
    coral=sm("coral"),
    pink=sm("pink"),
    velvet=sm("velvet"),
    red=sm("red"),
    yellow=sm("yellow"),
    lime=sm("lime"),
    towel=sm("towel"),
    rubber=sm("rubber"),
    glass=sm("glass"),
    ice=sm("ice"),
    leaf_dark=sm("leaf_dark"),
    soil=sm("soil", "#3a2a1c", 0.95),
    mirror=sm("mirror", "#c9d4da", 0.05, 1.0),
    bottle_g=sm("bottle_g", "#2f7a46", 0.15),
    bottle_a=sm("bottle_a", "#a8661c", 0.15),
    bottle_c=sm("bottle_c", "#d8eef2", 0.1),
    bottle_r=sm("bottle_r", "#7a2034", 0.15),
    bottle_b=sm("bottle_b", "#2f5f9e", 0.15),
    frond=cutmat("palm_frond", 0.65),
    bulb=lamp_mat("festoon_bulb", "#ffe0a8", 3.0),
    candle=lamp_mat("candle_glow", "#ffc27a", 3.0),
    shelf=lamp_mat("shelf_glow", "#ffcf8a", 3.0),
    par_pink=lamp_mat("par_pink", "#ff4fc0", 3.5),
    par_cyan=lamp_mat("par_cyan", "#4fd8ff", 3.5),
)
trees.use({"frond": M["frond"], "bark": sm("bark", "#7a5d40", 0.9), "bark_light": sm("bark", "#7a5d40", 0.9), "palm_boot": sm("bark", "#7a5d40", 0.9), "coconut": sm("coconut", "#6b4a2a", 0.8)})
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


lb = box  # (the kit's box by extents: in local coordinates before `yawed`, in game coordinates otherwise)
S = STATIONS
F = FIXTURES

# ================================================================================================================================
# THE SUNBEDS (head to -x, the near wall; a guest lies at 0.5 m; the game's towels on the seat)
# ================================================================================================================================
def sunbed(x, z):
    o = []
    for s in (-1, 1):
        o.append(box("BedRail", x - 1.0, x + 1.0, 0.18, 0.3, z + s * 0.31, z + s * 0.37, M["teak"], 0.015))
        for dx in (-0.92, 0.92):
            o.append(box("BedLeg", x + dx - 0.04, x + dx + 0.04, 0.0, 0.22, z + s * 0.31, z + s * 0.37, M["teak"], 0.01))
    o.append(box("BedSlats", x - 0.3, x + 1.0, 0.28, 0.32, z - 0.33, z + 0.33, M["teak"], 0.0))
    o.append(box("BedEnd", x + 0.96, x + 1.02, 0.18, 0.36, z - 0.37, z + 0.37, M["teak"], 0.01))
    o.append(box("Cushion", x - 0.32, x + 0.98, 0.32, 0.45, z - 0.34, z + 0.34, M["linen"], 0.045))
    # the raised back: a teak wedge under a linen one
    o.append(prism("BedBackFrame", [(x - 1.0, 0.22), (x - 0.3, 0.22), (x - 0.3, 0.32), (x - 0.98, 0.78), (x - 1.04, 0.74)], z - 0.34, z + 0.34, M["teak"]))
    o.append(prism("BedBack", [(x - 0.96, 0.78), (x - 0.3, 0.33), (x - 0.3, 0.45), (x - 0.92, 0.88)], z - 0.33, z + 0.33, M["linen"]))
    o.append(cyl("Headrest", 0.07, 0.6, g(x - 0.86, 0.9, z - 0.3), M["linen"], 12, rot=(PI / 2, 0, 0)))
    o.append(cyl("Wheel", 0.07, 0.04, g(x - 1.0, 0.07, z - 0.39), M["rubber"], 12, rot=(PI / 2, 0, 0)))
    o.append(cyl("Wheel", 0.07, 0.04, g(x - 1.0, 0.07, z + 0.35), M["rubber"], 12, rot=(PI / 2, 0, 0)))
    return o


for b in BEDS:
    if not b["cabana"]:
        add("beds", *sunbed(b["x"], b["z"]))

# ================================================================================================================================
# THE CABANAS (their front to the pool, +x; the camera sees their backs, the VIPs' ropes)
# ================================================================================================================================
CH = 2.6
for b in [b for b in BEDS if b["cabana"]]:
    x, z = b["x"], b["z"]
    o = []
    for dx in (-1.2, 1.2):
        for dz in (-1.2, 1.2):
            o.append(box("CabanaPost", x + dx - 0.06, x + dx + 0.06, 0.0, CH, z + dz - 0.06, z + dz + 0.06, M["teak"], 0.015))
            o.append(cyl("PostCap", 0.08, 0.06, g(x + dx, CH + 0.12, z + dz), M["brass"], 10))
            if dx > 0:
                # the curtains tied back at the front posts
                o.append(cyl("Curtain", 0.12, CH - 0.35, g(x + dx - 0.05, 0.05, z + dz - math.copysign(0.12, dz)), M["linen"], 12, r2=0.2))
                o.append(torus("CurtainTie", 0.15, 0.018, g(x + dx - 0.05, 1.2, z + dz - math.copysign(0.12, dz)), M["brass"], 14, 5))
    # the canopy: a flat top, a low pitched roof, valances all round
    o.append(box("Canopy", x - 1.32, x + 1.32, CH, CH + 0.06, z - 1.32, z + 1.32, M["linen"], 0.02))
    o.append(prism("CanopyRoof", [(x - 1.32, CH + 0.06), (x + 1.32, CH + 0.06), (x, CH + 0.42)], z - 1.32, z + 1.32, M["linen"]))
    for s in (-1, 1):
        o.append(box("Valance", x - 1.34, x + 1.34, CH - 0.28, CH + 0.02, z + s * 1.31, z + s * 1.34, M["linen"], 0.0))
        o.append(box("Valance", x + s * 1.31, x + s * 1.34, CH - 0.28, CH + 0.02, z - 1.34, z + 1.34, M["linen"], 0.0))
        o.append(box("ValanceTrim", x - 1.35, x + 1.35, CH - 0.3, CH - 0.27, z + s * 1.335, z + s * 1.345, M["gold"], 0.0))
        # the side curtains, half drawn
        o.append(box("SideCurtain", x - 1.18, x - 0.1, 0.06, CH - 0.28, z + s * 1.21, z + s * 1.23, M["linen"], 0.0))
    # the back drawn shut
    o.append(box("BackCurtain", x - 1.24, x - 1.22, 0.06, CH - 0.28, z - 1.18, z + 1.18, M["linen"], 0.0))
    # the day bed: a teak platform, a deep mattress, pillows against the back, a bolster
    o.append(box("DayBed", x - 1.1, x + 1.1, 0.0, 0.32, z - 1.1, z + 1.1, M["teak"], 0.03))
    o.append(box("Mattress", x - 1.06, x + 1.06, 0.32, 0.55, z - 1.06, z + 1.06, M["linen"], 0.06))
    for k, dz in enumerate((-0.7, 0.0, 0.7)):
        p = box("Pillow", -0.08, 0.08, -0.25, 0.25, -0.3, 0.3, (M["linen"], M["teal"], M["coral"])[k], 0.07)
        p.rotation_euler = (0, 0.35, 0)
        p.location = g(x - 0.88, 0.8, z + dz)
        o.append(p)
    o.append(cyl("Bolster", 0.1, 1.6, g(x - 0.6, 0.64, z - 0.8), M["teal"], 14, rot=(PI / 2, 0, 0)))
    # behind it: velvet ropes on brass stanchions, VIP ONLY (the camera's side)
    for dz in (-1.05, 0.0, 1.05):
        o.append(cyl("Stanchion", 0.03, 0.95, g(x - 1.42, 0.0, z + dz), M["brass"], 10))
        o.append(cyl("StanchionFoot", 0.13, 0.04, g(x - 1.42, 0.0, z + dz), M["brass"], 14))
        o.append(sphere("StanchionTop", 0.05, g(x - 1.42, 0.98, z + dz), M["brass"], 10, 6))
    for z0, z1 in ((-1.05, 0.0), (0.0, 1.05)):
        pts = [g(x - 1.42, 0.9 - 0.18 * math.sin(t * PI), z + z0 + (z1 - z0) * t) for t in np.linspace(0, 1, 7)]
        o.append(tube("VelvetRope", [Vector(p) for p in pts], 0.022, M["velvet"], 2, 6))
    o.append(face("VipSign", 0.36, 0.17, x - 1.45, 0.82, z, -PI / 2, signmat("vip", 0.5)))
    add("cabanas", *o)
    # the pigeon who got in
    add("cabanas", card("CabanaPigeon", "pigeon_vip", 0.34, x + 0.4, CH + 0.06, z + 0.6 * (1 if z > 0 else -1), -PI / 2 + 0.4))

# ================================================================================================================================
# THE PARASOLS, FURLED; THE FESTOONS BETWEEN THEM; THE SIDE TABLES
# ================================================================================================================================
for f in furniture("parasol"):
    x, z = f["x"], f["z"]
    add("parasols",
        box("ParasolBase", x - 0.21, x + 0.21, 0.0, 0.07, z - 0.21, z + 0.21, M["granite"], 0.02),
        cyl("ParasolPole", 0.035, 2.6, g(x, 0.07, z), M["teak"], 8),
        cyl("ParasolFurl", 0.04, 0.95, g(x, 1.45, z), M["linen"], 12, r2=0.16),
        cyl("ParasolTop", 0.16, 0.25, g(x, 2.4, z), M["linen"], 12, r2=0.05),
        torus("ParasolTie", 0.13, 0.016, g(x, 2.02, z), M["teal"], 12, 4),
        sphere("ParasolFinial", 0.05, g(x, 2.7, z), M["brass"], 8, 6))
rows = []
for xr in (ROOF["rowA"], ROOF["rowB"]):
    px = xr - BED["hx"] - 0.22
    rows.append(sorted([p for p in furniture("parasol") if abs(p["x"] - px) < 0.01], key=lambda p: p["z"]))
for row in rows:
    for a, b_ in zip(row, row[1:]):
        n = max(6, round(abs(b_["z"] - a["z"]) / 0.55))
        pts = [(a["x"], 2.45 - math.sin(k / n * PI) * 0.45, a["z"] + (b_["z"] - a["z"]) * k / n) for k in range(n + 1)]
        add("festoons", tube("FestoonWire", [Vector(g(px_, y + 0.04, pz)) for px_, y, pz in pts], 0.006, M["ink"], 2, 4))
        for px_, y, pz in pts[1:-1]:
            add("festoons", sphere("Light_Festoon", 0.05, g(px_, y, pz), M["bulb"], 8, 6))
for f in furniture("side-table"):
    x, z = f["x"], f["z"]
    add("tables",
        cyl("TableTop", 0.24, 0.03, g(x, 0.58, z), M["marble"], 20),
        cyl("TableStem", 0.025, 0.56, g(x, 0.02, z), M["brass"], 8),
        cyl("TableFoot", 0.17, 0.03, g(x, 0.0, z), M["brass"], 16),
        cyl("Hurricane", 0.06, 0.18, g(x - 0.08, 0.61, z + 0.06), M["glass"], 12),
        cyl("Light_Lantern", 0.025, 0.06, g(x - 0.08, 0.62, z + 0.06), M["candle"], 8),
        cyl("Coaster", 0.045, 0.006, g(x + 0.1, 0.61, z - 0.08), M["teal"], 10))

# ================================================================================================================================
# THE LOUNGE: rattan sofas round a fire table (the flames are the game's)
# ================================================================================================================================
LG = LOUNGE


def sofa():
    o = [
        lb("SofaBase", -1.05, 1.05, 0.0, 0.4, -0.4, 0.4, M["rattan"], 0.05),
        lb("SofaBack", -1.05, 1.05, 0.4, 0.78, -0.4, -0.24, M["rattan"], 0.04),
        lb("SeatCushion", -0.9, 0.9, 0.4, 0.55, -0.24, 0.38, M["linen"], 0.05),
        lb("BackCushion", -0.9, 0.9, 0.5, 0.86, -0.25, -0.1, M["linen"], 0.06),
    ]
    for s in (-1, 1):
        o.append(lb("SofaArm", s * 0.9, s * 1.05, 0.4, 0.62, -0.4, 0.4, M["rattan"], 0.04))
    for k, (dx, m) in enumerate(((-0.55, M["coral"]), (0.5, M["teal"]))):
        p = lb("Throw", -0.2, 0.2, -0.18, 0.18, -0.06, 0.06, m, 0.06)
        p.rotation_euler = (0.25, 0, 0.2 * (1 if k else -1))
        p.location = g(dx, 0.72, -0.08)
        o.append(p)
    return o


add("lounge", yawed(sofa(), LG["x"], LG["z"] - 1.35, 0.0, "Sofa"))
add("lounge", yawed(sofa(), LG["x"], LG["z"] + 1.35, PI, "Sofa"))
add("lounge", yawed(sofa(), LG["x"] - 1.05, LG["z"], PI / 2, "Sofa"))
fx = LG["x"] + 0.1
add("lounge",
    box("FireTable", fx - 0.35, fx + 0.35, 0.0, 0.42, LG["z"] - 0.75, LG["z"] + 0.75, M["granite"], 0.03),
    box("FireBeads", fx - 0.25, fx + 0.25, 0.42, 0.44, LG["z"] - 0.6, LG["z"] + 0.6, M["ice"], 0.0),
    box("FireRim", fx - 0.27, fx + 0.27, 0.42, 0.435, LG["z"] - 0.62, LG["z"] + 0.62, M["brass"], 0.0))

# ================================================================================================================================
# THE SKY BAR (its customers' side to the pool, +z; the bartender between it and the back bar)
# ================================================================================================================================
B = BAR
bx, bz = B["x"], B["z"]
o = [
    box("BarPlinth", bx - 1.72, bx + 1.72, 0.0, 0.1, bz - 0.38, bz + 0.38, M["granite"], 0.0),
    box("BarBody", bx - 1.78, bx + 1.78, 0.1, 1.02, bz - 0.44, bz + 0.44, M["zellige"], 0.02),
    box("BarTop", bx - 1.88, bx + 1.88, 1.02, 1.08, bz - 0.5, bz + 0.52, M["marble"], 0.01),
    box("BarTopEdge", bx - 1.89, bx + 1.89, 1.0, 1.03, bz + 0.5, bz + 0.53, M["brass"], 0.0),
    rod("FootRail", (bx - 1.7, 0.22, bz + 0.6), (bx + 1.7, 0.22, bz + 0.6), 0.025, M["brass"]),
]
for dx in (-1.5, -0.5, 0.5, 1.5):
    o.append(rod("FootBracket", (bx + dx, 0.22, bz + 0.6), (bx + dx, 0.22, bz + 0.44), 0.015, M["brass"]))
# the service side: a sink, an ice well, a speed rail of bottles
o.append(box("BarShelf", bx - 1.7, bx + 1.7, 0.85, 0.88, bz - 0.62, bz - 0.44, M["steel"], 0.0))
for k in range(9):
    o.append(cyl("SpeedBottle", 0.04, 0.3, g(bx - 1.4 + k * 0.33, 0.88, bz - 0.54), (M["bottle_g"], M["bottle_a"], M["bottle_c"], M["bottle_r"])[k % 4], 8))
add("bar", *o)
for dx in (-1.55, 1.55):
    sx_, sz_ = bx + dx, bz + 0.85
    add("bar",
        cyl("StoolSeat", 0.21, 0.08, g(sx_, 0.74, sz_), M["linen"], 16),
        cyl("StoolRing", 0.215, 0.02, g(sx_, 0.74, sz_), M["brass"], 16),
        cyl("StoolStem", 0.03, 0.72, g(sx_, 0.02, sz_), M["brass"], 8),
        cyl("StoolFoot", 0.18, 0.03, g(sx_, 0.0, sz_), M["brass"], 16),
        torus("StoolFootRing", 0.16, 0.012, g(sx_, 0.28, sz_), M["brass"], 16, 4))
# on the counter: the menu, the tip jar, limes, a shaker, the pigeon with a cherry
add("bar",
    box("MenuStand", bx - 1.72, bx - 1.66, 1.08, 1.5, bz + 0.1, bz + 0.38, M["brass"], 0.0),
    face("Menu", 0.28, 0.4, bx - 1.65, 1.3, bz + 0.24, PI / 2, signmat("bar_menu", 0.5)),
    cyl("TipJar", 0.08, 0.2, g(bx + 1.35, 1.08, bz + 0.25), M["glass"], 14),
    cyl("TipCoins", 0.07, 0.05, g(bx + 1.35, 1.09, bz + 0.25), M["gold"], 12),
    face("TipLabel", 0.15, 0.07, bx + 1.35, 1.17, bz + 0.33, 0.0, signmat("tips", 0.5)),
    cyl("LimeBowl", 0.14, 0.07, g(bx + 0.95, 1.08, bz + 0.05), M["brass"], 16, r2=0.1),
    *[sphere("Lime", 0.04, g(bx + 0.95 + 0.06 * math.cos(a), 1.16, bz + 0.05 + 0.06 * math.sin(a)), M["lime"], 8, 6) for a in (0.3, 2.4, 4.4)],
    cyl("Shaker", 0.05, 0.22, g(bx - 0.95, 1.08, bz - 0.1), M["chrome"], 12, r2=0.04),
    card("BarPigeon", "pigeon_cherry", 0.3, bx + 1.72, 1.08, bz + 0.1, PI / 2 - 0.5))
# the back bar against the end: bronze, a mirror, three lit shelves of bottles, a fascia for SKY BAR's neon (the game's)
BZ0 = -15.25  # its back
BZ1 = -14.85  # its face
o = [
    box("BackBar", bx - 2.1, bx + 2.1, 0.0, 2.6, BZ0, BZ1 - 0.25, M["bronze_t"], 0.02),
    box("BackCounter", bx - 2.1, bx + 2.1, 0.0, 0.95, BZ0, BZ1, M["bronze_t"], 0.02),
    box("BackCounterTop", bx - 2.12, bx + 2.12, 0.95, 1.0, BZ0, BZ1 + 0.02, M["marble"], 0.01),
    box("BackMirror", bx - 1.9, bx + 1.9, 1.05, 2.5, BZ1 - 0.26, BZ1 - 0.25, M["mirror"], 0.0),
    box("Fascia", bx - 1.6, bx + 1.6, 2.6, 3.3, BZ0, BZ1 - 0.06, M["ink"], 0.02),
]
for side in (-1, 1):
    o.append(box("BackPilaster", bx + side * 2.1 - 0.12, bx + side * 2.1 + 0.12, 0.0, 2.7, BZ0, BZ1 - 0.2, M["brass"], 0.02))
bottle_ms = [M["bottle_g"], M["bottle_a"], M["bottle_c"], M["bottle_r"], M["bottle_b"], M["gold"]]
for row in range(3):
    y = 1.12 + row * 0.5
    o.append(box("Shelf", bx - 1.9, bx + 1.9, y - 0.03, y, BZ1 - 0.25, BZ1 - 0.02, M["glass"], 0.0))
    o.append(box("Light_Kiosk", bx - 1.88, bx + 1.88, y - 0.045, y - 0.03, BZ1 - 0.1, BZ1 - 0.04, M["shelf"], 0.0) if row == 1 else box("ShelfGlow", bx - 1.88, bx + 1.88, y - 0.045, y - 0.03, BZ1 - 0.1, BZ1 - 0.04, M["shelf"], 0.0))
    for k in range(18):
        h = R.uniform(0.24, 0.34)
        bxx = bx - 1.75 + k * 0.205 + R.uniform(-0.02, 0.02)
        o.append(cyl("Bottle", 0.042, h, g(bxx, y, BZ1 - 0.14), bottle_ms[(k * 7 + row * 3) % 6], 8))
        o.append(cyl("BottleNeck", 0.015, 0.1, g(bxx, y + h, BZ1 - 0.14), bottle_ms[(k * 7 + row * 3) % 6], 6))
add("bar", *o)

# ================================================================================================================================
# THE DJ (the riser's lit edge, the LED wall, its light and beams, and the DJ are the game's)
# ================================================================================================================================
D = DJ
dx_, dz_ = D["x"], D["z"]
add("dj",
    box("Riser", dx_ - 1.8, dx_ + 1.8, 0.0, 0.25, 14.05, 15.45, M["ink"], 0.02),
    box("RiserStep", dx_ - 0.5, dx_ + 0.5, 0.0, 0.12, 13.85, 14.05, M["ink"], 0.01))
bo = [
    lb("Booth", -1.1, 1.1, 0.0, 1.1, -0.4, 0.4, M["ink"], 0.04),
    lb("BoothTop", -1.12, 1.12, 1.1, 1.14, -0.42, 0.42, M["marble"], 0.01),
    face("BoothFace", 1.9, 0.48, 0.0, 0.62, 0.405, 0.0, signmat("dj_name", 0.3)),
    lb("Mixer", -0.22, 0.22, 1.14, 1.2, -0.25, 0.15, M["charcoal"], 0.01),
]
for s in (-1, 1):
    bo.append(lb("DeckBox", s * 0.3, s * 0.85, 1.14, 1.22, -0.28, 0.22, M["charcoal"], 0.01))
    bo.append(cyl("Platter", 0.2, 0.02, g(s * 0.575, 1.22, -0.03), M["black"], 20))
    bo.append(cyl("Label", 0.06, 0.005, g(s * 0.575, 1.24, -0.03), M["pink"] if s < 0 else M["yellow"], 12))
bo.append(torus("Headphones", 0.1, 0.02, g(0.0, 1.27, 0.1), M["gold"], 16, 6))
add("dj", yawed(bo, dx_, dz_, PI, "Booth", y=0.0))
for f in furniture("speaker"):
    sx_, sz_ = f["x"], f["z"]
    a = math.atan2(0 - sx_, 0 - sz_)
    sp = [
        cyl("SpeakerStand", 0.03, 1.0, g(0, 0, 0), M["steel"], 8),
        cyl("SpeakerTripod", 0.3, 0.04, g(0, 0, 0), M["steel"], 3),
        lb("Speaker", -0.24, 0.24, 1.0, 2.25, -0.24, 0.24, M["ink"], 0.03),
        cyl("Woofer", 0.17, 0.03, g(0, 1.35, -0.25), M["rubber"], 18, rot=(PI / 2, 0, 0)),
        cyl("Tweeter", 0.08, 0.03, g(0, 1.88, -0.25), M["rubber"], 14, rot=(PI / 2, 0, 0)),
        lb("SpeakerGrille", -0.2, 0.2, 2.05, 2.18, 0.24, 0.25, M["charcoal"], 0.0),
    ]
    add("dj", yawed(sp, sx_, sz_, a, "Speaker"))
add("dj", card("SpeakerPigeon", "pigeon_dance", 0.36, 4.0, 2.25, 13.2, -PI / 2 + 0.6))
# the truss over the LED wall with par cans
TZ_ = 15.75
for s in (-1, 1):
    tx = dx_ + s * 2.75
    for ddx in (-0.12, 0.12):
        for ddz in (-0.12, 0.12):
            add("dj", rod("TrussLeg", (tx + ddx, 0.0, TZ_ + ddz), (tx + ddx, 3.9, TZ_ + ddz), 0.02, M["steel"]))
    for y in np.arange(0.3, 3.9, 0.45):
        add("dj", rod("TrussBrace", (tx - 0.12, y, TZ_ - 0.12), (tx + 0.12, y + 0.4, TZ_ + 0.12), 0.012, M["steel"]))
    add("dj", box("TrussFoot", tx - 0.25, tx + 0.25, 0.0, 0.04, TZ_ - 0.25, TZ_ + 0.25, M["steel"], 0.0))
for ddy in (-0.12, 0.12):
    for ddz in (-0.12, 0.12):
        add("dj", rod("TrussTop", (dx_ - 2.9, 3.9 + ddy, TZ_ + ddz), (dx_ + 2.9, 3.9 + ddy, TZ_ + ddz), 0.02, M["steel"]))
for k in range(6):
    px_ = dx_ - 2.2 + k * 0.88
    add("dj",
        cyl("ParCan", 0.11, 0.26, g(px_, 3.62, TZ_ - 0.18), M["black"], 12, rot=(0.6, 0, 0)),
        cyl("ParLens", 0.09, 0.02, g(px_, 3.53, TZ_ - 0.32), M["par_pink"] if k % 2 else M["par_cyan"], 12, rot=(0.6, 0, 0)))

# ================================================================================================================================
# PALMS IN PLANTERS, BAY BALLS BY THE LIFTS, LANTERNS, CHAMPAGNE BY THE CABANAS
# ================================================================================================================================
for k, f in enumerate(furniture("palm")):
    x, z = f["x"], f["z"]
    add("green",
        box("Planter", x - 0.45, x + 0.45, 0.0, 0.85, z - 0.45, z + 0.45, M["concrete"], 0.03),
        box("PlanterRim", x - 0.47, x + 0.47, 0.85, 0.9, z - 0.47, z + 0.47, M["bronze"], 0.01),
        box("PlanterSoil", x - 0.42, x + 0.42, 0.85, 0.88, z - 0.42, z + 0.42, M["soil"], 0.0),
        *palm(x, z, 3.0 + (k % 3) * 0.3, 570 + k, y0=0.88, lean=0.08, away=(0.0, 0.0)))
for s in (-1, 1):
    for x in (LIFT["x"] - 2.75, LIFT["x"] + 2.75):
        z = s * 14.9
        add("green",
            cyl("Pot", 0.26, 0.55, g(x, 0, z), M["bronze"], 16, r2=0.3),
            cyl("PotRim", 0.31, 0.04, g(x, 0.55, z), M["brass"], 16),
            trees.blob("BayBall", g(x, 0.98, z), (0.34, 0.34, 0.32), M["leaf_dark"], 1185 + int(x * 10) + s, (10, 6), 0.12),
            cyl("BayStem", 0.025, 0.2, g(x, 0.58, z), sm("bark", "#7a5d40", 0.9), 6))


def lantern(x, z, h=0.95):
    return [
        box("LanternBody", x - 0.17, x + 0.17, 0.0, h, z - 0.17, z + 0.17, M["rattan"], 0.03),
        box("LanternGlow", x - 0.13, x + 0.13, 0.15, h - 0.12, z - 0.175, z + 0.175, M["glass"], 0.0),
        cyl("Light_Lantern", 0.05, 0.14, g(x, 0.35, z), M["candle"], 10),
        box("LanternLid", x - 0.2, x + 0.2, h, h + 0.05, z - 0.2, z + 0.2, M["bronze"], 0.01),
        torus("LanternHandle", 0.1, 0.012, g(x, h + 0.12, z), M["bronze"], 12, 4, rot=(PI / 2, 0, 0)),
    ]


for z in (-1.9, 1.9):
    add("green", *lantern(-12.9, z))
for b in [b for b in BEDS if b["cabana"]]:
    sz = 1 if b["z"] > 0 else -1
    add("green", *lantern(b["x"] - 0.3, b["z"] + 1.75 * sz, 0.8))
    ix, iz = b["x"] + 1.25, b["z"] + 1.75 * sz
    add("green",
        cyl("IceStand", 0.02, 0.62, g(ix, 0.0, iz), M["brass"], 8),
        cyl("IceStandFoot", 0.15, 0.03, g(ix, 0.0, iz), M["brass"], 14),
        cyl("IceBucket", 0.13, 0.24, g(ix, 0.62, iz), M["chrome"], 16, r2=0.15),
        cyl("Champagne", 0.04, 0.26, g(ix + 0.03, 0.72, iz), M["bottle_g"], 10),
        cyl("ChampagneFoil", 0.018, 0.07, g(ix + 0.03, 0.98, iz), M["gold"], 8),
        cyl("IceTop", 0.125, 0.02, g(ix, 0.84, iz), M["ice"], 14))

# ================================================================================================================================
# THE STATIONS (their fronts to -x, as the game's) AND THE FIXTURES
# ================================================================================================================================
def cabinet(name, sign):
    o = [
        lb(name, -0.8, 0.8, 0.08, 1.05, -0.48, 0.48, M["zellige"], 0.02),
        lb(name + "Plinth", -0.75, 0.75, 0.0, 0.08, -0.42, 0.42, M["granite"], 0.0),
        lb(name + "Top", -0.88, 0.88, 1.05, 1.11, -0.56, 0.56, M["marble"], 0.01),
    ]
    for x in (-0.4, 0.4):
        o.append(lb(name + "Door", x - 0.37, x + 0.37, 0.16, 0.98, 0.48, 0.5, M["zellige"], 0.01))
        o.append(lb(name + "Pull", x - 0.15, x + 0.15, 0.85, 0.87, 0.5, 0.53, M["brass"], 0.0))
    for x in (-0.75, 0.75):
        o.append(cyl(name + "Post", 0.025, 1.25, g(x, 1.11, -0.3), M["brass"], 8))
    o.append(lb(name + "SignBack", -0.88, 0.88, 1.98, 2.32, -0.33, -0.29, M["ink"], 0.01))
    o.append(face(name + "Sign", 1.72, 0.32, 0.0, 2.15, -0.285, 0.0, signmat(sign, 0.4)))
    return o


wc = cabinet("WaterCare", "water_care")
wc += [
    cyl("ClTub", 0.22, 0.42, g(-0.4, 1.11, 0.0), sm("cl_tub", "#f2e6c8", 0.6), 16, r2=0.2),
    cyl("ClLid", 0.23, 0.06, g(-0.4, 1.53, 0.0), M["teal"], 16),
    cyl("ClBucket", 0.16, 0.25, g(0.35, 1.11, 0.1), M["chrome"], 14, r2=0.19),
    cyl("TestKit", 0.05, 0.16, g(0.62, 1.11, -0.2), M["yellow"], 8),
]
add("stations", yawed(wc, S["chlorine"]["x"], S["chlorine"]["z"], TO_MX, "WaterCare"))
ec = cabinet("EyeCare", "eye_care")
ec += [
    cyl("EyeWash", 0.07, 0.24, g(-0.5, 1.11, 0.05), sm("eyewash", "#64bcca", 0.3), 12),
    cyl("EyeWashCap", 0.04, 0.06, g(-0.5, 1.35, 0.05), M["coral"], 10),
    cyl("EyeWash", 0.07, 0.24, g(-0.3, 1.11, 0.12), sm("eyewash", "#64bcca", 0.3), 12),
    cyl("Mirror", 0.24, 0.03, g(0.35, 1.62, -0.25), M["brass"], 22, rot=(PI / 2, 0, 0)),
    cyl("MirrorGlass", 0.2, 0.02, g(0.35, 1.62, -0.22), M["mirror"], 22, rot=(PI / 2, 0, 0)),
    cyl("MirrorPost", 0.02, 0.45, g(0.35, 1.11, -0.27), M["brass"], 8),
]
for k in range(3):
    ec.append(cyl("RolledTowel", 0.06, 0.32, g(0.3 + k * 0.13 - 0.1, 1.17, 0.25), (M["towel"], M["teal"], M["towel"])[k], 10, rot=(PI / 2, 0, 0)))
add("stations", yawed(ec, S["relief"]["x"], S["relief"]["z"], TO_MX, "EyeCare"))
# the skimmer's board on the near rail (the game's skimmer on its pegs), the waste bin
SN = SANITATION
wallX = DECK["minX"] - 0.45
add("stations",
    box("SkimBoard", wallX - 0.06, wallX + 0.08, 1.12, 2.37, SN["rack"]["z"] - 1.95, SN["rack"]["z"] + 1.95, M["bronze_t"], 0.03),
    box("SkimRim", wallX - 0.08, wallX + 0.06, 1.09, 2.4, SN["rack"]["z"] - 1.98, SN["rack"]["z"] + 1.98, M["brass"], 0.01),
    face("SkimSign", 2.7, 0.42, wallX + 0.09, 2.65, SN["rack"]["z"], PI / 2, signmat("skimmer", 0.4)),
    box("SkimSignBack", wallX - 0.04, wallX + 0.08, 2.42, 2.88, SN["rack"]["z"] - 1.4, SN["rack"]["z"] + 1.4, M["ink"], 0.01))
for z in (SN["rack"]["z"] - 1.5, SN["rack"]["z"] + 1.5):
    add("stations", cyl("SkimPost", 0.04, 2.4, g(wallX, 0.0, z), M["bronze"], 8))
WB = SN["bin"]
add("stations",
    cyl("BinBody", 0.42, 1.0, g(WB["x"], 0, WB["z"]), M["bronze_t"], 20, r2=0.45),
    cyl("BinLid", 0.48, 0.07, g(WB["x"], 1.0, WB["z"]), M["brass"], 20),
    cyl("BinSlot", 0.2, 0.02, g(WB["x"], 1.07, WB["z"]), M["ink"], 14),
    face("BinSign", 0.5, 0.19, WB["x"] - 0.45, 0.62, WB["z"], -PI / 2, signmat("waste", 0.5)))


def board_on_posts(name, w, h, y0, sign_name, sign_h, m_board):
    """A board on two bronze posts at the origin, its face to local +z, `sign_name` on a plate over it."""
    out = [
        lb(name, -w / 2, w / 2, y0, y0 + h, -0.05, 0.0, m_board, 0.03),
        lb(name + "Rim", -w / 2 - 0.03, w / 2 + 0.03, y0 - 0.03, y0 + h + 0.03, -0.07, -0.04, M["brass"], 0.01),
    ]
    for x in (-w / 2 + 0.12, w / 2 - 0.12):
        out.append(cyl(name + "Post", 0.035, y0 + h + 0.1, g(x, 0, -0.1), M["bronze"], 10))
        out.append(cyl(name + "Foot", 0.09, 0.03, g(x, 0, -0.1), M["bronze"], 12))
    if sign_name:
        sy = y0 + h + 0.08 + sign_h / 2
        out.append(face(name + "Sign", w + 0.1, sign_h, 0, sy, 0.005, 0.0, signmat(sign_name, 0.5)))
        out.append(lb(name + "SignBack", -w / 2 - 0.06, w / 2 + 0.06, sy - sign_h / 2 - 0.01, sy + sign_h / 2 + 0.01, -0.03, -0.002, M["ink"], 0.01))
    return out


for m in RING_MOUNTS:
    rb = board_on_posts("RingBoard", 1.5, 2.15, 0.35, "life_ring", 0.42, M["bronze_t"])
    rb.append(rod("RingPeg", (0, 2.3, -0.05), (0, 2.3, 0.12), 0.04, M["brass"]))
    for q in rb:
        q.location.y += 0.18  # (the board 0.18 behind the ring's place, as the game's mount: Blender's +y is the game's -z)
    add("stations", yawed(rb, m["x"], m["z"], m["angle"], "RingBoard"), sphere("LifeRing", 0.1, g(m["x"], 1.65, m["z"]), M["red"], 8, 6))
FN = F["fishNet"]
fb = board_on_posts("NetBoard", 1.4, 2.5, 0.05, "fish_net", 0.4, M["bronze_t"])
for q in fb:
    q.location.y += 0.18
add("stations", yawed(fb, FN["x"], FN["z"], FN["angle"], "NetBoard"))
# the torch on a brass pedestal (the game's torch at 1.24 m)
FLT = F["flashlight"]
add("stations",
    cyl("Pedestal", 0.22, 0.06, g(FLT["x"], 0, FLT["z"]), M["granite"], 16),
    cyl("PedestalStem", 0.06, 1.0, g(FLT["x"], 0.06, FLT["z"]), M["brass"], 12, r2=0.05),
    cyl("PedestalCradle", 0.14, 0.08, g(FLT["x"], 1.06, FLT["z"]), M["brass"], 14, r2=0.17),
    sphere("Flashlight", 0.05, g(FLT["x"], 1.24, FLT["z"]), M["ink"], 6, 4))
# the fuse box's service column against the near rail, DANGER over it
FB = F["fuseBox"]
add("stations",
    box("ServiceColumn", FB["x"] - 0.5, FB["x"] - 0.27, 0.0, 2.6, FB["z"] - 0.8, FB["z"] + 0.8, M["concrete"], 0.03),
    box("ServiceCap", FB["x"] - 0.52, FB["x"] - 0.25, 2.6, 2.66, FB["z"] - 0.82, FB["z"] + 0.82, M["bronze"], 0.01),
    face("Danger", 1.1, 0.41, FB["x"] - 0.265, 2.45, FB["z"], PI / 2, signmat("danger", 0.5)))
# the dog treats' table: marble on brass, the jar and a bowl
TR = F["treats"]
add("stations",
    cyl("TreatsTop", 0.32, 0.04, g(TR["x"], 0.82, TR["z"]), M["marble"], 20),
    cyl("TreatsStem", 0.03, 0.82, g(TR["x"], 0.0, TR["z"]), M["brass"], 8),
    cyl("TreatsFoot", 0.2, 0.03, g(TR["x"], 0.0, TR["z"]), M["brass"], 16),
    cyl("TreatsJar", 0.1, 0.2, g(TR["x"] - 0.08, 0.86, TR["z"]), M["glass"], 14),
    cyl("TreatsJarLid", 0.105, 0.03, g(TR["x"] - 0.08, 1.06, TR["z"]), M["brass"], 14),
    cyl("DogBowl", 0.16, 0.06, g(TR["x"] + 0.4, 0.0, TR["z"] + 0.35), M["chrome"], 16, r2=0.12),
    face("TreatsSign", 0.5, 0.19, TR["x"], 1.2, TR["z"] - 0.1, PI, signmat("treats", 0.5)))

for k, v in parts.items():
    print("GROUP", k, tris(v))
if LOOK:
    look("furniture_over", g(-8, 0, 0), 26, 50, 270, (1280, 720), 16, 30)
    look("furniture_bar", g(1.4, 1, -14), 7, 20, 200, (1280, 720), 16, 35)
    look("furniture_dj", g(1.6, 1.5, 14.5), 8, 15, 20, (1280, 720), 16, 35)
    look("furniture_cabana", g(-11.3, 1.2, 5.6), 6, 20, 290, (1280, 720), 16, 35)
for k, v in parts.items():
    save_part("furniture_" + k, v)
