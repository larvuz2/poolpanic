"""Senior Aqua Fit's garden: what the palm house looks out on through its glass, a Victorian pleasure garden in the late sun, all of it
down on the ground 1.95 m below the deck (the terrace's stone face), none of it a lawn:
- along the far glass: a raked gravel walk with Victorian lamp posts and two benches, a bed of standard roses with a topiary mother
  duck and her three ducklings and a topiary swan, a clipped yew hedge with a gap, and through the gap the fountain (three tiers, a
  stone pineapple), Irish yews either side, limes and chestnuts behind;
- past the glass end (where the sun comes from): the gravel terrace, a lavender bed edged in box, two stone urns of geraniums at the
  top of the steps, a topiary teapot pouring into a topiary teacup, a sundial, the bandstand (white iron, an emerald roof, a duck
  on the weathervane), a row of Irish yews, trees beyond;
- by the near wall (under the camera): a low bed of lavender and a gravel path, nothing tall;
- behind the back wall: the path from the doors between urns, and three great limes whose crowns rise over the cornice.
The painted horizon beyond (dist/assets/senior-club/horizon.webp) is the game's ring.

    blender -b -P tools/venues/senior/garden.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import blob, broadleaf, cypress, lathe  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(1851)
TAU = 2 * PI
GY = -1.95  # the garden's ground
M = dict(
    gravel=tmat_tile("gravel", "#d7cbb2", 0.95),
    ground=tmat_tile("groundcover", "#4f7a3a", 0.95),
    hedge=tmat_tile("hedge", "#3c7a38", 0.8),
    stone=sm("stone"),
    iron=sm("iron"),
    iron_dark=sm("iron_dark"),
    emerald=sm("emerald"),
    cream=sm("cream"),
    teak=tmat_tile("teak", "#b57a43", 0.55),
    terracotta=sm("terracotta"),
    water=sm("water"),
    brass=sm("brass"),
    gold=sm("gold"),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    rose=sm("rose"),
    paper=sm("paper"),
    red=sm("tartan"),
    lantern=lamp_mat("lantern_glass", "#ffe6b0", 3.0),
    roses=cutmat("roses", 0.7),
    lavender=cutmat("lavender", 0.8),
    geranium=cutmat("geranium", 0.7),
    lace=cutmat("iron_lace", 0.5),
)
trees.use(
    dict(
        bark=sm("bark"),
        bark_light=sm("bark"),
        pine_bark=sm("bark"),
        palm_boot=sm("bark"),
        coconut=sm("bark"),
        frond=cutmat("palm_frond", 0.6),
        conifer=tmat_tile("conifer", "#22442c", 0.8),
        hedge=tmat_tile("hedge", "#3c7a38", 0.8),
        canopy=tmat_tile("canopy", "#3f7d3a", 0.8),
    )
)
parts = {}
RM = ROOM
TX0, TX1, TZ1 = RM["minX"] - 0.35, RM["maxX"] + 0.35, RM["maxZ"] + 0.35  # the terrace's outer edges


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def rect_up(name, x0, x1, z0, z1, y, m):
    bm = bmesh.new()
    vs = [bm.verts.new(g(x, y, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    f = bm.faces.new(vs)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    if o.data.polygons[0].normal.z < 0:
        o.data.polygons[0].flip()
    return o


def tufts_row(x0, z0, x1, z1, step, s, m, y=GY, seed=0, jitter=0.12):
    """Crossed cut-out cards along a line: a row of lavender, a bed's roses."""
    r = random.Random(seed)
    out = []
    n = max(1, int(math.hypot(x1 - x0, z1 - z0) / step))
    for k in range(n + 1):
        t = k / n
        x, z = x0 + (x1 - x0) * t + r.uniform(-jitter, jitter), z0 + (z1 - z0) * t + r.uniform(-jitter, jitter)
        ss = s * r.uniform(0.85, 1.15)
        for j in range(2):
            a = j * PI / 2 + r.uniform(0, PI / 2)
            out.append(plane("Tuft", ss * 1.2, ss, g(x, y + ss / 2 - 0.03, z), m, rot=(PI / 2, 0, a)))
    return out


# ================================================================================================================================
# THE GROUND: beds of ground cover to the horizon (no lawn), gravel walks
# ================================================================================================================================
outer = 70.0
for name, x0, x1, z0, z1 in (
    ("GroundNear", -outer, TX0, -outer, outer),
    ("GroundFar", TX1, outer, -outer, outer),
    ("GroundBack", TX0, TX1, -outer, RM["minZ"]),
    ("GroundEnd", TX0, TX1, TZ1, outer),
):
    add("ground", rect_up(name, x0, x1, z0, z1, GY, M["ground"]))
for name, x0, x1, z0, z1 in (
    ("WalkFar", TX1, TX1 + 2.0, RM["minZ"] - 3.0, TZ1 + 2.2),  # along the far glass
    ("WalkEnd", TX0 - 2.0, TX1 + 2.0, TZ1, TZ1 + 2.2),  # the terrace walk past the end
    ("WalkNear", TX0 - 2.6, TX0 - 1.3, RM["minZ"] - 3.0, TZ1 + 2.2),  # by the near wall, past the lavender
    ("WalkBack", -1.7, 1.7, RM["minZ"] - 9.0, RM["minZ"]),  # from the doors
    ("WalkFountain", TX1 + 2.0, TX1 + 11.0, -1.1, 1.1),  # through the hedge's gap to the fountain
    ("WalkSundial", -1.1, 1.1, TZ1 + 2.2, TZ1 + 7.5),
    ("FountainRound", TX1 + 7.0, TX1 + 13.0, -3.0, 3.0),
):
    add("ground", rect_up(name, x0, x1, z0, z1, GY + 0.01, M["gravel"]))
# stone kerbs along the walks' edges
for x0, x1, z0, z1 in (
    (TX1 + 2.0, TX1 + 2.1, RM["minZ"] - 3.0, -1.1),
    (TX1 + 2.0, TX1 + 2.1, 1.1, TZ1),
    (TX0 - 2.0, -1.1, TZ1 + 2.2, TZ1 + 2.3),
    (1.1, TX1 + 2.0, TZ1 + 2.2, TZ1 + 2.3),
):
    add("ground", box("Kerb", x0, x1, GY, GY + 0.08, z0, z1, M["stone"], 0.01))

# ================================================================================================================================
# LAMP POSTS, BENCHES, URNS
# ================================================================================================================================


def lamp_post(x, z):
    o = [cyl("LampBase", 0.2, 0.4, g(x, GY, z), M["iron_dark"], 8, r2=0.14)]
    o.append(cyl("LampPost", 0.07, 2.6, g(x, GY + 0.4, z), M["iron_dark"], 8, r2=0.05))
    o.append(rod("LampArm", (x - 0.3, GY + 2.6, z), (x + 0.3, GY + 2.6, z), 0.02, M["iron_dark"], 5))
    o.append(cyl("LampCollar", 0.09, 0.08, g(x, GY + 2.95, z), M["gold"], 8))
    o.append(cyl("Light_Lantern", 0.13, 0.4, g(x, GY + 3.03, z), M["lantern"], 4, r2=0.17))
    o.append(cyl("LampCap", 0.22, 0.16, g(x, GY + 3.43, z), M["iron_dark"], 4, r2=0.04))
    o.append(sphere("LampFinial", 0.04, g(x, GY + 3.62, z), M["gold"], 6, 4))
    return o


for z in (-13.0, -5.0, 5.0, 12.0):
    add("furniture", *lamp_post(TX1 + 2.25, z))
for x in (-13.0, -5.5, 5.5, 13.0):
    add("furniture", *lamp_post(x, TZ1 + 1.95))


def bench(x, z, turn, extra=None):
    b = []
    for sx in (-0.8, 0.8):
        b.append(box("BenchEnd", sx - 0.04, sx + 0.04, 0, 0.45, -0.25, 0.22, M["iron_dark"], 0.01))
        b.append(box("BenchArm", sx - 0.04, sx + 0.04, 0.62, 0.67, -0.25, 0.25, M["iron_dark"], 0.01))
        b.append(rod("BenchArmPost", (sx, 0.45, 0.2), (sx, 0.65, 0.2), 0.02, M["iron_dark"], 5))
        b.append(rod("BenchBackPost", (sx, 0.0, -0.28), (sx, 0.95, -0.34), 0.025, M["iron_dark"], 5))
    for k in range(4):
        b.append(box("BenchSlat", -0.9, 0.9, 0.43, 0.47, -0.24 + k * 0.12, -0.15 + k * 0.12, M["teak"], 0.01))
    for k in range(3):
        b.append(box("BenchBack", -0.9, 0.9, 0.58 + k * 0.13, 0.66 + k * 0.13, -0.33, -0.3, M["teak"], 0.01))
    if extra == "newspaper":
        b.append(box("Newspaper", 0.1, 0.45, 0.47, 0.49, -0.1, 0.18, M["paper"], 0.0))
    elif extra == "handbag":
        b.append(box("Handbag", -0.6, -0.25, 0.47, 0.72, -0.15, 0.05, M["red"], 0.04))
    o = join(b, "GardenBench")
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (0, 0, turn)
    o.location = g(x, GY, z)
    apply_all(o)
    return o


# (local +z the front; facing the glass: -x from the far walk, -z from the end walk)
add("furniture", bench(TX1 + 1.65, -9.0, -PI / 2, "newspaper"), bench(TX1 + 1.65, 8.5, -PI / 2))
add("furniture", bench(-9.3, TZ1 + 1.75, PI, "handbag"), bench(9.3, TZ1 + 1.75, PI))


def urn(x, z, h=0.9):
    o = [box("UrnPlinth", x - 0.3, x + 0.3, GY, GY + h, z - 0.3, z + 0.3, M["stone"], 0.02)]
    o.append(box("UrnPlinthCap", x - 0.35, x + 0.35, GY + h, GY + h + 0.06, z - 0.35, z + 0.35, M["stone"], 0.01))
    o.append(lathe("Urn", [(0.1, 0), (0.14, 0.05), (0.08, 0.12), (0.22, 0.2), (0.3, 0.38), (0.28, 0.46), (0.33, 0.5)], 16, M["stone"], g(x, GY + h + 0.06, z)))
    o += tufts_row(x - 0.12, z, x + 0.12, z, 0.24, 0.42, M["geranium"], GY + h + 0.5, int(abs(x * 13 + z)))
    return o


for x in (-2.2, 2.2):
    add("furniture", *urn(x, TZ1 + 2.6))
for x in (-2.2, 2.2):
    add("furniture", *urn(x, RM["minZ"] - 3.0, 0.8))

# ================================================================================================================================
# BEDS: roses along the far walk, lavender and box past the end, lavender under the near wall
# ================================================================================================================================


def standard_rose(x, z, seed):
    r = random.Random(seed)
    o = [rod("RoseStem", (x, GY, z), (x, GY + 1.15, z), 0.025, M["leaf_dark"], 5)]
    o.append(blob("RoseHead", g(x, GY + 1.35, z), (0.32, 0.32, 0.28), M["hedge"], seed, (8, 5), 0.25))
    for k in range(3):
        a = k * TAU / 3 + r.uniform(0, 1)
        o.append(plane("RoseBloom", 0.42, 0.42, g(x + math.cos(a) * 0.2, GY + 1.38, z + math.sin(a) * 0.2), M["roses"], rot=(PI / 2, 0, -a + PI / 2)))
    return o


RX0, RX1 = TX1 + 2.4, TX1 + 4.4  # the rose bed
for z in [v * 1.7 for v in range(-10, 9)]:
    if abs(z) < 1.6:
        continue
    add("beds", *standard_rose(RX0 + 1.0, z, int(z * 10) + 400))
add("beds", *tufts_row(RX0 + 0.4, RM["minZ"] - 2.5, RX0 + 0.4, -1.4, 0.5, 0.5, M["roses"], GY, 1))
add("beds", *tufts_row(RX0 + 0.4, 1.4, RX0 + 0.4, TZ1 - 0.2, 0.5, 0.5, M["roses"], GY, 2))
add("beds", *tufts_row(RX1 - 0.3, RM["minZ"] - 2.5, RX1 - 0.3, -1.4, 0.55, 0.45, M["lavender"], GY, 3))
add("beds", *tufts_row(RX1 - 0.3, 1.4, RX1 - 0.3, TZ1 - 0.2, 0.55, 0.45, M["lavender"], GY, 4))
# the yew hedge behind the roses, its gap on the fountain's axis, its ends rounded
HX0, HX1 = RX1 + 0.3, RX1 + 1.3
for z0, z1 in ((RM["minZ"] - 3.0, -1.4), (1.4, TZ1 + 6.0)):
    add("beds", box("YewHedge", HX0, HX1, GY, GY + 1.75, z0, z1, M["hedge"], 0.12))
    for zz in (z0, z1):
        add("beds", sphere("HedgeBall", 0.32, g((HX0 + HX1) / 2, GY + 2.05, zz + (0.3 if zz == z0 else -0.3)), M["hedge"], 10, 6))
# the end: the box edging, lavender, a second hedge returning along the end to meet the far one
EZ0, EZ1 = TZ1 + 2.4, TZ1 + 3.6
for x0, x1 in ((TX0 - 2.0, -2.8), (2.8, HX0)):
    add("beds", box("BoxEdging", x0, x1, GY, GY + 0.32, EZ0 - 0.15, EZ0 + 0.15, M["hedge"], 0.08))
    add("beds", box("BoxEdging", x0, x1, GY, GY + 0.32, EZ1 + 0.15, EZ1 + 0.45, M["hedge"], 0.08))
    add("beds", *tufts_row(x0 + 0.3, EZ0 + 0.55, x1 - 0.3, EZ0 + 0.55, 0.45, 0.5, M["lavender"], GY, int(x0) + 50))
    add("beds", *tufts_row(x0 + 0.3, EZ1 - 0.2, x1 - 0.3, EZ1 - 0.2, 0.5, 0.48, M["roses"], GY, int(x0) + 60))
# under the near wall: a low strip of lavender (the camera looks over it)
add("beds", *tufts_row(TX0 - 0.6, RM["minZ"] - 2.0, TX0 - 0.6, TZ1 + 1.5, 0.5, 0.42, M["lavender"], GY, 70))
add("beds", *tufts_row(TX0 - 1.05, RM["minZ"] - 2.0, TX0 - 1.05, TZ1 + 1.5, 0.6, 0.38, M["geranium"], GY, 71))

# ================================================================================================================================
# TOPIARY: a mother duck and three ducklings, a swan, a teapot pouring into a teacup (all clipped yew)
# ================================================================================================================================
H = M["hedge"]


def topiary_duck(x, z, s, turn, seed):
    o = [blob("DuckBody", (0, 0, 0.45 * s), (0.6 * s, 0.42 * s, 0.4 * s), H, seed, (10, 6), 0.08)]
    o.append(blob("DuckHead", (0.45 * s, 0, 0.98 * s), (0.25 * s, 0.24 * s, 0.25 * s), H, seed + 1, (8, 5), 0.06))
    o.append(blob("DuckBill", (0.72 * s, 0, 0.93 * s), (0.14 * s, 0.1 * s, 0.05 * s), H, seed + 2, (6, 4), 0.02))
    o.append(blob("DuckTail", (-0.6 * s, 0, 0.7 * s), (0.18 * s, 0.14 * s, 0.14 * s), H, seed + 3, (6, 4), 0.05))
    d = join(o, "TopiaryDuck")
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = d
    d.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    d.rotation_euler = (0, 0, turn)
    d.location = g(x, GY + 0.12, z)
    apply_all(d)
    return [d, cyl("TopiaryPlinth", 0.6 * s, 0.12, g(x, GY, z), M["stone"], 10)]


add("topiary", *topiary_duck(RX0 + 1.0, 5.1, 1.3, PI / 2 + 0.3, 11))
for k in range(3):
    add("topiary", *topiary_duck(RX0 + 0.8 + 0.25 * (k % 2), 6.5 + k * 0.85, 0.5, PI / 2 + R.uniform(-0.4, 0.4), 20 + k))
# the swan: a body, an S-curved neck of clipped yew, a head with a beak
sx, sz = RX0 + 1.0, -6.0
sw = [blob("SwanBody", g(sx, GY + 0.6, sz), (0.7, 0.45, 0.42), H, 31, (10, 6), 0.08)]
neck = [Vector(g(sx + 0.0, GY + 0.75, sz + 0.35)), Vector(g(sx, GY + 1.25, sz + 0.6)), Vector(g(sx, GY + 1.6, sz + 0.35)), Vector(g(sx, GY + 1.75, sz + 0.55))]
sw.append(tube("SwanNeck", neck, 0.13, H, 4, 8))
sw.append(blob("SwanHead", g(sx, GY + 1.8, sz + 0.62), (0.15, 0.2, 0.13), H, 32, (8, 5), 0.04))
sw.append(blob("SwanWing", g(sx, GY + 0.95, sz - 0.25), (0.45, 0.35, 0.25), H, 33, (8, 5), 0.08))
sw.append(cyl("TopiaryPlinth", 0.8, 0.12, g(sx, GY, sz), M["stone"], 10))
add("topiary", *sw)
# the teapot pouring into its cup, past the end on the sundial's walk
tx, tz = 4.6, TZ1 + 5.2
tp = [blob("TeapotBody", g(tx, GY + 0.95, tz), (0.85, 0.85, 0.72), H, 41, (12, 7), 0.05)]
tp.append(blob("TeapotLid", g(tx, GY + 1.68, tz), (0.42, 0.42, 0.12), H, 42, (10, 5), 0.03))
tp.append(blob("TeapotKnob", g(tx, GY + 1.86, tz), (0.13, 0.13, 0.13), H, 43, (6, 4), 0.02))
tp.append(tube("TeapotSpout", [Vector(g(tx - 0.7, GY + 0.85, tz)), Vector(g(tx - 1.1, GY + 1.15, tz)), Vector(g(tx - 1.35, GY + 1.45, tz))], 0.14, H, 3, 8))
tp.append(torus("TeapotHandle", 0.38, 0.11, g(tx + 0.85, GY + 1.0, tz), H, 14, 6, rot=(PI / 2, 0, 0)))
tp.append(cyl("TeapotFoot", 0.6, 0.25, g(tx, GY, tz), H, 14, r2=0.7))
tp.append(lathe("Teacup", [(0.18, 0), (0.3, 0.06), (0.48, 0.38), (0.56, 0.6), (0.5, 0.62), (0.01, 0.62)], 14, H, g(tx - 2.3, GY + 0.12, tz)))
tp.append(cyl("Saucer", 0.75, 0.12, g(tx - 2.3, GY, tz), H, 16, r2=0.8))
tp.append(torus("CupHandle", 0.18, 0.06, g(tx - 2.3 - 0.6, GY + 0.45, tz), H, 10, 5, rot=(PI / 2, 0, 0)))
add("topiary", *tp)
# the sundial on its pillar at the end of the walk
dx, dz = 0.0, TZ1 + 7.0
add("furniture", cyl("SundialStep", 0.8, 0.15, g(dx, GY, dz), M["stone"], 12), cyl("SundialPillar", 0.22, 0.9, g(dx, GY + 0.15, dz), M["stone"], 10, r2=0.18))
add("furniture", cyl("SundialTop", 0.35, 0.05, g(dx, GY + 1.05, dz), M["stone"], 16), cyl("SundialPlate", 0.3, 0.02, g(dx, GY + 1.1, dz), M["brass"], 16))
gn = bmesh.new()
vs = [gn.verts.new(g(dx + a, GY + 1.12 + b, dz)) for a, b in ((-0.22, 0), (0.18, 0), (-0.22, 0.24))]
gn.faces.new(vs)
me = bpy.data.meshes.new("Gnomon")
gn.to_mesh(me)
gn.free()
gnomon = bpy.data.objects.new("Gnomon", me)
bpy.context.scene.collection.objects.link(gnomon)
gnomon.data.materials.append(M["brass"])
sol = gnomon.modifiers.new("S", "SOLIDIFY")
sol.thickness = 0.02
apply_all(gnomon)
add("furniture", gnomon)

# ================================================================================================================================
# THE FOUNTAIN (through the hedge's gap) and THE BANDSTAND (past the end)
# ================================================================================================================================
fx, fz = TX1 + 10.0, 0.0
fo = [lathe("FountainBasin", [(2.2, 0), (2.3, 0.1), (2.3, 0.5), (2.45, 0.55), (2.45, 0.62), (2.15, 0.62), (2.1, 0.2), (0.01, 0.2)], 32, M["stone"], g(fx, GY, fz))]
fo.append(cyl("FountainWater", 2.12, 0.02, g(fx, GY + 0.45, fz), M["water"], 32))
fo.append(cyl("FountainShaft", 0.25, 1.2, g(fx, GY + 0.2, fz), M["stone"], 12, r2=0.18))
fo.append(lathe("FountainBowl", [(0.15, 0), (0.6, 0.12), (1.0, 0.25), (1.05, 0.32), (0.95, 0.32), (0.15, 0.2)], 24, M["stone"], g(fx, GY + 1.3, fz)))
fo.append(cyl("BowlWater", 0.93, 0.01, g(fx, GY + 1.6, fz), M["water"], 24))
fo.append(cyl("FountainShaft2", 0.14, 0.7, g(fx, GY + 1.6, fz), M["stone"], 10, r2=0.1))
fo.append(lathe("FountainBowl2", [(0.1, 0), (0.35, 0.08), (0.55, 0.17), (0.58, 0.22), (0.52, 0.22), (0.1, 0.14)], 20, M["stone"], g(fx, GY + 2.25, fz)))
fo.append(cyl("BowlWater2", 0.5, 0.01, g(fx, GY + 2.46, fz), M["water"], 20))
fo.append(blob("Pineapple", g(fx, GY + 2.75, fz), (0.15, 0.15, 0.24), M["stone"], 51, (8, 6), 0.1))
for k in range(5):
    a = k * TAU / 5
    fo.append(rod("PineLeaf", (fx, GY + 2.95, fz), (fx + math.cos(a) * 0.14, GY + 3.2, fz + math.sin(a) * 0.14), 0.025, M["stone"], 4))
# the falling water: thin sheets from the bowls' lips (pale, static)
fo.append(cyl("Glass_FountainFall", 1.0, 1.0, g(fx, GY + 0.45, fz), sm("water_fall", "#cfeaf0", 0.1), 24, r2=0.97))
fo.append(cyl("Glass_FountainFall2", 0.56, 0.6, g(fx, GY + 1.62, fz), sm("water_fall", "#cfeaf0", 0.1), 20, r2=0.54))
add("fountain", *fo)
for z in (-4.2, 4.2):
    add("trees", *cypress(fx, z, 5.5, int(z * 10) + 600, y0=GY))
# the bandstand: octagonal, white iron, an emerald roof striped in cream, a duck on the weathervane
bx_, bz_ = -9.0, TZ1 + 9.0
bs = [cyl("BandPlinth", 2.6, 0.8, g(bx_, GY, bz_), M["stone"], 8)]
bs.append(cyl("BandFloor", 2.5, 0.05, g(bx_, GY + 0.8, bz_), M["teak"], 8))
for k in range(8):
    a = k * TAU / 8 + PI / 8
    px, pz = bx_ + math.cos(a) * 2.35, bz_ + math.sin(a) * 2.35
    bs.append(cyl("BandColumn", 0.07, 2.6, g(px, GY + 0.85, pz), M["iron"], 8))
    b_ = k * TAU / 8 + PI / 8 + TAU / 16
    qx, qz = bx_ + math.cos(b_) * 2.17, bz_ + math.sin(b_) * 2.17
    if k != 2:  # (the steps' side open)
        bs.append(box("BandRail", qx - 0.04, qx + 0.04, GY + 0.85, GY + 1.75, qz - 0.04, qz + 0.04, M["iron"], 0.01))
    nx, nz = bx_ + math.cos(a + TAU / 8) * 2.35, bz_ + math.sin(a + TAU / 8) * 2.35
    if k != 2:
        bs.append(rod("BandRailTop", (px, GY + 1.75, pz), (nx, GY + 1.75, nz), 0.025, M["iron"], 5))
    bs.append(rod("BandFrieze", (px, GY + 3.25, pz), (nx, GY + 3.25, nz), 0.04, M["iron"], 5))
    lace = plane("Lace", 0.85, 0.85, g((px + nx) / 2, GY + 2.98, (pz + nz) / 2), M["lace"], rot=(PI / 2, 0, -(a + TAU / 16) + PI / 2))
    bs.append(lace)
bs.append(cyl("BandRoof", 2.85, 1.4, g(bx_, GY + 3.45, bz_), M["emerald"], 8, r2=0.25))
for k in range(8):
    a = k * TAU / 8 + PI / 8
    bs.append(rod("RoofRib", (bx_ + math.cos(a) * 2.9, GY + 3.42, bz_ + math.sin(a) * 2.9), (bx_ + math.cos(a) * 0.25, GY + 4.87, bz_ + math.sin(a) * 0.25), 0.05, M["cream"], 4))
bs.append(cyl("RoofEave", 2.95, 0.12, g(bx_, GY + 3.35, bz_), M["cream"], 8))
bs.append(rod("Vane", (bx_, GY + 4.85, bz_), (bx_, GY + 5.7, bz_), 0.02, M["gold"], 5))
bs.append(sphere("VaneBall", 0.08, g(bx_, GY + 5.2, bz_), M["gold"], 8, 5))
bs.append(rod("VaneArm", (bx_ - 0.3, GY + 5.45, bz_), (bx_ + 0.3, GY + 5.45, bz_), 0.012, M["gold"], 4))
bs.append(sphere("VaneDuck", 0.1, g(bx_, GY + 5.75, bz_), M["gold"], 8, 5, scale=(1.4, 0.4, 0.8)))
bs.append(sphere("VaneDuckHead", 0.06, g(bx_ + 0.12, GY + 5.86, bz_), M["gold"], 6, 4, scale=(1, 0.4, 1)))
a = 2 * TAU / 8 + PI / 8 + TAU / 16
for k in range(3):  # the steps up on the open side (toward the garden's middle)
    r_ = 2.7 + 0.35 * k
    sx_, sz_ = bx_ + math.cos(a) * r_, bz_ + math.sin(a) * r_
    st = box("BandStep", -0.7, 0.7, GY, GY + 0.8 - 0.27 * (k + 1) + 0.27, -0.18, 0.18, M["stone"], 0.01)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = st
    st.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    st.rotation_euler = (0, 0, -a + PI / 2)
    st.location = g(sx_, 0, sz_)
    apply_all(st)
    bs.append(st)
add("bandstand", *bs)
# music stands and chairs left on the bandstand
for k in range(4):
    a = k * TAU / 4 + 0.6
    cx, cz = bx_ + math.cos(a) * 1.2, bz_ + math.sin(a) * 1.2
    add("bandstand", rod("MusicStand", (cx, GY + 0.85, cz), (cx, GY + 1.95, cz), 0.012, M["iron_dark"], 4))
    add("bandstand", box("StandDesk", cx - 0.2, cx + 0.2, GY + 1.85, GY + 2.15, cz - 0.02, cz + 0.02, M["iron_dark"], 0.005))

# ================================================================================================================================
# TREES: Irish yews in rows, limes and chestnuts beyond, three great limes behind the back wall
# ================================================================================================================================
for x in range(-16, 17, 4):
    if abs(x - bx_) < 4.5 or abs(x) < 2:
        continue
    add("trees", *cypress(x + R.uniform(-0.3, 0.3), TZ1 + 12.5, R.uniform(4.5, 6.0), 700 + x, y0=GY))
for z in range(-16, 14, 5):
    if abs(z) < 5:
        continue
    add("trees", *cypress(HX1 + 5.0, z + R.uniform(-0.4, 0.4), R.uniform(4.5, 6.0), 800 + z, y0=GY))
spots = [(TX1 + 16 + R.uniform(0, 5), z, R.uniform(10, 13)) for z in range(-22, 26, 7)]
spots += [(x, TZ1 + 17 + R.uniform(0, 5), R.uniform(10, 13)) for x in range(-24, 26, 8)]
spots += [(x, RM["minZ"] - 6.5 - R.uniform(0, 2), 14.5) for x in (-9.0, 0.5, 9.5)]
spots += [(TX0 - 9 - R.uniform(0, 4), z, R.uniform(10, 12)) for z in range(-18, 20, 9)]
for k, (x, z, h) in enumerate(spots):
    add("trees", *broadleaf(x, z, h, 900 + k, y0=GY, light=True))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("gd_far", g(TX1 + 5, -0.5, 0.0), 22, 18, 270, (1280, 720), 16, 30)
    look("gd_end", g(0, -0.5, TZ1 + 6), 22, 22, 180, (1280, 720), 16, 30)
    look("gd_topiary", g(3.0, -1.0, TZ1 + 5.0), 6, 18, 180, (960, 640), 16, 35)
save_part("garden", [o for v in parts.values() for o in v if o])
