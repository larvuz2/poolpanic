"""Splash Park's gameplay furniture, modelled in place in game coordinates, each where the game keeps its hit box and label
(dist/spatial.mjs RESORT_SPEC; dist/scene/props.mjs draws the live parts and the hooks, these are the bodies round them):

- the trampoline tower: legs, braced frame, platform with a grip mat and padded edge, rails, a gate with the SPLASH ZONE board,
  the launch arm out to the bed (the bed itself, ring, springs and mat, is the game's), stairs down toward +x with handrails and
  two bollard lamps at their foot;
- the lifeguard tower: a white timber high chair, a red seat box with the LIFEGUARD board, a ladder toward the pool, a parasol,
  a rescue tube; beside it a post with a cradle for the torch (`Flashlight`: the exporter records its centre and drops it, the
  game hangs its own torch there);
- WATER CARE (chlorine) and EYE CARE (relief) stations, both facing the pool (-x);
- the fin rack, its three pairs of fins their own objects (Fins_1..3: the game hides each as it is rented);
- the skimmer board on the left wall (the game draws the skimmer, its hooks and the scoop) and the waste bin;
- the fish net's board on the right-hand pier (the game draws the net and its hooks);
- three life-ring boards, each with a `LifeRing` where its ring hangs (recorded and dropped: the game's rings hang there);
- the rescue bench and the bench on the right-hand side: teak slats on cast-iron frames.

    blender -b -P tools/venues/splash/props_stations.py [-- --look]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()

M = dict(
    blue=sm("tower_blue", "#2f7fc4", 0.38),
    blue_dark=sm("tower_blue_dark", "#22609e", 0.4),
    white=sm("white_gloss"),
    whitewash=sm("whitewash"),
    pad=sm("pad_navy", "#1d3557", 0.75),
    grip=sm("grip_mat", "#4a5560", 0.92),
    steel=sm("stainless"),
    iron=sm("iron"),
    teak=sm("teak"),
    teak_dark=sm("teak_dark"),
    red=sm("coral"),
    red_gloss=sm("coral_gloss"),
    canvas=sm("canvas"),
    sun=sm("sun"),
    sun_gloss=sm("sun_gloss"),
    teal=sm("teal"),
    teal_dark=sm("teal_dark"),
    navy=sm("navy"),
    rubber=sm("rubber"),
    charcoal=sm("charcoal"),
    rope=sm("rope", "#e7d3a6", 0.9),
    mirror=sm("mirror", "#dfe9ee", 0.05, 1.0),
    bin=sm("bin_teal", "#204d59", 0.5),
    gold=sm("bin_rim", "#f2b44f", 0.4),
    fin_yellow=sm("fin_yellow", "#f4c849", 0.45),
    fin_teal=sm("fin_teal", "#2f9aa0", 0.45),
    fin_coral=sm("fin_coral", "#e0513f", 0.45),
    foot=sm("fin_foot", "#1d3557", 0.6),
    towel=sm("towel_white"),
    towel_teal=sm("towel_teal"),
    tub=sm("tub_white", "#f2f4f0", 0.3),
    lid=sm("tub_lid", "#2f9aa0", 0.35),
    ring=sm("ring_orange", "#f47742", 0.5),
    lamp=lamp_mat("bollard_glass", "#ffe2b0", 4.0),
)
parts = {}  # item -> list of objects


def add(item, *objs):
    parts.setdefault(item, []).extend(o for o in objs if o is not None)
    return objs[0] if objs else None


def rod(name, a, b, r, m, sides=8):
    """A straight round bar between two game points."""
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


class Frame:
    """An item's local frame: `u` across it, `v` out of its front (toward `face`), y up; boxes by local extents."""

    AXES = {"+z": ((1, 0), (0, 1)), "-z": ((-1, 0), (0, -1)), "+x": ((0, -1), (1, 0)), "-x": ((0, 1), (-1, 0))}

    def __init__(self, x, z, face):
        self.x, self.z, self.face = x, z, face
        self.U, self.V = self.AXES[face]

    def p(self, u, v):
        return (self.x + u * self.U[0] + v * self.V[0], self.z + u * self.U[1] + v * self.V[1])

    def at(self, u, y, v):
        x, z = self.p(u, v)
        return (x, y, z)

    def box(self, name, u0, u1, y0, y1, v0, v1, m, bev=0.01):
        (xa, za), (xb, zb) = self.p(u0, v0), self.p(u1, v1)
        return gbx(name, min(xa, xb), max(xa, xb), y0, y1, min(za, zb), max(za, zb), m, bev)

    def g(self, u, y, v):
        return g(*self.at(u, y, v))

    @property
    def rz(self):
        """The turn (about Blender Z) that makes a thing built facing game +z face this frame's front."""
        return {"+z": 0.0, "-z": PI, "+x": PI / 2, "-x": -PI / 2}[self.face]

    def sign(self, name, w, h, u, y, v, image):
        o = plane(name, w, h, self.g(u, y, v), signmat(image, 0.5), rot=(PI / 2, 0, self.rz))
        return o

    def text(self, name, body, size, m, u, y, v, face="BarlowCondensed-Black"):
        return flat_text(name, body, size, m, self.g(u, y, v), self.rz, 0.008, face)


# ==== 1. the trampoline tower ======================================================================================================
T = TRAMPOLINE
TX, TZ, H = T["x"], T["z"], T["bedY"] - 0.22
tw = []
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = TX + sx * 0.85, TZ + sz * 0.95
        tw.append(gbx("TowerLeg", x - 0.06, x + 0.06, 0.02, H - 0.08, z - 0.06, z + 0.06, M["blue"], 0.015))
        tw.append(gbx("TowerFoot", x - 0.14, x + 0.14, 0, 0.025, z - 0.14, z + 0.14, M["steel"], 0.006))
        for k in range(4):  # the anchor bolts
            a = k * PI / 2 + PI / 4
            tw.append(cyl("Bolt", 0.014, 0.03, g(x + math.cos(a) * 0.1, 0.02, z + math.sin(a) * 0.1), M["steel"], 6))
# cross bracing on the long sides and across the ends
for sz in (-1, 1):
    z = TZ + sz * 0.95
    tw.append(rod("Brace", (TX - 0.85, 0.25, z), (TX + 0.85, H - 0.3, z), 0.03, M["white"]))
    tw.append(rod("Brace", (TX + 0.85, 0.25, z), (TX - 0.85, H - 0.3, z), 0.03, M["white"]))
for sx in (-1, 1):
    x = TX + sx * 0.85
    tw.append(rod("BraceEnd", (x, 0.9, TZ - 0.95), (x, 0.9, TZ + 0.95), 0.03, M["white"]))
# the platform: a blue deck, a grey grip mat, a padded navy edge at the front
tw.append(gbx("Platform", TX - 0.95, TX + 0.95, H - 0.09, H + 0.09, TZ - 1.05, TZ + 1.05, M["blue"], 0.03))
tw.append(gbx("GripMat", TX - 0.86, TX + 0.88, H + 0.09, H + 0.105, TZ - 0.96, TZ + 0.96, M["grip"], 0.004))
tw.append(gbx("EdgePad", TX - 1.0, TX - 0.9, H - 0.08, H + 0.14, TZ - 1.05, TZ + 1.05, M["pad"], 0.03))
# rails: corner posts, top and middle rails on both sides, short back rails beside the stairs
RH = H + 1.05
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = TX + sx * 0.9, TZ + sz * 1.0
        top = H + 1.95 if sx < 0 else RH
        tw.append(cyl("RailPost", 0.035, top - H - 0.09, g(x, H + 0.09, z), M["white"], 10))
        tw.append(sphere("PostCap", 0.045, g(x, top, z), M["white"], 10, 6))
for sz in (-1, 1):
    z = TZ + sz * 1.0
    for y in (RH - 0.02, H + 0.6):
        tw.append(rod("Rail", (TX - 0.9, y, z), (TX + 0.9, y, z), 0.03, M["white"]))
    tw.append(rod("RailBack", (TX + 0.9, RH - 0.02, z), (TX + 0.9, RH - 0.02, TZ + sz * 0.56), 0.03, M["white"]))
    # a mesh infill panel under the top rail (a teal net, safe for kids)
    tw.append(gbx("RailNet", TX - 0.88, TX + 0.88, H + 0.12, RH - 0.06, z - 0.006, z + 0.006, sm("rail_net", "#2f9aa0", 0.6, alpha=0.6), 0))
# the gate at the front: a crossbar over the launch with the SPLASH ZONE board facing the pool
tw.append(rod("GateBar", (TX - 0.9, H + 1.9, TZ - 1.0), (TX - 0.9, H + 1.9, TZ + 1.0), 0.04, M["white"]))
tw.append(gbx("GateBoard", TX - 0.94, TX - 0.9, H + 1.3, H + 1.82, TZ - 0.98, TZ + 0.98, M["navy"], 0.01))
tw.append(plane("SplashZoneSign", 1.9, 0.47, g(TX - 0.945, H + 1.56, TZ), signmat("splash_zone", 0.5), rot=(PI / 2, 0, -PI / 2)))
# the launch arm out under the bed (the bed's ring and mat are the game's, at bedX, bedY - 0.1)
BX = T["bedX"]
tw.append(gbx("Arm", BX - 0.2, TX - 0.95, H - 0.08, H + 0.06, TZ - 0.22, TZ + 0.22, M["blue"], 0.02))
tw.append(gbx("ArmPad", BX - 0.2, TX - 1.0, H + 0.06, H + 0.1, TZ - 0.18, TZ + 0.18, M["pad"], 0.015))
for sz in (-1, 1):
    tw.append(rod("ArmStrut", (TX - 0.85, 1.3, TZ + sz * 0.2), (BX + 0.25, H - 0.1, TZ + sz * 0.2), 0.035, M["blue_dark"]))
tw.append(cyl("BedMount", 0.12, 0.12, g(BX, H - 0.06, TZ), M["steel"], 16))
# the stairs down toward +x
x_top, x_bot = TX + 0.95, T["stairBottomX"]
run = x_bot - x_top
steps = 8
SZ0, SZ1 = TZ - 0.5, TZ + 0.5
for i in range(steps):
    f = (i + 0.5) / steps
    xc, y = x_top + run * (1 - f), H * f
    w_ = run / steps + 0.05
    tw.append(gbx("Tread", xc - w_ / 2, xc + w_ / 2, y - 0.03, y + 0.03, SZ0, SZ1, M["blue"], 0.01))
    tw.append(gbx("Nosing", xc + w_ / 2 - 0.05, xc + w_ / 2, y + 0.03, y + 0.04, SZ0 + 0.02, SZ1 - 0.02, M["sun"], 0.004))
    tw.append(gbx("TreadGrip", xc - w_ / 2 + 0.02, xc + w_ / 2 - 0.06, y + 0.03, y + 0.036, SZ0 + 0.04, SZ1 - 0.04, M["grip"], 0))
for z in (SZ0 - 0.04, SZ1 + 0.04):
    tw.append(tube("Stringer", [g(x_top, H + 0.05, z), g(x_bot + 0.08, -0.02, z)], 0.05, M["blue_dark"], 1, 4))
    tw.append(rod("Handrail", (x_top, H + 1.0, z), (x_bot, 0.95, z), 0.03, M["white"]))
    tw.append(rod("Handrail", (x_bot, 0.95, z), (x_bot, 0.0, z), 0.03, M["white"]))
    for k in (0.33, 0.66):
        xx = x_top + run * k
        tw.append(rod("Baluster", (xx, H * (1 - k) + 0.04, z), (xx, H * (1 - k) + 0.97, z), 0.022, M["white"]))
    # a bollard lamp on each newel at the foot (lit after dusk)
    tw.append(cyl("NewelBase", 0.05, 0.05, g(x_bot, 0.96, z), M["iron"], 10))
    tw.append(cyl("Light_Bollard", 0.045, 0.11, g(x_bot, 1.0, z), M["lamp"], 10))
    tw.append(cyl("NewelCap", 0.06, 0.03, g(x_bot, 1.11, z), M["iron"], 10))
add("trampoline", *tw)

# ==== 2. the lifeguard tower and the torch's post ======================================================================================
LX, LZ = LIFEGUARD
lg = []
FY = 2.05  # the floor of the seat box
for sx in (-1, 1):
    for sz in (-1, 1):
        lg.append(tube("LegTimber", [g(LX + sx * 0.62, 0, LZ + sz * 0.58), g(LX + sx * 0.46, FY, LZ + sz * 0.44)], 0.055, M["whitewash"], 1, 4))
        lg.append(gbx("LegShoe", LX + sx * 0.62 - 0.08, LX + sx * 0.62 + 0.08, 0, 0.06, LZ + sz * 0.58 - 0.08, LZ + sz * 0.58 + 0.08, M["iron"], 0.01))
for y, k in ((0.75, 0.6), (1.45, 0.53)):
    for sz in (-1, 1):
        lg.append(rod("Rail", (LX - k, y, LZ + sz * (k - 0.04)), (LX + k, y, LZ + sz * (k - 0.04)), 0.035, M["whitewash"], 4))
    lg.append(rod("RailBack", (LX - k, y, LZ - k + 0.04), (LX - k, y, LZ + k - 0.04), 0.035, M["whitewash"], 4))
lg.append(rod("XBrace", (LX - 0.6, 0.2, LZ - 0.56), (LX - 0.5, FY - 0.2, LZ + 0.46), 0.03, M["whitewash"], 4))
lg.append(rod("XBrace", (LX - 0.6, 0.2, LZ + 0.56), (LX - 0.5, FY - 0.2, LZ - 0.46), 0.03, M["whitewash"], 4))
# the seat box: a red floor, a seat, a slatted white back and arms, a footrest bar
lg.append(gbx("SeatFloor", LX - 0.56, LX + 0.56, FY, FY + 0.1, LZ - 0.52, LZ + 0.52, M["red"], 0.025))
lg.append(gbx("SeatBox", LX - 0.5, LX + 0.02, FY + 0.1, FY + 0.48, LZ - 0.42, LZ + 0.42, M["red"], 0.03))
lg.append(gbx("SeatCushion", LX - 0.48, LX + 0.0, FY + 0.48, FY + 0.54, LZ - 0.38, LZ + 0.38, M["navy"], 0.025))
for k in range(4):
    y = FY + 0.62 + k * 0.14
    lg.append(gbx("BackSlat", LX - 0.54, LX - 0.5, y, y + 0.1, LZ - 0.42, LZ + 0.42, M["whitewash"], 0.01))
for sz in (-1, 1):
    lg.append(gbx("BackPost", LX - 0.56, LX - 0.49, FY + 0.1, FY + 1.18, LZ + sz * 0.45 - 0.035, LZ + sz * 0.45 + 0.035, M["whitewash"], 0.01))
    lg.append(gbx("Arm", LX - 0.54, LX + 0.1, FY + 0.78, FY + 0.83, LZ + sz * 0.45 - 0.035, LZ + sz * 0.45 + 0.035, M["whitewash"], 0.01))
    lg.append(gbx("ArmPost", LX + 0.04, LX + 0.1, FY + 0.1, FY + 0.8, LZ + sz * 0.45 - 0.03, LZ + sz * 0.45 + 0.03, M["whitewash"], 0.008))
lg.append(rod("Footrest", (LX + 0.5, FY - 0.35, LZ - 0.4), (LX + 0.5, FY - 0.35, LZ + 0.4), 0.03, M["steel"]))
lg.append(gbx("BoardBack", LX + 0.56, LX + 0.6, FY - 0.32, FY + 0.06, LZ - 0.48, LZ + 0.48, M["red"], 0.01))
lg.append(plane("LifeguardSign", 0.9, 0.3, g(LX + 0.605, FY - 0.13, LZ), signmat("lifeguard", 0.5), rot=(PI / 2, 0, PI / 2)))
# the ladder toward the pool
for sz in (-1, 1):
    lg.append(tube("LadderSide", [g(LX + 0.82, 0, LZ + sz * 0.26), g(LX + 0.56, FY + 0.05, LZ + sz * 0.26)], 0.03, M["whitewash"], 1, 4))
for k in range(6):
    f = (k + 0.6) / 6.6
    lg.append(gbx("LadderStep", LX + 0.82 - 0.26 * f - 0.07, LX + 0.82 - 0.26 * f + 0.07, FY * f - 0.02, FY * f + 0.02, LZ - 0.25, LZ + 0.25, M["teak"], 0.006))
# the parasol: a white pole from the back, a red and cream canopy (two-faced: seen from the camera above and the Coach Cam below)
PX, PZ, PY = LX - 0.38, LZ, 3.95
lg.append(cyl("ParasolPole", 0.025, PY - FY, g(PX, FY + 0.1, PZ), M["whitewash"], 10))


def canopy(name, cx, cy, cz, r, drop, n, mats, valance=0.08):
    """A parasol's canopy: n panels in alternating materials, a top surface and an under surface, a scalloped valance."""
    bm = bmesh.new()
    me = bpy.data.meshes.new(name)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m_ in mats:
        o.data.materials.append(m_)
    apex = bm.verts.new(g(cx, cy, cz))
    apex2 = bm.verts.new(g(cx, cy - 0.03, cz))
    rim, rim2, val = [], [], []
    for k in range(n):
        a = k * math.tau / n
        rim.append(bm.verts.new(g(cx + math.cos(a) * r, cy - drop, cz + math.sin(a) * r)))
        rim2.append(bm.verts.new(g(cx + math.cos(a) * r * 0.98, cy - drop - 0.02, cz + math.sin(a) * r * 0.98)))
        val.append(bm.verts.new(g(cx + math.cos(a) * r, cy - drop - valance, cz + math.sin(a) * r)))
    for k in range(n):
        j = (k + 1) % n
        f = bm.faces.new([apex, rim[j], rim[k]])
        f.material_index = k % len(mats)
        f2 = bm.faces.new([apex2, rim2[k], rim2[j]])
        f2.material_index = k % len(mats)
        f3 = bm.faces.new([rim[k], rim[j], val[j], val[k]])
        f3.material_index = k % len(mats)
        f4 = bm.faces.new([val[k], val[j], rim2[j], rim2[k]])
        f4.material_index = k % len(mats)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return o


lg.append(canopy("ParasolCanopy", PX, PY, PZ, 1.05, 0.38, 10, [M["red"], M["canvas"]]))
lg.append(sphere("ParasolFinial", 0.045, g(PX, PY + 0.03, PZ), M["red"], 10, 6))
# a red rescue tube hanging on the front left leg by its strap
RT = (LX + 0.6, LZ + 0.58)
lg.append(gbx("RescueTube", RT[0] - 0.05, RT[0] + 0.05, 0.75, 1.55, RT[1] + 0.03, RT[1] + 0.17, M["red_gloss"], 0.045))
lg.append(tube("TubeStrap", [g(RT[0], 1.55, RT[1] + 0.1), g(RT[0] - 0.02, 1.78, RT[1] + 0.05), g(RT[0] - 0.05, 1.7, RT[1] - 0.02)], 0.012, M["navy"], 3, 4))
lg.append(flat_text("TubeWord", "RESCUE", 0.07, M["canvas"], g(RT[0] + 0.052, 1.15, RT[1] + 0.1), PI / 2, 0.004, "BarlowCondensed-Black"))
lg[-1].rotation_euler = (PI / 2, 0, 0)  # (along the tube)
apply_all(lg[-1])
# the torch's post: a teak post, a cradle on top; the game hangs its torch where `Flashlight` is
FLX, FLZ = FIXTURES["flashlight"]
lg.append(gbx("TorchPost", FLX - 0.045, FLX + 0.045, 0, 1.06, FLZ - 0.045, FLZ + 0.045, M["teak"], 0.012))
lg.append(gbx("TorchPostFoot", FLX - 0.12, FLX + 0.12, 0, 0.03, FLZ - 0.12, FLZ + 0.12, M["iron"], 0.008))
lg.append(gbx("TorchCradle", FLX - 0.17, FLX + 0.17, 1.06, 1.1, FLZ - 0.08, FLZ + 0.08, M["navy"], 0.01))
for sx in (-1, 1):
    lg.append(gbx("CradleFork", FLX + sx * 0.12 - 0.015, FLX + sx * 0.12 + 0.015, 1.1, 1.2, FLZ - 0.06, FLZ + 0.06, M["navy"], 0.006))
torch = cyl("Flashlight", 0.045, 0.26, g(FLX - 0.13, 1.17, FLZ), M["sun"], 10, rot=(0, PI / 2, 0))
torch.name = "Flashlight"
lg.append(torch)
add("lifeguard", *lg)

# ==== 3. the stations ===============================================================================================================
# WATER CARE at (13.6, 8.1), facing the pool (-x): a yellow cabinet with chlorine tubs and a test kit, a teal back with its board
F = Frame(*STATIONS["chlorine"], "-x")
wc = []
wc.append(F.box("Kick", -0.8, 0.8, 0, 0.08, -0.28, 0.28, M["charcoal"], 0.01))
wc.append(F.box("Cabinet", -0.85, 0.85, 0.08, 1.0, -0.32, 0.32, M["sun"], 0.03))
for u0, u1 in ((-0.8, -0.02), (0.02, 0.8)):
    wc.append(F.box("Door", u0, u1, 0.14, 0.94, 0.32, 0.345, M["sun_gloss"], 0.012))
    for k in range(4):
        y = 0.62 + k * 0.06
        wc.append(F.box("Vent", u0 + 0.12, u1 - 0.12, y, y + 0.02, 0.345, 0.352, M["charcoal"], 0))
wc.append(F.box("Handle", -0.1, -0.06, 0.45, 0.68, 0.345, 0.38, M["steel"], 0.008))
wc.append(F.box("Handle", 0.06, 0.1, 0.45, 0.68, 0.345, 0.38, M["steel"], 0.008))
wc.append(F.box("Worktop", -0.9, 0.9, 1.0, 1.05, -0.36, 0.38, M["steel"], 0.01))
wc.append(F.box("BackPanel", -0.9, 0.9, 1.05, 2.25, -0.36, -0.3, M["teal_dark"], 0.02))
wc.append(F.box("BackCap", -0.95, 0.95, 2.25, 2.32, -0.4, -0.26, M["whitewash"], 0.015))
wc.append(F.sign("WaterCareSign", 1.5, 0.75, 0, 1.82, -0.295, "water_care"))
# two chlorine tubs, a test kit with its vials, a clipboard, a measuring jug
for u in (-0.6, -0.25):
    wc.append(cyl("Tub", 0.15, 0.32, F.g(u, 1.05, 0.0), M["tub"], 16, r2=0.135))
    wc.append(cyl("TubLid", 0.145, 0.04, F.g(u, 1.37, 0.0), M["lid"], 16))
    wc.append(F.box("TubLabel", u - 0.09, u + 0.09, 1.12, 1.26, 0.13, 0.146, M["sun"], 0))
wc.append(F.box("TestKit", 0.12, 0.42, 1.05, 1.15, -0.12, 0.1, M["whitewash"], 0.015))
for k, col in enumerate(("#e0513f", "#f4c849", "#5cc3cc", "#e0513f")):
    wc.append(cyl("Vial", 0.016, 0.1, F.g(0.17 + k * 0.07, 1.15, -0.01), sm("vial_" + col[1:], col, 0.15), 8))
wc.append(F.box("Clipboard", 0.5, 0.78, 1.05, 1.07, -0.16, 0.2, M["teak"], 0.004))
wc.append(F.box("Paper", 0.52, 0.76, 1.07, 1.075, -0.14, 0.16, sm("paper"), 0))
wc.append(cyl("Jug", 0.07, 0.18, F.g(0.66, 1.05, 0.28), sm("jug", "#e8f3ea", 0.3), 12, r2=0.06))
# a hose reel on the side
wc.append(cyl("Reel", 0.22, 0.08, F.g(0.94, 0.55, 0.0), M["teal"], 18, rot=(PI / 2, 0, 0)))
wc[-1].location = F.g(0.9, 0.55, 0.0)
add("water_care", *wc)

# EYE CARE at (13.6, 0.4): a pedestal eyewash basin toward the deck, a wall unit behind it with a mirror, towels and the board
F = Frame(*STATIONS["relief"], "-x")
ec = []
# the unit at the back (v -0.85..-0.45), the basin at the front (v ~0.45)
ec.append(F.box("UnitKick", -0.55, 0.55, 0, 0.08, -0.85, -0.5, M["charcoal"], 0.01))
ec.append(F.box("Unit", -0.58, 0.58, 0.08, 0.95, -0.86, -0.46, sm("unit_white", "#eef3ee", 0.4), 0.03))
for u0, u1 in ((-0.54, -0.02), (0.02, 0.54)):
    ec.append(F.box("UnitDoor", u0, u1, 0.14, 0.9, -0.46, -0.44, M["teal"], 0.01))
ec.append(F.box("UnitTop", -0.6, 0.6, 0.95, 1.0, -0.88, -0.42, M["steel"], 0.01))
ec.append(F.box("Back", -0.6, 0.6, 1.0, 2.3, -0.88, -0.82, M["teal_dark"], 0.02))
ec.append(F.box("BackCap", -0.65, 0.65, 2.3, 2.37, -0.92, -0.78, M["whitewash"], 0.015))
ec.append(F.sign("EyeCareSign", 1.1, 0.55, 0, 2.0, -0.815, "eye_care"))
ec.append(F.box("MirrorFrame", -0.32, 0.32, 1.12, 1.66, -0.82, -0.8, M["whitewash"], 0.01))
ec.append(F.box("Mirror", -0.28, 0.28, 1.16, 1.62, -0.8, -0.795, M["mirror"], 0))
# a towel rail with folded towels, a bottle of eye drops, a box of tissues on the top
ec.append(rod("TowelRail", F.at(0.4, 1.35, -0.78), F.at(0.58, 1.35, -0.78), 0.012, M["steel"]))
for k, m_ in enumerate((M["towel"], M["towel_teal"], M["towel"])):
    y = 1.0 + k * 0.07
    ec.append(F.box("Towel", -0.52, -0.2, y, y + 0.065, -0.7, -0.48, m_, 0.025))
ec.append(cyl("Drops", 0.03, 0.11, F.g(0.1, 1.0, -0.6), sm("drops", "#5cc3cc", 0.25), 10))
ec.append(cyl("DropsCap", 0.018, 0.04, F.g(0.1, 1.11, -0.6), M["whitewash"], 8))
ec.append(F.box("Tissues", 0.22, 0.42, 1.0, 1.1, -0.68, -0.52, sm("tissue_box", "#f2b48f", 0.6), 0.01))
# the eyewash: a stainless bowl on a post, its twin nozzles, a yellow push paddle, a drain grate below
ec.append(cyl("WashPost", 0.05, 0.85, F.g(0, 0.03, 0.45), M["steel"], 14))
ec.append(cyl("WashBase", 0.16, 0.04, F.g(0, 0.0, 0.45), M["steel"], 18))
ec.append(cyl("Bowl", 0.06, 0.12, F.g(0, 0.88, 0.45), M["steel"], 20, r2=0.24))
ec.append(cyl("BowlRim", 0.25, 0.02, F.g(0, 1.0, 0.45), M["steel"], 20))
for du in (-0.07, 0.07):
    ec.append(cyl("Nozzle", 0.02, 0.07, F.g(du, 0.98, 0.45), M["sun"], 8))
ec.append(F.box("Paddle", -0.12, 0.12, 0.9, 0.94, 0.68, 0.76, M["sun_gloss"], 0.01))
ec.append(F.box("Drain", -0.2, 0.2, 0.0, 0.01, 0.25, 0.65, M["steel"], 0))
add("eye_care", *ec)

# FIN RACK at (-12.6, 7.9), along z: a teak A-frame, a central board with pegs, the FIN RENTAL header on both faces; three pairs
# of fins (Fins_1..3) hang on the pool's side (+x), kickboards stand on the shelf at the back
FX, FZ_ = STATIONS["fins"]
fr = []
for z in (FZ_ - 0.95, FZ_ + 0.95):
    fr.append(tube("EndLeg", [g(FX - 0.42, 0, z), g(FX, 1.85, z)], 0.035, M["teak_dark"], 1, 4))
    fr.append(tube("EndLeg", [g(FX + 0.42, 0, z), g(FX, 1.85, z)], 0.035, M["teak_dark"], 1, 4))
    fr.append(gbx("EndFoot", FX - 0.46, FX + 0.46, 0, 0.05, z - 0.05, z + 0.05, M["iron"], 0.01))
fr.append(gbx("PegBoard", FX - 0.03, FX + 0.03, 0.55, 1.75, FZ_ - 0.92, FZ_ + 0.92, M["teal"], 0.015))
for k in range(5):
    y = 0.62 + k * 0.26
    fr.append(gbx("Batten", FX - 0.04, FX + 0.04, y, y + 0.04, FZ_ - 0.92, FZ_ + 0.92, M["teak"], 0.006))
fr.append(gbx("Header", FX - 0.05, FX + 0.05, 1.85, 2.2, FZ_ - 1.0, FZ_ + 1.0, M["navy"], 0.02))
for sx, rz in ((1, PI / 2), (-1, -PI / 2)):
    fr.append(flat_text("FinRental", "FIN RENTAL", 0.24, M["canvas"], g(FX + sx * 0.055, 2.025, FZ_), rz, 0.006, "BarlowCondensed-Black"))
fr.append(gbx("Shelf", FX - 0.36, FX - 0.04, 0.32, 0.36, FZ_ - 0.92, FZ_ + 0.92, M["teak"], 0.008))
for k in range(5):
    z = FZ_ - 0.72 + k * 0.36
    col = (M["fin_teal"], M["fin_coral"], M["fin_yellow"])[k % 3]
    fr.append(gbx("Kickboard", FX - 0.3, FX - 0.27, 0.36, 0.82, z - 0.14, z + 0.14, col, 0.012))
fins = []


def fin(x, y, z, col, flip):
    """One swim fin hanging blade down, its face toward +x: a foot pocket and a tapered blade with ribs."""
    pts = [(-0.07, 0), (0.07, 0), (0.12, -0.36), (0.1, -0.5), (0.0, -0.53), (-0.1, -0.5), (-0.12, -0.36)]
    blade = extrude_shape("FinBlade", pts, 0.018, (0, 0, 0), col, rot=(PI / 2, 0, PI / 2))
    apply_all(blade)
    pocket = box("FinPocket", (0.03, 0.13, 0.18), (0.01, 0, -0.06), M["foot"], 0.025)
    ribs = [box("FinRib", (0.008, 0.012, 0.34), (0.022, s * 0.055, -0.3), M["foot"], 0.004) for s in (-1, 1)]
    o = join([blade, pocket] + ribs, "Fin")
    o.location = g(x, y, z)
    o.rotation_euler = (0, 0.12 if flip else -0.12, 0)
    apply_all(o)
    return o


for i, z in enumerate((FZ_ - 0.57, FZ_, FZ_ + 0.57)):
    col = (M["fin_yellow"], M["fin_teal"], M["fin_coral"])[i]
    pair = join([fin(FX + 0.06, 1.48, z - 0.075, col, False), fin(FX + 0.08, 1.46, z + 0.075, col, True)], "Fins_%d" % (i + 1))
    pair.name = "Fins_%d" % (i + 1)
    fins.append(pair)
    fr.append(rod("Peg", (FX + 0.03, 1.5, z), (FX + 0.16, 1.53, z), 0.012, M["steel"]))
add("fins", *fr)
add("fins", *fins)

# SANITATION: the skimmer board on the left wall (the game's hooks run from x -15.9 at y 1.8, its skimmer hangs at z -3.7) and the bin
RX_, RZ_ = SANITATION["rack"]
sn = []
BXF = -15.9  # the board's face
for z in (RZ_ - 1.85, RZ_ + 1.85):
    sn.append(gbx("BoardPost", BXF - 0.14, BXF - 0.06, 0, 2.55, z - 0.05, z + 0.05, M["teak_dark"], 0.012))
sn.append(gbx("SkimBoard", BXF - 0.07, BXF, 1.12, 2.4, RZ_ - 1.95, RZ_ + 1.95, M["teal_dark"], 0.02))
sn.append(gbx("SkimFrameT", BXF - 0.08, BXF + 0.015, 2.36, 2.44, RZ_ - 1.98, RZ_ + 1.98, M["whitewash"], 0.01))
sn.append(gbx("SkimFrameB", BXF - 0.08, BXF + 0.015, 1.08, 1.16, RZ_ - 1.98, RZ_ + 1.98, M["whitewash"], 0.01))
sn.append(gbx("SkimHeader", BXF - 0.08, BXF - 0.02, 2.47, 2.85, RZ_ - 1.3, RZ_ + 1.3, M["navy"], 0.015))
sn.append(flat_text("SkimWord", "POOL SKIMMER", 0.26, M["sun"], g(BXF - 0.015, 2.66, RZ_), PI / 2, 0.006, "BarlowCondensed-Black"))
# outlines painted where the tools go (the skimmer's net, the scoop), and a spare brush head on a hook
sn.append(gbx("ToolOutline", BXF, BXF + 0.004, 1.3, 2.25, RZ_ - 1.62, RZ_ - 1.38, M["sun"], 0))
sn.append(gbx("BrushHead", BXF + 0.01, BXF + 0.09, 1.35, 1.47, RZ_ + 0.15, RZ_ + 0.75, M["teal"], 0.02))
for k in range(8):
    z = RZ_ + 0.19 + k * 0.07
    sn.append(gbx("Bristle", BXF + 0.09, BXF + 0.14, 1.36, 1.46, z, z + 0.03, sm("bristle", "#f2e6c4", 0.9), 0))
add("sanitation", *sn)
BNX, BNZ = SANITATION["bin"]
bn = []
bn.append(cyl("Bin", 0.5, 1.2, g(BNX, 0.02, BNZ), M["bin"], 24, r2=0.56))
bn.append(cyl("BinFoot", 0.52, 0.04, g(BNX, 0.0, BNZ), M["charcoal"], 24))
for y in (0.3, 0.9):
    bn.append(torus("BinBand", 0.515 + (y - 0.3) * 0.05, 0.015, g(BNX, y, BNZ), M["gold"], 24, 4))
bn.append(cyl("BinLid", 0.58, 0.06, g(BNX, 1.22, BNZ), M["bin"], 24, r2=0.5))
bn.append(torus("BinRim", 0.57, 0.035, g(BNX, 1.23, BNZ), M["gold"], 24, 6))
bn.append(cyl("BinMouth", 0.32, 0.02, g(BNX, 1.28, BNZ), M["charcoal"], 18))
bn.append(cyl("BinKnob", 0.06, 0.04, g(BNX, 1.29, BNZ), M["gold"], 12))
bn.append(flat_text("BinWord", "WASTE", 0.15, M["sun"], g(BNX - 0.565, 0.72, BNZ), -PI / 2, 0.006, "BarlowCondensed-Black"))
add("sanitation", *bn)

# FISH NET: a board on two posts by the right-hand glass at z -2.8 (the game's hooks and its net stand off it)
FN_X, FN_Z, _ = FIXTURES["fishNet"]
fn = []
FF = 16.44  # the board's face (in front of the pier's cap)
fn.append(gbx("NetBoard", FF, FF + 0.06, 0.3, 2.95, FN_Z - 0.45, FN_Z + 0.45, sm("net_board", "#2c6f5c", 0.5), 0.02))
fn.append(gbx("NetBoardTrim", FF - 0.01, FF + 0.07, 2.9, 2.98, FN_Z - 0.48, FN_Z + 0.48, M["whitewash"], 0.01))
fn.append(gbx("NetHeader", FF - 0.01, FF + 0.05, 3.02, 3.32, FN_Z - 0.55, FN_Z + 0.55, M["navy"], 0.015))
fn.append(flat_text("NetWord", "FISH NET", 0.22, sm("net_word", "#e9f7d6", 0.5), g(FF - 0.015, 3.17, FN_Z), -PI / 2, 0.006, "BarlowCondensed-Black"))
for y in (1.25, 2.35):
    fn.append(gbx("HookPlate", FF - 0.012, FF, y - 0.07, y + 0.07, FN_Z - 0.07, FN_Z + 0.07, M["steel"], 0.004))
for dz in (-0.38, 0.38):  # (it stands on its own posts, in front of the glass)
    fn.append(gbx("NetPost", FF + 0.06, FF + 0.16, 0.0, 3.3, FN_Z + dz - 0.05, FN_Z + dz + 0.05, M["navy"], 0.01))
    fn.append(cyl("NetPostFoot", 0.11, 0.04, g(FF + 0.11, 0.0, FN_Z + dz), M["steel"], 12))
fn.append(sphere("FishDecal", 0.09, g(FF - 0.01, 0.75, FN_Z), M["sun"], 10, 6, (0.2, 1.8, 0.9)))
add("fish_net", *fn)

# LIFE RINGS: a board on the hotel wall and one on a pier each side; the game hangs its ring where each `LifeRing` is
ring_marks = []


def ring_board(name, x, z, face, wall):
    """A teal board on `wall` (the face it is fixed to), a peg, a coiled throw line, a LIFE RING header."""
    F = Frame(x, z, face)
    # v measured from the mount point: the wall's face is at v = wall
    out = []
    out.append(F.box(name + "Board", -0.6, 0.6, 0.55, 2.78, wall, wall + 0.06, M["teal_dark"], 0.02))
    out.append(F.box(name + "Trim", -0.64, 0.64, 2.74, 2.82, wall - 0.005, wall + 0.075, M["whitewash"], 0.01))
    out.append(F.box(name + "Trim", -0.64, 0.64, 0.51, 0.59, wall - 0.005, wall + 0.075, M["whitewash"], 0.01))
    out.append(F.box(name + "Header", -0.62, 0.62, 2.86, 3.18, wall, wall + 0.05, M["red"], 0.015))
    out.append(F.text(name + "Word", "LIFE RING", 0.22, M["canvas"], 0, 3.02, wall + 0.055))
    out.append(rod(name + "Peg", F.at(0, 2.4, wall + 0.06), F.at(0, 2.43, wall + 0.24), 0.022, M["steel"]))
    # the throw line coiled on a cleat at the side
    out.append(F.box(name + "Cleat", 0.42, 0.5, 1.45, 1.6, wall + 0.06, wall + 0.12, M["steel"], 0.01))
    coil = torus(name + "Coil", 0.12, 0.022, F.g(0.46, 1.32, wall + 0.12), M["rope"], 18, 5, rot=(PI / 2, 0, F.rz))
    out.append(coil)
    out.append(torus(name + "Coil", 0.1, 0.02, F.g(0.47, 1.3, wall + 0.14), M["rope"], 18, 5, rot=(PI / 2, 0, F.rz)))
    # the ring's place (the game's own ring hangs here: R 0.49, r 0.13)
    c = F.at(0, 1.9, wall + 0.2)
    mark = torus("LifeRing", 0.49, 0.13, g(*c), M["ring"], 24, 8, rot=(PI / 2, 0, F.rz))
    mark.name = "LifeRing"
    out.append(mark)
    ring_marks.append(c)
    return out


# (v for each: the wall's face relative to the mount point, measured toward the deck)
add("rings", *ring_board("HotelRing", -4.0, -16.12, "+z", 0.0))  # on the hotel's face (z -16.12)
add("rings", *ring_board("LeftRing", -15.76, -5.4, "+x", 0.0))  # on the left pier's cap face (x -15.76)
add("rings", *ring_board("RightRing", 16.51, -6.6, "-x", 0.0))  # on the right pier's cap face (x 16.51)

# ==== BENCHES: teak slats on cast-iron frames, along z ==================================================================================


def bench(name, x, z, length=3.4, depth=0.96, back=0):
    out = []
    z0, z1 = z - length / 2, z + length / 2
    for zz in (z0 + 0.18, z, z1 - 0.18):
        # a cast-iron end frame: two legs, a seat bearer, a foot rail
        for sx in (-1, 1):
            out.append(gbx(name + "Leg", x + sx * (depth / 2 - 0.08) - 0.03, x + sx * (depth / 2 - 0.08) + 0.03, 0, 0.42, zz - 0.035, zz + 0.035, M["iron"], 0.012))
        out.append(gbx(name + "Bearer", x - depth / 2 + 0.03, x + depth / 2 - 0.03, 0.38, 0.42, zz - 0.04, zz + 0.04, M["iron"], 0.01))
        out.append(gbx(name + "FootRail", x - depth / 2 + 0.08, x + depth / 2 - 0.08, 0.08, 0.11, zz - 0.025, zz + 0.025, M["iron"], 0.008))
        if back:
            bx_ = x + back * (depth / 2 - 0.06)
            out.append(tube(name + "BackPost", [g(bx_, 0.42, zz), g(bx_ + back * 0.12, 0.95, zz)], 0.03, M["iron"], 1, 6))
    n = 6
    for k in range(n):
        xx = x - depth / 2 + 0.04 + k * (depth - 0.08) / n
        out.append(gbx(name + "Slat", xx, xx + (depth - 0.08) / n - 0.025, 0.42, 0.47, z0, z1, M["teak"], 0.012))
    if back:
        for k in range(3):
            y = 0.58 + k * 0.13
            bx_ = x + back * (depth / 2 - 0.02 + (y - 0.42) * 0.2)
            out.append(gbx(name + "BackSlat", bx_ - 0.025, bx_ + 0.025, y, y + 0.1, z0 + 0.05, z1 - 0.05, M["teak"], 0.01))
    return out


add("benches", *bench("RescueBench", *RESCUE_BENCH))  # (the rescued are laid on it: no back)
add("benches", *bench("SideBench", *BENCH_2, back=1))  # (against the right-hand wall: its back to the wall)
# a towel and a water bottle left on the side bench
add("benches", towel_folded("BenchTowel", 0.4, 0.3, 0.06, sm("towel_coral"), sm("towel_stripe"), g(13.85, 0.47, -5.2), 0.2))
add("benches", bottle("BenchBottle", sm("bottle_blue", "#5cc3cc", 0.2), M["whitewash"], 0.22, 0.035, g(13.7, 0.47, -7.3)))

# ---- report and save ---------------------------------------------------------------------------------------------------------------------
for item, objs in parts.items():
    print("ITEM", item, tris([o for o in objs if o.type == "MESH"]), "triangles")
for f_ in fins:
    c = sum((f_.matrix_world @ Vector(b) for b in f_.bound_box), Vector()) / 8
    print("CENTRE", f_.name, [round(c.x, 3), round(c.z, 3), round(-c.y, 3)])
for c in ring_marks:
    print("CENTRE LifeRing", [round(v, 3) for v in c])
c = sum((torch.matrix_world @ Vector(b) for b in torch.bound_box), Vector()) / 8
print("CENTRE Flashlight", [round(c.x, 3), round(c.z, 3), round(-c.y, 3)])
everything = [o for objs in parts.values() for o in objs]
if LOOK:
    look("stations_trampoline", g(12.4, 1.6, 5), 8.5, 24, 220, (960, 640), 18, 32)
    look("stations_lifeguard", g(-13.2, 1.5, -7.2), 6.5, 18, 120, (960, 640), 18, 32)
    look("stations_right", g(14.2, 1.1, 3.0), 11, 26, 245, (960, 640), 18, 30)
    look("stations_left", g(-13.8, 1.2, 1.0), 12, 26, 70, (960, 640), 18, 30)
    look("stations_hotelring", g(-4, 1.8, -16), 4.5, 10, 0, (720, 560), 16, 35)
    look("stations_watercare", g(13.6, 1.1, 6.0), 7.5, 20, 280, (960, 640), 16, 32)
    look("stations_fishnet", g(16.4, 1.6, -4.6), 6.5, 14, 260, (960, 640), 16, 32)
save_part("stations", everything)
