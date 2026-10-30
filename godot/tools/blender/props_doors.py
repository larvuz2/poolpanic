"""The changing rooms' doors, flush in the -Z wall where the locker rooms stood (the creator, 30 October 2026: "remove the
lockers and place the doors on the same axis as the wall"): MEN at x -10.7, WOMEN at x +10.7, modelled in place in game
coordinates, so each is placed at the origin with no turn (godot/data/placements/doors.json).

Each is a painted door in a white frame on the tiled wall, a dark doorway behind it, a sign over it with its figure, a bulkhead
lamp (`Light_Bulkhead`) and a stone threshold; beside it, toward the corner, a slatted bench with a towel and a swim bag and a
rail of coat hooks with a robe and a towel; on the other side a rinse shower, its drain and a PLEASE SHOWER sign.

`Door` is the leaf, its origin on the hinge at the doorway's outer edge (toward the corner), the leaf reaching toward the hall's
centre: it swings out onto the deck as a guest comes or goes (three.js: `world.lockerDoors`, rotation.y = side × angle; Godot:
club_scene.gd, the same sign).

    blender -b -P godot/tools/blender/props_doors.py [-- men|women ...] [--preview]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *
from props_kit import *

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS

U = 10.7  # the doorway's centre, from the hall's centre line (spatial.mjs CLUB.doors.doorX)
WALL = -16.7  # the wall's face (z)
HALF, H = 0.6, 2.3  # half the opening's width, its height
REVEAL = 0.09  # how far the doorway's lining stands out of the wall (over the dado rail)


def door(side):
    tag = "Men" if side < 0 else "Women"
    X = lambda u: side * u  # noqa: E731
    frame = mat("door_frame", "#f4f1ea", 0.22)
    dark = mat("doorway_dark", "#13262c", 0.92)
    leaf_m = mat("door_navy", "#24456e", 0.32) if side < 0 else mat("door_coral", "#ef6a4c", 0.32)
    brass, steel, chrome = mat("brass"), mat("steel_brushed"), mat("chrome")
    frosted = mat("porthole_frosted", "#d8ebee", 0.18)
    sign = mat("sign_navy", "#1d3557", 0.3)
    cream = mat("sign_cream", "#f3e6c9", 0.4)
    slat = mat("bench_slat", "#d39a5e", 0.5)
    stone = mat("threshold_stone", "#efe2c4", 0.5)
    lamp = mat("lamp_lens", "#fff1d6", 0.2, emit="#fff1d6", emit_strength=6.0)
    static, specials = [], []

    # ---- the doorway: a dark opening lined in white, a stone threshold -------------------------------------------------------
    x0, x1 = X(U - HALF), X(U + HALF)
    static.append(gbx("Opening", x0, x1, 0, H, WALL, WALL + REVEAL - 0.02, dark, 0.004))
    for k, (a, b, y0, y1) in enumerate(
        [(U - HALF - 0.12, U - HALF, 0, H + 0.12), (U + HALF, U + HALF + 0.12, 0, H + 0.12), (U - HALF, U + HALF, H, H + 0.12)]
    ):
        static.append(gbx(f"Architrave{k}", X(a), X(b), y0, y1, WALL, WALL + REVEAL + 0.02, frame, 0.012))
    static.append(gbx("Threshold", x0 - side * 0.04, x1 + side * 0.04, 0, 0.018, WALL, WALL + 0.3, stone, 0.006))

    # ---- the leaf: painted, a frosted porthole in a brass ring, a push plate, a kick plate, its hinge on the outer edge -------
    lw, lt = 2 * HALF - 0.04, 0.05
    z0 = WALL + REVEAL - 0.05
    hinge_u = U + HALF - 0.01
    parts = [gbx("Leaf", X(hinge_u), X(hinge_u - lw), 0.02, H - 0.03, z0, z0 + lt, leaf_m, 0.012)]
    cx = X(hinge_u - lw / 2)
    parts.append(cyl("Porthole", 0.17, 0.012, g(cx, 1.62, z0 + lt + 0.004), frosted, 28, rot=(PI / 2, 0, 0)))
    parts.append(torus("PortholeRing", 0.18, 0.018, g(cx, 1.62, z0 + lt + 0.01), brass, 32, 8, rot=(PI / 2, 0, 0)))
    parts.append(gbx("KickPlate", X(hinge_u - 0.06), X(hinge_u - lw + 0.06), 0.06, 0.3, z0 + lt, z0 + lt + 0.006, steel, 0.003))
    hu = hinge_u - lw + 0.14  # the handle's side
    parts.append(gbx("PushPlate", X(hu - 0.05), X(hu + 0.05), 0.95, 1.3, z0 + lt, z0 + lt + 0.008, brass, 0.004))
    for k, y in enumerate((0.3, 1.1, 1.95)):
        parts.append(cyl(f"Hinge{k}", 0.018, 0.12, g(X(hinge_u + 0.005), y, z0 + lt / 2), brass, 12))
    leaf = join(parts, "Door")
    set_origin(leaf, g(X(hinge_u), 0, z0 + lt / 2))
    specials.append(leaf)

    # ---- the sign over it: MEN or WOMEN in cream on navy, with its figure, and the bulkhead lamp above ------------------------
    sy = H + 0.38
    static.append(gbx("SignBoard", X(U - 0.62), X(U + 0.62), sy - 0.17, sy + 0.17, WALL, WALL + 0.04, sign, 0.012))
    static.append(gbx("SignEdge", X(U - 0.65), X(U + 0.65), sy - 0.2, sy + 0.2, WALL, WALL + 0.025, brass, 0.01))
    word = "MEN" if side < 0 else "WOMEN"
    static.append(flat_text("SignWord", word, 0.22, cream, g(U * side + 0.12, sy - 0.005, WALL + 0.046), 0, 0.006, "BarlowCondensed-Black"))
    static.append(pictogram_3d("SignFigure", "man" if side < 0 else "woman", 0.26, cream, g(U * side - 0.42, sy - 0.13, WALL + 0.046)))
    by = sy + 0.42
    bh = [cyl("BulkBase", 0.12, 0.04, (0, 0, 0), sign, 24, bev=0.01, rot=(PI / 2, 0, 0))]
    bh.append(torus("BulkCage", 0.095, 0.006, (0, -0.06, 0), sign, 20, 6, rot=(PI / 2, 0, 0)))
    for k in range(4):
        bh.append(xf(bx(f"BulkBar{k}", -0.005, 0.005, -0.075, -0.035, -0.1, 0.1, sign, 0.002), (0, 0, 0), ry=k * PI / 4))
    static.append(grp(bh, "Bulkhead", g(X(U), by, WALL + 0.02), FACE["+z"]))
    lens = sphere("Light_Bulkhead", 0.08, (0, 0, 0), lamp, 18, 10, (1, 0.45, 0.75))
    xf(lens, g(X(U), by, WALL + 0.06))
    specials.append(lens)

    # ---- toward the corner: a slatted bench, a towel and a bag on it; coat hooks above with a robe and a towel -------------------
    bu, bw, seat = 12.85, 1.7, 0.45
    for k in range(4):
        z = WALL + 0.08 + k * 0.09
        static.append(gbx(f"Slat{k}", X(bu - bw / 2), X(bu + bw / 2), seat - 0.035, seat, z, z + 0.075, slat, 0.008))
    for du in (-bw / 2 + 0.15, bw / 2 - 0.15):
        static.append(gbx(f"BenchLeg{du:.2f}", X(bu + du - 0.03), X(bu + du + 0.03), 0, seat - 0.035, WALL + 0.06, WALL + 0.42, steel, 0.008))
    static.append(towel_folded("BenchTowel", 0.36, 0.26, 0.06, mat("towel_blue") if side < 0 else mat("towel_coral"), mat("towel_stripe"), g(X(bu - 0.45), seat, WALL + 0.24), 0.1 * side))
    static.append(duffel("BenchBag", mat("duffel_red", "#c8322b", 0.8) if side < 0 else mat("duffel_sea", "#2f8c88", 0.8), mat("black"), 0.46, 0.12, g(X(bu + 0.35), seat, WALL + 0.25), 0.04))
    static.append(flip_flop("FlipFlopL", mat("flipflop_pink", "#ef7aa6", 0.6) if side > 0 else mat("flipflop_blue", "#3d7fd1", 0.6), mat("navy"), g(X(bu + 0.1), 0.012, WALL + 0.62), 1.4))
    static.append(flip_flop("FlipFlopR", mat("flipflop_pink") if side > 0 else mat("flipflop_blue"), mat("navy"), g(X(bu + 0.3), 0.012, WALL + 0.6), 1.65))
    ry = 1.78
    static.append(gbx("HookRail", X(bu - bw / 2), X(bu + bw / 2), ry - 0.05, ry + 0.05, WALL, WALL + 0.03, mat("timber"), 0.008))
    hooks = [bu - 0.6, bu - 0.2, bu + 0.2, bu + 0.6]
    for k, hu_ in enumerate(hooks):
        static.append(tube(f"Hook{k}", [g(X(hu_), ry, WALL + 0.03), g(X(hu_), ry, WALL + 0.09), g(X(hu_), ry + 0.05, WALL + 0.11)], 0.008, brass, 4, 8))
    robe_m = mat("robe_white", "#f3efe6", 0.95) if side < 0 else mat("robe_peach", "#f2b48f", 0.95)
    static.append(robe("Robe", robe_m, mat("towel_stripe"), g(X(hooks[1]), ry + 0.02, WALL + 0.1), 0))
    static.append(towel_hanging("HookTowel", 0.36, 0.62, mat("towel_stripe"), mat("towel_blue") if side < 0 else mat("towel_coral"), g(X(hooks[3]), ry + 0.02, WALL + 0.1), 0))

    # ---- toward the hall: a rinse shower on the wall, its drain, and the sign ---------------------------------------------------
    su = 9.35
    static.append(tube("ShowerPipe", [g(X(su), 0.25, WALL + 0.04), g(X(su), 2.12, WALL + 0.04), g(X(su), 2.2, WALL + 0.16)], 0.016, chrome, 4, 10))
    static.append(cyl("ShowerHead", 0.075, 0.035, g(X(su), 2.18, WALL + 0.2), chrome, 20, bev=0.01, rot=(PI / 2 - 0.5, 0, 0)))
    static.append(cyl("ShowerValve", 0.04, 0.05, g(X(su), 1.15, WALL + 0.05), chrome, 16, bev=0.01, rot=(PI / 2, 0, 0)))
    static.append(gbx("ShowerLever", X(su - 0.01), X(su + 0.01), 1.13, 1.17, WALL + 0.07, WALL + 0.16, chrome, 0.004))
    for k in range(5):
        static.append(gbx(f"DrainBar{k}", X(su - 0.17), X(su + 0.17), 0.002, 0.008, WALL + 0.12 + k * 0.07, WALL + 0.15 + k * 0.07, steel, 0.002))
    ss = framed("ShowerSign", 0.5, 0.25, tmat("lk_sign_shower", 0.4), sign, (0, 0, 0), 0, 0.015, 0.012, False)
    static.append(grp(ss, "ShowerSignJ", g(X(8.75), 1.45, WALL), FACE["+z"]))

    print("TRIS", tris([o for o in static if o]) + tris(specials))
    body = join([o for o in static if o], f"ChangingDoor{tag}Body")
    root = parent_all([body] + specials, f"ChangingDoor{tag}")
    if PREVIEW:
        preview(f"changing_door_{tag.lower()}", g(X(U + 0.8), 1.3, WALL + 0.5), 5.0, 18, 0, (800, 520), 16)
    export(os.path.join(PROPS, f"changing_door_{tag.lower()}.glb"), [root])


if __name__ == "__main__":
    ensure_textures(["lk_sign_shower"])
    which = [a for a in ARGS if a in ("men", "women")] or ["men", "women"]
    for w_ in which:
        reset()
        door(-1 if w_ == "men" else 1)
