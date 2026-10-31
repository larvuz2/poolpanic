"""The Sunset Lagoon's garden: coconut palms all round the club (leaning, in groves on the dunes), broadleaf sea-almond trees
behind the beach house rising over its roof, sea-grape bushes along the boardwalk's foot, tufts of beach grass on the dunes and
round the piles, and the floor plan's three palms on the deck growing through square openings in the boardwalk. No lawn: sand.
On the sea side (under the game's camera) the palms stand well out, for the Coach Cam.

    blender -b -P tools/venues/lagoon/garden.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from trees import use, palm, shrub, broadleaf, blob  # (tools/venues/common/trees.py)

reset()
R = random.Random(53)
LOOK = "--look" in args()
use(
    dict(
        bark=sm("bark"),
        bark_light=sm("bark_light"),
        pine_bark=sm("bark"),
        palm_boot=sm("palm_boot"),
        coconut=sm("coconut"),
        frond=cutmat("palm_frond", 0.65),
        hedge=tmat_tile("hedge", "#3c7a38", 0.8),
        canopy=tmat_tile("canopy", "#3f7d3a", 0.8),
        conifer=tmat_tile("canopy", "#3f7d3a", 0.8),
    )
)
M = dict(
    grass=cutmat("beach_grass", 0.8),
    hibiscus=cutmat("hibiscus", 0.6),
    timber_dark=sm("timber_dark"),
    sand=tmat_tile("sand", "#ead0a0", 1.0),
)
parts = []
X0, X1, Z0, Z1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]


def clear(x, z, pad=1.5):
    """Away from the boardwalk and its steps (and the beach set: props_beach.py keeps its own spots clear)."""
    if X0 - pad < x < X1 + pad and Z0 - 7 < z < Z1 + pad:
        return False
    if -4 < x < 4 and Z1 < z < Z1 + 5.5:  # (the steps and their landing)
        return False
    return True


# ---- palms ------------------------------------------------------------------------------------------------------------------
spots = []
# the sea side (-x): out past the beach set, for the Coach Cam (the overview's camera is over this side)
for z in [-34, -26, -19, -11, -3, 6, 14, 22, 31]:
    spots.append(("palm", -24.5 - R.uniform(0, 7), z + R.uniform(-2, 2), R.uniform(8.0, 10.5)))
# behind the beach house: tall palms and broadleaf trees rising over the thatch
x = X0 - 6
while x < X1 + 8:
    kind = "broad" if R.random() < 0.45 else "palm"
    spots.append((kind, x + R.uniform(-1, 1), Z0 - 9.5 - R.uniform(0, 3), R.uniform(11, 14) if kind == "palm" else R.uniform(10, 13)))
    x += R.uniform(3.2, 4.6)
x = X0 - 2
while x < X1 + 10:
    spots.append(("palm" if R.random() < 0.6 else "broad", x + R.uniform(-1.5, 1.5), Z0 - 16 - R.uniform(0, 5), R.uniform(10, 14)))
    x += R.uniform(4.5, 6.5)
# the far side (+x): a grove on the dunes
for row, dx in ((0, 4.5), (1, 10.5), (2, 18)):
    z = Z0 - 6 + row * 1.5
    while z < Z1 + 12:
        kind = "broad" if (row == 2 and R.random() < 0.5) else "palm"
        spots.append((kind, X1 + dx + R.uniform(-1.2, 1.2), z + R.uniform(-1, 1), R.uniform(8.5, 12)))
        z += R.uniform(3.4, 5.2) + row * 2.5
# past the open end (+z): palms either side of the beach path, a row further out
for x in [-14, -9.5, 8, 12.5, 17]:
    spots.append(("palm", x + R.uniform(-1, 1), Z1 + 6.5 + R.uniform(0, 2), R.uniform(8, 10.5)))
x = X0 - 4
while x < X1 + 8:
    spots.append(("palm" if R.random() < 0.7 else "broad", x + R.uniform(-1, 1), Z1 + 15 + R.uniform(0, 5), R.uniform(9, 12)))
    x += R.uniform(4, 6)
n_trees = 0
for kind, x, z, h in spots:
    if not clear(x, z):
        continue
    seed = int(abs(x * 131 + z * 17)) + 3
    y0 = ground_y(x, z) - 0.05
    # (the near ones in full; the ones further out than 9 m from the boardwalk lighter)
    far = max(X0 - x, x - X1, Z0 - z, z - Z1) > 9
    if kind == "palm":
        parts += palm(x, z, h, seed, y0=y0, lean=R.uniform(0.1, 0.24), light=far)
    else:
        parts += broadleaf(x, z, h, seed, y0=y0, light=far)
    n_trees += 1

# ---- the floor plan's palms on the deck, growing through square openings in the boardwalk ----------------------------------
for x, z in DECK_PALMS:
    frame = []
    for (a0, a1, b0, b1) in [(-0.6, 0.6, -0.6, -0.48), (-0.6, 0.6, 0.48, 0.6), (-0.6, -0.48, -0.48, 0.48), (0.48, 0.6, -0.48, 0.48)]:
        frame.append(gbx("PalmFrame", x + a0, x + a1, -0.02, 0.08, z + b0, z + b1, M["timber_dark"], 0.01))
    frame.append(gbx("PalmSand", x - 0.48, x + 0.48, -0.06, 0.01, z - 0.48, z + 0.48, M["sand"], 0))
    parts.append(join(frame, "PalmOpening"))
    parts += palm(x, z, 5.6 + R.uniform(-0.3, 0.5), int(abs(x * 7 + z * 13)) + 1, y0=0.0, lean=0.1)

# ---- sea grape bushes along the boardwalk's foot, flowering hibiscus by the beach house's ends ------------------------------
for (a0, a1, fixed, along_x) in [(Z0 - 1, Z1 + 1, X1 + 1.0, False), (Z0 - 1, Z1 + 1, X0 - 1.0, False), (X0 - 1, -4.5, Z1 + 1.0, True), (4.5, X1 + 1, Z1 + 1.0, True)]:
    v = a0
    while v < a1:
        x, z = (v, fixed) if along_x else (fixed, v)
        parts.append(shrub(x + R.uniform(-0.3, 0.3), z + R.uniform(-0.3, 0.3), R.uniform(0.7, 1.15), int(v * 10) + 9, y0=SAND_Y))
        v += R.uniform(2.0, 3.2)
for x in (X0 - 1.6, X1 + 1.6):
    for k in range(3):
        c = (x + R.uniform(-0.5, 0.5), SAND_Y + 1.0 + k * 0.35, Z0 + 0.4 + R.uniform(-0.5, 0.5))
        parts.append(blob("Hibiscus", g(*c), (0.9, 0.8, 0.7), M["hibiscus"], 70 + k, (8, 5), 0.2))


# ---- beach grass: crossed cut-out cards on the dunes and round the piles ----------------------------------------------------------
def tuft(x, z, s, y0):
    out = []
    for k in range(2):
        a = k * PI / 2 + R.uniform(0, PI / 2)
        out.append(plane("Grass", s * 1.2, s, g(x, y0 + s / 2 - 0.04, z), M["grass"], rot=(PI / 2, 0, a)))
    return out


grass = []
for _ in range(260):
    x, z = R.uniform(-30, 60), R.uniform(-45, 55)
    if not clear(x, z, 0.4):
        continue
    if x > -20 and dune_h(x, z) < 0.25 and R.random() < 0.6:
        continue  # (most on the dunes)
    grass += tuft(x, z, R.uniform(0.55, 1.0), ground_y(x, z))
for (a0, a1, fixed, along_x) in [(Z0, Z1, X1 + 0.5, False), (Z0, Z1, X0 - 0.5, False), (X0, X1, Z1 + 0.5, True)]:
    v = a0
    while v < a1:
        x, z = (v, fixed) if along_x else (fixed, v)
        if clear(x, z, -0.2):
            grass += tuft(x + R.uniform(-0.2, 0.2), z + R.uniform(-0.2, 0.2), R.uniform(0.45, 0.8), SAND_Y)
        v += R.uniform(0.9, 1.8)
parts.append(join(grass, "BeachGrass"))

print("TREES", n_trees, "GRASS", len(grass) // 2)
if LOOK:
    look("garden_high", g(0, 0, -2), 50, 50, -90, (1280, 720), 16, 30)
    look("garden_side", g(14, 3, 2), 26, 16, 120, (1280, 720), 16, 30)
save_part("garden", parts)
