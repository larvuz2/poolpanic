"""The Mountain Hot Springs' ground, in game coordinates from the game's own plan (kit.PLAN): the terrace of icy flagstones holed
exactly where the four springs are; each spring's basin of rough rock going down from its edge to a pebbled floor (a few stones on
it); the flat rim stones round every spring (walkable, a few snow-capped) and the two wide step stones going down at its steps; the
boulders the walks go round (onsen-plan.mjs BOULDERS, each at its place and size) with caps of snow, and more rocks out in the snow;
the snowfield all round, out to the forest, and drifts banked against the terrace's edges and the bathhouse; floor.glb: the snow
lying on the terrace, thick at the edges and round the boulders, rubbed thin along the paths the guests have trodden from the
bathhouse door to every spring's steps and round its rim (the deck's paint).

    blender -b -P tools/venues/onsen/shell.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(181)
TAU = 2 * PI
M = dict(
    flag=tmat_tile("flagstone", "#8d97a3", 0.3),
    snow=tmat_tile("snow", "#eef3fa", 0.8),
    rock=tmat_tile("rock", "#6c6863", 0.85),
    pebbles=tmat_tile("pebbles", "#b8a88a", 0.7),
)
parts, floor = [], []


def mesh_obj(name, verts, faces, mats, face_mats=None):
    """A mesh from game-coordinate vertices and faces (index lists), its materials, and each face's material index."""
    bm = bmesh.new()
    vs = [bm.verts.new(g(*v)) for v in verts]
    for i, f in enumerate(faces):
        try:
            face = bm.faces.new([vs[k] for k in f])
            face.material_index = face_mats[i] if face_mats else 0
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    return o


def fill(name, loops, y, m, up=True, hole=None):
    """A flat face at height `y` bounded by `loops` (lists of (x, z)), triangulated; `hole(x, z)` says where it is cut away."""
    bm = bmesh.new()
    for loop in loops:
        vs = [bm.verts.new(g(x, y, z)) for x, z in loop]
        for a, b in zip(vs, vs[1:] + vs[:1]):
            bm.edges.new((a, b))
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=bm.edges[:])
    if hole:
        cut = []
        for f in bm.faces:
            c = f.calc_center_median()
            if hole(c.x, -c.y):  # (Blender (x, y) is the game's (x, -z))
                cut.append(f)
        bmesh.ops.delete(bm, geom=cut, context="FACES")
    for f in bm.faces:
        if (f.normal.z < 0) == up:
            f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return o


def rect(x0, x1, z0, z1, step=1.0):
    """A rectangle's outline, its sides cut every `step` m (so the fill makes even triangles for the light and the paint)."""
    pts = []
    for (ax, az), (bx_, bz) in (((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x1, z1), (x0, z1)), ((x0, z1), (x0, z0))):
        n = max(1, int(round(math.hypot(bx_ - ax, bz - az) / step)))
        pts += [(ax + (bx_ - ax) * k / n, az + (bz - az) * k / n) for k in range(n)]
    return pts


def lumpy(name, x, y, z, size, squash, seed, snow_cap=0.45, sub=2, mats=None):
    """A rock: an icosphere knocked about by a few waves, flattened by `squash`, its upward faces near the top capped with snow."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=size)
    ph = [rnd.random() * 10 for _ in range(4)]
    for v in bm.verts:
        p = v.co
        j = 0.82 + 0.12 * math.sin(p.x * 5.3 / size + ph[0]) * math.cos(p.z * 4.7 / size + ph[1]) + 0.08 * math.sin(p.y * 6.1 / size + ph[2])
        v.co = Vector((p.x * j, p.y * j, p.z * j * squash))
    rot = rnd.random() * TAU
    for v in bm.verts:
        v.co = Matrix.Rotation(rot, 3, "Z") @ v.co + Vector(g(x, y, z))
    bm.normal_update()
    top = y + size * squash
    for f in bm.faces:
        c = f.calc_center_median()
        f.material_index = 1 if (snow_cap and f.normal.z > 0.42 and c.z > top - size * squash * snow_cap * 2) else 0
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m in mats or (M["rock"], M["snow"]):
        o.data.materials.append(m)
    return o


# ---- the terrace: flagstones under ice, holed at the springs -------------------------------------------------------------------
D = DECK
edges = [[tuple((p["x"], p["z"])) for p in s["edge"]] for s in SPRINGS]
parts.append(fill("Terrace", [rect(D["minX"], D["maxX"], D["minZ"], D["maxZ"], 1.2)] + edges, 0.0, M["flag"], hole=lambda x, z: spring_inside(x, z, 0.0)))

# ---- the basins: rock walls from the edge down to a pebbled floor ----------------------------------------------------------------
RINGS = [(1.0, 0.02), (0.98, -0.3), (0.9, -0.75), (0.8, FLOOR_Y)]
for s in SPRINGS:
    n = len(s["edge"])
    loops = []
    for r, y in RINGS:
        pts = s["edge"] if r == 1.0 else s["rings"][str(r) if str(r) in s["rings"] else repr(r)]
        loops.append([(p["x"], y + (0.03 * math.sin(i * 0.7 + s["id"]) if 0 < r < 1 else 0), p["z"]) for i, p in enumerate(pts)])
    verts = [v for loop in loops for v in loop]
    faces = []
    for j in range(len(loops) - 1):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            faces.append([a, b, b + n, a + n])
    parts.append(mesh_obj(f"Basin{s['id']}", verts, faces, [M["rock"]]))
    parts.append(fill(f"BasinFloor{s['id']}", [[(p["x"], p["z"]) for p in s["rings"]["0.8"]]], FLOOR_Y, M["pebbles"]))
    # a few smooth stones lying on the floor, and one big one to sit on by the middle
    for k in range(5):
        th = R.random() * TAU
        x, z = spring_point(s, th, R.uniform(0.15, 0.6))
        parts.append(lumpy(f"FloorStone{s['id']}_{k}", x, FLOOR_Y + 0.02, z, R.uniform(0.12, 0.26), 0.5, 900 + s["id"] * 10 + k, 0, 1))

# ---- the rim stones round every spring (flat, walkable, some capped with snow) and the step stones -----------------------------------
for s in SPRINGS:
    around = round(s["r"] * TAU / 0.44)
    st = s["steps"]
    for ring_k, (spacing_out, sz0, sz1, every) in enumerate(((0.3, 0.32, 0.5, 1), (0.78, 0.2, 0.32, 2))):
        for i in range(0, around, every):
            th = i / around * TAU + R.random() * 0.05
            # (the steps' place is left to the step stones)
            if abs(math.atan2(math.sin(th - s["entry"]), math.cos(th - s["entry"]))) < (0.24 if ring_k == 0 else 0.36):
                continue
            out = spacing_out + R.random() * 0.2
            x, z = spring_point(s, th, 1 + out / s["r"])
            size = sz0 + R.random() * (sz1 - sz0)
            snowy = R.random() < (0.28 if ring_k == 0 else 0.45)
            o = lumpy(f"Rim{s['id']}_{ring_k}_{i}", x, -0.03, z, size, 0.3, 2000 + s["id"] * 200 + ring_k * 100 + i, 0.55 if snowy else 0, 2)
            o.scale = (1.3, 1.0, 1.0)
            apply_all(o)
            parts.append(o)
    # the steps: two wide flat stones, one on the rim, one a step down in the water
    for r, y in ((1 + 0.15 / s["r"], 0.03), (1 - 0.35 / s["r"], -0.42)):
        x, z = spring_point(s, s["entry"], r)
        c = cyl(f"Step{s['id']}", 0.62, 0.16, g(x, y - 0.08, z), M["rock"], 9, r2=0.68)
        c.scale = (1.0, 0.8, 1.0)
        c.rotation_euler = (0, 0, -st["angle"])
        apply_all(c)
        parts.append(c)

# ---- the boulders (the walks go round them: each where the plan has it) and more out in the snow --------------------------------------
for i, b in enumerate(BOULDERS):
    parts.append(lumpy(f"Boulder{i}", b["x"], -0.1, b["z"], b["r"] * 1.05, 0.8, 3000 + i, 0.45, 3))
    # a smaller one leaning on it now and then
    if i % 3 == 0:
        a = R.random() * TAU
        rr = b["r"] * 0.5
        bx_, bz = b["x"] + math.cos(a) * b["r"] * 0.95, b["z"] + math.sin(a) * b["r"] * 0.95
        if clear_of_play(bx_, bz, rr * 0.5) or not spring_inside(bx_, bz, -0.9):
            parts.append(lumpy(f"BoulderKid{i}", bx_, -0.06, bz, rr, 0.7, 3100 + i, 0.5, 1))
outside = 0
while outside < 34:
    side = outside % 3
    t = R.random()
    if side == 0:
        x, z = D["maxX"] + 2.2 + R.random() * 6, D["minZ"] + t * (D["maxZ"] - D["minZ"])
    elif side == 1:
        x, z = D["minX"] + t * (D["maxX"] - D["minX"]), D["maxZ"] + 2.2 + R.random() * 6
    else:
        x, z = D["minX"] - 2.4 - R.random() * 3, D["minZ"] + 15 + t * 12
    parts.append(lumpy(f"OutRock{outside}", x, -0.15, z, 0.6 + R.random() * 1.1, 0.7, 4000 + outside, 0.55))
    outside += 1

# ---- the snowfield: all round the terrace out to the mountains, and drifts banked on its edges -------------------------------------
parts.append(
    fill(
        "Snowfield",
        [rect(-130, 130, -130, 130, 26), rect(D["minX"] + 0.02, D["maxX"] - 0.02, D["minZ"] + 0.02, D["maxZ"] - 0.02, 2.0)],
        -0.01,
        M["snow"],
        hole=lambda x, z: D["minX"] < x < D["maxX"] and D["minZ"] < z < D["maxZ"],
    )
)


def drift(x, z, sx, sy, sz, rot=0.0):
    o = sphere("Drift", 1.0, (0, 0, 0), M["snow"], 16, 8)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    o.scale = (sx, sz, sy)
    o.rotation_euler = (0, 0, rot)
    o.location = g(x, -0.06, z)
    apply_all(o)
    return o


z = D["minZ"] + 1
while z < D["maxZ"]:
    parts.append(drift(D["maxX"] + 1.4 + R.random() * 0.8, z, 1.6 + R.random(), 0.5 + R.random() * 0.4, 1.8 + R.random(), R.random()))
    z += 2.6 + R.random() * 1.5
x = D["minX"] + 2
while x < D["maxX"]:
    parts.append(drift(x, D["maxZ"] + 1.3 + R.random() * 0.8, 1.8 + R.random(), 0.45 + R.random() * 0.35, 1.5 + R.random(), R.random()))
    x += 2.6 + R.random() * 1.5
z = D["minZ"] + 1
while z < D["maxZ"]:  # (the near side: low, the camera looks over them)
    parts.append(drift(D["minX"] - 1.7 - R.random() * 0.8, z, 1.4 + R.random(), 0.3 + R.random() * 0.25, 1.6 + R.random(), R.random()))
    z += 3 + R.random() * 1.5
for x in (-12.0, -8.5, 7.5, 11.5):  # (either side of the bathhouse, not across its door)
    parts.append(drift(x, D["minZ"] - 1.4, 1.8, 0.45, 1.2))

# ---- the snow on the terrace (floor.glb: the deck's paint) ---------------------------------------------------------------------------
P = PAINT
SIZE = 1024
px_m = P["span"] / SIZE
ys, xs = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
WX = P["x0"] + (xs + 0.5) * px_m  # world x of each texel (columns)
WZ = P["z0"] + (ys + 0.5) * px_m  # world z (rows, top-down)
rng = np.random.default_rng(77)


def smooth_noise(cells, seed):
    g_ = np.random.default_rng(seed).random((cells + 1, cells + 1)).astype(np.float32)
    u = xs / SIZE * cells
    v = ys / SIZE * cells
    i, j = u.astype(int), v.astype(int)
    fu, fv = u - i, v - j
    fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
    return (g_[j, i] * (1 - fu) + g_[j, i + 1] * fu) * (1 - fv) + (g_[j + 1, i] * (1 - fu) + g_[j + 1, i + 1] * fu) * fv


def seg_dist(ax, az, bx_, bz):
    dx, dz = bx_ - ax, bz - az
    L = dx * dx + dz * dz or 1
    t = np.clip(((WX - ax) * dx + (WZ - az) * dz) / L, 0, 1)
    return np.hypot(WX - (ax + dx * t), WZ - (az + dz * t))


def polyline(pts):
    d = np.full(WX.shape, 1e9, np.float32)
    for a, b in zip(pts, pts[1:]):
        d = np.minimum(d, seg_dist(a[0], a[1], b[0], b[1]))
    return d


alpha = 0.3 + 0.45 * np.clip((smooth_noise(14, 5) - 0.45) * 2.2, 0, 1) + 0.12 * smooth_noise(60, 6)
edge = np.minimum.reduce([WX - D["minX"], D["maxX"] - WX, D["maxZ"] - WZ])
alpha = np.maximum(alpha, 0.95 * np.clip(1 - edge / 1.6, 0, 1))
for b in BOULDERS:
    d = np.hypot(WX - b["x"], WZ - b["z"])
    alpha = np.maximum(alpha, 0.95 * np.clip((b["r"] + 0.9 - d) / 0.9, 0, 1))
# the trodden paths: from the bathhouse door down the middle, across in front of it, out to each spring's steps and round its rim
trod = np.zeros_like(alpha)
door = (DOOR_X, D["minZ"])
for pts, w_, a in [
    ([door, (0.6, -8), (0.4, 4), (0, 11)], 2.2, 0.75),
    ([(-12, -11), (12, -11)], 1.6, 0.6),
]:
    trod = np.maximum(trod, a * np.clip(1 - polyline(pts) / (w_ / 2), 0, 1) ** 0.6)
for s in SPRINGS:
    st = s["steps"]["deck"]
    trod = np.maximum(trod, 0.7 * np.clip(1 - polyline([(0.6, max(-11, min(6, st["z"]))), (st["x"], st["z"])]) / 0.7, 0, 1) ** 0.6)
    ring = [spring_point(s, k / 40 * TAU, 1 + 0.55 / s["r"]) for k in range(41)]
    trod = np.maximum(trod, 0.55 * np.clip(1 - polyline(ring) / 0.55, 0, 1) ** 0.6)
alpha = np.clip(alpha * (1 - trod), 0, 1)
# off the terrace: none (the snowfield is its own)
alpha *= (WX > D["minX"]) & (WX < D["maxX"]) & (WZ > D["minZ"]) & (WZ < D["maxZ"])
thin, thick = np.array([0.79, 0.84, 0.9], np.float32), np.array([0.95, 0.965, 0.985], np.float32)
sparkle = (rng.random(alpha.shape) > 0.996) * 0.04
rgb = thin * (1 - alpha[..., None]) + thick * alpha[..., None] + sparkle[..., None]
img = bpy.data.images.new("snow_cover", SIZE, SIZE, alpha=True)
img.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), alpha])[::-1].astype(np.float32).ravel())
img.filepath_raw = os.path.join(SIGNS, "snow_cover.png")
img.file_format = "PNG"
img.save()
cover = plane("SnowCover", P["span"], P["span"], g(P["x0"] + P["span"] / 2, 0.004, P["z0"] + P["span"] / 2), signmat("snow_cover", 0.8), rot=(0, 0, 0))
floor.append(cover)

for k in ("Terrace", "Snowfield"):
    pass
print("SHELL", tris(parts))
if LOOK:
    cover.hide_render = True  # (it only feeds the deck's paint; the preview would draw it over the springs)
    look("shell_overview", g(0, 0, -1), 36, 55, -90, (1280, 720), 16, 30)
    look("shell_spring", g(-6.2, 0, -1.6), 9, 35, -60, (960, 640), 16, 30)
cover.hide_render = False
save_part("shell", parts)
save_part("floor", floor)
