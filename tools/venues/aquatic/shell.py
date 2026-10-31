"""The Aquatic Centre's hall, modelled in place in game coordinates: the deck (white anti-slip tiles on a tabletop 1.95 m over the
hall's floor, a navy fascia round it), the competition basin (blue glass tiles, black lane lines and targets, yellow and black touch
pads at both ends, a deck-level gutter with its grate, the band), the ladders, the starting blocks (back plates, backstroke grips,
lane numbers) and the backstroke flags' posts; the timing wall along the back (white acoustic panels, a navy plinth, red and blue
bands, the frames round the game's timing board and pace clocks, the QUIET PLEASE banner); the hall's floor, its far walls (white
panels, a band of tall windows glowing with daylight) with the clubs' banners and the AQUATIC CENTRE lettering; the grandstands on
the far side and the far end (concrete tiers, rows of moulded seats in sections of blue, white and red, aisles of steps, a glass
front with a chrome rail, a handrail at the back), the press box with the POOL PANIC TV booth over the far stand; and, for the Coach
Cam only (ceiling.glb), the roof (a white barrel vault on lattice trusses with skylights and hanging lamps and banners) and the
near side (its wall and its grandstand).

Writes WORK/parts/shell.glb, ceiling.glb and floor.glb (the deck's paint: the lane numbers, AQUATIC CENTRE at the open end).

    blender -b -P tools/venues/aquatic/shell.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(13)
LOOK = "--look" in args()

M = dict(
    deck=tmat_tile("deck", "#eef3f6", 0.5),
    band=tmat_tile("mosaic_band", "#1f5fd1", 0.2),
    basin=tmat_tile("glass_mosaic", "#2a76c6", 0.15),
    floor=tmat_tile("rubberfloor", "#3a5770", 0.7),
    panel=tmat_tile("panel", "#e4f2f8", 0.7, tint="#e4f2f8"),
    walltile=tmat_tile("walltile", "#f2f7fa", 0.2),
    concrete=tmat_tile("concrete", "#b8bfc6", 0.85),
    seat_blue=tmat_tile("seats", "#1f5fd1", 0.35, tint="#1f5fd1"),
    seat_white=tmat_tile("seats", "#e8eef6", 0.35, tint="#e8eef6"),
    seat_red=tmat_tile("seats", "#e03a3a", 0.35, tint="#e03a3a"),
    navy=sm("navy"),
    blue=sm("blue"),
    red=sm("red"),
    white=sm("white"),
    gloss=sm("white_gloss"),
    black=sm("black"),
    yellow=sm("yellow"),
    steel=sm("steel"),
    chrome=sm("chrome"),
    stainless=sm("stainless"),
    grey=sm("grey"),
    charcoal=sm("charcoal"),
    glass=sm("glass_front", "#d6eef2", 0.05, alpha=0.25),
    lane=sm("lane_black", "#0c1a30", 0.3),
    window=lamp_mat("daylight", "#d8ecff", 2.2),
    sky=signmat("window_sky", 0.1),
    town=signmat("window_town", 0.1),
    town2=signmat("window_town2", 0.1),
    blind=sm("blind", "#efe6cf", 0.8),
    alu=sm("alu", "#e9eef2", 0.35),
    lamp=lamp_mat("hall_lamp", "#f4f8ff", 4.0),
    gutter=sm("gutter_dark", "#2a3440", 0.6),
)
parts, ceiling, floor = [], [], []


def ring(name, x_in, z_in, x_out, z_out, y0, y1, m, outer=None):
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
    return o


def slab(name, x0, x1, z0, z1, y0, y1, m, bev=0.0):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def mesh_from(name, verts, faces, m):
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


# ---- the deck and its fascia -----------------------------------------------------------------------------------------------------
RX0, RX1, RZ0, RZ1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]
COP, GUT, BAND = 0.4, (0.42, 0.62), (0.72, 1.42)
parts.append(ring("Deck", HX + GUT[1], HZ + GUT[1], 0, 0, -0.3, 0.0, M["deck"], outer=(RX0 - 0.05, RX1 + 0.05, RZ0 - 0.6, RZ1 + 0.05)))
parts.append(ring("Band", HX + BAND[0], HZ + BAND[0], HX + BAND[1], HZ + BAND[1], -0.02, 0.004, M["band"]))
parts.append(ring("GutterSlot", HX + GUT[0], HZ + GUT[0], HX + GUT[1], HZ + GUT[1], -0.06, -0.01, M["gutter"]))
bars = []
for sx in (-1, 1):
    x0, x1 = sx * (HX + GUT[0]), sx * (HX + GUT[1])
    z = -HZ - GUT[0]
    while z < HZ + GUT[0]:
        bars.append(gbx("GrateBar", min(x0, x1), max(x0, x1), -0.012, -0.002, z, z + 0.035, M["stainless"], 0))
        z += 0.12
for sz in (-1, 1):
    z0, z1 = sz * (HZ + GUT[0]), sz * (HZ + GUT[1])
    x = -HX - GUT[1]
    while x < HX + GUT[1]:
        bars.append(gbx("GrateBar", x, x + 0.035, -0.012, -0.002, min(z0, z1), max(z0, z1), M["stainless"], 0))
        x += 0.12
parts.append(join(bars, "Grate"))
cop = ring("Coping", HX, HZ, HX + COP, HZ + COP, -0.06, 0.045, M["gloss"])
bevel(cop, 0.03, 2, angle=30)
parts.append(cop)
# the navy fascia down to the hall's floor, a white lip on top, and a blue line along it
for name, x0, x1, z0, z1 in [("FasciaL", RX0 - 0.1, RX0 - 0.04, RZ0 - 0.6, RZ1 + 0.1), ("FasciaR", RX1 + 0.04, RX1 + 0.1, RZ0 - 0.6, RZ1 + 0.1), ("FasciaF", RX0 - 0.1, RX1 + 0.1, RZ1 + 0.04, RZ1 + 0.1)]:
    parts.append(slab(name, x0, x1, z0, z1, HALL_Y, -0.06, M["navy"]))
    parts.append(slab(name + "Lip", x0 - 0.02, x1 + 0.02, z0 - 0.02, z1 + 0.02, -0.06, 0.03, M["white"], 0.01))
    parts.append(slab(name + "Line", x0 - 0.005, x1 + 0.005, z0 - 0.005, z1 + 0.005, -0.5, -0.38, M["blue"]))

# ---- the basin -----------------------------------------------------------------------------------------------------------------------
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
for name, x0, x1, z0, z1 in [("FriezeL", -HX, -HX + 0.012, -HZ, HZ), ("FriezeR", HX - 0.012, HX, -HZ, HZ), ("FriezeB", -HX, HX, -HZ, -HZ + 0.012), ("FriezeF", -HX, HX, HZ - 0.012, HZ)]:
    parts.append(slab(name, x0, x1, z0, z1, -0.42, -0.08, M["band"]))
lines = []
for x in LANES:
    lines.append(slab("LaneLine", x - 0.13, x + 0.13, -6.9, 6.9, FLOOR_Y, FLOOR_Y + 0.008, M["lane"]))
    for z in (-6.9, 6.9):
        lines.append(slab("LaneT", x - 0.55, x + 0.55, z - 0.13, z + 0.13, FLOOR_Y, FLOOR_Y + 0.009, M["lane"]))
    for sz in (-1, 1):
        z = sz * (HZ - 0.008)
        zz = (z - 0.012, z) if sz > 0 else (z, z + 0.012)
        lines.append(slab("Target", x - 0.13, x + 0.13, *zz, FLOOR_Y + 0.3, -0.75, M["lane"]))
        lines.append(slab("TargetT", x - 0.4, x + 0.4, *zz, -0.9, -0.76, M["lane"]))
# the touch pads: yellow and black panels on the end walls, one to a lane, at both ends
for x in LANES:
    for sz in (-1, 1):
        z = sz * (HZ - 0.03)
        zz = (z - 0.03, z) if sz > 0 else (z, z + 0.03)
        lines.append(slab("TouchPad", x - 1.0, x + 1.0, *zz, -0.9, 0.0, M["yellow"]))
        lines.append(slab("TouchPadBand", x - 1.0, x + 1.0, zz[0] + sz * -0.005, zz[1] + sz * -0.005, -0.32, -0.2, M["black"]))
parts.append(join(lines, "LaneLines"))
uw = []
for sx in (-1, 1):
    for z in (-6, -2, 2, 6):
        uw.append(torus("UWRing", 0.2, 0.03, g(sx * (HX - 0.005), -0.78, z), M["stainless"], 20, 6, rot=(0, PI / 2, 0)))
        lens = cyl("UnderwaterLight", 0.17, 0.01, g(sx * (HX - 0.004), -0.78, z), sm("uw_lens", "#e9f5f2", 0.15), 18, rot=(0, PI / 2, 0))
        lens.name = "UnderwaterLight"
        parts.append(lens)
parts.append(join(uw, "UWRings"))


def ladder(x, z):
    out = -1 if x < 0 else 1
    rails = []
    for zz in (z - 0.42, z + 0.42):
        rails.append(poly_tube("LadderRail", [g(x - out * 0.12, -1.0, zz), g(x - out * 0.12, 0.35, zz), g(x + out * 0.18, 0.92, zz), g(x + out * 0.55, 0.62, zz), g(x + out * 0.55, 0.06, zz)], 0.024, M["stainless"], 10, 0.22))
        rails.append(cyl("LadderFoot", 0.05, 0.02, g(x + out * 0.55, 0.055, zz), M["stainless"], 14))
    for y in (-0.88, -0.5, -0.12):
        rails.append(gbx("Rung", min(x - out * 0.2, x - out * 0.04), max(x - out * 0.2, x - out * 0.04), y - 0.02, y + 0.02, z - 0.42, z + 0.42, M["stainless"], 0.006))
    return join(rails, "Ladder")


parts.append(ladder(-HX, 5.0))
parts.append(ladder(HX, -4.1))
# the starting blocks: a white top with a grey grip, a slanted back plate, backstroke grips, the lane's number on its face
blocks = []
for i, x in enumerate(LANES):
    z = -HZ - 0.85
    blocks.append(gbx("BlockBody", x - 0.3, x + 0.3, 0.04, 0.68, z - 0.3, z + 0.3, M["navy"], 0.04))
    top_ = gbx("BlockTop", x - 0.34, x + 0.34, 0.68, 0.78, z - 0.38, z + 0.36, M["white"], 0.025)
    blocks.append(top_)
    blocks.append(gbx("BlockGrip", x - 0.3, x + 0.3, 0.78, 0.79, z - 0.32, z + 0.3, M["grey"], 0))
    blocks.append(gbx("BackPlate", x - 0.3, x + 0.3, 0.79, 0.86, z - 0.36, z - 0.16, M["red"], 0.01))
    for s in (-1, 1):
        blocks.append(poly_tube("BackGrip", [g(x + s * 0.2, 0.72, z + 0.32), g(x + s * 0.2, 0.62, z + 0.42), g(x + s * 0.2, 0.62, z + 0.5)], 0.016, M["chrome"], 6, 0.04))
    blocks.append(gbx("BlockFoot", x - 0.36, x + 0.36, 0.0, 0.05, z - 0.4, z + 0.4, M["stainless"], 0.01))
    blocks.append(flat_text("BlockNum", str(i + 1), 0.3, M["white"], g(x, 0.4, z - 0.305), PI, 0.006, "BarlowCondensed-Black"))
    blocks.append(flat_text("BlockNumF", str(i + 1), 0.24, M["navy"], g(x, 0.6, z + 0.37), 0, 0.006, "BarlowCondensed-Black"))
parts.append(join(blocks, "Blocks"))
# the backstroke flags' posts (the game strings its pennants between them)
posts = []
for x in (-HX - 1.0, HX + 1.0):
    for z in (-5.7, 5.7):
        posts.append(cyl("PennantPost", 0.06, 3.4, g(x, 0.0, z), M["white"], 12, r2=0.045))
        posts.append(cyl("PostBase", 0.2, 0.06, g(x, 0.03, z), M["navy"], 16))
        posts.append(sphere("PostCap", 0.08, g(x, 3.42, z), M["red"], 10, 6))
        for y in (1.0, 2.0):
            posts.append(cyl("PostBand", 0.065, 0.12, g(x, y, z), M["blue"], 12))
parts.append(join(posts, "PennantPosts"))
depth = []
for x in (-HX - COP / 2, HX + COP / 2):
    for z in (-6.5, 0.0, 6.5):
        depth.append(flat_text("Depth", "2.0 m", 0.16, M["navy"], g(x, 0.047, z), (PI / 2 if x < 0 else -PI / 2), 0.004, "BarlowCondensed-Black", rx=0))
parts.append(join(depth, "DepthMarks"))

def wall_at(axis, fixed, face):
    """A builder in the wall's own terms: `u` along it, `d` out from its face into the hall, `y` up."""

    def box_(name, u0, u1, d0, d1, y0, y1, m, bev=0.0):
        if axis == "x":
            return slab(name, fixed - face * d0, fixed - face * d1, u0, u1, y0, y1, m, bev)
        return slab(name, u0, u1, fixed - face * d0, fixed - face * d1, y0, y1, m, bev)

    def pic(name, u, d, y, w_, h_, m):
        if axis == "x":
            return plane(name, w_, h_, g(fixed - face * d, y, u), m, rot=(PI / 2, 0, -PI / 2 if face > 0 else PI / 2))
        return plane(name, w_, h_, g(u, y, fixed - face * d), m, rot=(PI / 2, 0, PI if face > 0 else 0))

    return box_, pic


WIN_RAND = random.Random(77)


def window(box_, pic, c, w_, y0, y1, out, rows=3):
    """A tall window in a deep navy frame: two columns of panes (the town outside in the lowest row, sky above), aluminium mullions
    and transoms, a white sill, and a cream roller blind pulled down to wherever the last person left it (one hangs crooked)."""
    h_ = y1 - y0
    out.append(box_("WinFrame", c - w_ / 2 - 0.16, c - w_ / 2, 0, 0.32, y0 - 0.1, y1 + 0.16, M["navy"], 0.01))
    out.append(box_("WinFrame", c + w_ / 2, c + w_ / 2 + 0.16, 0, 0.32, y0 - 0.1, y1 + 0.16, M["navy"], 0.01))
    out.append(box_("WinHead", c - w_ / 2 - 0.16, c + w_ / 2 + 0.16, 0, 0.36, y1, y1 + 0.2, M["navy"], 0.01))
    out.append(box_("WinSill", c - w_ / 2 - 0.22, c + w_ / 2 + 0.22, 0, 0.4, y0 - 0.16, y0 - 0.04, M["white"], 0.01))
    for r in range(rows):
        ya, yb = y0 + h_ * r / rows, y0 + h_ * (r + 1) / rows
        for k in (0, 1):
            ua, ub = c - w_ / 2 + w_ * k / 2, c - w_ / 2 + w_ * (k + 1) / 2
            out.append(pic("Pane", (ua + ub) / 2, 0.02, (ya + yb) / 2, ub - ua, yb - ya, (M["town"] if WIN_RAND.random() < 0.18 else M["town2"]) if r == 0 else M["sky"]))
        if r:
            out.append(box_("Transom", c - w_ / 2, c + w_ / 2, 0, 0.1, ya - 0.04, ya + 0.04, M["alu"]))
    out.append(box_("Mullion", c - 0.05, c + 0.05, 0, 0.1, y0, y1, M["alu"]))
    # the blind: a roller box under the head, the fabric down to a bar, a pull cord
    out.append(box_("BlindBox", c - w_ / 2, c + w_ / 2, 0.12, 0.3, y1 - 0.22, y1, M["white"], 0.02))
    drop = WIN_RAND.choice([0.4, 0.9, 1.6, 2.3, 3.1, 0.6, 4.2])
    blind = box_("Blind", c - w_ / 2 + 0.04, c + w_ / 2 - 0.04, 0.16, 0.18, y1 - 0.22 - drop, y1 - 0.22, M["blind"])
    bar = box_("BlindBar", c - w_ / 2 + 0.02, c + w_ / 2 - 0.02, 0.15, 0.19, y1 - 0.26 - drop, y1 - 0.22 - drop, M["navy"], 0.005)
    if WIN_RAND.random() < 0.18:  # (stuck at a slant since the 2019 gala)
        tilt = math.radians(WIN_RAND.choice([-7, 6]))
        pivot = None
        for o in (blind, bar):
            ws = [o.matrix_world @ v.co for v in o.data.vertices]
            if pivot is None:
                cx_ = sum(v.x for v in ws) / len(ws)
                cy_ = sum(v.y for v in ws) / len(ws)
                pivot = Vector((cx_, cy_, max(v.z for v in ws)))
            axis_ = Vector((1, 0, 0)) if WALL_AXIS[0] == "x" else Vector((0, 1, 0))  # (the wall's normal, in Blender's axes)
            R = Matrix.Rotation(tilt, 4, axis_)
            inv = o.matrix_world.inverted()
            for v, wv in zip(o.data.vertices, ws):
                v.co = inv @ (pivot + (R @ (wv - pivot)))
            o.data.update()
    out += [blind, bar]
    cord_u = c + w_ / 2 - 0.12
    out.append(box_("BlindCord", cord_u - 0.006, cord_u + 0.006, 0.2, 0.212, y1 - 0.22 - drop - 0.9, y1 - 0.22, M["charcoal"]))


WALL_AXIS = ["x"]


# ---- the timing wall along the back -----------------------------------------------------------------------------------------------
FZ = FACE_Z
tw = []
TX0, TX1 = HALL["x0"], HALL["x1"]
tw.append(slab("TimingWall", TX0, TX1, FZ - 0.4, FZ, HALL_Y, EAVE, M["panel"]))
tw.append(slab("WallPlinth", TX0, TX1, FZ, FZ + 0.06, -0.02, 0.5, M["navy"], 0.01))
tw.append(slab("WallBandRed", TX0, TX1, FZ, FZ + 0.05, 4.85, 5.07, M["red"]))
tw.append(slab("WallBandBlue", TX0, TX1, FZ, FZ + 0.05, 5.2, 5.52, M["blue"]))
# the board's frame (the game's board at y 2.55, 9.6 by 4.2, its face at z -16.1): a navy frame, a lit header, cable trays
B = BOARD
for (x0, x1, y0, y1) in [(B["x"] - B["w"] / 2 - 0.3, B["x"] + B["w"] / 2 + 0.3, B["y"] - B["h"] / 2 - 0.3, B["y"] - B["h"] / 2), (B["x"] - B["w"] / 2 - 0.3, B["x"] + B["w"] / 2 + 0.3, B["y"] + B["h"] / 2, B["y"] + B["h"] / 2 + 0.3), (B["x"] - B["w"] / 2 - 0.3, B["x"] - B["w"] / 2, B["y"] - B["h"] / 2, B["y"] + B["h"] / 2), (B["x"] + B["w"] / 2, B["x"] + B["w"] / 2 + 0.3, B["y"] - B["h"] / 2, B["y"] + B["h"] / 2)]:
    tw.append(slab("BoardFrame", x0, x1, FZ, FZ + 0.22, y0, y1, M["navy"], 0.03))
tw.append(slab("BoardBack", B["x"] - B["w"] / 2, B["x"] + B["w"] / 2, FZ, FZ + 0.02, B["y"] - B["h"] / 2, B["y"] + B["h"] / 2, M["black"]))
for s in (-1, 1):
    tw.append(slab("BoardStrut", B["x"] + s * (B["w"] / 2 - 0.4) - 0.08, B["x"] + s * (B["w"] / 2 - 0.4) + 0.08, FZ, FZ + 0.2, 0.0, B["y"] - B["h"] / 2 - 0.3, M["navy"], 0.01))
# the pace clocks' housings (the game draws the dial, the rim and the hand at y 2.55)
for x in CLOCKS:
    tw.append(cyl("ClockHousing", 1.5, 0.12, g(x, 2.55, FZ), M["white"], 40, rot=(PI / 2, 0, 0)))
    tw.append(torus("ClockRing", 1.5, 0.05, g(x, 2.55, FZ + 0.12), M["red"], 40, 6, rot=(PI / 2, 0, 0)))
# the banner over everything, and lights over the board
tw.append(slab("BannerBack", -7.8, 8.6, FZ, FZ + 0.03, 6.3, 7.3, M["navy"]))
tw.append(plane("BannerQuiet", 16.2, 0.95, g(0.4, 6.8, FZ + 0.035), signmat("banner_quiet", 0.5), rot=(PI / 2, 0, 0)))
for x in (-3.6, 0.4, 4.4):
    tw.append(gbx("SpotArm", x - 0.04, x + 0.04, 5.9, 5.96, FZ, FZ + 0.6, M["charcoal"], 0.005))
    tw.append(cyl("Spot", 0.12, 0.22, g(x, 5.75, FZ + 0.6), M["charcoal"], 10, r2=0.16))
    tw.append(cyl("Light_Spot", 0.11, 0.01, g(x, 5.74, FZ + 0.6), M["lamp"], 10))
# glazed tiles up to the red band, the mural over the banner, high windows either side, the frieze under the eaves
tbox, tpic = wall_at("z", FZ, -1)
tw.append(tbox("WallTile", TX0, TX1, 0, 0.003, 0.5, 4.85, M["walltile"]))
tw.append(tbox("MuralFrame", -3.85, 4.65, 0, 0.05, 7.45, 10.75, M["navy"], 0.02))
tw.append(tpic("Mural", 0.4, 0.055, 9.1, 8.2, 3.08, signmat("mural", 0.5)))
tw.append(tbox("Frieze", TX0, TX1, 0, 0.015, EAVE - 1.25, EAVE - 0.75, M["band"]))
tw.append(tbox("Line", TX0, TX1, 0, 0.05, EAVE - 0.62, EAVE - 0.46, M["red"], 0.01))
WALL_AXIS[0] = "z"
for u in (-22.0, -16.4, -10.8, 11.6, 17.2, 22.8):
    window(tbox, tpic, u, 3.4, 7.9, 11.3, tw, rows=2)
for u in (-25.0, -19.2, -13.6, -7.4, 8.2, 14.4, 20.0, 25.6):
    tw.append(tbox("Pilaster", u - 0.17, u + 0.17, 0, 0.12, 5.6, EAVE, M["navy"], 0.01))
parts += tw

# ---- the hall's floor and its far walls --------------------------------------------------------------------------------------------
HX0, HX1, HZ0, HZ1 = HALL["x0"], HALL["x1"], HALL["z0"], HALL["z1"]
parts.append(slab("HallFloor", HX0, HX1, HZ0, HZ1, HALL_Y - 0.2, HALL_Y, M["floor"]))
WIN_Y0, WIN_Y1 = 4.2, 11.4


def hall_wall(name, axis, fixed, a0, a1, face, n_windows, out):
    """A hall wall: pale aqua acoustic panels to the eaves over a glazed tile dado, navy steel pilasters between tall windows (deep
    frames, the town and the sky outside, blinds at odd heights), a mosaic frieze and a red line under the eaves, vents."""
    box_, pic = wall_at(axis, fixed, face)
    WALL_AXIS[0] = axis
    if axis == "x":
        out.append(slab(name, fixed, fixed + face * 0.4, a0, a1, HALL_Y, EAVE, M["panel"]))
    else:
        out.append(slab(name, a0, a1, fixed, fixed + face * 0.4, HALL_Y, EAVE, M["panel"]))
    out.append(box_(name + "Skirt", a0, a1, 0, 0.05, HALL_Y, HALL_Y + 0.6, M["navy"]))
    out.append(box_(name + "Dado", a0, a1, 0, 0.012, HALL_Y + 0.6, WIN_Y0 - 0.5, M["walltile"]))
    out.append(box_(name + "DadoCap", a0, a1, 0, 0.06, WIN_Y0 - 0.56, WIN_Y0 - 0.44, M["blue"], 0.01))
    out.append(box_(name + "Frieze", a0, a1, 0, 0.015, EAVE - 1.25, EAVE - 0.75, M["band"]))
    out.append(box_(name + "Line", a0, a1, 0, 0.05, EAVE - 0.62, EAVE - 0.46, M["red"], 0.01))
    step = (a1 - a0) / n_windows
    for k in range(n_windows + 1):
        u = a0 + k * step
        out.append(box_("Pilaster", u - 0.17, u + 0.17, 0, 0.12, HALL_Y, EAVE, M["navy"], 0.01))
        out.append(box_("PilasterFlange", u - 0.24, u + 0.24, 0.12, 0.2, HALL_Y, EAVE, M["navy"], 0.01))
        if k % 2 == 1:  # an extract vent's grille high up, between the windows' heads and the frieze
            out.append(box_("VentGrille", u + step / 2 - 0.6, u + step / 2 + 0.6, 0, 0.08, WIN_Y1 + 0.45, WIN_Y1 + 0.9, M["grey"], 0.01))
            for j in range(4):
                yv = WIN_Y1 + 0.5 + j * 0.1
                out.append(box_("VentSlat", u + step / 2 - 0.56, u + step / 2 + 0.56, 0.08, 0.1, yv, yv + 0.03, M["charcoal"]))
    for k in range(n_windows):
        c = a0 + (k + 0.5) * step
        window(box_, pic, c, step * 0.62, WIN_Y0, WIN_Y1, out)


hall_wall("WallFar", "x", HX1, HZ0, HZ1, 1, 9, parts)
hall_wall("WallEnd", "z", HZ1, HX0, HX1, 1, 11, parts)
hall_wall("WallNear", "x", HX0, HZ0, HZ1, -1, 9, ceiling)
# the clubs' banners hanging on the far wall between its windows, the centre's name across the far end's top
for k, (z, name) in enumerate(((-9.5, "club_otters"), (-1.0, "club_seals"), (7.5, "club_biscuits"), (16.0, "club_otters"))):
    parts.append(cyl("BannerPole", 0.03, 2.2, g(HX1 - 0.3, 11.9, z - 1.1), M["chrome"], 6, rot=(PI / 2, 0, 0)))
    parts[-1].location = g(HX1 - 0.3, 11.9, z - 1.1)
    parts.append(plane("ClubBanner", 1.9, 3.8, g(HX1 - 0.32, 9.9, z), signmat(name, 0.6), rot=(PI / 2, 0, -PI / 2)))
parts.append(flat_text("CentreName", "AQUATIC CENTRE", 1.6, M["navy"], g(0.4, 12.0, HZ1 - 0.06), PI, 0.12, "BarlowCondensed-Black"))

# ---- the grandstands -----------------------------------------------------------------------------------------------------------------
SECTION = [M["seat_blue"], M["seat_white"], M["seat_blue"], M["seat_red"]]


def seat(along_, y, a, axis, d, m):
    """One moulded seat: a pan and a back, facing -d along the stand's axis."""
    out = []
    if axis == "x":
        out.append(slab("SeatPan", along_ - 0.22, along_ + 0.22, a - 0.22, a + 0.22, y, y + 0.06, m))
        out.append(slab("SeatBack", along_ + d * 0.2, along_ + d * 0.26, a - 0.21, a + 0.21, y + 0.06, y + 0.48, m))
    else:
        out.append(slab("SeatPan", a - 0.22, a + 0.22, along_ - 0.22, along_ + 0.22, y, y + 0.06, m))
        out.append(slab("SeatBack", a - 0.21, a + 0.21, along_ + d * 0.2, along_ + d * 0.26, y + 0.06, y + 0.48, m))
    return out


def grandstand(s, out):
    T = STAND
    d = s["dir"]
    for k in range(T["tiers"]):
        h = T["rise"] * (k + 1)
        a0_, a1_ = s["front"] + d * k * T["depth"], s["front"] + d * (k + 1) * T["depth"]
        if s["axis"] == "x":
            out.append(slab("Tier", a0_, a1_, s["a0"], s["a1"], HALL_Y, HALL_Y + h, M["concrete"]))
        else:
            out.append(slab("Tier", s["a0"], s["a1"], a0_, a1_, HALL_Y, HALL_Y + h, M["concrete"]))
        along = s["front"] + d * (k + 0.5) * T["depth"]
        a = s["a0"] + 0.5
        i = 0
        while a < s["a1"] - 0.3:
            if i % 9 != 8:  # (the aisles: the game leaves the same gaps in its crowd)
                sec = SECTION[(int((a - s["a0"]) / 9) + k) % len(SECTION)]
                out += seat(along - d * 0.1, HALL_Y + h, a, s["axis"], d, sec)
            a += 0.95
            i += 1
    # aisles of steps (yellow nosings) every 9 m, a glass front with a chrome rail, a handrail along the back
    a = s["a0"] + 0.5 + 8 * 0.95
    while a < s["a1"]:
        for k in range(T["tiers"]):
            h = T["rise"] * (k + 1)
            for half in (0, 1):
                y = HALL_Y + h - T["rise"] / 2 * (1 - half)
                c0 = s["front"] + d * (k + half * 0.5) * T["depth"]
                c1 = c0 + d * 0.06
                if s["axis"] == "x":
                    out.append(slab("Nosing", c0, c1, a - 0.4, a + 0.4, y - 0.02, y + 0.01, M["yellow"]))
                else:
                    out.append(slab("Nosing", a - 0.4, a + 0.4, c0, c1, y - 0.02, y + 0.01, M["yellow"]))
        a += 9 * 0.95
    top = HALL_Y + T["rise"] * T["tiers"]
    back = s["front"] + d * T["tiers"] * T["depth"]
    if s["axis"] == "x":
        out.append(slab("FrontGlass", s["front"] - d * 0.06, s["front"] - d * 0.04, s["a0"], s["a1"], HALL_Y + 1.4, HALL_Y + 2.4, M["glass"]))
        out.append(slab("FrontRail", s["front"] - d * 0.08, s["front"] - d * 0.02, s["a0"], s["a1"], HALL_Y + 2.4, HALL_Y + 2.46, M["chrome"]))
        out.append(slab("BackWall", back, back + d * 0.3, s["a0"], s["a1"], HALL_Y, top + 1.2, M["panel"]))
        out.append(slab("BackRail", back - d * 0.1, back, s["a0"], s["a1"], top + 0.95, top + 1.0, M["chrome"]))
    else:
        out.append(slab("FrontGlass", s["a0"], s["a1"], s["front"] - d * 0.06, s["front"] - d * 0.04, HALL_Y + 1.4, HALL_Y + 2.4, M["glass"]))
        out.append(slab("FrontRail", s["a0"], s["a1"], s["front"] - d * 0.08, s["front"] - d * 0.02, HALL_Y + 2.4, HALL_Y + 2.46, M["chrome"]))
        out.append(slab("BackWall", s["a0"], s["a1"], back, back + d * 0.3, HALL_Y, top + 1.2, M["panel"]))
        out.append(slab("BackRail", s["a0"], s["a1"], back - d * 0.1, back, top + 0.95, top + 1.0, M["chrome"]))


stand_parts = {False: [], True: []}
for s in STANDS:
    grandstand(s, stand_parts[s["coach"]])
parts.append(join(stand_parts[False], "Stands"))
ceiling.append(join(stand_parts[True], "StandNear"))

# the press box over the far end's stand: a glazed booth on legs, the POOL PANIC TV booth with its logo, a commentator's desk
PZ0, PZ1 = 22.75, 24.4
pb = []
pb.append(slab("PressBox", -6.0, 6.0, PZ0, PZ1, 3.4, 5.8, M["white"], 0.03))
pb.append(slab("PressWindow", -5.7, 5.7, PZ0 - 0.02, PZ0, 4.0, 5.4, sm("press_glass", "#2a4a6a", 0.1)))
for x in (-5.7, -1.9, 1.9, 5.7):
    pb.append(slab("PressMullion", x - 0.06, x + 0.06, PZ0 - 0.04, PZ0, 4.0, 5.4, M["navy"]))
pb.append(slab("PressRoof", -6.2, 6.2, PZ0 - 0.4, PZ1, 5.8, 6.0, M["navy"], 0.02))
pb.append(slab("PressBand", -6.0, 6.0, PZ0 - 0.04, PZ0, 3.4, 3.8, M["red"]))
for x in (-5.4, 5.4):
    pb.append(slab("PressLeg", x - 0.15, x + 0.15, PZ0 + 0.3, PZ0 + 0.6, HALL_Y + STAND["rise"] * STAND["tiers"], 3.4, M["navy"]))
pb.append(plane("TvLogo", 1.2, 1.2, g(-3.8, 4.7, PZ0 - 0.05), signmat("tv_logo", 0.5), rot=(PI / 2, 0, PI)))
pb.append(plane("TvLogo2", 1.2, 1.2, g(3.8, 4.7, PZ0 - 0.05), signmat("tv_logo", 0.5), rot=(PI / 2, 0, PI)))
pb.append(flat_text("OnAir", "ON AIR", 0.4, lamp_mat("on_air", "#ff4a3a", 6.0), g(0, 6.25, PZ0 - 0.2), PI, 0.06, "BarlowCondensed-Black"))
pb.append(slab("OnAirBox", -0.75, 0.75, PZ0 - 0.18, PZ0 - 0.1, 6.0, 6.5, M["black"], 0.02))
parts += pb

# ---- the roof (the Coach Cam's): a white barrel vault on lattice trusses, skylights, hanging lamps and the clubs' banners --------------
C = []
SEG = 16
span = HX1 - HX0
cx = (HX0 + HX1) / 2


def vault_y(t):
    return EAVE + (RIDGE - EAVE) * math.sin(t * PI)


vv, ff = [], []
for i in range(SEG + 1):
    t = i / SEG
    x = HX0 + span * t
    vv += [(x, vault_y(t), HZ0), (x, vault_y(t), HZ1)]
for i in range(SEG):
    ff.append([i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1])
C.append(mesh_from("Vault", vv, ff, M["panel"]))
# the gable walls under the vault at both ends
for z in (HZ0, HZ1):
    gv = [(HX0, EAVE, z)] + [(HX0 + span * i / SEG, vault_y(i / SEG), z) for i in range(SEG + 1)] + [(HX1, EAVE, z)]
    C.append(mesh_from("Gable", gv, [list(range(len(gv)))], M["panel"]))
z = HZ0 + 3.0
while z < HZ1 - 2:
    for i in range(SEG):
        t0, t1 = i / SEG, (i + 1) / SEG
        a = g(HX0 + span * t0, vault_y(t0) - 0.3, z)
        b = g(HX0 + span * t1, vault_y(t1) - 0.3, z)
        C.append(tube("Truss", [a, b], 0.08, M["white"], 1, 6))
        a2 = g(HX0 + span * t0, vault_y(t0) - 1.8, z)
        b2 = g(HX0 + span * t1, vault_y(t1) - 1.8, z)
        C.append(tube("TrussLow", [a2, b2], 0.06, M["white"], 1, 6))
        C.append(tube("TrussLace", [a, b2], 0.035, M["white"], 1, 4))
    # a lamp hanging from each truss over the pool
    for x in (-12.0, -4.0, 4.0, 12.0):
        t = (x - HX0) / span
        C.append(cyl("LampWire", 0.01, vault_y(t) - 1.8 - 10.5, g(x, 10.5, z), M["charcoal"], 4))
        C.append(cyl("LampShade", 0.5, 0.4, g(x, 10.1, z), M["white"], 12, r2=0.2))
        C.append(cyl("Light_HallLamp", 0.42, 0.02, g(x, 10.08, z), M["lamp"], 12))
    z += 6.5
# skylights along the vault's crown
for k in range(5):
    zc = HZ0 + 5 + k * 7.5
    t0, t1 = 0.42, 0.58
    C.append(mesh_from("Skylight", [(HX0 + span * t0, vault_y(t0) - 0.05, zc - 2.0), (HX0 + span * t1, vault_y(t1) - 0.05, zc - 2.0), (HX0 + span * t1, vault_y(t1) - 0.05, zc + 2.0), (HX0 + span * t0, vault_y(t0) - 0.05, zc + 2.0)], [[0, 1, 2, 3]], M["window"]))
# the clubs' banners hanging from the trusses over the pool
for k, (x, name) in enumerate(((-9.0, "club_seals"), (-3.0, "club_biscuits"), (3.0, "club_otters"), (9.0, "club_seals"))):
    C.append(plane("HangingBanner", 2.0, 4.0, g(x, 12.6, 6.0), signmat(name, 0.6), rot=(PI / 2, 0, PI)))
    C.append(plane("HangingBannerB", 2.0, 4.0, g(x, 12.6, 6.02), signmat(name, 0.6), rot=(PI / 2, 0, 0)))
ceiling += C

# ---- the deck's paint: the lane numbers past the turning end, AQUATIC CENTRE at the open end ----------------------------------------
for i, x in enumerate(LANES):
    floor.append(flat_text("LaneNumber", str(i + 1), 0.7, M["navy"], g(x, 0.006, HZ + 1.6), PI / 2, 0.002, "BarlowCondensed-Black", rx=0))
floor.append(flat_text("CentrePaint", "AQUATIC CENTRE", 0.62, M["blue"], g(0, 0.006, HZ + 3.9), 0, 0.002, "BarlowCondensed-Black", rx=0))

if LOOK:
    look("shell_overview", g(4, 0, 2), 50, 48, -90, (1280, 720), 16, 30)
    look("shell_wall", g(0.4, 3, -15), 18, 10, 0, (1280, 720), 16, 30)
    look("shell_stands", g(20, 1, 4), 22, 18, 220, (1280, 720), 16, 30)
save_part("shell", parts)
save_part("ceiling", ceiling)
save_part("floor", floor)
