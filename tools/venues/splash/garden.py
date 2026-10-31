"""Splash Park's garden: the ground round the tabletop and the trees that close it in (31 October 2026: the creator asked for no
lawn, "tall trees on the edge between the pool and the grass… I don't want to see the grass"), and the three palms on the deck.

- The ground round the deck's plinth, out to the horizon, is dark planting (`groundcover`: leaves and pine needles), with a belt
  of shrubs along the plinth's foot.
- Tall trees stand round the park: Italian umbrella pines (a bare leaning trunk forking into flat, lumpy canopies), cypresses
  (dark columns) and coconut palms (ringed curving trunks, a crown of fronds: the cut-out frond on bent cards). Behind the
  hotel they rise over its roof; beyond the far wall and past the hedge they fill the view's edges. On the near side (under the
  game's camera) they stand far enough out to stay out of the overview: only the Coach Cam sees them.
- On the deck, the three palms of the floor plan (kit.DECK_PALMS) in big terracotta planters.

    blender -b -P tools/venues/splash/garden.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
R = random.Random(31)
LOOK = "--look" in args()
GROUND = -1.95
M = dict(
    ground=tmat_tile("groundcover", "#2f4a2c", 0.95),
    pine=tmat_tile("pine", "#2f5a30", 0.8),
    conifer=tmat_tile("conifer", "#22442c", 0.8),
    hedge=tmat_tile("hedge", "#3c7a38", 0.8),
    frond=cutmat("palm_frond", 0.65),
    bark=sm("bark"),
    bark_light=sm("bark_light"),
    pine_bark=sm("pine_bark", "#7a5a44", 0.9),
    palm_boot=sm("palm_boot", "#7d6242", 0.95),
    coconut=sm("coconut", "#6f5a2e", 0.6),
    pot=sm("clay_pot"),
    pot_dark=sm("terracotta_dark"),
    soil=sm("soil"),
    pebble=sm("pebble"),
)
parts = []


def lathe(name, profile, sides, m, loc, noise=0.0, seed=0, squash=1.0):
    """A surface of revolution: `profile` [(radius, height)] bottom to top, `sides` round, roughened by `noise` (a fraction of
    the radius), `squash` scaling it in one horizontal direction; capped at the top (a point when its radius is 0)."""
    r = random.Random(seed)
    bm = bmesh.new()
    rings = []
    for k, (rad, h) in enumerate(profile):
        ring_ = []
        for i in range(sides):
            a = i * math.tau / sides
            j = 1 + (r.uniform(-noise, noise) if 0 < k < len(profile) - 1 else 0)
            ring_.append(bm.verts.new((loc[0] + math.cos(a) * rad * j, loc[1] + math.sin(a) * rad * j * squash, loc[2] + h)))
        rings.append(ring_)
    for k in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    me.shade_smooth()
    return o


def blob(name, centre, radii, m, seed, segs=(10, 6), lump=0.18):
    """A lumpy ellipsoid (a canopy cluster, a shrub): a UV sphere pushed in and out by smooth noise."""
    r = random.Random(seed)
    o = sphere(name, 1.0, centre, m, segs[0], segs[1], radii)
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    waves = [(r.uniform(1.5, 3.5), r.uniform(0, math.tau), r.uniform(0, math.tau)) for _ in range(3)]
    for v in o.data.vertices:
        d = v.co.normalized()
        k = 1 + lump * sum(math.sin(f * d.x + p) * math.cos(f * d.y + q) for f, p, q in waves) / 3
        v.co *= k
    o.data.shade_smooth()
    return o


# ---- palms ------------------------------------------------------------------------------------------------------------------------
def frond_card(name, base, azim, pitch, length, width, droop, fold=0.32, segs=6):
    """A palm frond: the cut-out frond on a strip bent down along its length and folded up along its rib (a V)."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    dirh = Vector((math.cos(azim), math.sin(azim), 0))
    perp = Vector((-math.sin(azim), math.cos(azim), 0))
    pts, p, step = [], Vector(base), length / segs
    for i in range(segs + 1):
        t = i / segs
        th = pitch - droop * t**1.3
        pts.append((p.copy(), t, th))
        p = p + (dirh * math.cos(th) + Vector((0, 0, 1)) * math.sin(th)) * step
    rows = []
    for c, t, th in pts:
        w = width * (0.55 + 0.45 * math.sin(min(1, t * 1.15) * math.pi * 0.95 + 0.1))
        up = Vector((0, 0, 1)) * math.sin(fold) * w
        rows.append(
            (
                bm.verts.new(c - perp * math.cos(fold) * w + up),
                bm.verts.new(c),
                bm.verts.new(c + perp * math.cos(fold) * w + up),
                t,
            )
        )
    for (a0, b0, c0, t0), (a1, b1, c1, t1) in zip(rows[:-1], rows[1:]):
        for quad, vs in (((a0, b0, b1, a1), (0.0, 0.5)), ((b0, c0, c1, b1), (0.5, 1.0))):
            f = bm.faces.new(quad)
            uvs = [(t0, vs[0]), (t0, vs[1]), (t1, vs[1]), (t1, vs[0])]
            for loop, uv in zip(f.loops, uvs):
                loop[uvl].uv = uv
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, M["frond"])
    return o


def palm(x, z, height, seed, y0=GROUND, lean=0.12):
    """A coconut palm `height` tall from y0: a ringed, gently curving trunk; a boot of old frond bases; coconuts; 14 fronds."""
    r = random.Random(seed)
    la = r.uniform(0, math.tau)
    lean_dir = Vector((math.cos(la), math.sin(la), 0))
    out = []
    pts = []
    n = 9
    for i in range(n + 1):
        t = i / n
        off = lean_dir * (height * lean * t**1.6)
        pts.append(Vector(g(x, y0 + height * t, z)) + off)
    # the trunk: rings swelling and narrowing (the leaf scars), tapering to the crown
    bm = bmesh.new()
    sides = 8
    rings = []
    steps = 22
    for k in range(steps + 1):
        t = k / steps
        f = t * n
        i0 = min(int(f), n - 1)
        c = pts[i0].lerp(pts[i0 + 1], f - i0)
        rad = (0.26 - 0.1 * t) * (1.25 if k == 0 else 1.0) * (1.0 + (0.06 if k % 2 else -0.03))
        rings.append([bm.verts.new(c + Vector((math.cos(a) * rad, math.sin(a) * rad, 0))) for a in [s * math.tau / sides for s in range(sides)]])
    for k in range(steps):
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
    me = bpy.data.meshes.new("PalmTrunk")
    bm.to_mesh(me)
    bm.free()
    trunk = bpy.data.objects.new("PalmTrunk", me)
    bpy.context.scene.collection.objects.link(trunk)
    set_mat(trunk, M["bark_light"])
    me.shade_smooth()
    out.append(trunk)
    top = pts[-1]
    gtop = (top.x, top.z, -top.y)  # game coordinates
    out.append(lathe("PalmBoot", [(0.2, -0.45), (0.34, -0.15), (0.3, 0.1), (0.12, 0.28)], 8, M["palm_boot"], tuple(top), 0.12, seed))
    for k in range(4):
        a = k * math.tau / 4 + r.uniform(-0.3, 0.3)
        out.append(sphere("Coconut", 0.11, top + Vector((math.cos(a) * 0.24, math.sin(a) * 0.24, -0.12)), M["coconut"], 8, 6))
    count = 14
    for k in range(count):
        a = k * math.tau / count + r.uniform(-0.15, 0.15)
        young = k % 3 == 0
        out.append(
            frond_card(
                "Frond",
                top + Vector((0, 0, 0.15)),
                a,
                math.radians(r.uniform(38, 58) if young else r.uniform(5, 28)),
                r.uniform(2.6, 3.4) * (height / 9) ** 0.35,
                r.uniform(0.42, 0.52),
                math.radians(r.uniform(60, 90) if not young else r.uniform(40, 60)),
            )
        )
    return out


# ---- umbrella pines ------------------------------------------------------------------------------------------------------------------
def stone_pine(x, z, height, seed, y0=GROUND):
    """An Italian stone pine: a bare trunk leaning a little, forking into three or four limbs, each carrying a flat lumpy pad of
    needles; the pads together make the umbrella."""
    r = random.Random(seed)
    out = []
    la = r.uniform(0, math.tau)
    lean = Vector((math.cos(la), math.sin(la), 0)) * height * 0.08
    base = Vector(g(x, y0, z))
    fork = base + Vector((0, 0, height * 0.62)) + lean
    out.append(tube("PineTrunk", [base, base + Vector((0, 0, height * 0.3)) + lean * 0.4, fork], 0.28, M["pine_bark"], 3, 7))
    out.append(cyl("PineFoot", 0.42, 0.5, base + Vector((0, 0, 0.2)), M["pine_bark"], 7, r2=0.28))
    crown_r = height * 0.34
    limbs = r.randint(3, 4)
    pads = []
    for k in range(limbs):
        a = k * math.tau / limbs + r.uniform(-0.4, 0.4)
        d = r.uniform(0.35, 0.65) * crown_r
        end = fork + Vector((math.cos(a) * d, math.sin(a) * d, height * r.uniform(0.22, 0.32)))
        out.append(tube("PineLimb", [fork, fork.lerp(end, 0.5) + Vector((0, 0, 0.3)), end], 0.13, M["pine_bark"], 2, 6))
        pads.append(end)
    pads.append(fork + Vector((0, 0, height * 0.36)))
    for k, p in enumerate(pads):
        rr = crown_r * r.uniform(0.5, 0.68)
        out.append(blob("PinePad", p + Vector((0, 0, 0.45)), (rr, rr * r.uniform(0.85, 1.0), rr * 0.44), M["pine"], seed * 7 + k, (14, 7), 0.16))
    return out


def cypress(x, z, height, seed, y0=GROUND):
    """A Mediterranean cypress: a dark flame-shaped column."""
    r = random.Random(seed)
    w = height * r.uniform(0.065, 0.08)
    prof = []
    for k in range(11):
        t = k / 10
        rad = w * (0.55 + 0.75 * math.sin(min(1.0, t * 1.25 + 0.08) * math.pi) ** 0.6) * (1 - t**3)
        prof.append((max(rad, 0.0), height * t))
    out = [lathe("Cypress", [(0.22, 0)] + prof[1:], 10, M["conifer"], tuple(g(x, y0 + 0.4, z)), 0.12, seed)]
    out.append(cyl("CypressFoot", 0.18, 0.6, g(x, y0 + 0.3, z), M["bark"], 6))
    return out


def shrub(x, z, s, seed, y0=GROUND):
    return blob("Shrub", g(x, y0 + s * 0.45, z), (s, s * 0.9, s * 0.7), M["hedge"], seed, (9, 5), 0.25)


# ---- the ground: dark planting from the plinth's foot out to the fog ------------------------------------------------------------
def ground():
    big = 140.0
    x0, x1, z0, z1 = ROOM["x0"] - 0.1, ROOM["x1"] + 0.1, ROOM["z0"] - 0.7, ROOM["z1"] + 0.1
    bm = bmesh.new()
    vo = [bm.verts.new(g(x, GROUND, zz)) for x, zz in [(-big, -big), (big, -big), (big, big), (-big, big)]]
    vi = [bm.verts.new(g(x, GROUND, zz)) for x, zz in [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([vo[i], vo[j], vi[j], vi[i]])
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    me = bpy.data.meshes.new("Ground")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Ground", me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, M["ground"])
    return o


parts.append(ground())

# ---- the trees round the park ---------------------------------------------------------------------------------------------------------
X0, X1, Z0, Z1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]
spots = []  # (kind, x, z, height)


def row(kinds, a0, a1, step, fixed, along_x, jitter, heights):
    v = a0
    i = 0
    while v <= a1:
        kind = kinds[i % len(kinds)]
        x, z = (v, fixed) if along_x else (fixed, v)
        x += R.uniform(-jitter, jitter)
        z += R.uniform(-jitter, jitter)
        spots.append((kind, x, z, R.uniform(*heights[kind])))
        v += step * R.uniform(0.85, 1.15)
        i += 1


H = {"pine": (10.5, 13.0), "cypress": (9.0, 12.5), "palm": (9.5, 12.5)}
H_TALL = {"pine": (13.0, 15.5), "cypress": (12.0, 15.0), "palm": (11.0, 13.5)}
# beyond the far wall (+x): a row close to the plinth, a second behind it
row(["palm", "pine", "cypress", "pine", "palm", "cypress"], Z0 - 2, Z1 + 3, 3.4, X1 + 2.6, False, 0.5, H)
row(["pine", "cypress", "pine"], Z0 - 4, Z1 + 6, 5.0, X1 + 7.5, False, 1.2, H)
# past the hedge (+z): the open end of the view
row(["cypress", "palm", "pine", "palm", "cypress", "pine"], X0 - 2, X1 + 4, 3.2, Z1 + 2.4, True, 0.5, H)
row(["pine", "palm", "pine", "cypress"], X0 - 4, X1 + 8, 4.6, Z1 + 7.0, True, 1.2, H)
# behind the hotel (-z), rising over its roof
row(["pine", "cypress", "pine", "palm"], X0 - 2, X1 + 3, 4.4, Z0 - 6.8, True, 0.8, H_TALL)
# the near side (-x): the game's camera stands over x -24..-15 (it follows the coach), so only palms here, well out and with
# narrow crowns, for the Coach Cam
row(["palm"], Z0 - 2, Z1 + 3, 5.5, X0 - 8.0, False, 0.6, {"palm": (7.5, 9.0)})
trees = 0
for kind, x, z, h in spots:
    seed = int(abs(x * 131 + z * 17)) + 3
    parts += {"pine": stone_pine, "cypress": cypress, "palm": palm}[kind](x, z, h, seed)
    trees += 1
# shrubs along the plinth's foot (and filling between the trunks)
for (a0, a1, fixed, along_x) in [(Z0 - 1, Z1 + 1, X1 + 0.9, False), (X0 - 1, X1 + 1, Z1 + 0.9, True), (Z0 - 1, Z1 + 1, X0 - 0.9, False)]:
    v = a0
    while v < a1:
        x, z = (v, fixed) if along_x else (fixed, v)
        parts.append(shrub(x + R.uniform(-0.3, 0.3), z + R.uniform(-0.3, 0.3), R.uniform(0.8, 1.3), int(v * 10) + 7))
        v += R.uniform(1.4, 2.0)

# ---- the palms on the deck, in big terracotta planters ----------------------------------------------------------------------------------
for k, (x, z) in enumerate(DECK_PALMS):
    parts.append(lathe("Planter", [(0.5, 0.0), (0.56, 0.08), (0.62, 0.62), (0.68, 0.7), (0.66, 0.78)], 20, M["pot"], tuple(g(x, 0, z))))
    parts.append(cyl("PlanterSoil", 0.6, 0.04, g(x, 0.7, z), M["soil"], 20))
    for j in range(7):
        a = j * math.tau / 7
        parts.append(sphere("Pebble", 0.07, g(x + math.cos(a) * 0.4, 0.73, z + math.sin(a) * 0.4), M["pebble"], 6, 4, (1, 1, 0.6)))
    parts += palm(x, z, 4.4 + k * 0.4, 900 + k, y0=0.7, lean=0.1)  # (the near corner's smallest: it is under the camera)

print("TREES", trees)
if LOOK:
    look("garden_high", g(0, 0, -2), 46, 50, -90, (1280, 720), 16, 30)
    look("garden_side", g(18, 3, 4), 26, 18, 120, (1280, 720), 16, 30)
    look("garden_palm", g(-14.7, 3, 11.5), 9, 20, -60, (960, 640), 16, 35)
save_part("garden", parts)
