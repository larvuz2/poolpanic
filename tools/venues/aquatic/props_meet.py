"""The Aquatic Centre's meet furniture and its quirks, modelled in place in game coordinates (on the floor plan's spots, against the
timing wall, or in the deck's corners, clear of the walks, the doors' ways and the massage table's spot):

- the victory podium at (12.4, 4.8): white steps 2, 1, 3 with gold, silver and bronze tops, a giant gold trophy on the top step,
  medals on ribbons, bouquets on the lower steps;
- the officials' table at the kiosk (13.4, 11.2): a raised judges' desk (its top at 1.24 m: the game's dog treats stand on it), two
  timing screens, a starter's horn, a megaphone, stopwatches, a bell, judges' scorecards on sticks (6.0, 5.9, 3.2), two chairs;
- the team bench at (-12.9, 10.6): a blue bench with kit bags, towels, a cooler, a clipboard, swim caps and a rubber chicken;
- a palm in a navy planter at (15.4, -11.2);
- Splashy, the giant rubber-duck mascot in a red swim cap and goggles, on a plinth in the far corner; his NO RUNNING poster on an easel;
- the trophy cabinet against the timing wall (a golden flipper, a golden rubber duck, golden goggles, a fish-skeleton cup, plain cups,
  each on a plaque) under the POOL RECORDS board; the ISO-SPLASH vending machine and a drinking fountain on the other side under
  the DAYS WITHOUT A CANNONBALL counter;
- a lane-rope reel on its cart, a leaning tower of kickboards and a bin of pull buoys, the POOL PANIC TV camera on its tripod with
  its cable, a cardboard Marco, three WET FLOOR boards.

    blender -b -P tools/venues/aquatic/props_meet.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from trees import use, palm  # (tools/venues/common/trees.py)

reset()
R = random.Random(23)
LOOK = "--look" in args()
M = dict(
    white=sm("white"),
    gloss=sm("white_gloss"),
    navy=sm("navy"),
    blue=sm("blue"),
    blue_light=sm("blue_light"),
    red=sm("red"),
    gold=sm("gold"),
    silver=sm("silver"),
    bronze=sm("bronze"),
    stainless=sm("stainless"),
    chrome=sm("chrome"),
    black=sm("black"),
    charcoal=sm("charcoal"),
    grey=sm("grey"),
    yellow=sm("yellow"),
    green=sm("green"),
    orange=sm("orange"),
    pink=sm("pink"),
    duck=sm("duck"),
    beak=sm("beak"),
    rubber=sm("rubber"),
    cardboard=sm("cardboard"),
    wood=sm("wood"),
    glass=sm("cabinet_glass", "#d6eef2", 0.05, alpha=0.25),
    screen=lamp_mat("screen_glow", "#7fd8ff", 3.0),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    t_white=sm("towel_white"),
    t_blue=sm("towel_blue"),
    t_red=sm("towel_red"),
    t_yellow=sm("towel_yellow"),
    t_stripe=sm("towel_stripe"),
)
use(dict(bark=sm("bark", "#8b6a4b", 0.9), bark_light=sm("bark_light", "#a9876a", 0.9), pine_bark=sm("bark", "#8b6a4b", 0.9), palm_boot=sm("palm_boot", "#7d6242", 0.95), coconut=sm("coconut", "#6f5a2e", 0.6), frond=cutmat("palm_frond", 0.65), hedge=M["leaf"], canopy=M["leaf"], conifer=M["leaf"]))
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def trophy(x, y, z, s, m=None):
    """A cup on a stepped base, two handles."""
    m = m or M["gold"]
    out = [box("TrophyBase", x - 0.12 * s, x + 0.12 * s, y, y + 0.1 * s, z - 0.12 * s, z + 0.12 * s, M["black"], 0.01)]
    out.append(cyl("TrophyStem", 0.03 * s, 0.14 * s, g(x, y + 0.1 * s, z), m, 10))
    out.append(cyl("TrophyCup", 0.06 * s, 0.22 * s, g(x, y + 0.24 * s, z), m, 16, r2=0.14 * s))
    for sx in (-1, 1):
        out.append(torus("TrophyHandle", 0.06 * s, 0.012 * s, g(x + sx * 0.14 * s, y + 0.36 * s, z), m, 12, 4, rot=(PI / 2, 0, 0)))
    return out


# ---- the victory podium ----------------------------------------------------------------------------------------------------------
PX, PZ = PODIUM
pod = []
for dx, h, n, top in ((-0.9, 0.55, "2", M["silver"]), (0.0, 0.85, "1", M["gold"]), (0.9, 0.38, "3", M["bronze"])):
    x = PX + dx
    pod.append(box("Step", x - 0.44, x + 0.44, 0, h, PZ - 0.55, PZ + 0.55, M["white"], 0.03))
    pod.append(box("StepTop", x - 0.45, x + 0.45, h, h + 0.06, PZ - 0.56, PZ + 0.56, top, 0.015))
    for sz in (-1, 1):
        pod.append(flat_text("StepNum", n, 0.34, M["navy"], g(x, h * 0.5, PZ + sz * 0.56), 0 if sz > 0 else PI, 0.01, "BarlowCondensed-Black"))
pod.append(box("PodiumMat", PX - 1.4, PX + 1.4, 0, 0.02, PZ - 0.62, PZ + 0.62, M["blue"], 0.005))
pod += trophy(PX, 0.91, PZ, 2.4)
for dx, h in ((-0.9, 0.61), (0.9, 0.44)):
    x = PX + dx
    for k, c in enumerate((M["red"], M["yellow"], M["pink"])):
        pod.append(sphere("Bloom", 0.07, g(x - 0.05 + k * 0.06, h + 0.24, PZ + 0.1 + (k % 2) * 0.05), c, 8, 6))
    pod.append(cyl("Bouquet", 0.03, 0.22, g(x, h, PZ + 0.1), M["leaf_dark"], 8, r2=0.1))
for dx, h, m in ((-0.2, 0.85, M["gold"]), (-0.9, 0.55, M["silver"]), (0.9, 0.38, M["bronze"])):
    x = PX + dx
    pod.append(cyl("Medal", 0.07, 0.015, g(x, h - 0.12, PZ - 0.57), m, 16, rot=(PI / 2, 0, 0)))
    pod.append(tube("MedalRibbon", [g(x - 0.05, h + 0.02, PZ - 0.56), g(x, h - 0.06, PZ - 0.575), g(x + 0.05, h + 0.02, PZ - 0.56)], 0.01, M["red"], 2, 4))
add("podium", *pod)

# ---- the officials' table at the kiosk: a long desk at sitting height (0.76 m), the two officials behind it on their chairs (the
# game's models: dist/scene/officials.mjs), the Starter on two cushions (his feet do not reach the floor), the monitors at the ends
KX, KZ = KIOSK
TOP = OFFICIALS_DESK
of = []
of.append(box("DeskBody", 12.42, 14.3, 0, TOP - 0.05, KZ - 1.1, KZ + 1.1, M["white"], 0.03))
of.append(box("DeskTop", 12.3, 14.35, TOP - 0.05, TOP, KZ - 1.15, KZ + 1.15, M["navy"], 0.015))
of.append(box("DeskBand", 12.4, 12.43, 0.45, 0.6, KZ - 1.1, KZ + 1.1, M["blue"], 0))
of.append(flat_text("Officials", "OFFICIALS", 0.2, M["navy"], g(12.39, 0.28, KZ), -PI / 2, 0.006, "BarlowCondensed-Black"))
for dz in (-0.98, 0.98):
    z = KZ + dz
    of.append(box("Monitor", 12.95, 13.0, TOP + 0.08, TOP + 0.4, z - 0.14, z + 0.14, M["black"], 0.01))
    of.append(box("NightGlow_Screen", 12.94, 12.945, TOP + 0.1, TOP + 0.38, z - 0.12, z + 0.12, M["screen"], 0))
    of.append(box("MonitorStand", 13.0, 13.1, TOP, TOP + 0.1, z - 0.05, z + 0.05, M["black"], 0.005))
# a starter's horn, a megaphone, stopwatches, a bell, the scorecards in a pot at the front, coffee mugs, a rule book
of.append(cyl("Horn", 0.07, 0.26, g(12.7, TOP, KZ - 0.7), M["red"], 12, r2=0.1))
mega = cyl("Megaphone", 0.05, 0.4, (0, 0, 0), M["white"], 12, r2=0.16)
mega.location = g(12.75, TOP + 0.12, KZ + 0.55)
mega.rotation_euler = (0, -PI / 2, 0.3)
apply_all(mega)
of.append(mega)
for k in range(3):
    of.append(cyl("Stopwatch", 0.04, 0.02, g(13.75 + k * 0.1, TOP, KZ - 0.25 + k * 0.08), M["chrome"], 12))
of.append(cyl("Bell", 0.05, 0.05, g(13.6, TOP, KZ + 0.15), M["gold"], 12, r2=0.015))
of.append(cyl("CardPot", 0.07, 0.14, g(12.5, TOP, KZ + 0.95), M["blue"], 10))
for k, txt in enumerate(("6.0", "5.9", "3.2")):
    z = KZ + 0.86 + k * 0.09
    of.append(cyl("CardStick", 0.008, 0.5, g(12.5, TOP + 0.08, z), M["wood"], 4))
    of.append(box("Card", 12.49, 12.51, TOP + 0.48, TOP + 0.66, z - 0.12, z + 0.12, M["white"], 0))
    of.append(flat_text("CardNum", txt, 0.12, M["red"] if txt == "3.2" else M["navy"], g(12.485, TOP + 0.57, z), -PI / 2, 0.003, "BarlowCondensed-Black"))
for k in range(2):
    of.append(cyl("Mug", 0.04, 0.09, g(13.9, TOP, KZ - 0.95 + k * 1.75), M["blue"] if k else M["red"], 10))
of.append(box("RuleBook", 13.5, 13.75, TOP, TOP + 0.07, KZ - 0.45, KZ - 0.1, M["red"], 0.008))
of.append(box("RuleBookPages", 13.51, 13.74, TOP + 0.01, TOP + 0.06, KZ - 0.445, KZ - 0.105, M["white"], 0))
# the chairs (seat tops at OFFICIAL_SEATS: the game sits each official on his or her own)
for (dz, seat) in OFFICIAL_SEATS:
    z = KZ + dz
    of.append(box("ChairSeat", 14.38, 14.86, seat - 0.06, seat, z - 0.25, z + 0.25, M["navy"], 0.02))
    of.append(box("ChairBack", 14.82, 14.88, seat, seat + 0.58, z - 0.24, z + 0.24, M["navy"], 0.02))
    for dx in (14.43, 14.8):
        for sz in (-1, 1):
            of.append(cyl("ChairLeg", 0.015, seat - 0.06, g(dx, 0, z + sz * 0.2), M["stainless"], 6))
# the Starter's cushions: a red one on a blue one
_, seat = OFFICIAL_SEATS[1]
z = KZ + OFFICIAL_SEATS[1][0]
of.append(box("Cushion", 14.4, 14.84, seat, seat + 0.06, z - 0.22, z + 0.22, M["blue"], 0.03))
of.append(box("Cushion2", 14.42, 14.82, seat + 0.06, seat + 0.11, z - 0.2, z + 0.2, M["red"], 0.025))
add("officials", *of)

# ---- the team bench ----------------------------------------------------------------------------------------------------------------------
TBX, TBZ = TEAM_BENCH
tb = []
tb.append(box("TBSeat", TBX - 1.5, TBX + 1.5, 0.46, 0.54, TBZ - 0.3, TBZ + 0.3, M["blue"], 0.02))
tb.append(box("TBBack", TBX - 1.5, TBX + 1.5, 0.55, 1.1, TBZ + 0.26, TBZ + 0.34, M["blue"], 0.02))
for dx in (-1.35, 0.0, 1.35):
    tb.append(box("TBLeg", TBX + dx - 0.04, TBX + dx + 0.04, 0, 0.46, TBZ - 0.25, TBZ + 0.25, M["stainless"], 0.005))
tb.append(towel_folded("TBTowel", 0.5, 0.36, 0.06, M["t_red"], M["t_stripe"], g(TBX + 0.6, 0.54, TBZ - 0.05), 0.1))
tb.append(towel_hanging("TBTowelHang", 0.5, 0.9, M["t_blue"], M["t_stripe"], g(TBX - 0.5, 1.1, TBZ + 0.36), 0))
tb.append(duffel("TBBag", M["red"], M["navy"], 0.55, 0.15, g(TBX - 1.0, 0.69, TBZ), 0.1))
tb.append(duffel("TBBag2", M["navy"], M["yellow"], 0.5, 0.14, g(TBX + 1.2, 0.14, TBZ - 0.5), 1.4))
tb.append(box("Cooler", TBX + 1.75, TBX + 2.25, 0, 0.42, TBZ - 0.25, TBZ + 0.25, M["white"], 0.03))
tb.append(box("CoolerLid", TBX + 1.73, TBX + 2.27, 0.42, 0.48, TBZ - 0.27, TBZ + 0.27, M["blue"], 0.02))
tb.append(box("Clipboard", TBX + 0.1, TBX + 0.4, 0.55, 0.57, TBZ - 0.2, TBZ + 0.2, M["wood"], 0.005))
tb.append(box("ClipPaper", TBX + 0.12, TBX + 0.38, 0.57, 0.575, TBZ - 0.18, TBZ + 0.16, M["white"], 0))
for k, c in enumerate((M["red"], M["yellow"], M["blue_light"])):
    tb.append(sphere("SwimCap", 0.1, g(TBX - 0.2 + k * 0.18, 0.56, TBZ + 0.05), c, 10, 6, scale=(1, 1, 0.6)))
# the rubber chicken, lying across the bench's end (nobody knows whose it is)
ch = [sphere("ChickenBody", 0.1, (0, 0, 0), M["yellow"], 10, 6, scale=(1.8, 0.8, 0.7))]
ch.append(sphere("ChickenHead", 0.06, (0.2, 0, 0.05), M["yellow"], 8, 6))
ch.append(cyl("ChickenBeak", 0.02, 0.06, (0.26, 0, 0.05), M["orange"], 6, r2=0.0, rot=(0, PI / 2, 0)))
ch.append(sphere("ChickenComb", 0.03, (0.2, 0, 0.11), M["red"], 6, 4, scale=(1.4, 0.5, 1)))
for k in (-1, 1):
    ch.append(cyl("ChickenLeg", 0.012, 0.16, (-0.1, k * 0.04, -0.02), M["orange"], 5, rot=(0, -PI / 2.4, 0)))
chicken = join(ch, "RubberChicken")
chicken.location = g(TBX - 1.3, 0.6, TBZ - 0.05)
chicken.rotation_euler = (0, 0, 0.4)
apply_all(chicken)
tb.append(chicken)
add("team", *tb)

# ---- the palm in its planter ---------------------------------------------------------------------------------------------------------
PLX, PLZ = PLANT
add("plants", box("Planter", PLX - 0.45, PLX + 0.45, 0, 0.6, PLZ - 0.45, PLZ + 0.45, M["navy"], 0.03))
add("plants", box("PlanterLip", PLX - 0.48, PLX + 0.48, 0.58, 0.64, PLZ - 0.48, PLZ + 0.48, M["white"], 0.01))
add("plants", *palm(PLX, PLZ, 3.0, 9, y0=0.62, lean=0.05, light=True))

# ---- Splashy, the giant rubber duck, on his plinth in the far corner ------------------------------------------------------------------
DX_, DZ_ = 15.75, 12.75
du = []
du.append(cyl("DuckPlinth", 0.7, 0.4, g(DX_, 0, DZ_), M["navy"], 24))
du.append(torus("DuckPlinthRim", 0.7, 0.03, g(DX_, 0.4, DZ_), M["gold"], 24, 4))
du.append(flat_text("DuckName", "SPLASHY", 0.16, M["yellow"], g(DX_ - 0.71, 0.2, DZ_), -PI / 2, 0.01, "BarlowCondensed-Black"))
Y0 = 0.4
du.append(sphere("DuckBody", 0.62, g(DX_, Y0 + 0.5, DZ_), M["duck"], 20, 12, scale=(1.15, 1.0, 0.85)))
du.append(sphere("DuckTail", 0.25, g(DX_ + 0.6, Y0 + 0.8, DZ_), M["duck"], 10, 8, scale=(1.0, 0.8, 1.3)))
du.append(sphere("DuckHead", 0.42, g(DX_ - 0.35, Y0 + 1.3, DZ_), M["duck"], 18, 12))
du.append(sphere("DuckBeak", 0.22, g(DX_ - 0.75, Y0 + 1.2, DZ_), M["beak"], 12, 8, scale=(1.3, 1.1, 0.45)))
for s in (-1, 1):
    du.append(sphere("DuckWing", 0.3, g(DX_ + 0.05, Y0 + 0.6, DZ_ + s * 0.52), M["duck"], 12, 8, scale=(1.3, 0.5, 0.7)))
    du.append(sphere("DuckEye", 0.09, g(DX_ - 0.62, Y0 + 1.42, DZ_ + s * 0.17), M["white"], 10, 6))
    du.append(sphere("DuckPupil", 0.045, g(DX_ - 0.69, Y0 + 1.43, DZ_ + s * 0.17), M["black"], 8, 6))
# his red swim cap and his goggles pushed up on it, a medal
du.append(sphere("DuckCap", 0.44, g(DX_ - 0.35, Y0 + 1.36, DZ_), M["red"], 18, 10, scale=(1.0, 1.0, 0.75)))
du.append(torus("DuckGoggleStrap", 0.43, 0.025, g(DX_ - 0.35, Y0 + 1.5, DZ_), M["black"], 24, 4))
for s in (-1, 1):
    du.append(cyl("DuckGoggle", 0.09, 0.05, g(DX_ - 0.74, Y0 + 1.58, DZ_ + s * 0.12), M["blue_light"], 12, rot=(0, PI / 2, 0)))
du.append(cyl("DuckMedal", 0.12, 0.02, g(DX_ - 0.68, Y0 + 0.8, DZ_), M["gold"], 16, rot=(0, PI / 2, 0)))
du.append(tube("DuckRibbon", [g(DX_ - 0.55, Y0 + 1.05, DZ_ - 0.25), g(DX_ - 0.68, Y0 + 0.88, DZ_), g(DX_ - 0.55, Y0 + 1.05, DZ_ + 0.25)], 0.02, M["blue"], 3, 4))
add("duck", *du)
# his poster on an easel in the near far corner
ex, ez = -15.35, 12.75
ea = []
for dx in (-0.25, 0.25):
    ea.append(tube("EaselLeg", [g(ex - 0.15, 0, ez + dx), g(ex, 1.8, ez + dx * 0.4)], 0.02, M["wood"], 1, 4))
ea.append(tube("EaselBack", [g(ex + 0.4, 0, ez), g(ex, 1.7, ez)], 0.02, M["wood"], 1, 4))
ea.append(box("EaselLedge", ex - 0.18, ex - 0.06, 0.66, 0.7, ez - 0.4, ez + 0.4, M["wood"], 0.005))
poster = plane("Splashy", 0.7, 1.05, g(ex - 0.08, 1.2, ez), signmat("splashy", 0.6), rot=(PI / 2 - 0.1, 0, -PI / 2))
ea.append(poster)
add("duck", *ea)

# ---- against the timing wall: the trophy cabinet and the records board; the vending machine, the fountain, the cannonball counter ------
FZ = FACE_Z
cab = []
CX0, CX1 = -15.7, -13.5
WOOD = sm("cabinet_wood", "#6a4a34", 0.5)
# an open-fronted case (no glass to sort): plinth, crown, sides, a navy back, white shelves, two mullions
cab.append(box("CabinetPlinth", CX0, CX1, 0, 0.15, FZ, FZ + 0.5, WOOD, 0.02))
cab.append(box("CabinetCrown", CX0 - 0.03, CX1 + 0.03, 1.92, 2.04, FZ, FZ + 0.53, WOOD, 0.02))
for x0, x1 in ((CX0, CX0 + 0.05), (CX1 - 0.05, CX1)):
    cab.append(box("CabinetSide", x0, x1, 0.15, 1.92, FZ, FZ + 0.5, WOOD, 0.01))
cab.append(box("CabinetBack", CX0 + 0.05, CX1 - 0.05, 0.15, 1.92, FZ, FZ + 0.04, M["navy"], 0))
for y in (0.72, 1.32):
    cab.append(box("CabinetShelf", CX0 + 0.05, CX1 - 0.05, y, y + 0.03, FZ + 0.04, FZ + 0.46, M["gloss"], 0.005))
for x in (CX0 + (CX1 - CX0) / 3, CX0 + 2 * (CX1 - CX0) / 3):
    cab.append(box("CabinetMullion", x - 0.015, x + 0.015, 0.15, 1.92, FZ + 0.47, FZ + 0.5, WOOD, 0.005))
cab.append(flat_text("CabinetTitle", "HALL OF FAME (ISH)", 0.11, M["gold"], g((CX0 + CX1) / 2, 1.98, FZ + 0.535), 0, 0.004, "BarlowCondensed-Black"))
cab.append(box("CabinetLight", CX0 + 0.1, CX1 - 0.1, 1.86, 1.88, FZ + 0.1, FZ + 0.4, sm("cabinet_light", "#fff4d6", 0.3), 0))
# the trophies: a golden flipper, a golden duck, golden goggles, a fish-skeleton cup, plain cups
sh = 0.18
fl = extrude_shape("GoldFlipper", [(-0.07, 0), (0.07, 0), (0.13, -0.32), (0.0, -0.36), (-0.13, -0.32)], 0.025, g(CX0 + 0.45, sh + 0.42, FZ + 0.28), M["gold"], rot=(PI / 2, 0, 0))
cab.append(fl)
cab.append(box("FlipperBase", CX0 + 0.33, CX0 + 0.57, sh, sh + 0.06, FZ + 0.18, FZ + 0.38, M["black"], 0.01))
cab.append(sphere("GoldDuckBody", 0.12, g(CX0 + 1.1, sh + 0.14, FZ + 0.28), M["gold"], 12, 8, scale=(1.2, 1, 0.9)))
cab.append(sphere("GoldDuckHead", 0.08, g(CX0 + 1.03, sh + 0.28, FZ + 0.28), M["gold"], 10, 8))
cab.append(sphere("GoldDuckBeak", 0.04, g(CX0 + 0.96, sh + 0.27, FZ + 0.28), M["gold"], 8, 6, scale=(1.4, 1, 0.5)))
for s in (-1, 1):
    cab.append(torus("GoldGoggle", 0.07, 0.015, g(CX0 + 1.75 + s * 0.09, sh + 0.12, FZ + 0.28), M["gold"], 16, 4, rot=(PI / 2, 0, 0)))
cab.append(tube("GoggleBridge", [g(CX0 + 1.73, sh + 0.12, FZ + 0.29), g(CX0 + 1.77, sh + 0.12, FZ + 0.29)], 0.01, M["gold"], 1, 4))
cab += trophy(CX0 + 0.5, 0.75, FZ + 0.28, 1.0, M["silver"])
cab += trophy(CX0 + 1.1, 0.75, FZ + 0.28, 1.3)
# the fish-skeleton cup: a cup with a fish's bones on top
cab += trophy(CX0 + 1.7, 0.75, FZ + 0.28, 1.0, M["bronze"])
cab.append(tube("FishSpine", [g(CX0 + 1.52, 1.16, FZ + 0.28), g(CX0 + 1.9, 1.16, FZ + 0.28)], 0.012, M["white"], 1, 4))
for k in range(6):
    x = CX0 + 1.6 + k * 0.045
    cab.append(tube("FishRib", [g(x, 1.07, FZ + 0.28), g(x, 1.25, FZ + 0.28)], 0.007, M["white"], 1, 3))
cab.append(sphere("FishSkull", 0.06, g(CX0 + 1.52, 1.16, FZ + 0.28), M["white"], 8, 6, scale=(1.3, 1, 0.9)))
cab.append(extrude_shape("FishTail", [(0, 0), (0.09, 0.07), (0.09, -0.07)], 0.01, g(CX0 + 1.9, 1.16, FZ + 0.28), M["white"], rot=(PI / 2, 0, 0)))
cab += trophy(CX0 + 0.6, 1.35, FZ + 0.28, 0.9, M["bronze"])
cab += trophy(CX0 + 1.5, 1.35, FZ + 0.28, 1.1)
for k, (x, name) in enumerate(((CX0 + 0.45, "plaque_flipper"), (CX0 + 1.1, "plaque_duck"), (CX0 + 1.75, "plaque_goggles"))):
    cab.append(plane("Plaque", 0.4, 0.15, g(x, sh - 0.04, FZ + 0.485), signmat(name, 0.5), rot=(PI / 2, 0, 0)))
cab.append(plane("PlaqueFish", 0.4, 0.15, g(CX0 + 1.7, 0.72, FZ + 0.485), signmat("plaque_fish", 0.5), rot=(PI / 2, 0, 0)))
cab.append(box("RecordsFrame", -15.25, -13.95, 2.45, 4.25, FZ, FZ + 0.06, M["gold"], 0.01))
cab.append(plane("Records", 1.2, 1.6, g(-14.6, 3.35, FZ + 0.065), signmat("records", 0.5), rot=(PI / 2, 0, 0)))
add("wall", *cab)
vm = []
VX = 13.9
vm.append(box("Vending", VX - 0.5, VX + 0.5, 0, 1.95, FZ, FZ + 0.8, M["blue"], 0.03))
vm.append(plane("VendingFront", 0.9, 1.8, g(VX, 1.0, FZ + 0.805), signmat("vending", 0.4), rot=(PI / 2, 0, 0)))
vm.append(box("VendingTray", VX - 0.35, VX + 0.35, 0.12, 0.3, FZ + 0.8, FZ + 0.85, M["black"], 0.01))
vm.append(box("Fountain", 15.2, 15.7, 0.0, 0.85, FZ, FZ + 0.32, M["stainless"], 0.02))
vm.append(box("FountainBowl", 15.15, 15.75, 0.85, 0.95, FZ, FZ + 0.42, M["stainless"], 0.03))
vm.append(cyl("FountainSpout", 0.02, 0.06, g(15.45, 0.95, FZ + 0.25), M["chrome"], 8))
vm.append(box("CounterFrame", 13.4, 15.2, 2.55, 3.95, FZ, FZ + 0.06, M["navy"], 0.01))
vm.append(plane("Cannonball", 1.6, 1.07, g(14.3, 3.25, FZ + 0.065), signmat("cannonball", 0.5), rot=(PI / 2, 0, 0)))
add("wall", *vm)

# ---- in the corners and at the open end -----------------------------------------------------------------------------------------------
# the lane-rope reel on its cart: a big drum wound with red, white and blue rope
rx, rz = -14.75, -13.3
re = []
for dz in (-0.55, 0.55):
    re.append(cyl("ReelSide", 0.6, 0.04, g(rx, 0.75, rz + dz), M["navy"], 24, rot=(PI / 2, 0, 0)))
    re[-1].location = g(rx, 0.75, rz + dz)
    re.append(tube("ReelFrame", [g(rx - 0.5, 0.12, rz + dz * 1.12), g(rx, 0.75, rz + dz * 1.12), g(rx + 0.5, 0.12, rz + dz * 1.12)], 0.03, M["stainless"], 1, 6))
    for sx in (-0.5, 0.5):
        re.append(cyl("ReelWheel", 0.12, 0.05, g(rx + sx, 0.12, rz + dz * 1.15), M["rubber"], 12, rot=(PI / 2, 0, 0)))
for k in range(9):
    re.append(torus("ReelRope", 0.0 + 0.32 + 0.0, 0.06, g(rx, 0.75, rz - 0.48 + k * 0.12), [M["red"], M["white"], M["blue"]][k % 3], 20, 6, rot=(PI / 2, 0, 0)))
for k in range(3):
    re.append(torus("ReelRopeOut", 0.44, 0.055, g(rx, 0.75, rz - 0.3 + k * 0.3), [M["blue"], M["red"], M["white"]][k], 20, 6, rot=(PI / 2, 0, 0)))
re.append(cyl("ReelAxle", 0.05, 1.3, g(rx, 0.75, rz - 0.65), M["stainless"], 8, rot=(PI / 2, 0, 0)))
re.append(cyl("ReelDrum", 0.3, 1.06, g(rx, 0.75, rz - 0.53), M["navy"], 20, rot=(PI / 2, 0, 0)))
add("corners", *re)
# the leaning tower of kickboards and a bin of pull buoys
kx, kz = 15.95, -13.7
kb = []
for k in range(16):
    off = 0.012 * k * k / 6
    kb.append(box("Kickboard", kx - 0.2 + off, kx + 0.2 + off, k * 0.045, k * 0.045 + 0.035, kz - 0.28, kz + 0.28, [M["blue"], M["yellow"], M["red"], M["blue_light"], M["white"]][k % 5], 0.012))
kb.append(cyl("BuoyBin", 0.3, 0.55, g(kx - 0.75, 0, kz + 0.1), M["navy"], 16))
for k in range(6):
    a = k * 1.1
    kb.append(sphere("Buoy", 0.08, g(kx - 0.75 + math.cos(a) * 0.15, 0.58 + (k % 2) * 0.06, kz + 0.1 + math.sin(a) * 0.15), M["yellow"] if k % 2 else M["pink"], 8, 6, scale=(1, 1, 1.6)))
add("corners", *kb)
# the POOL PANIC TV camera on its tripod, looking down the pool, its cable coiled on the deck
tx_, tz_ = -3.0, 12.85
tv = []
for k in range(3):
    a = k * math.tau / 3 + 0.3
    tv.append(tube("TripodLeg", [g(tx_, 1.25, tz_), g(tx_ + math.cos(a) * 0.45, 0, tz_ + math.sin(a) * 0.45)], 0.02, M["black"], 1, 5))
tv.append(box("CamHead", tx_ - 0.1, tx_ + 0.1, 1.25, 1.33, tz_ - 0.1, tz_ + 0.1, M["black"], 0.01))
tv.append(box("CamBody", tx_ - 0.17, tx_ + 0.17, 1.33, 1.63, tz_ - 0.15, tz_ + 0.45, M["charcoal"], 0.03))
tv.append(cyl("CamLens", 0.1, 0.35, g(tx_, 1.48, tz_ - 0.15), M["black"], 14, rot=(PI / 2, 0, 0)))
tv[-1].location = g(tx_, 1.48, tz_ - 0.5)
tv.append(cyl("CamGlass", 0.09, 0.01, g(tx_, 1.48, tz_ - 0.51), sm("lens_blue", "#3a6aa8", 0.05), 14, rot=(PI / 2, 0, 0)))
tv.append(box("Viewfinder", tx_ + 0.17, tx_ + 0.27, 1.5, 1.62, tz_ + 0.15, tz_ + 0.35, M["black"], 0.01))
tv.append(plane("CamLogo", 0.22, 0.22, g(tx_ - 0.172, 1.48, tz_ + 0.15), signmat("tv_logo", 0.5), rot=(PI / 2, 0, -PI / 2)))
tv.append(cyl("TallyLight", 0.02, 0.03, g(tx_, 1.63, tz_ + 0.3), lamp_mat("tally", "#ff3a3a", 6.0), 8))
tv.append(torus("CableCoil", 0.22, 0.015, g(tx_ + 0.6, 0.015, tz_ + 0.2), M["black"], 20, 4))
tv.append(torus("CableCoil2", 0.17, 0.015, g(tx_ + 0.6, 0.03, tz_ + 0.2), M["black"], 20, 4))
add("corners", *tv)
# cardboard Marco, flexing at the open end
mx, mz = 4.4, 12.95
# (he faces the overview's camera, at the -x side, turned a little toward the pool)
mc = [plane("Marco", 0.85, 1.7, g(mx, 0.86, mz), signmat("marco", 0.8), rot=(PI / 2, 0, -PI / 2 - 0.4))]
mc.append(plane("MarcoBack", 0.85, 1.7, g(mx + 0.006, 0.86, mz + 0.004), M["cardboard"], rot=(PI / 2, 0, PI / 2 - 0.4)))
mc.append(tube("MarcoStrut", [g(mx + 0.05, 1.2, mz), g(mx + 0.5, 0, mz + 0.2)], 0.015, M["cardboard"], 1, 4))
add("corners", *mc)


# three WET FLOOR boards
def wet_sign(x, z, rz):
    out = []
    for s in (-1, 1):
        p = plane("WetFloor", 0.3, 0.6, (0, s * 0.09, 0.3), signmat("wet_floor", 0.5), rot=(PI / 2 + s * 0.28, 0, 0 if s > 0 else PI))
        out.append(p)
    o = join(out, "WetSign")
    o.location = g(x, 0, z)
    o.rotation_euler = (0, 0, rz)
    apply_all(o)
    return o


add("corners", wet_sign(-8.7, 12.9, 0.4), wet_sign(8.3, 12.95, -0.6), wet_sign(15.6, 3.4, 1.4))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o.type == "MESH"]))
if LOOK:
    look("meet_podium", g(12.4, 0.8, 4.8), 4.5, 18, 230, (960, 640), 18, 32)
    look("meet_officials", g(13.3, 1.2, 11.2), 4.5, 18, 250, (960, 640), 18, 32)
    look("meet_duck", g(15.6, 1.2, 12.5), 4.0, 12, 220, (960, 640), 18, 32)
    look("meet_cabinet", g(-14.6, 1.6, -15.6), 4.2, 8, 0, (960, 640), 18, 32)
    look("meet_vending", g(14.5, 1.6, -15.6), 4.5, 8, 0, (960, 640), 18, 32)
    look("meet_team", g(-12.9, 0.6, 10.6), 4.5, 26, 170, (960, 640), 18, 32)
    look("meet_corner", g(-14.75, 0.6, -13.3), 3.5, 20, 60, (960, 640), 18, 32)
    look("meet_open", g(0.5, 0.8, 12.9), 9, 18, 170, (960, 640), 18, 32)
save_part("meet", [o for v in parts.values() for o in v])
