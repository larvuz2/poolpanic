"""Shared ground for Senior Aqua Fit's Blender scripts (the Victorian glass conservatory dressed for the three.js game, 1 November
2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
conservatory's plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/spatial.mjs SENIOR and
the classic scene's lines into the work folder: build_all.sh runs it first), so the pool, its coping and steps, the glass doors, the
lounge's waiting places, the evacuation columns along the long sides, every station and fixture (and the game's massage table) are
where the game has them.

The Palm House Baths, est. 1926: a Victorian palm house of white cast iron and glass round a four-lane pool for a gentle crowd of
seniors. The camera looks across from the near side (-x, a low wall) to the glass on the far side (+x) and the garden beyond; the
stucco wall with the glass doors is the back (-z, the left of the screen), the glass end (+z, the right) where the late sun comes in.
The roof is the Coach Cam's only (COACH_PARTS). Where the guests walk and wait (round the pool, the lounge's rugs, the evacuation
columns, the way from the doors) stays flat and clear: the props stand in the furniture's own boxes, against the walls and the
glass (the strips between the deck and the walls), and outside. The game's moving parts are placed at the model's anchors
(`Anchor_<Name>`): the spa's water, the gramophone's notes, the tea trolley's tin of treats.
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: white cast iron, brass, emerald, cream stucco, mahogany, marble, porcelain, rose and lavender ---------------------
SENIOR_PALETTE = {
    "iron": ("#f4f1e8", 0.4, 0.15),  # white-painted cast iron
    "iron_dark": ("#2b3a34", 0.5, 0.4),  # green-black iron (benches, bins)
    "brass": ("#c9a14a", 0.25, 0.9),
    "brass_dark": ("#8f6d2c", 0.35, 0.85),
    "gold": ("#d9b85c", 0.3, 0.8),
    "emerald": ("#1f5c4a", 0.35, 0.0),
    "emerald_deep": ("#143d33", 0.4, 0.0),
    "velvet": ("#2a6b52", 0.85, 0.0),
    "cream": ("#f3ead8", 0.6, 0.0),
    "stucco": ("#eee2cc", 0.9, 0.0),
    "marble": ("#f2eee6", 0.2, 0.0),
    "mahogany": ("#5b2c1a", 0.45, 0.0),
    "mahogany_light": ("#7a4127", 0.5, 0.0),
    "walnut": ("#6b4a32", 0.55, 0.0),
    "wicker": ("#c9a06a", 0.85, 0.0),
    "porcelain": ("#f6f4ee", 0.15, 0.0),
    "porcelain_blue": ("#2f5fa8", 0.2, 0.0),
    "terracotta": ("#c8774f", 0.8, 0.0),
    "rose": ("#e8829a", 0.6, 0.0),
    "rose_pale": ("#f6c1cc", 0.6, 0.0),
    "lavender": ("#9b86c9", 0.7, 0.0),
    "mint": ("#9fd9c0", 0.5, 0.0),
    "lemon": ("#f3dc6a", 0.5, 0.0),
    "sky": ("#9cc8e8", 0.5, 0.0),
    "peach": ("#f5b88f", 0.6, 0.0),
    "tartan": ("#a8323a", 0.9, 0.0),
    "navy": ("#1d2f4f", 0.6, 0.0),
    "white": ("#f8f6f0", 0.45, 0.0),
    "black": ("#17191c", 0.5, 0.0),
    "chrome": ("#dfe6ea", 0.18, 1.0),
    "steel": ("#9aa3a6", 0.35, 0.9),
    "rubber": ("#262a2e", 0.8, 0.0),
    "leaf": ("#3f7a3c", 0.6, 0.0),
    "leaf_dark": ("#2a5a30", 0.6, 0.0),
    "glass": ("#e6f4ef", 0.05, 0.0),
    "towel": ("#f7f3ea", 0.95, 0.0),
    "paper": ("#f3ead2", 0.9, 0.0),
    "felt": ("#2f6b45", 0.95, 0.0),
    "wool_pink": ("#f2a7b8", 0.95, 0.0),
    "wool_blue": ("#8fb6e0", 0.95, 0.0),
    "wool_yellow": ("#f3d27a", 0.95, 0.0),
    "tea": ("#7a4a22", 0.2, 0.0),
    "biscuit": ("#d9a35c", 0.8, 0.0),
    "jam": ("#b8262f", 0.3, 0.0),
    "cream_clot": ("#fbf2d8", 0.7, 0.0),
    "bark": ("#7d6550", 0.9, 0.0),
    "stone": ("#d9cdb6", 0.85, 0.0),
    "water": ("#5fa9b8", 0.1, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "travertine": 3.4,  # the deck (the classic's photograph)
    "fanmosaic": 4.2,  # the pool's floor and walls: the art-deco fan mosaic (the classic's photograph)
    "marble": 1.6,  # the coping, the steps, the spa's tub, the washstand: white marble with grey veins
    "mosaic_band": 1.0,  # the frieze round the pool and at the waterline: emerald, gold and cream
    "stucco": 2.5,  # the back wall
    "brick": 1.2,  # the dwarf walls under the glass: cream brick
    "teak": 1.2,  # boards (tinted for mahogany)
    "gravel": 2.0,  # the paths outside
    "groundcover": 3.0,  # the beds outside (no lawn)
    "hedge": 1.5,  # clipped yew and box, the topiary
    "canopy": 2.0,  # the garden's limes and chestnuts
    "conifer": 1.2,  # the Irish yews
}

NAME = "senior"  # dist/assets/senior-club/senior.glb
OUT = os.path.join(REPO, "dist", "assets", "senior-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, SENIOR_PALETTE, TILES)
COACH_PARTS = ["roof"]  # (merged as C_<class>: the Coach Cam's only)
SHARP_TILES = ["travertine", "fanmosaic", "marble", "mosaic_band"]
PAINT = {"size": 2048, "x0": -15.6, "z0": -17.0, "span": 31.2}
# (the signs share a 2048 atlas and the cut-outs a 1024 one: the big readable pictures keep their size, the little ones give way)
ATLAS_SIZE = {"founder": 896, "rug": 768, "sign_main": 768, "rules": 640, "programme": 640, "moves": 512, "clock": 512, "doormat": 512}
ATLAS_SIZE.update({"photo_%d" % k: 384 for k in range(1, 7)})
ATLAS_SIZE.update({k: 256 for k in ("bingo_card", "scale_face", "biscuits", "litter", "danger", "depth")})
ATLAS_SIZE.update({"founder_plate": 512, "lost_property": 384, "cap_week": 384})
ATLAS_SIZE.update({"swan": 768, "iron_lace": 384, "fern": 384, "palm_frond": 384, "zimmer": 512, "roses": 256, "geranium": 256, "lavender": 256})
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
POOL = PLAN["pool"]
PX, PZ = POOL["halfX"], POOL["halfZ"]  # the basin's inner walls
LANES = PLAN["lanes"]
DECK = PLAN["deck"]
ROOM = PLAN["room"]
DOORS = PLAN["doors"]
QUEUE = PLAN["queue"]
EVAC = PLAN["evacSpots"]
FURNITURE = PLAN["furniture"]
STATIONS = PLAN["stations"]
FIXTURES = PLAN["fixtures"]
RING_MOUNTS = PLAN["ringMounts"]
SANITATION = PLAN["sanitation"]
RESCUE = PLAN["rescue"]
WALL = PLAN["wall"]
ROOF = PLAN["roof"]
WATER_Y = -0.25
FLOOR_Y = -1.42  # the basin's floor (scene/pool.mjs depth)
COPE = 0.36  # the coping's width, from the basin's wall out
DOOR_HALF = DOORS["doorX"] * 2 + 0.02  # (scene/senior.mjs: the doorway either side of x 0)
MASSAGE = FIXTURES["massage"]


def furniture(kind):
    return [f for f in FURNITURE if f["kind"] == kind]
