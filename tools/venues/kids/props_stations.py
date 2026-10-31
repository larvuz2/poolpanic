"""The Kids Pool's gameplay furniture, modelled in place in game coordinates, each where the game keeps its hit box and label
(dist/spatial.mjs KIDS; dist/scene/props.mjs draws the live parts and the hooks, these are the bodies round them), in the Kids
Pool's candy palette: chunky, rounded, friendly.

- the fin rack: a sky-blue rack with a cloud-shaped FINS header, its three pairs of little fins their own objects (Fins_1..3:
  the game hides each as it is rented);
- WATER CARE (chlorine) and EYE CARE (relief) stations, both facing the pool (-x), with scalloped backs;
- the skimmer board on the left fence (the game draws the skimmer, its hooks and the scoop) and the frog waste bin;
- the fish net's board on its own posts by the right-hand fence (the game draws the net and its hooks);
- three life-ring boards on posts, each with a `LifeRing` where its ring hangs (recorded and dropped: the game's rings hang there);
- the torch's candy-striped post (`Flashlight`: recorded and dropped, the game hangs its torch there);
- the rescue bench and the bench by the right-hand fence: chunky painted slats on rounded white frames;
- a painted utility post behind the game's fuse box, and the SPLASH RULES board on the back fence.

    blender -b -P tools/venues/kids/props_stations.py [-- --look]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()

M = dict(
    white=sm("white_paint"),
    gloss=sm("white_gloss"),
    cream=sm("cream"),
    pink=sm("pink"),
    pink_soft=sm("pink_soft"),
    sun=sm("sun"),
    sun_soft=sm("sun_soft"),
    sky=sm("sky"),
    sky_soft=sm("sky_soft"),
    mint=sm("mint"),
    green=sm("leafgreen"),
    coral=sm("coral"),
    lilac=sm("lilac"),
    navy=sm("navy"),
    red=sm("red"),
    timber=sm("timber"),
    steel=sm("stainless"),
    charcoal=sm("charcoal"),
    rope=sm("rope", "#f3e2b8", 0.9),
    mirror=sm("mirror", "#dfe9ee", 0.05, 1.0),
    foot=sm("fin_foot", "#24456e", 0.6),
    towel_sky=sm("towel_sky"),
    towel_pink=sm("towel_pink"),
    towel_sun=sm("towel_sun"),
    tub=sm("tub_white", "#f2f4f0", 0.3),
    ring=sm("ring_orange", "#f47742", 0.5),
    eye_white=sm("eye_white", "#fbfbf6", 0.3),
    eye_black=sm("eye_black", "#1b1c1f", 0.2),
)
parts = {}  # item -> list of objects


def add(item, *objs):
    parts.setdefault(item, []).extend(o for o in objs if o is not None)
    return objs[0] if objs else None


def rod(name, a, b, r, m, sides=8):
    """A straight round bar between two game points."""
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


class Frame:
    """An item's local frame: `u` across it, `v` out of its front (toward `face`), y up; boxes by local extents."""

    AXES = {"+z": ((1, 0), (0, 1)), "-z": ((-1, 0), (0, -1)), "+x": ((0, -1), (1, 0)), "-x": ((0, 1), (-1, 0))}

    def __init__(self, x, z, face):
        self.x, self.z, self.face = x, z, face
        self.U, self.V = self.AXES[face]

    def p(self, u, v):
        return (self.x + u * self.U[0] + v * self.V[0], self.z + u * self.U[1] + v * self.V[1])

    def at(self, u, y, v):
        x, z = self.p(u, v)
        return (x, y, z)

    def box(self, name, u0, u1, y0, y1, v0, v1, m, bev=0.02):
        (xa, za), (xb, zb) = self.p(u0, v0), self.p(u1, v1)
        return gbx(name, min(xa, xb), max(xa, xb), y0, y1, min(za, zb), max(za, zb), m, bev)

    def g(self, u, y, v):
        return g(*self.at(u, y, v))

    @property
    def rz(self):
        """The turn (about Blender Z) that makes a thing built facing game +z face this frame's front."""
        return {"+z": 0.0, "-z": PI, "+x": PI / 2, "-x": -PI / 2}[self.face]

    def sign(self, name, w, h, u, y, v, image):
        return plane(name, w, h, self.g(u, y, v), signmat(image, 0.5), rot=(PI / 2, 0, self.rz))

    def text(self, name, body, size, m, u, y, v, face="BarlowCondensed-Black"):
        return flat_text(name, body, size, m, self.g(u, y, v), self.rz, 0.008, face)

    def disc(self, name, r, u, y, v, depth, m, verts=24):
        """A round plate standing in the frame's plane, `depth` thick toward the front."""
        return cyl(name, r, depth, self.g(u, y, v), m, verts, rot=(PI / 2, 0, self.rz))

    def scallops(self, name, u0, u1, y, v0, v1, m, n):
        """A row of half discs along the top of a panel (a scalloped, friendly edge)."""
        out = []
        w = (u1 - u0) / n
        for k in range(n):
            u = u0 + (k + 0.5) * w
            pts = [(math.cos(a) * w / 2, math.sin(a) * w / 2) for a in [i * PI / 10 for i in range(11)]]
            o = extrude_shape(name, pts, v1 - v0, self.g(u, y, v0), m, rot=(PI / 2, 0, self.rz))
            out.append(o)
        return out


def post(name, x, z, h, m, cap=None, r=0.06):
    """A round painted post with a ball on top."""
    out = [cyl(name, r, h, g(x, 0, z), m, 12)]
    out.append(cyl(name + "Foot", r + 0.05, 0.04, g(x, 0, z), M["steel"], 14))
    if cap:
        out.append(sphere(name + "Cap", r + 0.04, g(x, h + 0.03, z), cap, 14, 8))
    return out


# ==== WATER CARE at (10.8, 7.8), facing the pool (-x): a sunny cabinet with chlorine tubs and a test kit, a scalloped sky back ======
F = Frame(*STATIONS["chlorine"], "-x")
wc = []
wc.append(F.box("Kick", -0.78, 0.78, 0, 0.08, -0.26, 0.26, M["charcoal"], 0.015))
wc.append(F.box("Cabinet", -0.84, 0.84, 0.08, 0.98, -0.3, 0.3, M["sun"], 0.06))
for u0, u1 in ((-0.78, -0.03), (0.03, 0.78)):
    wc.append(F.box("Door", u0, u1, 0.15, 0.92, 0.3, 0.33, M["sun_soft"], 0.03))
    wc.append(F.disc("Knob", 0.045, (u1 - 0.1) if u0 < 0 else (u0 + 0.1), 0.58, 0.33, 0.04, M["pink"], 14))
    for k in range(3):  # a row of little bubbles on each door
        wc.append(F.disc("Bubble", 0.035 + 0.012 * k, (u0 + u1) / 2 + (k - 1) * 0.16, 0.3 + k * 0.05, 0.33, 0.012, M["white"], 12))
wc.append(F.box("Worktop", -0.9, 0.9, 0.98, 1.05, -0.34, 0.36, M["white"], 0.025))
wc.append(F.box("BackPanel", -0.88, 0.88, 1.05, 2.15, -0.34, -0.28, M["sky"], 0.015))
wc += F.scallops("BackScallop", -0.88, 0.88, 2.15, -0.34, -0.28, M["sky"], 6)
wc.append(F.sign("WaterCareSign", 1.4, 0.7, 0, 1.68, -0.275, "water_care"))
# two chlorine tubs, a test kit with its vials, a duck-shaped thermometer
for u in (-0.6, -0.27):
    wc.append(cyl("Tub", 0.15, 0.3, F.g(u, 1.05, 0.0), M["tub"], 16, r2=0.135))
    wc.append(cyl("TubLid", 0.148, 0.05, F.g(u, 1.35, 0.0), M["sky"], 16))
    wc.append(F.box("TubLabel", u - 0.09, u + 0.09, 1.12, 1.25, 0.13, 0.146, M["pink"], 0.005))
wc.append(F.box("TestKit", 0.12, 0.44, 1.05, 1.15, -0.12, 0.1, M["white"], 0.02))
for k, col in enumerate((M["pink"], M["sun"], M["mint"], M["lilac"])):
    wc.append(cyl("Vial", 0.017, 0.1, F.g(0.17 + k * 0.075, 1.15, -0.01), col, 8))
wc.append(sphere("DuckBody", 0.08, F.g(0.66, 1.12, 0.18), M["sun"], 12, 8, (1.25, 0.9, 0.85)))
wc.append(sphere("DuckHead", 0.05, F.g(0.66, 1.21, 0.24), M["sun"], 12, 8))
wc.append(sphere("DuckBeak", 0.025, F.g(0.66, 1.2, 0.29), M["coral"], 8, 6, (1, 1.4, 0.6)))
add("water_care", *wc)

# ==== EYE CARE at (10.8, 3.9): a mint wall unit with a round mirror and towels, a little eyewash basin in front ===================
F = Frame(*STATIONS["relief"], "-x")
ec = []
ec.append(F.box("UnitKick", -0.52, 0.52, 0, 0.08, -0.56, -0.24, M["charcoal"], 0.015))
ec.append(F.box("Unit", -0.56, 0.56, 0.08, 0.92, -0.58, -0.2, M["mint"], 0.05))
for u0, u1 in ((-0.52, -0.02), (0.02, 0.52)):
    ec.append(F.box("UnitDoor", u0, u1, 0.14, 0.86, -0.2, -0.18, M["white"], 0.02))
    ec.append(F.disc("UnitKnob", 0.04, (u1 - 0.08) if u0 < 0 else (u0 + 0.08), 0.52, -0.18, 0.04, M["sun"], 12))
ec.append(F.box("UnitTop", -0.6, 0.6, 0.92, 0.98, -0.6, -0.16, M["white"], 0.02))
ec.append(F.box("Back", -0.6, 0.6, 0.98, 2.15, -0.6, -0.54, M["mint"], 0.015))
ec += F.scallops("BackScallop", -0.6, 0.6, 2.15, -0.6, -0.54, M["mint"], 4)
ec.append(F.sign("EyeCareSign", 1.0, 0.5, 0, 1.86, -0.535, "eye_care"))
ec.append(F.disc("MirrorFrame", 0.27, -0.12, 1.32, -0.54, 0.03, M["sun"], 28))
ec.append(F.disc("Mirror", 0.23, -0.12, 1.32, -0.51, 0.008, M["mirror"], 28))
for k, m_ in enumerate((M["towel_sky"], M["towel_pink"], M["towel_sun"])):
    y = 0.98 + k * 0.07
    ec.append(F.box("Towel", 0.18, 0.5, y, y + 0.065, -0.48, -0.26, m_, 0.025))
ec.append(cyl("Drops", 0.03, 0.11, F.g(-0.4, 0.98, -0.36), sm("drops", "#4fc3f7", 0.25), 10))
ec.append(cyl("DropsCap", 0.018, 0.04, F.g(-0.4, 1.09, -0.36), M["white"], 8))
# the eyewash: a post, a round basin, its nozzles, a sun-yellow push paddle
ec.append(cyl("WashPost", 0.06, 0.75, F.g(0, 0.03, 0.3), M["white"], 14))
ec.append(cyl("WashBase", 0.17, 0.04, F.g(0, 0.0, 0.3), M["steel"], 18))
ec.append(cyl("Bowl", 0.07, 0.12, F.g(0, 0.78, 0.3), M["sky_soft"], 20, r2=0.22))
ec.append(torus("BowlRim", 0.22, 0.025, F.g(0, 0.9, 0.3), M["sky"], 24, 6))
for du in (-0.06, 0.06):
    ec.append(cyl("Nozzle", 0.02, 0.06, F.g(du, 0.84, 0.3), M["sun"], 8))
ec.append(F.box("Paddle", -0.12, 0.12, 0.8, 0.84, 0.5, 0.58, M["sun"], 0.015))
add("eye_care", *ec)

# ==== FIN RACK at (-10.3, 7.8), along z: a sky-blue A-frame, a peg board, a cloud header with FINS; three pairs of little fins =====
FX, FZ_ = STATIONS["fins"]
fr = []
for z in (FZ_ - 0.92, FZ_ + 0.92):
    fr.append(tube("EndLeg", [g(FX - 0.4, 0, z), g(FX, 1.7, z)], 0.045, M["sky"], 1, 8))
    fr.append(tube("EndLeg", [g(FX + 0.4, 0, z), g(FX, 1.7, z)], 0.045, M["sky"], 1, 8))
    for sx in (-1, 1):
        fr.append(sphere("LegFoot", 0.07, g(FX + sx * 0.4, 0.03, z), M["pink"], 10, 6, (1, 1, 0.55)))
fr.append(gbx("PegBoard", FX - 0.03, FX + 0.03, 0.5, 1.6, FZ_ - 0.88, FZ_ + 0.88, M["white"], 0.02))
for k in range(4):
    y = 0.58 + k * 0.28
    fr.append(gbx("Batten", FX - 0.045, FX + 0.045, y, y + 0.05, FZ_ - 0.88, FZ_ + 0.88, M["sky_soft"], 0.012))
# the cloud: three overlapping discs and a flat bottom, FINS on both faces
cloud = []
for dz, dy, r in ((-0.5, 1.92, 0.24), (-0.12, 2.02, 0.32), (0.3, 1.97, 0.27), (0.6, 1.9, 0.2)):
    cloud.append(sphere("Cloud", r, g(FX, dy, FZ_ + dz), M["white"], 18, 10, (0.06 / r, 1, 1)))
cloud.append(gbx("CloudBase", FX - 0.05, FX + 0.05, 1.72, 1.92, FZ_ - 0.72, FZ_ + 0.78, M["white"], 0.03))
fr += cloud
for sx, rz in ((1, PI / 2), (-1, -PI / 2)):
    fr.append(flat_text("FinWord", "FINS", 0.3, M["sky"], g(FX + sx * 0.06, 1.95, FZ_), rz, 0.008, "BarlowCondensed-Black"))
fr.append(gbx("Shelf", FX - 0.34, FX - 0.04, 0.3, 0.35, FZ_ - 0.88, FZ_ + 0.88, M["timber"], 0.012))
for k in range(4):  # little kickboards on the back shelf
    z = FZ_ - 0.6 + k * 0.4
    col = (M["pink"], M["sun"], M["mint"], M["lilac"])[k]
    fr.append(gbx("Kickboard", FX - 0.29, FX - 0.25, 0.35, 0.72, z - 0.12, z + 0.12, col, 0.03))
fins = []


def fin(x, y, z, col, flip):
    """One little swim fin hanging blade down, its face toward +x: a foot pocket and a rounded blade."""
    pts = [(-0.055, 0), (0.055, 0), (0.09, -0.26), (0.08, -0.36), (0.0, -0.39), (-0.08, -0.36), (-0.09, -0.26)]
    blade = extrude_shape("FinBlade", pts, 0.016, (0, 0, 0), col, rot=(PI / 2, 0, PI / 2))
    apply_all(blade)
    pocket = box("FinPocket", (0.03, 0.11, 0.14), (0.01, 0, -0.05), M["foot"], 0.025)
    o = join([blade, pocket], "Fin")
    o.location = g(x, y, z)
    o.rotation_euler = (0, 0.12 if flip else -0.12, 0)
    apply_all(o)
    return o


for i, z in enumerate((FZ_ - 0.55, FZ_, FZ_ + 0.55)):
    col = (M["pink"], M["sun"], M["mint"])[i]
    pair = join([fin(FX + 0.06, 1.4, z - 0.06, col, False), fin(FX + 0.08, 1.38, z + 0.06, col, True)], "Fins_%d" % (i + 1))
    pair.name = "Fins_%d" % (i + 1)
    fins.append(pair)
    fr.append(rod("Peg", (FX + 0.03, 1.42, z), (FX + 0.15, 1.45, z), 0.014, M["steel"]))
    fr.append(sphere("PegEnd", 0.025, g(FX + 0.15, 1.45, z), M["coral"], 8, 6))
add("fins", *fr)
add("fins", *fins)

# ==== SANITATION: the skimmer board on the left fence (the game's hooks run from x -14.40 at y 1.8, at z -2.9 and -0.9; its skimmer
# hangs along +z from x -14.0, z -3.4) and the frog bin ==============================================================================
RX_, RZ_ = SANITATION["rack"]
sn = []
BXF = -14.42  # the board's face (the hooks start at x -14.40)
for z in (RZ_ - 1.9, RZ_ + 1.9):
    sn += post("BoardPost", BXF - 0.1, z, 2.75, M["lilac"], M["sun"], 0.055)
sn.append(gbx("SkimBoard", BXF - 0.06, BXF, 1.12, 2.4, RZ_ - 1.95, RZ_ + 1.95, M["lilac"], 0.012))
sn.append(gbx("SkimTrim", BXF - 0.065, BXF + 0.012, 2.36, 2.44, RZ_ - 1.98, RZ_ + 1.98, M["white"], 0.02))
sn.append(gbx("SkimTrim", BXF - 0.065, BXF + 0.012, 1.08, 1.16, RZ_ - 1.98, RZ_ + 1.98, M["white"], 0.02))
sn.append(gbx("SkimHeader", BXF - 0.07, BXF - 0.01, 2.5, 2.86, RZ_ - 1.2, RZ_ + 1.2, M["sun"], 0.015))
sn.append(flat_text("SkimWord", "POOL SKIMMER", 0.24, M["navy"], g(BXF - 0.005, 2.68, RZ_), PI / 2, 0.006, "BarlowCondensed-Black"))
# a painted bubble pattern on the board (clear of the hooks at z -2.9 and -0.9, and of the skimmer's line)
for k, (dz, y, r) in enumerate(((0.55, 1.4, 0.09), (0.8, 1.62, 0.06), (0.45, 1.85, 0.05), (-1.5, 2.15, 0.07), (-1.75, 1.95, 0.05))):
    sn.append(cyl("Bubble", r, 0.008, g(BXF + 0.004, y, RZ_ + dz), M["white"], 16, rot=(PI / 2, 0, PI / 2)))
add("sanitation", *sn)
BNX, BNZ = SANITATION["bin"]
bn = []
# a frog: a round green body, a lid with two eyes on top, a pink tongue-flap mouth facing the pool (+x)
bn.append(cyl("Bin", 0.48, 1.1, g(BNX, 0.03, BNZ), M["green"], 26, r2=0.53))
bn.append(cyl("BinFoot", 0.5, 0.05, g(BNX, 0.0, BNZ), M["charcoal"], 26))
bn.append(sphere("BinBelly", 0.36, g(BNX + 0.32, 0.6, BNZ), M["sun_soft"], 20, 10, (0.45, 1.0, 1.15)))
bn.append(cyl("BinLid", 0.56, 0.14, g(BNX, 1.12, BNZ), M["green"], 26, r2=0.42, bev=0.03))
for dz in (-0.2, 0.2):
    bn.append(sphere("FrogEye", 0.14, g(BNX + 0.12, 1.32, BNZ + dz), M["green"], 14, 8))
    bn.append(sphere("FrogEyeWhite", 0.1, g(BNX + 0.2, 1.36, BNZ + dz), M["eye_white"], 12, 8))
    bn.append(sphere("FrogPupil", 0.05, g(BNX + 0.28, 1.37, BNZ + dz), M["eye_black"], 10, 6))
bn.append(gbx("FrogMouth", BNX + 0.49, BNX + 0.53, 0.98, 1.06, BNZ - 0.26, BNZ + 0.26, M["pink"], 0.03))
bn.append(flat_text("BinWord", "FEED ME", 0.13, M["navy"], g(BNX + 0.52, 0.7, BNZ), -PI / 2 + PI, 0.006, "BarlowCondensed-Black"))
add("sanitation", *bn)

# ==== FISH NET: a board on two posts by the right-hand fence at z -2.6 (the game's hooks stand off its face at x 14.47) =============
FN_X, FN_Z, _ = FIXTURES["fishNet"]
fn = []
FF = 14.47  # the board's face
fn.append(gbx("NetBoard", FF, FF + 0.06, 0.4, 2.9, FN_Z - 0.48, FN_Z + 0.48, M["sky"], 0.012))
fn.append(gbx("NetTrim", FF - 0.008, FF + 0.07, 2.86, 2.94, FN_Z - 0.5, FN_Z + 0.5, M["white"], 0.02))
fn.append(gbx("NetHeader", FF - 0.008, FF + 0.05, 2.98, 3.3, FN_Z - 0.56, FN_Z + 0.56, M["coral"], 0.015))
fn.append(flat_text("NetWord", "FISH NET", 0.21, M["white"], g(FF - 0.012, 3.14, FN_Z), -PI / 2, 0.006, "BarlowCondensed-Black"))
for y in (1.25, 2.35):
    fn.append(gbx("HookPlate", FF - 0.012, FF, y - 0.07, y + 0.07, FN_Z - 0.07, FN_Z + 0.07, M["steel"], 0.004))
for dz in (-0.4, 0.4):
    fn += post("NetPost", FF + 0.13, FN_Z + dz, 3.3, M["white"], M["sun"], 0.05)
# a little sun-yellow fish swimming low on the board
fish = [(0.0, 0.0), (0.12, 0.08), (0.24, 0.0), (0.12, -0.08)]
fn.append(extrude_shape("FishBody", fish, 0.012, g(FF - 0.002, 0.75, FN_Z - 0.12), M["sun"], rot=(PI / 2, 0, -PI / 2)))
fn.append(extrude_shape("FishTail", [(0.0, 0.0), (0.09, 0.07), (0.09, -0.07)], 0.012, g(FF - 0.002, 0.75, FN_Z + 0.12), M["sun"], rot=(PI / 2, 0, -PI / 2)))
add("fish_net", *fn)

# ==== LIFE RINGS: boards on posts, each with the place its ring hangs ================================================================
ring_marks = []


def ring_board(name, x, z, face):
    """A coral board with a wavy white top, a sun header, a peg and a coiled line, on two posts behind it; the game's ring hangs
    in front at the mount's height (`LifeRing`: R 0.49, r 0.13)."""
    F = Frame(x, z, face)
    out = []
    out.append(F.box(name + "Board", -0.62, 0.62, 0.5, 2.62, -0.07, -0.01, M["coral"], 0.015))
    out += F.scallops(name + "Wave", -0.62, 0.62, 2.62, -0.07, -0.01, M["white"], 5)
    out.append(F.box(name + "Header", -0.64, 0.64, 2.8, 3.12, -0.06, -0.01, M["sun"], 0.015))
    out.append(F.text(name + "Word", "LIFE RING", 0.22, M["navy"], 0, 2.96, -0.005))
    out.append(rod(name + "Peg", F.at(0, 2.32, -0.01), F.at(0, 2.35, 0.17), 0.024, M["steel"]))
    out.append(F.box(name + "Cleat", 0.42, 0.5, 1.4, 1.55, -0.01, 0.05, M["steel"], 0.01))
    out.append(torus(name + "Coil", 0.12, 0.022, F.g(0.46, 1.28, 0.06), M["rope"], 18, 5, rot=(PI / 2, 0, F.rz)))
    out.append(torus(name + "Coil", 0.1, 0.02, F.g(0.47, 1.26, 0.08), M["rope"], 18, 5, rot=(PI / 2, 0, F.rz)))
    for u in (-0.5, 0.5):
        px, pz = F.p(u, -0.14)
        out += post(name + "Post", px, pz, 3.1, M["white"], M["pink"], 0.055)
    c = F.at(0, 1.82, 0.16)
    mark = torus("LifeRing", 0.49, 0.13, g(*c), M["ring"], 24, 8, rot=(PI / 2, 0, F.rz))
    mark.name = "LifeRing"
    out.append(mark)
    ring_marks.append(c)
    return out


for (x, z, ang), nm in zip(RING_MOUNTS, ("BackRing", "LeftRing", "RightRing")):
    face = {0.0: "+z", PI / 2: "+x", -PI / 2: "-x"}[ang]
    add("rings", *ring_board(nm, x, z, face))

# ==== the torch's post: candy-striped, a cradle on top; the game hangs its torch where `Flashlight` is ===============================
FLX, FLZ = FIXTURES["flashlight"]
fl = []
for k in range(6):
    y = k * 0.18
    fl.append(cyl("TorchStripe", 0.06, 0.18, g(FLX, y, FLZ), M["pink"] if k % 2 else M["white"], 14))
fl.append(cyl("TorchPostFoot", 0.14, 0.04, g(FLX, 0, FLZ), M["steel"], 16))
fl.append(gbx("TorchCradle", FLX - 0.17, FLX + 0.17, 1.08, 1.12, FLZ - 0.08, FLZ + 0.08, M["sky"], 0.015))
for sx in (-1, 1):
    fl.append(gbx("CradleFork", FLX + sx * 0.12 - 0.018, FLX + sx * 0.12 + 0.018, 1.12, 1.22, FLZ - 0.06, FLZ + 0.06, M["sky"], 0.01))
torch = cyl("Flashlight", 0.045, 0.26, g(FLX - 0.13, 1.19, FLZ), M["sun"], 10, rot=(0, PI / 2, 0))
torch.name = "Flashlight"
fl.append(torch)
add("torch", *fl)

# ==== BENCHES: chunky painted slats on rounded white frames, along z ===================================================================


def bench(name, x, z, length=3.4, depth=0.96, back=0, colours=("pink", "sun", "sky", "mint")):
    out = []
    z0, z1 = z - length / 2, z + length / 2
    for zz in (z0 + 0.2, z, z1 - 0.2):
        for sx in (-1, 1):
            out.append(gbx(name + "Leg", x + sx * (depth / 2 - 0.1) - 0.05, x + sx * (depth / 2 - 0.1) + 0.05, 0, 0.4, zz - 0.05, zz + 0.05, M["white"], 0.03))
        out.append(gbx(name + "Bearer", x - depth / 2 + 0.04, x + depth / 2 - 0.04, 0.34, 0.4, zz - 0.06, zz + 0.06, M["white"], 0.025))
        if back:
            bx_ = x + back * (depth / 2 - 0.08)
            out.append(tube(name + "BackPost", [g(bx_, 0.4, zz), g(bx_ + back * 0.12, 0.98, zz)], 0.045, M["white"], 1, 8))
    n = 4
    for k in range(n):
        xx = x - depth / 2 + 0.03 + k * (depth - 0.06) / n
        out.append(gbx(name + "Slat", xx, xx + (depth - 0.06) / n - 0.03, 0.4, 0.48, z0, z1, M[colours[k % len(colours)]], 0.03))
    if back:
        for k in range(2):
            y = 0.6 + k * 0.2
            bx_ = x + back * (depth / 2 - 0.04 + (y - 0.4) * 0.2)
            out.append(gbx(name + "BackSlat", bx_ - 0.03, bx_ + 0.03, y, y + 0.15, z0 + 0.05, z1 - 0.05, M[colours[(k + 1) % len(colours)]], 0.03))
    return out


add("benches", *bench("RescueBench", *RESCUE_BENCH))  # (the rescued are laid on it: no back)
add("benches", *bench("SideBench", *BENCH_2, back=1, colours=("sky", "mint", "lilac", "sun")))  # (its back to the fence)
add("benches", towel_folded("BenchTowel", 0.36, 0.28, 0.06, M["towel_pink"], sm("towel_stripe"), g(BENCH_2[0] + 0.05, 0.48, BENCH_2[1] + 1.0), 0.2))
add("benches", sphere("BenchBall", 0.14, g(BENCH_2[0] - 0.15, 0.62, BENCH_2[1] - 1.1), M["sun"], 14, 8))

# ==== the fuse box's post (the game draws the box at (14.4, 12.05), its back at x 14.67) ===============================================
FBX, FBZ, _ = FIXTURES["fuseBox"]
fb = []
fb.append(gbx("FusePost", 14.67, 14.95, 0, 2.6, 11.3, 12.8, M["mint"], 0.04))
fb.append(gbx("FuseCap", 14.62, 15.0, 2.6, 2.7, 11.25, 12.85, M["white"], 0.03))
for k in range(4):  # painted planks down the post
    z = 11.32 + k * 0.37
    fb.append(gbx("FusePlank", 14.66, 14.67, 0.1, 2.5, z + 0.34, z + 0.36, M["green"], 0))
fb.append(sphere("FuseCapBall", 0.08, g(14.81, 2.76, 12.05), M["sun"], 12, 8))
add("fuse_post", *fb)

# ==== the SPLASH RULES board on the back fence (x 5..7) ===================================================================================
F = Frame(6.0, -16.1, "+z")
rb = []
rb.append(F.box("RulesBoard", -0.56, 0.56, 0.95, 2.45, -0.05, 0.0, M["white"], 0.012))
rb.append(F.sign("RulesSign", 0.96, 1.28, 0, 1.7, 0.004, "kids_rules"))
rb.append(F.box("RulesRoof", -0.68, 0.68, 2.45, 2.55, -0.12, 0.08, M["sky"], 0.04))
for u in (-0.6, 0.6):
    px, pz = F.p(u, -0.08)
    rb += post("RulesPost", px, pz, 2.5, M["sky"], M["sun"], 0.05)
add("rules", *rb)

# ---- report and save ---------------------------------------------------------------------------------------------------------------------
for item, objs in parts.items():
    print("ITEM", item, tris([o for o in objs if o.type == "MESH"]), "triangles")
print("TOTAL", tris([o for objs in parts.values() for o in objs if o.type == "MESH"]), "triangles")
for f_ in fins:
    c = sum((f_.matrix_world @ Vector(b) for b in f_.bound_box), Vector()) / 8
    print("CENTRE", f_.name, [round(c.x, 3), round(c.z, 3), round(-c.y, 3)])
for c in ring_marks:
    print("CENTRE LifeRing", [round(v, 3) for v in c])
c = sum((torch.matrix_world @ Vector(b) for b in torch.bound_box), Vector()) / 8
print("CENTRE Flashlight", [round(c.x, 3), round(c.z, 3), round(-c.y, 3)])
everything = [o for objs in parts.values() for o in objs]
if LOOK:
    ctx = [gbx("PreviewDeck", -15, 15, -0.05, 0, -17, 13.5, sm("preview_deck", "#f3e9d8", 0.8), 0)]
    look("kstations_right", g(11.6, 1.2, 4.0), 9.5, 24, 245, (960, 640), 16, 30)
    look("kstations_left", g(-12.3, 1.2, 2.0), 11, 26, 70, (960, 640), 16, 30)
    look("kstations_fins", g(-10.3, 1.2, 7.8), 5.5, 18, 110, (960, 640), 16, 32)
    look("kstations_back", g(1.0, 1.5, -15.8), 9.5, 14, 0, (960, 640), 16, 30)
    look("kstations_corner", g(13.4, 1.4, 9.0), 7.5, 18, 230, (960, 640), 16, 32)
    for o in ctx:
        bpy.data.objects.remove(o)
save_part("stations", everything)
