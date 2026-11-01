"""The Rooftop Pool's ground, in game coordinates, from the game's own plan (kit.PLAN):
- the deck: honey teak boards running the pool's length (fal); ivory travertine round the pool, past both ends of the gutter and
  in the lift lobbies (fal), a bronze inlay where they meet;
- the pool: emerald glass mosaic with gold flecks (fal), its bench step along the near wall (the game's floor: roofFloorAt), the
  hotel's emblem on its floor (fal: a pigeon in gold aviators on a flamingo float), a line of light under the coping, travertine
  coping on the near side and the ends, the depth plates; along the far side the knife edge in black granite (fal) flush with
  the water, and the catch gutter a step lower, granite, its outer wall capped in travertine (the water sliding over and running
  along is the game's);
- the roof slab's edges in white concrete (fal) with a bronze lip, its underside and downlights where it hangs out over the
  street (the tower's glass walls below are the game's);
- the glass rails: frameless panes in a bronze shoe, a bronze cap, slim posts, along every edge but the lift cores;
- the two lift cores: dark bronze fins (fal), a brass portal, the lit car behind the doors (a mirror, a handrail, PLEASE DO NOT
  PRESS ALL THE BUTTONS, a pigeon riding up), ▲ 57 SKY POOL over the doors, HOTEL VERTIGO on top, a canopy with a line of light
  (the doors' sliding leaves are the game's); the aircraft warning mast on one, the anemometer on the other;
- `floor.glb`: the deck's paint: the wet ring round the pool, SKY POOL · 57 and a red carpet out of the VIP lift, MIND THE EDGE,
  cocktail rings by the bar and the side tables, a few pigeon splats by the rails (the creator's rule: no footprints, ever).

    blender -b -P tools/venues/roof/shell.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(57)
M = dict(
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    trav=tmat_tile("travertine", "#eadfc6", 0.5),
    mosaic=tmat_tile("mosaic", "#0f5a4c", 0.2),
    granite=tmat_tile("granite", "#151618", 0.25),
    concrete=tmat_tile("concrete", "#ece8e0", 0.7),
    bronze_t=tmat_tile("bronze", "#5a4632", 0.4),
    marble=tmat_tile("marble", "#f1ece4", 0.25),
    bronze=sm("bronze"),
    brass=sm("brass"),
    gold=sm("gold"),
    black=sm("black"),
    ink=sm("ink"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    red=sm("red"),
    glass=sm("glass"),
    mirror=sm("mirror", "#c9d4da", 0.05, 1.0),
    car_wall=sm("car_wall", "#3a2c20", 0.4, 0.5),
    emblem=cutmat("emblem", 0.3),
    led=lamp_mat("pool_led", "#9ff7ec", 3.0),
    strip=lamp_mat("canopy_strip", "#ffd9a0", 3.0),
    car_light=lamp_mat("car_light", "#ffe6c0", 3.5),
    down=lamp_mat("downlight", "#ffe2b0", 3.0),
    beacon=lamp_mat("beacon", "#ff2a2a", 4.0),
)
parts, floor = [], []


def P_(*objs):
    parts.extend(o for o in objs if o is not None)


EX0, EX1, EZ = EDGE["x0"], EDGE["x1"], EDGE["z"]
SX0, SX1, SZ = SURROUND["x0"], SURROUND["x1"], SURROUND["z"]
G0, G1 = GUTTER["x0"], GUTTER["x1"]
GZ = HZ + 0.35  # the gutter's ends
CAP0 = G1 - 0.03  # the gutter's outer wall, capped in travertine to the roof's edge

# ================================================================================================================================
# THE DECK: teak, travertine round the pool and in the lobbies
# ================================================================================================================================
T = -0.12
for nm, (a, b, c, d) in {
    "TeakNear": (EX0, LOBBY["x0"], -EZ, EZ),
    "TeakMid": (LOBBY["x0"], SX0, -LOBBY["z"], LOBBY["z"]),
}.items():
    P_(box(nm, a, b, T, 0.0, c, d, M["teak"], 0.0))
for s in (-1, 1):
    P_(box("TeakEnd", LOBBY["x1"], EX1, T, 0.0, s * SZ, s * EZ, M["teak"], 0.0))
    P_(box("TeakEnd", SX0, LOBBY["x1"], T, 0.0, s * SZ, s * LOBBY["z"], M["teak"], 0.0))
    # travertine: the lobbies, the surround's ends past the gutter
    P_(box("TravLobby", LOBBY["x0"], LOBBY["x1"], T, 0.0, s * LOBBY["z"], s * EZ, M["trav"], 0.0))
    P_(box("TravEnd", SX0, EX1, T, 0.0, s * (GZ + 0.3), s * SZ, M["trav"], 0.0))
    P_(box("TravEndPool", -HX - 0.32, G0, T, 0.0, s * (HZ + 0.32), s * (GZ + 0.3), M["trav"], 0.0))
    P_(box("TravEndGutter", G0, EX1, T, 0.0, s * GZ, s * (GZ + 0.3), M["trav"], 0.0))
    # the bronze inlays where the teak meets the stone
    P_(box("Inlay", SX0, LOBBY["x1"], 0.0, 0.006, s * (SZ - 0.025), s * (SZ + 0.025), M["bronze"], 0.0))
    P_(box("Inlay", LOBBY["x1"] - 0.025, LOBBY["x1"] + 0.025, 0.0, 0.006, s * SZ, s * EZ, M["bronze"], 0.0))
    P_(box("Inlay", LOBBY["x0"] - 0.025, LOBBY["x0"] + 0.025, 0.0, 0.006, s * LOBBY["z"], s * EZ, M["bronze"], 0.0))
    P_(box("Inlay", LOBBY["x0"], SX0, 0.0, 0.006, s * (LOBBY["z"] - 0.025), s * (LOBBY["z"] + 0.025), M["bronze"], 0.0))
P_(box("TravNear", SX0, -HX - 0.32, T, 0.0, -(HZ + 0.32), HZ + 0.32, M["trav"], 0.0))
P_(box("Inlay", SX0 - 0.025, SX0 + 0.025, 0.0, 0.006, -LOBBY["z"], LOBBY["z"], M["bronze"], 0.0))

# ================================================================================================================================
# THE POOL
# ================================================================================================================================
FL = FLOOR_Y
P_(box("PoolFloor", -HX, HX, FL - 0.1, FL, -HZ, HZ, M["mosaic"], 0.0))
P_(box("WallNear", -HX - 0.32, -HX, FL - 0.1, -0.04, -HZ - 0.32, HZ + 0.32, M["mosaic"], 0.0))
for s in (-1, 1):
    P_(box("WallEnd", -HX, G0, FL - 0.1, -0.04, s * HZ, s * (HZ + 0.32), M["mosaic"], 0.0))
# the bench step (the game's floor: -0.62 to x -2.98, then down to the floor by -2.68)
P_(prism("Bench", [(-HX, FL), (-HX + 0.68, FL), (-HX + 0.42, BENCH_Y), (-HX, BENCH_Y)], -HZ, HZ, M["mosaic"]))
# the far wall: mosaic inside, granite outside (the gutter's side), the knife edge flush with the water
P_(box("WallFar", HX, HX + 0.1, FL - 0.1, WATER_Y - 0.04, -HZ, HZ, M["mosaic"], 0.0))
P_(box("WallFarOut", HX + 0.1, G0, GUTTER_FLOOR - 0.1, WATER_Y - 0.04, -GZ, GZ, M["granite"], 0.0))
P_(box("KnifeEdge", HX - 0.005, G0 + 0.02, WATER_Y - 0.04, WATER_Y, -HZ, HZ, M["granite"], 0.004))
# the gutter: its floor, its outer wall to the deck, its ends
P_(box("GutterFloor", G0, G1, GUTTER_FLOOR - 0.1, GUTTER_FLOOR, -GZ, GZ, M["granite"], 0.0))
P_(box("GutterOuter", G1, G1 + 0.22, GUTTER_FLOOR - 0.1, -0.04, -GZ, GZ, M["granite"], 0.0))
for s in (-1, 1):
    P_(box("GutterEnd", HX, G1 + 0.22, GUTTER_FLOOR - 0.1, -0.04, s * GZ, s * (GZ + 0.3), M["granite"], 0.0))
    P_(box("KnifeEnd", HX, G0, WATER_Y - 0.04, -0.04, s * HZ, s * GZ, M["granite"], 0.0))
# the outer wall's travertine cap to the roof's edge (the rail stands on it)
P_(box("GutterCap", CAP0, EX1, -0.05, 0.03, -GZ - 0.3, GZ + 0.3, M["trav"], 0.012))
P_(box("CapEdge", EX1 - 0.02, EX1 + 0.01, -0.12, 0.03, -EZ, EZ, M["bronze"], 0.0))
# the coping: travertine with a rounded nose on the near side and the ends
P_(box("CopeNear", -HX - 0.32, -HX + 0.02, -0.04, 0.04, -HZ - 0.32, HZ + 0.32, M["trav"], 0.02))
for s in (-1, 1):
    P_(box("CopeEnd", -HX, G0, -0.04, 0.04, s * (HZ - 0.02), s * (HZ + 0.32), M["trav"], 0.02))
# the line of light under the coping, round the near side and the ends
P_(box("PoolLED", -HX + 0.0, -HX + 0.012, -0.36, -0.32, -HZ, HZ, M["led"], 0.0))
for s in (-1, 1):
    P_(box("PoolLED", -HX, HX, -0.36, -0.32, s * (HZ - 0.012), s * HZ, M["led"], 0.0))
# the hotel's emblem on the floor, a little toward the far side (where the camera sees down into the water)
P_(flat("Emblem", 5.4, 5.4, 0.6, FL + 0.006, 0.0, M["emblem"], turn=-PI / 2))
# the depth plates set in the coping; 185 m on the gutter's cap
for z in (-7.0, 0.0, 7.0):
    P_(flat("Depth", 0.34, 0.17, -HX - 0.15, 0.042, z, signmat("depth_115", 0.5), turn=-PI / 2))
for z in (-6.0, 6.0):
    P_(flat("Depth", 0.34, 0.17, (CAP0 + EX1) / 2 - 0.05, 0.032, z, signmat("depth_185", 0.5), turn=PI / 2))
for s in (-1, 1):
    P_(flat("NoDiving", 0.5, 0.25, -1.0, 0.042, s * (HZ + 0.16), signmat("no_diving", 0.5), turn=0.0 if s < 0 else PI))

# ================================================================================================================================
# THE SLAB: white concrete edges with a bronze lip, the underside with its downlights
# ================================================================================================================================
SL = SLAB
P_(box("SlabFar", EX1 - 0.3, EX1, SL, -0.12, -EZ, EZ, M["concrete"], 0.02))
P_(box("SlabNear", EX0, EX0 + 0.3, SL, 0.0, -EZ, EZ, M["concrete"], 0.02))
for s in (-1, 1):
    P_(box("SlabEnd", EX0, EX1, SL, 0.0, s * (EZ - 0.3), s * EZ, M["concrete"], 0.02))
    P_(box("Lip", EX0 - 0.06, EX1 + 0.06, -0.1, 0.0, s * EZ, s * (EZ + 0.06), M["bronze"], 0.0))
P_(box("Lip", EX1, EX1 + 0.06, -0.1, 0.0, -EZ, EZ, M["bronze"], 0.0))
P_(box("Lip", EX0 - 0.06, EX0, -0.1, 0.0, -EZ, EZ, M["bronze"], 0.0))
P_(box("Underside", EX0, EX1, SL - 0.02, SL, -EZ, EZ, M["concrete"], 0.0))
for i in range(24):
    for x in (1.2, 3.6):
        P_(cyl("Downlight", 0.16, 0.02, g(x, SL - 0.03, -15.0 + i * 1.3), M["down"], 12))

# ================================================================================================================================
# THE GLASS RAILS
# ================================================================================================================================
H = 1.1


def rail(x0, z0, x1, z1):
    n = len(parts)
    L_ = math.hypot(x1 - x0, z1 - z0)
    along_x = abs(x1 - x0) > abs(z1 - z0)
    if along_x:
        a, b, c = min(x0, x1), max(x0, x1), z0
        P_(box("Glass_Rail", a, b, 0.08, H, c - 0.008, c + 0.008, M["glass"], 0.0))
        P_(box("RailShoe", a, b, 0.0, 0.1, c - 0.05, c + 0.05, M["bronze"], 0.006))
        P_(rod("RailCap", (a, H + 0.03, c), (b, H + 0.03, c), 0.035, M["bronze"]))
        for k in range(int(L_ // 2) + 1):
            x = a + min(L_, k * 2.0)
            P_(box("RailPost", x - 0.025, x + 0.025, 0.0, H, c - 0.025, c + 0.025, M["bronze"], 0.006))
    else:
        a, b, c = min(z0, z1), max(z0, z1), x0
        P_(box("Glass_Rail", c - 0.008, c + 0.008, 0.08, H, a, b, M["glass"], 0.0))
        P_(box("RailShoe", c - 0.05, c + 0.05, 0.0, 0.1, a, b, M["bronze"], 0.006))
        P_(rod("RailCap", (c, H + 0.03, a), (c, H + 0.03, b), 0.035, M["bronze"]))
        for k in range(int(L_ // 2) + 1):
            z = a + min(L_, k * 2.0)
            P_(box("RailPost", c - 0.025, c + 0.025, 0.0, H, z - 0.025, z + 0.025, M["bronze"], 0.006))
    return parts[n:]


RZ = EZ - 0.1
rail(RAIL, -RZ, RAIL, RZ)
rail(EX0 + 0.1, -RZ, EX0 + 0.1, RZ)
for s in (-1, 1):
    rail(EX0 + 0.1, s * RZ, CORE["x0"] - 0.1, s * RZ)
    rail(CORE["x1"] + 0.1, s * RZ, RAIL, s * RZ)

# ================================================================================================================================
# THE LIFT CORES (the doors' leaves are the game's)
# ================================================================================================================================
LX = LIFT["x"]
DZ = DOORS["doorZ"]
BACK = EZ + 0.6
for s in (-1, 1):
    f = s * DZ  # the doors' face
    zz = (f, s * BACK)
    # the core either side of the doorway and over it, clad in bronze fins
    P_(box("Core", LX - 2.3, LX - 0.8, 0.0, 3.4, *zz, M["bronze_t"], 0.02))
    P_(box("Core", LX + 0.8, LX + 2.3, 0.0, 3.4, *zz, M["bronze_t"], 0.02))
    P_(box("Core", LX - 0.8, LX + 0.8, 2.45, 3.4, *zz, M["bronze_t"], 0.02))
    P_(box("CoreRoof", LX - 2.4, LX + 2.4, 3.4, 3.55, s * (DZ - 0.05), s * (BACK + 0.05), M["concrete"], 0.02))
    # the brass portal and the door track
    P_(box("Portal", LX - 0.9, LX + 0.9, 2.42, 2.52, f - s * 0.1, f + s * 0.02, M["brass"], 0.01))
    for dx in (-1, 1):
        P_(box("Portal", LX + dx * 0.8 - 0.05, LX + dx * 0.8 + 0.05, 0.0, 2.52, f - s * 0.1, f + s * 0.02, M["brass"], 0.01))
    P_(box("Sill", LX - 0.85, LX + 0.85, 0.0, 0.015, f - s * 0.1, f + s * 0.12, M["steel"], 0.0))
    # the car: lit, a mirror on its back wall, a handrail, the buttons
    c0, c1 = f + s * 0.12, f + s * 1.45
    P_(box("CarFloor", LX - 0.8, LX + 0.8, 0.0, 0.01, c0, c1, M["granite"], 0.0))
    P_(box("CarCeiling", LX - 0.8, LX + 0.8, 2.38, 2.45, c0, c1, M["car_light"], 0.0))
    P_(box("CarBack", LX - 0.8, LX + 0.8, 0.0, 2.45, c1, c1 + s * 0.05, M["car_wall"], 0.0))
    P_(box("CarMirror", LX - 0.6, LX + 0.6, 0.9, 2.2, c1 - s * 0.01, c1, M["mirror"], 0.0))
    for dx in (-1, 1):
        P_(box("CarSide", LX + dx * 0.8, LX + dx * 0.83, 0.0, 2.45, c0, c1, M["car_wall"], 0.0))
    P_(rod("CarRail", (LX - 0.7, 0.95, c1 - s * 0.06), (LX + 0.7, 0.95, c1 - s * 0.06), 0.02, M["brass"]))
    P_(box("CarPanel", LX + 0.72, LX + 0.79, 1.0, 1.5, c0 + s * 0.15, c0 + s * 0.45, M["brass"], 0.005))
    P_(face("CarButtons", 0.28, 0.12, LX + 0.715, 1.62, c0 + s * 0.3, -PI / 2, signmat("buttons", 0.5)))
    P_(card("LiftPigeon", "pigeon_vip", 0.32, LX - 0.35, 0.0, c0 + s * 0.6, PI if s > 0 else 0.0))
    # over the doors: ▲ 57 SKY POOL; on top: HOTEL VERTIGO
    turn = PI if s > 0 else 0.0
    P_(face("Lift57", 1.6, 0.42, LX, 2.92, f - s * 0.012, turn, signmat("lift57", 0.4)))
    P_(box("VertigoBack", LX - 2.35, LX + 2.35, 3.55, 4.25, s * (DZ + 0.1), s * (DZ + 0.3), M["ink"], 0.02))
    P_(face("Vertigo", 4.5, 0.7, LX, 3.9, s * (DZ + 0.09), turn, signmat("vertigo", 0.35)))
    # the canopy over the lobby, a line of light under it
    P_(box("Canopy", LX - 2.3, LX + 2.3, 3.4, 3.52, s * (DZ - 2.2), f, M["ink"], 0.03))
    P_(box("CanopyEdge", LX - 2.32, LX + 2.32, 3.38, 3.54, s * (DZ - 2.24), s * (DZ - 2.18), M["brass"], 0.0))
    P_(box("CanopyStrip", LX - 2.2, LX + 2.2, 3.385, 3.4, s * (DZ - 2.1), s * (DZ - 2.04), M["strip"], 0.0))
    for dx in (-2.15, 2.15):
        P_(rod("CanopyTie", (LX + dx, 3.46, s * (DZ - 2.1)), (LX + dx, 4.25, s * (DZ + 0.15)), 0.02, M["bronze"]))
# on the +z core: the aircraft warning mast, red light on top; on the -z core: the weather mast and its anemometer
MZ = BACK - 0.6
P_(rod("Mast", (LX + 1.6, 3.55, MZ), (LX + 1.6, 8.0, MZ), 0.05, M["steel"]))
for y in (4.6, 5.8, 7.0):
    P_(rod("MastRung", (LX + 1.48, y, MZ), (LX + 1.72, y, MZ), 0.015, M["steel"]))
P_(sphere("Beacon", 0.13, g(LX + 1.6, 8.12, MZ), M["beacon"], 12, 8))
P_(cyl("BeaconCap", 0.15, 0.04, g(LX + 1.6, 8.24, MZ), M["black"], 12))
P_(face("Aircraft", 0.9, 0.24, LX + 1.6, 4.1, MZ - 0.06, PI, signmat("aircraft", 0.5)))
P_(rod("WxMast", (LX + 1.6, 3.55, -MZ), (LX + 1.6, 6.2, -MZ), 0.04, M["steel"]))
for k in range(3):
    a = k * 2 * PI / 3
    tip = (LX + 1.6 + 0.35 * math.cos(a), 6.25, -MZ + 0.35 * math.sin(a))
    P_(rod("Anemo", (LX + 1.6, 6.25, -MZ), tip, 0.012, M["steel"]))
    P_(sphere("AnemoCup", 0.07, g(*tip), M["chrome"], 8, 6))
P_(box("WxVane", LX + 1.6, LX + 2.1, 5.9, 6.05, -MZ - 0.01, -MZ + 0.01, M["black"], 0.0))

# ================================================================================================================================
# THE DECK'S PAINT (floor.glb)
# ================================================================================================================================
Pt = PAINT
SIZE = Pt["size"]
xs_ = Pt["x0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
zs_ = Pt["z0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
WX, WZ = np.meshgrid(xs_, zs_)


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


def stencil_paint(name, cx, cz, w, h, turn, colour, strength=0.85):
    """A sign's picture laid on the deck as paint: its dark letters only."""
    img = bpy.data.images.load(os.path.join(SIGNS, name + ".png"))
    iw, ih = img.size
    px = np.empty(iw * ih * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    lum = px.reshape(ih, iw, 4)[:, :, :3].mean(axis=2)
    dx, dz = WX - cx, WZ - cz
    c_, s_ = math.cos(turn), math.sin(turn)
    u = (dx * c_ + dz * s_) / w + 0.5
    v = (-dx * s_ + dz * c_) / h + 0.5
    inside = (u > 0) & (u < 1) & (v > 0) & (v < 1)
    ui = np.clip((u * (iw - 1)).astype(int), 0, iw - 1)
    vi = np.clip((v * (ih - 1)).astype(int), 0, ih - 1)
    ink = (1 - lum[vi, ui]) * inside
    lay(colour, np.clip((ink - 0.25) * 2.0, 0, 1) * strength * (0.8 + 0.2 * n2))


n1, n2, n3 = vnoise(0.6, 3), vnoise(0.25, 5), vnoise(1.8, 9)
on_deck = rect(EX0, EX1, -EZ, EZ, 0.01) * (1 - rect(-HX - 0.32, EX1, -(GZ + 0.0), GZ, 0.01))
# the wet ring round the pool (darker stone and wood), splashier at the near side where the guests climb out
dpool = np.maximum.reduce([-HX - 0.32 - WX, WX - G1, np.abs(WZ) - (HZ + 0.32)])
wet = np.clip(1 - dpool / 1.4, 0, 1) * np.clip((n2 - 0.3) * 2.0, 0, 1)
lay((0.42, 0.33, 0.2), wet * 0.35 * on_deck)
# SKY POOL · 57 in each lobby, read from the pool's side; the red carpet out of the +z lift (the VIPs')
for s in (-1, 1):
    stencil_paint("st_level57", LIFT["x"], s * 13.95, 3.2, 0.68, 0.0 if s < 0 else PI, (0.62, 0.48, 0.2), 0.55)
carpet = rect(LIFT["x"] - 0.7, LIFT["x"] + 0.7, 13.5, DZ - 0.1, 0.01)
lay((0.55, 0.07, 0.12), carpet * 0.95)
lay((0.88, 0.7, 0.3), (carpet - rect(LIFT["x"] - 0.62, LIFT["x"] + 0.62, 13.45, DZ, 0.01)).clip(0, 1) * 0.95)
lay((0.42, 0.04, 0.08), carpet * np.clip((n2 - 0.55) * 3, 0, 1) * 0.3)
# MIND THE EDGE on the stone past the gutter's ends
for s in (-1, 1):
    stencil_paint("st_mind_edge", (G0 + EX1) / 2 - 0.15, s * (GZ + 0.75), 2.0, 0.4, 0.0 if s < 0 else PI, (0.72, 0.16, 0.12), 0.7)
# cocktail rings by the bar and round the side tables
for q in range(30):
    if q < 12:
        cx, cz = BAR["x"] + R.uniform(-1.8, 1.8), BAR["z"] + R.uniform(0.7, 1.6)
    else:
        t = R.choice(furniture("side-table"))
        cx, cz = t["x"] + R.uniform(-0.6, 0.6), t["z"] + R.uniform(-0.6, 0.6)
    rr = R.uniform(0.035, 0.05)
    ring = np.clip(1 - np.abs(np.hypot(WX - cx, WZ - cz) - rr) / 0.006, 0, 1)
    lay((0.4, 0.28, 0.16), ring * 0.35)
# the pigeons' visits along the near rail and the far cap (a few white splats)
for q in range(22):
    cx = R.choice([EX0 + R.uniform(0.25, 0.6), R.uniform(CAP0 + 0.05, EX1 - 0.05)])
    cz = R.uniform(-EZ + 0.4, EZ - 0.4)
    rr = R.uniform(0.03, 0.06)
    d_ = np.hypot(WX - cx, (WZ - cz) * 0.8)
    lay((0.95, 0.94, 0.9), np.clip(1 - d_ / rr, 0, 1) * 0.85 * (0.6 + 0.4 * n2))
    lay((0.35, 0.33, 0.3), np.clip(1 - np.hypot(WX - cx - 0.01, WZ - cz) / (rr * 0.35), 0, 1) * 0.5)
# the sun: the teak silvered toward the rails, a faint warm haze on the stone by the far edge
silver = np.clip((np.abs(WZ) - 12.5) / 3.5, 0, 1) * (0.5 + 0.5 * n3) + np.clip((-WX - 12.0) / 3.0, 0, 1) * 0.6
lay((0.78, 0.74, 0.66), silver * 0.14 * on_deck)
rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
alpha *= rect(EX0, EX1, -EZ, EZ, 0.001)
img = bpy.data.images.new("roof_paint", SIZE, SIZE, alpha=True)
img.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), alpha])[::-1].astype(np.float32).ravel())
img.filepath_raw = os.path.join(SIGNS, "roof_paint.png")
img.file_format = "PNG"
img.save()
cover = plane("Paint", Pt["span"], Pt["span"], g(Pt["x0"] + Pt["span"] / 2, 0.004, Pt["z0"] + Pt["span"] / 2), signmat("roof_paint", 0.8), rot=(0, 0, 0))
floor.append(cover)

print("SHELL", tris(parts))
if LOOK:
    cover.hide_render = True
    look("shell_overview", g(-4, 0, 0), 40, 55, 270, (1280, 720), 16, 30)
    look("shell_pool", g(3, -0.5, 0), 12, 30, 250, (1280, 720), 16, 30)
    look("shell_lift", g(-6.2, 1.4, 15.0), 8, 15, 180, (1280, 720), 16, 35)
cover.hide_render = False
save_part("shell", parts)
save_part("floor", floor)
