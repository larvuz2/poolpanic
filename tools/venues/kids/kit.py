"""Shared ground for the Kids Pool's Blender scripts (the kids venue dressed for the three.js game, 31 October 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
Kids Pool's plan (dist/spatial.mjs KIDS), its palette and its tile sets.

The plan's rule for anything new: the kids run all over the deck (sim.mjs `roamKid`: anywhere from x -13.1 to 13.1 and z -14.2 to
11.65 that is deck), so the deck stays open. New things stand on the game's furniture spots (FURNITURE), against the fence (within
0.6 m of it), or outside it; never in the open deck.
"""

import os, sys, math, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the plan (dist/spatial.mjs KIDS; poolGeometry: a three-lane pool is 5.0 m by 8.3 m half) --------------------------------
ROOM = dict(x0=-14.7, x1=14.7, z0=-16.7, z1=13.5)
DECK = dict(x0=-14.1, x1=14.1, z0=-15.2, z1=12.65)
HX, HZ = 5.0, 8.3  # the basin's half width (x) and half length (z)
WATER_Y = -0.25
FLOOR_Y = -1.42  # the basin's floor (pool.mjs depth)
FENCE = dict(x0=-14.45, x1=14.45, z0=-16.45, z1=13.25)  # the picket fence's line (the classic's: the room inset 0.25)
GATE = dict(half=1.26, z=-16.45)  # the gate in the back fence: its posts at x +-1.26 (spatial doors.doorX 0.62: half = 2 * 0.62 + 0.02)
STATIONS = dict(fins=(-10.3, 7.8), chlorine=(10.8, 7.8), relief=(10.8, 3.9))
SANITATION = dict(rack=(-13.5, -1.9), bin=(-12.5, 1.5))
RING_MOUNTS = [(-4.0, -15.7, 0.0), (-14.35, -5.0, PI / 2), (14.35, 5.0, -PI / 2)]
RESCUE_BENCH = (-10.2, -0.9)  # (its seat runs along z)
BENCH_2 = (10.3, -0.5)
FIXTURES = dict(
    fishNet=(14.35, -2.6, -PI / 2),
    treats=(-13.4, 8.4),  # (the game's dog-treats jar stands at x -12.85, y 1.45: kioskTreats)
    flashlight=(11.2, -7.3),
    fuseBox=(14.4, 12.05, -PI / 2),  # (drawn by the game; its back at x 14.67)
)
FURNITURE = dict(
    slide=(-11.8, -8.4, 0.75, 1.9),  # (x, z, half x, half z)
    lifeguard=(12.6, 0.4, 0.6, 0.6),
    toy_box=(-12.9, 11.2, 0.65, 0.45),
    treat_table=(-13.4, 8.4, 0.36, 0.36),
)
ROAM = dict(x0=-13.1, x1=13.1, z0=-14.2, z1=11.65)  # where the kids run (keep it open)

# ---- the palette: a sunny seaside playground, candy colours softened by the sun ------------------------------------------------
KIDS = {
    "cream": ("#fff6e4", 0.6, 0.0),
    "white_paint": ("#fbf8f1", 0.45, 0.0),
    "white_gloss": ("#f7f5ef", 0.18, 0.0),
    "pink": ("#ff8fb8", 0.45, 0.0),
    "pink_soft": ("#ffc2d6", 0.55, 0.0),
    "sun": ("#ffd23f", 0.42, 0.0),
    "sun_soft": ("#ffe58a", 0.55, 0.0),
    "sky": ("#4fc3f7", 0.42, 0.0),
    "sky_soft": ("#a8e2fb", 0.55, 0.0),
    "mint": ("#7bd8b0", 0.45, 0.0),
    "leafgreen": ("#5cbf6a", 0.5, 0.0),
    "coral": ("#ff8a5c", 0.45, 0.0),
    "lilac": ("#b49cff", 0.45, 0.0),
    "navy": ("#24456e", 0.45, 0.0),
    "red": ("#e8483f", 0.4, 0.0),
    "timber": ("#d8a26a", 0.6, 0.0),
    "timber_dark": ("#a8703f", 0.6, 0.0),
    "steel": ("#c9cfd3", 0.28, 1.0),
    "stainless": ("#dfe4e7", 0.18, 1.0),
    "rubber": ("#2a2a2e", 0.85, 0.0),
    "charcoal": ("#3a3b40", 0.6, 0.0),
    "glass": ("#d6eef2", 0.05, 0.0),
    "leaf": ("#4f9a4a", 0.6, 0.0),
    "leaf_dark": ("#2e6b35", 0.6, 0.0),
    "bark": ("#8b6a4b", 0.9, 0.0),
    "bark_light": ("#a9876a", 0.9, 0.0),
    "soil": ("#5a4231", 0.95, 0.0),
    "clay_pot": ("#c97a52", 0.8, 0.0),
    "terracotta_dark": ("#a34c2c", 0.75, 0.0),
    "towel_white": ("#f7f3ea", 0.95, 0.0),
    "towel_sky": ("#7ccff2", 0.95, 0.0),
    "towel_pink": ("#ffa6c4", 0.95, 0.0),
    "towel_sun": ("#ffdc6b", 0.95, 0.0),
    "towel_stripe": ("#fff2d6", 0.95, 0.0),
    "canvas": ("#fff4dc", 0.9, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "rubber": 1.2,  # the deck's soft rubber tiles (EPDM granules, neutral: each colour is a tint, T_rubber@rrggbb)
    "glass_mosaic": 0.8,  # the basin: 2.5 cm glass tiles
    "mosaic_band": 0.8,  # the band round the pool and the waterline frieze
    "boards": 1.0,  # painted beach-hut boards (neutral: tinted)
    "hedge": 1.6,  # clipped hedges
    "groundcover": 3.0,  # the ground under the trees round the pool
    "canopy": 2.0,  # the broadleaf trees' crowns
    "conifer": 1.2,  # the cypresses
}

NAME = "kids"  # dist/assets/kids/kids.glb
OUT = os.path.join(REPO, "dist", "assets", "kids")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, KIDS, TILES)
SHARP_TILES = ["rubber", "glass_mosaic"]  # (packed at 1024: they fill the screen)
PAINT = {"size": 2048, "x0": -15.0, "z0": -17.0, "span": 30.6}  # (the deck's paint and occlusion: the square they cover)
ATLAS_SIZE = {"kids_pool": 1024, "palm_frond": 1000, "kids_club": 768, "ice_cream": 512}
DECIMATE = {}
