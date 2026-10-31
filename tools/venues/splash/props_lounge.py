"""Splash Park's lounge life and snack bar, modelled in place in game coordinates (the three.js game only):

- the lounge corner (the classic Splash Park's furniture, its footprints kept): two teak sun loungers at (-13.2, 10.1) and
  (-11.4, 10.1) with teal and coral cushions, rolled towels, a folded towel and sunglasses; a teak side table between them with
  two drinks and the sunscreen; the big market umbrella at (-12.3, 11.7) (coral and cream panels, a scalloped valance with a
  fringe, a teak pole on a granite base); a beach ball and a pair of flip-flops;
- along the open end, clear of the pool's surround and the NO RUNNING paint: a daybed with bolsters and a donut ring leaning on
  it, a teak towel cart stacked with towels and a flamingo ring against it, two more loungers;
- the snack shack at the kiosk (13.4, 11.2), serving toward the pool (-x): a teak-clad counter whose top is at 1.24 m where the
  game sets its dog-treats jar (12.45, 11.2: props.mjs kioskTreats), a striped awning on posts with a scalloped valance, the
  SNACK SHACK board and the chalk menu, an ice-cream freezer and a drinks fridge that glows after dusk, lemons, cups and jars,
  two bar stools; pendant bulbs (Light_Kiosk) and a string of bulbs along the awning (Light_Festoon).

Writes WORK/parts/lounge.glb.

    blender -b -P tools/venues/splash/props_lounge.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(11)
LOOK = "--look" in args()

M = dict(
    teak=sm("teak"),
    teak_dark=sm("teak_dark"),
    boards=tmat_tile("teak", "#b77b45", 0.5),
    stucco=tmat_tile("stucco", "#f6ecda", 0.88),
    white=sm("whitewash"),
    canvas=sm("canvas"),
    coral=sm("canvas_coral"),
    teal=sm("canvas_teal"),
    sun=sm("canvas_sun"),
    cush_teal=sm("cushion_teal", "#3aa6ab", 0.85),
    cush_coral=sm("cushion_coral", "#e8614d", 0.85),
    piping=sm("cushion_piping", "#fff4dc", 0.85),
    t_white=sm("towel_white"),
    t_teal=sm("towel_teal"),
    t_coral=sm("towel_coral"),
    t_sun=sm("towel_sun"),
    t_stripe=sm("towel_stripe"),
    steel=sm("stainless"),
    chrome=sm("chrome_bar", "#e6eaee", 0.1, 1.0),
    granite=sm("granite", "#7d7f80", 0.55),
    rubber=sm("rubber"),
    black=sm("charcoal"),
    glass=sm("glass_drink", "#e4f3f5", 0.05, alpha=0.3),
    juice=sm("juice_pink", "#f0607a", 0.25),
    juice2=sm("juice_orange", "#f39a3a", 0.25),
    lemon=sm("lemon", "#f4d23c", 0.5),
    lime=sm("lime", "#8cc63f", 0.5),
    straw=sm("straw_red", "#e0413a", 0.4),
    pink=sm("foam_pink"),
    flamingo=sm("flamingo", "#f38bb0", 0.3),
    beak=sm("beak", "#2a2a2e", 0.4),
    donut=sm("donut_dough", "#e7b46d", 0.35),
    frosting=sm("donut_frost", "#f27fae", 0.25),
    ball_red=sm("ball_red", "#e0413a", 0.3),
    ball_blue=sm("ball_blue", "#2f7fc4", 0.3),
    ball_yellow=sm("ball_yellow", "#f4c849", 0.3),
    ball_white=sm("ball_white", "#f7f4ec", 0.3),
    sunscreen=sm("sunscreen", "#f39a3a", 0.35),
    cap_white=sm("white_gloss"),
    lens=sm("lens_dark", "#1f2a33", 0.08),
    ice_blue=sm("freezer_blue", "#2f86b8", 0.35),
    fridge_red=sm("fridge_red", "#d13b32", 0.3),
    interior=sm("fridge_inside", "#dfe9ea", 0.4),
    lamp=lamp_mat("kiosk_bulb", "#ffe0a8", 4.0),
    glowpane=sm("night_fridge", "#cfefff", 0.5),
    cord=sm("cord", "#2a2a2e", 0.6),
    cup_white=sm("cup_white", "#f7f5ef", 0.4),
    cup_coral=sm("coral"),
    jar_lid=sm("teal"),
    candy=sm("candy", "#ef7aa6", 0.3),
)
parts = {"lounge": [], "openend": [], "shack": []}
lamps = []  # (kept apart: every Light_* is its own object, the exporter reads its centre)


def put(obj, x, z, y=0.0, rz=0.0, rx=0.0, ry=0.0):
    """Move a piece built at the origin (Blender coordinates, its front toward Blender -Y = game +z) to game (x, y, z)."""
    return xf(obj, g(x, y, z), rz, rx, ry)


# ---- small things ---------------------------------------------------------------------------------------------------------------
def drink(name, juice, garnish, h=0.15):
    """A tall glass with a juice, ice, a striped straw and a citrus slice on the rim, at the origin (base at z 0)."""
    out = [cyl(name + "Glass", 0.036, h, (0, 0, 0), M["glass"], 16, r2=0.042)]
    out.append(cyl(name + "Juice", 0.031, h * 0.78, (0, 0, 0.006), juice, 14, r2=0.036))
    out.append(tube(name + "Straw", [(0.01, 0, h * 0.5), (0.016, 0.004, h + 0.04), (0.04, 0.01, h + 0.075)], 0.0045, M["straw"], 3, 6))
    sl = cyl(name + "Slice", 0.03, 0.008, (0, 0, 0), garnish, 14, rot=(PI / 2, 0, 0))
    out.append(xf(sl, (-0.036, 0, h - 0.01), rz=0.3))
    return join(out, name)


def sunglasses(name):
    out = []
    for sx in (-1, 1):
        out.append(cyl(name + "Lens", 0.026, 0.006, (sx * 0.033, 0, 0.004), M["lens"], 14, rot=(PI / 2 - 0.25, 0, 0)))
        out.append(torus(name + "Rim", 0.026, 0.004, (sx * 0.033, 0, 0.008), M["black"], 14, 4, rot=(PI / 2 - 0.25, 0, 0)))
        out.append(tube(name + "Arm", [(sx * 0.058, 0, 0.012), (sx * 0.062, 0.06, 0.008), (sx * 0.06, 0.12, 0.004)], 0.003, M["black"], 2, 4))
    out.append(tube(name + "Bridge", [(-0.01, 0, 0.012), (0, 0, 0.018), (0.01, 0, 0.012)], 0.003, M["black"], 2, 4))
    return join(out, name)


def beach_ball(name, r=0.2):
    bm_ = bmesh.new()
    bmesh.ops.create_uvsphere(bm_, u_segments=18, v_segments=10, radius=r)
    me = bpy.data.meshes.new(name)
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m_ in (M["ball_red"], M["ball_white"], M["ball_blue"], M["ball_yellow"]):
        o.data.materials.append(m_)
    for p in o.data.polygons:
        c = p.center
        if abs(c.z) > r * 0.92:
            p.material_index = 1
            continue
        k = int(((math.atan2(c.y, c.x) + PI) / (2 * PI)) * 6) % 6
        p.material_index = [0, 1, 2, 1, 3, 1][k]
        p.use_smooth = True
    return o


def flamingo_ring(name):
    """A pink flamingo float: the ring, a curved neck and the head with its black-tipped beak."""
    out = [torus(name + "Ring", 0.42, 0.16, (0, 0, 0), M["flamingo"], 32, 12)]
    out.append(tube(name + "Neck", [(0, 0.42, 0.05), (0, 0.5, 0.35), (0, 0.42, 0.62), (0, 0.32, 0.68)], 0.065, M["flamingo"], 6, 12))
    out.append(sphere(name + "Head", 0.1, (0, 0.3, 0.7), M["flamingo"], 16, 10, (1, 1.2, 1)))
    out.append(cyl(name + "Beak", 0.04, 0.12, (0, 0.2, 0.67), M["beak"], 10, r2=0.012, rot=(PI / 2 + 0.6, 0, 0)))
    out.append(cyl(name + "Tail", 0.12, 0.16, (0, -0.42, 0.06), M["flamingo"], 10, r2=0.02, rot=(-PI / 2 - 0.5, 0, 0)))
    return join(out, name)


def donut_ring(name):
    out = [torus(name + "Dough", 0.38, 0.15, (0, 0, 0), M["donut"], 28, 10)]
    fr = torus(name + "Frost", 0.38, 0.152, (0, 0, 0.012), M["frosting"], 28, 10)
    # (the frosting covers the top half only)
    me = fr.data
    bm_ = bmesh.new()
    bm_.from_mesh(me)
    bmesh.ops.delete(bm_, geom=[v for v in bm_.verts if v.co.z < 0.05], context="VERTS")
    bm_.to_mesh(me)
    bm_.free()
    out.append(fr)
    for k in range(14):
        a = k * math.tau / 14 + R.uniform(-0.1, 0.1)
        rr = 0.38 + R.uniform(-0.08, 0.08)
        sp = bx(name + "Sprinkle", -0.025, 0.025, -0.006, 0.006, -0.006, 0.006, [M["ball_yellow"], M["ball_blue"], M["ball_white"]][k % 3], 0)
        out.append(xf(sp, (math.cos(a) * rr, math.sin(a) * rr, 0.155), rz=R.uniform(0, PI)))
    return join(out, name)


# ---- the sun lounger ------------------------------------------------------------------------------------------------------------------
def lounger(name, cushion, towel, back=0.62, dressed=True):
    """A teak lounger at the origin, 0.86 wide and 2.1 long along Blender Y, its head (raised back) toward -Y (game +z)."""
    L, W, H = 1.05, 0.43, 0.3
    out = []
    for sx in (-1, 1):
        out.append(bx(name + "Rail", sx * W - 0.035, sx * W, -L, L, H - 0.1, H, M["teak"], 0.012, 1))
        for y in (-L + 0.1, L - 0.1):
            out.append(bx(name + "Leg", sx * W - 0.035, sx * W, y - 0.03, y + 0.03, 0, H - 0.1, M["teak"], 0.01, 1))
    for y in (-L + 0.04, L - 0.04):
        out.append(bx(name + "End", -W, W, y - 0.03, y + 0.03, H - 0.09, H - 0.01, M["teak"], 0.01))
    # wheels at the head, to roll it into the sun
    for sx in (-1, 1):
        out.append(cyl(name + "Wheel", 0.075, 0.035, (sx * (W + 0.02), -L + 0.1, 0.075), M["rubber"], 10, rot=(0, PI / 2, 0)))
    # the seat's slats from the hinge to the foot
    y = -0.28
    while y < L - 0.06:
        out.append(bx(name + "Slat", -W + 0.04, W - 0.04, y, y + 0.075, H - 0.02, H + 0.005, M["teak"], 0.008, 1))
        y += 0.095
    # the back: a slatted frame on a hinge at y -0.3, raised by `back` radians
    bk = []
    yy = -0.72
    while yy < -0.02:
        bk.append(bx(name + "BackSlat", -W + 0.06, W - 0.06, yy, yy + 0.075, -0.015, 0.012, M["teak"], 0.008, 1))
        yy += 0.095
    for sx in (-1, 1):
        bk.append(bx(name + "BackRail", sx * (W - 0.06) - 0.03 * sx, sx * (W - 0.06), -0.76, 0, -0.03, 0.01, M["teak"], 0.01))
    if dressed:
        bk.append(bx(name + "BackCushion", -W + 0.05, W - 0.05, -0.74, -0.02, 0.012, 0.075, cushion, 0.03, 3))
        bk.append(bx(name + "BackPiping", -W + 0.045, W - 0.045, -0.745, -0.015, 0.04, 0.05, M["piping"], 0.008))
    back_obj = xf(join(bk, name + "Back"), (0, -0.3, H), rx=-back)
    out.append(back_obj)
    if dressed:
        out.append(bx(name + "Cushion", -W + 0.05, W - 0.05, -0.28, L - 0.05, H + 0.005, H + 0.075, cushion, 0.03, 3))
        out.append(bx(name + "Piping", -W + 0.045, W - 0.045, -0.285, L - 0.045, H + 0.035, H + 0.045, M["piping"], 0.008))
        # a rolled towel as the pillow, high on the back
        top = Vector((0, -0.3 - 0.62 * math.cos(back), H + 0.62 * math.sin(back) + 0.09))
        out.append(towel_rolled(name + "Pillow", 0.075, 0.6, towel, M["t_stripe"], tuple(top), 0))
    return join(out, name)


def daybed(name):
    """A low teak daybed, 2.0 by 1.3, a thick canvas mattress, two bolsters and three cushions, at the origin (long along X)."""
    out = [bx(name + "Base", -1.0, 1.0, -0.65, 0.65, 0.06, 0.32, M["teak"], 0.03)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            out.append(bx(name + "Foot", sx * 0.95 - 0.05, sx * 0.95 + 0.05, sy * 0.6 - 0.05, sy * 0.6 + 0.05, 0, 0.08, M["teak_dark"], 0.01))
    out.append(bx(name + "Mattress", -0.97, 0.97, -0.62, 0.62, 0.32, 0.48, M["canvas"], 0.06, 3))
    for sx in (-1, 1):
        out.append(cyl(name + "Bolster", 0.1, 1.1, (sx * 0.82, 0.55, 0.58), M["teal"], 18, bev=0.02, rot=(PI / 2, 0, 0)))
    for k, (x, m_) in enumerate([(-0.45, M["cush_coral"]), (0.0, M["sun"]), (0.45, M["cush_teal"])]):
        c = bx(name + "Cushion", -0.22, 0.22, -0.07, 0.07, 0, 0.42, m_, 0.06, 3)
        out.append(xf(c, (x, 0.45, 0.47), rz=R.uniform(-0.15, 0.15), rx=-0.35))
    out.append(towel_folded(name + "Towel", 0.5, 0.36, 0.06, M["t_white"], M["t_teal"], (0.35, -0.2, 0.48), 0.2))
    return join(out, name)


def towel_cart(name):
    """A teak towel cart on castors, two shelves of folded towels and a handle, at the origin (long along X)."""
    out = []
    W, D = 0.7, 0.3
    for sx in (-1, 1):
        for sy in (-1, 1):
            out.append(bx(name + "Post", sx * W - 0.03, sx * W + 0.03, sy * D - 0.03, sy * D + 0.03, 0.08, 1.05, M["teak"], 0.01))
            out.append(cyl(name + "Castor", 0.045, 0.03, (sx * W, sy * D, 0.045), M["rubber"], 12, rot=(PI / 2, 0, 0)))
    for z in (0.18, 0.62):
        out.append(bx(name + "Shelf", -W - 0.03, W + 0.03, -D - 0.03, D + 0.03, z, z + 0.03, M["teak"], 0.008))
    out.append(tube(name + "Handle", [(W + 0.03, -D + 0.05, 1.0), (W + 0.12, -D + 0.05, 1.03), (W + 0.12, D - 0.05, 1.03), (W + 0.03, D - 0.05, 1.0)], 0.014, M["steel"], 3, 8))
    colours = [M["t_white"], M["t_teal"], M["t_white"], M["t_coral"], M["t_sun"]]
    for z0 in (0.21, 0.65):
        for k, x in enumerate((-0.42, 0.02, 0.44)):
            n = 3 + (k + int(z0 * 10)) % 3
            for j in range(n):
                t_ = bx(name + "Towel", -0.18, 0.18, -0.25, 0.25, 0, 0.054, colours[(k * 2 + j) % len(colours)], 0.02, 1)
                out.append(xf(t_, (x + R.uniform(-0.015, 0.015), 0, z0 + j * 0.056), R.uniform(-0.05, 0.05)))
    return join(out, name)


def market_umbrella(name):
    """A market umbrella at the origin: eight panels coral and cream, a scalloped valance with a fringe, ribs, a teak pole with
    a crank, a granite base."""
    N, Rm, Rr = 8, 0.85, 1.55
    yt, ym, yr = 2.78, 2.6, 2.36
    out = [cyl(name + "Base", 0.32, 0.07, (0, 0, 0), M["granite"], 28, bev=0.015)]
    out.append(cyl(name + "Collar", 0.07, 0.14, (0, 0, 0.07), M["steel"], 14, bev=0.01))
    out.append(cyl(name + "Pole", 0.032, yt - 0.02, (0, 0, 0.1), M["teak"], 12))
    out.append(cyl(name + "Hub", 0.06, 0.08, (0, 0, 1.95), M["teak_dark"], 12))
    out.append(bx(name + "Crank", 0.03, 0.09, -0.012, 0.012, 1.28, 1.34, M["steel"], 0.005))
    out.append(sphere(name + "Finial", 0.05, (0, 0, yt + 0.06), M["teak_dark"], 12, 8))

    def shell(offset, flip):
        bm_ = bmesh.new()
        apex = bm_.verts.new((0, 0, yt - offset))
        mats = []
        steps = 4  # (each panel's edge sags a little between the ribs)
        mid, rim = [], []
        for k in range(N * steps):
            a = k * math.tau / (N * steps)
            t = (k % steps) / steps
            sag = math.sin(t * PI) * 0.04
            mid.append(bm_.verts.new((math.cos(a) * Rm, math.sin(a) * Rm, ym - offset - sag * 0.6)))
            rim.append(bm_.verts.new((math.cos(a) * Rr, math.sin(a) * Rr, yr - offset - sag)))
        n = N * steps
        for k in range(n):
            j = (k + 1) % n
            mi = (k // steps) % 2
            for vs in ([apex, mid[k], mid[j]], [mid[k], rim[k], rim[j], mid[j]]):
                f = bm_.faces.new(list(reversed(vs)) if flip else vs)
                mats.append(mi)
        me = bpy.data.meshes.new(name + "Canopy")
        bm_.to_mesh(me)
        bm_.free()
        o = bpy.data.objects.new(name + "Canopy", me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(M["coral"])
        o.data.materials.append(M["canvas"])
        for p, mi in zip(o.data.polygons, mats):
            p.material_index = mi
        return o

    top, under = shell(0.0, False), shell(0.02, True)
    # (the top faces outward and up)
    if sum(p.normal.z for p in top.data.polygons) < 0:
        top.data.flip_normals()
        under.data.flip_normals()
    out += [top, under]
    # the valance: a hanging band round the rim, scalloped, a sawtooth fringe under it; front and back faces
    bm_ = bmesh.new()
    segs = N * 8
    vs_top, vs_bot, fr = [], [], []
    for k in range(segs + 1):
        a = k * math.tau / segs
        t = (k % 8) / 8
        drop = 0.16 + 0.05 * math.sin(t * PI)
        c, s = math.cos(a), math.sin(a)
        vs_top.append(bm_.verts.new((c * (Rr + 0.005), s * (Rr + 0.005), yr - 0.01)))
        vs_bot.append(bm_.verts.new((c * (Rr + 0.005), s * (Rr + 0.005), yr - drop)))
    mats = []
    for k in range(segs):
        f = bm_.faces.new([vs_top[k], vs_bot[k], vs_bot[k + 1], vs_top[k + 1]])
        f.material_index = 1 if (k // 8) % 2 else 0
        # a tooth of fringe under each segment
        a0, a1 = k * math.tau / segs, (k + 1) * math.tau / segs
        am = (a0 + a1) / 2
        tip = bm_.verts.new((math.cos(am) * (Rr + 0.005), math.sin(am) * (Rr + 0.005), vs_bot[k].co.z - 0.05))
        f = bm_.faces.new([vs_bot[k], tip, vs_bot[k + 1]])
        f.material_index = 2
    # (a cloth with two sides: solidified, a few millimetres)
    bmesh.ops.solidify(bm_, geom=list(bm_.faces), thickness=0.006)
    me = bpy.data.meshes.new(name + "Valance")
    bm_.to_mesh(me)
    bm_.free()
    val = bpy.data.objects.new(name + "Valance", me)
    bpy.context.scene.collection.objects.link(val)
    for m_ in (M["coral"], M["canvas"], M["sun"]):
        val.data.materials.append(m_)
    out.append(val)
    # ribs and stretchers under the canopy
    for k in range(N):
        a = k * math.tau / N
        c, s = math.cos(a), math.sin(a)
        out.append(tube(name + "Rib", [(c * 0.05, s * 0.05, yt - 0.06), (c * Rm, s * Rm, ym - 0.04), (c * (Rr - 0.04), s * (Rr - 0.04), yr - 0.03)], 0.011, M["teak"], 2, 5))
        out.append(tube(name + "Stretcher", [(c * 0.05, s * 0.05, 1.99), (c * 0.8, s * 0.8, ym - 0.06)], 0.008, M["teak"], 1, 5))
    return join(out, name)


# ---- 1. the lounge corner ------------------------------------------------------------------------------------------------------------
L1 = put(lounger("LoungerA", M["cush_teal"], M["t_white"]), -13.2, 10.1)
L2 = put(lounger("LoungerB", M["cush_coral"], M["t_teal"]), -11.4, 10.1)
parts["lounge"] += [L1, L2]
# a folded towel at the foot of the teal one, sunglasses on it; a paperback on the coral one
parts["lounge"].append(put(towel_folded("FootTowel", 0.62, 0.42, 0.05, M["t_coral"], M["t_stripe"]), -13.2, 9.45, 0.37, 0.08))
parts["lounge"].append(put(sunglasses("Sunglasses"), -13.12, 9.48, 0.425, 0.5))
book = join([bx("BookCover", -0.07, 0.07, -0.1, 0.1, 0, 0.022, M["ball_blue"], 0.004), bx("BookPages", -0.065, 0.068, -0.095, 0.095, 0.003, 0.019, sm("paper_page", "#f4ecd8", 0.9), 0)], "Book")
parts["lounge"].append(put(book, -11.3, 9.6, 0.375, -0.4))
# the side table between them, two drinks and the sunscreen
tbl = [cyl("TableTop", 0.26, 0.035, (0, 0, 0.47), M["teak"], 24, bev=0.01)]
for k in range(3):
    a = k * math.tau / 3 + 0.3
    tbl.append(tube("TableLeg", [(math.cos(a) * 0.05, math.sin(a) * 0.05, 0.47), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.0)], 0.016, M["teak_dark"], 1, 6))
tbl.append(cyl("TableShelf", 0.12, 0.02, (0, 0, 0.18), M["teak"], 16))
parts["lounge"].append(put(join(tbl, "SideTable"), -12.3, 10.25))
parts["lounge"].append(put(drink("DrinkA", M["juice"], M["lime"]), -12.4, 10.15, 0.505, 0.4))
parts["lounge"].append(put(drink("DrinkB", M["juice2"], M["lemon"]), -12.18, 10.33, 0.505, 2.2))
parts["lounge"].append(put(bottle("Sunscreen", M["sunscreen"], M["cap_white"], 0.16, 0.03), -12.28, 10.42, 0.505))
# the market umbrella over the heads of the loungers
parts["lounge"].append(put(market_umbrella("Umbrella"), -12.3, 11.7))
# a beach ball and flip-flops on the deck
ball = beach_ball("BeachBall", 0.2)
parts["lounge"].append(put(ball, -10.45, 11.55, 0.2, 0.7))
parts["lounge"].append(flip_flop("FlipL", sm("flipflop_sole", "#3d7fd1", 0.6), M["cup_white"], g(-12.35, 0.0, 9.25), 1.75))
parts["lounge"].append(flip_flop("FlipR", sm("flipflop_sole"), M["cup_white"], g(-12.15, 0.0, 9.32), 1.4))

# ---- 2. the open end: a daybed, two loungers, the towel cart, the inflatables ---------------------------------------------------------
parts["openend"].append(put(daybed("Daybed"), -6.4, 11.65))
parts["openend"].append(put(donut_ring("Donut"), -7.75, 10.88, 0.4, 0.15, rx=1.25))
parts["openend"].append(put(towel_cart("TowelCart"), -2.7, 12.0))
parts["openend"].append(put(flamingo_ring("Flamingo"), -1.35, 11.7, 0.16, -2.2, rx=0.12))
for x, cush, tw, rz in ((4.0, M["cush_teal"], M["t_coral"], -PI / 2), (7.6, M["cush_coral"], M["t_white"], PI / 2)):
    # (laid along x so they fit the open end, their heads toward the little table between them)
    parts["openend"].append(put(lounger("LoungerE", cush, tw, 0.5), x, 11.65, rz=rz))
parts["openend"].append(put(towel_folded("EndTowel", 0.6, 0.4, 0.05, M["t_sun"], M["t_stripe"]), 3.55, 11.65, 0.37, PI / 2 + 0.1))
st = join([cyl("StoolTopE", 0.2, 0.03, (0, 0, 0.42), M["teak"], 20, bev=0.008)] + [tube("StoolLegE", [(math.cos(a) * 0.04, math.sin(a) * 0.04, 0.42), (math.cos(a) * 0.17, math.sin(a) * 0.17, 0)], 0.014, M["teak_dark"], 1, 6) for a in (0.2, 2.3, 4.4)], "EndTable")
parts["openend"].append(put(st, 5.8, 11.2))
parts["openend"].append(put(drink("DrinkC", M["juice"], M["lemon"]), 5.8, 11.2, 0.45))

# ---- 3. the snack shack -------------------------------------------------------------------------------------------------------------------
X0, X1, Z0, Z1 = 12.38, 14.42, 10.05, 12.35  # the shack's footprint (the kiosk's: 13.4 ± 1.05, 11.2 ± 1.2)
TOP = 1.24  # the counter's top: the game's treats jar stands on it at (12.45, 11.2)
shack = []
# the counter: teak-clad, its top a thick teak board overhanging toward the pool
shack.append(gbx("CounterBody", X0, 13.15, 0, TOP - 0.06, Z0, Z1, M["boards"], 0.02))
shack.append(gbx("CounterKick", X0 - 0.03, 13.15, 0, 0.12, Z0 + 0.02, Z1 - 0.02, M["teak_dark"], 0.01))
shack.append(gbx("CounterTop", X0 - 0.16, 13.2, TOP - 0.06, TOP, Z0 - 0.06, Z1 + 0.04, M["teak"], 0.015))
for z in (Z0 + 0.25, Z1 - 0.25):
    shack.append(gbx("CounterPost", X0 - 0.02, X0 + 0.06, 0.12, TOP - 0.06, z - 0.06, z + 0.06, M["teak_dark"], 0.01))
# the back room: a stucco wall at the back, short side walls; the menu on the back wall's front
shack.append(gbx("BackWall", 14.2, X1, 0, 2.62, Z0, Z1, M["stucco"], 0.02))
for z0, z1 in ((Z0, Z0 + 0.12), (Z1 - 0.12, Z1)):
    shack.append(gbx("SideWall", 13.15, 14.2, 0, 1.0, z0, z1, M["stucco"], 0.015))
menu_frame = gbx("MenuFrame", 14.15, 14.2, 1.32, 2.4, 10.42, 11.26, M["teak_dark"], 0.01)
shack.append(menu_frame)
menu = plane("Menu", 0.76, 1.0, g(14.145, 1.86, 10.84), signmat("snacks_menu", 0.7), rot=(PI / 2, 0, -PI / 2))
shack.append(menu)
# posts and the striped awning sloping toward the pool, a scalloped valance at its front edge
for x in (X0 + 0.04, X1 - 0.08):
    for z in (Z0 + 0.04, Z1 - 0.04):
        shack.append(gbx("Post", x - 0.05, x + 0.05, 0, 2.66 if x > 13 else 2.42, z - 0.05, z + 0.05, M["teak"], 0.012))
AX0, AX1, AY0, AY1 = 11.92, 14.6, 2.44, 2.86  # the awning's front and back edges (x) and heights
stripes = 9
for k in range(stripes):
    za = Z0 - 0.2 + k * (Z1 - Z0 + 0.4) / stripes
    zb = za + (Z1 - Z0 + 0.4) / stripes
    bm_ = bmesh.new()
    vs = [bm_.verts.new(g(x, y, z)) for x, y, z in ((AX0, AY0, za), (AX1, AY1, za), (AX1, AY1, zb), (AX0, AY0, zb))]
    bm_.faces.new(vs)
    bmesh.ops.solidify(bm_, geom=list(bm_.faces), thickness=0.02)
    me = bpy.data.meshes.new("Awning")
    bm_.to_mesh(me)
    bm_.free()
    o = bpy.data.objects.new("Awning", me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, M["coral"] if k % 2 == 0 else M["canvas"])
    shack.append(o)
# the valance along the front edge: scallops, the stripes carried down
val = []
for k in range(stripes):
    za = Z0 - 0.2 + k * (Z1 - Z0 + 0.4) / stripes
    zb = za + (Z1 - Z0 + 0.4) / stripes
    pts = [(0, 0), (zb - za, 0)]
    for j in range(1, 8):
        t = 1 - j / 8
        pts.append((t * (zb - za), -0.16 - 0.05 * math.sin(t * PI)))
    pts.insert(2, (zb - za, -0.16))
    pts.append((0, -0.16))
    sh = extrude_shape("Valance", pts, 0.015, g(AX0 - 0.01, AY0 + 0.01, za), M["coral"] if k % 2 == 0 else M["canvas"], rot=(PI / 2, 0, -PI / 2))
    val.append(sh)
shack += val
# the SNACK SHACK board standing on the awning's front
shack.append(gbx("BannerFrame", AX0 + 0.06, AX0 + 0.12, AY0 + 0.02, AY0 + 0.5, Z0 + 0.05, Z1 - 0.05, M["teak_dark"], 0.01))
ban = plane("Banner", Z1 - Z0 - 0.2, 0.4, g(AX0 + 0.055, AY0 + 0.26, (Z0 + Z1) / 2), signmat("snack_banner", 0.6), rot=(PI / 2, 0, -PI / 2))
shack.append(ban)
# the ice-cream freezer behind the counter (its glass lid), the drinks fridge against the back wall (its door glows after dusk)
shack.append(gbx("Freezer", 13.25, 14.15, 0, 0.88, Z0 + 0.14, Z0 + 0.84, M["ice_blue"], 0.03))
shack.append(gbx("FreezerTrim", 13.24, 14.16, 0.84, 0.9, Z0 + 0.13, Z0 + 0.85, M["white"], 0.01))
lid = gbx("Glass_FreezerLid", 13.3, 14.1, 0.9, 0.93, Z0 + 0.18, Z0 + 0.8, M["glass"], 0.005)
lid.name = "Glass_FreezerLid"
shack.append(lid)
for k in range(6):
    shack.append(gbx("IceTub", 13.35 + (k % 3) * 0.24, 13.55 + (k % 3) * 0.24, 0.8, 0.87, Z0 + 0.22 + (k // 3) * 0.28, Z0 + 0.46 + (k // 3) * 0.28, [M["frosting"], M["lemon"], M["cup_white"], M["juice2"], M["lime"], M["donut"]][k], 0.01))
shack.append(gbx("Fridge", 13.6, 14.18, 0, 1.85, Z1 - 0.84, Z1 - 0.14, M["fridge_red"], 0.03))
shack.append(gbx("FridgeInside", 13.585, 13.6, 0.2, 1.62, Z1 - 0.78, Z1 - 0.2, M["interior"], 0))
for j in range(3):
    y = 0.42 + j * 0.42
    shack.append(gbx("FridgeShelf", 13.62, 14.1, y - 0.015, y, Z1 - 0.78, Z1 - 0.2, M["steel"], 0))
    for k in range(5):
        shack.append(cyl("FridgeBottle", 0.032, 0.22, g(13.7, y, Z1 - 0.72 + k * 0.11), [M["juice2"], M["lime"], M["juice"], M["ball_blue"], M["lemon"]][(j + k) % 5], 8, r2=0.02))
door = gbx("Glass_FridgeDoor", 13.56, 13.585, 0.18, 1.66, Z1 - 0.8, Z1 - 0.18, M["glass"], 0.004)
door.name = "Glass_FridgeDoor"
shack.append(door)
glow = gbx("NightGlow_Fridge", 13.59, 13.592, 0.2, 1.62, Z1 - 0.78, Z1 - 0.2, M["glowpane"], 0)
glow.name = "NightGlow_Fridge"
shack.append(glow)
shack.append(gbx("FridgeHead", 13.56, 14.18, 1.66, 1.85, Z1 - 0.84, Z1 - 0.14, M["fridge_red"], 0.02))
# on the counter: a bowl of lemons, stacked cups, a jar of lollipops, napkins, a bell (the treats spot at z 11.2 left clear)
bowl = [cyl("Bowl", 0.14, 0.07, (0, 0, 0), M["cup_white"], 20, r2=0.17, bev=0.01)]
for k in range(5):
    a = k * math.tau / 5
    bowl.append(sphere("Lemon", 0.05, (math.cos(a) * 0.07, math.sin(a) * 0.07, 0.09 + (k % 2) * 0.02), M["lemon"], 10, 6, (1.25, 1, 1)))
bowl.append(sphere("LemonTop", 0.05, (0, 0, 0.13), M["lime"], 10, 6, (1.25, 1, 1)))
shack.append(put(join(bowl, "LemonBowl"), 12.62, 10.32, TOP))
for k in range(2):
    cups = [cyl("Cup", 0.045, 0.1, (0, 0, j * 0.03), M["cup_coral"] if k else M["cup_white"], 14, r2=0.055) for j in range(5)]
    shack.append(put(join(cups, "Cups"), 12.55 + k * 0.14, 11.9, TOP))
jar = [cyl("Jar", 0.08, 0.2, (0, 0, 0), M["glass"], 18, bev=0.01), cyl("JarLid", 0.085, 0.04, (0, 0, 0.2), M["jar_lid"], 18, bev=0.01)]
for k in range(7):
    a = k * math.tau / 7
    jar.append(tube("Lolly", [(math.cos(a) * 0.03, math.sin(a) * 0.03, 0.05), (math.cos(a) * 0.04, math.sin(a) * 0.04, 0.3)], 0.004, M["cup_white"], 1, 4))
    jar.append(sphere("LollyTop", 0.03, (math.cos(a) * 0.04, math.sin(a) * 0.04, 0.31), [M["candy"], M["lemon"], M["lime"], M["juice2"]][k % 4], 10, 6))
shack.append(put(join(jar, "LollyJar"), 12.78, 12.12, TOP))
shack.append(put(cyl("Bell", 0.045, 0.04, (0, 0, 0), M["chrome"], 14, r2=0.012), 12.6, 10.62, TOP))
shack.append(put(join([cyl("NapkinBox", 0.06, 0.08, (0, 0, 0), M["teak_dark"], 4, rot=(0, 0, PI / 4))], "Napkins"), 12.85, 10.62, TOP))
# two bar stools in front, either side of the treats spot
for z in (10.3, 12.1):
    sto = [cyl("StoolSeat", 0.19, 0.05, (0, 0, 0.78), M["teak"], 22, bev=0.015)]
    for a in (0.4, 2.5, 4.6):
        sto.append(tube("StoolLeg", [(math.cos(a) * 0.08, math.sin(a) * 0.08, 0.78), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.0)], 0.014, M["chrome"], 1, 6))
    sto.append(torus("StoolRing", 0.15, 0.011, (0, 0, 0.3), M["chrome"], 18, 5))
    shack.append(put(join(sto, "Stool"), 11.82, z))
# pendant bulbs under the awning, and a string of bulbs along its front edge
for z in (10.6, 11.8):
    shack.append(tube("PendantCord", [g(12.9, 2.6, z), g(12.9, 2.2, z)], 0.006, M["cord"], 1, 4))
    shack.append(cyl("PendantShade", 0.11, 0.12, g(12.9, 2.12, z), M["teal"], 16, r2=0.03))
    lamps.append(sphere("Light_Kiosk", 0.06, g(12.9, 2.09, z), M["lamp"], 12, 8))
fz = [Z0 - 0.15 + k * (Z1 - Z0 + 0.3) / 7 for k in range(8)]
wire = [g(AX0 - 0.03, AY0 - 0.08 - 0.07 * math.sin((z - fz[0]) / (fz[-1] - fz[0]) * PI * 2) ** 2, z) for z in fz]
shack.append(tube("FestoonWire", wire, 0.004, M["cord"], 3, 4))
for p in wire:
    shack.append(cyl("BulbCap", 0.018, 0.03, p - Vector((0, 0, 0.03)), M["black"], 8))
    lamps.append(sphere("Light_Festoon", 0.035, p - Vector((0, 0, 0.07)), M["lamp"], 10, 6, (1, 1, 1.3)))
parts["shack"] += shack

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o.type == "MESH"]))
print("GROUP lamps", tris(lamps))

if LOOK:
    look("lounge_corner", g(-12.2, 0.6, 10.6), 6.5, 32, 210, (960, 640), 18, 32)
    look("lounge_openend", g(-4.4, 0.5, 11.6), 6.8, 26, 190, (960, 640), 16, 32)
    look("lounge_openend2", g(5.8, 0.4, 11.6), 6.0, 30, 160, (960, 640), 16, 32)
    look("lounge_shack", g(13.1, 1.3, 11.2), 6.0, 22, -100, (960, 640), 18, 32)
    look("lounge_game", g(0, 0, 9), 26, 48, -90, (960, 640), 14, 35)
all_ = [o for v in parts.values() for o in v] + lamps
save_part("lounge", all_)
