"""The ship round the Lido Deck, in the ship's frame (the game rolls it), every piece where the classic has it (scene/cruise.mjs) so
the game's moving parts (the screen's movie, the radar, the signal flags, the funnel's smoke) land on it:
- the superstructure at the bow end: three tiers of white steel stepping back, each a band of tall windows holding the sunset (fal),
  white sills and navy eyebrows, glass windscreens with teak caps along each tier's deck; at deck level the Lido Café's glass front
  with its double doors, chrome mullions, brass sconces and a striped awning, SUNSET BUFFET over it, the fuse locker beside it;
- the giant screen's frame (black, a gold deco rim, speaker stacks either side, SAIL-AWAY CINEMA over it; the movie is the game's),
  PANIC OF THE SEAS across the top tier;
- the bridge across the top with its wings out past the sides, dark windows all round, a navy cap, the navigation lights (red to
  port, green to starboard), the mast with its yard, the radome and the masthead light, the halyards the game's signal flags hang
  from;
- the funnel: an oval stack raked aft, signal red with a white band and a black top, the line's crest on both sides, exhaust pipes,
  a brass whistle;
- the lifeboats two decks down on both sides: orange hulls under white canopies, LIFEBOAT 7 to 13, on white davits with their falls;
- festoon lights along both rails on chrome lamp posts (`Light_Festoon`), lit by the game after the sun goes.

    blender -b -P tools/venues/cruise/props_ship.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(1912)
M = dict(
    paint=tmat_tile("paint", "#f1f3f4", 0.4),
    facade=tmat_tile("facade", "#dfe8ee", 0.3),
    canvas=tmat_tile("canvas", "#efe6d0", 0.85),
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    white=sm("white"),
    navy=sm("navy"),
    navy_dark=sm("navy_dark"),
    red=sm("red"),
    orange=sm("orange"),
    black=sm("black"),
    gold=sm("gold"),
    brass=sm("brass"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    grey=sm("grey"),
    grey_dark=sm("grey_dark"),
    teak_cap=sm("teak"),
    rope=sm("rope"),
    glass=sm("glass"),
    dark_glass=sm("dark_glass", "#1e3a4f", 0.08, 0.6),
    rubber=sm("rubber"),
    bulb=lamp_mat("festoon_bulb", "#ffe6b0", 3.0),
    sconce=lamp_mat("sconce_glass", "#ffd79a", 3.0),
    nav_red=lamp_mat("nav_red", "#ff3a3a", 4.0),
    nav_green=lamp_mat("nav_green", "#3aff7a", 4.0),
    masthead=lamp_mat("masthead", "#fff6e0", 4.0),
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def face(name, w, h, x, y, z, theta, m):
    return plane(name, w, h, g(x, y, z), m, rot=(PI / 2, 0, theta))


def light(kind, x, y, z, r=0.05, m=None):
    return sphere("Light_" + kind, r, g(x, y, z), m or M["bulb"], 8, 6)


# ================================================================================================================================
# THE SUPERSTRUCTURE
# ================================================================================================================================
TIERS = [(BOW, 0.0, 4.4, 15.6), (BOW + 1.2, 4.4, 8.8, 15.0), (BOW + 2.6, 8.8, 13.2, 14.2)]
for i, (x, y0, y1, hz) in enumerate(TIERS):
    # the block: white steel; its face a band of windows (the facade's own picture), a sill and a navy eyebrow over it
    add("super", box("Tier", x, x + 18, y0, y1, -hz, hz, M["paint"], 0.06))
    add("super", box("TierFace", x - 0.04, x, y0 + 0.2, y1 - 0.25, -hz + 0.3, hz - 0.3, M["facade"], 0.0))
    add("super", box("Eyebrow", x - 0.6, x + 0.1, y1 - 0.28, y1 - 0.14, -hz, hz, M["navy"], 0.04))
    add("super", box("EyebrowGold", x - 0.62, x - 0.58, y1 - 0.25, y1 - 0.2, -hz, hz, M["gold"], 0.0))
    add("super", box("Sill", x - 0.35, x, y0, y0 + 0.16, -hz, hz, M["white"], 0.03))
    # rounded deco ends: half cylinders at each side of the face
    for s in (-1, 1):
        c = cyl("TierRound", 0.6, y1 - y0, g(x + 0.6, y0, s * hz), M["paint"], 20)
        add("super", c)
    if i > 0:
        # the windscreen along the tier below's deck, in front of this tier
        xp, hzp = TIERS[i - 1][0], TIERS[i - 1][3]
        add("super", box("TierGlass", xp + 0.05, xp + 0.07, y0, y0 + 1.0, -hzp + 0.3, hzp - 0.3, M["glass"], 0.0))
        add("super", box("TierCap", xp, xp + 0.12, y0 + 1.0, y0 + 1.07, -hzp + 0.3, hzp - 0.3, M["teak_cap"], 0.02))
        for z in np.arange(-hzp + 0.4, hzp - 0.3, 2.4):
            add("super", rod("TierPost", (xp + 0.06, y0, z), (xp + 0.06, y0 + 1.0, z), 0.025, M["chrome"]))
# the Lido Café's glass front at deck level: chrome mullions, double doors in the middle, an awning
for z in np.arange(-14.0, 14.01, 2.0):
    add("cafe", box("CafeMullion", BOW - 0.08, BOW - 0.02, 0.2, 4.1, z - 0.04, z + 0.04, M["chrome"], 0.01))
add("cafe", box("Glass_Cafe", BOW - 0.06, BOW - 0.05, 0.2, 4.1, -14.0, 14.0, M["dark_glass"], 0.0))
for s in (-1, 1):
    add("cafe", box("CafeDoor", BOW - 0.1, BOW - 0.06, 0.05, 2.5, s * 0.05, s * 0.95, M["glass"], 0.0))
    add("cafe", box("CafeDoorFrame", BOW - 0.12, BOW - 0.05, 0.05, 2.5, s * 0.92, s * 0.98, M["brass"], 0.01))
    add("cafe", rod("CafeHandle", (BOW - 0.16, 0.9, s * 0.15), (BOW - 0.16, 1.5, s * 0.15), 0.02, M["brass"]))
add("cafe", box("CafeDoorTop", BOW - 0.12, BOW - 0.05, 2.5, 2.58, -1.0, 1.0, M["brass"], 0.01))
add("cafe", face("Buffet", 5.0, 1.0, BOW - 0.12, 3.15, 0.0, -PI / 2, signmat("buffet", 0.5)))
# brass sconces between the panes, lit after dusk
for z in (-11.0, -7.0, -3.0, 3.0, 7.0, 11.0):
    add("cafe", cyl("SconceBack", 0.12, 0.04, g(BOW - 0.08, 2.6, z), M["brass"], 12, rot=(0, PI / 2, 0)))
    add("cafe", cyl("SconceArm", 0.025, 0.2, g(BOW - 0.28, 2.6, z), M["brass"], 6, rot=(0, PI / 2, 0)))
    add("cafe", cyl("Light_Sconce", 0.1, 0.24, g(BOW - 0.32, 2.62, z), M["sconce"], 12, r2=0.13))
# the striped awning along the café's front, scalloped
for s in (-1, 1):
    za, zb = (-14.6, -2.0) if s < 0 else (2.0, 14.6)
    aw = box("Awning", BOW - 1.3, BOW, 3.45, 3.52, za, zb, M["canvas"], 0.0)
    aw.rotation_euler = (0, 0, 0)
    add("cafe", aw)
    for z in np.arange(za + 0.25, zb, 0.5):
        add("cafe", cyl("Scallop", 0.25, 0.04, g(BOW - 1.3, 3.33, z), M["canvas"], 10, rot=(0, PI / 2, 0)))
    add("cafe", box("AwningValance", BOW - 1.32, BOW - 1.28, 3.3, 3.52, za, zb, M["canvas"], 0.0))
    for z in (za + 0.3, (za + zb) / 2, zb - 0.3):
        add("cafe", rod("AwningStay", (BOW - 1.28, 3.48, z), (BOW, 4.2, z), 0.02, M["chrome"]))
# the fuse locker the game's fuse box hangs on, DANGER over it
FB = FIXTURES["fuseBox"]
add("cafe", box("FuseLocker", FB["x"] + 0.18, BOW, 0.0, 2.5, FB["z"] - 0.8, FB["z"] + 0.8, M["grey"], 0.03))
add("cafe", face("Danger", 1.1, 0.45, FB["x"] + 0.16, 2.72, FB["z"], -PI / 2, signmat("danger", 0.5)))

# ================================================================================================================================
# THE SCREEN'S FRAME (the movie is the game's), the cinema's marquee, the ship's name
# ================================================================================================================================
SW, SH, SY = 12.0, 6.75, 4.6
sx = BOW + 0.9
add("screen", box("ScreenFrame", sx - 0.2, sx + 0.2, SY - 0.25, SY + SH + 0.25, -SW / 2 - 0.25, SW / 2 + 0.25, M["black"], 0.08))
for (a, b) in ((-SW / 2 - 0.27, -SW / 2 - 0.2), (SW / 2 + 0.2, SW / 2 + 0.27)):
    add("screen", box("ScreenGold", sx - 0.24, sx - 0.18, SY - 0.27, SY + SH + 0.27, a, b, M["gold"], 0.0))
for y in (SY - 0.27, SY + SH + 0.2):
    add("screen", box("ScreenGold", sx - 0.24, sx - 0.18, y, y + 0.07, -SW / 2 - 0.27, SW / 2 + 0.27, M["gold"], 0.0))
for s in (-1, 1):
    zc = s * (SW / 2 + 1.0)
    add("screen", box("Speaker", sx - 0.3, sx + 0.3, SY, SY + 3.2, zc - 0.6, zc + 0.6, M["black"], 0.05))
    for y in (SY + 0.8, SY + 2.2):
        add("screen", cyl("Cone", 0.42, 0.06, g(sx - 0.32, y, zc), M["grey_dark"], 18, rot=(0, PI / 2, 0)))
        add("screen", cyl("Dust", 0.12, 0.08, g(sx - 0.36, y, zc), M["grey"], 12, rot=(0, PI / 2, 0)))
# (the cinema's marquee and the belly flop banner hang on the tier-one windscreen, either side of the screen)
add("screen", face("Cinema", 5.2, 0.97, BOW - 0.02, 4.95, 10.4, -PI / 2, signmat("cinema", 0.5)))
add("screen", face("BellyFlop", 6.0, 1.29, BOW - 0.02, 4.95, -10.4, -PI / 2, signmat("belly_flop", 0.5)))
x3 = TIERS[2][0]
add("screen", face("ShipName", 14.0, 1.75, x3 - 0.06, 12.35, 0.0, -PI / 2, signmat("ship_name", 0.4)))

# ================================================================================================================================
# THE BRIDGE, THE MAST, THE HALYARDS
# ================================================================================================================================
bx = BOW + 6
add("bridge", box("Bridge", bx, bx + 7, 13.2, 16.2, -18.0, 18.0, M["paint"], 0.08))
add("bridge", box("Glass_Bridge", bx - 0.06, bx - 0.02, 14.4, 15.7, -17.6, 17.6, M["dark_glass"], 0.0))
for z in np.arange(-17.0, 17.1, 1.4):
    add("bridge", box("BridgeMullion", bx - 0.08, bx - 0.04, 14.4, 15.7, z - 0.04, z + 0.04, M["white"], 0.0))
add("bridge", box("BridgeCap", bx - 0.1, bx + 7.1, 16.2, 16.45, -18.2, 18.2, M["navy"], 0.05))
add("bridge", box("BridgeVisor", bx - 0.6, bx, 15.75, 15.9, -17.8, 17.8, M["white"], 0.03))
for s, m in ((-1, "nav_red"), (1, "nav_green")):
    add("bridge", box("NavBox", bx + 1.0, bx + 1.6, 15.4, 16.0, s * 18.0, s * 18.25, M["black"], 0.02))
    add("bridge", box("NavLamp", bx + 1.1, bx + 1.5, 15.5, 15.9, s * 18.25, s * 18.32, M[m], 0.01))
mx = bx + 4
add("bridge", cyl("Mast", 0.28, 12.0, g(mx, 16.2, 0.0), M["white"], 16, r2=0.18))
add("bridge", box("Yard", mx - 0.1, mx + 0.1, 25.4, 25.6, -2.5, 2.5, M["white"], 0.02))
add("bridge", sphere("Radome", 1.2, g(mx, 29.2, 0.0), M["white"], 20, 12))
add("bridge", cyl("RadomeFoot", 0.4, 0.8, g(mx, 27.6, 0.0), M["white"], 12))
add("bridge", sphere("Masthead", 0.14, g(mx, 30.6, 0.0), M["masthead"], 10, 6))
for s in (-1, 1):
    add("bridge", sphere("YardLamp", 0.09, g(mx, 25.4, s * 2.4), M["masthead"], 8, 5))
    # the halyards the game's signal flags hang from (scene/cruise.mjs: from the masthead down to the deck's forward corners)
    a = Vector((mx, 28.0, s * 0.2))
    b = Vector((BOW - 0.6, 4.2, s * 14.8))
    pts = []
    for t in np.linspace(0, 1, 27):
        p = a.lerp(b, t)
        pts.append(Vector(g(p.x, p.y - math.sin(t * PI) * 2.4, p.z)))
    add("bridge", tube("Halyard", pts, 0.015, M["rope"], 1, 5))
    add("bridge", cyl("Cleat", 0.06, 0.3, g(BOW - 0.6, 4.05, s * 14.8), M["brass"], 8))

# ================================================================================================================================
# THE FUNNEL
# ================================================================================================================================
fx = bx + 9
F = []
F.append(cyl("Funnel", 2.5, 8.5, (0, 0, 0), M["red"], 32, r2=2.0))
# (the classic's heights: the band round 19.2 m, the black top from 24.0; the stack tapers 2.5 to 2.0)
F.append(cyl("FunnelBand", 2.37, 1.3, (0, 0, 2.4), M["white"], 32, r2=2.3))
F.append(cyl("FunnelCap", 2.06, 0.9, (0, 0, 7.85), M["black"], 32, r2=2.0))
F.append(cyl("FunnelLip", 2.08, 0.12, (0, 0, 8.6), M["black"], 32))
for dx in (-0.6, 0.7):
    F.append(cyl("Exhaust", 0.32, 1.4, (dx, 0, 8.3), M["grey_dark"], 14))
for o in F:
    o.scale = (1.45, 1, 1)
funnel = join(F, "Funnel")
funnel.location = g(fx, 16.15, 0.0)
funnel.rotation_euler = (0, -0.12, 0)
apply_all(funnel)
add("funnel", funnel)
add("funnel", box("FunnelHouse", fx - 3.8, fx + 3.8, 13.2, 16.2, -3.4, 3.4, M["paint"], 0.1))
for s in (-1, 1):
    # (on the stack's side, 4 m up: it is 2.26 m out there and raked 0.49 m aft)
    add("funnel", plane("Crest", 2.2, 2.2, g(fx - 0.49, 20.2, s * 2.31), signmat("crest", 0.4), rot=(PI / 2, 0, 0 if s > 0 else PI)))
add("funnel", cyl("Whistle", 0.14, 0.9, g(fx - 2.9, 21.0, 0.0), M["brass"], 12, r2=0.22, rot=(0, -0.3, 0)))

# ================================================================================================================================
# THE LIFEBOATS on their davits, two decks down on both sides
# ================================================================================================================================
for s in (-1, 1):
    for k, x in enumerate((-10.5, -2.5, 5.5, 13.5)):
        zc = s * (HULL + 1.9)
        B = []
        B.append(box("BoatHull", x - 3.6, x + 3.6, -7.4, -6.2, zc - 1.4, zc + 1.4, M["orange"], 0.45))
        B.append(box("BoatBow", x + 3.2, x + 4.0, -7.2, -6.3, zc - 0.9, zc + 0.9, M["orange"], 0.4))
        B.append(box("BoatStern", x - 4.0, x - 3.2, -7.1, -6.3, zc - 1.0, zc + 1.0, M["orange"], 0.35))
        B.append(box("BoatCanopy", x - 3.3, x + 3.3, -6.25, -5.0, zc - 1.2, zc + 1.2, M["white"], 0.45))
        B.append(box("BoatWindows", x - 2.8, x + 2.8, -5.85, -5.55, zc - 1.22, zc + 1.22, M["dark_glass"], 0.05))
        B.append(box("BoatRub", x - 3.65, x + 3.65, -6.35, -6.2, zc - 1.45, zc + 1.45, M["white"], 0.06))
        B.append(face("BoatName", 2.2, 0.7, x, -6.75, zc + s * 1.43, 0 if s > 0 else PI, signmat(f"lifeboat_{7 + 2 * k}", 0.5)))
        add("boats", *B)
        for dx in (-3.1, 3.1):
            add("boats", box("Davit", x + dx - 0.14, x + dx + 0.14, -8.2, -4.6, s * (HULL + 0.18), s * (HULL + 0.46), M["white"], 0.04))
            add("boats", box("DavitArm", x + dx - 0.12, x + dx + 0.12, -4.85, -4.6, s * (HULL + 0.3), s * (HULL + 2.1), M["white"], 0.04))
            add("boats", rod("Fall", (x + dx, -4.85, zc), (x + dx, -5.0, zc), 0.03, M["rope"]))
            add("boats", cyl("Block", 0.12, 0.2, g(x + dx, -5.0, zc), M["brass"], 10))
# a seagull's nest on the third boat, port: two eggs (the culprit is on the deck)
add("boats", cyl("Nest", 0.4, 0.2, g(5.5, -5.0, -(HULL + 1.9)), sm("nest", "#9a7a4a", 0.95), 12, r2=0.5))
for dz in (-0.1, 0.12):
    add("boats", sphere("Egg", 0.09, g(5.5 + dz, -4.83, -(HULL + 1.9) + dz), M["white"], 10, 6, scale=(1, 1, 1.3)))

# ================================================================================================================================
# FESTOONS along both rails, on chrome lamp posts
# ================================================================================================================================
POSTS = [-15.3, -7.3, 0.7, 8.7, 16.9]
for s in (-1, 1):
    z = s * 16.15
    for x in POSTS:
        add("festoon", rod("LampPost", (x, 1.2, z), (x, 3.7, z), 0.04, M["chrome"]))
        add("festoon", sphere("PostKnob", 0.07, g(x, 3.75, z), M["brass"], 10, 6))
    for a, b in zip(POSTS[:-1], POSTS[1:]):
        pts = []
        for t in np.linspace(0, 1, 17):
            pts.append(Vector(g(a + (b - a) * t, 3.65 - math.sin(t * PI) * 0.42, z)))
        add("festoon", tube("FestoonWire", pts, 0.008, M["black"], 1, 4))
        n = int((b - a) / 0.9)
        for q in range(1, n):
            t = q / n
            add("festoon", light("Festoon", a + (b - a) * t, 3.55 - math.sin(t * PI) * 0.42, z, 0.055))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("ship_super", g(BOW + 6, 8, 0), 34, 12, 270, (1280, 720), 16, 35)
    look("ship_funnel", g(fx, 20, 0), 18, 10, 300, (1280, 720), 16, 35)
    look("ship_boats", g(0, -6, 18.4), 14, 5, 160, (1280, 720), 16, 35)
    look("ship_rail", g(-6, 2.5, 15.6), 10, 12, 250, (1280, 720), 16, 35)
save_part("ship", [o for v in parts.values() for o in v if o])
