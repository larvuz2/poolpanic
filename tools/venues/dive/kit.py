"""Shared ground for the Jumping Pool's Blender scripts (the diving pool of the Splashworth Country Club, dressed for the three.js
game, 1 November 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
pool's plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/spatial.mjs and
dist/dive-plan.mjs into the work folder: build_all.sh runs it first): the deep pool and its ladders, the six boards and their
stairs and lines, the stations' blocks, the hot tub, the massage beds, the gates, the queue, the evacuation spots, every station
and fixture.

The Splashworth Country Club on a bright summer's day: a deep diving pool in a cobalt glass mosaic with a band of Mediterranean
majolica at its waterline, white marble coping, a travertine deck, the diving stations in white concrete with their heights in
green, yellow and red, clipped box hedges with white gates and rose arches, the lawns, and the clubhouse beyond (lime-washed
render, terracotta roof, a colonnade, green-and-cream awnings). The camera looks from the near side (-x, the hot tub and the
massage corner) across the pool to the far side (+x) and the clubhouse past it; the boards stand at both ends (±z). Where the
guests walk and wait (the queues by the gates, the evacuation row, the stations' lines, the walks round the pool) stays flat and
clear: the props stand in the furniture's own boxes, against the hedges and beyond them. Its materials are photographic, made
once on fal and made seamless here (dive_textures.py).
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: white concrete and marble, the heights' green, yellow and red, racing green and cream, terracotta, brass -------
DIVE_PALETTE = {
    "white": ("#f6f4ee", 0.45, 0.0),
    "cream": ("#f6efdf", 0.7, 0.0),
    "ivory": ("#efe6d2", 0.6, 0.0),
    "navy": ("#23415e", 0.5, 0.0),
    "racing": ("#2f6b4a", 0.55, 0.0),
    "green": ("#46b553", 0.45, 0.0),
    "yellow": ("#f1c232", 0.45, 0.0),
    "red": ("#e2453c", 0.42, 0.0),
    "coral": ("#ff7a5c", 0.5, 0.0),
    "pink": ("#ef6f9a", 0.45, 0.0),
    "sky": ("#6fc3ea", 0.45, 0.0),
    "teal": ("#2e9c9a", 0.45, 0.0),
    "terracotta": ("#c8664a", 0.85, 0.0),
    "black": ("#17181a", 0.55, 0.0),
    "ink": ("#1d1f24", 0.55, 0.0),
    "grey": ("#8d969c", 0.6, 0.0),
    "grey_dark": ("#4a5258", 0.6, 0.2),
    "nonslip": ("#9aa39f", 0.95, 0.0),
    "brass": ("#c8a24f", 0.28, 1.0),
    "gold": ("#e0b648", 0.25, 0.9),
    "chrome": ("#d9e1e6", 0.16, 1.0),
    "steel": ("#9aa5ad", 0.35, 0.8),
    "teak": ("#a8714a", 0.6, 0.0),
    "teak_dark": ("#7c5234", 0.6, 0.0),
    "rope": ("#d2b98a", 0.95, 0.0),
    "towel": ("#fbfbf7", 0.95, 0.0),
    "rubber": ("#2b2d2f", 0.85, 0.0),
    "glass": ("#d9f0f4", 0.05, 0.0),
    "window": ("#9ccbe0", 0.1, 0.3),
    "leaf": ("#3f8a3c", 0.6, 0.0),
    "leaf_dark": ("#2a5a2c", 0.6, 0.0),
    "rose": ("#e53958", 0.6, 0.0),
    "soil": ("#3a2a1c", 0.95, 0.0),
    "bark": ("#6b4a32", 0.9, 0.0),
    "lime": ("#9bd34a", 0.5, 0.0),
    "lemon": ("#ffe066", 0.5, 0.0),
    "lilac": ("#a993d8", 0.5, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "travertine": 3.6,  # the deck: ivory travertine pavers (fal, the Rooftop Pool's)
    "mosaic": 1.6,  # the pool: cobalt glass mosaic (fal)
    "majolica": 0.3,  # the pool's waterline band: one hand-painted majolica tile a repeat (fal)
    "marble": 2.4,  # the coping, the tub's rim, the tables: Calacatta (fal, the Rooftop Pool's)
    "concrete": 4.0,  # the diving stations: white board-formed concrete (fal, the Rooftop Pool's)
    "teak": 2.6,  # the tub's cabinet, the treads, the benches (fal, the Rooftop Pool's)
    "lawn": 6.0,  # the lawns with their mowing stripes (fal)
    "hedge": 1.6,  # the clipped box hedges (fal)
    "stucco": 3.0,  # the clubhouse: lime-washed render (fal)
    "rooftile": 2.4,  # the clubhouse's roof: terracotta tiles (fal)
    "awning": 1.6,  # the awnings, the parasols: racing green and cream stripes (fal)
    "linen": 1.2,  # the cushions, the towels (fal, the Rooftop Pool's)
}

NAME = "dive"  # dist/assets/dive-club/dive.glb
OUT = os.path.join(REPO, "dist", "assets", "dive-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, DIVE_PALETTE, TILES)
COACH_PARTS = []
SHARP_TILES = ["travertine", "mosaic", "majolica", "lawn", "hedge", "concrete"]
PAINT = {"size": 2048, "x0": -11.0, "z0": -17.2, "span": 34.4}
ATLAS_SIZE = {"emblem": 1024, "halloffame": 768, "poster": 640, "founder": 640}
CUT_ATLAS = 2048
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
D = PLAN["dive"]
HX, HZ, DEPTH = D["halfX"], D["halfZ"], D["depth"]  # the basin: ±HX across, ±HZ long, its floor DEPTH down
GATE_X = D["gateX"]
HEIGHTS = PLAN["heights"]
BOARDS = PLAN["boards"]
DSTATIONS = PLAN["stations"]  # the diving stations' blocks
LADDERS = PLAN["ladders"]
TUB = PLAN["tub"]
MASSAGE_BEDS = PLAN["massageBeds"]
BLOCKS = PLAN["blocks"]
WATER_Y, GROUND_Y = PLAN["lines"]["water"], PLAN["lines"]["ground"]
DECK = PLAN["deck"]
ROOM = PLAN["room"]
DOORS = PLAN["doors"]
QUEUE = PLAN["queue"]
EVAC = PLAN["evacSpots"]
FURNITURE = PLAN["furniture"]
OBSTACLES = PLAN["obstacles"]
STATIONS = PLAN["venueStations"]
FIXTURES = PLAN["fixtures"]
RING_MOUNTS = PLAN["ringMounts"]
SANITATION = PLAN["sanitation"]
RESCUE = PLAN["rescue"]
MARKER = [h["color"] for h in HEIGHTS]  # the heights' colours: LOW green, MID yellow, HIGH red
HEDGE_T = 0.8  # the hedges' thickness, along the room's edges
HEDGE_H = 1.25
CLUB = {"x0": ROOM["maxX"] + 5.5, "depth": 9.0, "width": 30.0, "height": 7.5}  # the clubhouse beyond the far hedge


def furniture(kind):
    return [f for f in FURNITURE if f["kind"] == kind]


def in_pool(x, z, pad=0.0):
    return abs(x) < HX + pad and abs(z) < HZ + pad


def blocked(x, z, pad=0.0):
    """Inside one of the walkers' blocks (the pool, the stations, the tub, the furniture)."""
    return any(b[0] - pad < x < b[1] + pad and b[2] - pad < z < b[3] + pad for b in BLOCKS)


# ---- the scripts' shared helpers (game coordinates) ----------------------------------------------------------------------------
def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    """A box by its extents in game coordinates."""
    return gbx(name, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def face(name, w, h, x, y, z, theta, m):
    """A plane w × h centred at (x, y, z) facing the game's (sin θ, cos θ)."""
    return plane(name, w, h, g(x, y, z), m, rot=(PI / 2, 0, theta))


def flat(name, w, d, x, y, z, m, turn=0.0):
    """A plane lying flat at height y: `w` along x, `d` along z (before `turn`)."""
    return plane(name, w, d, g(x, y, z), m, rot=(0, 0, turn))


def anchor(name, x, y, z):
    return sphere("Anchor_" + name, 0.05, g(x, y, z), sm("white"), 6, 4)


def prism(name, pts, z0, z1, m):
    """A prism: the polygon `pts` [(x, y), ...] in the game's x-y plane (counter-clockwise), from z0 to z1."""
    me = bpy.data.meshes.new(name)
    n = len(pts)
    verts = [g(x, y, z0) for x, y in pts] + [g(x, y, z1) for x, y in pts]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    # (outward normals whatever the winding)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return o


def yawed(objs, x, z, yaw, name, y=0.0):
    """Join pieces modelled round the origin (their front to local +z), turn them by `yaw` and set them at (x, y, z). (Joining
    keeps the first piece's origin: it is baked away first, so the turn and the move are about the true origin.)"""
    o = join([q for q in objs if q], name)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (0, 0, yaw)
    o.location = g(x, y, z)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


TO_MX, TO_PX, TO_MZ, TO_PZ = -PI / 2, PI / 2, PI, 0.0
_ASPECT = {}


def card(name, cut, h, x, y, z, theta, rough=0.7):
    """A cut-out standing on (x, y, z), `h` tall, facing the game's (sin θ, cos θ)."""
    if cut not in _ASPECT:
        img = bpy.data.images.load(os.path.join(TEX, cut + "_alpha.png"))
        _ASPECT[cut] = img.size[0] / img.size[1]
        bpy.data.images.remove(img)
    w = h * _ASPECT[cut]
    return plane(name, w, h, g(x, y + h / 2, z), cutmat(cut, rough), rot=(PI / 2, 0, theta))
