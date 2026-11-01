"""The Jumping Pool's garden and clubhouse, in game coordinates (kit.PLAN):
- the clipped box hedges round the deck (fal: a box hedge's leaves), a gap at each near corner for the gate: white posts with
  ball finials, a white arch heavy with red roses (the picket leaves that swing are the game's);
- flower beds along the hedges' outer side (roses, lavender, white and pink blooms), broadleaf trees well back behind the near
  hedge (the camera looks over it), cypresses along the far side, trees beyond the ends;
- the clubhouse past the far hedge: lime-washed render (fal) under a terracotta hipped roof (fal), a deep white cornice, a
  colonnade with a porch roof, two floors of windows with green shutters, striped awnings (fal), SPLASHWORTH COUNTRY CLUB, a clock,
  the flagpole (the flag is the game's), Sir Reginald Splashworth's portrait under the colonnade and the club's posters (GPT Image
  2.5, our characters), the terrace's tables under green-and-cream parasols, a croquet set on the lawn.

    blender -b -P tools/venues/dive/props_garden.py [-- --look]
"""

import os, sys, math, random
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(1904)
M = dict(
    hedge=tmat_tile("hedge", "#3f7a3a", 0.75),
    stucco=tmat_tile("stucco", "#f3ead8", 0.85),
    rooftile=tmat_tile("rooftile", "#c8664a", 0.8),
    awning=tmat_tile("awning", "#2f6b4a", 0.8),
    marble=tmat_tile("marble", "#f1ece4", 0.25),
    concrete=tmat_tile("concrete", "#ece8e0", 0.7),
    white=sm("white"),
    cream=sm("cream"),
    racing=sm("racing"),
    navy=sm("navy"),
    window=sm("window"),
    brass=sm("brass"),
    gold=sm("gold"),
    ink=sm("ink"),
    soil=sm("soil"),
    rose=sm("rose"),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    lilac=sm("lilac"),
    pink=sm("pink"),
    yellow=sm("yellow"),
    red=sm("red"),
    teak=tmat_tile("teak", "#b98d5c", 0.55),
)
trees.use({
    "bark": sm("bark"),
    "bark_light": sm("bark"),
    "canopy": sm("canopy", "#4c8f3e", 0.85),
    "conifer": sm("conifer", "#2b5a2e", 0.9),
    "hedge": sm("shrub", "#3f7a3a", 0.85),
    "pine": sm("pine", "#3d6b35", 0.85),
    "pine_bark": sm("bark"),
})
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


lb = box
R0 = ROOM
GX = GATE_X
Y0 = 0.0  # the hedges stand on the deck's edge (the deck's top: 0)
# ================================================================================================================================
# THE HEDGES AND THE GATES
# ================================================================================================================================
t = HEDGE_T
for nm, (a, b, c, d) in {
    "HedgeNear": (R0["minX"], R0["minX"] + t, R0["minZ"], R0["maxZ"]),
    "HedgeFar": (R0["maxX"] - t, R0["maxX"], R0["minZ"], R0["maxZ"]),
}.items():
    add("hedges", box(nm, a, b, Y0 - 0.02, HEDGE_H, c, d, M["hedge"], 0.12))
for s in (-1, 1):
    zz = (s * (R0["maxZ"] - t), s * R0["maxZ"])
    add("hedges",
        box("HedgeEnd", R0["minX"] + t, GX - 1.05, Y0 - 0.02, HEDGE_H, *zz, M["hedge"], 0.12),
        box("HedgeEnd", GX + 1.05, R0["maxX"] - t, Y0 - 0.02, HEDGE_H, *zz, M["hedge"], 0.12))
    z = s * (R0["maxZ"] - t / 2)
    for dx in (-0.95, 0.95):
        add("gates",
            box("GatePost", GX + dx - 0.1, GX + dx + 0.1, 0.0, 2.4, z - 0.1, z + 0.1, M["white"], 0.02),
            sphere("GateBall", 0.13, g(GX + dx, 2.52, z), M["white"], 12, 8))
    arc = [Vector(g(GX + math.cos(a) * 0.95, 2.4 + math.sin(a) * 0.95, z)) for a in np.linspace(0, PI, 13)]
    add("gates", tube("RoseArch", arc, 0.06, M["white"], 2, 8))
    rr = random.Random(5 + s)
    for k in range(26):
        a = rr.uniform(0.05, PI - 0.05)
        add("gates", sphere("Rose" if k % 3 else "RoseLeaf", rr.uniform(0.08, 0.12), g(GX + math.cos(a) * 0.95, 2.4 + math.sin(a) * 0.95, z + rr.uniform(-0.12, 0.12)), M["rose"] if k % 3 else M["leaf"], 8, 5))
    for dx in (-0.95, 0.95):
        for k in range(6):
            add("gates", sphere("RoseClimb", 0.09, g(GX + dx + rr.uniform(-0.12, 0.12), 0.4 + k * 0.33, z + rr.uniform(-0.14, 0.14)), M["rose"] if k % 2 else M["leaf"], 8, 5))
# ================================================================================================================================
# THE FLOWER BEDS OUTSIDE THE HEDGES, THE TREES
# ================================================================================================================================
blooms = [M["rose"], M["pink"], M["yellow"], M["white"], M["lilac"]]


def bed(x0, x1, z0, z1, seed, n=10):
    r = random.Random(seed)
    out = [box("Bed", x0, x1, GROUND_Y, GROUND_Y + 0.12, z0, z1, M["soil"], 0.03)]
    for _ in range(n):
        x, z = r.uniform(x0 + 0.1, x1 - 0.1), r.uniform(z0 + 0.1, z1 - 0.1)
        out.append(trees.blob("BedLeaf", g(x, GROUND_Y + 0.3, z), (0.24, 0.24, 0.22), M["leaf_dark"], r.randint(0, 9999), (6, 4), 0.2))
        for k in range(2):
            out.append(sphere("Bloom", r.uniform(0.07, 0.11), g(x + r.uniform(-0.14, 0.14), GROUND_Y + 0.48, z + r.uniform(-0.14, 0.14)), r.choice(blooms), 6, 4))
    return out


for z in np.arange(-14.0, 14.1, 4.0):
    add("garden", *bed(R0["maxX"] + 0.15, R0["maxX"] + 0.95, z - 1.4, z + 1.4, int(z * 10) + 50))
for s in (-1, 1):
    for x in np.arange(-4.0, 13.0, 4.5):
        add("garden", *bed(x - 1.6, x + 1.6, s * (R0["maxZ"] + 0.15), s * (R0["maxZ"] + 0.95), int(x * 10) + 90 * s))
for k, z in enumerate(np.arange(R0["minZ"] - 3, R0["maxZ"] + 3.1, 5.2)):
    add("trees", *trees.broadleaf(R0["minX"] - 8.5 - R.uniform(0, 3), z + R.uniform(0, 2), 5.5 + R.uniform(0, 1.5), 700 + k, y0=GROUND_Y))
    if abs(z) > 4:
        add("trees", *trees.cypress(R0["maxX"] + 2.0, z + 1.3, 5.2 + R.uniform(0, 1), 800 + k, y0=GROUND_Y))
for s in (-1, 1):
    for k, x in enumerate(np.arange(R0["minX"] - 2, R0["maxX"] + 2.1, 5.5)):
        if abs(x - GX) < 3:
            continue
        add("trees", *trees.broadleaf(x + R.uniform(0, 2), s * (R0["maxZ"] + 5 + R.uniform(0, 4)), 6.0 + R.uniform(0, 1.5), 900 + k + 50 * s, y0=GROUND_Y, light=True))

# ================================================================================================================================
# THE CLUBHOUSE (its front to the pool, -x)
# ================================================================================================================================
C = CLUB
x0, dep, wid, hgt = C["x0"], C["depth"], C["width"], C["height"]
cx = x0 + dep / 2
G = GROUND_Y
add("club",
    box("ClubBody", x0, x0 + dep, G, G + hgt, -wid / 2, wid / 2, M["stucco"], 0.05),
    box("Cornice", x0 - 0.3, x0 + dep + 0.3, G + hgt, G + hgt + 0.4, -wid / 2 - 0.3, wid / 2 + 0.3, M["white"], 0.06),
    box("Plinth", x0 - 0.06, x0 + dep + 0.06, G, G + 0.5, -wid / 2 - 0.06, wid / 2 + 0.06, M["concrete"], 0.02))
# the hipped roof: two slopes to a ridge along z, two hips at the ends
rh = 3.0
ry = G + hgt + 0.4
add("club", prism("Roof", [(x0 - 0.4, ry), (x0 + dep + 0.4, ry), (cx + 0.0, ry + rh)], -wid / 2 + dep / 2, wid / 2 - dep / 2, M["rooftile"]))
for s in (-1, 1):
    me = bpy.data.meshes.new("RoofHip")
    zr = s * (wid / 2 - dep / 2)
    ze = s * (wid / 2 + 0.4)
    verts = [g(x0 - 0.4, ry, zr), g(x0 + dep + 0.4, ry, zr), g(cx, ry + rh, zr), g(x0 - 0.4, ry, ze), g(x0 + dep + 0.4, ry, ze)]
    me.from_pydata(verts, [], [[0, 3, 2], [3, 4, 2], [4, 1, 2]])
    me.update()
    o = bpy.data.objects.new("RoofHip", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(M["rooftile"])
    add("club", o)
# chimneys
for z in (-9.0, 9.0):
    add("club", box("Chimney", cx + 1.0, cx + 1.8, ry + 0.5, ry + 2.8, z - 0.4, z + 0.4, M["stucco"], 0.02), box("ChimneyCap", cx + 0.9, cx + 1.9, ry + 2.8, ry + 2.95, z - 0.5, z + 0.5, M["white"], 0.01))
# the colonnade and its porch roof
fx = x0 - 1.6
for k in range(11):
    z = -wid / 2 + 1.5 + k * (wid - 3) / 10
    add("club",
        cyl("Column", 0.3, 4.3, g(fx, G + 0.15, z), M["white"], 16, r2=0.26),
        box("ColumnBase", fx - 0.36, fx + 0.36, G, G + 0.15, z - 0.36, z + 0.36, M["white"], 0.02),
        box("ColumnCap", fx - 0.36, fx + 0.36, G + 4.45, G + 4.6, z - 0.36, z + 0.36, M["white"], 0.02))
add("club",
    box("PorchRoof", fx - 0.5, x0, G + 4.6, G + 4.9, -wid / 2 + 0.8, wid / 2 - 0.8, M["white"], 0.05),
    box("PorchFloor", fx - 0.6, x0, G, G + 0.15, -wid / 2 + 0.8, wid / 2 - 0.8, M["marble"], 0.02))
# windows with green shutters, two floors; the door
for k in range(9):
    z = -wid / 2 + 2.5 + k * (wid - 5) / 8
    for y in (2.0, 5.6):
        if y == 2.0 and abs(z) < 1.5:
            continue
        add("club",
            box("Window", x0 - 0.03, x0 + 0.02, G + y - 0.75, G + y + 0.75, z - 0.45, z + 0.45, M["window"], 0.0),
            box("WindowFrame", x0 - 0.06, x0 - 0.01, G + y - 0.8, G + y + 0.8, z - 0.5, z + 0.5, M["white"], 0.01),
            box("WindowBar", x0 - 0.07, x0 - 0.03, G + y - 0.75, G + y + 0.75, z - 0.02, z + 0.02, M["white"], 0.0))
        for d in (-0.62, 0.62):
            add("club", box("Shutter", x0 - 0.1, x0 - 0.04, G + y - 0.75, G + y + 0.75, z + d - 0.14, z + d + 0.14, M["racing"], 0.01))
add("club",
    box("Door", x0 - 0.04, x0 + 0.02, G + 0.5, G + 3.0, -0.9, 0.9, M["racing"], 0.02),
    box("DoorFrame", x0 - 0.07, x0 - 0.02, G + 0.5, G + 3.15, -1.05, 1.05, M["white"], 0.01),
    face("ClubName", 8.0, 1.17, x0 - 0.04, G + 6.75 + 0.2, 0.0, -PI / 2, signmat("club_name", 0.5)))
# the clock over the door, between the floors
add("club",
    cyl("ClockRim", 0.55, 0.08, g(x0 - 0.05, G + 3.8, 0.0), M["gold"], 28, rot=(0, PI / 2, 0)),
    cyl("ClockFace", 0.48, 0.02, g(x0 - 0.12, G + 3.8, 0.0), M["cream"], 28, rot=(0, PI / 2, 0)),
    rod("ClockHand", (x0 - 0.14, G + 3.8, 0.0), (x0 - 0.14, G + 4.15, 0.0), 0.02, M["ink"]),
    rod("ClockHand", (x0 - 0.15, G + 3.8, 0.0), (x0 - 0.15, G + 3.62, 0.25), 0.025, M["ink"]))
# striped awnings over the ground floor's outer windows
for z in (-9.0, 9.0):
    aw = box("Awning", x0 - 1.6, x0, G + 3.0, G + 3.06, z - 2.25, z + 2.25, M["awning"], 0.0)
    aw.rotation_euler = (0, 0, 0)
    add("club", aw)
    add("club", box("AwningValance", x0 - 1.62, x0 - 1.56, G + 2.75, G + 3.06, z - 2.25, z + 2.25, M["awning"], 0.0))
# the flagpole on the roof's ridge (the flag is the game's, at its top)
add("club", cyl("FlagPole", 0.06, 4.0, g(cx, ry + rh - 0.4, 0.0), M["white"], 10), sphere("FlagFinial", 0.1, g(cx, ry + rh + 3.65, 0.0), M["gold"], 10, 6))
# under the colonnade: Sir Reginald's portrait in a gilt frame and its plaque; the club's posters at the colonnade's ends


def gilt(name, sign, w, h, x, y, z):
    out = [face(name, w, h, x - 0.05, y, z, -PI / 2, signmat(sign, 0.5))]
    for (a, b_, c, d) in ((-w / 2 - 0.12, w / 2 + 0.12, h / 2, h / 2 + 0.12), (-w / 2 - 0.12, w / 2 + 0.12, -h / 2 - 0.12, -h / 2), (-w / 2 - 0.12, -w / 2, -h / 2, h / 2), (w / 2, w / 2 + 0.12, -h / 2, h / 2)):
        out.append(box(name + "Frame", x - 0.08, x, y + c, y + d, z + a, z + b_, M["gold"], 0.01))
    return out


add("club", *gilt("Founder", "founder", 1.5, 2.0, x0 - 0.01, G + 2.4, -3.2))
add("club", face("FounderPlate", 1.6, 0.34, x0 - 0.06, G + 1.05, -3.2, -PI / 2, signmat("founder_plate", 0.5)))
for z in (3.2, 12.0, -12.0):
    add("club", *gilt("Poster", "poster", 1.2, 1.6, x0 - 0.01, G + 2.2, z))
# the terrace's tables under parasols, a croquet set on the lawn
for z in (-7.0, -2.5, 6.5, 11.0):
    tx = 16.2
    add("terrace",
        cyl("TerraceTable", 0.5, 0.04, g(tx, G + 0.74, z), M["white"], 20),
        cyl("TerraceStem", 0.04, 0.74, g(tx, G, z), M["white"], 8),
        cyl("TerraceParasolPole", 0.035, 2.5, g(tx, G + 0.78, z), M["white"], 8),
        cyl("TerraceParasol", 1.3, 0.45, g(tx, G + 2.85, z), M["awning"], 16, r2=0.05),
        cyl("Teapot", 0.08, 0.13, g(tx + 0.15, G + 0.78, z - 0.1), M["white"], 10),
        cyl("Cake", 0.12, 0.1, g(tx - 0.15, G + 0.78, z + 0.1), M["pink"], 12))
    for a in (0.0, PI):
        add("terrace",
            box("Chair", tx + math.cos(a) * 0.8 - 0.22, tx + math.cos(a) * 0.8 + 0.22, G + 0.42, G + 0.47, z - 0.22, z + 0.22, M["white"], 0.02),
            box("ChairBack", tx + math.cos(a) * 1.0 - 0.03, tx + math.cos(a) * 1.0 + 0.03, G + 0.47, G + 0.95, z - 0.22, z + 0.22, M["white"], 0.02))
        for dx in (-0.18, 0.18):
            for dz in (-0.18, 0.18):
                add("terrace", rod("ChairLeg", (tx + math.cos(a) * 0.8 + dx, G, z + dz), (tx + math.cos(a) * 0.8 + dx, G + 0.42, z + dz), 0.015, M["white"]))
for k in range(6):
    hx_, hz_ = 15.4 + (k % 3) * 1.4, 2.0 + (k // 3) * 1.6
    add("terrace", torus("CroquetHoop", 0.15, 0.012, g(hx_, G + 0.02, hz_), M["white"], 12, 4, rot=(PI / 2, 0, 0.3)))
for k, m in enumerate((M["red"], M["navy"], M["yellow"])):
    add("terrace",
        rod("Mallet", (15.6 + k * 0.4, G + 0.02, 0.6), (15.9 + k * 0.4, G + 0.05, 1.5), 0.02, M["teak"]),
        cyl("MalletHead", 0.05, 0.22, g(15.53 + k * 0.4, G + 0.05, 0.4), m, 10, rot=(0, PI / 2, 0.3)),
        sphere("CroquetBall", 0.06, g(16.6 + k * 0.3, G + 0.06, 1.9 + k * 0.4), m, 10, 6))

for k, v in parts.items():
    print("GROUP", k, tris(v))
if LOOK:
    look("garden_club", g(18, 3, 0), 30, 20, 270, (1280, 720), 16, 30)
    look("garden_gate", g(-8.2, 1.5, 16.3), 6, 15, 180, (1280, 720), 16, 35)
for k, v in parts.items():
    save_part("garden_" + k, v)
