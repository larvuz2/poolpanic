"""The Jumping Pool's diving stations, hot tub and furniture, in game coordinates, every piece where the game's plan has it
(kit.PLAN):
- at each end the three boards: the LOW springboard's stand (its green band, the fulcrum, the side rails: the board itself is the
  game's, it bends), the MID 3 m platform and the HIGH 6 m tower in white board-formed concrete (fal), their fronts in their
  heights' colours with 1 m, 3 m, 6 m, non-slip tops, railings, the tower's braced columns and its landings; their stairs (teak
  treads on concrete stringers, chrome handrails), the heights' signs on posts at their feet (LOW 1, MID 2, HIGH 3);
- the hot tub: a teak cabinet with dark battens, a marble rim, a turquoise bowl with its seat ledges, the steps and a rail, HOT
  TUB · MAX 6 (its water, glow and steam are the game's);
- the massage corner's shelf (folded towels, oils, a stack of stones), RELAX · MASSAGE, a potted bay (the massage beds are the
  game's);
- WATER CARE (HOT TUB CARE) and EYE CARE as cream cabinets with green doors and marble tops, the skimmer's board on the near
  hedge, the waste bin, the rings' boards (`LifeRing`), the net's board, the torch on a brass pedestal (`Flashlight`), the fuse
  box's service cabinet, the dog treats' table;
- the rescue bench, the towel cart (TOWELS & FINS), the lifeguard's tall chair (its lifeguard a duck in swim goggles), the planters
  with palms, sun loungers and green-and-cream parasols on the deck behind the stations.

    blender -b -P tools/venues/dive/props_towers.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import palm  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(611)
M = dict(
    concrete=tmat_tile("concrete", "#ece8e0", 0.7),
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    marble=tmat_tile("marble", "#f1ece4", 0.25),
    linen=tmat_tile("linen", "#efe6d2", 0.85),
    awning=tmat_tile("awning", "#2f6b4a", 0.8),
    mosaic=tmat_tile("mosaic", "#4fc3d6", 0.2, tint="#8fe8f0"),
    nonslip=sm("nonslip"),
    white=sm("white"),
    cream=sm("cream"),
    racing=sm("racing"),
    navy=sm("navy"),
    teak_dark=sm("teak_dark"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    brass=sm("brass"),
    gold=sm("gold"),
    ink=sm("ink"),
    red=sm("red"),
    yellow=sm("yellow"),
    coral=sm("coral"),
    teal=sm("teal"),
    towel=sm("towel"),
    rubber=sm("rubber"),
    glass=sm("glass"),
    terracotta=sm("terracotta"),
    leaf_dark=sm("leaf_dark"),
    soil=sm("soil"),
    oil_a=sm("oil_a", "#d38a2c", 0.2),
    oil_b=sm("oil_b", "#9bbf6a", 0.2),
    stone=sm("stone", "#3a3a3a", 0.5),
    heights=[sm("h_" + h["key"], h["color"], 0.42) for h in HEIGHTS],
    frond=cutmat("palm_frond", 0.65),
)
trees.use({"frond": M["frond"], "bark": sm("bark"), "bark_light": sm("bark"), "palm_boot": sm("bark"), "coconut": sm("coconut", "#6b4a2a", 0.8)})
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


lb = box
SIGN_FACE = {}


def double_sign(name, sign, w, h, x, y, z, theta):
    """A sign readable from both sides (a plate on a post seen from anywhere): two faces back to back, a dark edge between."""
    nx, nz = math.sin(theta), math.cos(theta)
    return [
        face(name, w, h, x + nx * 0.012, y, z + nz * 0.012, theta, signmat(sign, 0.5)),
        face(name, w, h, x - nx * 0.012, y, z - nz * 0.012, theta + PI, signmat(sign, 0.5)),
    ]


# ================================================================================================================================
# THE DIVING STATIONS
# ================================================================================================================================
for b in BOARDS:
    H, s, x, h = b["y"], b["side"], b["x"], b["h"]
    col = M["heights"][h]
    word = HEIGHTS[h]["key"]
    o = []
    if h == 0:
        # the springboard's stand: concrete, a band in green, the fulcrum's roller, short side rails (the board is the game's)
        sz = (b["topZ"] + b["backZ"]) / 2
        o.append(box("Stand", x - 0.5, x + 0.5, 0.0, H - 0.12, sz - 0.7, sz + 0.7, M["concrete"], 0.04))
        o.append(box("StandBand", x - 0.51, x + 0.51, H - 0.43, H - 0.21, sz - 0.71, sz + 0.71, col, 0.02))
        o.append(cyl("Fulcrum", 0.07, 0.62, g(x - 0.31, H - 0.06, b["backZ"] - s * 0.2), M["steel"], 12, rot=(0, PI / 2, 0)))
        o.append(face("Metres", 0.6, 0.19, x, H - 0.32, sz - s * 0.715, 0.0 if s < 0 else PI, signmat("metres_low", 0.5)))
        for dx in (-0.5, 0.5):
            o.append(rod("StandRail", (x + dx, H + 0.9, b["topZ"]), (x + dx, H + 0.9, b["backZ"] + s * 0.3), 0.03, M["chrome"]))
            for z in (b["topZ"], b["backZ"] + s * 0.3):
                o.append(rod("StandPost", (x + dx, H - 0.12, z), (x + dx, H + 0.9, z), 0.025, M["chrome"]))
    else:
        width = 1.7 if h == 2 else 1.5
        z0, z1 = b["tipZ"], b["topZ"] + s * 0.25
        o.append(box("Slab", x - width / 2, x + width / 2, H - 0.28, H, z0, z1, M["concrete"], 0.03))
        o.append(box("NonSlip", x - width / 2 + 0.06, x + width / 2 - 0.06, H, H + 0.012, z0 + s * 0.06, z1 - s * 0.06, M["nonslip"], 0.0))
        o.append(box("Front", x - width / 2 - 0.01, x + width / 2 + 0.01, H - 0.29, H + 0.01, z0 - s * 0.04, z0 + s * 0.02, col, 0.01))
        o.append(face("Metres", 0.9, 0.28, x, H - 0.14, z0 - s * 0.045, 0.0 if s < 0 else PI, signmat("metres_" + word, 0.5)))
        back = b["backZ"] + s * 0.2
        colz = [back, back + s * 1.2] if h == 2 else [back + s * 0.3]
        for cz in colz:
            for dx in (-width / 2 + 0.18, width / 2 - 0.18):
                o.append(box("Column", x + dx - 0.15, x + dx + 0.15, 0.0, H - 0.28, cz - 0.15, cz + 0.15, M["concrete"], 0.03))
        if h == 2:
            for y in (2.0, 4.0):
                o.append(box("Landing", x - width / 2, x + width / 2, y - 0.09, y + 0.09, min(colz) - 0.15, max(colz) + 0.15, M["concrete"], 0.02))
            o.append(box("RedBand", x - width / 2 - 0.02, x + width / 2 + 0.02, H - 0.4, H - 0.27, min(z0, z1) - 0.02, max(z0, z1) + 0.02, col, 0.01))
        for dx in (-width / 2 + 0.05, width / 2 - 0.05):
            for y in (H + 0.5, H + 1.0):
                o.append(rod("Rail", (x + dx, y, z1), (x + dx, y, z0 + s * 0.55), 0.03 if y > H + 0.6 else 0.022, M["chrome"]))
            for z in (z1, z0 + s * 0.55):
                o.append(rod("RailPost", (x + dx, H, z), (x + dx, H + 1.0, z), 0.028, M["chrome"]))
    # the stairs: teak treads on two concrete stringers, chrome handrails
    steps = max(4, round(H / 0.25))
    run = b["footZ"] - b["topZ"]
    for i in range(steps):
        t = (i + 0.5) / steps
        y = H * (i + 1) / steps
        z = b["footZ"] - run * t
        o.append(box("Tread", x - 0.375, x + 0.375, y - 0.05, y, z - abs(run) / steps / 2 - 0.04, z + abs(run) / steps / 2 + 0.04, M["teak"], 0.01))
    for dx in (-0.415, 0.415):
        o.append(rod("Stringer", (x + dx, 0.05, b["footZ"]), (x + dx, H, b["topZ"]), 0.05, M["concrete"]))
        o.append(rod("Handrail", (x + dx, 0.95, b["footZ"] + s * 0.05), (x + dx, H + 0.95, b["topZ"]), 0.03, M["chrome"]))
        o.append(rod("HandrailFoot", (x + dx, 0.0, b["footZ"] + s * 0.05), (x + dx, 0.95, b["footZ"] + s * 0.05), 0.03, M["chrome"]))
    # the height's sign on a post at the stairs' foot
    px, pz = x + 0.62, b["footZ"] + s * 0.25
    o.append(cyl("SignPost", 0.05, 1.95, g(px, 0, pz), M["white"], 10))
    o += double_sign("HeightSign", "height_" + word, 0.62, 0.36, px, 1.72, pz, PI / 2)
    add("stations_dive", *o)

# ================================================================================================================================
# THE HOT TUB (its water, glow and steam are the game's)
# ================================================================================================================================
T = TUB
TOP = T["top"]
hx, hz = T["hx"], T["hz"]
wall = T["rim"] + T["deck"]
ox, oz = hx + wall, hz + wall
tx, tz = T["x"], T["z"]
o = []
for sx in (-1, 1):
    o.append(box("TubCabinet", tx + sx * hx, tx + sx * ox, 0.0, TOP, tz - oz, tz + oz, M["teak"], 0.01))
    o.append(box("TubCabinet", tx - hx, tx + hx, 0.0, TOP, tz + sx * hz, tz + sx * oz, M["teak"], 0.01))
    for k in range(-2, 3):
        zz = tz + k * oz / 2.5
        o.append(box("Batten", tx + sx * (ox + 0.005) - 0.025, tx + sx * (ox + 0.005) + 0.025, 0.02, TOP - 0.02, zz - 0.04, zz + 0.04, M["teak_dark"], 0.005))
    o.append(box("Batten", tx - 0.04, tx + 0.04, 0.02, TOP - 0.02, tz + sx * (oz + 0.005) - 0.025, tz + sx * (oz + 0.005) + 0.025, M["teak_dark"], 0.005))
    # the marble rim round the water
    o.append(box("TubRim", tx + sx * hx, tx + sx * (hx + T["rim"]), TOP, TOP + 0.06, tz - hz - T["rim"], tz + hz + T["rim"], M["marble"], 0.015))
    o.append(box("TubRim", tx - hx, tx + hx, TOP, TOP + 0.06, tz + sx * hz, tz + sx * (hz + T["rim"]), M["marble"], 0.015))
    # the bowl's lining and its seat ledges
    o.append(box("TubLining", tx + sx * (hx - 0.01), tx + sx * hx, 0.0, TOP, tz - hz, tz + hz, M["mosaic"], 0.0))
    o.append(box("TubLining", tx - hx, tx + hx, 0.0, TOP, tz + sx * (hz - 0.01), tz + sx * hz, M["mosaic"], 0.0))
    o.append(box("TubSeat", tx + sx * (hx - 0.26), tx + sx * hx, 0.0, 0.3, tz - hz + 0.05, tz + hz - 0.05, M["mosaic"], 0.03))
o.append(box("TubFloor", tx - hx, tx + hx, 0.0, 0.04, tz - hz, tz + hz, M["mosaic"], 0.0))
# the steps up its rim at the end toward the massage beds, and a rail
e = 1 if T["steps"]["deck"]["z"] > tz else -1
edge = tz + e * oz
for i in range(2):
    hh = TOP * (i + 1) / 3
    back = 0.55 - i * 0.28
    o.append(box("TubStep", tx - 0.5, tx + 0.5, 0.0, hh, edge + e * back - 0.15, edge + e * back + 0.15, M["teak"], 0.02))
rx = tx + ox - 0.05
o.append(rod("TubRail", (rx, 0, edge + e * 0.75), (rx, 0.95, edge + e * 0.75), 0.03, M["chrome"]))
o.append(rod("TubRail", (rx, 0.95, edge + e * 0.75), (rx, TOP + 0.75, edge), 0.03, M["chrome"]))
o.append(face("TubSign", 0.9, 0.28, tx, 0.35, tz - e * (oz + 0.012), PI if e > 0 else 0.0, signmat("hot_tub", 0.5)))
add("tub", *o)

# ================================================================================================================================
# THE MASSAGE CORNER (the beds are the game's)
# ================================================================================================================================
beds = sorted(MASSAGE_BEDS, key=lambda b: b["z"])
mx, mz0, mz1 = beds[0]["x"], beds[0]["z"] - 1.35, beds[-1]["z"] + 1.35
sh = []
for y in (0.25, 0.6):
    sh.append(lb("Shelf", -0.65, 0.65, y - 0.025, y + 0.025, -0.21, 0.21, M["teak"], 0.01))
for x in (-0.62, 0.62):
    sh.append(lb("ShelfSide", x - 0.025, x + 0.025, 0.0, 0.9, -0.21, 0.21, M["teak_dark"], 0.01))
for i in range(3):
    for j in range(2):
        sh.append(lb("FoldedTowel", -0.59 + i * 0.42, -0.25 + i * 0.42, 0.275 + j * 0.095, 0.365 + j * 0.095, -0.15, 0.15, (M["towel"], M["teal"], M["cream"])[(i + j) % 3], 0.03))
for i in range(4):
    sh.append(cyl("Oil", 0.05, 0.18, g(-0.5 + i * 0.33, 0.625, 0.0), M["oil_a"] if i % 2 else M["oil_b"], 10, r2=0.04))
for i in range(3):
    sh.append(sphere("Stone", 0.08 - i * 0.015, g(0.45, 0.67 + i * 0.09, 0.0), M["stone"], 10, 6, scale=(1.3, 1.3, 0.6)))
add("spa", yawed(sh, mx - 0.9, mz1 + 0.15, 0.0, "SpaShelf"))
rs = [cyl("RelaxPost", 0.03, 0.8, g(dz, 0, 0.0), M["white"], 8) for dz in (-0.5, 0.5)]
rs += double_sign("Relax", "relax", 1.5, 0.4, 0.0, 0.78, 0.0, 0.0)
add("spa", yawed(rs, mx + 0.45, mz1 + 0.2, -PI / 2, "Relax"))
add("spa",
    cyl("SpaPot", 0.26, 0.45, g(mx - 1.15, 0, mz0 - 0.1), M["terracotta"], 16, r2=0.2),
    trees.blob("SpaBay", g(mx - 1.15, 0.85, mz0 - 0.1), (0.4, 0.4, 0.38), M["leaf_dark"], 77, (10, 6), 0.12))

# ================================================================================================================================
# THE STATIONS AND THE FIXTURES
# ================================================================================================================================
S = STATIONS
F = FIXTURES


def cabinet(name, sign):
    o = [
        lb(name, -0.8, 0.8, 0.08, 1.05, -0.48, 0.48, M["cream"], 0.02),
        lb(name + "Plinth", -0.75, 0.75, 0.0, 0.08, -0.42, 0.42, M["racing"], 0.0),
        lb(name + "Top", -0.88, 0.88, 1.05, 1.11, -0.56, 0.56, M["marble"], 0.01),
    ]
    for x in (-0.4, 0.4):
        o.append(lb(name + "Door", x - 0.37, x + 0.37, 0.16, 0.98, 0.48, 0.5, M["racing"], 0.01))
        o.append(lb(name + "Pull", x - 0.12, x + 0.12, 0.85, 0.87, 0.5, 0.53, M["brass"], 0.0))
    for x in (-0.75, 0.75):
        o.append(cyl(name + "Post", 0.025, 1.25, g(x, 1.11, -0.3), M["brass"], 8))
    o.append(lb(name + "SignBack", -0.88, 0.88, 1.98, 2.32, -0.33, -0.29, M["racing"], 0.01))
    o.append(face(name + "Sign", 1.72, 0.32, 0.0, 2.15, -0.285, 0.0, signmat(sign, 0.4)))
    return o


facing = lambda p: PI / 2 if p["x"] < 0 else -PI / 2  # noqa: E731  (each faces the pool from its own side's hedge)
wc = cabinet("WaterCare", "water_care") + [
    cyl("ClTub", 0.22, 0.42, g(-0.4, 1.11, 0.0), sm("cl_tub", "#f2e6c8", 0.6), 16, r2=0.2),
    cyl("ClLid", 0.23, 0.06, g(-0.4, 1.53, 0.0), M["teal"], 16),
    cyl("ClBucket", 0.16, 0.25, g(0.35, 1.11, 0.1), M["chrome"], 14, r2=0.19),
]
add("stations", yawed(wc, S["chlorine"]["x"], S["chlorine"]["z"], facing(S["chlorine"]), "WaterCare"))
ec = cabinet("EyeCare", "eye_care") + [
    cyl("EyeWash", 0.07, 0.24, g(-0.5, 1.11, 0.05), sm("eyewash", "#64bcca", 0.3), 12),
    cyl("EyeWashCap", 0.04, 0.06, g(-0.5, 1.35, 0.05), M["coral"], 10),
    cyl("Mirror", 0.24, 0.03, g(0.35, 1.62, -0.25), M["brass"], 22, rot=(PI / 2, 0, 0)),
    cyl("MirrorGlass", 0.2, 0.02, g(0.35, 1.62, -0.22), sm("mirror", "#c9d4da", 0.05, 1.0), 22, rot=(PI / 2, 0, 0)),
    cyl("MirrorPost", 0.02, 0.45, g(0.35, 1.11, -0.27), M["brass"], 8),
]
add("stations", yawed(ec, S["relief"]["x"], S["relief"]["z"], facing(S["relief"]), "EyeCare"))
# the skimmer's board on the near hedge's face (the game's skimmer on its pegs), the waste bin
SN = SANITATION
wallX = DECK["minX"] - 0.45
add("stations",
    box("SkimBoard", wallX - 0.06, wallX + 0.08, 1.12, 2.37, SN["rack"]["z"] - 1.95, SN["rack"]["z"] + 1.95, M["racing"], 0.03),
    box("SkimRim", wallX - 0.08, wallX + 0.06, 1.09, 2.4, SN["rack"]["z"] - 1.98, SN["rack"]["z"] + 1.98, M["brass"], 0.01),
    face("SkimSign", 2.7, 0.42, wallX + 0.09, 2.65, SN["rack"]["z"], PI / 2, signmat("skimmer", 0.4)),
    box("SkimSignBack", wallX - 0.04, wallX + 0.08, 2.42, 2.88, SN["rack"]["z"] - 1.4, SN["rack"]["z"] + 1.4, M["racing"], 0.01))
for z in (SN["rack"]["z"] - 1.5, SN["rack"]["z"] + 1.5):
    add("stations", cyl("SkimPost", 0.04, 2.4, g(wallX, 0.0, z), M["racing"], 8))
WB = SN["bin"]
add("stations",
    cyl("BinBody", 0.4, 1.0, g(WB["x"], 0, WB["z"]), M["racing"], 20, r2=0.43),
    torus("BinBand", 0.43, 0.02, g(WB["x"], 0.85, WB["z"]), M["brass"], 24, 5),
    cyl("BinLid", 0.46, 0.07, g(WB["x"], 1.0, WB["z"]), M["brass"], 20),
    face("BinSign", 0.5, 0.19, WB["x"] + 0.44, 0.6, WB["z"], PI / 2, signmat("waste", 0.5)))


def board_on_posts(name, w, h, y0, sign_name, sign_h, m_board):
    out = [
        lb(name, -w / 2, w / 2, y0, y0 + h, -0.05, 0.0, m_board, 0.03),
        lb(name + "Rim", -w / 2 - 0.03, w / 2 + 0.03, y0 - 0.03, y0 + h + 0.03, -0.07, -0.04, M["brass"], 0.01),
    ]
    for x in (-w / 2 + 0.12, w / 2 - 0.12):
        out.append(cyl(name + "Post", 0.035, y0 + h + 0.1, g(x, 0, -0.1), M["white"], 10))
    if sign_name:
        sy = y0 + h + 0.08 + sign_h / 2
        out.append(face(name + "Sign", w + 0.1, sign_h, 0, sy, 0.005, 0.0, signmat(sign_name, 0.5)))
        out.append(lb(name + "SignBack", -w / 2 - 0.06, w / 2 + 0.06, sy - sign_h / 2 - 0.01, sy + sign_h / 2 + 0.01, -0.03, -0.002, M["racing"], 0.01))
    return out


for m in RING_MOUNTS:
    rb = board_on_posts("RingBoard", 1.5, 2.15, 0.35, "life_ring", 0.42, M["racing"])
    rb.append(rod("RingPeg", (0, 2.3, -0.05), (0, 2.3, 0.12), 0.04, M["brass"]))
    for q in rb:
        q.location.y += 0.18  # (the board 0.18 behind the ring's place: Blender's +y is the game's -z)
    add("stations", yawed(rb, m["x"], m["z"], m["angle"], "RingBoard"), sphere("LifeRing", 0.1, g(m["x"], 1.65, m["z"]), M["red"], 8, 6))
FN = F["fishNet"]
fb = board_on_posts("NetBoard", 1.4, 2.5, 0.05, "fish_net", 0.4, M["racing"])
for q in fb:
    q.location.y += 0.18
add("stations", yawed(fb, FN["x"], FN["z"], FN["angle"], "NetBoard"))
FLT = F["flashlight"]
add("stations",
    cyl("Pedestal", 0.22, 0.06, g(FLT["x"], 0, FLT["z"]), M["racing"], 16),
    cyl("PedestalStem", 0.06, 1.0, g(FLT["x"], 0.06, FLT["z"]), M["brass"], 12, r2=0.05),
    cyl("PedestalCradle", 0.14, 0.08, g(FLT["x"], 1.06, FLT["z"]), M["brass"], 14, r2=0.17),
    sphere("Flashlight", 0.05, g(FLT["x"], 1.24, FLT["z"]), M["ink"], 6, 4))
FB = F["fuseBox"]
add("stations",
    box("ServiceCabinet", FB["x"] + 0.27, FB["x"] + 0.5, 0.0, 2.4, FB["z"] - 0.8, FB["z"] + 0.8, M["racing"], 0.03),
    box("ServiceCap", FB["x"] + 0.25, FB["x"] + 0.52, 2.4, 2.46, FB["z"] - 0.82, FB["z"] + 0.82, M["brass"], 0.01),
    face("Danger", 1.1, 0.41, FB["x"] + 0.265, 2.2, FB["z"], -PI / 2, signmat("danger", 0.5)))
TR = F["treats"]
add("stations",
    cyl("TreatsTop", 0.32, 0.04, g(TR["x"], 0.82, TR["z"]), M["marble"], 20),
    cyl("TreatsStem", 0.03, 0.82, g(TR["x"], 0.0, TR["z"]), M["brass"], 8),
    cyl("TreatsFoot", 0.2, 0.03, g(TR["x"], 0.0, TR["z"]), M["brass"], 16),
    cyl("TreatsJar", 0.1, 0.2, g(TR["x"] - 0.08, 0.86, TR["z"]), M["glass"], 14),
    cyl("TreatsJarLid", 0.105, 0.03, g(TR["x"] - 0.08, 1.06, TR["z"]), M["brass"], 14),
    face("TreatsSign", 0.5, 0.19, TR["x"] - 0.33, 1.15, TR["z"], -PI / 2, signmat("treats", 0.5)))

# ================================================================================================================================
# THE FURNITURE: the rescue bench, the towel cart, the lifeguard's chair, the planters; loungers behind the stations
# ================================================================================================================================
for f in FURNITURE:
    x, z = f["x"], f["z"]
    if f["kind"] == "bench":
        bn = []
        for dz in (-1.0, 1.0):
            bn.append(lb("BenchLeg", -0.25, 0.25, 0.0, 0.42, dz - 0.04, dz + 0.04, M["racing"], 0.01))
            bn.append(lb("BenchArm", -0.27, 0.2, 0.42, 0.66, dz - 0.04, dz + 0.04, M["racing"], 0.01))
        for k in range(4):
            bn.append(lb("BenchSlat", -0.24 + k * 0.12, -0.15 + k * 0.12, 0.42, 0.46, -1.15, 1.15, M["teak"], 0.01))
        for k in range(3):
            bn.append(lb("BenchBack", 0.22, 0.26, 0.55 + k * 0.13, 0.64 + k * 0.13, -1.15, 1.15, M["teak"], 0.01))
        add("furniture", yawed(bn, x, z, 0.0, "Bench"))
    elif f["kind"] == "towel-rack":
        tc = []
        for dz in (-0.9, 0.9):
            tc.append(lb("CartEnd", -0.45, 0.45, 0.0, 1.2, dz - 0.03, dz + 0.03, M["teak"], 0.01))
        for y in (0.15, 0.6, 1.05):
            tc.append(lb("CartShelf", -0.42, 0.42, y, y + 0.03, -0.9, 0.9, M["teak"], 0.01))
        for y in (0.18, 0.63):
            for k in range(6):
                tc.append(cyl("RolledTowel", 0.07, 0.75, g(-0.37, y + 0.07, -0.75 + k * 0.3), (M["towel"], M["racing"])[k % 2], 10, rot=(0, PI / 2, 0)))
        for k in range(3):
            tc.append(lb("FinPair", -0.3, 0.3, 1.08, 1.12, -0.6 + k * 0.5, -0.4 + k * 0.5, M["yellow"], 0.02))
        tc.append(face("TowelsSign", 1.0, 0.31, -0.46, 1.42, 0.0, -PI / 2, signmat("towels", 0.5)))
        add("furniture", yawed(tc, x, z, 0.0, "TowelCart"))
    elif f["kind"] == "lifeguard":
        lg = []
        for dx in (-0.45, 0.45):
            for dz in (-0.45, 0.45):
                lg.append(rod("ChairLeg", (dx, 0.0, dz), (dx * 0.6, 1.75, dz * 0.6), 0.05, M["white"]))
        for y in (0.45, 0.95, 1.4):
            k = 1 - y / 1.75 * 0.4
            lg.append(lb("ChairRung", -0.45 * k, 0.45 * k, y - 0.03, y + 0.03, 0.43 * k, 0.48 * k, M["white"], 0.01))
        lg.append(lb("ChairSeat", -0.32, 0.32, 1.75, 1.82, -0.32, 0.32, M["teak"], 0.02))
        lg.append(lb("ChairBack", -0.32, 0.32, 1.82, 2.4, -0.34, -0.28, M["teak"], 0.02))
        lg.append(rod("UmbrellaPole", (0.28, 1.8, -0.28), (0.28, 3.4, -0.28), 0.025, M["white"]))
        lg.append(cyl("Umbrella", 0.9, 0.35, g(0.28, 3.2, -0.28), M["awning"], 12, r2=0.05))
        lg.append(face("LifeguardSign", 0.6, 0.23, 0.0, 1.3, 0.49, 0.0, signmat("lifeguard", 0.5)))
        lg.append(card("ChairDuck", "duck_goggles", 0.42, 0.0, 1.82, 0.0, 0.0))
        lg.append(cyl("RescueTube", 0.08, 0.9, g(-0.36, 1.9, 0.05), M["red"], 10, rot=(PI / 2, 0, 0)))
        add("furniture", yawed(lg, x, z, -PI / 2 if x > 0 else PI / 2, "LifeguardChair"))
    elif f["kind"] == "planter":
        add("furniture",
            box("Planter", x - 0.45, x + 0.45, 0.0, 0.6, z - 0.45, z + 0.45, M["concrete"], 0.04),
            box("PlanterRim", x - 0.47, x + 0.47, 0.6, 0.65, z - 0.47, z + 0.47, M["racing"], 0.01),
            box("PlanterSoil", x - 0.42, x + 0.42, 0.6, 0.63, z - 0.42, z + 0.42, M["soil"], 0.0),
            *palm(x, z, 2.6, 300 + int(x * 7 + z), y0=0.63, lean=0.06, away=(0.0, 0.0)))
# sun loungers and parasols on the deck behind the stations (where the classic has them)
for s in (-1, 1):
    for x in (8.4, 11.2):
        z = s * (HZ + 5.2)
        ln = []
        for dx in (-0.3, 0.3):
            ln.append(lb("LoungerRail", dx - 0.03, dx + 0.03, 0.18, 0.28, -0.95, 0.95, M["teak"], 0.01))
            for dz in (-0.85, 0.85):
                ln.append(lb("LoungerLeg", dx - 0.03, dx + 0.03, 0.0, 0.2, dz - 0.03, dz + 0.03, M["teak"], 0.005))
        ln.append(lb("LoungerCushion", -0.33, 0.33, 0.28, 0.38, -0.25, 0.92, M["linen"], 0.04))
        back = prism("LoungerBack", [(-0.95, 0.28), (-0.25, 0.28), (-0.25, 0.38), (-0.9, 0.8), (-0.97, 0.76)], -0.33, 0.33, M["linen"])
        back.rotation_euler = (0, 0, -PI / 2)  # (its x along the game's z, the head to -z: turned about Blender's z)
        ln.append(back)
        ln.append(cyl("RolledTowel", 0.08, 0.5, g(0.0, 0.42, 0.75), M["racing"], 10, rot=(0, PI / 2, 0)))
        add("loungers", yawed(ln, x, z, 0.0 if s < 0 else PI, "Lounger"))
    px, pz = 6.9, s * (HZ + 6.1)
    add("loungers",
        cyl("ParasolBase", 0.25, 0.08, g(px, 0, pz), M["concrete"], 16),
        cyl("ParasolPole", 0.035, 2.5, g(px, 0.08, pz), M["white"], 8),
        cyl("ParasolCanopy", 1.4, 0.5, g(px, 2.1, pz), M["awning"], 16, r2=0.05),
        cyl("ParasolValance", 1.42, 0.12, g(px, 2.0, pz), M["awning"], 16),
        sphere("ParasolFinial", 0.05, g(px, 2.62, pz), M["brass"], 8, 6))

for k, v in parts.items():
    print("GROUP", k, tris(v))
if LOOK:
    look("towers_west", g(0, 2.5, -10), 16, 25, 300, (1280, 720), 16, 35)
    look("towers_tub", g(-8.4, 0.5, 0), 8, 30, 250, (1280, 720), 16, 35)
for k, v in parts.items():
    save_part("towers_" + k, v)
