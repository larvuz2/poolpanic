"""Shared ground for the Sunset Lagoon's Blender scripts (the lagoon venue dressed for the three.js game, 31 October 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
Sunset Lagoon's plan (dist/spatial.mjs LAGOON: Splash Park's floor plan, RESORT_SPEC, its doors in the building along the back),
its palette and its tile sets. The deck is a raised boardwalk 1.95 m over the beach (the classic lagoon's sand lies at y -1.95);
the sea is the game's own (scene/sky.mjs `lagoon`: its shore at x -38, seen from the Coach Cam), so nothing is modelled past
x -34.6 on that side.
"""

import os, sys, math, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the plan (dist/spatial.mjs RESORT_SPEC; poolGeometry: a five-lane pool is 8.2 m by 8.3 m half) ------------------------
ROOM = dict(x0=-16.2, x1=17.0, z0=-16.7, z1=13.5)
DECK = dict(x0=-15.6, x1=16.4, z0=-15.2, z1=12.65)
HX, HZ = 8.2, 8.3
LANES = [-6.4, -3.2, 0.0, 3.2, 6.4]
WATER_Y = -0.25
FLOOR_Y = -1.42
SAND_Y = -1.95  # the beach under the boardwalk (the classic lagoon's)
SHORE_X = -34.6  # where the game's beach ramp runs down into its sea (scene/sky.mjs: shoreX + 3.4)
FACE_Z = -16.12  # the beach house's front (the changing rooms' doors are flush in it)
RAIL_X = (-16.0, 16.8)  # the rope railings along the long sides
DOORS_X = 10.7  # the changing rooms' doors (dist/spatial.mjs WALL_DOORS)
STATIONS = dict(fins=(-12.6, 7.9), chlorine=(13.6, 8.1), relief=(13.6, 0.4))
SANITATION = dict(rack=(-15.0, -2.2), bin=(-14.0, 1.6))
RING_MOUNTS = [(-4.0, -15.7, 0.0), (-15.85, -5.4, PI / 2), (16.85, -6.6, -PI / 2)]
RESCUE_BENCH = (-12.2, -0.9)
BENCH_2 = (13.9, -6.2)
FIXTURES = dict(
    fishNet=(16.85, -2.8, -PI / 2),
    treats=(11.9, 11.2),
    flashlight=(-12.6, -6.7),
    fuseBox=(16.9, 11.2, -PI / 2),
    medkit=(-14.9, 4.7),
)
MASSAGE = (-5.5, 11.75)  # the game's massage table (lying along x): kept clear
TRAMPOLINE = dict(x=11.4, z=5.0, bedX=9.5, bedY=2.62, stairBottomX=15.75)
LIFEGUARD = (-13.4, -7.6)
KIOSK = (13.4, 11.2)
DECK_PALMS = [(-14.7, 11.5), (15.5, -11.2), (-14.7, -9.6)]
LOUNGERS = [(-13.2, 10.1), (-11.4, 10.1)]
UMBRELLA = (-12.3, 11.7)
QUEUE = dict(outerX=4.6, startZ=-11.1)


# ---- the beach's low dunes (shell.py makes the sand from them, the garden and the beach props stand on them) -------------------
def _dunes():
    import random as _r

    r = _r.Random(17)
    out = []
    for _ in range(70):
        x, z = r.uniform(-22, 100), r.uniform(-100, 100)
        if ROOM["x0"] - 6 < x < ROOM["x1"] + 6 and ROOM["z0"] - 10 < z < ROOM["z1"] + 10:
            continue
        out.append((x, z, r.uniform(5, 13), r.uniform(0.5, 2.4)))
    return out


DUNES = _dunes()


def dune_h(x, z):
    """How high the sand stands over SAND_Y at (x, z): flat under and round the boardwalk and along the sea."""
    h = 0.0
    for dx, dz, r, a in DUNES:
        d2 = ((x - dx) ** 2 + (z - dz) ** 2) / (r * r)
        if d2 < 4:
            h += a * math.exp(-d2 * 1.4)
    near = max(0.0, min(1.0, (max(ROOM["x0"] - 4 - x, x - ROOM["x1"] - 4, ROOM["z0"] - 6 - z, z - ROOM["z1"] - 7, 0.0)) / 6.0))
    sea = max(0.0, min(1.0, (x + 26) / 6))
    return h * near * sea


def ground_y(x, z):
    return SAND_Y + dune_h(x, z)

# ---- the palette: a Polynesian beach club at golden hour, sun-bleached timber, thatch, teal and coral --------------------------
LAGOON = {
    "timber": ("#b98a5a", 0.7, 0.0),
    "timber_dark": ("#7a5234", 0.7, 0.0),
    "timber_grey": ("#a89a86", 0.8, 0.0),  # weathered driftwood
    "bamboo": ("#d8b568", 0.5, 0.0),
    "bamboo_joint": ("#9c7a3c", 0.55, 0.0),
    "thatch_dry": ("#c99a52", 0.95, 0.0),
    "rope": ("#e2cc9c", 0.95, 0.0),
    "coral_stone": ("#efe4cf", 0.65, 0.0),
    "teal": ("#2aa7a0", 0.45, 0.0),
    "teal_dark": ("#16706f", 0.5, 0.0),
    "coral": ("#ee6a4a", 0.45, 0.0),
    "sun": ("#f4c849", 0.45, 0.0),
    "cream": ("#fff1d6", 0.7, 0.0),
    "white_paint": ("#f7f3ea", 0.5, 0.0),
    "white_gloss": ("#f7f5ef", 0.18, 0.0),
    "navy": ("#173a4f", 0.45, 0.0),
    "tiki_red": ("#b8432c", 0.6, 0.0),
    "tiki_black": ("#2a2420", 0.6, 0.0),
    "steel": ("#c9cfd3", 0.28, 1.0),
    "stainless": ("#dfe4e7", 0.18, 1.0),
    "brass": ("#d7a447", 0.3, 1.0),
    "iron": ("#2c3236", 0.55, 0.6),
    "rubber": ("#2a2a2e", 0.85, 0.0),
    "charcoal": ("#2f2a26", 0.9, 0.0),
    "ember": ("#5a2a16", 0.9, 0.0),
    "stone_grey": ("#8a8f96", 0.85, 0.0),
    "stone_dark": ("#6f757c", 0.85, 0.0),
    "glass": ("#d6eef2", 0.05, 0.0),
    "bottle_green": ("#3f7a4a", 0.12, 0.0),
    "bottle_amber": ("#b06a22", 0.12, 0.0),
    "leaf_palm": ("#4f8a3a", 0.6, 0.0),
    "leaf_dark": ("#2e6b35", 0.6, 0.0),
    "leaf": ("#4f9a4a", 0.6, 0.0),
    "bark": ("#8b6a4b", 0.9, 0.0),
    "bark_light": ("#a9876a", 0.9, 0.0),
    "palm_boot": ("#7d6242", 0.95, 0.0),
    "coconut": ("#6f5a2e", 0.6, 0.0),
    "sand": ("#ecd2a0", 1.0, 0.0),
    "sand_wet": ("#c9ad7c", 0.8, 0.0),
    "canvas": ("#fff4dc", 0.9, 0.0),
    "canvas_teal": ("#2aa7a0", 0.9, 0.0),
    "canvas_coral": ("#ee6a4a", 0.9, 0.0),
    "canvas_sun": ("#f4c849", 0.9, 0.0),
    "towel_white": ("#f7f3ea", 0.95, 0.0),
    "towel_teal": ("#5cb8bd", 0.95, 0.0),
    "towel_coral": ("#ef8a74", 0.95, 0.0),
    "towel_sun": ("#f6d36b", 0.95, 0.0),
    "towel_stripe": ("#f2e2c4", 0.95, 0.0),
    "pineapple": ("#e0a62c", 0.6, 0.0),
    "lime": ("#8cc63f", 0.5, 0.0),
    "hibiscus_red": ("#e0412f", 0.5, 0.0),
    "paper_lantern": ("#ff9a4a", 0.8, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "boardwalk": 1.8,  # the deck: weathered hardwood planks along z, 15 cm wide, butt joints staggered
    "glass_mosaic": 0.8,  # the basin: lagoon-turquoise glass tiles
    "mosaic_band": 0.8,  # the band round the pool and the waterline frieze: teal, coral and sand
    "thatch": 1.6,  # the roofs: layered straw, combed down the slope
    "weave": 0.9,  # the beach house's walls: woven bamboo panels
    "teak": 1.0,  # boards and slats
    "sand": 4.0,  # the beach: fine sand, wind ripples, a few shells
    "canopy": 2.0,  # the broadleaf trees' crowns
    "hedge": 1.6,  # sea grape and bushes along the beach
}

NAME = "lagoon"  # dist/assets/lagoon/lagoon.glb
OUT = os.path.join(REPO, "dist", "assets", "lagoon")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, LAGOON, TILES)
SHARP_TILES = ["boardwalk", "glass_mosaic"]  # (packed at 1024: they fill the screen)
PAINT = {"size": 2048, "x0": -16.6, "z0": -17.2, "span": 34.4}  # (the deck's paint and occlusion: the square they cover)
ATLAS_SIZE = {"sunset_lagoon": 1024, "palm_frond": 1000, "tiki_menu": 512, "surf_school": 512}
DECIMATE = {"stations": 0.55, "lounge": 0.6}
