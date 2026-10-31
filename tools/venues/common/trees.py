"""Trees and planting every dressed venue may use (Blender, game coordinates): a lathe and a lumpy blob, coconut palms (ringed
curving trunks, a crown of cut-out fronds on bent cards), Italian umbrella pines, cypresses, shrubs, and broadleaf trees (a trunk
forking into a crown of lumpy clusters). The venue's garden script calls `use(materials)` first: its materials by name (bark,
bark_light, pine_bark, palm_boot, coconut, frond (a cutmat), pine, conifer, hedge, canopy).
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitbase import *  # noqa: F401,F403

M_ = {}


def use(materials):
    """The materials the trees are made of (see above)."""
    M_.clear()
    M_.update(materials)


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
    set_mat(o, M_["frond"])
    return o


def palm(x, z, height, seed, y0=-1.95, lean=0.12):
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
    set_mat(trunk, M_["bark_light"])
    me.shade_smooth()
    out.append(trunk)
    top = pts[-1]
    gtop = (top.x, top.z, -top.y)  # game coordinates
    out.append(lathe("PalmBoot", [(0.2, -0.45), (0.34, -0.15), (0.3, 0.1), (0.12, 0.28)], 8, M_["palm_boot"], tuple(top), 0.12, seed))
    for k in range(4):
        a = k * math.tau / 4 + r.uniform(-0.3, 0.3)
        out.append(sphere("Coconut", 0.11, top + Vector((math.cos(a) * 0.24, math.sin(a) * 0.24, -0.12)), M_["coconut"], 8, 6))
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
def stone_pine(x, z, height, seed, y0=-1.95):
    """An Italian stone pine: a bare trunk leaning a little, forking into three or four limbs, each carrying a flat lumpy pad of
    needles; the pads together make the umbrella."""
    r = random.Random(seed)
    out = []
    la = r.uniform(0, math.tau)
    lean = Vector((math.cos(la), math.sin(la), 0)) * height * 0.08
    base = Vector(g(x, y0, z))
    fork = base + Vector((0, 0, height * 0.62)) + lean
    out.append(tube("PineTrunk", [base, base + Vector((0, 0, height * 0.3)) + lean * 0.4, fork], 0.28, M_["pine_bark"], 3, 7))
    out.append(cyl("PineFoot", 0.42, 0.5, base + Vector((0, 0, 0.2)), M_["pine_bark"], 7, r2=0.28))
    crown_r = height * 0.34
    limbs = r.randint(3, 4)
    pads = []
    for k in range(limbs):
        a = k * math.tau / limbs + r.uniform(-0.4, 0.4)
        d = r.uniform(0.35, 0.65) * crown_r
        end = fork + Vector((math.cos(a) * d, math.sin(a) * d, height * r.uniform(0.22, 0.32)))
        out.append(tube("PineLimb", [fork, fork.lerp(end, 0.5) + Vector((0, 0, 0.3)), end], 0.13, M_["pine_bark"], 2, 6))
        pads.append(end)
    pads.append(fork + Vector((0, 0, height * 0.36)))
    for k, p in enumerate(pads):
        rr = crown_r * r.uniform(0.5, 0.68)
        out.append(blob("PinePad", p + Vector((0, 0, 0.45)), (rr, rr * r.uniform(0.85, 1.0), rr * 0.44), M_["pine"], seed * 7 + k, (14, 7), 0.16))
    return out


def cypress(x, z, height, seed, y0=-1.95):
    """A Mediterranean cypress: a dark flame-shaped column."""
    r = random.Random(seed)
    w = height * r.uniform(0.065, 0.08)
    prof = []
    for k in range(11):
        t = k / 10
        rad = w * (0.55 + 0.75 * math.sin(min(1.0, t * 1.25 + 0.08) * math.pi) ** 0.6) * (1 - t**3)
        prof.append((max(rad, 0.0), height * t))
    out = [lathe("Cypress", [(0.22, 0)] + prof[1:], 10, M_["conifer"], tuple(g(x, y0 + 0.4, z)), 0.12, seed)]
    out.append(cyl("CypressFoot", 0.18, 0.6, g(x, y0 + 0.3, z), M_["bark"], 6))
    return out


def shrub(x, z, s, seed, y0=-1.95):
    return blob("Shrub", g(x, y0 + s * 0.45, z), (s, s * 0.9, s * 0.7), M_["hedge"], seed, (9, 5), 0.25)


def broadleaf(x, z, height, seed, y0=0.0):
    """A broadleaf tree (a plane tree, a lime): a straight trunk forking into three or four limbs, the crown a cluster of lumpy
    rounded masses (the canopy picture), taller than wide."""
    r = random.Random(seed)
    out = []
    base = Vector(g(x, y0, z))
    fork = base + Vector((r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), height * 0.42))
    out.append(tube("BroadTrunk", [base, base.lerp(fork, 0.5), fork], 0.22, M_["bark"], 3, 7))
    out.append(cyl("BroadFoot", 0.34, 0.4, base + Vector((0, 0, 0.15)), M_["bark"], 7, r2=0.22))
    crown_r = height * 0.3
    centre = fork + Vector((0, 0, height * 0.3))
    for k in range(r.randint(3, 4)):
        a = k * math.tau / 4 + r.uniform(-0.4, 0.4)
        end = fork + Vector((math.cos(a) * crown_r * 0.5, math.sin(a) * crown_r * 0.5, height * 0.22))
        out.append(tube("BroadLimb", [fork, end], 0.1, M_["bark"], 1, 6))
    for k in range(6):
        a = k * math.tau / 6 + r.uniform(-0.3, 0.3)
        d = crown_r * r.uniform(0.35, 0.6)
        h = r.uniform(-0.25, 0.35) * crown_r
        rr = crown_r * r.uniform(0.5, 0.68)
        out.append(blob("Crown", centre + Vector((math.cos(a) * d, math.sin(a) * d, h)), (rr, rr * 0.92, rr * 0.85), M_["canopy"], seed * 11 + k, (12, 7), 0.16))
    out.append(blob("CrownTop", centre + Vector((0, 0, crown_r * 0.5)), (crown_r * 0.62, crown_r * 0.6, crown_r * 0.55), M_["canopy"], seed * 11 + 9, (12, 7), 0.16))
    return out
