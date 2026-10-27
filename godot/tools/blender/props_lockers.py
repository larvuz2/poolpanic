"""The two changing rooms in the corners of the -Z wall (MEN at -x, WOMEN at +x), modelled in place in game coordinates, so each
is placed at the origin with no turn (godot/data/placements/lockers.json). Each is an open alcove toward the pool: a terrazzo
floor, tiled walls 2.6 m tall with a timber cap (the camera looks down into them), a sign over the opening, steel lockers along
the back and outer walls, a slatted bench on a tiled base, coat hooks, a mirror and a hair dryer, the bits people leave behind,
and the door in the inner wall the guests come out of (`Door`, its origin on the hinge; it opens into the hall with
rotation.y = -90° for WOMEN, +90° for MEN). `Light_Bulkhead` is the wall light Godot lights.

    blender -b -P godot/tools/blender/props_lockers.py [-- men|women ...] [--preview]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lib import *
from props_kit import *

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS

# the plan (godot/docs/look.md, data/club-venue.json), as distances from the hall's centre line (u = |x|)
U_IN, U_OUT = 8.05, 13.35  # the side walls' centre lines
WT = 0.3  # their thickness
Z_BACK, Z_FRONT = -16.46, -13.66
Z_BACKWALL = -15.9  # the back wall's (the back lockers') front
WALL_H = 2.6
DOOR_Z0, DOOR_Z1 = -14.87, -13.93  # the door's opening (0.94 with its frame; a 0.85 leaf)
DOOR_H = 2.12
BENCH_U, BENCH_Z, BENCH_HU, BENCH_HZ = 10.7, -15.17, 1.55, 0.36

def M():
    """The rooms' materials (made after reset())."""
    return dict(
        floor=gdmat("terrazzo", "#e8dccb", 0.4),
        cream=gdmat("wall_cream", "#f3e8cf", 0.15),
        sea=gdmat("wall_sea", "#3e9e8f", 0.15),
        navy_t=gdmat("wall_navy", "#24456e", 0.15),
        timber=gdmat("timber", "#c88b4f", 0.5),
        sign=mat("sign_navy", "#1d3557", 0.3),
        sign_cream=mat("sign_cream", "#f3e6c9", 0.4),
        mustard=mat("mustard_gloss"),
        lockers=[mat("locker_coral", "#ef6a4c", 0.32), mat("locker_mustard", "#f2b33d", 0.32), mat("locker_sea", "#2f8c88", 0.3), mat("locker_navy", "#24456e", 0.3)],
        vent=mat("locker_vent", "#1f262d", 0.6),
        brass=mat("brass"),
        chrome=mat("chrome"),
        steel=mat("steel_brushed"),
        plate=mat("number_plate", "#f4f1ea", 0.3),
        ink=mat("navy"),
        slat=mat("bench_slat", "#d39a5e", 0.5),
        door=mat("door_timber", "#c88b4f", 0.45),
        mirror=mat("mirror", "#dfe7ea", 0.02, 1.0),
        stone=mat("threshold_stone", "#efe2c4", 0.5),
        grate=mat("grate_steel", "#aab2b8", 0.35, 1.0),
        rubber=mat("rubber"),
        lamp=mat("lamp_lens", "#fff1d6", 0.2, emit="#fff1d6", emit_strength=6.0),
    )


# ---- a locker column ---------------------------------------------------------------------------------------------------------
def locker_door(name, dw, dh, m, mm, number, spec, rng):
    """One door, built from its hinge (local x=0, the left as you face it) to its free edge (x=dw), its back on y=0."""
    parts = [bx(name + "Leaf", 0, dw, -0.018, 0, 0, dh, m, 0.006, 1)]
    for zc in ([dh - 0.07, 0.07] if dh > 0.6 else [dh - 0.06]):  # louvred vents
        for k in range(3):
            z = zc + (k - 1) * 0.022
            parts.append(bx(name + f"Vent{zc:.2f}{k}", dw * 0.22, dw * 0.78, -0.0205, -0.017, z - 0.005, z + 0.005, mm["vent"], 0))
    pz = dh - (0.16 if dh > 0.6 else 0.13)
    parts.append(bx(name + "Plate", dw / 2 - 0.036, dw / 2 + 0.036, -0.021, -0.017, pz - 0.022, pz + 0.022, mm["plate"], 0))
    parts.append(flat_text(name + "Num", str(number), 0.034, mm["ink"], (dw / 2, -0.0212, pz), 0, 0.0, res=1))
    lz = dh * 0.56 if dh > 0.6 else dh * 0.52
    lx = dw - 0.055
    if spec.get("padlock"):
        parts.append(bx(name + "Hasp", lx - 0.012, lx + 0.012, -0.024, -0.017, lz - 0.03, lz + 0.03, mm["steel"], 0.003, 1))
        parts.append(bx(name + "PadBody", lx - 0.019, lx + 0.019, -0.044, -0.03, lz - 0.075, lz - 0.035, mm["brass"], 0.005, 2))
        parts.append(torus(name + "Shackle", 0.012, 0.0035, (lx, -0.037, lz - 0.033), mm["steel"], 10, 4, rot=(PI / 2, 0, 0)))
    else:
        parts.append(cyl(name + "Lock", 0.016, 0.012, (lx, -0.017, lz), mm["chrome"], 10, rot=(PI / 2, 0, 0)))
        parts.append(bx(name + "Slot", lx - 0.002, lx + 0.002, -0.0305, -0.028, lz - 0.008, lz + 0.008, mm["vent"], 0))
        if spec.get("key"):
            parts.append(bx(name + "Key", lx - 0.005, lx + 0.005, -0.04, -0.028, lz - 0.03, lz + 0.002, mm["brass"], 0.002, 1))
            parts.append(torus(name + "Band", 0.03, 0.007, (lx, -0.04, lz - 0.06), spec["key"], 12, 4, rot=(PI / 2, 0, 0.15)))
    pz2 = lz - (0.12 if dh > 0.6 else 0.1)
    parts.append(bx(name + "Pull", lx - 0.007, lx + 0.007, -0.036, -0.017, pz2 - 0.05, pz2 + 0.05, mm["chrome"], 0.004, 1))
    if spec.get("note"):
        nw, nh = spec["note_size"]
        parts.append(decal(name + "Note", nw, nh, spec["note"], (dw / 2 + 0.01, -0.0225, dh * 0.62), 0, spec.get("note_tilt", 0.05)))
        tape = mat("tape", "#efe3bd", 0.6)
        for sx in (-1, 1):
            t = bx(name + f"Tape{sx}", -0.022, 0.022, -0.0235, -0.0225, -0.008, 0.008, tape, 0)
            parts.append(xf(t, (dw / 2 + 0.01 + sx * nw * 0.36, 0, dh * 0.62 + nh / 2 - 0.004), ry=sx * 0.5))
    return join(parts, name)


def locker_column(name, w, depth, h, tiers, m, mm, numbers, specs, rng, contents=None):
    """A steel locker column, built facing -Y with its front on y=0 and its base on z=0: a hollow carcass with shelves, a door
    per tier. `specs[i]` for tier i (0 = the bottom): padlock, key (a wristband's material), note, ajar (degrees)."""
    t = 0.012
    parts = []
    dh = (h - 0.02) / tiers
    open_tiers = [i for i in range(tiers) if specs.get(i, {}).get("ajar")]
    if not open_tiers:
        parts.append(bx(name + "Carcass", -w / 2, w / 2, 0, depth, 0, h, m, 0.006, 1))
    else:  # hollow where a door stands open
        parts.append(bx(name + "SideL", -w / 2, -w / 2 + t, 0, depth, 0, h, m, 0.004, 1))
        parts.append(bx(name + "SideR", w / 2 - t, w / 2, 0, depth, 0, h, m, 0.004, 1))
        parts.append(bx(name + "Back", -w / 2, w / 2, depth - t, depth, 0, h, m, 0, 1))
        parts.append(bx(name + "Top", -w / 2, w / 2, 0, depth, h - t, h, m, 0.004, 1))
        parts.append(bx(name + "Bottom", -w / 2, w / 2, 0, depth, 0, t, m, 0, 1))
        for i in range(1, tiers):
            parts.append(bx(name + f"Shelf{i}", -w / 2, w / 2, 0, depth, 0.01 + i * dh - t / 2, 0.01 + i * dh + t / 2, m, 0, 1))
        for i in range(tiers):
            if i not in open_tiers:
                parts.append(bx(name + f"Fill{i}", -w / 2 + t, w / 2 - t, t, depth - t, 0.01 + i * dh + t / 2, 0.01 + (i + 1) * dh - t / 2, m, 0))
    for i in range(tiers):
        spec = specs.get(i, {})
        d = locker_door(name + f"Door{i}", w - 0.016, dh - 0.012, m, mm, numbers[i], spec, rng)
        hinge = (-w / 2 + 0.008, 0, 0.01 + i * dh + 0.006)
        ajar = spec.get("ajar", 0)
        xf(d, hinge, -math.radians(ajar))
        parts.append(d)
        if ajar:  # the inside shows: a darker back
            parts.append(bx(name + f"Inside{i}", -w / 2 + t, w / 2 - t, depth - t - 0.002, depth - t, 0.01 + i * dh + t, 0.01 + (i + 1) * dh - t, mat("locker_inside", "#4b5560", 0.6), 0))
            parts.append(bx(name + f"Hook{i}", -0.01, 0.01, depth - 0.06, depth - t, 0.01 + (i + 1) * dh - 0.07, 0.01 + (i + 1) * dh - 0.05, mm["chrome"], 0.003))
    if contents:
        parts += contents
    return join(parts, name)


def locker_row(prefix, count, w, depth, h, tiers, start_colour, mm, first_number, specs, rng, contents=None):
    """`count` columns side by side along local X (centred), facing -Y, front on y=0, on a navy tiled plinth 0.14 tall."""
    cols = []
    total = count * w
    plinth = bx(prefix + "Plinth", -total / 2 + 0.01, total / 2 - 0.01, 0.03, depth, 0, 0.14, mm["navy_t"], 0.01)
    cols.append(plinth)
    for k in range(count):
        cx = -total / 2 + w * (k + 0.5)
        m = mm["lockers"][(start_colour + k) % 4]
        nums = [first_number + k * tiers + (tiers - 1 - i) for i in range(tiers)]  # numbered from the top down
        col = locker_column(f"{prefix}Col{k}", w, depth, h, tiers, m, mm, nums, specs.get(k, {}), rng, (contents or {}).get(k))
        xf(col, (cx, 0, 0.14))
        cols.append(col)
    cols.append(bx(prefix + "TopTrim", -total / 2, total / 2, -0.004, 0.02, 0.14 + h - 0.004, 0.14 + h + 0.012, mm["steel"], 0.004, 1))
    return join(cols, prefix + "Lockers")


# ---- the room ----------------------------------------------------------------------------------------------------------------
def bay(side):
    """side +1: WOMEN (+x), -1: MEN (-x)."""
    reset()
    s = side
    women = s > 0
    tag = "Women" if women else "Men"
    rng = random.Random(7 if women else 11)
    mm = M()
    X = lambda u: s * u
    face_in = "+x" if women else "-x"  # the inner wall's inside face looks toward the outer wall
    face_hall = "-x" if women else "+x"  # its hall face, and the outer wall's inside face, look back toward the centre
    static, specials = [], []

    def wall_x(name, u0, u1, y0, y1, z0, z1, m, bev=0.008):
        return gbx(name, X(u0), X(u1), y0, y1, z0, z1, m, bev)

    # the floor: terrazzo, a cream stone threshold at the opening, a round floor drain
    static.append(wall_x("Floor", U_IN + WT / 2, U_OUT - WT / 2, -0.02, 0.012, Z_BACK, Z_FRONT - 0.02, mm["floor"], 0.004))
    static.append(wall_x("Threshold", U_IN + WT / 2, U_OUT - WT / 2, 0.0, 0.016, Z_FRONT - 0.12, Z_FRONT + 0.06, mm["stone"], 0.006))
    dr = cyl("Drain", 0.11, 0.004, g(X(10.7), 0.012, -14.05), mm["grate"], 24)
    static.append(dr)
    for k in range(5):
        static.append(gbx(f"DrainSlot{k}", X(10.7) - 0.07, X(10.7) + 0.07, 0.0165, 0.0175, -14.05 - 0.06 + k * 0.03, -14.05 - 0.05 + k * 0.03, mm["vent"], 0))

    # the walls: the inner one with its door opening, the outer one, the back panel
    zin = [(Z_BACK, DOOR_Z0), (DOOR_Z1, Z_FRONT)]
    for k, (za, zb) in enumerate(zin):
        static.append(wall_x(f"InnerWall{k}", U_IN - WT / 2, U_IN + WT / 2, 0, WALL_H, za, zb, mm["cream"]))
    static.append(wall_x("InnerLintel", U_IN - WT / 2, U_IN + WT / 2, DOOR_H, WALL_H, DOOR_Z0, DOOR_Z1, mm["cream"]))
    static.append(wall_x("OuterWall", U_OUT - WT / 2, U_OUT + WT / 2, 0, WALL_H, Z_BACK, Z_FRONT, mm["cream"]))
    static.append(wall_x("BackPanel", U_IN + WT / 2, U_OUT - WT / 2, 0, WALL_H, Z_BACK, Z_BACK + 0.08, mm["cream"]))
    # the hall face of the inner wall dressed like the hall's walls: sea tiles, a navy band, a cream row, a timber rail
    uh = U_IN - WT / 2
    for k, (za, zb) in enumerate([(-16.3, DOOR_Z0 - 0.06), (DOOR_Z1 + 0.06, Z_FRONT)]):
        static.append(wall_x(f"HallTiles{k}", uh - 0.02, uh, 0.0, 1.6, za, zb, mm["sea"], 0.004))
        static.append(wall_x(f"HallBand{k}", uh - 0.045, uh, 1.6, 1.76, za, zb, mm["navy_t"], 0.004))
        static.append(wall_x(f"HallCream{k}", uh - 0.03, uh, 1.76, 1.92, za, zb, mm["cream"], 0.004))
        static.append(wall_x(f"HallCove{k}", uh - 0.04, uh, 0.0, 0.12, za, zb, mm["navy_t"], 0.004))
        static.append(wall_x(f"HallRail{k}", uh - 0.07, uh, 1.93, 2.01, za, zb, mm["timber"], 0.01))
    # the outer wall's outside face (toward the window wall's corner) the same, and its front end trimmed in navy
    uo = U_OUT + WT / 2
    static.append(wall_x("OuterTiles", uo, uo + 0.02, 0.0, 1.6, Z_BACK, Z_FRONT, mm["sea"], 0.004))
    static.append(wall_x("OuterBand", uo, uo + 0.045, 1.6, 1.76, Z_BACK, Z_FRONT, mm["navy_t"], 0.004))
    for k, u in enumerate((U_IN, U_OUT)):
        static.append(wall_x(f"EndTrim{k}", u - WT / 2 - 0.015, u + WT / 2 + 0.015, 0, WALL_H, Z_FRONT - 0.02, Z_FRONT + 0.02, mm["navy_t"], 0.012))
    # inside: a navy cove at the floor and a sea band above the lockers, round all three walls
    ui, uo_i = U_IN + WT / 2, U_OUT - WT / 2
    zb_in = Z_BACK + 0.08
    for k, (za, zb) in enumerate([(zb_in, DOOR_Z0 - 0.06), (DOOR_Z1 + 0.06, Z_FRONT)]):
        static.append(wall_x(f"InCove{k}", ui, ui + 0.03, 0, 0.12, za, zb, mm["navy_t"], 0.004))
        static.append(wall_x(f"InBand{k}", ui, ui + 0.018, 2.06, 2.2, za, zb, mm["sea"], 0.004))
    static.append(wall_x("OutCove", uo_i - 0.03, uo_i, 0, 0.12, zb_in, Z_FRONT, mm["navy_t"], 0.004))
    static.append(wall_x("OutBand", uo_i - 0.018, uo_i, 2.06, 2.2, zb_in, Z_FRONT, mm["sea"], 0.004))
    static.append(wall_x("BackBand", ui, uo_i, 2.06, 2.2, zb_in, zb_in + 0.018, mm["sea"], 0.004))
    # timber caps on every wall top, the back one reaching to the hall's wall so no gap shows from above
    static.append(wall_x("CapInner", U_IN - WT / 2 - 0.04, U_IN + WT / 2 + 0.04, WALL_H, WALL_H + 0.07, Z_BACK - 0.2, Z_FRONT + 0.04, mm["timber"], 0.02))
    static.append(wall_x("CapOuter", U_OUT - WT / 2 - 0.04, U_OUT + WT / 2 + 0.04, WALL_H, WALL_H + 0.07, Z_BACK - 0.2, Z_FRONT + 0.04, mm["timber"], 0.02))
    static.append(wall_x("CapBack", U_IN + WT / 2 + 0.04, U_OUT - WT / 2 - 0.04, WALL_H, WALL_H + 0.07, Z_BACK - 0.2, Z_BACK + 0.12, mm["timber"], 0.02))

    # the sign over the opening: a navy fascia, the word in cream, the club's figure either side in mustard
    static.append(wall_x("Fascia", U_IN + WT / 2, U_OUT - WT / 2, 2.28, WALL_H, Z_FRONT - 0.2, Z_FRONT + 0.0, mm["sign"], 0.015))
    static.append(wall_x("FasciaLine", U_IN + WT / 2 + 0.06, U_OUT - WT / 2 - 0.06, 2.3, 2.315, Z_FRONT - 0.0, Z_FRONT + 0.004, mm["sign_cream"], 0))
    static.append(wall_x("CapFascia", U_IN + WT / 2, U_OUT - WT / 2, WALL_H, WALL_H + 0.07, Z_FRONT - 0.24, Z_FRONT + 0.04, mm["timber"], 0.02))
    word = "WOMEN" if women else "MEN"
    static.append(flat_text("SignWord", word, 0.25, mm["sign_cream"], g(X(BENCH_U), 2.455, Z_FRONT + 0.004), 0, 0.012))
    for k, du in enumerate((-1.25, 1.25)):
        static.append(pictogram_3d(f"SignFigure{k}", "woman" if women else "man", 0.24, mm["mustard"], g(X(BENCH_U + du), 2.335, Z_FRONT + 0.012), 0, 0.01))

    # the door's frame (navy architraves on both faces, liners in the opening)
    for k, u in enumerate((U_IN - WT / 2, U_IN + WT / 2)):
        out = -1 if k == 0 else 1
        for j, z in enumerate((DOOR_Z0, DOOR_Z1)):
            static.append(wall_x(f"Architrave{k}{j}", u, u + out * 0.025, 0, DOOR_H + 0.07, z - 0.07 if j == 0 else z, z if j == 0 else z + 0.07, mm["sign"], 0.008))
        static.append(wall_x(f"ArchHead{k}", u, u + out * 0.025, DOOR_H, DOOR_H + 0.07, DOOR_Z0 - 0.07, DOOR_Z1 + 0.07, mm["sign"], 0.008))
    for j, (za, zb) in enumerate([(DOOR_Z0, DOOR_Z0 + 0.04), (DOOR_Z1 - 0.04, DOOR_Z1)]):
        static.append(wall_x(f"Liner{j}", U_IN - WT / 2, U_IN + WT / 2, 0, DOOR_H, za, zb, mm["sign"], 0.004))
    static.append(wall_x("LinerHead", U_IN - WT / 2, U_IN + WT / 2, DOOR_H - 0.04, DOOR_H, DOOR_Z0, DOOR_Z1, mm["sign"], 0.004))
    # a sign over the door, on the hall side
    plaque = [bx("Plaque", -0.3, 0.3, -0.025, 0, -0.09, 0.09, mm["sign"], 0.012)]
    plaque.append(flat_text("PlaqueWord", word, 0.11, mm["sign_cream"], (0.05, -0.027, 0), 0, 0.004, res=1))
    plaque.append(pictogram_3d("PlaqueFig", "woman" if women else "man", 0.13, mm["mustard"], (-0.2, -0.026, -0.065), 0, 0.006))
    static.append(grp(plaque, "DoorPlaque", g(X(U_IN - WT / 2), 2.38, (DOOR_Z0 + DOOR_Z1) / 2), FACE[face_hall]))

    # the door: a timber leaf in the hall-side half of the opening, hinged on its back edge, swinging out into the hall
    hu = U_IN - WT / 2 + 0.012  # the hinge line, just inside the hall face
    z0, z1 = DOOR_Z0 + 0.045, DOOR_Z1 - 0.045
    dp = []
    dp.append(wall_x("DoorLeaf", hu, hu + 0.045, 0.012, DOOR_H - 0.045, z0, z1, mm["door"], 0.01))
    for k in range(2):  # two raised panels each side
        ya, yb = (0.28, 1.0) if k == 0 else (1.12, 1.95)
        for j, (ua, ub) in enumerate(((hu - 0.008, hu), (hu + 0.045, hu + 0.053))):
            dp.append(wall_x(f"DoorPanel{k}{j}", ua, ub, ya, yb, z0 + 0.1, z1 - 0.1, mm["door"], 0.003))
    dp.append(wall_x("KickPlate", hu - 0.004, hu, 0.03, 0.22, z0 + 0.02, z1 - 0.02, mm["brass"], 0.002))
    dp.append(wall_x("PushPlate", hu - 0.004, hu, 1.0, 1.32, z1 - 0.16, z1 - 0.06, mm["brass"], 0.002))
    dp.append(wall_x("PullBar", hu + 0.045, hu + 0.09, 0.95, 1.25, z1 - 0.1, z1 - 0.07, mm["chrome"], 0.01))
    disc = cyl("DoorDisc", 0.12, 0.008, (0, 0, 0), mm["sign"], 32, rot=(PI / 2, 0, 0))
    fig = pictogram_3d("DoorFig", "woman" if women else "man", 0.17, mm["mustard"], (0, -0.008, -0.085), 0, 0.005)
    dp.append(grp([disc, fig], "DoorSign", g(X(hu - 0.004), 1.6, (z0 + z1) / 2), FACE[face_hall]))
    for k, y in enumerate((0.25, 1.05, 1.85)):
        dp.append(cyl(f"DoorHinge{k}", 0.012, 0.1, g(X(hu), y, z0 - 0.005), mm["brass"], 10))
    # a door closer at the top, on the room side
    dp.append(wall_x("Closer", hu + 0.045, hu + 0.1, 1.9, 1.98, z0 + 0.05, z0 + 0.3, mm["steel"], 0.01))
    door = join(dp, "Door")
    set_origin(door, g(X(hu), 0, z0))  # the hinge axis, vertical
    specials.append(door)
    arm = wall_x("CloserArm", hu + 0.06, hu + 0.07, 2.0, 2.02, z0 + 0.25, z0 + 0.5, mm["steel"], 0.004)
    static.append(arm)

    # ---- the lockers -------------------------------------------------------------------------------------------------------
    wristbands = [mat("band_coral", "#ef6a4c", 0.5), mat("band_yellow", "#f6cf45", 0.5), mat("band_blue", "#3d7fd1", 0.5), mat("band_green", "#62c48a", 0.5)]
    back_n, back_w = 12, 0.41
    back_specs, back_contents = {}, {}
    for k in range(back_n):
        sp = {}
        for i in range(2):
            roll = rng.random()
            if roll < 0.18:
                sp[i] = {"padlock": True}
            elif roll < 0.62:
                sp[i] = {"key": wristbands[rng.randrange(4)]}
            else:
                sp[i] = {}  # in use: its key is on someone's wrist
        back_specs[k] = sp
    # one door left open, a bag inside
    ajar_col, ajar_tier = (8, 1) if women else (3, 0)
    back_specs[ajar_col][ajar_tier] = {"ajar": 68}
    dh = (1.8 - 0.02) / 2
    zb = 0.012 + ajar_tier * dh
    if women:
        bag = tote("LockerTote", mat("tote_coral", "#e8604a", 0.85), mat("tote_strap", "#f3e6c9", 0.8), (0.0, 0.24, zb), 0.1, w=0.3, d=0.16, h=0.3)
        brush = bx("LockerBrush", -0.1, 0.06, 0.06, 0.1, zb, zb + 0.02, mat("brush_pink", "#ef7aa6", 0.5), 0.008)
        back_contents[ajar_col] = [bag, xf(brush, (0, 0, 0), 0.3)]
    else:
        bag = duffel("LockerDuffel", mat("duffel_navy", "#22324a", 0.8), mat("duffel_trim", "#ef6a4c", 0.7), 0.34, 0.12, (0, 0.24, zb), 0.0)
        tw = towel_hanging("LockerTowel", 0.24, 0.32, mat("towel_blue"), mat("towel_stripe"), (0.08, 0.02, zb + dh - 0.06), 0, 0.012)
        back_contents[ajar_col] = [bag, tw]
    if not women:  # No. 7 sticks
        back_specs[3][1] = {"note": tmat("lk_note_kick", 0.8), "note_size": (0.13, 0.13), "note_tilt": -0.08}
    back = locker_row("Back", back_n, back_w, 0.46, 1.8, 2, 0 if women else 3, mm, 1, back_specs, rng, back_contents)
    xf(back, g(X(BENCH_U), 0, Z_BACKWALL - 0.0), FACE["+z"])
    static.append(back)

    out_n, out_w = 3, 0.42
    out_specs = {k: {} for k in range(out_n)}
    for k in range(out_n):
        for i in range(3):
            roll = rng.random()
            out_specs[k][i] = {"padlock": True} if roll < 0.2 else ({"key": wristbands[rng.randrange(4)]} if roll < 0.7 else {})
    if women:  # the note the camera sees
        out_specs[1][1] = {"note": tmat("lk_note_out_of_order", 0.8), "note_size": (0.17, 0.212), "note_tilt": 0.07}
    outer = locker_row("Outer", out_n, out_w, 0.4, 1.8, 3, 2 if women else 1, mm, 25, out_specs, rng)
    oz = (Z_BACKWALL + 0.02) + out_n * out_w / 2
    # facing the room (toward the inner wall): its local +x runs toward +z for WOMEN, -z for MEN
    xf(outer, g(X(U_OUT - WT / 2 - 0.4), 0, oz), FACE[face_hall])
    static.append(outer)

    # ---- the bench: a tiled plinth and honey timber slats --------------------------------------------------------------------
    bu0, bu1 = BENCH_U - BENCH_HU, BENCH_U + BENCH_HU
    bz0, bz1 = BENCH_Z - BENCH_HZ, BENCH_Z + BENCH_HZ
    static.append(wall_x("BenchBase", bu0 + 0.06, bu1 - 0.06, 0, 0.36, bz0 + 0.06, bz1 - 0.06, mm["sea"], 0.012))
    static.append(wall_x("BenchCove", bu0 + 0.05, bu1 - 0.05, 0, 0.08, bz0 + 0.05, bz1 - 0.05, mm["navy_t"], 0.01))
    for k, du in enumerate((-1.3, 0.0, 1.3)):
        static.append(wall_x(f"BenchBearer{k}", BENCH_U + du - 0.04, BENCH_U + du + 0.04, 0.36, 0.4, bz0 + 0.02, bz1 - 0.02, mm["timber"], 0.006))
    n_sl = 6
    gap = 0.024
    sw = (bz1 - bz0 - gap * (n_sl - 1)) / n_sl
    for k in range(n_sl):
        za = bz0 + k * (sw + gap)
        static.append(wall_x(f"BenchSlat{k}", bu0, bu1, 0.4, 0.445, za, za + sw, mm["slat"], 0.007))

    # ---- coat hooks on the inner wall, a towel and a robe on them -------------------------------------------------------
    hook_parts = [bx("HookRail", -0.65, 0.65, -0.03, 0, -0.06, 0.06, mm["timber"], 0.012)]
    for k in range(5):
        hx = -0.52 + k * 0.26
        hook_parts.append(poly_tube(f"Hook{k}", [(hx, -0.03, 0.0), (hx, -0.09, 0.0), (hx, -0.1, 0.05)], 0.008, mm["chrome"], 8, 0.02))
        hook_parts.append(sphere(f"HookTip{k}", 0.012, (hx, -0.1, 0.055), mm["chrome"], 10, 6))
    hook_c = g(X(U_IN + WT / 2), 1.66, -15.55)
    static.append(grp(hook_parts, "Hooks", hook_c, FACE[face_in]))
    if women:
        static.append(robe("Robe", mat("robe_coral", "#ef8a74", 0.95), mat("towel_stripe"), (0, 0, 0), 0))
        static.append(towel_hanging("HookTowel", 0.36, 0.62, mat("towel_stripe"), mat("towel_coral"), (0, 0, 0), 0))
    else:
        static.append(robe("Robe", mat("robe_grey", "#9aa6ad", 0.95), mat("navy"), (0, 0, 0), 0))
        static.append(towel_hanging("HookTowel", 0.36, 0.62, mat("towel_blue"), mat("towel_stripe"), (0, 0, 0), 0))
    # hang them from hooks 1 and 3 (local x along the rail, a little in front of it)
    from mathutils import Euler
    for obj, k in ((static[-2], 1), (static[-1], 3)):
        tip = Vector((-0.52 + k * 0.26, -0.035, 0.03))
        tip.rotate(Euler((0, 0, FACE[face_in])))
        xf(obj, Vector(hook_c) + tip, FACE[face_in])

    # ---- the mirror, its shelf and a hair dryer on the outer wall's open end -----------------------------------------
    mz = -14.27
    mir = [bx("MirrorFrame", -0.3, 0.3, -0.035, 0, -0.4, 0.4, mm["sign"] if women else mm["timber"], 0.012)]
    mir.append(bx("MirrorGlass", -0.26, 0.26, -0.04, -0.03, -0.36, 0.36, mm["mirror"], 0.004))
    mir.append(bx("Shelf", -0.3, 0.3, -0.14, 0, -0.47, -0.44, mat("shelf_glass", "#d7eef2", 0.05, 0.0), 0.006))
    for sx in (-1, 1):
        mir.append(bx(f"ShelfBracket{sx}", sx * 0.24 - 0.01, sx * 0.24 + 0.01, -0.12, 0, -0.5, -0.47, mm["chrome"], 0.003))
    mir.append(bx("VanityLight", -0.22, 0.22, -0.07, 0, 0.44, 0.5, mm["chrome"], 0.01))
    mir.append(bx("VanityLens", -0.2, 0.2, -0.075, -0.06, 0.445, 0.495, mm["lamp"], 0.004))
    shelf_top = -0.44
    if women:
        mir.append(bottle("Shampoo", mat("shampoo_pink", "#ef7aa6", 0.3), mm["plate"], 0.18, 0.03, (-0.18, -0.07, shelf_top)))
        mir.append(pot_plant("ShelfSucculent", "succulent", mat("pot_cream", "#f3e6c9", 0.45), (0.15, -0.07, shelf_top), 0, 1.0, 3))
        mir.append(xf(bx("ShelfBrush", -0.08, 0.06, -0.015, 0.015, 0, 0.02, mat("brush_mustard", "#f2b33d", 0.5), 0.008), (-0.03, -0.08, shelf_top)))
    else:
        mir.append(bottle("Deodorant", mat("deo_navy", "#1d3557", 0.25), mm["chrome"], 0.16, 0.025, (-0.18, -0.07, shelf_top)))
        duck = [sphere("DuckBody", 0.04, (0, 0, 0.035), mm["mustard"], 14, 8, (1.3, 1, 0.85)), sphere("DuckHead", 0.025, (0.035, 0, 0.08), mm["mustard"], 12, 8), cyl("DuckBeak", 0.012, 0.025, (0.055, 0, 0.078), mat("coral"), 8, rot=(0, PI / 2, 0))]
        mir.append(grp(duck, "RubberDuck", (0.12, -0.07, shelf_top), -0.6))
        mir.append(xf(bx("Comb", -0.07, 0.07, -0.004, 0.004, 0, 0.025, mat("black"), 0.002), (-0.02, -0.07, shelf_top)))
    static.append(grp(mir, "Mirror", g(X(U_OUT - WT / 2), 1.5, mz), FACE[face_hall]))
    # the hair dryer: a wall bracket, the dryer in its cradle, a coiled cord
    hd = [bx("DryerBracket", -0.06, 0.06, -0.04, 0, -0.1, 0.1, mm["plate"], 0.01)]
    hd.append(cyl("DryerBody", 0.045, 0.19, (0, -0.1, 0.02), mat("dryer_mustard", "#f2b33d", 0.3) if women else mm["chrome"], 18, bev=0.01, rot=(PI / 2, 0, 0)))
    hd.append(cyl("DryerNozzle", 0.03, 0.06, (0, -0.06, -0.05), mat("charcoal"), 14, rot=(0.2, 0, 0)))
    hd.append(cyl("DryerGrip", 0.02, 0.14, (0, -0.08, -0.14), mat("charcoal"), 12))
    coil = [(0.022 * math.cos(k * 1.3), -0.06 + 0.022 * math.sin(k * 1.3), -0.16 - k * 0.014) for k in range(22)]
    hd.append(poly_tube("DryerCord", coil, 0.004, mat("black"), 6, 0.004))
    hd.append(bx("DryerSwitch", -0.025, 0.025, -0.05, -0.04, 0.03, 0.07, mm["sign"], 0.005))
    dz = -13.86
    static.append(grp(hd, "HairDryer", g(X(U_OUT - WT / 2), 1.42, dz), FACE[face_hall]))
    # bathroom scales on the floor under the mirror
    sc = [bx("ScaleBase", -0.15, 0.15, -0.17, 0.17, 0, 0.055, mat("scale_cream", "#efe6d2", 0.35), 0.02, 3)]
    sc.append(bx("ScaleMat", -0.13, 0.13, -0.08, 0.15, 0.055, 0.062, mat("rubber"), 0.004))
    sc.append(cyl("ScaleDialRim", 0.058, 0.01, (0, -0.115, 0.054), mm["chrome"], 24))
    sc.append(plane("ScaleDialFace", 0.1, 0.1, (0, -0.115, 0.0645), tmat("lk_scale_dial", 0.3), (0, 0, 0)))
    static.append(grp(sc, "Scales", g(X(12.88), 0, -14.3), FACE[face_hall] + (0.25 if women else -0.3)))

    # ---- things left behind ----------------------------------------------------------------------------------------------
    bench_top = 0.445
    if women:
        static.append(towel_folded("BenchTowels", 0.36, 0.26, 0.09, mat("towel_coral"), mat("towel_stripe"), g(X(9.65), bench_top, -15.2), 0.1))
        static.append(towel_folded("BenchTowel2", 0.34, 0.24, 0.05, mat("towel_stripe"), None, g(X(9.66), bench_top + 0.09, -15.2), 0.25))
        static.append(goggles("BenchGoggles", mat("lens_pink", "#ef7aa6", 0.1), mat("strap_navy", "#1d3557", 0.5), g(X(11.0), bench_top + 0.006, -15.05), 0.7))
        cap = sphere("SwimCap", 0.1, (0, 0, 0), mat("cap_mustard", "#f2b33d", 0.35), 18, 10, (1, 1.15, 0.55))
        for v in cap.data.vertices:
            v.co.z = max(v.co.z, 0)
        static.append(xf(cap, g(X(11.45), bench_top, -15.3), 0.4))
        static.append(bottle("BenchBottle", mat("bottle_sea", "#2f8c88", 0.25), mm["chrome"], 0.24, 0.036, g(X(12.0), bench_top, -15.1), 0))
        static.append(flip_flop("FlipFlop", mat("flipflop_pink", "#ef7aa6", 0.6), mat("coral"), g(X(12.15), 0.012, -14.25), 2.2))
        # on top of the back lockers: a stack of clean towels and a kid's swim ring
        top = 0.14 + 1.8 + 0.012
        for k, (mt, h) in enumerate([(mat("towel_blue"), 0.07), (mat("towel_stripe"), 0.07), (mat("towel_coral"), 0.07)]):
            static.append(towel_folded(f"TopTowel{k}", 0.34, 0.3, h, mt, None, g(X(12.55), top + k * 0.07, -16.15), 0.05 * (k - 1)))
        ring = torus("SwimRing", 0.17, 0.065, g(X(11.5), top + 0.065, -16.12), mat("coral_gloss"), 32, 12)
        static.append(ring)
        for k in range(4):
            a = k * PI / 2 + 0.4
            static.append(cyl(f"RingStripe{k}", 0.068, 0.05, g(X(11.5) + math.cos(a) * 0.17, top + 0.065, -16.12 - math.sin(a) * 0.17), mat("white_gloss"), 16, rot=(PI / 2, 0, -a + PI / 2)))
    else:
        static.append(towel_rolled("BenchTowel", 0.07, 0.42, mat("towel_blue"), mat("towel_stripe"), g(X(9.7), bench_top, -15.25), 0.1))
        static.append(sock("BenchSock", mat("sock_white", "#efece4", 0.95), g(X(10.6), bench_top + 0.002, -15.0), 1.1, mat("sock_band", "#3d7fd1", 0.9)))
        static.append(sock("FloorSock", mat("sock_white"), g(X(9.0), 0.014, -14.3), -0.6, mat("sock_band")))
        static.append(goggles("BenchGoggles", mat("lens_smoke", "#4a5560", 0.1), mat("strap_black", "#1b1c1f", 0.5), g(X(11.4), bench_top + 0.006, -15.3), -0.4))
        static.append(flip_flop("FlipFlop", mat("flipflop_blue", "#3d7fd1", 0.6), mat("navy"), g(X(11.8), 0.012, -14.4), -1.1, 0.29))
        static.append(bottle("BenchBottle", mat("bottle_red", "#d6423a", 0.25), mat("black"), 0.24, 0.036, g(X(11.9), bench_top, -15.0), 0, lying=True))
        top = 0.14 + 1.8 + 0.012
        static.append(kickboard("TopKickboard", mat("foam_yellow"), loc=g(X(9.4), top, -16.15), rz=0.3, grip=mat("foam_blue")))
        static.append(bx("TopBox", -0.22, 0.22, -0.17, 0.17, 0, 0.26, mat("cardboard", "#b48a5a", 0.85), 0.008))
        xf(static[-1], g(X(12.4), top, -16.15), 0.08)
        static.append(xf(bx("TopBoxFlap", -0.22, 0.22, -0.006, 0.006, 0, 0.16, mat("cardboard"), 0.004), g(X(12.4), top + 0.26, -16.15 + 0.17), 0.08, rx=-0.5))
        static.append(duffel("TopBag", mat("duffel_red", "#c8322b", 0.8), mat("black"), 0.42, 0.11, g(X(11.6), top, -16.12), 0.05))

    # a duckboard (slatted timber mat) by the bench, the way out
    db = []
    for k in range(7):
        db.append(bx(f"DuckSlat{k}", -0.5, 0.5, -0.33 + k * 0.11 - 0.04, -0.33 + k * 0.11 + 0.04, 0.012, 0.03, mm["slat"], 0.006))
    for sx in (-0.4, 0.0, 0.4):
        db.append(bx(f"DuckRunner{sx}", sx - 0.02, sx + 0.02, -0.37, 0.37, 0.0, 0.014, mm["timber"], 0.004))
    static.append(grp(db, "Duckboard", g(X(10.3), 0, -14.42), 0))

    # signs: please shower (hall side, by the door), lockers 20p (above the back lockers)
    ss = framed("ShowerSign", 0.5, 0.25, tmat("lk_sign_shower", 0.4), mm["sign"], (0, 0, 0), 0, 0.015, 0.012, False)
    static.append(grp(ss, "ShowerSignJ", g(X(U_IN - WT / 2 - 0.045), 1.3, -15.65), FACE[face_hall]))
    vs = framed("LockerSign", 0.42, 0.158, tmat("lk_sign_valuables", 0.4), mm["sign"], (0, 0, 0), 0, 0.012, 0.01, False)
    static.append(grp(vs, "LockerSignJ", g(X(9.1), 2.3, Z_BACK + 0.08), FACE["+z"]))

    # the wall light: a bulkhead with a cage, its lens glowing (Godot adds a warm light at it)
    bh = [cyl("BulkBase", 0.12, 0.04, (0, 0, 0), mm["sign"], 24, bev=0.01, rot=(PI / 2, 0, 0))]
    bh.append(torus("BulkCage", 0.095, 0.006, (0, -0.06, 0), mm["sign"], 20, 6, rot=(PI / 2, 0, 0)))
    for k in range(4):
        a = k * PI / 4
        bar = bx(f"BulkBar{k}", -0.005, 0.005, -0.075, -0.035, -0.1, 0.1, mm["sign"], 0.002)
        bh.append(xf(bar, (0, 0, 0), ry=a))
    bulk = grp(bh, "Bulkhead", g(X(BENCH_U + 0.4), 2.35, Z_BACK + 0.08), FACE["+z"])
    static.append(bulk)
    lens = sphere("Light_Bulkhead", 0.08, (0, 0, 0), mm["lamp"], 18, 10, (1, 0.45, 0.75))
    xf(lens, g(X(BENCH_U + 0.4), 2.35, Z_BACK + 0.08 + 0.04))
    specials.append(lens)

    big = sorted(((tris([o]), o.name) for o in static if o), reverse=True)[:12]
    print("TRIS", tris([o for o in static if o]), big)
    body = join([o for o in static if o], f"LockerBay{tag}Body")
    root = parent_all([body] + specials, f"LockerBay{tag}")
    if PREVIEW:
        c = g(X(10.7), 0.9, -15.0)
        n = f"locker_bay_{tag.lower()}"
        preview(n + "_a", c, 8.0, 40, -50, (640, 480), 12)
        preview(n + "_b", c, 8.0, 40, 50, (640, 480), 12)
        preview(n + "_c", g(X(12.4), 1.0, -14.9), 3.0, 18, -60 * s, (640, 480), 12)
    export(os.path.join(PROPS, f"locker_bay_{tag.lower()}.glb"), [root])


if __name__ == "__main__":
    ensure_textures(["lk_note_out_of_order", "lk_note_kick", "lk_sign_shower", "lk_sign_valuables", "lk_scale_dial"])
    which = [a for a in ARGS if a in ("men", "women")] or ["women", "men"]
    for w in which:
        bay(+1 if w == "women" else -1)
