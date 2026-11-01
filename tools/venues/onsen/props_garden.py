"""The Mountain Hot Springs' garden, each piece where the game keeps it (kit.PLAN):
- the four stone lanterns (kasuga-dōrō) of the venue's furniture: hexagonal granite, their paper windows glowing (`Light_Lantern`),
  the fire box's middle at 0.84 m where the game's flames burn, a cap of snow on each roof;
- the bamboo spout (kakehi) at its spot, the pipe coming out of a mossy rock and aimed at where its water falls in (the game draws
  the thread of water from the mouth, 0.6 m from the spout's post toward the spring, 0.38 m up);
- snowy cedars round the far side and the right end (where the monkeys come from), a few beyond the bathhouse, none on the near
  side, and a dark ring of firs further out under the painted mountains;
- the bench (towels, a tea tray, a crate of mikan oranges the monkeys have clearly been at), the towel shelf, the buckets and stools
  by every spring's steps and each spring's plaque with its temperature (spring 4: HOT HOT HOT);
- the rules board, the signpost, the monkey warning and SLIPPERY! VERY.; out in the snow a snowman wearing a towel on his head and a
  little shrine with a red gate (its offering: a rubber duck).

    blender -b -P tools/venues/onsen/props_garden.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from trees import lathe  # (tools/venues/common/trees.py)

reset()
LOOK = "--look" in args()
R = random.Random(277)
TAU = 2 * PI
M = dict(
    granite=sm("granite"),
    granite_dark=sm("granite_dark"),
    rock=tmat_tile("rock", "#6c6863", 0.85),
    snow=tmat_tile("snow", "#eef3fa", 0.8),
    hinoki=tmat_tile("hinoki", "#c9a374", 0.6),
    timber=tmat_tile("timber", "#3b2a20", 0.75),
    bark=tmat_tile("bark", "#5a3e2c", 0.9),
    cedar=tmat_tile("cedar", "#2d4a3a", 0.9, tint="#3c5c4a"),
    cedar_dark=tmat_tile("cedar", "#1f3a2e", 0.9, tint="#2a4436"),
    bamboo=sm("bamboo"),
    bamboo_dark=sm("bamboo_dark"),
    moss=sm("moss"),
    red=sm("red"),
    straw=sm("straw"),
    rope=sm("rope"),
    iron=sm("iron"),
    black=sm("black"),
    yellow=sm("yellow"),
    towel=sm("towel"),
    towel_blue=sm("towel_blue"),
    towel_red=sm("towel_red"),
    ceramic=sm("ceramic"),
    ceramic_blue=sm("ceramic_blue"),
    tea=sm("tea"),
    orange=sm("orange"),
    carrot=sm("carrot"),
    coal=sm("coal"),
    paper=lamp_mat("lantern_paper", "#ffcf8a", 3.0),
    brass=sm("brass"),
    white=sm("white"),
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def yawed(objs, x, z, yaw, name):
    """Join pieces modelled round the origin (game axes, facing +z) and set them at (x, z), turned to face `yaw` (game: atan2 of
    the facing's x and z)."""
    o = join(objs, name)
    # (the joined pieces keep the first one's pivot: bake it, so the turn and the move are about the local origin)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (0, 0, yaw)
    o.location = g(x, 0, z)
    apply_all(o)
    return o


# ---- the stone lanterns ------------------------------------------------------------------------------------------------------------
def stone_lantern(x, z, k):
    pcs = []
    pcs.append(cyl("LBase", 0.4, 0.14, (0, 0, 0), M["granite_dark"], 6))
    pcs.append(cyl("LBase2", 0.3, 0.08, (0, 0, 0.14), M["granite"], 6, r2=0.24))
    pcs.append(cyl("LPole", 0.11, 0.36, (0, 0, 0.22), M["granite"], 10, r2=0.1))
    pcs.append(cyl("LMid", 0.24, 0.1, (0, 0, 0.58), M["granite"], 6, r2=0.3))
    # the fire box: six granite posts round glowing paper panels (0.68 to 1.0: its middle at 0.84)
    for i in range(6):
        a = i * TAU / 6
        pcs.append(box("LPost", -0.035, 0.035, 0.68, 1.0, -0.035, 0.035, M["granite"], 0.005))
        pcs[-1].location = (math.cos(a) * 0.2, math.sin(a) * 0.2, 0)
        apply_all(pcs[-1])
    pcs.append(cyl("LRoof", 0.52, 0.2, (0, 0, 1.0), M["granite"], 6, r2=0.12))
    pcs.append(cyl("LRoofEdge", 0.54, 0.05, (0, 0, 0.99), M["granite_dark"], 6, r2=0.52))
    # the snow on the roof, thick, slumped
    pcs.append(lathe("LSnow", [(0.5, 1.05), (0.46, 1.12), (0.32, 1.22), (0.12, 1.29), (0.0, 1.31)], 10, M["snow"], (0, 0, 0), 0.08, 40 + k))
    pcs.append(sphere("LHoju", 0.075, (0, 0, 1.33), M["granite"], 10, 6))
    o = join(pcs, f"StoneLantern{k}")
    o.rotation_euler = (0, 0, R.random() * 0.4)
    o.location = g(x, 0, z)
    apply_all(o)
    # (the glow keeps its own object: a lamp of the model)
    return o


for k, f in enumerate(furniture("lantern")):
    lan = stone_lantern(f["x"], f["z"], k)
    # pull the glowing panels out as a lamp object of their own
    add("lanterns", lan)
    glow = cyl(f"Light_Lantern{k}", 0.17, 0.3, g(f["x"], 0.69, f["z"]), M["paper"], 6)
    add("lanterns", glow)

# ---- the bamboo spout ------------------------------------------------------------------------------------------------------------------
f = furniture("bamboo-spout")[0]
ang = math.atan2(SPOUT["z"] - f["z"], SPOUT["x"] - f["x"])
dx, dz = math.cos(ang), math.sin(ang)
mouth = (f["x"] + dx * 0.6, SPOUT_MOUTH_Y, f["z"] + dz * 0.6)
back = (f["x"] - dx * 1.1, 0.55, f["z"] - dz * 1.1)
sp = []
sp.append(tube("SpoutPipe", [g(*back), g(f["x"], 0.45, f["z"]), g(*mouth)], 0.055, M["bamboo"], 6, 10))
for t in (0.18, 0.42, 0.66, 0.9):  # the bamboo's nodes
    px = back[0] + (mouth[0] - back[0]) * t
    pz = back[2] + (mouth[2] - back[2]) * t
    py = back[1] + (mouth[1] - back[1]) * t
    sp.append(torus("SpoutNode", 0.057, 0.012, g(px, py, pz), M["bamboo_dark"], 12, 4, rot=(PI / 2, 0, -ang + PI / 2)))
# the crossed legs holding it, tied with straw rope
nx, nz = -dz, dx  # (across the pipe)
for s_ in (-1, 1):
    sp.append(rod("SpoutLeg", (f["x"] + nx * s_ * 0.22, 0, f["z"] + nz * s_ * 0.22), (f["x"] - nx * s_ * 0.06, 0.55, f["z"] - nz * s_ * 0.06), 0.035, M["bamboo_dark"], 8))
sp.append(torus("SpoutTie", 0.07, 0.018, g(f["x"], 0.45, f["z"]), M["rope"], 12, 4))
add("spout", *sp)
mossy = sphere("SpoutRock", 0.45, g(back[0] - dx * 0.2, 0.05, back[2] - dz * 0.2), M["rock"], 12, 8, scale=(1.2, 1.0, 0.75))
mossy_top = sphere("SpoutMoss", 0.38, g(back[0] - dx * 0.2, 0.18, back[2] - dz * 0.2), M["snow"], 12, 6, scale=(1.15, 0.95, 0.45))
add("spout", mossy, mossy_top)
# a wooden ladle hung on the legs (for a sip of the hot water: the sign says don't)
sp2 = [cyl("LadleCup", 0.06, 0.07, g(f["x"] + nx * 0.25, 0.32, f["z"] + nz * 0.25), M["hinoki"], 10)]
sp2.append(rod("LadleHandle", (f["x"] + nx * 0.25, 0.37, f["z"] + nz * 0.25), (f["x"] + nx * 0.1, 0.62, f["z"] + nz * 0.1), 0.012, M["hinoki"], 6))
add("spout", *sp2)


# ---- the cedars and the firs ---------------------------------------------------------------------------------------------------------
def cedar(x, z, h, seed, dark=False):
    rnd = random.Random(seed)
    pcs = [cyl("Trunk", 0.1 + h * 0.012, h * 0.45, (0, 0, -0.05), M["bark"], 8, r2=0.06)]
    tiers = 5
    for t in range(tiers):
        rb = h * (0.3 - t * 0.05) * rnd.uniform(0.9, 1.1)
        th = h * 0.26
        y0 = h * (0.14 + t * 0.15)
        prof = [(rb, 0), (rb * 0.82, th * 0.18), (rb * 0.4, th * 0.68), (0, th)]
        pcs.append(lathe("Tier", [(r_, y0 + y_) for r_, y_ in prof], 9, M["cedar_dark" if dark else "cedar"], (0, 0, 0), 0.12, seed * 10 + t))
        snow_prof = [(rb * 0.86, th * 0.16 + 0.03), (rb * 0.62, th * 0.42 + 0.04), (rb * 0.3, th * 0.74 + 0.03), (0, th + 0.02)]
        pcs.append(lathe("TierSnow", [(r_, y0 + y_) for r_, y_ in snow_prof], 9, M["snow"], (0, 0, 0), 0.16, seed * 10 + t + 5))
    o = join(pcs, "Cedar")
    o.rotation_euler = (0, 0, rnd.random() * TAU)
    o.location = g(x, -0.05, z)
    apply_all(o)
    return o


D = DECK
spots = []
z = D["minZ"] - 4
while z < D["maxZ"] + 8:
    spots.append((D["maxX"] + 3.2 + R.random() * 4, z, 0.9 + R.random() * 0.5))
    z += 2.4 + R.random() * 1.4
x = D["minX"] - 3
while x < D["maxX"] + 4:
    spots.append((x, D["maxZ"] + 3.2 + R.random() * 4, 0.9 + R.random() * 0.5))
    x += 2.6 + R.random() * 1.5
for zz in (D["minZ"] - 6, D["minZ"] - 3.5):
    for xx in (-11, -15, 9, 14):
        spots.append((xx + R.random(), zz, 0.8 + R.random() * 0.2))
for i, (x, z, k) in enumerate(spots):
    add("trees", cedar(x, z, 6.0 * k, 500 + i, i % 3 == 0))
# the dark ring of firs further out (cheap: three cones and a snowy tip each)
firs = []
for i in range(150):
    a = R.random() * TAU
    r = 30 + R.random() * 30
    x, z = math.cos(a) * r * 1.2 + 4, math.sin(a) * r
    if x < -24 and abs(z) < 30:
        continue  # (behind the camera)
    h = 6 + R.random() * 7
    for t in range(3):
        firs.append(cyl("Fir", h * (0.32 - t * 0.07), h * 0.45, g(x, h * (0.08 + t * 0.22), z), M["cedar_dark"], 7, r2=0.0))
        firs.append(cyl("FirSnow", h * (0.17 - t * 0.04), h * 0.22, g(x, h * (0.08 + t * 0.22) + h * 0.24, z), M["snow"], 7, r2=0.0))
add("firs", join(firs, "Firs"))


# ---- the bench, the towel shelf, the buckets by the steps, the springs' plaques ------------------------------------------------------
b = furniture("bench")[0]
bx0, bx1, bz0, bz1 = b["x"] - 0.26, b["x"] + 0.26, b["z"] - 1.15, b["z"] + 1.15
be = [box("BenchSeat", bx0, bx1, 0.38, 0.45, bz0, bz1, M["hinoki"], 0.015)]
for zz in (bz0 + 0.15, bz1 - 0.15):
    be.append(box("BenchLeg", bx0 + 0.04, bx1 - 0.04, 0, 0.38, zz - 0.05, zz + 0.05, M["timber"], 0.01))
be.append(box("BenchSnow", bx0 + 0.02, bx1 - 0.02, 0.45, 0.5, bz0 + 0.05, bz0 + 0.45, M["snow"], 0.03))
be.append(towel_folded("BenchTowel", 0.36, 0.3, 0.07, M["towel"], M["towel_blue"], g(b["x"], 0.45, b["z"] - 0.1), 0.1))
be.append(towel_folded("BenchTowel2", 0.36, 0.3, 0.07, M["towel"], M["towel_red"], g(b["x"], 0.52, b["z"] - 0.12), -0.15))
# a tea tray: a pot, two cups
be.append(box("Tray", b["x"] - 0.18, b["x"] + 0.18, 0.45, 0.47, b["z"] + 0.35, b["z"] + 0.75, M["timber"], 0.005))
be.append(sphere("TeaPot", 0.08, g(b["x"] - 0.06, 0.53, b["z"] + 0.5), M["ceramic_blue"], 12, 8, scale=(1, 1, 0.85)))
be.append(cyl("TeaSpout", 0.012, 0.09, g(b["x"] + 0.02, 0.53, b["z"] + 0.5), M["ceramic_blue"], 6, rot=(0, PI / 3, 0)))
for dz in (0.65, 0.4):
    be.append(cyl("TeaCup", 0.035, 0.05, g(b["x"] + 0.1, 0.47, b["z"] + dz), M["ceramic"], 10, r2=0.04))
# a crate of mikan, raided: half empty, peels on the bench and in the snow
be.append(box("Crate", b["x"] - 0.2, b["x"] + 0.2, 0.45, 0.62, b["z"] + 0.85, b["z"] + 1.1, M["hinoki"], 0.01))
for i in range(4):
    be.append(sphere("Mikan", 0.045, g(b["x"] - 0.12 + i * 0.08, 0.6, b["z"] + 0.97), M["orange"], 8, 6))
for i in range(5):
    a = R.random() * TAU
    be.append(sphere("Peel", 0.04, g(b["x"] + 0.55 + math.cos(a) * 0.25, 0.01, b["z"] + 0.9 + math.sin(a) * 0.3), M["orange"], 6, 4, scale=(1, 1, 0.25)))
add("bench", *be)

tr = furniture("towel-rack")[0]
tx0, tx1, tz0, tz1 = tr["x"] - 0.5, tr["x"] + 0.5, tr["z"] - 0.95, tr["z"] + 0.95
sh = [box("ShelfBack", tx1 - 0.04, tx1, 0, 1.5, tz0, tz1, M["timber"], 0.01)]
for zz in (tz0, tz1 - 0.04, tr["z"] - 0.02):
    sh.append(box("ShelfSide", tx0, tx1, 0, 1.5, zz, zz + 0.04, M["timber"], 0.01))
for y in (0.02, 0.5, 1.0, 1.46):
    sh.append(box("Shelf", tx0, tx1, y, y + 0.04, tz0, tz1, M["hinoki"], 0.01))
sh.append(box("ShelfRoof", tx0 - 0.15, tx1 + 0.1, 1.5, 1.58, tz0 - 0.15, tz1 + 0.15, M["timber"], 0.02))
sh.append(box("ShelfRoofSnow", tx0 - 0.12, tx1 + 0.08, 1.58, 1.7, tz0 - 0.12, tz1 + 0.12, M["snow"], 0.05))
cols = [M["towel"], M["towel_blue"], M["towel"], M["towel_red"]]
for y in (0.06, 0.54, 1.04):
    for k in range(6):
        zz = tz0 + 0.18 + k * 0.29
        sh.append(towel_rolled("ShelfTowel", 0.1, 0.42, cols[(k + int(y * 3)) % 4], None, g(tr["x"] - 0.05, y + 0.1, zz), PI / 2))
add("shelf", *sh)

side_items = []
for s in SPRINGS:
    st = s["steps"]
    d_, w_ = st["deck"], st["water"]
    fx, fz = d_["x"] - w_["x"], d_["z"] - w_["z"]
    n = math.hypot(fx, fz)
    fx, fz = fx / n, fz / n  # (out of the spring)
    sx_, sz_ = math.cos(s["entry"] + PI / 2), math.sin(s["entry"] + PI / 2)
    # the buckets: a stack of wooden ones and a yellow one, a little stool (the classic's spot by the steps)
    bxp, bzp = d_["x"] + sx_ * 0.95, d_["z"] + sz_ * 0.95
    it = [cyl("Bucket", 0.17, 0.24, g(bxp, 0, bzp), M["hinoki"], 14, r2=0.15)]
    it.append(torus("BucketHoop", 0.165, 0.012, g(bxp, 0.06, bzp), M["iron"], 14, 4))
    it.append(torus("BucketHoop", 0.155, 0.012, g(bxp, 0.19, bzp), M["iron"], 14, 4))
    it.append(cyl("BucketY", 0.15, 0.2, g(bxp, 0.24, bzp), M["yellow"], 14, r2=0.13))
    it.append(box("Stool", bxp + sx_ * 0.4 - 0.16, bxp + sx_ * 0.4 + 0.16, 0, 0.28, bzp + sz_ * 0.4 - 0.13, bzp + sz_ * 0.4 + 0.13, M["hinoki"], 0.02))
    side_items += it
    # the plaque: on a short post among the outer rim stones beside the steps (off the walk round the spring, which keeps 1.4 m out
    # from the edge), facing out of the spring
    th = s["entry"] - 0.5
    px_, pz_ = spring_point(s, th, 1 + 1.0 / s["r"])
    cx_, cz_ = spring_point(s, th, 0.0)
    yaw = math.atan2(px_ - cx_, pz_ - cz_)
    post = [box("PlaquePost", -0.05, 0.05, 0, 1.15, -0.05, 0.05, M["timber"], 0.01)]
    post.append(box("PlaqueBoard", -0.24, 0.24, 0.62, 1.26, 0.05, 0.08, M["hinoki"], 0.01))
    pic = plane("Plaque", 0.42, 0.56, (0, -0.081, 0.94), signmat(f"spring_{s['id'] + 1}", 0.6))
    post.append(pic)
    post.append(box("PlaqueCap", -0.29, 0.29, 1.26, 1.32, 0.0, 0.12, M["timber"], 0.01))
    post.append(box("PlaqueCapSnow", -0.27, 0.27, 1.32, 1.38, 0.0, 0.12, M["snow"], 0.02))
    side_items.append(yawed(post, px_, pz_, yaw, f"Plaque{s['id']}"))
add("springside", *side_items)


# ---- the boards and the signposts -------------------------------------------------------------------------------------------------------
def board_on_posts(name, img, w, h, x, z, yaw, y0=0.9, roof=True):
    pcs = []
    for s_ in (-1, 1):
        pcs.append(box("BPost", s_ * w / 2 - 0.05, s_ * w / 2 + 0.05, 0, y0 + h + 0.15, -0.05, 0.05, M["timber"], 0.01))
    pcs.append(box("BBoard", -w / 2, w / 2, y0, y0 + h, -0.03, 0.03, M["hinoki"], 0.01))
    for k, (dy, rz) in enumerate(((-0.032, 0.0), (0.032, PI))):
        p = plane("BPic", w - 0.06, h - 0.06, (0, dy, y0 + h / 2), signmat(img, 0.6), rot=(PI / 2, 0, rz))
        pcs.append(p)
    if roof:
        pcs.append(box("BRoof", -w / 2 - 0.18, w / 2 + 0.18, y0 + h + 0.15, y0 + h + 0.22, -0.22, 0.22, M["timber"], 0.02))
        pcs.append(box("BRoofSnow", -w / 2 - 0.15, w / 2 + 0.15, y0 + h + 0.22, y0 + h + 0.32, -0.2, 0.2, M["snow"], 0.04))
    return yawed(pcs, x, z, yaw, name)


signs = []
signs.append(board_on_posts("RulesBoard", "rules", 0.9, 1.2, -2.7, D["minZ"] + 1.3, PI * 0.15, 0.7))
signs.append(board_on_posts("Signpost", "signpost", 1.1, 0.74, -4.6, -12.4, PI * 0.5 - 0.3, 1.0, roof=False))
signs.append(board_on_posts("MonkeySign", "monkey_warning", 0.8, 0.8, 14.2, 12.2, -PI / 2 - 0.5, 1.0, roof=False))
signs.append(board_on_posts("Slippery", "slippery", 0.6, 0.75, -12.9, -2.4, -PI / 2, 0.8, roof=False))
add("signs", *signs)

# ---- out in the snow: the snowman in a towel, the little shrine -----------------------------------------------------------------------
sx0, sz0 = 16.6, -10.6
sm_ = [sphere("SnowBall", 0.5, g(sx0, 0.42, sz0), M["snow"], 16, 10), sphere("SnowBall", 0.36, g(sx0, 1.06, sz0), M["snow"], 16, 10)]
sm_.append(sphere("SnowHead", 0.25, g(sx0, 1.52, sz0), M["snow"], 14, 8))
sm_.append(cyl("Carrot", 0.04, 0.24, g(sx0 - 0.24, 1.53, sz0), M["carrot"], 8, rot=(0, -PI / 2, 0), r2=0.0))
for dz in (-0.09, 0.09):
    sm_.append(sphere("Coal", 0.032, g(sx0 - 0.22, 1.6, sz0 + dz), M["coal"], 6, 4))
for k in range(4):
    sm_.append(sphere("CoalButton", 0.03, g(sx0 - 0.35 + k * 0.02, 1.2 - k * 0.12, sz0), M["coal"], 6, 4))
sm_.append(towel_folded("SnowmanTowel", 0.34, 0.26, 0.06, M["towel"], M["towel_red"], g(sx0, 1.74, sz0), 0.2))  # (on his head: he is having a soak)
for s_ in (-1, 1):
    sm_.append(rod("Arm", (sx0, 1.1, sz0 + s_ * 0.32), (sx0 - 0.1, 1.45, sz0 + s_ * 0.75), 0.02, M["bark"], 5))
sm_.append(cyl("SnowmanBucket", 0.15, 0.2, g(sx0 - 0.6, 0, sz0 + 0.3), M["yellow"], 14, r2=0.13))
add("decor", *sm_)

hx_, hz_ = 17.4, 10.2
sh_ = [box("ShrineBase", hx_ - 0.4, hx_ + 0.4, 0, 0.3, hz_ - 0.35, hz_ + 0.35, M["granite"], 0.02)]
sh_.append(box("ShrineBox", hx_ - 0.28, hx_ + 0.28, 0.3, 0.85, hz_ - 0.25, hz_ + 0.25, M["hinoki"], 0.01))
sh_.append(box("ShrineDoor", hx_ - 0.29, hx_ - 0.28, 0.4, 0.75, hz_ - 0.15, hz_ + 0.15, M["timber"], 0.0))
sh_.append(box("ShrineRoof", hx_ - 0.42, hx_ + 0.42, 0.85, 0.92, hz_ - 0.4, hz_ + 0.4, M["timber"], 0.02))
sh_.append(box("ShrineSnow", hx_ - 0.4, hx_ + 0.4, 0.92, 1.04, hz_ - 0.38, hz_ + 0.38, M["snow"], 0.05))
sh_.append(sphere("OfferingDuck", 0.07, g(hx_ - 0.36, 0.36, hz_), M["yellow"], 10, 6, scale=(1.2, 1, 0.9)))
sh_.append(sphere("OfferingDuckHead", 0.045, g(hx_ - 0.42, 0.44, hz_), M["yellow"], 8, 6))
# its little red gate in front
for dz in (-0.42, 0.42):
    sh_.append(cyl("ToriiPost", 0.045, 1.25, g(hx_ - 1.0, 0, hz_ + dz), M["red"], 10))
sh_.append(box("ToriiTop", hx_ - 1.06, hx_ - 0.94, 1.22, 1.3, hz_ - 0.62, hz_ + 0.62, M["black"], 0.01))
sh_.append(box("ToriiBeam", hx_ - 1.04, hx_ - 0.96, 1.05, 1.11, hz_ - 0.5, hz_ + 0.5, M["red"], 0.01))
sh_.append(box("ToriiSnow", hx_ - 1.07, hx_ - 0.93, 1.3, 1.36, hz_ - 0.6, hz_ + 0.6, M["snow"], 0.02))
add("decor", *sh_)

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("garden_lantern", g(0.2, 0.8, 6.2), 3.4, 14, 250, (960, 640), 18, 35)
    look("garden_spout", g(9.2, 0.4, -4.0), 4.0, 20, 240, (960, 640), 18, 35)
    look("garden_forest", g(10, 2, 6), 18, 12, 250, (1280, 720), 16, 30)
    look("garden_bench", g(-10.8, 0.5, -9.4), 3.2, 24, 270, (960, 640), 18, 35)
    look("garden_snowman", g(16.6, 1, -10.6), 3.4, 10, 270, (960, 640), 18, 35)
    look("garden_spring", g(-6.2, 0.4, -4.6), 4.5, 24, 300, (960, 640), 18, 35)
save_part("garden", [o for v in parts.values() for o in v if o])
