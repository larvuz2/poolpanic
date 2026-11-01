"""The Wave Pool's planting and what lies outside its walls (the sand runs out to the painted horizon: no lawn).
- Inside: the plan's three palms, each in a round raised bed with a Malibu band and beach grass.
- Outside, all round: coconut palms in leaning groves, sea grape and hibiscus bushes, beach grass on low dunes; for the Coach Cam
  looking out, and the painted coast beyond (dist/assets/wave-club/horizon.webp, the game's ring).
- By the gate, outside: the path between two tiki torches, a ticket kiosk (TICKETS, a striped awning), a rack of beach-cruiser
  bikes, a two-tone camper van with boards on its roof rack, a sandwich board.
- Past the right end: a hammock slung between two palms, a beach volleyball court (a net, a ball in the sand), a stack of boogie
  boards.

    blender -b -P tools/venues/wave/garden.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import palm, blob  # noqa: E402
from props_kit import towel_folded  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(8812)
TAU = 2 * PI
M = dict(
    sand=tmat_tile("sand", "#e8cf9c", 1.0),
    stucco=tmat_tile("stucco", "#f7efe0", 0.88),
    malibu=tmat_tile("malibu", "#e9c879", 0.25),
    pavers=tmat_tile("pavers", "#e8d6b6", 0.7),
    teak=tmat_tile("teak", "#b57a43", 0.55),
    thatch=tmat_tile("thatch", "#c99a52", 0.95),
    post=sm("teak_dark"),
    white=sm("white"),
    cream=sm("cream"),
    coral=sm("coral"),
    teal=sm("teal"),
    sun=sm("sun"),
    navy=sm("navy"),
    sky=sm("sky"),
    red=sm("red"),
    chrome=sm("chrome"),
    iron=sm("iron"),
    black=sm("black"),
    rubber=sm("rubber"),
    rope=sm("rope"),
    canvas=sm("canvas"),
    window=sm("window", "#2d5f70", 0.12),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    seagrape=sm("seagrape", "#5f8f3a", 0.6),
    flame=lamp_mat("torch_flame", "#ffb050", 5.0),
    grass=cutmat("beach_grass", 0.8),
    hibiscus=cutmat("hibiscus", 0.7),
    bougainvillea=cutmat("bougainvillea", 0.7),
)
trees.use(
    {
        "frond": cutmat("palm_frond", 0.6),
        "bark_light": sm("palm_bark", "#9b8466", 0.9),
        "palm_boot": sm("palm_boot", "#7a5f3e", 0.95),
        "coconut": sm("coconut", "#6a4a2a", 0.6),
        "hedge": M["seagrape"],
    }
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


RM = ROOM


def outside(x, z, pad=0.0):
    return not (RM["minX"] - pad < x < RM["maxX"] + pad and RM["minZ"] - pad < z < RM["maxZ"] + pad)


def tuft(x, z, s, y0=0.0):
    out = []
    for k in range(2):
        a = k * PI / 2 + R.uniform(0, PI / 2)
        out.append(plane("Grass", s * 1.2, s, g(x, y0 + s / 2 - 0.04, z), M["grass"], rot=(PI / 2, 0, a)))
    return out


def bush(x, z, s, seed, flowers=0, fl=None):
    out = [blob("SeaGrape", g(x, s * 0.42, z), (s, s * 0.9, s * 0.65), M["seagrape"] if seed % 2 else M["leaf_dark"], seed, (9, 5), 0.25)]
    r = random.Random(seed)
    for k in range(flowers):
        a = r.uniform(0, TAU)
        sz = r.uniform(0.35, 0.5)
        p = plane("Flowers", sz, sz, (0, 0, 0), fl or M["hibiscus"], rot=(PI / 2, 0, 0))
        p.location = g(x + math.cos(a) * s * 0.85, r.uniform(0.35, 0.95) * s * 1.1, z + math.sin(a) * s * 0.85)
        p.rotation_euler = (PI / 2 - 0.2, 0, -a + PI / 2)
        out.append(p)
    return out


# ---- inside: the plan's palms in round raised beds ----------------------------------------------------------------------------
for f in (q for q in FURNITURE if q["kind"] == "palm"):
    x, z = f["x"], f["z"]
    add("inside", cyl("PalmBed", 0.52, 0.4, g(x, 0, z), M["stucco"], 20))
    add("inside", cyl("PalmBedBand", 0.53, 0.14, g(x, 0.22, z), M["malibu"], 20))
    add("inside", cyl("PalmBedSand", 0.48, 0.02, g(x, 0.4, z), M["sand"], 20))
    # (the one on the near strip, by the tower, stays short: the overview's camera looks down past it)
    h = 4.3 if x < -13 and abs(z) < 3 else 6.2 + R.uniform(-0.4, 0.6)
    add("inside", *palm(x, z, h, int(abs(x * 7 + z * 13)) + 3, y0=0.38, lean=0.08 if h < 5 else 0.14))
    for k in range(3):
        a = k * TAU / 3 + 0.4
        add("inside", *tuft(x + math.cos(a) * 0.28, z + math.sin(a) * 0.28, 0.45, 0.4))

# ---- outside: palm groves all round, bushes and grass ------------------------------------------------------------------------
spots = []
for z in range(-20, 19, 4):  # the near side (behind the overview's camera: the Coach Cam's view back)
    spots.append((-17.5 - R.uniform(0, 2.5), z + R.uniform(-1.2, 1.2), R.uniform(6.5, 9.0)))
    if R.random() < 0.3:
        spots.append((-22.0 - R.uniform(0, 4), z + R.uniform(-1.5, 1.5), R.uniform(8, 11)))
for z in range(-18, 17, 4):  # behind the wave house: crowns rising over its ends and roof
    spots.append((16.8 + R.uniform(0, 1.5), z + R.uniform(-0.8, 0.8), R.uniform(10.5, 13.5)))
for x in range(-14, 16, 3):  # past the left end (around the gate's path: kept clear)
    if abs(x) < 4:
        continue
    spots.append((x + R.uniform(-1, 1), -19.5 - R.uniform(0, 1.5) if x > -12 else -18.5, R.uniform(6.5, 9.5)))
    if R.random() < 0.4:
        spots.append((x + R.uniform(-1, 1), -26 - R.uniform(0, 4), R.uniform(8, 11)))
for x in range(-14, 16, 3):  # past the right end
    spots.append((x + R.uniform(-1, 1), 16.0 + R.uniform(0, 1.5), R.uniform(6.5, 9.5)))
    if R.random() < 0.4:
        spots.append((x + R.uniform(-1, 1), 22 + R.uniform(0, 4), R.uniform(8, 11)))
HAMMOCK = [(-6.5, 16.6), (-3.0, 17.2)]
spots = [s for s in spots if all(math.hypot(s[0] - hx, s[1] - hz) > 1.2 for hx, hz in HAMMOCK)]
spots += [(HAMMOCK[0][0], HAMMOCK[0][1], 7.0), (HAMMOCK[1][0], HAMMOCK[1][1], 7.6)]
spots = [s for s in spots if not (-3.6 < s[0] < 13 and 16 < s[1] < 21.5)]  # (the volleyball court)
spots = [s for s in spots if not (-13 < s[0] < 7 and -24 < s[1] < -16.9)]  # (the van, the kiosk, the bikes)
for k, (x, z, h) in enumerate(spots):
    add("palms", *palm(x, z, h, 100 + k, y0=0.0, lean=R.uniform(0.08, 0.22), light=True))
print("PALMS", len(spots))
for k in range(70):
    x, z = R.uniform(-28, 26), R.uniform(-30, 28)
    if not outside(x, z, 0.8) or (-3.6 < x < 13 and 16 < z < 21.5) or (-13 < x < 7 and -24 < z < -16.9) or (-2.2 < x < 2.2 and z < -16):
        continue
    add("bushes", *bush(x, z, R.uniform(0.6, 1.1), 300 + k, 4 if k % 3 == 0 else 0, M["hibiscus"] if k % 2 else M["bougainvillea"]))
for k in range(220):
    x, z = R.uniform(-30, 28), R.uniform(-32, 30)
    if not outside(x, z, 0.4) or (-2.2 < x < 2.2 and z < -16) or (-3.6 < x < 13 and 16.5 < z < 21):
        continue
    add("grass", *tuft(x, z, R.uniform(0.45, 0.8)))
# bushes along the outside of the breeze-block screens (seen through the blocks' holes) and bougainvillea climbing the piers
for zz, sgn in ((RM["minZ"] - 0.6, -1), (RM["maxZ"] + 0.6, 1)):
    x = RM["minX"] + 0.8
    while x < 14.5:
        if not (sgn < 0 and abs(x) < 2.6):
            add("hedge", *bush(x, zz + R.uniform(-0.15, 0.15), R.uniform(0.55, 0.8), int(x * 10) + (500 if sgn > 0 else 700), 3, M["bougainvillea"] if int(x) % 2 else M["hibiscus"]))
        x += R.uniform(1.4, 2.0)

# ---- by the gate, outside: tiki torches, the kiosk, the bikes, the van, the sandwich board ----------------------------------------
for s in (-1, 1):
    x, z = s * 2.3, RM["minZ"] - 1.1
    add("gate", rod("TikiPole", (x, 0, z), (x, 2.0, z), 0.06, M["post"], 8))
    add("gate", cyl("TikiCup", 0.1, 0.25, g(x, 2.0, z), M["thatch"], 10, r2=0.14))
    add("gate", sphere("Light_Torch", 0.11, g(x, 2.38, z), M["flame"], 8, 6, scale=(1, 1, 1.5)))
# the ticket kiosk: a stucco booth, a teal roof, a window, the striped awning, TICKETS
KX, KZ = 4.6, -19.6
add("gate", box("Kiosk", KX - 0.9, KX + 0.9, 0, 2.4, KZ - 0.8, KZ + 0.8, M["stucco"], 0.03))
add("gate", box("KioskRoof", KX - 1.1, KX + 1.1, 2.4, 2.6, KZ - 1.0, KZ + 1.0, M["teal"], 0.04))
add("gate", box("KioskWindow", KX - 0.6, KX + 0.6, 1.0, 1.8, KZ + 0.8, KZ + 0.82, M["window"], 0.0))
add("gate", box("KioskSill", KX - 0.7, KX + 0.7, 0.95, 1.0, KZ + 0.8, KZ + 1.05, M["teak"], 0.01))
for k in range(6):
    x0 = KX - 0.9 + k * 0.3
    add("gate", box("KioskAwning", x0, x0 + 0.3, 2.0, 2.04, KZ + 0.82, KZ + 1.4, M["coral"] if k % 2 == 0 else M["cream"], 0.0))
add("gate", plane("Tickets", 1.5, 0.45, g(KX, 2.2, KZ + 0.83), signmat("tickets", 0.5), rot=(PI / 2, 0, 0)))
add("gate", box("KioskBase", KX - 0.92, KX + 0.92, 0, 0.3, KZ - 0.82, KZ + 0.82, M["malibu"], 0.0))
# the bikes: three beach cruisers in a rack
BX, BZ = -4.6, -18.6
add("gate", box("BikeRack", BX - 1.4, BX + 1.4, 0, 0.08, BZ - 0.05, BZ + 0.05, M["iron"], 0.01))
for k, col in enumerate((M["coral"], M["teal"], M["sun"])):
    x = BX - 0.9 + k * 0.9
    bike = []
    for dz in (-0.55, 0.55):
        bike.append(torus("BikeWheel", 0.33, 0.035, g(x, 0.36, BZ + dz), M["rubber"], 20, 6, rot=(0, PI / 2, 0)))
        bike.append(rod("BikeSpoke", (x, 0.36, BZ + dz - 0.3), (x, 0.36, BZ + dz + 0.3), 0.006, M["chrome"], 4))
    bike.append(rod("BikeFrame", (x, 0.36, BZ - 0.55), (x, 0.75, BZ - 0.1), 0.03, col))
    bike.append(rod("BikeFrame", (x, 0.75, BZ - 0.1), (x, 0.75, BZ + 0.4), 0.03, col))
    bike.append(rod("BikeFrame", (x, 0.36, BZ + 0.55), (x, 0.75, BZ + 0.4), 0.03, col))
    bike.append(rod("BikeFrame", (x, 0.36, BZ - 0.1), (x, 0.75, BZ - 0.1), 0.03, col))
    bike.append(box("BikeSeat", x - 0.08, x + 0.08, 0.8, 0.86, BZ - 0.2, BZ + 0.0, M["black"], 0.02))
    bike.append(rod("BikeBars", (x - 0.28, 1.0, BZ + 0.45), (x + 0.28, 1.0, BZ + 0.45), 0.02, M["chrome"]))
    bike.append(rod("BikeStem", (x, 0.75, BZ + 0.4), (x, 1.0, BZ + 0.45), 0.025, M["chrome"]))
    bike.append(box("BikeBasket", x - 0.15, x + 0.15, 0.8, 1.0, BZ + 0.5, BZ + 0.75, M["canvas"], 0.02))
    o = join(bike, "Bike")
    o.rotation_euler = (0, 0, R.uniform(-0.08, 0.08))
    apply_all(o)
    add("gate", o)
# the camper van: two-tone, rounded, a split windscreen, surfboards on the roof rack
VX, VZ, VA = -9.4, -21.6, 0.5
van = []
van.append(box("VanLower", -2.1, 2.1, 0.35, 1.25, -0.9, 0.9, M["teal"], 0.18))
van.append(box("VanUpper", -2.05, 2.0, 1.25, 2.05, -0.88, 0.88, M["cream"], 0.25))
van.append(box("VanVee", 1.95, 2.13, 0.6, 1.25, -0.5, 0.5, M["cream"], 0.08))
for dz in (-0.42, 0.42):
    van.append(box("VanScreen", 1.98, 2.02, 1.38, 1.88, dz - 0.36, dz + 0.36, M["window"], 0.02))
for x0 in (-1.6, -0.75, 0.1, 0.95):
    for s in (-1, 1):
        van.append(box("VanWindow", x0, x0 + 0.7, 1.38, 1.85, s * 0.885, s * 0.9, M["window"], 0.0))
for x in (-1.35, 1.35):
    for s in (-1, 1):
        van.append(cyl("VanWheel", 0.36, 0.22, (x, s * 0.82, 0.36), M["rubber"], 16, rot=(PI / 2, 0, 0)))
        van.append(cyl("VanHub", 0.18, 0.24, (x, s * 0.82, 0.36), M["white"], 12, rot=(PI / 2, 0, 0)))
for s in (-1, 1):
    van.append(sphere("VanLamp", 0.11, (2.12, s * 0.62, 0.9), M["chrome"], 10, 6))
van.append(box("VanBumper", 2.1, 2.2, 0.3, 0.42, -0.9, 0.9, M["chrome"], 0.03))
van.append(box("VanBumperB", -2.2, -2.1, 0.3, 0.42, -0.9, 0.9, M["chrome"], 0.03))
for x in (-1.2, 1.0):
    van.append(box("RoofRack", x - 0.04, x + 0.04, 2.05, 2.15, -0.8, 0.8, M["chrome"], 0.01))
for k, col in enumerate((M["coral"], M["sun"])):
    van.append(box("RoofBoard", -1.6, 1.6, 2.15 + k * 0.09, 2.22 + k * 0.09, -0.5 + k * 0.5, -0.0 + k * 0.5, col, 0.08))
vo = join(van, "Van")
vo.rotation_euler = (0, 0, VA)
vo.location = g(VX, 0, VZ)
apply_all(vo)
add("gate", vo)
# the sandwich board by the gate: the surf report, the A-frame
SBX, SBZ = 2.5, RM["minZ"] - 1.8
for s in (-1, 1):
    leg = box("ABoard", SBX - 0.33, SBX + 0.33, 0, 1.0, SBZ - 0.02, SBZ + 0.02, M["teak"], 0.01)
    leg.rotation_euler = (s * 0.22, 0, 0)
    apply_all(leg)
    add("gate", leg)
add("gate", plane("ABoardFace", 0.56, 0.45, g(SBX, 0.62, SBZ + 0.13), signmat("surf_report", 0.8), rot=(PI / 2 - 0.22, 0, 0)))

# ---- past the right end: the hammock, the volleyball court, boogie boards -----------------------------------------------------
(h0x, h0z), (h1x, h1z) = HAMMOCK
pts = []
for k in range(13):
    t = k / 12
    pts.append((h0x + (h1x - h0x) * t, 1.5 - 0.65 * math.sin(t * PI), h0z + (h1z - h0z) * t))
for off in (-0.35, 0.35):
    add("right", poly_tube("HammockSide", [g(x + off * 0.15, y, z + off) for x, y, z in pts], 0.02, M["rope"], 6, 0.1))
rows = []
for k in range(13):
    x, y, z = pts[k]
    rows.append((g(x, y, z - 0.35), g(x, y - 0.06, z), g(x, y, z + 0.35)))
bm = bmesh.new()
vs = [[bm.verts.new(p) for p in row] for row in rows]
for i in range(len(vs) - 1):
    for j in range(2):
        bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
me = bpy.data.meshes.new("Hammock")
bm.to_mesh(me)
bm.free()
ham = bpy.data.objects.new("Hammock", me)
bpy.context.scene.collection.objects.link(ham)
ham.data.materials.append(M["coral"])
s_ = ham.modifiers.new("S", "SOLIDIFY")
s_.thickness = 0.02
add("right", ham)
add("right", towel_folded("HammockPillow", 0.45, 0.3, 0.12, M["sun"], None, g(h0x + 0.6, 1.0, h0z + 0.12), 0.2))
# the volleyball court: posts, a net, the boundary rope, a ball
VC = (4.5, 18.6)
for s in (-1, 1):
    add("right", cyl("NetPost", 0.06, 2.5, g(VC[0] + s * 4.0, 0, VC[1]), M["white"], 10))
add("right", box("Net", VC[0] - 4.0, VC[0] + 4.0, 1.55, 2.4, VC[1] - 0.005, VC[1] + 0.005, sm("net", "#2a2f33", 0.8), 0.0))
add("right", box("NetBand", VC[0] - 4.0, VC[0] + 4.0, 2.36, 2.44, VC[1] - 0.02, VC[1] + 0.02, M["white"], 0.0))
court = [(VC[0] - 4.5, VC[1] - 2.6), (VC[0] + 4.5, VC[1] - 2.6), (VC[0] + 4.5, VC[1] + 2.6), (VC[0] - 4.5, VC[1] + 2.6)]
for a, b in zip(court, court[1:] + court[:1]):
    add("right", box("CourtLine", min(a[0], b[0]) - 0.03, max(a[0], b[0]) + 0.03, 0.0, 0.02, min(a[1], b[1]) - 0.03, max(a[1], b[1]) + 0.03, M["coral"], 0.0))
add("right", sphere("Volleyball", 0.11, g(VC[0] + 1.6, 0.1, VC[1] + 1.1), M["white"], 12, 8))
for k, col in enumerate((M["coral"], M["teal"], M["sun"], M["sky"])):
    add("right", box("BoogieBoard", -0.3, 0.3, 0.03 * k, 0.03 * k + 0.05, -0.5, 0.5, col, 0.05))
    o = parts["right"][-1]
    o.rotation_euler = (0, 0, 0.15 * k)
    o.location = g(-1.0, 0, 16.4)
    apply_all(o)

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("garden_gate", g(0, 1.5, -20), 14, 25, 20, (1280, 720), 16, 30)
    look("garden_right", g(0, 1.5, 18), 14, 20, 200, (1280, 720), 16, 30)
save_part("garden", [o for v in parts.values() for o in v if o])
