"""The Mountain Hot Springs' bathhouse (ONSEN.bathhouse: x 0, z -17.2, 9.2 by 4.4 m, its front at the terrace's left end, z -15),
its door where the guests come and go (x 0.62; the game's indigo 湯 curtain hangs in it and sways, scene/onsen.mjs): a low granite
plinth, charred cedar boards under white lime plaster between dark posts and beams, latticed windows glowing warm, a gabled roof of
grey kawara tiles under a thick quilt of snow with icicles along its eaves, an entrance canopy, two red paper lanterns, the plaque
(温泉 MOUNTAIN HOT SPRINGS); at the door geta sandals, an umbrella stand, a pyramid of yellow bath buckets and the drinks machine
glowing (hot corn soup, banana milk); a woodpile under a lean-to with an axe in the block, a snow shovel.

    blender -b -P tools/venues/onsen/props_bathhouse.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from trees import lathe

reset()
LOOK = "--look" in args()
R = random.Random(919)
TAU = 2 * PI
M = dict(
    granite=sm("granite"),
    granite_dark=sm("granite_dark"),
    timber=tmat_tile("timber", "#3b2a20", 0.75),
    post=sm("timber"),
    hinoki=tmat_tile("hinoki", "#c9a374", 0.6),
    plaster=tmat_tile("plaster", "#efe9dc", 0.85),
    kawara=tmat_tile("kawara", "#4a5058", 0.5),
    roof=sm("roof"),
    snow=tmat_tile("snow", "#eef3fa", 0.8),
    ice=sm("ice"),
    shoji=lamp_mat("shoji", "#ffd59a", 2.6),
    inside=lamp_mat("bath_inside", "#ffbf7a", 1.8),
    chochin=lamp_mat("chochin", "#ff5a3a", 3.0),
    black=sm("black"),
    red=sm("red"),
    yellow=sm("yellow"),
    iron=sm("iron"),
    straw=sm("straw"),
    rope=sm("rope"),
    bark=sm("bark"),
    vending=sm("vending"),
    vend_glow=lamp_mat("vending_glow", "#eaf6ff", 2.2),
    brass=sm("brass"),
    indigo=sm("indigo"),
)
B = BATH
X0, X1 = B["x"] - B["hx"], B["x"] + B["hx"]
ZB, ZF = B["z"] - B["hz"], B["z"] + B["hz"]  # back (-19.4), front (-15.0: the terrace's edge)
DOOR0, DOOR1 = DOOR_X - 0.75, DOOR_X + 0.75  # the door's opening (the game's curtain is 1.5 m wide)
DOOR_H = 2.25
PLINTH = 0.14
WALL_TOP = 3.05
EAVE_Y, RIDGE_Y = 3.25, 5.15
OVER_F, OVER_S = 1.0, 0.7  # how far the roof reaches past the walls, front and back / at the ends
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def quad(name, pts, m):
    """A flat face through four game points (in order)."""
    bm = bmesh.new()
    vs = [bm.verts.new(g(*p)) for p in pts]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return o


def slab_between(name, a, b, c, d, thick, m):
    """A slab whose top face is the quad a, b, c, d (game points), `thick` m deep below it."""
    bm = bmesh.new()
    top = [bm.verts.new(g(*p)) for p in (a, b, c, d)]
    bot = [bm.verts.new(g(p[0], p[1] - thick, p[2])) for p in (a, b, c, d)]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([top[i], bot[i], bot[j], top[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return o


# ---- the plinth, the walls, the posts and beams -----------------------------------------------------------------------------------------
w = []
w.append(box("Plinth", X0 - 0.12, DOOR0, 0, PLINTH, ZB - 0.12, ZF + 0.06, M["granite"], 0.02))
w.append(box("Plinth", DOOR1, X1 + 0.12, 0, PLINTH, ZB - 0.12, ZF + 0.06, M["granite"], 0.02))
w.append(box("PlinthBack", DOOR0, DOOR1, 0, PLINTH, ZB - 0.12, ZF - 1.4, M["granite"], 0.02))
w.append(box("Threshold", DOOR0 - 0.1, DOOR1 + 0.1, -0.02, 0.05, ZF - 0.1, ZF + 0.35, M["granite_dark"], 0.02))
T = 0.16  # wall thickness


def wall_x(z, x0, x1, gaps, face):
    """A wall along x at z (its face toward +z if face > 0): boards to 1.0 m, plaster above, holes at `gaps` [(x0, x1, y0, y1)]."""
    out = []
    zz0, zz1 = (z - T, z) if face > 0 else (z, z + T)
    xs = sorted({x0, x1, *[a for gp in gaps for a in gp[:2]]})
    for a, b in zip(xs, xs[1:]):
        hole = next((gp for gp in gaps if gp[0] <= a and b <= gp[1]), None)
        bands = [(PLINTH, 1.0, M["timber"]), (1.0, WALL_TOP, M["plaster"])]
        for y0, y1, m in bands:
            if hole:
                for ya, yb in ((y0, min(y1, hole[2])), (max(y0, hole[3]), y1)):
                    if yb - ya > 0.01:
                        out.append(box("Wall", a, b, ya, yb, zz0, zz1, m, 0.0))
            else:
                out.append(box("Wall", a, b, y0, y1, zz0, zz1, m, 0.0))
    return out


def wall_z(x, z0, z1, face):
    out = []
    xx0, xx1 = (x - T, x) if face > 0 else (x, x + T)
    out.append(box("WallEnd", xx0, xx1, PLINTH, 1.0, z0, z1, M["timber"], 0.0))
    out.append(box("WallEnd", xx0, xx1, 1.0, WALL_TOP, z0, z1, M["plaster"], 0.0))
    return out


WIN_L, WIN_R = (-3.6, -1.6), (2.9, 4.1)
WIN_Y = (1.15, 2.25)
w += wall_x(ZF, X0, X1, [(DOOR0, DOOR1, 0, DOOR_H), (WIN_L[0], WIN_L[1], *WIN_Y), (WIN_R[0], WIN_R[1], *WIN_Y)], 1)
w += wall_x(ZB + T, X0, X1, [], 1)
w += wall_z(X0, ZB, ZF, -1)
w += wall_z(X1, ZB, ZF, 1)
# posts at the corners and the bays, beams (nuki) at the boards' top and the wall's top
for x in (X0, -1.0, DOOR0 - 0.1, DOOR1 + 0.1, 2.4, X1):
    w.append(box("Post", x - 0.1, x + 0.1, PLINTH, WALL_TOP + 0.1, ZF - 0.1, ZF + 0.06, M["post"], 0.01))
for x in (X0, X1):
    w.append(box("Post", x - 0.1, x + 0.1, PLINTH, WALL_TOP + 0.1, ZB - 0.06, ZB + 0.1, M["post"], 0.01))
for y in (1.0, WALL_TOP - 0.06):
    # (the low beam stops at the door's jambs)
    for a_, b_ in (((X0 - 0.06, DOOR0 - 0.1), (DOOR1 + 0.1, X1 + 0.06)) if y < DOOR_H else ((X0 - 0.06, X1 + 0.06),)):
        w.append(box("Beam", a_, b_, y - 0.06, y + 0.06, ZF - 0.02, ZF + 0.05, M["post"], 0.01))
    for x in (X0, X1):
        w.append(box("BeamEnd", x - 0.05, x + 0.05, y - 0.06, y + 0.06, ZB, ZF, M["post"], 0.01))
# the windows: a lattice of thin bars over glowing paper, a sill, a little snow on the sill
for (a, b) in (WIN_L, WIN_R):
    w.append(box("Shoji", a, b, WIN_Y[0], WIN_Y[1], ZF - 0.1, ZF - 0.09, M["shoji"], 0.0))
    n = int((b - a) / 0.11)
    for k in range(1, n):
        x = a + (b - a) * k / n
        w.append(box("Lattice", x - 0.018, x + 0.018, WIN_Y[0], WIN_Y[1], ZF - 0.08, ZF + 0.0, M["post"], 0.0))
    for y in (WIN_Y[0] + 0.37, WIN_Y[0] + 0.74):
        w.append(box("LatticeRail", a, b, y - 0.02, y + 0.02, ZF - 0.08, ZF - 0.01, M["post"], 0.0))
    w.append(box("WinFrame", a - 0.06, b + 0.06, WIN_Y[1], WIN_Y[1] + 0.08, ZF - 0.02, ZF + 0.08, M["post"], 0.01))
    w.append(box("WinSill", a - 0.08, b + 0.08, WIN_Y[0] - 0.08, WIN_Y[0], ZF - 0.02, ZF + 0.14, M["post"], 0.01))
    w.append(box("SillSnow", a - 0.06, b + 0.06, WIN_Y[0], WIN_Y[0] + 0.06, ZF, ZF + 0.13, M["snow"], 0.02))
# the doorway: a dark warm room behind the curtain, a step up into it
w.append(box("DoorJamb", DOOR0 - 0.12, DOOR0, 0, DOOR_H + 0.1, ZF - 0.2, ZF + 0.06, M["post"], 0.01))
w.append(box("DoorJamb", DOOR1, DOOR1 + 0.12, 0, DOOR_H + 0.1, ZF - 0.2, ZF + 0.06, M["post"], 0.01))
w.append(box("Lintel", DOOR0 - 0.12, DOOR1 + 0.12, DOOR_H, DOOR_H + 0.18, ZF - 0.2, ZF + 0.08, M["post"], 0.01))
w.append(box("Light_Doorway", DOOR0, DOOR1, 0, DOOR_H, ZF - 1.4, ZF - 1.38, M["inside"], 0.0))
w.append(box("DoorFloor", DOOR0, DOOR1, 0, 0.02, ZF - 1.4, ZF - 0.1, M["hinoki"], 0.0))
for s_ in (-1, 1):
    x = DOOR0 if s_ < 0 else DOOR1
    w.append(box("DoorReveal", x - (0.0 if s_ < 0 else 0.02), x + (0.02 if s_ < 0 else 0.0), 0, DOOR_H, ZF - 1.4, ZF - 0.1, M["hinoki"], 0.0))
w.append(box("DoorCeil", DOOR0, DOOR1, DOOR_H - 0.02, DOOR_H, ZF - 1.4, ZF - 0.1, M["hinoki"], 0.0))
add("walls", *w)

# ---- the roof: kawara under a quilt of snow, icicles, the gables, rafters -----------------------------------------------------------------
rf = []
ra, rb = X0 - OVER_S, X1 + OVER_S
zf, zb = ZF + OVER_F, ZB - OVER_F
zm = (ZF + ZB) / 2
for (z_eave, sgn) in ((zf, 1), (zb, -1)):
    a, b, c, d = (ra, EAVE_Y, z_eave), (rb, EAVE_Y, z_eave), (rb, RIDGE_Y, zm), (ra, RIDGE_Y, zm)
    rf.append(slab_between("RoofTiles", a, b, c, d, 0.12, M["kawara"]))
    # the snow on it: thick, a soft lip over the eave
    lift = 0.22
    a2, b2, c2, d2 = ((p[0] + (0.15 if p[0] == ra else -0.15), p[1] + lift, p[2] - sgn * 0.05) for p in (a, b, c, d))
    rf.append(slab_between("RoofSnow", a2, b2, c2, d2, lift, M["snow"]))
    lip = cyl("SnowLip", 0.16, rb - ra - 0.3, g(ra + 0.15, EAVE_Y + 0.12, z_eave + sgn * 0.02), M["snow"], 10, rot=(0, PI / 2, 0))
    lip.scale = (1, 1, 0.75)
    apply_all(lip)
    rf.append(lip)
    # the fascia board and the rafters' ends under the eave
    rf.append(box("Fascia", ra, rb, EAVE_Y - 0.22, EAVE_Y - 0.04, z_eave - sgn * 0.05, z_eave + sgn * 0.02, M["post"], 0.01))
    x = ra + 0.2
    while x < rb - 0.1:
        z0, z1 = (ZF, z_eave) if sgn > 0 else (z_eave, ZB)
        rf.append(box("Rafter", x - 0.04, x + 0.04, EAVE_Y - 0.2, EAVE_Y - 0.1, z0, z1, M["post"], 0.005))
        x += 0.45
    # icicles along the front eave (and fewer at the back)
    if sgn > 0:
        x = ra + 0.25
        while x < rb - 0.2:
            L = 0.12 + R.random() * 0.5
            rf.append(cyl("Icicle", 0.035 + R.random() * 0.02, L, g(x, EAVE_Y - 0.2 - L, z_eave - 0.02), M["ice"], 6, rot=(PI, 0, 0), r2=0.0))
            rf[-1].location = g(x, EAVE_Y - 0.2, z_eave - 0.02)
            apply_all(rf[-1])
            x += 0.18 + R.random() * 0.3
# the ridge: a rounded cap under snow, its ends turned up (onigawara)
rf.append(cyl("Ridge", 0.16, rb - ra + 0.2, g(ra - 0.1, RIDGE_Y + 0.08, zm), M["roof"], 12, rot=(0, PI / 2, 0)))
rf.append(cyl("RidgeSnow", 0.22, rb - ra, g(ra, RIDGE_Y + 0.22, zm), M["snow"], 12, rot=(0, PI / 2, 0)))
for x in (ra - 0.15, rb + 0.15):
    rf.append(box("Oni", x - 0.08, x + 0.08, RIDGE_Y - 0.05, RIDGE_Y + 0.5, zm - 0.22, zm + 0.22, M["roof"], 0.04))
# the gables: charred boards, a little hanging ornament (gegyo)
for x, f_ in ((X0, -1), (X1, 1)):
    tri = [(x + f_ * 0.02, WALL_TOP, ZF), (x + f_ * 0.02, WALL_TOP, ZB), (x + f_ * 0.02, RIDGE_Y, zm)]
    bm = bmesh.new()
    vs = [bm.verts.new(g(*p)) for p in tri]
    bm.faces.new(vs)
    me = bpy.data.meshes.new("Gable")
    bm.to_mesh(me)
    bm.free()
    gab = bpy.data.objects.new("Gable", me)
    bpy.context.scene.collection.objects.link(gab)
    gab.data.materials.append(M["timber"])
    rf.append(gab)
    rf.append(box("Gegyo", x + f_ * 0.03 - 0.03, x + f_ * 0.03 + 0.03, RIDGE_Y - 0.9, RIDGE_Y - 0.2, zm - 0.18, zm + 0.18, M["post"], 0.02))
# the bath's chimney: a little smoke hood on the ridge
rf.append(box("Hood", 2.4, 3.2, RIDGE_Y, RIDGE_Y + 0.55, zm - 0.35, zm + 0.35, M["post"], 0.02))
rf.append(box("HoodRoof", 2.25, 3.35, RIDGE_Y + 0.55, RIDGE_Y + 0.65, zm - 0.5, zm + 0.5, M["roof"], 0.02))
rf.append(box("HoodSnow", 2.3, 3.3, RIDGE_Y + 0.65, RIDGE_Y + 0.8, zm - 0.45, zm + 0.45, M["snow"], 0.05))
add("roof", *rf)

# ---- the entrance: the canopy, the lanterns, the plaque -------------------------------------------------------------------------------
en = []
c0, c1 = DOOR0 - 0.55, DOOR1 + 0.55
en.append(slab_between("Canopy", (c0, DOOR_H + 0.55, ZF + 0.85), (c1, DOOR_H + 0.55, ZF + 0.85), (c1, DOOR_H + 0.8, ZF), (c0, DOOR_H + 0.8, ZF), 0.06, M["kawara"]))
en.append(slab_between("CanopySnow", (c0 + 0.05, DOOR_H + 0.68, ZF + 0.8), (c1 - 0.05, DOOR_H + 0.68, ZF + 0.8), (c1 - 0.05, DOOR_H + 0.93, ZF), (c0 + 0.05, DOOR_H + 0.93, ZF), 0.12, M["snow"]))
for x in (c0 + 0.12, c1 - 0.12):
    en.append(rod("Bracket", (x, DOOR_H + 0.15, ZF), (x, DOOR_H + 0.5, ZF + 0.8), 0.04, M["post"], 6))
en.append(plane("Plaque", 1.25, 0.47, g(DOOR_X, DOOR_H + 1.12, ZF + 0.022), signmat("bath_plaque", 0.6)))
en.append(box("PlaqueFrame", DOOR_X - 0.68, DOOR_X + 0.68, DOOR_H + 0.86, DOOR_H + 1.38, ZF, ZF + 0.02, M["post"], 0.01))
for x in (DOOR0 - 0.35, DOOR1 + 0.35):
    en.append(cyl("Light_Paper", 0.17, 0.42, g(x, DOOR_H + 0.0, ZF + 0.45), M["chochin"], 14))
    en.append(cyl("ChochinTop", 0.13, 0.05, g(x, DOOR_H + 0.42, ZF + 0.45), M["black"], 12))
    en.append(cyl("ChochinBot", 0.13, 0.05, g(x, DOOR_H - 0.05, ZF + 0.45), M["black"], 12))
    en.append(rod("ChochinCord", (x, DOOR_H + 0.47, ZF + 0.45), (x, DOOR_H + 0.62, ZF + 0.45), 0.008, M["black"], 4))
add("entrance", *en)

# ---- at the door: geta, the umbrella stand, the pyramid of yellow buckets, the drinks machine ---------------------------------------------
dz = []
for k in range(3):
    x = DOOR0 - 0.35 - k * 0.32
    for s_ in (-0.06, 0.06):
        dz.append(box("Geta", x + s_ - 0.045, x + s_ + 0.045, 0.04, 0.07, ZF + 0.12, ZF + 0.36, M["hinoki"], 0.01))
        for zz in (ZF + 0.17, ZF + 0.31):
            dz.append(box("GetaTooth", x + s_ - 0.04, x + s_ + 0.04, 0, 0.04, zz - 0.012, zz + 0.012, M["hinoki"], 0.0))
ux, uz = X0 + 0.55, ZF + 0.28
dz.append(cyl("UmbrellaStand", 0.17, 0.42, g(ux, 0, uz), M["hinoki"], 12))
for k, (dx_, tilt) in enumerate(((-0.05, 0.12), (0.06, -0.1))):
    um = cyl("Wagasa", 0.07, 1.0, (0, 0, 0), M["red"], 10, r2=0.025)
    um.rotation_euler = (tilt, 0, 0)
    um.location = g(ux + dx_, 0.25, uz)
    apply_all(um)
    dz.append(um)
    dz.append(cyl("WagasaTip", 0.012, 0.25, g(ux + dx_, 1.22, uz + tilt * 1.0), M["black"], 5))
# the pyramid of yellow buckets (4, 3, 2, 1) and two stools, right of the door
px0 = DOOR1 + 0.55
for row, n in enumerate((4, 3, 2, 1)):
    for k in range(n):
        x = px0 + (k + row * 0.5) * 0.3
        dz.append(cyl("YBucket", 0.13, 0.17, g(x, row * 0.17, ZF + 0.2), M["yellow"], 12, r2=0.11))
for k in range(2):
    x = px0 + 0.15 + k * 0.5
    dz.append(box("StoolSeat", x - 0.16, x + 0.16, 0.24, 0.28, ZF + 0.45, ZF + 0.7, M["hinoki"], 0.01))
    for s_ in (-1, 1):
        dz.append(box("StoolSide", x + s_ * 0.13 - 0.02, x + s_ * 0.13 + 0.02, 0, 0.24, ZF + 0.47, ZF + 0.68, M["hinoki"], 0.0))
# the drinks machine, against the wall between the window and the corner, its front glowing
vm = []
vx0, vx1 = X1 + 0.12, X1 + 0.82  # (no room between the window and the corner: round it, by the end wall, facing the terrace)
vm.append(box("Vending", vx0, vx1, 0, 1.85, ZF - 0.62, ZF - 0.05, M["vending"], 0.03))
vm.append(plane("NightGlow_VendFront", 0.62, 1.6, g((vx0 + vx1) / 2, 0.98, ZF - 0.048), M["vend_glow"]))
vm.append(plane("VendFront", 0.6, 1.58, g((vx0 + vx1) / 2, 0.98, ZF - 0.044), signmat("vending", 0.3)))
vm.append(box("VendRoofSnow", vx0 - 0.02, vx1 + 0.02, 1.85, 1.95, ZF - 0.64, ZF - 0.03, M["snow"], 0.04))
add("door", *dz, *vm)

# ---- the woodpile under its lean-to, the axe in the block, the snow shovel --------------------------------------------------------------
wp = []
lx0, lx1, lz0, lz1 = X1 + 0.2, X1 + 1.5, ZB + 0.6, ZF - 1.0
for x in (lx1,):
    for z in (lz0, lz1):
        wp.append(box("LeanPost", x - 0.06, x + 0.06, 0, 2.1, z - 0.06, z + 0.06, M["post"], 0.01))
wp.append(slab_between("LeanRoof", (X1, 2.6, lz0 - 0.3), (X1, 2.6, lz1 + 0.3), (lx1 + 0.35, 2.05, lz1 + 0.3), (lx1 + 0.35, 2.05, lz0 - 0.3), 0.06, M["kawara"]))
wp.append(slab_between("LeanSnow", (X1 + 0.05, 2.75, lz0 - 0.25), (X1 + 0.05, 2.75, lz1 + 0.25), (lx1 + 0.3, 2.2, lz1 + 0.25), (lx1 + 0.3, 2.2, lz0 - 0.25), 0.15, M["snow"]))
for layer in range(5):
    for k in range(int((lz1 - lz0) / 0.2)):
        z = lz0 + 0.12 + k * 0.2 + (0.1 if layer % 2 else 0)
        if z > lz1 - 0.1:
            continue
        wp.append(cyl("Log", 0.085, 0.95, g(X1 + 0.25, 0.09 + layer * 0.16, z), M["bark"], 8, rot=(0, PI / 2, 0)))
wp.append(cyl("Block", 0.25, 0.45, g(lx1 + 0.8, 0, lz1 - 0.6), M["bark"], 12))
wp.append(box("AxeHead", lx1 + 0.75, lx1 + 0.9, 0.42, 0.5, lz1 - 0.66, lz1 - 0.54, M["iron"], 0.01))
wp.append(rod("AxeHandle", (lx1 + 0.82, 0.48, lz1 - 0.6), (lx1 + 0.5, 1.05, lz1 - 0.6), 0.022, M["hinoki"], 6))
wp.append(rod("ShovelHandle", (X0 - 0.2, 0.2, ZF - 0.7), (X0 - 0.35, 1.45, ZF - 0.5), 0.022, M["hinoki"], 6))
wp.append(box("ShovelBlade", X0 - 0.32, X0 - 0.08, -0.05, 0.3, ZF - 0.85, ZF - 0.55, M["red"], 0.01))
add("woodpile", *wp)

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("bath_front", g(0.6, 2.2, -16.0), 11, 12, 0, (1280, 720), 18, 30)
    look("bath_door", g(0.9, 1.4, -15.0), 4.2, 8, 20, (960, 640), 18, 35)
    look("bath_side", g(4.8, 1.8, -16.5), 7, 16, 60, (960, 640), 18, 35)
save_part("bathhouse", [o for v in parts.values() for o in v if o])
