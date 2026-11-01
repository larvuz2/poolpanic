"""Senior Aqua Fit's ground and structure, in game coordinates from the game's own plan (kit.PLAN):
- the deck of travertine to the walls, the frieze of emerald-and-gold mosaic round the pool between brass strips, the lounge's two
  Persian rugs either side of an emerald runner with brass stair-rods from the doors, the mosaic doormat (SALVETE);
- the pool: the art-deco fan mosaic on its floor and walls, the waterline frieze, the marble bullnose coping with brass depth plates,
  two marble steps across the near end with curling brass handrails, brass ladders at the far end, and the swan in tile on the floor
  (a pink swimming cap, pearls);
- the back wall: cream stucco, an emerald-tiled dado under a brass rail, pilasters with capitals, the cornice, a pediment over the
  doorway with the main sign, the glass doors (`Door_A`/`Door_B`, the game swings them);
- the near side's low cream-brick wall with its brass cap (the overview looks over it);
- the glazing of the far side and the far end: the dwarf wall, white cast-iron columns with capitals, the panes, mullions and
  transoms, a fanlight in every bay, cast-iron lace in the spandrels, the eave beam and its gutter;
- the roof (the Coach Cam's only: COACH_PARTS): two slopes of glass on iron rafters and purlins, a ridge lantern, cresting and
  finials, the back gable in stucco, the end gable's fan of bars;
- outside: the conservatory stands on a stone terrace above the garden (the garden at -1.95, as the classic's);
- floor.glb: the deck's paint (worn where the guests walk in, damp round the steps, the spa and the hoist, petals under the far
  glass, grime at the walls' feet).

    blender -b -P tools/venues/senior/shell.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(1926)
TAU = 2 * PI
GROUND_Y = -1.95
M = dict(
    trav=tmat_tile("travertine", "#e6dac2", 0.42),
    fan=tmat_tile("fanmosaic", "#2a9d9a", 0.2),
    marble=tmat_tile("marble", "#f2eee6", 0.2),
    band=tmat_tile("mosaic_band", "#1f5c4a", 0.22),
    stucco=tmat_tile("stucco", "#eee2cc", 0.9),
    brick=tmat_tile("brick", "#e6d6bb", 0.85),
    mahog=tmat_tile("teak", "#5b2c1a", 0.45, tint="#7a4a36"),
    iron=sm("iron"),
    brass=sm("brass"),
    emerald=sm("emerald"),
    deep=sm("emerald_deep"),
    cream=sm("cream"),
    trim=sm("trim", "#faf4e8", 0.6),
    glass=sm("glass", "#e6f4ef", 0.05, alpha=0.25),
    frost=sm("frost", "#e8f0ec", 0.25),
    stone=sm("stone", "#d9cdb5", 0.85),
    runner=sm("runner", "#1d5a45", 0.95),
    lace=cutmat("iron_lace", 0.4),
    swan=cutmat("swan", 0.25),
    rug=signmat("rug", 0.95),
    zimmer=cutmat("zimmer", 0.6),
)
parts, roof, floor = [], [], []


def P_(*objs):
    parts.extend(o for o in objs if o is not None)


def RF(*objs):
    roof.extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def quad_mesh(name, rows, m, uv=None):
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
    for p in o.data.polygons:
        if (p.normal.z < 0) == up:
            p.flip()
    o.data.update()
    return o


def rect_up(name, x0, x1, z0, z1, y, m, uv=None):
    return face_up(quad_mesh(name, [[(x0, y, z0), (x1, y, z0)], [(x0, y, z1), (x1, y, z1)]], m, uv))


def pic(name, w, h, x, y, z, m, facing):
    """A picture standing upright facing `facing` ('+x', '-x', '+z', '-z')."""
    rz = {"+z": 0, "-z": PI, "-x": -PI / 2, "+x": PI / 2}[facing]
    return plane(name, w, h, g(x, y, z), m, rot=(PI / 2, 0, rz))


# ---- the deck ---------------------------------------------------------------------------------------------------------------------
OX, OZ = PX + COPE, PZ + COPE  # the coping's outer edge
W_ = WALL
for name, x0, x1, z0, z1 in (
    ("DeckNear", W_["near"], -OX, W_["back"], W_["end"]),
    ("DeckFar", OX, W_["far"], W_["back"], W_["end"]),
    ("DeckBack", -OX, OX, W_["back"], -OZ),
    ("DeckEnd", -OX, OX, OZ, W_["end"]),
):
    P_(rect_up(name, x0, x1, z0, z1, 0.0, M["trav"]))
# the frieze round the pool: the band 0.42 wide, 0.82 out from the basin, between brass strips (inlaid)
FI, FW = 0.82, 0.42
for s in (-1, 1):
    zc = s * (PZ + FI + FW / 2)
    P_(rect_up("Frieze", -(PX + FI + FW), PX + FI + FW, zc - FW / 2, zc + FW / 2, 0.003, M["band"]))
    xc = s * (PX + FI + FW / 2)
    P_(rect_up("Frieze", xc - FW / 2, xc + FW / 2, -(PZ + FI), PZ + FI, 0.003, M["band"]))
    for r in (-1, 1):
        P_(box("FriezeBrass", -(PX + FI + FW) - 0.02, PX + FI + FW + 0.02, 0.0, 0.006, zc + r * FW / 2 - 0.02, zc + r * FW / 2 + 0.02, M["brass"], 0))
        P_(box("FriezeBrass", xc + r * FW / 2 - 0.02, xc + r * FW / 2 + 0.02, 0.0, 0.006, -(PZ + FI + FW), PZ + FI + FW, M["brass"], 0))

# the lounge: two Persian rugs either side of the emerald runner (the waiting places stand on them: flat)
q0 = QUEUE[0]
inner = min(abs(q["x"]) for q in QUEUE)
outer = max(abs(q["x"]) for q in QUEUE)
rz1 = max(q["z"] for q in QUEUE) + 0.8
rz0 = DECK["minZ"] + 0.05
for s in (-1, 1):
    x0, x1 = s * (inner - 0.75), s * (outer + 0.75)
    uv = [[(0, 0), (1, 0)], [(0, 1), (1, 1)]]
    P_(rect_up("Rug", min(x0, x1), max(x0, x1), rz0, rz1, 0.006, M["rug"], uv if s < 0 else [[(1, 0), (0, 0)], [(1, 1), (0, 1)]]))
    P_(box("RugFringe", min(x0, x1), max(x0, x1), 0.0, 0.008, rz0 - 0.06, rz0, M["cream"], 0))
    P_(box("RugFringe", min(x0, x1), max(x0, x1), 0.0, 0.008, rz1, rz1 + 0.06, M["cream"], 0))
RW, RZ2 = 1.5, -9.0
P_(box("Runner", -RW / 2, RW / 2, 0.0, 0.01, W_["back"], RZ2, M["runner"], 0))
for x in (-RW / 2, RW / 2):
    P_(box("RunnerEdge", x - 0.03, x + 0.03, 0.0, 0.012, W_["back"], RZ2, M["brass"], 0))
for k in range(9):
    z = W_["back"] + 0.6 + k * (RZ2 - W_["back"] - 0.8) / 8
    P_(rod("StairRod", (-RW / 2 - 0.05, 0.016, z), (RW / 2 + 0.05, 0.016, z), 0.012, M["brass"], 6))
# (its words read from inside the room, looking at the doors)
P_(rect_up("Doormat", -1.25, 1.25, W_["back"] + 0.05, W_["back"] + 0.95, 0.013, signmat("doormat", 0.9), [[(0, 1), (1, 1)], [(0, 0), (1, 0)]]))

# ---- the pool ---------------------------------------------------------------------------------------------------------------------
P_(rect_up("PoolFloor", -PX, PX, -PZ, PZ, FLOOR_Y, M["fan"]))
for s in (-1, 1):
    # the long walls and the ends: the fan mosaic below, the frieze at the waterline
    for name, y0, y1, m in (("PoolWall", FLOOR_Y, -0.42, M["fan"]), ("PoolBand", -0.42, 0.0, M["band"])):
        o = quad_mesh(name, [[(s * PX, y0, -PZ), (s * PX, y0, PZ)], [(s * PX, y1, -PZ), (s * PX, y1, PZ)]], m)
        for p in o.data.polygons:
            if (p.normal.x > 0) == (s > 0):
                p.flip()
        P_(o)
        o = quad_mesh(name, [[(-PX, y0, s * PZ), (PX, y0, s * PZ)], [(-PX, y1, s * PZ), (PX, y1, s * PZ)]], m)
        for p in o.data.polygons:
            if (p.normal.y < 0) == (s > 0):  # (Blender y is -z: face the water)
                p.flip()
        P_(o)
# the coping: marble bullnose all round, its nose over the water
for s in (-1, 1):
    P_(box("Coping", -OX, OX, -0.04, 0.05, s * PZ - 0.04 * s, s * OZ, M["marble"], 0.035))
    P_(box("Coping", s * PX - 0.04 * s, s * OX, -0.04, 0.05, -PZ, PZ, M["marble"], 0.035))
# brass depth plates on the coping: both long sides, three each
for s in (-1, 1):
    for z in (-5.5, 0.0, 5.5):
        P_(face_up(plane("Depth", 0.34, 0.14, g(s * (PX + COPE / 2), 0.052, z), signmat("depth", 0.3), rot=(0, 0, PI / 2 if s < 0 else -PI / 2))))
# two marble steps across the near end, under the water; brass handrails at its sides
for i in range(2):
    P_(box("Step", -PX + 0.05, PX - 0.05, -0.62 - i * 0.32 - 0.09, -0.62 - i * 0.32 + 0.09, -PZ + i * 0.5, -PZ + 0.5 + i * 0.5, M["marble"], 0.03))
    P_(box("StepRiser", -PX + 0.05, PX - 0.05, FLOOR_Y, -0.62 - i * 0.32 - 0.09, -PZ + i * 0.5, -PZ + 0.5 + i * 0.5, M["fan"], 0.0))
for x in (-PX + 0.35, PX - 0.35):
    pts = [g(x, 0.02, -PZ - 0.55), g(x, 0.95, -PZ - 0.35), g(x, 0.95, -PZ + 0.35), g(x, -0.55, -PZ + 1.1)]
    P_(tube("Handrail", pts, 0.04, M["brass"], 8, 10))
    P_(cyl("HandrailFoot", 0.07, 0.04, g(x, 0.0, -PZ - 0.55), M["brass"], 12))
# brass ladders at the far end's corners
for x in (-PX + 1.2, PX - 1.2):
    for dx in (-0.25, 0.25):
        pts = [g(x + dx, -0.9, PZ - 0.12), g(x + dx, 0.2, PZ - 0.12), g(x + dx, 0.75, PZ + 0.12), g(x + dx, 0.05, PZ + 0.5)]
        P_(tube("LadderRail", pts, 0.025, M["brass"], 8, 8))
    for k in range(3):
        y = -0.8 + k * 0.3
        P_(box("LadderRung", x - 0.25, x + 0.25, y - 0.025, y + 0.025, PZ - 0.2, PZ - 0.06, M["brass"], 0.01))
# the swan in tile on the floor, 4.6 m across, gliding toward the far end; head to +z, the picture's top to +x
SW = 4.6
srows, suv = [], []
for j in range(2):
    x = -SW / 2 + j * SW
    srows.append([(x, FLOOR_Y + 0.012, 1.0 - SW / 2 + i * SW) for i in range(2)])
    suv.append([(i, j) for i in range(2)])
P_(face_up(quad_mesh("Swan", srows, M["swan"], suv)))

# ---- the back wall ----------------------------------------------------------------------------------------------------------------
Z = W_["back"]
H = 6.2
gap = DOOR_HALF + 0.18
for s in (-1, 1):
    a, b = (ROOM["minX"], -gap) if s < 0 else (gap, ROOM["maxX"])
    P_(box("BackWall", a, b, 0, H, Z - 0.3, Z, M["stucco"], 0.02))
P_(box("BackWallOver", -gap, gap, 3.25, H, Z - 0.3, Z, M["stucco"], 0.02))
P_(box("Skirting", ROOM["minX"], ROOM["maxX"], 0, 0.22, Z, Z + 0.05, M["trim"], 0.01))
for s in (-1, 1):
    a, b = (ROOM["minX"] + 0.1, -gap - 0.1) if s < 0 else (gap + 0.1, ROOM["maxX"] - 0.1)
    P_(box("Dado", a, b, 0.22, 1.12, Z, Z + 0.03, sm("dado_tile", "#1f5c4a", 0.18), 0.0))
    for k in range(int((b - a) / 0.3)):
        x = a + 0.15 + k * 0.3
        P_(box("DadoJoint", x - 0.006, x + 0.006, 0.22, 1.12, Z + 0.03, Z + 0.032, M["cream"], 0))
    P_(box("DadoRail", a, b, 1.12, 1.18, Z, Z + 0.07, M["brass"], 0.01))
P_(box("Cornice", ROOM["minX"], ROOM["maxX"], H - 0.25, H + 0.05, Z, Z + 0.35, M["trim"], 0.04))
P_(box("CorniceDentils", ROOM["minX"], ROOM["maxX"], H - 0.4, H - 0.25, Z, Z + 0.15, M["trim"], 0.02))
for x in (-12.4, -8.4, -3.2, 3.2, 8.4, 12.4):
    P_(box("Pilaster", x - 0.31, x + 0.31, 0, H - 0.3, Z, Z + 0.16, M["trim"], 0.03))
    P_(box("PilasterBase", x - 0.36, x + 0.36, 0, 0.32, Z, Z + 0.2, M["trim"], 0.02))
    P_(box("PilasterCap", x - 0.39, x + 0.39, H - 0.62, H - 0.4, Z, Z + 0.26, M["trim"], 0.03))
    for k in range(5):
        xx = x - 0.2 + k * 0.1
        P_(box("Flute", xx - 0.018, xx + 0.018, 0.4, H - 0.7, Z + 0.16, Z + 0.17, M["cream"], 0.0))
# the doorway: a brass frame, a pediment with the main sign
P_(box("DoorHead", -gap - 0.12, gap + 0.12, 3.15, 3.39, Z, Z + 0.3, M["brass"], 0.03))
for s in (-1, 1):
    P_(box("DoorJamb", s * (gap + 0.04) - 0.08, s * (gap + 0.04) + 0.08, 0, 3.15, Z, Z + 0.3, M["brass"], 0.02))
pd = [(-2.6, 4.5), (2.6, 4.5), (0, 5.5)]
bm = bmesh.new()
vs = [bm.verts.new(g(x, y, Z + 0.06)) for x, y in pd]
bm.faces.new(vs)
me = bpy.data.meshes.new("Pediment")
bm.to_mesh(me)
bm.free()
ped = bpy.data.objects.new("Pediment", me)
bpy.context.scene.collection.objects.link(ped)
ped.data.materials.append(M["trim"])
sol = ped.modifiers.new("S", "SOLIDIFY")
sol.thickness = 0.12
P_(ped)
for a, b in ((pd[0], pd[2]), (pd[2], pd[1]), (pd[0], pd[1])):
    P_(rod("PedimentMould", (a[0], a[1], Z + 0.2), (b[0], b[1], Z + 0.2), 0.06, M["trim"], 8))
P_(box("SignFrame", -1.42, 1.42, 3.46, 4.4, Z + 0.06, Z + 0.14, M["brass"], 0.03))
P_(pic("MainSign", 2.7, 0.9, 0, 3.93, Z + 0.15, signmat("sign_main", 0.35), "+z"))
# the glass doors: brass frames round frosted panes, push bars, an etched band (the game swings them)
for side, name in ((-1, "Door_A"), (1, "Door_B")):
    hx = side * DOOR_HALF
    lw = DOOR_HALF - 0.04
    cx = hx - side * lw / 2
    leaf = [box("DoorPane", cx - (lw - 0.16) / 2, cx + (lw - 0.16) / 2, 0.15, 2.85, Z + 0.07, Z + 0.1, M["frost"], 0.0)]
    for y in (0.1, 2.9):
        leaf.append(box("DoorRail", cx - lw / 2, cx + lw / 2, y - 0.06, y + 0.06, Z + 0.05, Z + 0.12, M["brass"], 0.01))
    for xx in (cx - lw / 2 + 0.05, cx + lw / 2 - 0.05):
        leaf.append(box("DoorStile", xx - 0.05, xx + 0.05, 0.04, 2.96, Z + 0.05, Z + 0.12, M["brass"], 0.01))
    leaf.append(box("DoorEtch", cx - (lw - 0.2) / 2, cx + (lw - 0.2) / 2, 2.3, 2.4, Z + 0.1, Z + 0.105, M["cream"], 0))
    leaf.append(rod("PushBar", (cx + side * (lw / 2 - 0.25), 1.05, Z + 0.2), (cx - side * (lw / 2 - 0.4), 1.05, Z + 0.2), 0.025, M["brass"], 8))
    o = join(leaf, name)
    set_origin(o, g(hx, 0, Z + 0.06))
    P_(o)

# ---- the near side's low wall -------------------------------------------------------------------------------------------------------
NX = W_["near"]
P_(box("NearWall", NX - 0.16, NX + 0.16, 0, 0.75, W_["back"], W_["end"], M["brick"], 0.03))
P_(box("NearWallCap", NX - 0.21, NX + 0.21, 0.75, 0.83, W_["back"], W_["end"], M["brass"], 0.02))


# ---- the glazing of the far side and the far end -------------------------------------------------------------------------------------
def column(x, z, height=ROOF["eave"]):
    out = [cyl("ColBase", 0.2, 0.3, g(x, 0, z), M["iron"], 12, r2=0.17)]
    out.append(cyl("Col", 0.12, height - 0.55, g(x, 0.3, z), M["iron"], 12, r2=0.1))
    out.append(cyl("ColNeck", 0.11, 0.08, g(x, height - 0.5, z), M["brass"], 12))
    out.append(cyl("ColCap", 0.11, 0.24, g(x, height - 0.42, z), M["iron"], 12, r2=0.21))
    out.append(box("ColAbacus", x - 0.22, x + 0.22, height - 0.18, height - 0.08, z - 0.22, z + 0.22, M["iron"], 0.02))
    return out


COLS = set()


def glazing_run(a0, a1, at, along_z):
    """A run of glazing: along z at x = at (the far side) or along x at z = at (the far end)."""
    L = a1 - a0
    bays = max(1, round(L / 3.2))
    bay = L / bays
    E = ROOF["eave"]

    def P3(u, y, d=0.0):
        return (at + d, y, u) if along_z else (u, y, at + d)

    def B(name, u0, u1, y0, y1, t0, t1, m, bev=0.01):
        if along_z:
            return box(name, at + t0, at + t1, y0, y1, u0, u1, m, bev)
        return box(name, u0, u1, y0, y1, at + t0, at + t1, m, bev)

    out = [B("DwarfWall", a0 - 0.15, a1 + 0.15, 0, 0.75, -0.16, 0.16, M["brick"], 0.03)]
    out.append(B("DwarfCap", a0 - 0.2, a1 + 0.2, 0.75, 0.83, -0.21, 0.21, M["brass"], 0.02))
    face = "-x" if along_z else "-z"
    for i in range(bays + 1):
        u = a0 + i * bay
        key = (round(P3(u, 0)[0], 2), round(P3(u, 0)[2], 2))
        if key not in COLS:
            COLS.add(key)
            out += column(*([at, u] if along_z else [u, at]))
        if i == bays:
            continue
        mid = u + bay / 2
        paneH = E - 0.95 - 0.45
        # the glass, its bars, the transom, the fanlight over it and its radial bars
        x, y, z = P3(mid, 0.86 + paneH / 2)
        gp = plane("Glass_Pane", bay - 0.24, paneH, g(x, y, z), M["glass"], rot=(PI / 2, 0, PI / 2 if along_z else 0))
        out.append(gp)
        for k in (-1 / 3, 1 / 3):
            out.append(B("Mullion", mid + k * bay - 0.025, mid + k * bay + 0.025, 0.83, E - 0.45, -0.035, 0.035, M["iron"], 0.008))
        out.append(B("Transom", u + 0.12, u + bay - 0.12, 2.97, 3.03, -0.04, 0.04, M["iron"], 0.008))
        out.append(B("Sill", u + 0.1, u + bay - 0.1, 0.83, 0.9, -0.05, 0.05, M["iron"], 0.008))
        r = bay * 0.36
        cx, cy, cz = P3(mid, 3.03)
        fan = torus("Fanlight", r, 0.035, (0, 0, 0), M["iron"], 24, 6)
        # (a half ring standing in the plane of the glass: drop its lower half)
        fan.rotation_euler = (PI / 2, 0, PI / 2 if along_z else 0)
        fan.location = g(cx, cy, cz)
        apply_all(fan)
        bmf = bmesh.new()
        bmf.from_mesh(fan.data)
        lowest = [v for v in bmf.verts if v.co.z < -0.02]  # (apply_all keeps the location: the mesh is about its centre)
        bmesh.ops.delete(bmf, geom=lowest, context="VERTS")
        bmf.to_mesh(fan.data)
        bmf.free()
        out.append(fan)
        for k in range(1, 6):
            aa = k / 6 * PI
            p0 = P3(mid, 3.03)
            p1 = P3(mid - math.cos(aa) * r, 3.03 + math.sin(aa) * r)
            out.append(rod("FanBar", p0, p1, 0.016, M["iron"], 5))
        # the iron lace in the spandrels either side of the arch, under the eave
        for sgn in (-1, 1):
            w_ = bay / 2 - 0.12
            uc = mid + sgn * (bay / 2 - w_ / 2 - 0.12)
            hy = E - 0.45 - 3.03
            s_ = min(w_, r + 0.2)
            x, y, z = P3(uc, E - 0.45 - s_ / 2, -0.005)
            lp = plane("Lace", s_, s_, g(x, y, z), M["lace"], rot=(PI / 2, 0, PI / 2 if along_z else 0))
            # (mirror the left one so the lace's arch side faces the fanlight)
            if sgn < 0:
                lp.scale = (-1, 1, 1)
                apply_all(lp)
            out.append(lp)
        out.append(B("EaveBand", u, u + bay, E - 0.45, E - 0.32, -0.08, 0.08, M["iron"], 0.01))
    out.append(B("EaveBeam", a0 - 0.15, a1 + 0.15, E - 0.12, E + 0.12, -0.14, 0.14, M["iron"], 0.03))
    out.append(B("Gutter", a0 - 0.15, a1 + 0.15, E + 0.05, E + 0.2, 0.1, 0.3, M["iron"], 0.02))
    return out


P_(*glazing_run(W_["back"], W_["end"], W_["far"], True))
P_(*glazing_run(W_["near"], W_["far"], W_["end"], False))
# a column at the near end's corner (the classic's)
P_(*column(W_["near"], W_["end"]))

# ---- the roof (the Coach Cam's only) -------------------------------------------------------------------------------------------------
E, RG = ROOF["eave"], ROOF["ridge"]
z0, z1 = W_["back"], W_["end"]
for s in (-1, 1):
    edge = W_["near"] if s < 0 else W_["far"]
    # the glass of the slope: a quad from the eave to the ridge
    RF(quad_mesh("Glass_Roof", [[(edge, E, z0), (edge, E, z1)], [(0.0, RG, z0), (0.0, RG, z1)]], M["glass"]))
    n = round((z1 - z0) / 1.6)
    for k in range(n + 1):
        z = z0 + k * (z1 - z0) / n
        RF(rod("Rafter", (edge, E, z), (0.0, RG, z), 0.05, M["iron"], 6))
    for t in (0.25, 0.5, 0.75):
        x, y = edge * (1 - t), E + (RG - E) * t
        RF(rod("Purlin", (x, y - 0.06, z0), (x, y - 0.06, z1), 0.04, M["iron"], 6))
RF(box("Ridge", -0.2, 0.2, RG - 0.1, RG + 0.15, z0, z1, M["iron"], 0.03))
# the ridge lantern: a little glazed clerestory with its own roof
RF(box("LanternBase", -1.2, 1.2, RG - 0.05, RG + 0.05, -8.0, 6.0, M["iron"], 0.02))
for s in (-1, 1):
    RF(quad_mesh("Glass_Lantern", [[(s * 1.15, RG, -8.0), (s * 1.15, RG, 6.0)], [(s * 1.15, RG + 0.8, -8.0), (s * 1.15, RG + 0.8, 6.0)]], M["glass"]))
    for k in range(15):
        z = -8.0 + k
        RF(box("LanternPost", s * 1.15 - 0.03, s * 1.15 + 0.03, RG, RG + 0.8, z - 0.03, z + 0.03, M["iron"], 0.005))
    RF(quad_mesh("Glass_LanternRoof", [[(s * 1.25, RG + 0.8, -8.1), (s * 1.25, RG + 0.8, 6.1)], [(0, RG + 1.3, -8.1), (0, RG + 1.3, 6.1)]], M["glass"]))
RF(box("LanternRidge", -0.08, 0.08, RG + 1.25, RG + 1.38, -8.1, 6.1, M["iron"], 0.01))
for z in [z0 + k * 0.5 for k in range(int((z1 - z0) / 0.5) + 1)]:
    if -8.2 < z < 6.2:
        continue
    RF(box("Cresting", -0.015, 0.015, RG + 0.15, RG + 0.45, z - 0.015, z + 0.015, M["iron"], 0))
for z in (z0, z1):
    RF(cyl("Finial", 0.12, 0.8, g(0, RG + 0.15, z), M["brass"], 10, r2=0.0))
# the back gable in stucco, the far end's gable glass with a fan of bars
for zz, m in ((z0 - 0.15, M["stucco"]), (z1, M["glass"])):
    bm = bmesh.new()
    vs = [bm.verts.new(g(W_["near"], E, zz)), bm.verts.new(g(W_["far"], E, zz)), bm.verts.new(g(0, RG, zz))]
    bm.faces.new(vs)
    me = bpy.data.meshes.new("Gable")
    bm.to_mesh(me)
    bm.free()
    gab = bpy.data.objects.new("Glass_Gable" if m is M["glass"] else "Gable", me)
    bpy.context.scene.collection.objects.link(gab)
    gab.data.materials.append(m)
    if m is M["stucco"]:
        sol = gab.modifiers.new("S", "SOLIDIFY")
        sol.thickness = 0.3
    RF(gab)
for k in range(1, 10):
    aa = k / 10 * PI
    r = 14.0
    ex, ey = math.cos(aa) * r, math.sin(aa) * r * ((RG - E) / 15.1)
    RF(rod("GableBar", (0, E, z1), (ex, E + ey, z1), 0.03, M["iron"], 5))
# brass pendant lamps on chains down the middle (no glow points: the Coach Cam's)
for z in (-9, -2, 5):
    for x in (-4.8, 4.8):
        top = E + (RG - E) * (1 - abs(x) / 15.1) - 0.1
        RF(rod("PendantChain", (x, top, z), (x, 4.4, z), 0.012, M["brass"], 4))
        RF(cyl("PendantCap", 0.22, 0.2, g(x, 4.3, z), M["brass"], 14, r2=0.04))
        RF(sphere("PendantGlobe", 0.2, g(x, 4.18, z), lamp_mat("pendant_glass", "#fff1d6", 3.0), 14, 10))

# ---- outside: the terrace the conservatory stands on, its stone face down to the garden ---------------------------------------------
for name, x0, x1, z0_, z1_ in (
    ("TerraceFar", ROOM["maxX"] - 0.05, ROOM["maxX"] + 0.35, ROOM["minZ"], ROOM["maxZ"] + 0.35),
    ("TerraceEnd", ROOM["minX"] - 0.35, ROOM["maxX"] + 0.35, ROOM["maxZ"] - 0.05, ROOM["maxZ"] + 0.35),
    ("TerraceNear", ROOM["minX"] - 0.35, ROOM["minX"] + 0.05, ROOM["minZ"], ROOM["maxZ"] + 0.35),
):
    P_(box(name, x0, x1, GROUND_Y, 0.02, z0_, z1_, M["stone"], 0.02))
P_(rect_up("TerraceTop", ROOM["minX"] - 0.35, ROOM["maxX"] + 0.35, W_["end"], ROOM["maxZ"] + 0.35, 0.0, M["trav"]))
P_(rect_up("TerraceTopFar", W_["far"], ROOM["maxX"] + 0.35, ROOM["minZ"], ROOM["maxZ"], 0.0, M["trav"]))
P_(rect_up("TerraceTopNear", ROOM["minX"] - 0.35, W_["near"], ROOM["minZ"], ROOM["maxZ"], 0.0, M["trav"]))

# ---- the deck's paint (floor.glb) -------------------------------------------------------------------------------------------------------
Pt = PAINT
SIZE = Pt["size"]
xs_ = Pt["x0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
zs_ = Pt["z0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
WX, WZ = np.meshgrid(xs_, zs_)
rng = np.random.default_rng(1926)


def vnoise(scale, seed, octaves=3):
    out = np.zeros_like(WX)
    amp, tot = 1.0, 0.0
    r = np.random.default_rng(seed)
    for o in range(octaves):
        n = int(Pt["span"] / scale * 2**o) + 2
        grid = r.random((n, n)).astype(np.float32)
        u = (WX - Pt["x0"]) / Pt["span"] * (n - 1)
        v = (WZ - Pt["z0"]) / Pt["span"] * (n - 1)
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
    global rgb, alpha
    c = np.array(colour, np.float32)
    a = np.clip(a, 0, 1)
    rgb = c * a[..., None] + rgb * (1 - a[..., None])
    alpha = a + alpha * (1 - a)


deck = ~((np.abs(WX) < OX) & (np.abs(WZ) < OZ))
n1 = vnoise(0.6, 3)
# the worn way in: from the doors down the runner and round to the steps
wear = np.clip(1 - np.abs(WX) / 2.6, 0, 1) * (WZ < -8.5) * (WZ > W_["back"])
lay((0.78, 0.72, 0.6), wear * 0.18 * (0.6 + 0.4 * n1) * deck)
# damp round the steps (the near end), the spa, the hoist, the ladders
damp = np.zeros_like(WX)
for cx, cz, rx, rz in ((0, -PZ - 0.9, 5.5, 0.9), (-11.7, 8.0, 2.4, 2.4), (-7.35, 4.4, 1.0, 1.0), (-5.4, PZ + 0.7, 0.8, 0.5), (5.4, PZ + 0.7, 0.8, 0.5)):
    damp = np.maximum(damp, np.clip(1 - np.hypot((WX - cx) / rx, (WZ - cz) / rz), 0, 1))
damp *= np.clip((vnoise(0.35, 7) - 0.3) * 2.4, 0, 1) * deck
lay((0.62, 0.58, 0.5), damp * 0.4)
# rose petals under the far glass and the end's baskets
petals = (rng.random(WX.shape) > 0.9975) * ((WX > 13.6) | (WZ > 12.2)) * deck
lay((0.94, 0.55, 0.62), petals * 0.95)
# grime at the walls' feet, a little green in the glass corners
edge = np.minimum.reduce([WX - W_["near"], W_["far"] - WX, WZ - W_["back"], W_["end"] - WZ])
lay((0.45, 0.42, 0.34), np.clip(1 - edge / 0.45, 0, 1) * (0.5 + 0.5 * vnoise(0.4, 11)) * 0.35 * deck)
moss = np.clip(1 - edge / 0.3, 0, 1) * ((WX > 14) | (WZ > 12.6)) * np.clip((vnoise(0.25, 12) - 0.5) * 3, 0, 1)
lay((0.42, 0.5, 0.3), moss * 0.5 * deck)
rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
inside = (WX > W_["near"]) & (WX < W_["far"]) & (WZ > W_["back"]) & (WZ < W_["end"])
alpha *= inside
img = bpy.data.images.new("senior_paint", SIZE, SIZE, alpha=True)
img.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), alpha])[::-1].astype(np.float32).ravel())
img.filepath_raw = os.path.join(SIGNS, "senior_paint.png")
img.file_format = "PNG"
img.save()
cover = plane("Paint", Pt["span"], Pt["span"], g(Pt["x0"] + Pt["span"] / 2, 0.004, Pt["z0"] + Pt["span"] / 2), signmat("senior_paint", 0.8), rot=(0, 0, 0))
floor.append(cover)

print("SHELL", tris(parts), "ROOF", tris(roof))
if LOOK:
    cover.hide_render = True
    look("shell_overview", g(0, 0, -1), 36, 50, 270, (1280, 720), 16, 30)
    look("shell_back", g(0, 2.5, -15.5), 13, 12, 0, (1280, 720), 16, 30)
    look("shell_glass", g(13, 2.5, 6), 10, 12, 240, (1280, 720), 16, 30)
cover.hide_render = False
save_part("shell", parts)
save_part("roof", roof)
save_part("floor", floor)
