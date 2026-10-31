"""The Kids Pool's garden: tall trees round the pool (no lawn: the creator, 31 October 2026, "tall trees on the edge… I don't want
to see the grass"), on the ground level with the deck that shell.py lays: broadleaf trees (planes and limes), coconut palms and a
few cypresses beyond the hedge, behind the beach huts and past the open end; on the near side, under the game's camera, only
palms well out of the overview; shrubs along the hedge's foot.

    blender -b -P tools/venues/kids/garden.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from trees import use, palm, cypress, shrub, broadleaf  # (tools/venues/common/trees.py)

reset()
R = random.Random(41)
LOOK = "--look" in args()
use(
    dict(
        bark=sm("bark"),
        bark_light=sm("bark_light"),
        pine_bark=sm("pine_bark", "#7a5a44", 0.9),
        palm_boot=sm("palm_boot", "#7d6242", 0.95),
        coconut=sm("coconut", "#6f5a2e", 0.6),
        frond=cutmat("palm_frond", 0.65),
        conifer=tmat_tile("conifer", "#22442c", 0.8),
        hedge=tmat_tile("hedge", "#3c7a38", 0.8),
        canopy=tmat_tile("canopy", "#3f7d3a", 0.8),
    )
)
parts = []
X0, X1, Z0, Z1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]
spots = []


def row(kinds, a0, a1, step, fixed, along_x, jitter, heights):
    v, i = a0, 0
    while v <= a1:
        kind = kinds[i % len(kinds)]
        x, z = (v, fixed) if along_x else (fixed, v)
        spots.append((kind, x + R.uniform(-jitter, jitter), z + R.uniform(-jitter, jitter), R.uniform(*heights[kind])))
        v += step * R.uniform(0.85, 1.15)
        i += 1


H = {"broad": (9.0, 12.0), "palm": (9.0, 11.5), "cypress": (8.5, 11.0)}
# beyond the far fence (+x) and its hedge: a row close in, another behind
row(["broad", "palm", "broad", "cypress", "palm"], Z0 - 4, Z1 + 3, 3.6, X1 + 3.0, False, 0.5, H)
row(["broad", "cypress", "broad"], Z0 - 6, Z1 + 6, 5.2, X1 + 8.0, False, 1.0, H)
# past the open end (+z)
row(["palm", "broad", "cypress", "broad", "palm"], X0 - 2, X1 + 4, 3.4, Z1 + 2.8, True, 0.5, H)
row(["broad", "palm", "broad"], X0 - 4, X1 + 8, 4.8, Z1 + 7.5, True, 1.0, H)
# behind the beach huts (-z), rising over them
row(["broad", "palm", "broad", "cypress"], X0 - 3, X1 + 4, 3.8, Z0 - 6.2, True, 0.6, {"broad": (10.0, 13.0), "palm": (10.0, 12.5), "cypress": (10.0, 12.5)})
row(["broad", "broad", "palm"], X0 - 5, X1 + 6, 5.0, Z0 - 11.0, True, 1.0, H)
# the near side (-x): the game's camera stands over it, so only palms here, well out, for the Coach Cam
row(["palm"], Z0 - 2, Z1 + 3, 5.5, X0 - 8.5, False, 0.6, {"palm": (7.5, 9.0)})
for kind, x, z, h in spots:
    seed = int(abs(x * 131 + z * 17)) + 5
    parts += {"broad": broadleaf, "palm": palm, "cypress": cypress}[kind](x, z, h, seed, y0=0.0)
# shrubs along the hedge's outer foot
for (a0, a1, fixed, along_x) in [(Z0 - 1, Z1 + 1, X1 + 1.3, False), (X0 - 1, X1 + 1, Z1 + 1.3, True), (Z0 - 1, Z1 + 1, X0 - 1.3, False)]:
    v = a0
    while v < a1:
        x, z = (v, fixed) if along_x else (fixed, v)
        parts.append(shrub(x + R.uniform(-0.3, 0.3), z + R.uniform(-0.3, 0.3), R.uniform(0.7, 1.1), int(v * 10) + 9, y0=0.0))
        v += R.uniform(1.5, 2.2)

print("TREES", len(spots))
if LOOK:
    look("kgarden_high", g(0, 0, -2), 44, 50, -90, (1280, 720), 16, 30)
    look("kgarden_side", g(14, 3, 2), 24, 18, 120, (1280, 720), 16, 30)
save_part("garden", parts)
