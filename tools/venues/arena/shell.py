"""The Grand Gala Arena's hall, modelled in place in game coordinates: the deck (ivory terrazzo with brass strips on a tabletop
1.95 m over the hall's floor, a walnut fascia round it with a gold lip and a row of marquee bulbs), a band of the pool's mosaic round
it, black marble coping, a brass gutter grate; the basin (navy and gold glass mosaic, the art deco band at the waterline, lane lines
broken round the gala's emblem on the floor: a rubber duck in a bow tie and a crown holding up the trophy), the ladders, the
starting blocks (black marble, gold tops), the pennants' brass posts; the stage's wall along the back (walnut, gold-leaf frames
round the game's screens, a crimson velvet pelmet, the niche over the screen where the trophy turns on its plinth before a gold
sunburst, the poster, the nominees, the red carpet's photograph, THE POOL PANIC AWARDS); the hall's floor in theatre carpet; the
far walls (midnight damask, gilded pilasters, a walnut dado, a row of opera boxes with velvet curtains and sconces, arched windows
on the night outside); the grandstands on the far side and the far end (navy tiers, crimson velvet seats, gold sections and
nosings, a walnut front with a brass rail where the game's ribbon scrolls); and, for the Coach Cam only (ceiling.glb), the roof (a
coffered vault in navy and gold on gilded trusses, two crystal chandeliers, hanging GRAND GALA banners) and the near side (its
wall and its grandstand).

Writes WORK/parts/shell.glb, ceiling.glb and floor.glb (the deck's paint: the red carpet along the stage, the lane numbers, GRAND
GALA at the open end).

    blender -b -P tools/venues/arena/shell.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(29)
LOOK = "--look" in args()

M = dict(
    deck=tmat_tile("terrazzo", "#e2d6bc", 0.35, tint="#e2d6bc"),
    band=tmat_tile("mosaic", "#22305a", 0.2),
    basin=tmat_tile("mosaic", "#22305a", 0.15),
    deco=tmat_tile("decoband", "#22305a", 0.2),
    nero=tmat_tile("nero", "#141418", 0.15),
    marble=tmat_tile("marble", "#f1ece4", 0.2),
    carpet=tmat_tile("carpet", "#1b2346", 0.9),
    damask=tmat_tile("damask", "#1b2a52", 0.6),
    walnut=tmat_tile("walnut", "#5a3520", 0.35),
    goldleaf=tmat_tile("goldleaf", "#d9ae4a", 0.35),
    velvet=tmat_tile("velvet", "#8f1f32", 0.85),
    concrete=tmat_tile("concrete", "#2a3352", 0.85, tint="#2a3352"),
    seat_red=tmat_tile("velvet", "#8f1f32", 0.85),
    seat_gold=tmat_tile("velvet", "#c9a24a", 0.8, tint="#e2c27a"),
    seat_navy=tmat_tile("velvet", "#22305a", 0.85, tint="#5a6aa8"),
    navy=sm("navy"),
    midnight=sm("midnight"),
    crimson=sm("crimson"),
    ivory=sm("ivory"),
    black=sm("black"),
    gold=sm("gold"),
    brass=sm("brass"),
    gold_paint=sm("gold_paint"),
    chrome=sm("chrome"),
    crystal=sm("crystal_glass", "#f2f8ff", 0.04, alpha=0.55),
    lane=sm("lane_navy", "#0c1430", 0.3),
    gutter=sm("gutter_dark", "#1a1d26", 0.6),
    bulb=lamp_mat("marquee_bulb", "#ffe2a0", 5.0),
    lamp=lamp_mat("sconce", "#ffd89a", 4.0),
    chandelier=lamp_mat("chandelier", "#fff0c8", 6.0),
    spot=lamp_mat("niche_spot", "#fff4dc", 5.0),
    night=signmat("window_night", 0.1),
    night2=signmat("window_night2", 0.1),
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
    return gbx(name, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1), m, bev)


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


# ---- the deck, its band and coping, its fascia ------------------------------------------------------------------------------------
RX0, RX1, RZ0, RZ1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]
COP, GUT, BAND = 0.4, (0.42, 0.62), (0.72, 1.42)
parts.append(ring("Deck", HX + GUT[1], HZ + GUT[1], 0, 0, -0.3, 0.0, M["deck"], outer=(RX0 - 0.05, RX1 + 0.05, RZ0 - 0.6, RZ1 + 0.05)))
parts.append(ring("Band", HX + BAND[0], HZ + BAND[0], HX + BAND[1], HZ + BAND[1], -0.02, 0.004, M["band"]))
for k, d_ in enumerate((BAND[0], BAND[1])):  # brass strips either side of the band
    parts.append(ring("BandStrip%d" % k, HX + d_ - 0.02, HZ + d_ - 0.02, HX + d_ + 0.02, HZ + d_ + 0.02, -0.02, 0.006, M["brass"]))
parts.append(ring("GutterSlot", HX + GUT[0], HZ + GUT[0], HX + GUT[1], HZ + GUT[1], -0.06, -0.01, M["gutter"]))
bars = []
for sx in (-1, 1):
    x0, x1 = sx * (HX + GUT[0]), sx * (HX + GUT[1])
    z = -HZ - GUT[0]
    while z < HZ + GUT[0]:
        bars.append(gbx("GrateBar", min(x0, x1), max(x0, x1), -0.012, -0.002, z, z + 0.035, M["brass"], 0))
        z += 0.12
for sz in (-1, 1):
    z0, z1 = sz * (HZ + GUT[0]), sz * (HZ + GUT[1])
    x = -HX - GUT[1]
    while x < HX + GUT[1]:
        bars.append(gbx("GrateBar", x, x + 0.035, -0.012, -0.002, min(z0, z1), max(z0, z1), M["brass"], 0))
        x += 0.12
parts.append(join(bars, "Grate"))
cop = ring("Coping", HX, HZ, HX + COP, HZ + COP, -0.06, 0.045, M["nero"])
bevel(cop, 0.03, 2, angle=30)
parts.append(cop)
# the walnut fascia down to the hall's floor, a gold-leaf lip, a gold line low down and a row of marquee bulbs along it
bulbs = []
for name, x0, x1, z0, z1 in [("FasciaL", RX0 - 0.1, RX0 - 0.04, RZ0 - 0.6, RZ1 + 0.1), ("FasciaR", RX1 + 0.04, RX1 + 0.1, RZ0 - 0.6, RZ1 + 0.1), ("FasciaF", RX0 - 0.1, RX1 + 0.1, RZ1 + 0.04, RZ1 + 0.1)]:
    parts.append(slab(name, x0, x1, z0, z1, HALL_Y, -0.06, M["walnut"]))
    parts.append(slab(name + "Lip", x0 - 0.02, x1 + 0.02, z0 - 0.02, z1 + 0.02, -0.06, 0.03, M["goldleaf"], 0.01))
    parts.append(slab(name + "Line", x0 - 0.005, x1 + 0.005, z0 - 0.005, z1 + 0.005, -1.75, -1.68, M["gold"]))
    parts.append(slab(name + "Rule", x0 - 0.008, x1 + 0.008, z0 - 0.008, z1 + 0.008, -0.42, -0.32, M["black"]))
    along_x = (x1 - x0) > (z1 - z0)
    a0, a1 = (x0, x1) if along_x else (z0, z1)
    n = int((a1 - a0) / 0.55)
    for k in range(n):
        a = a0 + 0.3 + k * (a1 - a0 - 0.6) / max(1, n - 1)
        if along_x:
            p_ = (a, -0.37, z1 + 0.03)
        else:
            p_ = ((x1 + 0.03) if name == "FasciaR" else (x0 - 0.03), -0.37, a)
        bulbs.append(sphere("Bulb", 0.045, g(*p_), M["bulb"], 6, 4))
parts.append(join(bulbs, "MarqueeBulbs"))

# ---- the basin ------------------------------------------------------------------------------------------------------------------------
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
    parts.append(slab(name, x0, x1, z0, z1, -0.36, -0.06, M["deco"]))
    parts.append(slab(name + "Gold", x0, x1, z0, z1, -0.39, -0.36, M["gold"]))
# the emblem on the floor, the lane lines broken round it
EMB = 5.4
parts.append(flat("Emblem", EMB, EMB, 0.0, FLOOR_Y + 0.012, 0.0, cutmat("emblem", 0.3), turn=PI / 2))
lines = []
for x in LANES:
    gap = 3.15 if abs(x) < 4 else 0.0
    for za, zb in ((-6.9, -gap), (gap, 6.9)) if gap else ((-6.9, 6.9),):
        lines.append(slab("LaneLine", x - 0.13, x + 0.13, za, zb, FLOOR_Y, FLOOR_Y + 0.008, M["lane"]))
    for z in (-6.9, 6.9):
        lines.append(slab("LaneT", x - 0.55, x + 0.55, z - 0.13, z + 0.13, FLOOR_Y, FLOOR_Y + 0.009, M["lane"]))
    for sz in (-1, 1):
        z = sz * (HZ - 0.008)
        zz = (z - 0.012, z) if sz > 0 else (z, z + 0.012)
        lines.append(slab("Target", x - 0.13, x + 0.13, *zz, FLOOR_Y + 0.3, -0.75, M["lane"]))
        lines.append(slab("TargetT", x - 0.4, x + 0.4, *zz, -0.9, -0.76, M["lane"]))
parts.append(join(lines, "LaneLines"))
uw = []
for sx in (-1, 1):
    for z in (-6, -2, 2, 6):
        uw.append(torus("UWRing", 0.2, 0.03, g(sx * (HX - 0.005), -0.78, z), M["brass"], 20, 6, rot=(0, PI / 2, 0)))
        lens = cyl("UnderwaterLight", 0.17, 0.01, g(sx * (HX - 0.004), -0.78, z), sm("uw_lens", "#fff2d6", 0.15), 18, rot=(0, PI / 2, 0))
        lens.name = "UnderwaterLight"
        parts.append(lens)
parts.append(join(uw, "UWRings"))


def ladder(x, z):
    out = -1 if x < 0 else 1
    rails = []
    for zz in (z - 0.42, z + 0.42):
        rails.append(poly_tube("LadderRail", [g(x - out * 0.12, -1.0, zz), g(x - out * 0.12, 0.35, zz), g(x + out * 0.18, 0.92, zz), g(x + out * 0.55, 0.62, zz), g(x + out * 0.55, 0.06, zz)], 0.024, M["brass"], 10, 0.22))
        rails.append(cyl("LadderFoot", 0.05, 0.02, g(x + out * 0.55, 0.055, zz), M["brass"], 14))
    for y in (-0.88, -0.5, -0.12):
        rails.append(gbx("Rung", min(x - out * 0.2, x - out * 0.04), max(x - out * 0.2, x - out * 0.04), y - 0.02, y + 0.02, z - 0.42, z + 0.42, M["brass"], 0.006))
    return join(rails, "Ladder")


parts.append(ladder(-HX, 5.0))
parts.append(ladder(HX, -4.1))
# the starting blocks: black marble, a gold top with a black grip, the lane's number in gold
blocks = []
for i, x in enumerate(LANES):
    z = -HZ - 0.85
    blocks.append(gbx("BlockBody", x - 0.3, x + 0.3, 0.04, 0.68, z - 0.3, z + 0.3, M["nero"], 0.04))
    blocks.append(gbx("BlockTop", x - 0.34, x + 0.34, 0.68, 0.78, z - 0.38, z + 0.36, M["gold"], 0.025))
    blocks.append(gbx("BlockGrip", x - 0.3, x + 0.3, 0.78, 0.79, z - 0.32, z + 0.3, M["black"], 0))
    blocks.append(gbx("BlockFoot", x - 0.36, x + 0.36, 0.0, 0.05, z - 0.4, z + 0.4, M["brass"], 0.01))
    blocks.append(flat_text("BlockNum", str(i + 1), 0.3, M["gold"], g(x, 0.4, z - 0.305), PI, 0.006, "BarlowCondensed-Black"))
    blocks.append(flat_text("BlockNumF", str(i + 1), 0.24, M["gold"], g(x, 0.42, z + 0.305), 0, 0.006, "BarlowCondensed-Black"))
parts.append(join(blocks, "Blocks"))
# the pennants' brass posts (the game strings its pennants between them)
posts = []
for x in (-HX - 1.0, HX + 1.0):
    for z in (-5.7, 5.7):
        posts.append(cyl("PennantPost", 0.055, 3.4, g(x, 0.0, z), M["brass"], 12, r2=0.04))
        posts.append(cyl("PostBase", 0.2, 0.06, g(x, 0.03, z), M["black"], 16))
        posts.append(sphere("PostCap", 0.09, g(x, 3.42, z), M["gold"], 10, 6))
        for y in (1.0, 2.0):
            posts.append(cyl("PostBand", 0.062, 0.1, g(x, y, z), M["crimson"], 12))
parts.append(join(posts, "PennantPosts"))
depth = []
for x in (-HX - COP / 2, HX + COP / 2):
    for z in (-6.5, 0.0, 6.5):
        depth.append(flat_text("Depth", "1.4 m", 0.16, M["gold"], g(x, 0.047, z), (PI / 2 if x < 0 else -PI / 2), 0.004, "BarlowCondensed-Black", rx=0))
parts.append(join(depth, "DepthMarks"))

# ---- the stage's wall along the back ----------------------------------------------------------------------------------------------
FZ = FACE_Z
HX0, HX1, HZ0, HZ1 = HALL["x0"], HALL["x1"], HALL["z0"], HALL["z1"]
sw = []
NX0, NX1, NY0, NY1, NZ = CX - 3.5, CX + 3.5, 5.75, 12.2, -18.7  # the trophy's niche
TOPW = EAVE + 1.0


def wall_piece(x0, x1, y0, y1, m=M["walnut"], name="StageWall"):
    sw.append(slab(name, x0, x1, FZ - 0.5, FZ, y0, y1, m))


wall_piece(HX0, NX0, HALL_Y, TOPW)
wall_piece(NX1, HX1, HALL_Y, TOPW)
wall_piece(NX0, NX1, HALL_Y, NY0)
wall_piece(NX0, NX1, NY1, TOPW)
# the doorways (the leaves are props_doors.py's): the wall stands behind them, a dark opening is cut by a box in front
sw.append(slab("WallPlinth", HX0, HX1, FZ, FZ + 0.05, -0.02, 0.42, M["nero"], 0.01))
sw.append(slab("WallRail", HX0, HX1, FZ, FZ + 0.06, 5.75, 5.95, M["goldleaf"], 0.01))
sw.append(slab("WallRail2", HX0, HX1, FZ, FZ + 0.04, 0.42, 0.5, M["gold"], 0.005))
# the niche: its sides, its floor (the plinth's shelf) and the gold sunburst on its back, a spot either side
sw.append(slab("NicheBack", NX0, NX1, NZ - 0.2, NZ, NY0, NY1, M["walnut"]))
for x0, x1 in ((NX0 - 0.0, NX0 + 0.3), (NX1 - 0.3, NX1)):
    sw.append(slab("NicheSide", x0, x1, NZ, FZ, NY0, NY1, M["goldleaf"]))
sw.append(slab("NicheTop", NX0, NX1, NZ, FZ, NY1 - 0.3, NY1, M["goldleaf"]))
rays = []
for k in range(15):
    a = PI * (k + 0.5) / 15
    r0, r1 = 1.8, 6.0
    w0, w1 = 0.06, 0.32 if k % 2 == 0 else 0.18
    cx_, cy_ = CX, NY0 + 0.3
    pts = [(cx_ + math.cos(a) * r0 - math.sin(a) * w0, cy_ + math.sin(a) * r0 + math.cos(a) * w0), (cx_ + math.cos(a) * r0 + math.sin(a) * w0, cy_ + math.sin(a) * r0 - math.cos(a) * w0), (cx_ + math.cos(a) * r1 + math.sin(a) * w1, cy_ + math.sin(a) * r1 - math.cos(a) * w1), (cx_ + math.cos(a) * r1 - math.sin(a) * w1, cy_ + math.sin(a) * r1 + math.cos(a) * w1)]
    pts = [(min(max(x, NX0 + 0.35), NX1 - 0.35), min(y, NY1 - 0.35)) for x, y in pts]
    rays.append(prism("SunRay", pts, NZ, NZ + 0.04, M["goldleaf"]))
sw.append(join(rays, "Sunburst"))
# the plinth: Calacatta on a black marble base, a gold band, the plate (THE GOLDEN WHISTLE) toward the deck
T_ = TROPHY
sw.append(slab("PlinthBase", T_["x"] - 1.6, T_["x"] + 1.6, T_["z"] - 1.4, T_["z"] + 1.4, NY0, NY0 + 0.05, M["nero"], 0.01))
sw.append(slab("Plinth", T_["x"] - 1.45, T_["x"] + 1.45, T_["z"] - 1.25, T_["z"] + 1.25, NY0 + 0.05, T_["y"] - 0.06, M["marble"], 0.02))
sw.append(slab("PlinthBand", T_["x"] - 1.5, T_["x"] + 1.5, T_["z"] - 1.3, T_["z"] + 1.3, T_["y"] - 0.06, T_["y"], M["gold"], 0.01))
sw.append(face("TrophyPlate", 1.2, 0.35, T_["x"], (NY0 + T_["y"]) / 2 + 0.02, T_["z"] + 1.26, 0.0, signmat("trophy_plate", 0.4)))
for sx in (-1, 1):
    x = CX + sx * 2.6
    sw.append(rod("SpotArm", (x, NY1 - 0.35, FZ - 0.4), (x, NY1 - 0.8, FZ - 0.4), 0.025, M["black"]))
    sw.append(cyl("SpotCan", 0.16, 0.36, g(x, NY1 - 1.05, FZ - 0.4), M["black"], 12, r2=0.2, rot=(0.6, 0, 0)))
    sw.append(cyl("Light_Spot", 0.15, 0.02, g(x, NY1 - 1.2, FZ - 0.28), M["spot"], 12, rot=(0.6, 0, 0)))
# the frames round the game's screens (the main one at y 3.55, 8.4 by 3.28; the side ones 2.4 by 3.6), a stepped deco crown on
# the main one, black behind
S_ = SCREEN


def frame(name, cx_, cy_, w_, h_, t, m):
    out = []
    for (x0, x1, y0, y1) in [(cx_ - w_ / 2 - t, cx_ + w_ / 2 + t, cy_ - h_ / 2 - t, cy_ - h_ / 2), (cx_ - w_ / 2 - t, cx_ + w_ / 2 + t, cy_ + h_ / 2, cy_ + h_ / 2 + t), (cx_ - w_ / 2 - t, cx_ - w_ / 2, cy_ - h_ / 2, cy_ + h_ / 2), (cx_ + w_ / 2, cx_ + w_ / 2 + t, cy_ - h_ / 2, cy_ + h_ / 2)]:
        out.append(slab(name, x0, x1, FZ, FZ + 0.16, y0, y1, m, 0.02))
    out.append(slab(name + "Back", cx_ - w_ / 2, cx_ + w_ / 2, FZ, FZ + 0.02, cy_ - h_ / 2, cy_ + h_ / 2, M["black"]))
    return out


sw += frame("ScreenFrame", S_["x"], S_["y"], S_["w"] + 0.1, S_["h"] + 0.1, 0.42, M["goldleaf"])
for k, (dx, w_) in enumerate(((0, 3.2), (0, 1.8))):
    y0 = S_["y"] + S_["h"] / 2 + 0.47 + k * 0.22
    sw.append(slab("ScreenCrown", S_["x"] - w_ / 2, S_["x"] + w_ / 2, FZ, FZ + 0.12, y0, y0 + 0.22, M["goldleaf"], 0.01))
for x in SIDE_SCREENS:
    sw += frame("SideFrame", x, S_["y"], 2.5, 3.7, 0.22, M["goldleaf"])
    sw.append(slab("SidePelmet", x - 1.6, x + 1.6, FZ, FZ + 0.3, 5.55, 5.75, M["goldleaf"], 0.02))
# the crimson velvet pelmet across the stage over everything, swagged in three, gold fringe; the drapes' rails (the game hangs them)
sw.append(slab("Pelmet", RX0, RX1, FZ, FZ + 0.18, 5.95, 6.6, M["velvet"], 0.02))
sw.append(slab("PelmetFringe", RX0, RX1, FZ + 0.02, FZ + 0.2, 5.92, 5.98, M["gold"], 0.0))
for x in DRAPES:
    sw.append(slab("DrapeRail", x - 1.85, x + 1.85, FZ + 0.15, FZ + 0.35, 5.5, 5.62, M["gold"], 0.02))
    for sx in (-1, 1):
        sw.append(sphere("RailFinial", 0.09, g(x + sx * 1.9, 5.56, FZ + 0.25), M["gold"], 10, 6))
# the pictures on the wall high over the drapes and doors (the Coach Cam's mostly): the red carpet's photograph, the nominees, the
# poster; gold frames; and THE POOL PANIC AWARDS over the niche
for name, sign, cx_, cy_, w_, h_ in (("RedCarpet", "redcarpet", -12.9, 8.6, 3.2, 2.4), ("Nominees", "nominees", -7.0, 8.4, 4.4, 2.2), ("Poster", "poster", 7.6, 8.6, 2.1, 2.8), ("Programme", "programme", 12.3, 8.4, 1.6, 2.25)):
    sw += frame(name + "Frame", cx_, cy_, w_, h_, 0.16, M["gold"])
    sw.append(face(name, w_, h_, cx_, cy_, FZ + 0.025, 0.0, signmat(sign, 0.4)))
sw.append(face("AwardsName", 11.0, 1.61, CX, 13.4, FZ + 0.03, 0.0, signmat("awards_name", 0.4)))
for x in (-18.5, -22.5, 19.5, 23.5):  # over the corners: the banners
    sw.append(rod("BannerRod", (x - 0.9, 11.6, FZ + 0.15), (x + 0.9, 11.6, FZ + 0.15), 0.03, M["gold"]))
    sw.append(face("Banner", 1.6, 3.2, x, 9.9, FZ + 0.12, 0.0, signmat("banner_%d" % (int(abs(x)) % 3), 0.6)))
# gilded pilasters along the wall's ends (over the hall's floor) and the frieze under the eaves
for u in (-24.5, -20.5, -16.6, 17.4, 21.5, 25.5):
    sw.append(slab("Pilaster", u - 0.28, u + 0.28, FZ, FZ + 0.16, HALL_Y, EAVE, M["goldleaf"], 0.01))
sw.append(slab("Frieze", HX0, HX1, FZ, FZ + 0.08, EAVE - 0.6, EAVE - 0.2, M["goldleaf"], 0.01))
parts += sw

# ---- the hall's floor and its far walls ---------------------------------------------------------------------------------------------
parts.append(slab("HallFloor", HX0, HX1, HZ0, HZ1, HALL_Y - 0.2, HALL_Y, M["carpet"]))
BOX_Y1 = BOX_Y0 + 2.6  # the opera boxes' curtains' tops (their floor kit.BOX_Y0, over the crowd's heads)
WIN_Y0, WIN_Y1 = 9.0, 13.6


def wall_at(axis, fixed, face_):
    def box_(name, u0, u1, d0, d1, y0, y1, m, bev=0.0):
        if axis == "x":
            return slab(name, fixed - face_ * d0, fixed - face_ * d1, u0, u1, y0, y1, m, bev)
        return slab(name, u0, u1, fixed - face_ * d0, fixed - face_ * d1, y0, y1, m, bev)

    def pic(name, u, d, y, w_, h_, m):
        if axis == "x":
            return plane(name, w_, h_, g(fixed - face_ * d, y, u), m, rot=(PI / 2, 0, -PI / 2 if face_ > 0 else PI / 2))
        return plane(name, w_, h_, g(u, y, fixed - face_ * d), m, rot=(PI / 2, 0, PI if face_ > 0 else 0))

    return box_, pic


def hall_wall(name, axis, fixed, a0, a1, face_, n_bays, out):
    """A hall wall: midnight damask to the eaves over a walnut dado, gilded pilasters, an opera box in every bay (a gold-leaf front, a
    velvet rail, curtains drawn back, a sconce, two little gilt chairs), an arched window on the night over each, a gold frieze."""
    box_, pic = wall_at(axis, fixed, face_)
    if axis == "x":
        out.append(slab(name, fixed, fixed + face_ * 0.4, a0, a1, HALL_Y, EAVE + 1.0, M["damask"]))
    else:
        out.append(slab(name, a0, a1, fixed, fixed + face_ * 0.4, HALL_Y, EAVE + 1.0, M["damask"]))
    out.append(box_(name + "Dado", a0, a1, 0, 0.05, HALL_Y, BOX_Y0 - 0.4, M["walnut"]))
    out.append(box_(name + "DadoCap", a0, a1, 0, 0.09, BOX_Y0 - 0.46, BOX_Y0 - 0.36, M["gold"], 0.01))
    out.append(box_(name + "Frieze", a0, a1, 0, 0.06, EAVE - 0.7, EAVE - 0.2, M["goldleaf"], 0.01))
    step = (a1 - a0) / n_bays
    for k in range(n_bays + 1):
        u = a0 + k * step
        out.append(box_("Pilaster", u - 0.26, u + 0.26, 0, 0.16, BOX_Y0 - 0.4, EAVE - 0.7, M["goldleaf"], 0.01))
        out.append(box_("PilasterCap", u - 0.36, u + 0.36, 0, 0.24, EAVE - 1.1, EAVE - 0.7, M["gold"], 0.01))
    for k in range(n_bays):
        c = a0 + (k + 0.5) * step
        w_ = step * 0.72
        # the opera box: its floor and front out from the wall, the dark inside, curtains, a sconce, two chairs
        out.append(box_("BoxInside", c - w_ / 2, c + w_ / 2, 0, 0.02, BOX_Y0, BOX_Y1 + 0.4, M["midnight"]))
        out.append(box_("BoxFloor", c - w_ / 2, c + w_ / 2, 0, 1.2, BOX_Y0 - 0.12, BOX_Y0, M["walnut"]))
        out.append(box_("BoxFront", c - w_ / 2 - 0.05, c + w_ / 2 + 0.05, 1.1, 1.3, BOX_Y0 - 0.7, BOX_Y0 + 0.75, M["goldleaf"], 0.02))
        out.append(box_("BoxRail", c - w_ / 2 - 0.05, c + w_ / 2 + 0.05, 1.08, 1.32, BOX_Y0 + 0.75, BOX_Y0 + 0.86, M["velvet"], 0.02))
        out.append(box_("BoxCrown", c - w_ / 2 - 0.1, c + w_ / 2 + 0.1, 0, 0.5, BOX_Y1 + 0.4, BOX_Y1 + 0.62, M["goldleaf"], 0.02))
        for s in (-1, 1):
            out.append(box_("BoxCurtain", c + s * (w_ / 2 - 0.25) - 0.25, c + s * (w_ / 2 - 0.25) + 0.25, 0.05, 0.35, BOX_Y0, BOX_Y1 + 0.4, M["velvet"], 0.03))
            out.append(box_("BoxChair", c + s * 0.5 - 0.22, c + s * 0.5 + 0.22, 0.3, 0.75, BOX_Y0, BOX_Y0 + 0.95, M["crimson"], 0.03))
        out.append(box_("Light_Sconce", c - 0.08, c + 0.08, 0.05, 0.2, BOX_Y1, BOX_Y1 + 0.22, M["lamp"]))
        # the arched window over it, on the night
        ww = step * 0.5
        out.append(box_("WinFrame", c - ww / 2 - 0.2, c + ww / 2 + 0.2, 0, 0.12, WIN_Y0 - 0.2, WIN_Y1, M["goldleaf"], 0.01))
        out.append(pic("Night", c, 0.13, (WIN_Y0 + WIN_Y1 - 0.6) / 2, ww, WIN_Y1 - WIN_Y0 - 0.6, M["night"] if R.random() < 0.3 else M["night2"]))
        for j in range(5):  # the arch's head: steps of gold over the pane
            t0, t1 = j / 5, (j + 1) / 5
            hh = 0.6 * (1 - math.cos((t0 + t1) / 2 * PI / 2))
            out.append(box_("ArchStep", c - ww / 2 + ww * t0 / 2, c - ww / 2 + ww * t1 / 2, 0.12, 0.16, WIN_Y1 - 0.6 + (0.6 - hh) * 0 + hh, WIN_Y1, M["goldleaf"]))
            out.append(box_("ArchStep", c + ww / 2 - ww * t1 / 2, c + ww / 2 - ww * t0 / 2, 0.12, 0.16, WIN_Y1 - 0.6 + hh, WIN_Y1, M["goldleaf"]))
        out.append(box_("Mullion", c - 0.04, c + 0.04, 0.13, 0.17, WIN_Y0, WIN_Y1 - 0.3, M["gold"]))


hall_wall("WallFar", "x", HX1, HZ0, HZ1, 1, 8, parts)
hall_wall("WallEnd", "z", HZ1, HX0, HX1, 1, 10, parts)
hall_wall("WallNear", "x", HX0, HZ0, HZ1, -1, 8, ceiling)

# ---- the grandstands ---------------------------------------------------------------------------------------------------------------
SECTION = [M["seat_red"], M["seat_red"], M["seat_gold"], M["seat_red"], M["seat_navy"]]


def seat(along_, y, a, axis, d, m):
    """One velvet theatre seat: a pan, a back and a gold-capped arm, facing -d along the stand's axis."""
    out = []
    if axis == "x":
        out.append(slab("SeatPan", along_ - 0.22, along_ + 0.22, a - 0.22, a + 0.22, y, y + 0.08, m))
        out.append(slab("SeatBack", along_ + d * 0.18, along_ + d * 0.27, a - 0.21, a + 0.21, y + 0.08, y + 0.52, m))
    else:
        out.append(slab("SeatPan", a - 0.22, a + 0.22, along_ - 0.22, along_ + 0.22, y, y + 0.08, m))
        out.append(slab("SeatBack", a - 0.21, a + 0.21, along_ + d * 0.18, along_ + d * 0.27, y + 0.08, y + 0.52, m))
    return out


def grandstand(s, out):
    T = STAND
    d = s["dir"]
    for k in range(T["tiers"]):
        h = T["rise"] * (k + 1)
        a0_, a1_ = s["front"] + d * k * T["depth"], s["front"] + d * (k + 1) * T["depth"]
        if s["axis"] == "x":
            out.append(slab("Tier", a0_, a1_, s["a0"], s["a1"], HALL_Y, HALL_Y + h, M["concrete"]))
            out.append(slab("TierEdge", a0_, a0_ + d * 0.05, s["a0"], s["a1"], HALL_Y + h - 0.04, HALL_Y + h, M["gold"]))
        else:
            out.append(slab("Tier", s["a0"], s["a1"], a0_, a1_, HALL_Y, HALL_Y + h, M["concrete"]))
            out.append(slab("TierEdge", s["a0"], s["a1"], a0_, a0_ + d * 0.05, HALL_Y + h - 0.04, HALL_Y + h, M["gold"]))
        along = s["front"] + d * (k + 0.5) * T["depth"]
        a = s["a0"] + 0.5
        i = 0
        while a < s["a1"] - 0.3:
            if i % 10 != 9:  # (the aisles: the game leaves the same gaps in its crowd)
                sec = SECTION[(int((a - s["a0"]) / 9) + k // 3) % len(SECTION)]
                out += seat(along - d * 0.1, HALL_Y + h, a, s["axis"], d, sec)
            a += 0.95
            i += 1
    top = HALL_Y + T["rise"] * T["tiers"]
    back = s["front"] + d * T["tiers"] * T["depth"]
    if s["axis"] == "x":
        out.append(slab("FrontWall", s["front"], s["front"] + d * 0.12, s["a0"], s["a1"], HALL_Y, -0.55, M["walnut"]))
        out.append(slab("FrontRail", s["front"], s["front"] + d * 0.14, s["a0"], s["a1"], -0.55, -0.48, M["brass"]))
        out.append(slab("BackWall", back, back + d * 0.3, s["a0"], s["a1"], HALL_Y, top + 1.1, M["walnut"]))
        out.append(slab("BackRail", back - d * 0.1, back, s["a0"], s["a1"], top + 0.95, top + 1.02, M["brass"]))
    else:
        out.append(slab("FrontWall", s["a0"], s["a1"], s["front"], s["front"] + d * 0.12, HALL_Y, -0.55, M["walnut"]))
        out.append(slab("FrontRail", s["a0"], s["a1"], s["front"], s["front"] + d * 0.14, -0.55, -0.48, M["brass"]))
        out.append(slab("BackWall", s["a0"], s["a1"], back, back + d * 0.3, HALL_Y, top + 1.1, M["walnut"]))
        out.append(slab("BackRail", s["a0"], s["a1"], back - d * 0.1, back, top + 0.95, top + 1.02, M["brass"]))


stand_parts = {False: [], True: []}
for s in STANDS:
    grandstand(s, stand_parts[s["coach"]])
parts.append(join(stand_parts[False], "Stands"))
ceiling.append(join(stand_parts[True], "StandNear"))

# ---- the roof (the Coach Cam's): a coffered vault in navy and gold on gilded trusses, two crystal chandeliers, banners ----------------
C = []
SEG = 16
span = HX1 - HX0


def vault_y(t):
    return EAVE + (RIDGE - EAVE) * math.sin(t * PI)


vv, ff = [], []
for i in range(SEG + 1):
    t = i / SEG
    x = HX0 + span * t
    vv += [(x, vault_y(t), HZ0), (x, vault_y(t), HZ1)]
for i in range(SEG):
    ff.append([i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1])
C.append(mesh_from("Vault", vv, ff, M["damask"]))
for z in (HZ0, HZ1):
    gv = [(HX0, EAVE, z)] + [(HX0 + span * i / SEG, vault_y(i / SEG), z) for i in range(SEG + 1)] + [(HX1, EAVE, z)]
    C.append(mesh_from("Gable", gv, [list(range(len(gv)))], M["damask"]))
ribs = []
for i in range(1, SEG):  # the coffers' ribs along the vault
    t = i / SEG
    ribs.append(slab("RibLong", HX0 + span * t - 0.12, HX0 + span * t + 0.12, HZ0, HZ1, vault_y(t) - 0.25, vault_y(t) - 0.05, M["goldleaf"]))
z = HZ0 + 3.0
while z < HZ1 - 2:
    for i in range(SEG):
        t0, t1 = i / SEG, (i + 1) / SEG
        a = g(HX0 + span * t0, vault_y(t0) - 0.3, z)
        b = g(HX0 + span * t1, vault_y(t1) - 0.3, z)
        ribs.append(tube("Truss", [a, b], 0.09, M["gold"], 1, 6))
        a2 = g(HX0 + span * t0, vault_y(t0) - 1.6, z)
        b2 = g(HX0 + span * t1, vault_y(t1) - 1.6, z)
        ribs.append(tube("TrussLow", [a2, b2], 0.06, M["gold"], 1, 6))
        ribs.append(tube("TrussLace", [a, b2], 0.035, M["gold"], 1, 4))
    z += 6.5
C.append(join(ribs, "Ribs"))


def chandelier(cx_, cy_, cz_):
    """Three tiers of brass rings hung with crystal drops, candle bulbs round each, a chain to the vault."""
    out = [cyl("Chain", 0.03, RIDGE - 0.4 - (cy_ + 1.6), g(cx_, cy_ + 1.6, cz_), M["gold"], 6)]
    for k, (r, y) in enumerate(((1.6, 0.0), (1.1, 0.7), (0.6, 1.3))):
        out.append(torus("ChRing", r, 0.05, g(cx_, cy_ + y, cz_), M["gold"], 24, 5))
        n = int(r * 9)
        for j in range(n):
            a = j * 2 * PI / n
            px, pz = cx_ + math.cos(a) * r, cz_ + math.sin(a) * r
            out.append(sphere("Drop", 0.07, g(px, cy_ + y - 0.32, pz), M["crystal"], 6, 4, scale=(1, 1, 1.8)))
            out.append(rod("DropWire", (px, cy_ + y, pz), (px, cy_ + y - 0.25, pz), 0.006, M["gold"], 4))
            if j % 2 == 0:
                out.append(cyl("Light_Candle", 0.045, 0.16, g(px, cy_ + y + 0.04, pz), M["chandelier"], 6))
    out.append(sphere("ChBowl", 0.5, g(cx_, cy_ - 0.2, cz_), M["gold"], 14, 8, scale=(1, 1, 0.6)))
    out.append(sphere("ChDrop", 0.18, g(cx_, cy_ - 0.75, cz_), M["crystal"], 10, 6, scale=(1, 1, 1.6)))
    out.append(cyl("Light_Chandelier", 0.3, 0.05, g(cx_, cy_ + 0.05, cz_), M["chandelier"], 10))
    return out


for cz_ in (-9.0, 17.0):
    C += chandelier(CX, 18.0, cz_)
for k, (x, z) in enumerate(((-9.0, 9.0), (-3.0, 12.0), (4.0, 12.0), (10.0, 9.0), (-6.0, -4.0), (7.0, -4.0))):
    C.append(plane("HangingBanner", 2.0, 4.0, g(x, 15.5, z), signmat("banner_%d" % (k % 3), 0.6), rot=(PI / 2, 0, PI)))
    C.append(plane("HangingBannerB", 2.0, 4.0, g(x, 15.5, z + 0.02), signmat("banner_%d" % (k % 3), 0.6), rot=(PI / 2, 0, 0)))
    C.append(rod("BannerRod", (x - 1.1, 17.55, z + 0.01), (x + 1.1, 17.55, z + 0.01), 0.03, M["gold"]))
ceiling += C

# ---- the deck's paint: the red carpet along the stage, the lane numbers past the turning end, GRAND GALA at the open end -------------
CARPET_Z0, CARPET_Z1 = DECK["z0"] + 0.05, -13.4
floor.append(flat("RedCarpet", 2 * (DOORS_X + 0.9), CARPET_Z1 - CARPET_Z0, 0.0, 0.004, (CARPET_Z0 + CARPET_Z1) / 2, sm("carpet_red", "#9c1d30", 0.9)))
for z in (CARPET_Z0 + 0.06, CARPET_Z1 - 0.06):
    floor.append(flat("CarpetEdge", 2 * (DOORS_X + 0.9), 0.07, 0.0, 0.005, z, sm("carpet_gold", "#d9ae4a", 0.5)))
for i, x in enumerate(LANES):
    floor.append(flat_text("LaneNumber", str(i + 1), 0.7, M["navy"], g(x, 0.006, HZ + 1.6), PI / 2, 0.002, "BarlowCondensed-Black", rx=0))
floor.append(flat_text("GalaPaint", "GRAND GALA", 0.62, sm("paint_gold", "#b8913c", 0.5), g(0, 0.006, HZ + 3.9), 0, 0.002, "BarlowCondensed-Black", rx=0))

if LOOK:
    look("shell_overview", g(4, 0, 2), 50, 48, -90, (1280, 720), 16, 30)
    look("shell_wall", g(0.4, 5, -15), 22, 10, 0, (1280, 720), 16, 30)
    look("shell_stands", g(20, 2, 4), 22, 18, 220, (1280, 720), 16, 30)
save_part("shell", parts)
save_part("ceiling", ceiling)
save_part("floor", floor)
