"""The Wave Pool's gameplay furniture, each where the game keeps its hit box and label (kit.PLAN: dist/spatial.mjs WAVE; dist/scene/
props.mjs for what the game itself draws on them):
- the tube hut (the game's tubes stack on its peg like a ring toss: `Anchor_Tubes`), thatched, TUBE HUT both ways, its rules
  chalkboard (no sitting on the duck), a bell to ring, a foot pump, a patch kit, one sad deflated tube over the rail;
- the Surf Shack: a plank shed under thatch, SURF SHACK over a striped awning, a counter at the game's height (the dog treats' jar
  stands on it), a shave-ice machine, three syrups, a till, a coconut cup, leis on hooks, the chalk menu (a tube: ask the coach), a
  board on its roof and two against its back;
- the lifeguard tower at the top of the beach: white legs, a sky-blue hut, LIFEGUARD and a red cross, the flag board (always WAVES),
  a rescue can, binoculars, the life ring's board between its front legs (`LifeRing`), a ladder, a flag on its roof;
- WATER CARE in the service yard (a blue drum the pipe bridge feeds, a pH can, a test kit, a scoop) and EYE CARE at the right end
  (a chrome beach shower, a green eyewash bowl, a slatted grate, towels), their boards above;
- on the near wall the two ring boards, the fish net's board, the skimmer's board on posts (the game hangs the skimmer on its hooks);
  the waste bin, a fat teal fish with its mouth open (FEED ME); the torch's striped bollard (`Flashlight`); the fuse box's conduits
  and DANGER sign on the yard's wall (the game draws the box and its lever).

    blender -b -P tools/venues/wave/props_stations.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(733)
TAU = 2 * PI
M = dict(
    teak=tmat_tile("teak", "#b57a43", 0.55),
    thatch=tmat_tile("thatch", "#c99a52", 0.95),
    stucco=tmat_tile("stucco", "#f7efe0", 0.88),
    malibu=tmat_tile("malibu", "#e9c879", 0.25),
    post=sm("teak_dark"),
    white=sm("white"),
    cream=sm("cream"),
    coral=sm("coral"),
    teal=sm("teal"),
    teal_dark=sm("teal_dark"),
    sun=sm("sun"),
    navy=sm("navy"),
    sky=sm("sky"),
    red=sm("red"),
    orange=sm("orange"),
    pink=sm("pink"),
    lime=sm("lime"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    iron=sm("iron"),
    brass=sm("brass"),
    black=sm("black"),
    rubber=sm("rubber"),
    rope=sm("rope"),
    canvas=sm("canvas"),
    green=sm("eyewash_green", "#2fae5f", 0.35),
    blue_drum=sm("drum_blue", "#2f6fc4", 0.4),
    glass=sm("glass_jar", "#d6eef2", 0.05, alpha=0.3),
    ring=sm("ring_orange", "#f47742", 0.5),
    towel=sm("towel"),
    leaf=sm("leaf"),
    plastic_y=sm("plastic_y"),
    plastic_b=sm("plastic_b"),
    plastic_g=sm("plastic_g"),
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
    """Pieces modelled round the local origin (game axes, Blender units) joined, turned by `yaw` about the vertical and moved."""
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


def painted(img, w, h, y, z_front, z_back, x=0.0):
    """A picture on both faces of a board whose faces are at local z `z_front` (+z) and `z_back` (local, Blender: game z = -y)."""
    a = plane("Pic", w, h, (x, -(z_front + 0.002), y), signmat(img, 0.55))
    b = plane("Pic", w, h, (x, -(z_back - 0.002), y), signmat(img, 0.55), rot=(PI / 2, 0, PI))
    return [a, b]


def front_pic(img, w, h, y, z_front, x=0.0):
    return plane("Pic", w, h, (x, -(z_front + 0.002), y), signmat(img, 0.55))


def lifeguard_cap(w, y, d=0.26):
    """A little striped roof over a board: a coral plank and a cream one, a teal edge."""
    return [
        box("CapA", -w / 2 - 0.12, w / 2 + 0.12, y, y + 0.06, -d, 0.0, M["coral"], 0.015),
        box("CapB", -w / 2 - 0.12, w / 2 + 0.12, y, y + 0.06, 0.0, d, M["cream"], 0.015),
        box("CapEdge", -w / 2 - 0.14, w / 2 + 0.14, y - 0.03, y + 0.01, d - 0.03, d + 0.02, M["teal"], 0.008),
    ]


# local helpers in "local game axes" (x right, y up, z toward the viewer: Blender (x, -z, y))
def lb(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return box(name, x0, x1, y0, y1, z0, z1, m, bev)


# ---- the tube hut -----------------------------------------------------------------------------------------------------------------
# (local: +z toward the pool, the game's +x; yawed by -π/2 to stand there)
TH = STATIONS["fins"]
th = next(f for f in FURNITURE if f["kind"] == "tube-hut")
HX, HZ = th["hz"], th["hx"]  # (local half width along the hut's front, half depth)
pc = []
for sx in (-HX, HX):
    for sz in (-HZ, HZ):
        pc.append(lb("HutPost", sx - 0.06, sx + 0.06, 0, 2.55, sz - 0.06, sz + 0.06, M["post"], 0.01))
pc.append(lb("HutFloor", -HX - 0.08, HX + 0.08, 0, 0.1, -HZ - 0.08, HZ + 0.08, M["teak"], 0.01))
# (no back wall: the overview's camera looks in from behind it, at the game's tubes on their peg)
pc.append(lb("HutBackRail", -HX, HX, 0.85, 0.92, -HZ - 0.03, -HZ + 0.03, M["post"], 0.008))
for sx in (-HX, HX):
    pc.append(lb("HutSideRail", sx - 0.03, sx + 0.03, 0.85, 0.92, -HZ, HZ, M["post"], 0.008))
# the thatched roof: a low pyramid, the header board under its front eave, the sign on both faces
apex = (0, 3.35, 0.15)
eave = 2.55
corners = [(-HX - 0.4, eave, -HZ - 0.08), (HX + 0.4, eave, -HZ - 0.08), (HX + 0.4, eave, HZ + 0.45), (-HX - 0.4, eave, HZ + 0.45)]
bm = bmesh.new()
va = bm.verts.new((apex[0], -apex[2], apex[1]))
cs = [bm.verts.new((c[0], -c[2], c[1])) for c in corners]
for i in range(4):
    bm.faces.new((cs[i], cs[(i + 1) % 4], va))
me = bpy.data.meshes.new("HutRoof")
bm.to_mesh(me)
bm.free()
roof = bpy.data.objects.new("HutRoof", me)
bpy.context.scene.collection.objects.link(roof)
roof.data.materials.append(M["thatch"])
sol = roof.modifiers.new("S", "SOLIDIFY")
sol.thickness = 0.12
pc.append(roof)
pc.append(lb("HutHeader", -HX - 0.05, HX + 0.05, 2.1, 2.5, HZ - 0.03, HZ + 0.03, M["sun"], 0.01))
pc += painted("tube_hut", 1.9, 1.9 * 256 / 768, 2.3, HZ + 0.03, HZ - 0.03)
# the peg the game's tubes stack on (`Anchor_Tubes`: the stack's foot), a ring of rope round its top
pc.append(cyl("TubePeg", 0.06, 1.75, (0.0, -0.15, 0.1), M["post"], 10))
pc.append(sphere("TubePegKnob", 0.09, (0.0, -0.15, 1.88), M["coral"], 10, 6))
# the rules chalkboard on an easel at the side, the bell, the foot pump, the patch kit, the sad tube
pc.append(lb("EaselBoard", 0.55, 0.62, 0.35, 1.25, -0.55, 0.05, M["post"], 0.01))
pc.append(plane("TubeRules", 0.5, 0.66, (0.632, 0.25, 0.8), signmat("tube_rules", 0.8), rot=(PI / 2, 0, PI / 2)))
pc.append(rod("BellArm", (-HX, 1.7, HZ), (-HX - 0.25, 1.7, HZ + 0.1), 0.015, M["iron"], 6))
pc.append(cyl("Bell", 0.04, 0.12, (-HX - 0.25, -HZ - 0.1, 1.5), M["brass"], 12, r2=0.09))
pc.append(sphere("PumpBellows", 0.14, (-0.45, -(-0.4), 0.22), M["red"], 12, 8, scale=(1.4, 1, 0.6)))
pc.append(rod("PumpHose", (-0.3, 0.2, -0.4), (0.0, 0.3, -0.1), 0.012, M["black"], 6))
pc.append(lb("PatchKit", 0.25, 0.45, 0.1, 0.2, -0.65, -0.5, M["sun"], 0.01))
sad = torus("SadTube", 0.33, 0.1, (0, 0, 0), M["plastic_g"], 18, 6)
sad.scale = (1.0, 0.55, 0.45)
apply_all(sad)
sad.rotation_euler = (0.3, 1.3, 0)
sad.location = (HX + 0.02, -(-0.3), 0.92)
apply_all(sad)
pc.append(sad)
add("tubehut", yawed(pc, TH["x"], TH["z"], PI / 2, "TubeHut"))
# (the peg: local (0, 0.15) → after the turn the game's x + 0.15: the classic's stack, `finPairs`, at (x + 0.15, 0.2 + i·0.25))
add("tubehut", anchor("Tubes", TH["x"] + 0.15, 0.2, TH["z"]))

# ---- the Surf Shack --------------------------------------------------------------------------------------------------------------
ss = next(f for f in FURNITURE if f["kind"] == "surf-shack")
SX, SZ = ss["hz"], ss["hx"]  # (local: front along z+ = the game's +x, the pool)
CT = 1.24  # the counter's top (the game's treats jar stands on it: kioskTreats)
pc = []
for sx in (-SX, SX):
    for sz in (-SZ, SZ):
        pc.append(lb("ShackPost", sx - 0.07, sx + 0.07, 0, 2.6, sz - 0.07, sz + 0.07, M["post"], 0.01))
pc.append(lb("ShackBack", -SX, SX, 0, 2.5, -SZ - 0.03, -SZ + 0.05, M["teak"], 0.01))
for sx in (-SX, SX):
    pc.append(lb("ShackSide", sx - 0.04, sx + 0.04, 0, 2.5, -SZ, SZ - 0.02, M["teak"], 0.01))
pc.append(lb("CounterFront", -SX, SX, 0, CT - 0.06, SZ - 0.08, SZ, M["teal"], 0.01))
for k in range(9):
    x = -SX + 0.1 + k * (2 * SX - 0.2) / 8
    pc.append(lb("CounterSlat", x - 0.05, x + 0.05, 0.08, CT - 0.12, SZ, SZ + 0.02, M["cream"], 0.005))
pc.append(lb("Counter", -SX - 0.06, SX + 0.06, CT - 0.06, CT, SZ - 0.45, SZ + 0.12, M["teak"], 0.01))
# the roof: a thatched lean-to, a board on it, the header, a striped awning over the counter
bm = bmesh.new()
quad = [(-SX - 0.4, 3.0, -SZ - 0.45), (SX + 0.4, 3.0, -SZ - 0.45), (SX + 0.4, 2.55, SZ + 0.55), (-SX - 0.4, 2.55, SZ + 0.55)]
vs = [bm.verts.new((p[0], -p[2], p[1])) for p in quad]
bm.faces.new(vs)
me = bpy.data.meshes.new("ShackRoof")
bm.to_mesh(me)
bm.free()
roof = bpy.data.objects.new("ShackRoof", me)
bpy.context.scene.collection.objects.link(roof)
roof.data.materials.append(M["thatch"])
sol = roof.modifiers.new("S", "SOLIDIFY")
sol.thickness = 0.14
pc.append(roof)
rb = lb("RoofBoard", -0.24, 0.24, 2.82, 2.9, -1.0, 1.0, M["sun"], 0.12)
rb.rotation_euler = (0.2, 0, 0.15)
apply_all(rb)
pc.append(rb)
pc.append(lb("ShackHeader", -SX - 0.1, SX + 0.1, 2.2, 2.62, SZ + 0.04, SZ + 0.1, M["teak"], 0.01))
pc += painted("surf_shack", 2 * SX + 0.1, (2 * SX + 0.1) * 220 / 1024, 2.41, SZ + 0.1, SZ + 0.04)
for k in range(10):
    x0 = -SX - 0.05 + k * (2 * SX + 0.1) / 10
    stripe = lb("Awning", x0, x0 + (2 * SX + 0.1) / 10, 2.12, 2.15, SZ + 0.1, SZ + 0.75, M["coral"] if k % 2 == 0 else M["cream"], 0.0)
    stripe.rotation_euler = (-0.0, 0, 0)
    pc.append(stripe)
    pc.append(cyl("AwningScallop", 0.13, 0.02, (x0 + (2 * SX + 0.1) / 20, -(SZ + 0.75), 2.12), M["coral"] if k % 2 == 0 else M["cream"], 10, rot=(PI / 2, 0, 0)))
# on the counter: the shave-ice machine, syrups, the till, a coconut cup; leis on hooks; the menu board inside on the back wall
pc.append(lb("IceMachine", -0.95, -0.55, CT, CT + 0.38, SZ - 0.38, SZ - 0.08, M["red"], 0.03))
pc.append(cyl("IceDome", 0.15, 0.18, (-0.75, -(SZ - 0.23), CT + 0.38), M["glass"], 12))
pc.append(sphere("IceBlock", 0.1, (-0.75, -(SZ - 0.23), CT + 0.5), M["white"], 10, 6))
for k, m in enumerate((M["red"], M["plastic_b"], M["lime"])):
    pc.append(cyl("Syrup", 0.04, 0.22, (-0.4 + k * 0.1, -(SZ - 0.2), CT), m, 10))
    pc.append(cyl("SyrupCap", 0.015, 0.06, (-0.4 + k * 0.1, -(SZ - 0.2), CT + 0.22), M["white"], 6))
pc.append(lb("Till", 0.45, 0.85, CT, CT + 0.26, SZ - 0.42, SZ - 0.12, M["chrome"], 0.02))
pc.append(lb("TillKeys", 0.48, 0.82, CT + 0.26, CT + 0.3, SZ - 0.2, SZ - 0.12, M["black"], 0.01))
pc.append(sphere("Coconut", 0.09, (0.1, -(SZ - 0.25), CT + 0.09), M["post"], 10, 8))
pc.append(rod("CocoStraw", (0.1, CT + 0.15, SZ - 0.25), (0.15, CT + 0.32, SZ - 0.2), 0.008, M["pink"], 5))
for k, m in enumerate((M["pink"], M["sun"], M["lime"], M["orange"])):
    lei = torus("Lei", 0.16, 0.04, (0, 0, 0), m, 14, 5)
    lei.scale = (0.75, 0.75, 1.2)
    lei.rotation_euler = (PI / 2, 0, 0)
    lei.location = (-SX + 0.25 + k * 0.32, -(SZ + 0.06), 1.92)
    apply_all(lei)
    pc.append(lei)
pc.append(plane("Menu", 0.8, 1.0, (0.2, -(-SZ + 0.06), 1.75), signmat("shack_menu", 0.8)))
pc.append(plane("TreatsTag", 0.5, 0.25, (0.95, -(SZ + 0.025), 0.92), signmat("dog_treats", 0.55)))
# two boards leaning on the back, outside
for k, (dx, img) in enumerate(((-0.45, "board_2"), (0.25, "board_6"))):
    b = lb("LeanBoard", dx - 0.27, dx + 0.27, 0.0, 2.1, -SZ - 0.12, -SZ - 0.06, M["white"], 0.12)
    pc.append(b)
    pc.append(plane("LeanBoardDeck", 0.5, 2.0, (dx, -(-SZ - 0.13), 1.05), signmat(img, 0.4), rot=(PI / 2, 0, PI)))
add("shack", yawed(pc, ss["x"], ss["z"], PI / 2, "SurfShack"))

# ---- the lifeguard tower -----------------------------------------------------------------------------------------------------------
tw = next(f for f in FURNITURE if f["kind"] == "lifeguard-tower")
TX, TZ = tw["x"], tw["z"]
F0 = 2.05  # its floor
pc = []
for sx in (-0.7, 0.7):
    for sz in (-0.7, 0.7):
        pc.append(lb("TowerLeg", sx - 0.07, sx + 0.07, 0, F0, sz - 0.07, sz + 0.07, M["white"], 0.015))
for y in (0.55, 1.35):
    for sz in (-0.7, 0.7):
        pc.append(lb("TowerBrace", -0.7, 0.7, y - 0.04, y + 0.04, sz - 0.04, sz + 0.04, M["white"], 0.01))
pc.append(rod("TowerX", (-0.7, 0.2, -0.7), (0.7, 1.9, -0.7), 0.035, M["white"]))
pc.append(rod("TowerX", (0.7, 0.2, -0.7), (-0.7, 1.9, -0.7), 0.035, M["white"]))
pc.append(lb("TowerDeck", -1.0, 1.0, F0, F0 + 0.1, -1.0, 1.0, M["teak"], 0.01))
pc.append(lb("TowerHut", -0.75, 0.75, F0 + 0.1, F0 + 1.75, -0.75, 0.6, M["sky"], 0.02))
# windows on three sides: dark glass, white frames
for x0, x1, z0, z1 in ((-0.55, 0.55, 0.6, 0.62), (0.75, 0.77, -0.5, 0.45), (-0.77, -0.75, -0.5, 0.45)):
    pc.append(lb("TowerWindow", x0, x1, F0 + 0.75, F0 + 1.45, z0, z1, sm("window", "#2d5f70", 0.12), 0.0))
for k in range(7):
    y = F0 + 0.25 + k * 0.2
    pc.append(lb("Clapboard", -0.77, 0.77, y, y + 0.025, -0.77, 0.62, sm("sky_dark", "#4f9fca", 0.45), 0.0))
for sx in (-0.75, 0.75):
    for sz in (-0.75, 0.6):
        pc.append(lb("TowerTrim", sx - 0.05, sx + 0.05, F0 + 0.1, F0 + 1.75, sz - 0.05, sz + 0.05, M["white"], 0.01))
pc.append(lb("TowerDoor", -0.3, 0.3, F0 + 0.1, F0 + 1.55, -0.79, -0.76, M["coral"], 0.01))
pc.append(lb("TowerRoof", -1.05, 1.05, F0 + 1.75, F0 + 1.88, -1.05, 0.95, M["red"], 0.03))
pc.append(lb("TowerRoofTop", -0.8, 0.8, F0 + 1.88, F0 + 2.0, -0.8, 0.7, M["sun"], 0.03))
for sx in (-1.0, 1.0):
    pc.append(lb("TowerRail", sx - 0.025, sx + 0.025, F0 + 0.1, F0 + 1.0, -1.0, 1.0, M["white"], 0.008))
pc.append(lb("TowerRailTop", -1.0, 1.0, F0 + 0.95, F0 + 1.02, 0.97, 1.02, M["white"], 0.008))
pc.append(lb("TowerSignBack", -0.8, 0.8, F0 + 1.47, F0 + 1.75, 0.6, 0.64, M["red"], 0.01))
pc.append(front_pic("lifeguard", 1.55, 1.55 * 192 / 768, F0 + 1.61, 0.64))
pc.append(front_pic("red_cross", 0.42, 0.42, F0 + 0.55, 0.62, x=0.5))
pc.append(front_pic("flag_board", 0.6, 0.45, 1.0, 0.78))
pc.append(lb("FlagBoardBack", -0.32, 0.32, 0.76, 1.24, 0.71, 0.78, M["teak"], 0.01))
# the life ring's board between the front legs (the game hangs the ring at 1.65 m on the peg), a rescue can, binoculars
pc.append(lb("RingBoard", -0.55, 0.55, 1.1, 2.0, 0.66, 0.72, M["coral"], 0.01))
pc.append(rod("RingPeg", (0, 1.95, 0.72), (0, 1.95, 0.95), 0.04, M["post"], 8))
pc.append(cyl("RescueCan", 0.1, 0.7, (-0.95, -0.2, F0 + 0.55), M["red"], 12, rot=(0, 0, 0)))
pc.append(sphere("RescueCanEnd", 0.1, (-0.95, -0.2, F0 + 1.25), M["red"], 10, 6))
pc.append(sphere("RescueCanEnd", 0.1, (-0.95, -0.2, F0 + 0.55), M["red"], 10, 6))
for dz in (-0.06, 0.06):
    pc.append(cyl("TowerBinocular", 0.04, 0.16, (0.55 + dz, -0.9, F0 + 1.02), M["black"], 10, rot=(PI / 2, 0, 0)))
# the ladder at the back, the flag on the roof
for sx in (-0.3, 0.3):
    pc.append(rod("LadderRail", (sx, 0, -1.25), (sx, F0 + 0.1, -0.95), 0.03, M["white"], 6))
for k in range(6):
    y = 0.3 + k * 0.32
    zz = -1.25 + 0.3 * (y / F0)
    pc.append(rod("LadderRung", (-0.3, y, zz), (0.3, y, zz), 0.022, M["white"], 6))
pc.append(cyl("TowerFlagPole", 0.025, 1.6, (0.6, 0.6, F0 + 2.0), M["white"], 8))
flag = lb("TowerFlag", 0.62, 0.64, F0 + 3.05, F0 + 3.5, -0.6, 0.0, M["sun"], 0.0)
pc.append(flag)
pc.append(lb("TowerFlagStripe", 0.615, 0.645, F0 + 3.05, F0 + 3.2, -0.6, 0.0, M["red"], 0.0))
add("tower", yawed(pc, TX, TZ, PI / 2, "LifeguardTower"))

# ---- WATER CARE in the service yard, EYE CARE at the right end -----------------------------------------------------------------------
ch = STATIONS["chlorine"]
# (local: +z faces the game's -x, the deck and the camera; local x runs along the game's z; yawed by -π/2)
pc = []
pc.append(lb("CarePallet", -0.85, 0.85, 0, 0.14, -0.55, 0.55, M["teak"], 0.01))
DX, DZ = 0.3, -0.35  # the drum, under the pipe bridge from the wave house (props_house.py)
pc.append(lb("DrumStand", DX - 0.33, DX + 0.33, 0.14, 0.3, DZ - 0.33, DZ + 0.33, M["iron"], 0.01))
pc.append(cyl("Drum", 0.3, 0.9, (DX, -DZ, 0.3), M["blue_drum"], 18))
for y in (0.55, 0.9):
    pc.append(torus("DrumRib", 0.305, 0.015, (DX, -DZ, y), M["blue_drum"], 18, 4))
pc.append(cyl("DrumBung", 0.05, 0.03, (DX + 0.15, -DZ, 1.2), M["white"], 8))
pc.append(lb("PhCan", -0.7, -0.4, 0.14, 0.62, -0.1, 0.25, M["sun"], 0.03))
pc.append(cyl("PhCap", 0.04, 0.06, (-0.6, -0.15, 0.62), M["red"], 8))
pc.append(lb("TestKit", -0.3, 0.1, 0.14, 0.32, 0.15, 0.45, M["white"], 0.01))
for k, m in enumerate((M["red"], M["sun"], M["plastic_b"])):
    pc.append(cyl("TestVial", 0.02, 0.12, (-0.22 + k * 0.1, -0.3, 0.32), m, 8))
pc.append(cyl("Scoop", 0.06, 0.06, (0.45, -0.35, 0.14), M["white"], 10))
pc.append(rod("ScoopHandle", (0.45, 0.17, 0.35), (0.62, 0.2, 0.48), 0.012, M["white"], 5))
for sx in (-0.75, 0.75):
    pc.append(lb("CarePost", sx - 0.05, sx + 0.05, 0, 2.55, -0.6, -0.5, M["post"], 0.01))
pc.append(lb("CareBoard", -0.8, 0.8, 1.85, 2.45, -0.57, -0.52, M["teal"], 0.01))
pc += painted("water_care", 1.5, 0.62, 2.15, -0.52, -0.57)
cap = lifeguard_cap(1.6, 2.55, 0.22)
for o in cap:
    o.location = (o.location[0], o.location[1] + 0.55, o.location[2])
    apply_all(o)
pc += cap
add("stations", yawed(pc, ch["x"], ch["z"], -PI / 2, "WaterCare"))

rl = STATIONS["relief"]
pc = []
pc.append(lb("Grate", -0.85, 0.85, 0, 0.05, -0.55, 0.55, M["teak"], 0.005))
for k in range(8):
    x = -0.75 + k * 0.215
    pc.append(lb("GrateSlat", x - 0.06, x + 0.06, 0.05, 0.08, -0.5, 0.5, M["teak"], 0.005))
# the beach shower: a chrome post, a big round head
pc.append(cyl("ShowerPost", 0.045, 2.35, (-0.55, 0.3, 0.0), M["chrome"], 10))
pc.append(rod("ShowerArm", (-0.55, 2.3, -0.3), (-0.55, 2.3, 0.15), 0.03, M["chrome"], 8))
pc.append(cyl("ShowerHead", 0.17, 0.06, (-0.55, -0.15, 2.22), M["chrome"], 16, r2=0.12))
pc.append(rod("ShowerChain", (-0.55, 2.2, -0.25), (-0.55, 1.5, -0.25), 0.006, M["chrome"], 4))
pc.append(sphere("ShowerPull", 0.03, (-0.55, 0.25, 1.48), M["red"], 8, 6))
# the eyewash: a green pedestal, twin bowls, the yellow sign on a post
pc.append(cyl("EyePedestal", 0.07, 0.95, (0.35, 0.1, 0.05), M["green"], 12))
pc.append(cyl("EyeBowl", 0.24, 0.12, (0.35, 0.1, 1.0), M["green"], 18, r2=0.3))
for dz in (-0.07, 0.07):
    pc.append(cyl("EyeNozzle", 0.025, 0.06, (0.35 + dz, 0.1, 1.08), M["sun"], 8))
pc.append(lb("TowelBar", 0.6, 0.82, 1.2, 1.24, -0.4, -0.36, M["chrome"], 0.005))
pc.append(towel_hanging("EyeTowel", 0.28, 0.45, M["towel"], M["teal"], (0.71, 0.38, 1.21), 0.0))
for sx in (-0.75, 0.75):
    pc.append(lb("ReliefPost", sx - 0.05, sx + 0.05, 0, 2.7, -0.52, -0.42, M["post"], 0.01))
pc.append(lb("ReliefBoard", -0.8, 0.8, 2.0, 2.62, -0.5, -0.45, sm("reliefblue", "#3a8fd0", 0.45), 0.01))
pc += painted("eye_care", 1.5, 0.62, 2.31, -0.45, -0.5)
cap = lifeguard_cap(1.6, 2.7, 0.22)
for o in cap:
    o.location = (o.location[0], o.location[1] + 0.47, o.location[2])
    apply_all(o)
pc += cap
add("stations", yawed(pc, rl["x"], rl["z"], PI, "EyeCare"))

# ---- the near wall: two ring boards, the fish net's, the skimmer's -------------------------------------------------------------------
for k, mnt in enumerate(RING_MOUNTS):
    if k == 1:
        add("rings", torus("LifeRing", 0.4, 0.1, g(mnt["x"], 1.65, mnt["z"]), M["ring"], 16, 6))
        continue  # (the tower's: its board is the tower's)
    rb_ = [lb("RingBoard", -0.62, 0.62, 0.95, 2.45, -0.245, -0.115, M["red"], 0.02)]
    rb_ += painted("life_ring", 1.18, 0.49, 2.72, -0.115, -0.245)
    rb_.append(lb("RingSignBack", -0.62, 0.62, 2.45, 3.0, -0.21, -0.15, M["teal"], 0.01))
    for s_ in (-1, 1):
        rb_.append(lb("RingPost", s_ * 0.66 - 0.05, s_ * 0.66 + 0.05, 0, 3.15, -0.24, -0.12, M["post"], 0.01))
    cap = lifeguard_cap(1.32, 3.12, 0.22)
    for o in cap:
        o.location = (o.location[0], o.location[1] + 0.18, o.location[2])
        apply_all(o)
    rb_ += cap
    rb_.append(rod("RingPeg", (0, 2.25, -0.12), (0, 2.25, 0.16), 0.05, M["post"], 8))
    add("rings", yawed(rb_, mnt["x"], mnt["z"], mnt["angle"], f"RingBoard{k}"))
    add("rings", torus("LifeRing", 0.4, 0.1, g(mnt["x"], 1.65, mnt["z"]), M["ring"], 16, 6))
fn = FIXTURES["fishNet"]
fb = [lb("NetBoard", -0.66, 0.66, 0.05, 2.85, -0.245, -0.115, M["navy"], 0.02)]
for s_ in (-1, 1):
    fb.append(lb("NetPost", s_ * 0.7 - 0.05, s_ * 0.7 + 0.05, 0, 3.5, -0.24, -0.12, M["post"], 0.01))
fb += painted("fish_net", 1.24, 0.52, 3.15, -0.115, -0.245)
fb.append(lb("NetSignBack", -0.66, 0.66, 2.85, 3.45, -0.21, -0.15, M["navy"], 0.01))
cap = lifeguard_cap(1.4, 3.47, 0.22)
for o in cap:
    o.location = (o.location[0], o.location[1] + 0.18, o.location[2])
    apply_all(o)
fb += cap
add("rings", yawed(fb, fn["x"], fn["z"], fn["angle"], "FishNetBoard"))
sk = SANITATION["rack"]
wallX = DECK["minX"] - 0.45
sb = [box("SkimmerBoard", wallX - 0.08, wallX + 0.08, 1.12, 2.37, sk["z"] - 1.95, sk["z"] + 1.95, sm("skimgreen", "#3d8a5a", 0.5), 0.02)]
for zz in (sk["z"] - 1.85, sk["z"] + 1.85):
    sb.append(box("SkimmerPost", wallX - 0.07, wallX + 0.07, 0, 3.2, zz - 0.07, zz + 0.07, M["post"], 0.01))
title = [lb("SkimTitleBoard", -0.72, 0.72, 2.45, 3.05, -0.03, 0.03, sm("skimgreen", "#3d8a5a", 0.5), 0.01)]
title += painted("skimmer", 1.4, 0.58, 2.75, 0.03, -0.03)
cap = lifeguard_cap(1.44, 3.08, 0.2)
title += cap
add("sanitation", *sb, yawed(title, wallX, sk["z"], PI / 2, "SkimmerTitle"))

# ---- the waste bin: a fat teal fish, its mouth open to the sky (FEED ME) -------------------------------------------------------------
bn = SANITATION["bin"]
fish = []
body = sphere("FishBin", 0.5, (0, 0, 0.62), M["teal"], 20, 14, scale=(0.95, 0.85, 1.25))
fish.append(body)
fish.append(cyl("FishMouth", 0.36, 0.12, (0, 0, 1.18), M["coral"], 18, r2=0.4))
fish.append(cyl("FishThroat", 0.33, 0.02, (0, 0, 1.29), M["black"], 18))
for sx in (-1, 1):
    fish.append(sphere("FishEye", 0.13, (sx * 0.26, -0.33, 0.98), M["white"], 12, 8))
    fish.append(sphere("FishPupil", 0.06, (sx * 0.28, -0.44, 1.0), M["black"], 8, 6))
    fin = sphere("FishFin", 0.2, (sx * 0.5, 0.0, 0.62), M["sun"], 10, 6, scale=(0.3, 0.9, 0.6))
    fish.append(fin)
fish.append(sphere("FishTail", 0.28, (0, 0.52, 0.42), M["sun"], 10, 6, scale=(0.2, 0.9, 1.0)))
for k in range(3):
    fish.append(torus("FishStripe", 0.48 - abs(k - 1) * 0.06, 0.02, (0, 0, 0.42 + k * 0.25), M["navy"], 20, 4))
fish.append(plane("FeedMe", 0.55, 0.28, (0, -0.47, 0.5), signmat("waste", 0.55), rot=(PI / 2 - 0.15, 0, 0)))
fobj = join(fish, "FishBinAll")
fobj.rotation_euler = (0, 0, PI / 2)  # (its face to the pool, the game's +x)
fobj.location = g(bn["x"], 0, bn["z"])
apply_all(fobj)
add("sanitation", fobj)

# ---- the torch's bollard, the fuse box's conduits and sign --------------------------------------------------------------------------
fl = FIXTURES["flashlight"]
fp = []
for k in range(4):
    fp.append(cyl("Bollard", 0.13, 0.28, g(fl["x"], k * 0.28, fl["z"]), M["coral"] if k % 2 == 0 else M["cream"], 14))
fp.append(cyl("BollardShelf", 0.22, 0.05, g(fl["x"], 1.12, fl["z"]), M["navy"], 16))
fp.append(cyl("BollardLip", 0.23, 0.04, g(fl["x"], 1.17, fl["z"]), M["sun"], 16))
fp.append(cyl("Flashlight", 0.06, 0.3, g(fl["x"], 1.09, fl["z"]), M["iron"], 8))  # (its middle, 1.24 m up: the game's torch)
add("fixtures", *fp)
fu = FIXTURES["fuseBox"]
wx = ROOM["maxX"] - 0.3  # the yard's end wall's face
for dz, h in ((-0.25, 2.3), (0.0, 2.4), (0.25, 2.2)):
    add("fixtures", box("Conduit", wx - 0.06, wx - 0.0, 1.3, h, fu["z"] + dz - 0.025, fu["z"] + dz + 0.025, M["steel"], 0.01))
add("fixtures", box("ConduitBox", wx - 0.12, wx, 2.2, 2.5, fu["z"] - 0.4, fu["z"] + 0.4, M["steel"], 0.01))
add("fixtures", plane("FuseSign", 0.6, 0.375, g(wx - 0.012, 1.65, fu["z"] + 0.85), signmat("fuse", 0.55), rot=(PI / 2, 0, -PI / 2)))
add("fixtures", box("FuseSignBack", wx - 0.01, wx, 1.45, 1.85, fu["z"] + 0.53, fu["z"] + 1.17, M["sun"], 0.0))

# ---- the service yard: the machine's pipes along the wall, a pegboard of tools, chlorine tubs and a coiled hose -------------------
YZ = ROOM["minZ"] + 0.15 + 0.17  # the yard wall's inner face
for y, m in ((1.75, M["teal"]), (1.95, M["sun"])):
    # (along the yard's wall to its corner, then up into the cap: clear of the game's fuse box on the end wall)
    add("yard", poly_tube("YardPipe", [g(7.6, y, YZ + 0.12), g(14.3 - (y - 1.75), y, YZ + 0.12), g(14.3 - (y - 1.75), 2.45, YZ + 0.12)], 0.06, m, 10, 0.12))
for x in (8.4, 10.2, 12.0, 13.8):
    add("yard", box("PipeBracket", x - 0.04, x + 0.04, 1.6, 2.08, YZ, YZ + 0.2, M["iron"], 0.005))
    add("yard", torus("PipeFlange", 0.075, 0.02, g(x + 0.3, 1.75, YZ + 0.12), M["steel"], 12, 4, rot=(0, PI / 2, 0)))
add("yard", box("Pegboard", 11.0, 12.6, 0.6, 1.5, YZ, YZ + 0.03, M["teak"], 0.01))
for k, (dx, w_, h_) in enumerate(((0.2, 0.06, 0.5), (0.5, 0.25, 0.08), (0.8, 0.05, 0.42), (1.1, 0.3, 0.12), (1.35, 0.07, 0.35))):
    add("yard", box("Tool", 11.0 + dx - w_ / 2, 11.0 + dx + w_ / 2, 1.05 - h_ / 2, 1.05 + h_ / 2, YZ + 0.03, YZ + 0.06, M["iron"] if k % 2 else M["red"], 0.01))
for k in range(3):
    add("yard", cyl("ChlorineTub", 0.22, 0.4, g(13.3 + k * 0.48, 0, YZ + 0.35), M["white"], 14, r2=0.24))
    add("yard", cyl("TubLid", 0.25, 0.05, g(13.3 + k * 0.48, 0.4, YZ + 0.35), M["plastic_b"], 14))
add("yard", cyl("ChlorineTub", 0.22, 0.4, g(13.54, 0.45, YZ + 0.35), M["white"], 14, r2=0.24))
add("yard", torus("YardHose", 0.32, 0.04, g(8.6, 1.1, YZ + 0.08), M["sun"], 24, 6, rot=(PI / 2, 0, 0)))
add("yard", torus("YardHose", 0.25, 0.04, g(8.6, 1.1, YZ + 0.12), M["sun"], 24, 6, rot=(PI / 2, 0, 0)))
add("yard", rod("HoseHook", (8.6, 1.4, YZ), (8.6, 1.4, YZ + 0.2), 0.025, M["iron"], 6))
add("yard", plane("YardDanger", 0.6, 0.375, g(9.6, 1.6, YZ + 0.012), signmat("fuse", 0.55), rot=(PI / 2, 0, 0)))

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("st_hut", g(TH["x"], 1.2, TH["z"]), 5.5, 16, 250, (960, 640), 18, 35)
    look("st_shack", g(ss["x"], 1.4, ss["z"]), 6, 16, 250, (960, 640), 18, 35)
    look("st_tower", g(TX, 2.0, TZ), 7, 14, 260, (960, 640), 18, 35)
    look("st_near", g(-14.8, 1.6, 2.0), 11, 14, 270, (1280, 720), 18, 30)
    look("st_care", g(ch["x"], 1.2, ch["z"]), 4.5, 16, 300, (960, 640), 18, 35)
    look("st_eye", g(rl["x"], 1.2, rl["z"]), 4.5, 16, 220, (960, 640), 18, 35)
save_part("stations", [o for v in parts.values() for o in v if o])
