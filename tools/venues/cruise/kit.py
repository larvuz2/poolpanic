"""Shared ground for the Cruise Ship's Blender scripts (the pool deck of "Panic of the Seas", dressed for the three.js game,
1 November 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
ship's plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/spatial.mjs and
dist/cruise-plan.mjs into the work folder: build_all.sh runs it first): the pool and its two halves, the rows of sun loungers, the
Lido Bar, the hot tub, the stairway lobbies, the ship's lines, the queue, the evacuation spots, every station and fixture.

Lido Deck 14 of the Panic of the Seas at golden hour: a 1930s ocean liner's glamour on a modern cruise ship (honey teak with black
caulking, white steel, brass and mahogany, navy and white stripes, signal flags, festoon lights). The camera looks forward from the
stern (-x) along the deck to the superstructure at the bow end (+x); the ship's sides are port (-z, the left of the screen) and
starboard (+z). THE WHOLE SHIP ROLLS in the game (scene/cruise.mjs turns the scene about x), so everything here is built in the
ship's frame, level; the sea and the sky are the game's. Where the guests walk and wait (the deck between the lounger rows, the
queue in front of the lobbies, the evacuation rows, the far walk, the walks round the pool) stays flat and clear: the props stand in
the furniture's own boxes, along the rails and the stern, and on the superstructure. Its materials are photographic, made once on
fal and made seamless here (cruise_textures.py).
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: white steel, navy, signal red, brass and chrome, teak and mahogany, canvas; the sea's teal; the flags' colours ----
CRUISE_PALETTE = {
    "white": ("#f4f5f2", 0.4, 0.0),
    "white_matte": ("#eceee9", 0.7, 0.0),
    "cream": ("#f3e8cf", 0.7, 0.0),
    "navy": ("#1d3557", 0.45, 0.0),
    "navy_dark": ("#13233b", 0.5, 0.0),
    "red": ("#c8202e", 0.42, 0.0),
    "orange": ("#ff6a1f", 0.45, 0.0),
    "yellow": ("#ffd23f", 0.45, 0.0),
    "teal": ("#1f9aa0", 0.45, 0.0),
    "sky": ("#6fc3ea", 0.45, 0.0),
    "pink": ("#ef6f9a", 0.45, 0.0),
    "green": ("#2a9d48", 0.5, 0.0),
    "black": ("#17181a", 0.55, 0.0),
    "grey": ("#8d969c", 0.6, 0.0),
    "grey_dark": ("#4a5258", 0.6, 0.2),
    "brass": ("#c9a24a", 0.3, 1.0),
    "gold": ("#e0b648", 0.28, 0.9),
    "chrome": ("#d9e1e6", 0.16, 1.0),
    "steel": ("#9aa5ad", 0.35, 0.8),
    "iron": ("#2e2c28", 0.6, 0.6),
    "teak": ("#b5874f", 0.55, 0.0),
    "teak_dark": ("#7a5430", 0.6, 0.0),
    "mahogany": ("#6a2e1c", 0.35, 0.0),
    "rope": ("#d2b98a", 0.95, 0.0),
    "canvas": ("#efe6d0", 0.85, 0.0),
    "towel": ("#fbfbf7", 0.95, 0.0),
    "rubber": ("#2b2d2f", 0.85, 0.0),
    "glass": ("#cfe8f0", 0.06, 0.0),
    "ice": ("#d8f3ff", 0.08, 0.0),
    "leaf": ("#3f8a3c", 0.6, 0.0),
    "leaf_dark": ("#2a5a2c", 0.6, 0.0),
    "terracotta": ("#c06a3c", 0.85, 0.0),
    "coconut": ("#6b4a2a", 0.8, 0.0),
    "lime": ("#9bd34a", 0.5, 0.0),
    "lilac": ("#a993d8", 0.5, 0.0),
    "shrimp": ("#ff8a5c", 0.5, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "teak": 2.4,  # the deck: honey teak with black caulking (fal)
    "paint": 3.0,  # white steel plating with weld seams and rivets: the bulwarks, the superstructure, the lobbies (fal)
    "nonskid": 1.6,  # the walks along the rails: blue-grey non-skid (fal)
    "mosaic": 1.8,  # the pool: iridescent glass mosaic (fal)
    "hullside": 6.0,  # the ship's sides: two decks of balconies to a repeat (fal)
    "facade": 4.4,  # the superstructure's window bands (fal)
    "canvas": 1.6,  # the awnings, the umbrellas, the deck chairs: navy and cream stripes (fal)
    "mahogany": 2.0,  # the Lido Bar's counter and the deco panels (fal)
}

NAME = "cruise"  # dist/assets/cruise-club/cruise.glb
OUT = os.path.join(REPO, "dist", "assets", "cruise-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, CRUISE_PALETTE, TILES)
COACH_PARTS = []
SHARP_TILES = ["teak", "paint", "nonskid", "mosaic", "facade", "canvas", "mahogany", "hullside"]
PAINT = {"size": 2048, "x0": -16.2, "z0": -16.8, "span": 34.4}
ATLAS_SIZE = {"kraken": 1024, "poster": 640, "captain": 640, "deckplan": 640, "photoop": 768, "programme": 640}
CUT_ATLAS = 2048
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
C = PLAN["cruise"]
SHIP = PLAN["ship"]
LANES = C["lanes"]
HX, HZ = C["halfX"], C["halfZ"]  # the lane half's half-width (x) and the pool's half-length (z)
FREE = C["free"]  # the free half: x0..x1
RAIL = C["rail"]
FAR_WALK = C["farWalk"]
BAR = C["bar"]
TUBS = C["tubs"]
ROWS = C["rows"]
LOUNGER = C["lounger"]
LOUNGERS = PLAN["loungers"]
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
WATER_Y = SHIP["water"]  # the pool's surface (-0.15)
LANE_FLOOR, FREE_FLOOR, BENCH_Y = SHIP["laneFloor"], SHIP["freeFloor"], SHIP["bench"]
SEA = SHIP["sea"]  # the sea, 26 m below
HULL = SHIP["hull"]  # the ship's sides (±z)
STERN, BOW = SHIP["stern"], SHIP["bow"]  # the deck's aft edge, where the superstructure rises
GLASS_Z = HULL - 0.3  # the windscreens along both sides
POOL_X0, POOL_X1 = -HX, FREE["x1"]  # the whole pool across x
LOBBIES = [dict(side=s, x0=s * 9.6, x1=s * 13.6, z0=-15.4, z1=-13.3) for s in (-1, 1)]


def furniture(kind):
    return [f for f in FURNITURE if f["kind"] == kind]


def in_pool(x, z, pad=0.0):
    return POOL_X0 - pad < x < POOL_X1 + pad and abs(z) < HZ + pad


def blocked(x, z, pad=0.0):
    """Inside one of the walkers' blocks (the pool, the lounger rows, the bar, the tub, the lobbies)."""
    return any(b[0] - pad < x < b[1] + pad and b[2] - pad < z < b[3] + pad for b in BLOCKS)
