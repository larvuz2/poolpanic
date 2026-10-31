"""The Sunset Lagoon's ground and building, modelled in place in game coordinates: the raised hardwood boardwalk on its timber
piles over the sand, the pool's glass-mosaic basin with its coral-stone coping, gutter, teal and coral band and waterline frieze,
the ladders, starting blocks and bamboo pennant posts; the Polynesian beach house along the back (woven bamboo walls between
round timber posts, a deep thatched roof hipped at both ends, a tall gable over the carved entrance with crossed horns at its
apex and the SUNSET LAGOON board, windows with bamboo blinds propped open, paper lanterns along the eave, tiki masks, surfboards
against the wall); the rope railings on timber posts along the long sides and the open end, tiki torches on them; wide steps
down to the beach at the open end; the beach itself (sand to the game's sea on one side, low dunes everywhere else).

Writes WORK/parts/shell.glb (and floor.glb: what is painted on the deck, baked by the exporter into the floor's picture).

    blender -b -P tools/venues/lagoon/shell.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(7)
LOOK = "--look" in args()

M = dict(
    deck=tmat_tile("boardwalk", "#b98a5a", 0.7),
    band=tmat_tile("mosaic_band", "#2aa7a0", 0.2),
    basin=tmat_tile("glass_mosaic", "#5fd6d2", 0.15),
    weave=tmat_tile("weave", "#d8b878", 0.75),
    thatch=tmat_tile("thatch", "#c99a52", 0.95),
    teak=tmat_tile("teak", "#b77b45", 0.5),
    sand=tmat_tile("sand", "#ead0a0", 1.0),
    coping=sm("coral_stone"),
    lane=sm("lane_tile", "#16606a", 0.25),
    gutter=sm("gutter_dark", "#3d4a4f", 0.6),
    grate=sm("stainless"),
    timber=sm("timber"),
    timber_dark=sm("timber_dark"),
    timber_grey=sm("timber_grey"),
    bamboo=sm("bamboo"),
    joint=sm("bamboo_joint"),
    rope=sm("rope"),
    thatch_dry=sm("thatch_dry"),
    interior=sm("window_dark", "#2a2622", 0.4),
    block=sm("white_gloss"),
    block_top=sm("block_top", "#2aa7a0", 0.6),
    teal=sm("teal"),
    coral=sm("coral"),
    sun=sm("sun"),
    cream=sm("cream"),
    navy=sm("navy"),
    tiki_red=sm("tiki_red"),
    tiki_black=sm("tiki_black"),
    iron=sm("iron"),
    lamp=lamp_mat("paper_glow", "#ffb070", 3.0),
    flame=lamp_mat("torch_flame", "#ffa040", 6.0),
)
parts = []


def ring(name, x_in, z_in, x_out, z_out, y0, y1, m, bev=0.0, outer=None):
    """A flat rectangular ring round the pool (outer minus inner rectangle) from y0 to y1, game coordinates. `outer`
    (x0, x1, z0, z1): an outer rectangle not centred on the pool."""
    bm = bmesh.new()
    pts_o = [(-x_out, -z_out), (x_out, -z_out), (x_out, z_out), (-x_out, z_out)]
    if outer:
        ox0, ox1, oz0, oz1 = outer
        pts_o = [(ox0, oz0), (ox1, oz0), (ox1, oz1), (ox0, oz1)]
    pts_i = [(-x_in, -z_in), (x_in, -z_in), (x_in, z_in), (-x_in, z_in)]
    vo = [bm.verts.new(g(x, y1, z)) for x, z in pts_o]
    vi = [bm.verts.new(g(x, y1, z)) for x, z in pts_i]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([vo[i], vo[j], vi[j], vi[i]])
    r = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    moved = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, y0 - y1), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    if bev:
        bevel(o, bev, 3, angle=30)
    return o


def slab(name, x0, x1, z0, z1, y0, y1, m, bev=0.0):
    return gbx(name, x0, x1, y0, y1, z0, z1, m, bev)


def mesh_from(name, verts, faces, m):
    """A mesh from game-coordinate vertices and faces (index lists)."""
    bm = bmesh.new()
    vs = [bm.verts.new(g(*v)) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    return o


def solidify(o, t):
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = t
    mod.offset = -1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def bamboo_pole(name, x, z, y0, h, r=0.045):
    """An upright bamboo pole with darker joints every 45 cm."""
    out = [cyl(name, r, h, g(x, y0, z), M["bamboo"], 8)]
    y = 0.4
    while y < h - 0.1:
        out.append(cyl(name + "Joint", r * 1.18, 0.035, g(x, y0 + y, z), M["joint"], 8))
        y += 0.45
    return out


def sag_rope(name, a, b, sag, r=0.022, n=6):
    """A rope hanging between two points (game coordinates) with `sag` at its middle: a four-sided tube (cheap: there are many)."""
    bm = bmesh.new()
    rings = []
    d = Vector((b[0] - a[0], 0, b[2] - a[2])).normalized()
    sx, sz = -d.z * r, d.x * r  # (sideways, level)
    for k in range(n + 1):
        t = k / n
        c = Vector((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t))
        rings.append([bm.verts.new(g(c.x + dx, c.y + dy, c.z + dz)) for dx, dy, dz in ((0, r, 0), (sx, 0, sz), (0, -r, 0), (-sx, 0, -sz))])
    for k in range(n):
        for j in range(4):
            bm.faces.new([rings[k][j], rings[k][(j + 1) % 4], rings[k + 1][(j + 1) % 4], rings[k + 1][j]])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in o.data.polygons:
        p.use_smooth = True
    set_mat(o, M["rope"])
    return o


# ---- the ground: boardwalk, coping, gutter, band ------------------------------------------------------------------------------------
RX0, RX1, RZ0, RZ1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]
COP = 0.4
GUT = (0.42, 0.62)
BAND = (0.72, 1.42)
deck = ring("Deck", HX + GUT[1], HZ + GUT[1], 0, 0, -0.3, 0.0, M["deck"], outer=(RX0 - 0.05, RX1 + 0.05, RZ0 - 0.6, RZ1 + 0.05))
parts.append(deck)
parts.append(ring("Band", HX + BAND[0], HZ + BAND[0], HX + BAND[1], HZ + BAND[1], -0.02, 0.004, M["band"]))
parts.append(ring("GutterSlot", HX + GUT[0], HZ + GUT[0], HX + GUT[1], HZ + GUT[1], -0.06, -0.01, M["gutter"]))
bars = []
for sx in (-1, 1):
    x0, x1 = sx * (HX + GUT[0]), sx * (HX + GUT[1])
    z = -HZ - GUT[0]
    while z < HZ + GUT[0]:
        bars.append(gbx("GrateBar", x0, x1, -0.012, -0.002, z, z + 0.035, M["grate"], 0))
        z += 0.12
for sz in (-1, 1):
    z0, z1 = sz * (HZ + GUT[0]), sz * (HZ + GUT[1])
    x = -HX - GUT[1]
    while x < HX + GUT[1]:
        bars.append(gbx("GrateBar", x, x + 0.035, -0.012, -0.002, z0, z1, M["grate"], 0))
        x += 0.12
parts.append(join(bars, "Grate"))
cop = ring("Coping", HX, HZ, HX + COP, HZ + COP, -0.06, 0.045, M["coping"])
bevel(cop, 0.035, 3, angle=30)
parts.append(cop)

# the boardwalk's edge: a fascia board, a dark skirt of boards set back under it, round piles down into the sand
fascia = []
for name, x0, x1, z0, z1 in [
    ("FasciaL", RX0 - 0.1, RX0 - 0.04, RZ0 - 0.6, RZ1 + 0.1),
    ("FasciaR", RX1 + 0.04, RX1 + 0.1, RZ0 - 0.6, RZ1 + 0.1),
    ("FasciaF", RX0 - 0.1, RX1 + 0.1, RZ1 + 0.04, RZ1 + 0.1),
]:
    fascia.append(slab(name, x0, x1, z0, z1, -0.42, 0.02, M["timber_dark"], 0.01))
for name, x0, x1, z0, z1 in [
    ("SkirtL", RX0 + 0.2, RX0 + 0.26, RZ0 - 0.6, RZ1 - 0.2),
    ("SkirtR", RX1 - 0.26, RX1 - 0.2, RZ0 - 0.6, RZ1 - 0.2),
    ("SkirtF", RX0 + 0.2, RX1 - 0.2, RZ1 - 0.26, RZ1 - 0.2),
]:
    fascia.append(slab(name, x0, x1, z0, z1, SAND_Y - 0.1, -0.42, M["teak"]))
piles = []
z = RZ0 - 0.2
while z <= RZ1 + 0.1:
    for x in (RX0 - 0.02, RX1 + 0.02):
        piles.append(cyl("Pile", 0.13, -0.1 - SAND_Y, g(x, SAND_Y - 0.05, z), M["timber_grey"], 10))
    z += 1.8
x = RX0 + 1.6
while x < RX1 - 0.5:
    piles.append(cyl("Pile", 0.13, -0.1 - SAND_Y, g(x, SAND_Y - 0.05, RZ1 + 0.02), M["timber_grey"], 10))
    x += 1.8
# diagonal braces between the piles along the open end and the long sides (in the shade under the boardwalk)
for (a, b) in [((RX0 - 0.02, -15.2), (RX0 - 0.02, 13.3)), ((RX1 + 0.02, -15.2), (RX1 + 0.02, 13.3))]:
    zz = a[1]
    k = 0
    while zz + 1.8 <= b[1]:
        y_lo, y_hi = SAND_Y + 0.25, -0.55
        p0 = (a[0], y_lo if k % 2 else y_hi, zz)
        p1 = (a[0], y_hi if k % 2 else y_lo, zz + 1.8)
        piles.append(tube("Brace", [g(*p0), g(*p1)], 0.04, M["timber_grey"], 1, 6))
        zz += 1.8
        k += 1
parts += fascia
parts.append(join(piles, "Piles"))

# ---- the basin: glass mosaic, the lanes' dark lines and targets, the waterline frieze --------------------------------------------
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
    parts.append(slab(name, x0, x1, z0, z1, -0.42, -0.08, M["band"]))
lines = []
for x in LANES:
    lines.append(slab("LaneLine", x - 0.12, x + 0.12, -6.9, 6.9, FLOOR_Y, FLOOR_Y + 0.008, M["lane"]))
    for z in (-6.9, 6.9):
        lines.append(slab("LaneT", x - 0.55, x + 0.55, z - 0.12, z + 0.12, FLOOR_Y, FLOOR_Y + 0.009, M["lane"]))
    for sz in (-1, 1):
        z = sz * (HZ - 0.008)
        zz = (z - 0.012, z) if sz > 0 else (z, z + 0.012)
        lines.append(slab("Target", x - 0.12, x + 0.12, *zz, FLOOR_Y + 0.3, -0.5, M["lane"]))
        lines.append(slab("TargetT", x - 0.4, x + 0.4, *zz, -0.66, -0.5, M["lane"]))
# a sea turtle in darker tiles on the floor of the shallow end, between lanes 2 and 4 (out of the lanes' lines)
turtle = []
tx, tz = -1.6, -2.6
turtle.append(sphere("TurtleShell", 0.62, g(tx, FLOOR_Y + 0.002, tz), M["lane"], 16, 6, scale=(0.8, 1.0, 0.012)))
for dx, dz, s in [(-0.55, -0.45, 0.22), (0.55, -0.45, 0.22), (-0.45, 0.5, 0.17), (0.45, 0.5, 0.17)]:
    turtle.append(sphere("TurtleFlipper", s, g(tx + dx, FLOOR_Y + 0.002, tz + dz), M["lane"], 10, 4, scale=(1.4, 0.7, 0.012)))
turtle.append(sphere("TurtleHead", 0.16, g(tx, FLOOR_Y + 0.002, tz - 0.82), M["lane"], 10, 4, scale=(0.9, 1.2, 0.012)))
parts.append(join(lines + turtle, "LaneLines"))
uw = []
for sx in (-1, 1):
    for z in (-6, -2, 2, 6):
        uw.append(torus("UWRing", 0.2, 0.03, g(sx * (HX - 0.005), -0.78, z), M["grate"], 20, 6, rot=(0, PI / 2, 0)))
        lens = cyl("UnderwaterLight", 0.17, 0.01, g(sx * (HX - 0.004), -0.78, z), sm("uw_lens", "#e9f5f2", 0.15), 18, rot=(0, PI / 2, 0))
        lens.name = "UnderwaterLight"
        parts.append(lens)
parts.append(join(uw, "UWRings"))


# ---- ladders, starting blocks, bamboo pennant posts --------------------------------------------------------------------------------
def ladder(x, z):
    out = -1 if x < 0 else 1
    rails = []
    for zz in (z - 0.42, z + 0.42):
        rails.append(
            poly_tube(
                "LadderRail",
                [g(x - out * 0.12, -1.0, zz), g(x - out * 0.12, 0.35, zz), g(x + out * 0.18, 0.92, zz), g(x + out * 0.55, 0.62, zz), g(x + out * 0.55, 0.06, zz)],
                0.024,
                M["grate"],
                10,
                0.22,
            )
        )
        rails.append(cyl("LadderFoot", 0.05, 0.02, g(x + out * 0.55, 0.055, zz), M["grate"], 14))
    for y in (-0.88, -0.5, -0.12):
        rails.append(gbx("Rung", x - out * 0.2, x - out * 0.04, y - 0.02, y + 0.02, z - 0.42, z + 0.42, M["grate"], 0.006))
    return join(rails, "Ladder")


parts.append(ladder(-HX, 5.0))
parts.append(ladder(HX, -4.1))
blocks = []
for i, x in enumerate(LANES):
    z = -HZ - 0.85
    blocks.append(gbx("BlockBody", x - 0.3, x + 0.3, 0.04, 0.72, z - 0.32, z + 0.32, M["block"], 0.04))
    blocks.append(gbx("BlockTop", x - 0.34, x + 0.34, 0.72, 0.8, z - 0.38, z + 0.36, M["block_top"], 0.025))
    blocks.append(gbx("BlockGrip", x - 0.36, x + 0.36, 0.42, 0.46, z + 0.3, z + 0.34, M["grate"], 0.01))
    blocks.append(flat_text("BlockNum", str(i + 1), 0.26, M["navy"], g(x, 0.45, z - 0.325), PI, 0.006, "BarlowCondensed-Black"))
parts.append(join(blocks, "Blocks"))
posts = []
for x in (-HX - 1.0, HX + 1.0):
    for z in (-5.7, 5.7):
        posts += bamboo_pole("PennantPost", x, z, 0.0, 3.4, 0.065)
        posts.append(cyl("PostBase", 0.18, 0.08, g(x, 0.0, z), M["timber_dark"], 12))
        posts.append(sphere("PostCap", 0.1, g(x, 3.44, z), M["coral"], 12, 8))
parts.append(join(posts, "PennantPosts"))
depth = []
for x in (-HX - COP / 2, HX + COP / 2):
    for z in (-6.5, 0.0, 6.5):
        depth.append(flat_text("Depth", "1.4 m", 0.16, M["navy"], g(x, 0.047, z), (PI / 2 if x < 0 else -PI / 2), 0.004, "BarlowCondensed-Black", rx=0))
parts.append(join(depth, "DepthMarks"))

# ---- the beach house along the back ------------------------------------------------------------------------------------------------
FZ = FACE_Z
BX0, BX1 = RX0 - 0.4, RX1 + 0.4
EAVE_Y = 3.1  # the walls' top
DEPTH = 6.0
house = []
house.append(slab("HouseBack", BX0, BX1, FZ - DEPTH, FZ - 0.08, -0.3, EAVE_Y, M["weave"]))
# the wall: woven bamboo panels on a dark sill beam, a top beam under the eave
house.append(slab("WallPanel", BX0, BX1, FZ - 0.1, FZ, 0.3, EAVE_Y - 0.25, M["weave"]))
house.append(slab("SillBeam", BX0, BX1, FZ - 0.1, FZ + 0.06, -0.02, 0.32, M["timber_dark"], 0.02))
house.append(slab("TopBeam", BX0, BX1, FZ - 0.1, FZ + 0.12, EAVE_Y - 0.28, EAVE_Y + 0.05, M["timber"], 0.03))
# lashed rails across the panels (a third and two thirds up), in split bamboo
for y in (1.25, 2.15):
    house.append(cyl("WallRail", 0.035, BX1 - BX0, g(BX0, y, FZ + 0.04), M["bamboo"], 8, rot=(0, PI / 2, 0)))
WALL_POSTS = [BX0 + 0.25, -13.2, -8.4, -4.9, 4.9, 8.4, 13.2, BX1 - 0.25]
for x in WALL_POSTS:
    house.append(cyl("WallPost", 0.17, EAVE_Y + 0.15, g(x, -0.02, FZ + 0.08), M["timber_dark"], 12))
    # rope lashings near the top
    for y in (EAVE_Y - 0.55, EAVE_Y - 0.45):
        house.append(torus("Lashing", 0.18, 0.018, g(x, y, FZ + 0.08), M["rope"], 10, 3))


def window(x, y, w, h):
    """A window: a recess with a dark interior that glows warm after dusk, a timber frame, a bamboo blind propped open above it on
    two sticks."""
    out = []
    out.append(slab("WinBack", x - w / 2, x + w / 2, FZ + 0.0, FZ + 0.012, y, y + h, M["interior"]))
    pane = slab("NightGlow_Window", x - w / 2 + 0.03, x + w / 2 - 0.03, FZ + 0.013, FZ + 0.016, y + 0.03, y + h - 0.03, sm("night_window", "#ffc27a", 0.5))
    pane.name = "NightGlow_Window"
    out.append(pane)
    for (x0, x1, y0, y1) in [(x - w / 2 - 0.1, x - w / 2, y - 0.1, y + h + 0.1), (x + w / 2, x + w / 2 + 0.1, y - 0.1, y + h + 0.1), (x - w / 2, x + w / 2, y - 0.1, y), (x - w / 2, x + w / 2, y + h, y + h + 0.1)]:
        out.append(slab("WinFrame", x0, x1, FZ, FZ + 0.1, y0, y1, M["timber"], 0.015))
    out.append(slab("WinSill", x - w / 2 - 0.15, x + w / 2 + 0.15, FZ, FZ + 0.22, y - 0.14, y - 0.06, M["timber_dark"], 0.015))
    # the blind: slats of bamboo hinged at the top, propped out at 35 degrees
    blind = []
    ang = math.radians(35)
    L = h * 0.9
    for k in range(int(w / 0.045)):
        xx = x - w / 2 + 0.02 + k * 0.045
        a = (xx, y + h + 0.08, FZ + 0.1)
        b = (xx, y + h + 0.08 - math.cos(ang) * L, FZ + 0.1 + math.sin(ang) * L)
        blind.append(tube("BlindSlat", [g(*a), g(*b)], 0.018, M["bamboo"] if k % 3 else M["joint"], 1, 3))
    out.append(join(blind, "Blind"))
    for s in (-1, 1):
        xx = x + s * (w / 2 - 0.08)
        out.append(tube("BlindStick", [g(xx, y - 0.06, FZ + 0.18), g(xx, y + h + 0.08 - math.cos(ang) * L + 0.03, FZ + 0.1 + math.sin(ang) * L - 0.02)], 0.015, M["timber_dark"], 1, 5))
    # a hibiscus window box
    out.append(slab("WinBox", x - w / 2, x + w / 2, FZ + 0.06, FZ + 0.34, y - 0.42, y - 0.14, M["teak"], 0.015))
    return out


for x, w_ in ((-6.6, 1.35), (6.6, 1.35), (-15.9, 0.95), (15.9, 0.95)):
    house += window(x, 1.0, w_, 1.2)

# the entrance: carved double doors under the gable, carved tiki posts either side
EW, EH = 2.2, 2.65
house.append(slab("EntranceBack", -EW / 2 - 0.2, EW / 2 + 0.2, FZ, FZ + 0.03, 0, EH + 0.2, M["interior"]))
for s in (-1, 1):
    house.append(slab("EntranceDoor", s * 0.02, s * (EW / 2), 0.02, EH, FZ + 0.03, FZ + 0.09, M["timber_dark"], 0.012))
    for k in range(4):
        y = 0.2 + k * 0.6
        house.append(slab("DoorPanel", s * 0.16, s * (EW / 2 - 0.14), y, y + 0.48, FZ + 0.09, FZ + 0.11, M["timber"], 0.01))
        # carved zigzags across each panel
        for j in range(5):
            xx = s * (0.22 + j * (EW / 2 - 0.4) / 4)
            house.append(gbx("DoorCarve", xx - 0.03, xx + 0.03, y + 0.08, y + 0.4, FZ + 0.11, FZ + 0.12, M["tiki_black"], 0))
    house.append(torus("DoorRing", 0.07, 0.012, g(s * 0.14, 1.2, FZ + 0.13), M["iron"], 14, 4, rot=(PI / 2, 0, 0)))
house.append(slab("Lintel", -EW / 2 - 0.3, EW / 2 + 0.3, FZ, FZ + 0.18, EH, EH + 0.24, M["timber_dark"], 0.02))


def tiki(name, x, z, h, face=0.0, scale=1.0):
    """A carved tiki post: a round log with a big head (brow ridge, eyes, nose, a wide mouth), arms folded over a belly, painted
    red and black in the carving."""
    out = []
    r = 0.22 * scale
    out.append(cyl(name, r, h, g(x, 0.0, z), M["timber"], 14))
    fz = z + (r - 0.01)
    hy = h * 0.72
    # brow, eyes, nose, mouth
    out.append(gbx(name + "Brow", x - r * 0.95, x + r * 0.95, hy + 0.2 * scale, hy + 0.28 * scale, fz - 0.02, fz + 0.08, M["timber_dark"], 0.02))
    for s in (-1, 1):
        out.append(sphere(name + "Eye", 0.07 * scale, g(x + s * 0.09 * scale, hy + 0.12 * scale, fz + 0.02), M["cream"], 10, 6, scale=(1, 1, 0.5)))
        out.append(sphere(name + "Pupil", 0.035 * scale, g(x + s * 0.09 * scale, hy + 0.12 * scale, fz + 0.055), M["tiki_black"], 8, 4, scale=(1, 1, 0.5)))
    out.append(gbx(name + "Nose", x - 0.06 * scale, x + 0.06 * scale, hy - 0.06 * scale, hy + 0.1 * scale, fz, fz + 0.09, M["timber_dark"], 0.02))
    out.append(gbx(name + "Mouth", x - r * 0.8, x + r * 0.8, hy - 0.26 * scale, hy - 0.12 * scale, fz - 0.01, fz + 0.05, M["tiki_red"], 0.02))
    for k in range(5):
        xx = x - r * 0.6 + k * r * 0.3
        out.append(gbx(name + "Tooth", xx - 0.02, xx + 0.02, hy - 0.24 * scale, hy - 0.14 * scale, fz + 0.04, fz + 0.06, M["cream"], 0))
    # arms over the belly, bands of carving
    out.append(torus(name + "Arms", r * 0.75, 0.035 * scale, g(x, h * 0.42, fz - r * 0.55), M["timber_dark"], 16, 5, rot=(PI / 2, 0, 0)))
    for y in (h * 0.12, h * 0.2, h * 0.94):
        out.append(cyl(name + "Band", r * 1.06, 0.06, g(x, y, z), M["tiki_black"], 14))
    out.append(cyl(name + "Crown", r * 1.15, 0.12, g(x, h, z), M["tiki_red"], 14, r2=r * 0.6))
    return out


for s in (-1, 1):
    house += tiki("EntranceTiki", s * (EW / 2 + 0.55), FZ + 0.12, 2.9)

# paper lanterns along the eave (each a Light_Paper the game lights after dusk), on cords from the eave beam
for x in (-14.4, -11.9, -9.5, -7.1, 7.1, 9.5, 11.9, 14.4):
    house.append(cyl("LanternCord", 0.006, 0.42, g(x, EAVE_Y + 0.38, FZ + 1.25), M["rope"], 4))
    lt = sphere("Light_Paper", 0.22, g(x, EAVE_Y + 0.15, FZ + 1.25), M["lamp"], 12, 8, scale=(1, 1, 1.25))
    house.append(lt)
    house.append(cyl("LanternRim", 0.12, 0.04, g(x, EAVE_Y + 0.4, FZ + 1.25), M["timber_dark"], 10))
    house.append(cyl("LanternRim", 0.12, 0.04, g(x, EAVE_Y - 0.13, FZ + 1.25), M["timber_dark"], 10))
# tiki masks on the wall posts, surfboards and a paddle against the wall at the ends
for x in (-13.2, -8.4, 8.4, 13.2):
    house.append(sphere("Mask", 0.26, g(x, 2.1, FZ + 0.22), M["timber"], 14, 8, scale=(0.8, 0.35, 1.1)))
    for s in (-1, 1):
        house.append(sphere("MaskEye", 0.06, g(x + s * 0.08, 2.22, FZ + 0.3), M["cream"], 8, 6, scale=(1, 0.5, 1)))
    house.append(gbx("MaskMouth", x - 0.12, x + 0.12, 1.9, 1.98, FZ + 0.27, FZ + 0.32, M["tiki_red"], 0.01))
    house.append(gbx("MaskBrow", x - 0.17, x + 0.17, 2.3, 2.36, FZ + 0.26, FZ + 0.33, M["tiki_black"], 0.01))
BOARD_COLS = [M["coral"], M["teal"], M["sun"], M["cream"], M["teal"], M["coral"]]
for i, x in enumerate([-13.75, -14.2, 13.75, 14.2, 14.65, -14.65]):
    b = sphere("Surfboard", 1.0, (0, 0, 0), BOARD_COLS[i], 16, 8, scale=(0.27, 0.06, 1.05))
    b.location = g(x, 1.1, FZ + 0.42)
    b.rotation_euler = (math.radians(-12), math.radians(R.uniform(-4, 4)), 0)
    apply_all(b)
    house.append(b)
    house.append(gbx("SurfStripe", x - 0.025, x + 0.025, 0.25, 2.0, FZ + 0.3, FZ + 0.48, M["cream"], 0))
parts += house

# ---- the roof: thatch, hipped at both ends, a deep overhang over the deck ------------------------------------------------------
RO = 1.45  # the overhang past the wall
Y0, YR = EAVE_Y - 0.05, 8.0  # the eave, the ridge
ZF, ZR, ZB = FZ + RO, FZ - 2.8, FZ - DEPTH - 0.6  # the eave's line, the ridge's, the back eave's
XE0, XE1 = BX0 - 0.7, BX1 + 0.7
RUN = ZF - ZR
XR0, XR1 = XE0 + RUN, XE1 - RUN
roof_v = [
    (XE0, Y0, ZF), (XE1, Y0, ZF), (XR1, YR, ZR), (XR0, YR, ZR),  # the front slope
    (XE0, Y0 - 0.2, ZB), (XE1, Y0 - 0.2, ZB),  # the back eave
]
roof = mesh_from("Roof", roof_v, [[0, 1, 2, 3], [3, 2, 5, 4], [0, 3, 4], [1, 5, 2]], M["thatch"])
solidify(roof, 0.32)
parts.append(roof)
# the ridge: a thick roll of thatch bound with rope every metre
ridge = cyl("Ridge", 0.32, XR1 - XR0 + 0.6, g(XR0 - 0.3, YR + 0.12, ZR), M["thatch_dry"], 12, rot=(0, PI / 2, 0))
parts.append(ridge)
for x in [XR0 + k * 1.2 for k in range(int((XR1 - XR0) / 1.2) + 1)]:
    parts.append(torus("RidgeBind", 0.34, 0.025, g(x, YR + 0.12, ZR), M["rope"], 10, 3, rot=(0, PI / 2, 0)))
# the eave's fringe: straw hanging in a ragged edge along the front
fr_v, fr_f = [], []
x = XE0 + 0.1
k = 0
while x < XE1 - 0.1:
    d = 0.32 + 0.18 * math.sin(k * 1.7) ** 2 + R.uniform(0, 0.12)
    i = len(fr_v)
    fr_v += [(x, Y0 + 0.05, ZF + 0.02), (x + 0.16, Y0 + 0.05, ZF + 0.02), (x + 0.08, Y0 - d, ZF + 0.06)]
    fr_f.append([i, i + 1, i + 2])
    x += 0.12
    k += 1
parts.append(mesh_from("Fringe", fr_v, fr_f, M["thatch_dry"]))
# rafter tails under the overhang, and brackets at the posts holding it out
for x in WALL_POSTS:
    parts.append(tube("Bracket", [g(x, EAVE_Y - 0.6, FZ + 0.1), g(x, Y0 + 0.02, FZ + 1.1)], 0.07, M["timber_dark"], 1, 8))
xx = XE0 + 0.4
while xx < XE1 - 0.3:
    parts.append(tube("Rafter", [g(xx, Y0 + 0.1, ZF - 0.05), g(xx, Y0 + 0.75, ZF - 0.9)], 0.045, M["bamboo"], 1, 6))
    xx += 0.9

# the tall gable over the entrance: its own steep roof along z, a lattice gable face, crossed horns at the apex
GX, GY0, GY1 = 3.9, 3.3, 10.2
GZF, GZB = FZ + 2.0, FZ - 4.2
gable_v = [(-GX - 0.4, GY0, GZF), (0, GY1, GZF), (0, GY1, GZB), (-GX - 0.4, GY0, GZB), (GX + 0.4, GY0, GZF), (GX + 0.4, GY0, GZB)]
groof = mesh_from("GableRoof", gable_v, [[0, 1, 2, 3], [1, 4, 5, 2]], M["thatch"])
solidify(groof, 0.34)
parts.append(groof)
face_z = GZF - 0.55
parts.append(mesh_from("GableFace", [(-GX + 0.15, GY0 + 0.05, face_z), (GX - 0.15, GY0 + 0.05, face_z), (0, GY1 - 0.6, face_z)], [[0, 1, 2]], M["weave"]))
for s in (-1, 1):
    # bargeboards along the rafters, and the horns crossing over the apex
    a = g(s * (GX + 0.3), GY0 - 0.1, GZF + 0.08)
    b = g(-s * 0.9, GY1 + 1.05, GZF + 0.08)
    parts.append(tube("Bargeboard", [a, b], 0.1, M["timber_dark"], 1, 8))
    parts.append(cyl("HornTip", 0.07, 0.35, b, M["tiki_red"], 8))
parts.append(cyl("GableRidge", 0.34, GZF - GZB, g(0, GY1 + 0.08, GZB), M["thatch_dry"], 12, rot=(PI / 2, 0, 0)))
# the gable's posts down the face of the wall and its fringe
gfr_v, gfr_f = [], []
for s in (-1, 1):
    for k in range(40):
        t = k / 40
        x0 = s * (GX + 0.4) * (1 - t)
        y0 = GY0 + (GY1 - GY0) * t
        i = len(gfr_v)
        d = 0.28 + R.uniform(0, 0.12)
        gfr_v += [(x0, y0, GZF + 0.02), (x0 - s * 0.1, y0 + 0.16, GZF + 0.02), (x0 - s * 0.03, y0 - d, GZF + 0.06)]
        gfr_f.append([i, i + 1, i + 2])
parts.append(mesh_from("GableFringe", gfr_v, gfr_f, M["thatch_dry"]))
# the SUNSET LAGOON board hung across the gable's foot, two big lanterns either side of it
SW_, SH_ = 5.6, 1.4
parts.append(slab("SignBack", -SW_ / 2 - 0.12, SW_ / 2 + 0.12, face_z - 0.02, face_z + 0.06, GY0 + 0.25, GY0 + 0.25 + SH_ + 0.2, M["timber_dark"], 0.03))
parts.append(plane("SignPanel", SW_, SH_, g(0, GY0 + 0.35 + SH_ / 2, face_z + 0.065), signmat("sunset_lagoon", 0.5), rot=(PI / 2, 0, 0)))
for s in (-1, 1):
    x = s * (SW_ / 2 + 0.75)
    parts.append(cyl("BigLanternCord", 0.008, 0.6, g(x, GY0 + 1.25, face_z + 0.4), M["rope"], 4))
    parts.append(sphere("Light_Paper", 0.32, g(x, GY0 + 0.95, face_z + 0.4), M["lamp"], 14, 8, scale=(1, 1, 1.3)))
    parts.append(cyl("BigLanternRim", 0.16, 0.05, g(x, GY0 + 1.33, face_z + 0.4), M["timber_dark"], 10))

# ---- rope railings on timber posts, tiki torches on some -----------------------------------------------------------------------
rail = []
TORCH_POSTS = set()
TORCHES = []


def post(x, z, h=1.05):
    rail.append(cyl("RailPost", 0.075, h, g(x, 0.0, z), M["timber"], 7))
    rail.append(cyl("RailPostCap", 0.085, 0.07, g(x, h, z), M["timber_dark"], 7, r2=0.03))


def torch(x, z, h=2.15):
    """A tiki torch: a bamboo pole, a woven cup at its top, a flame (`Light_Torch`: its glow and its light after dusk)."""
    rail.extend(bamboo_pole("TorchPole", x, z, 0.0, h, 0.04))
    rail.append(cyl("TorchCup", 0.11, 0.26, g(x, h - 0.02, z), M["thatch_dry"], 10, r2=0.07))
    rail.append(torus("TorchBind", 0.1, 0.012, g(x, h + 0.12, z), M["rope"], 12, 4))
    # (each flame its own object, kept out of the railings' join: the exporter reads every Light_* object's centre)
    TORCHES.append(cyl("Light_Torch", 0.08, 0.32, g(x, h + 0.22, z), M["flame"], 8, r2=0.0))


def rope_run(points, y_top=1.0, y_mid=0.6):
    for a, b in zip(points[:-1], points[1:]):
        for y, sag in ((y_top, 0.08), (y_mid, 0.06)):
            rail.append(sag_rope("Rope", (a[0], y, a[1]), (b[0], y, b[1]), sag))


# the long sides (the ring boards, the fish net's and the skimmer's stand on their own posts: props_stations)
for side, x in ((-1, RAIL_X[0]), (1, RAIL_X[1])):
    z_end = 9.9 if side > 0 else RZ1 - 0.15  # (the fuse box's post closes the right-hand side)
    zs = [DECK["z0"] - 0.6 + 0.25]
    while zs[-1] + 1.8 < z_end:
        zs.append(zs[-1] + 1.8)
    zs.append(z_end)
    for z in zs:
        post(x, z)
    rope_run([(x, z) for z in zs])
    for z in ((-13.0, -9.2, 10.6) if side < 0 else (-13.0, -9.6, 2.6, 7.4)):
        torch(x + side * 0.22, z)
# the open end: posts and ropes either side of the steps down to the beach
STEP_X = 2.6  # the steps' half width
for x0_, x1_ in ((RX0 + 0.15, -STEP_X - 0.2), (STEP_X + 0.2, RX1 - 0.15)):
    xs = [x0_]
    while xs[-1] + 1.8 < x1_:
        xs.append(xs[-1] + 1.8)
    xs.append(x1_)
    for x in xs:
        post(x, RZ1 - 0.12)
    rope_run([(x, RZ1 - 0.12) for x in xs])
for x in (-12.0, -7.6, 7.2):
    torch(x, RZ1 + 0.12)
for s in (-1, 1):
    torch(s * (STEP_X + 0.35), RZ1 + 0.12, 2.4)
parts.append(join(rail, "Railings"))
parts += TORCHES
# the fuse box's post (props.mjs fuseBox: its back at x 17.17), a timber pier with a little thatch hat
parts.append(slab("FusePost", 17.17, 17.6, 10.55, 11.85, 0, 2.7, M["timber"], 0.03))
parts.append(slab("FusePostSill", 17.12, 17.65, 10.5, 11.9, 0, 0.25, M["timber_dark"], 0.02))
hat = cyl("FuseHat", 0.95, 0.6, g(17.4, 2.7, 11.2), M["thatch_dry"], 8, r2=0.05)
parts.append(hat)

# the steps down to the beach at the open end, with rope handrails on bamboo posts
steps = []
NST = 11
for k in range(NST):
    y_top = -(k + 1) * (-SAND_Y / NST)
    z0 = RZ1 + 0.1 + k * 0.3
    steps.append(slab("Step", -STEP_X, STEP_X, z0, z0 + 0.34, y_top - 0.06, y_top + 0.0, M["teak"], 0.01))
    steps.append(slab("Riser", -STEP_X + 0.05, STEP_X - 0.05, z0, z0 + 0.03, y_top, y_top + (-SAND_Y / NST), M["timber_dark"]))
for s in (-1, 1):
    steps.append(slab("Stringer", s * STEP_X - 0.07, s * STEP_X + 0.07, RZ1 + 0.1, RZ1 + 0.1 + NST * 0.3 + 0.1, SAND_Y, 0.0, M["timber_dark"], 0.01))
    top_ = (s * (STEP_X + 0.05), 0.95, RZ1 + 0.1)
    bot_ = (s * (STEP_X + 0.05), SAND_Y + 0.95, RZ1 + 0.1 + NST * 0.3)
    steps += bamboo_pole("StepPost", bot_[0], bot_[2], SAND_Y, 1.05, 0.05)
    steps.append(sag_rope("StepRope", top_, bot_, 0.12, 0.025))
parts.append(join(steps, "Steps"))

# ---- the beach: sand from the game's shore to the fog, low dunes everywhere but the sea side -------------------------------------
GX0, GX1, GZ0, GZ1 = SHORE_X, 110.0, -110.0, 110.0
CELL = 3.2


nx, nz = int((GX1 - GX0) / CELL), int((GZ1 - GZ0) / CELL)
gv, gf = [], []
for i in range(nx + 1):
    for j in range(nz + 1):
        x, z = GX0 + i * CELL, GZ0 + j * CELL
        gv.append((x, SAND_Y + dune_h(x, z) - (0.01 if x < SHORE_X + 1 else 0), z))
for i in range(nx):
    for j in range(nz):
        a = i * (nz + 1) + j
        gf.append([a, a + nz + 1, a + nz + 2, a + 1])
sand = mesh_from("Beach", gv, gf, M["sand"])
for p in sand.data.polygons:
    p.use_smooth = True
parts.append(sand)

# ---- what is painted on the deck (baked by the exporter into the floor's picture) ---------------------------------------------------
floor = []
floor.append(plane("SplashZonePaint", 4.6, 1.15, g(12.35, 0.006, -9.4), signmat("splash_zone", 0.6), rot=(0, 0, PI / 2)))
for i, x in enumerate(LANES):
    floor.append(flat_text("LaneNumber", "%02d" % (i + 1), 0.42, sm("deck_paint_white", "#f7f3e8", 0.6), g(x, 0.006, -HZ - 1.65), PI, 0.002, "BarlowCondensed-Black", rx=0))
floor.append(flat_text("NoRunning", "NO RUNNING", 0.5, M["coral"], g(0, 0.006, HZ + 2.35), 0, 0.002, "BarlowCondensed-Black", rx=0))

print("TORCHES", len(TORCHES))
if LOOK:
    look("shell_overview", g(0, 0, -2), 40, 46, -90, (1280, 720), 16, 30)
    look("shell_house", g(0, 4, -16), 18, 12, 0, (1280, 720), 20, 30)
    look("shell_corner", g(12, 1, -12), 10, 22, 40, (1100, 700), 20, 30)
    look("shell_steps", g(0, -1, 14), 12, 18, 160, (1100, 700), 20, 30)
save_part("shell", parts)
save_part("floor", floor)
