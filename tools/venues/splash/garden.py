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


from trees import use, lathe, blob, frond_card, palm, stone_pine, cypress, shrub  # noqa: E402  (tools/venues/common/trees.py)

use(M)


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
