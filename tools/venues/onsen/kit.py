"""Shared ground for the Mountain Hot Springs' Blender scripts (the onsen venue dressed for the three.js game, 1 November 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
hot springs' plan, its palette and its tile sets. The plan is the game's own (plan.mjs writes it from dist/onsen-plan.mjs and
dist/spatial.mjs ONSEN into the work folder: build_all.sh runs it first), so every spring's edge, step and seat, every boulder the
walks go round, every station and fixture is where the game has it.

A snowy terrace in the mountains at the blue hour: the camera looks across it from the near side (-x) to the mountains (+x); the
bathhouse is at the left end (-z), the forest round the far side (+x) and the right end (+z), where the snow monkeys come from.
Nothing tall on the near side. What moves stays the game's (scene/onsen.mjs): the springs' water, the steam, the falling snow, the
spout's thread of water, the curtain in the bathhouse door; and its cast (scene/onsen-view.mjs): the guests and the snow monkeys.
"""

import os, sys, math, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the palette: dark timber and white plaster, grey granite, snow, lacquer red, indigo cloth, straw rope ------------------------
ONSEN_PALETTE = {
    "timber": ("#3b2a20", 0.75, 0.0),  # charred cedar (yakisugi)
    "timber_mid": ("#6b4a32", 0.7, 0.0),
    "hinoki": ("#c9a374", 0.6, 0.0),  # pale cypress
    "hinoki_dark": ("#a07d55", 0.65, 0.0),
    "plaster": ("#efe9dc", 0.85, 0.0),
    "roof": ("#3a3f46", 0.55, 0.0),
    "granite": ("#8e8c86", 0.85, 0.0),
    "granite_dark": ("#6f6c67", 0.85, 0.0),
    "rock": ("#5f5b57", 0.85, 0.0),
    "snow": ("#eef3fa", 0.8, 0.0),
    "ice": ("#cfe0ef", 0.15, 0.0),
    "red": ("#b8352c", 0.4, 0.0),
    "red_paper": ("#d8483a", 0.8, 0.0),
    "indigo": ("#2c3c78", 0.9, 0.0),
    "paper": ("#f3e6c8", 0.9, 0.0),
    "straw": ("#c9b48a", 0.95, 0.0),
    "rope": ("#d8c49a", 0.95, 0.0),
    "bamboo": ("#9fa84a", 0.45, 0.0),
    "bamboo_dark": ("#6f7a34", 0.5, 0.0),
    "moss": ("#5a7a4a", 0.9, 0.0),
    "cedar": ("#2d4a3a", 0.9, 0.0),
    "cedar_dark": ("#1f3a2e", 0.9, 0.0),
    "bark": ("#5a3e2c", 0.9, 0.0),
    "copper": ("#6f9a86", 0.5, 0.6),  # verdigris
    "iron": ("#2b2d31", 0.6, 0.6),
    "brass": ("#c9a24a", 0.35, 1.0),
    "black": ("#16191f", 0.5, 0.0),
    "white": ("#f4f6f8", 0.5, 0.0),
    "yellow": ("#f2c230", 0.35, 0.0),  # the famous yellow bath buckets
    "orange": ("#f08a2a", 0.45, 0.0),
    "towel": ("#f7f3ea", 0.95, 0.0),
    "towel_blue": ("#5a7ab8", 0.95, 0.0),
    "towel_red": ("#c8524a", 0.95, 0.0),
    "glass": ("#d6eef2", 0.05, 0.0),
    "tea": ("#7a8a3a", 0.3, 0.0),
    "ceramic": ("#e8e2d4", 0.25, 0.0),
    "ceramic_blue": ("#3a5a8a", 0.25, 0.0),
    "carrot": ("#f07a2a", 0.5, 0.0),
    "coal": ("#1c1c1e", 0.8, 0.0),
    "vending": ("#d8dee6", 0.3, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "flagstone": 3.6,  # the terrace: irregular stone flags under a glaze of ice (the classic's stone path, cooled)
    "snow": 4.0,  # the snowfield and the drifts
    "rock": 1.6,  # boulders, rim stones, the basins' walls
    "pebbles": 1.4,  # the springs' floors
    "hinoki": 1.0,  # pale cypress boards
    "timber": 1.2,  # charred cedar boards
    "plaster": 2.0,  # the bathhouse's white walls
    "kawara": 1.0,  # roof tiles
    "bark": 1.0,  # cedar trunks
    "cedar": 1.2,  # the cedars' needles (tinted)
}

NAME = "onsen"  # dist/assets/onsen-club/onsen.glb
OUT = os.path.join(REPO, "dist", "assets", "onsen-club")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, ONSEN_PALETTE, TILES)
COACH_PARTS = []
SHARP_TILES = []
PAINT = {"size": 2048, "x0": -15.4, "z0": -16.4, "span": 30.8}
ATLAS_SIZE = {"noren": 512, "rules": 512, "monkey_warning": 512, "vending": 512}
DECIMATE = {}

# ---- the plan (the game's: plan.mjs) ----------------------------------------------------------------------------------------------
_plan_file = os.path.join(WORK, "plan.json")
if not os.path.exists(_plan_file):
    with open(_plan_file, "w") as f:
        f.write(subprocess.check_output(["node", os.path.join(HERE, "plan.mjs")], cwd=REPO, text=True))
PLAN = json.load(open(_plan_file))
DECK = PLAN["deck"]
SPRINGS = PLAN["springs"]
BOULDERS = PLAN["boulders"]
BATH = PLAN["bathhouse"]
DOOR_X = PLAN["doors"]["doorX"]
SPOUT = PLAN["spout"]
FURNITURE = PLAN["furniture"]
STATIONS = PLAN["stations"]
FIXTURES = PLAN["fixtures"]
RING_MOUNTS = PLAN["ringMounts"]
SANITATION = PLAN["sanitation"]
RESCUE = PLAN["rescue"]
WATER_Y = -0.15  # (scene/onsen.mjs ONSEN_WATER_Y)
FLOOR_Y = -1.1  # the basins' floor
LANTERN_FIRE_Y = 0.84  # the stone lanterns' fire boxes (the game's flames burn there)
SPOUT_MOUTH_Y = 0.38  # the bamboo pipe's mouth (the game's thread of water starts there, 0.6 m from the spout's post toward the water)


def furniture(kind):
    return [f for f in FURNITURE if f["kind"] == kind]


def spring_point(s, th, r=1.0):
    """A point of spring `s` at angle `th` and normalized radius `r` (dist/onsen-plan.mjs springPoint)."""
    k = r * (1 + s["a2"] * math.cos(2 * th + s["p2"]) + s["a3"] * math.cos(3 * th + s["p3"]))
    return (s["x"] + math.cos(th) * s["rx"] * k, s["z"] + math.sin(th) * s["rz"] * k)


def spring_inside(x, z, margin=0.0):
    """Whether (x, z) is in a spring's water (`margin` m in from its edge: negative reaches out over its rim)."""
    for s in SPRINGS:
        u, v = (x - s["x"]) / s["rx"], (z - s["z"]) / s["rz"]
        th = math.atan2(v, u)
        f = 1 + s["a2"] * math.cos(2 * th + s["p2"]) + s["a3"] * math.cos(3 * th + s["p3"])
        R = math.hypot(math.cos(th) * s["rx"], math.sin(th) * s["rz"]) * f
        if (1 - math.hypot(u, v) / f) * R > margin:
            return True
    return False


def clear_of_play(x, z, r):
    """Whether a prop of radius `r` at (x, z) keeps off the springs and their rims, the boulders, the steps, the queue in front of the
    bathhouse and the evacuation spots (the guests walk and wait there)."""
    if spring_inside(x, z, -(PLAN["rim"] + r + 0.2)):
        return False
    for b in BOULDERS:
        if math.hypot(x - b["x"], z - b["z"]) < b["r"] + r + 0.2:
            return False
    q = PLAN["queue"]
    if q["blockX"][0] - 1 - r < x < q["blockX"][1] + 1 + r and -12.6 - r < z < -5.8 + r:
        return False
    return True
