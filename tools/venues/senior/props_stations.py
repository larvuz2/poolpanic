"""Senior Aqua Fit's gameplay furniture and the pieces the plan's furniture boxes hold, each where the game keeps its hit box, label
or obstacle (kit.PLAN: dist/spatial.mjs SENIOR; dist/scene/props.mjs for what the game itself draws on them):
- FLIPPERS: a mahogany stand with brass pegs, its three pairs (`Fins_1..3`, the game hides a pair as it is taken), a brass plate;
- WATER CARE: an apothecary's cabinet of brass-bound mahogany (bottles of chlorine, a brass balance, a test kit); EYE CARE: a marble
  washstand, a porcelain basin, brass taps, eye baths, a mirror, folded towels; their enamel boards above;
- the ring boards (one on the back wall, one over the near wall, one in front of the far glass: `LifeRing`), the fish net's board,
  the skimmer's board over the near wall; the green cast-iron litter bin; the torch's brass pedestal (`Flashlight`); the fuse box's
  mahogany board and conduit (the game draws the box and its lever);
- the hydrotherapy spa's marble tub with its brass rail and steps (the game's water, bubbles and steam: `Anchor_Spa`);
- the pool hoist (a white column, its arm out over the water, a navy sling seat); the rest bench (teak on cast-iron scroll ends, a
  tartan blanket); the tea trolley (a knitted tea cosy on the pot, cups, a cake stand of scones; the game's tin of dog biscuits on its
  top tier: `Anchor_Biscuits`); the gramophone on its mahogany table with a crate of records (the game's notes: `Anchor_Notes`);
  the two wing armchairs in emerald velvet with lace antimacassars, a brass standard lamp lit between them (`Light_Torchiere`), a
  knitting basket (a swimming costume half knitted), a side table with tea and large-print books; the two steamer loungers with
  tartan blankets, an eye mask, a crossword.

    blender -b -P tools/venues/senior/props_stations.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(733)
TAU = 2 * PI
M = dict(
    mahog=tmat_tile("teak", "#5b2c1a", 0.45, tint="#7a4a36"),
    teak=tmat_tile("teak", "#b57a43", 0.55),
    marble=tmat_tile("marble", "#f2eee6", 0.2),
    brass=sm("brass"),
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
    lavender=sm("lavender"),
    black=sm("black"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    rubber=sm("rubber"),
    towel=sm("towel"),
    paper=sm("paper"),
    tea=sm("tea"),
    biscuit=sm("biscuit"),
    jam=sm("jam"),
    clot=sm("cream_clot"),
    wool_p=sm("wool_pink"),
    wool_b=sm("wool_blue"),
    wool_y=sm("wool_yellow"),
    wicker=sm("wicker"),
    glass=sm("bottle_glass", "#9fd0c4", 0.08),
    amber=sm("amber_glass", "#c9862f", 0.1),
    mirror=sm("mirror", "#dfe9ee", 0.05, 1.0),
    ring=sm("ring_orange", "#f47742", 0.5),
    shade=lamp_mat("lamp_silk", "#f6e3bd", 3.0),
    fin_a=sm("fin_rose", "#e8829a", 0.5),
    fin_b=sm("fin_mint", "#7fcfb0", 0.5),
    fin_c=sm("fin_lemon", "#f0d060", 0.5),
    foot=sm("fin_foot", "#2b2f33", 0.6),
    fish=sm("goldfish", "#f08a24", 0.4),
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def anchor(name, x, y, z):
    return sphere("Anchor_" + name, 0.05, g(x, y, z), M["white"], 6, 4)


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


# yaw that turns local +z (the front) toward the game's -x (the pool, from the far side), +x (from the near side), -z, +z
TO_MX, TO_PX, TO_MZ, TO_PZ = -PI / 2, PI / 2, PI, 0.0


def lb(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return box(name, x0, x1, y0, y1, z0, z1, m, bev)


def front(img, w, h, y, z, x=0.0, rough=0.5):
    return plane("Pic", w, h, (x, -(z + 0.003), y), signmat(img, rough))


def enamel_board(img, w, h, y0, z, posts=True, post_h=None):
    """An enamel board (its picture on the front, mahogany behind) at local z, on two brass-capped mahogany posts."""
    out = [lb("BoardBack", -w / 2 - 0.05, w / 2 + 0.05, y0 - 0.05, y0 + h + 0.05, z - 0.05, z, M["mahog"], 0.015)]
    out.append(front(img, w, h, y0 + h / 2, z))
    if posts:
        for s in (-1, 1):
            out.append(lb("BoardPost", s * (w / 2 + 0.08) - 0.045, s * (w / 2 + 0.08) + 0.045, 0, post_h or (y0 + h + 0.1), z - 0.07, z + 0.02, M["mahog"], 0.01))
            out.append(sphere("PostKnob", 0.05, (s * (w / 2 + 0.08), -(z - 0.025), (post_h or (y0 + h + 0.1)) + 0.03), M["brass"], 10, 6))
    return out


# ---- FLIPPERS: the rack (the plan's: x 12.4, z -5.6), facing the pool (-x) -------------------------------------------------------
FR = STATIONS["fins"]
rk = []
for z in (-0.95, 0.95):
    rk.append(lb("RackEnd", -0.08, 0.08, 0, 1.9, z - 0.06, z + 0.06, M["mahog"], 0.02))
    rk.append(lb("RackFoot", -0.4, 0.4, 0, 0.08, z - 0.1, z + 0.1, M["mahog"], 0.02))
    rk.append(sphere("RackFinial", 0.07, (0, -z, 1.97), M["brass"], 10, 8))
rk.append(lb("RackTop", -0.1, 0.1, 1.72, 1.84, -1.0, 1.0, M["mahog"], 0.02))
rk.append(lb("RackShelf", -0.32, 0.32, 0.42, 0.47, -0.9, 0.9, M["mahog"], 0.01))
rk.append(lb("RackPlateBack", -0.12, -0.08, 1.88, 2.24, -0.6, 0.6, M["mahog"], 0.01))
rk += [plane("Flippers", 1.16, 0.48, (-0.123, 0, 2.06), signmat("flippers", 0.5), rot=(PI / 2, 0, -PI / 2))]
# towels rolled on the shelf, a little crate of swim caps
for k in range(3):
    rk.append(towel_rolled("ShelfTowel", 0.07, 0.36, (M["rose_pale"], M["mint"], M["lemon"])[k], M["white"], (-0.1, -(-0.6 + k * 0.28), 0.47), 0.0))
rk.append(lb("CapCrate", -0.25, 0.1, 0.47, 0.67, 0.35, 0.8, M["wicker"], 0.02))
for k, m in enumerate((M["rose"], M["sky"], M["lemon"])):
    rk.append(sphere("SwimCap", 0.09, (-0.08 + (k % 2) * 0.1, -(0.45 + k * 0.1), 0.68), m, 10, 6, scale=(1, 1, 0.7)))
add("fins", yawed(rk, FR["x"], FR["z"], 0.0, "FinRack"))


def fin(col):
    pts = [(-0.07, 0), (0.07, 0), (0.12, -0.36), (0.1, -0.5), (0.0, -0.53), (-0.1, -0.5), (-0.12, -0.36)]
    blade = extrude_shape("FinBlade", pts, 0.018, (0, 0, 0), col, rot=(PI / 2, 0, -PI / 2))
    apply_all(blade)
    pocket = gbx("FinPocket", -0.025, 0.005, -0.15, 0.03, -0.065, 0.065, M["foot"], 0.02)
    return join([blade, pocket], "Fin")


for i, dz in enumerate((-0.57, 0.0, 0.57)):
    col = (M["fin_a"], M["fin_b"], M["fin_c"])[i]
    pair = []
    for k, ddz in enumerate((-0.075, 0.075)):
        f = fin(col)
        f.location = g(FR["x"] - 0.12 - 0.02 * k, 1.5, FR["z"] + dz + ddz)
        f.rotation_euler = (0, 0.12 if k else -0.12, 0)
        apply_all(f)
        pair.append(f)
    o = join(pair, "Fins_%d" % (i + 1))
    o.name = "Fins_%d" % (i + 1)
    add("fins", o)
    add("fins", rod("Peg", (FR["x"] - 0.08, 1.52, FR["z"] + dz), (FR["x"] - 0.2, 1.55, FR["z"] + dz), 0.012, M["brass"]))

# ---- WATER CARE: the apothecary's cabinet (local front +z, turned to face -x) ---------------------------------------------------------
CH = STATIONS["chlorine"]
pc = []
pc.append(lb("Cabinet", -0.85, 0.85, 0, 0.9, -0.5, 0.3, M["mahog"], 0.02))
pc.append(lb("CabinetTop", -0.9, 0.9, 0.9, 0.95, -0.55, 0.35, M["marble"], 0.015))
for k in range(3):
    pc.append(lb("Drawer", -0.78 + k * 0.53, -0.3 + k * 0.53, 0.55, 0.82, 0.3, 0.32, M["mahog"], 0.01))
    pc.append(sphere("DrawerKnob", 0.025, (-0.54 + k * 0.53, -0.33, 0.68), M["brass"], 8, 6))
pc.append(lb("CabinetDoor", -0.78, 0.78, 0.08, 0.5, 0.3, 0.32, M["mahog"], 0.01))
for s in (-1, 1):
    pc.append(lb("BrassCorner", s * 0.85 - 0.03, s * 0.85 + 0.03, 0, 0.95, 0.27, 0.33, M["brass"], 0.005))
# the bottles: green glass, amber, labelled; a brass balance; the test kit; a feather duster
for k, (x, m, h) in enumerate(((-0.7, M["glass"], 0.32), (-0.55, M["amber"], 0.26), (-0.42, M["glass"], 0.3), (-0.3, M["amber"], 0.22))):
    pc.append(cyl("Bottle", 0.055, h, (x, 0.1, 0.95), m, 12))
    pc.append(cyl("Stopper", 0.03, 0.05, (x, 0.1, 0.95 + h), M["cream"], 8))
    pc.append(lb("BottleLabel", x - 0.04, x + 0.04, 0.95 + h * 0.3, 0.95 + h * 0.6, -0.044, -0.04, M["paper"], 0))
pc.append(cyl("BalanceFoot", 0.1, 0.03, (0.3, 0.1, 0.95), M["brass"], 14))
pc.append(cyl("BalancePost", 0.015, 0.4, (0.3, 0.1, 0.98), M["brass"], 8))
pc.append(rod("BalanceBeam", (0.1, 1.38, -0.1), (0.5, 1.38, -0.1), 0.01, M["brass"], 6))
for x in (0.1, 0.5):
    pc.append(cyl("BalancePan", 0.08, 0.02, (x, 0.1, 1.24), M["brass"], 12))
    pc.append(rod("BalanceString", (x, 1.26, -0.1), (x, 1.38, -0.1), 0.004, M["brass"], 4))
pc.append(lb("TestKit", 0.6, 0.85, 0.95, 1.05, -0.3, 0.1, M["white"], 0.01))
for k, m in enumerate((M["rose"], M["lemon"], M["sky"])):
    pc.append(cyl("Vial", 0.016, 0.1, (0.64 + k * 0.07, 0.05, 1.05), m, 8))
# its board above, on posts at the back
pc += enamel_board("water_care", 1.4, 0.58, 1.75, -0.52, True, 2.45)
add("stations", yawed(pc, CH["x"], CH["z"], TO_MX, "WaterCare"))

# ---- EYE CARE: the marble washstand --------------------------------------------------------------------------------------------------
RL = STATIONS["relief"]
pc = []
for s in (-1, 1):
    pc.append(lb("StandLeg", s * 0.75 - 0.05, s * 0.75 + 0.05, 0, 0.85, -0.35, -0.25, M["mahog"], 0.01))
    pc.append(lb("StandLeg", s * 0.75 - 0.05, s * 0.75 + 0.05, 0, 0.85, 0.25, 0.35, M["mahog"], 0.01))
pc.append(lb("StandShelf", -0.8, 0.8, 0.2, 0.25, -0.35, 0.35, M["mahog"], 0.01))
pc.append(lb("StandTop", -0.88, 0.88, 0.85, 0.93, -0.42, 0.42, M["marble"], 0.02))
pc.append(lb("Splash", -0.88, 0.88, 0.93, 1.25, -0.42, -0.36, M["marble"], 0.02))
for x in (-0.38, 0.38):
    pc.append(cyl("Basin", 0.22, 0.1, (x, 0.0, 0.93), M["porcelain"], 18, r2=0.26))
    pc.append(cyl("BasinWater", 0.2, 0.01, (x, 0.0, 1.0), M["sky"], 18))
    pc.append(rod("Tap", (x, 1.1, -0.36), (x, 1.15, -0.2), 0.018, M["brass"], 8))
    pc.append(cyl("TapHandle", 0.04, 0.02, (x + 0.08, 0.32, 1.13), M["porcelain"], 8))
for k in range(4):
    pc.append(cyl("EyeBath", 0.035, 0.05, (-0.75 + k * 0.08, -0.2, 0.93), M["glass"], 10, r2=0.025))
pc.append(lb("Mirror", -0.35, 0.35, 1.3, 1.95, -0.4, -0.38, M["mirror"], 0.01))
pc.append(lb("MirrorFrame", -0.39, 0.39, 1.26, 1.99, -0.42, -0.4, M["gold"], 0.01))
for k in range(3):
    pc.append(towel_folded("WashTowel", 0.3, 0.22, 0.05, M["towel"], M["emerald"], (0.0, 0.0, 0.25 + k * 0.05), 0.08 * k))
pc.append(lb("Glasses", -0.12, 0.12, 0.93, 0.95, 0.12, 0.2, M["black"], 0.004))
pc += enamel_board("eye_care", 1.4, 0.58, 2.2, -0.45, True, 2.9)
add("stations", yawed(pc, RL["x"], RL["z"], TO_MX, "EyeCare"))

# ---- the ring boards, the fish net's board, the skimmer's -------------------------------------------------------------------------------
for k, mnt in enumerate(RING_MOUNTS):
    rb_ = [lb("RingBoard", -0.55, 0.55, 0.95, 2.45, -0.24, -0.12, M["mahog"], 0.02)]
    for x0, x1, y0, y1 in ((-0.58, 0.58, 0.92, 0.96), (-0.58, 0.58, 2.44, 2.48), (-0.58, -0.54, 0.92, 2.48), (0.54, 0.58, 0.92, 2.48)):
        rb_.append(lb("RingBoardGilt", x0, x1, y0, y1, -0.12, -0.1, M["gold"], 0.003))
    rb_ += [front("life_ring", 1.06, 0.44, 2.75, -0.12)]
    rb_.append(lb("RingSignBack", -0.58, 0.58, 2.5, 3.0, -0.2, -0.12, M["mahog"], 0.01))
    if mnt["x"] < 0 and abs(mnt["angle"]) > 1 or mnt["x"] > 0:
        for s_ in (-1, 1):
            rb_.append(lb("RingPost", s_ * 0.62 - 0.045, s_ * 0.62 + 0.045, 0, 3.05, -0.24, -0.14, M["mahog"], 0.01))
    rb_.append(rod("RingPeg", (0, 2.25, -0.12), (0, 2.25, 0.16), 0.045, M["brass"], 8))
    add("rings", yawed(rb_, mnt["x"], mnt["z"], mnt["angle"], f"RingBoard{k}"))
    add("rings", torus("LifeRing", 0.4, 0.1, g(mnt["x"], 1.65, mnt["z"]), M["ring"], 16, 6))
FN = FIXTURES["fishNet"]
fb = [lb("NetBoard", -0.62, 0.62, 0.05, 2.85, -0.24, -0.12, M["mahog"], 0.02)]
for s_ in (-1, 1):
    fb.append(lb("NetPost", s_ * 0.66 - 0.045, s_ * 0.66 + 0.045, 0, 3.4, -0.24, -0.14, M["mahog"], 0.01))
    fb.append(sphere("NetKnob", 0.05, (s_ * 0.66, 0.19, 3.43), M["brass"], 10, 6))
fb += [front("fish_net", 1.16, 0.48, 3.1, -0.12)]
for x0, x1, y0, y1 in ((-0.62, 0.62, 0.05, 0.09), (-0.62, 0.62, 2.81, 2.85), (-0.62, -0.58, 0.05, 2.85), (0.58, 0.62, 0.05, 2.85)):
    fb.append(lb("NetGilt", x0, x1, y0, y1, -0.12, -0.1, M["gold"], 0.003))
# a little brass goldfish plaque and a jar for the catch at the board's foot
fb.append(cyl("NetJar", 0.11, 0.24, (0.42, 0.0, 0.0), M["glass"], 12))
fb.append(sphere("NetJarFish", 0.035, (0.42, 0.0, 0.14), M["fish"], 8, 6, scale=(1.4, 0.6, 1)))
fb.append(lb("NetSignBack", -0.62, 0.62, 2.85, 3.38, -0.2, -0.12, M["mahog"], 0.01))
add("rings", yawed(fb, FN["x"], FN["z"], FN["angle"], "FishNetBoard"))
SK = SANITATION["rack"]
wallX = DECK["minX"] - 0.45
sb = [box("SkimmerBoard", wallX - 0.08, wallX + 0.08, 1.12, 2.37, SK["z"] - 1.95, SK["z"] + 1.95, M["mahog"], 0.02)]
for y0, y1, z0, z1 in ((1.1, 1.14, SK["z"] - 1.97, SK["z"] + 1.97), (2.35, 2.39, SK["z"] - 1.97, SK["z"] + 1.97), (1.1, 2.39, SK["z"] - 1.97, SK["z"] - 1.93), (1.1, 2.39, SK["z"] + 1.93, SK["z"] + 1.97)):
    sb.append(box("SkimmerGilt", wallX + 0.08, wallX + 0.1, y0, y1, z0, z1, M["gold"], 0.0))
for zz in (SK["z"] - 1.85, SK["z"] + 1.85):
    sb.append(box("SkimmerPost", wallX - 0.07, wallX + 0.07, 0, 3.1, zz - 0.06, zz + 0.06, M["mahog"], 0.01))
    sb.append(sphere("SkimmerKnob", 0.06, g(wallX, 3.13, zz), M["brass"], 10, 6))
# pinned on the board round where the skimmer hangs: today's paper, a bingo card, two notes in a shaky hand, brass pins
FX_ = wallX + 0.081
for name, w_, h_, y_, dz_ in (("newspaper", 0.5, 0.38, 2.02, -1.35), ("bingo_card", 0.42, 0.28, 2.06, 1.4)):
    sb.append(plane("Pinned", w_, h_, g(FX_ + 0.004, y_, SK["z"] + dz_), signmat(name, 0.8), rot=(PI / 2, 0, PI / 2)))
    sb.append(sphere("Pin", 0.015, g(FX_ + 0.012, y_ + h_ / 2 - 0.03, SK["z"] + dz_), M["red"], 6, 4))
for y_, dz_, tilt in ((1.32, -1.5, 0.08), (1.3, 1.35, -0.06), (2.12, -0.75, 0.04)):
    note = box("Note", FX_, FX_ + 0.004, y_ - 0.1, y_ + 0.1, SK["z"] + dz_ - 0.14, SK["z"] + dz_ + 0.14, M["paper"] if dz_ < 0 else M["lemon"], 0.0)
    sb.append(note)
    for k in range(3):
        sb.append(box("NoteLine", FX_ + 0.004, FX_ + 0.006, y_ + 0.05 - k * 0.045, y_ + 0.058 - k * 0.045, SK["z"] + dz_ - 0.1, SK["z"] + dz_ + 0.08 - 0.04 * (k == 2), M["navy"], 0.0))
    sb.append(sphere("Pin", 0.015, g(FX_ + 0.012, y_ + 0.08, SK["z"] + dz_), M["rose"], 6, 4))
title = [lb("SkimTitle", -0.7, 0.7, 2.42, 3.0, -0.03, 0.03, M["mahog"], 0.01), front("skimmer", 1.36, 0.56, 2.71, 0.03)]
add("sanitation", *sb, yawed(title, wallX, SK["z"], TO_PX, "SkimmerTitle"))

# ---- the litter bin: green cast iron, a gilt band, a domed lid --------------------------------------------------------------------------
BN = SANITATION["bin"]
bi = [cyl("Bin", 0.42, 0.95, g(BN["x"], 0.05, BN["z"]), M["iron_dark"], 20, r2=0.46)]
bi.append(cyl("BinFoot", 0.46, 0.06, g(BN["x"], 0, BN["z"]), M["iron_dark"], 20))
for y in (0.25, 0.75):
    bi.append(torus("BinBand", 0.44 + (y - 0.25) * 0.04, 0.018, g(BN["x"], y, BN["z"]), M["gold"], 20, 4))
for k in range(12):
    a = k * TAU / 12
    bi.append(box("BinRib", BN["x"] + math.cos(a) * 0.44 - 0.015, BN["x"] + math.cos(a) * 0.44 + 0.015, 0.3, 0.7, BN["z"] + math.sin(a) * 0.44 - 0.015, BN["z"] + math.sin(a) * 0.44 + 0.015, M["iron_dark"], 0.005))
bi.append(cyl("BinDome", 0.48, 0.25, g(BN["x"], 1.0, BN["z"]), M["iron_dark"], 20, r2=0.15))
bi.append(sphere("BinFinial", 0.06, g(BN["x"], 1.3, BN["z"]), M["gold"], 10, 6))
bi.append(plane("Litter", 0.42, 0.21, g(BN["x"] + 0.465, 0.5, BN["z"]), signmat("litter", 0.5), rot=(PI / 2, 0, PI / 2)))
add("sanitation", *bi)

# ---- the torch's brass pedestal, the fuse box's board -------------------------------------------------------------------------------------
FL = FIXTURES["flashlight"]
fp = [cyl("PedestalFoot", 0.2, 0.08, g(FL["x"], 0, FL["z"]), M["brass"], 16)]
fp.append(cyl("Pedestal", 0.06, 1.0, g(FL["x"], 0.08, FL["z"]), M["mahog"], 12, r2=0.05))
fp.append(cyl("PedestalShelf", 0.22, 0.04, g(FL["x"], 1.08, FL["z"]), M["brass"], 16))
fp.append(torus("PedestalRim", 0.22, 0.018, g(FL["x"], 1.12, FL["z"]), M["brass"], 16, 4))
fp.append(cyl("Flashlight", 0.06, 0.3, g(FL["x"], 1.09, FL["z"]), M["iron"], 8))  # (its middle 1.24 m up: the game's torch)
add("fixtures", *fp)
FU = FIXTURES["fuseBox"]
fx = FU["x"] + 0.05
add("fixtures", box("FuseBoard", fx, fx + 0.08, 0.9, 2.3, FU["z"] - 0.6, FU["z"] + 0.6, M["mahog"], 0.015))
add("fixtures", box("FuseConduit", fx + 0.02, fx + 0.06, 2.3, ROOF["eave"] - 0.1, FU["z"] - 0.03, FU["z"] + 0.03, M["brass"], 0.005))
add("fixtures", plane("Danger", 0.48, 0.3, g(fx - 0.004, 2.0, FU["z"] - 0.95), signmat("danger", 0.5), rot=(PI / 2, 0, -PI / 2)))
add("fixtures", box("DangerBack", fx, fx + 0.02, 1.83, 2.17, FU["z"] - 1.21, FU["z"] - 0.69, M["mahog"], 0.005))

# ---- the spa's tub: marble, a brass rail, two marble steps; the water is the game's ---------------------------------------------------
SP = next(f for f in FURNITURE if f["kind"] == "spa")
r = min(SP["hx"], SP["hz"])
prof = [(r + 0.05, 0), (r + 0.02, 0.56), (r + 0.08, 0.6), (r + 0.08, 0.68), (r - 0.06, 0.7), (r - 0.18, 0.66), (r - 0.18, 0.3), (0.01, 0.3)]
bm = bmesh.new()
rings_ = []
for rad, h in prof:
    rings_.append([bm.verts.new((SP["x"] + math.cos(a) * rad, -SP["z"] + math.sin(a) * rad, h)) for a in [k * TAU / 48 for k in range(48)]])
for k in range(len(rings_) - 1):
    for i in range(48):
        j = (i + 1) % 48
        bm.faces.new([rings_[k][i], rings_[k][j], rings_[k + 1][j], rings_[k + 1][i]])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("SpaTub")
bm.to_mesh(me)
bm.free()
tub = bpy.data.objects.new("SpaTub", me)
bpy.context.scene.collection.objects.link(tub)
tub.data.materials.append(M["marble"])
add("spa", tub)
add("spa", torus("SpaBand", r + 0.06, 0.03, g(SP["x"], 0.3, SP["z"]), M["sky"], 48, 6))
rail = torus("SpaRail", r - 0.05, 0.03, (0, 0, 0), M["brass"], 40, 8)
bmr = bmesh.new()
bmr.from_mesh(rail.data)
cut = [v for v in bmr.verts if math.atan2(v.co.y, v.co.x) % TAU > PI * 0.7]
bmesh.ops.delete(bmr, geom=cut, context="VERTS")
bmr.to_mesh(rail.data)
bmr.free()
rail.location = g(SP["x"], 1.05, SP["z"])
apply_all(rail)
add("spa", rail)
for a in (0.0, PI * 0.7):
    add("spa", rod("SpaPost", (SP["x"] + math.cos(a) * (r - 0.05), 0.66, SP["z"] - math.sin(a) * (r - 0.05)), (SP["x"] + math.cos(a) * (r - 0.05), 1.05, SP["z"] - math.sin(a) * (r - 0.05)), 0.03, M["brass"]))
# two marble steps up to it from the pool's side (+x), in its box's corner
for k in range(2):
    add("spa", box("SpaStep", SP["x"] + r - 0.45 + k * 0.0, SP["x"] + r + 0.05 - 0.2 * k, 0, 0.18 + 0.18 * k, SP["z"] - 1.2, SP["z"] - 0.6, M["marble"], 0.02))
add("spa", anchor("Spa", SP["x"], 0.58, SP["z"]))

# ---- the pool hoist: its arm out over the water ----------------------------------------------------------------------------------------
HO = next(f for f in FURNITURE if f["kind"] == "hoist")
ho = [cyl("HoistBase", 0.3, 0.06, g(HO["x"], 0, HO["z"]), M["steel"], 20)]
ho.append(cyl("HoistColumn", 0.07, 2.0, g(HO["x"], 0.06, HO["z"]), M["white"], 12))
ho.append(rod("HoistArm", (HO["x"], 1.95, HO["z"]), (HO["x"] + 1.15, 1.95, HO["z"]), 0.05, M["white"], 10))
ho.append(rod("HoistStrut", (HO["x"], 1.5, HO["z"]), (HO["x"] + 0.6, 1.95, HO["z"]), 0.03, M["white"], 8))
ho.append(lb("HoistBox", HO["x"] - 0.12, HO["x"] + 0.12, 1.0, 1.35, HO["z"] - 0.1, HO["z"] + 0.1, M["sky"], 0.02))
for dz in (-0.2, 0.2):
    ho.append(rod("HoistChain", (HO["x"] + 1.15, 1.92, HO["z"]), (HO["x"] + 1.15, 0.85, HO["z"] + dz), 0.008, M["steel"], 4))
ho.append(lb("HoistSeat", HO["x"] + 0.92, HO["x"] + 1.38, 0.72, 0.8, HO["z"] - 0.22, HO["z"] + 0.22, M["navy"], 0.02))
ho.append(lb("HoistBack", HO["x"] + 1.36, HO["x"] + 1.4, 0.78, 1.15, HO["z"] - 0.22, HO["z"] + 0.22, M["navy"], 0.02))
ho.append(towel_folded("HoistTowel", 0.3, 0.25, 0.05, M["rose_pale"], M["white"], g(HO["x"] + 1.15, 0.8, HO["z"]), 0.1))
add("furniture", *ho)

# ---- the rest bench: teak slats on cast-iron scroll ends, a tartan blanket --------------------------------------------------------------
BE = next(f for f in FURNITURE if f["kind"] == "bench")
pc = []
for x in (-1.5, 1.5):
    pc.append(lb("BenchLeg", x - 0.04, x + 0.04, 0, 0.5, 0.18, 0.26, M["iron_dark"], 0.01))
    pc.append(lb("BenchLeg", x - 0.04, x + 0.04, 0, 1.0, -0.34, -0.26, M["iron_dark"], 0.01))
    pc.append(lb("BenchArm", x - 0.04, x + 0.04, 0.6, 0.66, -0.3, 0.26, M["iron_dark"], 0.01))
    sc = torus("BenchScroll", 0.12, 0.025, (x, -0.24, 0.72), M["iron_dark"], 14, 6, rot=(0, PI / 2, 0))
    pc.append(sc)
for k in range(4):
    pc.append(lb("BenchSlat", -1.6, 1.6, 0.53, 0.58, -0.24 + k * 0.15 - 0.06, -0.24 + k * 0.15 + 0.06, M["teak"], 0.015))
for k in range(3):
    pc.append(lb("BenchBack", -1.6, 1.6, 0.72 + k * 0.17 - 0.06, 0.72 + k * 0.17 + 0.06, -0.35, -0.31, M["teak"], 0.015))
pc.append(lb("Blanket", 0.4, 1.3, 0.58, 0.68, -0.25, 0.3, M["red"], 0.04))
for k in range(4):
    pc.append(lb("BlanketCheck", 0.4 + k * 0.22, 0.44 + k * 0.22, 0.58, 0.685, -0.26, 0.31, M["navy"], 0.0))
add("furniture", yawed(pc, BE["x"], BE["z"], -(BE.get("angle", 0) - PI / 2) + PI / 2, "Bench"))

# ---- the tea trolley: mahogany and brass, a knitted cosy on the pot, cups, scones (the game's biscuit tin on the top tier) --------------
TR = next(f for f in FURNITURE if f["kind"] == "trolley")
pc = []
for y in (0.28, 0.8):
    pc.append(lb("Tray", -0.48, 0.48, y, y + 0.04, -0.28, 0.28, M["mahog"], 0.01))
    for zz in (-0.29, 0.29):
        pc.append(lb("TrayLip", -0.5, 0.5, y + 0.03, y + 0.07, zz - 0.012, zz + 0.012, M["brass"], 0.004))
    for xx in (-0.49, 0.49):
        pc.append(lb("TrayLip", xx - 0.012, xx + 0.012, y + 0.03, y + 0.07, -0.29, 0.29, M["brass"], 0.004))
for x in (-0.45, 0.45):
    for z in (-0.25, 0.25):
        pc.append(cyl("TrolleyLeg", 0.015, 0.84, (x, -z, 0.06), M["brass"], 6))
        pc.append(cyl("Castor", 0.04, 0.05, (x, -z, 0.0), M["black"], 8))
pc.append(rod("TrolleyHandle", (-0.55, 0.95, -0.25), (-0.55, 0.95, 0.25), 0.015, M["brass"], 6))
pc.append(cyl("Teapot", 0.12, 0.16, (-0.2, 0.0, 0.84), M["porcelain"], 14, r2=0.1))
pc.append(sphere("TeaCosy", 0.15, (-0.2, 0.0, 0.98), M["wool_p"], 14, 10, scale=(1, 1, 0.9)))
pc.append(sphere("CosyPompom", 0.04, (-0.2, 0.0, 1.13), M["wool_y"], 8, 6))
for k in range(3):
    a = k * TAU / 3
    pc.append(cyl("Cup", 0.04, 0.05, (0.15 + math.cos(a) * 0.12, math.sin(a) * 0.12, 0.84), M["porcelain"], 10, r2=0.05))
    pc.append(cyl("Saucer", 0.07, 0.01, (0.15 + math.cos(a) * 0.12, math.sin(a) * 0.12, 0.84), M["blue"], 12))
# the cake stand on the lower tier: three plates, scones with jam and cream
pc.append(cyl("StandPole", 0.01, 0.42, (0.15, 0.0, 0.32), M["brass"], 6))
for k, rad in enumerate((0.17, 0.14, 0.1)):
    y = 0.36 + k * 0.14
    pc.append(cyl("StandPlate", rad, 0.012, (0.15, 0.0, y), M["porcelain"], 14))
    for j in range(3 - k):
        a = j * TAU / max(1, 3 - k) + k
        pc.append(cyl("Scone", 0.035, 0.035, (0.15 + math.cos(a) * rad * 0.6, math.sin(a) * rad * 0.6, y + 0.012), M["biscuit"], 8))
        pc.append(cyl("Jam", 0.025, 0.012, (0.15 + math.cos(a) * rad * 0.6, math.sin(a) * rad * 0.6, y + 0.047), M["jam"], 8))
        pc.append(sphere("Clot", 0.018, (0.15 + math.cos(a) * rad * 0.6, math.sin(a) * rad * 0.6, y + 0.065), M["clot"], 6, 4))
add("furniture", yawed(pc, TR["x"], TR["z"], PI / 2, "TeaTrolley"))
# (the classic's tin: at x - 0.18, 1.05 up, z + 0.3: the game puts its biscuits there)
add("furniture", anchor("Biscuits", TR["x"] - 0.18, 1.05, TR["z"] + 0.3))
add("furniture", plane("Biscuits", 0.36, 0.18, g(TR["x"] - 0.3, 0.62, TR["z"]), signmat("biscuits", 0.5), rot=(PI / 2, 0, -PI / 2)))

# ---- the gramophone on its mahogany table, a crate of records ------------------------------------------------------------------------
GR = next(f for f in FURNITURE if f["kind"] == "gramophone")
pc = []
pc.append(cyl("GTable", 0.42, 0.05, (0, 0, 0.7), M["mahog"], 24))
pc.append(cyl("GTableStem", 0.05, 0.68, (0, 0, 0.02), M["mahog"], 10, r2=0.07))
pc.append(cyl("GTableFoot", 0.3, 0.04, (0, 0, 0.0), M["mahog"], 16, r2=0.26))
pc.append(lb("GCabinet", -0.18, 0.18, 0.75, 0.93, -0.18, 0.18, M["mahog"], 0.02))
pc.append(cyl("GPlatter", 0.15, 0.01, (0, 0, 0.93), M["black"], 20))
pc.append(cyl("GLabel", 0.04, 0.012, (0, 0, 0.935), M["rose"], 10))
pc.append(rod("GTonearm", (0.14, 0.97, 0.12), (0.03, 0.96, -0.02), 0.01, M["brass"], 6))
# the horn: a flared brass lathe on its elbow
horn_prof = [(0.03, 0.0), (0.05, 0.18), (0.09, 0.32), (0.17, 0.44), (0.28, 0.52)]
bm = bmesh.new()
rs = []
for rad, h in horn_prof:
    rs.append([bm.verts.new((math.cos(a) * rad, math.sin(a) * rad, h)) for a in [k * TAU / 20 for k in range(20)]])
for k in range(len(rs) - 1):
    for i in range(20):
        j = (i + 1) % 20
        bm.faces.new([rs[k][i], rs[k][j], rs[k + 1][j], rs[k + 1][i]])
me = bpy.data.meshes.new("Horn")
bm.to_mesh(me)
bm.free()
horn = bpy.data.objects.new("Horn", me)
bpy.context.scene.collection.objects.link(horn)
horn.data.materials.append(M["brass"])
sol = horn.modifiers.new("S", "SOLIDIFY")
sol.thickness = 0.01
horn.rotation_euler = (0.0, -0.9, 0.0)
horn.location = (0.1, 0.0, 1.0)
apply_all(horn)
pc.append(horn)
pc.append(rod("HornElbow", (0.15, 0.93, 0.0), (0.12, 1.02, 0.0), 0.03, M["brass"], 8))
# the records in a crate on the floor beside it
pc.append(lb("Crate", 0.35, 0.75, 0, 0.35, -0.2, 0.2, M["teak"], 0.01))
for k in range(8):
    pc.append(lb("Record", 0.38, 0.72, 0.05, 0.4, -0.17 + k * 0.045, -0.15 + k * 0.045, (M["black"], M["rose"], M["navy"], M["lemon"])[k % 4], 0.0))
add("furniture", yawed(pc, GR["x"], GR["z"], PI * 0.75, "Gramophone"))
add("furniture", anchor("Notes", GR["x"], 1.45, GR["z"]))

# ---- the reading corner: two wing armchairs, a lamp, a basket of knitting, a side table ---------------------------------------------
chairs = [f for f in FURNITURE if f["kind"] == "armchair"]


def wing_chair():
    pc = [lb("ChairSeat", -0.38, 0.38, 0.3, 0.48, -0.38, 0.3, M["velvet"], 0.06)]
    pc.append(lb("ChairBack", -0.38, 0.38, 0.4, 1.2, -0.42, -0.26, M["velvet"], 0.06))
    for s in (-1, 1):
        pc.append(lb("ChairArm", s * 0.38 - 0.07 * s - 0.06, s * 0.38 - 0.07 * s + 0.06, 0.3, 0.68, -0.38, 0.3, M["velvet"], 0.05))
        pc.append(lb("ChairWing", s * 0.38 - 0.05, s * 0.38 + 0.05, 0.68, 1.12, -0.42, -0.12, M["velvet"], 0.05))
        for z in (-0.35, 0.25):
            pc.append(cyl("ChairLeg", 0.03, 0.3, (s * 0.33, -z, 0.0), M["mahog"], 8, r2=0.02))
    pc.append(lb("Cushion", -0.3, 0.3, 0.48, 0.58, -0.3, 0.25, M["velvet"], 0.05))
    pc.append(lb("Antimacassar", -0.25, 0.25, 0.95, 1.15, -0.27, -0.255, M["white"], 0.0))
    for k in range(6):
        pc.append(sphere("LaceScallop", 0.04, (-0.21 + k * 0.084, 0.26, 0.95), M["white"], 6, 4, scale=(1, 0.2, 1)))
    for s in (-1, 1):
        for y in (0.4, 0.62, 0.84, 1.06):
            pc.append(sphere("Button", 0.018, (s * 0.15, 0.255, y), M["gold"], 6, 4))
    return pc


for k, f in enumerate(chairs):
    add("reading", yawed(wing_chair(), f["x"], f["z"], TO_MX, "WingChair%d" % k))
zc = sum(f["z"] for f in chairs) / len(chairs)
LX = chairs[0]["x"] + 0.4
lp = [cyl("LampFoot", 0.17, 0.04, g(LX, 0, zc), M["brass"], 16)]
lp.append(cyl("LampStem", 0.02, 1.55, g(LX, 0.04, zc), M["brass"], 8))
lp.append(cyl("Light_Torchiere", 0.18, 0.32, g(LX, 1.5, zc), M["shade"], 16, r2=0.28))
lp.append(torus("LampFringe", 0.28, 0.012, g(LX, 1.5, zc), M["gold"], 20, 4))
add("reading", *lp)
# the knitting basket at the first chair's side, a half-knitted swimming costume on its needles, three balls of wool
kb = chairs[0]
KX, KZ = kb["x"] + 0.05, kb["z"] - 0.55
add("reading", cyl("KnitBasket", 0.18, 0.2, g(KX, 0, KZ), M["wicker"], 14, r2=0.21))
for k, m in enumerate((M["wool_p"], M["wool_b"], M["wool_y"])):
    add("reading", sphere("Wool", 0.07, g(KX - 0.05 + k * 0.06, 0.22, KZ + (k - 1) * 0.05), m, 10, 8))
add("reading", box("Knitting", KX - 0.12, KX + 0.12, 0.2, 0.36, KZ - 0.06, KZ - 0.04, M["wool_p"], 0.01))
for s in (-1, 1):
    add("reading", rod("Needle", (KX + s * 0.03, 0.2, KZ - 0.05), (KX + s * 0.1, 0.55, KZ - 0.05), 0.006, M["steel"], 4))
# the side table between the chairs (in the second chair's box): tea, reading glasses, the large-print books, the newspaper
ST = chairs[1]
SX_, SZ_ = ST["x"] + 0.32, ST["z"] + 0.42
add("reading", cyl("SideTable", 0.2, 0.03, g(SX_, 0.6, SZ_), M["mahog"], 16))
add("reading", cyl("SideTableLeg", 0.025, 0.6, g(SX_, 0.0, SZ_), M["mahog"], 8))
add("reading", cyl("SideCup", 0.04, 0.05, g(SX_ - 0.05, 0.63, SZ_ - 0.05), M["porcelain"], 10, r2=0.05))
add("reading", box("Book1", SX_ - 0.0, SX_ + 0.14, 0.63, 0.67, SZ_, SZ_ + 0.1, M["red"], 0.005))

# ---- the steamer loungers by the far end: teak, cane, tartan blankets, an eye mask, a crossword -----------------------------------
for k, f in enumerate([f for f in FURNITURE if f["kind"] == "lounger"]):
    pc = []
    for x in (-0.95, 0.95):
        for z in (-0.3, 0.3):
            pc.append(cyl("LoungerLeg", 0.025, 0.3, (x, -z, 0.0), M["teak"], 6))
    pc.append(lb("LoungerFrame", -0.95, 0.95, 0.3, 0.36, -0.32, 0.32, M["teak"], 0.02))
    pc.append(lb("LoungerCane", -0.4, 0.95, 0.36, 0.38, -0.28, 0.28, M["wicker"], 0.0))
    back = lb("LoungerBack", -0.2, 0.4, 0.36, 0.38, -0.28, 0.28, M["wicker"], 0.0)
    back.rotation_euler = (0, -0.85, 0)
    back.location = (-0.75, 0, 0.55)
    apply_all(back)
    pc.append(back)
    pc.append(lb("Footrest", 0.95, 1.05, 0.2, 0.38, -0.3, 0.3, M["teak"], 0.01))
    pc.append(lb("LoungerBlanket", -0.3, 0.8, 0.38, 0.45, -0.3, 0.3, M["red"] if k == 0 else M["navy"], 0.03))
    for j in range(5):
        pc.append(lb("LoungerCheck", -0.25 + j * 0.22, -0.21 + j * 0.22, 0.38, 0.455, -0.31, 0.31, M["emerald"] if k == 0 else M["red"], 0.0))
    pc.append(lb("Pillow", -0.95, -0.6, 0.62, 0.72, -0.22, 0.22, M["white"], 0.04))
    if k == 0:
        pc.append(lb("EyeMask", -0.2, 0.0, 0.45, 0.47, -0.08, 0.08, M["rose"], 0.01))
    else:
        pc.append(lb("Crossword", 0.1, 0.4, 0.45, 0.46, -0.15, 0.1, M["paper"], 0.0))
        pc.append(rod("Pencil", (0.2, 0.47, -0.2), (0.38, 0.47, -0.12), 0.006, M["lemon"], 5))
    # (yawed bakes the parts where they are first: the turn is about the lounger's own middle)
    add("loungers", yawed(pc, f["x"], f["z"], 0.0 if f["x"] < 0 else PI, "Lounger%d" % k))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("st_far", g(12.4, 1.2, 1.0), 9, 12, 270, (1280, 720), 16, 30)
    look("st_spa", g(-11.7, 0.8, 9.0), 6, 22, 300, (960, 640), 16, 35)
    look("st_reading", g(13.0, 0.9, -0.6), 3.5, 15, 270, (960, 640), 16, 35)
    look("st_trolley", g(-12.9, 0.8, 11.0), 2.2, 25, 300, (960, 640), 16, 35)
    look("st_near", g(-14.8, 1.5, -5.0), 7, 12, 90, (1280, 720), 16, 30)
    look("st_loungers", g(0.0, 0.5, 11.75), 7, 30, 180, (1280, 720), 16, 30)
save_part("stations", [o for v in parts.values() for o in v if o])
