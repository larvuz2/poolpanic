"""The Kids Pool's play pieces, modelled in place in game coordinates (31 October 2026): the slide with its little turret, the
lifeguard's high chair, the toy box, the ice-cream cart at the dog treats' spot, shade sails along the far fence, bunting across
both ends of the pool, flower planters at the fence's corners and beach towels drying on its rails.

The kids run all over the deck (kit.ROAM), so everything here stands on the game's furniture spots (kit.FURNITURE: the slide, the
lifeguard chair, the toy box, the treat table), against the fence or outside it; the sails and the bunting hang high over the deck
(2.6 m and more) on masts and poles outside the fence.

The ice-cream cart carries the game's dog-treats jar (resort.mjs kioskTreats: at x -12.85, y 1.45, z 8.4, 0.42 tall): its serving
ledge's top is at y 1.24 there, reaching out to x -12.6, and the jar's own room is left empty.

    blender -b -P tools/venues/kids/props_play.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(11)

M = dict(
    white=sm("white_paint"),
    white_gloss=sm("white_gloss"),
    pink=sm("pink"),
    sun=sm("sun"),
    sky=sm("sky"),
    mint=sm("mint"),
    coral=sm("coral"),
    lilac=sm("lilac"),
    navy=sm("navy"),
    red=sm("red"),
    cream=sm("cream"),
    timber=sm("timber"),
    timber_dark=sm("timber_dark"),
    steel=sm("steel"),
    stainless=sm("stainless"),
    rubber=sm("rubber"),
    slide=sm("slide_gloss", "#ffcf2e", 0.14),
    slide_lip=sm("slide_lip_gloss", "#ff8a5c", 0.16),
    pad=sm("landing_pad", "#7bd8b0", 0.85),
    pot=sm("clay_pot"),
    pot_dark=sm("terracotta_dark"),
    soil=sm("soil"),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    hydrangea=cutmat("hydrangea", 0.7),
    hibiscus=cutmat("hibiscus", 0.7),
)
COLOURS = [M["pink"], M["sun"], M["sky"], M["mint"], M["coral"], M["lilac"]]
objs = []  # everything saved
count = {}  # triangles per item


def item(name, parts):
    parts = [p for p in parts if p]
    count[name] = tris(parts)
    objs.extend(parts)
    print(f"ITEM {name}: {count[name]} triangles")


def rod(name, a, b, r, m, sides=8):
    """A straight rod between two game points."""
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def mesh_from(name, verts, faces, mats, face_mats=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    if face_mats:
        for p, mi in zip(o.data.polygons, face_mats):
            p.material_index = mi
    return o


def cone_stripes(name, apex, rim_y, radius, segs, mats, centre, droop=0.0, valance=0.0):
    """A striped canopy: a cone of `segs` panels from the apex down to a rim (game coordinates), alternating `mats`, and a short
    scalloped valance hanging from the rim when `valance` > 0."""
    cx, cz = centre
    verts = [tuple(g(cx, apex, cz))]
    rim = []
    for k in range(segs):
        a = k * math.tau / segs
        verts.append(tuple(g(cx + math.cos(a) * radius, rim_y, cz + math.sin(a) * radius)))
        rim.append(len(verts) - 1)
    # a mid-ring so the panels bow a little (droop)
    faces, fm = [], []
    mid = []
    for k in range(segs):
        a = k * math.tau / segs
        verts.append(tuple(g(cx + math.cos(a) * radius * 0.55, apex - (apex - rim_y) * 0.5 - droop, cz + math.sin(a) * radius * 0.55)))
        mid.append(len(verts) - 1)
    for k in range(segs):
        j = (k + 1) % segs
        faces.append((0, mid[j], mid[k]))
        fm.append(k % len(mats))
        faces.append((mid[k], mid[j], rim[j], rim[k]))
        fm.append(k % len(mats))
    if valance > 0:
        for k in range(segs):
            j = (k + 1) % segs
            a0, a1 = k * math.tau / segs, j * math.tau / segs
            am = (a0 + a1) / 2
            p0 = (cx + math.cos(a0) * radius, cz + math.sin(a0) * radius)
            p1 = (cx + math.cos(a1) * radius, cz + math.sin(a1) * radius)
            pm = (cx + math.cos(am) * radius, cz + math.sin(am) * radius)
            b = len(verts)
            verts += [tuple(g(p0[0], rim_y, p0[1])), tuple(g(p1[0], rim_y, p1[1])), tuple(g(pm[0], rim_y - valance, pm[1]))]
            faces.append((b, b + 1, b + 2))
            fm.append(k % len(mats))
    o = mesh_from(name, verts, faces, mats, fm)
    # (seen from below as well as above: a second skin, turned over)
    o2 = o.copy()
    o2.data = o.data.copy()
    bpy.context.scene.collection.objects.link(o2)
    bm = bmesh.new()
    bm.from_mesh(o2.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.translate(bm, vec=(0, 0, -0.012), verts=bm.verts)
    bm.to_mesh(o2.data)
    bm.free()
    return join([o, o2], name)


def two_sided(o, offset=0.008):
    """Give a thin sheet a back: a copy turned over and pushed along its normals."""
    o2 = o.copy()
    o2.data = o.data.copy()
    bpy.context.scene.collection.objects.link(o2)
    bm = bmesh.new()
    bm.from_mesh(o2.data)
    bm.normal_update()
    for v in bm.verts:
        v.co -= v.normal * offset
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(o2.data)
    bm.free()
    return join([o, o2], o.name)


# ---- 1. the slide: a turret with a ladder, a platform with rails and a roof, a glossy wavy chute, a soft landing pad ---------
def slide():
    X, Z = -11.8, -8.4
    p = []
    PY = 1.5  # the platform's top
    tx0, tx1, tz0, tz1 = -12.4, -11.2, -10.25, -9.15  # the turret's square
    posts = [(tx0, tz0), (tx1, tz0), (tx0, tz1), (tx1, tz1)]
    for k, (x, z) in enumerate(posts):
        p.append(gbx("TurretPost", x - 0.06, x + 0.06, 0, 2.62, z - 0.06, z + 0.06, M["sky"], 0.025))
        p.append(cyl("PostFoot", 0.1, 0.06, g(x, 0, z), M["navy"], 12, bev=0.01))
    p.append(gbx("Platform", tx0 - 0.04, tx1 + 0.04, PY - 0.1, PY, tz0 - 0.04, tz1 + 0.04, M["pink"], 0.03))
    # panels round three sides (the chute's side, +z, open), each with a round window
    for (a, b, side) in [((tx0, tz0), (tx1, tz0), "z"), ((tx0, tz0), (tx0, tz1), "x"), ((tx1, tz0), (tx1, tz1), "x")]:
        if side == "z":
            p.append(gbx("Panel", a[0] + 0.07, b[0] - 0.07, PY + 0.05, PY + 0.7, a[1] - 0.02, a[1] + 0.02, M["mint"], 0.015))
            p.append(cyl("Porthole", 0.16, 0.05, g((a[0] + b[0]) / 2, PY + 0.38, a[1]), M["sun"], 20, rot=(PI / 2, 0, 0)))
        else:
            if a[0] == tx0:
                continue  # (the ladder's side)
            p.append(gbx("Panel", a[0] - 0.02, a[0] + 0.02, PY + 0.05, PY + 0.7, a[1] + 0.07, b[1] - 0.07, M["mint"], 0.015))
            p.append(cyl("Porthole", 0.16, 0.05, g(a[0], PY + 0.38, (a[1] + b[1]) / 2), M["sun"], 20, rot=(0, PI / 2, 0)))
    p.append(gbx("RailTopZ", tx0, tx1, PY + 0.7, PY + 0.76, tz0 - 0.03, tz0 + 0.03, M["white"], 0.02))
    p.append(gbx("RailTopX", tx1 - 0.03, tx1 + 0.03, PY + 0.7, PY + 0.76, tz0, tz1, M["white"], 0.02))
    # the ladder on the fence side (-x): two rails, round rungs, grab hoops over the top
    lx = tx0 - 0.1
    for z in (tz0 + 0.22, tz1 - 0.22):
        p.append(gbx("LadderRail", lx - 0.04, lx + 0.04, 0, PY + 0.75, z - 0.035, z + 0.035, M["sun"], 0.015))
    for k in range(5):
        y = 0.3 + k * 0.28
        p.append(rod("Rung", (lx, y, tz0 + 0.22), (lx, y, tz1 - 0.22), 0.025, M["navy"], 10))
    for z in (tz0 + 0.22, tz1 - 0.22):
        p.append(torus("GrabHoop", 0.16, 0.025, g(lx + 0.02, PY + 0.75, z), M["sun"], 16, 6, rot=(0, PI / 2, 0)))
    # the turret's roof: a coral cone with a sun-yellow band and a little flag
    p.append(gbx("RoofBeam", tx0 - 0.08, tx1 + 0.08, 2.6, 2.7, tz0 - 0.08, tz1 + 0.08, M["white"], 0.03))
    p.append(cone_stripes("TurretRoof", 3.55, 2.68, 0.98, 8, [M["coral"], M["cream"]], (X, (tz0 + tz1) / 2), droop=0.06, valance=0.12))
    p.append(cyl("FlagPole", 0.018, 0.55, g(X, 3.5, (tz0 + tz1) / 2), M["white"], 8))
    p.append(extrude_shape("Flag", [(0, 0), (0.34, -0.1), (0, -0.2)], 0.01, g(X, 4.02, (tz0 + tz1) / 2), M["pink"], rot=(PI / 2, 0, 0)))
    # the chute: a glossy U-trough with rolled lips, waving down from the platform to the pad
    N, half = 30, 0.3
    z0, z1 = tz1, -6.62
    path = []
    for i in range(N + 1):
        t = i / N
        z = z0 + (z1 - z0) * t
        y = 0.22 + (PY - 0.12 - 0.22) * (1 - t) ** 1.25 + 0.1 * math.sin(t * math.tau * 1.5) * (1 - t) * t * 4
        if t > 0.9:  # the run-out flattens
            y = 0.22 + (y - 0.22) * (1 - (t - 0.9) / 0.1) ** 2
        path.append((z, y))
    prof = []  # (x offset, y offset) round the trough: the inside U, a rolled lip, back along the outside
    for k in range(9):
        a = math.pi + k * math.pi / 8
        prof.append((math.cos(a) * half, math.sin(a) * 0.17 + 0.05))
    prof.append((half + 0.04, 0.09))
    for k in range(9):
        a = k * math.pi / 8
        prof.append((math.cos(a) * (half + 0.05), -math.sin(a) * 0.22 + 0.06))
    prof.append((-half - 0.04, 0.09))
    verts, faces, fm = [], [], []
    n = len(prof)
    for z, y in path:
        for dx, dy in prof:
            verts.append(tuple(g(X + dx, y + dy, z)))
    for i in range(N):
        for k in range(n):
            j = (k + 1) % n
            a, b = i * n + k, i * n + j
            faces.append((a, b, b + n, a + n))
            fm.append(1 if k in (8, 9, 18, 19) else 0)
    chute = mesh_from("Chute", verts, faces, [M["slide"], M["slide_lip"]], fm)
    bm = bmesh.new()
    bm.from_mesh(chute.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(chute.data)
    bm.free()
    chute.data.shade_smooth()
    p.append(chute)
    # two legs under its middle, the pad at its foot
    for t in (0.42, 0.7):
        z, y = path[int(t * N)]
        for s in (-1, 1):
            p.append(gbx("ChuteLeg", X + s * 0.26 - 0.03, X + s * 0.26 + 0.03, 0, y - 0.1, z - 0.03, z + 0.03, M["sky"], 0.01))
        p.append(gbx("ChuteBrace", X - 0.29, X + 0.29, y - 0.16, y - 0.1, z - 0.03, z + 0.03, M["sky"], 0.01))
    p.append(gbx("LandingPad", X - 0.55, X + 0.55, 0, 0.07, -7.0, -6.42, M["pad"], 0.03))
    p.append(gbx("PadStripe", X - 0.5, X + 0.5, 0.07, 0.075, -6.75, -6.67, M["white"], 0.005))
    item("slide", p)


# ---- 2. the lifeguard's high chair, facing the pool (-x) ------------------------------------------------------------------------
def lifeguard_chair():
    X, Z = 12.6, 0.4
    p = []
    SY = 1.45  # the seat's top
    feet = [(X - 0.52, Z - 0.52), (X + 0.52, Z - 0.52), (X - 0.52, Z + 0.52), (X + 0.52, Z + 0.52)]
    tops = [(X - 0.3, Z - 0.3), (X + 0.3, Z - 0.3), (X - 0.3, Z + 0.3), (X + 0.3, Z + 0.3)]
    for (fx, fz), (tx, tz) in zip(feet, tops):
        p.append(rod("ChairLeg", (fx, 0, fz), (tx, SY - 0.1, tz), 0.045, M["white"], 10))
        p.append(cyl("ChairFoot", 0.08, 0.05, g(fx, 0, fz), M["navy"], 12, bev=0.01))
    # cross braces on the sides, rungs at the back (+x) as the ladder
    for z in (Z - 0.4, Z + 0.4):
        f = 0.4
        p.append(rod("Brace", (X - 0.45, 0.45, z), (X + 0.45, 1.0, z), 0.025, M["white"], 8))
    for k in range(4):
        y = 0.35 + k * 0.28
        dx = 0.52 - (0.22 * y / SY)
        hz = 0.52 - 0.22 * y / (SY - 0.1)  # (the back legs' half-span at this height)
        p.append(rod("LadderRung", (X + dx, y, Z - hz + 0.02), (X + dx, y, Z + hz - 0.02), 0.022, M["sky"], 10))
    p.append(gbx("SeatBox", X - 0.36, X + 0.36, SY - 0.12, SY, Z - 0.36, Z + 0.36, M["red"], 0.03))
    p.append(gbx("SeatPad", X - 0.3, X + 0.3, SY, SY + 0.07, Z - 0.3, Z + 0.3, M["navy"], 0.03))
    p.append(gbx("Backrest", X + 0.26, X + 0.34, SY, SY + 0.62, Z - 0.32, Z + 0.32, M["red"], 0.03))
    for z in (Z - 0.34, Z + 0.34):
        p.append(gbx("Arm", X - 0.32, X + 0.3, SY + 0.28, SY + 0.33, z - 0.03, z + 0.03, M["white"], 0.012))
        p.append(gbx("ArmPost", X - 0.3, X - 0.25, SY, SY + 0.3, z - 0.025, z + 0.025, M["white"], 0.008))
    p.append(gbx("Footrest", X - 0.52, X - 0.36, 0.75, 0.8, Z - 0.3, Z + 0.3, M["white"], 0.012))
    # the LIFEGUARD board under the seat, facing the pool
    p.append(gbx("BoardBack", X - 0.37, X - 0.35, 0.92, 1.22, Z - 0.42, Z + 0.42, M["white"], 0.008))
    p.append(plane("LifeguardBoard", 0.8, 0.27, g(X - 0.375, 1.07, Z), signmat("lifeguard"), rot=(PI / 2, 0, -PI / 2)))
    # the parasol over it: a pole off the backrest, a striped cone with a valance
    p.append(cyl("ParasolPole", 0.025, 1.45, g(X + 0.31, SY + 0.3, Z), M["white"], 10))
    p.append(cone_stripes("Parasol", 3.12, 2.78, 0.92, 10, [M["red"], M["cream"]], (X + 0.1, Z), droop=0.04, valance=0.1))
    # a rescue tube hanging off the arm on the deck side
    tube_ = cyl("RescueTube", 0.075, 0.82, g(X - 0.05, SY - 0.15, Z - 0.42), M["red"], 12, rot=(0, 0, 0))
    tube_.location = g(X - 0.05, SY - 0.6, Z - 0.44)
    p.append(tube_)
    p.append(rod("TubeStrap", (X - 0.05, SY + 0.3, Z - 0.37), (X - 0.05, SY + 0.2, Z - 0.44), 0.012, M["navy"], 6))
    item("lifeguard_chair", p)


# ---- 3. the toy box: an open painted chest with toys spilling over its rim ------------------------------------------------------
def duck(name, x, y, z, s=1.0, rz=0.0):
    yel = sm("duck_yellow", "#ffd23f", 0.3)
    o = [
        sphere(name + "Body", 0.09 * s, g(x, y + 0.07 * s, z), yel, 12, 8, (1.3, 1.0, 0.8)),
        sphere(name + "Head", 0.055 * s, g(x + 0.07 * s, y + 0.16 * s, z), yel, 10, 8),
        sphere(name + "Beak", 0.025 * s, g(x + 0.125 * s, y + 0.155 * s, z), M["coral"], 8, 6, (1.6, 1.0, 0.6)),
    ]
    return o


def ball(name, x, y, z, r, mats):
    """A beach ball: six coloured gores."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    for poly in o.data.polygons:
        c = poly.center
        a = math.atan2(c.y, c.x)
        poly.material_index = int(((a + math.pi) / math.tau) * 6) % len(mats)
    o.data.shade_smooth()
    o.location = g(x, y, z)
    return o


def toy_box():
    X, Z = -12.9, 11.2
    p = []
    x0, x1, z0, z1, h = -13.45, -12.35, 10.85, 11.55, 0.55
    p.append(gbx("ChestBody", x0, x1, 0.06, h, z0, z1, M["lilac"], 0.03))
    for z in (z0 - 0.01, z1 - 0.03):
        p.append(gbx("ChestBandZ", x0 - 0.02, x1 + 0.02, 0.06, h + 0.01, z, z + 0.04, M["timber_dark"], 0.008))
    for y in (0.12, h - 0.06):
        p.append(gbx("ChestBand", x0 - 0.02, x1 + 0.02, y, y + 0.05, z0 - 0.02, z1 + 0.02, M["sun"], 0.01))
    for x in (x0 + 0.05, x1 - 0.05):
        for z in (z0 + 0.05, z1 - 0.05):
            p.append(sphere("ChestFoot", 0.05, g(x, 0.05, z), M["timber_dark"], 10, 6))
    p.append(flat_text("ChestWord", "TOYS", 0.17, M["cream"], g(x1 + 0.006, 0.3, (z0 + z1) / 2), PI / 2, 0.006, "BarlowCondensed-Black"))
    p.append(gbx("ChestLatch", x1, x1 + 0.03, h - 0.14, h - 0.04, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05, M["steel"], 0.006))
    # the lid, open and leaning back over the -x side
    lid = join(
        [
            gbx("ChestLid", x0 - 0.08, x0, h, h + 0.72, z0 - 0.03, z1 + 0.03, M["pink"], 0.03),
            gbx("LidTrim", x0 - 0.1, x0 - 0.06, h + 0.04, h + 0.68, (z0 + z1) / 2 - 0.04, (z0 + z1) / 2 + 0.04, M["sun"], 0.01),
        ],
        "ChestLid",
    )
    set_origin(lid, g(x0, h, (z0 + z1) / 2))
    lid.rotation_euler = (0, -0.3, 0)  # (leaning back, away from the deck)
    p.append(lid)
    # toys spilling over the rim
    p.append(ball("ToyBall", -12.75, h + 0.08, 11.05, 0.17, [M["coral"], M["cream"], M["sky"], M["cream"], M["sun"], M["cream"]]))
    p.append(sphere("ToyBallSmall", 0.1, g(-13.15, h + 0.03, 11.38), M["mint"], 12, 8))
    p.append(cyl("Bucket", 0.12, 0.2, g(-12.95, h - 0.08, 11.32), M["sky"], 16, r2=0.15))
    p.append(torus("BucketHandle", 0.13, 0.008, g(-12.95, h + 0.12, 11.32), M["sun"], 16, 4, rot=(PI / 2, 0, 0)))
    p.append(gbx("Spade", -13.25, -13.22, h - 0.1, h + 0.16, 10.98, 11.02, M["timber"], 0.005))
    p.append(gbx("SpadeBlade", -13.29, -13.18, h + 0.14, h + 0.26, 10.95, 11.05, M["red"], 0.008))
    # a toy boat leaning on the rim
    boat = [gbx("BoatHull", -12.6, -12.3, 0, 0.09, 10.92, 11.06, M["red"], 0.03), gbx("BoatMast", -12.46, -12.44, 0.09, 0.4, 10.98, 11.0, M["white"], 0.004)]
    boat.append(extrude_shape("BoatSail", [(0, 0), (0.0, 0.28), (0.18, 0.02)], 0.006, g(-12.44, 0.11, 10.99), M["cream"], rot=(PI / 2, 0, 0)))
    b = join(boat, "ToyBoat")
    b.location = g(0, h - 0.04, 0)
    b.rotation_euler = (0.25, 0, 0)
    p.append(b)
    p += duck("ToyDuck", -13.05, h - 0.02, 10.98, 1.2)
    # on the deck beside it, still on its spot
    p.append(ball("DeckBall", -12.42, 0.13, 10.82, 0.13, [M["sky"], M["cream"], M["pink"], M["cream"], M["sun"], M["cream"]]))
    p += duck("DeckDuck", -13.4, 0.0, 10.78, 1.0)
    item("toy_box", p)


# ---- 4. the ice-cream cart at the dog treats' spot ------------------------------------------------------------------------------------
def ice_cream_cart():
    X, Z = -13.4, 8.4
    p = []
    x0, x1, z0, z1 = -13.72, -13.08, 8.1, 8.7
    # the freezer body on two big wheels, a push bar on the fence side
    p.append(gbx("CartBody", x0, x1, 0.28, 0.98, z0, z1, M["white_gloss"], 0.04))
    p.append(gbx("CartStripe", x0 - 0.005, x1 + 0.005, 0.5, 0.62, z0 - 0.005, z1 + 0.005, M["pink"], 0.01))
    p.append(gbx("CartSkirt", x0 + 0.02, x1 - 0.02, 0.24, 0.3, z0 + 0.02, z1 - 0.02, M["sky"], 0.01))
    for z in (z0 - 0.02, z1 + 0.02):
        p.append(torus("Wheel", 0.2, 0.045, g(X, 0.24, z), M["rubber"], 20, 8, rot=(PI / 2, 0, 0)))
        p.append(cyl("WheelHub", 0.07, 0.06, g(X, 0.24, z), M["sun"], 12, rot=(PI / 2, 0, 0)))
    p.append(gbx("Axle", X - 0.02, X + 0.02, 0.22, 0.26, z0 - 0.05, z1 + 0.05, M["steel"], 0.005))
    p.append(cyl("Prop", 0.03, 0.26, g(x1 - 0.06, 0, (z0 + z1) / 2), M["steel"], 8))
    p.append(rod("PushBar", (x0 - 0.02, 0.95, z0 + 0.05), (x0 - 0.24, 1.05, z0 + 0.05), 0.02, M["steel"]))
    p.append(rod("PushBar2", (x0 - 0.02, 0.95, z1 - 0.05), (x0 - 0.24, 1.05, z1 - 0.05), 0.02, M["steel"]))
    p.append(rod("PushGrip", (x0 - 0.24, 1.05, z0 + 0.05), (x0 - 0.24, 1.05, z1 - 0.05), 0.028, M["navy"]))
    # the lid: glass hatches over tubs of ice cream
    p.append(gbx("LidFrame", x0, x1, 0.98, 1.02, z0, z1, M["stainless"], 0.01))
    tubs = ["#ff8fb0", "#fff1c9", "#9fe3c4", "#8a5a3c", "#7fd0f5", "#ffe066"]
    for k, c in enumerate(tubs):
        tx = x0 + 0.14 + (k % 3) * 0.18
        tz = z0 + 0.17 + (k // 3) * 0.26
        p.append(cyl("Tub", 0.075, 0.03, g(tx, 0.99, tz), M["stainless"], 12))
        p.append(sphere("Scoop", 0.065, g(tx, 1.03, tz), sm("icecream_%d" % k, c, 0.6), 10, 6, (1, 1, 0.7)))
    # the serving ledge (+x side) at the height the game's treats jar stands on: its top at 1.24, out to x -12.6
    p.append(gbx("Ledge", x1 - 0.04, -12.6, 1.2, 1.24, z0 + 0.02, z1 - 0.02, M["timber"], 0.012))
    for z in (z0 + 0.06, z1 - 0.06):
        p.append(rod("LedgeBracket", (x1, 0.98, z), (-12.66, 1.2, z), 0.018, M["steel"], 6))
    p.append(gbx("LedgePost", x1 - 0.06, x1 - 0.02, 0.98, 1.24, z0 + 0.04, z0 + 0.08, M["steel"], 0.004))
    # a cone holder and napkins on the ledge, clear of the jar's room (x -12.97..-12.73, z 8.22..8.58)
    for k in range(3):
        z = z0 + 0.06 + k * 0.05
        p.append(cyl("Cone", 0.028, 0.12, g(-12.68, 1.24, z0 + 0.06), sm("cone_wafer", "#e0a85c", 0.7), 8, r2=0.004))
        break
    p.append(gbx("Napkins", -13.06, -12.99, 1.24, 1.29, z1 - 0.14, z1 - 0.04, M["cream"], 0.004))
    # the menu on a board over the back, facing the pool
    p.append(gbx("MenuBoard", x0 + 0.02, x0 + 0.06, 1.0, 1.62, z0 + 0.04, z1 - 0.04, M["sky"], 0.015))
    p.append(plane("Menu", 0.5, 0.5, g(x0 + 0.065, 1.31, (z0 + z1) / 2), signmat("ice_cream"), rot=(PI / 2, 0, PI / 2)))
    # the striped canopy on its pole
    p.append(cyl("CanopyPole", 0.022, 1.42, g(x0 + 0.12, 0.98, z1 - 0.1), M["white"], 10))
    p.append(cone_stripes("Canopy", 2.62, 2.32, 0.62, 8, [M["pink"], M["cream"]], (x0 + 0.12, z1 - 0.1), droop=0.03, valance=0.07))
    p.append(sphere("CanopyTop", 0.04, g(x0 + 0.12, 2.64, z1 - 0.1), M["sun"], 10, 6))
    item("ice_cream_cart", p)


# ---- 5. shade sails along the far fence, their masts outside it ----------------------------------------------------------------------
def sail(name, corners, m, sag=0.28, n=7):
    """A taut triangular canvas sail between three corners (game points), its edges cut in a little and its middle sagging,
    two-sided; a cable from each corner to its mast."""
    A, B, C = [Vector(c) for c in corners]
    cen = (A + B + C) / 3
    idx, verts = {}, []
    for i in range(n + 1):
        for j in range(n + 1 - i):
            k = n - i - j
            p = (A * i + B * j + C * k) / n
            # cut the edges in toward the middle (a sail's catenary cut), sag the middle down
            on_edge = min(i, j, k) == 0 and max(i, j, k) < n
            if on_edge:
                t = [v for v in (i, j, k) if v][0] / n
                p = p + (cen - p) * 0.07 * 4 * t * (1 - t)
            p = Vector((p.x, p.y - sag * 27 * i * j * k / n**3, p.z))
            idx[(i, j)] = len(verts)
            verts.append(tuple(g(p.x, p.y, p.z)))
    faces = []
    for i in range(n):
        for j in range(n - i):
            faces.append((idx[(i, j)], idx[(i + 1, j)], idx[(i, j + 1)]))
            if i + j < n - 1:
                faces.append((idx[(i + 1, j)], idx[(i + 1, j + 1)], idx[(i, j + 1)]))
    o = mesh_from(name, verts, faces, [m])
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    bm.to_mesh(o.data)
    bm.free()
    o.data.shade_smooth()
    return two_sided(o, 0.01)


def mast(name, x, z, h, m):
    return [
        cyl(name, 0.07, h, g(x, 0, z), m, 12, r2=0.055),
        cyl(name + "Foot", 0.16, 0.1, g(x, 0, z), M["steel"], 12, bev=0.015),
        sphere(name + "Cap", 0.08, g(x, h, z), M["steel"], 10, 6),
    ]


def shade_sails():
    p = []
    # (the masts outside the fence, x beyond 14.45 or z beyond the back and front fences; the sails over the deck's far corners)
    for name, mx, colour, cs in [
        ("SailBack", [(15.2, -17.2, 4.0), (15.2, -9.4, 3.3), (8.4, -17.2, 3.5)], M["sun"], None),
        ("SailFront", [(15.2, 14.0, 4.0), (15.2, 6.6, 3.3), (8.0, 14.0, 3.5)], M["sky"], None),
    ]:
        pts = []
        for k, (x, z, h) in enumerate(mx):
            p += mast(name + "Mast%d" % k, x, z, h + 0.25, M["white"])
            # the sail's corner a little in from its mast, the cable between
            cx_, cz_ = x + (-0.5 if x > 0 else 0.5) * (1 if abs(x) > 14.45 else 0), z + (0.5 if z < -16.45 else -0.5 if z > 13.25 else 0)
            pts.append((cx_, h - 0.15, cz_))
            p.append(rod(name + "Cable%d" % k, (x, h, z), (cx_, h - 0.15, cz_), 0.008, M["steel"], 4))
            p.append(torus(name + "Ring%d" % k, 0.04, 0.008, g(cx_, h - 0.15, cz_), M["steel"], 10, 4))
        p.append(sail(name, pts, colour))
    item("shade_sails", p)


# ---- 6. bunting across both ends of the pool, on poles outside the fence --------------------------------------------------------------
def bunting():
    p = []
    flags_by_colour = {k: [] for k in range(len(COLOURS))}
    for zl in (-9.9, 9.9):
        x0, x1 = -15.0, 15.0
        for x in (x0, x1):
            p.append(cyl("BuntingPole", 0.05, 3.55, g(x, 0, zl), M["white"], 10, r2=0.04))
            p.append(sphere("BuntingCap", 0.07, g(x, 3.56, zl), M["sun"], 10, 6))
            p.append(cyl("BuntingFoot", 0.13, 0.08, g(x, 0, zl), M["steel"], 12, bev=0.01))
        sag = lambda x: 3.42 - 0.42 * (1 - (x / x1) ** 2)  # noqa: E731
        pts = [g(x, sag(x), zl) for x in [x0 + (x1 - x0) * k / 24 for k in range(25)]]
        p.append(tube("BuntingLine", pts, 0.008, M["white"], 2, 4))
        n = 64
        for k in range(n):
            x = x0 + 0.3 + (x1 - x0 - 0.6) * (k + 0.5) / n
            y = sag(x) - 0.01
            tri = mesh_from(
                "Flag",
                [tuple(g(x - 0.17, y, zl)), tuple(g(x + 0.17, y, zl)), tuple(g(x, y - 0.38, zl + 0.03 * math.sin(k)))],
                [(0, 1, 2)],
                [COLOURS[k % len(COLOURS)]],
            )
            flags_by_colour[k % len(COLOURS)].append(two_sided(tri, 0.004))
    for k, fl in flags_by_colour.items():
        if fl:
            p.append(join(fl, "Flags%d" % k))
    item("bunting", p)


# ---- 7. flower planters at the fence's corners, beach towels drying on its rails ------------------------------------------------------
def flower_card(name, x, y, z, s, m, rz):
    """A flower cluster: two crossed cut-out cards."""
    cards = []
    for k in range(2):
        c = plane(name, s, s, g(x, y, z), m, rot=(PI / 2, 0, rz + k * PI / 2))
        cards.append(c)
    top = plane(name + "Top", s * 0.9, s * 0.9, g(x, y + s * 0.32, z), m, rot=(0, 0, rz))
    cards.append(top)
    return join(cards, name)


def planters():
    p = []
    for k, (x, z) in enumerate([(-15.15, -17.15), (15.15, -17.15), (-15.15, 13.95), (15.15, 13.95), (-15.15, 2.8), (15.15, -12.4)]):
        p.append(cyl("Planter", 0.52, 0.66, g(x, 0, z), M["pot"], 18, bev=0.02, r2=0.42))
        p.append(torus("PlanterRim", 0.5, 0.05, g(x, 0.66, z), M["pot_dark"], 18, 6))
        p.append(cyl("PlanterSoil", 0.47, 0.03, g(x, 0.62, z), M["soil"], 18))
        for j in range(5):
            a = j * math.tau / 5 + k
            p.append(sphere("Leaves", R.uniform(0.2, 0.28), g(x + math.cos(a) * 0.22, 0.85 + R.uniform(0, 0.12), z + math.sin(a) * 0.22), M["leaf_dark"] if j % 2 else M["leaf"], 9, 6))
        mflower = M["hydrangea"] if k % 2 == 0 else M["hibiscus"]
        for j in range(4):
            a = j * math.tau / 4 + 0.4 * k
            p.append(flower_card("Flowers", x + math.cos(a) * 0.2, 0.95 + R.uniform(0, 0.15), z + math.sin(a) * 0.2, 0.42, mflower, a))
    item("planters", p)


def towel_over_rail(name, x, z, along_x, w, colours, rail_y=0.98, drop=0.5):
    """A beach towel hung over the fence's top rail: an inverted U of strips, each stripe its own colour."""
    n_str = 6
    verts, faces, fm = [], [], []
    prof = [(-0.05, rail_y - drop), (-0.045, rail_y - 0.1), (-0.03, rail_y + 0.02), (0.0, rail_y + 0.045), (0.03, rail_y + 0.02), (0.045, rail_y - 0.1), (0.05, rail_y - drop * 0.8)]
    for s in range(n_str + 1):
        u = -w / 2 + w * s / n_str
        for dz, y in prof:
            if along_x:
                verts.append(tuple(g(x + u, y, z + dz)))
            else:
                verts.append(tuple(g(x + dz, y, z + u)))
    m = len(prof)
    for s in range(n_str):
        for k in range(m - 1):
            a = s * m + k
            faces.append((a, a + m, a + m + 1, a + 1))
            fm.append(s % len(colours))
    o = mesh_from(name, verts, faces, colours, fm)
    o.data.shade_smooth()
    return two_sided(o, 0.006)


def towels():
    p = []
    ts = [sm("towel_pink"), sm("towel_stripe"), sm("towel_sky"), sm("towel_sun"), sm("towel_white")]
    p.append(towel_over_rail("TowelA", -7.6, FENCE["z1"], True, 0.62, [ts[0], ts[1]]))
    p.append(towel_over_rail("TowelB", -3.1, FENCE["z1"], True, 0.6, [ts[2], ts[4]]))
    p.append(towel_over_rail("TowelC", 6.6, FENCE["z1"], True, 0.64, [ts[3], ts[1], ts[0]]))
    item("towels", p)


slide()
lifeguard_chair()
toy_box()
ice_cream_cart()
shade_sails()
bunting()
planters()
towels()
total = sum(count.values())
print("PLAY TOTAL", total, count)

if LOOK:
    ctx = [gbx("PreviewDeck", -15, 15, -0.05, 0, -17.5, 14.5, sm("preview_deck", "#f3e9d6", 0.8), 0)]
    look("play_slide", g(-11.8, 1.4, -8.4), 6.5, 18, 55, (960, 640), 16, 32)
    look("play_chair", g(12.6, 1.3, 0.4), 5.0, 14, -70, (960, 640), 16, 32)
    look("play_corner", g(-13.0, 0.8, 9.8), 5.5, 26, 70, (960, 640), 16, 32)
    for o in ctx:
        bpy.data.objects.remove(o)
save_part("play", objs)
