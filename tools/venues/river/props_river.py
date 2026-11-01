"""The Lazy River's pieces on and over the water, every one where the game's plan has it (kit.PLAN, the river's own geometry):
- the cave the river comes out of (the back wall): a sculpted arch of mossy boulders, stalactites, a mound of rock behind with ferns
  and bromeliads on its ledges, lianas over the mouth, the dark inside (the game's waterfall and mist fall across it);
- the temple it goes into (the end): two carved pillars and a stone lintel with TEMPLE RAPIDS cut into it, and over them the Lazy
  Idol, a giant stone face yawning on its slab, stepped ruins either side with torches, a mound of overgrown blocks, lianas, the
  dark beyond;
- the rope bridge (planks on two beams, posts with carved tops and lanterns, rope rails sagging between them, drop ropes, two logs
  under it), the two stepping stones (flat-topped boulders, their tops at the deck's height, mossy at the rim, pebbles round them);
- the two docks (planks over the water's edge, steps down into it, a bamboo arch with ALL ABOARD! or EXIT, a tube on top), the tube
  return (a low bamboo rack on a slatted floor, its sign), the tube rack (bamboo, a slatted base: the game's tubes stand in it, TUBES);
- the torches round the deck and at the docks, iron baskets on bamboo poles (`Anchor_Flame`: the game's flames burn in them).

    blender -b -P tools/venues/river/props_river.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import blob  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(1932)
TAU = 2 * PI
M = dict(
    rock=tmat_tile("riverrock", "#5a5a50", 0.6),
    temple=tmat_tile("templestone", "#9a9a84", 0.88),
    planks=tmat_tile("planks", "#8a5a33", 0.75),
    bamboo_t=tmat_tile("bamboo", "#cfae62", 0.6),
    hedge=tmat_tile("hedge", "#2f6b34", 0.8),
    pole=sm("bamboo"),
    pole_dark=sm("bamboo_dark"),
    rope=sm("rope"),
    timber=sm("timber"),
    timber_dark=sm("timber_dark"),
    iron=sm("iron"),
    rust=sm("rust"),
    moss=sm("moss"),
    dark=sm("cave_dark", "#07100a", 1.0),
    red=sm("red"),
    yellow=sm("yellow"),
    orange=sm("orange"),
    teal=sm("teal"),
    white=sm("white"),
    lantern=lamp_mat("lantern_glass", "#ffd99a", 3.0),
    idol=cutmat("idol", 0.85),
    liana=cutmat("liana", 0.7),
    fern=cutmat("palm_frond", 0.65),
    bromeliad=cutmat("bromeliad", 0.6),
    heliconia=cutmat("heliconia", 0.6),
    monstera=cutmat("monstera_1", 0.6),
    temple_sign=signmat("temple", 0.85),
)
parts = {}
trees.use({"frond": M["fern"]})


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


def flow_yaw(s):
    """The yaw that turns local +z along the flow and local +x across it, toward +d (the three.js group's turn)."""
    c = at(s)
    return math.atan2(c["tx"], c["tz"])


def rock(name, x, y, z, size, squash=0.75, seed=0, m=None):
    return blob(name, g(x, y, z), (size, size * (0.8 + 0.3 * random.Random(seed).random()), size * squash), m or M["rock"], seed, (9, 6), 0.22)


def tuft(x, y, z, s, m, n=2, seed=0):
    r = random.Random(seed)
    out = []
    for k in range(n):
        a = k * PI / n + r.uniform(-0.3, 0.3)
        out.append(plane("Tuft", s * r.uniform(0.9, 1.2), s, g(x, y + s / 2 - 0.04, z), m, rot=(PI / 2, 0, a)))
    return out


def hang(x, y, z, length, turn, m=None):
    """A liana card hanging from (x, y, z), `length` long, facing `turn`."""
    return plane("Liana", length * 0.5, length, g(x, y - length / 2, z), m or M["liana"], rot=(PI / 2, 0, turn))


def bamboo_pole(x, z, h, r=0.06, y0=0.0):
    out = [cyl("Bamboo", r, h, g(x, y0, z), M["pole"], 8, r2=r * 0.92)]
    y = 0.45
    while y < h - 0.1:
        out.append(cyl("BambooNode", r * 1.25, 0.05, g(x, y0 + y, z), M["pole_dark"], 8))
        y += 0.55 + random.Random(int(x * 100 + z * 10 + y * 7)).uniform(-0.06, 0.08)
    return out


# ================================================================================================================================
# THE CAVE (the river's way in, at the back wall)
# ================================================================================================================================
s0 = S_START
c0 = at(s0)
left = point(s0, -W - 0.9)
right = point(s0, W + 0.9)
H_CAVE = 3.4
cave = []
for k in range(25):
    a = k / 24 * PI
    u = 0.5 - math.cos(a) / 2
    y = math.sin(a) * H_CAVE
    x = left[0] + (right[0] - left[0]) * u
    z = left[1] + (right[1] - left[1]) * u
    for depth in range(3):
        back = depth * 0.85 + 0.25
        cave.append(rock("CaveArch", x - c0["tx"] * back, y + R.uniform(-0.1, 0.1), z - c0["tz"] * back, 0.6 + R.uniform(0, 0.35), 0.85, k * 7 + depth))
# the mound over and behind it, up to 6 m, wide enough to close the palisade's gap
for k in range(46):
    u = R.uniform(-0.25, 1.25)
    back = R.uniform(1.2, 6.5)
    x = left[0] + (right[0] - left[0]) * u - c0["tx"] * back
    z = left[1] + (right[1] - left[1]) * u - c0["tz"] * back
    hgt = H_CAVE * R.uniform(0.3, 1.25) if 0 < u < 1 else R.uniform(0.6, 3.2)
    cave.append(rock("CaveMound", x, hgt, z, 1.0 + R.uniform(0, 1.0), 0.75, 100 + k))
# the mouth's sides, down into the water
for side in (-1, 1):
    y = -0.7
    while y < H_CAVE * 0.85:
        x, z = point(s0 - 0.3, side * (W + 0.55 + R.uniform(0, 0.35)))
        cave.append(rock("CaveSide", x, y, z, 0.62 + R.uniform(0, 0.3), 0.9, int(y * 100) + side * 7))
        y += 0.55
# stalactites hanging under the arch's crown
for k in range(9):
    u = 0.25 + 0.5 * k / 8
    x = left[0] + (right[0] - left[0]) * u + c0["tx"] * 0.1
    z = left[1] + (right[1] - left[1]) * u + c0["tz"] * 0.1
    top = math.sin(math.acos(1 - 2 * u)) * H_CAVE - 0.3
    L = R.uniform(0.3, 0.75)
    cave.append(cyl("Stalactite", 0.09, L, g(x, top - L, z), M["rock"], 6, r2=0.0, rot=(PI, 0, 0)))
add("cave", *cave)
# the dark inside
back = point(max(0.3, s0 - 2.6), 0)
span = math.hypot(right[0] - left[0], right[1] - left[1])
dark = plane("CaveDark", span + 0.6, H_CAVE + 1.2, g(back[0], H_CAVE / 2 - 0.4, back[1]), M["dark"], rot=(PI / 2, 0, flow_yaw(s0)))
add("cave", dark)
# moss caps, ferns, bromeliads and heliconias on its ledges; lianas over the mouth
for k in range(14):
    u = R.uniform(0.0, 1.0)
    a = u * PI
    x = left[0] + (right[0] - left[0]) * (0.5 - math.cos(a) / 2) - c0["tx"] * R.uniform(0.3, 1.5)
    z = left[1] + (right[1] - left[1]) * (0.5 - math.cos(a) / 2) - c0["tz"] * R.uniform(0.3, 1.5)
    y = math.sin(a) * H_CAVE + 0.45
    add("cave", blob("CaveMoss", g(x, y, z), (0.55, 0.5, 0.22), M["hedge"], 300 + k, (8, 4), 0.25))
    m = [M["bromeliad"], M["heliconia"], M["monstera"], M["fern"]][k % 4]
    add("cave", *tuft(x, y + 0.1, z, R.uniform(0.6, 0.95), m, 2, 400 + k))
for k in range(12):
    u = 0.12 + 0.76 * k / 11
    a = u * PI
    x = left[0] + (right[0] - left[0]) * (0.5 - math.cos(a) / 2) + c0["tx"] * 0.35
    z = left[1] + (right[1] - left[1]) * (0.5 - math.cos(a) / 2) + c0["tz"] * 0.35
    y = math.sin(a) * H_CAVE - 0.05
    add("cave", hang(x, y, z, R.uniform(0.9, 1.9), flow_yaw(s0) + R.uniform(-0.3, 0.3)))

# ================================================================================================================================
# THE TEMPLE OF THE LAZY IDOL (the river's way out, at the end)
# ================================================================================================================================
s1 = S_END
c1 = at(s1)
T = []
half = W + 0.45
HT = 3.2
for side in (-1, 1):
    x = side * (half + 0.55)
    T.append(lb("TemplePillar", x - 0.55, x + 0.55, -1.2, HT, -0.6, 0.6, M["temple"], 0.04))
    T.append(lb("PillarCap", x - 0.68, x + 0.68, HT, HT + 0.25, -0.72, 0.72, M["temple"], 0.04))
    T.append(lb("PillarBase", x - 0.68, x + 0.68, -0.1, 0.35, -0.72, 0.72, M["temple"], 0.04))
    # a carved band round the pillar
    T.append(lb("PillarBand", x - 0.58, x + 0.58, 1.9, 2.05, -0.63, 0.63, M["temple"], 0.02))
    # stepped ruins either side, a pyramid's broken flank
    for k in range(4):
        hh = 0.9 + k * 0.55
        xx = side * (half + 1.65 + k * 1.15)
        T.append(lb("TempleStep", xx - 0.6, xx + 0.6, -0.1, hh, -0.4 + k * 0.25, 0.9 + k * 0.25, M["temple"], 0.06))
    # a torch on each pillar's upstream face (the game's flame burns in it)
    T.append(rod("TorchArm", (x, 2.3, -0.6), (x, 2.45, -0.95), 0.03, M["iron"], 5))
    T.append(cyl("TorchBowl", 0.16, 0.18, g(x, 2.45, -0.95), M["iron"], 10, r2=0.22))
T.append(lb("Lintel", -half - 1.25, half + 1.25, HT + 0.25, HT + 1.05, -0.65, 0.65, M["temple"], 0.04))
T.append(plane("TempleSign", 2 * half + 1.6, (2 * half + 1.6) * 256 / 1536, g(0, HT + 0.65, -0.66), M["temple_sign"], rot=(PI / 2, 0, PI)))
# the Lazy Idol: its slab and its face over the lintel, yawning upstream
IDOL_W = 3.6
T.append(lb("IdolSlab", -IDOL_W / 2 - 0.25, IDOL_W / 2 + 0.25, HT + 1.05, HT + 1.05 + IDOL_W * 1.0, -0.25, 0.45, M["temple"], 0.05))
T.append(plane("IdolFace", IDOL_W, IDOL_W * 1.0, g(0, HT + 1.05 + IDOL_W * 0.5, -0.27), M["idol"], rot=(PI / 2, 0, PI)))
T.append(lb("IdolCrown", -IDOL_W / 2 - 0.35, IDOL_W / 2 + 0.35, HT + 1.05 + IDOL_W, HT + 1.35 + IDOL_W, -0.35, 0.55, M["temple"], 0.05))
# the dark beyond, its walls, the roof
T.append(plane("TempleDark", 2 * half + 0.4, HT + 1.4, g(0, (HT + 1.4) / 2 - 1.2, 2.2), M["dark"], rot=(PI / 2, 0, 0)))
for side in (-1, 1):
    T.append(lb("TempleInner", side * half - 0.2, side * half + 0.2, -1.2, HT + 0.25, 0, 3.0, M["temple"], 0.03))
T.append(lb("TempleRoof", -half - 0.5, half + 0.5, HT + 0.25, HT + 0.75, 0, 3.2, M["temple"], 0.04))
for k in range(30):
    x = R.uniform(-half - 3.0, half + 3.0)
    z = R.uniform(1.2, 5.5)
    T.append(blob("TempleMound", g(x, HT + R.uniform(0.2, 1.8), z), (R.uniform(0.7, 1.4), R.uniform(0.6, 1.2), R.uniform(0.5, 1.0)), M["temple"] if k % 3 else M["hedge"], 500 + k, (8, 5), 0.2))
temple = yawed(T, c1["x"], c1["z"], flow_yaw(s1), "Temple")
add("temple", temple)
# flames, lianas over the opening and off the idol's slab, plants on the steps
for side in (-1, 1):
    x, z = point(s1, side * (half + 0.55))
    x -= c1["tx"] * 0.95
    z -= c1["tz"] * 0.95
    add("temple", anchor("Flame", x, 2.75, z))
for k in range(14):
    d = R.uniform(-half - 1.0, half + 1.0)
    x, z = point(s1 - 0.7, d)
    add("temple", hang(x, HT + 1.0, z, R.uniform(0.8, 2.2), flow_yaw(s1) + PI + R.uniform(-0.3, 0.3)))
for side in (-1, 1):
    for k in range(4):
        d = side * (half + 1.65 + k * 1.15)
        x, z = point(s1 - 0.2 - k * 0.25, d)
        m = [M["bromeliad"], M["heliconia"], M["monstera"], M["fern"]][(k + (side > 0)) % 4]
        add("temple", *tuft(x, 0.9 + k * 0.55, z, R.uniform(0.7, 1.0), m, 2, 600 + k * 3 + side))

# ================================================================================================================================
# THE ROPE BRIDGE
# ================================================================================================================================
B = BRIDGE
reach, bhalf = B.get("reach", W + 1.3), B.get("half", 0.85)
bp = []
x = -reach
while x <= reach + 0.01:
    tilt = R.uniform(-0.015, 0.015)
    bp.append(lb("Plank", x - 0.14, x + 0.14, 0.0 + tilt, 0.07 + tilt, -bhalf - 0.1 + R.uniform(-0.04, 0.04), bhalf + 0.1 + R.uniform(-0.04, 0.04), M["planks"], 0.015))
    x += 0.32
for z in (-bhalf, bhalf):
    bp.append(lb("BridgeBeam", -reach - 0.2, reach + 0.2, -0.17, -0.01, z - 0.1, z + 0.1, M["timber_dark"], 0.03))
    for x in (-reach - 0.1, -W - 0.3, W + 0.3, reach + 0.1):
        bp.append(cyl("BridgePost", 0.1, 1.32, g(x, -0.1, z), M["timber"], 8, r2=0.09))
        bp.append(sphere("PostKnob", 0.12, g(x, 1.27, z), M["timber_dark"], 8, 6, scale=(1, 1, 1.3)))
        bp.append(cyl("PostBand", 0.11, 0.08, g(x, 1.02, z), M["rope"], 8))
    pts = []
    for k in range(25):
        x = -reach - 0.1 + (reach + 0.1) * 2 * k / 24
        sag = 0.12 * (1 - (x / (reach + 0.1)) ** 2)
        pts.append(Vector(g(x, 1.08 - sag, z)))
    bp.append(tube("BridgeRope", pts, 0.032, M["rope"], 2, 6))
    x = -W + 0.2
    while x < W:
        sag = 0.12 * (1 - (x / (reach + 0.1)) ** 2)
        bp.append(rod("DropRope", (x, 0.07, z), (x, 1.06 - sag, z), 0.012, M["rope"], 4))
        x += 0.6
for x in (-W * 0.45, W * 0.45):
    bp.append(cyl("BridgeLog", 0.16, 1.9, g(x, -0.95, -0.95), M["timber_dark"], 10, rot=(PI / 2, 0, 0)))
# lanterns hanging off the end posts (their glass on its own: a Light_ object the exporter finds)
lamps = []
for xs in (-reach - 0.1, reach + 0.1):
    bp.append(rod("LanternHook", (xs, 1.2, -bhalf), (xs, 1.2, -bhalf - 0.25), 0.012, M["iron"], 4))
    bp.append(cyl("LanternCap", 0.1, 0.06, g(xs, 1.15, -bhalf - 0.25), M["iron"], 6, r2=0.03))
    lamps.append(cyl("Light_Lantern", 0.08, 0.2, g(xs, 0.95, -bhalf - 0.25), M["lantern"], 6))
cb = at(B["s"])
add("bridge", yawed(bp, cb["x"], cb["z"], flow_yaw(B["s"]), "Bridge"))
for k, lp in enumerate(lamps):
    add("bridge", yawed([lp], cb["x"], cb["z"], flow_yaw(B["s"]), "Light_Lantern"))

# ================================================================================================================================
# THE STEPPING STONES: flat-topped boulders from the bed to the deck's height
# ================================================================================================================================
for k, st in enumerate(STONES):
    r = st["r"]
    prof = [(r * 1.3, BED_Y), (r * 1.22, BED_Y + 0.4), (r * 1.08, WATER_Y - 0.05), (r * 1.02, -0.06), (r * 0.94, 0.0), (r * 0.8, 0.03), (0.01, 0.03)]
    stone = trees.lathe("SteppingStone", [(rr, y) for rr, y in prof], 12, M["rock"], g(st["x"], 0, st["z"]), noise=0.08, seed=700 + k)
    add("stones", stone)
    add("stones", blob("StoneMoss", g(st["x"] + 0.2, -0.03, st["z"] - 0.15), (r * 0.6, r * 0.5, 0.06), M["moss"], 710 + k, (8, 4), 0.2))
    # (the pebbles on the bank's side of the stone only: the riders float between the two stones)
    out_ = math.atan2(st["nz"], st["nx"]) + (0 if st["d"] > 0 else PI)
    for q in range(5):
        a = out_ + R.uniform(-1.0, 1.0)
        dd = r + 0.2 + R.uniform(0, 0.3)
        add("stones", rock("Pebble", st["x"] + math.cos(a) * dd, -0.36, st["z"] + math.sin(a) * dd, 0.1 + R.uniform(0, 0.12), 0.6, 720 + k * 9 + q))

# ================================================================================================================================
# THE DOCKS, THE TUBE RETURN, THE TUBE RACK
# ================================================================================================================================


def tube_model(name, cols, r=0.45, t=0.14):
    """A striped river tube lying flat at the origin."""
    out = []
    for i, c in enumerate(cols):
        a0 = i * TAU / len(cols)
        seg = torus(name, r, t, (0, 0, t), c, 24, 8)
        bmt = bmesh.new()
        bmt.from_mesh(seg.data)
        cut = [v for v in bmt.verts if not (a0 <= (math.atan2(v.co.y, v.co.x) % TAU) <= a0 + TAU / len(cols) + 1e-3)]
        bmesh.ops.delete(bmt, geom=cut, context="VERTS")
        bmt.to_mesh(seg.data)
        bmt.free()
        out.append(seg)
    return join(out, name)


for key, sign in (("board", "all_aboard"), ("exit", "exit")):
    dk = DOCKS[key]
    s = dk["s"]
    bank = point(s, -W)
    D = []
    z = -1.0
    while z <= 1.01:
        D.append(lb("DockPlank", -1.3, 0.45, 0.02, 0.08, z - 0.11, z + 0.11, M["planks"], 0.012))
        z += 0.25
    for z in (-1.06, 1.06):
        D.append(lb("DockBeam", -1.35, 0.5, -0.1, 0.02, z - 0.06, z + 0.06, M["timber_dark"], 0.02))
    for z in (-0.95, 0.95):
        D.append(cyl("DockPile", 0.08, 1.35, g(0.42, -1.25, z), M["timber_dark"], 8))
        D.append(cyl("DockPileRope", 0.085, 0.1, g(0.42, -0.02, z), M["rope"], 8))
    for xx, yy in ((0.62, -0.18), (0.86, -0.42)):
        D.append(lb("DockStep", xx - 0.14, xx + 0.14, yy - 0.03, yy + 0.03, -0.8, 0.8, M["planks"], 0.01))
    # the arch at the land end, its sign both ways, a tube on top
    for z in (-1.0, 1.0):
        D += bamboo_pole(-1.25, z, 2.6, 0.07)
    D.append(rod("ArchBeam", (-1.25, 2.5, -1.12), (-1.25, 2.5, 1.12), 0.075, M["pole"], 8))
    D.append(lb("ArchSignBack", -1.29, -1.21, 1.98, 2.46, -0.98, 0.98, M["timber_dark"], 0.01))
    for face, yaw in ((-1.2, PI / 2), (-1.3, -PI / 2)):
        D.append(plane("ArchSign", 1.9, 0.79 * 0.5 * 1.0, g(face, 2.22, 0), signmat(sign, 0.6), rot=(PI / 2, 0, yaw)))
    for z in (-0.7, 0.7):
        D.append(rod("SignRope", (-1.25, 2.47, z), (-1.25, 2.44, z), 0.012, M["rope"], 4))
    tb = tube_model("ArchTube", [M["yellow"], M["red"], M["yellow"], M["red"]] if key == "board" else [M["teal"], M["white"], M["teal"], M["white"]], 0.3, 0.1)
    tb.rotation_euler = (0, PI / 2, 0)
    tb.location = g(-1.25, 2.95, 0)
    apply_all(tb)
    D.append(tb)
    # a coil of rope and a bell on the boarding dock; a towel left on the exit's
    if key == "board":
        D.append(torus("RopeCoil", 0.2, 0.04, g(-0.9, 0.12, -0.75), M["rope"], 16, 6))
        D.append(torus("RopeCoil", 0.15, 0.04, g(-0.9, 0.18, -0.75), M["rope"], 16, 6))
        D.append(rod("BellArm", (-1.25, 1.9, 1.0), (-1.0, 1.9, 1.0), 0.02, M["iron"], 4))
        D.append(cyl("Bell", 0.06, 0.14, g(-1.0, 1.72, 1.0), M["rust"], 10, r2=0.11))
    add("docks", yawed(D, bank[0], bank[1], flow_yaw(s), "Dock_" + key))
# the tube return: a low bamboo rack on a slatted floor (the game drops the used tubes in it), its sign on a post
t = DOCKS["tubeReturn"]
ct = at(DOCKS["exit"]["s"] - 1.9)
TR = []
for z in (-0.9, 0.9):
    for x in (-0.75, 0.75):
        TR += bamboo_pole(x, z, 0.55, 0.05)
for x in (-0.75, 0.75):
    TR.append(rod("ReturnRail", (x, 0.5, -0.95), (x, 0.5, 0.95), 0.05, M["pole"], 8))
for k in range(7):
    z = -0.8 + k * 0.27
    TR.append(rod("ReturnSlat", (-0.75, 0.035, z), (0.75, 0.035, z), 0.035, M["pole_dark"], 6))
TR += bamboo_pole(-0.95, 0, 1.75, 0.05)
TR.append(lb("ReturnSignBack", -0.99, -0.91, 1.3, 1.72, -0.65, 0.65, M["timber_dark"], 0.01))
for face, yaw in ((-0.9, PI / 2), (-1.0, -PI / 2)):
    TR.append(plane("ReturnSign", 1.25, 1.25 * 320 / 768, g(face, 1.51, 0), signmat("tube_return", 0.6), rot=(PI / 2, 0, yaw)))
add("docks", yawed(TR, t["x"], t["z"], math.atan2(ct["tx"], ct["tz"]), "TubeReturn"))
# the tube rack (the station `fins`): the game's tubes stand in it on their edges
RK = STATIONS["fins"]
F_ = next(f for f in FURNITURE if f["kind"] == "tube-rack")
hz = F_["hz"]
rk = []
for z in (-hz, hz):
    rk += bamboo_pole(-0.35, z, 1.5, 0.065)
    rk += bamboo_pole(0.35, z, 1.5, 0.065)
    rk.append(rod("RackTie", (-0.35, 1.2, z), (0.35, 1.2, z), 0.035, M["pole_dark"], 6))
rk.append(lb("RackBase", -0.45, 0.45, 0.05, 0.15, -hz - 0.1, hz + 0.1, M["planks"], 0.02))
for x in (-0.3, 0.3):
    rk.append(rod("RackGuide", (x, 0.3, -hz), (x, 0.3, hz), 0.03, M["pole"], 6))
rk.append(rod("RackRail", (0, 1.38, -hz - 0.1), (0, 1.38, hz + 0.1), 0.06, M["pole"], 8))
rk.append(lb("RackSignBack", -0.4, -0.32, 1.52, 1.92, -0.6, 0.6, M["timber_dark"], 0.01))
rk.append(plane("RackSign", 1.1, 1.1 * 320 / 768, g(-0.42, 1.72, 0), signmat("tubes", 0.6), rot=(PI / 2, 0, -PI / 2)))
add("docks", yawed(rk, RK["x"], RK["z"], 0.0, "TubeRack"))

# ================================================================================================================================
# THE TORCHES: iron baskets on bamboo poles round the deck and at the docks (the game's flames)
# ================================================================================================================================
RM = ROOM
spots = [
    (RM["minX"] + 0.5, -12),
    (RM["minX"] + 0.5, 4),
    (RM["maxX"] - 0.5, -13),
    (RM["maxX"] - 0.5, 4.5),
    (-2.2, RM["minZ"] + 0.6),
    (2.2, RM["minZ"] + 0.6),
    (RM["maxX"] - 0.5, 12.2),
]
for key in ("board", "exit"):
    for sd in (-1.5, 1.5):
        spots.append(point(DOCKS[key]["s"] + sd, -(W + 1.6)))
for x, z in spots:
    add("torches", *bamboo_pole(x, z, 1.9, 0.055))
    add("torches", cyl("TorchBasket", 0.1, 0.22, g(x, 1.9, z), M["iron"], 8, r2=0.16))
    for k in range(6):
        a = k * TAU / 6
        add("torches", rod("BasketBar", (x + math.cos(a) * 0.1, 1.9, z + math.sin(a) * 0.1), (x + math.cos(a) * 0.17, 2.18, z + math.sin(a) * 0.17), 0.012, M["iron"], 4))
    add("torches", anchor("Flame", x, 2.35, z))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    cx, cz = point(S_START, 0)
    look("rv_cave", g(cx, 1.5, cz), 13, 18, 0, (1280, 720), 16, 30)
    tx, tz = point(S_END, 0)
    look("rv_temple", g(tx, 3.0, tz), 15, 10, 180, (1280, 720), 16, 30)
    bx, bz = point(BRIDGE["s"], 0)
    look("rv_bridge", g(bx, 0.6, bz), 8, 25, 250, (1280, 720), 16, 30)
    dx, dz = DOCKS["board"]["stand"]["x"], DOCKS["board"]["stand"]["z"]
    look("rv_docks", g(dx, 0.8, dz - 2.5), 9, 30, 300, (1280, 720), 16, 30)
save_part("river", [o for v in parts.values() for o in v if o])
