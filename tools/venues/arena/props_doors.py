"""The Grand Gala Arena's changing-room doors and the medical cabinet, modelled in place in game coordinates.

No locker rooms (2 November 2026, as the Aquatic Centre's since 31 October, the creator: "Remove the lockers and just put doors
within the wall"): the two changing-room doors stand flush in the stage's wall (z -16.13) at x -10.7 (GENTLEMEN) and +10.7 (LADIES),
where the game's floor plan has them (dist/spatial.mjs WALL_DOORS). Each is a stepped gold-leaf art deco frame round a French-polished
walnut door with a sunburst inlay in brass and a brass push plate, its deco plate over it, a little lit marquee over that, a crimson
mat in front, and a brass stanchion with a velvet rope either side. The leaf is its own object, `Door_A` (side -1) or `Door_B` (side
+1), its origin on its hinge at the doorway's outer edge; the game turns it about y by side * 1.35 * (how open), so it swings out
onto the deck (scene.mjs `lockerDoors`).

The medical cabinet at the medkit fixture (x -15.4, z 4.7), facing +x (the Aquatic Centre's, in ivory and gold): the game draws the
red kit at (-15.0, 0.95, 4.7) and hides it while carried, so the cabinet has an open niche with a ledge at y 0.77 for it.

    blender -b -P tools/venues/arena/props_doors.py [-- --look]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
FZ = FACE_Z
DX = DOORS_X
HALF, H = 0.62, 2.35
steel = sm("brass")
dark = sm("doorway_shadow", "#1a1410", 0.9)
white = sm("ivory")
navy = sm("navy")
gold = sm("gold")
leafgold = tmat_tile("goldleaf", "#d9ae4a", 0.35)
walnut = tmat_tile("walnut", "#5a3520", 0.35)
velvet = tmat_tile("velvet", "#8f1f32", 0.85)
rubber = sm("rubber")


def door(side):
    word = "GENTLEMEN" if side < 0 else "LADIES"
    X = lambda u: side * u  # noqa: E731
    cx = X(DX)
    parts = []
    parts.append(gbx("Opening", cx - HALF, cx + HALF, 0, H, FZ - 0.2, FZ + 0.01, dark, 0))
    for k, W in enumerate((0.12, 0.26)):  # the stepped deco frame
        for s in (-1, 1):
            a, b = cx + s * HALF, cx + s * (HALF + W)
            parts.append(gbx("Jamb", min(a, b), max(a, b), 0, H + W, FZ, FZ + 0.1 - k * 0.04, leafgold, 0.01))
        parts.append(gbx("Head", cx - HALF - W, cx + HALF + W, H, H + W, FZ, FZ + 0.1 - k * 0.04, leafgold, 0.01))
    # the plate, the marquee over it, the mat, the ropes
    py = H + 0.52
    parts.append(gbx("PlateBack", cx - 0.86, cx + 0.86, py - 0.22, py + 0.22, FZ, FZ + 0.03, gold, 0.01))
    parts.append(plane("Plate", 1.6, 0.344, g(cx, py, FZ + 0.035), signmat(word.lower(), 0.4), rot=(PI / 2, 0, 0)))
    parts.append(gbx("Marquee", cx - 0.7, cx + 0.7, py + 0.3, py + 0.5, FZ, FZ + 0.1, navy, 0.01))
    lit = join([sphere("Light_Bulb", 0.04, g(cx - 0.6 + k * 0.15, py + 0.4, FZ + 0.11), lamp_mat("door_bulb", "#ffe2a0", 5.0), 6, 4) for k in range(9)], "Light_Marquee")
    parts.append(gbx("Mat", cx - 0.75, cx + 0.75, 0.0, 0.015, FZ + 0.2, FZ + 1.15, sm("mat_crimson", "#7a1626", 0.9), 0.005))
    parts.append(gbx("MatEdge", cx - 0.72, cx + 0.72, 0.015, 0.018, FZ + 0.24, FZ + 1.11, gold, 0))
    for s in (-1, 1):
        sx = cx + s * (HALF + 0.55)
        parts.append(cyl("PostBase", 0.15, 0.04, g(sx, 0, FZ + 0.4), steel, 14))
        parts.append(cyl("Post", 0.03, 0.95, g(sx, 0.04, FZ + 0.4), steel, 10))
        parts.append(sphere("PostTop", 0.055, g(sx, 1.0, FZ + 0.4), steel, 10, 6))
        parts.append(poly_tube("Rope", [g(sx, 0.95, FZ + 0.4), g(sx, 0.7, FZ + 0.25), g(sx, 0.95, FZ + 0.06)], 0.025, velvet, 8, 0.1))
    # the leaf: walnut, a brass sunburst inlay, a push plate, a kick plate
    hinge_u = DX + HALF - 0.02
    lw, lt = 2 * HALF - 0.04, 0.05
    z0 = FZ + 0.012
    a, b = X(hinge_u), X(hinge_u - lw)
    leaf = [gbx("Leaf", min(a, b), max(a, b), 0.03, H - 0.01, z0, z0 + lt, walnut, 0.012)]
    vu = hinge_u - lw / 2
    for k in range(7):
        ang = PI * (k + 0.5) / 7
        r0, r1 = 0.08, 0.42
        p0 = (X(vu) + math.cos(ang) * r0, 1.25 + math.sin(ang) * r0)
        p1 = (X(vu) + math.cos(ang) * r1, 1.25 + math.sin(ang) * r1)
        leaf.append(tube("Ray", [g(p0[0], p0[1], z0 + lt + 0.004), g(p1[0], p1[1], z0 + lt + 0.004)], 0.012, gold, 1, 4))
    leaf.append(gbx("RayBase", min(X(vu - 0.45), X(vu + 0.45)), max(X(vu - 0.45), X(vu + 0.45)), 1.22, 1.26, z0 + lt, z0 + lt + 0.008, gold, 0.003))
    hu = hinge_u - lw + 0.14
    leaf.append(gbx("PushPlate", min(X(hu - 0.06), X(hu + 0.06)), max(X(hu - 0.06), X(hu + 0.06)), 1.0, 1.4, z0 + lt, z0 + lt + 0.006, steel, 0.003))
    a, b = X(hinge_u - 0.05), X(hinge_u - lw + 0.05)
    leaf.append(gbx("KickPlate", min(a, b), max(a, b), 0.05, 0.3, z0 + lt, z0 + lt + 0.006, steel, 0.003))
    for y in (0.35, 1.2, 2.05):
        leaf.append(cyl("Hinge", 0.018, 0.12, g(X(hinge_u + 0.01), y, z0 + lt / 2), steel, 10))
    leaf_o = join(leaf, "Door_A" if side < 0 else "Door_B")
    set_origin(leaf_o, g(X(hinge_u), 0, z0 + lt / 2))
    body = join([p for p in parts if p], "Doorway" + word)
    print(f"DOOR {word}: {tris([body])} triangles + leaf {tris([leaf_o])}, hinge at {tuple(round(v, 3) for v in (leaf_o.location.x, leaf_o.location.z, -leaf_o.location.y))}")
    return [body, lit, leaf_o]


def medkit_cabinet():
    """The medical cabinet at (x -15.4, z 4.7), facing +x: a lower cupboard, an open niche with a ledge at y 0.77 where the game's
    red kit sits (at x -15.0), an upper cupboard with the red cross and MEDIC, a little roof."""
    cx, cz = -15.4, 4.7
    x0, x1 = cx - 0.25, cx + 0.25  # -15.65 .. -15.15
    z0, z1 = cz - 0.75, cz + 0.75
    w = sm("ivory")
    red = sm("medic_red", "#d6423a", 0.4)
    green = sm("navy")
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
    p.append(gbx("Canopy", x0 - 0.04, x1 + 0.14, 2.06, 2.12, z0 - 0.05, z1 + 0.05, gold, 0.015))
    p.append(gbx("CanopyLip", x1 + 0.1, x1 + 0.14, 1.98, 2.06, z0 - 0.05, z1 + 0.05, red, 0.008))
    # a wall-mounted eyewash bottle and a small phone beside it
    p.append(bottle("Eyewash", sm("eyewash", "#5aa9d6", 0.3), white, 0.2, 0.035, g(cx + 0.33, 1.12, z1 - 0.2), 0))
    body = join(p, "MedkitCabinet")
    print(f"MEDKIT: {tris([body])} triangles; the niche's ledge at y 0.77 (x {x0 + 0.04:.2f}..{x1 + 0.32:.2f}), open to y 1.32")
    return [body]


objs = []
objs += door(-1)
objs += door(1)
objs += medkit_cabinet()
print("DOORS TOTAL", sum(tris([o]) for o in objs))
if LOOK:
    ctx = [gbx("PreviewWall", -17, 17, 0, 6, FZ - 0.4, FZ, sm("ivory"), 0), gbx("PreviewDeck", -17, 17, -0.05, 0, -17, 8, sm("ivory"), 0)]
    look("door_b", g(10.7, 1.6, -15.5), 6.5, 12, 20, (960, 640), 20, 32)
    look("medkit", g(-15.3, 1.0, 4.7), 3.6, 14, 62, (960, 640), 20, 35)
    for o in ctx:
        bpy.data.objects.remove(o)
save_part("doors", objs)
