"""The Sunset Lagoon's beach, modelled in place in game coordinates on the sand (kit.ground_y): what the club's guests leave the
pool for, seen past the railings and from the Coach Cam.

- past the open end, at the foot of the steps: a signpost of painted arrows (BEACH, TIKI BAR, SURF, BONFIRE), tiki torches along
  the path, a sandcastle with a flag;
- the bonfire on the sand: a ring of stones, a teepee of logs and its flames (`Light_Bonfire`: a big warm glow and light after
  dusk), four driftwood logs to sit on round it;
- on the sea side: a volleyball net on bamboo poles with its court roped out on the sand and a ball; a red and white rowboat and
  an outrigger canoe drawn up near the water; the surf school's shack (planks, a straw roof, its board) with a rack of
  surfboards; a rack of kayaks; three striped beach umbrellas with towels.

    blender -b -P tools/venues/lagoon/props_beach.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(29)
LOOK = "--look" in args()
M = dict(
    timber=sm("timber"),
    timber_dark=sm("timber_dark"),
    driftwood=sm("timber_grey"),
    bamboo=sm("bamboo"),
    joint=sm("bamboo_joint"),
    rope=sm("rope"),
    thatch=tmat_tile("thatch", "#c99a52", 0.95),
    thatch_dry=sm("thatch_dry"),
    boards=tmat_tile("teak", "#b77b45", 0.5),
    stone=sm("stone_grey"),
    stone_dark=sm("stone_dark"),
    charcoal=sm("charcoal"),
    ember=sm("ember"),
    flame=lamp_mat("bonfire_flame", "#ff9a3a", 7.0),
    torch=lamp_mat("torch_flame", "#ffa040", 6.0),
    sand=sm("sand"),
    sand_dark=sm("sand_wet"),
    coral=sm("coral"),
    teal=sm("teal"),
    sun=sm("sun"),
    cream=sm("cream"),
    white=sm("white_paint"),
    red=sm("hull_red", "#d9503f", 0.5),
    navy=sm("navy"),
    canvas=sm("canvas"),
    canvas_teal=sm("canvas_teal"),
    canvas_coral=sm("canvas_coral"),
    canvas_sun=sm("canvas_sun"),
    t_teal=sm("towel_teal"),
    t_coral=sm("towel_coral"),
    t_sun=sm("towel_sun"),
    t_stripe=sm("towel_stripe"),
    kayak_y=sm("kayak_yellow", "#f2b52c", 0.35),
    kayak_o=sm("kayak_orange", "#ee6a2a", 0.35),
    kayak_b=sm("kayak_blue", "#2f86b8", 0.35),
)
parts = []
lamps = []


def gy(x, z):
    return ground_y(x, z)


def bamboo_pole(name, x, z, y0, h, r=0.045):
    out = [cyl(name, r, h, g(x, y0, z), M["bamboo"], 8)]
    y = 0.4
    while y < h - 0.1:
        out.append(cyl(name + "Joint", r * 1.18, 0.035, g(x, y0 + y, z), M["joint"], 8))
        y += 0.45
    return out


def torch(x, z, h=2.0):
    y0 = gy(x, z)
    out = bamboo_pole("TorchPole", x, z, y0 - 0.2, h + 0.2, 0.04)
    out.append(cyl("TorchCup", 0.11, 0.26, g(x, y0 + h - 0.02, z), M["thatch_dry"], 10, r2=0.07))
    lamps.append(cyl("Light_Torch", 0.08, 0.32, g(x, y0 + h + 0.22, z), M["torch"], 8, r2=0.0))
    return out


# ---- the path from the steps: a signpost, torches, a sandcastle -------------------------------------------------------------
STEPS_FOOT = ROOM["z1"] + 0.1 + 11 * 0.3  # (shell.py's steps end here)
sx, sz = 3.4, STEPS_FOOT + 1.2
y0 = gy(sx, sz)
post = cyl("SignPost", 0.07, 2.7, g(sx, y0 - 0.2, sz), M["driftwood"], 8)
parts.append(post)
for k, (name, rot) in enumerate((("arrow_beach", -0.5), ("arrow_bar", 0.4), ("arrow_surf", 1.2), ("arrow_bonfire", -1.1))):
    y = y0 + 2.3 - k * 0.42
    a = plane("Arrow", 1.05, 0.22, (0, 0, 0), signmat(name, 0.6), rot=(PI / 2, 0, 0))
    b = plane("ArrowBack", 1.05, 0.22, (0, 0, 0), M["timber"], rot=(PI / 2, 0, PI))
    b.location = (0, 0.012, 0)
    apply_all(b)
    arr = join([a, b], "Arrow")
    arr.location = g(sx + math.cos(rot) * 0.0, y, sz)
    arr.rotation_euler = (0, 0, rot)
    apply_all(arr)
    parts.append(arr)
for x, z in ((-3.4, STEPS_FOOT + 1.0), (3.4, STEPS_FOOT + 3.6), (-3.2, STEPS_FOOT + 5.0), (2.4, STEPS_FOOT + 7.6)):
    parts += torch(x, z)
# a sandcastle with a flag, a bucket and spade
cx_, cz_ = -7.6, STEPS_FOOT + 2.4
y0 = gy(cx_, cz_)
sc = [cyl("Castle", 1.0, 0.45, g(cx_, y0 - 0.05, cz_), M["sand_dark"], 14, r2=0.85), cyl("Keep", 0.55, 0.55, g(cx_, y0 + 0.4, cz_), M["sand_dark"], 12, r2=0.48)]
for k in range(4):
    a = k * PI / 2 + 0.3
    tx, tz = cx_ + math.cos(a) * 0.9, cz_ + math.sin(a) * 0.9
    sc.append(cyl("Tower", 0.24, 0.75, g(tx, y0 - 0.05, tz), M["sand_dark"], 10, r2=0.2))
    for j in range(5):
        b_ = j * math.tau / 5
        sc.append(gbx("Crenel", tx + math.cos(b_) * 0.17 - 0.04, tx + math.cos(b_) * 0.17 + 0.04, y0 + 0.7, y0 + 0.8, tz + math.sin(b_) * 0.17 - 0.04, tz + math.sin(b_) * 0.17 + 0.04, M["sand_dark"], 0))
sc.append(cyl("FlagStick", 0.012, 0.7, g(cx_, y0 + 0.95, cz_), M["driftwood"], 5))
sc.append(extrude_shape("Flag", [(0, 0), (0.32, -0.09), (0, -0.18)], 0.005, g(cx_ + 0.01, y0 + 1.63, cz_), M["coral"], rot=(PI / 2, 0, 0)))
sc.append(cyl("Bucket", 0.14, 0.24, g(cx_ + 1.5, y0, cz_ - 0.3), M["teal"], 12, r2=0.17))
sc.append(tube("Spade", [g(cx_ + 1.2, y0 + 0.05, cz_ + 0.5), g(cx_ + 1.55, y0 + 0.5, cz_ + 0.65)], 0.015, M["sun"], 1, 5))
parts.append(join(sc, "Sandcastle"))

# ---- the bonfire ------------------------------------------------------------------------------------------------------------
fx, fz = 8.5, ROOM["z1"] + 9.5
y0 = gy(fx, fz)
bf = []
for k in range(14):
    a = k * math.tau / 14
    bf.append(sphere("FireStone", 0.2, g(fx + math.cos(a) * 1.0, y0 + 0.08, fz + math.sin(a) * 1.0), M["stone"] if k % 2 else M["stone_dark"], 8, 5, scale=(1.2, 1.0, 0.75)))
bf.append(cyl("Ash", 0.85, 0.04, g(fx, y0 - 0.01, fz), M["charcoal"], 14))
for k in range(5):
    a = k * math.tau / 5
    bf.append(tube("FireLog", [g(fx + math.cos(a) * 0.65, y0 + 0.05, fz + math.sin(a) * 0.65), g(fx + math.cos(a) * 0.08, y0 + 0.95, fz + math.sin(a) * 0.08)], 0.07, M["ember"] if k % 2 else M["timber_dark"], 1, 6))
# the flames: three nested cones, leaning a little, the light's centre in the middle one
for k, (r, h, dx) in enumerate(((0.5, 1.1, 0.0), (0.32, 1.5, 0.08), (0.2, 1.8, -0.06))):
    fl = cyl("Light_Bonfire" if k == 1 else "Flame", r, h, g(fx + dx, y0 + 0.1, fz), M["flame"], 7, r2=0.0)
    fl.rotation_euler = (0.05 * (k - 1), 0.04 * k, k)
    (lamps if k == 1 else bf).append(fl)
for k in range(4):
    a = k * PI / 2 + 0.6
    lx, lz = fx + math.cos(a) * 2.6, fz + math.sin(a) * 2.6
    log = cyl("SeatLog", 0.24, 1.8, g(lx, gy(lx, lz) + 0.22, lz), M["driftwood"], 9, rot=(PI / 2, 0, a + PI / 2))
    log.location = g(lx, gy(lx, lz) + 0.22, lz)
    bf.append(log)
parts.append(join(bf, "Bonfire"))

# ---- the volleyball court on the sea side ------------------------------------------------------------------------------------
vx, vz = -24.5, 2.0
y0 = gy(vx, vz)
vb = []
for dz in (-3.6, 3.6):
    vb += bamboo_pole("NetPole", vx, vz + dz, y0 - 0.3, 2.85, 0.07)
    vb.append(tube("GuyRope", [g(vx, y0 + 2.5, vz + dz), g(vx, y0, vz + dz * 1.4)], 0.01, M["rope"], 1, 4))
vb.append(gbx("NetTape", vx - 0.02, vx + 0.02, y0 + 2.36, y0 + 2.43, vz - 3.6, vz + 3.6, M["white"], 0))
vb.append(gbx("NetBottom", vx - 0.01, vx + 0.01, y0 + 1.55, y0 + 1.58, vz - 3.6, vz + 3.6, M["white"], 0))
for k in range(36):
    z = vz - 3.6 + k * 0.2
    vb.append(gbx("NetCord", vx - 0.005, vx + 0.005, y0 + 1.56, y0 + 2.38, z - 0.005, z + 0.005, M["white"], 0))
for k in range(4):
    y = y0 + 1.6 + k * 0.2
    vb.append(gbx("NetCordH", vx - 0.005, vx + 0.005, y, y + 0.01, vz - 3.6, vz + 3.6, M["white"], 0))
# the court's lines: rope laid on the sand, 8 by 12 m
for (a, b) in [((-6, -4), (6, -4)), ((6, -4), (6, 4)), ((6, 4), (-6, 4)), ((-6, 4), (-6, -4))]:
    xa, za, xb, zb = vx + a[0], vz + a[1], vx + b[0], vz + b[1]
    if xa < SHORE_X + 1 or xb < SHORE_X + 1:
        continue
    vb.append(gbx("CourtLine", min(xa, xb) - 0.03, max(xa, xb) + 0.03, y0 + 0.0, y0 + 0.02, min(za, zb) - 0.03, max(za, zb) + 0.03, M["teal"], 0))
vb.append(sphere("Volleyball", 0.11, g(vx + 2.4, y0 + 0.1, vz + 1.6), M["cream"], 12, 8))
parts.append(join(vb, "Volleyball"))


# ---- the boats drawn up on the sand -----------------------------------------------------------------------------------------
def hull(name, L, W, H, top_m, bottom_m, x, z, ry, tilt=0.06):
    """A small boat's hull: a half-ellipsoid, white above a coloured band, its bench seats and oars."""
    out = []
    shell = sphere(name, 1.0, (0, 0, 0), top_m, 18, 10, scale=(L / 2, W / 2, H))
    bm = bmesh.new()
    bm.from_mesh(shell.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.001], context="VERTS")
    bm.to_mesh(shell.data)
    bm.free()
    shell.data.update()
    for p in shell.data.polygons:
        if sum(shell.data.vertices[i].co.z for i in p.vertices) / len(p.vertices) < -H * 0.55:
            p.material_index = 1
    shell.data.materials.append(bottom_m)
    solidify(shell, 0.04)
    out.append(shell)
    out.append(torus(name + "Gunwale", 1.0, 0.025, (0, 0, 0), M["timber_dark"], 24, 4))
    out[-1].scale = (L / 2, W / 2, 1)
    apply_all(out[-1])
    for xx in (-L * 0.18, L * 0.18):
        out.append(bx(name + "Thwart", xx - 0.1, xx + 0.1, -W / 2 + 0.06, W / 2 - 0.06, -0.12, -0.06, M["timber"], 0.01))
    o = join(out, name)
    o.location = g(x, gy(x, z) + H * 0.75, z)
    o.rotation_euler = (tilt, 0, ry)
    apply_all(o)
    return o


def solidify(o, t):
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = t
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


parts.append(hull("Rowboat", 3.8, 1.5, 0.55, M["white"], M["red"], -30.0, -8.0, 0.5))
parts.append(tube("Oar", [g(-29.6, gy(-29.6, -7.2) + 0.25, -7.2), g(-28.0, gy(-28, -6.4) + 0.05, -6.4)], 0.03, M["timber"], 1, 5))
parts.append(gbx("OarBlade", -28.2, -27.7, gy(-28, -6.4) + 0.02, gy(-28, -6.4) + 0.05, -6.55, -6.25, M["timber"], 0.01))
# the outrigger canoe: a long slender hull, two booms out to a float
ox, oz = -31.0, 11.0
canoe = [hull("Canoe", 5.2, 0.7, 0.4, M["teal"], M["timber_dark"], ox, oz, 1.45, 0.0)]
yb = gy(ox, oz) + 0.45
for d in (-0.9, 0.9):
    canoe.append(tube("Boom", [g(ox, yb, oz + d), g(ox + 1.9, yb - 0.05, oz + d)], 0.04, M["driftwood"], 1, 5))
fl = cyl("Float", 0.12, 3.2, g(ox + 1.9, yb - 0.25, oz - 1.6), M["driftwood"], 8, rot=(PI / 2, 0, 0))
fl.location = g(ox + 1.9, yb - 0.25, oz - 1.6)
canoe.append(fl)
parts.append(join(canoe, "Outrigger"))

# ---- the surf school's shack and its boards ---------------------------------------------------------------------------------
shx, shz = -26.5, -16.0
y0 = gy(shx, shz)
sh = []
sh.append(gbx("ShackFloor", shx - 1.8, shx + 1.8, y0 - 0.1, y0 + 0.25, shz - 1.5, shz + 1.5, M["timber_dark"], 0.02))
sh.append(gbx("ShackBody", shx - 1.6, shx + 1.2, y0 + 0.25, y0 + 2.6, shz - 1.3, shz + 1.3, M["boards"], 0.02))
sh.append(gbx("ShackHatch", shx + 1.2, shx + 1.25, y0 + 1.1, y0 + 2.1, shz - 0.9, shz + 0.9, sm("window_dark", "#2a2622", 0.4), 0))
sh.append(gbx("ShackCounter", shx + 1.2, shx + 1.55, y0 + 1.05, y0 + 1.12, shz - 1.0, shz + 1.0, M["timber"], 0.01))
roof = cyl("ShackRoof", 2.6, 1.4, g(shx - 0.2, y0 + 2.55, shz), M["thatch"], 4, r2=0.05, rot=(0, 0, PI / 4))
sh.append(roof)
sh.append(plane("SurfSchool", 2.4, 0.6, g(shx + 1.26, y0 + 2.35, shz), signmat("surf_school", 0.6), rot=(PI / 2, 0, -PI / 2)))
rack = []
for k in range(5):
    z = shz + 2.2 + k * 0.42
    b = sphere("Surfboard", 1.0, (0, 0, 0), [M["coral"], M["sun"], M["teal"], M["cream"], M["coral"]][k], 14, 8, scale=(0.27, 0.06, 1.05))
    b.location = g(shx + 0.6, y0 + 1.05, z)
    b.rotation_euler = (0, math.radians(10), math.radians(R.uniform(-4, 4)))
    apply_all(b)
    rack.append(b)
for z in (shz + 1.9, shz + 4.2):
    rack.append(cyl("RackPost", 0.05, 1.4, g(shx + 0.25, y0, z), M["bamboo"], 8))
rack.append(cyl("RackBar", 0.04, 2.4, g(shx + 0.25, y0 + 1.25, shz + 1.85), M["bamboo"], 8, rot=(PI / 2, 0, 0)))
rack[-1].location = g(shx + 0.25, y0 + 1.25, shz + 1.85)
sh += rack
parts.append(join(sh, "SurfShack"))
# a rack of kayaks
kx, kz = -22.5, -12.0
y0 = gy(kx, kz)
ky = []
for dz in (-1.2, 1.2):
    ky.append(gbx("KayakRackLeg", kx - 0.05, kx + 0.05, y0, y0 + 1.3, kz + dz - 0.05, kz + dz + 0.05, M["timber"], 0.01))
for k, (y, m) in enumerate(((0.45, M["kayak_y"]), (0.95, M["kayak_o"]))):
    ky.append(gbx("KayakRackBar", kx - 0.45, kx + 0.45, y0 + y - 0.06, y0 + y - 0.02, kz - 1.25, kz + 1.25, M["timber"], 0.005))
    kk = sphere("Kayak", 1.0, g(kx, y0 + y + 0.12, kz), m, 14, 6, scale=(0.32, 1.6, 0.16))
    ky.append(kk)
ky.append(sphere("Kayak", 1.0, g(kx + 1.4, y0 + 0.12, kz + 0.4), M["kayak_b"], 14, 6, scale=(0.32, 1.6, 0.16)))
parts.append(join(ky, "Kayaks"))


# ---- striped beach umbrellas with towels on the sand ------------------------------------------------------------------------
def umbrella(x, z, mats):
    y0 = gy(x, z)
    out = [cyl("UmbPole", 0.03, 2.4, g(x, y0 - 0.3, z), M["white"], 8)]
    n = 10
    bm = bmesh.new()
    me = bpy.data.meshes.new("UmbCanopy")
    o = bpy.data.objects.new("UmbCanopy", me)
    bpy.context.scene.collection.objects.link(o)
    for m_ in mats:
        o.data.materials.append(m_)
    apex = bm.verts.new(g(x, y0 + 2.3, z))
    rim = [bm.verts.new(g(x + math.cos(k * math.tau / n) * 1.3, y0 + 1.85, z + math.sin(k * math.tau / n) * 1.3)) for k in range(n)]
    for k in range(n):
        f = bm.faces.new([apex, rim[(k + 1) % n], rim[k]])
        f.material_index = k % 2
    bm.to_mesh(me)
    bm.free()
    solidify(o, 0.02)
    out.append(o)
    return out


for (x, z, mats, tw) in ((-21.6, -8.0, [M["canvas_coral"], M["canvas"]], M["t_coral"]), (-21.8, 8.8, [M["canvas_teal"], M["canvas"]], M["t_teal"]), (-23.6, 13.5, [M["canvas_sun"], M["canvas"]], M["t_sun"])):
    parts += umbrella(x, z, mats)
    t = towel_folded("BeachTowel", 0.8, 1.7, 0.02, tw, M["t_stripe"], g(x - 0.4, gy(x - 0.4, z + 1.3) + 0.0, z + 1.3), 0.3)
    parts.append(t)

for o in lamps:
    parts.append(o)
print("LAMPS", len(lamps))
if LOOK:
    look("beach_open", g(4, -1.5, 19), 14, 28, 160, (1100, 700), 18, 30)
    look("beach_sea", g(-26, -1.5, -2), 16, 26, -60, (1100, 700), 18, 30)
save_part("beach", parts)
