"""The Cruise Ship's ground, in game coordinates (the ship's frame: the game rolls the whole of it) from the game's own plan
(kit.PLAN):
- the deck: honey teak with black caulking fore and aft (fal), cut round the pool; the walks along both rails in blue-grey
  non-skid with a yellow safety line;
- the pool across the deck: iridescent glass mosaic (fal), its lane half deep with two navy lane lines and their T's, its free half
  shallower with a bench step along the far wall and the kraken on its floor (fal: a mosaic in a captain's hat hugging an anchor);
  a deco band of navy and gold under the coping, underwater lamps, white coping with a navy inlay, two starting blocks, chrome
  ladders, the depth plates;
- the rails: glass windscreens on white steel bulwarks with a teak cap rail and chrome posts, both sides and across the stern;
- the ship falling away under the deck: its white sides with rows of balconies (fal) down to the sea, a white sheer strake, the
  navy band at the waterline; aft, the lower deck (13) the stern drops to, the Lido's aft windows over it;
- the two stairway lobbies at the left end: glass deckhouses on white steel, a deco roof with a navy fascia, stairs going down,
  STAIRS over the doorway (the sliding glass leaves are the game's);
- `floor.glb`: the deck's paint: LIDO DECK 14, the shuffleboard court, NO DIVING by the coping, the wet ring round the pool and
  the slosh's spill at its ends, scuffs on the walk from the lobbies, cocktail rings by the bar, the yellow lines on the walks.

    blender -b -P tools/venues/cruise/shell.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(1931)
M = dict(
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    paint=tmat_tile("paint", "#f1f3f4", 0.4),
    nonskid=tmat_tile("nonskid", "#a9bac5", 0.9),
    mosaic=tmat_tile("mosaic", "#2f9fd6", 0.2),
    hull=tmat_tile("hullside", "#f3f5f6", 0.45),
    facade=tmat_tile("facade", "#dfe8ee", 0.3),
    white=sm("white"),
    navy=sm("navy"),
    navy_dark=sm("navy_dark"),
    gold=sm("gold"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    teak_cap=sm("teak"),
    yellow=sm("yellow"),
    rubber=sm("rubber"),
    glass=sm("glass"),
    kraken=cutmat("kraken", 0.3),
    pool_lamp=lamp_mat("pool_lamp", "#bff6ff", 3.0),
)
parts, floor = [], []


def P_(*objs):
    parts.extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def face(name, w, h, x, y, z, theta, m):
    """A plane w × h centred at (x, y, z) facing the game's (sin θ, cos θ)."""
    return plane(name, w, h, g(x, y, z), m, rot=(PI / 2, 0, theta))


# ================================================================================================================================
# THE DECK: teak cut round the pool, non-skid walks along the rails
# ================================================================================================================================
TZ = 15.45  # the teak's edge; the walks beyond it to the bulwarks
BZ = 16.25  # the bulwarks' inner face
px0, px1, pz = POOL_X0 - 0.3, POOL_X1 + 0.3, HZ + 0.3
for nm, (a, b, c, d) in {
    "DeckAft": (STERN, px0, -TZ, TZ),
    "DeckFore": (px1, BOW, -TZ, TZ),
    "DeckPort": (px0, px1, -TZ, -pz),
    "DeckStbd": (px0, px1, pz, TZ),
}.items():
    P_(box(nm, a, b, -0.14, 0.0, c, d, M["teak"], 0.0))
for s in (-1, 1):
    P_(box("Walk", STERN, BOW, -0.14, 0.0, s * TZ, s * BZ, M["nonskid"], 0.0))
    # (a brass edge strip where the teak meets the walk)
    P_(box("TeakEdge", STERN, BOW, 0.0, 0.006, s * (TZ - 0.03), s * (TZ + 0.03), M["gold"], 0.0))

# ================================================================================================================================
# THE POOL
# ================================================================================================================================
x0, xr, x1 = POOL_X0, HX, POOL_X1
bench_x = x1 - 0.42
P_(box("LaneFloor", x0, xr, LANE_FLOOR - 0.1, LANE_FLOOR, -HZ, HZ, M["mosaic"], 0.0))
# (the free half's floor down to the lane floor: its -x face is the step between the halves)
P_(box("FreeFloor", xr, bench_x, LANE_FLOOR, FREE_FLOOR, -HZ, HZ, M["mosaic"], 0.0))
P_(box("Bench", bench_x, x1, LANE_FLOOR, BENCH_Y, -HZ, HZ, M["mosaic"], 0.0))
P_(box("WallNear", x0 - 0.25, x0, LANE_FLOOR - 0.1, 0.0, -HZ - 0.25, HZ + 0.25, M["mosaic"], 0.0))
P_(box("WallFar", x1, x1 + 0.25, LANE_FLOOR - 0.1, 0.0, -HZ - 0.25, HZ + 0.25, M["mosaic"], 0.0))
for s in (-1, 1):
    P_(box("WallEnd", x0, x1, LANE_FLOOR - 0.1, 0.0, s * HZ, s * (HZ + 0.25), M["mosaic"], 0.0))
# the lane lines and their T's
for x in LANES:
    P_(box("LaneLine", x - 0.125, x + 0.125, LANE_FLOOR, LANE_FLOOR + 0.008, -(HZ - 1.2), HZ - 1.2, M["navy_dark"], 0.0))
    for s in (-1, 1):
        P_(box("LaneT", x - 0.5, x + 0.5, LANE_FLOOR, LANE_FLOOR + 0.008, s * (HZ - 1.32), s * (HZ - 1.08), M["navy_dark"], 0.0))
    # the target crosses on the end walls
    for s in (-1, 1):
        P_(box("LaneTarget", x - 0.125, x + 0.125, -1.15, -0.45, s * (HZ - 0.008), s * (HZ - 0.002), M["navy_dark"], 0.0))
        P_(box("LaneTarget", x - 0.3, x + 0.3, -0.92, -0.68, s * (HZ - 0.008), s * (HZ - 0.002), M["navy_dark"], 0.0))
# the kraken on the free half's floor
P_(plane("Kraken", 5.4, 5.4, g((xr + bench_x) / 2, FREE_FLOOR + 0.006, 0.0), M["kraken"], rot=(0, 0, PI / 2)))
# the deco band under the coping: navy with a gold line, all round
band_y0, band_y1 = -0.32, -0.04
for nm, (a, b, c, d) in {
    "BandNear": (x0 + 0.004, x0 + 0.01, -HZ, HZ),
    "BandFar": (x1 - 0.01, x1 - 0.004, -HZ, HZ),
    "BandPort": (x0, x1, -HZ + 0.004, -HZ + 0.01),
    "BandStbd": (x0, x1, HZ - 0.01, HZ - 0.004),
}.items():
    P_(box(nm, a, b, band_y0, band_y1, c, d, M["navy"], 0.0))
    P_(box(nm + "Gold", a - 0.002 if "Near" in nm else a, b + 0.002 if "Far" in nm else b, band_y0 - 0.045, band_y0 - 0.02,
           c - (0.002 if "Port" in nm else 0), d + (0.002 if "Stbd" in nm else 0), M["gold"], 0.0))
# underwater lamps along the long walls
for z in np.arange(-HZ + 1.6, HZ - 1.0, 3.2):
    P_(cyl("PoolLamp", 0.14, 0.02, g(x0 + 0.005, -0.85, z), M["pool_lamp"], 14, rot=(0, PI / 2, 0)))
    P_(cyl("PoolLamp", 0.14, 0.02, g(x1 - 0.025, -0.4, z), M["pool_lamp"], 14, rot=(0, PI / 2, 0)))
# the coping: white with a rounded nose and a navy inlay, all round
for nm, (a, b, c, d) in {
    "CopeNear": (px0, x0, -pz, pz),
    "CopeFar": (x1, px1, -pz, pz),
    "CopePort": (x0, x1, -pz, -HZ),
    "CopeStbd": (x0, x1, HZ, pz),
}.items():
    P_(box(nm, a, b, -0.04, 0.05, c, d, M["white"], 0.025))
for s in (-1, 1):
    P_(box("CopeInlay", x0 + 0.3, x1 - 0.3, 0.05, 0.054, s * (pz - 0.17), s * (pz - 0.13), M["navy"], 0.0))
for x in (px0 + 0.15, px1 - 0.15):
    P_(box("CopeInlay", x - 0.02, x + 0.02, 0.05, 0.054, -pz + 0.3, pz - 0.3, M["navy"], 0.0))
# the depth plates set in the coping
from_x = [(x0 + 1.0, "depth_12"), (x0 + 5.0, "depth_12"), (x1 - 2.4, "depth_09")]
for xx, nm in from_x:
    for s in (-1, 1):
        P_(plane("Depth", 0.42, 0.21, g(xx, 0.052, s * (HZ + 0.15)), signmat(nm, 0.5), rot=(0, 0, 0 if s < 0 else PI)))
# the starting blocks at the left end of each lane, their numbers facing the pool
for i, x in enumerate(LANES):
    z = -9.15
    P_(box("Block", x - 0.31, x + 0.31, 0.0, 0.58, z - 0.28, z + 0.28, M["white"], 0.04))
    P_(box("BlockTop", x - 0.33, x + 0.33, 0.58, 0.66, z - 0.3, z + 0.3, M["navy"], 0.02))
    P_(box("BlockGrip", x - 0.3, x + 0.3, 0.66, 0.67, z - 0.24, z + 0.26, M["rubber"], 0.0))
    P_(rod("BlockHandle", (x - 0.22, 0.5, z + 0.31), (x + 0.22, 0.5, z + 0.31), 0.018, M["chrome"]))
    for xx in (x - 0.22, x + 0.22):
        P_(rod("BlockHandle", (xx, 0.5, z + 0.31), (xx, 0.5, z + 0.26), 0.018, M["chrome"]))
    P_(face("BlockNum", 0.36, 0.36, x, 0.32, z + 0.282, 0.0, signmat(f"lane_{i + 1}", 0.5)))
    # its backstroke ledge bar
    P_(rod("BlockBar", (x - 0.25, 0.25, z + 0.33), (x + 0.25, 0.25, z + 0.33), 0.016, M["chrome"]))
# chrome ladders: the near side into the lanes, the far side into the free half
for xx, z, f in ((x0, -5.6, 1), (x0, 5.6, 1), (x1, -5.6, -1), (x1, 5.6, -1)):
    floor_y = LANE_FLOOR if f > 0 else BENCH_Y
    # (f: the way into the pool; the handrails rise from the deck behind the coping, arch over it and run down the wall)
    for dz in (-0.28, 0.28):
        pts = [(-0.55, 0.05), (-0.5, 0.6), (-0.36, 0.86), (-0.12, 0.86), (0.02, 0.62), (0.1, 0.2), (0.12, floor_y + 0.3)]
        P_(tube("Ladder", [Vector(g(xx + f * a, y, z + dz)) for a, y in pts], 0.025, M["chrome"], 2, 8))
        P_(cyl("LadderFoot", 0.05, 0.03, g(xx - f * 0.55, 0.0, z + dz), M["chrome"], 10))
    for k in range(3):
        y = -0.35 - k * 0.32
        if y < floor_y + 0.1:
            break
        P_(box("LadderStep", xx + f * 0.06, xx + f * 0.18, y - 0.02, y + 0.02, z - 0.26, z + 0.26, M["steel"], 0.006))

# ================================================================================================================================
# THE RAILS: glass windscreens on white steel bulwarks, a teak cap rail, chrome posts
# ================================================================================================================================
def windscreen(along, a, b, at, sign, y=0.0):
    """A run of windscreen: `along` "x" (the sides, at z = at) or "z" (across the stern, at x = at), from a to b, on a deck at y."""
    n = len(parts)
    _windscreen(along, a, b, at, sign)
    for o in parts[n:]:
        o.location.z += y  # (Blender's z is the game's y)


def _windscreen(along, a, b, at, sign):
    if along == "x":
        P_(box("Bulwark", a, b, -0.14, 0.32, at, at + sign * 0.2, M["paint"], 0.02))
        P_(box("Glass_Wind", a, b, 0.32, 1.18, at + sign * 0.09, at + sign * 0.11, M["glass"], 0.0))
        P_(box("CapRail", a, b, 1.18, 1.26, at + sign * 0.02, at + sign * 0.18, M["teak_cap"], 0.03))
        for x in np.arange(a + 0.2, b, 2.4):
            P_(box("Post", x - 0.03, x + 0.03, 0.32, 1.18, at + sign * 0.07, at + sign * 0.13, M["chrome"], 0.01))
            P_(cyl("PostCap", 0.035, 0.06, g(x, 1.12, at + sign * 0.1), M["chrome"], 10))
    else:
        P_(box("Bulwark", at, at + sign * 0.2, -0.14, 0.32, a, b, M["paint"], 0.02))
        P_(box("Glass_Wind", at + sign * 0.09, at + sign * 0.11, 0.32, 1.18, a, b, M["glass"], 0.0))
        P_(box("CapRail", at + sign * 0.02, at + sign * 0.18, 1.18, 1.26, a, b, M["teak_cap"], 0.03))
        for z in np.arange(a + 0.2, b, 2.4):
            P_(box("Post", at + sign * 0.07, at + sign * 0.13, 0.32, 1.18, z - 0.03, z + 0.03, M["chrome"], 0.01))


for s in (-1, 1):
    windscreen("x", STERN, BOW, s * BZ, s)
windscreen("z", -BZ - 0.2, BZ + 0.2, STERN, -1)

# ================================================================================================================================
# THE SHIP UNDER THE DECK: its sides with balconies down to the sea, the sheer strake, the waterline; the lower deck aft
# ================================================================================================================================
AFT = STERN - 6.4  # where the lower deck ends and the hull's stern falls to the sea
for s in (-1, 1):
    P_(box("Sheer", AFT, BOW + 26, -1.0, -0.14, s * HULL, s * (HULL + 0.18), M["paint"], 0.03))
    P_(box("Hull", AFT, BOW + 26, SEA - 2, -1.0, s * (HULL + 0.05), s * (HULL + 0.18), M["hull"], 0.0))
    P_(box("Strake", AFT, BOW + 26, -1.18, -1.0, s * (HULL + 0.18), s * (HULL + 0.26), M["white"], 0.02))
    P_(box("Waterline", AFT, BOW + 26, SEA - 2, SEA + 1.6, s * (HULL + 0.18), s * (HULL + 0.2), M["navy"], 0.0))
    P_(box("Boot", AFT, BOW + 26, SEA + 1.6, SEA + 1.9, s * (HULL + 0.18), s * (HULL + 0.21), M["white"], 0.0))
# the Lido's aft face over the lower deck: windows looking aft
P_(box("AftFace", STERN - 0.25, STERN, -3.2, -0.14, -HULL, HULL, M["facade"], 0.0))
P_(box("LowerDeck", AFT, STERN - 0.25, -3.34, -3.2, -HULL, HULL, M["teak"], 0.0))
P_(box("Transom", AFT - 0.2, AFT, SEA - 2, -3.2, -HULL - 0.2, HULL + 0.2, M["paint"], 0.0))
windscreen("z", -HULL, HULL, AFT + 0.05, 1, y=-3.2)
for s in (-1, 1):
    P_(box("LowerBulwark", AFT, STERN - 0.25, -3.2, -2.1, s * (HULL - 0.2), s * HULL, M["paint"], 0.02))
# on the lower deck: bollards and a coil of mooring line, a capstan
for s in (-1, 1):
    bx_, bz_ = AFT + 1.4, s * 11.0
    for dz in (-0.35, 0.35):
        P_(cyl("Bollard", 0.16, 0.5, g(bx_, -3.2, bz_ + dz), M["navy_dark"], 14))
        P_(cyl("BollardCap", 0.2, 0.06, g(bx_, -2.7, bz_ + dz), M["navy_dark"], 14))
    for k in range(4):
        P_(torus("Coil", 0.5 - k * 0.05, 0.05, g(bx_ + 1.6, -3.15 + k * 0.08, bz_), sm("rope"), 24, 6))
P_(cyl("Capstan", 0.45, 0.7, g(AFT + 2.4, -3.2, 0.0), M["navy_dark"], 18))
P_(cyl("CapstanTop", 0.55, 0.12, g(AFT + 2.4, -2.5, 0.0), M["steel"], 18))

# ================================================================================================================================
# THE STAIRWAY LOBBIES: glass deckhouses on white steel, a deco roof; the doors' sliding leaves are the game's
# ================================================================================================================================
door_z = DOORS["doorZ"]
for L in LOBBIES:
    s, xa, xb, za, zb = L["side"], L["x0"], L["x1"], L["z0"], L["z1"]
    lo, hi = min(xa, xb), max(xa, xb)
    cx = (xa + xb) / 2
    # the roof: a white slab with a rounded navy fascia and a gold line
    P_(box("LobbyRoof", lo - 0.15, hi + 0.15, 2.88, 3.12, za - 0.1, zb + 0.15, M["paint"], 0.05))
    P_(box("LobbyFascia", lo - 0.18, hi + 0.18, 2.74, 2.9, za - 0.12, zb + 0.18, M["navy"], 0.04))
    P_(box("LobbyGold", lo - 0.19, hi + 0.19, 2.76, 2.79, za - 0.13, zb + 0.19, M["gold"], 0.0))
    for x, z in ((xa, za), (xa, zb), (xb, za), (xb, zb)):
        P_(box("LobbyPost", x - 0.07, x + 0.07, 0.0, 2.74, z - 0.07, z + 0.07, M["white"], 0.02))
    # the glass: the front (to the pool), the outer end, the inner end beside the doorway
    P_(box("Glass_LobbyFront", lo + 0.07, hi - 0.07, 0.15, 2.74, zb - 0.01, zb + 0.01, M["glass"], 0.0))
    P_(box("LobbySill", lo, hi, 0.0, 0.15, zb - 0.06, zb + 0.06, M["steel"], 0.01))
    P_(box("Glass_LobbyEnd", xb - 0.01, xb + 0.01, 0.15, 2.74, za + 0.07, zb - 0.07, M["glass"], 0.0))
    # the doorway's side: glass behind the leaf's slide (-z of the door), a transom over the door
    P_(box("Glass_LobbyDoorSide", xa - 0.03, xa - 0.01, 0.15, 2.74, za + 0.07, door_z - 0.6, M["glass"], 0.0))
    P_(box("Glass_LobbyDoorSide", xa - 0.03, xa - 0.01, 0.15, 2.74, door_z + 0.6, zb - 0.07, M["glass"], 0.0))
    P_(box("LobbyTransom", xa - 0.06, xa + 0.06, 2.32, 2.74, door_z - 0.62, door_z + 0.62, M["paint"], 0.02))
    P_(box("DoorTrack", xa - 0.08, xa + 0.02, 2.3, 2.36, za + 0.1, door_z + 0.65, M["chrome"], 0.0))
    P_(face("StairsSign", 1.6, 0.5, xa - s * 0.075, 2.53, door_z, -s * PI / 2, signmat("stairs", 0.5)))
    # the stairs going down inside, with a chrome handrail
    for i in range(6):
        P_(box("Tread", cx + s * 0.1 - 0.8, cx + s * 0.1 + 0.8, -i * 0.28 - 0.12, -i * 0.28, za + 0.3 + i * 0.3, za + 0.6 + i * 0.3, M["teak_cap"], 0.01))
    P_(rod("StairRail", (cx + s * 0.95, 0.9, za + 0.3), (cx + s * 0.95, -0.8, za + 2.0), 0.025, M["chrome"]))
    # MUSTER STATION B on the outer end
    P_(face("Muster", 1.1, 0.55, xb + s * 0.03, 2.2, (za + zb) / 2, s * PI / 2, signmat("muster", 0.5)))

# ================================================================================================================================
# THE DECK'S PAINT (floor.glb)
# ================================================================================================================================
Pt = PAINT
SIZE = Pt["size"]
xs_ = Pt["x0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
zs_ = Pt["z0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
WX, WZ = np.meshgrid(xs_, zs_)
rng = np.random.default_rng(1931)


def vnoise(scale, seed, octaves=3):
    out = np.zeros_like(WX)
    amp, tot = 1.0, 0.0
    r = np.random.default_rng(seed)
    for o in range(octaves):
        n = int(Pt["span"] / scale * 2**o) + 2
        grid = r.random((n, n)).astype(np.float32)
        u = (WX - Pt["x0"]) / Pt["span"] * (n - 1)
        v = (WZ - Pt["z0"]) / Pt["span"] * (n - 1)
        i, j = np.floor(u).astype(int), np.floor(v).astype(int)
        fu, fv = u - i, v - j
        fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
        i1, j1 = np.clip(i + 1, 0, n - 1), np.clip(j + 1, 0, n - 1)
        a = grid[j, i] * (1 - fu) + grid[j, i1] * fu
        b = grid[j1, i] * (1 - fu) + grid[j1, i1] * fu
        out += amp * (a * (1 - fv) + b * fv)
        tot += amp
        amp *= 0.5
    return out / tot


rgb = np.zeros(WX.shape + (3,), np.float32)
alpha = np.zeros(WX.shape, np.float32)


def lay(colour, a):
    global rgb, alpha
    c = np.array(colour, np.float32)
    a = np.clip(a, 0, 1)
    rgb = c * a[..., None] + rgb * (1 - a[..., None])
    alpha = a + alpha * (1 - a)


def rect(xa, xb, za, zb, soft=0.02):
    return np.clip((np.minimum.reduce([WX - xa, xb - WX, WZ - za, zb - WZ]) + soft) / (2 * soft), 0, 1)


def outline(xa, xb, za, zb, w=0.05):
    return rect(xa, xb, za, zb, 0.008) * (1 - rect(xa + w, xb - w, za + w, zb - w, 0.008))


on_deck = rect(STERN, BOW, -BZ, BZ, 0.01) * (1 - rect(px0, px1, -pz, pz, 0.01))
n1, n2, n3 = vnoise(0.6, 3), vnoise(0.25, 5), vnoise(1.8, 9)
# the wet ring round the pool, heavier at its ends where the slosh spills over the coping
dpool = np.maximum.reduce([px0 - WX, WX - px1, np.abs(WZ) - pz])
wet = np.clip(1 - dpool / 1.3, 0, 1) * np.clip((n2 - 0.3) * 2.0, 0, 1)
spill = np.clip(1 - (np.abs(WZ) - pz) / 2.6, 0, 1) * (np.abs(WZ) > pz) * (WX > px0) * (WX < px1) * (0.55 + 0.45 * n1)
lay((0.36, 0.25, 0.14), np.maximum(wet * 0.5, spill * 0.55) * on_deck)
# footprints? never (the creator's rule): scuffs on the walk from the lobbies to the queue instead, faint
for s in (-1, 1):
    for t in np.linspace(0, 1, 26):
        cx, cz = s * (9.0 - 5.0 * t), -14.0 + 2.2 * t
        lay((0.62, 0.48, 0.32), np.clip(1 - np.hypot(WX - cx, WZ - cz) / 1.1, 0, 1) * 0.06 * (0.5 + 0.5 * n1) * on_deck)
# cocktail rings by the bar and the loungers' side tables
for q in range(26):
    cx = R.uniform(12.0, 13.0) if q < 10 else R.choice([-7.8, -11.7, 13.5]) + R.uniform(-1.3, 1.3)
    cz = BAR["z"] + R.uniform(-1.6, 1.6) if q < 10 else R.uniform(-7.5, 7.5)
    rr = R.uniform(0.035, 0.05)
    ring = np.clip(1 - np.abs(np.hypot(WX - cx, WZ - cz) - rr) / 0.006, 0, 1)
    lay((0.4, 0.28, 0.16), ring * 0.4)
# LIDO DECK 14 in navy on the near walk; NO DIVING by the coping on both long sides
def stencil_paint(name, cx, cz, w, h, turn, colour, strength=0.85):
    """A sign's picture laid on the deck as paint: its dark letters only."""
    img = bpy.data.images.load(os.path.join(SIGNS, name + ".png"))
    iw, ih = img.size
    px = np.empty(iw * ih * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    a = px.reshape(ih, iw, 4)[:, :, :3]
    lum = a.mean(axis=2)
    # in the stencil's frame: u across its width, v up its height
    dx, dz = WX - cx, WZ - cz
    c_, s_ = math.cos(turn), math.sin(turn)
    u = (dx * c_ + dz * s_) / w + 0.5
    v = (-dx * s_ + dz * c_) / h + 0.5
    inside = (u > 0) & (u < 1) & (v > 0) & (v < 1)
    ui = np.clip((u * (iw - 1)).astype(int), 0, iw - 1)
    vi = np.clip((v * (ih - 1)).astype(int), 0, ih - 1)
    ink = (1 - lum[vi, ui]) * inside
    lay(colour, np.clip((ink - 0.25) * 2.0, 0, 1) * strength * (0.75 + 0.25 * n2))


stencil_paint("lido_deck", -4.65, 12.6, 5.2, 1.0, 0.0, (0.11, 0.2, 0.34))
for s in (-1, 1):
    stencil_paint("no_diving", -1.6, s * (pz + 0.55), 1.2, 0.6, PI if s > 0 else 0.0, (0.75, 0.13, 0.15))
    stencil_paint("no_diving", 6.8, s * (pz + 0.55), 1.2, 0.6, PI if s > 0 else 0.0, (0.75, 0.13, 0.15))
# the shuffleboard court on the port side by the bar: its outline, the scoring triangle, the numbers
CX0, CX1, CZ0, CZ1 = 5.0, 12.6, -12.9, -11.1
court = outline(CX0, CX1, CZ0, CZ1, 0.05)
for xx in (CX0 + 1.6, CX1 - 1.6):
    court = np.maximum(court, outline(xx - 0.025, xx + 0.025, CZ0, CZ1, 0.025))
# the triangles at each end
for xx, d in ((CX0 + 0.3, 1), (CX1 - 0.3, -1)):
    t = (WX - xx) * d
    half = (CZ1 - CZ0) / 2 * (1 - t / 1.2)
    tri = (t > 0) & (t < 1.2) & (np.abs(np.abs(WZ - (CZ0 + CZ1) / 2) - half) < 0.03)
    court = np.maximum(court, tri.astype(np.float32))
    for frac in (0.33, 0.66):
        xl = xx + d * 1.2 * frac
        hw = (CZ1 - CZ0) / 2 * (1 - frac)
        court = np.maximum(court, ((np.abs(WX - xl) < 0.025) & (np.abs(WZ - (CZ0 + CZ1) / 2) < hw)).astype(np.float32))
lay((0.96, 0.95, 0.9), court * 0.9 * (0.8 + 0.2 * n2))
lay((0.11, 0.2, 0.34), rect(CX0 + 0.06, CX1 - 0.06, CZ0 + 0.06, CZ1 - 0.06, 0.01) * 0.18)
# the yellow safety lines along both walks
for s in (-1, 1):
    line = np.clip(1 - np.abs(WZ - s * (TZ + 0.12)) / 0.04, 0, 1) * (WX > STERN) * (WX < BOW)
    lay((0.95, 0.78, 0.2), line * 0.85 * (0.75 + 0.25 * n1))
# salt and sun: the teak a touch silvered toward the rails, darker under the loungers' rows
silver = np.clip((np.abs(WZ) - 11.0) / 4.0, 0, 1) * (0.5 + 0.5 * n3)
lay((0.78, 0.74, 0.66), silver * 0.16 * on_deck)
rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
alpha *= rect(STERN, BOW, -BZ, BZ, 0.0)
img = bpy.data.images.new("cruise_paint", SIZE, SIZE, alpha=True)
img.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), alpha])[::-1].astype(np.float32).ravel())
img.filepath_raw = os.path.join(SIGNS, "cruise_paint.png")
img.file_format = "PNG"
img.save()
cover = plane("Paint", Pt["span"], Pt["span"], g(Pt["x0"] + Pt["span"] / 2, 0.004, Pt["z0"] + Pt["span"] / 2), signmat("cruise_paint", 0.8), rot=(0, 0, 0))
floor.append(cover)

print("SHELL", tris(parts))
if LOOK:
    cover.hide_render = True
    look("shell_overview", g(0, 0, 0), 40, 55, 270, (1280, 720), 16, 30)
    look("shell_pool", g(3, -0.5, 0), 14, 35, 250, (1280, 720), 16, 30)
    look("shell_lobby", g(-11.6, 1.4, -14.3), 7, 15, 330, (1280, 720), 16, 35)
    look("shell_side", g(0, -8, 18), 30, 5, 180, (1280, 720), 16, 30)
cover.hide_render = False
save_part("shell", parts)
save_part("floor", floor)
