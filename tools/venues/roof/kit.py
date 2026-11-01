"""Shared ground for the Rooftop Pool's Blender scripts (the Sky Pool of Hotel Vertigo, 185 m up, dressed for the three.js game,
1 November 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
roof's plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/spatial.mjs and
dist/roof-plan.mjs into the work folder: build_all.sh runs it first): the basin, the knife edge and the gutter, the rows of sunbeds
and the cabanas, the lounge, the Sky Bar, the DJ, the lifts, the roof's lines, the queue, the evacuation spots, every station and
fixture.

The Sky Pool of Hotel Vertigo at golden hour: a five-star roof (honey teak, ivory travertine, an emerald glass-mosaic infinity pool
with a black granite knife edge, dark bronze lift cores, cream linen and rattan, Calacatta marble, teal zellige), and a lot of
nonsense at its edges (the pigeons, the window cleaner's cradle, the net that catches the phones, the coin binoculars). The camera
looks from the near side (-x) across the pool to the infinity edge (+x) and the city past it; the bar is at the left end (-z), the
DJ at the right (+z), a lift core at each end. Where the guests walk and wait (the queues by the lifts, the evacuation rows, the
aisles, the walks round the pool) stays flat and clear: the props stand in the furniture's own boxes, along the rails, beyond the
roof's edge and on the lift cores. Its materials are photographic, made once on fal and made seamless here (roof_textures.py).
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: cream and ivory, bronze and brass, black granite, the pool's emerald, sunset coral, the DJ's neon -----------
ROOF_PALETTE = {
    "white": ("#f4f2ec", 0.45, 0.0),
    "ivory": ("#efe6d2", 0.6, 0.0),
    "cream": ("#f3ead8", 0.8, 0.0),
    "black": ("#141416", 0.5, 0.0),
    "ink": ("#1d1f24", 0.55, 0.0),
    "charcoal": ("#2e3034", 0.6, 0.1),
    "bronze": ("#8a6a45", 0.35, 0.85),
    "brass": ("#c8a24f", 0.28, 1.0),
    "gold": ("#e0b648", 0.25, 0.9),
    "chrome": ("#d9e1e6", 0.16, 1.0),
    "steel": ("#9aa5ad", 0.35, 0.8),
    "teal": ("#1f5a5c", 0.4, 0.0),
    "emerald": ("#0f5a4c", 0.35, 0.0),
    "coral": ("#ff7a5c", 0.5, 0.0),
    "pink": ("#ef6f9a", 0.45, 0.0),
    "magenta": ("#ff3fb4", 0.4, 0.0),
    "cyan": ("#3fd8ff", 0.4, 0.0),
    "red": ("#c8202e", 0.42, 0.0),
    "yellow": ("#ffd23f", 0.45, 0.0),
    "orange": ("#ff8a2a", 0.45, 0.0),
    "green": ("#2a9d48", 0.5, 0.0),
    "velvet": ("#7a1626", 0.9, 0.0),
    "teak": ("#b07a48", 0.55, 0.0),
    "teak_dark": ("#6e4a2a", 0.6, 0.0),
    "rope": ("#d2b98a", 0.95, 0.0),
    "towel": ("#fbfbf7", 0.95, 0.0),
    "rubber": ("#2b2d2f", 0.85, 0.0),
    "glass": ("#d9f0f4", 0.05, 0.0),
    "ice": ("#d8f3ff", 0.08, 0.0),
    "leaf": ("#3f8a3c", 0.6, 0.0),
    "leaf_dark": ("#2a5a2c", 0.6, 0.0),
    "terracotta": ("#c06a3c", 0.85, 0.0),
    "lime": ("#9bd34a", 0.5, 0.0),
    "grey": ("#8d969c", 0.6, 0.0),
    "grey_dark": ("#4a5258", 0.6, 0.2),
    "safety": ("#ffb21f", 0.5, 0.0),
    "blue": ("#2f6fd0", 0.45, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "teak": 2.6,  # the deck: honey teak boards with open joints (fal)
    "travertine": 4.8,  # the surround, the coping, the lobbies: ivory travertine pavers, four slabs across (fal)
    "mosaic": 1.6,  # the pool: emerald glass mosaic with gold flecks (fal)
    "granite": 2.0,  # the knife edge, the gutter, the fire table, the bar's foot: black granite (fal)
    "marble": 2.4,  # the bar's top, the side tables, the DJ booth's top: Calacatta gold (fal)
    "bronze": 1.6,  # the lift cores' cladding: dark brushed bronze fins (fal)
    "linen": 1.2,  # the cushions, the cabanas' curtains, the parasols: cream linen (fal)
    "rattan": 0.8,  # the sofas, the lanterns, the baskets: woven rattan (fal)
    "concrete": 4.0,  # the slab's edges, the planters, the plant room: white architectural concrete (fal)
    "zellige": 1.2,  # the bar's front, the stations, the DJ riser's face: teal zellige tiles (fal)
}

NAME = "roof"  # dist/assets/roof-club/roof.glb
OUT = os.path.join(REPO, "dist", "assets", "roof-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, ROOF_PALETTE, TILES)
COACH_PARTS = []
SHARP_TILES = ["teak", "travertine", "mosaic", "bronze", "zellige", "marble"]
PAINT = {"size": 2048, "x0": -15.6, "z0": -17.4, "span": 34.8}
ATLAS_SIZE = {"emblem": 1024, "poster": 640, "gig": 640, "employee": 512, "shame": 768}
CUT_ATLAS = 2048
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
ROOF = PLAN["roof"]
L = PLAN["lines"]
HX, HZ = ROOF["halfX"], ROOF["halfZ"]  # the basin: near wall at -HX, the knife edge at +HX; its ends at ±HZ
GUTTER = ROOF["gutter"]  # the catch gutter past the knife edge: x0..x1
RAIL = ROOF["rail"]  # the far glass rail
BED = ROOF["bed"]
BEDS = PLAN["beds"]
CABANA = ROOF["cabana"]
LOUNGE = ROOF["lounge"]
BAR = ROOF["bar"]
DJ = ROOF["dj"]
LIFT = ROOF["lift"]
BLOCKS = PLAN["blocks"]
DECK = PLAN["deck"]
ROOM = PLAN["room"]
DOORS = PLAN["doors"]
QUEUE = PLAN["queue"]
EVAC = PLAN["evacSpots"]
FURNITURE = PLAN["furniture"]
OBSTACLES = PLAN["obstacles"]
STATIONS = PLAN["stations"]
FIXTURES = PLAN["fixtures"]
RING_MOUNTS = PLAN["ringMounts"]
SANITATION = PLAN["sanitation"]
RESCUE = PLAN["rescue"]
WATER_Y, FLOOR_Y, BENCH_Y = L["water"], L["floor"], L["bench"]
GUTTER_WATER, GUTTER_FLOOR = L["gutterWater"], L["gutterFloor"]
SLAB = L["slab"]  # the roof slab's underside
EDGE = L["edge"]  # the roof's outline: x0..x1, ±z
TOWER = L["tower"]  # the tower under it (the rest is cantilevered over the street)
SURROUND = {"x0": -5.45, "x1": GUTTER["x1"], "z": HZ + 0.35 + 1.25}  # the travertine round the pool
LOBBY = {"x0": -9.2, "x1": -3.2, "z": 13.4}  # the travertine lobbies before the lifts (|z| > 13.4)
CORE = {"x0": LIFT["x"] - 2.3, "x1": LIFT["x"] + 2.3}  # the lift cores, |z| from the door to the roof's end


def furniture(kind):
    return [f for f in FURNITURE if f["kind"] == kind]


def in_pool(x, z, pad=0.0):
    return -HX - pad < x < GUTTER["x1"] + pad and abs(z) < HZ + pad


def blocked(x, z, pad=0.0):
    """Inside one of the walkers' blocks (the pool, the beds, the cabanas, the lounge, the bar, the DJ)."""
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
