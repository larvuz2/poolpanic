"""Splash Park's ground and building, modelled in place in game coordinates: the travertine deck on its sandstone plinth, the
pool's glass-mosaic basin with its bullnose coping, gutter, blue band and waterline frieze, the ladders, starting blocks and
pennant posts; the two-storey hotel along the back (stucco, arched windows with teal shutters, iron balconies, a terracotta
roof, the hand-painted SPLASH PARK sign over the entrance); the low walls with glass on the long sides, punctuated by stucco
piers with lanterns (one carries the fuse box, two the life rings, one the fish net); the clipped hedge across the open end.

Writes WORK/parts/shell.glb (and floor.glb: what is painted on the deck, baked by the exporter into the floor's picture).

    blender -b -P tools/venues/splash/shell.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(7)
LOOK = "--look" in args()

M = dict(
    deck=tmat_tile("travertine", "#e8d5b4", 0.6),
    band=tmat_tile("mosaic_band", "#2f7fc4", 0.2),
    basin=tmat_tile("glass_mosaic", "#7fd3d6", 0.15),
    stucco=tmat_tile("stucco", "#f6ecda", 0.88),
    cobble=tmat_tile("cobble", "#d6bf98", 0.85),
    hedge=tmat_tile("hedge", "#3c7a38", 0.8),
    teak=tmat_tile("teak", "#b77b45", 0.5),
    coping=sm("limestone"),
    lane=sm("lane_tile", "#1f4f8a", 0.25),
    gutter=sm("gutter_dark", "#3d4a4f", 0.6),
    grate=sm("stainless"),
    white=sm("whitewash"),
    trim=sm("stucco_warm"),
    shutter=sm("teal"),
    shutter_dark=sm("teal_dark"),
    interior=sm("window_dark", "#2c3b40", 0.35),
    curtain=sm("curtain", "#f3e2c4", 0.9),
    iron=sm("iron"),
    roof=sm("terracotta"),
    roof_dark=sm("terracotta_dark"),
    roof_light=sm("terracotta_light", "#d7774c", 0.7),
    timber_door=sm("teak_dark"),
    brass=sm("brass"),
    glass=sm("glass_balustrade", "#d6eef2", 0.05, alpha=0.25),
    lamp=lamp_mat("lantern_glass", "#ffe2a8", 4.0),
    block=sm("white_gloss"),
    block_top=sm("block_top", "#2f7fc4", 0.6),
    sun=sm("sun"),
    coral=sm("coral"),
    pot=sm("clay_pot"),
    soil=sm("soil"),
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


# ---- the ground: deck, plinth, coping, gutter, band ------------------------------------------------------------------------------
RX0, RX1, RZ0, RZ1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]
COP = 0.4  # coping width
GUT = (0.42, 0.62)  # the gutter's slot, out from the basin's edge
BAND = (0.72, 1.42)  # the mosaic band (pool.mjs poolSurround)
# the deck: travertine from the gutter out to the plinth's edge (the hole a little smaller than the band, which lies on it)
# (built with its real outline from the start: a ring whose outer edge starts inside its hole turns inside out)
deck = ring("Deck", HX + GUT[1], HZ + GUT[1], 0, 0, -0.3, 0.0, M["deck"], outer=(RX0 - 0.05, RX1 + 0.05, RZ0 - 0.6, RZ1 + 0.05))
parts.append(deck)
parts.append(ring("Band", HX + BAND[0], HZ + BAND[0], HX + BAND[1], HZ + BAND[1], -0.02, 0.004, M["band"]))
# the gutter: a dark slot with a stainless grate over it (bars every 12 cm along the long sides, every 12 cm across the ends)
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
# the coping: bullnose limestone, a little proud of the deck, its inner edge rounded over the water
cop = ring("Coping", HX, HZ, HX + COP, HZ + COP, -0.06, 0.045, M["coping"])
bevel(cop, 0.035, 3, angle=30)
parts.append(cop)
# the plinth: the deck stands on a sandstone base above the lawn, a limestone lip along its top
LAWN_Y = -1.95
for name, x0, x1, z0, z1 in [
    ("PlinthL", RX0 - 0.05, RX0 + 0.25, RZ0 - 0.6, RZ1 + 0.05),
    ("PlinthR", RX1 - 0.25, RX1 + 0.05, RZ0 - 0.6, RZ1 + 0.05),
    ("PlinthF", RX0 - 0.05, RX1 + 0.05, RZ1 - 0.25, RZ1 + 0.05),
]:
    parts.append(slab(name, x0, x1, z0, z1, LAWN_Y, -0.08, M["cobble"]))
for name, x0, x1, z0, z1 in [
    ("LipL", RX0 - 0.12, RX0 + 0.2, RZ0 - 0.6, RZ1 + 0.12),
    ("LipR", RX1 - 0.2, RX1 + 0.12, RZ0 - 0.6, RZ1 + 0.12),
    ("LipF", RX0 - 0.12, RX1 + 0.12, RZ1 - 0.2, RZ1 + 0.12),
]:
    parts.append(slab(name, x0, x1, z0, z1, -0.12, 0.012, M["coping"], 0.02))

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
# the frieze at the waterline: the band's blue mosaic, 25 cm, just under the coping
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
parts.append(join(lines, "LaneLines"))
# the underwater lights' rings (the game puts its lit lenses in them after dusk: pool.mjs)
uw = []
for sx in (-1, 1):
    for z in (-6, -2, 2, 6):
        r_ = torus("UWRing", 0.2, 0.03, g(sx * (HX - 0.005), -0.78, z), M["grate"], 20, 6, rot=(0, PI / 2, 0))
        uw.append(r_)
        lens = cyl("UnderwaterLight", 0.17, 0.01, g(sx * (HX - 0.004), -0.78, z), sm("uw_lens", "#e9f5f2", 0.15), 18, rot=(0, PI / 2, 0))
        lens.name = "UnderwaterLight"
        parts.append(lens)
parts.append(join(uw, "UWRings"))


# ---- ladders (pool.mjs's spots), starting blocks, pennant posts ---------------------------------------------------------------
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
    blocks.append(flat_text("BlockNum", str(i + 1), 0.26, sm("navy"), g(x, 0.45, z - 0.325), PI, 0.006, "BarlowCondensed-Black"))
parts.append(join(blocks, "Blocks"))
posts = []
for x in (-HX - 1.0, HX + 1.0):
    for z in (-5.7, 5.7):
        posts.append(cyl("PennantPost", 0.07, 3.4, g(x, 0.0, z), M["white"], 14, r2=0.055))
        posts.append(cyl("PostBase", 0.2, 0.06, g(x, 0.03, z), M["grate"], 18, bev=0.01))
        posts.append(sphere("PostCap", 0.1, g(x, 3.42, z), M["sun"], 12, 8))
parts.append(join(posts, "PennantPosts"))
# the depth on the coping, both long sides, at both ends and in the middle
depth = []
for x in (-HX - COP / 2, HX + COP / 2):
    for z in (-6.5, 0.0, 6.5):
        depth.append(flat_text("Depth", "1.4 m", 0.16, sm("navy"), g(x, 0.047, z), (PI / 2 if x < 0 else -PI / 2), 0.004, "BarlowCondensed-Black", rx=0))

parts.append(join(depth, "DepthMarks"))

# ---- the hotel along the back ---------------------------------------------------------------------------------------------------
FZ = -16.12  # the facade's face
BX0, BX1 = RX0 - 0.3, RX1 + 0.3
G1, G2, EAVE = 4.2, 4.38, 7.45  # the ground floor's top, the string course, the eaves
DEPTH = 4.0  # how deep the building is (only its front shows)
hotel = []
hotel.append(slab("HotelWall", BX0, BX1, FZ - DEPTH, FZ, -0.3, EAVE, M["stucco"]))
# a plinth course of sandstone along its foot and a string course between the storeys
hotel.append(slab("HotelSocle", BX0, BX1, FZ, FZ + 0.06, -0.02, 0.45, M["cobble"], 0.01))
hotel.append(slab("StringCourse", BX0, BX1, FZ, FZ + 0.12, G1, G2, M["trim"], 0.02))
hotel.append(slab("Cornice", BX0, BX1, FZ, FZ + 0.22, EAVE - 0.22, EAVE, M["trim"], 0.03))
hotel.append(slab("Cornice2", BX0, BX1, FZ, FZ + 0.32, EAVE, EAVE + 0.1, M["white"], 0.02))
# corner pilasters and the side returns (the building's ends, past the low walls)
for x in (BX0 + 0.3, BX1 - 0.3):
    hotel.append(slab("Pilaster", x - 0.3, x + 0.3, FZ, FZ + 0.1, 0.45, EAVE - 0.22, M["trim"], 0.02))


def arch_shape(w, h, n=14):
    """A round-headed opening's outline, w wide, h to the crown (2D, x across, y up, origin at the sill's middle)."""
    r = w / 2
    pts = [(-r, 0), (r, 0), (r, h - r)]
    for k in range(1, n):
        a = k * math.pi / n
        pts.append((r * math.cos(a), h - r + r * math.sin(a)))
    pts.append((-r, h - r))
    return pts


def arch_frame(name, w, h, frame, depth_, loc, m):
    """The frame round a round-headed opening: a band `frame` wide outside the opening's outline (no sill side), extruded
    `depth_` toward the deck."""
    inner = arch_shape(w, h)
    outer = arch_shape(w + frame * 2, h + frame)
    outer[0], outer[1] = (-w / 2 - frame, 0), (w / 2 + frame, 0)
    bm = bmesh.new()
    vi = [bm.verts.new((x, y, 0)) for x, y in inner]
    vo = [bm.verts.new((x, y, 0)) for x, y in outer]
    n = len(inner)
    for i in range(1, n):  # (from the right-hand jamb round to the left; the sill edge 0-1 stays open)
        j = (i + 1) % n
        if i == n - 1:
            j = 0
        bm.faces.new([vi[i], vi[j], vo[j], vo[i]])
    r = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    top = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, depth_), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (PI / 2, 0, 0)
    o.location = loc
    set_mat(o, m)
    return o


def opening(name, x, y, w, h, depth_=0.16, frame=0.09, sill=True, glow=True, interior=None):
    """A round-headed window in the facade: a recess with a dark interior and drawn curtains, a white frame and keystone, a sill;
    a pane that glows warm after dusk (NightGlow)."""
    out = []
    out.append(arch_frame(name + "Frame", w, h, frame, 0.07, g(x, y, FZ), M["white"]))
    back = extrude_shape(name + "Back", arch_shape(w, h), 0.01, g(x, y, FZ), interior or M["interior"], rot=(PI / 2, 0, 0))
    out.append(back)
    # curtains drawn to each side inside
    for s in (-1, 1):
        out.append(gbx(name + "Curtain", x + s * (w / 2 - 0.01), x + s * (w / 2 - 0.24), y + 0.04, y + h - w * 0.32, FZ + 0.01, FZ + 0.035, M["curtain"], 0.015))
    # the glazing bars
    out.append(gbx(name + "Mullion", x - 0.018, x + 0.018, y, y + h - 0.02, FZ + 0.03, FZ + 0.05, M["white"], 0))
    out.append(gbx(name + "Transom", x - w / 2, x + w / 2, y + h * 0.55, y + h * 0.55 + 0.036, FZ + 0.03, FZ + 0.05, M["white"], 0))
    if sill:
        out.append(gbx(name + "Sill", x - w / 2 - 0.16, x + w / 2 + 0.16, y - 0.09, y, FZ, FZ + 0.16, M["trim"], 0.015))
    out.append(gbx(name + "Key", x - 0.08, x + 0.08, y + h + frame - 0.06, y + h + frame + 0.14, FZ + 0.05, FZ + 0.1, M["trim"], 0.01))
    if glow:
        pane = extrude_shape("NightGlow_" + name, arch_shape(w - 0.04, h - 0.03), 0.002, g(x, y + 0.015, FZ + 0.012), sm("night_window", "#ffcf8a", 0.5), rot=(PI / 2, 0, 0))
        out.append(pane)
    return out


def shutters(x, y, w, h, open_=True):
    """Teal louvred shutters folded back against the wall either side of an opening."""
    out = []
    sw = w / 2 + 0.04
    for s in (-1, 1):
        x0 = x + s * (w / 2 + 0.1)
        x1 = x0 + s * sw
        out.append(gbx("ShutterFrame", x0, x1, y, y + h - 0.08, FZ + 0.02, FZ + 0.06, M["shutter"], 0.01))
        n = int((h - 0.2) / 0.1)
        for k in range(n):
            yy = y + 0.1 + k * 0.1
            sl = gbx("Louvre", x0 + s * 0.05, x1 - s * 0.05, yy, yy + 0.05, FZ + 0.055, FZ + 0.085, M["shutter_dark"], 0)
            out.append(sl)
    return out


def balcony(x, w):
    """A shallow balcony on stone brackets with a wrought-iron rail."""
    out = []
    y0 = G2
    out.append(gbx("BalconySlab", x - w / 2, x + w / 2, y0 - 0.12, y0, FZ, FZ + 0.62, M["trim"], 0.02))
    for s in (-1, 1):
        out.append(gbx("Bracket", x + s * (w / 2 - 0.2) - 0.08, x + s * (w / 2 - 0.2) + 0.08, y0 - 0.42, y0 - 0.12, FZ, FZ + 0.5, M["trim"], 0.02))
    rail_y = y0 + 1.0
    zf = FZ + 0.58
    out.append(gbx("RailTop", x - w / 2 + 0.04, x + w / 2 - 0.04, rail_y - 0.03, rail_y + 0.02, zf - 0.03, zf + 0.03, M["iron"], 0.01))
    out.append(gbx("RailBottom", x - w / 2 + 0.04, x + w / 2 - 0.04, y0 + 0.08, y0 + 0.11, zf - 0.02, zf + 0.02, M["iron"], 0))
    for s in (-1, 1):
        out.append(gbx("RailSide", x + s * (w / 2 - 0.06) - 0.02, x + s * (w / 2 - 0.06) + 0.02, rail_y - 0.03, rail_y, FZ, zf, M["iron"], 0))
        out.append(gbx("RailSideBot", x + s * (w / 2 - 0.06) - 0.015, x + s * (w / 2 - 0.06) + 0.015, y0, rail_y, zf - 0.015, zf + 0.015, M["iron"], 0))
    k = x - w / 2 + 0.16
    i = 0
    while k < x + w / 2 - 0.1:
        out.append(gbx("Baluster", k - 0.012, k + 0.012, y0 + 0.08, rail_y, zf - 0.012, zf + 0.012, M["iron"], 0))
        if i % 3 == 1:  # a scroll between
            out.append(torus("Scroll", 0.07, 0.01, g(k + 0.06, y0 + 0.55, zf), M["iron"], 12, 4, rot=(PI / 2, 0, 0)))
        k += 0.12
        i += 1
    # a pot of geraniums on each balcony's corner
    out.append(cyl("BalconyPot", 0.13, 0.22, g(x + w / 2 - 0.3, y0 + 0.11, FZ + 0.32), M["pot"], 14, r2=0.1))
    for j in range(5):
        out.append(sphere("Geranium", 0.09, g(x + w / 2 - 0.3 + R.uniform(-0.1, 0.1), y0 + 0.3 + R.uniform(0, 0.08), FZ + 0.32 + R.uniform(-0.08, 0.08)), sm("coral") if j % 2 else sm("leaf"), 8, 6))
    return out


# ground floor: the entrance in the middle, windows either side, more windows over the cabanas' roofs
GW, GH = 1.25, 2.15  # a ground-floor window
UW, UH = 1.05, 1.85  # an upper window
for x in (-6.2, 6.2, -14.4, 14.4):  # (the two by the corners where the cabanas stood, before 31 October 2026)
    hotel += opening("GroundWin", x, 1.05, GW, GH)
    hotel += shutters(x, 1.05, GW, GH)
for x in (-12.0, -7.2, -4.0, 4.0, 7.2, 12.0):
    hotel += opening("UpperWin", x, G2 + 0.28, UW, UH, sill=False)
    hotel += shutters(x, G2 + 0.28, UW, UH)
for x in (-7.2, 7.2):
    hotel += balcony(x, 2.3)
for x in (-15.0, 15.4):
    hotel += opening("UpperWinEnd", x, G2 + 0.28, 0.85, UH, sill=True)
# the entrance: a deep round arch with panelled timber doors (shut: the guests come through the cabanas), a fanlight, lanterns
EW, EH = 2.3, 3.05
hotel.append(arch_frame("EntranceSurround", EW, EH, 0.26, 0.12, g(0, 0, FZ), M["coping"]))
hotel.append(extrude_shape("EntranceReveal", arch_shape(EW, EH), 0.02, g(0, 0, FZ), sm("reveal_shadow", "#c9b89a", 0.9), rot=(PI / 2, 0, 0)))
for s in (-1, 1):
    hotel.append(gbx("EntranceDoor", s * 0.02, s * (EW / 2 - 0.02), 0.02, EH - EW / 2 - 0.02, FZ + 0.02, FZ + 0.07, M["timber_door"], 0.012))
    for k in range(3):
        y = 0.25 + k * 0.58
        hotel.append(gbx("DoorPanel", s * 0.14, s * (EW / 2 - 0.16), y, y + 0.46, FZ + 0.07, FZ + 0.09, sm("teak"), 0.01))
    hotel.append(cyl("DoorRing", 0.05, 0.02, g(s * 0.12, 1.15, FZ + 0.1), M["brass"], 14, rot=(PI / 2, 0, 0)))
hotel.append(extrude_shape("NightGlow_Fanlight", arch_shape(EW - 0.08, EW / 2, 12)[2:], 0.002, g(0, EH - EW / 2, FZ + 0.025), sm("night_window"), rot=(PI / 2, 0, 0)))
hotel.append(extrude_shape("Fanlight", arch_shape(EW - 0.04, EW / 2, 12)[2:], 0.01, g(0, EH - EW / 2, FZ + 0.012), M["interior"], rot=(PI / 2, 0, 0)))
hotel.append(gbx("FanSill", -EW / 2, EW / 2, EH - EW / 2 - 0.03, EH - EW / 2 + 0.03, FZ, FZ + 0.08, M["white"], 0))
for k in range(5):
    a = (k + 1) * math.pi / 6
    c = (0, EH - EW / 2 + 0.02)
    rr = EW / 2 - 0.1
    hotel.append(tube("FanBar", [g(c[0], c[1], FZ + 0.04), g(c[0] + math.cos(a) * rr, c[1] + math.sin(a) * rr, FZ + 0.04)], 0.014, M["white"], 1, 4))
# the sign over the entrance, in a white frame, on the string course
SW_, SH_ = 4.8, 1.05
hotel.append(gbx("SignFrame", -SW_ / 2 - 0.08, SW_ / 2 + 0.08, G2 + 0.12, G2 + 0.12 + SH_ + 0.16, FZ, FZ + 0.08, M["white"], 0.02))
sign = plane("SignPanel", SW_, SH_, g(0, G2 + 0.2 + SH_ / 2, FZ + 0.085), signmat("splash_park", 0.4), rot=(PI / 2, 0, 0))
hotel.append(sign)
# lanterns either side of the entrance and between the ground windows
for x in (-1.75, 1.75, -9.0, 9.0):
    if abs(x) > 8:
        continue
    lt = []
    lt.append(gbx("LanternBracket", x - 0.03, x + 0.03, 2.7, 2.76, FZ, FZ + 0.3, M["iron"], 0.005))
    lt.append(cyl("LanternCap", 0.13, 0.08, g(x, 2.95, FZ + 0.3), M["iron"], 6, r2=0.03))
    lt.append(cyl("LanternBase", 0.1, 0.04, g(x, 2.6, FZ + 0.3), M["iron"], 6))
    for k in range(6):
        a = k * math.tau / 6
        lt.append(gbx("LanternBar", x + math.cos(a) * 0.1 - 0.008, x + math.cos(a) * 0.1 + 0.008, 2.62, 2.92, FZ + 0.3 + math.sin(a) * 0.1 - 0.008, FZ + 0.3 + math.sin(a) * 0.1 + 0.008, M["iron"], 0))
    hotel += lt
    glass_ = cyl("Light_Lantern", 0.09, 0.3, g(x, 2.64, FZ + 0.3), M["lamp"], 6)
    hotel.append(glass_)
# planters with bougainvillea climbing the wall either side of the entrance (the climbers are props_planting's)
for x in (-2.65, 2.65):  # (clear of the life ring's board at x -4)
    hotel.append(gbx("Planter", x - 0.7, x + 0.7, 0, 0.62, FZ, FZ + 0.62, M["coping"], 0.03))
    hotel.append(gbx("PlanterSoil", x - 0.62, x + 0.62, 0.58, 0.6, FZ + 0.06, FZ + 0.56, M["soil"], 0))
parts += hotel

# ---- the roof: barrel tiles in rows down the slope, an overhang over the cornice -----------------------------------------------
def roof():
    x0, x1 = BX0 - 0.2, BX1 + 0.2
    z_front, z_back = FZ + 0.55, FZ - DEPTH + 0.3
    y_front, y_back = EAVE + 0.12, EAVE + 2.2
    rows = 9
    period = 0.3
    nper = int((x1 - x0) / period)
    per = 6  # vertices across one barrel
    mats_ = [M["roof"], M["roof_dark"], M["roof_light"]]
    bm = bmesh.new()
    me = bpy.data.meshes.new("Roof")
    o = bpy.data.objects.new("Roof", me)
    bpy.context.scene.collection.objects.link(o)
    for m_ in mats_:
        o.data.materials.append(m_)
    for r_ in range(rows):
        t0, t1 = r_ / rows, (r_ + 1.12) / rows
        za, zb = z_front + (z_back - z_front) * t0, z_front + (z_back - z_front) * min(t1, 1)
        ya, yb = y_front + (y_back - y_front) * t0, y_front + (y_back - y_front) * min(t1, 1)
        lift = 0.05  # each row's lower edge sits on the row below
        grid = []
        for k in range(nper * per + 1):
            x = x0 + k * period / per
            ph = (k % per) / per
            h = math.sin(ph * math.pi) * 0.07
            grid.append(
                (
                    bm.verts.new(g(x, ya + h + lift, za)),
                    bm.verts.new(g(x, yb + h, zb)),
                )
            )
        for k in range(nper * per):
            f = bm.faces.new([grid[k][0], grid[k + 1][0], grid[k + 1][1], grid[k][1]])
            f.material_index = R.choice([0, 0, 0, 1, 2]) if k % per == 0 else f.material_index
        # one colour per tile: the faces of a barrel take its first face's
        faces = list(bm.faces)[-nper * per :]
        for p in range(nper):
            mi = R.choice([0, 0, 0, 1, 2, 2])
            for f in faces[p * per : (p + 1) * per]:
                f.material_index = mi
        # the row's lower lip: a short drop so each row reads
        lip = []
        for k in range(nper * per + 1):
            v0 = grid[k][0]
            lip.append((v0, bm.verts.new(v0.co + Vector((0, 0, -0.06)))))
        for k in range(nper * per):
            f = bm.faces.new([lip[k][1], lip[k + 1][1], lip[k + 1][0], lip[k][0]])
            f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:  # the roof faces up
        if f.normal.z < -0.2:
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()
    # the ridge: rounded tiles along the top
    ridge = cyl("Ridge", 0.16, x1 - x0, g((x0 + x1) / 2, y_back + 0.08, z_back), M["roof_dark"], 10, rot=(0, PI / 2, 0))
    return [o, ridge]


parts += roof()

# ---- the long sides: a low stucco wall, a limestone cap, frameless glass, stucco piers with lanterns --------------------------
PIERS = {  # z of each pier on each side (rings, the fish net and lamps hang on them); the fuse box has a taller one
    -1: [-14.6, -9.6, -5.4, 0.6, 5.6, 11.0],
    1: [-14.6, -10.2, -6.6, 1.6, 6.8],  # (no pier at the fish net's board, z -2.8: it hangs on the glass's posts)
}
glass, walls = [], []
WZ0, WZ1 = DECK["z0"] - 0.0, RZ1 - 0.4
for side, x in ((-1, WALL_X[0]), (1, WALL_X[1])):
    z_end = 9.9 if side > 0 else WZ1  # (the fuse box's tall pier closes the right-hand side's last stretch)
    walls.append(slab("LowWall", x - 0.17, x + 0.17, WZ0, z_end, 0, 0.55, M["stucco"]))
    walls.append(slab("WallCap", x - 0.23, x + 0.23, WZ0, z_end, 0.55, 0.62, M["coping"], 0.015))
    pz = PIERS[side]
    # glass between the piers
    edges = [WZ0] + pz + [z_end]
    for a, b in zip(edges[:-1], edges[1:]):
        a2, b2 = a + (0.32 if a in pz else 0.05), b - (0.32 if b in pz else 0.05)
        if b2 - a2 < 0.3:
            continue
        pane = slab("Glass_Pane", x - 0.012, x + 0.012, a2, b2, 0.64, 1.44, M["glass"])
        pane.name = "Glass_Pane"
        glass.append(pane)
        walls.append(slab("GlassShoe", x - 0.05, x + 0.05, a2, b2, 0.6, 0.68, M["grate"], 0.005))
        walls.append(slab("Handrail", x - 0.035, x + 0.035, a2, b2, 1.44, 1.5, M["grate"], 0.012))
    for z in pz:
        walls.append(slab("Pier", x - 0.28, x + 0.28, z - 0.28, z + 0.28, 0, 1.55, M["stucco"], 0.02))
        walls.append(slab("PierCap", x - 0.34, x + 0.34, z - 0.34, z + 0.34, 1.55, 1.66, M["coping"], 0.02))
        # a lantern on every other pier
        if pz.index(z) % 2 == 0:
            walls.append(cyl("PierLanternBase", 0.1, 0.06, g(x, 1.69, z), M["iron"], 8))
            walls.append(cyl("PierLanternCap", 0.15, 0.1, g(x, 2.02, z), M["iron"], 8, r2=0.03))
            for k in range(4):
                a = k * math.tau / 4 + PI / 4
                walls.append(gbx("PierLanternBar", x + math.cos(a) * 0.1 - 0.01, x + math.cos(a) * 0.1 + 0.01, 1.72, 2.01, z + math.sin(a) * 0.1 - 0.01, z + math.sin(a) * 0.1 + 0.01, M["iron"], 0))
            walls.append(cyl("Light_PierLantern", 0.085, 0.27, g(x, 1.75, z), M["lamp"], 8))
# the utility pier that carries the fuse box (props.mjs fuseBox: its back at x 17.17), right-hand corner
walls.append(slab("FusePier", 17.17, 17.6, 9.9, RZ1 - 0.3, 0, 2.75, M["stucco"], 0.02))
walls.append(slab("FusePierCap", 17.1, 17.68, 9.84, RZ1 - 0.24, 2.75, 2.86, M["coping"], 0.02))
walls.append(slab("FusePierReturn", 16.68, 17.6, 9.9, 10.3, 0, 1.0, M["stucco"], 0.02))
parts += walls
parts.append(join(glass, "Glass_Balustrade"))
parts[-1].name = "Glass_Balustrade"

# ---- the open end: a clipped hedge in a stone kerb -----------------------------------------------------------------------------------
hedge = []
HZ0 = RZ1 - 0.95
hedge.append(slab("HedgeKerb", RX0 + 0.25, RX1 - 0.25, HZ0 - 0.05, RZ1 - 0.2, 0, 0.18, M["coping"], 0.02))
hb = slab("Hedge", RX0 + 0.3, RX1 - 0.3, HZ0 + 0.02, RZ1 - 0.27, 0.18, 1.12, M["hedge"], 0.18)
hedge.append(hb)
parts += hedge

# ---- what is painted on the deck (baked by the exporter into the floor's picture) ---------------------------------------------------
floor = []
paint = sm("deck_paint_white", "#f7f3e8", 0.6)
# the splash zone's hazard board by lane 5 (pool.mjs had it as a label on the deck: "NO DIVING · SPLASH ZONE LANE 5")
sz = plane("SplashZonePaint", 4.6, 1.15, g(12.35, 0.006, -9.4), signmat("splash_zone", 0.6), rot=(0, 0, PI / 2))
floor.append(sz)
# lane numbers on the deck at the blocks' end, behind each block
for i, x in enumerate(LANES):
    floor.append(flat_text("LaneNumber", "%02d" % (i + 1), 0.42, sm("navy"), g(x, 0.006, -HZ - 1.65), PI, 0.002, "BarlowCondensed-Black", rx=0))
# NO RUNNING at the open end
floor.append(flat_text("NoRunning", "NO RUNNING", 0.5, sm("coral"), g(0, 0.006, HZ + 2.35), 0, 0.002, "BarlowCondensed-Black", rx=0))

if LOOK:
    look("shell_overview", g(0, 0, -2), 34, 46, -90, (1280, 720), 16, 30)
    look("shell_facade", g(0, 3, -16), 14, 14, 0, (1280, 720), 20, 30)
    look("shell_corner", g(12, 1, -12), 9, 22, 40, (1100, 700), 20, 30)
save_part("shell", parts)
save_part("floor", floor)
