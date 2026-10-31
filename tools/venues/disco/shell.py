"""The Aqua Disco's room, modelled in place in game coordinates: the black glass dance floor wall to wall, the pool's deep-blue
glass basin (a mirror-tile starburst in its floor) with its polished black coping, gutter and the violet and gold band; the
ladders; the walls: a black gloss dado under a chrome rail, buttoned velvet bays between mirror-mosaic columns with gold capitals,
a gold cornice with a neon cove, acoustic slats above; the back wall's grand entrance (a stepped gold surround, mirror pilasters,
marquee bulbs) under the frames of the game's neon sign and equaliser; the far end's stage backdrop (a mirror arch, velvet drapes,
the AQUA DISCO crest, fluted columns); and, for the Coach Cam only (ceiling.glb, kit.COACH_PARTS), the near wall's upper part and the
ceiling: a coffered deco vault over the pool with neon rings, the lighting truss and its fixtures, the mirror ball's motor.

Writes WORK/parts/shell.glb, ceiling.glb and floor.glb (the deck's paint: the zones' numbers).

    blender -b -P tools/venues/disco/shell.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(9)
LOOK = "--look" in args()

M = dict(
    deck=tmat_tile("glassfloor", "#16101f", 0.15),
    band=tmat_tile("mosaic_band", "#4a2c86", 0.2),
    basin=tmat_tile("glass_mosaic", "#1f6fd6", 0.15),
    quilt=tmat_tile("quilt", "#5a1a5e", 0.85, tint="#6a2266"),
    quilt_teal=tmat_tile("quilt", "#0f4a5a", 0.85, tint="#1a5a6a"),
    acoustic=tmat_tile("acoustic", "#2b2034", 0.9),
    mirror=tmat_tile("mirrortile", "#dfe4f0", 0.08),
    terrazzo=tmat_tile("terrazzo", "#16131c", 0.3),
    coping=sm("granite"),
    gloss=sm("black_gloss"),
    matte=sm("black_matte"),
    ink=sm("ink"),
    violet=sm("violet"),
    violet_light=sm("violet_light"),
    velvet=sm("velvet"),
    chrome=sm("chrome"),
    gold=sm("gold"),
    steel=sm("steel"),
    truss=sm("truss"),
    lane=sm("lane_gold", "#d9a441", 0.3),
    star=sm("star_silver", "#e6ecf8", 0.2),
    gutter=sm("gutter_dark", "#0e0c14", 0.6),
    dark=sm("doorway_dark", "#050308", 0.9),
    neon_pink=lamp_mat("neon_pink", "#ff4fc0", 6.0),
    neon_cyan=lamp_mat("neon_cyan", "#3ae8ff", 6.0),
    neon_gold=lamp_mat("neon_gold", "#ffd24a", 6.0),
    bulb=lamp_mat("marquee_bulb", "#fff0c8", 5.0),
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


def neon(name, pts, m, r=0.025):
    """A neon tube along game points (a lamp: it glows, and the game lights it with the room)."""
    return poly_tube(name, [g(*p) for p in pts], r, m, 6, 0.04)


# ---- the floor: glass dance floor, coping, gutter, band -----------------------------------------------------------------------------
X0, X1 = -WALL_X, WALL_X
Z0, Z1 = FACE_Z, END_Z
COP, GUT, BAND = 0.4, (0.42, 0.62), (0.72, 1.42)
parts.append(ring("Deck", HX + GUT[1], HZ + GUT[1], 0, 0, -0.3, 0.0, M["deck"], outer=(X0, X1, Z0, Z1)))
parts.append(ring("Band", HX + BAND[0], HZ + BAND[0], HX + BAND[1], HZ + BAND[1], -0.02, 0.004, M["band"]))
parts.append(ring("GutterSlot", HX + GUT[0], HZ + GUT[0], HX + GUT[1], HZ + GUT[1], -0.06, -0.01, M["gutter"]))
cop = ring("Coping", HX, HZ, HX + COP, HZ + COP, -0.06, 0.045, M["coping"])
bevel(cop, 0.03, 2, angle=30)
parts.append(cop)
# a thin chrome line along the coping's outer edge (the game's LED strip rides over the gutter beside it)
parts.append(ring("CopingChrome", HX + COP, HZ + COP, HX + COP + 0.02, HZ + COP + 0.02, -0.02, 0.05, M["chrome"]))
# gold inlay lines in the floor: a frame round the band, and spokes out from the pool's corners
inlay = [ring("Inlay", HX + 1.6, HZ + 1.6, HX + 1.66, HZ + 1.66, -0.01, 0.003, M["gold"])]
for sx in (-1, 1):
    for sz in (-1, 1):
        a = (sx * (HX + 1.66), sz * (HZ + 1.66))
        b = (sx * (HX + 4.6), sz * (HZ + 4.0 if sz < 0 else HZ + 2.2))
        d = math.atan2(b[1] - a[1], b[0] - a[0])
        L = math.dist(a, b)
        o = gbx("Spoke", -L / 2, L / 2, -0.01, 0.003, -0.03, 0.03, M["gold"], 0)
        o.location = g((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)
        o.rotation_euler = (0, 0, -d)
        apply_all(o)
        inlay.append(o)
parts.append(join(inlay, "Inlays"))

# ---- the basin: deep-blue glass, a mirror starburst in its floor, the band's frieze at the waterline ------------------------------
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
# the starburst: rays of silver mirror tile from a gold disc in the middle of the floor, and a ring round them
burst = [cyl("BurstDisc", 1.1, 0.008, g(0, FLOOR_Y, 0), M["lane"], 32)]
for k in range(16):
    a = k * math.tau / 16
    L = 5.6 if k % 2 == 0 else 3.6
    w_ = 0.42 if k % 2 == 0 else 0.3
    pts = [(math.cos(a) * 1.1 - math.sin(a) * w_ / 2, math.sin(a) * 1.1 + math.cos(a) * w_ / 2), (math.cos(a) * L, math.sin(a) * L * (HZ - 0.8) / 5.6), (math.cos(a) * 1.1 + math.sin(a) * w_ / 2, math.sin(a) * 1.1 - math.cos(a) * w_ / 2)]
    burst.append(mesh_from("Ray", [(x, FLOOR_Y + 0.006, z) for x, z in pts], [[0, 1, 2]], M["star"]))
burst.append(torus("BurstRing", 1.25, 0.05, g(0, FLOOR_Y + 0.004, 0), M["lane"], 40, 3))
burst[-1].scale = (1, 1, 0.1)
apply_all(burst[-1])
parts.append(join(burst, "Starburst"))
uw = []
for sx in (-1, 1):
    for z in (-6, -2, 2, 6):
        uw.append(torus("UWRing", 0.2, 0.03, g(sx * (HX - 0.005), -0.78, z), M["chrome"], 20, 6, rot=(0, PI / 2, 0)))
        lens = cyl("UnderwaterLight", 0.17, 0.01, g(sx * (HX - 0.004), -0.78, z), sm("uw_lens", "#e9f5f2", 0.15), 18, rot=(0, PI / 2, 0))
        lens.name = "UnderwaterLight"
        parts.append(lens)
parts.append(join(uw, "UWRings"))


def ladder(x, z):
    out = -1 if x < 0 else 1
    rails = []
    for zz in (z - 0.45, z + 0.45):
        rails.append(poly_tube("LadderRail", [g(x - out * 0.12, -1.0, zz), g(x - out * 0.12, 0.35, zz), g(x + out * 0.18, 0.92, zz), g(x + out * 0.55, 0.62, zz), g(x + out * 0.55, 0.06, zz)], 0.026, M["chrome"], 10, 0.22))
        rails.append(cyl("LadderFoot", 0.05, 0.02, g(x + out * 0.55, 0.055, zz), M["gold"], 14))
    for y in (-0.88, -0.5, -0.12):
        rails.append(gbx("Rung", x - out * 0.2, x - out * 0.04, y - 0.02, y + 0.02, z - 0.45, z + 0.45, M["chrome"], 0.006))
    return join(rails, "Ladder")


parts.append(ladder(-HX, 5.0))
parts.append(ladder(HX, -4.1))

# ---- the long walls ------------------------------------------------------------------------------------------------------------------------
DADO, RAIL_Y, CORNICE = 1.1, 1.16, 3.5
PIERS = [-14.6, -11.0, -7.4, -3.7, 0.0, 3.7, 7.4, 10.6, 13.2]  # the columns along each long wall (z)
# (the wall fixtures: ring boards at z -6 (left) and -4.6 (right), the skimmer board at -2.6 (left), the fish net at -1.6 (right), the
# fuse box at 11.4 (right): their bays keep the velvet, the posters go elsewhere)
POSTERS = {1: [(-12.8, "poster_fever"), (5.55, "poster_splash"), (9.0, "poster_deep")], -1: [(1.85, "poster_synchro"), (-0.0 + 5.55, "poster_fever")]}


def long_wall(side):
    """One long wall (side -1: x -14, the near side; +1: x +14, the overview's backdrop). Returns (always, coach-only) objects."""
    x = side * WALL_X
    t = side * 0.4  # (the wall's thickness, outward)
    low, high = [], []
    zs, ze = Z0, Z1
    low.append(slab("WallCore", x, x + t, zs, ze, -0.3, DADO, M["gloss"]))
    low.append(slab("DadoCap", x - side * 0.05, x + t, zs, ze, DADO, RAIL_Y, M["gold"], 0.01))
    low.append(slab("Skirting", x - side * 0.04, x, zs, ze, 0, 0.12, M["chrome"], 0))
    up = high if side < 0 else low
    up.append(slab("WallUpper", x, x + t, zs, ze, RAIL_Y, CEIL_Y, M["acoustic"]))
    # velvet bays from the rail to the cornice, between the columns
    for a, b in zip(PIERS[:-1], PIERS[1:]):
        up.append(slab("Velvet", x - side * 0.06, x, a + 0.3, b - 0.3, RAIL_Y + 0.08, CORNICE - 0.12, M["quilt"] if side > 0 else M["quilt_teal"]))
        up.append(slab("BayFrame", x - side * 0.08, x - side * 0.05, a + 0.26, b - 0.26, CORNICE - 0.14, CORNICE - 0.1, M["gold"], 0))
    for z in PIERS:
        up.append(slab("Column", x - side * 0.16, x, z - 0.26, z + 0.26, RAIL_Y, CORNICE, M["mirror"]))
        up.append(slab("ColumnBase", x - side * 0.2, x, z - 0.3, z + 0.3, 0.0, RAIL_Y + 0.04, M["gloss"], 0.02))
        for k, (y0, y1, w_) in enumerate(((CORNICE - 0.06, CORNICE + 0.06, 0.34), (CORNICE + 0.06, CORNICE + 0.16, 0.3), (CORNICE + 0.16, CORNICE + 0.3, 0.24))):
            up.append(slab("Capital", x - side * (0.18 + 0.03 * (2 - k)), x, z - w_, z + w_, y0, y1, M["gold"], 0.01))
        # a deco fan of gold over each column, high on the slats
        up.append(cyl("Fan", 0.6, 0.04, g(x - side * 0.02, 6.2, z), M["gold"], 12, rot=(0, PI / 2, 0), r2=0.6))
    # the cornice and its neon cove: a gold band, a tube of light along its top (pink on the near side, cyan on the far)
    up.append(slab("Cornice", x - side * 0.22, x, zs, ze, CORNICE, CORNICE + 0.12, M["gold"], 0.01))
    up.append(slab("CoveLip", x - side * 0.34, x - side * 0.22, zs, ze, CORNICE + 0.06, CORNICE + 0.22, M["ink"], 0.01))
    up.append(neon("NeonCove", [(x - side * 0.27, CORNICE + 0.18, zs + 0.3), (x - side * 0.27, CORNICE + 0.18, ze - 0.3)], M["neon_pink"] if side < 0 else M["neon_cyan"], 0.03))
    # a second neon line along the top of the slats, and art-deco triple lines on the velvet's frames
    up.append(neon("NeonHigh", [(x - side * 0.05, 7.6, zs + 0.3), (x - side * 0.05, 7.6, ze - 0.3)], M["neon_gold"], 0.025))
    # posters in gold frames, on the velvet where no fixture hangs
    for z, name in POSTERS[side]:
        up.append(slab("PosterFrame", x - side * 0.1, x - side * 0.06, z - 0.62, z + 0.62, 1.55, 3.25, M["gold"], 0.01))
        up.append(plane("Poster", 1.1, 1.6, g(x - side * 0.105, 2.4, z), signmat(name, 0.5), rot=(PI / 2, 0, -side * PI / 2)))
    # wall lights: gold deco sconces with a glowing shell on each column, at 2.4 m
    for z in PIERS[1:-1]:
        up.append(slab("SconceBack", x - side * 0.2, x - side * 0.16, z - 0.12, z + 0.12, 2.1, 2.8, M["gold"], 0.01))
        lamp = cyl("Light_Sconce", 0.11, 0.36, g(x - side * 0.3, 2.25, z), M["neon_gold"], 8, r2=0.17)
        (high if side < 0 else lamp_objs).append(lamp)
    return low, high


# ---- neon art high on the walls: script words, palms, waves (lamps: they glow in their colour) --------------------------------------
def neon_word(word, x, y, z, rz, size, m):
    return flat_text("NeonWord", word, size, m, g(x, y, z), rz, 0.04, "Pacifico-Regular")


def neon_palm(cx, cy, z, face, m_trunk, m_leaf, s=1.0):
    """A neon palm on a wall: a curving trunk, five fronds arching out of its top (face: +1 toward +z, -1 toward -z)."""
    out = []
    trunk = [(cx + 0.25 * s * math.sin(t * 1.4), cy + t * 1.6 * s, z) for t in [k / 6 for k in range(7)]]
    out.append(neon("NeonTrunk", trunk, m_trunk, 0.03))
    tx, ty = trunk[-1][0], trunk[-1][1]
    for a in (-2.6, -1.9, -1.2, 1.2, 1.9, 2.6):
        pts = [(tx + math.sin(a) * 0.8 * s * t, ty + (math.cos(a) * 0.5 + 0.35 - 0.9 * t) * s * t, z) for t in [k / 6 for k in range(7)]]
        out.append(neon("NeonFrond", pts, m_leaf, 0.025))
    return out


def neon_waves(x0, x1, y, z, m):
    out = []
    for k in range(3):
        pts = [(x0 + (x1 - x0) * t, y - k * 0.28 + 0.12 * math.sin(t * 9 + k), z) for t in [i / 24 for i in range(25)]]
        out.append(neon("NeonWave", pts, m, 0.025))
    return out


art_always, art_coach = [], []
# the far long wall (+x, the overview's backdrop): Dance, Splash, Repeat in the bays between its columns
for word, z, m in (("Dance", -9.2, M["neon_pink"]), ("Splash", -1.85, M["neon_cyan"]), ("Repeat", 5.55, M["neon_gold"])):
    art_always.append(neon_word(word, WALL_X - 0.06, 4.9, z, -PI / 2, 1.1, m))
# the near wall (-x, the Coach Cam's): Aqua and Disco, and a palm between them
for word, z, m in (("Aqua", -9.2, M["neon_cyan"]), ("Disco", 5.55, M["neon_pink"])):
    art_coach.append(neon_word(word, -WALL_X + 0.06, 4.9, z, PI / 2, 1.1, m))
# the back wall's wings: a neon palm each side of the sign; the far end's wings: waves over the posters
for sx in (-1, 1):
    art_always += neon_palm(sx * 10.0, 4.2, FACE_Z + 0.08, 1, M["neon_gold"], M["neon_pink"] if sx < 0 else M["neon_cyan"], 1.1)
    art_always += neon_waves(sx * 9.2, sx * 12.6, 5.0, END_Z - 0.08, M["neon_cyan"] if sx < 0 else M["neon_pink"])
parts += art_always
ceiling += art_coach

lamp_objs = []
for side in (-1, 1):
    lo, hi = long_wall(side)
    parts += lo
    ceiling.extend(hi)

# ---- the back wall: the grand entrance under the frames of the game's sign and equaliser ---------------------------------------------------
FZ = FACE_Z
back = []
back.append(slab("BackCore", X0 - 0.4, X1 + 0.4, FZ - 0.5, FZ, -0.3, CEIL_Y, M["acoustic"]))
back.append(slab("BackDado", X0, X1, FZ, FZ + 0.04, 0, DADO, M["gloss"]))
back.append(slab("BackRail", X0, X1, FZ, FZ + 0.06, DADO, RAIL_Y, M["gold"], 0.01))
H_ = DOOR["half"]
DH = DOOR["height"]
# the opening's dark and the stepped gold surround (three steps out, rising to a peak over the door)
back.append(slab("DoorDark", -H_, H_, FZ - 0.3, FZ - 0.02, 0, DH, M["dark"]))
for k in range(3):
    w_, h_ = H_ + 0.12 + k * 0.16, DH + 0.12 + k * 0.16
    for sx in (-1, 1):
        back.append(slab("Surround", sx * (w_ - 0.08), sx * w_, FZ, FZ + 0.06 + k * 0.04, 0, h_, M["gold"] if k != 1 else M["ink"], 0.01))
    back.append(slab("SurroundTop", -w_, w_, FZ, FZ + 0.06 + k * 0.04, h_ - 0.08, h_, M["gold"] if k != 1 else M["ink"], 0.01))
# a terrazzo threshold and a black glass canopy over the door with a row of bulbs under its lip
back.append(slab("Threshold", -H_ - 0.5, H_ + 0.5, FZ, FZ + 0.9, 0, 0.012, M["terrazzo"]))
# mirror pilasters either side of the entrance
for sx in (-1, 1):
    back.append(slab("EntrancePilaster", sx * (H_ + 0.7), sx * (H_ + 1.3), FZ, FZ + 0.18, 0, CORNICE + 0.3, M["mirror"]))
    for y in (CORNICE + 0.3, CORNICE + 0.42):
        back.append(slab("PilasterCap", sx * (H_ + 0.62), sx * (H_ + 1.38), FZ, FZ + 0.24, y, y + 0.12, M["gold"], 0.01))
# the equaliser's chrome bezel (the game's screen sits in it at y 3.6) and the sign's panel with its marquee of bulbs
EW, EH, EY = EQ["w"], EQ["h"], EQ["y"]
for (x0, x1, y0, y1) in [(-EW / 2 - 0.14, EW / 2 + 0.14, EY - EH / 2 - 0.14, EY - EH / 2), (-EW / 2 - 0.14, EW / 2 + 0.14, EY + EH / 2, EY + EH / 2 + 0.14), (-EW / 2 - 0.14, -EW / 2, EY - EH / 2, EY + EH / 2), (EW / 2, EW / 2 + 0.14, EY - EH / 2, EY + EH / 2)]:
    back.append(slab("EqBezel", x0, x1, FZ, FZ + 0.08, y0, y1, M["chrome"], 0.01))
back.append(slab("EqBack", -EW / 2, EW / 2, FZ, FZ + 0.01, EY - EH / 2, EY + EH / 2, M["ink"]))
SW, SH, SY = SIGN["w"] + 0.6, SIGN["h"] + 0.5, SIGN["y"]
back.append(slab("SignPanel", -SW / 2, SW / 2, FZ, FZ + 0.012, SY - SH / 2, SY + SH / 2, M["ink"]))
for (x0, x1, y0, y1) in [(-SW / 2 - 0.12, SW / 2 + 0.12, SY - SH / 2 - 0.12, SY - SH / 2), (-SW / 2 - 0.12, SW / 2 + 0.12, SY + SH / 2, SY + SH / 2 + 0.12), (-SW / 2 - 0.12, -SW / 2, SY - SH / 2, SY + SH / 2), (SW / 2, SW / 2 + 0.12, SY - SH / 2, SY + SH / 2)]:
    back.append(slab("SignFrame", x0, x1, FZ, FZ + 0.1, y0, y1, M["gold"], 0.01))
bulbs = []
for k in range(26):
    x = -SW / 2 + 0.2 + k * (SW - 0.4) / 25
    for y in (SY - SH / 2 - 0.06, SY + SH / 2 + 0.06):
        bulbs.append(sphere("Bulb", 0.05, g(x, y, FZ + 0.13), M["bulb"], 6, 4))
for k in range(6):
    y = SY - SH / 2 + 0.2 + k * (SH - 0.4) / 5
    for x in (-SW / 2 - 0.06, SW / 2 + 0.06):
        bulbs.append(sphere("Bulb", 0.05, g(x, y, FZ + 0.13), M["bulb"], 6, 4))
back.append(join(bulbs, "NightGlow_Marquee"))
back[-1].name = "NightGlow_Marquee"
# the laser heads' brackets (the game's heads hang at y 4.6 at x -6, 0, 6)
for x in LASERS:
    back.append(slab("LaserBracket", x - 0.3, x + 0.3, FZ, FZ + 0.32, 4.3, 4.38, M["chrome"], 0.01))
# the back wall's velvet wings either side, with columns, posters and the cornice's neon
for sx in (-1, 1):
    a, b = sx * 4.6, sx * 13.6
    back.append(slab("BackVelvet", min(a, b), max(a, b), FZ, FZ + 0.05, RAIL_Y + 0.08, CORNICE - 0.12, M["quilt"]))
    for x in (sx * 4.4, sx * 8.6, sx * 13.6):
        back.append(slab("BackColumn", x - 0.26, x + 0.26, FZ, FZ + 0.16, RAIL_Y, CORNICE, M["mirror"]))
        back.append(slab("BackCapital", x - 0.32, x + 0.32, FZ, FZ + 0.2, CORNICE, CORNICE + 0.16, M["gold"], 0.01))
    back.append(slab("BackCornice", min(a, b), max(a, b), FZ, FZ + 0.22, CORNICE, CORNICE + 0.12, M["gold"], 0.01))
    back.append(neon("BackNeon", [(a, CORNICE + 0.18, FZ + 0.27), (b, CORNICE + 0.18, FZ + 0.27)], M["neon_pink"], 0.03))
    x = sx * 6.5
    back.append(slab("PosterFrame", x - 0.62, x + 0.62, FZ, FZ + 0.05, 1.55, 3.25, M["gold"], 0.01))
    back.append(plane("Poster", 1.1, 1.6, g(x, 2.4, FZ + 0.055), signmat("poster_deep" if sx < 0 else "poster_synchro", 0.5), rot=(PI / 2, 0, 0)))
    x = sx * 11.1
    back.append(slab("RulesFrame", x - 0.55, x + 0.55, FZ, FZ + 0.05, 1.4, 2.9, M["chrome"], 0.01))
    back.append(plane("Rules", 0.95, 1.3, g(x, 2.15, FZ + 0.055), signmat("disco_rules" if sx > 0 else "poster_splash", 0.5), rot=(PI / 2, 0, 0)))
parts += back

# ---- the far end: the stage's backdrop -------------------------------------------------------------------------------------------------
EZ = END_Z
end = []
end.append(slab("EndCore", X0 - 0.4, X1 + 0.4, EZ, EZ + 0.5, -0.3, CEIL_Y, M["acoustic"]))
end.append(slab("EndDado", X0, X1, EZ - 0.04, EZ, 0, DADO, M["gloss"]))
end.append(slab("EndRail", X0, X1, EZ - 0.06, EZ, DADO, RAIL_Y, M["gold"], 0.01))
# the mirror arch behind the stage: a half ring of mirror mosaic, a gold edge inside and out
SX, SZ = STAGE["x"], STAGE["z"]


def half_ring(name, r0, r1, y0, z, depth, m, n=24):
    pts = [(math.cos(k * PI / n) * r1, math.sin(k * PI / n) * r1) for k in range(n + 1)] + [(math.cos(k * PI / n) * r0, math.sin(k * PI / n) * r0) for k in range(n, -1, -1)]
    o = extrude_shape(name, pts, depth, g(SX, y0, z), m, rot=(PI / 2, 0, PI))
    return o


end.append(half_ring("MirrorArch", 3.0, 4.1, 0.0, EZ - 0.02, 0.18, M["mirror"]))
end.append(half_ring("ArchGoldOut", 4.1, 4.25, 0.0, EZ - 0.02, 0.24, M["gold"]))
end.append(half_ring("ArchGoldIn", 2.88, 3.0, 0.0, EZ - 0.02, 0.24, M["gold"]))
end.append(half_ring("ArchInside", 0.0, 2.88, 0.0, EZ - 0.01, 0.02, M["violet"]))
# rays of gold in the arch's inside (a sunburst behind Valentina)
for k in range(9):
    a = (k + 0.5) * PI / 9
    pts = [(math.cos(a - 0.05) * 0.6, math.sin(a - 0.05) * 0.6), (math.cos(a) * 2.8, math.sin(a) * 2.8), (math.cos(a + 0.05) * 0.6, math.sin(a + 0.05) * 0.6)]
    end.append(extrude_shape("ArchRay", pts, 0.01, g(SX, 0.0, EZ - 0.04), M["violet_light"], rot=(PI / 2, 0, PI)))
# the crest over the arch
end.append(slab("CrestFrame", -3.3, 3.3, EZ - 0.08, EZ, 4.5, 7.9, M["gold"], 0.02))
end.append(plane("Crest", 6.4, 3.2, g(0, 6.2, EZ - 0.085), signmat("aqua_disco_crest", 0.5), rot=(PI / 2, 0, PI)))


# velvet drapes either side of the arch, gathered in folds, tied back with gold cord
def drape(x0, x1, y0, y1, z, folds, m):
    n = folds * 6
    vs, fs = [], []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        dz = 0.12 * math.sin(t * folds * math.tau)
        vs.append((x, y0, z - 0.15 - dz * 0.6))
        vs.append((x, y1, z - 0.15 - dz))
    for i in range(n):
        fs.append([i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1])
    return mesh_from("Drape", vs, fs, m)


for sx in (-1, 1):
    end.append(drape(sx * 4.4, sx * 7.4, 0.0, 6.4, EZ, 5, M["velvet"]))
    end.append(torus("DrapeTie", 0.28, 0.035, g(sx * 5.4, 2.4, EZ - 0.25), M["gold"], 16, 4))
    end.append(slab("Pelmet", sx * 4.2, sx * 7.6, EZ - 0.3, EZ, 6.3, 6.8, M["gold"], 0.02))
    # fluted columns at the arch's sides, and velvet bays with posters beyond
    for x in (sx * 8.0, sx * 13.6):
        end.append(slab("EndColumn", x - 0.28, x + 0.28, EZ - 0.18, EZ, RAIL_Y, CORNICE, M["mirror"]))
        end.append(slab("EndCapital", x - 0.34, x + 0.34, EZ - 0.22, EZ, CORNICE, CORNICE + 0.16, M["gold"], 0.01))
    a, b = sx * 8.3, sx * 13.3
    end.append(slab("EndVelvet", min(a, b), max(a, b), EZ - 0.05, EZ, RAIL_Y + 0.08, CORNICE - 0.12, M["quilt"]))
    end.append(slab("EndCornice", min(a, b), max(a, b), EZ - 0.22, EZ, CORNICE, CORNICE + 0.12, M["gold"], 0.01))
    end.append(neon("EndNeon", [(a, CORNICE + 0.18, EZ - 0.27), (b, CORNICE + 0.18, EZ - 0.27)], M["neon_cyan"], 0.03))
    x = sx * 10.8
    end.append(slab("PosterFrame", x - 0.62, x + 0.62, EZ - 0.05, EZ, 1.55, 3.25, M["gold"], 0.01))
    end.append(plane("Poster", 1.1, 1.6, g(x, 2.4, EZ - 0.055), signmat("poster_splash" if sx < 0 else "poster_fever", 0.5), rot=(PI / 2, 0, PI)))
# a neon outline round the arch (pink), and the high gold line across the end
end.append(neon("ArchNeon", [(SX + math.cos(k * PI / 24) * 4.35, math.sin(k * PI / 24) * 4.35, EZ - 0.2) for k in range(25)], M["neon_pink"], 0.035))
parts += end

# ---- the ceiling (the Coach Cam's only): a coffered vault over the pool, neon rings, the lighting truss ----------------------------
C = []
C.append(slab("CeilingFlat", X0 - 0.4, X1 + 0.4, Z0 - 0.5, Z1 + 0.5, CEIL_Y, CEIL_Y + 0.2, M["acoustic"]))
# the vault: three stepped rings rising over the pool, each lip lit by a neon line
for k, (hx, hz, y) in enumerate(((10.5, 12.0, CEIL_Y), (8.8, 10.4, CEIL_Y + 0.8), (7.0, 8.6, CEIL_Y + 1.6))):
    C.append(ring("Coffer", hx, hz, hx + 1.7, hz + 1.7, y - 0.2, y + 0.8, M["violet"]))
    C.append(ring("CofferGold", hx - 0.04, hz - 0.04, hx + 0.04, hz + 0.04, y - 0.24, y - 0.16, M["gold"]))
    C.append(neon("CofferNeon", [(-hx + 0.15, y - 0.1, -hz + 0.15), (hx - 0.15, y - 0.1, -hz + 0.15), (hx - 0.15, y - 0.1, hz - 0.15), (-hx + 0.15, y - 0.1, hz - 0.15), (-hx + 0.15, y - 0.1, -hz + 0.15)], [M["neon_pink"], M["neon_cyan"], M["neon_gold"]][k], 0.03))
C.append(slab("VaultTop", -7.2, 7.2, -8.8, 8.8, CEIL_Y + 2.4, CEIL_Y + 2.6, M["ink"]))
# a gold sunburst rose in the vault's middle, round the mirror ball's motor
for k in range(24):
    a = k * math.tau / 24
    L = 3.6 if k % 2 == 0 else 2.4
    C.append(mesh_from("Rose", [(math.cos(a - 0.06) * 0.6, CEIL_Y + 2.38, math.sin(a - 0.06) * 0.6), (math.cos(a) * L, CEIL_Y + 2.38, math.sin(a) * L), (math.cos(a + 0.06) * 0.6, CEIL_Y + 2.38, math.sin(a + 0.06) * 0.6)], [[0, 1, 2]], M["gold"]))
C.append(cyl("BallMotor", 0.25, 0.3, g(0, CEIL_Y + 2.1, 0), M["chrome"], 12))
C.append(cyl("BallChain", 0.02, CEIL_Y + 2.1 - 8.5, g(0, 8.5, 0), M["chrome"], 6))


# the lighting truss: a box truss round the pool at 7.2 m on chains, moving heads and par cans hung from it
def truss_run(a, b, y):
    out = []
    L = math.dist(a, b)
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    for dy, dw in ((0, -0.15), (0, 0.15), (-0.3, -0.15), (-0.3, 0.15)):
        o = gbx("TrussChord", -L / 2, L / 2, y + dy - 0.025, y + dy + 0.025, dw - 0.025, dw + 0.025, M["truss"], 0)
        o.location = g((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)
        o.rotation_euler = (0, 0, -ang)
        apply_all(o)
        out.append(o)
    n = int(L / 0.5)
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        for dw in (-0.15, 0.15):
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            nx, nz = -math.sin(ang) * dw, math.cos(ang) * dw
            out.append(tube("TrussLace", [g(p0[0] + nx, y, p0[1] + nz), g(p1[0] + nx, y - 0.3, p1[1] + nz)], 0.012, M["truss"], 1, 3))
    return out


TY = 7.2
T = [(-9.0, -11.0), (9.0, -11.0), (9.0, 10.0), (-9.0, 10.0)]
for a, b in zip(T, T[1:] + T[:1]):
    C += truss_run(a, b, TY)
for x, z in T:
    C.append(cyl("TrussChain", 0.02, CEIL_Y - TY, g(x, TY, z), M["steel"], 4))


def moving_head(x, z):
    out = [cyl("HeadBase", 0.16, 0.12, g(x, TY - 0.42, z), M["ink"], 10)]
    out.append(gbx("HeadYoke", x - 0.18, x + 0.18, TY - 0.72, TY - 0.42, z - 0.04, z + 0.04, M["ink"], 0.01))
    out.append(sphere("HeadBody", 0.17, g(x, TY - 0.72, z), M["gloss"], 10, 6, scale=(1, 1, 1.2)))
    out.append(cyl("HeadLens", 0.09, 0.02, g(x, TY - 0.92, z), M["neon_cyan"], 10))
    return out


for k in range(8):
    x = -9.0 + k * 18.0 / 7
    for z in (-11.0, 10.0):
        C += moving_head(x, z)
for z in (-6.0, -1.0, 4.0):
    for x in (-9.0, 9.0):
        C += moving_head(x, z)
ceiling += C

# ---- what is painted on the floor (baked into the deck's picture): the zones' numbers at the near end -----------------------------------
for i, x in enumerate(ZONES):
    floor.append(plane("ZonePaint", 1.2, 0.6, g(x, 0.006, -HZ - 2.0), signmat("zone_%d" % (i + 1), 0.6), rot=(0, 0, -PI / 2)))

print("LAMPS", len(lamp_objs))
parts += lamp_objs
if LOOK:
    look("shell_overview", g(0, 0, -1), 38, 52, -90, (1280, 720), 16, 30)
    look("shell_back", g(0, 3.5, -15), 16, 10, 0, (1280, 720), 16, 30)
    look("shell_end", g(0, 3, 12), 16, 10, 180, (1280, 720), 16, 30)
    look("shell_far", g(13, 3, 0), 16, 12, 90, (1280, 720), 16, 30)
save_part("shell", parts)
save_part("ceiling", ceiling)
save_part("floor", floor)
