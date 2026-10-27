"""The Community Pool's building, modelled in place in game coordinates: the deck, the pool's basin and coping, the walls with
their tiles, windows and radiators, and the roof (drawn only in shadows, so the camera looks into the hall while the sun still
falls through its skylights). Writes godot/assets/venue/club_shell.glb.

Object names tell Godot what to do with them (scripts/club/club_scene.gd):
  ShadowOnly_*  cast shadows, never seen by the camera     Glass_*   transparent, cast no shadow
  UnderwaterLight_*  a light is added at its centre        GD_ materials are replaced by Godot's (triplanar tiles, shaders)

    blender -b -P godot/tools/blender/build_shell.py
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from lib import *

reset()

# ---- the plan (godot/data/club-venue.json; metres; Godot axes) -------------------------------------------------------------
HX, HZ = 5.0, 8.3  # the basin's half width (x) and half length (z)
ROOM = dict(x0=-14.7, x1=14.7, z0=-16.7, z1=13.5)
H = 9.6  # the walls' height (the roof's underside)
T = 0.35  # the walls' thickness
WATER_Y = -0.25
DEEP, SHALLOW = -1.85, -1.1  # the floor at the block end (z -8.3) and at the far end (z +8.3)

M = dict(
    deck=gdmat("deck", "#dcb98f", 0.65),
    pool=gdmat("pool_tile", "#bfe7e3", 0.15),
    band=gdmat("deck_band", "#2f8c88", 0.3),
    wall_sea=gdmat("wall_sea", "#3e9e8f", 0.15),
    wall_navy=gdmat("wall_navy", "#24456e", 0.15),
    wall_cream=gdmat("wall_cream", "#f3e8cf", 0.15),
    plaster=gdmat("plaster", "#f1dcb4", 0.85),
    waterline=gdmat("waterline", "#1d3557", 0.12),
    coping=mat("coping_stone", "#efe2c4", 0.5),
    lane=mat("lane_paint", "#1d3557", 0.3),
    timber=gdmat("timber", "#c88b4f", 0.5),
    frame=mat("frame_paint", "#f4f1ea", 0.35),
    frame_dark=mat("frame_navy", "#24456e", 0.35),
    glass=mat("glass_pane", "#d7eef2", 0.05, alpha=0.25),
    steel=mat("steel"),
    grate=mat("grate_steel", "#aab2b8", 0.35, 1.0),
    radiator=mat("radiator_cream", "#f1e4c8", 0.4),
    lamp=mat("lamp_lens", "#fff1d6", 0.2, emit="#fff1d6", emit_strength=6.0),
    shadow=mat("shadow_only", "#555555", 0.9),
    stencil=mat("stencil_paint", "#f4f1ea", 0.45),
    stencil_navy=mat("stencil_navy", "#1d3557", 0.45),
    stencil_coral=mat("stencil_coral", "#ef6a4c", 0.45),
)


def gbox(name, center, size, m, bev=0.0, seg=2):
    """A box in Godot coordinates: `center` (x, y, z), `size` (along x, y, z)."""
    return box(name, (size[0], size[2], size[1]), g(*center), m, bev, seg)


def ring(name, x_in, z_in, x_out, z_out, y0, y1, m, bev=0.0):
    """A flat rectangular ring (outer minus inner rectangle) from y0 to y1, centred on the pool (Godot coordinates)."""
    bm = bmesh.new()
    pts_o = [(-x_out, -z_out), (x_out, -z_out), (x_out, z_out), (-x_out, z_out)]
    pts_i = [(-x_in, -z_in), (x_in, -z_in), (x_in, z_in), (-x_in, z_in)]
    vo = [bm.verts.new(g(x, y1, z)) for x, z in pts_o]
    vi = [bm.verts.new(g(x, y1, z)) for x, z in pts_i]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([vo[i], vo[j], vi[j], vi[i]])
    top = list(bm.faces)
    r = bmesh.ops.extrude_face_region(bm, geom=top)
    moved = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, y0 - y1), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    if bev:
        bevel(o, bev, 3, angle=30)
    return o


parts = []

# ---- the deck: one slab, wall to wall, with the pool cut out ---------------------------------------------------------------
parts.append(ring("Deck", HX, HZ, ROOM["x1"], ROOM["z1"], -0.4, 0.0, M["deck"]))
# (the room is not symmetric in z: stretch the slab's far side to the room's -z wall)
deck = parts[-1]
for v in deck.data.vertices:
    if v.co.y > 12.0:  # Blender y = -Godot z: the outer edge at the -z end
        v.co.y = -ROOM["z0"]

# a band of glazed sea-green tiles round the coping, and a stainless drain grate a step further out
parts.append(ring("DeckBand", HX + 0.36, HZ + 0.36, HX + 0.72, HZ + 0.72, -0.01, 0.004, M["band"]))
parts.append(ring("DrainGrate", HX + 1.02, HZ + 1.02, HX + 1.14, HZ + 1.14, -0.01, 0.003, M["grate"]))
# a drain channel along the foot of every wall
for name, c, s in [
    ("WallDrainA", (0, 0.002, ROOM["z0"] + 0.22), (ROOM["x1"] * 2 - 0.5, 0.006, 0.12)),
    ("WallDrainB", (ROOM["x1"] - 0.22, 0.002, -1.6), (0.12, 0.006, 29.6)),
]:
    parts.append(gbox(name, c, s, M["grate"]))

# ---- the basin: tiled walls and a floor that slopes from 1.85 m deep at the blocks to 1.1 m at the far end ----------------
bm = bmesh.new()
corners = [(-HX, -HZ), (HX, -HZ), (HX, HZ), (-HX, HZ)]
floor_y = lambda z: DEEP + (SHALLOW - DEEP) * (z + HZ) / (2 * HZ)
top = [bm.verts.new(g(x, 0.0, z)) for x, z in corners]
bot = [bm.verts.new(g(x, floor_y(z), z)) for x, z in corners]
for i in range(4):
    j = (i + 1) % 4
    bm.faces.new([top[i], bot[i], bot[j], top[j]])  # walls, facing in
bm.faces.new(list(reversed(bot)))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.normal_update()
floor_face = [f for f in bm.faces if abs(f.normal.z) > 0.5][0]
if floor_face.normal.z < 0:  # the basin is seen from inside: its floor faces up, its walls face the water
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
me = bpy.data.meshes.new("Basin")
bm.to_mesh(me)
bm.free()
basin = bpy.data.objects.new("Basin", me)
bpy.context.scene.collection.objects.link(basin)
set_mat(basin, M["pool"])
parts.append(basin)

# the waterline: a band of dark glazed tiles where the water meets the wall
for name, c, s in [
    ("WaterlineN", (0, -0.24, -HZ + 0.006), (2 * HX, 0.26, 0.012)),
    ("WaterlineS", (0, -0.24, HZ - 0.006), (2 * HX, 0.26, 0.012)),
    ("WaterlineW", (-HX + 0.006, -0.24, 0), (0.012, 0.26, 2 * HZ)),
    ("WaterlineE", (HX - 0.006, -0.24, 0), (0.012, 0.26, 2 * HZ)),
]:
    parts.append(gbox(name, c, s, M["waterline"]))

# the coping: a rounded cream stone kerb, overhanging the water by 3 cm
parts.append(ring("Coping", HX - 0.03, HZ - 0.03, HX + 0.36, HZ + 0.36, -0.07, 0.012, M["coping"], bev=0.035))

# lane lines on the floor (a T at each end, 2 m from the wall) and targets on the end walls
slope = math.atan2(SHALLOW - DEEP, 2 * HZ)
for i, lx in enumerate([-3.2, 0.0, 3.2]):
    z0, z1 = -HZ + 2.0, HZ - 2.0
    zc = (z0 + z1) / 2
    stripe = gbox(f"LaneLine{i}", (lx, floor_y(zc) + 0.004, zc), (0.25, 0.008, z1 - z0), M["lane"])
    stripe.rotation_euler.x = -slope
    parts.append(stripe)
    for zt in (z0, z1):
        bar = gbox(f"LaneT{i}_{zt:.0f}", (lx, floor_y(zt) + 0.004, zt), (1.0, 0.008, 0.25), M["lane"])
        bar.rotation_euler.x = -slope
        parts.append(bar)
    for side, zw in (("N", -HZ + 0.012), ("S", HZ - 0.012)):
        fy = floor_y(zw)
        parts.append(gbox(f"Target{i}{side}V", (lx, (fy - 0.5) / 2 + 0.0, zw), (0.25, abs(fy) - 0.55, 0.01), M["lane"]))
        parts.append(gbox(f"Target{i}{side}H", (lx, -0.75, zw), (0.9, 0.25, 0.01), M["lane"]))

# underwater lights: a chrome bezel and a warm lens in each long wall
for k, (x, z) in enumerate([(-HX, -4.5), (-HX, 2.5), (HX, -4.5), (HX, 2.5)]):
    s = 1 if x > 0 else -1
    rim = cyl(f"UnderwaterBezel{k}", 0.17, 0.03, g(x - s * 0.015, -0.95, z), M["steel"], 28, rot=(0, math.pi / 2 * s, 0))
    lens = cyl(f"UnderwaterLight_{k}", 0.13, 0.034, g(x - s * 0.02, -0.95, z), M["lamp"], 28, rot=(0, math.pi / 2 * s, 0))
    parts += [rim, lens]

# ---- the walls ---------------------------------------------------------------------------------------------------------------
x0, x1, z0, z1 = ROOM["x0"], ROOM["x1"], ROOM["z0"], ROOM["z1"]
W = x1 - x0
L = z1 - z0


def wainscot(prefix, along_x, fixed, a0, a1, inward):
    """Glazed tiles to 1.6 m on a wall's inner face, a navy band and a cream row above, and a navy cove at the floor."""
    out = []
    n = inward * 0.012
    for tag, y0, y1, m, d in [
        ("Tiles", 0.0, 1.6, M["wall_sea"], 0.02),
        ("Band", 1.6, 1.76, M["wall_navy"], 0.045),
        ("Cream", 1.76, 1.92, M["wall_cream"], 0.03),
        ("Cove", 0.0, 0.12, M["wall_navy"], 0.04),
    ]:
        length = a1 - a0
        c = (a0 + a1) / 2
        if along_x:
            out.append(gbox(f"{prefix}{tag}", (c, (y0 + y1) / 2, fixed + inward * d / 2), (length, y1 - y0, d), m, 0.004))
        else:
            out.append(gbox(f"{prefix}{tag}", (fixed + inward * d / 2, (y0 + y1) / 2, c), (d, y1 - y0, length), m, 0.004))
    # a timber dado rail
    if along_x:
        out.append(gbox(f"{prefix}Rail", ((a0 + a1) / 2, 1.97, fixed + inward * 0.04), (a1 - a0, 0.08, 0.06), M["timber"], 0.01))
    else:
        out.append(gbox(f"{prefix}Rail", (fixed + inward * 0.04, 1.97, (a0 + a1) / 2), (0.06, 0.08, a1 - a0), M["timber"], 0.01))
    return out


# -z: the end wall behind the starting blocks (the mural's wall), plastered above the tiles
parts.append(gbox("WallBlocks", (0, H / 2, z0 - T / 2), (W + 2 * T, H, T), M["plaster"]))
parts += wainscot("WallBlocks", True, z0, x0, x1, +1)
# pilasters with timber caps, framing the mural between the locker rooms
for k, px in enumerate([-7.85, 7.85]):
    parts.append(gbox(f"Pilaster{k}", (px, H / 2, z0 + 0.14), (0.7, H, 0.28), M["wall_cream"], 0.01))
    parts.append(gbox(f"PilasterCap{k}", (px, 7.95, z0 + 0.18), (0.86, 0.22, 0.36), M["timber"], 0.02))
    parts.append(gbox(f"PilasterBase{k}", (px, 0.25, z0 + 0.18), (0.8, 0.5, 0.36), M["wall_navy"], 0.01))
# a timber cornice running round the top of the walls
parts.append(gbox("CorniceBlocks", (0, H - 0.4, z0 + 0.12), (W, 0.36, 0.24), M["timber"], 0.02))

# +x: the long wall of tall windows the afternoon sun comes through, radiators under the sills
SILL, HEAD = 2.1, 8.4
n_win, win_w = 6, 4.0
pier = (L - n_win * win_w) / (n_win + 1)
parts.append(gbox("WallWindowsLow", (x1 + T / 2, SILL / 2, (z0 + z1) / 2), (T, SILL, L + 2 * T), M["plaster"]))
parts.append(gbox("WallWindowsHigh", (x1 + T / 2, (HEAD + H) / 2, (z0 + z1) / 2), (T, H - HEAD, L + 2 * T), M["plaster"]))
parts += wainscot("WallWindows", False, x1, z0, z1, -1)
parts.append(gbox("SillTimber", (x1 - 0.12, SILL + 0.03, (z0 + z1) / 2), (0.3, 0.06, L), M["timber"], 0.015))
for k in range(n_win + 1):
    zc = z0 + pier / 2 + k * (pier + win_w)
    parts.append(gbox(f"WindowPier{k}", (x1 + T / 2, (SILL + HEAD) / 2, zc), (T, HEAD - SILL, pier), M["plaster"]))
    parts.append(gbox(f"WindowPierFace{k}", (x1 - 0.03, (SILL + HEAD) / 2, zc), (0.06, HEAD - SILL, pier - 0.1), M["wall_cream"], 0.01))
for k in range(n_win):
    za = z0 + pier + k * (pier + win_w)
    zb = za + win_w
    zc = (za + zb) / 2
    xf = x1 + 0.05
    # the frame, mullions every metre and two transoms, in white-painted steel
    parts.append(gbox(f"WinFrameL{k}", (xf, (SILL + HEAD) / 2, za + 0.05), (0.12, HEAD - SILL, 0.1), M["frame"], 0.01))
    parts.append(gbox(f"WinFrameR{k}", (xf, (SILL + HEAD) / 2, zb - 0.05), (0.12, HEAD - SILL, 0.1), M["frame"], 0.01))
    parts.append(gbox(f"WinFrameB{k}", (xf, SILL + 0.05, zc), (0.12, 0.1, win_w), M["frame"], 0.01))
    parts.append(gbox(f"WinFrameT{k}", (xf, HEAD - 0.05, zc), (0.12, 0.1, win_w), M["frame"], 0.01))
    for m_ in range(1, 4):
        parts.append(gbox(f"WinMullion{k}_{m_}", (xf, (SILL + HEAD) / 2, za + m_ * win_w / 4), (0.08, HEAD - SILL, 0.06), M["frame"], 0.008))
    for ty in (4.3, 6.4):
        parts.append(gbox(f"WinTransom{k}_{ty}", (xf, ty, zc), (0.08, 0.07, win_w), M["frame"], 0.008))
    parts.append(gbox(f"Glass_Win{k}", (xf + 0.02, (SILL + HEAD) / 2, zc), (0.01, HEAD - SILL - 0.1, win_w - 0.1), M["glass"]))
    # a cast-iron radiator under the sill, painted cream, with its pipe
    rz0 = zc - 1.1
    fins = []
    for f in range(22):
        fins.append(gbox(f"RadFin{k}_{f}", (x1 - 0.13, 0.62, rz0 + f * 0.1), (0.16, 0.78, 0.055), M["radiator"], 0.02, 2))
    rad = join(fins, f"Radiator{k}")
    parts.append(rad)
    parts.append(tube(f"RadPipe{k}", [g(x1 - 0.13, 0.18, rz0 - 0.15), g(x1 - 0.13, 0.12, rz0 - 0.3), g(x1 - 0.06, 0.12, rz0 - 0.5)], 0.022, M["steel"]))

# +z: the far end wall: tiles, plaster, and (in front of it) the café doors and the office (props)
# the wall is built round the viewing gallery's long window (x -9..9, y 3.4..5.6), the café beyond it (gallery() below)
GX0, GX1, GY0, GY1 = -9.0, 9.0, 3.4, 5.6
parts.append(gbox("WallFarLow", (0, GY0 / 2, z1 + T / 2), (W + 2 * T, GY0, T), M["plaster"]))
parts.append(gbox("WallFarHigh", (0, (GY1 + H) / 2, z1 + T / 2), (W + 2 * T, H - GY1, T), M["plaster"]))
for side, (a, b) in (("L", (x0 - T, GX0)), ("R", (GX1, x1 + T))):
    parts.append(gbox(f"WallFarSide{side}", ((a + b) / 2, (GY0 + GY1) / 2, z1 + T / 2), (b - a, GY1 - GY0, T), M["plaster"]))
parts += wainscot("WallFar", True, z1, x0, x1, -1)
parts.append(gbox("CorniceFar", (0, H - 0.4, z1 - 0.12), (W, 0.36, 0.24), M["timber"], 0.02))
parts.append(gbox("CorniceWindows", (x1 - 0.12, H - 0.4, (z0 + z1) / 2), (0.24, 0.36, L), M["timber"], 0.02))

# ---- the viewing gallery: a long window in the far wall onto the café upstairs, lamp-lit, people watching the pool ----------
def gallery():
    out = []
    zf = z1 + T  # the café's floor starts behind the wall
    D = 3.2  # its depth
    warm = mat("cafe_wall", "#f2c79a", 0.8, emit="#f6c48f", emit_strength=0.35)
    floorm = mat("cafe_floor", "#a8714a", 0.55)
    out.append(gbox("CafeFloor", (0, GY0 - 0.42, zf + D / 2), (GX1 - GX0 + 0.6, 0.12, D), floorm))
    out.append(gbox("CafeBack", (0, GY0 + 1.6, zf + D), (GX1 - GX0 + 0.6, 4.4, 0.12), warm))
    out.append(gbox("CafeCeiling", (0, GY1 + 0.9, zf + D / 2), (GX1 - GX0 + 0.6, 0.12, D), mat("cafe_ceiling", "#f6e6cf", 0.8)))
    for sx in (-1, 1):
        out.append(gbox(f"CafeEnd{sx}", (sx * (GX1 + 0.25), GY0 + 1.6, zf + D / 2), (0.12, 4.4, D), warm))
    # framed pictures and a striped awning-like valance on the back wall
    for k, px in enumerate([-7.0, -3.5, 3.5, 7.0]):
        out.append(gbox(f"CafePicFrame{k}", (px, GY0 + 1.65, zf + D - 0.08), (0.9, 0.7, 0.04), mat("timber_dark"), 0.01))
        out.append(gbox(f"CafePic{k}", (px, GY0 + 1.65, zf + D - 0.105), (0.76, 0.56, 0.01), mat(["sea", "coral", "sky", "mustard"][k]), 0))
    for k in range(18):
        out.append(gbox(f"CafeValance{k}", (GX0 + 0.5 + k, GY1 + 0.6, zf + D - 0.1), (1.0, 0.35, 0.05), mat("coral" if k % 2 else "cream"), 0.01))
    # the counter at one end, tables and chairs, pendant lamps, two spectators at the glass
    out.append(gbox("CafeCounter", (6.4, GY0 + 0.1, zf + D - 0.7), (3.4, 1.0, 0.7), mat("navy"), 0.03))
    out.append(gbox("CafeCounterTop", (6.4, GY0 + 0.62, zf + D - 0.7), (3.6, 0.06, 0.8), mat("timber"), 0.02))
    for k, (tx, tz) in enumerate([(-6.5, 1.0), (-3.6, 1.6), (-0.8, 1.0), (2.2, 1.7)]):
        out.append(cyl(f"CafeTableTop{k}", 0.42, 0.04, g(tx, GY0 + 0.38, zf + tz), mat("white_gloss"), 28, bev=0.01))
        out.append(cyl(f"CafeTableLeg{k}", 0.04, 0.74, g(tx, GY0 - 0.36, zf + tz), mat("charcoal"), 12))
        for cx in (-0.62, 0.62):
            out.append(gbox(f"CafeChair{k}{cx}", (tx + cx, GY0 - 0.1, zf + tz), (0.42, 0.06, 0.42), mat(["sea", "coral", "mustard", "sky"][k]), 0.02))
            out.append(gbox(f"CafeChairBack{k}{cx}", (tx + cx * 1.45, GY0 + 0.15, zf + tz), (0.05, 0.5, 0.42), mat(["sea", "coral", "mustard", "sky"][k]), 0.02))
        out.append(cyl(f"CafeCup{k}", 0.04, 0.09, g(tx + 0.1, GY0 + 0.4, zf + tz - 0.1), mat("white"), 14))
    for k, lx in enumerate([-6.5, -3.6, -0.8, 2.2, 6.4]):
        out.append(cyl(f"CafeLampCord{k}", 0.008, 0.6, g(lx, GY1 + 0.25, zf + 1.4), mat("black"), 6))
        out.append(cyl(f"CafeShade{k}", 0.24, 0.22, g(lx, GY1 + 0.05, zf + 1.4), mat("mustard_gloss"), 24, r2=0.08))
        out.append(sphere(f"Light_CafeBulb{k}", 0.07, g(lx, GY1 + 0.02, zf + 1.4), mat("cafe_bulb", "#fff0cf", 0.3, emit="#ffe2a8", emit_strength=8.0), 12, 8))
    skin = mat("spectator_skin", "#f2b48f", 0.6)
    for k, (sx, top) in enumerate([(-2.6, "coral"), (-1.9, "sea"), (4.0, "mustard")]):
        out.append(cyl(f"SpecBody{k}", 0.2, 0.75, g(sx, GY0 - 0.36, zf + 0.45), mat(top), 16, bev=0.05))
        out.append(sphere(f"SpecHead{k}", 0.16, g(sx, GY0 + 0.6, zf + 0.45), skin, 16, 10))
        out.append(gbox(f"SpecArm{k}", (sx, GY0 + 0.18, zf + 0.25), (0.42, 0.1, 0.12), mat(top), 0.04))
    # the window itself: a deep timber sill, white steel frames every 1.5 m, glass
    out.append(gbox("GallerySill", (0, GY0 - 0.04, z1 - 0.1), (GX1 - GX0 + 0.3, 0.08, 0.36), M["timber"], 0.02))
    out.append(gbox("GalleryHead", (0, GY1 + 0.05, z1 - 0.04), (GX1 - GX0 + 0.3, 0.12, 0.16), M["frame"], 0.01))
    for k in range(13):
        xk = GX0 + k * 1.5
        out.append(gbox(f"GalleryMullion{k}", (xk, (GY0 + GY1) / 2, z1 - 0.02), (0.08, GY1 - GY0, 0.1), M["frame"], 0.01))
    out.append(gbox("GalleryTransom", (0, GY0 + 0.95, z1 - 0.02), (GX1 - GX0, 0.06, 0.08), M["frame"], 0.008))
    out.append(gbox("Glass_Gallery", (0, (GY0 + GY1) / 2, z1 + 0.02), (GX1 - GX0, GY1 - GY0, 0.01), M["glass"]))
    out.append(text("GallerySign", "VIEWING GALLERY  ·  CAFÉ", 0.3, 0.02, g(0, GY1 + 0.42, z1 - 0.01), (math.pi / 2, 0, math.pi), M["stencil_navy"]))
    return out


parts += gallery()

# -x: the near wall, behind the game's camera: the game camera never draws it (Godot puts the Keep_NearWall parts on a layer it
# skips, so a coach at the near edge never hides behind it), but close-up views and the shadows see it
near = [gbox("Keep_NearWallPlaster", (x0 - T / 2, H / 2, (z0 + z1) / 2), (T, H, L + 2 * T), M["plaster"])]
near += wainscot("Keep_NearWall", False, x0, z0, z1, +1)
near.append(gbox("Keep_NearWallCornice", (x0 + 0.12, H - 0.4, (z0 + z1) / 2), (0.24, 0.36, L), M["timber"], 0.02))
near_wall = join(near, "Keep_NearWall")
parts.append(near_wall)

# ---- the roof: drawn only in shadows, with a long skylight over each side of the pool and glulam beams -----------------
roof_y = H + 0.15
sky = [(7.0, 12.5)]  # a skylight strip along z over the far deck: the low sun throws its light across the pool
xs = [x0 - T, sky[0][0], sky[0][1], x1 + T]
for k in range(0, len(xs) - 1, 2):
    a, b = xs[k], xs[k + 1]
    if b > a:
        parts.append(gbox(f"ShadowOnly_Roof{k}", ((a + b) / 2, roof_y, (z0 + z1) / 2), (b - a, 0.3, L + 2 * T), M["shadow"]))
# the skylights' glazing bars, every 1.2 m, and the beams, every 3.6 m, across the hall
for (a, b) in sky:
    for zz in [z0 + 1.2 * i for i in range(1, int(L / 1.2))]:
        parts.append(gbox(f"ShadowOnly_SkyBar{a}_{zz:.1f}", ((a + b) / 2, roof_y, zz), (b - a, 0.25, 0.07), M["shadow"]))
for k, zz in enumerate([z0 + 1.8 + 3.6 * i for i in range(int(L / 3.6))]):
    parts.append(gbox(f"ShadowOnly_Beam{k}", (0, H - 0.45, zz), (W, 0.9, 0.24), M["shadow"]))

root = parent_all([o for o in parts if o], "ClubShell")
export(os.path.join(VENUE, "club_shell.glb"), [root])
