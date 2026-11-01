"""The Jumping Pool's ground, in game coordinates, from the game's own plan (kit.PLAN):
- the lawns all round (fal: a country club's, with its mowing stripes) and the deck raised on them: ivory travertine (fal),
  its edges falling to the grass;
- the deep pool: a cobalt glass mosaic (fal) down to 4.2 m, a band of hand-painted majolica at the waterline (fal: one tile a
  repeat), white marble coping, lamps under the water, a target ring on the floor under each board in its height's colour, the
  club's emblem in the middle of the floor (fal: a walrus in a striped 1920s bathing suit mid swan dive, in a laurel wreath),
  chrome ladders where the game's are, the depth plates;
- the warm tiles under the massage corner;
- `floor.glb`: the deck's paint: each board's line in its colour (round spots: no footprints, ever), DIVERS QUEUE HERE, DEEP WATER,
  the wet ring round the pool and the tub, sun-faded travertine toward the hedges.

    blender -b -P tools/venues/dive/shell.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(1927)
M = dict(
    trav=tmat_tile("travertine", "#eadfc6", 0.5),
    warm=tmat_tile("travertine", "#d39a6a", 0.6, tint="#d8a27a"),
    lawn=tmat_tile("lawn", "#6aa648", 0.95),
    mosaic=tmat_tile("mosaic", "#2f7fc4", 0.2),
    majolica=tmat_tile("majolica", "#e9c88a", 0.25),
    marble=tmat_tile("marble", "#f1ece4", 0.25),
    chrome=sm("chrome"),
    emblem=cutmat("emblem", 0.3),
    lamp=lamp_mat("pool_lamp", "#bff6ff", 3.0),
    rings=[sm("ring_" + h["key"], h["color"], 0.5, 0.0) for h in HEIGHTS],
)
parts, floor = [], []


def P_(*objs):
    parts.extend(o for o in objs if o is not None)


R0 = ROOM
CX, CZ = HX + 0.35, HZ + 0.49  # the coping's outer edge
# ================================================================================================================================
# THE LAWNS AND THE DECK
# ================================================================================================================================
# (the lawns round the room: never under the pool, whose basin goes down through the ground's level)
for nm, (a, b, c, d) in {
    "LawnNear": (-60, R0["minX"], -60, 60),
    "LawnFar": (R0["maxX"], 64, -60, 60),
    "LawnWest": (R0["minX"], R0["maxX"], -60, R0["minZ"]),
    "LawnEast": (R0["minX"], R0["maxX"], R0["maxZ"], 60),
}.items():
    P_(box(nm, a, b, GROUND_Y - 0.1, GROUND_Y, c, d, M["lawn"], 0.0))
for nm, (a, b, c, d) in {
    "DeckNear": (R0["minX"], -CX, R0["minZ"], R0["maxZ"]),
    "DeckFar": (CX, R0["maxX"], R0["minZ"], R0["maxZ"]),
    "DeckWest": (-CX, CX, R0["minZ"], -CZ),
    "DeckEast": (-CX, CX, CZ, R0["maxZ"]),
}.items():
    P_(box(nm, a, b, GROUND_Y, 0.0, c, d, M["trav"], 0.0))
# ================================================================================================================================
# THE POOL
# ================================================================================================================================
FL = -DEPTH
P_(box("PoolFloor", -HX, HX, FL - 0.1, FL, -HZ, HZ, M["mosaic"], 0.0))
for s in (-1, 1):
    P_(box("PoolWallLong", s * HX, s * (HX + 0.3), FL - 0.1, -0.04, -HZ - 0.3, HZ + 0.3, M["mosaic"], 0.0))
    P_(box("PoolWallEnd", -HX, HX, FL - 0.1, -0.04, s * HZ, s * (HZ + 0.3), M["mosaic"], 0.0))
    # the majolica band at the waterline, a tile tall (aligned to the tiles' grid: -0.25 to 0)
    P_(box("Majolica", s * (HX - 0.006), s * HX, -0.25, -0.04, -HZ, HZ, M["majolica"], 0.0))
    P_(box("Majolica", -HX, HX, -0.25, -0.04, s * (HZ - 0.006), s * HZ, M["majolica"], 0.0))
    # the coping: white marble with a rounded nose, overhanging the water a little
    P_(box("CopeLong", s * (HX - 0.05), s * CX, -0.04, 0.05, -CZ, CZ, M["marble"], 0.02))
    P_(box("CopeEnd", -HX + 0.05, HX - 0.05, -0.04, 0.05, s * (HZ - 0.05), s * CZ, M["marble"], 0.02))
    # lamps under the water along the long walls
    for z in (-6.0, -2.0, 2.0, 6.0):
        P_(cyl("PoolLamp", 0.15, 0.02, g(s * (HX - 0.005), -0.9, z), M["lamp"], 14, rot=(0, PI / 2, 0)))
# a target ring on the floor under each board, in its height's colour (where the classic paints them)
for b in BOARDS:
    zz = b["tipZ"] + b["dir"] * (1.6 + b["h"] * 0.4)
    t = torus("Target", 1.02, 0.12, g(b["x"], FL + 0.012, zz), M["rings"][b["h"]], 40, 4)
    t.scale = (1, 1, 0.08)
    P_(t)
# the club's emblem in the middle of the floor
P_(flat("Emblem", 4.8, 4.8, 0.0, FL + 0.008, 0.0, M["emblem"], turn=-PI / 2))
# the ladders, where the game's guests climb out (a rail each side curving out over the coping, three rungs)
for L in LADDERS:
    x, z, out = L["side"] * HX, L["water"]["z"], L["side"]
    for dz in (-0.42, 0.42):
        pts = [(x - out * 0.12, -1.0), (x - out * 0.12, 0.4), (x + out * 0.2, 0.82), (x + out * 0.55, 0.6), (x + out * 0.62, 0.05)]
        P_(tube("Ladder", [Vector(g(px, py, z + dz)) for px, py in pts], 0.03, M["chrome"], 4, 8))
        P_(cyl("LadderFoot", 0.06, 0.02, g(x + out * 0.62, 0.05, z + dz), M["chrome"], 10))
    for y in (-0.85, -0.45, -0.1):
        P_(rod("LadderRung", (x - out * 0.1, y, z - 0.42), (x - out * 0.1, y, z + 0.42), 0.03, M["chrome"]))
# the depth plates set in the coping
for s in (-1, 1):
    for z in (-4.0, 4.0):
        P_(flat("Depth", 0.34, 0.17, s * (HX + 0.2), 0.052, z, signmat("depth_42", 0.5), turn=s * PI / 2))
    P_(flat("NoRunning", 0.34, 0.17, s * (HX + 0.2), 0.052, 0.0, signmat("no_running", 0.5), turn=s * PI / 2))
# ================================================================================================================================
# THE MASSAGE CORNER'S WARM TILES (open to the sky)
# ================================================================================================================================
beds = sorted(MASSAGE_BEDS, key=lambda b: b["z"])
mz0, mz1 = beds[0]["z"] - 1.35, beds[-1]["z"] + 1.35
mx = beds[0]["x"]
P_(box("SpaTiles", mx - 1.4, mx + 0.9, 0.0, 0.008, mz0, mz1, M["warm"], 0.0))

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


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


n1, n2, n3 = vnoise(0.6, 3), vnoise(0.25, 5), vnoise(1.8, 9)
on_deck = rect(R0["minX"], R0["maxX"], R0["minZ"], R0["maxZ"], 0.01) * (1 - rect(-CX, CX, -CZ, CZ, 0.01))
# the wet ring round the pool, splashier at the ends under the boards; the hot tub's spill
dpool = np.maximum(np.abs(WX) - CX, np.abs(WZ) - CZ)
wet = np.clip(1 - dpool / 1.4, 0, 1) * np.clip((n2 - 0.3) * 2.0, 0, 1)
ends = np.clip(1 - (np.abs(WZ) - CZ) / 3.0, 0, 1) * (np.abs(WZ) > CZ) * (np.abs(WX) < 4.6) * (0.5 + 0.5 * n1)
tub = np.clip(1 - np.hypot((WX - TUB["x"]) / 1.6, (WZ - TUB["z"]) / 2.8), 0, 1) * (0.5 + 0.5 * n2)
lay((0.5, 0.42, 0.3), np.maximum.reduce([wet * 0.35, ends * 0.35, tub * 0.4]) * on_deck)
# each board's line: round spots in its colour, the first three stronger (where the classic draws them)
for b in BOARDS:
    for k, spot in enumerate(b["line"]):
        d_ = np.hypot(WX - spot["x"], WZ - spot["z"])
        ring = np.clip((0.27 - d_) / 0.02, 0, 1)
        inner = np.clip((0.2 - d_) / 0.02, 0, 1)
        lay(hexrgb(MARKER[b["h"]]), (ring - inner * 0.55) * (0.9 if k < 3 else 0.45))
# DIVERS QUEUE HERE between the lines, DEEP WATER beside the long sides
for s in (-1, 1):
    for x in (-1.7, 1.7):
        stencil_paint("st_divers", x, s * 13.6, 2.6, 0.5, PI / 2, (0.14, 0.25, 0.37), 0.6)
    stencil_paint("st_deep", s * (CX + 0.75), 0.0, 3.0, 0.58, PI / 2 if s < 0 else -PI / 2, (0.14, 0.25, 0.37), 0.65)
# the sun: the travertine a touch warmer and paler toward the hedges, darker in the hedges' shade
fade = np.clip((np.maximum(np.abs(WX - 1.85) - 10.0, np.abs(WZ) - 13.5)) / 2.5, 0, 1) * (0.5 + 0.5 * n3)
lay((0.62, 0.55, 0.42), fade * 0.18 * on_deck)
rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
alpha *= rect(R0["minX"], R0["maxX"], R0["minZ"], R0["maxZ"], 0.001)
img = bpy.data.images.new("dive_paint", SIZE, SIZE, alpha=True)
img.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), alpha])[::-1].astype(np.float32).ravel())
img.filepath_raw = os.path.join(SIGNS, "dive_paint.png")
img.file_format = "PNG"
img.save()
cover = plane("Paint", Pt["span"], Pt["span"], g(Pt["x0"] + Pt["span"] / 2, 0.004, Pt["z0"] + Pt["span"] / 2), signmat("dive_paint", 0.8), rot=(0, 0, 0))
floor.append(cover)

print("SHELL", tris(parts))
if LOOK:
    cover.hide_render = True
    look("shell_overview", g(0, 0, 0), 40, 55, 270, (1280, 720), 16, 30)
    look("shell_pool", g(0, -2, 0), 14, 45, 250, (1280, 720), 16, 30)
cover.hide_render = False
save_part("shell", parts)
save_part("floor", floor)
