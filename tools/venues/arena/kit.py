"""Shared ground for the Grand Gala Arena's Blender scripts (the season finale, dressed for the three.js game, 2 November 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
arena's plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/spatial.mjs into the work
folder: build_all.sh runs it first): Splash Park's floor plan (RESORT_SPEC: the five lanes, the trampoline, the stations) on a
tabletop 1.95 m over the hall's floor, the changing rooms' doors in the stage's wall (WALL_DOORS since 2 November 2026).

THE POOL PANIC AWARDS, the season's last night, in a grand old domed arena: a terrazzo deck with brass strips, the pool in navy
and gold glass mosaic with an art deco band at its waterline, black marble coping; the stage's wall behind the deck in walnut, gold
leaf and red velvet round the game's screens and marquee, the trophy on its plinth above them before a gold sunburst; grandstands
in navy and gold with red velvet seats where the crowd sits in its evening clothes, theatre carpet on the hall's floor, damask walls
with gilded pilasters and opera boxes. The camera looks from the near side (-x) across the pool to the far stand (+x); the stage's
wall is the back (-z), the end stand the open end (+z). Where the guests walk and wait (the queue, the doors' paths, the walks
round the pool) stays flat and clear: the props stand in the furniture's own boxes, against the walls and off the platform. Its
materials are photographic, made once on fal and made seamless here (arena_textures.py).

COACH_PARTS (merged as C_<class>, shown only in the Coach Cam): the roof (its coffered vault, chandeliers) and the near side's hall
(its wall and grandstand).
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: navy and gold, crimson velvet, ivory, black marble, brass --------------------------------------------------------
GALA = {
    "navy": ("#141d36", 0.45, 0.0),
    "midnight": ("#0d1428", 0.5, 0.0),
    "royal": ("#2b3f73", 0.4, 0.0),
    "crimson": ("#a3233a", 0.42, 0.0),
    "burgundy": ("#6e1426", 0.5, 0.0),
    "ivory": ("#f3ead6", 0.45, 0.0),
    "cream": ("#f6ecd6", 0.7, 0.0),
    "champagne": ("#e9d6a8", 0.4, 0.0),
    "gold": ("#d9ae4a", 0.25, 1.0),
    "gold_paint": ("#d9ae4a", 0.4, 0.0),
    "brass": ("#c99a42", 0.3, 1.0),
    "black": ("#141418", 0.4, 0.0),
    "ink": ("#1d1f24", 0.55, 0.0),
    "emerald": ("#1f6a4f", 0.45, 0.0),
    "pink": ("#e86d9a", 0.45, 0.0),
    "lilac": ("#a993d8", 0.5, 0.0),
    "steel": ("#9aa5ad", 0.35, 0.8),
    "chrome": ("#d9e1e6", 0.16, 1.0),
    "silver": ("#cfd5dc", 0.25, 1.0),
    "glass": ("#d9f0f4", 0.05, 0.0),
    "crystal": ("#eef6ff", 0.05, 0.0),
    "ice": ("#cfe9f6", 0.08, 0.0),
    "rubber": ("#2a2a2e", 0.85, 0.0),
    "charcoal": ("#2b2d33", 0.6, 0.0),
    "leaf": ("#3f7a3c", 0.6, 0.0),
    "leaf_dark": ("#24502a", 0.6, 0.0),
    "rose": ("#c8203a", 0.55, 0.0),
    "lily": ("#fbf7ee", 0.6, 0.0),
    "rope": ("#d2b98a", 0.95, 0.0),
    "duck": ("#ffd23a", 0.35, 0.0),
    "beak": ("#ff8a2a", 0.35, 0.0),
    # (the names Splash Park's stations use, in the gala's colours: props_stations.py)
    "teal": ("#2b3f73", 0.4, 0.0),
    "teal_dark": ("#1b2a4a", 0.45, 0.0),
    "coral": ("#a3233a", 0.42, 0.0),
    "coral_gloss": ("#a3233a", 0.2, 0.0),
    "sun": ("#d9ae4a", 0.35, 0.0),
    "sun_gloss": ("#e2bb5a", 0.2, 0.0),
    "canvas": ("#f6ecd6", 0.85, 0.0),
    "whitewash": ("#f3ead6", 0.45, 0.0),
    "white_gloss": ("#f7f2e6", 0.18, 0.0),
    "stainless": ("#dfe4e7", 0.18, 1.0),
    "iron": ("#1f2230", 0.5, 0.6),
    "teak": ("#7a4a2c", 0.45, 0.0),
    "teak_dark": ("#4e2f1c", 0.45, 0.0),
    "towel_white": ("#f7f3ea", 0.95, 0.0),
    "towel_teal": ("#3a4f86", 0.95, 0.0),
    "towel_coral": ("#b8384c", 0.95, 0.0),
    "towel_sun": ("#e6c46a", 0.95, 0.0),
    "towel_stripe": ("#f2e2c4", 0.95, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "terrazzo": 2.4,  # the deck: ivory terrazzo, brass strips in 80 cm squares (fal)
    "mosaic": 1.6,  # the pool: navy and royal blue glass mosaic with gold smalti (fal)
    "decoband": 0.3,  # the pool's waterline band: one art deco sunburst tile a repeat (fal)
    "nero": 2.4,  # the coping, the plinths, the stage's step: black marble (fal)
    "marble": 2.4,  # the bar, the trophy's plinth: Calacatta (fal, the Rooftop Pool's)
    "velvet": 1.4,  # the drapes, the seats, the ropes, the chaises: crimson velvet (fal)
    "carpet": 3.0,  # the hall's floor: navy theatre carpet with gold fans (fal)
    "goldleaf": 1.8,  # the stage's sunburst, the pilasters, the boxes' fronts: gold leaf (fal)
    "walnut": 2.0,  # the stage's wall, the doors, the bar: French-polished walnut (fal)
    "damask": 2.4,  # the hall's walls: midnight silk damask (fal)
    "concrete": 4.0,  # the stands' tiers (fal, the Rooftop Pool's), tinted navy
    "linen": 1.2,  # the tablecloths, the towels (fal, the Rooftop Pool's)
}

NAME = "arena"  # dist/assets/arena-club/arena.glb
OUT = os.path.join(REPO, "dist", "assets", "arena-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, GALA, TILES)
COACH_PARTS = ["ceiling"]
SHARP_TILES = ["terrazzo", "mosaic", "decoband", "velvet", "carpet", "goldleaf", "walnut"]
PAINT = {"size": 2048, "x0": -16.6, "z0": -17.2, "span": 34.4}
ATLAS_SIZE = {"emblem": 1024, "poster": 640, "nominees": 1024, "redcarpet": 768, "flamingo": 512}
CUT_ATLAS = 2048
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
_r, _d = PLAN["room"], PLAN["deck"]
ROOM = dict(x0=_r["minX"], x1=_r["maxX"], z0=_r["minZ"], z1=_r["maxZ"])
DECK = dict(x0=_d["minX"], x1=_d["maxX"], z0=_d["minZ"], z1=_d["maxZ"])
HX, HZ = PLAN["pool"]["halfX"], PLAN["pool"]["halfZ"]
LANES = [-6.4, -3.2, 0.0, 3.2, 6.4]
WATER_Y = -0.25
FLOOR_Y = -1.42
HALL_Y = -1.95  # the hall's floor round the tabletop (scene/arena.mjs FLOOR)
HALL = dict(x0=-26.5, x1=27.3, z0=-16.15, z1=24.5)  # (scene/arena.mjs ARENA_HALL)
EAVE, RIDGE = 15.0, 28.0
FACE_Z = -16.13  # the stage's wall's face (the doors in it)
DOORS_X = PLAN["doors"]["doorX"]
_s = PLAN["venueStations"]
STATIONS = {k: (_s[k]["x"], _s[k]["z"]) for k in ("fins", "chlorine", "relief")}
SANITATION = {k: (PLAN["sanitation"][k]["x"], PLAN["sanitation"][k]["z"]) for k in ("rack", "bin")}
RING_MOUNTS = [(m["x"], m["z"], m["angle"]) for m in PLAN["ringMounts"]]
_f = PLAN["fixtures"]
FIXTURES = dict(
    fishNet=(_f["fishNet"]["x"], _f["fishNet"]["z"], _f["fishNet"]["angle"]),
    treats=(_f["treats"]["x"], _f["treats"]["z"]),
    flashlight=(_f["flashlight"]["x"], _f["flashlight"]["z"]),
    fuseBox=(_f["fuseBox"]["x"], _f["fuseBox"]["z"], _f["fuseBox"]["angle"]),
    medkit=(_f["medkit"]["x"], _f["medkit"]["z"]),
)
MOP = (_f["mop"]["x"], _f["mop"]["z"])  # the game's mop bucket: kept clear
MASSAGE = (_f["massage"]["x"], _f["massage"]["z"])  # the game's massage table (along x): kept clear
TRAMPOLINE = PLAN["trampoline"]
FURN = PLAN["furniture"]


def furniture(kind):
    return [(f["x"], f["z"]) for f in FURN if f["kind"] == kind]


RESCUE_BENCH, BENCH_2 = furniture("bench")
LIFEGUARD = furniture("lifeguard-tower")[0]
KIOSK = furniture("kiosk")[0]  # the champagne bar (it keeps the dog treats)
DECK_PALMS = furniture("palm")  # the floral urns and the ice swan
LOUNGERS = furniture("lounger")  # the VIP chaises
UMBRELLA = furniture("umbrella")[0]  # a champagne bucket on its stand
QUEUE = PLAN["queue"]
# the game's screens, marquee and drapes on the stage's wall (scene/arena.mjs stage: SIDE_SCREENS, DRAPES), the trophy above
CX = 0.4
SCREEN = dict(x=CX, y=3.55, w=8.4, h=3.28)
SIDE_SCREENS = [CX - 6.9, CX + 6.9]  # (2.4 by 3.6, y 3.55)
DRAPES = [CX - 13.8, CX + 13.4]  # (3.4 wide, from y 5.5 down)
TROPHY = dict(x=CX, y=5.9, z=-17.0)  # the trophy's plinth's top (arenaclub.mjs TROPHY_AT)
STAND = dict(tiers=8, depth=1.15, rise=0.55)  # (scene/arena.mjs STAND: the crowd sits on these)
STANDS = [
    dict(axis="x", dir=1, front=17.7, a0=-13.6, a1=22.4, coach=False),
    dict(axis="z", dir=1, front=14.6, a0=-14.4, a1=16.4, coach=False),
    dict(axis="x", dir=-1, front=-16.9, a0=-13.6, a1=22.4, coach=True),
]
BOX_Y0 = 4.6  # the opera boxes' floor on the far walls, over the top rows' heads (shell.py, props_gala.py: the royal box)
CANNONS = [(-15.2, -14.4), (16.0, -14.4), (-15.2, 12.0), (16.0, 12.0)]  # (the classic's confetti cannons' spots)


# ---- the scripts' shared helpers (game coordinates) ----------------------------------------------------------------------------
def xbox(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
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


def prism(name, pts, z0, z1, m):
    """A prism: the polygon `pts` [(x, y), ...] in the game's x-y plane, from z0 to z1."""
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
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return o


def yawed(objs, x, z, yaw, name, y=0.0):
    """Join pieces modelled round the origin (their front to local +z), turn them by `yaw` and set them at (x, y, z)."""
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
