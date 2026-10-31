"""The Kids Pool's ground and buildings, modelled in place in game coordinates: the soft rubber deck with its inlaid shapes (a sun,
stepping-stone circles, a wave, hopscotch), the pink band round the pool, the white bullnose coping, the aqua mosaic basin with
mosaic sea creatures on its floor, its pink waterline frieze and its ladders; the white picket fence with candy-coloured caps and
a flowering hedge outside it; the gate (two rainbow leaves, `Door_A` and `Door_B`, under the KIDS POOL arch); a row of pastel
beach huts outside the back fence on either side of a boardwalk from the gate; the ground round it all, level with the deck.

Writes WORK/parts/shell.glb and floor.glb (what is painted on the deck: the hopscotch's numbers, WALK!).

    blender -b -P tools/venues/kids/shell.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(11)
LOOK = "--look" in args()
CREAM_RUBBER = "#ffefc9"
M = dict(
    deck=tmat_tile("rubber", CREAM_RUBBER, 0.9, tint=CREAM_RUBBER),
    band=tmat_tile("rubber", "#ffa6c4", 0.9, tint="#ffa6c4"),
    basin=tmat_tile("glass_mosaic", "#8fe0ea", 0.15),
    frieze=tmat_tile("mosaic_band", "#ff7eb3", 0.2),
    hedge=tmat_tile("hedge", "#3c7a38", 0.8),
    boardwalk=tmat_tile("boards", "#d8a26a", 0.6, tint="#d9b27f"),
    coping=sm("white_gloss"),
    picket=sm("white_paint"),
    rail=sm("sky"),
    roof_white=sm("white_paint"),
    hut_trim=sm("cream"),
    door_white=sm("white_paint"),
    window=sm("hut_window", "#2c4a5a", 0.25),
    ground=tmat_tile("groundcover", "#2f4a2c", 0.95),
    kerb=sm("kerb", "#e9e2d2", 0.7),
)
INLAY = ["#7fd0f5", "#ffd23f", "#9fe3c4", "#c4a8ff", "#ff9fbf", "#ffb27a"]
parts = []


def rubber(hex_):
    return tmat_tile("rubber", hex_, 0.9, tint=hex_)


def ring(name, x_in, z_in, y0, y1, m, outer):
    """A flat ring: the rectangle `outer` (x0, x1, z0, z1) with a hole x_in by z_in round the pool, from y0 to y1."""
    bm = bmesh.new()
    ox0, ox1, oz0, oz1 = outer
    vo = [bm.verts.new(g(x, y1, z)) for x, z in [(ox0, oz0), (ox1, oz0), (ox1, oz1), (ox0, oz1)]]
    vi = [bm.verts.new(g(x, y1, z)) for x, z in [(-x_in, -z_in), (x_in, -z_in), (x_in, z_in), (-x_in, z_in)]]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([vo[i], vo[j], vi[j], vi[i]])
    r = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    bmesh.ops.translate(bm, vec=(0, 0, y0 - y1), verts=[e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    return o


def disc(name, x, z, r, m, y=0.004, n=28, h=0.004):
    return cyl(name, r, h, g(x, y - h, z), m, n)


# ---- the deck: soft rubber, a pink band round the pool, the coping -------------------------------------------------------------
COP = 0.38
parts.append(ring("Deck", HX + COP, HZ + COP, -0.3, 0.0, M["deck"], (ROOM["x0"] - 0.05, ROOM["x1"] + 0.05, ROOM["z0"] - 0.05, ROOM["z1"] + 0.05)))
parts.append(ring("Band", HX + COP, HZ + COP, -0.02, 0.006, M["band"], (-HX - 1.15, HX + 1.15, -HZ - 1.15, HZ + 1.15)))
cop = ring("Coping", HX, HZ, -0.06, 0.05, M["coping"], (-HX - COP, HX + COP, -HZ - COP, HZ + COP))
bevel(cop, 0.04, 3, angle=30)
parts.append(cop)

# inlaid shapes in other rubbers (kids run over them: they are the deck, 6 mm proud at most)
inlays = []
# a big sun at the open end, between the pool and the toy corner
sx, sz = 0.0, 11.0
inlays.append(disc("SunDisc", sx, sz, 0.85, rubber("#ffd23f"), 0.009, 32, 0.004))
for k in range(12):
    a = k * math.tau / 12
    ray = extrude_shape("SunRay", [(-0.12, 0), (0.12, 0), (0, 0.5)], 0.004, g(sx + math.cos(a) * 1.0, 0.005, sz + math.sin(a) * 1.0), rubber("#ffb27a"), rot=(0, 0, a - PI / 2))
    inlays.append(ray)
# stepping-stone circles in a curving trail along both long sides
for side in (-1, 1):
    for k in range(9):
        z = -11.5 + k * 2.6
        x = side * (HX + 2.6 + math.sin(k * 0.9) * 0.9)
        inlays.append(disc("Stone", x, z, 0.36 + (k % 3) * 0.06, rubber(INLAY[(k + (side > 0) * 3) % len(INLAY)]), 0.008))
# a wave along the back, in front of the gate's walk (between the pool and the back fence, left and right of the path)
for side in (-1, 1):
    pts = []
    for k in range(25):
        t = k / 24
        x = side * (2.2 + t * 10.0)
        pts.append((x, -13.6 + math.sin(t * math.tau * 2) * 0.35))
    for (x0, z0), (x1, z1) in zip(pts[:-1], pts[1:]):
        dx, dz = x1 - x0, z1 - z0
        L = math.hypot(dx, dz)
        nx, nz = -dz / L * 0.22, dx / L * 0.22
        quad = [(x0 + nx, z0 + nz), (x1 + nx, z1 + nz), (x1 - nx, z1 - nz), (x0 - nx, z0 - nz)]
        bm = bmesh.new()
        vs = [bm.verts.new(g(qx, 0.006, qz)) for qx, qz in quad]
        f = bm.faces.new(vs)
        if f.normal.z < 0:
            f.normal_flip()
        me = bpy.data.meshes.new("Wave")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("Wave", me)
        bpy.context.scene.collection.objects.link(o)
        set_mat(o, rubber("#7fd0f5"))
        inlays.append(o)
# hopscotch by the toy corner's side of the open end (x -9.5 .. -6.5, z 10.0 .. 12.2): squares in the palette, numbers painted
HOP = [(0, 0), (0, 1), (-0.5, 2), (0.5, 2), (0, 3), (-0.5, 4), (0.5, 4), (0, 5)]
hop_numbers = []
for k, (u, v) in enumerate(HOP):
    x, z = -8.0 + u * 0.62, 12.0 - v * 0.62
    inlays.append(gbx("Hop", x - 0.29, x + 0.29, 0.0, 0.007, z - 0.29, z + 0.29, rubber(INLAY[k % len(INLAY)]), 0.0))
    hop_numbers.append((k + 1, x, z))
parts.append(join(inlays, "Inlays"))

# ---- the basin: aqua mosaic, a pink frieze at the waterline, sea creatures on the floor, two ladders -------------------------------
bm = bmesh.new()
corners = [(-HX, -HZ), (HX, -HZ), (HX, HZ), (-HX, HZ)]
top = [bm.verts.new(g(x, -0.06, z)) for x, z in corners]
bot = [bm.verts.new(g(x, FLOOR_Y, z)) for x, z in corners]
for i in range(4):
    j = (i + 1) % 4
    bm.faces.new([top[i], bot[i], bot[j], top[j]])
bm.faces.new(list(reversed(bot)))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.normal_update()
if [f for f in bm.faces if abs(f.normal.z) > 0.5][0].normal.z < 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
me = bpy.data.meshes.new("Basin")
bm.to_mesh(me)
bm.free()
basin = bpy.data.objects.new("Basin", me)
bpy.context.scene.collection.objects.link(basin)
set_mat(basin, M["basin"])
parts.append(basin)
for name, x0, x1, z0, z1 in [
    ("FriezeL", -HX, -HX + 0.012, -HZ, HZ),
    ("FriezeR", HX - 0.012, HX, -HZ, HZ),
    ("FriezeB", -HX, HX, -HZ, -HZ + 0.012),
    ("FriezeF", -HX, HX, HZ - 0.012, HZ),
]:
    parts.append(gbx(name, x0, x1, -0.4, -0.08, z0, z1, M["frieze"], 0))


def flat_shape(name, pts, x, z, m, rz=0.0, scale=1.0, y=FLOOR_Y + 0.004):
    """A flat mosaic picture on the basin's floor: a 2D outline (x across, y along z) laid flat at (x, z), turned by rz."""
    o = extrude_shape(name, [(px * scale, py * scale) for px, py in pts], 0.004, g(x, y, z), m, rot=(0, 0, rz))
    return o


def blob_outline(rx, ry, n=20, wob=0.0, seed=0):
    r = random.Random(seed)
    return [(math.cos(k * math.tau / n) * rx * (1 + r.uniform(-wob, wob)), math.sin(k * math.tau / n) * ry * (1 + r.uniform(-wob, wob))) for k in range(n)]


creatures = []
whale_body = sm("whale", "#2f6fb5", 0.3)
whale_belly = sm("whale_belly", "#bfe6f7", 0.3)
# a whale across the middle of the floor: its body, its tail, its belly, an eye, a spout of drops
creatures.append(flat_shape("Whale", blob_outline(2.2, 1.0, 26), -0.6, 0.6, whale_body))
creatures.append(flat_shape("WhaleTail", [(0, 0), (1.1, 0.75), (0.85, 0.05), (1.1, -0.65)], 1.35, 0.6, whale_body, PI / 2))
creatures.append(flat_shape("WhaleBelly", blob_outline(1.5, 0.45, 20), -0.8, 1.05, whale_belly, 0, 1, FLOOR_Y + 0.006))
creatures.append(flat_shape("WhaleEye", blob_outline(0.12, 0.12, 10), -2.0, 0.3, sm("navy"), 0, 1, FLOOR_Y + 0.008))
for k in range(4):
    creatures.append(flat_shape("Spout", blob_outline(0.14, 0.14, 10), -1.6 - k * 0.35, -0.9 - (k % 2) * 0.3, whale_belly))
# starfish and fish round it
def star(r1, r2, n=5):
    return [((r1 if k % 2 == 0 else r2) * math.cos(k * math.pi / n + PI / 2), (r1 if k % 2 == 0 else r2) * math.sin(k * math.pi / n + PI / 2)) for k in range(n * 2)]


for (x, z, c, s) in [(-3.2, -5.2, "#ff8a5c", 0.7), (3.0, 4.9, "#ffd23f", 0.6), (2.6, -6.6, "#ff7eb3", 0.55), (-3.3, 6.2, "#b49cff", 0.5)]:
    creatures.append(flat_shape("Starfish", star(s, s * 0.42), x, z, sm("star_" + c, c, 0.35), R.uniform(0, 1)))
fish = [(0, 0.3), (0.55, 0.0), (0, -0.3), (-0.5, -0.12), (-0.8, -0.35), (-0.75, 0.0), (-0.8, 0.35), (-0.5, 0.12)]
for (x, z, c, rz) in [(2.8, -2.0, "#ffd23f", 0.4), (3.4, -1.2, "#ff8a5c", 0.2), (-3.0, 2.6, "#7bd8b0", 2.8), (-2.6, 3.4, "#ffd23f", 3.0), (0.4, -4.4, "#ff7eb3", 1.4)]:
    creatures.append(flat_shape("Fish", fish, x, z, sm("fish_" + c, c, 0.35), rz))
parts.append(join(creatures, "SeaCreatures"))


def ladder(x, z):
    out = -1 if x < 0 else 1
    rails = []
    hand = sm("sky_gloss", "#4fc3f7", 0.2)
    for zz in (z - 0.42, z + 0.42):
        rails.append(poly_tube("LadderRail", [g(x - out * 0.12, -1.0, zz), g(x - out * 0.12, 0.35, zz), g(x + out * 0.18, 0.92, zz), g(x + out * 0.55, 0.62, zz), g(x + out * 0.55, 0.06, zz)], 0.035, hand, 10, 0.22))
        rails.append(cyl("LadderFoot", 0.07, 0.03, g(x + out * 0.55, 0.05, zz), sm("white_gloss"), 14))
    for y in (-0.88, -0.5, -0.12):
        rails.append(gbx("Rung", x - out * 0.2, x - out * 0.04, y - 0.025, y + 0.025, z - 0.42, z + 0.42, sm("sun"), 0.01))
    return join(rails, "Ladder")


parts.append(ladder(-HX, 5.0))
parts.append(ladder(HX, -4.1))

# ---- the picket fence, its hedge outside, the gate ----------------------------------------------------------------------------------
FX0, FX1, FZ0, FZ1 = FENCE["x0"], FENCE["x1"], FENCE["z0"], FENCE["z1"]
GH = GATE["half"]
CAPS = ["#ff7eb3", "#ffd23f", "#4fc3f7", "#7bd8b0", "#ff8a5c", "#b49cff"]
pickets, posts, rails = [], [], []
PICKET = [(-0.045, 0), (0.045, 0), (0.045, 0.86), (0, 0.95), (-0.045, 0.86)]


def picket_run(x0, z0, x1, z1, skip=None):
    L = math.hypot(x1 - x0, z1 - z0)
    n = int(L / 0.17)
    rz = math.atan2(z1 - z0, x1 - x0)  # (the run's direction in game x-z)
    for i in range(n + 1):
        t = i / n
        x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
        if skip and skip(x, z):
            continue
        p = extrude_shape("Picket", PICKET, 0.022, (0, 0, 0), M["picket"], rot=(PI / 2, 0, 0))
        p.location = g(x, 0.02, z)
        p.rotation_euler = (PI / 2, 0, -rz)
        pickets.append(p)
    # posts every ~2.4 m with a ball cap
    m = max(1, int(L / 2.4))
    for i in range(m + 1):
        t = i / m
        x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
        if skip and skip(x, z):
            continue
        posts.append(gbx("Post", x - 0.06, x + 0.06, 0, 1.05, z - 0.06, z + 0.06, M["picket"], 0.015))
        posts.append(sphere("PostCap", 0.085, g(x, 1.12, z), sm("cap_" + CAPS[i % len(CAPS)], CAPS[i % len(CAPS)], 0.3), 12, 8))
    for y in (0.28, 0.7):
        if skip:
            for s in (-1, 1):
                a, b = (x0, -GH - 0.18) if s < 0 else (GH + 0.18, x1)
                rails.append(gbx("Rail", a, b, y - 0.03, y + 0.03, z0 + 0.03, z0 + 0.07, M["picket"], 0.006))
        else:
            if abs(x1 - x0) > abs(z1 - z0):
                rails.append(gbx("Rail", x0, x1, y - 0.03, y + 0.03, z0 + 0.03 * (1 if z0 < 0 else -1), z0 + 0.07 * (1 if z0 < 0 else -1), M["picket"], 0.006))
            else:
                sx = 1 if x0 < 0 else -1
                rails.append(gbx("Rail", x0 + 0.03 * sx, x0 + 0.07 * sx, y - 0.03, y + 0.03, z0, z1, M["picket"], 0.006))


picket_run(FX0, FZ0, FX1, FZ0, skip=lambda x, z: abs(x) < GH + 0.1)
picket_run(FX0, FZ0, FX0, FZ1)
picket_run(FX1, FZ0, FX1, FZ1)
picket_run(FX0, FZ1, FX1, FZ1)
parts.append(join(pickets, "Pickets"))
parts.append(join(posts + rails, "FencePosts"))
# the hedge outside the fence, with flowers (hydrangea and hibiscus cards on its face)
hedge = []
for name, x0, x1, z0, z1 in [
    ("HedgeL", ROOM["x0"] - 0.85, ROOM["x0"] - 0.05, FZ0 - 0.3, FZ1 + 0.8),
    ("HedgeR", ROOM["x1"] + 0.05, ROOM["x1"] + 0.85, FZ0 - 0.3, FZ1 + 0.8),
    ("HedgeF", ROOM["x0"] - 0.85, ROOM["x1"] + 0.85, ROOM["z1"] + 0.05, ROOM["z1"] + 0.85),
]:
    hedge.append(gbx(name, x0, x1, 0, 1.25, z0, z1, M["hedge"], 0.18))
parts += hedge
flowers = []
fl_mats = [cutmat("hydrangea", 0.7), cutmat("hibiscus", 0.7)]
for k in range(46):
    side = k % 3
    if side == 0:
        x, z, rz = ROOM["x0"] - 0.06, R.uniform(FZ0, FZ1), PI / 2
    elif side == 1:
        x, z, rz = ROOM["x1"] + 0.06, R.uniform(FZ0, FZ1), -PI / 2
    else:
        x, z, rz = R.uniform(ROOM["x0"], ROOM["x1"]), ROOM["z1"] + 0.06, PI
    s = R.uniform(0.35, 0.55)
    p = plane("Flowers", s, s, (0, 0, 0), fl_mats[k % 2], rot=(PI / 2, 0, 0))
    p.location = g(x, R.uniform(0.85, 1.15), z)
    p.rotation_euler = (PI / 2 - 0.3, 0, rz)
    flowers.append(p)
parts.append(join(flowers, "HedgeFlowers"))

# the gate: posts with big ball caps, the KIDS POOL arch board, two rainbow leaves
for s in (-1, 1):
    parts.append(gbx("GatePost", s * (GH + 0.12) - 0.11, s * (GH + 0.12) + 0.11, 0, 2.62, FZ0 - 0.11, FZ0 + 0.11, sm("sky"), 0.03))
    parts.append(sphere("GateCap", 0.17, g(s * (GH + 0.12), 2.78, FZ0), sm("sun"), 16, 10))
AW, AH = 3.5, 0.88
parts.append(gbx("ArchBack", -AW / 2 - 0.06, AW / 2 + 0.06, 2.18, 2.18 + AH + 0.12, FZ0 - 0.06, FZ0 + 0.02, sm("pink"), 0.03))
parts.append(plane("ArchSign", AW, AH, g(0, 2.24 + AH / 2, FZ0 + 0.025), signmat("kids_pool", 0.5), rot=(PI / 2, 0, 0)))
LEAF_COLS = ["#ff7eb3", "#ffd23f", "#4fc3f7", "#7bd8b0", "#ff8a5c", "#b49cff"]
for side, name in ((-1, "Door_A"), (1, "Door_B")):
    hinge_x = side * GH
    leaf = []
    w_ = GH - 0.04
    n = 6
    for i in range(n):
        u = 0.1 + i * (w_ - 0.18) / (n - 1)
        x = hinge_x - side * u
        c = LEAF_COLS[(i + (3 if side > 0 else 0)) % len(LEAF_COLS)]
        p = extrude_shape("GatePicket", [(-0.05, 0), (0.05, 0), (0.05, 1.0), (0, 1.1), (-0.05, 1.0)], 0.03, (0, 0, 0), sm("gate_" + c, c, 0.4), rot=(PI / 2, 0, 0))
        p.location = g(x, 0.06, FZ0 + 0.04)
        leaf.append(p)
    for y in (0.3, 0.85):
        leaf.append(gbx("GateRail", hinge_x - side * 0.03, hinge_x - side * (w_ - 0.03), y - 0.035, y + 0.035, FZ0 + 0.05, FZ0 + 0.1, M["picket"], 0.008))
    leaf.append(gbx("GateBrace", min(hinge_x - side * 0.08, hinge_x - side * (w_ - 0.08)), max(hinge_x - side * 0.08, hinge_x - side * (w_ - 0.08)), 0.56, 0.6, FZ0 + 0.05, FZ0 + 0.1, M["picket"], 0.006))
    o = join(leaf, name)
    set_origin(o, g(hinge_x, 0, FZ0 + 0.06))
    parts.append(o)
    print(name, "hinge", tuple(round(v, 3) for v in (o.location.x, o.location.z, -o.location.y)))

# ---- the beach huts outside the back fence, a boardwalk from the gate between them ---------------------------------------------------
HUT_COLS = ["#ff8fb8", "#7fd0f5", "#ffd23f", "#9fe3c4", "#ffb27a", "#c4a8ff"]
huts = []
hz0 = -17.15  # the huts' fronts
for i, x in enumerate([-12.6, -10.15, -7.7, -5.25, -2.8, 2.8, 5.25, 7.7, 10.15, 12.6]):
    c = HUT_COLS[i % len(HUT_COLS)]
    W, D, H = 2.1, 2.2, 2.3
    body = tmat_tile("boards", c, 0.6, tint=c)
    huts.append(gbx("HutBody", x - W / 2, x + W / 2, 0.25, H, hz0 - D, hz0, body, 0.02))
    huts.append(gbx("HutSkirt", x - W / 2 - 0.03, x + W / 2 + 0.03, 0, 0.27, hz0 - D - 0.03, hz0 + 0.03, M["hut_trim"], 0.01))
    # the gable roof: a white prism over the hut (a little overhang all round), its front gable cream
    deep = "#%02x%02x%02x" % tuple(int(int(c[k : k + 2], 16) * 0.8) for k in (1, 3, 5))  # (the roof a deeper shade of the hut)
    roof = extrude_shape("HutRoof", [(-W / 2 - 0.16, -0.04), (W / 2 + 0.16, -0.04), (0, 0.82)], D + 0.4, g(x, H, hz0 - D - 0.2), sm("roof_" + deep, deep, 0.5), rot=(PI / 2, 0, 0))
    huts.append(roof)
    gable = extrude_shape("HutGable", [(-W / 2, 0), (W / 2, 0), (0, 0.66)], 0.03, g(x, H, hz0 + 0.21), M["hut_trim"], rot=(PI / 2, 0, 0))
    huts.append(gable)
    # the door: stripes of white and the hut's colour, a little round window, the number
    for k in range(6):
        sx0 = x - 0.42 + k * 0.14
        huts.append(gbx("DoorStripe", sx0, sx0 + 0.14, 0.32, 1.95, hz0, hz0 + 0.03, M["door_white"] if k % 2 else sm("hutdoor_" + c, c, 0.45), 0.0))
    huts.append(gbx("DoorFrame", x - 0.48, x + 0.48, 1.95, 2.03, hz0, hz0 + 0.04, M["hut_trim"], 0.006))
    huts.append(cyl("HutWindow", 0.13, 0.03, g(x, 2.22, hz0 + 0.01), M["window"], 16, rot=(PI / 2, 0, 0)))
    huts.append(torus("HutWindowRing", 0.14, 0.025, g(x, 2.22, hz0 + 0.04), M["hut_trim"], 18, 6, rot=(PI / 2, 0, 0)))
    huts.append(plane("HutNumber", 0.26, 0.26, g(x - 0.7, 1.5, hz0 + 0.008), signmat("hut_%d" % (i % 6 + 1), 0.5), rot=(PI / 2, 0, 0)))
    # a step
    huts.append(gbx("HutStep", x - 0.55, x + 0.55, 0, 0.12, hz0, hz0 + 0.35, M["hut_trim"], 0.01))
parts += huts
# the boardwalk from the gate out between the huts
parts.append(gbx("Boardwalk", -1.3, 1.3, -0.02, 0.05, -24.0, ROOM["z0"] + 0.1, M["boardwalk"], 0.01))
for s in (-1, 1):
    parts.append(gbx("BoardwalkEdge", s * 1.3 - 0.05, s * 1.3 + 0.05, 0, 0.12, -24.0, ROOM["z0"] + 0.1, sm("timber_dark"), 0.01))

# ---- the ground round it all, level with the deck: dark planting out to the fog ---------------------------------------------------
def ground():
    big = 140.0
    x0, x1, z0, z1 = ROOM["x0"] - 0.05, ROOM["x1"] + 0.05, ROOM["z0"] - 0.05, ROOM["z1"] + 0.05
    bm = bmesh.new()
    vo = [bm.verts.new(g(x, -0.03, zz)) for x, zz in [(-big, -big), (big, -big), (big, big), (-big, big)]]
    vi = [bm.verts.new(g(x, -0.03, zz)) for x, zz in [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([vo[i], vo[j], vi[j], vi[i]])
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    me = bpy.data.meshes.new("Ground")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Ground", me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, M["ground"])
    return o


parts.append(ground())
# a sand strip in front of the huts and round the boardwalk (the huts stand on it)
parts.append(gbx("HutSand", ROOM["x0"] - 0.9, ROOM["x1"] + 0.9, -0.03, 0.0, -20.2, ROOM["z0"] - 0.05, sm("sand", "#f2dfb5", 0.95), 0.0))

# ---- painted on the deck (baked into the floor's picture) -----------------------------------------------------------------------------
floor = []
for n, x, z in hop_numbers:
    floor.append(flat_text("HopNumber", str(n), 0.34, sm("white_paint"), g(x, 0.012, z), PI, 0.002, "BarlowCondensed-Black", rx=0))
floor.append(flat_text("Walk", "WALK!", 0.62, sm("navy"), g(0, 0.012, -HZ - 2.2), PI, 0.002, "BarlowCondensed-Black", rx=0))

if LOOK:
    look("kids_overview", g(0, 0, -2), 36, 50, -90, (1280, 720), 16, 30)
    look("kids_gate", g(0, 1.5, -16), 12, 14, 0, (1280, 720), 16, 30)
    look("kids_corner", g(9, 1, -12), 10, 25, 40, (1100, 700), 16, 30)
save_part("shell", parts)
save_part("floor", floor)
