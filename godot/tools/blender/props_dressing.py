"""The dressing of the hall's edges: what a 1960s seaside club has collected along its walls, so no wall looks empty. One GLB per
asset in godot/assets/venue/props/, front toward Godot +Z (Blender -Y); floor things with their pivot at the centre of their
footprint, wall things with their pivot on the wall's surface at floor level (their mounting height is built in). The places are
in godot/data/placements/dressing.json, written by this script (PLACEMENTS below).

Nodes Godot reads: `Light_VendGlow` (the vending machine's lit window), `HandSecond`/`HandMinute` (the pace clock's hands),
`HandSecondWall`/`HandMinuteWall` (the wall clock's), `Glass_*` (glazing).

    blender -b -P godot/tools/blender/props_dressing.py [-- name ...] [--preview] [--placements]
"""

import os, sys, math, random, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from lib import *
from props_kit import *

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NAMES = [a for a in ARGS if not a.startswith("--")]

TEXNAMES = ["dr_poster_gala", "dr_poster_learn", "dr_whiteboard", "dr_rules", "dr_honours", "dr_team_photo", "dr_corkboard", "dr_vending_panel", "dr_vending_side", "dr_menu", "dr_pace_face", "dr_clock_face", "dr_no_running", "dr_label_towels", "dr_label_hamper", "dr_label_lost", "dr_sign_extinguisher", "dr_sign_phone", "dr_label_kickboards", "dr_sign_hose", "dr_cafe_view"]


# ---- helpers -----------------------------------------------------------------------------------------------------------------
def disc(name, r, m, loc=(0, 0, 0), segs=40, rz=0.0):
    """A round picture (a clock's face) standing up and facing -Y, its UVs filling the image's square."""
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=segs, radius=r)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / (2 * r) + 0.5, l.vert.co.y / (2 * r) + 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    return xf(o, loc, rz, rx=PI / 2)


def finish(name, parts, specials=(), view=None, backdrop=None):
    """Join the parts into `<Name>Body`, group with the named nodes under `<Name>`, preview, export."""
    title = "".join(w.capitalize() for w in name.split("_"))
    body = join([p for p in parts if p], title + "Body")
    root = parent_all([body, *specials], title)
    if PREVIEW:
        extra = []
        if backdrop is not None:  # a wall and a floor for the preview only (not exported)
            extra.append(bx("PreviewWall", -3, 3, 0.0, 0.05, 0, 3.5, mat("pv_wall", "#e7dcc6", 0.8), 0))
            extra.append(bx("PreviewFloor", -3, 3, -3, 0.05, -0.02, 0, mat("pv_floor", "#d9c3a0", 0.8), 0))
        elif view is not None:
            extra.append(bx("PreviewFloor", -3, 3, -3, 3, -0.02, 0, mat("pv_floor", "#d9c3a0", 0.8), 0))
        tz, dist, elev, azim = view or (0.6, 3.0, 25, -30)
        preview(name, (0, 0, tz), dist, elev, azim, (640, 480), 12)
        for o in extra:
            bpy.data.objects.remove(o)
    export(os.path.join(PROPS, name + ".glb"), [root])
    return root


def trophy_cup(name, h, cup_m, base_m, dent=False, handles=True, lid=False):
    """A cup on a stepped base: a stem, a knot, a bowl with a rolled rim and two looped handles."""
    p = [bx(name + "Base", -h * 0.22, h * 0.22, -h * 0.22, h * 0.22, 0, h * 0.18, base_m, 0.006)]
    p.append(cyl(name + "Foot", h * 0.13, h * 0.06, (0, 0, h * 0.18), cup_m, 16, r2=h * 0.07))
    p.append(cyl(name + "Stem", h * 0.035, h * 0.22, (0, 0, h * 0.24), cup_m, 10))
    p.append(sphere(name + "Knot", h * 0.06, (0, 0, h * 0.42), cup_m, 12, 8))
    p.append(cyl(name + "Bowl", h * 0.07, h * 0.42, (0, 0, h * 0.46), cup_m, 18, r2=h * 0.2))
    p.append(torus(name + "Rim", h * 0.2, h * 0.012, (0, 0, h * 0.88), cup_m, 18, 6))
    if handles:
        for sx in (-1, 1):
            p.append(torus(name + f"Handle{sx}", h * 0.1, h * 0.016, (sx * h * 0.2, 0, h * 0.68), cup_m, 14, 6, rot=(PI / 2, 0, 0)))
    if lid:
        p.append(cyl(name + "Lid", h * 0.19, h * 0.06, (0, 0, h * 0.88), cup_m, 18, r2=h * 0.05))
        p.append(sphere(name + "Finial", h * 0.04, (0, 0, h * 0.97), cup_m, 10, 6))
    o = join(p, name)
    if dent:  # someone dropped it: squashed on one side and leaning
        for v in o.data.vertices:
            if v.co.z > h * 0.5 and v.co.x > 0:
                v.co.x *= 0.78
                v.co.z -= 0.02 * h
    return o


def medal(name, m, ribbon_m, loc, rz=0.0):
    p = [cyl(name + "Disc", 0.03, 0.006, (0, 0, -0.06), m, 16, rot=(PI / 2, 0, 0))]
    for sx in (-1, 1):
        r = bx(name + f"Ribbon{sx}", -0.009, 0.009, -0.003, 0, -0.05, 0.03, ribbon_m, 0)
        p.append(xf(r, (sx * 0.012, 0, 0), ry=sx * 0.35))
    return grp(p, name, loc, rz)


# ---- the -Z wall: the club's corner by the changing rooms --------------------------------------------------------------------
def vending_machine():
    """A drinks machine, Harbour Fizz: a navy cabinet, a lit window of cans on shelves, the keypad panel, a hatch; a can left
    on top. Its glowing back panel is `Light_VendGlow`."""
    reset()
    W, D, H = 0.86, 0.72, 1.86
    body_m, trim = mat("vend_navy", "#1f3a5f", 0.25), mat("vend_trim", "#c9cfd3", 0.3, 1.0)
    wx0, wx1, wz0, wz1 = -W / 2 + 0.06, 0.16, 0.56, 1.62  # the window
    yf = -D / 2
    P = [bx("Cabinet", -W / 2, W / 2, yf + 0.36, D / 2, 0.06, H, body_m, 0.03, 3)]
    for k, (a, b, c, d) in enumerate([(-W / 2, W / 2, 0.06, wz0), (-W / 2, W / 2, wz1, H), (-W / 2, wx0, wz0 - 0.01, wz1 + 0.01), (wx1, W / 2, wz0 - 0.01, wz1 + 0.01)]):
        P.append(bx(f"Front{k}", a, b, yf + 0.01, yf + 0.37, c, d, body_m, 0.02, 2))
    P.append(bx("Door", 0.18, W / 2 - 0.015, yf, yf + 0.02, 0.45, H - 0.2, body_m, 0.012, 2))
    P.append(bx("Crown", -W / 2 + 0.02, W / 2 - 0.02, -D / 2 - 0.01, -D / 2 + 0.05, H - 0.17, H - 0.05, mat("coral_gloss"), 0.015))
    P.append(flat_text("CrownWord", "ICE COLD DRINKS", 0.08, mat("cream"), (0, -D / 2 - 0.012, H - 0.11), 0, 0.004, res=1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            P.append(cyl(f"Foot{sx}{sy}", 0.025, 0.06, (sx * (W / 2 - 0.08), sy * (D / 2 - 0.1), 0), mat("rubber"), 10))
    # the window: a recess, the glow at its back, shelves of cans
    for k, (a, b, c, d) in enumerate([(wx0 - 0.03, wx1 + 0.03, wz0 - 0.03, wz0), (wx0 - 0.03, wx1 + 0.03, wz1, wz1 + 0.03), (wx0 - 0.03, wx0, wz0, wz1), (wx1, wx1 + 0.03, wz0, wz1)]):
        P.append(bx(f"WinFrame{k}", a, b, yf - 0.012, yf + 0.012, c, d, trim, 0.006))
    cans = [mat("can_coral", "#ef6a4c", 0.25, 0.6), mat("can_sea", "#2f8c88", 0.25, 0.6), mat("can_yellow", "#f6cf45", 0.25, 0.6), mat("can_red", "#d6423a", 0.25, 0.6), mat("can_blue", "#3d7fd1", 0.25, 0.6)]
    rng = random.Random(4)
    for row in range(5):
        z = wz0 + 0.04 + row * 0.205
        P.append(bx(f"Shelf{row}", wx0 + 0.005, wx1 - 0.005, yf + 0.02, yf + 0.33, z - 0.012, z, trim, 0.003))
        P.append(bx(f"PriceStrip{row}", wx0 + 0.005, wx1 - 0.005, yf + 0.014, yf + 0.022, z - 0.03, z, mat("white"), 0))
        cm = cans[row % 5]
        for k in range(5):
            if row == 2 and k == 3:
                continue  # sold out
            x = wx0 + 0.05 + k * 0.085
            for depth in (0.08, 0.18):
                P.append(cyl(f"Can{row}{k}{depth}", 0.03, 0.115, (x, yf + depth, z), cm, 12))
                if depth == 0.08:
                    P.append(cyl(f"CanTop{row}{k}", 0.026, 0.006, (x, yf + depth, z + 0.115), trim, 10))
    glass = bx("Glass_VendFront", wx0 - 0.005, wx1 + 0.005, yf - 0.006, yf - 0.002, wz0, wz1, mat("glass_frame", "#e8f4f6", 0.04, alpha=0.18), 0)
    glow = bx("Light_VendGlow", wx0 + 0.01, wx1 - 0.01, yf + 0.34, yf + 0.35, wz0 + 0.01, wz1 - 0.01, mat("vend_glow", "#fff6e0", 0.4, emit="#fff1d0", emit_strength=4.0), 0)
    # the right-hand panel, the coin return, the hatch
    P.append(decal("Panel", 0.22, 0.86, tmat("dr_vending_panel", 0.35), (0.29, yf - 0.003, 1.12)))
    P.append(bx("Hatch", -W / 2 + 0.08, W / 2 - 0.08, yf - 0.012, yf + 0.04, 0.16, 0.4, mat("charcoal"), 0.015))
    P.append(bx("HatchFlap", -W / 2 + 0.12, W / 2 - 0.12, yf - 0.02, yf - 0.008, 0.2, 0.36, mat("vend_flap", "#2a2f36", 0.3), 0.01))
    P.append(bx("HatchPush", -0.12, 0.12, yf - 0.03, yf - 0.018, 0.34, 0.36, trim, 0.004))
    P.append(bx("Kick", -W / 2 + 0.03, W / 2 - 0.03, yf - 0.004, yf + 0.02, 0.06, 0.12, mat("charcoal"), 0.01))
    for sx in (-1, 1):  # the brand down each side
        P.append(decal(f"Side{sx}", 0.52, 1.04, tmat("dr_vending_side", 0.35), (sx * (W / 2 + 0.002), 0.04, 1.05), sx * PI / 2))
    # a can someone left on top, and the plug's cable to the wall
    P.append(cyl("LeftCan", 0.03, 0.115, (0.22, -0.1, H), cans[0], 12))
    P.append(poly_tube("Cable", [(0.3, D / 2, 0.3), (0.3, D / 2 + 0.06, 0.25), (0.36, D / 2 + 0.06, 0.05), (0.5, D / 2 + 0.04, 0.02)], 0.008, mat("black"), 6, 0.04))
    finish("vending_machine", P, [glass, glow], (0.95, 3.4, 18, -35))


def trophy_cabinet():
    """The club's glass-fronted trophy cabinet: a timber base with drawers, three glass shelves of cups (one dented), medals on
    the navy felt, a shield, a diving statuette and the 1974 team photograph."""
    reset()
    W, D, H = 1.5, 0.45, 1.95
    wood, dark = mat("cab_timber", "#9a6235", 0.45), mat("cab_timber_dark", "#6e4424", 0.5)
    felt = mat("felt_navy", "#22385a", 0.95)
    gold, silver = mat("trophy_gold", "#d9a93d", 0.22, 1.0), mat("trophy_silver", "#d5dadd", 0.15, 1.0)
    bronze = mat("trophy_bronze", "#b87333", 0.3, 1.0)
    base_m = mat("trophy_base", "#2b2b2b", 0.35)
    P = []
    P.append(bx("Plinth", -W / 2 + 0.02, W / 2 - 0.02, -D / 2 + 0.03, D / 2, 0, 0.08, dark, 0.01))
    P.append(bx("Base", -W / 2, W / 2, -D / 2, D / 2, 0.08, 0.6, wood, 0.012))
    for k, x in enumerate((-W / 4, W / 4)):
        P.append(bx(f"Drawer{k}", x - W / 4 + 0.03, x + W / 4 - 0.03, -D / 2 - 0.012, -D / 2, 0.14, 0.54, wood, 0.01))
        P.append(sphere(f"Knob{k}", 0.018, (x, -D / 2 - 0.03, 0.37), mat("brass"), 12, 8))
        P.append(bx(f"Keyhole{k}", x - 0.004, x + 0.004, -D / 2 - 0.014, -D / 2 - 0.011, 0.44, 0.47, mat("black"), 0))
    P.append(bx("Top", -W / 2 - 0.03, W / 2 + 0.03, -D / 2 - 0.03, D / 2, H - 0.06, H, wood, 0.015))
    P.append(bx("Cornice", -W / 2 - 0.05, W / 2 + 0.05, -D / 2 - 0.05, D / 2, H - 0.03, H + 0.02, dark, 0.01))
    P.append(bx("Back", -W / 2, W / 2, D / 2 - 0.02, D / 2, 0.6, H - 0.06, felt, 0))
    for sx in (-1, 1):
        P.append(bx(f"Side{sx}", min(sx * W / 2, sx * (W / 2 - 0.03)), max(sx * W / 2, sx * (W / 2 - 0.03)), -D / 2, D / 2, 0.6, H - 0.06, wood, 0.006))
    # the doors' frames (the glass is its own node)
    for k, x in enumerate((-W / 4, W / 4)):
        x0, x1 = x - W / 4 + 0.03, x + W / 4 - 0.03
        for j, (a, b, c, d) in enumerate([(x0, x0 + 0.035, 0.6, H - 0.06), (x1 - 0.035, x1, 0.6, H - 0.06), (x0, x1, 0.6, 0.64), (x0, x1, H - 0.1, H - 0.06)]):
            P.append(bx(f"DoorFrame{k}{j}", a, b, -D / 2 - 0.02, -D / 2 + 0.005, c, d, wood, 0.006))
        P.append(bx(f"DoorPull{k}", (x1 - 0.02 if k == 0 else x0 + 0.02) - 0.006, (x1 - 0.02 if k == 0 else x0 + 0.02) + 0.006, -D / 2 - 0.035, -D / 2 - 0.02, 1.15, 1.3, mat("brass"), 0.004))
    glass = [bx(f"Glass_Cabinet{k}", x - W / 4 + 0.06, x + W / 4 - 0.06, -D / 2 - 0.01, -D / 2 - 0.004, 0.64, H - 0.1, mat("glass_frame", "#e8f4f6", 0.04, alpha=0.18), 0) for k, x in enumerate((-W / 4, W / 4))]
    shelves = [0.62, 1.05, 1.47]
    for k, z in enumerate(shelves[1:]):
        P.append(bx(f"Shelf{k}", -W / 2 + 0.03, W / 2 - 0.03, -D / 2 + 0.03, D / 2 - 0.02, z - 0.012, z, mat("shelf_glass", "#d7eef2", 0.05), 0.003))
    # the bottom shelf: two big cups, the dented one, a shield
    items = []
    items.append(xf(trophy_cup("CupBig", 0.36, gold, base_m, lid=True), (-0.48, 0.02, shelves[0])))
    items.append(xf(trophy_cup("CupDented", 0.3, silver, base_m, dent=True), (0.15, 0.04, shelves[0]), 0.4, ry=0.07))
    items.append(xf(trophy_cup("CupMid", 0.26, bronze, base_m), (0.52, 0.0, shelves[0]), -0.3))
    sh = [bx("ShieldBoard", -0.13, 0.13, -0.015, 0, -0.16, 0.16, dark, 0.02)]
    sh.append(bx("ShieldPlate", -0.09, 0.09, -0.02, -0.014, -0.1, 0.1, silver, 0.01))
    sh.append(bx("ShieldTag", -0.11, 0.11, -0.02, -0.015, -0.15, -0.135, gold, 0))
    items.append(grp(sh, "Shield", (-0.15, 0.17, shelves[0] + 0.2), 0, rx=-0.15))
    # the middle shelf: the team photograph on a stand, small cups, a diving statuette
    ph = framed("TeamPhoto", 0.24, 0.18, tmat("dr_team_photo", 0.6), dark, (0, 0, 0), 0, 0.015, 0.018, False)
    items.append(xf(join(ph, "TeamPhotoJ"), (-0.35, 0.05, shelves[1] + 0.13), 0.15, rx=0.18))
    for k, (x, hh, m) in enumerate([(-0.62, 0.2, silver), (0.05, 0.22, gold), (0.26, 0.17, bronze)]):
        items.append(xf(trophy_cup(f"CupS{k}", hh, m, base_m, handles=k != 2), (x, 0.03, shelves[1]), 0.3 * k))
    st = [bx("StatBase", -0.06, 0.06, -0.05, 0.05, 0, 0.07, base_m, 0.006)]
    st.append(xf(pictogram_3d("StatFigure", "man", 0.2, gold, (0, 0, 0), 0, 0.02), (0.0, 0.01, 0.065), 0, ry=-0.35))
    items.append(grp(st, "Statuette", (0.55, 0.02, shelves[1])))
    # the top shelf: a row of plates and a pennant; medals hang on the felt
    for k, x in enumerate((-0.55, -0.25, 0.25, 0.55)):
        items.append(xf(trophy_cup(f"CupT{k}", 0.16 + 0.03 * (k % 2), [gold, silver, gold, bronze][k], base_m, handles=k % 2 == 0), (x, 0.0, shelves[2])))
    plate = cyl("Plate", 0.11, 0.012, (0, 0, 0), silver, 28, rot=(PI / 2, 0, 0))
    items.append(xf(plate, (0.0, 0.16, shelves[2] + 0.13), rx=-0.2))
    for k, (x, z, m) in enumerate([(-0.6, 1.4, gold), (-0.48, 1.38, silver), (0.4, 1.0, bronze), (0.62, 1.39, gold), (-0.05, 1.86, silver)]):
        items.append(medal(f"Medal{k}", m, [mat("coral"), mat("navy"), mat("sea"), mat("mustard"), mat("coral")][k], (x, D / 2 - 0.022, z - 0.0)))
    pen = extrude_shape("Pennant", [(-0.16, 0), (0.16, 0), (0, -0.2)], 0.003, (0, 0, 0), mat("coral"), (PI / 2, 0, 0))
    items.append(xf(pen, (-0.2, D / 2 - 0.022, 1.88)))
    items.append(xf(flat_text("PennantWord", "HSC", 0.05, mat("cream"), (0, 0, 0), 0, 0.002, res=1), (-0.2, D / 2 - 0.0255, 1.84)))
    finish("trophy_cabinet", P + items, glass, (1.0, 3.6, 12, -28))


def noticeboard():
    """A cork noticeboard in a timber frame: lost property, Aqua Fit, the club trials, a child's fish, a 'for sale' with its
    tabs half gone, a sticky note about a flask; a little timber header 'NOTICES'. Its centre at 1.42 m."""
    reset()
    wood = mat("timber")
    w, h, zc = 0.96, 0.6, 1.42
    P = []
    for k, (cx, cz, sw, sh) in enumerate([(0, h / 2 + 0.025, w + 0.1, 0.05), (0, -h / 2 - 0.025, w + 0.1, 0.05), (-w / 2 - 0.025, 0, 0.05, h), (w / 2 + 0.025, 0, 0.05, h)]):
        P.append(bx(f"Frame{k}", cx - sw / 2, cx + sw / 2, -0.035, 0, zc + cz - sh / 2, zc + cz + sh / 2, wood, 0.01))
    P.append(bx("Cork", -w / 2, w / 2, -0.02, 0, zc - h / 2, zc + h / 2, mat("cork", "#b78755", 0.9), 0))
    P.append(decal("Notes", w, h, tmat("dr_corkboard", 0.75), (0, -0.0205, zc)))
    hd = [bx("Header", -0.22, 0.22, -0.03, 0, -0.045, 0.045, mat("navy_gloss"), 0.01)]
    hd.append(flat_text("HeaderWord", "NOTICES", 0.06, mat("cream"), (0, -0.031, 0), 0, 0.003, res=1))
    P.append(grp(hd, "HeaderJ", (0, 0, zc + h / 2 + 0.1)))
    # a few real pins and a flyer's curled corner
    for k, (x, z, m) in enumerate([(-0.3, 0.2, mat("coral")), (0.33, -0.05, mat("sea")), (-0.05, -0.2, mat("mustard"))]):
        P.append(cyl(f"Pin{k}", 0.009, 0.012, (x, -0.022, zc + z), m, 10, rot=(PI / 2, 0, 0)))
    finish("noticeboard", P, view=(1.4, 1.8, 8, -20), backdrop=True)


def lost_property():
    """A mustard plastic crate labelled LOST PROPERTY, spilling over: towels, a swim ring, a single flip-flop, goggles, a cap,
    a child's rubber duck and a lonely trainer."""
    reset()
    W, D, H = 0.66, 0.42, 0.36
    crate = mat("crate_mustard", "#e9a92f", 0.5)
    P = [bx("Floor", -W / 2, W / 2, -D / 2, D / 2, 0, 0.03, crate, 0.01)]
    for sx in (-1, 1):
        P.append(bx(f"End{sx}", min(sx * W / 2, sx * W / 2 - sx * 0.025), max(sx * W / 2, sx * W / 2 - sx * 0.025), -D / 2, D / 2, 0, H, crate, 0.008))
        P.append(bx(f"Grip{sx}", sx * W / 2 - 0.004 * sx - 0.003, sx * W / 2 + 0.003, -0.1, 0.1, H - 0.1, H - 0.06, mat("charcoal"), 0.004))
    for sy in (-1, 1):
        P.append(bx(f"Wall{sy}", -W / 2, W / 2, min(sy * D / 2, sy * D / 2 - sy * 0.025), max(sy * D / 2, sy * D / 2 - sy * 0.025), 0, H, crate, 0.008))
    for k, x in enumerate((-W / 2 + 0.08, W / 2 - 0.08)):  # ribs on the front
        P.append(bx(f"Rib{k}", x - 0.012, x + 0.012, -D / 2 - 0.008, -D / 2, 0.03, H - 0.02, crate, 0.004))
    P.append(decal("Label", 0.36, 0.09, tmat("dr_label_lost", 0.5), (0, -D / 2 - 0.003, H * 0.55)))
    P.append(towel_folded("TowelA", 0.4, 0.3, 0.1, mat("towel_blue"), mat("towel_stripe"), (-0.08, 0.02, H - 0.1), 0.15))
    ring = torus("Ring", 0.15, 0.055, (0, 0, 0), mat("foam_pink"), 28, 10)
    P.append(xf(ring, (0.17, 0.02, H + 0.02), 0.2, rx=0.5))
    P.append(flip_flop("FlipFlop", mat("flipflop_green", "#62c48a", 0.6), mat("navy"), (-0.15, -0.05, H + 0.0), 0.5, 0.25))
    P.append(goggles("Goggles", mat("lens_blue", "#3d7fd1", 0.1), mat("strap_coral", "#ef6a4c", 0.5), (0.02, -0.12, H + 0.01), 1.1))
    duck = [sphere("DuckBody", 0.05, (0, 0, 0.04), mat("mustard_gloss"), 14, 8, (1.3, 1, 0.85)), sphere("DuckHead", 0.032, (0.045, 0, 0.1), mat("mustard_gloss"), 12, 8), cyl("DuckBeak", 0.014, 0.03, (0.07, 0, 0.098), mat("coral"), 8, rot=(0, PI / 2, 0))]
    P.append(grp(duck, "Duck", (0.24, -0.1, H - 0.03), -0.7))
    # a trainer on the floor beside it
    tr = [bx("Sole", -0.05, 0.05, -0.14, 0.14, 0, 0.03, mat("white"), 0.012)]
    tr.append(bx("Upper", -0.045, 0.045, -0.13, 0.08, 0.03, 0.09, mat("sea"), 0.03, 2))
    tr.append(bx("Toe", -0.045, 0.045, 0.06, 0.135, 0.03, 0.07, mat("sea"), 0.025, 2))
    tr.append(bx("Laces", -0.025, 0.025, -0.02, 0.06, 0.09, 0.096, mat("white"), 0.004))
    P.append(grp(tr, "Trainer", (W / 2 + 0.12, -0.08, 0), 0.5))
    finish("lost_property", [p for p in P if p], view=(0.25, 1.8, 30, -30))


def towel_cubbies():
    """A honey-timber cubby unit of clean rolled towels in the club's colours, a few cubbies already empty, its label on top."""
    reset()
    W, D, H = 1.1, 0.4, 1.2
    wood, dark = mat("timber_light"), mat("timber_dark")
    P = [bx("Plinth", -W / 2 + 0.02, W / 2 - 0.02, -D / 2 + 0.03, D / 2, 0, 0.06, dark, 0.008)]
    t = 0.025
    P.append(bx("Top", -W / 2 - 0.015, W / 2 + 0.015, -D / 2 - 0.015, D / 2, H - t, H, wood, 0.008))
    P.append(bx("Bottom", -W / 2, W / 2, -D / 2, D / 2, 0.06, 0.06 + t, wood, 0.006))
    P.append(bx("Back", -W / 2, W / 2, D / 2 - 0.012, D / 2, 0.06, H, wood, 0))
    cols, rows = 3, 3
    cw = (W - t) / cols
    rh = (H - 0.06 - t) / rows
    for k in range(cols + 1):
        x = -W / 2 + k * cw
        P.append(bx(f"Div{k}", x, x + t, -D / 2, D / 2, 0.06, H - t, wood, 0.005))
    for j in range(1, rows):
        z = 0.06 + j * rh
        P.append(bx(f"Shelf{j}", -W / 2, W / 2, -D / 2, D / 2, z, z + t, wood, 0.005))
    cols_m = [mat("towel_blue"), mat("towel_coral"), mat("towel_stripe"), mat("towel_mustard", "#f2c35d", 0.95), mat("towel_sea", "#4fb0a5", 0.95)]
    rng = random.Random(12)
    for j in range(rows):
        for k in range(cols):
            z = 0.06 + j * rh + t
            cx = -W / 2 + t + k * cw + (cw - t) / 2
            n = [3, 2, 3, 1, 3, 0, 2, 3, 2][j * 3 + k]
            spots = [(-0.08, 0), (0.08, 0), (0.0, 1)]
            for i in range(n):
                dx, lay = spots[i]
                r = 0.065
                tw = towel_rolled(f"T{j}{k}{i}", r, D - 0.08, cols_m[rng.randrange(5)], mat("towel_stripe") if rng.random() < 0.4 else None, (0, 0, 0), 0)
                xf(tw, (cx + dx * (1 if lay == 0 else 0), -0.02, z + lay * 0.11), -PI / 2 + rng.uniform(-0.1, 0.1))
                P.append(tw)
    lab = [bx("LabelBoard", -0.24, 0.24, -0.012, 0, -0.08, 0.08, mat("navy_gloss"), 0.006), decal("LabelArt", 0.44, 0.147, tmat("dr_label_towels", 0.5), (0, -0.0125, 0))]
    P.append(grp(lab, "LabelJ", (0, -D / 2 - 0.016, H + 0.06)))
    P.append(bx("LabelLeg", -0.01, 0.01, -D / 2 - 0.012, -D / 2 + 0.01, H - 0.02, H + 0.0, mat("brass"), 0.003))
    finish("towel_cubbies", [p for p in P if p], view=(0.65, 2.8, 18, -28))


def laundry_hamper():
    """A towel trolley: a steel frame on castors holding a navy canvas sack, USED TOWELS on it, towels heaped over the top."""
    reset()
    W, D, H = 0.48, 0.42, 0.82
    steel = mat("steel_brushed")
    canvas = mat("canvas_navy", "#26406a", 0.9)
    P = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (W / 2 - 0.03), sy * (D / 2 - 0.03)
            P.append(cyl(f"Post{sx}{sy}", 0.012, H - 0.1, (x, y, 0.08), steel, 10))
            P.append(cyl(f"Castor{sx}{sy}", 0.032, 0.025, (x - 0.012, y, 0.035), mat("rubber"), 14, rot=(0, PI / 2, 0)))
            P.append(bx(f"Fork{sx}{sy}", x - 0.018, x + 0.018, y - 0.012, y + 0.012, 0.05, 0.085, steel, 0.004))
    for z in (0.1, H - 0.02):
        P.append(poly_tube(f"Ring{z}", [(-W / 2 + 0.03, -D / 2 + 0.03, z), (W / 2 - 0.03, -D / 2 + 0.03, z), (W / 2 - 0.03, D / 2 - 0.03, z), (-W / 2 + 0.03, D / 2 - 0.03, z), (-W / 2 + 0.03, -D / 2 + 0.03 + 0.001, z)], 0.011, steel, 8, 0.04))
    sack = bx("Sack", -W / 2 + 0.035, W / 2 - 0.035, -D / 2 + 0.035, D / 2 - 0.035, 0.14, H - 0.02, canvas, 0.05, 3)
    for v in sack.data.vertices:  # bellied out, full
        t = (v.co.z - 0.14) / (H - 0.16)
        bulge = 1.0 + 0.1 * math.sin(PI * min(1, max(0, t)))
        v.co.x *= bulge
        v.co.y *= bulge
    P.append(sack)
    P.append(bx("Cuff", -W / 2 + 0.02, W / 2 - 0.02, -D / 2 + 0.02, D / 2 - 0.02, H - 0.06, H + 0.01, canvas, 0.02))
    P.append(decal("Label", 0.3, 0.075, tmat("dr_label_hamper", 0.5), (0, -D / 2 + 0.01, H - 0.2)))
    heap = [(mat("towel_blue"), (-0.06, 0.02, H - 0.07), 0.2, 0.12), (mat("towel_coral"), (0.07, -0.04, H - 0.03), -0.4, 0.05), (mat("towel_stripe"), (0.0, 0.06, H + 0.01), 0.9, 0.0)]
    for k, (m, loc, rz, rx) in enumerate(heap):
        tw = bx(f"Heap{k}", -0.17, 0.17, -0.13, 0.13, 0, 0.07, m, 0.03, 2)
        for v in tw.data.vertices:
            v.co.z += 0.03 * math.sin(v.co.x * 12) + 0.02 * math.cos(v.co.y * 9)
        P.append(xf(tw, loc, rz, rx=rx))
    P.append(towel_hanging("Spill", 0.22, 0.34, mat("towel_stripe"), mat("towel_blue"), (W / 2 - 0.01, 0.02, H + 0.03), PI / 2, 0.01))
    finish("laundry_hamper", P, view=(0.45, 2.0, 20, -30))


def poster(name, tex, w, h, zc, frame, mount):
    reset()
    parts = framed("Poster", w, h, tmat(tex, 0.7), mat(frame), (0, 0, zc), 0, 0.028, 0.03, True, 0.025, mat(mount))
    body = [p for p in parts if not p.name.startswith("Glass_")]
    glass = [p for p in parts if p.name.startswith("Glass_")]
    finish(name, body, glass, (zc, 1.6, 6, -18), backdrop=True)


def poster_gala():
    """'HARBOURSIDE SWIM GALA 1974': a faded, folded vintage poster in a timber frame, its centre at 1.63 m."""
    poster("poster_gala", "dr_poster_gala", 0.32, 0.48, 1.63, "timber_dark", "paper")


def poster_learn():
    """'LEARN TO SWIM': a 1970s poster of a child in armbands in a duck ring, in a navy frame, its centre at 1.5 m."""
    poster("poster_learn", "dr_poster_learn", 0.4, 0.6, 1.5, "navy_gloss", "cream")


def kickboard_rack():
    """A timber rack with three slots of kickboards standing on edge in every foam colour, and the label: return after use."""
    reset()
    W, D, H = 1.2, 0.5, 0.72
    wood, dark = mat("timber"), mat("timber_dark")
    P = [bx("Base", -W / 2, W / 2, -D / 2, D / 2, 0, 0.08, dark, 0.012)]
    for k in range(4):
        x = -W / 2 + 0.02 + k * (W - 0.04) / 3
        P.append(bx(f"Divider{k}", x - 0.02, x + 0.02, -D / 2 + 0.02, D / 2 - 0.02, 0.08, H, wood, 0.01))
    P.append(bx("BackRail", -W / 2, W / 2, D / 2 - 0.04, D / 2, 0.4, 0.48, wood, 0.01))
    P.append(bx("FrontRail", -W / 2, W / 2, -D / 2, -D / 2 + 0.04, 0.2, 0.28, wood, 0.01))
    P.append(bx("TopRail", -W / 2, W / 2, D / 2 - 0.04, D / 2, H - 0.08, H, wood, 0.01))
    foams = [mat("foam_blue"), mat("foam_yellow"), mat("foam_pink"), mat("foam_green"), mat("foam_orange")]
    rng = random.Random(3)
    sw = (W - 0.04) / 3
    for s in range(3):
        x0 = -W / 2 + 0.02 + s * sw + 0.04
        n = [6, 4, 5][s]
        for k in range(n):
            x = x0 + 0.04 + k * (sw - 0.2) / max(1, n - 1)
            kb = kickboard(f"KB{s}{k}", foams[rng.randrange(5)], 0.3, 0.46, 0.032, (0, 0, 0), 0, grip=None)
            # stand it on its long edge, nose up, leaning a little
            kb.rotation_euler = (PI / 2 + rng.uniform(-0.05, 0.05), 0, PI / 2 + 0.5 + rng.uniform(-0.08, 0.08))  # leaning like books
            kb.location = (x, 0.0, 0.08 + 0.23)
            apply_all(kb)
            P.append(kb)
    lab = [bx("LabelBoard", -0.22, 0.22, -0.01, 0, -0.07, 0.07, mat("sea_gloss"), 0.006), decal("LabelArt", 0.42, 0.14, tmat("dr_label_kickboards", 0.5), (0, -0.0105, 0))]
    P.append(grp(lab, "LabelJ", (0, -D / 2 - 0.005, 0.24)))
    finish("kickboard_rack", P, view=(0.5, 2.6, 22, -28))


def whiteboard():
    """The squad's whiteboard: lap times, the lessons timetable, GALA SATURDAY!!; an aluminium frame, a tray of markers and an
    eraser, two magnets. Its centre at 1.52 m."""
    reset()
    w, h, zc = 1.3, 0.65, 1.52
    alu = mat("alu", "#c4cacf", 0.35, 1.0)
    P = [bx("Board", -w / 2, w / 2, -0.02, 0, zc - h / 2, zc + h / 2, mat("white_gloss"), 0.004)]
    P.append(decal("Writing", w - 0.02, h - 0.02, tmat("dr_whiteboard", 0.25), (0, -0.0205, zc)))
    for k, (cx, cz, sw, sh) in enumerate([(0, h / 2, w + 0.04, 0.03), (0, -h / 2, w + 0.04, 0.03), (-w / 2, 0, 0.03, h), (w / 2, 0, 0.03, h)]):
        P.append(bx(f"Frame{k}", cx - sw / 2, cx + sw / 2, -0.03, 0, zc + cz - sh / 2, zc + cz + sh / 2, alu, 0.006))
    P.append(bx("Tray", -0.4, 0.4, -0.08, 0, zc - h / 2 - 0.03, zc - h / 2 - 0.015, alu, 0.004))
    P.append(bx("TrayLip", -0.4, 0.4, -0.085, -0.075, zc - h / 2 - 0.03, zc - h / 2 + 0.0, alu, 0.003))
    for k, (x, m) in enumerate([(-0.25, mat("marker_blue", "#1f4fa8", 0.4)), (-0.15, mat("marker_red", "#c8322b", 0.4)), (0.02, mat("marker_green", "#2b8a4a", 0.4))]):
        P.append(cyl(f"Marker{k}", 0.009, 0.12, (x - 0.06, -0.05, zc - h / 2 - 0.006), mat("white"), 10, rot=(0, PI / 2, 0.1 * k)))
        P.append(cyl(f"MarkerCap{k}", 0.0095, 0.03, (x + 0.06, -0.05, zc - h / 2 - 0.006), m, 10, rot=(0, PI / 2, 0.1 * k)))
    P.append(bx("Eraser", 0.15, 0.29, -0.07, -0.02, zc - h / 2 - 0.015, zc - h / 2 + 0.02, mat("charcoal"), 0.008))
    P.append(bx("EraserFelt", 0.15, 0.29, -0.07, -0.02, zc - h / 2 - 0.018, zc - h / 2 - 0.014, mat("felt_grey", "#9aa0a4", 0.9), 0))
    for k, (x, z, m) in enumerate([(-0.01, 0.27, mat("coral_gloss")), (0.6, 0.27, mat("mustard_gloss"))]):
        P.append(cyl(f"Magnet{k}", 0.022, 0.012, (x, -0.02, zc + z), m, 14, rot=(PI / 2, 0, 0)))
    finish("whiteboard", P, view=(1.5, 2.0, 6, -20), backdrop=True)


def noodle_bin():
    """A tall navy bin crammed with pool noodles in every colour, leaning every which way."""
    reset()
    R, H = 0.25, 0.62
    binm = mat("bin_navy", "#24456e", 0.4)
    P = [cyl("Bin", R, H, (0, 0, 0), binm, 28, bev=0.012, r2=R * 1.06)]
    P.append(torus("Lip", R * 1.06, 0.018, (0, 0, H), binm, 32, 8))
    for z in (0.12, H - 0.12):
        P.append(torus(f"Hoop{z}", R * (1.0 + 0.06 * z / H) + 0.004, 0.008, (0, 0, z), mat("cream"), 32, 6))
    P.append(flat_text("BinWord", "NOODLES", 0.07, mat("cream"), (0, -R * 1.04 - 0.004, H * 0.5), 0, 0.003, res=1))
    foams = [mat("foam_blue"), mat("foam_yellow"), mat("foam_pink"), mat("foam_green"), mat("foam_orange")]
    rng = random.Random(9)
    for k in range(15):
        a = rng.uniform(0, 2 * PI)
        d = rng.uniform(0.0, R - 0.06)
        x, y = math.cos(a) * d, math.sin(a) * d
        L = rng.uniform(1.15, 1.45)
        n = cyl(f"Noodle{k}", 0.035, L, (0, 0, 0), foams[k % 5], 10, bev=0.01)
        n2 = cyl(f"Hole{k}", 0.012, 0.004, (0, 0, L), mat("black"), 8)
        nn = join([n, n2], f"Noodle{k}")
        tilt = rng.uniform(0.05, 0.22)
        xf(nn, (x, y, 0.03), a + PI / 2 + rng.uniform(-0.3, 0.3), rx=tilt if d > 0.08 else tilt * 0.5)
        P.append(nn)
    finish("noodle_bin", P, view=(0.7, 3.0, 20, -30))


def buoy_basket():
    """A wire basket of pull buoys, one fallen out on the floor."""
    reset()
    W, D, H = 0.5, 0.38, 0.3
    wire = mat("wire_white", "#eef0ee", 0.35, 0.3)
    P = []
    for z in (0.02, H * 0.5, H):
        P.append(poly_tube(f"Ring{z}", [(-W / 2, -D / 2, z), (W / 2, -D / 2, z), (W / 2, D / 2, z), (-W / 2, D / 2, z), (-W / 2, -D / 2 + 0.001, z)], 0.006, wire, 6, 0.04))
    for k in range(7):
        x = -W / 2 + k * W / 6
        for sy in (-1, 1):
            P.append(cyl(f"BarF{k}{sy}", 0.004, H, (x, sy * D / 2, 0.02), wire, 6))
    for k in range(5):
        y = -D / 2 + k * D / 4
        for sx in (-1, 1):
            P.append(cyl(f"BarS{k}{sx}", 0.004, H, (sx * W / 2, y, 0.02), wire, 6))
    P.append(bx("Floor", -W / 2, W / 2, -D / 2, D / 2, 0.015, 0.025, wire, 0))
    for sx in (-1, 1):
        P.append(poly_tube(f"Handle{sx}", [(sx * W / 2, -0.08, H), (sx * (W / 2 + 0.04), -0.06, H + 0.03), (sx * (W / 2 + 0.04), 0.06, H + 0.03), (sx * W / 2, 0.08, H)], 0.006, wire, 6, 0.02))
    foams = [mat("foam_blue"), mat("foam_yellow"), mat("foam_pink"), mat("foam_green")]
    rng = random.Random(2)
    for k in range(8):
        x = -0.15 + (k % 4) * 0.1
        y = -0.08 + (k // 4) * 0.15
        z = 0.08 + (k // 4) * 0.03 + rng.uniform(0, 0.08)
        pb = pull_buoy(f"PB{k}", foams[k % 4])
        xf(pb, (x, y, z), rng.uniform(0, PI), rx=PI / 2 + rng.uniform(-0.3, 0.3))
        P.append(pb)
    pb = pull_buoy("PBFloor", foams[1])
    P.append(xf(pb, (W / 2 + 0.12, -0.12, 0.05), 0.6, rx=PI / 2))
    finish("buoy_basket", P, view=(0.2, 1.5, 32, -30))


def rope_reel():
    """A lane-rope reel: a big timber-flanged drum on a steel frame with two wheels, wound with a racing rope in blue and white
    with red at the ends, its loose end trailing to the floor; a crank on the side."""
    reset()
    steel = mat("steel")
    Rd, L = 0.42, 0.86  # the drum's flange radius and its length (along local X)
    axle_z = 0.58
    P = []
    for sx in (-1, 1):
        P.append(cyl(f"Flange{sx}", Rd, 0.03, (L / 2 - 0.03 if sx > 0 else -L / 2, 0, axle_z), mat("reel_navy", "#1d3557", 0.4), 40, bev=0.008, rot=(0, PI / 2, 0)))
    P.append(cyl("Core", 0.12, L, (-L / 2, 0, axle_z), mat("steel_brushed"), 24, rot=(0, PI / 2, 0)))
    rope_cols = [mat("float_blue", "#2f6fc4", 0.35), mat("float_white", "#f4f4f0", 0.35), mat("float_red", "#d6423a", 0.35)]
    rows = 9
    for i in range(rows):
        x = -L / 2 + 0.06 + i * (L - 0.12) / (rows - 1)
        for layer, rr in enumerate((0.22, 0.31)):
            col = rope_cols[2] if (layer == 1 and i < 2) else rope_cols[(i + layer) % 2]
            P.append(torus(f"Wind{i}{layer}", rr, 0.048, (x, 0, axle_z), col, 28, 8, rot=(0, PI / 2, 0)))
    # the loose end: floats on a line down to the floor
    pts = [Vector((0.2, -0.33, axle_z - 0.1)), Vector((0.24, -0.5, 0.2)), Vector((0.3, -0.55, 0.06)), Vector((0.45, -0.52, 0.06))]
    P.append(poly_tube("Line", [tuple(p) for p in pts], 0.008, mat("rope_white", "#e8e4da", 0.8), 6, 0.1))
    for k in range(5):
        t = 0.25 + k * 0.17
        seg = min(2, int(t * 3))
        a, b = pts[seg], pts[min(seg + 1, 3)]
        f = t * 3 - seg
        p = a + (b - a) * min(1, f)
        d = (b - a).normalized()
        fl = cyl(f"Float{k}", 0.05, 0.08, (0, 0, -0.04), rope_cols[2 if k > 2 else k % 2], 14, bev=0.01)
        fl.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        fl.location = p
        apply_all(fl)
        P.append(fl)
    # the frame: an A each side, a cross tube, wheels at the back, feet at the front, a push handle
    for sx in (-1, 1):
        x = sx * (L / 2 + 0.06)
        P.append(poly_tube(f"FrameA{sx}", [(x, -0.38, 0.04), (x, 0, axle_z), (x, 0.38, 0.12)], 0.02, steel, 10, 0.03))
        P.append(cyl(f"Hub{sx}", 0.04, 0.05, (x - 0.025, 0, axle_z), steel, 14, rot=(0, PI / 2, 0)))
        P.append(cyl(f"Wheel{sx}", 0.11, 0.05, (x + sx * 0.03 - 0.025, 0.38, 0.11), mat("rubber"), 24, bev=0.012, rot=(0, PI / 2, 0)))
        P.append(cyl(f"WheelHub{sx}", 0.04, 0.055, (x + sx * 0.03 - 0.0275, 0.38, 0.11), mat("mustard_gloss"), 14, rot=(0, PI / 2, 0)))
        P.append(cyl(f"Foot{sx}", 0.04, 0.03, (x, -0.38, 0.0), mat("rubber"), 12))
    P.append(cyl("CrossBar", 0.018, L + 0.12, (-(L + 0.12) / 2, -0.38, 0.06), steel, 10, rot=(0, PI / 2, 0)))
    P.append(poly_tube("PushHandle", [(-L / 2 - 0.06, 0.3, 0.2), (-L / 2 - 0.06, 0.42, 0.95), (L / 2 + 0.06, 0.42, 0.95), (L / 2 + 0.06, 0.3, 0.2)], 0.018, steel, 10, 0.08))
    P.append(poly_tube("Crank", [(L / 2 + 0.09, 0, axle_z), (L / 2 + 0.12, 0, axle_z), (L / 2 + 0.12, -0.16, axle_z - 0.05), (L / 2 + 0.2, -0.16, axle_z - 0.05)], 0.012, steel, 8, 0.02))
    P.append(cyl("CrankGrip", 0.02, 0.08, (L / 2 + 0.16, -0.16, axle_z - 0.05), mat("coral_gloss"), 12, rot=(0, PI / 2, 0)))
    finish("rope_reel", P, view=(0.55, 3.0, 20, -35))


def hose_reel():
    """A wall-mounted fire hose reel: a red drum of coiled hose on a swinging arm, the nozzle clipped on, FIRE HOSE above."""
    reset()
    red = mat("fire_red", "#c8322b", 0.35)
    zc = 1.15
    P = [bx("WallPlate", -0.12, 0.12, -0.015, 0, zc - 0.2, zc + 0.2, red, 0.01)]
    P.append(cyl("Arm", 0.03, 0.12, (0.0, -0.015, zc), mat("steel"), 14, rot=(PI / 2, 0, 0)))
    P.append(cyl("DrumBack", 0.3, 0.02, (0, -0.13, zc), red, 36, bev=0.006, rot=(PI / 2, 0, 0)))
    P.append(cyl("DrumFront", 0.3, 0.02, (0, -0.33, zc), red, 36, bev=0.006, rot=(PI / 2, 0, 0)))
    P.append(cyl("DrumCore", 0.1, 0.2, (0, -0.15, zc), mat("steel"), 18, rot=(PI / 2, 0, 0)))
    hose = mat("hose_red", "#e04a3c", 0.55)
    for k in range(3):
        for j, r in enumerate((0.15, 0.2, 0.25)):
            P.append(torus(f"Coil{k}{j}", r, 0.024, (0, -0.18 - k * 0.05, zc), hose, 32, 8, rot=(PI / 2, 0, 0)))
    P.append(poly_tube("HoseEnd", [(0.25, -0.33, zc - 0.05), (0.28, -0.36, zc - 0.2), (0.22, -0.36, zc - 0.33)], 0.022, hose, 8, 0.06))
    P.append(cyl("Nozzle", 0.025, 0.12, (0.22, -0.36, zc - 0.45), mat("brass"), 12, r2=0.015))
    P.append(cyl("Valve", 0.04, 0.03, (-0.2, -0.03, zc + 0.27), mat("brass"), 14, rot=(PI / 2, 0, 0)))
    P.append(cyl("ValveWheel", 0.06, 0.012, (-0.2, -0.06, zc + 0.27), red, 16, rot=(PI / 2, 0, 0)))
    P.append(poly_tube("Feed", [(-0.2, -0.03, zc + 0.27), (-0.2, -0.03, zc + 0.6), (-0.2, 0.0, zc + 0.7)], 0.018, mat("steel"), 8, 0.04))
    sg = [bx("SignBoard", -0.15, 0.15, -0.008, 0, -0.055, 0.055, red, 0.004), decal("SignArt", 0.29, 0.105, tmat("dr_sign_hose", 0.5), (0, -0.0085, 0))]
    P.append(grp(sg, "SignJ", (0.12, 0, zc + 0.42)))
    finish("hose_reel", P, view=(1.2, 2.0, 10, -35), backdrop=True)


def honours_board():
    """The CLUB CHAMPIONS honours board: dark varnished timber, names in gold leaf from 1962, the last lines still blank, under a
    carved pediment with the club's crest. Its centre at 1.38 m."""
    reset()
    w, h, zc = 0.62, 0.93, 1.38
    wood, dark = mat("timber_dark"), mat("honours_wood", "#5b3820", 0.35)
    gold = mat("trophy_gold", "#d9a93d", 0.22, 1.0)
    P = [bx("Board", -w / 2, w / 2, -0.03, 0, zc - h / 2, zc + h / 2, dark, 0.01)]
    P.append(decal("Names", w - 0.02, h - 0.02, tmat("dr_honours", 0.35), (0, -0.0305, zc)))
    for k, (cx, cz, sw, sh) in enumerate([(0, h / 2 + 0.02, w + 0.08, 0.04), (0, -h / 2 - 0.02, w + 0.08, 0.04), (-w / 2 - 0.02, 0, 0.04, h), (w / 2 + 0.02, 0, 0.04, h)]):
        P.append(bx(f"Moulding{k}", cx - sw / 2, cx + sw / 2, -0.045, 0, zc + cz - sh / 2, zc + cz + sh / 2, wood, 0.012))
    ped = extrude_shape("Pediment", [(-w / 2 - 0.05, 0), (w / 2 + 0.05, 0), (0.0, 0.16)], 0.04, (0, 0, 0), wood, (PI / 2, 0, 0), 0.01)
    P.append(xf(ped, (0, 0.0, zc + h / 2 + 0.04)))
    P.append(cyl("Crest", 0.05, 0.012, (0, -0.04, zc + h / 2 + 0.1), gold, 24, rot=(PI / 2, 0, 0)))
    P.append(pictogram_3d("CrestFig", "man", 0.07, dark, (0, -0.053, zc + h / 2 + 0.065), 0, 0.004))
    for k, x in enumerate((-w / 2 + 0.03, w / 2 - 0.03)):
        P.append(sphere(f"Rosette{k}", 0.018, (x, -0.04, zc + h / 2 + 0.02), gold, 10, 6))
    finish("honours_board", P, view=(1.45, 2.0, 6, -20), backdrop=True)


def rules_board():
    """POOL RULES: an enamel board of pictograms in a navy frame with chrome screw caps. Its centre at 1.5 m."""
    reset()
    w, h, zc = 0.5, 0.75, 1.5
    P = [bx("Board", -w / 2 - 0.02, w / 2 + 0.02, -0.018, 0, zc - h / 2 - 0.02, zc + h / 2 + 0.02, mat("navy_gloss"), 0.01)]
    P.append(decal("Rules", w, h, tmat("dr_rules", 0.3), (0, -0.0185, zc)))
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.append(sphere(f"Screw{sx}{sz}", 0.012, (sx * (w / 2 + 0.003), -0.02, zc + sz * (h / 2 + 0.003)), mat("chrome"), 10, 6, (1, 0.5, 1)))
    finish("rules_board", P, view=(1.5, 1.8, 6, -20), backdrop=True)


def no_running():
    """An enamel NO RUNNING plaque, chipped at the edges, four screws. Its centre at 1.45 m."""
    reset()
    w, h, zc = 0.3, 0.45, 1.45
    P = [bx("Plate", -w / 2, w / 2, -0.008, 0, zc - h / 2, zc + h / 2, mat("white_gloss"), 0.012, 3)]
    P.append(decal("Art", w - 0.012, h - 0.012, tmat("dr_no_running", 0.25), (0, -0.0085, zc)))
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.append(sphere(f"Screw{sx}{sz}", 0.008, (sx * (w / 2 - 0.018), -0.009, zc + sz * (h / 2 - 0.018)), mat("chrome"), 8, 6, (1, 0.5, 1)))
    finish("no_running", P, view=(1.45, 1.2, 6, -20), backdrop=True)


def wall_clock():
    """A round station clock for the pilaster, its face 'Harbourside', at 2.9 m. The hour hand stays at about ten past four (late
    afternoon); `HandMinuteWall` and `HandSecondWall` turn (pivots at the centre, pointing up at rest, about the face normal)."""
    reset()
    zc, R = 2.9, 0.19
    P = [cyl("Case", R + 0.025, 0.06, (0, 0, zc), mat("navy_gloss"), 40, bev=0.015, rot=(PI / 2, 0, 0))]
    P.append(torus("Bezel", R + 0.012, 0.012, (0, -0.062, zc), mat("chrome"), 40, 8, rot=(PI / 2, 0, 0)))
    P.append(disc("Face", R, tmat("dr_clock_face", 0.4), (0, -0.0605, zc)))
    hour = bx("HourHand", -0.01, 0.01, -0.004, 0, -0.02, 0.1, mat("navy"), 0.003)
    xf(hour, (0, -0.064, zc), ry=math.radians(125))
    P.append(hour)
    P.append(cyl("Hub", 0.014, 0.012, (0, -0.064, zc), mat("navy"), 14, rot=(PI / 2, 0, 0)))
    P.append(bx("Bracket", -0.04, 0.04, -0.01, 0, zc - R - 0.05, zc - R + 0.02, mat("chrome"), 0.004))
    m_hand = bx("HandMinuteWall", -0.007, 0.007, -0.071, -0.067, -0.025, 0.15, mat("navy"), 0.002)
    s_hand = join([bx("SecondArm", -0.0025, 0.0025, -0.075, -0.072, -0.04, 0.165, mat("coral"), 0), cyl("SecondDot", 0.008, 0.004, (0, -0.072, 0), mat("coral"), 12, rot=(PI / 2, 0, 0))], "HandSecondWall")
    for h_ in (m_hand, s_hand):  # modelled round (0, 0, 0) pointing up: their pivot goes to the clock's centre with them
        at_origin(h_, (0, 0, zc))
    finish("wall_clock", P, [m_hand, s_hand], (2.9, 1.0, 5, -20), backdrop=True)


def pace_clock():
    """The swimmers' pace clock for the +Z wall: a white case 0.92 m across with a coral rim, a 60-second face, the red sweep
    hand `HandSecond` and the navy `HandMinute` (pivots at the centre, pointing up at rest, turning about the face normal);
    its centre at 3.2 m."""
    reset()
    zc, R = 3.2, 0.42
    P = [cyl("Case", R + 0.04, 0.1, (0, 0, zc), mat("white_gloss"), 56, bev=0.025, rot=(PI / 2, 0, 0))]
    P.append(torus("Rim", R + 0.03, 0.022, (0, -0.1, zc), mat("coral_gloss"), 56, 10, rot=(PI / 2, 0, 0)))
    P.append(disc("Face", R, tmat("dr_pace_face", 0.35), (0, -0.103, zc), 64))
    P.append(cyl("Hub", 0.032, 0.035, (0, -0.1, zc), mat("navy"), 18, rot=(PI / 2, 0, 0)))
    for sx in (-1, 1):  # wall brackets and the cable conduit down the wall
        P.append(bx(f"Bracket{sx}", sx * 0.25 - 0.03, sx * 0.25 + 0.03, -0.05, 0, zc + R - 0.02, zc + R + 0.08, mat("steel"), 0.006))
    P.append(bx("Conduit", -0.012, 0.012, -0.024, 0, 2.0, zc - R - 0.04, mat("cream"), 0.006))
    P.append(bx("ConduitBox", -0.04, 0.04, -0.04, 0, zc - R - 0.08, zc - R - 0.0, mat("cream"), 0.008))
    sec = [bx("SecArm", -0.008, 0.008, -0.129, -0.125, -0.08, R - 0.03, mat("red"), 0.003)]
    sec.append(xf(extrude_shape("SecTip", [(-0.02, R - 0.05), (0.02, R - 0.05), (0, R - 0.0)], 0.004, (0, 0, 0), mat("red"), (PI / 2, 0, 0)), (0, -0.125, 0)))
    sec.append(cyl("SecTail", 0.025, 0.006, (0, -0.125, -0.07), mat("red"), 16, rot=(PI / 2, 0, 0)))
    sec_o = join(sec, "HandSecond")
    mn = [bx("MinArm", -0.014, 0.014, -0.119, -0.115, -0.04, R * 0.62, mat("navy"), 0.004)]
    mn.append(xf(extrude_shape("MinTip", [(-0.03, R * 0.62 - 0.01), (0.03, R * 0.62 - 0.01), (0, R * 0.62 + 0.05)], 0.004, (0, 0, 0), mat("navy"), (PI / 2, 0, 0)), (0, -0.115, 0)))
    min_o = join(mn, "HandMinute")
    for h_ in (sec_o, min_o):  # modelled round (0, 0, 0) pointing up: their pivot goes to the clock's centre with them
        at_origin(h_, (0, 0, zc))
    finish("pace_clock", P, [sec_o, min_o], (3.2, 2.0, 5, -20), backdrop=True)


def extinguisher_cabinet():
    """A red-framed fire point: a glazed cabinet with an extinguisher inside and its sign above. Built for 0.55-1.55 m."""
    reset()
    red = mat("fire_red", "#c8322b", 0.35)
    W, D, z0, z1 = 0.34, 0.22, 0.55, 1.3
    P = [bx("Back", -W / 2, W / 2, -0.012, 0, z0, z1, red, 0.006)]
    for sx in (-1, 1):
        P.append(bx(f"Side{sx}", min(sx * W / 2, sx * (W / 2 - 0.02)), max(sx * W / 2, sx * (W / 2 - 0.02)), -D, 0, z0, z1, red, 0.006))
    P.append(bx("Top", -W / 2, W / 2, -D, 0, z1 - 0.02, z1, red, 0.006))
    P.append(bx("Bottom", -W / 2, W / 2, -D, 0, z0, z0 + 0.02, red, 0.006))
    P.append(bx("Inside", -W / 2 + 0.02, W / 2 - 0.02, -0.014, -0.012, z0 + 0.02, z1 - 0.02, mat("white"), 0))
    for k, (a, b, c, d) in enumerate([(-W / 2, -W / 2 + 0.03, z0, z1), (W / 2 - 0.03, W / 2, z0, z1), (-W / 2, W / 2, z0, z0 + 0.03), (-W / 2, W / 2, z1 - 0.03, z1)]):
        P.append(bx(f"DoorFrame{k}", a, b, -D - 0.015, -D, c, d, red, 0.004))
    P.append(bx("DoorPull", W / 2 - 0.06, W / 2 - 0.045, -D - 0.03, -D - 0.015, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05, mat("chrome"), 0.003))
    ext = [cyl("ExBody", 0.075, 0.42, (0, 0, 0), red, 20, bev=0.03)]
    ext.append(cyl("ExNeck", 0.03, 0.05, (0, 0, 0.42), mat("black"), 12))
    ext.append(bx("ExHead", -0.05, 0.05, -0.02, 0.02, 0.46, 0.5, mat("black"), 0.008))
    ext.append(bx("ExLever", -0.01, 0.09, -0.015, 0.015, 0.5, 0.52, mat("black"), 0.005))
    ext.append(cyl("ExGauge", 0.015, 0.01, (0.0, -0.025, 0.475), mat("white"), 10, rot=(PI / 2, 0, 0)))
    ext.append(poly_tube("ExHose", [(-0.05, 0, 0.47), (-0.09, -0.02, 0.4), (-0.085, -0.03, 0.15)], 0.01, mat("black"), 6, 0.04))
    ext.append(bx("ExLabel", -0.05, 0.05, -0.077, -0.074, 0.14, 0.3, mat("cream"), 0))
    P.append(grp(ext, "Extinguisher", (0.01, -D / 2 - 0.005, z0 + 0.06)))
    glass = bx("Glass_Cabinet", -W / 2 + 0.03, W / 2 - 0.03, -D - 0.01, -D - 0.005, z0 + 0.03, z1 - 0.03, mat("glass_frame", "#e8f4f6", 0.04, alpha=0.18), 0)
    sg = [bx("SignBoard", -0.14, 0.14, -0.008, 0, -0.07, 0.07, red, 0.004), decal("SignArt", 0.27, 0.135, tmat("dr_sign_extinguisher", 0.5), (0, -0.0085, 0))]
    P.append(grp(sg, "SignJ", (0, 0, z1 + 0.15)))
    finish("extinguisher_cabinet", P, [glass], (1.0, 1.8, 10, -30), backdrop=True)


def emergency_phone():
    """A yellow emergency telephone box on the wall: a red handset on its hook, a coiled cord, the sign above. At 1.15-1.6 m."""
    reset()
    yel = mat("phone_yellow", "#f2c230", 0.35)
    zc = 1.3
    P = [bx("Box", -0.12, 0.12, -0.1, 0, zc - 0.17, zc + 0.17, yel, 0.02, 2)]
    P.append(bx("Hood", -0.14, 0.14, -0.13, 0, zc + 0.15, zc + 0.19, yel, 0.012))
    P.append(bx("Keypad", -0.05, 0.05, -0.104, -0.098, zc - 0.1, zc + 0.0, mat("charcoal"), 0.004))
    for i in range(3):
        for j in range(3):
            P.append(bx(f"Key{i}{j}", -0.04 + j * 0.03 - 0.008, -0.04 + j * 0.03 + 0.008, -0.11, -0.103, zc - 0.088 + i * 0.03, zc - 0.072 + i * 0.03, mat("white"), 0.002))
    hs = [bx("HsGrip", -0.018, 0.018, -0.02, 0.02, -0.09, 0.09, mat("red"), 0.012)]
    for sz in (-1, 1):
        hs.append(bx(f"HsCup{sz}", -0.03, 0.03, -0.035, 0.015, sz * 0.09 - 0.025, sz * 0.09 + 0.025, mat("red"), 0.014))
    P.append(grp(hs, "Handset", (0.08, -0.13, zc + 0.03)))
    P.append(bx("Hook", 0.06, 0.1, -0.13, -0.1, zc - 0.07, zc - 0.05, mat("chrome"), 0.004))
    coil = [(0.06 + 0.015 * math.cos(k * 1.4), -0.15 + 0.015 * math.sin(k * 1.4), zc - 0.07 - k * 0.012) for k in range(20)]
    P.append(poly_tube("Cord", coil, 0.004, mat("black"), 5, 0.004))
    P.append(poly_tube("CordUp", [coil[-1], (0.0, -0.11, zc - 0.33), (-0.05, -0.1, zc - 0.17)], 0.004, mat("black"), 5, 0.04))
    sg = [bx("SignBoard", -0.14, 0.14, -0.008, 0, -0.07, 0.07, yel, 0.004), decal("SignArt", 0.27, 0.135, tmat("dr_sign_phone", 0.5), (0, -0.0085, 0))]
    P.append(grp(sg, "SignJ", (0, 0, zc + 0.35)))
    finish("emergency_phone", P, view=(1.4, 1.4, 10, -30), backdrop=True)


# ---- plants ----------------------------------------------------------------------------------------------------------------
def plant_palm():
    """A kentia palm in a big terracotta pot: arching fronds, the club's pride."""
    reset()
    P = [pot_plant("Palm", "palm", mat("terracotta"), (0, 0, 0), 0, 1.0, 5)]
    P.append(torus("Saucer", 0.27, 0.02, (0, 0, 0.012), mat("terracotta"), 32, 6))
    finish("plant_palm", P, view=(0.8, 3.6, 15, -30))


def plant_fern():
    """A Boston fern in a cream glazed pot on a timber plant stand."""
    reset()
    wood = mat("timber")
    P = []
    for k in range(3):
        a = k * 2 * PI / 3
        leg = bx(f"Leg{k}", -0.018, 0.018, -0.018, 0.018, 0, 0.5, wood, 0.006)
        P.append(xf(leg, (math.cos(a) * 0.15, math.sin(a) * 0.15, 0), a, rx=0.0))
    P.append(cyl("StandTop", 0.2, 0.03, (0, 0, 0.5), wood, 28, bev=0.008))
    P.append(cyl("StandShelf", 0.15, 0.02, (0, 0, 0.18), wood, 24, bev=0.006))
    P.append(pot_plant("Fern", "fern", mat("pot_cream", "#f3e6c9", 0.3), (0, 0, 0.53), 0, 1.0, 8))
    finish("plant_fern", P, view=(0.75, 2.8, 18, -30))


def plant_snake():
    """A snake plant in a navy ceramic pot with a mustard band."""
    reset()
    P = [pot_plant("Snake", "snake", mat("navy_gloss"), (0, 0, 0), 0, 1.0, 6)]
    finish("plant_snake", P, view=(0.55, 2.2, 15, -30))


# ---- on the window sills and the radiators ---------------------------------------------------------------------------------
def sill_succulents():
    """Three little succulents in a row on a timber tray, for a window sill."""
    reset()
    P = [bx("Tray", -0.24, 0.24, -0.08, 0.08, 0, 0.015, mat("timber_light"), 0.005)]
    for k, (x, m) in enumerate([(-0.15, mat("terracotta")), (0.0, mat("pot_cream", "#f3e6c9", 0.3)), (0.15, mat("coral_gloss"))]):
        P.append(pot_plant(f"Succ{k}", "succulent", m, (x, 0, 0.015), k * 0.7, 1.0, 20 + k))
    finish("sill_succulents", P, view=(0.1, 0.9, 25, -30))


def sill_pothos():
    """A pothos in a coral pot, trailing over the sill's edge."""
    reset()
    P = [pot_plant("Pothos", "trailing", mat("coral_gloss"), (0, 0, 0), 0, 1.3, 31)]
    finish("sill_pothos", P, view=(0.1, 0.9, 20, -30))


def sill_bits():
    """What gets left on a sill: goggles, a swim cap turned inside out, a water bottle, a rubber duck."""
    reset()
    P = [goggles("Goggles", mat("lens_blue", "#3d7fd1", 0.1), mat("strap_coral", "#ef6a4c", 0.5), (-0.12, 0.02, 0.006), 0.4)]
    cap = sphere("SwimCap", 0.09, (0, 0, 0), mat("cap_sea", "#2f8c88", 0.35), 18, 10, (1, 1.15, 0.55))
    for v in cap.data.vertices:
        v.co.z = max(v.co.z, 0)
    P.append(xf(cap, (0.06, 0.0, 0), 0.5))
    P.append(bottle("Bottle", mat("bottle_clear", "#cfe9ef", 0.1), mat("coral"), 0.22, 0.033, (0.2, 0.03, 0)))
    duck = [sphere("DuckBody", 0.04, (0, 0, 0.035), mat("mustard_gloss"), 14, 8, (1.3, 1, 0.85)), sphere("DuckHead", 0.025, (0.035, 0, 0.08), mat("mustard_gloss"), 12, 8), cyl("DuckBeak", 0.011, 0.025, (0.055, 0, 0.078), mat("coral"), 8, rot=(0, PI / 2, 0))]
    P.append(grp(duck, "Duck", (-0.25, -0.03, 0), -0.8))
    finish("sill_bits", P, view=(0.06, 1.0, 30, -25))


def radiator_towel():
    """A striped towel left drying over the top of a cream radiator (the radiator is the building's): its front 0.165 m out
    from the wall, its top at 1.01 m. Pivot on the wall at floor level; the towel runs along local x."""
    reset()
    w = 0.5
    front, back, top = -0.175, -0.05, 1.025
    m, s = mat("towel_blue"), mat("towel_stripe")
    P = []
    drape = bx("Front", -w / 2, w / 2, front - 0.02, front, 0.55, top + 0.01, m, 0.012)
    for v in drape.data.vertices:  # it bellies out a little and its hem waves
        t = (top - v.co.z) / (top - 0.55)
        v.co.y -= 0.025 * math.sin(PI * min(1, max(0, t)))
        v.co.z += 0.015 * math.sin(v.co.x * 14) * t
    P.append(drape)
    P.append(bx("Top", -w / 2, w / 2, front - 0.02, back + 0.015, top - 0.005, top + 0.015, m, 0.01))
    P.append(bx("BackDrape", -w / 2, w / 2, back, back + 0.015, 0.8, top + 0.01, m, 0.01))
    for k, z in enumerate((0.63, 0.67)):
        st = bx(f"Stripe{k}", -w / 2 + 0.004, w / 2 - 0.004, front - 0.026, front - 0.018, z, z + 0.022, s, 0)
        for v in st.data.vertices:
            t = (top - v.co.z) / (top - 0.55)
            v.co.y -= 0.025 * math.sin(PI * min(1, max(0, t)))
            v.co.z += 0.015 * math.sin(v.co.x * 14) * t
        P.append(st)
    P.append(cyl("FoldRoll", 0.016, w, (-w / 2, front - 0.005, top + 0.002), m, 10, rot=(0, PI / 2, 0)))
    if PREVIEW:  # a stand-in radiator for the preview (not exported)
        [bx(f"PvFin{k}", -0.6 + k * 0.1, -0.6 + k * 0.1 + 0.055, -0.165, -0.005, 0.23, 1.01, mat("radiator_cream", "#f1e4c8", 0.4), 0.02) for k in range(12)]
    finish("radiator_towel", P, view=(0.8, 1.8, 20, -40), backdrop=True)


# ---- the office corner and the far end ---------------------------------------------------------------------------------------
def filing_cabinet():
    """The office's old steel filing cabinet, three drawers with card holders, a kettle, two mugs and a little radio on top."""
    reset()
    W, D, H = 0.47, 0.55, 1.0
    green = mat("cabinet_green", "#7d9a86", 0.4)
    P = [bx("Body", -W / 2, W / 2, -D / 2, D / 2, 0.02, H, green, 0.015)]
    P.append(bx("Kick", -W / 2 + 0.02, W / 2 - 0.02, -D / 2 + 0.02, D / 2, 0, 0.03, mat("charcoal"), 0.005))
    for k in range(3):
        z0 = 0.05 + k * 0.315
        P.append(bx(f"Drawer{k}", -W / 2 + 0.02, W / 2 - 0.02, -D / 2 - 0.012, -D / 2, z0, z0 + 0.29, green, 0.008))
        P.append(bx(f"Pull{k}", -0.07, 0.07, -D / 2 - 0.03, -D / 2 - 0.012, z0 + 0.19, z0 + 0.21, mat("chrome"), 0.006))
        P.append(bx(f"Card{k}", -0.05, 0.05, -D / 2 - 0.015, -D / 2 - 0.012, z0 + 0.225, z0 + 0.26, mat("paper"), 0))
    P.append(cyl("Kettle", 0.08, 0.17, (-0.1, 0.05, H), mat("white_gloss"), 20, bev=0.02, r2=0.065))
    P.append(cyl("KettleLid", 0.05, 0.02, (-0.1, 0.05, H + 0.17), mat("white_gloss"), 16, bev=0.006))
    P.append(torus("KettleHandle", 0.06, 0.012, (-0.1, 0.12, H + 0.12), mat("charcoal"), 16, 6, rot=(0, PI / 2, 0)))
    P.append(cyl("KettleSpout", 0.016, 0.08, (-0.1, -0.03, H + 0.08), mat("white_gloss"), 10, rot=(1.0, 0, 0)))
    for k, (x, y, m) in enumerate([(0.08, -0.12, mat("coral_gloss")), (0.15, -0.02, mat("sea_gloss"))]):
        P.append(cyl(f"Mug{k}", 0.04, 0.09, (x, y, H), m, 16, bev=0.006))
        P.append(torus(f"MugHandle{k}", 0.025, 0.007, (x + 0.045, y, H + 0.045), m, 12, 5, rot=(PI / 2, 0, 0)))
    P.append(bx("Radio", -0.11, 0.11, -0.04, 0.04, 0, 0.12, mat("radio_cream", "#efe2c4", 0.4), 0.02))
    P[-1] = xf(P[-1], (0.12, 0.17, H), 0.1)
    P.append(xf(cyl("RadioDial", 0.03, 0.006, (0, 0, 0), mat("brass"), 16, rot=(PI / 2, 0, 0)), (0.17, 0.125, H + 0.06), 0.1))
    P.append(xf(bx("RadioGrille", -0.06, 0.03, -0.003, 0.0, -0.035, 0.035, mat("charcoal"), 0.004), (0.1, 0.128, H + 0.06), 0.1))
    P.append(xf(cyl("Aerial", 0.003, 0.3, (0, 0, 0), mat("chrome"), 6, rot=(0.5, 0, 0)), (0.02, 0.2, H + 0.12), 0.1))
    finish("filing_cabinet", P, view=(0.6, 2.2, 22, -30))


def spectator_chairs():
    """A row of four moulded chairs on a steel beam for parents watching lessons; a programme left on one, a cardigan on another."""
    reset()
    steel = mat("steel_brushed")
    cols = [mat("chair_sea", "#2f8c88", 0.35), mat("chair_coral", "#ef6a4c", 0.35), mat("chair_sea"), mat("chair_mustard", "#f2b33d", 0.35)]
    P = [bx("Beam", -1.02, 1.02, -0.03, 0.03, 0.36, 0.42, steel, 0.01)]
    for sx in (-1, 1):
        P.append(poly_tube(f"Leg{sx}", [(sx * 0.8, -0.24, 0.0), (sx * 0.8, 0, 0.39), (sx * 0.8, 0.24, 0.0)], 0.022, steel, 10, 0.08))
        for sy in (-1, 1):
            P.append(cyl(f"Foot{sx}{sy}", 0.03, 0.015, (sx * 0.8, sy * 0.24, 0), mat("rubber"), 10))
    for k in range(4):
        x = -0.765 + k * 0.51
        seat = bx(f"Seat{k}", -0.22, 0.22, -0.22, 0.2, 0.42, 0.46, cols[k], 0.02, 3)
        for v in seat.data.vertices:  # dished
            v.co.z -= 0.015 * (1 - (v.co.x / 0.22) ** 2) * (1 - ((v.co.y + 0.01) / 0.21) ** 2)
        P.append(xf(seat, (x, 0, 0)))
        back = bx(f"Back{k}", -0.21, 0.21, -0.02, 0.02, 0.0, 0.36, cols[k], 0.02, 3)
        for v in back.data.vertices:
            v.co.y += 0.03 * (v.co.x / 0.21) ** 2
        P.append(xf(back, (x, 0.2, 0.47), rx=-0.18))
        spine = bx(f"Spine{k}", -0.06, 0.06, -0.012, 0.012, -0.1, 0.18, cols[k], 0.01)
        P.append(xf(spine, (x, 0.215, 0.47), rx=-0.18))
        P.append(bx(f"Bracket{k}", x - 0.05, x + 0.05, -0.05, 0.22, 0.4, 0.43, steel, 0.006))
    # a gala programme on one seat, a cardigan over another's back
    P.append(xf(bx("Programme", -0.1, 0.1, -0.14, 0.14, 0, 0.006, mat("paper"), 0.002), (-0.25, -0.02, 0.455), 0.3))
    P.append(xf(bx("ProgCover", -0.1, 0.1, -0.14, 0.14, 0, 0.002, mat("coral"), 0), (-0.25, -0.02, 0.462), 0.3))
    P.append(towel_folded("SeatTowel", 0.3, 0.22, 0.05, mat("towel_coral"), mat("towel_stripe"), (0.765, -0.03, 0.455), -0.2))
    P.append(bottle("SeatFlask", mat("flask_blue", "#3d7fd1", 0.3), mat("chrome"), 0.26, 0.035, (0.25, 0.05, 0.455)))
    finish("spectator_chairs", P, view=(0.5, 3.0, 22, -30))


def cafe_doors():
    """Double glass doors to the café and the viewing gallery upstairs: a navy frame, push bars, a warm corridor behind the glass
    (a painted backdrop), the sign CAFÉ & VIEWING GALLERY over them and a step mat."""
    reset()
    navy = mat("navy_gloss")
    W, H = 1.9, 2.3
    P = []
    # the frame
    for k, (a, b, c, d) in enumerate([(-W / 2 - 0.08, -W / 2, 0, H + 0.08), (W / 2, W / 2 + 0.08, 0, H + 0.08), (-W / 2 - 0.08, W / 2 + 0.08, H, H + 0.08), (-0.02, 0.02, 0, H)]):
        P.append(bx(f"Frame{k}", a, b, -0.1, 0, c, d, navy, 0.01))
    # the corridor behind: a recess and its picture, glowing a little
    P.append(bx("Reveal", -W / 2, W / 2, -0.02, 0, 0, H, mat("charcoal"), 0))
    P.append(decal("View", W, H, tmat("dr_cafe_view", 0.8, emit_strength=0.6), (0, -0.025, H / 2)))
    glass = []
    for k, sx in enumerate((-1, 1)):
        x0, x1 = (-W / 2 + 0.01, -0.03) if sx < 0 else (0.03, W / 2 - 0.01)
        for j, (a, b, c, d) in enumerate([(x0, x0 + 0.07, 0.02, H - 0.02), (x1 - 0.07, x1, 0.02, H - 0.02), (x0, x1, 0.02, 0.24), (x0, x1, H - 0.1, H - 0.02)]):
            P.append(bx(f"Leaf{k}{j}", a, b, -0.075, -0.035, c, d, navy, 0.006))
        glass.append(bx(f"Glass_Cafe{k}", x0 + 0.06, x1 - 0.06, -0.06, -0.05, 0.23, H - 0.09, mat("glass_frame", "#e8f4f6", 0.04, alpha=0.18), 0))
        xb = -0.12 if sx < 0 else 0.12
        P.append(cyl(f"PushBar{k}", 0.018, 0.75 - 0.2, (x0 + 0.1 if sx < 0 else x0 + 0.1, -0.13, 1.05), mat("chrome"), 12, rot=(0, PI / 2, 0)))
        for e in (x0 + 0.13, x1 - 0.13):
            P.append(cyl(f"BarPost{k}{e:.2f}", 0.012, 0.06, (e, -0.075, 1.05), mat("chrome"), 10, rot=(PI / 2, 0, 0)))
        P.append(bx(f"KickPlate{k}", x0 + 0.07, x1 - 0.07, -0.08, -0.075, 0.03, 0.22, mat("steel_brushed"), 0.003))
        # PUSH on the glass in white letters
        P.append(flat_text(f"Push{k}", "PUSH", 0.06, mat("white"), ((x0 + x1) / 2, -0.062, 1.3), 0, 0.0, res=1))
    # the sign above
    sg = [bx("SignBoard", -1.1, 1.1, -0.06, 0, -0.17, 0.17, navy, 0.02)]
    sg.append(bx("SignLine", -1.04, 1.04, -0.062, -0.058, -0.14, -0.13, mat("mustard"), 0))
    sg.append(flat_text("SignWord", "CAFÉ & VIEWING GALLERY", 0.17, mat("cream"), (0, -0.065, 0.025), 0, 0.012, res=2))
    sg.append(flat_text("SignSub", "upstairs  ·  hot drinks  ·  snacks", 0.06, mat("mustard"), (0, -0.063, -0.105), 0, 0.0, res=1))
    P.append(grp(sg, "Sign", (0, 0, H + 0.33)))
    for sx in (-1, 1):
        P.append(bx(f"SignBracket{sx}", sx * 0.9 - 0.02, sx * 0.9 + 0.02, -0.05, 0, H + 0.08, H + 0.17, mat("steel"), 0.005))
    # a coir mat at the threshold
    P.append(bx("Mat", -0.75, 0.75, -0.6, -0.12, 0, 0.015, mat("coir", "#9b7a4e", 0.95), 0.006))
    P.append(bx("MatBorder", -0.77, 0.77, -0.62, -0.1, 0, 0.012, mat("rubber"), 0.004))
    finish("cafe_doors", P, glass, (1.4, 4.4, 10, -25), backdrop=True)


def menu_board():
    """The café's chalkboard menu in a timber frame: tea, toasties, ice lollies, the soup of the day. Its centre at 1.45 m."""
    reset()
    w, h, zc = 0.5, 0.75, 1.45
    wood = mat("timber")
    P = [bx("Board", -w / 2, w / 2, -0.015, 0, zc - h / 2, zc + h / 2, mat("slate", "#2b3330", 0.8), 0)]
    P.append(decal("Menu", w, h, tmat("dr_menu", 0.75), (0, -0.0155, zc)))
    for k, (cx, cz, sw, sh) in enumerate([(0, h / 2 + 0.025, w + 0.1, 0.05), (0, -h / 2 - 0.025, w + 0.1, 0.05), (-w / 2 - 0.025, 0, 0.05, h), (w / 2 + 0.025, 0, 0.05, h)]):
        P.append(bx(f"Frame{k}", cx - sw / 2, cx + sw / 2, -0.03, 0, zc + cz - sh / 2, zc + cz + sh / 2, wood, 0.01))
    P.append(bx("ChalkLedge", -w / 2, w / 2, -0.06, 0, zc - h / 2 - 0.06, zc - h / 2 - 0.045, wood, 0.005))
    for k, (x, m) in enumerate([(-0.1, mat("white")), (0.0, mat("chalk_pink", "#ef9fbf", 0.9)), (0.12, mat("chalk_yellow", "#f7df6e", 0.9))]):
        P.append(cyl(f"Chalk{k}", 0.006, 0.06, (x - 0.03, -0.03, zc - h / 2 - 0.04), m, 8, rot=(0, PI / 2, 0.2 * k)))
    finish("menu_board", P, view=(1.45, 1.6, 6, -20), backdrop=True)


ASSETS = [vending_machine, trophy_cabinet, noticeboard, lost_property, towel_cubbies, laundry_hamper, poster_gala, poster_learn, kickboard_rack, whiteboard, noodle_bin, buoy_basket, rope_reel, hose_reel, honours_board, rules_board, no_running, wall_clock, pace_clock, extinguisher_cabinet, emergency_phone, plant_palm, plant_fern, plant_snake, sill_succulents, sill_pothos, sill_bits, radiator_towel, filing_cabinet, spectator_chairs, cafe_doors, menu_board]


# ---- where they go (Godot coordinates; rot 0 faces +Z, -90 faces -X, 180 faces -Z) ------------------------------------------
ZW, ZF = -16.655, -16.62  # the -Z wall: wall things' pivot (in front of its navy band), floor things' backs (clear of its rail)
XW, XF = 14.655, 14.63  # the +X wall
ZE, ZEF = 13.455, 13.43  # the +Z wall
SILL = 2.16


def P_(asset, x, y, z, rot, note, scale=1):
    return {"asset": f"props/{asset}.glb", "pos": [round(x, 3), round(y, 3), round(z, 3)], "rot": rot, "scale": scale, "note": note}


PLACEMENTS = [
    # the -Z wall, right half (what the camera sees most), from the WOMEN bay's door toward the middle
    P_("vending_machine", 6.75, 0, ZF + 0.36, 0, "-Z wall by the WOMEN door: the drinks machine, glowing"),
    P_("trophy_cabinet", 5.35, 0, ZF + 0.225, 0, "-Z wall: the club's trophies"),
    P_("noticeboard", 3.9, 0, ZW, 0, "-Z wall: the cork noticeboard over the lost property"),
    P_("lost_property", 3.85, 0, ZF + 0.21, 0, "-Z wall: lost property crate"),
    P_("towel_cubbies", 2.6, 0, ZF + 0.2, 0, "-Z wall: clean towels"),
    P_("poster_gala", 2.6, 0, ZW, 0, "-Z wall: the 1974 gala poster above the towels"),
    P_("laundry_hamper", 1.68, 0, ZF + 0.21, 0, "-Z wall: used towels"),
    P_("kickboard_rack", 0.7, 0, ZF + 0.25, 0, "-Z wall: kickboards"),
    P_("whiteboard", 0.7, 0, ZW, 0, "-Z wall: lap times and lessons above the kickboards"),
    # the -Z wall, left half
    P_("noodle_bin", -0.6, 0, ZF + 0.27, 0, "-Z wall: pool noodles"),
    P_("buoy_basket", -1.35, 0, ZF + 0.2, 0, "-Z wall: pull buoys"),
    P_("poster_learn", -1.35, 0, ZW, 0, "-Z wall: LEARN TO SWIM poster"),
    P_("rope_reel", -2.45, 0, ZF + 0.43, 0, "-Z wall: the spare lane rope's reel (clear of the life-ring stand at x -4)"),
    P_("hose_reel", -5.2, 0, ZW, 0, "-Z wall: fire hose reel"),
    P_("honours_board", -6.05, 0, ZW, 0, "-Z wall: CLUB CHAMPIONS honours board"),
    P_("rules_board", -6.95, 0, ZW, 0, "-Z wall: POOL RULES"),
    P_("plant_snake", -6.95, 0, ZF + 0.2, 0, "-Z wall: under the rules"),
    # the pilasters' faces (x +-7.85, z -16.42)
    P_("wall_clock", 7.85, 0, -16.42, 0, "right pilaster: the clock (hands turn)"),
    P_("emergency_phone", 7.85, 0, -16.42, 0, "right pilaster: emergency phone"),
    P_("no_running", -7.85, 0, -16.42, 0, "left pilaster: NO RUNNING"),
    # the +X window wall's foot, between the radiators (z = window centre +-1.1)
    P_("plant_snake", 14.3, 0, -16.1, -90, "corner beside the WOMEN bay"),
    P_("plant_snake", 14.4, 0, -12.3, -90, "+X wall, between radiators 0 and 1"),
    P_("extinguisher_cabinet", XW, 0, -11.0, -90, "+X wall: fire point"),
    P_("plant_palm", 14.38, 0, -6.9, -90, "+X wall, behind the lifeguard chair"),
    P_("no_running", XW, 0, -5.75, -90, "+X wall"),
    P_("radiator_towel", XW, 0, -4.45, -90, "+X wall: a towel drying on radiator 2"),
    P_("plant_fern", 14.4, 0, -1.0, -90, "+X wall, between radiators 2 and 3 (clear of the fish net at z -2.6)"),
    P_("plant_palm", 14.38, 0, 2.5, -90, "+X wall, between radiators 3 and 4"),
    P_("noodle_bin", 14.4, 0, 3.75, -90, "+X wall: more noodles by the first-aid station"),
    P_("radiator_towel", XW, 0, 6.3, -90, "+X wall: a towel drying on radiator 4"),
    P_("plant_fern", 14.4, 0, 7.3, -90, "+X wall, by the chlorine station"),
    P_("filing_cabinet", XF - 0.275, 0, 8.75, -90, "+X wall: the office's filing cabinet behind the counter"),
    P_("plant_snake", 14.35, 0, 13.1, -90, "the +X/+Z corner (compact: the fuse box is on the wall at z 12.05)"),
    # the window sills
    P_("sill_succulents", 14.57, SILL, -13.2, -90, "sill, window 0", 1.3),
    P_("sill_pothos", 14.57, SILL, -9.6, -90, "sill, window 1", 1.3),
    P_("sill_bits", 14.57, SILL, -4.5, -90, "sill, window 2: things left behind"),
    P_("sill_succulents", 14.57, SILL, 1.5, -90, "sill, window 3", 1.3),
    P_("sill_pothos", 14.57, SILL, 6.4, -90, "sill, window 4", 1.3),
    P_("sill_succulents", 14.57, SILL, 11.2, -90, "sill, window 5", 1.3),
    # the +Z end wall
    P_("pace_clock", -11.8, 0, ZE, 180, "+Z wall, beside the viewing gallery's window (hands turn)"),
    P_("cafe_doors", 4.6, 0, ZE, 180, "+Z wall: the café and viewing gallery"),
    P_("menu_board", 6.3, 0, ZE, 180, "+Z wall: the café's menu"),
    P_("plant_palm", 7.6, 0, ZEF - 0.3, 180, "+Z wall, by the café"),
    P_("spectator_chairs", -2.2, 0, ZEF - 0.275, 180, "+Z wall: chairs for watching parents"),
    P_("spectator_chairs", -4.6, 0, ZEF - 0.275, 180, "+Z wall: chairs for watching parents"),
    P_("poster_gala", -3.4, 0, ZE, 180, "+Z wall: another copy of the gala poster above the chairs"),
    P_("rules_board", 0.0, 0, ZE, 180, "+Z wall: the rules again, under the pace clock"),
    P_("poster_learn", 2.1, 0, ZE, 180, "+Z wall: LEARN TO SWIM again, by the café"),
    P_("plant_fern", -6.6, 0, ZEF - 0.25, 180, "+Z wall"),
    P_("extinguisher_cabinet", -8.0, 0, ZE, 180, "+Z wall: a second fire point"),
    P_("kickboard_rack", -9.9, 0, ZEF - 0.25, 180, "+Z wall: the learners' kickboards"),
    P_("noticeboard", -9.9, 0, ZE, 180, "+Z wall: notices above the kickboards"),
    P_("noodle_bin", -11.3, 0, ZEF - 0.27, 180, "+Z wall: noodles for the lessons"),
    P_("plant_palm", -14.15, 0, 12.95, 180, "the -X/+Z corner"),
]


def write_placements():
    path = os.path.join(GODOT, "data", "placements", "dressing.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write("[\n" + ",\n".join("  " + json.dumps(p, ensure_ascii=False) for p in PLACEMENTS) + "\n]\n")
    print("PLACEMENTS", os.path.relpath(path, GODOT), len(PLACEMENTS))


if __name__ == "__main__":
    ensure_textures(TEXNAMES)
    for f in ASSETS:
        if not NAMES or f.__name__ in NAMES:
            f()
    if "--placements" in ARGS or not NAMES:
        write_placements()
