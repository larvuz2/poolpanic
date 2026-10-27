"""The pool's own furniture: starting blocks (1-3), the ladders, a lane-rope float, the rope's wall anchor, the backstroke-flag
posts and a pennant. Each is its own GLB in godot/assets/venue/props/, pivot on the floor, front toward Godot +Z (Blender -Y).

    blender -b -P godot/tools/blender/props_pool.py [-- --preview]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lib import *

PROPS = os.path.join(VENUE, "props")
PREVIEW = "--preview" in sys.argv


def starting_block(n):
    """A competition starting platform: stainless frame, a navy platform sloping 10° to the water, a sea-green grip pad with the
    lane's number, a coral back wedge, backstroke grips, and the number on its front plate. Its front faces the water."""
    reset()
    steel, chrome = mat("steel"), mat("chrome")
    navy, coral = mat("navy_gloss"), mat("coral_gloss")
    pad, white = mat("pad_sea", "#2c7f7b", 0.75), mat("white")
    parts = []
    # the anchor plate and the two posts, a cross bar
    parts.append(box("Anchor", (0.56, 0.62, 0.02), (0, 0.02, 0.01), steel, 0.006))
    for sx in (-0.2, 0.2):
        parts.append(box(f"Post{sx}", (0.07, 0.07, 0.62), (sx, 0.14, 0.32), steel, 0.012))
        parts.append(box(f"Strut{sx}", (0.05, 0.42, 0.05), (sx, -0.06, 0.2), steel, 0.01, rot=(math.radians(-38), 0, 0)))
    parts.append(box("CrossBar", (0.46, 0.06, 0.06), (0, 0.14, 0.44), steel, 0.01))
    # the platform, tilted 10° toward the water (-y)
    tilt = math.radians(10)
    plat = box("Platform", (0.6, 0.66, 0.07), (0, -0.02, 0.69), navy, 0.025, 3)
    pad_o = box("Pad", (0.52, 0.5, 0.012), (0, -0.04, 0.731), pad, 0.004)
    num = text("Number", str(n), 0.3, 0.004, (0, -0.07, 0.738), (0, 0, -math.pi / 2), white)
    for o in (plat, pad_o, num):
        o.rotation_euler.x = tilt
        o.location.z += 0
    # the back wedge (kick plate), coral, on two rails
    wedge = box("Wedge", (0.46, 0.1, 0.07), (0, 0.2, 0.775), coral, 0.02, 3)
    wedge.rotation_euler.x = tilt + math.radians(28)
    for sx in (-0.17, 0.17):
        parts.append(box(f"WedgeRail{sx}", (0.03, 0.3, 0.02), (sx, 0.14, 0.745), steel, 0.006))
    # backstroke grips: a horizontal bar under the front lip and two vertical handles
    parts.append(poly_tube("GripH", [(-0.26, -0.33, 0.6), (-0.26, -0.37, 0.52), (0.26, -0.37, 0.52), (0.26, -0.33, 0.6)], 0.016, chrome, corner=0.05))
    for sx in (-0.29, 0.29):
        parts.append(poly_tube(f"GripV{sx}", [(sx, -0.2, 0.7), (sx * 1.08, -0.24, 0.62), (sx * 1.08, -0.24, 0.42), (sx, -0.2, 0.36)], 0.015, chrome, corner=0.04))
    # the front plate with the lane number, facing the water, and the number on each side
    plate = box("FrontPlate", (0.42, 0.02, 0.26), (0, -0.25, 0.38), white, 0.01)
    fnum = text("FrontNumber", str(n), 0.22, 0.006, (0, -0.262, 0.37), (math.pi / 2, 0, 0), navy)
    side = []
    for sx, rz in ((-0.305, -math.pi / 2), (0.305, math.pi / 2)):
        side.append(text(f"SideNumber{sx}", str(n), 0.12, 0.004, (sx, 0.02, 0.69), (math.pi / 2 - 0.0, 0, rz), mat("white")))
    allp = parts + [plat, pad_o, num, wedge, plate, fnum] + side
    root = parent_all(allp, f"StartingBlock{n}")
    if PREVIEW and n == 1:
        preview("starting_block", (0, 0, 0.45), 2.3, 22, -40)
    export(os.path.join(PROPS, f"starting_block_{n}.glb"), [root])


def ladder():
    """A pool ladder: two polished rails rising from the deck behind the coping, arching over it and down the wall into the water,
    with three treads. The pivot is at the pool's edge line at deck level; the pool is in front (-y)."""
    reset()
    chrome, steel = mat("chrome"), mat("steel_brushed")
    tread = mat("tread", "#d9dee0", 0.5, 1.0)
    parts = []
    for sx in (-0.28, 0.28):
        pts = [(sx, 0.42, 0.0), (sx, 0.42, 0.62), (sx, 0.34, 0.86), (sx, 0.12, 0.9), (sx, -0.06, 0.62), (sx, -0.09, 0.15), (sx, -0.09, -1.3)]
        parts.append(poly_tube(f"Rail{sx}", pts, 0.022, chrome, sides=16, corner=0.18))
        parts.append(cyl(f"Escutcheon{sx}", 0.05, 0.012, (sx, 0.42, 0.0), steel, 24))
        parts.append(cyl(f"WallBumper{sx}", 0.035, 0.05, (sx, -0.07, -1.05), mat("rubber"), 16, rot=(math.pi / 2, 0, 0)))
    for k, z in enumerate((-0.38, -0.72, -1.06)):
        parts.append(box(f"Tread{k}", (0.54, 0.11, 0.025), (0, -0.14, z), tread, 0.008))
        for s in (-1, 1):
            parts.append(box(f"TreadRib{k}{s}", (0.5, 0.008, 0.006), (0, -0.14 + s * 0.03, z + 0.014), steel, 0))
    root = parent_all(parts, "Ladder")
    if PREVIEW:
        preview("ladder", (0, 0, 0.0), 2.6, 18, -55)
    export(os.path.join(PROPS, "ladder.glb"), [root])


def lane_float():
    """One float of a racing lane rope: a hub with fluted wave-killer discs, along Blender y (Godot z: down the lane). White: the
    game colours each float (blue, white, red near the ends) through the MultiMesh's per-instance colour."""
    reset()
    white = mat("float_white", "#ffffff", 0.35)
    parts = [cyl("Hub", 0.035, 0.12, (0, 0.06, 0), white, 16, rot=(math.pi / 2, 0, 0))]
    for k, y in enumerate((-0.045, -0.015, 0.015, 0.045)):
        r = 0.105 if k in (1, 2) else 0.085
        d = cyl(f"Disc{k}", r, 0.014, (0, y + 0.007, 0), white, 20, rot=(math.pi / 2, 0, 0), bev=0.004)
        parts.append(d)
    o = join(parts, "LaneFloat")
    export(os.path.join(PROPS, "lane_float.glb"), [o])


def rope_anchor():
    """Where a lane rope meets the end wall: a stainless cup in the wall with a hook and a short spring."""
    reset()
    steel, chrome = mat("steel"), mat("chrome")
    parts = [cyl("Cup", 0.06, 0.03, (0, 0.0, -0.05), steel, 20, rot=(math.pi / 2, 0, 0))]
    parts.append(torus("Eye", 0.03, 0.007, (0, -0.05, -0.05), chrome, 20, 8, rot=(0, math.pi / 2, 0)))
    coil = [(0.0, -0.08 - k * 0.012, -0.05 + 0.012 * math.sin(k * 1.6)) for k in range(14)]
    parts.append(tube("Spring", coil, 0.005, chrome))
    o = join(parts, "RopeAnchor")
    export(os.path.join(PROPS, "rope_anchor.glb"), [o])


def flag_post():
    """A backstroke-flag post: a weighted round base and a white pole 3.35 m tall with a cap and a ring for the line."""
    reset()
    white, navy, steel = mat("white_gloss"), mat("navy_gloss"), mat("steel")
    parts = [
        cyl("Base", 0.24, 0.07, (0, 0, 0), navy, 32, bev=0.02),
        cyl("BaseTop", 0.12, 0.05, (0, 0, 0.07), steel, 24, bev=0.01),
        cyl("Pole", 0.025, 3.3, (0, 0, 0.1), white, 16),
        cyl("Cap", 0.034, 0.05, (0, 0, 3.4), mat("coral_gloss"), 16, bev=0.01),
        torus("Ring", 0.035, 0.008, (0, 0, 3.32), steel, 20, 8),
    ]
    root = parent_all(parts, "FlagPost")
    export(os.path.join(PROPS, "flag_post.glb"), [root])


def pennant():
    """One pennant of the backstroke line: a triangle, 22 cm wide, hanging 30 cm below its top edge; coloured per instance."""
    reset()
    o = extrude_shape("Pennant", [(-0.11, 0.0), (0.11, 0.0), (0.0, -0.3)], 0.004, (0, 0, 0), mat("pennant_white", "#ffffff", 0.7), (math.pi / 2, 0, 0))
    export(os.path.join(PROPS, "pennant.glb"), [o])


if __name__ == "__main__":
    for n in (1, 2, 3):
        starting_block(n)
    ladder()
    lane_float()
    rope_anchor()
    flag_post()
    pennant()
