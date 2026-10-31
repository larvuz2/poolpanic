"""Splash Park's changing-room doors and the medical cabinet, modelled in place in game coordinates.

No cabanas and no lockers (31 October 2026, the creator: "I don't like lockers. Remove the lockers and just put doors within the
wall"): the two changing-room doors stand flush in the hotel's front (z -16.12) at x -10.7 (MEN, teal) and +10.7 (WOMEN, coral),
where the game's floor plan has them (dist/spatial.mjs RESORT doors, as the Community Pool's). Each is a round-headed stone
doorway with a dark fanlight that glows after dusk, a painted panelled door with louvres, a brass handle and a kick plate, a
plaque over it with the word and its figure, a lantern (`Light_Lantern`) beside it, a limestone step and a pot of geraniums.
The leaf is its own object, `Door_A` (side -1) or `Door_B` (side +1), its origin on the hinge at the doorway's outer edge (toward
the corner), the leaf reaching toward the centre: the game turns it about y by side * 1.35 * (how open), so it swings out onto
the deck (scene.mjs `lockerDoors`).

The medical cabinet at the medkit fixture (x -15.4, z 4.7), facing +x: the game draws the red kit at (-15.0, 0.95, 4.7) and hides
it while carried, so the cabinet has an open niche with a ledge at y 0.77 for it.

    blender -b -P tools/venues/splash/props_doors.py [-- --look]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()

FZ = -16.12  # the hotel's front
DX = 10.7  # the doorways' centres (dist/spatial.mjs RESORT doors.doorX)
HALF, H = 0.62, 2.35  # half the opening's width, the leaf's height (the arch rises over it)
stone = sm("limestone")
teak = sm("teak")
brass = sm("brass")
steel = sm("steel")
dark = sm("doorway_shadow", "#2a2622", 0.9)
white = sm("whitewash")


def semicircle(r, n=14):
    return [(r * math.cos(k * math.pi / n), r * math.sin(k * math.pi / n)) for k in range(n + 1)]


def door(side):
    word = "MEN" if side < 0 else "WOMEN"
    paint = sm("door_teal", "#2f9aa0", 0.38) if side < 0 else sm("door_coral", "#e0513f", 0.38)
    paint_dark = sm("door_teal_dark", "#1f6f78", 0.42) if side < 0 else sm("door_coral_dark", "#b94032", 0.42)
    X = lambda u: side * u  # noqa: E731  (u: distance from the centre line)
    cx = X(DX)
    parts = []
    # the doorway: a dark opening with a round head, a stone surround with a keystone, a step
    parts.append(gbx("Opening", cx - HALF, cx + HALF, 0, H, FZ, FZ + 0.01, dark, 0))
    parts.append(extrude_shape("OpeningHead", semicircle(HALF), 0.01, g(cx, H, FZ), dark, rot=(PI / 2, 0, 0)))
    parts.append(extrude_shape("FanlightBars", [(-HALF + 0.05, 0), (HALF - 0.05, 0), (HALF - 0.05, 0.04), (-HALF + 0.05, 0.04)], 0.02, g(cx, H - 0.02, FZ + 0.01), white, rot=(PI / 2, 0, 0)))
    for k in range(1, 4):
        a = k * math.pi / 4
        parts.append(tube("FanBar", [g(cx, H, FZ + 0.02), g(cx + math.cos(a) * (HALF - 0.04), H + math.sin(a) * (HALF - 0.04), FZ + 0.02)], 0.012, white, 1, 4))
    parts.append(extrude_shape("NightGlow_Fanlight", semicircle(HALF - 0.04), 0.002, g(cx, H + 0.01, FZ + 0.012), sm("night_window", "#ffcf8a", 0.5), rot=(PI / 2, 0, 0)))
    W = 0.2  # the surround's width
    for s in (-1, 1):
        parts.append(gbx("Jamb", cx + s * HALF, cx + s * (HALF + W), 0, H, FZ, FZ + 0.1, stone, 0.02))
    ring_ = [(HALF + W) * math.cos(k * math.pi / 14) for k in range(15)]
    outer = semicircle(HALF + W)
    inner = semicircle(HALF)
    bm = bmesh.new()
    vo = [bm.verts.new((x, y, 0)) for x, y in outer]
    vi = [bm.verts.new((x, y, 0)) for x, y in inner]
    for k in range(len(outer) - 1):
        bm.faces.new([vi[k], vi[k + 1], vo[k + 1], vo[k]])
    r_ = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    bmesh.ops.translate(bm, vec=(0, 0, 0.1), verts=[e for e in r_["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Arch")
    bm.to_mesh(me)
    bm.free()
    arch = bpy.data.objects.new("Arch", me)
    bpy.context.scene.collection.objects.link(arch)
    arch.rotation_euler = (PI / 2, 0, 0)
    arch.location = g(cx, H, FZ)
    set_mat(arch, stone)
    parts.append(arch)
    parts.append(gbx("Keystone", cx - 0.1, cx + 0.1, H + HALF - 0.04, H + HALF + W + 0.06, FZ, FZ + 0.13, stone, 0.015))
    parts.append(gbx("Step", cx - HALF - W - 0.08, cx + HALF + W + 0.08, 0, 0.06, FZ, FZ + 0.42, stone, 0.02))
    # the plaque over it: the word and its figure in cream on the door's colour, framed in white
    py = H + HALF + W + 0.5
    parts.append(gbx("PlaqueFrame", cx - 0.72, cx + 0.72, py - 0.24, py + 0.24, FZ, FZ + 0.04, white, 0.012))
    parts.append(gbx("Plaque", cx - 0.66, cx + 0.66, py - 0.18, py + 0.18, FZ + 0.04, FZ + 0.055, paint, 0.006))
    cream = sm("plaque_cream", "#fff4dc", 0.45)
    parts.append(flat_text("PlaqueWord", word, 0.22, cream, g(cx + 0.14, py - 0.005, FZ + 0.058), 0, 0.004, "BarlowCondensed-Black"))
    parts.append(pictogram_3d("PlaqueFigure", "man" if side < 0 else "woman", 0.26, cream, g(cx - 0.47, py - 0.13, FZ + 0.058)))
    # the lantern on the corner side, and a pot of geraniums on the other
    lx = X(DX + HALF + W + 0.45)
    parts.append(gbx("LanternBracket", lx - 0.03, lx + 0.03, 2.38, 2.44, FZ, FZ + 0.3, sm("iron"), 0.005))
    parts.append(cyl("LanternCap", 0.13, 0.08, g(lx, 2.66, FZ + 0.3), sm("iron"), 6, r2=0.03))
    parts.append(cyl("LanternBase", 0.1, 0.04, g(lx, 2.28, FZ + 0.3), sm("iron"), 6))
    lamp = cyl("Light_Lantern", 0.09, 0.34, g(lx, 2.32, FZ + 0.3), lamp_mat("lantern_glass", "#ffe2a8", 4.0), 6)
    px = X(DX - HALF - W - 0.5)
    parts.append(cyl("Pot", 0.26, 0.42, g(px, 0, FZ + 0.45), sm("clay_pot"), 16, r2=0.21))
    parts.append(cyl("PotRim", 0.28, 0.06, g(px, 0.4, FZ + 0.45), sm("terracotta_dark"), 16))
    import random as _r

    rr = _r.Random(5 + side)
    for k in range(9):
        a, d = rr.uniform(0, math.tau), rr.uniform(0, 0.2)
        parts.append(sphere("GeraniumLeaf" if k % 2 else "Geranium", 0.12 if k % 2 else 0.09, g(px + math.cos(a) * d, 0.55 + rr.uniform(0, 0.18), FZ + 0.45 + math.sin(a) * d), sm("leaf") if k % 2 else sm("coral"), 8, 6))
    # the leaf: panelled, louvres above, a brass handle and kick plate; its origin on the hinge (the corner side)
    hinge_u = DX + HALF - 0.02
    lw, lt = 2 * HALF - 0.04, 0.05
    z0 = FZ + 0.012
    leaf = [gbx("Leaf", X(hinge_u), X(hinge_u - lw), 0.03, H - 0.01, z0, z0 + lt, paint, 0.012)]
    for k in range(9):
        y = 1.45 + k * 0.08
        leaf.append(gbx("Louvre", X(hinge_u - 0.14), X(hinge_u - lw + 0.14), y, y + 0.045, z0 + lt, z0 + lt + 0.025, paint_dark, 0.004))
    leaf.append(gbx("Panel", X(hinge_u - 0.14), X(hinge_u - lw + 0.14), 0.35, 1.25, z0 + lt, z0 + lt + 0.015, paint_dark, 0.01))
    leaf.append(gbx("KickPlate", X(hinge_u - 0.05), X(hinge_u - lw + 0.05), 0.05, 0.25, z0 + lt, z0 + lt + 0.006, brass, 0.003))
    hu = hinge_u - lw + 0.12
    leaf.append(gbx("Handle", X(hu - 0.02), X(hu + 0.02), 1.0, 1.24, z0 + lt + 0.02, z0 + lt + 0.05, brass, 0.008))
    leaf.append(gbx("HandleRose", X(hu - 0.04), X(hu + 0.04), 1.05, 1.19, z0 + lt, z0 + lt + 0.02, brass, 0.006))
    for y in (0.35, 1.2, 2.05):
        leaf.append(cyl("Hinge", 0.018, 0.12, g(X(hinge_u + 0.01), y, z0 + lt / 2), brass, 10))
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
    p.append(gbx("Canopy", x0 - 0.04, x1 + 0.14, 2.06, 2.12, z0 - 0.05, z1 + 0.05, red, 0.015))
    p.append(gbx("CanopyLip", x1 + 0.1, x1 + 0.14, 1.98, 2.06, z0 - 0.05, z1 + 0.05, red, 0.008))
    # a wall-mounted eyewash bottle and a small phone beside it
    p.append(bottle("Eyewash", sm("eyewash", "#5aa9d6", 0.3), sm("whitewash"), 0.2, 0.035, g(cx + 0.33, 1.12, z1 - 0.2), 0))
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
        gbx("PreviewFacade", -17, 17, 0, 6, FZ - 0.4, FZ, sm("stucco"), 0),
        gbx("PreviewDeck", -17, 17, -0.05, 0, -17, 8, sm("travertine"), 0),
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
