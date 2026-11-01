"""The Lazy River's jungle, outside the walls (kit.PLAN): tall and thick behind the far side's ruin, the back and the end (the top of
the picture and the Coach Cam's views out), low along the near side (under the camera); never in the river's way where it runs on
behind the walls, nor on the cave or the temple.
- coconut palms in leaning groves, broadleaf giants with lianas hanging from their crowns, bamboo groves;
- under them banana plants, monstera, heliconia and bird of paradise, bromeliads, ferns, lumpy bushes, mossy rocks;
- the jungle floor itself is the shell's (leaf litter, no lawn), the painted horizon beyond (dist/assets/river-club/horizon.webp).

    blender -b -P tools/venues/river/garden.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402
from trees import palm, broadleaf, blob  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(1934)
TAU = 2 * PI
M = dict(
    hedge=tmat_tile("hedge", "#2f6b34", 0.8),
    rock=tmat_tile("riverrock", "#5a5a50", 0.6),
    pole=sm("bamboo"),
    pole_dark=sm("bamboo_dark"),
    bamboo_green=sm("bamboo_green", "#8fb84a", 0.6),
    liana=cutmat("liana", 0.7),
    banana=cutmat("banana_1", 0.6),
    banana2=cutmat("banana_2", 0.6),
    monstera=cutmat("monstera_1", 0.6),
    monstera2=cutmat("monstera_3", 0.6),
    heliconia=cutmat("heliconia", 0.6),
    paradise=cutmat("paradise", 0.6),
    bromeliad=cutmat("bromeliad", 0.6),
    frond=cutmat("palm_frond", 0.65),
    leaf_dark=sm("leaf_dark"),
)
trees.use(
    dict(
        bark=sm("bark"),
        bark_light=sm("bark"),
        pine_bark=sm("bark"),
        palm_boot=sm("palm_boot", "#7d6242", 0.95),
        coconut=sm("coconut"),
        frond=M["frond"],
        conifer=M["hedge"],
        hedge=M["hedge"],
        canopy=tmat_tile("canopy", "#3f7d3a", 0.8),
    )
)
parts = {}
RM = ROOM


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def free(x, z, pad=0.6):
    """Outside the room and clear of the river where it runs on behind the walls (and of the cave and the temple)."""
    if in_room(x, z, pad):
        return False
    s, d = locate(x, z)
    if abs(d) < W + 3.2 and -2 < s < LENGTH + 2:
        return False
    for s_ in (S_START, S_END):
        cx, cz = point(s_, 0)
        if math.hypot(x - cx, z - cz) < 7.5:
            return False
    return True


def spot(side, g0, g1):
    """A place g0..g1 metres outside a wall: far (+x), near (-x), back (-z), end (+z)."""
    g_ = R.uniform(g0, g1)
    if side == "far":
        return RM["maxX"] + g_, R.uniform(RM["minZ"] - 8, RM["maxZ"] + 8)
    if side == "near":
        return RM["minX"] - g_, R.uniform(RM["minZ"] - 8, RM["maxZ"] + 8)
    if side == "back":
        return R.uniform(RM["minX"] - 6, RM["maxX"] + 6), RM["minZ"] - g_
    return R.uniform(RM["minX"] - 6, RM["maxX"] + 6), RM["maxZ"] + g_


def spots(n, sides, g0, g1, gap=1.2, taken=None):
    out = taken if taken is not None else []
    tries = 0
    while len(out) < n and tries < n * 60:
        tries += 1
        x, z = spot(sides[len(out) % len(sides)], g0, g1)
        if free(x, z) and all(math.hypot(x - a, z - b) > gap for a, b, *_ in out):
            out.append((x, z))
    return out


def tuft(x, z, s, m, n=2, y=0.0, seed=0):
    r = random.Random(seed)
    out = []
    for k in range(n):
        a = k * PI / n + r.uniform(-0.3, 0.3)
        out.append(plane("Tuft", s * r.uniform(0.9, 1.25), s, g(x, y + s / 2 - 0.05, z), m, rot=(PI / 2, 0, a)))
    return out


def banana_plant(x, z, size, seed):
    r = random.Random(seed)
    out = [cyl("BananaTrunk", 0.13 * size, 1.4 * size, g(x, 0, z), M["leaf_dark"], 7, r2=0.09 * size)]
    for k in range(7):
        a = k * TAU / 7 + r.uniform(-0.25, 0.25)
        f = trees.frond_card("BananaLeaf", Vector(g(x, 1.35 * size, z)), -a, math.radians(r.uniform(20, 45)), r.uniform(1.4, 1.9) * size, 0.55 * size, math.radians(r.uniform(35, 70)), segs=4)
        set_mat(f, M["banana"] if k % 2 else M["banana2"])
        out.append(f)
    return out


def monstera(x, z, size, seed):
    r = random.Random(seed)
    out = []
    for k in range(6):
        a = k * TAU / 6 + r.uniform(-0.3, 0.3)
        d = r.uniform(0.15, 0.45) * size
        h = r.uniform(0.5, 1.1) * size
        out.append(plane("Monstera", 0.8 * size, 0.85 * size, g(x + math.cos(a) * d, h, z + math.sin(a) * d), M["monstera"] if k % 2 else M["monstera2"], rot=(PI / 2 - r.uniform(0.2, 0.7), 0, -a + PI / 2)))
    return out


def bamboo_grove(x, z, seed):
    r = random.Random(seed)
    out = []
    for k in range(9):
        bx, bz = x + r.uniform(-0.9, 0.9), z + r.uniform(-0.9, 0.9)
        h = r.uniform(4.5, 8.0)
        lean = (r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3))
        out.append(tube("BambooCulm", [Vector(g(bx, 0, bz)), Vector(g(bx + lean[0] * 0.4, h * 0.5, bz + lean[1] * 0.4)), Vector(g(bx + lean[0], h, bz + lean[1]))], 0.07, M["bamboo_green"] if k % 3 else M["pole"], 2, 6))
        for q in range(3):
            fy = h * r.uniform(0.6, 0.95)
            f = trees.frond_card("BambooLeaves", Vector(g(bx + lean[0] * fy / h, fy, bz + lean[1] * fy / h)), r.uniform(0, TAU), math.radians(r.uniform(10, 40)), r.uniform(0.9, 1.4), 0.3, math.radians(40), segs=3)
            out.append(f)
    return out


# ---- palms in groves: thick behind the far ruin, the back and the end; none on the near side close in -----------------------------
taken = []
palms = spots(32, ["far", "far", "back", "end"], 1.5, 16, 2.2, taken)
for k, (x, z) in enumerate(palms):
    add("palms", *palm(x, z, R.uniform(6.0, 10.5), 2000 + k, y0=-0.03, lean=R.uniform(0.08, 0.22), light=k % 2 == 1))
# ---- broadleaf giants with lianas hanging from their crowns, further out ----------------------------------------------------------
giants = spots(10, ["far", "back", "end", "far"], 9, 24, 6.0, [])
for k, (x, z) in enumerate(giants):
    h = R.uniform(11, 15)
    add("trees", *broadleaf(x, z, h, 2100 + k, y0=-0.03, light=True))
    for q in range(5):
        a = R.uniform(0, TAU)
        d = h * 0.28 * R.uniform(0.6, 1.0)
        L = R.uniform(2.0, 4.0)
        add("trees", plane("Liana", L * 0.5, L, g(x + math.cos(a) * d, h * 0.62 - L / 2, z + math.sin(a) * d), M["liana"], rot=(PI / 2, 0, R.uniform(0, TAU))))
# near-side trees: far out only (behind the camera: the Coach Cam's view back)
for k, (x, z) in enumerate(spots(6, ["near"], 12, 22, 6.0, [])):
    add("trees", *broadleaf(x, z, R.uniform(10, 13), 2200 + k, y0=-0.03, light=True))
# ---- bamboo groves -----------------------------------------------------------------------------------------------------------
for k, (x, z) in enumerate(spots(6, ["far", "back", "end"], 3, 12, 4.0, [])):
    add("bamboo", *bamboo_grove(x, z, 2300 + k))
# ---- the understorey: banana plants, monstera, heliconia, bird of paradise, bromeliads, ferns, bushes, rocks ------------------------
under = spots(120, ["far", "back", "end", "far", "back"], 0.5, 9, 0.85, [])
for k, (x, z) in enumerate(under):
    kind = k % 6
    if kind == 0:
        add("under", *banana_plant(x, z, R.uniform(1.1, 1.8), 2400 + k))
    elif kind == 1:
        add("under", *monstera(x, z, R.uniform(1.0, 1.5), 2400 + k))
    elif kind == 2:
        add("under", *tuft(x, z, R.uniform(0.9, 1.3), M["heliconia"], 3, seed=2400 + k))
    elif kind == 3:
        add("under", *tuft(x, z, R.uniform(0.9, 1.2), M["paradise"], 3, seed=2400 + k))
    elif kind == 4:
        add("under", blob("Bush", g(x, 0.45, z), (R.uniform(0.7, 1.2), R.uniform(0.7, 1.2), R.uniform(0.5, 0.9)), M["hedge"], 2400 + k, (9, 5), 0.25))
        add("under", *tuft(x + 0.4, z, 0.6, M["bromeliad"], 2, seed=2450 + k))
    else:
        add("under", *tuft(x, z, R.uniform(0.9, 1.3), M["frond"], 3, seed=2400 + k))
# the near side: low only (ferns, bromeliads, bushes under a metre)
for k, (x, z) in enumerate(spots(30, ["near"], 0.5, 6, 1.0, [])):
    if k % 3 == 0:
        add("under", blob("LowBush", g(x, 0.3, z), (0.6, 0.6, 0.4), M["hedge"], 2500 + k, (8, 4), 0.25))
    else:
        add("under", *tuft(x, z, R.uniform(0.6, 0.9), M["frond"] if k % 2 else M["bromeliad"], 2, seed=2500 + k))
# mossy rocks
for k, (x, z) in enumerate(spots(14, ["far", "back", "end", "near"], 0.8, 10, 1.5, [])):
    sz = R.uniform(0.4, 1.1)
    add("under", blob("JungleRock", g(x, sz * 0.25, z), (sz, sz * 0.85, sz * 0.6), M["rock"], 2600 + k, (8, 5), 0.22))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("gd_far", g(15, 2.0, 0.0), 26, 18, 270, (1280, 720), 16, 30)
    look("gd_end", g(4, 2.0, 14), 22, 16, 180, (1280, 720), 16, 30)
save_part("garden", [o for v in parts.values() for o in v if o])
