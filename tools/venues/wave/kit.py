"""Shared ground for the Wave Pool's Blender scripts (the surf park dressed for the three.js game, 1 November 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
surf park's plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/waves.mjs, dist/scene/
wave.mjs and dist/spatial.mjs WAVE into the work folder: build_all.sh runs it first), so the basin, the beach's slope, the five wave
chambers, the gate, the waiting rows, the towels, every station and fixture are where the game has them.

A 1960s surf park in the late-afternoon sun: the camera looks across the beach (-x, the near side) and the pool to the wave house
(+x), a streamline-moderne surf temple; the gate is in the left end's wall (-z), the Surf Shack and the eye care at the right end
(+z). Where the guests walk and wait (the ends' decks, the sand, the queue inside the gate) stays flat and clear: the props stand
in the furniture's own boxes, against the walls, on the wave house's terrace and outside.

The game's moving parts are placed by the model: an object named `Anchor_<Name>` is left out and its centre recorded (the
exporter: info.anchors[<Name>]): the chambers' surges, the LED board, the beacons, the flags, the roof sign's bulbs, the tubes.
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: cream stucco, coral, turquoise, sunshine, navy, teak; chrome and glazed tile -------------------------------------
WAVE_PALETTE = {
    "cream": ("#fff1d8", 0.8, 0.0),
    "stucco": ("#f7efe0", 0.88, 0.0),
    "coral": ("#e2574a", 0.55, 0.0),
    "coral_dark": ("#b8413a", 0.6, 0.0),
    "teal": ("#1f9aa0", 0.45, 0.0),
    "teal_dark": ("#16707a", 0.5, 0.0),
    "seafoam": ("#8fd8c8", 0.5, 0.0),
    "sun": ("#ffc93c", 0.45, 0.0),
    "navy": ("#174958", 0.5, 0.0),
    "navy_dark": ("#0e2e38", 0.55, 0.0),
    "teak": ("#b57a43", 0.55, 0.0),
    "teak_dark": ("#7d4f2a", 0.6, 0.0),
    "driftwood": ("#a99b86", 0.85, 0.0),
    "chrome": ("#dfe6ea", 0.18, 1.0),
    "steel": ("#7f8b92", 0.4, 0.9),
    "iron": ("#2b3238", 0.55, 0.7),
    "rust": ("#9a5a36", 0.8, 0.2),
    "brass": ("#c9a24a", 0.35, 1.0),
    "white": ("#f6f6f2", 0.45, 0.0),
    "black": ("#17191c", 0.5, 0.0),
    "red": ("#d43a2f", 0.4, 0.0),
    "orange": ("#f47742", 0.45, 0.0),
    "pink": ("#ef6f9a", 0.5, 0.0),
    "lilac": ("#a993d8", 0.5, 0.0),
    "lime": ("#9bd34a", 0.5, 0.0),
    "sky": ("#6fc3ea", 0.45, 0.0),
    "glass": ("#cfeef5", 0.05, 0.0),
    "rubber": ("#262a2e", 0.8, 0.0),
    "canvas": ("#efe4cc", 0.9, 0.0),
    "rope": ("#d8c49a", 0.95, 0.0),
    "sand": ("#e8cf9c", 0.95, 0.0),
    "terracotta": ("#c8693f", 0.75, 0.0),
    "concrete": ("#c9c3b8", 0.9, 0.0),
    "leaf": ("#3f8a4a", 0.6, 0.0),
    "leaf_dark": ("#2a6a3c", 0.6, 0.0),
    "hibiscus": ("#e8344a", 0.6, 0.0),
    "plastic_y": ("#ffd23f", 0.35, 0.0),
    "plastic_b": ("#2f8fe0", 0.35, 0.0),
    "plastic_g": ("#3cc98a", 0.35, 0.0),
    "towel": ("#f7f3ea", 0.95, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "pavers": 2.4,  # the deck: sun-bleached coquina pavers in a running bond, shells in the stone
    "malibu": 0.6,  # glazed Malibu tile: borders, the chambers' arches, the bands on the wave house
    "sand": 2.2,  # the beach, rippled
    "glass_mosaic": 1.0,  # the pool: aqua glass mosaic
    "mosaic_band": 1.0,  # the waterline's band
    "stucco": 2.5,  # the wave house and the walls
    "teak": 1.2,  # boards, benches
    "boardwalk": 1.8,  # the boardwalk between the beach and the deck
    "thatch": 1.2,  # the tube hut's and the surf shack's roofs
}

NAME = "wave"  # dist/assets/wave-club/wave.glb
OUT = os.path.join(REPO, "dist", "assets", "wave-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, WAVE_PALETTE, TILES)
COACH_PARTS = []
SHARP_TILES = ["malibu", "pavers", "sand", "glass_mosaic"]
PAINT = {"size": 2048, "x0": -15.6, "z0": -17.0, "span": 31.2}
ATLAS_SIZE = {"mural": 2048, "octopus": 1024, "roof_sign": 1024, "breeze": 512}
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
WAVE = PLAN["wave"]
HALF_X, HALF_Z, WATER_Y = WAVE["halfX"], WAVE["halfZ"], WAVE["water"]
CHAMBERS = PLAN["chambers"]
CHAMBER_W = PLAN["chamberWidth"]
SAND_EDGE = PLAN["sandEdge"]
PROFILE = PLAN["profile"]  # [x, floor y] from the sand's edge to the wave house
DECK = PLAN["deck"]
ROOM = PLAN["room"]
DOORS = PLAN["doors"]
QUEUE = PLAN["queue"]
TOWELS = PLAN["towels"]
EVAC = PLAN["evacSpots"]
FURNITURE = PLAN["furniture"]
STATIONS = PLAN["stations"]
FIXTURES = PLAN["fixtures"]
RING_MOUNTS = PLAN["ringMounts"]
SANITATION = PLAN["sanitation"]
RESCUE = PLAN["rescue"]
TUBE_COUNT = PLAN["tubes"]

# ---- the wave house (the model's; nothing in the game reads these but the anchors) ----------------------------------------------
FRONT = HALF_X + 0.3  # its wall over the water (scene/wave.mjs FAR)
BACK = 14.9
HOUSE_HZ = 10.4  # the front wall's half length (the furniture box: x 7.5..14.6, |z| < 10.6)
ARCH_SPRING = 0.55  # the chambers' arches: the springing line, radius half the chamber
TERRACE_Y = 3.15  # the terrace's floor
UPPER_X = 9.4  # the upper storey's face, set back behind the terrace
UPPER_Y = 9.0  # its roof
UPPER_HZ = 9.0  # its half length; its ends are rounded
TURRET = (8.55, 9.75)  # the lighthouse turrets on the terrace's corners (x, |z|)
LED = {"x": FRONT - 0.085, "y": 2.43, "w": 3.4, "h": 0.64}  # the LED board over the middle chamber (face)
MURAL = {"x": UPPER_X - 0.012, "y0": 3.75, "w": 11.4, "h": 4.9}
SIGN = {"x": 10.3, "y0": 9.75, "w": 10.4, "h": 2.3}  # the roof sign's board (face at x)

GATE_HALF = DOORS["doorX"] * 2 + 0.02  # (scene/wave.mjs: the gate's opening, either side of x 0)
GATE_Z = ROOM["minZ"] + 0.05
WALL_H = 1.25  # the end walls (breeze block)
NEAR_WALL_H = 0.55  # the near side's low wall (the overview's camera looks over it)


def furniture(kind):
    return [f for f in FURNITURE if f["kind"] == kind]


def floor_at(x):
    """The floor's height at x (dist/waves.mjs floorAt): 0 up on the deck, the sand going down into the pool."""
    if x <= -HALF_X:
        return min(0.0, WATER_Y + ((-HALF_X - x) / (-HALF_X - WAVE["sandTop"])) * -WATER_Y)
    return WATER_Y - depth_at(x)


def depth_at(x):
    if x <= -HALF_X:
        return 0.0
    if x <= WAVE["shelf"]:
        return ((x + HALF_X) / (WAVE["shelf"] + HALF_X)) * WAVE["shelfDepth"]
    return WAVE["shelfDepth"] + ((x - WAVE["shelf"]) / (HALF_X - WAVE["shelf"])) * (WAVE["deep"] - WAVE["shelfDepth"])


def in_walk(x, z, r=0.0):
    """Whether a prop of radius `r` at (x, z) would stand where the guests or the coach walk or wait: the decks at both ends (the
    routes round the pool), the queue inside the gate, the sand (the bathers' towels and the evacuation rows), the walk in from the
    gate. The near strip's furniture, the walls' margins, the terrace and outside are free."""
    d = DECK
    if not (d["minX"] - r < x < d["maxX"] + r and d["minZ"] - r < z < d["maxZ"] + r):
        return False
    # (the wave house's footprint)
    if x > FRONT - 0.05 and abs(z) < 10.6:
        return False
    for q in QUEUE:
        if math.hypot(x - q["x"], z - q["z"]) < 0.7 + r:
            return True
    for e in EVAC:
        if math.hypot(x - e["x"], z - e["z"]) < 0.55 + r:
            return True
    for t in TOWELS:
        if abs(x - t["x"]) < 0.5 + r and abs(z - t["z"]) < 0.85 + r:
            return True
    return True  # (everywhere else on the deck is someone's walk: props go in the furniture's boxes and the margins)


def in_box(x, z, f, pad=0.0):
    return abs(x - f["x"]) <= f.get("hx", 0.3) + pad and abs(z - f["z"]) <= f.get("hz", 0.3) + pad
