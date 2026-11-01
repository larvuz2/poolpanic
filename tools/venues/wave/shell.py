"""The Wave Pool's ground, in game coordinates from the game's own plan (kit.PLAN): the deck of coquina pavers round the beach and the
pool, Malibu-tile borders along the coping and the walls and round two sun medallions laid in the ends' decks; the boardwalk at the
top of the beach; the beach and the pool's floor in one surface on the game's own profile (dist/waves.mjs floorAt: the sand running
down into the water, then aqua glass mosaic to the deep end, the two meeting along the classic's wavy line); the giant octopus in
tile on the deep floor; the pool's ends tiled down to the floor with the waterline band; the bullnose coping with its depth plaques;
the low wall on the near side, the breeze-block screens of the ends with their stucco piers, the service yard's wall in the far
corner; the surf gate (two streamline pylons, the SURF GATE arch, two slatted leaves `Door_A`/`Door_B` the game swings); the sand
outside; floor.glb: the deck's paint (the wet sand at the water's edge, the wrack line, sand blown onto the pavers, the damp patches
where bathers walk out, the grime at the walls' feet).

    blender -b -P tools/venues/wave/shell.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(551)
TAU = 2 * PI
M = dict(
    pavers=tmat_tile("pavers", "#e8d6b6", 0.7),
    malibu=tmat_tile("malibu", "#e9c879", 0.25),
    sand=tmat_tile("sand", "#e8cf9c", 1.0),
    pool=tmat_tile("glass_mosaic", "#6fd0d2", 0.2),
    band=tmat_tile("mosaic_band", "#1f9aa0", 0.22),
    stucco=tmat_tile("stucco", "#f7efe0", 0.88),
    boardwalk=tmat_tile("boardwalk", "#b99470", 0.7),
    teak=tmat_tile("teak", "#b57a43", 0.55),
    coping=sm("coping", "#f4ead6", 0.55),
    coral=sm("coral"),
    teal=sm("teal"),
    cream=sm("cream"),
    sun=sm("sun"),
    navy=sm("navy"),
    chrome=sm("chrome"),
    iron=sm("iron"),
    breeze=cutmat("breeze", 0.85),
    octopus=cutmat("octopus", 0.25),
)
parts, floor = [], []


def P_(*objs):
    parts.extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def quad_mesh(name, rows, m, uv=None):
    """A surface through a grid of game-coordinate points `rows` (lists of equal length), with `uv` the same shape (or none)."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap") if uv else None
    vs = [[bm.verts.new(g(*p)) for p in row] for row in rows]
    for i in range(len(rows) - 1):
        for j in range(len(rows[0]) - 1):
            f = bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
            if uv:
                for loop, (a, b) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                    loop[uvl].uv = uv[a][b]
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return o


def face_up(o, up=True):
    """Make every face of `o` point up (or down)."""
    for p in o.data.polygons:
        if (p.normal.z < 0) == up:
            p.flip()
    o.data.update()
    return o


def rect_up(name, x0, x1, z0, z1, y, m):
    o = quad_mesh(name, [[(x0, y, z0), (x1, y, z0)], [(x0, y, z1), (x1, y, z1)]], m)
    return face_up(o)


# ---- the deck: pavers everywhere but the beach and the pool (and under the wave house) ---------------------------------------------
BW0 = SAND_EDGE - 0.6  # the boardwalk, from the deck to the sand
POOLZ = HALF_Z + 0.35  # the coping's outer edge
RM = ROOM
for name, x0, x1, z0, z1 in (
    ("DeckNear", RM["minX"], BW0, RM["minZ"], RM["maxZ"]),
    ("DeckLeft", BW0, RM["maxX"], RM["minZ"], -POOLZ),
    ("DeckRight", BW0, RM["maxX"], POOLZ, RM["maxZ"]),
):
    P_(rect_up(name, x0, x1, z0, z1, 0.0, M["pavers"]))
# a skirt under the deck's edges, so nothing shows a seam against the sand outside
for z in (RM["minZ"], RM["maxZ"]):
    P_(box("DeckSkirt", RM["minX"], RM["maxX"], -0.4, 0.0, z - 0.02, z + 0.02, M["stucco"], 0))

# the boardwalk at the top of the beach: planks along z, a teak lip on the sand side
P_(box("Boardwalk", BW0, SAND_EDGE, -0.05, 0.025, -POOLZ, POOLZ, M["boardwalk"], 0.006))
P_(box("BoardwalkLip", SAND_EDGE - 0.06, SAND_EDGE + 0.02, -0.12, 0.035, -POOLZ, POOLZ, M["teak"], 0.01))

# Malibu borders, inlaid (2 mm proud): along each coping, along the end walls' feet, round the deck's near edge
for s in (-1, 1):
    zc = s * (POOLZ + 0.16)
    P_(rect_up("BorderCoping", BW0, FRONT - 0.05, zc - 0.15, zc + 0.15, 0.003, M["malibu"]))
P_(rect_up("BorderLeftWall", RM["minX"] + 0.3, -GATE_HALF - 0.75, -15.2 + 0.0, -15.2 + 0.3, 0.003, M["malibu"]))
P_(rect_up("BorderLeftWall", GATE_HALF + 0.75, FRONT - 0.2, -15.2, -15.2 + 0.3, 0.003, M["malibu"]))
P_(rect_up("BorderRightWall", RM["minX"] + 0.3, RM["maxX"] - 0.4, DECK["maxZ"] - 0.3, DECK["maxZ"], 0.003, M["malibu"]))
P_(rect_up("BorderNear", -14.6, -14.3, -15.2, DECK["maxZ"], 0.003, M["malibu"]))


# the sun medallions: discs of tile in the ends' decks, a Malibu ring round each
def disc(name, x, z, r, y, m, n=48, rot=0.0):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    c = bm.verts.new(g(x, y, z))
    ring = [bm.verts.new(g(x + math.cos(a) * r, y, z + math.sin(a) * r)) for a in [k * TAU / n for k in range(n)]]
    for k in range(n):
        a0, a1 = k * TAU / n + rot, (k + 1) * TAU / n + rot
        f = bm.faces.new((c, ring[k], ring[(k + 1) % n]))
        for loop, uv in zip(f.loops, ((0.5, 0.5), (0.5 + 0.5 * math.cos(a0), 0.5 + 0.5 * math.sin(a0)), (0.5 + 0.5 * math.cos(a1), 0.5 + 0.5 * math.sin(a1)))):
            loop[uvl].uv = uv
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return face_up(o)


def annulus(name, x, z, r0, r1, y, m, n=48):
    rows = [[(x + math.cos(a) * r, y, z + math.sin(a) * r) for a in [k * TAU / n for k in range(n + 1)]] for r in (r0, r1)]
    return face_up(quad_mesh(name, rows, m))


MEDALLIONS = [(-6.2, -12.75, signmat("medallion_a", 0.3)), (-3.2, 11.25, signmat("medallion_b", 0.3))]
for x, z, mm in MEDALLIONS:
    P_(disc("Medallion", x, z, 1.25, 0.004, mm, rot=-PI / 2))
    P_(annulus("MedallionRing", x, z, 1.25, 1.5, 0.004, M["malibu"]))

# ---- the beach and the pool's floor: one surface on the game's profile, sand then glass mosaic along a wavy line ----------------
ZS = [-HALF_Z + k * (2 * HALF_Z) / 76 for k in range(77)]


def blend_x(z):
    # (scene/wave.mjs `bed`: the sand gives way to the tiles where x + sin(z·1.3)·0.22 + sin(z·0.37 + 1)·0.4 passes about -3.05)
    return -3.05 - math.sin(z * 1.3) * 0.22 - math.sin(z * 0.37 + 1.0) * 0.4


def strip(x0f, x1f, n):
    rows = []
    for z in ZS:
        a, b = x0f(z), x1f(z)
        rows.append([(a + (b - a) * (i / n) ** 1.0, floor_at(a + (b - a) * i / n), z) for i in range(n + 1)])
    return rows


P_(face_up(quad_mesh("Beach", strip(lambda z: SAND_EDGE, blend_x, 44), M["sand"])))
P_(face_up(quad_mesh("PoolFloor", strip(blend_x, lambda z: HALF_X + 0.02, 52), M["pool"])))
# the sand runs on under the coping and the boardwalk a little
P_(box("BeachUnder", SAND_EDGE - 0.2, -HALF_X, -0.2, -0.01, -POOLZ, POOLZ, M["sand"], 0))

# the octopus: on the deep floor, its head toward the wave house, following the slope 1 cm above the tiles
OX0, OX1, OZ = -0.4, 6.9, 3.65
orows, ouv = [], []
for j in range(13):
    z = -OZ + 2 * OZ * j / 12
    orows.append([(OX0 + (OX1 - OX0) * i / 12, floor_at(OX0 + (OX1 - OX0) * i / 12) + 0.012, z) for i in range(13)])
    ouv.append([(j / 12, i / 12) for i in range(13)])
P_(face_up(quad_mesh("Octopus", orows, M["octopus"], ouv)))

# ---- the pool's two ends: tiled from the coping down to the floor, the waterline band, the bullnose coping ------------------------
BAND = (-0.42, -0.02)
xs = [SAND_EDGE + 0.25 * k for k in range(int((HALF_X - SAND_EDGE) / 0.25) + 1)] + [HALF_X + 0.3]
for s in (-1, 1):
    z = s * HALF_Z
    low, up = [], []
    for x in xs:
        f = floor_at(min(x, HALF_X)) - 0.03
        low.append(((x, f, z), (x, min(BAND[0], max(f, BAND[0])), z)))
        up.append(((x, max(f, BAND[0]), z), (x, 0.0, z)))
    for name, pairs, m in (("EndWallTile", low, M["pool"]), ("EndWallBand", up, M["band"])):
        rows = [[p[0] for p in pairs], [p[1] for p in pairs]]
        o = quad_mesh(name, rows, m)
        for p in o.data.polygons:
            if (p.normal.y > 0) != (s > 0):  # (Blender y is -z: face the pool)
                p.flip()
        P_(o)
    # the coping: a bullnose of cream stone along the end, 35 cm, its nose over the water
    cz = s * (HALF_Z + 0.175)
    P_(box("Coping", SAND_EDGE - 0.6, FRONT, -0.02, 0.06, cz - 0.19, cz + 0.19, M["coping"], 0.035))
    # depth plaques (read from the deck) and NO DIVING
    for x, k in ((-7.2, "0"), (-4.1, "05"), (-1.0, "1"), (3.0, "15"), (6.6, "2")):
        d = plane("Depth", 0.42, 0.21, g(x, 0.062, cz), signmat("depth_" + k, 0.4), rot=(0, 0, 0 if s < 0 else PI))
        P_(face_up(d))
    for x in (0.9, 5.0):
        P_(face_up(plane("NoDiving", 0.42, 0.21, g(x, 0.062, cz), signmat("no_diving", 0.4), rot=(0, 0, 0 if s < 0 else PI))))
    # linear drains in the deck beside the coping: steel grates
    for x0 in (-9.2, -2.4, 4.4):
        P_(box("Drain", x0, x0 + 1.4, -0.005, 0.006, s * (POOLZ + 0.42), s * (POOLZ + 0.5), M["iron"], 0.002))

# ---- the walls: low on the near side, breeze-block screens at the ends, the service yard's wall in the far corner -----------------
STUCCO, CAP = M["stucco"], M["coral"]
NX = RM["minX"] + 0.15
P_(box("NearWall", NX - 0.15, NX + 0.15, 0, NEAR_WALL_H, RM["minZ"], RM["maxZ"], STUCCO, 0.02))
P_(box("NearWallCap", NX - 0.21, NX + 0.21, NEAR_WALL_H, NEAR_WALL_H + 0.08, RM["minZ"], RM["maxZ"], CAP, 0.02))
# a Malibu-tiled face on the near wall's inside, below its cap
P_(box("NearWallTile", NX + 0.15, NX + 0.165, 0.12, NEAR_WALL_H - 0.04, RM["minZ"] + 0.3, RM["maxZ"] - 0.3, M["malibu"], 0))


def screen_wall(x0, x1, z, piers_at_ends=True):
    """A breeze-block screen along x at z: stucco piers, a base course, panels of breeze block (1.2 × 0.9), a capped beam."""
    L = x1 - x0
    n = max(1, round(L / 1.5))
    step = L / n
    out = []
    for k in range(n + 1):
        x = x0 + k * step
        out.append(box("Pier", x - 0.17, x + 0.17, 0, WALL_H + 0.2, z - 0.17, z + 0.17, STUCCO, 0.02))
        out.append(box("PierCap", x - 0.22, x + 0.22, WALL_H + 0.2, WALL_H + 0.28, z - 0.22, z + 0.22, CAP, 0.02))
        out.append(sphere("PierBall", 0.09, g(x, WALL_H + 0.36, z), M["sun"], 12, 8))
    out.append(box("WallBase", x0, x1, 0, 0.3, z - 0.13, z + 0.13, STUCCO, 0.01))
    out.append(box("WallBaseTile", x0, x1, 0.04, 0.26, z - 0.135, z + 0.135, M["malibu"], 0))
    out.append(box("WallBeam", x0, x1, WALL_H - 0.04, WALL_H + 0.08, z - 0.13, z + 0.13, STUCCO, 0.01))
    out.append(box("WallBeamCap", x0, x1, WALL_H + 0.08, WALL_H + 0.13, z - 0.16, z + 0.16, CAP, 0.01))
    for k in range(n):
        xa, xb = x0 + k * step + 0.17, x0 + (k + 1) * step - 0.17
        # panels 1.2 wide: as many as fit, centred in the bay
        m_ = max(1, int((xb - xa) / 1.2 + 0.25))
        w = (xb - xa) / m_
        for j in range(m_):
            cx = xa + (j + 0.5) * w
            p = plane("Breeze", w, WALL_H - 0.34, g(cx, 0.3 + (WALL_H - 0.34) / 2, z), M["breeze"], rot=(PI / 2, 0, 0))
            out.append(p)
    return out


LZ = RM["minZ"] + 0.15
P_(*screen_wall(RM["minX"] + 0.15, -GATE_HALF - 0.42, LZ))
P_(*screen_wall(GATE_HALF + 0.42, 7.2, LZ))
P_(*screen_wall(RM["minX"] + 0.15, RM["maxX"] - 0.15, RM["maxZ"] - 0.15))
# the service yard (the far left corner, by the wave house): a solid wall, taller, its stucco a little stained
P_(box("YardWall", 7.2, RM["maxX"], 0, 2.4, LZ - 0.15, LZ + 0.15, STUCCO, 0.02))
P_(box("YardWallCap", 7.2, RM["maxX"], 2.4, 2.48, LZ - 0.2, LZ + 0.2, CAP, 0.02))
P_(box("YardWallEnd", RM["maxX"] - 0.3, RM["maxX"], 0, 2.4, RM["minZ"], -HOUSE_HZ, STUCCO, 0.02))
P_(box("YardWallEndCap", RM["maxX"] - 0.35, RM["maxX"] + 0.05, 2.4, 2.48, RM["minZ"], -HOUSE_HZ, CAP, 0.02))
# the yard's walls dressed: a coral skirting, a band of Malibu tile at hand height, a teal stripe under the cap
for name, x0, x1, z0, z1 in (("Yard", 7.2, RM["maxX"] - 0.3, LZ + 0.15, LZ + 0.17), ("YardEnd", RM["maxX"] - 0.32, RM["maxX"] - 0.3, RM["minZ"] + 0.3, -HOUSE_HZ)):
    P_(box(name + "Skirt", x0, x1, 0, 0.22, z0, z1, M["coral"], 0.005))
    P_(box(name + "TileBand", x0, x1, 1.0, 1.3, z0, z1, M["malibu"], 0))
    P_(box(name + "Stripe", x0, x1, 2.1, 2.2, z0, z1, M["teal"], 0.004))
# the far right corner: a screen along the far side, from the wave house to the end wall
P_(box("FarRightBase", RM["maxX"] - 0.3, RM["maxX"], 0, WALL_H, HOUSE_HZ, RM["maxZ"], STUCCO, 0.02))
P_(box("FarRightCap", RM["maxX"] - 0.35, RM["maxX"] + 0.05, WALL_H, WALL_H + 0.08, HOUSE_HZ, RM["maxZ"], CAP, 0.02))

# ---- the surf gate: two streamline pylons, the arch board, the leaves the game swings ----------------------------------------------
GZ = GATE_Z
for s in (-1, 1):
    x = s * (GATE_HALF + 0.3)
    P_(box("Pylon", x - 0.3, x + 0.3, 0, 3.1, GZ - 0.3, GZ + 0.3, STUCCO, 0.04))
    P_(box("PylonStep", x - 0.24, x + 0.24, 3.1, 3.55, GZ - 0.24, GZ + 0.24, STUCCO, 0.03))
    P_(box("PylonStep2", x - 0.16, x + 0.16, 3.55, 3.85, GZ - 0.16, GZ + 0.16, CAP, 0.03))
    P_(sphere("PylonBall", 0.2, g(x, 4.05, GZ), M["sun"], 16, 10))
    # speed stripes on the pylon's faces, a Malibu panel at hand height
    for k, (y, m) in enumerate(((2.55, M["teal"]), (2.7, M["sun"]), (2.85, CAP))):
        P_(box("PylonStripe", x - 0.31, x + 0.31, y, y + 0.08, GZ - 0.31, GZ + 0.31, m, 0.005))
    P_(box("PylonTile", x - 0.305, x + 0.305, 0.25, 1.45, GZ - 0.305, GZ + 0.305, M["malibu"], 0))
# the arch: a curved beam between the pylons, the board on it, facing into the park and out
AW = 2 * (GATE_HALF + 0.3)
arch = []
for k in range(17):
    t = k / 16
    xa = -AW / 2 + AW * t
    arch.append(g(xa, 3.05 + 0.35 * math.sin(t * PI), GZ))
P_(poly_tube("ArchBeam", arch, 0.11, M["teal"], 10, 0.3))
P_(box("GateBoardBack", -1.5, 1.5, 3.12, 3.92, GZ - 0.06, GZ + 0.06, M["teal"], 0.03))
for face, rz in ((GZ + 0.065, 0), (GZ - 0.065, PI)):
    P_(plane("GateSign", 2.9, 0.725, g(0, 3.52, face), signmat("gate_sign", 0.5), rot=(PI / 2, 0, rz)))
# the leaves: slatted teak, a coral rail, a sunburst cut-out; hinged at the opening's edges (`Door_A` left, `Door_B` right)
for side, name in ((-1, "Door_A"), (1, "Door_B")):
    hx = side * GATE_HALF
    leaf = []
    w_ = GATE_HALF - 0.03
    for i in range(6):
        u = 0.1 + i * (w_ - 0.18) / 5
        xx = hx - side * u
        leaf.append(box("GateSlat", xx - 0.075, xx + 0.075, 0.08, 1.35 + 0.08 * math.sin((i + 0.5) / 6 * PI), GZ + 0.02, GZ + 0.06, M["teak"], 0.008))
    for y in (0.3, 1.05):
        leaf.append(box("GateRail", min(hx, hx - side * w_), max(hx, hx - side * w_), y - 0.04, y + 0.04, GZ + 0.06, GZ + 0.11, CAP, 0.01))
    leaf.append(sphere("GateKnob", 0.05, g(hx - side * (w_ - 0.1), 0.95, GZ + 0.14), M["chrome"], 10, 8))
    o = join(leaf, name)
    set_origin(o, g(hx, 0, GZ + 0.06))
    P_(o)

# ---- outside: sand to the horizon (no lawn), a paved path from the gate ------------------------------------------------------------
outer = 70.0
for name, x0, x1, z0, z1 in (
    ("SandOutNear", -outer, RM["minX"], -outer, outer),
    ("SandOutFar", RM["maxX"], outer, -outer, outer),
    ("SandOutLeft", RM["minX"], RM["maxX"], -outer, RM["minZ"]),
    ("SandOutRight", RM["minX"], RM["maxX"], RM["maxZ"], outer),
):
    P_(rect_up(name, x0, x1, z0, z1, -0.02, M["sand"]))
P_(rect_up("GatePath", -1.6, 1.6, -26.0, RM["minZ"], -0.005, M["pavers"]))
for s in (-1, 1):
    P_(box("PathEdge", s * 1.6 - 0.06, s * 1.6 + 0.06, -0.05, 0.05, -26.0, RM["minZ"], M["teak"], 0.01))

# ---- the deck's paint (floor.glb): wet sand, the wrack line, blown sand, damp patches, grime at the walls ---------------------------
P = PAINT
SIZE = P["size"]
xs_ = P["x0"] + (np.arange(SIZE) + 0.5) / SIZE * P["span"]
zs_ = P["z0"] + (np.arange(SIZE) + 0.5) / SIZE * P["span"]
WX, WZ = np.meshgrid(xs_, zs_)  # rows: z, columns: x
rng = np.random.default_rng(77)


def vnoise(scale, seed, octaves=3):
    out = np.zeros_like(WX)
    amp, tot = 1.0, 0.0
    r = np.random.default_rng(seed)
    for o in range(octaves):
        n = int(P["span"] / scale * 2**o) + 2
        grid = r.random((n, n)).astype(np.float32)
        u = (WX - P["x0"]) / P["span"] * (n - 1)
        v = (WZ - P["z0"]) / P["span"] * (n - 1)
        i, j = np.floor(u).astype(int), np.floor(v).astype(int)
        fu, fv = u - i, v - j
        fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
        i1, j1 = np.clip(i + 1, 0, n - 1), np.clip(j + 1, 0, n - 1)
        a = grid[j, i] * (1 - fu) + grid[j, i1] * fu
        b = grid[j1, i] * (1 - fu) + grid[j1, i1] * fu
        out += amp * (a * (1 - fv) + b * fv)
        tot += amp
        amp *= 0.5
    return out / tot


rgb = np.zeros(WX.shape + (3,), np.float32)
alpha = np.zeros(WX.shape, np.float32)


def lay(colour, a):
    """Paint `colour` over what is there with coverage `a` (premultiplied; divided out at the end)."""
    global rgb, alpha
    c = np.array(colour, np.float32)
    a = np.clip(a, 0, 1)
    rgb = c * a[..., None] + rgb * (1 - a[..., None])
    alpha = a + alpha * (1 - a)


on_beach = (WX > SAND_EDGE) & (WX < HALF_X) & (np.abs(WZ) < HALF_Z)
n1 = vnoise(1.2, 3)
n2 = vnoise(0.35, 4)
# the wet sand: from the water's edge up the beach, darker and a little cooler, fading out irregularly
shore = -HALF_X - 0.1 + (n1 - 0.5) * 0.5 + np.sin(WZ * 0.9) * 0.15
wet = np.clip((WX - (shore - 1.5)) / 1.5, 0, 1) * on_beach
lay((0.66, 0.55, 0.4), wet * 0.55)
# the wrack line: a ragged band of seaweed and shell bits where the run-up stops
wrack_x = -HALF_X - 1.05 + (n1 - 0.5) * 0.7 + np.sin(WZ * 0.55 + 1.3) * 0.25
wr = np.clip(1 - np.abs(WX - wrack_x) / 0.14, 0, 1) * (n2 > 0.5) * on_beach
lay((0.32, 0.33, 0.18), wr * 0.75)
bits = (rng.random(WX.shape) > 0.985) * np.clip(1 - np.abs(WX - wrack_x) / 0.5, 0, 1) * on_beach
lay((0.95, 0.9, 0.82), bits * 0.9)
# dry sand trodden and scuffed near the boardwalk (no footprints: the creator's rule), shadows of ripples
scuff = np.clip((n2 - 0.55) * 3, 0, 1) * np.clip((WX - SAND_EDGE) / 0.6, 0, 1) * np.clip((-8.6 - WX) / 0.8, 0, 1) * on_beach
lay((0.83, 0.71, 0.52), scuff * 0.35)
# sand blown onto the pavers: along the boardwalk, in the ends' corners against the walls
deck = ~on_beach
blown = np.clip(1 - (BW0 - 0.2 - WX) / 1.2, 0, 1) * (WX < BW0) * (np.abs(WZ) < 14)
blown = np.maximum(blown, np.clip(1 - (np.abs(WZ) - POOLZ) / 0.9, 0, 1) * (WX < -6.0) * (np.abs(WZ) > POOLZ) * (WX > BW0))
blown = blown * np.clip((vnoise(0.6, 9) - 0.35) * 2.2, 0, 1) * deck
lay((0.86, 0.75, 0.55), blown * 0.6)
# damp patches where the bathers walk out onto the ends (the deck just past the sand), and round the showers
damp = np.zeros_like(WX)
for zc in (-11.0, 10.9):
    damp = np.maximum(damp, np.clip(1 - np.hypot((WX + 8.6) / 2.2, (WZ - zc) / 1.1), 0, 1))
for xc in (-9.0, -6.0, -3.0):
    damp = np.maximum(damp, np.clip(1 - np.hypot((WX - xc) / 0.7, (WZ - 12.9) / 0.5), 0, 1))
damp = damp * np.clip((vnoise(0.4, 12) - 0.3) * 2.5, 0, 1) * deck
lay((0.6, 0.52, 0.42), damp * 0.45)
# grime at the walls' feet and in the service yard, a rust streak under the pipes
edge_d = np.minimum.reduce([WX - RM["minX"], RM["maxX"] - WX, WZ - RM["minZ"], RM["maxZ"] - WZ])
grime = np.clip(1 - edge_d / 0.5, 0, 1) * (0.5 + 0.5 * vnoise(0.5, 14))
yard = (WX > 7.4) & (WZ < -HOUSE_HZ)
grime = np.maximum(grime, yard * np.clip(vnoise(0.8, 15) - 0.45, 0, 1) * 1.4)
lay((0.42, 0.38, 0.32), grime * 0.4 * deck)
# out of the room: nothing (the sand outside is its own)
inside = (WX > RM["minX"]) & (WX < RM["maxX"]) & (WZ > RM["minZ"]) & (WZ < RM["maxZ"])
rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
alpha *= inside
img = bpy.data.images.new("wave_paint", SIZE, SIZE, alpha=True)
img.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), alpha])[::-1].astype(np.float32).ravel())
img.filepath_raw = os.path.join(SIGNS, "wave_paint.png")
img.file_format = "PNG"
img.save()
cover = plane("Paint", P["span"], P["span"], g(P["x0"] + P["span"] / 2, 0.004, P["z0"] + P["span"] / 2), signmat("wave_paint", 0.8), rot=(0, 0, 0))
floor.append(cover)

print("SHELL", tris(parts))
if LOOK:
    cover.hide_render = True
    look("shell_overview", g(-1, 0, -1), 34, 52, 270, (1280, 720), 16, 30)
    look("shell_gate", g(0, 1.5, -15.5), 9, 18, 0, (960, 640), 16, 30)
    look("shell_beach", g(-8.5, 0, 0), 10, 30, 240, (960, 640), 16, 30)
cover.hide_render = False
save_part("shell", parts)
save_part("floor", floor)
