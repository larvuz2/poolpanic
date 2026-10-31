"""The Aqua Disco's club furniture, modelled in place in game coordinates round what the game moves to the beat (scene/disco.mjs and
scene/discoclub.mjs: the stage's ring, disc and bulbs and Valentina; the speakers' cones; the DJ, his records and his booth's panel;
the bartender; the moving-head spots, lasers, LED rim and sparkles):

- the stage at (0, 11.6): a black gloss drum with a chrome band and a violet top (0.62 m, the game's), a step round its back half,
  uplights at its foot (`Light_Uplight`); two box-truss towers either side with a crossbar, moving heads and strobes on it;
- the four speaker stacks: cabinets in speaker cloth with chrome corners, turned to face the pool's middle as the game's cones do,
  dark rings where the cones pump, a horn on top and a moving head over each;
- the DJ's riser at (-12.2, -9.4): a black glass platform with a cyan edge, the booth in mirror mosaic (a dark window for the game's
  glowing panel), two turntables (the game spins their records), the mixer, a laptop, headphones, a microphone, crates of records,
  the DJ BOOTH board on the wall;
- the juice bar at (-12.9, 10.6): a mirror-fronted counter (its top at 1.24 m: the game's dog treats stand on it) with lime neon, the
  back bar on the wall (a mirror, glass shelves of glowing bottles), the Juice Bar sign and the smoothie menu, a blender, fruit,
  glasses and a shaker;
- the lounge: velvet banquettes along the back wall either side of the entrance, little cocktail tables with drinks;
- a deco urn with a palm at (-13, -12.4) and more at the far corners, two floor lamps beside the stage (`Light_Torchiere`);
- the aqua-fit kit: a basket of pool noodles by the left wall, a rack of foam dumbbells and kickboards by the right wall.

    blender -b -P tools/venues/disco/props_club.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from trees import use, palm  # (tools/venues/common/trees.py)

reset()
R = random.Random(19)
LOOK = "--look" in args()
M = dict(
    gloss=sm("black_gloss"),
    matte=sm("black_matte"),
    ink=sm("ink"),
    violet=sm("violet"),
    violet_light=sm("violet_light"),
    chrome=sm("chrome"),
    gold=sm("gold"),
    truss=sm("truss"),
    steel=sm("steel"),
    rubber=sm("rubber"),
    grille=tmat_tile("grille", "#1c1a22", 0.9),
    mirror=tmat_tile("mirrortile", "#dfe4f0", 0.08),
    velvet=tmat_tile("quilt", "#5a1a5e", 0.85, tint="#7a2068"),
    velvet_teal=tmat_tile("quilt", "#0f4a5a", 0.85, tint="#1a5a6a"),
    terrazzo=tmat_tile("terrazzo", "#16131c", 0.3),
    glass=sm("glass_drink", "#e4f3f5", 0.05, alpha=0.3),
    mirror_flat=sm("mirror"),
    cream=sm("cream"),
    neon_pink=lamp_mat("neon_pink", "#ff4fc0", 6.0),
    neon_cyan=lamp_mat("neon_cyan", "#3ae8ff", 6.0),
    neon_lime=lamp_mat("neon_lime", "#a8ff5a", 6.0),
    neon_gold=lamp_mat("neon_gold", "#ffd24a", 6.0),
    lens=lamp_mat("lens_white", "#f4f0ff", 4.0),
    bottle_glow=[lamp_mat("bottle_" + c[1:], c, 2.5) for c in ("#ff4fc0", "#3ae8ff", "#a8ff5a", "#ffd24a", "#8f6bff")],
    orange=sm("fruit_orange", "#ff8a3c", 0.5),
    lime=sm("fruit_lime", "#8cc63f", 0.5),
    pineapple=sm("pineapple", "#e0a62c", 0.6),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    juice_pink=sm("juice_pink", "#ff6aa8", 0.25),
    juice_blue=sm("juice_blue", "#4ac8ff", 0.25),
    noodle=[sm("noodle_" + c[1:], c, 0.6) for c in ("#ff3fb4", "#34e6ff", "#9cff4f", "#ffd24a", "#8f6bff")],
    vinyl=sm("vinyl", "#121216", 0.3),
    sleeve=[sm("sleeve_" + c[1:], c, 0.6) for c in ("#ff3fb4", "#34e6ff", "#ffd24a", "#f1e6d6", "#8f6bff")],
)
use(dict(bark=sm("bark"), bark_light=sm("bark"), pine_bark=sm("bark"), palm_boot=sm("bark"), coconut=sm("bark"), frond=cutmat("palm_frond", 0.65), hedge=M["leaf"], canopy=M["leaf"], conifer=M["leaf"]))
parts = {"stage": [], "speakers": [], "dj": [], "bar": [], "lounge": [], "plants": [], "gear": []}
lamps = []


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def turned(objs, x, z, yaw, name):
    """Join objects built round the origin (game axes, front toward +z) and set them at (x, z) turned by yaw about y."""
    o = join(objs, name)
    o.location = g(x, 0, z)
    o.rotation_euler = (0, 0, yaw)
    apply_all(o)
    return o


def moving_head(x, y, z, hang=False):
    s = -1 if hang else 1
    out = [cyl("HeadBase", 0.15, 0.1, g(x, y if not hang else y - 0.1, z), M["ink"], 10)]
    out.append(box("HeadYoke", x - 0.17, x + 0.17, y + s * 0.1, y + s * 0.36, z - 0.04, z + 0.04, M["ink"], 0.01))
    out.append(sphere("HeadBody", 0.16, g(x, y + s * 0.38, z), M["gloss"], 10, 6, scale=(1, 1, 1.15)))
    out.append(cyl("HeadLens", 0.085, 0.02, g(x, y + s * 0.38, z - 0.15), M["lens"], 10, rot=(PI / 2, 0, 0)))
    return out


# ---- the stage -------------------------------------------------------------------------------------------------------------------
SX, SZ, TOP = STAGE["x"], STAGE["z"], STAGE["y"]
st = parts["stage"]
st.append(cyl("StageDrum", 2.9, TOP - 0.1, g(SX, 0, SZ), M["gloss"], 48))
st.append(cyl("StageBand", 2.93, 0.06, g(SX, TOP - 0.12, SZ), M["chrome"], 48))
st.append(cyl("StageTop", 2.78, 0.06, g(SX, TOP - 0.06, SZ), M["violet_light"], 48))
st.append(torus("StageNeon", 2.91, 0.025, g(SX, 0.08, SZ), M["neon_pink"], 64, 4))
# a step round the back half (the front stays clear of the walk behind the pool)
bm = bmesh.new()
n = 24
outer = [(SX + math.cos(PI * k / n) * 3.35, SZ + math.sin(PI * k / n) * 3.35) for k in range(n + 1)]
inner = [(SX + math.cos(PI * k / n) * 2.9, SZ + math.sin(PI * k / n) * 2.9) for k in range(n, -1, -1)]
step = extrude_shape("StageStep", [(x - SX, z - SZ) for x, z in outer + inner], 0.28, g(SX, 0, SZ), M["terrazzo"], rot=(0, 0, 0))
step.scale = (1, -1, 1)
apply_all(step)
bpy.ops.object.select_all(action="DESELECT")
step.select_set(True)
bpy.context.view_layer.objects.active = step
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
st.append(step)
for k in range(10):
    a = PI * (0.05 + 0.9 * k / 9)
    lamps.append(cyl("Light_Uplight", 0.07, 0.1, g(SX + math.cos(a) * 3.1, 0.28, SZ + math.sin(a) * 3.1), M["neon_pink"] if k % 2 else M["neon_cyan"], 8))
# the truss towers and their crossbar, lights on it
TX, TZ, TH = 3.5, 13.1, 6.4


def tower(x, z, h):
    out = []
    for dx in (-0.15, 0.15):
        for dz in (-0.15, 0.15):
            out.append(cyl("Chord", 0.025, h, g(x + dx, 0, z + dz), M["truss"], 6))
    y = 0.0
    k = 0
    while y < h - 0.4:
        for (a, b) in (((-0.15, -0.15), (0.15, -0.15)), ((0.15, -0.15), (0.15, 0.15)), ((0.15, 0.15), (-0.15, 0.15)), ((-0.15, 0.15), (-0.15, -0.15))):
            out.append(tube("Lace", [g(x + a[0], y, z + a[1]), g(x + b[0], y + 0.4, z + b[1])], 0.012, M["truss"], 1, 3))
        y += 0.4
        k += 1
    out.append(box("TowerFoot", x - 0.35, x + 0.35, 0, 0.04, z - 0.35, z + 0.35, M["steel"], 0.01))
    return out


for sx in (-1, 1):
    st += tower(sx * TX, TZ, TH)
for dy, dz in ((0, -0.15), (0, 0.15), (-0.3, -0.15), (-0.3, 0.15)):
    st.append(box("CrossChord", -TX, TX, TH + dy - 0.025, TH + dy + 0.025, TZ + dz - 0.025, TZ + dz + 0.025, M["truss"], 0))
for k in range(12):
    x = -TX + k * 2 * TX / 12
    st.append(tube("CrossLace", [g(x, TH, TZ - 0.15), g(x + TX / 6, TH - 0.3, TZ - 0.15)], 0.012, M["truss"], 1, 3))
for k in range(5):
    x = -2.4 + k * 1.2
    st += moving_head(x, TH - 0.32, TZ - 0.2, hang=True)
for sx in (-1, 1):
    st.append(box("Strobe", sx * 1.8 - 0.25, sx * 1.8 + 0.25, TH - 0.55, TH - 0.35, TZ - 0.35, TZ - 0.2, M["ink"], 0.01))
    st.append(box("NightGlow_Strobe", sx * 1.8 - 0.2, sx * 1.8 + 0.2, TH - 0.52, TH - 0.38, TZ - 0.36, TZ - 0.35, sm("strobe_glass", "#f4f0ff", 0.2), 0))
    st[-1].name = "NightGlow_Strobe"

# ---- the speaker stacks ------------------------------------------------------------------------------------------------------------------
for (x, z) in FURNITURE["speakers"]:
    yaw = math.atan2(-x, -z)  # (the game's cones face the pool's middle: their local +z)
    s = []
    s.append(bx("Cabinet", -0.55, 0.55, -0.47, 0.47, 0.0, 1.9, M["matte"], 0.03))
    s.append(bx("Cloth", -0.48, 0.48, 0.47, 0.49, 0.12, 1.78, M["grille"], 0))
    for (y, r) in ((1.35, 0.32), (0.6, 0.4)):
        s.append(cyl("ConeRim", r + 0.05, 0.03, (0, 0.48, y), M["chrome"], 24, rot=(PI / 2, 0, 0)))
        s.append(cyl("ConeHole", r + 0.01, 0.02, (0, 0.495, y), M["ink"], 24, rot=(PI / 2, 0, 0)))
    for cx in (-0.55, 0.55):
        for cz in (-0.47, 0.47):
            for cy in (0.0, 1.84):
                s.append(bx("Corner", cx - 0.06, cx + 0.06, cz - 0.06, cz + 0.06, cy, cy + 0.06, M["chrome"], 0.01))
    s.append(bx("Horn", -0.32, 0.32, -0.2, 0.32, 1.9, 2.12, M["ink"], 0.02))
    s.append(bx("HornMouth", -0.28, 0.28, 0.3, 0.33, 1.93, 2.09, M["chrome"], 0.005))
    for sx_ in (-1, 1):
        s.append(bx("Handle", sx_ * 0.56, sx_ * 0.58, -0.15, 0.15, 1.1, 1.18, M["chrome"], 0.005))
    o = join(s, "Speaker")
    # (bx builds in Blender axes: rotate so the cloth faces the game's yaw, then place)
    o.location = g(x, 0, z)
    o.rotation_euler = (0, 0, PI + yaw)
    apply_all(o)
    parts["speakers"].append(o)
    parts["speakers"] += moving_head(x, 2.12, z)

# ---- the DJ's riser and booth ------------------------------------------------------------------------------------------------------------
DX_, DZ_, _, _ = FURNITURE["dj"]
RY = 0.25  # the riser's top (the DJ stands on it: scene/discoclub.mjs)
dj = parts["dj"]
dj.append(box("Riser", -13.98, -11.0, 0, RY, DZ_ - 1.65, DZ_ + 1.65, M["gloss"], 0.02))
dj.append(box("RiserEdge", -11.04, -11.0, 0.02, RY - 0.03, DZ_ - 1.62, DZ_ + 1.62, M["neon_cyan"], 0))
dj.append(box("RiserStep", -11.0, -10.75, 0, 0.12, DZ_ + 0.9, DZ_ + 1.6, M["terrazzo"], 0.01))
BX0, BX1 = -12.2, -11.15  # the booth's back and front (x)
BTOP = RY + 1.05
dj.append(box("BoothBody", BX0, BX1, RY, BTOP - 0.05, DZ_ - 1.2, DZ_ + 1.2, M["mirror"], 0.02))
dj.append(box("BoothWindow", BX1, BX1 + 0.01, RY + 0.25, RY + 0.95, DZ_ - 1.1, DZ_ + 1.1, M["ink"], 0))  # (the game's panel glows here)
dj.append(box("BoothTop", BX0 - 0.05, BX1 + 0.08, BTOP - 0.05, BTOP, DZ_ - 1.26, DZ_ + 1.26, M["gloss"], 0.01))
dj.append(box("BoothTrim", BX1 + 0.06, BX1 + 0.09, BTOP - 0.06, BTOP + 0.01, DZ_ - 1.26, DZ_ + 1.26, M["gold"], 0.005))
for dz in (-0.6, 0.6):  # the turntables (the game's records spin on them)
    dj.append(box("Turntable", -11.95, -11.4, BTOP, BTOP + 0.08, DZ_ + dz - 0.27, DZ_ + dz + 0.27, M["steel"], 0.01))
    dj.append(cyl("Platter", 0.25, 0.012, g(-11.68, BTOP + 0.08, DZ_ + dz), M["ink"], 24))
    dj.append(tube("ToneArm", [g(-11.5, BTOP + 0.1, DZ_ + dz + 0.22), g(-11.62, BTOP + 0.1, DZ_ + dz + 0.05)], 0.008, M["chrome"], 1, 4))
dj.append(box("Mixer", -11.95, -11.45, BTOP, BTOP + 0.07, DZ_ - 0.18, DZ_ + 0.18, M["ink"], 0.01))
for k in range(4):
    for j in range(3):
        dj.append(cyl("Knob", 0.015, 0.02, g(-11.88 + j * 0.13, BTOP + 0.07, DZ_ - 0.12 + k * 0.08), [M["neon_pink"], M["neon_cyan"], M["chrome"]][j], 6))
dj.append(box("Laptop", -12.15, -11.95, BTOP, BTOP + 0.02, DZ_ - 0.18, DZ_ + 0.18, M["steel"], 0.005))
lap = box("LaptopScreen", -12.16, -12.14, BTOP, BTOP + 0.26, DZ_ - 0.18, DZ_ + 0.18, M["steel"], 0.004)
dj.append(lap)
scr = box("NightGlow_Laptop", -12.135, -12.13, BTOP + 0.03, BTOP + 0.23, DZ_ - 0.16, DZ_ + 0.16, sm("screen_glow", "#7fd8ff", 0.3), 0)
scr.name = "NightGlow_Laptop"
dj.append(scr)
dj.append(torus("Headphones", 0.09, 0.015, g(-11.55, BTOP + 0.1, DZ_ + 1.0), M["ink"], 14, 4, rot=(0, PI / 2, 0)))
dj.append(cyl("MicStand", 0.012, 1.4, g(-11.3, 0, DZ_ - 1.5), M["chrome"], 6))
dj.append(tube("MicBoom", [g(-11.3, 1.4, DZ_ - 1.5), g(-11.6, 1.55, DZ_ - 1.2)], 0.01, M["chrome"], 1, 4))
dj.append(sphere("Mic", 0.04, g(-11.62, 1.56, DZ_ - 1.18), M["ink"], 8, 6))
dj.append(cyl("MicFoot", 0.18, 0.02, g(-11.3, 0, DZ_ - 1.5), M["ink"], 12))
# crates of records behind the DJ, sleeves showing
for k, dz in enumerate((-1.25, 1.15)):
    cz = DZ_ + dz
    dj.append(box("Crate", -13.9, -13.45, RY, RY + 0.36, cz - 0.22, cz + 0.22, M["violet"], 0.01))
    for j in range(7):
        x = -13.85 + j * 0.06
        dj.append(box("Sleeve", x, x + 0.012, RY + 0.04, RY + 0.4, cz - 0.16, cz + 0.16, M["sleeve"][(j + k) % 5], 0))
# the DJ BOOTH board on the wall behind, a neon ring round it
dj.append(box("DjBoardFrame", -14.0, -13.95, 2.3, 3.0, DZ_ - 1.4, DZ_ + 1.4, M["gold"], 0.01))
dj.append(plane("DjBoard", 2.6, 0.62, g(-13.945, 2.65, DZ_), signmat("dj_board", 0.5), rot=(PI / 2, 0, PI / 2)))

# ---- the juice bar -------------------------------------------------------------------------------------------------------------------------------
BXc, BZc, _, BHZ = FURNITURE["bar"]
TOPY = 1.24
ba = parts["bar"]
CX0, CX1, CZ0, CZ1 = -12.6, -11.95, BZc - 1.4, BZc + 1.4
ba.append(box("CounterBody", CX0, CX1, 0, TOPY - 0.05, CZ0, CZ1, M["mirror"], 0.02))
ba.append(box("CounterKick", CX1 - 0.02, CX1 + 0.02, 0, 0.1, CZ0, CZ1, M["ink"], 0))
ba.append(box("CounterTop", CX0 - 0.05, CX1 + 0.12, TOPY - 0.05, TOPY, CZ0 - 0.06, CZ1 + 0.06, M["gloss"], 0.012))
ba.append(box("CounterLip", CX1 + 0.1, CX1 + 0.13, TOPY - 0.07, TOPY + 0.01, CZ0 - 0.06, CZ1 + 0.06, M["gold"], 0.004))
for y in (0.16, TOPY - 0.12):
    ba.append(neon_ := box("CounterNeon", CX1 + 0.02, CX1 + 0.045, y - 0.015, y + 0.015, CZ0 + 0.05, CZ1 - 0.05, M["neon_lime"], 0))
# the back bar on the wall: a mirror, glass shelves, glowing bottles; the sign and the menu
ba.append(box("BackBarMirror", -13.98, -13.95, 1.1, 2.55, CZ0 + 0.2, CZ1 - 0.2, M["mirror_flat"], 0))
ba.append(box("BackBarBase", -13.98, -13.5, 0, 1.0, CZ0 + 0.1, CZ1 - 0.1, M["gloss"], 0.02))
for y in (1.45, 1.95, 2.45):
    ba.append(box("Shelf", -13.95, -13.7, y - 0.02, y, CZ0 + 0.2, CZ1 - 0.2, M["glass"], 0))
    for k in range(int((CZ1 - CZ0 - 0.5) / 0.14)):
        z = CZ0 + 0.3 + k * 0.14
        h = 0.2 + 0.06 * ((k * 7) % 3)
        ba.append(cyl("Bottle", 0.035, h, g(-13.82, y, z), M["bottle_glow"][(k + int(y * 3)) % 5], 8, r2=0.018))
ba.append(box("SignBack", -14.0, -13.96, 2.7, 3.35, CZ0 + 0.3, CZ1 - 0.3, M["ink"], 0.01))
ba.append(plane("JuiceBarSign", CZ1 - CZ0 - 0.7, 0.6, g(-13.955, 3.02, BZc), signmat("juice_bar", 0.5), rot=(PI / 2, 0, PI / 2)))
ba.append(box("MenuFrame", -14.0, -13.95, 1.25, 2.55, CZ1 + 0.3, CZ1 + 1.2, M["gold"], 0.01))
ba.append(plane("Menu", 0.8, 1.2, g(-13.945, 1.9, CZ1 + 0.75), signmat("juice_menu", 0.5), rot=(PI / 2, 0, PI / 2)))
# on the counter: a blender, a bowl of fruit, two smoothies with straws, a shaker (the treats' spot, z 10.6 at x -12.05, kept clear)
ba.append(cyl("BlenderBase", 0.09, 0.12, g(-12.35, TOPY, BZc + 1.05), M["chrome"], 12))
ba.append(cyl("BlenderJug", 0.08, 0.26, g(-12.35, TOPY + 0.12, BZc + 1.05), M["glass"], 12, r2=0.1))
ba.append(cyl("BlenderJuice", 0.075, 0.14, g(-12.35, TOPY + 0.13, BZc + 1.05), M["juice_pink"], 12, r2=0.085))
ba.append(cyl("FruitBowl", 0.14, 0.07, g(-12.3, TOPY, BZc - 1.0), M["gold"], 16, r2=0.18))
for k in range(5):
    a = k * math.tau / 5
    ba.append(sphere("Fruit", 0.05, g(-12.3 + math.cos(a) * 0.07, TOPY + 0.09, BZc - 1.0 + math.sin(a) * 0.07), [M["orange"], M["lime"]][k % 2], 8, 6))
ba.append(sphere("Pineapple", 0.08, g(-12.3, TOPY + 0.17, BZc - 1.0), M["pineapple"], 8, 6, scale=(1, 1, 1.4)))
for k, (dz, m) in enumerate(((-0.55, M["juice_pink"]), (0.55, M["juice_blue"]))):
    ba.append(cyl("Smoothie", 0.04, 0.17, g(-12.1, TOPY, BZc + dz), M["glass"], 10, r2=0.05))
    ba.append(cyl("SmoothieJuice", 0.037, 0.14, g(-12.1, TOPY + 0.01, BZc + dz), m, 10, r2=0.047))
    ba.append(tube("Straw", [g(-12.1, TOPY + 0.05, BZc + dz), g(-12.08, TOPY + 0.26, BZc + dz + 0.03)], 0.006, M["neon_pink"] if k else M["neon_cyan"], 1, 4))
ba.append(cyl("Shaker", 0.045, 0.2, g(-12.45, TOPY, BZc - 0.4), M["chrome"], 10, r2=0.035))

# ---- the lounge: velvet banquettes along the back wall, cocktail tables ------------------------------------------------------------------------
FZ = FACE_Z
lo = parts["lounge"]
for (a, b) in ((-12.9, -8.95), (-8.25, -4.75), (4.75, 8.25), (8.95, 12.4)):
    z0 = FZ + 0.02
    lo.append(box("BanquetteBase", a, b, 0, 0.36, z0, z0 + 0.6, M["gloss"], 0.02))
    lo.append(box("BanquetteSeat", a + 0.03, b - 0.03, 0.36, 0.48, z0 + 0.04, z0 + 0.6, M["velvet"], 0.04))
    lo.append(box("BanquetteBack", a + 0.03, b - 0.03, 0.48, 1.12, z0, z0 + 0.16, M["velvet"], 0.05))
    lo.append(box("BanquetteCap", a, b, 1.12, 1.16, z0, z0 + 0.18, M["gold"], 0.01))
    lo.append(box("BanquetteNeon", a + 0.05, b - 0.05, 0.05, 0.08, z0 + 0.6, z0 + 0.62, M["neon_pink"], 0))
    for x in (a + (b - a) * 0.3, a + (b - a) * 0.72):
        lo.append(cyl("TableFoot", 0.18, 0.03, g(x, 0, FZ + 0.92), M["chrome"], 16))
        lo.append(cyl("TableStem", 0.03, 0.5, g(x, 0.03, FZ + 0.92), M["chrome"], 8))
        lo.append(cyl("TableTop", 0.26, 0.03, g(x, 0.53, FZ + 0.92), M["gloss"], 20))
        lo.append(torus("TableRim", 0.26, 0.01, g(x, 0.56, FZ + 0.92), M["gold"], 20, 3))
        for k, m in enumerate((M["juice_pink"], M["juice_blue"])):
            dx = -0.08 + k * 0.16
            lo.append(cyl("Cocktail", 0.04, 0.13, g(x + dx, 0.56, FZ + 0.9), M["glass"], 8, r2=0.05))
            lo.append(cyl("CocktailIn", 0.036, 0.1, g(x + dx, 0.57, FZ + 0.9), m, 8, r2=0.045))
        lo.append(cyl("Candle", 0.035, 0.07, g(x, 0.56, FZ + 1.0), M["neon_gold"], 8))

# ---- urns with palms, floor lamps by the stage ---------------------------------------------------------------------------------------------
pl = parts["plants"]


def urn(x, z):
    out = [cyl("Urn", 0.36, 0.6, g(x, 0, z), M["gloss"], 16, r2=0.26)]
    out.append(cyl("UrnLip", 0.4, 0.06, g(x, 0.6, z), M["gold"], 16))
    for y in (0.15, 0.4):
        out.append(torus("UrnBand", 0.33 - y * 0.1, 0.015, g(x, y, z), M["gold"], 16, 3))
    out.append(cyl("UrnSoil", 0.34, 0.02, g(x, 0.6, z), M["ink"], 12))
    out += palm(x, z, 2.8 + R.uniform(-0.2, 0.3), int(abs(x * 13 + z * 7)) + 3, y0=0.6, lean=0.05, light=True)
    return out


px, pz = FURNITURE["plant"]
pl += urn(px, pz)
for (x, z) in ((-9.6, 13.0), (9.6, 13.0), (12.6, 13.0)):
    pl += urn(x, z)
for sx in (-1, 1):
    x, z = sx * 8.7, 13.1
    pl.append(cyl("LampFoot", 0.2, 0.04, g(x, 0, z), M["gold"], 16))
    pl.append(cyl("LampPole", 0.025, 1.7, g(x, 0.04, z), M["gold"], 8))
    pl.append(cyl("LampShade", 0.16, 0.3, g(x, 1.7, z), M["gold"], 16, r2=0.32))
    lamps.append(cyl("Light_Torchiere", 0.28, 0.02, g(x, 1.99, z), M["neon_gold"], 16))

# ---- the aqua-fit kit ----------------------------------------------------------------------------------------------------------------------------
ge = parts["gear"]
# a basket of pool noodles by the left wall
nx, nz = -13.4, 1.5
ge.append(cyl("NoodleBasket", 0.4, 0.7, g(nx, 0, nz), M["mirror"], 16))
ge.append(torus("NoodleRim", 0.4, 0.03, g(nx, 0.7, nz), M["gold"], 16, 4))
for k in range(9):
    a = k * math.tau / 9
    r = 0.22 if k < 8 else 0.0
    o = cyl("Noodle", 0.05, 1.6, g(nx + math.cos(a) * r, 0.05, nz + math.sin(a) * r), M["noodle"][k % 5], 8)
    o.rotation_euler = (math.cos(a) * 0.12, math.sin(a) * 0.12, 0)
    apply_all(o)
    ge.append(o)
# a rack of foam dumbbells and kickboards by the right wall
rx, rz = 13.45, 5.0
for dz in (-0.7, 0.7):
    ge.append(box("RackSide", rx - 0.25, rx + 0.25, 0, 1.3, rz + dz - 0.03, rz + dz + 0.03, M["chrome"], 0.005))
for y in (0.35, 0.8):
    ge.append(box("RackShelf", rx - 0.25, rx + 0.25, y - 0.02, y, rz - 0.7, rz + 0.7, M["gloss"], 0.005))
    for k in range(4):
        z = rz - 0.5 + k * 0.33
        m = M["noodle"][(k + int(y * 10)) % 5]
        for dx in (-0.1, 0.1):
            ge.append(cyl("Bell", 0.05, 0.06, g(rx + dx, y, z - 0.09), m, 10, rot=(PI / 2, 0, 0)))
            ge.append(cyl("Bell", 0.05, 0.06, g(rx + dx, y, z + 0.09), m, 10, rot=(PI / 2, 0, 0)))
            ge.append(cyl("BellBar", 0.018, 0.14, g(rx + dx, y + 0.05, z - 0.07), M["ink"], 6, rot=(PI / 2, 0, 0)))
for k in range(5):
    ge.append(box("Kickboard", rx - 0.2, rx + 0.2, 1.3 + k * 0.035, 1.33 + k * 0.035, rz - 0.3, rz + 0.3, M["noodle"][k], 0.01))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o.type == "MESH"]))
print("LAMPS", len(lamps))
if LOOK:
    look("club_stage", g(0, 2.5, 11.6), 12, 14, 180, (1100, 700), 18, 32)
    look("club_dj", g(-12.2, 1.2, -9.4), 5.5, 20, 70, (960, 640), 18, 32)
    look("club_bar", g(-12.8, 1.4, 10.6), 5.5, 16, 75, (960, 640), 18, 32)
    look("club_lounge", g(8.5, 0.8, -15.4), 6.0, 20, 15, (960, 640), 18, 32)
    look("club_speaker", g(12.9, 1.0, -10.2), 4.0, 14, 230, (960, 640), 18, 32)
everything = [o for v in parts.values() for o in v] + lamps
save_part("club", everything)
