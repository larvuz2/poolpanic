"""Senior Aqua Fit's dressing: the edge of play, every piece against the walls and the glass, in the strips between the deck and
the walls, in the furniture's own boxes, and up on the columns, never where the guests walk or wait (kit.PLAN):
- the back wall as a Victorian salon hang, bay by bay between the pilasters: TODAY'S MOVES on a chalkboard over an aspidistra; the
  slippers' corner (a bench, a rack of slippers in pairs and one pair of flippers, a coat stand with a sun hat, a cardigan and a
  handbag, the sign); the station clock (it is always time for aqua fit); the lost property cabinet (one flipper, a set of dentures
  in a glass, reading glasses, a hearing aid, a knitted cap, a toupee, a rubber duck) under the founder's portrait in its gilt frame
  with her plate, a picture light and a half-moon table of roses and her own flowered cap under a glass dome; the penny scale (the
  HONEST scale); the umbrella stand; the conservatory rules under six photographs of the club; ZIMMER PARKING (four walking frames
  with tennis-ball feet, a basket, a bicycle horn, a garland, a learner's L); the bingo console (the cage, its balls, the cards, the
  dabbers) under the AQUA BINGO sign and a shield of crossed flippers; TODAY'S PROGRAMME over a fern; a brass sconce on every
  pilaster;
- the glass end: fern stands, the canary in its cage, QUIET PLEASE on an easel by the loungers, the CAP OF THE WEEK (Doris, again)
  on an easel with the cap itself, a hamper of towels, a watering can, a stack of pots; geraniums and orchids in pots along the sills;
- the far glass: pots along the sill; hanging baskets of ferns and geraniums on every column, far side and end;
- the near wall: terracotta troughs of geraniums and lavender along its cap;
- the spa's corners: a stool of towels with a rubber duck, the HYDROTHERAPY board, a bucket of ducks;
- the big plants: a tall fan palm in a blue-and-white jardiniere at the end, a Boston fern on a pedestal by the near wall.

    blender -b -P tools/venues/senior/props_decor.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(1926)
TAU = 2 * PI
M = dict(
    mahog=tmat_tile("teak", "#5b2c1a", 0.45, tint="#7a4a36"),
    teak=tmat_tile("teak", "#b57a43", 0.55),
    marble=tmat_tile("marble", "#f2eee6", 0.2),
    brass=sm("brass"),
    brass_dark=sm("brass_dark"),
    gold=sm("gold"),
    iron=sm("iron"),
    iron_dark=sm("iron_dark"),
    emerald=sm("emerald"),
    velvet=sm("velvet"),
    cream=sm("cream"),
    white=sm("white"),
    porcelain=sm("porcelain"),
    blue=sm("porcelain_blue"),
    navy=sm("navy"),
    red=sm("tartan"),
    rose=sm("rose"),
    rose_pale=sm("rose_pale"),
    mint=sm("mint"),
    lemon=sm("lemon"),
    sky=sm("sky"),
    peach=sm("peach"),
    lavender=sm("lavender"),
    black=sm("black"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    rubber=sm("rubber"),
    towel=sm("towel"),
    paper=sm("paper"),
    felt=sm("felt"),
    wicker=sm("wicker"),
    terracotta=sm("terracotta"),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    tea=sm("tea"),
    wool_p=sm("wool_pink"),
    wool_b=sm("wool_blue"),
    wool_y=sm("wool_yellow"),
    chalk=sm("chalkboard", "#26302c", 0.9),
    glass=sm("bottle_glass", "#9fd0c4", 0.08),
    dome=sm("dome_glass", "#e9f5f2", 0.04),
    tennis=sm("tennis_ball", "#d8e85a", 0.85),
    duck=sm("duck_yellow", "#ffd23f", 0.4),
    beak=sm("duck_beak", "#f28c28", 0.5),
    canary=sm("canary", "#ffe14a", 0.6),
    toupee=sm("toupee", "#6b4a2e", 0.95),
    teeth=sm("teeth", "#fbf6e8", 0.2),
    gum=sm("gum", "#e58a96", 0.4),
    sheep=sm("sheepskin", "#efe3cc", 0.95),
    fin_a=sm("fin_rose", "#e8829a", 0.5),
    fin_b=sm("fin_mint", "#7fcfb0", 0.5),
    soil=sm("soil", "#4a3426", 0.95),
    orchid=sm("orchid", "#f3d9ef", 0.5),
    orchid_lip=sm("orchid_lip", "#c0569a", 0.5),
    shade=lamp_mat("lamp_silk", "#f6e3bd", 3.0),
    tulip=lamp_mat("lamp_tulip", "#fff1d6", 3.5),
    fern=cutmat("fern", 0.7),
    frond=cutmat("palm_frond", 0.6),
    geranium=cutmat("geranium", 0.7),
    lavender_c=cutmat("lavender", 0.8),
    roses=cutmat("roses", 0.7),
    zimmer=cutmat("zimmer", 0.6),
)
parts = {}
trees.use({"frond": M["frond"]})


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


lb = box


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def yawed(objs, x, z, yaw, name):
    o = join([q for q in objs if q], name)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (0, 0, yaw)
    o.location = g(x, 0, z)
    apply_all(o)
    return o


def place(o, x, y, z, turn=0.0, rx=0.0, ry=0.0):
    """Turn an object built about the local origin (rx, ry, then turn about the vertical) and move it to game (x, y, z)."""
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (rx, ry, turn)
    o.location = g(x, y, z)
    apply_all(o)
    return o


# yaw that turns local +z (the front) toward the game's -x, +x, -z, +z
TO_MX, TO_PX, TO_MZ, TO_PZ = -PI / 2, PI / 2, PI, 0.0
ZW = WALL["back"]  # the back wall's face (local z 0 of the back wall's pieces)
ZE = WALL["end"] - 0.16  # the glass end's dwarf wall, inner face
XF = WALL["far"] - 0.16  # the far side's dwarf wall, inner face
XN = WALL["near"] + 0.16  # the near side's low wall, inner face


def front(img, w, h, y, z, x=0.0, rough=0.5):
    """A picture facing local +z at local (x, y, z)."""
    return plane("Pic", w, h, g(x, y, z + 0.003), signmat(img, rough))


def disc_pic(name, r, img, x, y, z, segs=32):
    """A round picture (a clock's dial) facing local +z: a fan of triangles, its UVs the picture's square."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    c = bm.verts.new(g(x, y, z))
    ring = [bm.verts.new(g(x + math.cos(a) * r, y + math.sin(a) * r, z)) for a in [k * TAU / segs for k in range(segs)]]
    for k in range(segs):
        f = bm.faces.new([c, ring[k], ring[(k + 1) % segs]])
        for l in f.loops:
            p = l.vert.co
            l[uv].uv = ((p.x - x) / (2 * r) + 0.5, (p.z - y) / (2 * r) + 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(signmat(img, 0.3))
    for poly in o.data.polygons:
        if poly.normal.y > 0:  # (face the game's +z: Blender -y)
            poly.flip()
    return o


def gilt_frame(w, h, x, y, z, t=0.08, d=0.06, m=None, rosettes=True):
    """A frame round a w x h picture centred at local (x, y), its front at local z + d: four moulded bars, a bead inside, a
    rosette at each corner."""
    m = m or M["gold"]
    out = []
    for x0, x1, y0, y1 in ((-w / 2 - t, w / 2 + t, h / 2, h / 2 + t), (-w / 2 - t, w / 2 + t, -h / 2 - t, -h / 2), (-w / 2 - t, -w / 2, -h / 2, h / 2), (w / 2, w / 2 + t, -h / 2, h / 2)):
        out.append(lb("Frame", x + x0, x + x1, y + y0, y + y1, z, z + d, m, min(0.02, t * 0.3)))
    for x0, x1, y0, y1 in ((-w / 2, w / 2, h / 2 - 0.012, h / 2), (-w / 2, w / 2, -h / 2, -h / 2 + 0.012), (-w / 2, -w / 2 + 0.012, -h / 2, h / 2), (w / 2 - 0.012, w / 2, -h / 2, h / 2)):
        out.append(lb("FrameBead", x + x0, x + x1, y + y0, y + y1, z, z + d * 0.6, M["brass_dark"], 0.0))
    if rosettes:
        for sx in (-1, 1):
            for sy in (-1, 1):
                out.append(sphere("Rosette", t * 0.55, g(x + sx * (w / 2 + t / 2), y + sy * (h / 2 + t / 2), z + d), m, 8, 5, scale=(1, 0.5, 1)))
    out.append(lb("FrameBack", x - w / 2, x + w / 2, y - h / 2, y + h / 2, z, z + 0.01, M["mahog"], 0.0))
    return out


def framed_pic(img, w, h, x, y, z=0.0, t=0.07, d=0.05, m=None, rosettes=False):
    return gilt_frame(w, h, x, y, z, t, d, m, rosettes) + [front(img, w, h, y, z + 0.011, x)]


def pot(name, x, y, z, r, h, m, rim=None):
    """A flowerpot standing at game (x, y, z): tapered, a rolled rim, soil."""
    out = [cyl(name, r * 0.8, h, g(x, y, z), m, 14, r2=r)]
    out.append(torus(name + "Rim", r, 0.018 + r * 0.06, g(x, y + h, z), rim or m, 16, 5))
    out.append(cyl(name + "Soil", r * 0.92, 0.01, g(x, y + h - 0.03, z), M["soil"], 12))
    return out


def tuft(x, y, z, s, m, n=3, seed=0, lean=0.0):
    """Crossed cut-out cards of flowers or leaves, standing in a pot or a bed at game (x, y, z), s high."""
    r = random.Random(seed)
    out = []
    for k in range(n):
        a = k * PI / n + r.uniform(-0.2, 0.2)
        w = s * r.uniform(1.0, 1.3)
        o = plane("Tuft", w, s, g(x, y + s / 2, z), m, rot=(PI / 2 - lean, 0, a))
        out.append(o)
    return out


def fern_fountain(x, y, z, s, seed, n=10, droop=1.0):
    """A Boston fern: fronds arching out and down from a crown at game (x, y, z), s long."""
    r = random.Random(seed)
    out = []
    for k in range(n):
        a = k * TAU / n + r.uniform(-0.25, 0.25)
        out.append(trees.frond_card("Fern", Vector(g(x, y, z)), -a, math.radians(r.uniform(15, 45)), s * r.uniform(0.75, 1.05), s * 0.22, math.radians(r.uniform(50, 85) * droop), segs=4))
    for o in out:
        set_mat(o, M["fern"])
    return out


def trail(x, y, z, length, seed, n=5, m=None):
    """Trailing cards hanging from a basket's rim at game (x, y, z): ivy and fern spilling down."""
    r = random.Random(seed)
    out = []
    for k in range(n):
        a = k * TAU / n + r.uniform(-0.3, 0.3)
        L = length * r.uniform(0.6, 1.0)
        px, pz = x + math.cos(a) * 0.2, z + math.sin(a) * 0.2
        # (the frond's picture runs along its length: the card stood up, then turned in its own plane to hang)
        o = plane("Trail", L, 0.22, g(px, y - L / 2, pz), m or M["fern"], rot=(PI / 2, PI / 2, -a + PI / 2))
        out.append(o)
    return out


# ================================================================================================================================
# THE BACK WALL: a salon hang between the pilasters (x +-12.4, +-8.4, +-3.2), the doorway in the middle
# ================================================================================================================================

# ---- the sconces: a brass arm and a tulip of frosted glass on every pilaster ------------------------------------------------------
for x in (-12.4, -8.4, -3.2, 3.2, 8.4, 12.4):
    sc = [lb("SconcePlate", x - 0.09, x + 0.09, 2.55, 2.85, ZW + 0.16, ZW + 0.19, M["brass"], 0.01)]
    sc.append(tube("SconceArm", [Vector(g(x, 2.62, ZW + 0.19)), Vector(g(x, 2.55, ZW + 0.36)), Vector(g(x, 2.72, ZW + 0.46))], 0.018, M["brass"], 3, 6))
    sc.append(cyl("SconceCup", 0.05, 0.05, g(x, 2.7, ZW + 0.46), M["brass"], 10))
    sc.append(cyl("Light_Sconce", 0.06, 0.2, g(x, 2.74, ZW + 0.46), M["tulip"], 12, r2=0.11))
    add("wall", *sc)

# ---- bay A (x -15.1 .. -12.7): TODAY'S MOVES on a chalkboard over an aspidistra on its pedestal (the plan's plant) ---------------
bay = []
bay.append(lb("ChalkFrame", -0.58, 0.58, 2.0, 3.45, 0.0, 0.05, M["mahog"], 0.015))
bay.append(front("moves", 1.0, 1.2, 2.72, 0.05))
bay.append(lb("ChalkLedge", -0.55, 0.55, 1.97, 2.02, 0.0, 0.1, M["mahog"], 0.008))
for k, c in enumerate(("white", "rose", "lemon")):
    bay.append(cyl("Chalk", 0.008, 0.07, g(-0.3 + k * 0.1, 2.035, 0.06), M[c], 6, rot=(0, PI / 2, 0)))
bay.append(lb("Duster", 0.2, 0.36, 2.02, 2.07, 0.03, 0.09, M["felt"], 0.01))
add("wall", yawed(bay, -13.75, ZW, TO_PZ, "MovesBoard"))
PL = [f for f in FURNITURE if f["kind"] == "plant"]


def pedestal_plant(f, kind, seed, h=0.95):
    """A mahogany pedestal (fluted, a marble top) with a blue-and-white jardiniere: an aspidistra or a Boston fern."""
    x, z = f["x"], f["z"]
    out = [cyl("PedFoot", 0.3, 0.08, g(x, 0, z), M["mahog"], 16, r2=0.26)]
    out.append(cyl("PedColumn", 0.13, h - 0.16, g(x, 0.08, z), M["mahog"], 12, r2=0.11))
    for k in range(8):
        a = k * TAU / 8
        out.append(box("PedFlute", x + math.cos(a) * 0.12 - 0.01, x + math.cos(a) * 0.12 + 0.01, 0.2, h - 0.2, z + math.sin(a) * 0.12 - 0.01, z + math.sin(a) * 0.12 + 0.01, M["mahog"], 0.0))
    out.append(cyl("PedTop", 0.28, 0.06, g(x, h - 0.08, z), M["marble"], 16))
    jar = trees.lathe("Jardiniere", [(0.16, 0), (0.22, 0.05), (0.26, 0.18), (0.24, 0.3), (0.27, 0.34), (0.25, 0.36)], 18, M["porcelain"], g(x, h - 0.02, z))
    out.append(jar)
    for yy in (0.08, 0.26):
        out.append(torus("JarBand", 0.255 if yy > 0.2 else 0.235, 0.012, g(x, h - 0.02 + yy, z), M["blue"], 18, 4))
    out.append(cyl("JarSoil", 0.24, 0.01, g(x, h + 0.3, z), M["soil"], 14))
    top = h + 0.32
    if kind == "fern":
        out += fern_fountain(x, top, z, 0.85, seed, 14)
    else:  # an aspidistra: tall dark blades, upright and arching
        r = random.Random(seed)
        for k in range(11):
            a = k * TAU / 11 + r.uniform(-0.2, 0.2)
            out.append(trees.frond_card("Aspidistra", Vector(g(x, top, z)), -a, math.radians(r.uniform(8, 25)), r.uniform(0.7, 0.95), 0.16, math.radians(r.uniform(25, 50)), segs=4))
        for o in out[-11:]:
            set_mat(o, M["leaf_dark"])
    return out


add("plants", *pedestal_plant(PL[0], "aspidistra", 3, 0.75))

# ---- bay B (x -12.1 .. -8.7): the slippers' corner, the coat stand; the station clock up high -----------------------------------
XB = -10.4
sl = []
# the bench: teak slats on brass-capped mahogany legs
for x in (-0.65, 0.85):
    sl.append(lb("SlipBenchLeg", x - 0.04, x + 0.04, 0, 0.42, 0.08, 0.44, M["mahog"], 0.01))
for k in range(3):
    sl.append(lb("SlipBenchSlat", -0.75, 0.95, 0.42, 0.46, 0.08 + k * 0.125, 0.18 + k * 0.125, M["teak"], 0.01))
sl.append(lb("SlipBenchRail", -0.75, 0.95, 0.06, 0.1, 0.12, 0.4, M["mahog"], 0.005))
# a cardigan folded on it, a handbag, a pair of glasses on a chain
sl.append(towel_folded("Cardigan", 0.36, 0.28, 0.07, M["lavender"], M["cream"], g(-0.45, 0.46, 0.25), 0.1))
hb = [lb("Handbag", 0.25, 0.6, 0.46, 0.72, 0.16, 0.34, M["red"], 0.04)]
hb.append(tube("HandbagStrap", [Vector(g(0.3, 0.7, 0.25)), Vector(g(0.42, 0.88, 0.25)), Vector(g(0.55, 0.7, 0.25))], 0.012, M["mahog"], 3, 6))
hb.append(lb("HandbagClasp", 0.4, 0.45, 0.66, 0.71, 0.335, 0.345, M["gold"], 0.003))
sl += hb


def slipper(x, z, m, turn, pom=None, fluffy=False):
    """One slipper at local (x, z) on the floor (or a shelf at y): a rounded sole, a rolled collar, a pompom on the toe."""
    o = [lb("SlipperSole", -0.05, 0.05, 0.0, 0.025, -0.13, 0.13, M["rubber"], 0.02)]
    o.append(lb("SlipperUpper", -0.055, 0.055, 0.02, 0.085 if not fluffy else 0.1, -0.02, 0.13, m, 0.03))
    o.append(lb("SlipperHeel", -0.05, 0.05, 0.02, 0.06, -0.13, -0.05, m, 0.02))
    if pom:
        o.append(sphere("Pompom", 0.035, g(0, 0.09, 0.1), pom, 8, 6))
    return place(join(o, "Slipper"), x, 0, z, turn)


pairs = [("wool_p", "white", False), ("red", None, False), ("sheep", None, True), ("wool_b", "wool_y", False), ("navy", "red", False)]
for k, (m, pom, fl) in enumerate(pairs):
    x = -0.6 + k * 0.32
    for s in (-1, 1):
        sl.append(slipper(x + s * 0.065, 0.28 + 0.02 * s, M[m], R.uniform(-0.12, 0.12), M[pom] if pom else None, fl))
# the shoe rack at the bench's end: two shelves, three more pairs, and the flippers that should be on the other rack
for y in (0.12, 0.42):
    sl.append(lb("RackShelf", 1.08, 1.62, y, y + 0.025, 0.06, 0.4, M["mahog"], 0.005))
for x in (1.1, 1.6):
    sl.append(lb("RackSide", x - 0.02, x + 0.02, 0, 0.66, 0.06, 0.4, M["mahog"], 0.005))
for k, (m, pom) in enumerate((("rose_pale", "rose"), ("mint", None))):
    for s in (-1, 1):
        sh = slipper(1.22 + k * 0.26 + s * 0.06, 0.24, M[m], 0.0, M[pom] if pom else None)
        sl.append(place(sh, 0, 0.145, 0))
for s in (-1, 1):
    fl_ = [lb("FlipperFoot", -0.05, 0.05, 0.0, 0.06, -0.12, 0.02, M["rubber"], 0.02), lb("FlipperBlade", -0.09, 0.09, 0.0, 0.015, 0.0, 0.3, M["fin_a"], 0.006)]
    sl.append(place(join(fl_, "Flipper"), 1.35 + s * 0.11, 0.45, 0.12, 0.0, 0.25))
sl.append(lb("SlipSignBack", -0.85, 0.85, 1.4, 1.86, 0.0, 0.03, M["mahog"], 0.01))
sl.append(front("slippers", 1.6, 0.4, 1.63, 0.03))
# the coat stand: a turned mahogany pole, brass hooks, a straw sun hat, a cardigan, a striped towel, an umbrella hooked on
cx = -1.3
sl.append(cyl("CoatFoot", 0.24, 0.05, g(cx, 0, 0.3), M["mahog"], 12, r2=0.2))
for k in range(4):
    a = k * TAU / 4 + 0.4
    sl.append(rod("CoatLeg", (cx, 0.2, 0.3), (cx + math.cos(a) * 0.3, 0.0, 0.3 + math.sin(a) * 0.3), 0.018, M["mahog"], 5))
sl.append(cyl("CoatPole", 0.03, 1.75, g(cx, 0.05, 0.3), M["mahog"], 8))
sl.append(sphere("CoatKnob", 0.05, g(cx, 1.83, 0.3), M["mahog"], 8, 6))
for k in range(4):
    a = k * TAU / 4
    sl.append(rod("CoatHook", (cx, 1.66, 0.3), (cx + math.cos(a) * 0.17, 1.74, 0.3 + math.sin(a) * 0.17), 0.012, M["brass"], 5))
sl.append(cyl("SunHatBrim", 0.26, 0.015, g(cx + 0.06, 1.74, 0.36), M["wicker"], 18, rot=(0.35, 0, 0)))
sl.append(sphere("SunHatCrown", 0.11, g(cx + 0.06, 1.8, 0.33), M["wicker"], 12, 6, scale=(1, 1, 0.7)))
sl.append(torus("SunHatRibbon", 0.11, 0.015, g(cx + 0.06, 1.78, 0.34), M["rose"], 14, 4, rot=(0.35, 0, 0)))
sl.append(place(lb("CoatCardigan", -0.17, 0.17, 1.05, 1.68, -0.04, 0.05, M["wool_b"], 0.04), cx, 0, 0.3, -0.5))
sl.append(towel_hanging("CoatTowel", 0.3, 0.55, M["towel"], M["emerald"], g(cx - 0.15, 1.7, 0.18), 0.7))
add("wall", yawed(sl, XB, ZW, TO_PZ, "SlippersCorner"))
# the station clock: a brass bezel round its dial, high on the wall where everyone can see it is time for aqua fit
ck = [cyl("ClockCase", 0.5, 0.08, g(0, 3.95, 0.0), M["mahog"], 32, rot=(PI / 2, 0, 0))]
ck.append(torus("ClockBezel", 0.46, 0.035, g(0, 3.95, 0.085), M["brass"], 32, 6, rot=(PI / 2, 0, 0)))
ck.append(disc_pic("ClockDial", 0.44, "clock", 0, 3.95, 0.083))
ck.append(lb("ClockBracket", -0.06, 0.06, 3.35, 3.5, 0.0, 0.06, M["brass"], 0.01))
add("wall", yawed(ck, XB, ZW, TO_PZ, "StationClock"))

# ---- bay C (x -8.1 .. -3.5): the lost property cabinet, the founder's portrait and her plate; the ring board at -4.2 (stations) --
lp = []
LX0, LX1 = -0.5, 0.5  # (game x -7.85 .. -6.85)
for x0, x1, y0, y1, z0, z1 in ((LX0, LX1, 0, 0.08, 0.0, 0.42), (LX0, LX1, 1.5, 1.58, 0.0, 0.44), (LX0, LX0 + 0.05, 0, 1.5, 0.0, 0.42), (LX1 - 0.05, LX1, 0, 1.5, 0.0, 0.42), (LX0, LX1, 0, 1.5, 0.0, 0.03)):
    lp.append(lb("LostCase", x0, x1, y0, y1, z0, z1, M["mahog"], 0.01))
lp.append(lb("LostCornice", LX0 - 0.04, LX1 + 0.04, 1.56, 1.62, -0.0, 0.47, M["mahog"], 0.015))
for y in (0.45, 0.85, 1.2):
    lp.append(lb("LostShelf", LX0 + 0.05, LX1 - 0.05, y, y + 0.02, 0.03, 0.4, M["mahog"], 0.0))
# glazed doors: brass frames, glass
for s in (-1, 1):
    x0 = 0.0 if s > 0 else LX0 + 0.04
    x1 = LX1 - 0.04 if s > 0 else 0.0
    for a0, a1, b0, b1 in ((x0, x1, 0.1, 0.13), (x0, x1, 1.44, 1.47), (x0, x0 + 0.025, 0.1, 1.47), (x1 - 0.025, x1, 0.1, 1.47)):
        lp.append(lb("LostDoor", a0, a1, b0, b1, 0.41, 0.43, M["brass"], 0.003))
    lp.append(plane("Glass_Lost", x1 - x0 - 0.05, 1.31, g((x0 + x1) / 2, 0.785, 0.42), M["dome"]))
lp.append(sphere("LostKnob", 0.018, g(-0.03, 0.8, 0.44), M["brass"], 6, 4))
lp.append(sphere("LostKnob", 0.018, g(0.03, 0.8, 0.44), M["brass"], 6, 4))
lp.append(lb("LostSignBack", -0.46, 0.46, 1.62, 1.92, 0.12, 0.15, M["mahog"], 0.008))
lp.append(front("lost_property", 0.86, 0.27, 1.77, 0.15))
# the shelves' contents: a single flipper, dentures in a glass, glasses, a hearing aid, a knitted cap, a toupee, a rubber duck,
# a handbag with no owner, a walking stick lying across the bottom
fl_ = join([lb("LostFlipperFoot", -0.05, 0.05, 0.0, 0.06, -0.12, 0.02, M["rubber"], 0.02), lb("LostFlipperBlade", -0.09, 0.09, 0.0, 0.015, 0.0, 0.3, M["fin_b"], 0.006)], "LostFlipper")
lp.append(place(fl_, -0.22, 0.47, 0.22, 0.9))
lp.append(cyl("DentureGlass", 0.05, 0.13, g(0.22, 0.47, 0.22), M["glass"], 12))
for s in (-1, 1):
    lp.append(torus("Denture", 0.032, 0.012, g(0.22, 0.52 + s * 0.012, 0.22), M["gum"], 12, 5, rot=(0.2 * s, 0, 0)))
    lp.append(torus("DentureTeeth", 0.032, 0.008, g(0.22, 0.525 + s * 0.006, 0.225), M["teeth"], 12, 4, rot=(0.2 * s, 0, 0)))
for s in (-1, 1):
    lp.append(torus("LostGlasses", 0.035, 0.005, g(-0.1 + s * 0.04, 0.9, 0.3), M["black"], 12, 4, rot=(PI / 2, 0, 0)))
lp.append(rod("LostGlassesBridge", (-0.105, 0.9, 0.3), (-0.095, 0.9, 0.3), 0.004, M["black"], 4))
lp.append(sphere("HearingAid", 0.022, g(0.05, 0.89, 0.25), M["peach"], 8, 6, scale=(1, 1.4, 0.8)))
lp.append(sphere("KnitCap", 0.09, g(0.25, 0.87, 0.22), M["wool_p"], 12, 6, scale=(1, 1, 0.75)))
lp.append(sphere("KnitPom", 0.03, g(0.25, 0.95, 0.22), M["wool_y"], 8, 6))
lp.append(sphere("Toupee", 0.1, g(-0.2, 1.22, 0.22), M["toupee"], 10, 6, scale=(1, 0.9, 0.35)))
lp.append(sphere("LostDuck", 0.05, g(0.18, 1.27, 0.25), M["duck"], 10, 6))
lp.append(sphere("LostDuckHead", 0.032, g(0.21, 1.33, 0.25), M["duck"], 8, 6))
lp.append(cyl("LostDuckBeak", 0.012, 0.03, g(0.24, 1.33, 0.25), M["beak"], 6, rot=(0, PI / 2, 0)))
lp.append(lb("LostBag", -0.38, -0.08, 0.13, 0.36, 0.1, 0.3, M["emerald"], 0.03))
lp.append(rod("LostStick", (-0.42, 0.15, 0.36), (0.42, 0.15, 0.32), 0.012, M["mahog"], 6))
lp.append(torus("LostStickCrook", 0.05, 0.012, g(0.42, 0.2, 0.32), M["mahog"], 10, 4, rot=(PI / 2, 0, 0)))
add("wall", yawed(lp, -7.35, ZW, TO_PZ, "LostProperty"))
# the founder: Mrs. Edith Plumm in her gilt frame, a picture light, her plate; a half-moon table with roses and her cap under glass
fd = gilt_frame(1.2, 1.6, 0, 3.05, 0.0, 0.13, 0.08, M["gold"])
fd.append(front("founder", 1.2, 1.6, 3.05, 0.012))
fd.append(lb("PicLightArm", -0.03, 0.03, 3.9, 4.05, 0.0, 0.25, M["brass"], 0.005))
fd.append(cyl("Light_Sconce", 0.04, 0.6, g(-0.3, 4.0, 0.27), M["tulip"], 10, rot=(0, PI / 2, 0)))
fd.append(cyl("PicLightHood", 0.06, 0.66, g(-0.33, 4.03, 0.25), M["brass"], 12, rot=(0, PI / 2, 0)))
fd.append(lb("FounderPlateBack", -0.48, 0.48, 1.86, 2.06, 0.0, 0.02, M["mahog"], 0.004))
fd.append(front("founder_plate", 0.92, 0.18, 1.96, 0.02))
# the half-moon table: marble top on two gilt legs
hm = bmesh.new()
pts = [(math.cos(a) * 0.45, math.sin(a) * 0.28) for a in [k * PI / 16 for k in range(17)]]
vs = [hm.verts.new(g(x, 0.84, z)) for x, z in pts]
hm.faces.new(vs)
me = bpy.data.meshes.new("HalfMoon")
hm.to_mesh(me)
hm.free()
top = bpy.data.objects.new("HalfMoon", me)
bpy.context.scene.collection.objects.link(top)
top.data.materials.append(M["marble"])
so = top.modifiers.new("S", "SOLIDIFY")
so.thickness = 0.05
apply_all(top)
fd.append(top)
for x in (-0.28, 0.28):
    fd.append(rod("HalfMoonLeg", (x, 0.8, 0.18), (x * 0.9, 0.0, 0.2), 0.02, M["gold"], 6))
fd.append(lb("HalfMoonApron", -0.4, 0.4, 0.72, 0.8, 0.02, 0.06, M["gold"], 0.005))
# a vase of roses, her cap under a glass dome, a candle
fd.append(trees.lathe("Vase", [(0.05, 0), (0.08, 0.06), (0.07, 0.16), (0.04, 0.22), (0.055, 0.26)], 12, M["blue"], g(-0.25, 0.86, 0.14)))
fd += tuft(-0.25, 1.06, 0.14, 0.3, M["roses"], 3, 7)
fd.append(cyl("DomeBase", 0.12, 0.03, g(0.12, 0.86, 0.13), M["mahog"], 16))
fd.append(sphere("FounderCap", 0.075, g(0.12, 0.89, 0.13), M["white"], 12, 6, scale=(1, 1, 0.8)))
for k in range(7):
    a = k * TAU / 7
    fd.append(sphere("CapFlower", 0.022, g(0.12 + math.cos(a) * 0.055, 0.92 + 0.015 * (k % 2), 0.13 + math.sin(a) * 0.055), M["rose" if k % 2 else "lemon"], 6, 4))
fd.append(cyl("Glass_Dome", 0.105, 0.2, g(0.12, 0.89, 0.13), M["dome"], 16))
fd.append(sphere("Glass_DomeTop", 0.105, g(0.12, 1.09, 0.13), M["dome"], 16, 6, scale=(1, 1, 0.6)))
fd.append(cyl("Candlestick", 0.03, 0.03, g(0.33, 0.86, 0.12), M["brass"], 10))
fd.append(cyl("Candle", 0.014, 0.18, g(0.33, 0.89, 0.12), M["cream"], 8))
add("wall", yawed(fd, -5.75, ZW, TO_PZ, "Founder"))

# ---- bay D (x -2.9 .. -1.6): the penny scale, cast iron, red enamel; its dial reads HONEST ---------------------------------------
ps = [lb("ScaleStep", -0.24, 0.24, 0, 0.08, 0.02, 0.48, M["iron_dark"], 0.02)]
ps.append(lb("ScaleTread", -0.2, 0.2, 0.08, 0.09, 0.06, 0.44, M["rubber"], 0.0))
ps.append(lb("ScaleColumn", -0.1, 0.1, 0.08, 1.3, 0.06, 0.2, M["red"], 0.02))
ps.append(lb("ScaleTrim", -0.11, 0.11, 0.5, 0.54, 0.05, 0.21, M["gold"], 0.005))
ps.append(cyl("ScaleHead", 0.24, 0.12, g(0, 1.55, 0.06), M["red"], 28, rot=(PI / 2, 0, 0)))
ps.append(torus("ScaleBezel", 0.22, 0.02, g(0, 1.55, 0.19), M["gold"], 28, 5, rot=(PI / 2, 0, 0)))
ps.append(disc_pic("ScaleDial", 0.21, "scale_face", 0, 1.55, 0.184))
ps.append(sphere("ScaleCrest", 0.07, g(0, 1.83, 0.12), M["gold"], 10, 6, scale=(1.4, 0.6, 1)))
ps.append(lb("ScaleSlot", -0.04, 0.04, 1.15, 1.2, 0.2, 0.21, M["black"], 0.0))
add("wall", yawed(ps, -2.3, ZW, TO_PZ, "PennyScale"))

# ---- bay E (x 1.6 .. 2.9): the umbrella stand, two umbrellas (one floral), a walking stick, a parasol -----------------------------
us = [trees.lathe("UmbrellaStand", [(0.16, 0), (0.17, 0.05), (0.15, 0.3), (0.16, 0.55), (0.18, 0.6)], 16, M["porcelain"], g(0, 0, 0.25))]
for yy in (0.08, 0.5):
    us.append(torus("StandBand", 0.165, 0.012, g(0, yy, 0.25), M["blue"], 16, 4))
for k, (m, tilt, a) in enumerate(((M["navy"], 0.12, 0.4), (M["rose"], 0.16, 2.2), (M["red"], 0.1, 4.1))):
    tx, tz = math.cos(a) * 0.06, 0.25 + math.sin(a) * 0.06
    hx, hz = tx + math.cos(a) * tilt * 0.9, tz + math.sin(a) * tilt * 0.9
    us.append(cyl("UmbrellaFurl", 0.04, 0.55, g(tx, 0.35, tz), m, 8, r2=0.012))
    us.append(rod("UmbrellaShaft", (tx, 0.85, tz), (hx, 1.05, hz), 0.01, M["mahog"], 5))
    us.append(torus("UmbrellaCrook", 0.045, 0.012, g(hx + 0.04, 1.05, hz), M["mahog"], 10, 4, rot=(PI / 2, 0, a)))
us.append(rod("WalkingStick", (0.05, 0.05, 0.3), (0.12, 1.0, 0.36), 0.013, M["mahog"], 6))
us.append(sphere("StickKnob", 0.03, g(0.12, 1.02, 0.36), M["brass"], 8, 6))
add("wall", yawed(us, 2.25, ZW, TO_PZ, "UmbrellaStand"))

# ---- bay F (x 3.5 .. 8.1): the rules under six photographs; ZIMMER PARKING ---------------------------------------------------------
gf = framed_pic("rules", 0.78, 0.91, 0, 1.78, 0.0, 0.07, 0.05, M["mahog"])
for k in range(6):
    col, row = k % 3, k // 3
    gf += framed_pic("photo_%d" % (k + 1), 0.5, 0.5, -0.95 + col * 0.95, 2.72 + row * 0.68, 0.0, 0.045, 0.035, M["gold"] if (k % 2) else M["mahog"])
add("wall", yawed(gf, 5.8, ZW, TO_PZ, "Gallery"))


def zimmer(x, extra):
    """A walking frame parked facing out of the wall (local +z), tennis balls on its back feet, and its owner's touch."""
    z = []
    for sx in (-1, 1):
        z.append(rod("ZimLeg", (sx * 0.26, 0.04, 0.12), (sx * 0.24, 0.84, 0.18), 0.014, M["chrome"], 6))
        z.append(rod("ZimLeg", (sx * 0.26, 0.04, 0.5), (sx * 0.24, 0.84, 0.42), 0.014, M["chrome"], 6))
        z.append(rod("ZimSide", (sx * 0.24, 0.84, 0.18), (sx * 0.24, 0.84, 0.42), 0.014, M["chrome"], 6))
        z.append(rod("ZimBrace", (sx * 0.255, 0.3, 0.13), (sx * 0.255, 0.3, 0.49), 0.01, M["chrome"], 5))
        z.append(lb("ZimGrip", sx * 0.24 - 0.022, sx * 0.24 + 0.022, 0.82, 0.86, 0.22, 0.38, M["rubber"], 0.015))
        z.append(sphere("TennisBall", 0.035, g(sx * 0.26, 0.035, 0.12), M["tennis"], 10, 6))
        z.append(cyl("ZimFoot", 0.02, 0.03, g(sx * 0.26, 0.0, 0.5), M["rubber"], 8))
    z.append(rod("ZimFront", (-0.25, 0.7, 0.13), (0.25, 0.7, 0.13), 0.014, M["chrome"], 6))
    if extra == "basket":
        z.append(lb("ZimBasket", -0.18, 0.18, 0.52, 0.72, 0.06, 0.13, M["wicker"], 0.02))
        z.append(sphere("ZimKnitting", 0.06, g(0.05, 0.7, 0.1), M["wool_p"], 8, 6))
    elif extra == "horn":
        z.append(cyl("HornBulb", 0.035, 0.06, g(0.24, 0.86, 0.18), M["black"], 8, r2=0.03))
        z.append(cyl("HornBell", 0.012, 0.12, g(0.24, 0.9, 0.18), M["brass"], 8, rot=(PI / 2, 0, 0), r2=0.04))
    elif extra == "garland":
        for k in range(9):
            t = k / 8
            z.append(sphere("GarlandFlower", 0.025, g(-0.25 + t * 0.5, 0.7 - 0.04 * math.sin(t * PI), 0.12), M["rose" if k % 2 else "lemon"], 6, 4))
    elif extra == "learner":
        z.append(lb("LPlate", -0.1, 0.1, 0.55, 0.75, 0.115, 0.125, M["white"], 0.005))
        z.append(lb("LPlateL", -0.05, -0.02, 0.58, 0.72, 0.125, 0.13, M["red"], 0.0))
        z.append(lb("LPlateL", -0.05, 0.05, 0.58, 0.61, 0.125, 0.13, M["red"], 0.0))
    return place(join(z, "Zimmer"), x, 0, 0)


zp = [zimmer(x, e) for x, e in ((-1.45, "basket"), (-0.5, "horn"), (0.5, "garland"), (1.45, "learner"))]
# the parking bays: yellow lines on the floor between the frames
for x in (-1.93, -0.97, 0.0, 0.97, 1.93):
    zp.append(lb("BayLine", x - 0.025, x + 0.025, 0.0, 0.006, 0.04, 0.7, M["lemon"], 0.0))
add("wall", yawed(zp, 5.8, ZW, TO_PZ, "ZimmerParking"))
# ZIMMER PARKING painted on the deck in front of the bays, reading from the deck (its top toward the wall)
add("floorpaint", plane("ZimmerSign", 2.6, 0.65, g(5.8, 0.004, ZW + 1.25), M["zimmer"], rot=(0, 0, 0)))

# ---- bay G (x 8.7 .. 12.1): the bingo console under the AQUA BINGO sign and a shield of crossed flippers --------------------------
bg = []
for x in (-0.75, 0.75):
    for z in (0.06, 0.4):
        bg.append(lb("BingoLeg", x - 0.025, x + 0.025, 0, 0.78, z - 0.025, z + 0.025, M["mahog"], 0.005))
bg.append(lb("BingoTop", -0.82, 0.82, 0.78, 0.83, 0.02, 0.46, M["mahog"], 0.01))
bg.append(lb("BingoBaize", -0.75, 0.75, 0.83, 0.835, 0.06, 0.42, M["felt"], 0.0))
bg.append(lb("BingoShelf", -0.75, 0.75, 0.2, 0.23, 0.04, 0.44, M["mahog"], 0.005))
# the cage: two brass rings on an axle on two uprights, a crank
cxg = -0.35
for s in (-1, 1):
    bg.append(lb("CageUpright", cxg + s * 0.2 - 0.015, cxg + s * 0.2 + 0.015, 0.835, 1.15, 0.22, 0.26, M["brass"], 0.004))
    bg.append(torus("CageRing", 0.16, 0.008, g(cxg + s * 0.16, 1.1, 0.24), M["brass"], 18, 4, rot=(0, PI / 2, 0)))
for k in range(8):
    a = k * TAU / 8
    bg.append(rod("CageBar", (cxg - 0.16, 1.1 + math.sin(a) * 0.16, 0.24 + math.cos(a) * 0.16), (cxg + 0.16, 1.1 + math.sin(a) * 0.16, 0.24 + math.cos(a) * 0.16), 0.005, M["brass"], 4))
for k in range(9):
    bg.append(sphere("BingoBall", 0.025, g(cxg + R.uniform(-0.1, 0.1), 0.98 + R.uniform(0, 0.05), 0.24 + R.uniform(-0.06, 0.06)), M["white" if k % 3 else "rose"], 8, 6))
bg.append(rod("CageCrank", (cxg + 0.2, 1.1, 0.24), (cxg + 0.26, 1.1, 0.24), 0.008, M["brass"], 4))
bg.append(rod("CageCrankArm", (cxg + 0.26, 1.1, 0.24), (cxg + 0.26, 1.02, 0.28), 0.008, M["brass"], 4))
bg.append(cyl("CageHandle", 0.012, 0.06, g(cxg + 0.26, 1.02, 0.28), M["red"], 6, rot=(0, PI / 2, 0)))
# the called balls in their tray, the cards, the dabbers, a cup of tea
bg.append(lb("BallTray", 0.0, 0.4, 0.835, 0.86, 0.3, 0.42, M["mahog"], 0.004))
for k in range(6):
    bg.append(sphere("CalledBall", 0.022, g(0.04 + k * 0.064, 0.88, 0.36), M["white"], 8, 6))
for k in range(3):
    c = plane("BingoCard", 0.27, 0.18, g(0.2 + k * 0.03, 0.84 + k * 0.004, 0.17 - k * 0.02), signmat("bingo_card", 0.6), rot=(0, 0, 0.15 * k - 0.1 + PI))
    bg.append(c)
for k, m in enumerate(("red", "blue", "rose")):
    bg.append(cyl("Dabber", 0.022, 0.13, g(0.55 + k * 0.06, 0.835, 0.15), M[m], 10, r2=0.018))
bg.append(cyl("BingoCup", 0.04, 0.06, g(0.65, 0.835, 0.34), M["porcelain"], 10, r2=0.05))
bg.append(cyl("BingoSaucer", 0.07, 0.01, g(0.65, 0.835, 0.34), M["blue"], 12))
# the sign; above it the shield of crossed flippers
bg.append(lb("BingoSignBack", -0.8, 0.8, 1.3, 1.86, 0.0, 0.03, M["mahog"], 0.01))
bg.append(front("bingo", 1.5, 0.5, 1.58, 0.03))
sh = bmesh.new()
spts = [(-0.42, 3.4), (0.42, 3.4), (0.42, 2.95), (0.3, 2.6), (0.0, 2.42), (-0.3, 2.6), (-0.42, 2.95)]
vs = [sh.verts.new(g(x, y, 0.02)) for x, y in spts]
sh.faces.new(vs)
me = bpy.data.meshes.new("Shield")
sh.to_mesh(me)
sh.free()
shield = bpy.data.objects.new("Shield", me)
bpy.context.scene.collection.objects.link(shield)
shield.data.materials.append(M["mahog"])
so = shield.modifiers.new("S", "SOLIDIFY")
so.thickness = 0.04
bpy.context.view_layer.objects.active = shield
bpy.ops.object.modifier_apply(modifier="S")
bg.append(shield)
for s, m in ((-1, M["fin_a"]), (1, M["fin_b"])):
    # (built lying along local z, stood up flat against the shield, then turned in the shield's plane to cross the other)
    f_ = join([lb("TrophyFoot", -0.05, 0.05, -0.02, 0.04, -0.3, -0.16, M["rubber"], 0.02), lb("TrophyBlade", -0.1, 0.1, -0.012, 0.012, -0.16, 0.28, m, 0.006)], "TrophyFlipper")
    f_ = place(f_, 0, 0, 0, 0.0, -PI / 2)
    bg.append(place(f_, 0, 2.95, 0.07, 0.0, 0.0, s * 0.6))
bg.append(lb("ShieldPlate", -0.18, 0.18, 2.62, 2.7, 0.06, 0.07, M["gold"], 0.003))
add("wall", yawed(bg, 10.4, ZW, TO_PZ, "BingoConsole"))

# ---- bay H (x 12.7 .. 15.1): TODAY'S PROGRAMME over a Boston fern on its pedestal (the plan's plant) ------------------------------
pg = framed_pic("programme", 0.95, 1.42, 0, 2.95, 0.0, 0.08, 0.05, M["emerald"])
pg.append(lb("ProgHeader", -0.6, 0.6, 3.74, 3.86, 0.0, 0.07, M["gold"], 0.01))
add("wall", yawed(pg, 13.8, ZW, TO_PZ, "Programme"))
add("plants", *pedestal_plant(PL[1], "fern", 5, 0.9))

# ---- the noodle basket by the moves board, in the strip by the wall ---------------------------------------------------------------
nb = [cyl("NoodleBasket", 0.24, 0.5, g(0, 0, 0.32), M["wicker"], 14, r2=0.27)]
for yy in (0.1, 0.4):
    nb.append(torus("BasketBand", 0.255 + yy * 0.05, 0.012, g(0, yy, 0.32), M["mahog"], 14, 4))
for k, (m, a, t) in enumerate((("rose", 0.3, 0.1), ("mint", 2.0, 0.14), ("lemon", 3.7, 0.08), ("sky", 5.0, 0.16), ("lavender", 1.2, 0.05))):
    bx_, bz_ = math.cos(a) * 0.1, 0.32 + math.sin(a) * 0.1
    nb.append(rod("Noodle", (bx_, 0.1, bz_), (bx_ + math.cos(a) * t, 1.45, bz_ + math.sin(a) * t), 0.04, M[m], 8))
for k, m in enumerate(("sky", "rose")):
    db = [cyl("DumbBar", 0.015, 0.2, g(-0.1, 0, 0), M["white"], 6, rot=(0, PI / 2, 0))]
    for s in (-1, 1):
        db.append(cyl("DumbBell", 0.05, 0.06, g(-0.13 if s < 0 else 0.07, 0, 0), M[m], 10, rot=(0, PI / 2, 0)))
    nb.append(place(join(db, "Dumbbell"), 0.42 + k * 0.05, 0.05, 0.3 + k * 0.13, 0.4 * k))
add("wall", yawed(nb, -12.95, ZW + 0.05, TO_PZ, "NoodleBasket"))

# ================================================================================================================================
# THE GLASS END (z 13.4): the strip between the deck and the sill, and the sill itself; local +z faces the pool (yaw pi)
# ================================================================================================================================


def fern_stand(x):
    out = []
    for k in range(3):
        a = k * TAU / 3 + 0.5
        out.append(rod("StandLeg", (x + math.cos(a) * 0.2, 0.0, ZE - 0.28 + math.sin(a) * 0.2), (x + math.cos(a) * 0.1, 0.95, ZE - 0.28 + math.sin(a) * 0.1), 0.02, M["iron"], 6))
    out.append(torus("StandRing", 0.15, 0.012, g(x, 0.5, ZE - 0.28), M["iron"], 14, 4))
    out.append(cyl("StandTop", 0.18, 0.03, g(x, 0.95, ZE - 0.28), M["iron"], 14))
    out += pot("FernPot", x, 0.98, ZE - 0.28, 0.17, 0.2, M["terracotta"])
    out += fern_fountain(x, 1.15, ZE - 0.28, 0.65, int(x * 10) + 99, 12)
    return out


for x in (-9.7, 9.7):
    add("end", *fern_stand(x))


def easel(x, img, w, h, y0, extra=None):
    """A brass easel holding a board, leaning back against the glass, facing the pool (-z)."""
    e = []
    for sx in (-1, 1):
        e.append(rod("EaselLeg", (sx * (w / 2 - 0.05), 0.0, 0.22), (sx * 0.06, y0 + h + 0.15, 0.06), 0.016, M["brass"], 6))
    e.append(rod("EaselBack", (0, 0.0, -0.25), (0, y0 + h, 0.03), 0.014, M["brass"], 6))
    e.append(lb("EaselLedge", -w / 2, w / 2, y0 - 0.04, y0, 0.08, 0.2, M["brass"], 0.005))
    e.append(lb("EaselBoard", -w / 2 - 0.03, w / 2 + 0.03, y0 - 0.03, y0 + h + 0.03, 0.08, 0.12, M["mahog"], 0.01))
    e.append(front(img, w, h, y0 + h / 2, 0.12))
    if extra:
        e += extra
    o = place(join(e, "Easel"), 0, 0, 0, 0.0, -0.08)  # (leaning back a little)
    o = yawed([o], x, ZE - 0.3, TO_MZ, "Easel")
    print("EASEL", x, [round(v, 2) for v in o.bound_box[0]], [round(v, 2) for v in o.bound_box[6]], tuple(round(v, 2) for v in o.location))
    return o


add("end", easel(-6.6, "nap", 1.0, 0.4, 0.95))
cap_extra = [sphere("CapOfWeek", 0.1, g(0.0, 1.77, 0.1), M["white"], 12, 6, scale=(1, 1, 0.8))]
for k in range(9):
    a = k * TAU / 9
    cap_extra.append(sphere("CapPetal", 0.03, g(math.cos(a) * 0.075, 1.81 + 0.02 * (k % 2), 0.1 + math.sin(a) * 0.075), M[("rose", "lemon", "lavender")[k % 3]], 6, 4))
cap_extra.append(lb("Rosette", -0.06, 0.06, 1.0, 1.12, 0.125, 0.13, M["navy"], 0.0))
add("end", easel(6.6, "cap_week", 0.56, 0.7, 0.98, cap_extra))

# the canary in its brass cage on a stand
bc = []
CX, CZ = -2.2, ZE - 0.3
bc.append(cyl("CageFoot", 0.2, 0.04, g(CX, 0, CZ), M["iron"], 14))
bc.append(cyl("CagePole", 0.025, 1.25, g(CX, 0.04, CZ), M["iron"], 8))
bc.append(cyl("CageFloor", 0.2, 0.04, g(CX, 1.28, CZ), M["brass"], 18))
for k in range(16):
    a = k * TAU / 16
    bc.append(tube("CageWire", [Vector(g(CX + math.cos(a) * 0.19, 1.31, CZ + math.sin(a) * 0.19)), Vector(g(CX + math.cos(a) * 0.19, 1.6, CZ + math.sin(a) * 0.19)), Vector(g(CX + math.cos(a) * 0.12, 1.78, CZ + math.sin(a) * 0.12)), Vector(g(CX, 1.84, CZ))], 0.004, M["brass"], 2, 4))
for yy in (1.45, 1.6):
    bc.append(torus("CageHoop", 0.19, 0.006, g(CX, yy, CZ), M["brass"], 18, 4))
bc.append(torus("CageHook", 0.04, 0.008, g(CX, 1.88, CZ), M["brass"], 10, 4, rot=(PI / 2, 0, 0)))
bc.append(rod("Perch", (CX - 0.15, 1.45, CZ), (CX + 0.15, 1.45, CZ), 0.007, M["mahog"], 5))
bc.append(sphere("Canary", 0.045, g(CX + 0.02, 1.5, CZ), M["canary"], 10, 6, scale=(1.3, 1, 1)))
bc.append(sphere("CanaryHead", 0.03, g(CX + 0.07, 1.55, CZ), M["canary"], 8, 6))
bc.append(cyl("CanaryBeak", 0.008, 0.02, g(CX + 0.1, 1.55, CZ), M["beak"], 5, rot=(0, PI / 2, 0)))
bc.append(lb("CanaryTail", CX - 0.1, CX - 0.04, 1.47, 1.5, CZ - 0.015, CZ + 0.015, M["canary"], 0.005))
bc.append(cyl("Seed", 0.035, 0.03, g(CX - 0.1, 1.32, CZ + 0.08), M["porcelain"], 8))
bc.append(sphere("CageBell", 0.02, g(CX + 0.1, 1.68, CZ), M["gold"], 6, 4))
add("end", *bc)
# the towel hamper: wicker, its lid up, folded towels in pastel stripes on it
hp = [lb("Hamper", -0.35, 0.35, 0.0, 0.5, -0.22, 0.22, M["wicker"], 0.04)]
hp.append(lb("HamperLid", -0.36, 0.36, 0.5, 0.55, -0.23, 0.23, M["wicker"], 0.03))
for k, (m, s) in enumerate((("towel", "rose"), ("mint", "white"), ("towel", "lemon"), ("lavender", "white"))):
    hp.append(towel_folded("HamperTowel", 0.42, 0.3, 0.07, M[m], M[s], g(R.uniform(-0.03, 0.03), 0.55 + k * 0.07, 0.0), R.uniform(-0.1, 0.1)))
add("end", yawed(hp, 2.3, ZE - 0.3, TO_MZ, "Hamper"))
# a watering can and a stack of pots by the trolley; a trowel; a second can by the gramophone
wc = [cyl("CanBody", 0.13, 0.26, g(0, 0, 0), M["emerald"], 14)]
wc.append(rod("CanSpout", (0.1, 0.06, 0), (0.36, 0.3, 0), 0.018, M["emerald"], 6))
wc.append(cyl("CanRose", 0.04, 0.04, g(0.36, 0.3, 0), M["brass"], 8, rot=(0, PI / 2 - 0.6, 0)))
wc.append(tube("CanHandle", [Vector(g(-0.12, 0.2, 0)), Vector(g(-0.05, 0.4, 0)), Vector(g(0.08, 0.27, 0))], 0.014, M["emerald"], 3, 6))
can = join(wc, "WateringCan")
for x, turn in ((-11.6, 2.6), (11.4, 0.4)):
    c = can.copy()
    c.data = can.data.copy()
    bpy.context.scene.collection.objects.link(c)
    c.rotation_euler = (0, 0, turn)
    c.location = g(x, 0, ZE - 0.3)
    apply_all(c)
    add("end", c)
bpy.data.objects.remove(can)
for k in range(4):
    add("end", *pot("StackPot", -10.9, k * 0.07, ZE - 0.25, 0.14, 0.16, M["terracotta"]))
add("end", rod("Trowel", (-10.6, 0.02, ZE - 0.4), (-10.3, 0.02, ZE - 0.35), 0.01, M["mahog"], 5), lb("TrowelBlade", -10.35, -10.2, 0.0, 0.01, ZE - 0.4, ZE - 0.33, M["steel"], 0.0))

# ---- the sills: pots of geraniums and orchids along the dwarf walls' brass caps (between the columns) -----------------------------
CAP_Y = 0.83


def sill_pot(x, z, kind, seed):
    out = pot("SillPot", x, CAP_Y, z, 0.11, 0.15, M["terracotta"] if kind != "orchid" else M["porcelain"])
    if kind == "geranium":
        out += tuft(x, CAP_Y + 0.12, z, 0.32, M["geranium"], 2, seed)
    elif kind == "lavender":
        out += tuft(x, CAP_Y + 0.12, z, 0.34, M["lavender_c"], 2, seed)
    else:  # an orchid: two leaves, a cane, a spray of moth blooms
        out.append(trees.frond_card("OrchidLeaf", Vector(g(x, CAP_Y + 0.14, z)), 0.3, math.radians(70), 0.2, 0.07, math.radians(20), segs=2))
        out.append(trees.frond_card("OrchidLeaf", Vector(g(x, CAP_Y + 0.14, z)), 3.4, math.radians(70), 0.2, 0.07, math.radians(20), segs=2))
        for o in out[-2:]:
            set_mat(o, M["leaf_dark"])
        out.append(tube("OrchidCane", [Vector(g(x, CAP_Y + 0.14, z)), Vector(g(x, CAP_Y + 0.55, z)), Vector(g(x + 0.12, CAP_Y + 0.62, z))], 0.004, M["leaf"], 3, 4))
        for k in range(5):
            t = k / 4
            px, py = x + 0.02 + t * 0.12, CAP_Y + 0.5 + math.sin(t * PI) * 0.1 - t * 0.04
            out.append(sphere("Orchid", 0.03, g(px, py, z), M["orchid"], 8, 4, scale=(1, 0.4, 1)))
            out.append(sphere("OrchidLip", 0.01, g(px, py - 0.01, z + 0.0), M["orchid_lip"], 6, 4))
    return out


kinds = ["geranium", "orchid", "geranium", "lavender"]
# the end: bay middles (9 bays of 3.36 m), two pots in each, none in front of the gramophone's or the fuse box's corner
EB = (WALL["far"] - WALL["near"]) / 9
for i in range(9):
    mid = WALL["near"] + EB * (i + 0.5)
    for k, d in enumerate((-0.6, 0.6)):
        add("sills", *sill_pot(mid + d, WALL["end"], kinds[(i + k) % 4], i * 7 + k))
FB = (WALL["end"] - WALL["back"]) / 9
for i in range(9):
    mid = WALL["back"] + FB * (i + 0.5)
    if abs(mid - FIXTURES["fuseBox"]["z"]) < 1.5 or abs(mid - FIXTURES["fishNet"]["z"]) < 1.0:
        continue
    add("sills", *sill_pot(WALL["far"], mid + 0.5, kinds[(i + 1) % 4], 100 + i))

# ---- the hanging baskets: a scrolled bracket on every column, a wire basket of fern and geraniums trailing --------------------------
def basket(px, pz, dx, dz, seed):
    """On the column at (px, pz), its bracket reaching (dx, dz) toward the pool."""
    bx_, bz_ = px + dx * 0.55, pz + dz * 0.55
    out = [rod("BasketBracket", (px + dx * 0.12, 3.75, pz + dz * 0.12), (bx_, 3.75, bz_), 0.016, M["iron"], 6)]
    out.append(rod("BasketStrut", (px + dx * 0.12, 3.45, pz + dz * 0.12), (px + dx * 0.4, 3.75, pz + dz * 0.4), 0.012, M["iron"], 5))
    out.append(torus("BasketScroll", 0.08, 0.01, g(px + dx * 0.25, 3.62, pz + dz * 0.25), M["iron"], 10, 4, rot=(PI / 2, 0, math.atan2(-dz, dx))))
    for k in range(3):
        a = k * TAU / 3
        out.append(rod("BasketChain", (bx_, 3.73, bz_), (bx_ + math.cos(a) * 0.2, 3.28, bz_ + math.sin(a) * 0.2), 0.004, M["iron_dark"], 4))
    out.append(sphere("BasketMoss", 0.21, g(bx_, 3.28, bz_), M["leaf_dark"], 10, 5, scale=(1, 1, 0.55)))
    out.append(torus("BasketRim", 0.22, 0.012, g(bx_, 3.28, bz_), M["iron_dark"], 14, 4))
    for k in range(6):
        a = k * TAU / 6
        out.append(tube("BasketRib", [Vector(g(bx_ + math.cos(a) * 0.22, 3.28, bz_ + math.sin(a) * 0.22)), Vector(g(bx_ + math.cos(a) * 0.16, 3.16, bz_ + math.sin(a) * 0.16)), Vector(g(bx_, 3.16 - 0.03, bz_))], 0.006, M["iron_dark"], 2, 4))
    out += trail(bx_, 3.3, bz_, 0.9, seed, 6, M["fern"])
    out += tuft(bx_, 3.26, bz_, 0.42, M["geranium"], 3, seed + 1)
    return out


for i in range(1, 9):
    z = WALL["back"] + FB * i
    add("baskets", *basket(WALL["far"], z, -1, 0, 200 + i))
for i in range(1, 9):
    x = WALL["near"] + EB * i
    add("baskets", *basket(x, WALL["end"], 0, -1, 300 + i))

# ================================================================================================================================
# THE NEAR WALL: terracotta troughs of geraniums and lavender along its brass cap (low: the camera looks over it)
# ================================================================================================================================


def trough(z0, z1, seed):
    out = [box("Trough", WALL["near"] - 0.13, WALL["near"] + 0.13, CAP_Y, CAP_Y + 0.2, z0, z1, M["terracotta"], 0.02)]
    out.append(box("TroughLip", WALL["near"] - 0.15, WALL["near"] + 0.15, CAP_Y + 0.17, CAP_Y + 0.21, z0 - 0.02, z1 + 0.02, M["terracotta"], 0.01))
    r = random.Random(seed)
    z = z0 + 0.2
    while z < z1 - 0.15:
        out += tuft(WALL["near"], CAP_Y + 0.16, z, r.uniform(0.25, 0.34), M["geranium" if r.random() < 0.6 else "lavender_c"], 2, r.randrange(999))
        z += r.uniform(0.32, 0.45)
    return out


for z0, z1, s in ((-14.4, -12.8, 1), (-11.6, -9.6, 2), (-0.9, 1.0, 3), (2.4, 4.0, 4), (6.6, 8.6, 5), (9.8, 11.6, 6)):
    add("near", *trough(z0, z1, s))

# ================================================================================================================================
# THE SPA'S CORNERS (its box: x -13.25 .. -10.15, z 6.45 .. 9.55): towels and a duck, the HYDROTHERAPY board, a bucket of ducks
# ================================================================================================================================
SP = next(f for f in FURNITURE if f["kind"] == "spa")


def duck(x, y, z, s=1.0, turn=0.0, m=None):
    d = [sphere("Duck", 0.07 * s, g(0, 0.05 * s, 0), m or M["duck"], 10, 6, scale=(1.25, 1, 0.85))]
    d.append(sphere("DuckHead", 0.045 * s, g(0.05 * s, 0.12 * s, 0), m or M["duck"], 8, 6))
    d.append(cyl("DuckBeak", 0.015 * s, 0.04 * s, g(0.09 * s, 0.115 * s, 0), M["beak"], 6, rot=(0, PI / 2, 0)))
    for s_ in (-1, 1):
        d.append(sphere("DuckEye", 0.007 * s, g(0.08 * s, 0.14 * s, s_ * 0.025 * s), M["black"], 4, 3))
    return place(join(d, "Duck"), x, y, z, turn)


sx0, sz0 = SP["x"] - 1.35, SP["z"] - 1.35  # the corner toward the near wall and the back
st = [cyl("StoolSeat", 0.2, 0.04, g(sx0, 0.42, sz0), M["wicker"], 14)]
for k in range(3):
    a = k * TAU / 3
    st.append(rod("StoolLeg", (sx0 + math.cos(a) * 0.15, 0.42, sz0 + math.sin(a) * 0.15), (sx0 + math.cos(a) * 0.2, 0.0, sz0 + math.sin(a) * 0.2), 0.016, M["mahog"], 5))
for k, m in enumerate(("towel", "rose_pale", "mint")):
    st.append(towel_folded("SpaTowel", 0.32, 0.26, 0.06, M[m], M["white"] if k else M["emerald"], g(sx0, 0.46 + k * 0.06, sz0), 0.2 * k))
st.append(duck(sx0 + 0.02, 0.64, sz0, 1.2, 0.8))
add("spa", *st)
# the HYDROTHERAPY board, double-sided on a brass stand, in the corner by the near wall and the end
hy = [rod("HydroPost", (0, 0.0, 0), (0, 1.2, 0), 0.022, M["brass"], 8)]
hy.append(cyl("HydroFoot", 0.17, 0.03, g(0, 0, 0), M["brass"], 14))
hy.append(lb("HydroBack", -0.34, 0.34, 0.98, 1.36, -0.03, 0.03, M["mahog"], 0.01))
hy.append(front("hydro", 0.64, 0.32, 1.17, 0.03))
hy.append(plane("Hydro", 0.64, 0.32, g(0, 1.17, -0.034), signmat("hydro", 0.4), rot=(PI / 2, 0, PI)))
add("spa", yawed(hy, SP["x"] - 1.3, SP["z"] + 1.3, -PI / 4, "HydroBoard"))
# a zinc bucket of ducks at the corner toward the pool and the end; one duck has escaped onto the floor
bk_x, bk_z = SP["x"] + 1.35, SP["z"] + 1.35
add("spa", cyl("DuckBucket", 0.15, 0.25, g(bk_x, 0, bk_z), M["steel"], 14, r2=0.18))
add("spa", torus("DuckBucketRim", 0.18, 0.012, g(bk_x, 0.25, bk_z), M["steel"], 14, 4))
for k in range(4):
    a = k * TAU / 4 + 0.3
    add("spa", duck(bk_x + math.cos(a) * 0.07, 0.2, bk_z + math.sin(a) * 0.07, 0.8, a, M["duck"] if k != 2 else M["rose"]))
add("spa", duck(bk_x + 0.15, 0.0, bk_z - 0.35, 0.9, 2.4))

# ================================================================================================================================
# THE BIG PLANTS: a fan palm in a blue-and-white jardiniere at the end (the plan's plant at x 0), a fern on a pedestal by the near wall
# ================================================================================================================================
PE = PL[3]
pj = [trees.lathe("BigJardiniere", [(0.26, 0), (0.33, 0.06), (0.42, 0.3), (0.4, 0.52), (0.45, 0.58), (0.43, 0.62)], 22, M["porcelain"], g(PE["x"], 0, PE["z"]))]
for yy, rr in ((0.12, 0.37), (0.45, 0.42)):
    pj.append(torus("BigJarBand", rr, 0.016, g(PE["x"], yy, PE["z"]), M["blue"], 22, 4))
for k in range(8):  # a blue willow-ish motif: little blue dabs round the belly
    a = k * TAU / 8
    pj.append(sphere("JarMotif", 0.05, g(PE["x"] + math.cos(a) * 0.415, 0.3, PE["z"] + math.sin(a) * 0.415), M["blue"], 6, 4, scale=(0.4, 1, 1)))
pj.append(cyl("BigJarSoil", 0.41, 0.01, g(PE["x"], 0.58, PE["z"]), M["soil"], 18))
r = random.Random(42)
for k in range(18):  # curving canes up to a crown of arching fronds, the tallest 3.4 m
    a = k * TAU / 18 + r.uniform(-0.2, 0.2)
    h = r.uniform(1.4, 2.9)
    lean = r.uniform(0.2, 0.75) * (1.2 - h / 3.5)
    mid = Vector(g(PE["x"] + math.cos(a) * lean * 0.35, 0.55 + (h - 0.55) * 0.55, PE["z"] + math.sin(a) * lean * 0.35))
    top = Vector(g(PE["x"] + math.cos(a) * lean, h, PE["z"] + math.sin(a) * lean))
    pj.append(tube("PalmCane", [Vector(g(PE["x"] + math.cos(a) * 0.05, 0.55, PE["z"] + math.sin(a) * 0.05)), mid, top], 0.013, sm("palm_stem", "#7a8a4a", 0.6), 2, 5))
    pj.append(trees.frond_card("PalmFrond", top, -a, math.radians(r.uniform(5, 35)), r.uniform(0.95, 1.3), r.uniform(0.34, 0.42), math.radians(r.uniform(45, 75)), segs=4))
add("plants", *pj)
add("plants", *pedestal_plant(PL[2], "fern", 9, 0.95))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("dc_backL", g(-9.0, 2.0, -15.2), 8, 10, 0, (1280, 720), 16, 30)
    look("dc_backR", g(8.0, 2.0, -15.2), 8, 10, 0, (1280, 720), 16, 30)
    look("dc_end", g(0.0, 1.5, 12.8), 10, 14, 180, (1280, 720), 16, 30)
    look("dc_spa", g(-11.7, 0.8, 8.0), 4.5, 30, 0, (960, 640), 16, 35)
    look("dc_far", g(14.6, 2.2, 0.0), 12, 12, 270, (1280, 720), 16, 30)
save_part("decor", [o for v in parts.values() for o in v if o])
