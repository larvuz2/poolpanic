"""The Aqua Disco's entrance doors, modelled in place in game coordinates: a pair of padded leather doors in the back wall's grand
entrance (no locker rooms: the creator, 16 October 2026), buttoned in violet velvet under chrome studs, each with a round porthole
whose glass glows cyan, a gold push plate and a tall chrome handle. The leaves are the game's to swing: `Door_A` (side -1) and
`Door_B` (side +1), each its origin on its hinge at the opening's outer edge (x -+1.26), reaching to the middle; the game turns it
about y by side * 1.35 * (how open), so it swings out onto the deck (scene.mjs `lockerDoors`).

    blender -b -P tools/venues/disco/props_doors.py [-- --look]
"""

import os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
FZ = FACE_Z
HALF, H = DOOR["half"], DOOR["height"]
velvet = tmat_tile("quilt", "#5a1a5e", 0.85, tint="#4a1a5a")
chrome = sm("chrome")
gold = sm("gold")
ink = sm("ink")
glass = sm("porthole_glow", "#7ff0ff", 0.2)


def leaf(side):
    X = lambda u: side * u  # noqa: E731  (u: distance from the middle)
    hinge_u = HALF - 0.02
    lw, lt = HALF - 0.05, 0.08
    z0 = FZ + 0.015
    p = [gbx("Leaf", min(X(hinge_u), X(hinge_u - lw)), max(X(hinge_u), X(hinge_u - lw)), 0.03, H - 0.03, z0, z0 + lt, ink, 0.02)]
    # the padded face: buttoned velvet in a chrome frame
    a, b = X(hinge_u - 0.08), X(hinge_u - lw + 0.08)
    p.append(gbx("Pad", min(a, b), max(a, b), 0.12, H - 0.12, z0 + lt, z0 + lt + 0.05, velvet, 0.03))
    for (u0, u1, y0, y1) in [(hinge_u - 0.06, hinge_u - lw + 0.06, 0.08, 0.12), (hinge_u - 0.06, hinge_u - lw + 0.06, H - 0.12, H - 0.08), (hinge_u - 0.06, hinge_u - 0.1, 0.08, H - 0.08), (hinge_u - lw + 0.1, hinge_u - lw + 0.06, 0.08, H - 0.08)]:
        a, b = X(u0), X(u1)
        p.append(gbx("PadFrame", min(a, b), max(a, b), y0, y1, z0 + lt, z0 + lt + 0.06, chrome, 0.005))
    # the porthole: a chrome ring round glowing glass
    cu = hinge_u - lw / 2
    p.append(torus("Porthole", 0.24, 0.035, g(X(cu), 1.78, z0 + lt + 0.07), chrome, 24, 6, rot=(PI / 2, 0, 0)))
    pane = cyl("NightGlow_Porthole", 0.22, 0.01, g(X(cu), 1.78, z0 + lt + 0.06), glass, 20, rot=(PI / 2, 0, 0))
    pane.name = "NightGlow_Porthole"
    p.append(pane)
    # a gold push plate and a tall chrome handle near the meeting edge
    hu = hinge_u - lw + 0.16
    p.append(gbx("PushPlate", min(X(hu - 0.07), X(hu + 0.07)), max(X(hu - 0.07), X(hu + 0.07)), 1.0, 1.4, z0 + lt + 0.05, z0 + lt + 0.06, gold, 0.004))
    p.append(cyl("Handle", 0.022, 0.9, g(X(hu), 0.75, z0 + lt + 0.13), chrome, 10))
    for y in (0.8, 1.6):
        p.append(gbx("HandlePost", min(X(hu - 0.02), X(hu + 0.02)), max(X(hu - 0.02), X(hu + 0.02)), y - 0.02, y + 0.02, z0 + lt + 0.05, z0 + lt + 0.13, chrome, 0))
    # chrome studs down the hinge side
    for k in range(8):
        y = 0.3 + k * 0.28
        p.append(sphere("Stud", 0.018, g(X(hinge_u - 0.04), y, z0 + lt + 0.03), chrome, 6, 4))
    o = join(p, "Door_A" if side < 0 else "Door_B")
    set_origin(o, g(X(hinge_u), 0, z0 + lt / 2))
    print(f"DOOR {o.name}: {tris([o])} triangles, hinge at {tuple(round(v, 3) for v in (o.location.x, o.location.z, -o.location.y))}")
    return o


objs = [leaf(-1), leaf(1)]
if LOOK:
    ctx = [gbx("PreviewWall", -6, 6, 0, 5, FZ - 0.4, FZ, sm("violet"), 0), gbx("PreviewDeck", -6, 6, -0.05, 0, FZ, -10, sm("black_gloss"), 0)]
    look("doors", g(0, 1.4, -15.0), 5.5, 12, 0, (960, 640), 20, 32)
    bpy.data.objects["Door_B"].rotation_euler[2] = 1.35 * 0.7
    look("doors_open", g(0, 1.4, -15.0), 5.5, 28, -30, (960, 640), 20, 32)
    bpy.data.objects["Door_B"].rotation_euler[2] = 0
    for o in ctx:
        bpy.data.objects.remove(o)
save_part("doors", objs)
