"""The Lazy River's deck and its edges, every piece in the plan's furniture boxes, the strips between the deck and the walls, on the
walls, or outside (kit.PLAN):
- the stations: WATER CARE a carved stone cistern with a bamboo spout, a brass hand pump and clay jars; EYE CARE a stone basin on a
  pedestal, a little idol's face for its spout, towels on a bamboo rail; their painted boards;
- the Coconut Shack (the snack hut): thatch on bamboo, a plank counter, the chalk menu (Temple Fries), coconuts with straws, a
  pineapple, a blender, smoothie cups, a hand of bananas hanging, the sign both ways; the dog treats' crate pile by it;
- the rescue bench of split logs on carved stone feet; two tiki totems (the game's flames on top); palms in stone rings, a banana
  plant on the near side (low, for the camera); two boulders with ferns, one with a sunken idol's head;
- the rings' boards, the fish net's, the skimmer's (notices pinned to it), a carved stone litter urn, the torch's stone pedestal
  (`Flashlight`), the fuse box's hood and DANGER;
- the edges: along the back the notice wall (the explorer's map, the travel poster, MISSING: ONE TUBE), the expedition's crates (a
  pith helmet, binoculars, a coil of rope), pots of heliconia and bird of paradise, a basket of coconuts, the signpost (TEMPLE, CAVE
  FALLS, SNACKS, WAY OUT?), the river's rules; along the end the crocodile (he is a log) and his sign, a dugout canoe on trestles
  with its paddles, a stone bench, NO SPLASHING THE IDOL; on the ruined wall SHHH! IDOL SLEEPING, lianas, moss and bromeliads in its
  niches; planters along the near wall's rail;
- outside, through the ruin's two collapsed bays: the expedition's camp (a canvas tent, a table with the map and a lantern, folding
  chairs, crates, a campfire with its pot: the game's flame).

    blender -b -P tools/venues/river/props_deck.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import blob, palm  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(1933)
TAU = 2 * PI
M = dict(
    rock=tmat_tile("riverrock", "#5a5a50", 0.6),
    temple=tmat_tile("templestone", "#9a9a84", 0.88),
    planks=tmat_tile("planks", "#8a5a33", 0.75),
    thatch=tmat_tile("thatch", "#c99a52", 0.95),
    hedge=tmat_tile("hedge", "#2f6b34", 0.8),
    pole=sm("bamboo"),
    pole_dark=sm("bamboo_dark"),
    rope=sm("rope"),
    timber=sm("timber"),
    timber_dark=sm("timber_dark"),
    bark=sm("bark"),
    iron=sm("iron"),
    brass=sm("brass"),
    rust=sm("rust"),
    moss=sm("moss"),
    clay=sm("clay"),
    canvas=sm("canvas"),
    canvas_g=sm("canvas_green"),
    khaki=sm("khaki"),
    coconut=sm("coconut"),
    yellow=sm("yellow"),
    orange=sm("orange"),
    red=sm("red"),
    teal=sm("teal"),
    pink=sm("pink"),
    lime=sm("lime"),
    white=sm("white"),
    cream=sm("cream"),
    black=sm("black"),
    glass=sm("glass"),
    gold=sm("gold"),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    water=sm("basin_water", "#4fb0b0", 0.1),
    towel_a=sm("towel_a", "#e8603c", 0.95),
    towel_b=sm("towel_b", "#f3e6c4", 0.95),
    lantern=lamp_mat("lantern_glass", "#ffd99a", 3.0),
    idol=cutmat("idol", 0.85),
    liana=cutmat("liana", 0.7),
    frond=cutmat("palm_frond", 0.65),
    bromeliad=cutmat("bromeliad", 0.6),
    heliconia=cutmat("heliconia", 0.6),
    paradise=cutmat("paradise", 0.6),
    monstera=cutmat("monstera_2", 0.6),
    banana=cutmat("banana_1", 0.6),
)
parts = {}
trees.use({"frond": M["frond"], "bark": M["bark"], "bark_light": M["bark"], "palm_boot": M["bark"], "coconut": M["coconut"]})


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


lb = box


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def anchor(name, x, y, z):
    return sphere("Anchor_" + name, 0.05, g(x, y, z), M["white"], 6, 4)


def yawed(objs, x, z, yaw, name):
    o = join([q for q in objs if q], name)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (0, 0, yaw)
    o.location = g(x, 0, z)
    apply_all(o)
    return o


def place(o, x, y, z, turn=0.0, rx=0.0, ry=0.0):
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (rx, ry, turn)
    o.location = g(x, y, z)
    apply_all(o)
    return o


# yaw that turns local +z (the front) toward the game's -x, +x, -z, +z
TO_MX, TO_PX, TO_MZ, TO_PZ = -PI / 2, PI / 2, PI, 0.0


def front(img, w, h, y, z, x=0.0):
    """A picture facing local +z at local (x, y, z)."""
    return plane("Pic", w, h, g(x, y, z + 0.003), signmat(img, 0.6))


def back_pic(img, w, h, y, z, x=0.0):
    """A picture facing local -z."""
    return plane("Pic", w, h, g(x, y, z - 0.003), signmat(img, 0.6), rot=(PI / 2, 0, PI))


def tuft(x, y, z, s, m, n=2, seed=0):
    r = random.Random(seed)
    out = []
    for k in range(n):
        a = k * PI / n + r.uniform(-0.3, 0.3)
        out.append(plane("Tuft", s * r.uniform(0.9, 1.2), s, g(x, y + s / 2 - 0.04, z), m, rot=(PI / 2, 0, a)))
    return out


def bamboo_pole(x, z, h, r=0.06, y0=0.0):
    out = [cyl("Bamboo", r, h, g(x, y0, z), M["pole"], 8, r2=r * 0.92)]
    y = 0.45
    while y < h - 0.1:
        out.append(cyl("BambooNode", r * 1.25, 0.05, g(x, y0 + y, z), M["pole_dark"], 8))
        y += 0.55
    return out


def crate(x, y, z, w_, h_, d_, img, turn=0.0, lid=True):
    c = [lb("Crate", -w_ / 2, w_ / 2, 0, h_, -d_ / 2, d_ / 2, M["planks"], 0.015)]
    for zz in (-d_ / 2, d_ / 2):
        c.append(lb("CrateBand", -w_ / 2 - 0.01, w_ / 2 + 0.01, h_ * 0.12, h_ * 0.2, zz - 0.012, zz + 0.012, M["timber_dark"], 0.003))
        c.append(lb("CrateBand", -w_ / 2 - 0.01, w_ / 2 + 0.01, h_ * 0.8, h_ * 0.88, zz - 0.012, zz + 0.012, M["timber_dark"], 0.003))
    if img:
        c.append(front(img, w_ * 0.86, w_ * 0.86 * 0.75, h_ * 0.5, d_ / 2 + 0.013))
    o = join(c, "Crate")
    return place(o, x, y, z, turn)


def clay_pot(x, z, r, h, plant, seed, y0=0.0):
    out = [trees.lathe("Pot", [(r * 0.7, 0), (r, h * 0.55), (r * 0.9, h * 0.92), (r * 1.06, h)], 12, M["clay"], g(x, y0, z))]
    out.append(cyl("PotSoil", r * 0.92, 0.01, g(x, y0 + h - 0.04, z), M["timber_dark"], 10))
    out += tuft(x, y0 + h - 0.06, z, plant[1], plant[0], 3, seed)
    return out


# ================================================================================================================================
# THE STATIONS
# ================================================================================================================================
WC = STATIONS["chlorine"]
pc = [lb("Cistern", -0.75, 0.75, 0, 0.85, -0.45, 0.45, M["temple"], 0.05)]
pc.append(lb("CisternLip", -0.82, 0.82, 0.85, 0.95, -0.52, 0.52, M["temple"], 0.03))
pc.append(lb("CisternWater", -0.68, 0.68, 0.86, 0.87, -0.38, 0.38, M["water"], 0.0))
# the bamboo spout from a post, pouring in
pc += bamboo_pole(0.7, -0.3, 1.6, 0.05)
pc.append(rod("Spout", (0.7, 1.45, -0.3), (0.25, 1.3, -0.1), 0.045, M["pole"], 8))
# the brass hand pump
pc.append(cyl("PumpBody", 0.07, 0.5, g(-0.55, 0.95, 0.0), M["brass"], 10))
pc.append(rod("PumpHandle", (-0.55, 1.42, 0.0), (-0.85, 1.6, 0.0), 0.02, M["brass"], 6))
pc.append(rod("PumpNozzle", (-0.55, 1.3, 0.0), (-0.4, 1.25, 0.0), 0.02, M["brass"], 6))
# clay jars of chlorine, a scoop, a test kit
for k, (x, z, h) in enumerate(((0.2, 0.62, 0.42), (-0.15, 0.68, 0.34), (0.5, 0.7, 0.3))):
    pc.append(trees.lathe("Jar", [(0.1, 0), (0.17, h * 0.4), (0.13, h * 0.85), (0.08, h)], 12, M["clay"], g(x, 0, z)))
    pc.append(cyl("JarLid", 0.09, 0.03, g(x, h, z), M["timber"], 10))
pc.append(lb("TestKit", -0.6, -0.3, 0.95, 1.02, 0.15, 0.35, M["white"], 0.01))
# the board on a bamboo frame behind it
for x in (-0.7, 0.7):
    pc += bamboo_pole(x, -0.55, 2.4, 0.05)
pc.append(lb("BoardBack", -0.75, 0.75, 1.55, 2.25, -0.6, -0.55, M["timber_dark"], 0.01))
pc.append(front("water_care", 1.45, 1.45 * 320 / 768, 1.9, -0.55))
add("stations", yawed(pc, WC["x"], WC["z"], TO_MX, "WaterCare"))

EC = STATIONS["relief"]
pc = [cyl("BasinPedestal", 0.22, 0.75, g(0, 0, 0), M["temple"], 10, r2=0.17)]
pc.append(cyl("BasinFoot", 0.32, 0.12, g(0, 0, 0), M["temple"], 10))
pc.append(trees.lathe("Basin", [(0.2, 0.75), (0.5, 0.85), (0.58, 1.0), (0.55, 1.04), (0.45, 0.96), (0.01, 0.9)], 18, M["temple"], g(0, 0, 0)))
pc.append(cyl("BasinWater", 0.47, 0.01, g(0, 0.96, 0), M["water"], 18))
# the spout: a little idol's face on a stone stele behind, water pouring from its mouth into the basin
pc.append(lb("Stele", -0.3, 0.3, 0, 1.75, -0.62, -0.42, M["temple"], 0.03))
pc.append(plane("SpoutFace", 0.42, 0.46, g(0, 1.42, -0.415), M["idol"]))
pc.append(cyl("Pour", 0.025, 0.42, g(0, 0.98, -0.28), sm("pour", "#bfe9ec", 0.05), 6, r2=0.035))
# towels on a bamboo rail
pc += bamboo_pole(-0.75, 0.0, 1.2, 0.04)
pc += bamboo_pole(0.75, 0.0, 1.2, 0.04)
pc.append(rod("TowelRail", (-0.75, 1.12, 0.0), (0.75, 1.12, 0.0), 0.03, M["pole"], 6))
for x, m in ((-0.45, M["towel_a"]), (0.42, M["towel_b"])):
    pc.append(lb("Towel", x - 0.17, x + 0.17, 0.55, 1.14, 0.02, 0.06, m, 0.02))
pc.append(lb("BoardBack", -0.75, 0.75, 1.85, 2.5, -0.66, -0.62, M["timber_dark"], 0.01))
pc.append(front("eye_care", 1.45, 1.45 * 320 / 768, 2.17, -0.62))
add("stations", yawed(pc, EC["x"], EC["z"], TO_MX, "EyeCare"))

# ================================================================================================================================
# THE COCONUT SHACK (the snack hut), the treats' crates
# ================================================================================================================================
SH = furniture("snack-hut")[0]
hx, hz = SH["hx"], SH["hz"]
pc = []
# (in local coordinates the counter faces +z: the hut is turned so it faces the river, +x)
for x in (-hz + 0.1, hz - 0.1):
    for z in (-hx + 0.1, hx - 0.1):
        pc += bamboo_pole(x, z, 2.5, 0.07)
pc.append(lb("Counter", -hz, hz, 0, 1.0, hx - 0.35, hx - 0.05, M["planks"], 0.02))
pc.append(lb("CounterTop", -hz - 0.1, hz + 0.1, 1.0, 1.07, hx - 0.5, hx + 0.1, M["timber"], 0.015))
pc.append(lb("BackShelf", -hz + 0.15, hz - 0.15, 1.3, 1.35, -hx + 0.1, -hx + 0.35, M["timber"], 0.01))
pc.append(lb("BackWall", -hz, hz, 0, 2.2, -hx, -hx + 0.08, M["planks"], 0.01))
roof = cyl("ShackRoof", max(hx, hz) * 1.8, 1.4, g(0, 2.45, 0), M["thatch"], 4, r2=0.05)
roof.rotation_euler = (0, 0, PI / 4)
apply_all(roof)
pc.append(roof)
pc.append(lb("SignBoard", -1.05, 1.05, 2.0, 2.45, hx + 0.15, hx + 0.22, M["timber_dark"], 0.01))
pc.append(front("snacks", 2.0, 2.0 * 320 / 1024, 2.225, hx + 0.22))
pc.append(back_pic("snacks", 2.0, 2.0 * 320 / 1024, 2.225, hx + 0.15))
pc.append(lb("MenuBack", -0.35, 0.35, 1.35, 2.25, -hx + 0.08, -hx + 0.11, M["timber_dark"], 0.01))
pc.append(front("menu", 0.62, 0.62 * 896 / 640, 1.8, -hx + 0.11))
# on the counter: coconuts with straws, a pineapple, the blender, smoothie cups
for k in range(4):
    x = -0.75 + k * 0.32
    pc.append(sphere("Coconut", 0.11, g(x, 1.17, hx - 0.2), M["coconut"], 10, 6))
    pc.append(rod("Straw", (x, 1.2, hx - 0.2), (x + 0.05, 1.42, hx - 0.18), 0.008, [M["pink"], M["lime"], M["yellow"], M["teal"]][k], 4))
pc.append(sphere("Pineapple", 0.11, g(0.55, 1.2, hx - 0.25), M["orange"], 10, 6, scale=(1, 1, 1.4)))
for k in range(5):
    a = k * TAU / 5
    pc.append(rod("PineLeaf", (0.55, 1.33, hx - 0.25), (0.55 + math.cos(a) * 0.08, 1.52, hx - 0.25 + math.sin(a) * 0.08), 0.015, M["leaf"], 4))
pc.append(cyl("BlenderBase", 0.09, 0.12, g(0.85, 1.07, hx - 0.3), M["white"], 10))
pc.append(cyl("BlenderJar", 0.08, 0.25, g(0.85, 1.19, hx - 0.3), sm("smoothie", "#f2a33a", 0.2), 10, r2=0.1))
for k in range(3):
    pc.append(cyl("Cup", 0.04, 0.12, g(-0.2 + k * 0.12, 1.07, hx - 0.38), [M["pink"], M["yellow"], M["lime"]][k], 8, r2=0.05))
# a hand of bananas hanging from the roof's front beam; coconuts on the back shelf
pc.append(rod("FrontBeam", (-hz, 2.3, hx - 0.1), (hz, 2.3, hx - 0.1), 0.05, M["pole"], 8))
for k in range(5):
    a = (k - 2) * 0.25
    pc.append(cyl("Banana", 0.035, 0.24, g(-0.6 + math.sin(a) * 0.08, 1.85, hx - 0.1 + math.cos(a) * 0.03), M["yellow"], 6, r2=0.02, rot=(0.3, a, 0)))
pc.append(rod("BananaString", (-0.6, 2.3, hx - 0.1), (-0.6, 2.08, hx - 0.1), 0.008, M["rope"], 4))
for k in range(5):
    pc.append(sphere("ShelfCoconut", 0.1, g(-0.7 + k * 0.35, 1.45, -hx + 0.22), M["coconut"], 8, 6))
add("shack", yawed(pc, SH["x"], SH["z"], PI / 2, "CoconutShack"))
# the dog treats: a pile of crates, its top where the game sets the jar (1.24 m up, 0.55 m toward +x)
TT = FIXTURES["treats"]
add("shack", crate(TT["x"] + 0.4, 0, TT["z"], 0.62, 0.62, 0.5, "crate_bananas", 0.1))
add("shack", crate(TT["x"] + 0.45, 0.62, TT["z"] + 0.02, 0.58, 0.6, 0.48, "crate_idol", -0.12))
add("shack", crate(TT["x"] - 0.25, 0, TT["z"] + 0.1, 0.5, 0.5, 0.45, "crate_tubes", 0.4))

# ================================================================================================================================
# THE BENCH, THE TOTEMS, THE PALMS, THE BOULDERS
# ================================================================================================================================
BE = furniture("bench")[0]
pc = []
for z in (-1.25, 1.25):
    pc.append(lb("BenchFoot", -0.35, 0.35, 0, 0.3, z - 0.18, z + 0.18, M["temple"], 0.04))
# (a split log on the feet, its flat face up at 0.6 m: the rescued sit on it; cylinders built along +z)
pc.append(cyl("BenchLog", 0.22, 3.3, g(0, 0.36, -1.65), M["bark"], 12, rot=(PI / 2, 0, 0)))
pc.append(lb("BenchSeat", -0.21, 0.21, 0.56, 0.6, -1.6, 1.6, M["planks"], 0.02))
pc.append(cyl("BenchBackLog", 0.12, 3.2, g(-0.32, 0.95, -1.6), M["bark"], 10, rot=(PI / 2, 0, 0)))
for z in (-1.0, 0.0, 1.0):
    pc.append(rod("BackStake", (-0.32, 0.4, z), (-0.34, 1.05, z), 0.05, M["timber_dark"], 6))
pc.append(lb("BenchTowel", -0.18, 0.18, 0.6, 0.65, 0.4, 0.9, M["towel_a"], 0.02))
add("furniture", yawed(pc, BE["x"], BE["z"], 0.0, "RescueBench"))


def totem(f, seed):
    x, z = f["x"], f["z"]
    out = [cyl("TotemFoot", f["hx"] * 0.95, 0.3, g(x, 0, z), M["temple"], 10)]
    out.append(cyl("Totem", 0.3, 2.3, g(x, 0.3, z), M["timber"], 10, r2=0.26))
    face_turn = math.atan2(-x, -z)
    for k in range(3):
        y = 0.8 + k * 0.62
        fx, fz = x + math.sin(face_turn) * 0.27, z + math.cos(face_turn) * 0.27
        out.append(plane("TotemFace", 0.48, 0.52, g(fx, y, fz), M["idol"], rot=(PI / 2, 0, -face_turn + PI)))
        out.append(cyl("TotemBand", 0.31, 0.06, g(x, y + 0.3, z), [M["red"], M["teal"], M["yellow"]][k], 10))
    out.append(cyl("TotemBowl", 0.18, 0.28, g(x, 2.6, z), M["iron"], 10, r2=0.26))
    out.append(anchor("Flame", x, 2.95, z))
    return out


for k, f in enumerate(furniture("tiki")):
    add("furniture", *totem(f, k))
for k, f in enumerate(furniture("palm")):
    x, z = f["x"], f["z"]
    add("furniture", cyl("PalmRing", 0.5, 0.32, g(x, 0, z), M["temple"], 12), cyl("PalmSoil", 0.44, 0.01, g(x, 0.31, z), M["timber_dark"], 12))
    if x < -8:  # (the near side: a banana plant, low, so the camera sees past it)
        add("furniture", cyl("BananaTrunk", 0.12, 1.1, g(x, 0.3, z), M["leaf_dark"], 8, r2=0.09))
        for q in range(7):
            a = q * TAU / 7 + R.uniform(-0.2, 0.2)
            add("furniture", trees.frond_card("BananaLeaf", Vector(g(x, 1.35, z)), -a, math.radians(R.uniform(25, 45)), R.uniform(1.2, 1.6), 0.5, math.radians(R.uniform(40, 70)), segs=4))
            set_mat(parts["furniture"][-1], M["banana"])
        add("furniture", *[t for t in []])
    else:
        # (leaning away from the river, its crown out over the deck and the wall rather than over the riders)
        s_, d_ = locate(x, z)
        add("furniture", *palm(x, z, 5.6 + R.uniform(-0.4, 0.8), 800 + k, y0=0.3, lean=0.2, away=point(s_, 0)))
    for q in range(3):
        a = q * TAU / 3 + 0.5
        add("furniture", *tuft(x + math.cos(a) * 0.3, 0.3, z + math.sin(a) * 0.3, 0.45, [M["bromeliad"], M["heliconia"], M["paradise"]][q], 1, 820 + k * 3 + q))
for k, f in enumerate(furniture("boulder")):
    x, z = f["x"], f["z"]
    sz = max(f["hx"], f["hz"]) * 1.05
    add("furniture", blob("Boulder", g(x, sz * 0.35, z), (sz, sz * 0.85, sz * 0.7), M["rock"], 900 + k, (10, 6), 0.22))
    for q in range(3):
        a = R.uniform(0, TAU)
        d = sz * R.uniform(0.75, 1.0)
        add("furniture", blob("Rock", g(x + math.cos(a) * d, 0.1, z + math.sin(a) * d), (sz * 0.3, sz * 0.28, sz * 0.22), M["rock"], 910 + k * 5 + q, (8, 5), 0.22))
    add("furniture", blob("BoulderMoss", g(x, sz * 0.85, z), (sz * 0.7, sz * 0.6, sz * 0.25), M["hedge"], 930 + k, (8, 4), 0.25))
    add("furniture", *tuft(x + sz * 0.7, 0, z - sz * 0.5, 0.7, M["frond"], 3, 940 + k))
    if k == 0:  # a sunken idol's head beside it, its face up, one eye open
        head = [lb("IdolHead", -0.4, 0.4, 0, 0.8, -0.35, 0.35, M["temple"], 0.08)]
        head.append(plane("IdolHeadFace", 0.74, 0.76, g(0, 0.4, 0.355), M["idol"]))
        hd = join(head, "IdolHead")
        add("furniture", place(hd, x + 0.85, -0.25, z - 0.55, 0.6, -0.5))

# ================================================================================================================================
# THE WALLS' BOARDS: the rings', the fish net's, the skimmer's; the litter urn; the torch's pedestal; the fuse box's hood
# ================================================================================================================================


def board_on_posts(img, w_, h_, y0, post_h, extra=None, seed=0):
    """A painted board (facing local +z) on two bamboo posts, a little thatched hood over it."""
    out = [lb("BoardBack", -w_ / 2 - 0.05, w_ / 2 + 0.05, y0 - 0.05, y0 + h_ + 0.05, -0.06, 0.0, M["timber_dark"], 0.01)]
    out.append(front(img, w_, h_, y0 + h_ / 2, 0.0))
    for s in (-1, 1):
        out += bamboo_pole(s * (w_ / 2 + 0.1), -0.05, post_h, 0.05)
    hood = cyl("Hood", w_ * 0.75, 0.32, g(0, post_h - 0.05, -0.05), M["thatch"], 4, r2=0.05)
    hood.scale = (1.0, 0.45, 1.0)
    hood.rotation_euler = (0, 0, PI / 4)
    apply_all(hood)
    out.append(hood)
    if extra:
        out += extra
    return out


for k, mnt in enumerate(RING_MOUNTS):
    pc = board_on_posts("life_ring", 1.0, 1.0 * 320 / 768, 2.25, 2.85)
    pc.append(lb("RingBack", -0.55, 0.55, 0.95, 2.15, -0.06, 0.0, M["planks"], 0.02))
    pc.append(rod("RingPeg", (0, 2.0, 0.0), (0, 2.0, 0.22), 0.04, M["iron"], 6))
    add("walls", yawed(pc, mnt["x"], mnt["z"], mnt["angle"], f"RingBoard{k}"))
    add("walls", torus("LifeRing", 0.4, 0.1, g(mnt["x"], 1.65, mnt["z"]), M["orange"], 12, 6))
FN = FIXTURES["fishNet"]
pc = board_on_posts("fish_net", 1.1, 1.1 * 320 / 768, 2.35, 2.95)
pc.append(lb("NetBack", -0.6, 0.6, 0.2, 2.2, -0.06, 0.0, M["planks"], 0.02))
add("walls", yawed(pc, FN["x"], FN["z"], FN["angle"], "FishNetBoard"))
SK = SANITATION["rack"]
wallX = DECK["minX"] - 0.45
pc = board_on_posts("skimmer", 1.3, 1.3 * 320 / 768, 2.35, 2.95)
pc.append(lb("SkimBack", -1.95, 1.95, 1.1, 2.25, -0.06, 0.0, M["planks"], 0.02))
for name, w_, h_, y_, x_ in (("missing", 0.36, 0.5, 1.68, -1.45), ("rules", 0.4, 0.52, 1.68, 1.45)):
    pc.append(front(name, w_, h_, y_, 0.004, x_))
pc += [bamboo_pole(s * 1.95, -0.05, 2.4, 0.05)[0] for s in (-1, 1)]
add("walls", yawed(pc, wallX, SK["z"], TO_PX, "SkimmerBoard"))
BN = SANITATION["bin"]
add("walls", trees.lathe("LitterUrn", [(0.3, 0), (0.42, 0.25), (0.46, 0.6), (0.36, 0.85), (0.4, 0.95), (0.42, 1.0)], 14, M["temple"], g(BN["x"], 0, BN["z"])))
add("walls", cyl("UrnLid", 0.4, 0.08, g(BN["x"], 1.0, BN["z"]), M["timber"], 14, r2=0.3))
pc = [plane("LitterSign", 0.5, 0.25, g(0, 0.62, 0.47), signmat("litter", 0.6))]
add("walls", yawed(pc, BN["x"], BN["z"], TO_PX, "LitterSign"))
FL = FIXTURES["flashlight"]
add("walls", cyl("TorchPedestal", 0.22, 1.0, g(FL["x"], 0, FL["z"]), M["temple"], 8, r2=0.17))
add("walls", cyl("TorchPedestalTop", 0.28, 0.08, g(FL["x"], 1.0, FL["z"]), M["temple"], 8))
add("walls", cyl("Flashlight", 0.06, 0.3, g(FL["x"], 1.09, FL["z"]), M["black"], 8))
FU = FIXTURES["fuseBox"]
fx = FU["x"] - 0.1
add("walls", box("FuseBoard", fx - 0.06, fx + 0.02, 0.9, 2.3, FU["z"] - 0.6, FU["z"] + 0.6, M["planks"], 0.015))
add("walls", rod("FuseConduit", (fx, 2.3, FU["z"]), (fx, 3.0, FU["z"]), 0.03, M["iron"], 6))
add("walls", plane("Danger", 0.48, 0.3, g(fx - 0.065, 2.0, FU["z"] - 0.95), signmat("danger", 0.5), rot=(PI / 2, 0, -PI / 2)))
add("walls", box("DangerBack", fx - 0.06, fx - 0.03, 1.83, 2.17, FU["z"] - 1.21, FU["z"] - 0.69, M["timber_dark"], 0.005))

# ================================================================================================================================
# THE EDGES: the back wall's strip (z -16.7 .. -15.2), the end's (12.65 .. 13.6), the ruin's face, the near wall's rail
# ================================================================================================================================
BZ = ROOM["minZ"] + 0.15  # just in front of the palisade
# the notice wall: a bamboo frame on the palisade, the explorer's map, the poster, MISSING
pc = []
for x in (-1.25, 1.25):
    pc += bamboo_pole(x, 0.05, 2.5, 0.05)
for y in (0.6, 2.35):
    pc.append(rod("NoticeRail", (-1.3, y, 0.05), (1.3, y, 0.05), 0.04, M["pole"], 6))
pc.append(lb("NoticeBack", -1.2, 1.2, 0.65, 2.3, 0.0, 0.04, M["planks"], 0.01))
pc.append(front("map", 1.2, 0.9, 1.6, 0.04, -0.45))
pc.append(front("poster", 0.62, 0.83, 1.55, 0.04, 0.68))
pc.append(front("missing", 0.36, 0.5, 1.02, 0.045, -0.75))
for x, y in ((-1.0, 2.0), (0.1, 2.0), (0.4, 1.95), (0.95, 1.92), (-0.75, 1.26)):
    pc.append(sphere("Pin", 0.02, g(x, y, 0.055), M["red"], 6, 4))
add("edges", yawed(pc, -11.4, BZ, TO_PZ, "NoticeWall"))
# the expedition's crates: a pith helmet, binoculars, a coil of rope, a barrel
add("edges", crate(-8.6, 0, BZ + 0.45, 0.8, 0.62, 0.6, "crate_bananas", 0.05))
add("edges", crate(-8.55, 0.62, BZ + 0.42, 0.62, 0.52, 0.5, "crate_idol", -0.12))
add("edges", crate(-7.7, 0, BZ + 0.4, 0.62, 0.55, 0.5, "crate_tubes", 0.2))
add("edges", sphere("PithHelmet", 0.17, g(-8.55, 1.18, BZ + 0.42), M["khaki"], 12, 6, scale=(1.15, 1, 0.75)))
add("edges", cyl("HelmetBrim", 0.24, 0.02, g(-8.55, 1.15, BZ + 0.42), M["khaki"], 14))
add("edges", cyl("HelmetBand", 0.175, 0.04, g(-8.55, 1.17, BZ + 0.42), M["timber_dark"], 14))
for dx in (-0.05, 0.05):
    add("edges", cyl("Binocular", 0.035, 0.14, g(-7.7 + dx, 0.56, BZ + 0.4), M["black"], 8, rot=(PI / 2, 0, 0)))
add("edges", torus("RopeCoil", 0.22, 0.045, g(-9.35, 0.05, BZ + 0.45), M["rope"], 16, 6))
add("edges", torus("RopeCoil", 0.17, 0.045, g(-9.35, 0.13, BZ + 0.45), M["rope"], 16, 6))
add("edges", cyl("Barrel", 0.28, 0.75, g(-6.85, 0, BZ + 0.4), M["timber"], 14, r2=0.3))
for y in (0.12, 0.62):
    add("edges", torus("BarrelHoop", 0.29, 0.015, g(-6.85, y, BZ + 0.4), M["iron"], 14, 4))
# pots of heliconia and bird of paradise; a basket of coconuts
for k, (x, plant) in enumerate(((-5.9, (M["heliconia"], 0.9)), (-5.2, (M["paradise"], 0.85)), (-4.45, (M["heliconia"], 0.8)))):
    add("edges", *clay_pot(x, BZ + 0.4, 0.22, 0.42, plant, 960 + k))
add("edges", cyl("Basket", 0.3, 0.3, g(-3.7, 0, BZ + 0.45), sm("wicker", "#c9a06a", 0.9), 12, r2=0.34))
for k in range(6):
    a = k * TAU / 6
    add("edges", sphere("BasketCoconut", 0.11, g(-3.7 + math.cos(a) * 0.15, 0.36, BZ + 0.45 + math.sin(a) * 0.15), M["coconut"], 8, 6))
# the signpost by the gate
pc = bamboo_pole(0, 0, 2.6, 0.06)
for k, (name, y, turn) in enumerate((("arrow_temple", 2.3, 0.3), ("arrow_cave", 1.95, -0.4), ("arrow_snacks", 1.6, 0.9), ("arrow_out", 1.25, -1.1))):
    arm = plane("Arrow", 0.75, 0.19, g(0.0, y, 0.07), cutmat(name, 0.6))
    arm2 = plane("ArrowBack", 0.75, 0.19, g(0.0, y, 0.05), cutmat(name, 0.6), rot=(PI / 2, 0, PI))
    for o in (arm, arm2):
        o.rotation_euler.z += turn
        apply_all(o)
        pc.append(o)
add("edges", yawed(pc, -3.0, BZ + 0.45, TO_PZ, "Signpost"))
# right of the gate: the river's rules on a board
pc = board_on_posts("rules", 0.62, 0.81, 0.85, 1.95)
add("edges", yawed(pc, 3.5, BZ + 0.2, TO_PZ, "RulesBoard"))

EZ = ROOM["maxZ"] - 0.15  # just inside the end's palisade
# the crocodile: a log with two eyes and nostrils, its sign on a stake
log = [cyl("CrocLog", 0.22, 2.2, g(-11.3, 0.2, EZ - 0.45), M["bark"], 10, rot=(0, PI / 2, 0))]
for dx in (-0.08, 0.08):
    log.append(sphere("CrocEye", 0.06, g(-9.3, 0.42, EZ - 0.45 + dx), M["yellow"], 8, 6))
    log.append(sphere("CrocPupil", 0.025, g(-9.27, 0.45, EZ - 0.45 + dx), M["black"], 6, 4))
for k in range(5):
    log.append(cyl("CrocKnob", 0.06, 0.06, g(-10.8 + k * 0.35, 0.4, EZ - 0.45), M["bark"], 6, r2=0.02))
add("edges", *log)
pc = [cyl("Stake", 0.04, 1.2, g(0, 0, 0), M["timber"], 6)]
pc.append(lb("CrocSignBack", -0.42, 0.42, 0.75, 1.13, -0.04, 0.0, M["timber_dark"], 0.01))
pc.append(front("croc", 0.8, 0.8 * 320 / 768, 0.94, 0.0))
add("edges", yawed(pc, -12.1, EZ - 0.7, TO_MZ, "CrocSign"))
# the dugout canoe on trestles, its paddles leaning
for x in (-7.6, -5.6):
    for s in (-1, 1):
        add("edges", rod("Trestle", (x, 0, EZ - 0.5 + s * 0.25), (x, 0.5, EZ - 0.5), 0.03, M["timber_dark"], 5))
canoe = trees.lathe("Canoe", [(0.01, -1.4), (0.18, -1.2), (0.3, -0.6), (0.32, 0.0), (0.3, 0.6), (0.18, 1.2), (0.01, 1.4)], 12, M["timber"], (0, 0, 0), squash=0.7)
add("edges", place(canoe, -6.6, 0.8, EZ - 0.5, 0.0, 0.0, PI / 2))
for k, x in enumerate((-4.9, -4.7)):
    add("edges", rod("Paddle", (x, 0.0, EZ - 0.3), (x + 0.08, 1.5, EZ - 0.12), 0.025, M["timber"], 6))
    add("edges", place(lb("PaddleBlade", -0.08, 0.08, 0.0, 0.42, -0.015, 0.015, M["timber"], 0.01), x, 0.0, EZ - 0.3, 0.2 * k))
# a stone bench and NO SPLASHING THE IDOL near the temple
add("edges", lb("StoneBench", -3.2, -1.6, 0.0, 0.45, EZ - 0.6, EZ - 0.15, M["temple"], 0.04))
add("edges", *clay_pot(-3.6, EZ - 0.4, 0.2, 0.38, (M["bromeliad"], 0.6), 990))
pc = [cyl("Stake", 0.04, 1.3, g(0, 0, 0), M["timber"], 6)]
pc.append(lb("NoSplashBack", -0.42, 0.42, 0.85, 1.28, -0.04, 0.0, M["timber_dark"], 0.01))
pc.append(front("no_splash", 0.8, 0.4, 1.06, 0.0))
add("edges", yawed(pc, 0.6, EZ - 0.4, TO_MZ, "NoSplashSign"))
# the ruin's face: SHHH! IDOL SLEEPING; lianas, moss and bromeliads in its niches
FX = ROOM["maxX"] - 0.12
add("edges", yawed([lb("ShhhBack", -0.62, 0.62, 1.15, 1.8, -0.04, 0.0, M["timber_dark"], 0.01), front("shhh", 1.2, 0.6, 1.475, 0.0)], FX, 7.6, TO_MX, "ShhhSign"))
RUIN = json.load(open(os.path.join(WORK, "ruin.json")))  # (shell.py's bays: [z0, z1, height])
for k in range(16):
    z = ROOM["minZ"] + 1.0 + k * (ROOM["maxZ"] - ROOM["minZ"] - 2.0) / 15
    bay = next((b for b in RUIN if b[0] <= z <= b[1]), None)
    if any(abs(z - q) < 0.8 for q in (FN["z"], FU["z"], 5.6, 7.6)) or not bay or bay[2] < 1.5:
        continue  # (the boards, and the ruin's collapsed bays: nothing to hang from)
    top = bay[2] + 0.1
    L = R.uniform(0.9, 2.0)
    add("edges", plane("Liana", L * 0.5, L, g(FX - 0.02, top - L / 2, z), M["liana"], rot=(PI / 2, 0, -PI / 2)))
    if k % 3 == 0:
        add("edges", blob("WallMoss", g(FX + 0.15, top - 0.05, z + 0.4), (0.25, 0.45, 0.15), M["hedge"], 1000 + k, (8, 4), 0.25))
        add("edges", *tuft(FX - 0.05, 0.0, z + 0.3, 0.55, M["bromeliad"], 2, 1010 + k))
# planters on the near wall's rail, clear of the boards
NX = ROOM["minX"] + 0.05
for k in range(9):
    z = ROOM["minZ"] + 1.6 + k * 3.2
    if any(abs(z - q) < 1.2 for q in (-1.2, 9.4, SK["z"])):
        continue
    add("edges", lb("Planter", NX - 0.14, NX + 0.14, 1.0, 1.2, z - 0.4, z + 0.4, M["planks"], 0.01))
    add("edges", *tuft(NX, 1.16, z - 0.15, 0.4, M["bromeliad"], 2, 1100 + k))
    add("edges", *tuft(NX, 1.16, z + 0.2, 0.45, M["heliconia"] if k % 2 else M["paradise"], 2, 1120 + k))

# ================================================================================================================================
# OUTSIDE: the expedition's camp beyond the ruin's collapsed bays
# ================================================================================================================================
CX, CZ = 18.0, -5.0
tent = []
L = 2.6
bm = bmesh.new()
pts = [(-1.2, 0.0), (1.2, 0.0), (0.0, 1.6)]
vs = [[bm.verts.new(g(CX + x, y, CZ + zz)) for x, y in pts] for zz in (-L / 2, L / 2)]
for a, b_ in ((0, 2), (2, 1)):
    bm.faces.new((vs[0][a], vs[1][a], vs[1][b_], vs[0][b_]))
bm.faces.new((vs[0][0], vs[0][2], vs[0][1]))
me = bpy.data.meshes.new("Tent")
bm.to_mesh(me)
bm.free()
tento = bpy.data.objects.new("Tent", me)
bpy.context.scene.collection.objects.link(tento)
tento.data.materials.append(M["canvas_g"])
add("camp", tento)
add("camp", plane("TentDoor", 1.0, 1.2, g(CX, 0.6, CZ + L / 2 + 0.01), M["timber_dark"]))
for zz in (-L / 2 - 0.1, L / 2 + 0.1):
    add("camp", rod("TentPole", (CX, 0, CZ + zz), (CX, 1.7, CZ + zz), 0.03, M["timber"], 6))
    for s in (-1, 1):
        add("camp", rod("GuyRope", (CX, 1.65, CZ + zz), (CX + s * 1.8, 0, CZ + zz * 1.3), 0.008, M["rope"], 4))
# the table with the map, a lantern, a compass; two folding chairs
tx, tz = CX - 2.2, CZ + 2.4
for dx in (-0.55, 0.55):
    for dz in (-0.35, 0.35):
        add("camp", rod("TableLeg", (tx + dx, 0, tz + dz), (tx + dx, 0.75, tz + dz), 0.025, M["timber_dark"], 5))
add("camp", lb("TableTop", tx - 0.65, tx + 0.65, 0.75, 0.8, tz - 0.42, tz + 0.42, M["planks"], 0.01))
add("camp", plane("TableMap", 0.8, 0.6, g(tx - 0.1, 0.805, tz), signmat("map", 0.8), rot=(0, 0, 0.15)))
add("camp", cyl("Light_Lantern", 0.08, 0.22, g(tx + 0.4, 0.8, tz - 0.15), M["lantern"], 8))
add("camp", cyl("LanternCap", 0.1, 0.06, g(tx + 0.4, 1.02, tz - 0.15), M["iron"], 8, r2=0.03))
add("camp", cyl("Compass", 0.06, 0.02, g(tx + 0.3, 0.8, tz + 0.2), M["brass"], 12))
for dz, turn in ((-0.9, 0.3), (0.95, PI - 0.2)):
    ch = [lb("ChairSeat", -0.25, 0.25, 0.42, 0.45, -0.22, 0.22, M["canvas"], 0.01), lb("ChairBack", -0.25, 0.25, 0.45, 0.9, -0.24, -0.2, M["canvas"], 0.01)]
    for s in (-1, 1):
        ch.append(rod("ChairLeg", (s * 0.24, 0, -0.2), (s * 0.24, 0.45, 0.2), 0.015, M["timber"], 4))
        ch.append(rod("ChairLeg", (s * 0.24, 0, 0.2), (s * 0.24, 0.45, -0.2), 0.015, M["timber"], 4))
    add("camp", yawed(ch, tx, tz + dz, turn, "CampChair"))
# crates and a campfire with its pot on a tripod (the game's flame)
add("camp", crate(CX + 1.8, 0, CZ - 1.2, 0.7, 0.55, 0.55, "crate_bananas", 0.4))
add("camp", crate(CX + 1.9, 0.55, CZ - 1.15, 0.6, 0.5, 0.5, "crate_idol", -0.2))
fx_, fz_ = CX - 1.2, CZ + 4.8
for k in range(8):
    a = k * TAU / 8
    add("camp", blob("FireStone", g(fx_ + math.cos(a) * 0.45, 0.05, fz_ + math.sin(a) * 0.45), (0.13, 0.12, 0.1), M["rock"], 1200 + k, (6, 4), 0.2))
for k in range(4):
    a = k * TAU / 4 + 0.3
    add("camp", rod("FireLog", (fx_ + math.cos(a) * 0.35, 0.02, fz_ + math.sin(a) * 0.35), (fx_ - math.cos(a) * 0.05, 0.15, fz_ - math.sin(a) * 0.05), 0.05, M["bark"], 6))
for k in range(3):
    a = k * TAU / 3
    add("camp", rod("Tripod", (fx_ + math.cos(a) * 0.55, 0, fz_ + math.sin(a) * 0.55), (fx_, 1.25, fz_), 0.025, M["timber_dark"], 5))
add("camp", rod("PotChain", (fx_, 1.25, fz_), (fx_, 0.85, fz_), 0.008, M["iron"], 4))
add("camp", sphere("Pot", 0.2, g(fx_, 0.7, fz_), M["iron"], 12, 8, scale=(1, 1, 0.8)))
add("camp", anchor("Flame", fx_, 0.35, fz_))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("dk_back", g(-7.0, 1.2, -15.6), 9, 15, 0, (1280, 720), 16, 30)
    look("dk_end", g(-6.0, 0.8, 12.8), 9, 18, 180, (1280, 720), 16, 30)
    look("dk_far", g(11.0, 1.2, 1.5), 9, 18, 270, (1280, 720), 16, 30)
    look("dk_shack", g(-10.5, 1.2, 8.2), 6, 20, 120, (1280, 720), 16, 35)
    look("dk_camp", g(18.0, 0.8, -2.5), 8, 25, 260, (1280, 720), 16, 30)
save_part("deck", [o for v in parts.values() for o in v if o])
