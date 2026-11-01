"""The Wave Pool's wave house, the park's landmark, in game coordinates (kit: FRONT, the chambers from the game's plan): a
streamline-moderne surf temple of cream stucco across the whole far side.

- The front wall at the waterline with the five wave chambers (scene/wave.mjs CHAMBERS): each an arch in a band of Malibu tile with
  a coral keystone and its number, a dark tunnel going back into the machine, a riveted steel grille; the wall below the water in
  glass mosaic with the waterline band; between the arches porthole lamps and DANGER: WAVE CHAMBER signs; the LED board's frame over
  the middle chamber (the game draws its words: `Anchor_LED`), the water surging in each chamber is the game's (`Anchor_Surge`).
- The terrace over the chambers: a coral fascia with chrome speed lines and the machine's brass plate (WAVE-O-MATIC MK II), teak
  decking, a chrome rail; on it the judges' booth (a striped canopy, three score cards: 10, 9.5, 2; a megaphone; binoculars), a tall
  lifeguard's chair under a red umbrella, two retro spotlights aimed at the waves, potted palms, life rings on the rail, a rack of
  boards against the wall.
- The upper storey set back, its corners rounded, speed stripes wrapping round them, portholes, vertical fins; the fal-painted
  mural (a smiling sun, a surfer and an octopus in sunglasses riding the wave) framed in teal on its face.
- Two lighthouse turrets on the terrace's corners, red and cream, a gallery and a rail, a glass lantern (the game's beacon turns in
  it: `Anchor_Beacon`), a siren horn aimed at the pool, a little door.
- On the roof the WAVE POOL sign on a steel truss (the game's bulbs chase round it: `Anchor_BulbLow`/`Anchor_BulbHigh`), a neon wave
  curl over it, six flag poles (the game's flags flap on them: `Anchor_Flag`), a water tank, vents.
- Its ends: on the left the wave machine's door (AUTHORISED STAFF ONLY · KNOCK LOUDLY), the big pipes going into it with flanges,
  red valve wheels and gauges, a pipe bridge over the walk to the water care, a ladder to the terrace, louvred vents; on the right a
  hose reel, a fire extinguisher's cabinet and the siren's warning (hold on to your trunks).

    blender -b -P tools/venues/wave/props_house.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
import trees  # noqa: E402

reset()
LOOK = "--look" in args()
R = random.Random(907)
TAU = 2 * PI
M = dict(
    stucco=tmat_tile("stucco", "#f7efe0", 0.88),
    malibu=tmat_tile("malibu", "#e9c879", 0.25),
    pool=tmat_tile("glass_mosaic", "#6fd0d2", 0.2),
    band=tmat_tile("mosaic_band", "#1f9aa0", 0.22),
    teak=tmat_tile("teak", "#b57a43", 0.55),
    tunnel=sm("tunnel", "#0b1f27", 0.9),
    coral=sm("coral"),
    coral_dark=sm("coral_dark"),
    cream=sm("cream"),
    teal=sm("teal"),
    teal_dark=sm("teal_dark"),
    sun=sm("sun"),
    navy=sm("navy"),
    navy_dark=sm("navy_dark"),
    chrome=sm("chrome"),
    steel=sm("steel"),
    iron=sm("iron"),
    brass=sm("brass"),
    white=sm("white"),
    red=sm("red"),
    black=sm("black"),
    canvas=sm("canvas"),
    window=sm("window", "#2d5f70", 0.12),
    glass=sm("glass", "#cfeef5", 0.05, alpha=0.3),
    sconce=lamp_mat("sconce_glass", "#ffe2a8", 4.0),
    neon=lamp_mat("neon_blue", "#86ecff", 5.0),
    rubber=sm("rubber"),
    terracotta=sm("terracotta"),
    ring=sm("ring_orange", "#f47742", 0.5),
)
parts = []


def P_(*objs):
    parts.extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def anchor(name, x, y, z):
    """A place the game puts one of its moving parts (left out of the model; its centre recorded)."""
    return sphere("Anchor_" + name, 0.05, g(x, y, z), M["white"], 6, 4)


def pic_x(name, w, h, x, y, z, img, facing=-1, rough=0.5):
    """A picture standing in the plane x = const, facing -x (or +x)."""
    return plane(name, w, h, g(x, y, z), signmat(img, rough), rot=(PI / 2, 0, -PI / 2 if facing < 0 else PI / 2))


def pic_z(name, w, h, x, y, z, img, facing=-1, rough=0.5):
    """A picture in the plane z = const, facing -z (or +z)."""
    return plane(name, w, h, g(x, y, z), signmat(img, rough), rot=(PI / 2, 0, PI if facing > 0 else 0))


def prism(name, pts, a0, a1, axis, m, side_m=None):
    """A closed polygon extruded: axis "x" (pts are (z, y), from x a0 to a1) or "y" (pts are (x, z), from y a0 to a1). `side_m(i)`
    may give each side face (the edge from pts[i] to pts[i+1]) its own material index (1: the second material)."""
    bm = bmesh.new()

    def P3(p, a):
        return g(a, p[1], p[0]) if axis == "x" else g(p[0], a, p[1])

    f0 = [bm.verts.new(P3(p, a0)) for p in pts]
    f1 = [bm.verts.new(P3(p, a1)) for p in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((f0[i], f0[j], f1[j], f1[i]))
        if side_m:
            f.material_index = side_m(i)
    for ring in (f0, f1):
        edges = [bm.edges.get((ring[i], ring[(i + 1) % n])) or bm.edges.new((ring[i], ring[(i + 1) % n])) for i in range(n)]
        bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    if side_m:
        o.data.materials.append(side_m.material)
    return o


def arch_pts(zc, r, y_spring, y_bottom, n=18):
    """An arched opening's outline in (z, y), from its bottom left, up, over and down: its edges in order."""
    pts = [(zc - r, y_bottom), (zc - r, y_spring)]
    for k in range(1, n):
        a = PI - PI * k / n
        pts.append((zc + r * math.cos(a), y_spring + r * math.sin(a)))
    pts += [(zc + r, y_spring), (zc + r, y_bottom)]
    return pts


HR = CHAMBER_W / 2  # the arches' radius
WALL_TOP = 2.8
WB = -2.6  # the wall's foot, under the deep end's floor

# ---- the front wall: the arches cut through it, the tunnels dark inside ----------------------------------------------------------
outline = [(-HOUSE_HZ, WALL_TOP), (-HOUSE_HZ, WB)]
inner_edges = set()
for zc in CHAMBERS:
    a = arch_pts(zc, HR, ARCH_SPRING, WB)
    start = len(outline)
    outline += a
    for i in range(start, start + len(a) - 1):
        inner_edges.add(i)
outline += [(HOUSE_HZ, WB), (HOUSE_HZ, WALL_TOP)]
# a lip of stucco at the front, then the tunnels dark back to the machine
P_(prism("FrontLip", outline, FRONT, FRONT + 0.22, "x", M["stucco"]))


class Dark:
    material = M["tunnel"]

    def __call__(self, i):
        return 1 if i in inner_edges else 0


P_(prism("FrontDeep", outline, FRONT + 0.22, 9.6, "x", M["stucco"], Dark()))
# the machine hall behind, the tunnels' back plates in the dark
P_(box("MachineHall", 9.6, BACK, WB, TERRACE_Y, -HOUSE_HZ, HOUSE_HZ, M["stucco"], 0.02))
for zc in CHAMBERS:
    P_(box("TunnelBack", 9.55, 9.6, WB, ARCH_SPRING + HR, zc - HR, zc + HR, M["tunnel"], 0))

# the arches' Malibu surrounds, keystones, numbers; the grilles
SW = 0.26
for k, zc in enumerate(CHAMBERS):
    ring = [(zc - HR - SW, -0.3), (zc - HR - SW, ARCH_SPRING)]
    for j in range(1, 24):
        a = PI - PI * j / 24
        ring.append((zc + (HR + SW) * math.cos(a), ARCH_SPRING + (HR + SW) * math.sin(a)))
    ring += [(zc + HR + SW, ARCH_SPRING), (zc + HR + SW, -0.3), (zc + HR, -0.3), (zc + HR, ARCH_SPRING)]
    for j in range(1, 24):
        a = PI * j / 24
        ring.append((zc + HR * math.cos(a), ARCH_SPRING + HR * math.sin(a)))
    ring += [(zc - HR, ARCH_SPRING), (zc - HR, -0.3)]
    P_(prism("ArchTile", ring, FRONT - 0.03, FRONT + 0.01, "x", M["malibu"]))
    top = ARCH_SPRING + HR + SW
    ky0 = top - 0.36 if zc != 0 else top - 0.34
    P_(prism("Keystone", [(zc - 0.2, ky0), (zc + 0.2, ky0), (zc + 0.27, top + (0.12 if zc != 0 else 0.0)), (zc - 0.27, top + (0.12 if zc != 0 else 0.0))], FRONT - 0.07, FRONT + 0.01, "x", M["coral"]))
    P_(pic_x("ChamberNo", 0.3, 0.375, FRONT - 0.075, (ky0 + top) / 2 + 0.02, zc, f"chamber_{k + 1}"))
    # the grille, a little back in the opening: bars down into the water, two flat bars across, rivets
    gx = FRONT + 0.3
    for b in range(-4, 5):
        dz = b * 0.27
        ytop = ARCH_SPRING + math.sqrt(max(0.0, HR * HR - dz * dz)) - 0.04
        P_(cyl("GrilleBar", 0.03, ytop + 2.4, g(gx, -2.4, zc + dz), M["navy"], 8))
    for y in (0.15, ARCH_SPRING + 0.02):
        P_(box("GrilleFlat", gx - 0.04, gx + 0.04, y - 0.05, y + 0.05, zc - HR + 0.02, zc + HR - 0.02, M["navy"], 0.01))
        for b in range(-4, 5):
            P_(box("Rivet", gx - 0.06, gx - 0.035, y - 0.012, y + 0.012, zc + b * 0.27 - 0.012, zc + b * 0.27 + 0.012, M["steel"], 0))
    P_(anchor("Surge", FRONT + 0.4, WATER_Y, zc))

# the wall's face below the water: glass mosaic, the waterline band
piers = [(-HOUSE_HZ, CHAMBERS[0] - HR)] + [(CHAMBERS[i] + HR, CHAMBERS[i + 1] - HR) for i in range(4)] + [(CHAMBERS[-1] + HR, HOUSE_HZ)]
for z0, z1 in piers:
    P_(box("PierTile", FRONT - 0.012, FRONT, WB, -0.42, z0 + 0.0, z1 - 0.0, M["pool"], 0))
    P_(box("PierBand", FRONT - 0.014, FRONT, -0.42, -0.02, z0, z1, M["band"], 0))
    zc = (z0 + z1) / 2
    # a porthole lamp on every pier
    P_(torus("Porthole", 0.17, 0.035, g(FRONT - 0.035, 1.6, zc), M["brass"], 16, 6, rot=(0, PI / 2, 0)))
    P_(cyl("Light_Sconce", 0.15, 0.03, g(FRONT - 0.05, 1.6, zc), M["sconce"], 20, rot=(0, PI / 2, 0)))
    for a in range(6):
        aa = a * TAU / 6
        P_(box("PortBolt", FRONT - 0.05, FRONT - 0.02, 1.6 + math.sin(aa) * 0.21 - 0.015, 1.6 + math.sin(aa) * 0.21 + 0.015, zc + math.cos(aa) * 0.21 - 0.015, zc + math.cos(aa) * 0.21 + 0.015, M["brass"], 0))
    # the signs: DANGER on the inner piers, the siren's warning on the ends
    if abs(zc) < 8:
        P_(pic_x("ChamberWarn", 0.5, 0.333, FRONT - 0.012, 0.78, zc, "chamber_warn"))
    else:
        P_(pic_x("SirenWarn", 0.62, 0.39, FRONT - 0.012, 0.8, zc - math.copysign(0.25, zc), "siren_warn"))
    # cleats for ropes, a little brass, just above the water
    P_(box("Cleat", FRONT - 0.09, FRONT, 0.12, 0.17, zc - 0.16, zc + 0.16, M["brass"], 0.02))

# the LED board's frame over the middle chamber (the game draws the words on its face: `Anchor_LED`)
L = LED
P_(box("LedFrame", L["x"] + 0.01, FRONT + 0.01, L["y"] - L["h"] / 2 - 0.04, L["y"] + L["h"] / 2 + 0.07, -L["w"] / 2 - 0.08, L["w"] / 2 + 0.08, M["navy_dark"], 0.03))
P_(box("LedHood", L["x"] - 0.12, FRONT, L["y"] + L["h"] / 2 + 0.06, L["y"] + L["h"] / 2 + 0.1, -L["w"] / 2 - 0.12, L["w"] / 2 + 0.12, M["chrome"], 0.015))
P_(anchor("LED", L["x"], L["y"], 0.0))

# ---- the terrace: the fascia, the decking, the rail --------------------------------------------------------------------------------
P_(box("TerraceSlab", FRONT - 0.05, 9.6, WALL_TOP, TERRACE_Y - 0.03, -HOUSE_HZ - 0.05, HOUSE_HZ + 0.05, M["stucco"], 0.02))
P_(box("TerraceDeck", FRONT - 0.02, 9.6, TERRACE_Y - 0.03, TERRACE_Y, -HOUSE_HZ, HOUSE_HZ, M["teak"], 0.004))
P_(box("Fascia", FRONT - 0.09, FRONT - 0.04, WALL_TOP, TERRACE_Y, -HOUSE_HZ - 0.06, HOUSE_HZ + 0.06, M["coral"], 0.015))
for y in (2.87, 2.96, 3.05):
    for s in (-1, 1):
        z0, z1 = (0.62, HOUSE_HZ + 0.02) if s > 0 else (-HOUSE_HZ - 0.02, -0.62)
        P_(box("SpeedLine", FRONT - 0.11, FRONT - 0.085, y - 0.012, y + 0.012, z0, z1, M["chrome"], 0.004))
P_(pic_x("LedPlate", 1.08, 0.2, FRONT - 0.095, 2.975, 0.0, "led_plate", rough=0.3))
RAIL_X = FRONT + 0.12
for s in (-1, 1):
    zs = [s * (0.15 + k * 1.2) for k in range(8)]
    for z in zs:
        P_(cyl("RailPost", 0.025, 1.0, g(RAIL_X, TERRACE_Y, z), M["chrome"], 8))
for y, r in ((TERRACE_Y + 1.0, 0.035), (TERRACE_Y + 0.65, 0.016), (TERRACE_Y + 0.33, 0.016)):
    P_(rod("Rail", (RAIL_X, y, -8.85), (RAIL_X, y, 8.85), r, M["chrome"], 10))
# life rings on the rail (decor: the game's three rings are on their own boards)
for z in (-6.45, 6.45):
    P_(torus("DecorRing", 0.3, 0.07, g(RAIL_X - 0.08, TERRACE_Y + 0.62, z), M["ring"], 28, 10, rot=(PI / 2, 0, PI / 2)))
    for a in range(4):
        aa = a * TAU / 4 + PI / 4
        P_(box("RingTape", RAIL_X - 0.16, RAIL_X, TERRACE_Y + 0.62 + math.sin(aa) * 0.3 - 0.04, TERRACE_Y + 0.62 + math.sin(aa) * 0.3 + 0.04, z + math.cos(aa) * 0.3 - 0.06, z + math.cos(aa) * 0.3 + 0.06, M["white"], 0.01))

# ---- on the terrace -----------------------------------------------------------------------------------------------------------------
TY = TERRACE_Y


def canopy_stripes(x0, x1, z0, z1, y, mats, n=8, slope=0.18):
    out = []
    for i in range(n):
        za, zb = z0 + (z1 - z0) * i / n, z0 + (z1 - z0) * (i + 1) / n
        out.append(quad(za, zb, x0, x1, y, slope, mats[i % 2]))
    return out


def quad(za, zb, x0, x1, y, slope, m):
    bm = bmesh.new()
    vs = [bm.verts.new(g(x0, y - slope, za)), bm.verts.new(g(x0, y - slope, zb)), bm.verts.new(g(x1, y, zb)), bm.verts.new(g(x1, y, za))]
    bm.faces.new(vs)
    me = bpy.data.meshes.new("Canopy")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Canopy", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    s = o.modifiers.new("S", "SOLIDIFY")
    s.thickness = 0.02
    apply_all(o)
    return o


# the judges' booth: a striped canopy on four poles, a table, three score cards, a megaphone, binoculars, two director's chairs
JZ0, JZ1 = 2.6, 5.4
for x in (7.8, 9.2):
    for z in (JZ0, JZ1):
        P_(cyl("BoothPole", 0.03, 2.25, g(x, TY, z), M["white"], 8))
P_(*canopy_stripes(7.6, 9.4, JZ0 - 0.15, JZ1 + 0.15, TY + 2.38, [M["coral"], M["cream"]], 8, 0.22))
for k in range(8):
    # a scalloped valance along the front
    z = JZ0 - 0.15 + (k + 0.5) * (JZ1 - JZ0 + 0.3) / 8
    P_(cyl("Valance", 0.12, 0.02, g(7.6, TY + 2.12, z), M["coral"] if k % 2 == 0 else M["cream"], 12, rot=(0, PI / 2, 0)))
P_(box("JudgeTable", 8.0, 8.75, TY + 0.72, TY + 0.77, JZ0 + 0.3, JZ1 - 0.3, M["teak"], 0.01))
for x in (8.05, 8.7):
    for z in (JZ0 + 0.35, JZ1 - 0.35):
        P_(cyl("TableLeg", 0.025, 0.72, g(x, TY, z), M["teak"], 8))
P_(box("TableSkirt", 7.98, 8.02, TY + 0.4, TY + 0.77, JZ0 + 0.3, JZ1 - 0.3, M["cream"], 0.004))
cards = pic_x("ScoreCards", 1.2, 0.5, 7.97, TY + 0.55, (JZ0 + JZ1) / 2, "score_cards")
P_(cards)
# the cards held up on the table, too: three little paddles
for k, dz in enumerate((-0.5, 0.0, 0.5)):
    z = (JZ0 + JZ1) / 2 + dz
    P_(box("Paddle", 8.25, 8.27, TY + 0.95, TY + 1.25, z - 0.13, z + 0.13, M["white"], 0.004))
    P_(rod("PaddleHandle", (8.27, TY + 0.77, z), (8.27, TY + 0.96, z), 0.012, M["teak"], 6))
P_(cyl("Megaphone", 0.04, 0.32, g(8.5, TY + 0.85, JZ0 + 0.55), M["red"], 16, rot=(0, PI / 2 - 0.15, 0), r2=0.14))
P_(cyl("MegaphoneHandle", 0.02, 0.1, g(8.62, TY + 0.77, JZ0 + 0.55), M["black"], 8))
for dz in (-0.05, 0.05):
    P_(cyl("Binocular", 0.035, 0.14, g(8.4, TY + 0.81, JZ1 - 0.55 + dz), M["black"], 12, rot=(0, PI / 2, 0)))
P_(box("Clipboard", 8.4, 8.62, TY + 0.775, TY + 0.79, (JZ0 + JZ1) / 2 - 0.1, (JZ0 + JZ1) / 2 + 0.2, M["teak"], 0.004))
P_(box("ClipPaper", 8.42, 8.6, TY + 0.79, TY + 0.795, (JZ0 + JZ1) / 2 - 0.08, (JZ0 + JZ1) / 2 + 0.18, M["white"], 0.0))


def directors_chair(x, z):
    out = []
    for dz in (-0.25, 0.25):
        out.append(rod("ChairX", (x - 0.22, TY, z + dz), (x + 0.22, TY + 0.45, z + dz), 0.018, M["teak"]))
        out.append(rod("ChairX", (x + 0.22, TY, z + dz), (x - 0.22, TY + 0.45, z + dz), 0.018, M["teak"]))
        out.append(rod("ChairArm", (x - 0.25, TY + 0.66, z + dz), (x + 0.25, TY + 0.66, z + dz), 0.02, M["teak"]))
        out.append(rod("ChairBack", (x + 0.24, TY + 0.45, z + dz), (x + 0.26, TY + 1.0, z + dz), 0.02, M["teak"]))
    out.append(box("ChairSeat", x - 0.22, x + 0.22, TY + 0.44, TY + 0.47, z - 0.25, z + 0.25, M["navy"], 0.01))
    out.append(box("ChairBackCanvas", x + 0.23, x + 0.26, TY + 0.72, TY + 0.95, z - 0.25, z + 0.25, M["navy"], 0.01))
    return out


for z in (JZ0 + 0.7, JZ1 - 0.7):
    P_(*directors_chair(9.05, z))

# the lifeguard's high chair on the other side, under a red umbrella, facing the waves
HZ = -4.0
for dz in (-0.35, 0.35):
    P_(rod("HighLeg", (8.75, TY, HZ + dz), (8.45, TY + 1.7, HZ + dz * 0.8), 0.04, M["white"]))
    P_(rod("HighLeg", (8.05, TY, HZ + dz), (8.25, TY + 1.7, HZ + dz * 0.8), 0.04, M["white"]))
for y in (0.45, 0.95, 1.4):
    P_(rod("HighRung", (8.05 + 0.04 * y, TY + y, HZ - 0.35), (8.05 + 0.04 * y, TY + y, HZ + 0.35), 0.025, M["white"]))
P_(box("HighSeat", 8.2, 8.6, TY + 1.7, TY + 1.76, HZ - 0.32, HZ + 0.32, M["teak"], 0.01))
P_(box("HighBack", 8.58, 8.64, TY + 1.76, TY + 2.4, HZ - 0.32, HZ + 0.32, M["white"], 0.01))
P_(box("HighCushion", 8.22, 8.58, TY + 1.76, TY + 1.81, HZ - 0.3, HZ + 0.3, M["red"], 0.02))
P_(cyl("HighPole", 0.022, 1.45, g(8.66, TY + 1.76, HZ + 0.3), M["white"], 8))
um = cyl("Umbrella", 0.95, 0.38, g(8.66, TY + 3.0, HZ + 0.3), M["red"], 16, r2=0.04)
P_(um, sphere("UmbrellaTip", 0.05, g(8.66, TY + 3.4, HZ + 0.3), M["white"], 8, 6))
for k in range(8):
    a = k * TAU / 8
    P_(rod("UmbrellaRib", (8.66, TY + 3.36, HZ + 0.3), (8.66 + math.cos(a) * 0.95, TY + 3.0, HZ + 0.3 + math.sin(a) * 0.95), 0.008, M["white"], 5))
P_(cyl("Whistle", 0.02, 0.06, g(8.6, TY + 1.83, HZ - 0.2), M["sun"], 8, rot=(PI / 2, 0, 0)))

# two retro spotlights on tripods, aimed at the waves; potted palms at the corners; a rack of boards against the wall
for z in (-1.95, 1.95):
    for a in range(3):
        aa = a * TAU / 3
        P_(rod("TripodLeg", (8.5 + math.cos(aa) * 0.32, TY, z + math.sin(aa) * 0.32), (8.5, TY + 1.3, z), 0.018, M["iron"], 6))
    P_(cyl("SpotBody", 0.2, 0.55, g(8.5, TY + 1.45, z), M["iron"], 16, rot=(0, -PI / 2 + 0.35, 0), r2=0.24))
    P_(cyl("SpotLens", 0.21, 0.02, g(8.0, TY + 1.27, z), M["sconce"], 16, rot=(0, -PI / 2 + 0.35, 0)))
    P_(torus("SpotYoke", 0.26, 0.02, g(8.5, TY + 1.45, z), M["iron"], 16, 6, rot=(PI / 2, 0, 0)))
trees.use({"frond": cutmat("palm_frond", 0.6)})


def potted_palm(x, y, z, seed, h=1.5):
    """A light potted palm: a terracotta pot with a coral band, a few canes, cut-out fronds arching out."""
    r = random.Random(seed)
    out = [cyl("PalmPot", 0.26, 0.5, g(x, y, z), M["terracotta"], 16, r2=0.32)]
    out.append(cyl("PalmPotBand", 0.3, 0.07, g(x, y + 0.36, z), M["coral"], 16, r2=0.315))
    for k in range(9):
        a = k * TAU / 9 + r.uniform(-0.2, 0.2)
        top = Vector(g(x + math.cos(a) * 0.08, y + 0.5 + h * r.uniform(0.55, 1.0), z + math.sin(a) * 0.08))
        out.append(tube("PalmCane", [Vector(g(x, y + 0.45, z)), top], 0.012, sm("palm_stem", "#7a8a4a", 0.6), 1, 5))
        out.append(trees.frond_card("PalmFrond", top, -a, math.radians(r.uniform(20, 45)), r.uniform(0.75, 1.05), r.uniform(0.2, 0.26), math.radians(r.uniform(55, 85)), segs=4))
    return out


for z, seed in ((-8.2, 3), (8.2, 4), (-6.0, 5), (1.0, 6)):
    P_(*potted_palm(9.0, TY, z, seed))
for k, (dz, col) in enumerate(((0.0, "coral"), (0.3, "sun"), (0.6, "teal"), (0.9, "cream"))):
    z = -7.4 + dz
    P_(box("TerraceBoard", 9.2, 9.27, TY, TY + 2.2, z - 0.24, z + 0.24, M[col], 0.1))
P_(box("BoardRack", 9.0, 9.4, TY + 0.15, TY + 0.25, -7.7, -6.3, M["teak"], 0.01))

# ---- the upper storey: rounded corners, speed stripes, portholes, fins; the mural ----------------------------------------------------
def plan_poly(off=0.0, corner=1.5):
    r = corner + off
    x0, x1, hz = UPPER_X - off, BACK + off, UPPER_HZ + off
    pts = [(x1, -hz), (x0 + r, -hz)]
    for k in range(1, 12):
        a = -PI / 2 - (PI / 2) * k / 12
        pts.append((x0 + r + r * math.cos(a), -hz + r + r * math.sin(a)))
    pts += [(x0, -hz + r), (x0, hz - r)]
    for k in range(1, 12):
        a = PI - (PI / 2) * k / 12
        pts.append((x0 + r + r * math.cos(a), hz - r + r * math.sin(a)))
    pts += [(x0 + r, hz), (x1, hz)]
    return pts


P_(prism("Upper", plan_poly(), TERRACE_Y, UPPER_Y, "y", M["stucco"]))
P_(prism("Parapet", plan_poly(0.12), UPPER_Y, UPPER_Y + 0.3, "y", M["cream"]))
P_(prism("ParapetCap", plan_poly(0.16), UPPER_Y + 0.3, UPPER_Y + 0.38, "y", M["coral"]))
P_(prism("Plinth", plan_poly(0.05), TERRACE_Y, TERRACE_Y + 0.25, "y", M["coral_dark"]))
# speed stripes: from the mural's frame round the corner and along the side
def stripe_path(sgn, off=0.035, r=1.5):
    x0, hz = UPPER_X - off, UPPER_HZ + off
    cx, cz = UPPER_X + r, sgn * (UPPER_HZ - r)
    pts = [(x0, sgn * 5.95), (x0, cz)]
    for k in range(1, 12):
        a = PI - sgn * (PI / 2) * k / 12
        pts.append((cx + (r + off) * math.cos(a), cz + (r + off) * math.sin(a)))
    pts += [(cx, sgn * hz), (BACK - 0.4, sgn * hz)]
    return pts


def ribbon(name, path, y, h, m):
    """A flat band of height h standing along a path of (x, z) points (a painted stripe proud of the wall)."""
    rows = [[g(px, y - h / 2, pz), g(px, y + h / 2, pz)] for px, pz in path]
    bm = bmesh.new()
    vs = [[bm.verts.new(a), bm.verts.new(b)] for a, b in rows]
    for i in range(len(vs) - 1):
        bm.faces.new((vs[i][0], vs[i + 1][0], vs[i + 1][1], vs[i][1]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    # (face out of the building: away from the plan's middle)
    for p in o.data.polygons:
        c = p.center
        if p.normal.x * (c.x - 12.0) + p.normal.y * (c.y - 0.0) < 0:
            p.flip()
    return o


for y, m in ((4.05, M["coral"]), (4.3, M["sun"]), (4.55, M["teal"])):
    for sgn in (-1, 1):
        P_(ribbon("SpeedStripe", stripe_path(sgn), y, 0.1, m))
# the mural and its frame
MU = MURAL
P_(pic_x("Mural", MU["w"], MU["h"], MU["x"], MU["y0"] + MU["h"] / 2, 0.0, "mural", rough=0.85))
for (y0, y1, z0, z1) in (
    (MU["y0"] - 0.16, MU["y0"], -MU["w"] / 2 - 0.16, MU["w"] / 2 + 0.16),
    (MU["y0"] + MU["h"], MU["y0"] + MU["h"] + 0.16, -MU["w"] / 2 - 0.16, MU["w"] / 2 + 0.16),
    (MU["y0"], MU["y0"] + MU["h"], -MU["w"] / 2 - 0.16, -MU["w"] / 2),
    (MU["y0"], MU["y0"] + MU["h"], MU["w"] / 2, MU["w"] / 2 + 0.16),
):
    P_(box("MuralFrame", UPPER_X - 0.06, UPPER_X, y0, y1, z0, z1, M["teal"], 0.015))
# a little lamp over the mural on brackets, three to a side
for z in (-4.0, 0.0, 4.0):
    P_(rod("MuralLampArm", (UPPER_X, MU["y0"] + MU["h"] + 0.4, z), (UPPER_X - 0.45, MU["y0"] + MU["h"] + 0.3, z), 0.02, M["iron"], 6))
    P_(cyl("MuralLamp", 0.07, 0.22, g(UPPER_X - 0.5, MU["y0"] + MU["h"] + 0.22, z), M["navy"], 12, r2=0.13))
# portholes on the panels beside the mural
for s in (-1, 1):
    for y in (5.0, 6.35, 7.7):
        z = s * 6.7
        P_(torus("Porthole", 0.34, 0.06, g(UPPER_X - 0.04, y, z), M["chrome"], 20, 6, rot=(0, PI / 2, 0)))
        P_(cyl("PortholeGlass", 0.3, 0.02, g(UPPER_X - 0.03, y, z), M["window"], 24, rot=(0, PI / 2, 0)))
# vertical fins on the rounded corners
for sgn in (-1, 1):
    cx, cz = UPPER_X + 1.5, sgn * (UPPER_HZ - 1.5)
    for a in (0.4, 0.78, 1.17):
        aa = PI - sgn * a
        px, pz = cx + 1.5 * math.cos(aa), cz + 1.5 * math.sin(aa)
        fin = box("Fin", -0.02, 0.4, 4.9, 8.7, -0.07, 0.07, M["cream"], 0.02)
        P_(xf(fin, g(px, 0, pz), math.atan2(-math.sin(aa), math.cos(aa))))
# the sides: two portholes and a louvre each
for s in (-1, 1):
    z = s * (UPPER_HZ + 0.03)
    for x in (12.0, 13.6):
        P_(torus("SidePorthole", 0.3, 0.05, g(x, 6.6, z), M["chrome"], 16, 6, rot=(PI / 2, 0, 0)))
        P_(cyl("SidePortholeGlass", 0.26, 0.02, g(x, 6.6, z - s * 0.01), M["window"], 20, rot=(PI / 2, 0, 0)))
    for k in range(6):
        P_(box("Louvre", 11.6, 14.0, 4.6 + k * 0.14, 4.66 + k * 0.14, z - 0.04, z + 0.04, M["cream"], 0.01))

# ---- the lighthouse turrets ------------------------------------------------------------------------------------------------------------
for s in (-1, 1):
    tx, tz = TURRET[0], s * TURRET[1]
    y0, top = TY, 10.2
    n = 6
    for k in range(n):
        ya, yb = y0 + (top - y0) * k / n, y0 + (top - y0) * (k + 1) / n
        ra, rb = 0.82 - 0.22 * k / n, 0.82 - 0.22 * (k + 1) / n
        P_(cyl("TurretBand", ra, yb - ya, g(tx, ya, tz), M["coral"] if k % 2 == 0 else M["cream"], 28, r2=rb))
    P_(cyl("Gallery", 0.98, 0.14, g(tx, top, tz), M["navy"], 28))
    for k in range(16):
        a = k * TAU / 16
        P_(cyl("GalleryPost", 0.018, 0.48, g(tx + math.cos(a) * 0.92, top + 0.14, tz + math.sin(a) * 0.92), M["chrome"], 6))
    P_(torus("GalleryRail", 0.92, 0.025, g(tx, top + 0.62, tz), M["chrome"], 40, 6))
    P_(cyl("Glass_Lantern", 0.52, 0.92, g(tx, top + 0.14, tz), M["glass"], 24))
    for k in range(6):
        a = k * TAU / 6
        P_(cyl("Mullion", 0.025, 0.92, g(tx + math.cos(a) * 0.53, top + 0.14, tz + math.sin(a) * 0.53), M["navy"], 6))
    P_(cyl("LanternBase", 0.56, 0.1, g(tx, top + 0.14, tz), M["navy"], 24))
    P_(cyl("LanternCap", 0.66, 0.55, g(tx, top + 1.06, tz), M["coral"], 24, r2=0.05))
    P_(sphere("Finial", 0.12, g(tx, top + 1.7, tz), M["sun"], 12, 8))
    P_(rod("Vane", (tx, top + 1.6, tz), (tx, top + 2.1, tz), 0.012, M["iron"], 6))
    P_(anchor("Beacon", tx, top + 0.6, tz))
    # the siren horn on the gallery, aimed at the pool
    P_(cyl("SirenHorn", 0.06, 0.55, g(tx - 0.95, top + 0.45, tz), M["steel"], 14, rot=(0, -PI / 2 - 0.25, 0), r2=0.26))
    # a little door and two portholes, toward the pool
    P_(box("TurretDoor", tx - 0.86, tx - 0.74, TY, TY + 1.6, tz - 0.3, tz + 0.3, M["navy"], 0.02))
    P_(sphere("DoorKnob", 0.035, g(tx - 0.88, TY + 0.85, tz - 0.2), M["brass"], 8, 6))
    for y, r_ in ((6.0, 0.73), (8.3, 0.66)):
        P_(torus("TurretPort", 0.14, 0.03, g(tx - r_ - 0.01, y, tz), M["chrome"], 16, 6, rot=(0, PI / 2, 0)))
        P_(cyl("TurretPortGlass", 0.12, 0.02, g(tx - r_, y, tz), M["window"], 16, rot=(0, PI / 2, 0)))

# ---- the roof: the sign on its truss, the neon curl, flags, a water tank, vents ---------------------------------------------------------
SG = SIGN
P_(box("SignBoard", SG["x"], SG["x"] + 0.18, SG["y0"], SG["y0"] + SG["h"], -SG["w"] / 2 - 0.1, SG["w"] / 2 + 0.1, M["coral"], 0.03))
P_(pic_x("RoofSign", SG["w"], SG["h"], SG["x"] - 0.005, SG["y0"] + SG["h"] / 2, 0.0, "roof_sign", rough=0.4))
P_(box("SignTrim", SG["x"] - 0.04, SG["x"] + 0.2, SG["y0"] - 0.12, SG["y0"], -SG["w"] / 2 - 0.15, SG["w"] / 2 + 0.15, M["cream"], 0.02))
P_(anchor("BulbLow", SG["x"] - 0.06, SG["y0"] + 0.08, -SG["w"] / 2 + 0.08))
P_(anchor("BulbHigh", SG["x"] - 0.06, SG["y0"] + SG["h"] - 0.08, SG["w"] / 2 - 0.08))
for z in (-4.2, 0.0, 4.2):
    P_(box("TrussPost", SG["x"] + 0.2, SG["x"] + 0.32, UPPER_Y, SG["y0"] + SG["h"], z - 0.06, z + 0.06, M["iron"], 0.01))
    P_(rod("TrussStrut", (SG["x"] + 0.3, SG["y0"] + 1.8, z), (SG["x"] + 1.8, UPPER_Y, z), 0.04, M["iron"]))
for y in (SG["y0"] + 0.3, SG["y0"] + 1.2, SG["y0"] + 2.1):
    P_(box("TrussRail", SG["x"] + 0.2, SG["x"] + 0.3, y - 0.04, y + 0.04, -SG["w"] / 2, SG["w"] / 2, M["iron"], 0.01))
for k in range(8):
    za, zb = -4.2 + k * 1.05, -4.2 + (k + 1) * 1.05
    ya, yb = (SG["y0"] + 0.3, SG["y0"] + 2.1) if k % 2 == 0 else (SG["y0"] + 2.1, SG["y0"] + 0.3)
    P_(rod("TrussDiag", (SG["x"] + 0.26, ya, za), (SG["x"] + 0.26, yb, zb), 0.02, M["iron"], 6))
# the neon wave curl over the board's middle
curl = []
for k in range(40):
    t = k / 39
    a = PI * 0.15 + t * PI * 1.8
    r = 0.42 * (1 - 0.65 * t)
    curl.append(g(SG["x"] + 0.05, SG["y0"] + SG["h"] + 0.62 + math.sin(a) * r, 0.5 + math.cos(a) * r - 0.3 * (1 - t)))
crest = [g(SG["x"] + 0.05, SG["y0"] + SG["h"] + 0.2 + 0.05 * math.sin(k), -1.4 + k * 0.35) for k in range(6)]
P_(tube("Light_Neon", curl, 0.035, M["neon"], 1, 6))
P_(tube("Light_Neon", crest, 0.035, M["neon"], 2, 6))
P_(box("NeonFrame", SG["x"] + 0.1, SG["x"] + 0.14, SG["y0"] + SG["h"], SG["y0"] + SG["h"] + 1.15, -1.5, 1.2, M["iron"], 0.005))
# flags on six poles flanking the sign (the game flaps the flags)
for s in (-1, 1):
    for z in (6.1, 6.95, 7.8):
        P_(cyl("FlagPole", 0.035, 3.4, g(11.4, UPPER_Y, s * z), M["white"], 8))
        P_(sphere("FlagBall", 0.06, g(11.4, UPPER_Y + 3.45, s * z), M["sun"], 8, 6))
        P_(anchor("Flag", 11.4, UPPER_Y + 3.1, s * z))
# a water tank on legs, vents, an AC box
for dx in (-0.45, 0.45):
    for dz in (-0.45, 0.45):
        P_(cyl("TankLeg", 0.05, 1.2, g(13.6 + dx, UPPER_Y, -6.5 + dz), M["iron"], 6))
P_(cyl("Tank", 0.75, 1.3, g(13.6, UPPER_Y + 1.2, -6.5), M["teal"], 20))
P_(cyl("TankRoof", 0.8, 0.45, g(13.6, UPPER_Y + 2.5, -6.5), M["coral"], 20, r2=0.05))
for k in range(4):
    P_(torus("TankHoop", 0.76, 0.02, g(13.6, UPPER_Y + 1.4 + k * 0.32, -6.5), M["iron"], 20, 4))
for z in (5.6, 7.2):
    P_(cyl("Vent", 0.18, 0.6, g(13.8, UPPER_Y, z), M["steel"], 12))
    P_(cyl("VentCap", 0.3, 0.12, g(13.8, UPPER_Y + 0.6, z), M["steel"], 12, r2=0.1))
P_(box("ACUnit", 12.4, 13.4, UPPER_Y, UPPER_Y + 0.8, 1.5, 2.6, M["white"], 0.03))
P_(cyl("ACFan", 0.35, 0.03, g(12.9, UPPER_Y + 0.8, 2.05), M["iron"], 20))

# ---- the ends: the wave machine's door, pipes, valves, gauges, a ladder; the hose reel, the extinguisher -----------------------------
ZL = -HOUSE_HZ - 0.01
P_(box("MachineDoorFrame", 11.0, 12.2, 0.0, 2.3, ZL - 0.06, ZL + 0.01, M["navy_dark"], 0.02))
P_(box("MachineDoor", 11.08, 12.12, 0.02, 2.2, ZL - 0.09, ZL - 0.05, M["steel"], 0.02))
P_(torus("DoorPort", 0.16, 0.035, g(11.6, 1.6, ZL - 0.1), M["chrome"], 16, 6, rot=(PI / 2, 0, 0)))
P_(cyl("DoorPortGlass", 0.14, 0.02, g(11.6, 1.6, ZL - 0.095), M["window"], 16, rot=(PI / 2, 0, 0)))
P_(box("DoorBar", 11.25, 11.95, 0.98, 1.04, ZL - 0.14, ZL - 0.1, M["chrome"], 0.01))
P_(pic_z("PumpHouseSign", 1.2, 0.48, 11.6, 2.6, ZL - 0.02, "pump_house"))
for x in (9.0, 9.55):
    # the big intake pipes: up out of the ground, a bend, into the wall
    path = [g(x, -0.3, ZL - 0.55), g(x, 2.2, ZL - 0.55), g(x, 2.45, ZL - 0.3), g(x, 2.45, ZL + 0.2)]
    P_(poly_tube("IntakePipe", path, 0.18, M["teal_dark"], 16, 0.3))
    for y in (0.3, 1.6):
        P_(torus("Flange", 0.2, 0.04, g(x, y, ZL - 0.55), M["steel"], 20, 6))
        for b in range(6):
            a = b * TAU / 6
            P_(sphere("Bolt", 0.02, g(x + math.cos(a) * 0.2, y + 0.03, ZL - 0.55 + math.sin(a) * 0.2), M["steel"], 6, 4))
    P_(torus("ValveWheel", 0.16, 0.025, g(x - 0.24, 1.0, ZL - 0.55), M["red"], 20, 6, rot=(0, PI / 2, 0)))
    P_(rod("ValveStem", (x - 0.18, 1.0, ZL - 0.55), (x - 0.24, 1.0, ZL - 0.55), 0.02, M["steel"], 6))
    for b in range(4):
        a = b * PI / 4
        P_(rod("ValveSpoke", (x - 0.24, 1.0 + math.sin(a) * 0.16, ZL - 0.55 + math.cos(a) * 0.16), (x - 0.24, 1.0 - math.sin(a) * 0.16, ZL - 0.55 - math.cos(a) * 0.16), 0.01, M["red"], 5))
P_(pic_z("Gauge", 0.3, 0.3, 10.2, 1.5, ZL - 0.02, "gauge", rough=0.3))
P_(cyl("GaugeRim", 0.16, 0.05, g(10.2, 1.5, ZL - 0.02), M["chrome"], 20, rot=(PI / 2, 0, 0)))
for k in range(6):
    P_(box("SideLouvre", 13.0, 14.3, 1.2 + k * 0.13, 1.25 + k * 0.13, ZL - 0.06, ZL, M["cream"], 0.008))
# the pipe bridge to the water care station (overhead: the walk under it is the coach's)
st = STATIONS["chlorine"]
bridge = [g(10.25, 1.6, ZL), g(10.25, 2.45, ZL - 0.25), g(10.25, 2.45, st["z"] + 0.3), g(10.25, 1.35, st["z"] + 0.3)]
P_(poly_tube("WaterCarePipe", bridge, 0.06, M["sun"], 10, 0.25))
for z in (ZL - 0.8, st["z"] + 0.6):
    P_(rod("PipeHanger", (10.25, 2.45, z), (10.25, 2.48, z), 0.07, M["iron"], 8))
# the ladder up to the terrace, at the house's front corner
for dx in (-0.22, 0.22):
    P_(rod("LadderRail", (8.1 + dx, 0.0, ZL - 0.12), (8.1 + dx, TY + 0.95, ZL - 0.12), 0.025, M["chrome"], 8))
for k in range(12):
    y = 0.28 + k * 0.28
    P_(rod("LadderRung", (7.88, y, ZL - 0.12), (8.32, y, ZL - 0.12), 0.018, M["chrome"], 6))
P_(rod("LadderHoop", (7.88, TY + 0.95, ZL - 0.12), (8.32, TY + 0.95, ZL - 0.12), 0.025, M["chrome"], 6))
ZR = HOUSE_HZ + 0.01
P_(cyl("HoseReel", 0.32, 0.18, g(12.6, 1.25, ZR), M["red"], 24, rot=(PI / 2, 0, 0)))
P_(torus("HoseCoil", 0.24, 0.05, g(12.6, 1.25, ZR + 0.12), M["sun"], 24, 8, rot=(PI / 2, 0, 0)))
P_(torus("HoseCoil", 0.17, 0.05, g(12.6, 1.25, ZR + 0.16), M["sun"], 24, 8, rot=(PI / 2, 0, 0)))
P_(box("ExtinguisherBox", 10.9, 11.5, 0.6, 1.6, ZR, ZR + 0.22, M["white"], 0.02))
P_(cyl("Extinguisher", 0.1, 0.62, g(11.2, 0.75, ZR + 0.11), M["red"], 14))
P_(pic_z("SirenWarnSide", 0.85, 0.53, 9.0, 1.7, ZR + 0.01, "siren_warn", facing=1))
for k in range(6):
    P_(box("SideLouvreR", 13.0, 14.3, 1.2 + k * 0.13, 1.25 + k * 0.13, ZR, ZR + 0.06, M["cream"], 0.008))

print("HOUSE", tris(parts))
_by = {}
for o in parts:
    k = o.name.split(".")[0].rstrip("0123456789")
    _by[k] = _by.get(k, 0) + sum(len(p.vertices) - 2 for p in o.data.polygons)
print("HEAVY", sorted(_by.items(), key=lambda kv: -kv[1])[:14])
if LOOK:
    look("house_front", g(0.0, 4.5, 0.0), 19, 12, 270, (1280, 720), 20, 35)
    look("house_left", g(5.0, 2.0, -14.0), 8, 15, 330, (960, 640), 16, 35)
    look("house_terrace", g(8.3, 4.2, 3.0), 6, 22, 250, (960, 640), 16, 35)
save_part("house", parts)
