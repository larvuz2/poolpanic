"""The Wave Pool's beach and the dressing round the walls, every piece in a place the guests and the coach never walk (kit.PLAN):
- the five towels where the bathers rest (wave-pool.mjs, the classic's places), each with its little story on the boardwalk side
  (a paperback face down and sunglasses; a tote, sunscreen and a sun hat; a boombox and a soda; a snorkel mask; a bucket);
- the sandcastle in the middle of the beach: the wave house itself in sand, five arches, two turrets with paper flags, a moat, a
  bucket and spade, a crab in sunglasses on top; beach balls, shells, starfish, a message in a bottle in the wrack line;
- the two beach umbrellas (fringed, striped) and the three deck chairs on the near strip, a towel, a hat or a drink on each;
- along the right end's wall: three beach showers, the surf report (today: waves; tomorrow: also waves), YOU MUST BE THIS TALL TO
  SURF, SPF 9000, the Hall of Wipeouts, the lost & found (single flip-flops), a clutch of boards against the wall;
- along the left end's wall, inside the gate: the rules, a drinking fountain, a teak bench with a towel and a radio, the surf rack
  (six boards in an A-frame, each deck its own), a clock (it is always surf o'clock);
- little pots along the top of the near wall.

    blender -b -P tools/venues/wave/props_beach.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(4242)
TAU = 2 * PI
M = dict(
    sand=tmat_tile("sand", "#e8cf9c", 1.0),
    teak=tmat_tile("teak", "#b57a43", 0.55),
    post=sm("teak_dark"),
    white=sm("white"),
    cream=sm("cream"),
    coral=sm("coral"),
    teal=sm("teal"),
    seafoam=sm("seafoam"),
    sun=sm("sun"),
    navy=sm("navy"),
    sky=sm("sky"),
    red=sm("red"),
    orange=sm("orange"),
    pink=sm("pink"),
    lilac=sm("lilac"),
    lime=sm("lime"),
    chrome=sm("chrome"),
    iron=sm("iron"),
    black=sm("black"),
    canvas=sm("canvas"),
    straw=sm("straw", "#e3c27e", 0.9),
    glass=sm("bottle_glass", "#8fd3c0", 0.1),
    paper=sm("paper", "#f3ead2", 0.9),
    terracotta=sm("terracotta"),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    crab=sm("crab", "#e2573a", 0.5),
    shell=sm("shell", "#fbe9dc", 0.6),
    shell_pink=sm("shell_pink", "#f4c2b0", 0.6),
    starfish=sm("starfish", "#f08a5d", 0.7),
    wet_sand=sm("wet_sand", "#c9a774", 0.95),
    plastic_y=sm("plastic_y"),
    plastic_b=sm("plastic_b"),
    plastic_g=sm("plastic_g"),
)
parts = {}
trees.use({"frond": cutmat("palm_frond", 0.6)})


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def yaw_of(dx, dz):
    """The Blender turn about Z that points local +x along the game direction (dx, dz)."""
    return math.atan2(-dz, dx)


# ---- the towels the bathers rest on, and their stories --------------------------------------------------------------------------
TOWEL_COLS = [("coral", "cream"), ("teal", "white"), ("sun", "coral"), ("sky", "white"), ("seafoam", "teal")]


def towel(x, z, a, b, turn):
    """A beach towel lying flat, 0.9 × 1.6, along z: stripes across it, a fringe at the ends."""
    out = []
    n = 7
    for k in range(n):
        z0 = -0.8 + k * 1.6 / n
        out.append(box("Towel", -0.45, 0.45, 0.004, 0.016, z0, z0 + 1.6 / n, M[a] if k % 2 == 0 else M[b], 0.0))
    for s in (-1, 1):
        for j in range(9):
            xx = -0.4 + j * 0.1
            out.append(box("Fringe", xx - 0.012, xx + 0.012, 0.004, 0.01, s * 0.8, s * 0.86, M[a], 0.0))
    o = join(out, "TowelAll")
    o.rotation_euler = (0, 0, turn)
    o.location = g(x, 0, z)
    apply_all(o)
    return o


for k, t in enumerate(TOWELS):
    a, b = TOWEL_COLS[k % len(TOWEL_COLS)]
    add("beach", towel(t["x"], t["z"], a, b, R.uniform(-0.12, 0.12)))
# the stories, on the boardwalk side of each towel (x -10.4: clear of the evacuation rows at -9.9)
SX = -10.4
t0, t1, t2, t3, t4 = (t["z"] for t in TOWELS)
add(
    "beach",
    flip_flop("FlipFlop", M["coral"], M["navy"], g(SX, 0.0, t0 - 0.45), 0.3),
    flip_flop("FlipFlop", M["coral"], M["navy"], g(SX + 0.12, 0.0, t0 - 0.3), 0.6),
    box("Paperback", SX - 0.09, SX + 0.09, 0.0, 0.03, t0 + 0.2, t0 + 0.46, M["red"], 0.01),
    box("PaperbackPages", SX - 0.085, SX + 0.085, 0.005, 0.025, t0 + 0.205, t0 + 0.455, M["paper"], 0.0),
)
for dz in (-0.045, 0.045):
    add("beach", cyl("Shades", 0.035, 0.01, g(SX + 0.02, 0.0, t0 + 0.65 + dz), M["black"], 12))
add("beach", rod("ShadesBridge", (SX + 0.02, 0.012, t0 + 0.62), (SX + 0.02, 0.012, t0 + 0.68), 0.006, M["black"], 5))
add(
    "beach",
    tote("BeachTote", M["teal"], M["cream"], g(SX - 0.02, 0.0, t1 - 0.4), 0.2),
    bottle("Sunscreen", M["sun"], M["coral"], 0.18, 0.032, g(SX + 0.1, 0.035, t1 + 0.1), 0.8, lying=True),
)
hat = cyl("SunHatBrim", 0.26, 0.015, g(SX, 0.0, t1 + 0.5), M["straw"], 20)
hatc = cyl("SunHatCrown", 0.12, 0.1, g(SX, 0.015, t1 + 0.5), M["straw"], 16, r2=0.1)
hatb = cyl("SunHatBand", 0.122, 0.03, g(SX, 0.03, t1 + 0.5), M["coral"], 16)
add("beach", hat, hatc, hatb)
# the boombox: a chrome-and-black box, two speakers, a handle
bb = [box("Boombox", -0.22, 0.22, 0.0, 0.2, -0.06, 0.06, M["black"], 0.02)]
for sx in (-0.12, 0.12):
    bb.append(cyl("Speaker", 0.07, 0.01, (sx, -0.061, 0.1), M["chrome"], 16, rot=(PI / 2, 0, 0)))
bb.append(rod("BoomHandle", (-0.15, 0.2, 0), (0.15, 0.2, 0), 0.012, M["chrome"], 6))
bb.append(box("BoomTape", -0.05, 0.05, 0.06, 0.14, -0.065, -0.06, M["sun"], 0.0))
bbo = join(bb, "BoomboxAll")
bbo.rotation_euler = (0, 0, PI / 2)
bbo.location = g(SX, 0.0, t2 - 0.35)
apply_all(bbo)
add("beach", bbo, cyl("Soda", 0.033, 0.12, g(SX + 0.05, 0.0, t2 + 0.25), M["red"], 12))
# a snorkel and mask
add("beach", box("Mask", SX - 0.09, SX + 0.09, 0.0, 0.05, t3 - 0.3, t3 - 0.18, M["sky"], 0.02))
add("beach", poly_tube("Snorkel", [g(SX + 0.1, 0.02, t3 - 0.24), g(SX + 0.12, 0.02, t3 + 0.05), g(SX + 0.1, 0.02, t3 + 0.12)], 0.016, M["sun"], 8, 0.04))
# a bucket with a spade in it
add("beach", cyl("Bucket", 0.1, 0.18, g(SX, 0.0, t4 - 0.45), M["plastic_b"], 14, r2=0.12))
add("beach", rod("BucketSpade", (SX, 0.1, t4 - 0.45), (SX + 0.08, 0.38, t4 - 0.4), 0.012, M["plastic_y"], 6))

# ---- the sandcastle: the wave house in sand, in the middle of the beach, clear of every towel and row ---------------------------------
CX, CZ = -9.85, -0.1
CS = sm("castle_sand", "#e6c890", 0.95)
sc = []
sc.append(cyl("Moat", 0.78, 0.01, (0, 0, 0.0), M["wet_sand"], 28))
sc.append(cyl("CastleMound", 0.6, 0.12, (0, 0, 0.0), CS, 20, r2=0.55))
sc.append(box("CastleBlock", -0.22, 0.22, 0.12, 0.42, -0.42, 0.42, CS, 0.03))
for k in range(5):
    z = -0.32 + k * 0.16
    sc.append(box("CastleArch", 0.2, 0.235, 0.12, 0.26, z - 0.05, z + 0.05, M["wet_sand"], 0.01))
sc.append(box("CastleTerrace", -0.16, 0.24, 0.42, 0.46, -0.44, 0.44, CS, 0.01))
sc.append(box("CastleUpper", -0.2, 0.06, 0.46, 0.7, -0.33, 0.33, CS, 0.03))
for s in (-1, 1):
    sc.append(cyl("CastleTurret", 0.08, 0.42, (0.12, -s * 0.38, 0.42), CS, 12, r2=0.06))
    sc.append(cyl("CastleTurretTop", 0.08, 0.12, (0.12, -s * 0.38, 0.84), CS, 12, r2=0.0))
    sc.append(rod("CastleFlagStick", (0.12, 0.92, s * 0.38), (0.12, 1.1, s * 0.38), 0.005, M["post"], 4))
    sc.append(box("CastleFlag", 0.12, 0.125, 1.02, 1.1, s * 0.38, s * 0.38 + 0.1, M["coral"] if s > 0 else M["teal"], 0.0))
# the crab in sunglasses on the terrace, the bucket upside down beside it, the spade stuck in the mound
crab = [sphere("CrabBody", 0.06, (0, 0, 0.03), M["crab"], 12, 8, scale=(1.3, 1.0, 0.55))]
for s in (-1, 1):
    crab.append(sphere("CrabClaw", 0.025, (s * 0.1, -0.05, 0.04), M["crab"], 8, 6, scale=(1.2, 1, 0.8)))
    for j in range(3):
        crab.append(rod("CrabLeg", (s * 0.05, 0.03, 0.03 * j - 0.03), (s * 0.11, 0.0, 0.03 * j - 0.04), 0.008, M["crab"], 4))
    crab.append(cyl("CrabShade", 0.018, 0.006, (s * 0.022, -0.065, 0.065), M["black"], 10, rot=(PI / 2, 0, 0)))
co = join(crab, "Crab")
co.location = (0.21, -0.18, 0.46)
apply_all(co)
sc.append(co)
sc.append(cyl("CastleBucket", 0.09, 0.15, (-0.45, 0.4, 0.0), M["plastic_g"], 14, r2=0.07))
sc.append(rod("CastleSpade", (-0.4, 0.05, -0.45), (-0.5, 0.45, -0.5), 0.012, M["plastic_y"], 6))
sc.append(box("CastleSpadeBlade", -0.43, -0.37, 0.0, 0.1, -0.48, -0.42, M["plastic_y"], 0.01))
cast = join(sc, "SandCastle")
cast.rotation_euler = (0, 0, 0.0)
cast.location = g(CX, 0.0, CZ)
apply_all(cast)
add("beach", cast)

# beach balls, shells and starfish, a message in a bottle half in the sand by the wrack line
def beach_ball(x, z, r=0.2):
    cols = [M["coral"], M["white"], M["plastic_b"], M["white"], M["sun"], M["white"]]
    segs = []
    for i in range(6):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
        me = bpy.data.meshes.new("Ball")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("Ball", me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(cols[i])
        segs.append(o)
    # (one sphere coloured by longitude: a material per face)
    o = segs[0]
    for q in segs[1:]:
        bpy.data.objects.remove(q)
    o.data.materials.clear()
    for c in cols:
        o.data.materials.append(c)
    for p in o.data.polygons:
        a = math.atan2(p.center.y, p.center.x) % TAU
        p.material_index = int(a / (TAU / 6)) % 6
    o.location = g(x, r, z)
    o.data.shade_smooth()
    return o


add("beach", beach_ball(-10.3, 1.35), beach_ball(-10.2, -9.0, 0.17))
for k in range(26):
    x = R.uniform(-10.4, -8.3)
    z = R.uniform(-9.0, 9.0)
    if any(abs(z - t["z"]) < 0.9 and abs(x - t["x"]) < 0.55 for t in TOWELS) or math.hypot(x - CX, z - CZ) < 0.9:
        continue
    if k % 4 == 0:
        arms = []
        for j in range(5):
            a = j * TAU / 5
            arms.append(cyl("StarArm", 0.022, 0.1, (0, 0, 0.0), M["starfish"], 6, rot=(PI / 2, 0, a), r2=0.008))
        st = join(arms, "Starfish")
        st.scale = (1, 1, 0.35)
        st.location = g(x, 0.012, z)
        apply_all(st)
        add("beach", st)
    else:
        add("beach", sphere("Shell", R.uniform(0.025, 0.045), g(x, 0.0, z), M["shell"] if k % 2 else M["shell_pink"], 8, 5, scale=(1.0, 1.3, 0.4)))
add("beach", bottle("MessageBottle", M["glass"], M["post"], 0.24, 0.04, g(-8.6, 0.02, 3.9), 0.6, lying=True))
add("beach", box("MessagePaper", -8.62, -8.55, 0.03, 0.05, 3.88, 3.98, M["paper"], 0.0))

# ---- the umbrellas and deck chairs on the near strip -------------------------------------------------------------------------------
def umbrella(x, z, a, b, seed):
    r = random.Random(seed)
    out = [cyl("UmbBase", 0.22, 0.1, g(x, 0.0, z), M["white"], 16)]
    tilt = r.uniform(-0.08, 0.08)
    top = (x + tilt * 2.2, 2.45, z)
    out.append(rod("UmbPole", (x, 0.1, z), top, 0.025, M["white"], 8))
    n = 12
    rad = 1.15
    for k in range(n):
        a0, a1 = k * TAU / n, (k + 1) * TAU / n
        bm = bmesh.new()
        apex = bm.verts.new(g(top[0], top[1] + 0.05, top[2]))
        p0 = bm.verts.new(g(top[0] + math.cos(a0) * rad, top[1] - 0.42, top[2] + math.sin(a0) * rad))
        p1 = bm.verts.new(g(top[0] + math.cos(a1) * rad, top[1] - 0.42, top[2] + math.sin(a1) * rad))
        bm.faces.new((apex, p0, p1))
        me = bpy.data.meshes.new("UmbPanel")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("UmbPanel", me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(M[a] if k % 2 == 0 else M[b])
        s_ = o.modifiers.new("S", "SOLIDIFY")
        s_.thickness = 0.015
        out.append(o)
        # a fringe flap under each panel's edge
        mid = (a0 + a1) / 2
        out.append(box("UmbFringe", 0, 0, 0, 0, 0, 0, M[a], 0.0) if False else plane("UmbFringe", 0.55, 0.09, g(top[0] + math.cos(mid) * rad * 0.97, top[1] - 0.47, top[2] + math.sin(mid) * rad * 0.97), M[b] if k % 2 == 0 else M[a], rot=(PI / 2, 0, -mid + PI / 2)))
    out.append(sphere("UmbTip", 0.05, g(top[0], top[1] + 0.08, top[2]), M["sun"], 8, 6))
    return out


for f in (q for q in FURNITURE if q["kind"] == "umbrella"):
    cols = ("coral", "cream") if f["z"] < 0 else ("teal", "cream")
    add("lounge", *umbrella(f["x"], f["z"], *cols, seed=int(f["z"] * 10)))


def deck_chair(x, z, angle, stripe_a, stripe_b, extra):
    """A wooden folding deck chair facing along `angle` (the plan's), a striped canvas sling, and its story."""
    pc = []
    # (local: +y forward along the chair's facing; built in Blender units, then turned)
    for sx in (-0.3, 0.3):
        pc.append(rod("ChairRail", (sx, 0.0, -0.45), (sx, 0.95, 0.45), 0.022, M["teak"], 6) if False else tube("ChairRail", [(sx, -0.45, 0.0), (sx, 0.35, 0.95)], 0.022, M["post"], 1, 6))
        pc.append(tube("ChairLeg", [(sx, 0.4, 0.0), (sx, -0.15, 0.55)], 0.02, M["post"], 1, 6))
    pc.append(tube("ChairBar", [(-0.3, -0.42, 0.04), (0.3, -0.42, 0.04)], 0.02, M["post"], 1, 6))
    pc.append(tube("ChairBar", [(-0.3, 0.33, 0.92), (0.3, 0.33, 0.92)], 0.02, M["post"], 1, 6))
    # the sling: a sagging strip of striped canvas between the rails
    n = 8
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        def at(t):
            y = -0.4 + 0.72 * t
            zz = 0.08 + 0.82 * t - 0.22 * math.sin(t * PI)
            return y, zz
        y0, z0 = at(t0)
        y1, z1 = at(t1)
        bm = bmesh.new()
        vs = [bm.verts.new((-0.28, y0, z0)), bm.verts.new((0.28, y0, z0)), bm.verts.new((0.28, y1, z1)), bm.verts.new((-0.28, y1, z1))]
        bm.faces.new(vs)
        me = bpy.data.meshes.new("Sling")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("Sling", me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(M[stripe_a] if (k // 1) % 2 == 0 else M[stripe_b])
        s_ = o.modifiers.new("S", "SOLIDIFY")
        s_.thickness = 0.01
        pc.append(o)
    pc += extra
    o = join(pc, "DeckChair")
    # the plan's angle π/2: facing +x (the pool). Local +y forward: turn so +y → game +x
    o.rotation_euler = (0, 0, -PI / 2)
    o.location = g(x, 0, z)
    apply_all(o)
    return o


chairs = [q for q in FURNITURE if q["kind"] == "deck-chair"]
stories = [
    lambda: [towel_folded("ChairTowel", 0.4, 0.3, 0.06, M["coral"], M["cream"], (0.0, 0.05, 0.4), 0.0)],
    lambda: [cyl("ChairHat", 0.2, 0.012, (0.05, -0.05, 0.42), M["straw"], 18), cyl("ChairHatCrown", 0.1, 0.09, (0.05, -0.05, 0.43), M["straw"], 14, r2=0.08)],
    lambda: [cyl("Cocktail", 0.035, 0.1, (0.42, 0.25, 0.0), M["glass"], 10), sphere("CocktailLime", 0.025, (0.45, 0.25, 0.11), M["lime"], 8, 6), cyl("ChairSideTable", 0.1, 0.0, (0.42, 0.25, 0.0), M["teak"], 10)],
]
for k, f in enumerate(chairs):
    a, b = (("coral", "cream"), ("teal", "white"), ("sun", "navy"))[k % 3]
    add("lounge", deck_chair(f["x"], f["z"], f.get("angle", 0.0), a, b, stories[k % 3]()))

# ---- the right end's wall: showers, the surf report, the shark, SPF 9000, the Hall of Wipeouts, the lost & found, boards ---------------
WZ = ROOM["maxZ"] - 0.15 - 0.14  # the screen's inner face
DZ = DECK["maxZ"]  # (the walk ends here: everything below stands between it and the wall)


def board_on_posts(name, img, w, h, x, y0, z, face=-1, back_m=None, posts=True):
    """A painted board on two posts against the wall, facing the deck (-z)."""
    k = -face  # (the side the wall is on)
    out = [box(name + "Back", x - w / 2 - 0.04, x + w / 2 + 0.04, y0 - 0.04, y0 + h + 0.04, z, z + k * 0.05, back_m or M["teak"], 0.01)]
    out.append(plane(name, w, h, g(x, y0 + h / 2, z + face * 0.003), signmat(img, 0.6), rot=(PI / 2, 0, PI if face < 0 else 0)))
    if posts:
        for s in (-1, 1):
            out.append(box(name + "Post", x + s * (w / 2 + 0.02) - 0.04, x + s * (w / 2 + 0.02) + 0.04, 0, y0 + h + 0.1, z + k * 0.05, z + k * 0.13, M["post"], 0.01))
    return out


for x in (-9.0, -6.0, -3.0):
    sh = [cyl("ShowerPost", 0.045, 2.3, g(x, 0, WZ - 0.12), M["chrome"], 10)]
    sh.append(rod("ShowerArm", (x, 2.25, WZ - 0.12), (x, 2.25, WZ - 0.45), 0.03, M["chrome"], 8))
    sh.append(cyl("ShowerHead", 0.16, 0.06, g(x, 2.15, WZ - 0.45), M["chrome"], 16, r2=0.11))
    sh.append(cyl("ShowerValve", 0.05, 0.06, g(x, 1.1, WZ - 0.17), M["red"], 10, rot=(PI / 2, 0, 0)))
    sh.append(box("ShowerGrate", x - 0.3, x + 0.3, 0, 0.03, DZ + 0.02, WZ - 0.02, M["teak"], 0.005))
    sh.append(cyl("ShowerHook", 0.02, 0.1, g(x + 0.3, 1.5, WZ - 0.08), M["chrome"], 6, rot=(PI / 2, 0, 0)))
    sh.append(towel_folded("ShowerTowel", 0.36, 0.26, 0.07, M["sun"] if x < -5 else M["teal"], M["white"], g(x + 0.32, 0.03, WZ - 0.25), 0.2))
    add("rightwall", *sh)
add("rightwall", *board_on_posts("SurfReport", "surf_report", 1.2, 0.96, -7.5, 0.95, WZ - 0.05))
shark = [box("SharkBack", -4.7, -4.2, 0.28, 1.95, WZ - 0.04, WZ, M["seafoam"], 0.01)]
shark.append(plane("Shark", 0.5, 1.6, g(-4.45, 0.28 + 0.8, WZ - 0.043), signmat("height_shark", 0.6), rot=(PI / 2, 0, PI)))
add("rightwall", *shark)
spf = [box("SpfBox", -1.75, -1.25, 0.9, 1.5, WZ - 0.22, WZ, M["sun"], 0.03)]
spf.append(plane("Spf", 0.42, 0.56, g(-1.5, 1.2, WZ - 0.224), signmat("spf", 0.6), rot=(PI / 2, 0, PI)))
spf.append(cyl("SpfPump", 0.03, 0.12, g(-1.5, 1.5, WZ - 0.11), M["white"], 8))
spf.append(rod("SpfNozzle", (-1.5, 1.6, WZ - 0.11), (-1.5, 1.6, WZ - 0.28), 0.015, M["white"], 6))
spf.append(box("SpfPost", -1.53, -1.47, 0, 0.9, WZ - 0.13, WZ - 0.07, M["chrome"], 0.005))
add("rightwall", *spf)
add("rightwall", *board_on_posts("Wipeouts", "wipeouts", 1.92, 1.2, 2.3, 0.95, WZ - 0.05, back_m=M["teak"]))
# the lost & found: a crate of single flip-flops and a hat, its sign on the wall above
crate = [box("Crate", 4.0, 4.7, 0, 0.42, DZ + 0.05, WZ - 0.02, M["teak"], 0.01)]
cols_ = [M["coral"], M["sun"], M["plastic_b"], M["lime"], M["pink"], M["teal"]]
for k in range(6):
    crate.append(flip_flop("LostFlop", cols_[k], M["navy"], g(4.12 + (k % 3) * 0.2, 0.42, DZ + 0.25 + (k // 3) * 0.2), R.uniform(0, TAU)))
crate.append(cyl("LostHat", 0.16, 0.08, g(4.55, 0.42, DZ + 0.4), M["navy"], 14))
add("rightwall", *crate, *board_on_posts("LostFound", "lost_found", 0.9, 0.34, 4.35, 1.0, WZ - 0.05, posts=False))
# boards leaning against the wall in a clutch, past the eye care
for k, (x, img) in enumerate(((8.7, "board_1"), (9.25, "board_3"), (9.8, "board_4"), (10.4, "board_5"), (11.0, "board_2"))):
    lean = 0.12
    bo = box("WallBoard", -0.26, 0.26, 0.0, 2.05, -0.03, 0.03, M["white"], 0.1)
    deck = plane("WallBoardDeck", 0.48, 1.98, (0, 0.032, 1.03), signmat(img, 0.4), rot=(PI / 2, 0, PI))
    fin = box("WallBoardFin", -0.01, 0.01, 0.1, 0.3, 0.03, 0.15, M["black"], 0.01)
    o = join([bo, deck, fin], "WallBoard")
    o.rotation_euler = (lean, 0, R.uniform(-0.06, 0.06))
    o.location = g(x, 0.0, WZ - 0.3)
    apply_all(o)
    add("rightwall", o)

# planters with hibiscus at the right wall's ends
hib = cutmat("hibiscus", 0.7)


def planter(x, z, w, d, flowers=10, seed=1):
    r = random.Random(seed)
    out = [box("Planter", x - w / 2, x + w / 2, 0, 0.5, z - d / 2, z + d / 2, M["terracotta"], 0.03)]
    out.append(box("PlanterBand", x - w / 2 - 0.01, x + w / 2 + 0.01, 0.38, 0.45, z - d / 2 - 0.01, z + d / 2 + 0.01, M["coral"], 0.01))
    for k in range(int(w * 2)):
        out.append(sphere("Shrub", 0.3, g(x - w / 2 + 0.25 + k * (w - 0.5) / max(1, int(w * 2) - 1), 0.65, z), M["leaf"] if k % 2 else M["leaf_dark"], 10, 6, scale=(1.2, 1.0, 0.8)))
    for k in range(flowers):
        s = r.uniform(0.3, 0.45)
        p = plane("Hibiscus", s, s, (0, 0, 0), hib, rot=(PI / 2, 0, 0))
        p.location = g(x + r.uniform(-w / 2, w / 2), r.uniform(0.75, 1.0), z - d / 2 - 0.05)
        p.rotation_euler = (PI / 2 - 0.3, 0, PI + r.uniform(-0.4, 0.4))
        out.append(p)
    return out


add("rightwall", *planter(-12.6, WZ - 0.3, 2.6, 0.5, 12, 1), *planter(13.2, WZ - 0.3, 2.4, 0.5, 10, 2))

# ---- the left end's wall, inside the gate: the rules, a drinking fountain, a bench, the surf rack, a clock -----------------------------
LZ = ROOM["minZ"] + 0.15 + 0.14  # the screen's inner face
DL = DECK["minZ"]
add("leftwall", *board_on_posts("Rules", "rules", 0.9, 1.26, -2.75, 0.75, LZ + 0.05, face=1))
# (facing +z: the board's picture on its +z face; board_on_posts builds for -z, so mirror it)
fo = [cyl("FountainPedestal", 0.12, 0.85, g(-4.0, 0, LZ + 0.35), M["chrome"], 14, r2=0.09)]
fo.append(cyl("FountainBowl", 0.22, 0.12, g(-4.0, 0.85, LZ + 0.35), M["chrome"], 18, r2=0.27))
fo.append(cyl("FountainSpout", 0.025, 0.08, g(-4.0, 0.95, LZ + 0.35), M["chrome"], 8))
fo.append(cyl("FountainStep", 0.25, 0.12, g(-4.0, 0, LZ + 0.75), M["teak"], 16))
add("leftwall", *fo)
# the bench: teak slats on cream stucco ends, a towel and a radio on it
bench = []
for s in (-1, 1):
    bench.append(box("BenchEnd", -7.0 + s * 1.0 - 0.08, -7.0 + s * 1.0 + 0.08, 0, 0.42, LZ + 0.1, LZ + 0.6, M["cream"], 0.02))
for k in range(4):
    z = LZ + 0.15 + k * 0.115
    bench.append(box("BenchSlat", -8.1, -5.9, 0.42, 0.46, z, z + 0.09, M["teak"], 0.01))
bench.append(box("BenchBack", -8.1, -5.9, 0.6, 0.9, LZ + 0.08, LZ + 0.12, M["teak"], 0.01))
bench.append(towel_folded("BenchTowel", 0.45, 0.35, 0.08, M["sky"], M["white"], g(-7.6, 0.46, LZ + 0.35), 0.1))
bench.append(box("Radio", -6.5, -6.15, 0.46, 0.66, LZ + 0.25, LZ + 0.4, M["coral"], 0.03))
bench.append(cyl("RadioDial", 0.05, 0.01, g(-6.33, 0.56, LZ + 0.405), M["cream"], 12, rot=(PI / 2, 0, 0)))
add("leftwall", *bench)
# the surf rack (the plan's furniture): an A-frame, six boards in its slots, their decks out
sr = next(f for f in FURNITURE if f["kind"] == "surf-rack")
rk = []
for s in (-1, 1):
    x = sr["x"] + s * sr["hx"]
    rk.append(rod("RackLeg", (x, 0, sr["z"] - 0.32), (x, 1.15, sr["z"]), 0.035, M["post"]))
    rk.append(rod("RackLeg", (x, 0, sr["z"] + 0.32), (x, 1.15, sr["z"]), 0.035, M["post"]))
rk.append(rod("RackRidge", (sr["x"] - sr["hx"], 1.15, sr["z"]), (sr["x"] + sr["hx"], 1.15, sr["z"]), 0.04, M["post"]))
rk.append(box("RackSill", sr["x"] - sr["hx"], sr["x"] + sr["hx"], 0.1, 0.18, sr["z"] - 0.32, sr["z"] + 0.32, M["teak"], 0.01))
imgs = ["board_1", "board_2", "board_3", "board_4", "board_5", "board_6"]
for k in range(6):
    x = sr["x"] - sr["hx"] + 0.25 + k * (2 * sr["hx"] - 0.5) / 5
    bo = box("RackBoard", -0.04, 0.04, 0.0, 2.0, -0.25, 0.25, M["white"], 0.1)
    dk = plane("RackBoardDeck", 0.48, 1.96, (0.042, 0, 1.0), signmat(imgs[k], 0.4), rot=(PI / 2, 0, PI / 2))
    o = join([bo, dk], "RackBoard")
    # (boards stand on their tails in the slots, leaning back on the ridge, decks turned to the camera)
    o.rotation_euler = (0, 0.0, -PI / 2 + R.uniform(-0.08, 0.08))
    o.location = g(x, 0.12, sr["z"] - 0.05)
    apply_all(o)
    add("leftwall", o)
add("leftwall", *rk)
# a clock on a post (always surf o'clock: its hands on the wave), a planter of palms each side of the gate
add("leftwall", cyl("ClockPost", 0.05, 2.4, g(2.6, 0, LZ + 0.3), M["post"], 8))
add("leftwall", cyl("ClockFace", 0.32, 0.08, g(2.6, 2.55, LZ + 0.3), M["cream"], 24, rot=(PI / 2, 0, 0)))
add("leftwall", torus("ClockRim", 0.32, 0.035, g(2.6, 2.55, LZ + 0.35), M["coral"], 24, 6, rot=(PI / 2, 0, 0)))
add("leftwall", box("ClockHand", 2.58, 2.62, 2.55, 2.8, LZ + 0.35, LZ + 0.36, M["navy"], 0.0))
add("leftwall", box("ClockHand2", 2.6, 2.78, 2.53, 2.57, LZ + 0.35, LZ + 0.365, M["navy"], 0.0))
for x, seed in ((-11.5, 11), (-9.6, 12), (5.4, 13), (6.6, 14)):
    pot = [cyl("BigPot", 0.36, 0.7, g(x, 0, LZ + 0.5), M["terracotta"], 18, r2=0.44)]
    pot.append(torus("BigPotRim", 0.44, 0.04, g(x, 0.7, LZ + 0.5), M["coral"], 18, 5))
    rr = random.Random(seed)
    for k in range(10):
        a = k * TAU / 10 + rr.uniform(-0.2, 0.2)
        top = Vector(g(x + math.cos(a) * 0.1, 0.7 + rr.uniform(0.9, 1.6), LZ + 0.5 + math.sin(a) * 0.1))
        pot.append(tube("PotCane", [Vector(g(x, 0.65, LZ + 0.5)), top], 0.014, sm("palm_stem", "#7a8a4a", 0.6), 1, 5))
        pot.append(trees.frond_card("PotFrond", top, -a, math.radians(rr.uniform(20, 45)), rr.uniform(0.8, 1.1), rr.uniform(0.22, 0.28), math.radians(rr.uniform(55, 85)), segs=4))
    add("leftwall", *pot)
add("leftwall", *planter(-13.6, LZ + 0.35, 2.2, 0.5, 10, 3))

# little pots along the near wall's top (the Coach Cam sees them looking back)
for k in range(9):
    z = -14.0 + k * 3.2
    if abs(z - 0.4) < 1.0:
        continue
    x = ROOM["minX"] + 0.15
    add("nearwall", cyl("WallPot", 0.11, 0.18, g(x, NEAR_WALL_H + 0.08, z), M["terracotta"], 12, r2=0.13))
    add("nearwall", sphere("WallSucc", 0.12, g(x, NEAR_WALL_H + 0.3, z), M["leaf"] if k % 2 else M["lime"], 10, 6, scale=(1, 1, 0.7)))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("beach_castle", g(CX, 0.4, CZ), 3.0, 22, 250, (960, 640), 18, 35)
    look("beach_towels", g(-10.0, 0.2, -5.5), 4.5, 30, 240, (960, 640), 18, 35)
    look("beach_right", g(-2.0, 1.2, 12.8), 9, 10, 180, (1280, 720), 18, 30)
    look("beach_left", g(-4.0, 1.2, -15.8), 8, 12, 0, (1280, 720), 18, 30)
    look("beach_chairs", g(-13.2, 0.6, -6.2), 5, 25, 250, (960, 640), 18, 35)
save_part("beach", [o for v in parts.values() for o in v if o])
