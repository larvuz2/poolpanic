"""Shared ground for the Lazy River's Blender scripts (the jungle water park dressed for the three.js game, 1 November 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
river's plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/river.mjs and dist/spatial.mjs
into the work folder: build_all.sh runs it first): the river's centreline sampled every 0.25 m with its flow and normal, its banks,
the bridge, the stepping stones, the docks and the tube return, the gate, the queue, the evacuation spots, every station and fixture.

The Lost Temple of the Lazy River: an ancient temple courtyard of sandstone the jungle has taken back, the river wandering through
it out of a cave behind a waterfall (the back wall, -z, the left of the screen) and into the temple of the Lazy Idol, a giant stone
head yawning over the river's way out (the end, +z, the right). The camera looks across from the near side (-x) to the far bank
and the jungle (+x). Where the guests walk and wait (the deck, the queue by the jungle gate, the evacuation rows, the docks, the
bridge, a band along both banks for the coach's rescues) stays flat and clear: the props stand in the furniture's own boxes,
against the walls, and outside. Its textures are photographic, made once on fal and made seamless here (river_textures.py).
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: sandstone and temple stone, old timber, bamboo, rope, brass and iron, canvas; jungle greens and parrot colours --
RIVER_PALETTE = {
    "sandstone": ("#cfa774", 0.85, 0.0),
    "stone": ("#9a9a84", 0.88, 0.0),
    "stone_dark": ("#6d6c5c", 0.9, 0.0),
    "moss": ("#4f7a2e", 0.95, 0.0),
    "moss_light": ("#7da23e", 0.95, 0.0),
    "timber": ("#8a5a33", 0.75, 0.0),
    "timber_dark": ("#5a3a20", 0.8, 0.0),
    "bamboo": ("#cfae62", 0.6, 0.0),
    "bamboo_dark": ("#9c7a3c", 0.65, 0.0),
    "rope": ("#c9ac74", 0.95, 0.0),
    "thatch_dry": ("#c99a52", 0.95, 0.0),
    "canvas": ("#d9c9a2", 0.9, 0.0),
    "canvas_green": ("#6f7a4a", 0.9, 0.0),
    "khaki": ("#b8a06a", 0.85, 0.0),
    "brass": ("#c9a24a", 0.35, 1.0),
    "iron": ("#2e2c28", 0.6, 0.6),
    "rust": ("#8a4a2a", 0.85, 0.2),
    "red": ("#c8372d", 0.5, 0.0),
    "orange": ("#f07a2a", 0.5, 0.0),
    "yellow": ("#ffd23f", 0.5, 0.0),
    "teal": ("#1f9aa0", 0.5, 0.0),
    "jungle": ("#2f6b3c", 0.6, 0.0),
    "cream": ("#f3e6c4", 0.8, 0.0),
    "white": ("#f6f2e8", 0.5, 0.0),
    "black": ("#17181a", 0.6, 0.0),
    "glass": ("#cfe8e4", 0.08, 0.0),
    "leaf": ("#3f8a3c", 0.6, 0.0),
    "leaf_dark": ("#2a5a2c", 0.6, 0.0),
    "coconut": ("#6b4a2a", 0.8, 0.0),
    "gold": ("#e0b648", 0.3, 0.9),
    "clay": ("#b8643a", 0.85, 0.0),
    "bark": ("#6b5440", 0.9, 0.0),
    "pink": ("#ef6f9a", 0.5, 0.0),
    "sky": ("#6fc3ea", 0.5, 0.0),
    "lilac": ("#a993d8", 0.5, 0.0),
    "lime": ("#9bd34a", 0.5, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "sandstone": 3.2,  # the deck: temple courtyard flagstones, moss in the joints (fal)
    "templestone": 3.0,  # the temple, the gate's pillars, the ruined walls: carved grey-green blocks (fal)
    "riverrock": 2.2,  # the banks' walls, the lip, the cave's rocks, the stepping stones: wet mossy boulders (fal)
    "riverbed": 2.6,  # the river's bed: sand and pebbles (fal)
    "planks": 2.0,  # the docks, the bridge, the snack hut's counter: old hardwood (fal)
    "leaflitter": 4.0,  # the jungle floor outside: leaves, seedlings, roots (fal; no lawn)
    "bamboo": 2.4,  # the palisade: lashed golden bamboo (fal)
    "thatch": 1.5,  # the roofs (the Sunset Lagoon's)
    "canopy": 2.0,  # the broadleaf trees' crowns
    "hedge": 1.5,  # the jungle's bushes
}

NAME = "river"  # dist/assets/river-club/river.glb
OUT = os.path.join(REPO, "dist", "assets", "river-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, RIVER_PALETTE, TILES)
COACH_PARTS = []
SHARP_TILES = ["sandstone", "templestone", "riverrock", "riverbed", "planks", "bamboo", "leaflitter"]
PAINT = {"size": 2048, "x0": -15.6, "z0": -17.0, "span": 31.2}
ATLAS_SIZE = {"idol": 1024, "map": 768, "poster": 640, "sign_main": 768, "rules": 640}
CUT_ATLAS = 2048  # (fourteen cut-outs: the idol, the foliage, the lianas, the signpost's arrows)
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
RIV = PLAN["river"]
W = RIV["w"]  # the river's half-width
SAMPLES = RIV["samples"]  # every 0.25 m: s, x, z, tx, tz (the flow), nx, nz (left of the flow)
LENGTH, S_START, S_END = RIV["length"], RIV["start"], RIV["end"]
BRIDGE = RIV["bridge"]
STONES = RIV["stones"]
DOCKS = RIV["docks"]
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
TUBE_COUNT = PLAN["tubes"]
WATER_Y = -0.25
BED_Y = -1.15  # the river's bed (scene/river.mjs BED)
GATE_HALF = DOORS["doorX"] * 2 + 0.02  # (scene/river.mjs: the gate's opening either side of x 0)
GATE_Z = ROOM["minZ"] + 0.05


def at(s):
    """The centreline at `s`: x, z, the flow (tx, tz) and the left normal (nx, nz), from the plan's samples."""
    s = max(0.0, min(LENGTH, s))
    f = s / 0.25
    i = min(len(SAMPLES) - 2, int(f))
    t = f - i
    a, b = SAMPLES[i], SAMPLES[i + 1]
    lerp = lambda k: a[k] + (b[k] - a[k]) * t
    tx, tz = lerp("tx"), lerp("tz")
    n = math.hypot(tx, tz) or 1
    tx, tz = tx / n, tz / n
    return {"s": s, "x": lerp("x"), "z": lerp("z"), "tx": tx, "tz": tz, "nx": tz, "nz": -tx}


def point(s, d):
    """The place `d` across (left of the flow positive) at `s` along."""
    c = at(s)
    return c["x"] + c["nx"] * d, c["z"] + c["nz"] * d


def locate(x, z):
    """The nearest centreline place: (s, d)."""
    best, bd = 0, 1e9
    for i, p in enumerate(SAMPLES):
        dd = (p["x"] - x) ** 2 + (p["z"] - z) ** 2
        if dd < bd:
            bd, best = dd, i
    p = SAMPLES[best]
    along = max(-0.13, min(0.13, (x - p["x"]) * p["tx"] + (z - p["z"]) * p["tz"]))
    c = at(p["s"] + along)
    return c["s"], (x - c["x"]) * c["nx"] + (z - c["z"]) * c["nz"]


def near_river(x, z, margin):
    """Within `margin` of the water (or in it), inside the river's length."""
    s, d = locate(x, z)
    return abs(d) < W + margin and 0.0 < s < LENGTH


def in_room(x, z, pad=0.0):
    return ROOM["minX"] - pad < x < ROOM["maxX"] + pad and ROOM["minZ"] - pad < z < ROOM["maxZ"] + pad


def furniture(kind):
    return [f for f in FURNITURE if f["kind"] == kind]


