"""The Lido Deck's furniture and its stories, every piece in the plan's furniture boxes, on the walks along the rails, on the stern's
and the bow's strips (outside the deck the guests walk), or on the ship (kit.PLAN):
- the Lido Bar: a deco kiosk of mahogany with brass portholes and a brass foot rail under a striped canvas canopy, The Lido Bar
  over it, a back bar of bottles before a mirror, the cocktail menu, glasses, a pineapple and limes, an ice swan melting on the
  counter, two stools; a seagull stealing a fry off the counter, a towel monkey hanging off the canopy;
- the hot tub: teak staves, a white rim, steps and a chrome rail, HOT TUB (MAX 6 · NO SEAGULLS), a stack of towels with a towel
  octopus in a captain's hat, a champagne bucket, a rubber duck;
- the stations: WATER CARE a white marine locker with a brass dosing pump and yellow jerrycans, EYE CARE an enamel eyewash fountain
  with a porthole mirror and towels; the fin rack (its three pairs the model's, `Fins_1..3`); the rescue bench of teak on chrome
  (a towel turtle on it); the first aid locker (the game's kit on its shelf); the skimmer's board on the stern rail and the waste
  bin; the life rings' boards (`LifeRing`), the fish net's board; the torch on a ship's binnacle (`Flashlight`); the dog treats'
  table; the life jacket chests (a towel crab on one); the towel cart (a towel elephant and a towel swan on top); white planters with
  palms; furled umbrellas between the loungers;
- the stories: TODAY ON BOARD (15:30 BELLY FLOP CHAMPIONSHIP), the pool's rules and SEAGULL CROSSING on the port walk with a
  squawking gull; CAPTAIN FOR A DAY (fal) with a smug gull on it, LOST & FOUND with its basket, WET DECK on the starboard walk;
  Captain Barnacle's portrait (fal) and the travel poster on the café's front, the judges' table at the bow (9.5, 10, 2 and the
  trophy), the engine telegraph rung to PANIC, a basket of pool toys and a flamingo; the deck plan (YOU ARE HERE) and two
  ventilator cowls aft; the shuffleboard's cue rack and pucks; seagulls everywhere a seagull would be.

    blender -b -P tools/venues/cruise/props_deck.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import palm  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(1936)
TAU = 2 * PI
M = dict(
    paint=tmat_tile("paint", "#f1f3f4", 0.4),
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    canvas=tmat_tile("canvas", "#efe6d0", 0.85),
    mahogany=tmat_tile("mahogany", "#6a2e1c", 0.35),
    white=sm("white"),
    white_matte=sm("white_matte"),
    cream=sm("cream"),
    navy=sm("navy"),
    navy_dark=sm("navy_dark"),
    red=sm("red"),
    orange=sm("orange"),
    yellow=sm("yellow"),
    teal=sm("teal"),
    sky=sm("sky"),
    pink=sm("pink"),
    green=sm("green"),
    lime=sm("lime"),
    black=sm("black"),
    grey=sm("grey"),
    grey_dark=sm("grey_dark"),
    gold=sm("gold"),
    brass=sm("brass"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    teak_s=sm("teak"),
    teak_dark=sm("teak_dark"),
    rope=sm("rope"),
    towel=sm("towel"),
    rubber=sm("rubber"),
    glass=sm("glass"),
    ice=sm("ice"),
    mirror=sm("mirror", "#c9d6dc", 0.05, 1.0),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    terracotta=sm("terracotta"),
    shrimp=sm("shrimp"),
    wicker=sm("wicker", "#c79a5a", 0.9),
    soil=sm("soil", "#3a2a1c", 0.95),
    bottle_g=sm("bottle_g", "#2f7a46", 0.15),
    bottle_a=sm("bottle_a", "#a8661c", 0.15),
    bottle_c=sm("bottle_c", "#d8eef2", 0.1),
    frond=cutmat("palm_frond", 0.65),
    kiosk=lamp_mat("kiosk_glass", "#ffe2b0", 3.0),
)
trees.use({"frond": M["frond"], "bark": sm("bark", "#7a5d40", 0.9), "bark_light": sm("bark", "#7a5d40", 0.9), "palm_boot": sm("bark", "#7a5d40", 0.9), "coconut": sm("coconut")})
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1), m, bev)


lb = box


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def face(name, w, h, x, y, z, theta, m):
    return plane(name, w, h, g(x, y, z), m, rot=(PI / 2, 0, theta))


def anchor(name, x, y, z):
    return sphere("Anchor_" + name, 0.05, g(x, y, z), M["white"], 6, 4)


def yawed(objs, x, z, yaw, name, y=0.0):
    """Join pieces modelled round the origin (their front to local +z), turn them by `yaw` and set them at (x, y, z). (Joining
    keeps the first piece's origin: it is baked away first, so the turn and the move are about the true origin.)"""
    o = join([q for q in objs if q], name)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (0, 0, yaw)
    o.location = g(x, y, z)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


TO_MX, TO_PX, TO_MZ, TO_PZ = -PI / 2, PI / 2, PI, 0.0
_ASPECT = {}


def card(name, cut, h, x, y, z, theta):
    """A cut-out standing on (x, y, z), `h` tall, facing the game's (sin θ, cos θ)."""
    if cut not in _ASPECT:
        img = bpy.data.images.load(os.path.join(TEX, cut + "_alpha.png"))
        _ASPECT[cut] = img.size[0] / img.size[1]
        bpy.data.images.remove(img)
    w = h * _ASPECT[cut]
    return plane(name, w, h, g(x, y + h / 2, z), cutmat(cut, 0.7), rot=(PI / 2, 0, theta))


def board_on_posts(name, w, h, y0, sign_name, sign_h, m_board):
    """A board on two chrome posts at the origin, its face to local +z, `sign_name` on a plate over it."""
    out = []
    if h > 0:
        out.append(lb(name, -w / 2, w / 2, y0, y0 + h, -0.05, 0.0, m_board, 0.03))
        out.append(lb(name + "Rim", -w / 2 - 0.03, w / 2 + 0.03, y0 - 0.03, y0 + h + 0.03, -0.07, -0.04, M["brass"], 0.01))
    for x in (-w / 2 + 0.12, w / 2 - 0.12):
        out.append(cyl(name + "Post", 0.035, y0 + h + 0.1, g(x, 0, -0.1), M["chrome"], 10))
        out.append(cyl(name + "Foot", 0.09, 0.03, g(x, 0, -0.1), M["chrome"], 12))
    if sign_name:
        sy = y0 + h + 0.08 + sign_h / 2
        out.append(face(name + "Sign", w + 0.1, sign_h, 0, sy, 0.005, 0.0, signmat(sign_name, 0.5)))
        # (a navy back to it: never the sign's letters mirrored from behind)
        out.append(lb(name + "SignBack", -w / 2 - 0.06, w / 2 + 0.06, sy - sign_h / 2 - 0.01, sy + sign_h / 2 + 0.01, -0.03, -0.002, M["navy_dark"], 0.01))
    return out


# ================================================================================================================================
# THE LIDO BAR (its serving side to the pool, -x)
# ================================================================================================================================
B = BAR
bx0, bx1 = B["x"] - 1.6, B["x"] + 1.55  # front counter's face .. the back bar's wall
bz0, bz1 = B["z"] - 1.5, B["z"] + 1.5
L = []
# the front counter along z, the two short sides, the back bar
L.append(lb("BarFront", bx0, bx0 + 0.45, 0.0, 1.1, bz0, bz1, M["mahogany"], 0.02))
for z0_, z1_ in ((bz0, bz0 + 0.35), (bz1 - 0.35, bz1)):
    L.append(lb("BarSide", bx0, bx0 + 1.9, 0.0, 1.1, z0_, z1_, M["mahogany"], 0.02))
L.append(lb("BarTop", bx0 - 0.12, bx0 + 0.5, 1.1, 1.16, bz0 - 0.08, bz1 + 0.08, M["white"], 0.02))
L.append(lb("BarTopEdge", bx0 - 0.14, bx0 - 0.1, 1.08, 1.16, bz0 - 0.08, bz1 + 0.08, M["brass"], 0.0))
for z0_, z1_ in ((bz0 - 0.08, bz0 + 0.38), (bz1 - 0.38, bz1 + 0.08)):
    L.append(lb("BarSideTop", bx0, bx0 + 1.95, 1.1, 1.16, z0_, z1_, M["white"], 0.02))
L.append(lb("BarKick", bx0 - 0.02, bx0 + 0.05, 0.0, 0.14, bz0, bz1, M["navy_dark"], 0.0))
L.append(rod("FootRail", (bx0 - 0.2, 0.24, bz0 + 0.1), (bx0 - 0.2, 0.24, bz1 - 0.1), 0.028, M["brass"]))
for z in (bz0 + 0.3, B["z"], bz1 - 0.3):
    L.append(rod("FootRailFoot", (bx0 - 0.2, 0.24, z), (bx0, 0.24, z), 0.02, M["brass"]))
for z in (B["z"] - 0.9, B["z"], B["z"] + 0.9):
    L.append(cyl("Porthole", 0.2, 0.04, g(bx0 - 0.02, 0.6, z), M["brass"], 18, rot=(0, PI / 2, 0)))
    L.append(cyl("PortholeGlass", 0.15, 0.02, g(bx0 - 0.04, 0.6, z), M["navy"], 18, rot=(0, PI / 2, 0)))
# the back bar: shelves of bottles before a mirror
L.append(lb("BackBar", bx1 - 0.45, bx1, 0.0, 1.0, bz0 + 0.3, bz1 - 0.3, M["mahogany"], 0.02))
L.append(lb("BackMirror", bx1 - 0.08, bx1 - 0.05, 1.0, 2.3, bz0 + 0.4, bz1 - 0.4, M["mirror"], 0.0))
for y in (1.3, 1.75):
    L.append(lb("Shelf", bx1 - 0.35, bx1 - 0.05, y - 0.03, y, bz0 + 0.4, bz1 - 0.4, M["glass"], 0.0))
    for k in range(11):
        z = bz0 + 0.55 + k * 0.2
        m = (M["bottle_g"], M["bottle_a"], M["bottle_c"], M["red"])[R.randrange(4)]
        h = R.uniform(0.24, 0.34)
        L.append(cyl("Bottle", 0.04, h, g(bx1 - 0.2, y, z), m, 8, r2=0.035))
        L.append(cyl("BottleNeck", 0.015, 0.08, g(bx1 - 0.2, y + h, z), m, 6))
L.append(face("Menu", 0.6, 0.84, bx1 - 0.1, 1.55, bz0 + 0.25, -PI / 2, signmat("bar_menu", 0.5)))
L.append(cyl("Shaker", 0.05, 0.22, g(bx1 - 0.3, 1.0, bz1 - 0.6), M["chrome"], 12, r2=0.04))
L.append(sphere("Pineapple", 0.11, g(bx1 - 0.3, 1.12, bz1 - 0.9), M["yellow"], 10, 8, scale=(1, 1, 1.35)))
for k in range(5):
    L.append(cyl("PineLeaf", 0.02, 0.18, g(bx1 - 0.3 + math.cos(k * 1.3) * 0.03, 1.25, bz1 - 0.9 + math.sin(k * 1.3) * 0.03), M["leaf"], 4, r2=0.0, rot=(math.cos(k) * 0.4, math.sin(k) * 0.4, 0)))
L.append(cyl("LimeBowl", 0.13, 0.08, g(bx0 + 0.2, 1.16, B["z"] + 0.95), M["white"], 14, r2=0.16))
for k in range(5):
    L.append(sphere("Lime", 0.045, g(bx0 + 0.2 + math.cos(k * 1.2) * 0.06, 1.25, B["z"] + 0.95 + math.sin(k * 1.2) * 0.06), M["lime"], 8, 6))
# glasses on the counter: margaritas with lime, a hurricane glass with an umbrella
for k, z in enumerate((B["z"] - 0.7, B["z"] - 0.3, B["z"] + 0.6)):
    L.append(cyl("GlassStem", 0.012, 0.1, g(bx0 + 0.18, 1.16, z), M["glass"], 6))
    L.append(cyl("GlassBowl", 0.025, 0.08, g(bx0 + 0.18, 1.26, z), M["ice"], 12, r2=0.075))
    L.append(cyl("Drink", 0.02, 0.06, g(bx0 + 0.18, 1.27, z), (M["lime"], M["pink"], M["orange"])[k], 10, r2=0.065))
    L.append(cyl("Umbrella", 0.003, 0.12, g(bx0 + 0.2, 1.3, z + 0.03), M["white"], 4))
    L.append(cyl("UmbrellaTop", 0.05, 0.02, g(bx0 + 0.2, 1.42, z + 0.03), (M["pink"], M["yellow"], M["teal"])[k], 8, r2=0.0))
# the ice swan melting on the counter's end, on a silver tray
sw_x, sw_z = bx0 + 0.2, bz1 - 0.2
L.append(cyl("Tray", 0.22, 0.02, g(sw_x, 1.16, sw_z), M["chrome"], 18))
L.append(sphere("SwanBody", 0.13, g(sw_x, 1.28, sw_z), M["ice"], 14, 8, scale=(1.5, 0.9, 0.8)))
L.append(tube("SwanNeck", [Vector(g(sw_x - 0.12, 1.3, sw_z)), Vector(g(sw_x - 0.2, 1.45, sw_z)), Vector(g(sw_x - 0.16, 1.58, sw_z)), Vector(g(sw_x - 0.22, 1.6, sw_z))], 0.03, M["ice"], 3, 8))
L.append(sphere("SwanWing", 0.1, g(sw_x + 0.02, 1.36, sw_z + 0.06), M["ice"], 10, 6, scale=(1.2, 0.5, 0.25)))
L.append(sphere("SwanWing", 0.1, g(sw_x + 0.02, 1.36, sw_z - 0.06), M["ice"], 10, 6, scale=(1.2, 0.5, 0.25)))
# the canopy: chrome posts, a striped canvas roof with a scalloped valance, The Lido Bar on its front
for x in (bx0 + 0.15, bx1 - 0.1):
    for z in (bz0 + 0.12, bz1 - 0.12):
        L.append(cyl("CanopyPost", 0.045, 2.7, g(x, 0, z), M["chrome"], 10))
L.append(lb("Canopy", bx0 - 0.3, bx1 + 0.2, 2.7, 2.82, bz0 - 0.3, bz1 + 0.3, M["canvas"], 0.03))
L.append(lb("CanopyCrown", bx0 + 0.3, bx1 - 0.3, 2.82, 3.02, bz0 + 0.2, bz1 - 0.2, M["canvas"], 0.08))
for z in np.arange(bz0 - 0.15, bz1 + 0.2, 0.42):
    L.append(cyl("Valance", 0.21, 0.03, g(bx0 - 0.3, 2.62, z), M["canvas"], 10, rot=(0, PI / 2, 0)))
L.append(lb("ValanceStrip", bx0 - 0.32, bx0 - 0.28, 2.6, 2.82, bz0 - 0.3, bz1 + 0.3, M["canvas"], 0.0))
L.append(face("BarSign", 2.6, 0.76, bx0 - 0.34, 3.15, B["z"], -PI / 2, signmat("lido_bar", 0.5)))
L.append(lb("BarSignBack", bx0 - 0.33, bx0 - 0.28, 2.77, 3.53, B["z"] - 1.32, B["z"] + 1.32, M["navy_dark"], 0.02))
# the kiosk's lamps under the canopy
for z in (bz0 + 0.4, bz1 - 0.4):
    L.append(cyl("Light_Kiosk", 0.09, 0.14, g(bx0 + 0.25, 2.5, z), M["kiosk"], 12, r2=0.12))
    L.append(rod("KioskCord", (bx0 + 0.25, 2.64, z), (bx0 + 0.25, 2.7, z), 0.01, M["black"]))
add("bar", *L)
# two stools before it (out of the coach's way at the bar's station)
for dz in (-1.25, 1.25):
    sx_, sz_ = B["x"] - B["hx"] - 0.18, B["z"] + dz
    add("bar", cyl("StoolSeat", 0.2, 0.08, g(sx_, 0.72, sz_), M["navy"], 16), cyl("StoolPole", 0.03, 0.72, g(sx_, 0, sz_), M["chrome"], 8), cyl("StoolFoot", 0.18, 0.03, g(sx_, 0, sz_), M["chrome"], 14), torus("StoolRing", 0.14, 0.012, g(sx_, 0.3, sz_), M["chrome"], 16, 4))
# a gull stealing a fry off the counter; a basket of fries; a towel monkey off the canopy's corner
add("bar", cyl("FryBasket", 0.1, 0.08, g(bx0 + 0.25, 1.16, B["z"] - 1.15), M["red"], 10, r2=0.12))
for k in range(7):
    add("bar", lb("Fry", bx0 + 0.2 + (k % 3) * 0.03, bx0 + 0.22 + (k % 3) * 0.03, 1.2, 1.3 + (k % 2) * 0.04, B["z"] - 1.18 + k * 0.01, B["z"] - 1.165 + k * 0.01, M["yellow"], 0.0))
add("bar", card("Gull", "gull_fry", 0.5, bx0 + 0.2, 1.16, B["z"] - 1.38, -PI / 2 - 0.4))
add("bar", card("TowelMonkey", "towel_monkey", 0.55, bx0 + 0.1, 2.1, bz1 + 0.05, -PI / 2))
add("bar", card("Gull", "gull_squawk", 0.45, B["x"], 3.02, bz0 + 0.6, -PI / 2 + 0.5))

# ================================================================================================================================
# THE HOT TUB (its water and bubbles the game's, at 0.5 m)
# ================================================================================================================================
T = TUBS[0]
tx, tz, tr = T["x"], T["z"], T["r"]
H = []
# (hollow: its floor at 0.46, under the game's water at 0.5)
H.append(trees.lathe("TubStaves", [(tr, 0.0), (tr, 0.55), (tr - 0.1, 0.55), (tr - 0.1, 0.46), (0.01, 0.46)], 40, M["teak"], g(tx, 0, tz)))
H.append(torus("TubRim", tr - 0.04, 0.07, g(tx, 0.58, tz), M["white"], 48, 8))
for k in range(2):
    H.append(torus("TubHoop", tr + 0.005, 0.02, g(tx, 0.12 + k * 0.32, tz), M["brass"], 48, 5))
for k, y in enumerate((0.18, 0.36)):
    H.append(lb("TubStep", tx - tr - 0.35 + k * 0.12, tx - tr + 0.05, 0.0, y, tz - 0.45, tz + 0.45, M["teak"], 0.02))
H.append(tube("TubRail", [Vector(g(tx - tr - 0.25, 0.0, tz + 0.55)), Vector(g(tx - tr - 0.2, 0.95, tz + 0.55)), Vector(g(tx - tr + 0.15, 1.0, tz + 0.55)), Vector(g(tx - tr + 0.3, 0.6, tz + 0.55))], 0.025, M["chrome"], 3, 8))
# HOT TUB on a post; towels with a towel octopus; a champagne bucket; a rubber duck on the rim
H.append(cyl("TubSignPost", 0.035, 1.6, g(tx + 1.0, 0, tz + 1.2), M["chrome"], 8))
H.append(face("TubSign", 0.9, 0.42, tx + 1.0, 1.75, tz + 1.24, -PI / 2 - 0.6, signmat("hot_tub", 0.5)))
for k in range(4):
    H.append(lb("TubTowel", tx + 0.7, tx + 1.15, 0.0 + k * 0.1, 0.1 + k * 0.1, tz - 1.35, tz - 1.0, (M["towel"], M["navy"])[k % 2], 0.03))
H.append(card("TowelOctopus", "towel_octopus", 0.35, tx + 0.92, 0.4, tz - 1.18, -PI / 2))
H.append(cyl("Bucket", 0.12, 0.25, g(tx - 0.6, 0.6, tz - tr + 0.08), M["chrome"], 14, r2=0.14))
H.append(cyl("Champagne", 0.04, 0.32, g(tx - 0.6, 0.7, tz - tr + 0.08), M["bottle_g"], 10, r2=0.03))
H.append(cyl("ChampagneFoil", 0.022, 0.06, g(tx - 0.6, 1.02, tz - tr + 0.08), M["gold"], 8))
H.append(sphere("Duck", 0.07, g(tx + 0.3, 0.68, tz + tr - 0.06), M["yellow"], 10, 6, scale=(1.3, 1, 0.9)))
H.append(sphere("DuckHead", 0.045, g(tx + 0.38, 0.77, tz + tr - 0.06), M["yellow"], 8, 6))
H.append(lb("DuckBeak", tx + 0.42, tx + 0.47, 0.76, 0.78, tz + tr - 0.075, tz + tr - 0.045, M["orange"], 0.0))
add("tub", *H)

# ================================================================================================================================
# THE STATIONS
# ================================================================================================================================
S = STATIONS
# WATER CARE: a white marine locker, its front to the pool (+x)
W_ = []
W_.append(lb("Locker", -0.8, 0.8, 0.0, 1.12, -0.5, 0.42, M["paint"], 0.04))
for x in (-0.4, 0.4):
    W_.append(lb("LockerDoor", x - 0.36, x + 0.36, 0.1, 1.0, 0.42, 0.45, M["navy"], 0.02))
    W_.append(cyl("LockerPort", 0.11, 0.02, g(x, 0.75, 0.45), M["brass"], 14, rot=(PI / 2, 0, 0)))
    W_.append(rod("LockerHandle", (x - 0.2, 0.45, 0.48), (x - 0.2, 0.62, 0.48), 0.015, M["brass"]))
W_.append(lb("LockerTop", -0.84, 0.84, 1.12, 1.16, -0.54, 0.48, M["teak_s"], 0.02))
for k, x in enumerate((-0.55, -0.2)):
    W_.append(lb("Jerrycan", x - 0.13, x + 0.13, 1.16, 1.52, -0.2, 0.1, M["yellow"], 0.04))
    W_.append(cyl("JerryCap", 0.03, 0.05, g(x + 0.07, 1.52, -0.12), M["red"], 8))
W_.append(cyl("Pump", 0.08, 0.3, g(0.45, 1.16, -0.1), M["brass"], 12))
W_.append(cyl("Gauge", 0.08, 0.03, g(0.45, 1.36, -0.02), M["white"], 14, rot=(PI / 2, 0, 0)))
W_.append(rod("PumpHandle", (0.45, 1.46, -0.1), (0.7, 1.55, -0.1), 0.015, M["brass"]))
W_.append(lb("TestKit", 0.2, 0.35, 1.16, 1.22, 0.15, 0.35, M["white"], 0.01))
W_ += board_on_posts("WaterBoard", 1.4, 0.0, 1.6, "water_care", 0.58, M["navy"])
add("stations", yawed(W_, S["chlorine"]["x"], S["chlorine"]["z"], TO_PX, "WaterCare"))
# EYE CARE: an enamel eyewash fountain, a porthole mirror, towels; its front to the pool (-z)
E = []
E.append(cyl("FountainFoot", 0.28, 0.08, g(0, 0, 0), M["navy"], 18))
E.append(cyl("FountainPost", 0.12, 0.95, g(0, 0.08, 0), M["white"], 16, r2=0.09))
E.append(cyl("FountainBowl", 0.2, 0.14, g(0, 1.0, 0), M["chrome"], 20, r2=0.32))
for dx in (-0.08, 0.08):
    E.append(cyl("Nozzle", 0.025, 0.08, g(dx, 1.04, 0), M["brass"], 8))
E.append(rod("PushBar", (-0.3, 0.95, 0.3), (0.3, 0.95, 0.3), 0.02, M["chrome"]))
for x in (-0.6, 0.6):
    E.append(cyl("TowelPost", 0.025, 1.1, g(x, 0, -0.25), M["chrome"], 8))
E.append(rod("TowelBar", (-0.6, 1.05, -0.25), (0.6, 1.05, -0.25), 0.02, M["chrome"]))
for k, x in enumerate((-0.38, 0.0, 0.38)):
    E.append(lb("EyeTowel", x - 0.15, x + 0.15, 0.7, 1.08, -0.28, -0.22, (M["towel"], M["sky"], M["towel"])[k], 0.02))
E.append(cyl("Mirror", 0.3, 0.04, g(0.0, 1.75, -0.32), M["brass"], 22, rot=(PI / 2, 0, 0)))
E.append(cyl("MirrorGlass", 0.24, 0.02, g(0.0, 1.75, -0.29), M["mirror"], 22, rot=(PI / 2, 0, 0)))
E.append(cyl("MirrorPost", 0.03, 1.5, g(0, 0, -0.34), M["chrome"], 8))
E += [o for o in board_on_posts("EyeBoard", 1.5, 0.0, 2.2, "eye_care", 0.62, M["teal"]) if "Sign" in o.name]
add("stations", yawed(E, S["relief"]["x"], S["relief"]["z"], TO_MZ, "EyeCare"))

# THE FIN RACK: navy posts, a teak shelf, FIN RENTAL both ways; the pairs the model's own (Fins_1..3, where the game's are)
FR = S["fins"]
rk = []
for x in (-0.85, 0.85):
    rk.append(lb("RackPost", x - 0.055, x + 0.055, 0.0, 1.72, -0.065, 0.065, M["navy"], 0.02))
    rk.append(lb("RackFoot", x - 0.25, x + 0.25, 0.0, 0.12, -0.42, 0.42, M["navy"], 0.02))
rk.append(lb("RackBar", -0.93, 0.93, 1.59, 1.71, -0.1, 0.1, M["navy"], 0.02))
rk.append(lb("RackShelf", -0.85, 0.85, 0.48, 0.6, -0.4, 0.4, M["teak_s"], 0.02))
for th in (0.0, PI):
    rk.append(face("FinSign", 1.72, 0.42, 0, 2.0, 0.1 * (1 if th == 0 else -1), th, signmat("fin_rental", 0.5)))
# (the game's rack turns its front (local +z) to -x: game.finRack's angle -π/2)
add("stations", yawed(rk, FR["x"], FR["z"], TO_MX, "FinRack"))
for i in range(3):
    pair = []
    for dx in (-0.14, 0.14):
        f = lb("Fin", dx - 0.11, dx + 0.11, -0.255, 0.255, -0.04, 0.04, M["yellow"], 0.03)
        f.rotation_euler = (0, -0.06 if dx > 0 else 0.06, 0)
        apply_all(f)
        pair.append(f)
        pair.append(lb("FinStrap", dx - 0.07, dx + 0.07, 0.07, 0.23, -0.04, 0.07, M["teal"], 0.02))
    # (the game's pair: at the rack's (-0.57 + 0.57 i, 0.82, -0.05), tipped 0.2 back; the rack turned -π/2)
    tilted = yawed(pair, 0.0, 0.0, 0.0, f"Fins_{i + 1}")
    tilted.rotation_euler = (-0.2, 0, 0)
    apply_all(tilted)
    add("fins", yawed([tilted], FR["x"] + 0.05, FR["z"] + (-0.57 + 0.57 * i), TO_MX, f"Fins_{i + 1}", y=0.82))

# THE RESCUE BENCH: teak slats on chrome frames along z, facing the pool (+x); a towel turtle on it
RB = RESCUE["bench"]
bz_c = RB["z"] - 0.6
bn = []
for z in (-1.15, 1.15):
    bn.append(lb("BenchFrame", -0.3, 0.3, 0.0, 0.44, z - 0.03, z + 0.03, M["chrome"], 0.01))
    bn.append(lb("BenchBackFrame", -0.32, -0.26, 0.44, 0.95, z - 0.03, z + 0.03, M["chrome"], 0.01))
for k in range(4):
    bn.append(lb("BenchSlat", -0.28 + k * 0.15, -0.16 + k * 0.15, 0.44, 0.48, -1.25, 1.25, M["teak_s"], 0.01))
for k in range(2):
    bn.append(lb("BenchBack", -0.33, -0.29, 0.62 + k * 0.18, 0.74 + k * 0.18, -1.25, 1.25, M["teak_s"], 0.01))
bn.append(lb("BenchTowel", -0.25, 0.25, 0.48, 0.5, -0.9, -0.3, M["navy"], 0.01))
bench = yawed(bn, RB["x"], bz_c, 0.0, "RescueBench")
add("furniture", bench, card("TowelTurtle", "towel_turtle", 0.24, RB["x"] + 0.05, 0.48, bz_c + 0.8, -PI / 2))

# THE FIRST AID LOCKER: the game's kit on its shelf (0.95 m, at x - 0.1)
MK = FIXTURES["medkit"]
mk = []
mk.append(lb("AidBack", -0.55, -0.3, 0.0, 2.0, -0.68, 0.68, M["paint"], 0.03))
for z in (-0.68, 0.68):
    mk.append(lb("AidSide", -0.55, 0.2, 0.0, 2.0, z - 0.03, z + 0.03, M["white"], 0.01))
mk.append(lb("AidShelf", -0.3, 0.2, 0.7, 0.76, -0.65, 0.65, M["white"], 0.01))
mk.append(lb("AidRoof", -0.58, 0.25, 2.0, 2.06, -0.72, 0.72, M["red"], 0.01))
mk.append(face("AidSign", 1.36, 0.55, -0.29, 1.55, 0.0, PI / 2, signmat("first_aid", 0.5)))
mk.append(cyl("Pills", 0.06, 0.16, g(-0.15, 0.76, -0.45), M["glass"], 10))
mk.append(cyl("PillsLid", 0.065, 0.03, g(-0.15, 0.92, -0.45), M["green"], 10))
add("furniture", yawed(mk, MK["x"], MK["z"], 0.0, "FirstAid"))

# THE SKIMMER'S BOARD on the stern rail, its face to the deck (+x); THE WASTE BIN
SN = SANITATION
sk = board_on_posts("SkimBoard", 3.9, 1.25, 1.12, "skimmer", 0.45, M["navy"])
add("furniture", yawed(sk, DECK["minX"] - 0.32, SN["rack"]["z"], TO_PX, "SkimmerBoard"))
WB = SN["bin"]
wb = [
    cyl("BinBody", 0.55, 1.15, g(0, 0, 0), M["navy"], 24, r2=0.6),
    torus("BinBand", 0.585, 0.025, g(0, 0.9, 0), M["brass"], 28, 5),
    cyl("BinLid", 0.63, 0.08, g(0, 1.15, 0), M["chrome"], 24),
    sphere("BinKnob", 0.06, g(0, 1.26, 0), M["brass"], 10, 6),
    face("BinSign", 0.62, 0.26, -0.56, 0.6, 0, -PI / 2, signmat("waste", 0.5)),
]
add("furniture", yawed(wb, WB["x"], WB["z"], 0.0, "WasteBin"))

# THE LIFE RINGS' BOARDS: navy enamel with a brass rim, LIFE RING over; the rings the game's (LifeRing places)
for m in RING_MOUNTS:
    rb = board_on_posts("RingBoard", 1.5, 2.15, 0.35, "life_ring", 0.42, M["navy"])
    rb.append(rod("RingPeg", (0, 2.3, -0.05), (0, 2.3, 0.12), 0.04, M["brass"]))
    # (the board stands 0.18 behind the ring's place, as the classic mount does)
    for q in rb:
        q.location.y += 0.18  # (Blender's +y is the game's -z: back)
    o = yawed(rb, m["x"], m["z"], m["angle"], "RingBoard")
    add("furniture", o, sphere("LifeRing", 0.1, g(m["x"], 1.65, m["z"]), M["red"], 8, 6))
# THE FISH NET'S BOARD (the game's net on its hooks)
FN = FIXTURES["fishNet"]
fb = board_on_posts("NetBoard", 1.4, 2.8, 0.05, "fish_net", 0.4, M["navy"])
for q in fb:
    q.location.y += 0.18
add("furniture", yawed(fb, FN["x"], FN["z"], FN["angle"], "NetBoard"))
# THE TORCH on a ship's binnacle (the game's torch at 1.24 m)
FL = FIXTURES["flashlight"]
bi = [
    cyl("BinnacleFoot", 0.3, 0.1, g(0, 0, 0), M["navy"], 18),
    cyl("Binnacle", 0.2, 0.95, g(0, 0.1, 0), M["teak_s"], 16, r2=0.16),
    sphere("BinnacleDome", 0.2, g(0, 1.08, 0), M["brass"], 16, 10, scale=(1, 1, 0.6)),
    cyl("BinnacleRing", 0.21, 0.04, g(0, 1.05, 0), M["brass"], 18),
]
for s in (-1, 1):
    bi.append(sphere("Corrector", 0.08, g(s * 0.28, 1.0, 0), M["red" if s < 0 else "green"], 10, 6))
    bi.append(rod("CorrectorArm", (s * 0.15, 1.0, 0), (s * 0.24, 1.0, 0), 0.015, M["brass"]))
add("furniture", yawed(bi, FL["x"], FL["z"], 0.0, "Binnacle"), cyl("Flashlight", 0.06, 0.3, g(FL["x"], 1.09, FL["z"]), M["yellow"], 10))  # (its centre at 1.24, where the game puts the torch)
# THE DOG TREATS' TABLE: a white café table, the jar of bones, its sign
TR_ = FIXTURES["treats"]
tt = [
    cyl("TreatFoot", 0.26, 0.04, g(0, 0, 0), M["navy"], 16),
    cyl("TreatPole", 0.04, 0.74, g(0, 0.04, 0), M["chrome"], 8),
    cyl("TreatTop", 0.36, 0.05, g(0, 0.76, 0), M["white"], 22),
    cyl("Jar", 0.18, 0.36, g(0, 0.81, 0), M["glass"], 16),
    cyl("JarLid", 0.19, 0.06, g(0, 1.17, 0), M["red"], 16),
]
for k in range(5):
    tt.append(lb("Bone", -0.07, 0.07, 0.86 + k * 0.06, 0.89 + k * 0.06, -0.02 + 0.01 * k, 0.02 + 0.01 * k, M["cream"], 0.01))
tt.append(cyl("DogBowl", 0.16, 0.08, g(0.0, 0.0, 0.5), M["red"], 16, r2=0.19))
tt += [o for o in board_on_posts("TreatBoard", 0.9, 0.0, 1.35, "treats", 0.36, M["navy"]) if "Sign" in o.name]
add("furniture", yawed(tt, TR_["x"], TR_["z"], TO_MZ, "Treats"))

# ================================================================================================================================
# THE REST OF THE FURNITURE
# ================================================================================================================================
for f in furniture("lifejacket-box"):
    face_to = TO_MZ if f["z"] > 0 else TO_PZ
    lj = [
        lb("Chest", -0.72, 0.72, 0.0, 0.7, -0.42, 0.42, M["white_matte"], 0.06),
        lb("ChestLid", -0.75, 0.75, 0.7, 0.82, -0.45, 0.45, M["navy"], 0.05),
        face("ChestSign", 1.3, 0.34, 0, 0.42, 0.425, 0.0, signmat("lifejackets", 0.5)),
        lb("JacketPeek", -0.3, 0.1, 0.62, 0.86, 0.3, 0.46, M["orange"], 0.03),
    ]
    for x in (-0.6, 0.6):
        lj.append(rod("ChestHandle", (x, 0.5, 0.43), (x, 0.5, 0.47), 0.02, M["chrome"]))
    add("furniture", yawed(lj, f["x"], f["z"], face_to, "LifejacketChest"))
    if f["z"] > 0:
        add("furniture", card("TowelCrab", "towel_crab", 0.25, f["x"] - 0.2, 0.82, f["z"], -PI / 2))
for f in furniture("towel-cart"):
    tc = []
    for x in (-0.55, 0.55):
        for z in (-0.35, 0.35):
            tc.append(cyl("CartPost", 0.02, 1.05, g(x, 0, z), M["chrome"], 8))
            tc.append(sphere("Caster", 0.05, g(x, 0.05, z), M["black"], 8, 6))
    for y in (0.15, 0.55, 0.95):
        tc.append(lb("CartShelf", -0.58, 0.58, y, y + 0.03, -0.38, 0.38, M["chrome"], 0.01))
    for y in (0.18, 0.58):
        for k in range(5):
            z = -0.28 + k * 0.14
            tc.append(cyl("RolledTowel", 0.065, 1.0, g(-0.5, y + 0.07, z), M["towel"] if k % 2 else M["navy"], 10, rot=(0, PI / 2, 0)))
    tc.append(face("CartSign", 1.1, 0.29, -0.6, 1.2, 0, -PI / 2, signmat("towels", 0.5)))
    add("furniture", yawed(tc, f["x"], f["z"], 0.0, "TowelCart"))
    add("furniture", card("TowelElephant", "towel_elephant", 0.42, f["x"], 0.98, f["z"] - 0.18, -PI / 2), card("TowelSwan", "towel_swan", 0.36, f["x"], 0.98, f["z"] + 0.22, -PI / 2))
for k, f in enumerate(furniture("palm")):
    pl = [
        lb("Planter", -0.5, 0.5, 0.0, 0.8, -0.5, 0.5, M["white"], 0.06),
        lb("PlanterBand", -0.52, 0.52, 0.6, 0.68, -0.52, 0.52, M["navy"], 0.02),
        lb("PlanterRim", -0.53, 0.53, 0.78, 0.84, -0.53, 0.53, M["brass"], 0.02),
        lb("PlanterSoil", -0.46, 0.46, 0.8, 0.82, -0.46, 0.46, M["soil"], 0.0),
    ]
    add("furniture", yawed(pl, f["x"], f["z"], 0.0, "Planter"), *palm(f["x"], f["z"], 3.2 + k * 0.3, 900 + k, y0=0.82, lean=0.08, light=False))
# furled umbrellas in deck sockets between the loungers' pairs (on the heads' side), as the classic has
for row in ROWS:
    homes = row["homes"]
    for i in range(0, len(homes), 2):
        z = (homes[i] + homes[i + 1]) / 2
        x = row["x"] - row["facing"] * 1.15
        add("umbrellas",
            cyl("UmbrellaPole", 0.03, 2.5, g(x, 0, z), M["teak_s"], 8),
            cyl("UmbrellaFurl", 0.05, 1.3, g(x, 1.1, z), M["canvas"], 10, r2=0.16),
            cyl("UmbrellaTop", 0.16, 0.2, g(x, 2.4, z), M["canvas"], 10, r2=0.02),
            torus("UmbrellaTie", 0.12, 0.015, g(x, 1.75, z), M["navy"], 12, 4),
            sphere("UmbrellaFinial", 0.04, g(x, 2.62, z), M["brass"], 8, 6),
            cyl("UmbrellaSocket", 0.13, 0.03, g(x, 0, z), M["chrome"], 14))

# ================================================================================================================================
# THE STORIES AT THE EDGE OF PLAY
# ================================================================================================================================
WALK = 15.92  # the walks' outer line, against the windscreens
# the port walk: the programme, the rules, SEAGULL CROSSING with its gull, the shuffleboard's cue rack, potted palms
add("edges", yawed(board_on_posts("Programme", 0.86, 1.2, 0.5, None, 0.0, M["white"]) + [face("ProgrammeFace", 0.82, 1.14, 0, 1.1, 0.002, 0.0, signmat("programme", 0.5))], 4.6, -WALK, TO_PZ, "Programme"))
add("edges", yawed(board_on_posts("Rules", 0.76, 1.02, 0.6, None, 0.0, M["white"]) + [face("RulesFace", 0.72, 0.97, 0, 1.11, 0.002, 0.0, signmat("rules", 0.5))], -1.2, -WALK, TO_PZ, "Rules"))
add("edges", yawed([cyl("CrossPost", 0.035, 2.0, g(0, 0, -0.06), M["chrome"], 8), face("Crossing", 0.6, 0.75, 0, 1.6, 0.0, 0.0, signmat("gull_crossing", 0.5))], -7.4, -WALK, TO_PZ, "GullCrossing"))
add("edges", card("Gull", "gull_squawk", 0.42, -6.8, 1.26, -16.2, 0.4))
cr = [lb("CueRack", -0.5, 0.5, 0.0, 1.1, -0.08, 0.0, M["teak_s"], 0.02)]
for k in range(4):
    cr.append(rod("Cue", (-0.36 + k * 0.24, 0.1, 0.06), (-0.36 + k * 0.24, 1.55, 0.04), 0.018, M["teak_dark"]))
    cr.append(lb("CueHead", -0.36 + k * 0.24 - 0.09, -0.36 + k * 0.24 + 0.09, 0.05, 0.12, 0.02, 0.12, M["chrome"], 0.01))
cr.append(face("CupSign", 1.0, 0.36, 0, 1.3, 0.005, 0.0, signmat("captains_cup", 0.5)))
add("edges", yawed(cr, 7.5, -WALK, TO_PZ, "CueRack"))
for k, (x, z) in enumerate(((5.6, -12.1), (6.3, -11.6), (11.2, -12.3), (11.6, -11.8))):
    add("edges", cyl("Puck", 0.08, 0.025, g(x, 0.0, z), M["red"] if k % 2 else M["navy"], 14))
for x in (-8.2, 8.2):
    add("edges", cyl("Pot", 0.28, 0.5, g(x, 0, -WALK + 0.05), M["white"], 16, r2=0.32), cyl("PotBand", 0.325, 0.06, g(x, 0.4, -WALK + 0.05), M["navy"], 16))
    # (a clipped bay ball in each: low and round, off the deck)
    add("edges", trees.blob("BayBall", g(x, 0.88, -WALK + 0.05), (0.36, 0.36, 0.34), M["leaf_dark"], 960 + int(x), (10, 6), 0.12))
# the starboard walk: CAPTAIN FOR A DAY with a smug gull on it, LOST & FOUND and its basket, WET DECK, a flamingo
po = [lb("PhotoBack", -1.35, 1.35, 0.3, 0.32, -0.04, -0.02, M["teak_dark"], 0.0)]
for x in (-1.1, 1.1):
    po.append(lb("PhotoLeg", x - 0.05, x + 0.05, 0.0, 0.5, -0.12, -0.02, M["teak_dark"], 0.01))
    po.append(lb("PhotoFoot", x - 0.08, x + 0.08, 0.0, 0.05, -0.4, 0.15, M["teak_dark"], 0.01))
po.append(card("PhotoBoard", "photoop", 1.94, 0.0, 0.3, 0.0, 0.0))
add("edges", yawed(po, 10.4, WALK - 0.1, TO_MZ, "PhotoOp"))
add("edges", card("Gull", "gull_smug", 0.42, 11.2, 0.3 + 2.6 / (2400 / 1792) - 0.08, WALK - 0.1, PI + 0.3))
add("edges", plane("PhotoHere", 1.6, 0.33, g(10.4, 0.006, WALK - 0.75), signmat("photo_here", 0.5), rot=(0, 0, PI)))
add("edges", yawed(board_on_posts("LostFound", 0.84, 1.0, 0.7, None, 0.0, M["cream"]) + [face("LostFace", 0.8, 0.95, 0, 1.2, 0.002, 0.0, signmat("lost_found", 0.5))], -7.8, WALK, TO_MZ, "LostFound"))
add("edges", cyl("Basket", 0.3, 0.3, g(-7.1, 0, WALK - 0.15), M["wicker"], 14, r2=0.34))
add("edges", cyl("SunHat", 0.24, 0.03, g(-7.1, 0.32, WALK - 0.15), M["cream"], 16), cyl("SunHatCrown", 0.11, 0.08, g(-7.1, 0.35, WALK - 0.15), M["cream"], 12), torus("SunHatBand", 0.11, 0.012, g(-7.1, 0.37, WALK - 0.15), M["pink"], 12, 4))
add("edges", lb("FlipFlop", -7.55, -7.45, 0.0, 0.03, WALK - 0.4, WALK - 0.15, M["teal"], 0.01))
wd = [lb("WetBoardA", -0.3, 0.3, 0.0, 0.8, -0.18, -0.15, M["yellow"], 0.01), lb("WetBoardB", -0.3, 0.3, 0.0, 0.8, 0.15, 0.18, M["yellow"], 0.01)]
wd.append(face("WetSign", 0.5, 0.67, 0, 0.42, 0.185, 0.0, signmat("wet_deck", 0.5)))
add("edges", yawed(wd, 0.8, WALK - 0.1, TO_MZ, "WetDeck"))
# the café's front at the bow: Captain Barnacle and the travel poster in brass frames; the judges' table; the telegraph; toys
for (z, nm, w, h, plate) in ((-5.6, "captain", 1.5, 2.0, True), (5.6, "poster", 1.2, 1.6, False)):
    fr = [lb("Frame", -w / 2 - 0.1, w / 2 + 0.1, -h / 2 - 0.1, h / 2 + 0.1, -0.06, 0.0, M["gold"], 0.03), face(nm.title(), w, h, 0, 0, 0.005, 0.0, signmat(nm, 0.4))]
    if plate:
        fr.append(face("CaptainPlate", 1.0, 0.25, 0, -h / 2 - 0.3, 0.005, 0.0, signmat("captain_plate", 0.4)))
        fr.append(cyl("PictureLight", 0.03, w * 0.7, g(-w * 0.35, h / 2 + 0.2, 0.1), M["brass"], 8, rot=(0, PI / 2, 0)))
    add("edges", yawed(fr, BOW - 0.14, z, TO_MX, "Picture_" + nm, y=2.05))
jt = [lb("JudgeTable", -0.3, 0.3, 0.72, 0.78, -0.75, 0.75, M["white"], 0.02), lb("JudgeSkirt", -0.29, 0.29, 0.2, 0.72, -0.74, 0.74, M["navy"], 0.0)]
jt.append(face("Scorecards", 0.9, 0.35, -0.1, 0.96, 0.0, -PI / 2, signmat("scorecards", 0.5)))
jt += [cyl("TrophyFoot", 0.08, 0.08, g(0.05, 0.78, 0.5), M["navy"], 12), cyl("TrophyCup", 0.05, 0.22, g(0.05, 0.86, 0.5), M["gold"], 14, r2=0.13)]
for s in (-1, 1):
    jt.append(torus("TrophyHandle", 0.06, 0.012, g(0.05, 1.0, 0.5 + s * 0.13), M["gold"], 12, 4, rot=(PI / 2, 0, 0)))
jt.append(cyl("Megaphone", 0.04, 0.3, g(0.05, 0.85, -0.5), M["red"], 12, r2=0.12, rot=(0, -PI / 2, 0)))
add("edges", yawed(jt, 17.2, -7.0, 0.0, "JudgesTable"))
te = [cyl("TeleFoot", 0.22, 0.08, g(0, 0, 0), M["brass"], 16), cyl("TelePost", 0.1, 0.95, g(0, 0.08, 0), M["brass"], 14, r2=0.08), cyl("TeleHead", 0.24, 0.16, g(0, 1.18, -0.08), M["brass"], 22, rot=(PI / 2, 0, 0))]
te.append(plane("TeleDial", 0.4, 0.4, g(0, 1.18, 0.005 + 0.08), signmat("telegraph", 0.4), rot=(PI / 2, 0, 0)))
te.append(rod("TeleLever", (0, 1.18, 0.12), (0.18, 1.36, 0.14), 0.02, M["brass"]))
te.append(sphere("TeleKnob", 0.04, g(0.18, 1.36, 0.14), M["black"], 8, 6))
add("edges", yawed(te, 17.25, 9.2, TO_MX, "Telegraph"))
tb = [cyl("ToyBasket", 0.4, 0.5, g(0, 0, 0), M["wicker"], 16, r2=0.45)]
for k, c in enumerate(("red", "yellow", "sky")):
    tb.append(sphere("Ball", 0.2, g(math.cos(k * 2.1) * 0.15, 0.55, math.sin(k * 2.1) * 0.15), M[c], 12, 8))
tb.append(torus("Noodle", 0.25, 0.04, g(0.0, 0.62, 0.0), M["lime"], 16, 6, rot=(0.6, 0, 0)))
add("edges", yawed(tb, 17.15, 12.2, 0.0, "ToyBasket"))
fl = [torus("Flamingo", 0.42, 0.14, g(0, 0.55, 0.0), M["pink"], 22, 8, rot=(PI / 2, 0, 0))]
fl.append(tube("FlamingoNeck", [Vector(g(0, 0.95, 0)), Vector(g(0.05, 1.3, 0)), Vector(g(0.15, 1.55, 0)), Vector(g(0.3, 1.55, 0))], 0.06, M["pink"], 3, 8))
fl.append(sphere("FlamingoHead", 0.09, g(0.32, 1.55, 0), M["pink"], 10, 6))
fl.append(cyl("FlamingoBeak", 0.04, 0.12, g(0.4, 1.53, 0), M["black"], 8, r2=0.01, rot=(0, PI / 2, 0)))
add("edges", yawed(fl, 17.3, 13.6, TO_MX, "Flamingo"))
# aft on the stern's strip: the deck plan, YOU ARE HERE; two ventilator cowls on the lower deck; decorative life rings
dp = [lb("PlanFrame", -0.85, 0.85, 0.95, 2.2, -0.05, 0.0, M["brass"], 0.02), face("DeckPlan", 1.6, 1.2, 0, 1.575, 0.005, 0.0, signmat("deckplan", 0.4))]
for x in (-0.7, 0.7):
    dp.append(cyl("PlanPost", 0.035, 2.2, g(x, 0, -0.08), M["chrome"], 8))
add("edges", yawed(dp, DECK["minX"] - 0.3, -12.6, TO_PX, "DeckPlan"))
for s in (-1, 1):
    vx, vz = STERN - 4.2, s * 12.5
    add("edges", cyl("Vent", 0.4, 2.2, g(vx, -3.2, vz), M["white"], 18), torus("VentLip", 0.55, 0.12, g(vx + 0.35, -0.6, vz), M["white"], 22, 8, rot=(0, PI / 2, 0)), cyl("VentMouth", 0.5, 0.05, g(vx + 0.33, -0.6, vz), M["red"], 20, rot=(0, PI / 2, 0)), sphere("VentElbow", 0.42, g(vx, -1.0, vz), M["white"], 16, 10))
for z in (-6.0, 6.0):
    add("edges", torus("DecoRing", 0.34, 0.09, g(STERN - 0.24, 0.75, z), M["orange"], 24, 8, rot=(0, PI / 2, 0)))
    for k in range(4):
        add("edges", lb("DecoRingBand", STERN - 0.36, STERN - 0.12, 0.7 + 0.34 * math.sin(k * PI / 2) - 0.05, 0.7 + 0.34 * math.sin(k * PI / 2) + 0.15, z + 0.34 * math.cos(k * PI / 2) - 0.06, z + 0.34 * math.cos(k * PI / 2) + 0.06, M["white"], 0.02))
# seagulls where a seagull would be: on the festoon posts, a lobby's roof, a davit, the funnel house
for (gull, x, y, z, th) in (
    ("gull_asleep", 0.7, 3.78, -16.15, 0.2),
    ("gull_shades", 8.7, 3.78, 16.15, -0.3 + PI),
    ("gull_shades", -11.0, 3.12, -14.0, -PI / 2),
    ("gull_brolly", 11.4, 3.12, -14.4, -PI / 2 + 0.6),
    ("gull_smug", 8.6, -4.6, 18.35, -PI / 2),
    ("gull_asleep", BOW + 7.0, 16.45, 6.0, -PI / 2),
):
    add("gulls", card("Gull", gull, 0.45, x, y, z, th))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("deck_bar", g(B["x"], 1.4, B["z"]), 7, 18, 250, (1280, 720), 16, 35)
    look("deck_tub", g(tx, 0.6, tz), 6, 25, 230, (1280, 720), 16, 35)
    look("deck_stations", g(-12.0, 1.0, 11.0), 7, 18, 250, (1280, 720), 16, 35)
    look("deck_fins", g(-13.0, 1.0, -10.0), 6, 15, 270, (1280, 720), 16, 35)
    look("deck_star", g(2.0, 1.2, 15.0), 12, 12, 200, (1280, 720), 16, 35)
    look("deck_port", g(2.0, 1.2, -15.0), 12, 12, 340, (1280, 720), 16, 35)
    look("deck_bow", g(17.0, 1.5, 0.0), 12, 12, 270, (1280, 720), 16, 35)
save_part("deck", [o for v in parts.values() for o in v if o])
