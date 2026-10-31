"""The Sunset Lagoon's changing-room doors and the medical cabinet, modelled in place in game coordinates (Splash Park's script in
the beach house's materials).

No lockers (31 October 2026, the creator: "Remove the lockers and just put doors within the wall"): the two changing-room doors
stand flush in the beach house's front (z -16.12) at x -10.7 (MEN, teal) and +10.7 (WOMEN, coral), where the game's floor plan
has them (dist/spatial.mjs WALL_DOORS). Each is a doorway framed in dark timber with a carved lintel, a plank door painted in its
colour with a Z of battens, a rope pull and iron straps, a driftwood board over it with the word and its figure, a paper lantern
(`Light_Paper`) beside it and a clay pot of hibiscus. The leaf is its own object, `Door_A` (side -1) or `Door_B` (side +1), its
origin on the hinge at the doorway's outer edge, the leaf reaching toward the centre: the game turns it about y by
side * 1.35 * (how open), so it swings out onto the deck (scene.mjs `lockerDoors`).

The medical cabinet at the medkit fixture (x -15.4, z 4.7), facing +x, white with the red cross so it reads at once, under a
little thatched roof: the game draws the red kit at (-15.0, 0.95, 4.7) and hides it while carried, so the cabinet has an open
niche with a ledge at y 0.77 for it.

    blender -b -P tools/venues/lagoon/props_doors.py [-- --look]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()

FZ = -16.12  # the hotel's front
DX = 10.7  # the doorways' centres (dist/spatial.mjs RESORT doors.doorX)
HALF, H = 0.62, 2.35  # half the opening's width, the leaf's height (the arch rises over it)
stone = sm("timber_dark")
teak = sm("teak", "#b77b45", 0.5)
brass = sm("iron")
steel = sm("stainless")
dark = sm("doorway_shadow", "#2a2622", 0.9)
white = sm("timber_grey")


def semicircle(r, n=14):
    return [(r * math.cos(k * math.pi / n), r * math.sin(k * math.pi / n)) for k in range(n + 1)]


def door(side):
    word = "MEN" if side < 0 else "WOMEN"
    paint = sm("door_teal", "#2f9aa0", 0.38) if side < 0 else sm("door_coral", "#e0513f", 0.38)
    paint_dark = sm("door_teal_dark", "#1f6f78", 0.42) if side < 0 else sm("door_coral_dark", "#b94032", 0.42)
    X = lambda u: side * u  # noqa: E731  (u: distance from the centre line)
    cx = X(DX)
    parts = []
    # the doorway: a dark opening, dark timber posts and a lintel carved with zigzags, a fanlight of bamboo over the door
    parts.append(gbx("Opening", cx - HALF, cx + HALF, 0, H + 0.4, FZ, FZ + 0.01, dark, 0))
    parts.append(gbx("NightGlow_Fanlight", cx - HALF + 0.04, cx + HALF - 0.04, H + 0.03, H + 0.37, FZ + 0.011, FZ + 0.013, sm("night_window", "#ffc27a", 0.5), 0))
    for k in range(7):
        xx = cx - HALF + 0.1 + k * (2 * HALF - 0.2) / 6
        parts.append(cyl("FanBamboo", 0.018, 0.36, g(xx, H + 0.02, FZ + 0.03), sm("bamboo"), 6))
    W = 0.18
    for s_ in (-1, 1):
        parts.append(gbx("Jamb", cx + s_ * HALF, cx + s_ * (HALF + W), 0, H + 0.4, FZ, FZ + 0.12, stone, 0.02))
    parts.append(gbx("Lintel", cx - HALF - W - 0.12, cx + HALF + W + 0.12, H + 0.4, H + 0.66, FZ, FZ + 0.16, stone, 0.02))
    for k in range(9):
        xx = cx - HALF - 0.05 + k * (2 * HALF + 0.1) / 8
        parts.append(gbx("LintelCarve", xx - 0.035, xx + 0.035, H + 0.46, H + 0.6, FZ + 0.16, FZ + 0.175, sm("tiki_red") if k % 2 else sm("cream"), 0))
    parts.append(gbx("Step", cx - HALF - W - 0.08, cx + HALF + W + 0.08, 0, 0.05, FZ, FZ + 0.4, teak, 0.015))
    # the plaque over it: the word and its figure in cream on the door's colour, framed in white
    py = H + 0.66 + 0.32
    parts.append(gbx("PlaqueFrame", cx - 0.72, cx + 0.72, py - 0.24, py + 0.24, FZ + 0.1, FZ + 0.14, white, 0.012))
    parts.append(gbx("Plaque", cx - 0.66, cx + 0.66, py - 0.18, py + 0.18, FZ + 0.14, FZ + 0.155, paint, 0.006))
    cream = sm("plaque_cream", "#fff4dc", 0.45)
    parts.append(flat_text("PlaqueWord", word, 0.22, cream, g(cx + 0.14, py - 0.005, FZ + 0.158), 0, 0.004, "BarlowCondensed-Black"))
    parts.append(pictogram_3d("PlaqueFigure", "man" if side < 0 else "woman", 0.26, cream, g(cx - 0.47, py - 0.13, FZ + 0.158)))
    # the lantern on the corner side, and a pot of geraniums on the other
    lx = X(DX + HALF + W + 0.45)
    parts.append(gbx("LanternArm", lx - 0.03, lx + 0.03, 2.62, 2.68, FZ, FZ + 0.42, stone, 0.005))
    parts.append(cyl("LanternCord", 0.006, 0.2, g(lx, 2.44, FZ + 0.4), sm("rope"), 4))
    lamp = sphere("Light_Paper", 0.17, g(lx, 2.28, FZ + 0.4), lamp_mat("paper_glow", "#ffb070", 3.0), 12, 8, scale=(1, 1, 1.25))
    px = X(DX - HALF - W - 0.5)
    parts.append(cyl("Pot", 0.26, 0.42, g(px, 0, FZ + 0.45), sm("clay_pot", "#c97a52", 0.8), 12, r2=0.21))
    parts.append(cyl("PotRim", 0.28, 0.06, g(px, 0.4, FZ + 0.45), sm("terracotta_dark", "#a34c2c", 0.75), 12))
    import random as _r

    rr = _r.Random(5 + side)
    for k in range(9):
        a, d = rr.uniform(0, math.tau), rr.uniform(0, 0.22)
        parts.append(sphere("HibiscusLeaf" if k % 3 else "HibiscusFlower", 0.13 if k % 3 else 0.08, g(px + math.cos(a) * d, 0.55 + rr.uniform(0, 0.3), FZ + 0.45 + math.sin(a) * d), sm("leaf") if k % 3 else sm("hibiscus_red"), 7, 5))
    # the leaf: panelled, louvres above, a brass handle and kick plate; its origin on the hinge (the corner side)
    hinge_u = DX + HALF - 0.02
    lw, lt = 2 * HALF - 0.04, 0.05
    z0 = FZ + 0.012
    leaf = [gbx("Leaf", X(hinge_u), X(hinge_u - lw), 0.03, H + 0.3, z0, z0 + lt, paint, 0.008)]
    for k in range(1, 5):  # the planks' grooves
        u = hinge_u - k * lw / 5
        leaf.append(gbx("Groove", X(u) - 0.008, X(u) + 0.008, 0.05, H + 0.28, z0 + lt, z0 + lt + 0.004, paint_dark, 0))
    for y in (0.35, 2.15):
        leaf.append(gbx("Batten", X(hinge_u - 0.06), X(hinge_u - lw + 0.06), y, y + 0.12, z0 + lt, z0 + lt + 0.03, paint_dark, 0.008))
        leaf.append(gbx("Strap", X(hinge_u + 0.01), X(hinge_u - 0.5), y + 0.03, y + 0.09, z0 + lt + 0.03, z0 + lt + 0.04, brass, 0.004))
    leaf.append(tube("Brace", [g(X(hinge_u - 0.1), 0.5, z0 + lt + 0.015), g(X(hinge_u - lw + 0.1), 2.12, z0 + lt + 0.015)], 0.045, paint_dark, 1, 4))
    hu = hinge_u - lw + 0.12
    leaf.append(torus("Pull", 0.07, 0.014, g(X(hu), 1.15, z0 + lt + 0.03), sm("rope"), 12, 4, rot=(PI / 2, 0, 0)))
    leaf.append(gbx("PullPlate", X(hu - 0.04), X(hu + 0.04), 1.17, 1.27, z0 + lt, z0 + lt + 0.02, brass, 0.006))
    leaf_o = join(leaf, "Door_A" if side < 0 else "Door_B")
    set_origin(leaf_o, g(X(hinge_u), 0, z0 + lt / 2))
    body = join([p for p in parts if p], "Doorway" + word)
    print(f"DOOR {word}: {tris([body])} triangles + leaf {tris([leaf_o])}, hinge at {tuple(round(v, 3) for v in (leaf_o.location.x, leaf_o.location.z, -leaf_o.location.y))}")
    return [body, lamp, leaf_o]


def medkit_cabinet():
    """The medical cabinet at (x -15.4, z 4.7), facing +x: a lower cupboard, an open niche with a ledge at y 0.77 where the game's
    red kit sits (at x -15.0), an upper cupboard with the red cross and MEDIC, a little roof."""
    cx, cz = -15.4, 4.7
    x0, x1 = cx - 0.25, cx + 0.25  # -15.65 .. -15.15
    z0, z1 = cz - 0.75, cz + 0.75
    w = sm("medic_white", "#f7f4ec", 0.35)
    red = sm("medic_red", "#d6423a", 0.4)
    green = sm("medic_green", "#2f8c5a", 0.45)
    p = []
    p.append(gbx("Plinth", x0 + 0.02, x1 - 0.02, 0, 0.08, z0 + 0.02, z1 - 0.02, sm("charcoal"), 0.01))
    p.append(gbx("Lower", x0, x1, 0.08, 0.73, z0, z1, w, 0.025))
    for s_ in (-1, 1):  # two doors with handles
        za, zb = (z0 + 0.04, cz - 0.01) if s_ < 0 else (cz + 0.01, z1 - 0.04)
        p.append(gbx("LowerDoor", x1, x1 + 0.015, 0.12, 0.69, za, zb, w, 0.008))
        zh = cz + s_ * 0.08
        p.append(gbx("LowerHandle", x1 + 0.015, x1 + 0.04, 0.5, 0.62, zh - 0.012, zh + 0.012, steel, 0.005))
    # the niche: back, sides, roof, and the ledge that runs out to carry the kit
    p.append(gbx("NicheBack", x0, x0 + 0.05, 0.73, 1.32, z0, z1, w, 0.01))
    p.append(gbx("NicheBackPanel", x0 + 0.05, x0 + 0.06, 0.78, 1.28, z0 + 0.08, z1 - 0.08, green, 0.004))
    for zz in (z0, z1 - 0.06):
        p.append(gbx("NicheSide", x0, x1, 0.73, 1.32, zz, zz + 0.06, w, 0.01))
    p.append(gbx("Ledge", x0 + 0.04, x1 + 0.32, 0.73, 0.77, z0 + 0.06, z1 - 0.06, w, 0.012))
    p.append(gbx("LedgeLip", x1 + 0.28, x1 + 0.32, 0.77, 0.81, z0 + 0.08, z1 - 0.08, red, 0.006))
    for zz in (z0 + 0.12, z1 - 0.12):
        p.append(gbx("LedgeBracket", x1 - 0.02, x1 + 0.2, 0.6, 0.73, zz - 0.02, zz + 0.02, steel, 0.004))
    # a glazed frame round the niche's mouth
    for zz in (z0 + 0.06, z1 - 0.1):
        p.append(gbx("NicheFrame", x1 - 0.02, x1 + 0.01, 0.77, 1.32, zz, zz + 0.04, steel, 0.004))
    p.append(gbx("Upper", x0, x1, 1.32, 2.06, z0, z1, w, 0.025))
    p.append(gbx("UpperDoor", x1, x1 + 0.015, 1.36, 2.02, z0 + 0.04, z1 - 0.04, w, 0.008))
    # the red cross and the lettering, facing +x
    a_, b_ = 0.06, 0.18
    cross = [(-a_, -b_), (a_, -b_), (a_, -a_), (b_, -a_), (b_, a_), (a_, a_), (a_, b_), (-a_, b_), (-a_, a_), (-b_, a_), (-b_, -a_), (-a_, -a_)]
    # (drawn in the y-z plane, standing on the door's face and pushed out toward +x)
    p.append(extrude_shape("Cross", cross, 0.01, g(x1 + 0.015, 1.78, cz), red, rot=(PI / 2, 0, PI / 2)))
    p.append(flat_text("Medic", "MEDIC", 0.16, red, g(x1 + 0.027, 1.46, cz), PI / 2, 0.004, "BarlowCondensed-Black"))
    p.append(flat_text("FirstAid", "FIRST AID", 0.075, sm("charcoal"), g(x1 + 0.018, 0.33, cz), PI / 2, 0, "BarlowCondensed-Bold"))
    # a little canopy and a band round the top
    roof = cyl("Canopy", 1.0, 0.5, g(cx + 0.05, 2.06, cz), sm("thatch_dry"), 4, r2=0.05, rot=(0, 0, PI / 4))
    roof.scale = (0.55, 1.15, 1.0)
    apply_all(roof)
    p.append(roof)
    # a wall-mounted eyewash bottle and a small phone beside it
    p.append(bottle("Eyewash", sm("eyewash", "#5aa9d6", 0.3), sm("white_paint"), 0.2, 0.035, g(cx + 0.33, 1.12, z1 - 0.2), 0))
    body = join(p, "MedkitCabinet")
    print(f"MEDKIT: {tris([body])} triangles; the niche's ledge at y 0.77 (x {x0 + 0.04:.2f}..{x1 + 0.32:.2f}), open to y 1.32")
    return [body]


objs = []
objs += door(-1)
objs += door(1)
objs += medkit_cabinet()
total = sum(tris([o]) for o in objs)
print("DOORS TOTAL", total)

if LOOK:
    # a stand-in for the hotel's front and the deck, for the previews only (never saved)
    ctx = [
        gbx("PreviewFacade", -17, 17, 0, 6, FZ - 0.4, FZ, sm("bamboo"), 0),
        gbx("PreviewDeck", -17, 17, -0.05, 0, -17, 8, sm("timber"), 0),
    ]
    look("door_b", g(10.7, 1.6, -15.5), 6.5, 12, 20, (960, 640), 20, 32)
    look("door_a", g(-10.7, 1.6, -15.5), 6.5, 12, -20, (960, 640), 20, 32)
    door = bpy.data.objects["Door_B"]
    door.rotation_euler[2] = 1.35 * 0.7  # (a turn about the game's y is the same turn about Blender's z)
    look("door_b_open", g(10.7, 1.4, -15.0), 5.5, 30, -40, (960, 640), 20, 32)
    door.rotation_euler[2] = 0
    look("medkit", g(-15.3, 1.0, 4.7), 3.6, 14, 62, (960, 640), 20, 35)
    for o in ctx:
        bpy.data.objects.remove(o)
save_part("doors", objs)
