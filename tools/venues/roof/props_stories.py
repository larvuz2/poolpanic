"""The Rooftop Pool's stories at the edge of play (the creator: "Quirky! Use same character as references if you are adding
posters or stuff"), in game coordinates, all of them along the rails, past the roof's edge or on the lift cores, never where a
guest walks or waits:
- the window cleaner's cradle hung off the far edge by the bar, its machine on the roof's corner and its jib over the drop:
  buckets, a squeegee, a thermos, a lunch box, a radio, BACK IN 5 MINUTES (since Tuesday), a pigeon asleep on its rail;
- the phone net off the far edge in the middle: a net on steel arms with what fell in it (a cracked phone in a pink case, a
  flamingo flip-flop, a straw hat, a toupee, a duck in sunglasses, a selfie stick) and DAYS WITHOUT A PHONE GOING OVER THE EDGE: 0
  on the rail over it;
- the coin binoculars at the near corners (SEE YOUR HOUSE!);
- the champagne tower by the bar's end, the bellhop's luggage cart by the DJ's (suitcases, a golf bag, a flamingo float), the Sky
  Concierge's desk by the VIP lift (a bell, a guest book);
- on the lift cores, in bronze frames, the pictures with our characters in them (GPT Image 2.5, the coaches as references):
  HOTEL VERTIGO · DON'T LOOK DOWN, the Wall of Shame, DJ SPLASH's gig poster, the Employee of the Month (Coach Waters, every
  month since opening); ALTITUDE 185 m, PIGEONS ARE NOT GUESTS, the pool's rules;
- the pigeons (fal): on the rails, the cradle, the net, the canopies.

    blender -b -P tools/venues/roof/props_stories.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(312)
M = dict(
    teak=tmat_tile("teak", "#b98d5c", 0.55),
    marble=tmat_tile("marble", "#f1ece4", 0.25),
    granite=tmat_tile("granite", "#151618", 0.25),
    rattan=tmat_tile("rattan", "#c79a5a", 0.8),
    bronze=sm("bronze"),
    brass=sm("brass"),
    gold=sm("gold"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    grey=sm("grey"),
    grey_dark=sm("grey_dark"),
    ink=sm("ink"),
    black=sm("black"),
    safety=sm("safety"),
    coral=sm("coral"),
    blue=sm("blue"),
    red=sm("red"),
    pink=sm("pink"),
    teal=sm("teal"),
    cream=sm("cream"),
    yellow=sm("yellow"),
    velvet=sm("velvet"),
    rubber=sm("rubber"),
    rope=sm("rope"),
    glass=sm("glass"),
    bottle_g=sm("bottle_g", "#2f7a46", 0.15),
    suit_a=sm("suit_a", "#c06a3c", 0.6),
    suit_b=sm("suit_b", "#2f4f6e", 0.5),
    suit_c=sm("suit_c", "#e8dcc0", 0.6),
    champagne=sm("champagne", "#f3d98a", 0.1),
    net=cutmat("net", 0.9),
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


lb = box
EX1, EZ = EDGE["x1"], EDGE["z"]
RAILC = 1.13  # the rail's cap


def sheet(name, nx, nz, at, m):
    """A grid with UVs 0..1 (u along x, v along z) whose vertices `at(u, v)` places in game coordinates."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=nx, y_segments=nz, size=0.5)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x + 0.5, l.vert.co.y + 0.5)
    for v in bm.verts:
        v.co = Vector(g(*at(v.co.x + 0.5, v.co.y + 0.5)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return o


def lying(name, cut, size, x, y, z, turn):
    """A cut-out lying face up (the camera looks down on it), `size` its longer side."""
    img = bpy.data.images.load(os.path.join(TEX, cut + "_alpha.png"))
    a = img.size[0] / img.size[1]
    bpy.data.images.remove(img)
    w, h = (size, size / a) if a >= 1 else (size * a, size)
    return plane(name, w, h, g(x, y, z), cutmat(cut, 0.6), rot=(0, 0, turn))


# ================================================================================================================================
# THE WINDOW CLEANER'S CRADLE: the machine on the corner by the bar, its jib over the drop, the cradle hung off the far edge
# ================================================================================================================================
BX, BZ = 4.1, -15.9
JT = (5.65, 4.35, -11.6)  # the jib's tip
o = [
    box("BMU", BX - 0.42, BX + 0.42, 0.0, 1.05, BZ - 0.45, BZ + 0.45, M["safety"], 0.04),
    box("BMUStripe", BX - 0.43, BX + 0.43, 0.75, 0.85, BZ - 0.46, BZ + 0.46, M["ink"], 0.0),
    box("BMUTrack", BX - 0.5, BX + 0.5, 0.0, 0.06, BZ - 0.55, BZ + 0.55, M["grey_dark"], 0.0),
    cyl("BMUMast", 0.16, 3.4, g(BX, 1.05, BZ), M["safety"], 14),
    cyl("BMUHead", 0.26, 0.4, g(BX, 4.3, BZ), M["safety"], 14),
    cyl("BMUWinch", 0.14, 0.5, g(BX, 4.45, BZ - 0.25), M["grey_dark"], 12, rot=(0, PI / 2, 0)),
]
for dy in (0.0, 0.32):
    o.append(rod("Jib", (BX, 4.35 + dy, BZ), (JT[0], JT[1] + dy * 0.6, JT[2]), 0.05 if dy == 0 else 0.035, M["safety"]))
for t in np.linspace(0.08, 0.92, 7):
    a = (BX + (JT[0] - BX) * t, 4.35 + (JT[1] - 4.35) * t, BZ + (JT[2] - BZ) * t)
    b = (BX + (JT[0] - BX) * (t + 0.06), 4.67 + (JT[1] + 0.19 - 4.67) * (t + 0.06), BZ + (JT[2] - BZ) * (t + 0.06))
    o.append(rod("JibBrace", a, b, 0.02, M["safety"]))
o.append(box("JibTip", JT[0] - 0.15, JT[0] + 0.15, JT[1] - 0.15, JT[1] + 0.1, JT[2] - 0.6, JT[2] + 0.6, M["safety"], 0.02))
add("cradle", *o)
# the cradle: a steel basket 2.6 m long, hung from two cables
C0, C1, CZ0, CZ1, CY = 5.2, 6.05, -12.9, -10.3, -0.3
o = [
    box("CradleFloor", C0, C1, CY, CY + 0.06, CZ0, CZ1, M["grey"], 0.0),
    box("CradleKick", C0, C1, CY + 0.06, CY + 0.25, CZ0, CZ0 + 0.03, M["grey"], 0.0),
    box("CradleKick", C0, C1, CY + 0.06, CY + 0.25, CZ1 - 0.03, CZ1, M["grey"], 0.0),
    box("CradleKick", C0, C0 + 0.03, CY + 0.06, CY + 0.25, CZ0, CZ1, M["grey"], 0.0),
    box("CradleKick", C1 - 0.03, C1, CY + 0.06, CY + 0.25, CZ0, CZ1, M["grey"], 0.0),
]
for y in (CY + 0.55, CY + 1.1):
    for x in (C0 + 0.02, C1 - 0.02):
        o.append(rod("CradleRail", (x, y, CZ0), (x, y, CZ1), 0.025, M["steel"]))
    for z in (CZ0 + 0.02, CZ1 - 0.02):
        o.append(rod("CradleRail", (C0, y, z), (C1, y, z), 0.025, M["steel"]))
for x in (C0 + 0.02, C1 - 0.02):
    for z in np.linspace(CZ0 + 0.02, CZ1 - 0.02, 4):
        o.append(rod("CradlePost", (x, CY, z), (x, CY + 1.1, z), 0.02, M["steel"]))
for z in (CZ0 + 0.3, CZ1 - 0.3):
    o.append(rod("CradleCable", ((C0 + C1) / 2, CY + 1.1, z), (JT[0], JT[1] - 0.1, JT[2] + (0.4 if z > JT[2] else -0.4)), 0.012, M["ink"]))
    o.append(rod("CradleStirrup", ((C0 + C1) / 2, CY + 1.1, z), ((C0 + C1) / 2, CY + 1.5, z), 0.03, M["safety"]))
# what's in it: buckets, a squeegee, a thermos, a lunch box, a radio
o += [
    cyl("Bucket", 0.15, 0.3, g(5.45, CY + 0.06, -12.4), M["coral"], 14, r2=0.18),
    cyl("Bucket", 0.15, 0.3, g(5.75, CY + 0.06, -12.1), M["blue"], 14, r2=0.18),
    cyl("Suds", 0.17, 0.02, g(5.45, CY + 0.34, -12.4), sm("suds", "#f4f8fb", 0.9), 14),
    rod("SqueegeePole", (5.35, CY + 0.06, -11.0), (5.6, CY + 1.6, -11.3), 0.02, M["chrome"]),
    box("SqueegeeBlade", 5.5, 5.7, CY + 1.55, CY + 1.65, -11.6, -11.0, M["rubber"], 0.0),
    cyl("Thermos", 0.06, 0.32, g(5.9, CY + 0.06, -10.7), sm("thermos", "#2a6e3a", 0.4), 12),
    cyl("ThermosCup", 0.065, 0.06, g(5.9, CY + 0.38, -10.7), M["chrome"], 12),
    box("LunchBox", 5.5, 5.8, CY + 0.06, CY + 0.22, -10.75, -10.5, M["red"], 0.02),
    box("Radio", 5.75, 5.98, CY + 0.06, CY + 0.25, -11.6, -11.3, M["teal"], 0.02),
    rod("RadioAerial", (5.95, CY + 0.25, -11.35), (5.95, CY + 0.7, -11.5), 0.006, M["chrome"]),
    torus("RopeCoil", 0.2, 0.03, g(5.75, CY + 0.08, -12.65), M["rope"], 16, 5),
    face("CleanerSign", 0.9, 0.45, C0 - 0.01, CY + 0.8, -11.6, -PI / 2, signmat("cleaner", 0.5)),
]
add("cradle", *o)
add("cradle", card("CradlePigeon", "pigeon_asleep", 0.3, C0 + 0.02, CY + 1.12, -12.3, -PI / 2 - 0.3))
add("cradle", card("JibPigeon", "pigeon_bling", 0.32, BX + (JT[0] - BX) * 0.7, 4.35 + (JT[1] - 4.35) * 0.7 + 0.37, BZ + (JT[2] - BZ) * 0.7, -PI / 2 + 0.3))

# ================================================================================================================================
# THE PHONE NET off the far edge, and what fell in it
# ================================================================================================================================
NX0, NX1, NZ0, NZ1 = EX1 + 0.03, EX1 + 1.35, -3.25, 3.25


def net_at(u, v):
    x = NX0 + (NX1 - NX0) * u
    z = NZ0 + (NZ1 - NZ0) * v
    sag = math.sin(u * PI) * 0.35 + math.sin(v * PI) * 0.12
    return (x, -0.12 + 0.18 * u - sag, z)


add("net", sheet("PhoneNet", 6, 24, net_at, M["net"]))
for z in np.linspace(NZ0, NZ1, 6):
    add("net",
        rod("NetArm", (EX1 + 0.02, -0.25, z), (NX1, 0.06, z), 0.025, M["steel"]),
        rod("NetStrut", (EX1 + 0.02, -0.75, z), (EX1 + 0.85, -0.03, z), 0.02, M["steel"]))
add("net",
    rod("NetRim", (NX1, 0.06, NZ0), (NX1, 0.06, NZ1), 0.03, M["steel"]),
    rod("NetRim", (EX1 + 0.03, -0.12, NZ0), (EX1 + 0.03, -0.12, NZ1), 0.025, M["steel"]))
for name, cut, size, u, v, turn in (
    ("NetPhone", "drop_phone", 0.32, 0.5, 0.35, 0.4),
    ("NetFlipFlop", "drop_flipflop", 0.42, 0.42, 0.62, -0.7),
    ("NetHat", "drop_hat", 0.7, 0.55, 0.15, 0.2),
    ("NetToupee", "drop_toupee", 0.4, 0.6, 0.82, 1.2),
    ("NetDuck", "drop_duck", 0.36, 0.38, 0.48, 0.0),
    ("NetStick", "drop_stick", 0.8, 0.5, 0.92, 1.1),
    ("NetPhone", "drop_phone", 0.28, 0.62, 0.55, -1.0),
):
    x, y, z = net_at(u, v)
    add("net", lying(name, cut, size, x, y + 0.02, z, turn))
add("net",
    card("NetPigeon", "pigeon_bling", 0.32, NX1, 0.08, -1.8, -PI / 2 - 0.5),
    card("NetPigeon", "pigeon_cherry", 0.3, NX1, 0.08, 2.1, -PI / 2 + 0.4))
# the counter on the rail over it, facing the pool
add("net",
    face("PhoneNetSign", 1.05, 0.49, RAIL - 0.03, 0.66, 0.0, -PI / 2, signmat("phone_net", 0.5)),
    box("PhoneNetBack", RAIL - 0.025, RAIL - 0.01, 0.4, 0.92, -0.56, 0.56, M["ink"], 0.01))

# ================================================================================================================================
# THE COIN BINOCULARS at the near corners, looking out over the city
# ================================================================================================================================
for s in (-1, 1):
    bx_, bz_ = -13.6, s * 15.95
    yaw = 0.0 if s > 0 else PI  # (their lenses out, +z or -z)
    o = [
        cyl("BinoFoot", 0.2, 0.06, g(0, 0, 0), M["granite"], 16),
        cyl("BinoPost", 0.07, 1.05, g(0, 0.06, 0), M["teal"], 12),
        lb("BinoBox", -0.16, 0.16, 1.05, 1.32, -0.14, 0.14, M["teal"], 0.04),
        lb("CoinSlot", -0.03, 0.03, 1.2, 1.26, -0.15, -0.14, M["brass"], 0.0),
        face("BinoPlate", 0.34, 0.15, 0, 1.18, -0.146, PI, signmat("binoculars", 0.5)),
        lb("BinoVisor", -0.2, 0.2, 1.32, 1.42, -0.08, 0.06, M["ink"], 0.02),
    ]
    for dx in (-0.09, 0.09):
        o.append(cyl("BinoTube", 0.07, 0.42, g(dx, 1.4, -0.2), M["teal"], 14, r2=0.09, rot=(PI / 2 - 0.15, 0, 0)))
        o.append(cyl("BinoLens", 0.075, 0.02, g(dx, 1.47, 0.2), M["glass"], 14, rot=(PI / 2 - 0.15, 0, 0)))
    add("edges", yawed(o, bx_, bz_, yaw, "Binoculars"))

# ================================================================================================================================
# THE CHAMPAGNE TOWER by the bar's end; THE LUGGAGE CART by the DJ's; THE SKY CONCIERGE by the VIP lift
# ================================================================================================================================
cx, cz = -1.55, -15.85
o = [
    cyl("ChampTable", 0.45, 0.04, g(cx, 0.92, cz), M["marble"], 24),
    cyl("ChampStem", 0.05, 0.9, g(cx, 0.02, cz), M["brass"], 10),
    cyl("ChampFoot", 0.28, 0.03, g(cx, 0.0, cz), M["brass"], 18),
]
tiers = [(10, 0.3), (6, 0.2), (3, 0.11), (1, 0.0)]
y = 0.96
for n, r in tiers:
    for k in range(n):
        a = k * 2 * PI / n + (0.3 if n == 6 else 0)
        px, pz = cx + r * math.cos(a), cz + r * math.sin(a)
        o += [
            cyl("CoupeStem", 0.008, 0.08, g(px, y, pz), M["glass"], 6),
            cyl("Coupe", 0.03, 0.035, g(px, y + 0.08, pz), M["glass"], 10, r2=0.06),
            cyl("Fizz", 0.055, 0.01, g(px, y + 0.105, pz), M["champagne"], 10),
        ]
    y += 0.115
bt = cyl("PouringBottle", 0.045, 0.32, g(0, 0, 0), M["bottle_g"], 10)
bt.rotation_euler = (0.0, 2.2, 0.3)
bt.location = g(cx + 0.22, y + 0.2, cz - 0.05)
o.append(bt)
add("edges", *o)
add("edges", card("ChampPigeon", "pigeon_brolly", 0.32, cx + 0.5, 0.0, cz + 0.25, 0.5))
# the luggage cart
lx, lz = -1.65, 15.85
o = [
    box("CartDeck", lx - 0.55, lx + 0.55, 0.12, 0.18, lz - 0.32, lz + 0.32, M["velvet"], 0.02),
    box("CartDeckRim", lx - 0.57, lx + 0.57, 0.1, 0.13, lz - 0.34, lz + 0.34, M["brass"], 0.01),
]
for dx in (-0.45, 0.45):
    for dz in (-0.28, 0.28):
        o.append(cyl("CartWheel", 0.06, 0.04, g(lx + dx, 0.06, lz + dz), M["rubber"], 12, rot=(PI / 2, 0, 0)))
    o.append(rod("CartUpright", (lx + dx, 0.18, lz), (lx + dx, 1.75, lz), 0.02, M["brass"]))
o.append(tube("CartArch", [Vector(g(lx - 0.45, 1.75, lz)), Vector(g(lx - 0.3, 1.95, lz)), Vector(g(lx + 0.3, 1.95, lz)), Vector(g(lx + 0.45, 1.75, lz))], 0.02, M["brass"], 6, 8))
o.append(rod("CartRail", (lx - 0.45, 1.6, lz), (lx + 0.45, 1.6, lz), 0.015, M["brass"]))
o += [
    box("Suitcase", lx - 0.42, lx + 0.12, 0.18, 0.42, lz - 0.28, lz + 0.26, M["suit_a"], 0.03),
    box("Suitcase", lx - 0.36, lx + 0.06, 0.42, 0.62, lz - 0.22, lz + 0.2, M["suit_b"], 0.03),
    box("Hatbox", lx - 0.3, lx + 0.0, 0.62, 0.8, lz - 0.15, lz + 0.15, M["suit_c"], 0.02),
    cyl("GolfBag", 0.13, 0.85, g(lx + 0.3, 0.18, lz - 0.05), M["red"], 14),
    torus("Flamingo", 0.28, 0.1, g(lx + 0.25, 1.05, lz + 0.18), M["pink"], 20, 8, rot=(PI / 2 - 0.3, 0, 0.4)),
    tube("FlamingoNeck", [Vector(g(lx + 0.35, 1.25, lz + 0.35)), Vector(g(lx + 0.3, 1.5, lz + 0.42)), Vector(g(lx + 0.38, 1.62, lz + 0.38))], 0.05, M["pink"], 6, 8),
    sphere("FlamingoHead", 0.08, g(lx + 0.42, 1.66, lz + 0.36), M["pink"], 10, 6),
]
for k in range(3):
    o.append(rod("GolfClub", (lx + 0.3 + (k - 1) * 0.05, 1.0, lz - 0.05), (lx + 0.3 + (k - 1) * 0.07, 1.25, lz - 0.08), 0.012, M["chrome"]))
add("edges", *o)
# the Sky Concierge's desk (its front to the deck, -z)
o = [
    lb("Desk", -0.32, 0.32, 0.0, 1.08, -0.25, 0.25, M["rattan"], 0.03),
    lb("DeskTop", -0.36, 0.36, 1.08, 1.12, -0.3, 0.3, M["marble"], 0.01),
    face("DeskSign", 0.6, 0.17, 0, 0.9, 0.255, 0.0, signmat("concierge", 0.5)),
    cyl("DeskBell", 0.05, 0.05, g(0.15, 1.12, 0.05), M["brass"], 12, r2=0.01),
    lb("GuestBook", -0.25, 0.05, 1.12, 1.14, -0.15, 0.1, M["velvet"], 0.005),
]
add("edges", yawed(o, -9.15, 15.95, PI, "Concierge"))

# ================================================================================================================================
# ON THE LIFT CORES: the pictures in bronze frames; the plates
# ================================================================================================================================
def framed_picture(name, sign, w, h, x, y, z, theta):
    nx, nz = math.sin(theta), math.cos(theta)
    out = [face(name, w, h, x + nx * 0.03, y, z + nz * 0.03, theta, signmat(sign, 0.5))]
    # (the frame: four bronze bars round it, standing 0.02 proud)
    tx, tz = math.cos(theta), -math.sin(theta)  # (along the picture, in the game's x-z)
    for k, (a, b, c, d) in enumerate(((-w / 2 - 0.05, w / 2 + 0.05, h / 2, h / 2 + 0.05), (-w / 2 - 0.05, w / 2 + 0.05, -h / 2 - 0.05, -h / 2), (-w / 2 - 0.05, -w / 2, -h / 2, h / 2), (w / 2, w / 2 + 0.05, -h / 2, h / 2))):
        p0 = (x + tx * a + nx * 0.0, z + tz * a + nz * 0.0)
        p1 = (x + tx * b + nx * 0.05, z + tz * b + nz * 0.05)
        out.append(box(name + "Frame", p0[0], p1[0], y + c, y + d, p0[1], p1[1], M["bronze"], 0.005))
    return out


LX = LIFT["x"]
DZ = DOORS["doorZ"]
# the -z core (the bar's end), its face to +z: HOTEL VERTIGO's poster, the Wall of Shame
add("cores", *framed_picture("Poster", "poster", 1.0, 1.33, LX - 1.55, 1.5, -DZ, 0.0))
add("cores", *framed_picture("Shame", "shame", 1.4, 1.05, LX + 1.55, 1.45, -DZ, 0.0))
# the +z core (the DJ's end), its face to -z: DJ SPLASH, the Employee of the Month and its plaque
add("cores", *framed_picture("Gig", "gig", 1.0, 1.33, LX + 1.55, 1.5, DZ, PI))
add("cores", *framed_picture("Employee", "employee", 0.75, 1.0, LX - 1.55, 1.62, DZ, PI))
add("cores", face("EmployeePlaque", 0.9, 0.2, LX - 1.55, 0.92, DZ - 0.04, PI, signmat("employee_plaque", 0.4)))
# the plates on the cores' near faces (to -x) and the rules by the bar's end
add("cores",
    face("Altitude", 1.2, 0.38, CORE["x0"] - 0.005, 1.7, -(DZ + 0.85), -PI / 2, signmat("altitude", 0.5)),
    face("Pigeons", 1.3, 0.35, CORE["x0"] - 0.005, 1.7, DZ + 0.85, -PI / 2, signmat("pigeons", 0.5)))
ru = [
    lb("RulesBoard", -0.4, 0.4, 0.55, 1.6, -0.05, 0.0, M["bronze"], 0.02),
    face("RulesFace", 0.74, 0.99, 0, 1.08, 0.004, 0.0, signmat("rules", 0.5)),
]
for x in (-0.3, 0.3):
    ru.append(cyl("RulesPost", 0.03, 1.6, g(x, 0, -0.08), M["bronze"], 8))
add("cores", yawed(ru, -3.35, -16.05, 0.0, "Rules"))

# ================================================================================================================================
# THE PIGEONS (on the rail's cap, the canopies, the bar's fascia)
# ================================================================================================================================
for cut, x, z, th in (
    ("pigeon_bling", RAIL, 7.6, -PI / 2 + 0.3),
    ("pigeon_brolly", RAIL, -7.9, -PI / 2 - 0.4),
    ("pigeon_asleep", RAIL, 12.4, -PI / 2),
    ("pigeon_vip", EDGE["x0"] + 0.1, 2.4, PI / 2 - 0.3),
    ("pigeon_dance", EDGE["x0"] + 0.1, -4.8, PI / 2 + 0.4),
):
    add("pigeons", card("RailPigeon", cut, 0.3, x, RAILC + 0.02, z, th))
for s, cut in ((-1, "pigeon_cherry"), (1, "pigeon_asleep")):
    add("pigeons", card("CanopyPigeon", cut, 0.3, LX + 1.6 * s, 3.52, s * (DZ - 1.9), PI if s > 0 else 0.0))
add("pigeons", card("FasciaPigeon", "pigeon_vip", 0.3, BAR["x"] - 1.2, 3.3, -15.05, 0.2))

for k, v in parts.items():
    print("GROUP", k, tris(v))
if LOOK:
    look("stories_cradle", g(5.5, 1.5, -12), 8, 25, 120, (1280, 720), 16, 35)
    look("stories_net", g(5.6, 0, 0), 6, 45, 90, (1280, 720), 16, 35)
    look("stories_core", g(-6.2, 1.5, -15.2), 7, 15, 0, (1280, 720), 16, 35)
    look("stories_cart", g(-1.6, 1, 15.6), 4, 20, 180, (1280, 720), 16, 35)
for k, v in parts.items():
    save_part("stories_" + k, v)
