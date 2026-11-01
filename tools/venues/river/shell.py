"""The Lazy River's ground, in game coordinates from the game's own plan (kit.PLAN):
- the deck: the temple courtyard's sandstone flagstones (fal, moss in the joints), a grid over the room cut exactly round the river
  (the faces in the water go, the corners left in it are pulled out onto the bank's line);
- the river's channel: its walls of wet mossy boulders down to the bed, the bed of sand and pebbles, and along both banks a coping of
  carved temple stone a little proud of the deck (its lip over the water, its top rounded), the whole length the river is seen;
- the walls: a bamboo palisade lashed with rope at the back (the jungle gate in it, its gap for the cave) and at the end (its gap for
  the temple), low along the near side (the camera looks over it); the far side a ruined temple wall of carved blocks, broken
  crenellations, two collapsed bays with their rubble;
- the jungle gate: two carved stone pillars with the Lazy Idol's face, a timber lintel with LAZY RIVER, a thatched hood, its two
  bamboo leaves (`Door_A`/`Door_B`, swung by the game);
- the jungle floor outside (leaf litter, no lawn) out to the horizon;
- `floor.glb`: the deck's paint: the wet band along the banks and the docks, puddles, moss at the walls, leaves blown in from the
  jungle, the path worn from the gate to the queue and the docks, damp under the cave's and the temple's shade.

    blender -b -P tools/venues/river/shell.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(1931)
TAU = 2 * PI
M = dict(
    deck=tmat_tile("sandstone", "#cfa774", 0.85),
    temple=tmat_tile("templestone", "#9a9a84", 0.88),
    coping=tmat_tile("templestone", "#b8b29a", 0.85, tint="#e8e0c8"),
    rock=tmat_tile("riverrock", "#5a5a50", 0.6),
    bed=tmat_tile("riverbed", "#c8a46a", 0.95),
    bamboo=tmat_tile("bamboo", "#cfae62", 0.6),
    planks=tmat_tile("planks", "#8a5a33", 0.75),
    litter=tmat_tile("leaflitter", "#5a4a30", 0.95),
    thatch=tmat_tile("thatch", "#c99a52", 0.95),
    pole=sm("bamboo"),
    pole_dark=sm("bamboo_dark"),
    rope=sm("rope"),
    timber=sm("timber"),
    timber_dark=sm("timber_dark"),
    iron=sm("iron"),
    moss=sm("moss"),
    idol=cutmat("idol", 0.85),
    sign=signmat("sign_main", 0.6),
)
parts, floor = [], []


def P_(*objs):
    parts.extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def mesh_from(name, verts, faces, m):
    me = bpy.data.meshes.new(name)
    me.from_pydata([g(*v) for v in verts], [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return o


def orient(o, want):
    """Flip the faces whose normal points away from `want(centre)` (a Blender-space vector)."""
    for p in o.data.polygons:
        c = p.center
        wv = want(c)
        if p.normal.dot(wv) < 0:
            p.flip()
    o.data.update()
    return o


UP = lambda c: Vector((0, 0, 1))


def ribbon(name, s0, s1, d0, d1, m, y=None, step=0.25, across=1, want=UP):
    """A strip along the river from s0 to s1 between d0 and d1 across it; `y(f)` its height across (f 0..1 from d0 to d1)."""
    n = max(2, int(math.ceil((s1 - s0) / step)) + 1)
    verts, faces = [], []
    for i in range(n):
        s = s0 + (s1 - s0) * i / (n - 1)
        for j in range(across + 1):
            f = j / across
            x, z = point(s, d0 + (d1 - d0) * f)
            verts.append((x, y(f) if y else 0.0, z))
    cols = across + 1
    for i in range(n - 1):
        for j in range(across):
            a = i * cols + j
            faces.append((a, a + 1, a + cols + 1, a + cols))
    return orient(mesh_from(name, verts, faces, m), want)


def seen_range(d, pad=0.3):
    """The stretch of s where the place `d` across lies inside the room (padded)."""
    ss = [k * 0.1 for k in range(int(LENGTH * 10) + 1)]
    ins = [s for s in ss if in_room(*point(s, d), pad)]
    return (min(ins), max(ins)) if ins else (S_START, S_END)


# ================================================================================================================================
# THE DECK: a grid over the room, cut round the river
# ================================================================================================================================
STEP = 0.4
EDGE = W + 0.14  # the deck stops here (under the coping)
x0, x1, z0, z1 = ROOM["minX"], ROOM["maxX"], ROOM["minZ"], ROOM["maxZ"]
nx, nz = int(round((x1 - x0) / STEP)), int(round((z1 - z0) / STEP))
verts, sd = [], []
for j in range(nz + 1):
    for i in range(nx + 1):
        x, z = x0 + (x1 - x0) * i / nx, z0 + (z1 - z0) * j / nz
        s, d = locate(x, z)
        verts.append([x, 0.0, z])
        sd.append((s, d))
wet = [abs(d) < EDGE and 0.01 < s < LENGTH - 0.01 for s, d in sd]
faces = []
for j in range(nz):
    for i in range(nx):
        a = j * (nx + 1) + i
        q = (a, a + 1, a + nx + 2, a + nx + 1)
        if all(wet[k] for k in q):
            continue
        faces.append(q)
used = {k for f in faces for k in f}
for k in used:
    if wet[k]:
        s, d = sd[k]
        x, z = point(s, math.copysign(EDGE, d if d else 1))
        verts[k][0], verts[k][2] = x, z
deck = orient(mesh_from("Deck", [tuple(v) for v in verts], faces, M["deck"]), UP)
P_(deck)

# ================================================================================================================================
# THE CHANNEL: the bed, the walls, the coping along both banks
# ================================================================================================================================
P_(ribbon("Bed", 0, LENGTH, -W - 0.05, W + 0.05, M["bed"], y=lambda f: BED_Y, step=0.3, across=6))
for side in (-1, 1):
    # the wall: from the coping's foot down to the bed, a little battered, facing into the water
    def inward(c, side=side):
        s, d = locate(c.x, -c.y)
        cc = at(s)
        return Vector((-cc["nx"] * side, cc["nz"] * side, 0.0))

    P_(ribbon("BankWall", 0, LENGTH, side * (W + 0.02), side * (W - 0.22), M["rock"], y=lambda f: -0.04 + (BED_Y + 0.04) * f, step=0.3, across=3, want=inward))
    # the coping: carved stone, its lip over the water, its top rounded, from where the bank enters the room to where it leaves
    a, b = seen_range(side * W, 0.6)
    prof = [(-0.1, -0.04), (-0.09, 0.03), (0.0, 0.07), (0.18, 0.08), (0.36, 0.06), (0.46, 0.0)]
    P_(ribbon("Coping", a, b, side * (W + prof[0][0]), side * (W + prof[-1][0]), M["coping"], y=lambda f: np.interp(f, [(p[0] - prof[0][0]) / (prof[-1][0] - prof[0][0]) for p in prof], [p[1] for p in prof]), step=0.3, across=5))
    # the lip's face down to the water
    P_(ribbon("CopingLip", a, b, side * (W - 0.1), side * (W - 0.1), M["coping"], y=lambda f: -0.04 - 0.14 * f, step=0.3, across=1, want=inward))
    # the coping's joints: a dark groove across it every 0.9 m
    s = a + 0.4
    while s < b:
        x0_, z0_ = point(s, side * (W - 0.08))
        x1_, z1_ = point(s, side * (W + 0.44))
        P_(rod("CopingJoint", (x0_, 0.072, z0_), (x1_, 0.055, z1_), 0.012, M["timber_dark"], 4))
        s += 0.9 + R.uniform(-0.15, 0.15)

# ================================================================================================================================
# THE WALLS: the bamboo palisade (back, end, low near), the ruined temple wall (far)
# ================================================================================================================================
def crossing_gap(wall_z):
    """The x range where the river's banks (plus a margin) cross the wall at z = wall_z."""
    xs = []
    for side in (-1, 1):
        for k in range(int(LENGTH * 10)):
            s = k * 0.1
            xa, za = point(s, side * (W + 1.4))
            xb, zb = point(s + 0.1, side * (W + 1.4))
            if (za - wall_z) * (zb - wall_z) <= 0:
                xs.append(xa)
    return (min(xs), max(xs)) if xs else (0, 0)


BACK_GAP = crossing_gap(ROOM["minZ"])
END_GAP = crossing_gap(ROOM["maxZ"])
print("GAPS back", BACK_GAP, "end", END_GAP)
GATE_GAP = (-(GATE_HALF + 0.42), GATE_HALF + 0.42)


def palisade(xa, xb, z, h, face, seed):
    """A run of bamboo along x at z (or along z at x when face is 'x'): the textured panel, rope bands, poles standing proud on top."""
    r = random.Random(seed)
    out = []
    if face == "z":
        out.append(box("Palisade", xa, xb, 0, h, z - 0.07, z + 0.07, M["bamboo"], 0.0))
        x = xa + 0.08
        while x < xb - 0.05:
            top = h + r.uniform(0.02, 0.32)
            out.append(cyl("PoleTop", 0.06 + r.uniform(0, 0.015), top - h + 0.08, g(x, h - 0.08, z), M["pole"] if r.random() > 0.25 else M["pole_dark"], 6, r2=0.05))
            x += 0.16 + r.uniform(-0.02, 0.03)
        for y in (h * 0.3, h * 0.72):
            out.append(rod("Lashing", (xa, y, z + 0.08), (xb, y, z + 0.08), 0.025, M["rope"], 5))
            out.append(rod("Lashing", (xa, y, z - 0.08), (xb, y, z - 0.08), 0.025, M["rope"], 5))
        # a thicker post every 3 m
        x = xa
        while x <= xb + 0.01:
            out.append(cyl("Post", 0.1, h + 0.45, g(x, 0, z), M["pole_dark"], 8))
            out.append(cyl("PostCap", 0.12, 0.06, g(x, h + 0.42, z), M["rope"], 8))
            x += 3.0
    else:
        out.append(box("Palisade", z - 0.07, z + 0.07, 0, h, xa, xb, M["bamboo"], 0.0))
        x = xa + 0.08
        while x < xb - 0.05:
            top = h + r.uniform(0.02, 0.18)
            out.append(cyl("PoleTop", 0.06, top - h + 0.06, g(z, h - 0.06, x), M["pole"], 6, r2=0.05))
            x += 0.16 + r.uniform(-0.02, 0.03)
        out.append(rod("Lashing", (z + 0.08, h * 0.5, xa), (z + 0.08, h * 0.5, xb), 0.025, M["rope"], 5))
        out.append(box("Rail", z - 0.11, z + 0.11, h - 0.02, h + 0.06, xa, xb, M["timber"], 0.02))
    return out


BZ = ROOM["minZ"] + 0.05
for xa, xb in ((ROOM["minX"], GATE_GAP[0]), (GATE_GAP[1], BACK_GAP[0]), (BACK_GAP[1], ROOM["maxX"])):
    if xb - xa > 0.3:
        P_(*palisade(xa, xb, BZ, 2.4, "z", int(xa * 10)))
EZ = ROOM["maxZ"] - 0.05
for xa, xb in ((ROOM["minX"], END_GAP[0]), (END_GAP[1], ROOM["maxX"])):
    if xb - xa > 0.3:
        P_(*palisade(xa, xb, EZ, 2.4, "z", int(xa * 10) + 50))
# the near side: low, the camera looks over it
P_(*palisade(ROOM["minZ"], ROOM["maxZ"], ROOM["minX"] + 0.05, 0.95, "x", 7))

# the far side: a ruined temple wall of carved blocks, broken crenellations, two collapsed bays, rubble
FX = ROOM["maxX"] + 0.2
z = ROOM["minZ"]
k = 0
RUIN = []  # the bays: [z0, z1, height] (written for the dressing: props_deck.py hangs its lianas from them)
COLLAPSED = [(-6.4, -3.8), (3.2, 5.0)]
while z < ROOM["maxZ"]:
    zb = min(ROOM["maxZ"], z + R.uniform(1.4, 2.4))
    low = any(a < (z + zb) / 2 < b for a, b in COLLAPSED)
    h = R.uniform(0.6, 1.0) if low else R.uniform(2.2, 2.9)
    P_(box("RuinWall", FX - 0.3, FX + 0.3, 0, h, z, zb, M["temple"], 0.03))
    RUIN.append([z, zb, h])
    # a cornice and the crenellations, some missing
    if not low:
        P_(box("RuinCornice", FX - 0.38, FX + 0.38, h, h + 0.18, z - 0.02, zb + 0.02, M["temple"], 0.03))
        c = z + 0.2
        while c < zb - 0.4:
            if R.random() > 0.25:
                ch = R.uniform(0.35, 0.55)
                P_(box("Merlon", FX - 0.25, FX + 0.25, h + 0.18, h + 0.18 + ch, c, c + 0.45, M["temple"], 0.03))
            c += 0.75
    else:
        # the fallen blocks: tumbled in front and behind, mossy
        for q in range(5):
            bx = FX + R.uniform(-0.2, 1.4)
            bz = R.uniform(z, zb)
            sz = R.uniform(0.3, 0.55)
            blk = box("Rubble", bx - sz, bx + sz, 0, sz * 1.1, bz - sz * 0.8, bz + sz * 0.8, M["temple"], 0.05)
            blk.rotation_euler = (R.uniform(-0.2, 0.2), R.uniform(-0.2, 0.2), R.uniform(0, PI))
            apply_all(blk)
            P_(blk)
    # a pilaster between the bays
    P_(box("RuinPilaster", FX - 0.42, FX - 0.28, 0, (h + 0.18) if not low else h, zb - 0.22, zb + 0.22, M["temple"], 0.03))
    z = zb
    k += 1

with open(os.path.join(WORK, "ruin.json"), "w") as f:
    json.dump(RUIN, f)

# ================================================================================================================================
# THE JUNGLE GATE: carved pillars with the Lazy Idol's face, a timber lintel with the sign, a thatched hood, two bamboo leaves
# ================================================================================================================================
GZ = GATE_Z
for s in (-1, 1):
    px = s * (GATE_HALF + 0.3)
    P_(box("GatePillar", px - 0.26, px + 0.26, 0, 3.4, GZ - 0.3, GZ + 0.3, M["temple"], 0.03))
    P_(box("GatePillarCap", px - 0.34, px + 0.34, 3.4, 3.58, GZ - 0.38, GZ + 0.38, M["temple"], 0.03))
    P_(box("GatePillarBase", px - 0.34, px + 0.34, 0, 0.32, GZ - 0.38, GZ + 0.38, M["temple"], 0.03))
    P_(plane("GateIdol", 0.5, 0.56, g(px, 2.55, GZ + 0.302), M["idol"]))
P_(box("Lintel", -GATE_HALF - 0.7, GATE_HALF + 0.7, 3.0, 3.35, GZ - 0.18, GZ + 0.18, M["timber"], 0.03))
P_(box("SignBoard", -1.55, 1.55, 3.36, 4.38, GZ + 0.05, GZ + 0.13, M["timber_dark"], 0.02))
P_(plane("MainSign", 3.0, 3.0 * 320 / 1024, g(0, 3.87, GZ + 0.135), M["sign"]))
for s in (-1, 1):
    P_(rod("SignRope", (s * 1.3, 4.38, GZ + 0.09), (s * 1.1, 3.35, GZ + 0.09), 0.02, M["rope"], 5))
    # the hood's posts, on the pillars' caps
    P_(cyl("HoodPost", 0.07, 1.1, g(s * (GATE_HALF + 0.3), 3.58, GZ - 0.25), M["pole_dark"], 7))
# the thatched hood over the lintel: a prism of thatch, its ridge along x
hood = []
L = GATE_HALF + 1.1
bm = bmesh.new()
pts = [(-0.85, 4.55), (0.75, 4.55), (-0.05, 5.25)]
vs = [[bm.verts.new(g(x, y, GZ + zz)) for zz, y in pts] for x in (-L, L)]
for a, b_ in ((0, 1), (1, 2), (2, 0)):
    bm.faces.new((vs[0][a], vs[1][a], vs[1][b_], vs[0][b_]))
bm.faces.new(vs[0])
bm.faces.new(vs[1][::-1])
me = bpy.data.meshes.new("GateHood")
bm.to_mesh(me)
bm.free()
hood = bpy.data.objects.new("GateHood", me)
bpy.context.scene.collection.objects.link(hood)
hood.data.materials.append(M["thatch"])
P_(hood)
# (the sign sits in front of the hood: the hood stands behind, over the lintel)
# the two leaves: bamboo poles lashed to two rails, hinged at the pillars
for side, name in ((-1, "Door_A"), (1, "Door_B")):
    hx = side * GATE_HALF
    lw = GATE_HALF - 0.04
    leaf = []
    for i in range(7):
        x = hx - side * (0.1 + i * (lw - 0.14) / 6)
        hgt = 1.75 + (0.12 if i % 2 else 0.0) - 0.04 * i
        leaf.append(cyl("LeafPole", 0.055, hgt, g(x, 0.08, GZ + 0.06), M["pole"], 7))
        leaf.append(sphere("LeafPoleTop", 0.055, g(x, 0.08 + hgt, GZ + 0.06), M["pole_dark"], 6, 4))
    for y in (0.45, 1.35):
        leaf.append(box("LeafRail", min(hx, hx - side * lw), max(hx, hx - side * lw), y - 0.04, y + 0.04, GZ + 0.12, GZ + 0.18, M["timber"], 0.01))
    leaf.append(rod("LeafBrace", (hx - side * 0.1, 0.45, GZ + 0.15), (hx - side * (lw - 0.1), 1.35, GZ + 0.15), 0.03, M["timber"], 5))
    o = join(leaf, name)
    set_origin(o, g(hx, 0, GZ + 0.06))
    P_(o)

# ================================================================================================================================
# OUTSIDE: the jungle floor to the horizon (leaf litter: no lawn)
# ================================================================================================================================
outer = 70.0
for name, xa, xb, za, zb in (
    ("FloorNear", -outer, ROOM["minX"], -outer, outer),
    ("FloorFar", ROOM["maxX"], outer, -outer, outer),
    ("FloorBack", ROOM["minX"], ROOM["maxX"], -outer, ROOM["minZ"]),
    ("FloorEnd", ROOM["minX"], ROOM["maxX"], ROOM["maxZ"], outer),
):
    P_(orient(mesh_from(name, [(xa, -0.03, za), (xb, -0.03, za), (xb, -0.03, zb), (xa, -0.03, zb)], [(0, 1, 2, 3)], M["litter"]), UP))

# ================================================================================================================================
# THE DECK'S PAINT (floor.glb)
# ================================================================================================================================
Pt = PAINT
SIZE = Pt["size"]
xs_ = Pt["x0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
zs_ = Pt["z0"] + (np.arange(SIZE) + 0.5) / SIZE * Pt["span"]
WX, WZ = np.meshgrid(xs_, zs_)
rng = np.random.default_rng(1931)


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


# the distance from the river at every pixel (from the samples, coarse then exact enough)
DR = np.full(WX.shape, 99.0, np.float32)
for p in SAMPLES[::2]:
    DR = np.minimum(DR, np.hypot(WX - p["x"], WZ - p["z"]))
bankd = DR - W  # metres out from the bank
deckm = (bankd > 0.0).astype(np.float32)
n1, n2, n3 = vnoise(0.7, 3), vnoise(0.3, 5), vnoise(1.6, 9)
# the wet band along both banks: splashes darken the stone, more where the riders climb out
splash = np.clip(1 - bankd / 1.1, 0, 1) * np.clip((n2 - 0.35) * 2.2, 0, 1)
for key in ("board", "exit"):
    st = DOCKS[key]["stand"]
    splash = np.maximum(splash, np.clip(1 - np.hypot(WX - st["x"], WZ - st["z"]) / 2.2, 0, 1) * (0.6 + 0.4 * n2))
tr = DOCKS["tubeReturn"]
splash = np.maximum(splash, np.clip(1 - np.hypot(WX - tr["x"], WZ - tr["z"]) / 1.6, 0, 1) * 0.8)
lay((0.42, 0.34, 0.24), splash * 0.5 * deckm)
# puddles: a few dark glossy pools by the docks
for key in ("board", "exit"):
    st = DOCKS[key]["stand"]
    for q in range(3):
        cx, cz = st["x"] + rng.uniform(-1.4, 1.4), st["z"] + rng.uniform(-1.4, 1.4)
        pud = np.clip(1 - np.hypot((WX - cx) / rng.uniform(0.3, 0.6), (WZ - cz) / rng.uniform(0.25, 0.5)), 0, 1)
        lay((0.3, 0.27, 0.2), np.clip(pud * 3, 0, 1) * 0.45 * deckm)
# the worn path: from the gate down to the queue and on to the docks
path = np.clip(1 - np.abs(WX) / 1.6, 0, 1) * (WZ < -11.5)
bx, bz = DOCKS["board"]["stand"]["x"], DOCKS["board"]["stand"]["z"]
for t in np.linspace(0, 1, 30):
    cx, cz = -3.0 + (bx - -3.0) * t, -11.0 + (bz - -11.0) * t
    path = np.maximum(path, np.clip(1 - np.hypot(WX - cx, WZ - cz) / 1.2, 0, 1))
lay((0.86, 0.74, 0.55), path * 0.16 * (0.6 + 0.4 * n1) * deckm)
# moss creeping in from the walls and the corners; leaves blown in from the jungle
edge = np.minimum.reduce([WX - ROOM["minX"], ROOM["maxX"] - WX, WZ - ROOM["minZ"], ROOM["maxZ"] - WZ])
moss = np.clip(1 - edge / 1.4, 0, 1) * np.clip((n1 - 0.4) * 2.5, 0, 1)
lay((0.34, 0.45, 0.2), moss * 0.55 * deckm)
leaves = (rng.random(WX.shape) > 0.9968) * np.clip(1.4 - edge / 6, 0, 1) * deckm
tone = rng.random(WX.shape)
lay((0.62, 0.38, 0.14), leaves * (tone > 0.5) * 0.95)
lay((0.78, 0.6, 0.2), leaves * (tone <= 0.5) * 0.9)
# damp in the cave's and the temple's shade
for s_ in (S_START, S_END):
    cx, cz = point(s_, 0)
    shade = np.clip(1 - np.hypot(WX - cx, WZ - cz) / 7.0, 0, 1) * (0.5 + 0.5 * n3)
    lay((0.3, 0.33, 0.24), shade * 0.35 * deckm)
rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
inside = (WX > ROOM["minX"]) & (WX < ROOM["maxX"]) & (WZ > ROOM["minZ"]) & (WZ < ROOM["maxZ"])
alpha *= inside
img = bpy.data.images.new("river_paint", SIZE, SIZE, alpha=True)
img.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), alpha])[::-1].astype(np.float32).ravel())
img.filepath_raw = os.path.join(SIGNS, "river_paint.png")
img.file_format = "PNG"
img.save()
cover = plane("Paint", Pt["span"], Pt["span"], g(Pt["x0"] + Pt["span"] / 2, 0.004, Pt["z0"] + Pt["span"] / 2), signmat("river_paint", 0.8), rot=(0, 0, 0))
floor.append(cover)

print("SHELL", tris(parts))
if LOOK:
    cover.hide_render = True
    look("shell_overview", g(0, 0, -1), 38, 55, 270, (1280, 720), 16, 30)
    look("shell_gate", g(0, 2.0, -16.0), 9, 12, 0, (1280, 720), 16, 30)
    look("shell_far", g(15, 1.5, 0), 14, 14, 270, (1280, 720), 16, 30)
    look("shell_bank", g(-2.0, 0.0, -2.0), 5, 30, 300, (1280, 720), 16, 35)
cover.hide_render = False
save_part("shell", parts)
save_part("floor", floor)
