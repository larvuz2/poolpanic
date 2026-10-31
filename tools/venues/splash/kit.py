"""Shared ground for Splash Park's Blender scripts (the resort venue dressed for the three.js game, 30 October 2026).

The venue kit of the Harbourside (godot/tools/blender/lib.py, props_kit.py: boxes by extents, tubes, text, towels, pots, the
Godot <-> Blender axes) is reused as it is; this adds the plan of the floor (dist/spatial.mjs RESORT_SPEC, which Splash Park
shares with the Sunset Lagoon and the Grand Gala Arena: only Splash Park wears these assets), the park's palette, the tile sets
the exporter maps to the game's textured materials, and where the pieces are written.

Conventions (as the Harbourside's):
- Metres, game axes for the plan: x across the lanes (+x the top of the game's view), y up, z along the lanes (-z the back
  facade). `g(x, y, z)` turns a game position into Blender's (x, -z, y).
- Pieces are modelled in place in game coordinates, or at the origin and placed by placements.json (asset, pos, rot, scale).
- Material names tell the exporter (common/export_three.py) what a surface becomes:
    T_<set>      a tile set (TILES below): world-box UVs at the set's scale, its picture and normal map in the game
    Light_<kind> an object whose centre is a lamp (glows, the night's pools of light on the deck: splash.json `lights`)
    NightGlow_*  (object names) drawn additively, lit only after dusk (lit windows, lantern glass, bulbs' halos)
    leaf/frond…  two-sided foliage; a material with an alpha picture becomes the cut-out atlas (palm fronds, flowers)
  Object names the game keeps as its own nodes: Door_A, Door_B (the changing rooms' doors), Fins_1..3, Keep_* (see export_three.py).
"""

import os, sys, math, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the plan (dist/spatial.mjs RESORT_SPEC; poolGeometry: a five-lane pool is 8.2 m by 8.3 m half) ------------------------
ROOM = dict(x0=-16.2, x1=17.0, z0=-16.7, z1=13.5)
DECK = dict(x0=-15.6, x1=16.4, z0=-15.2, z1=12.65)
HX, HZ = 8.2, 8.3  # the basin's half width (x, across the lanes) and half length (z)
LANES = [-6.4, -3.2, 0.0, 3.2, 6.4]
WATER_Y = -0.25
FLOOR_Y = -1.42  # the basin's floor (pool.mjs depth)
FACADE_Z = -16.35  # the back wall's face line (the classic facade's middle)
WALL_X = (-16.1, 16.85)  # the low walls with glass on the long sides (x)
DOORS_X = 10.7  # the changing rooms' doors, flush in the hotel's front (x = +-10.7; dist/spatial.mjs RESORT doors)
STATIONS = dict(fins=(-12.6, 7.9), chlorine=(13.6, 8.1), relief=(13.6, 0.4))
SANITATION = dict(rack=(-15.0, -2.2), bin=(-14.0, 1.6))
RING_MOUNTS = [(-4.0, -15.7, 0.0), (-15.85, -5.4, PI / 2), (16.85, -6.6, -PI / 2)]
RESCUE_BENCH = (-12.2, -0.9)  # (the bench the rescued are laid on; its seat runs along z)
BENCH_2 = (13.9, -6.2)
FIXTURES = dict(
    fishNet=(16.85, -2.8, -PI / 2),
    treats=(11.9, 11.2),
    flashlight=(-12.6, -6.7),
    fuseBox=(16.9, 11.2, -PI / 2),
    medkit=(-14.9, 4.7),
)
TRAMPOLINE = dict(x=11.4, z=5.0, bedX=9.5, bedY=2.62, stairBottomX=15.75)
LIFEGUARD = (-13.4, -7.6)
KIOSK = (13.4, 11.2)
DECK_PALMS = [(-14.7, 11.5), (15.5, -11.2), (-14.7, -9.6)]
LOUNGERS = [(-13.2, 10.1), (-11.4, 10.1)]
UMBRELLA = (-12.3, 11.7)
# where people walk and wait (kept clear of anything that would hide them): the queue between the doors, the doors' paths
QUEUE = dict(outerX=4.6, startZ=-11.1)

# ---- the palette: a sun-bleached Mediterranean park -------------------------------------------------------------------------
SPLASH = {
    "stucco": ("#f6ecda", 0.88, 0.0),
    "stucco_warm": ("#f1dfc2", 0.88, 0.0),
    "stucco_pink": ("#f4d3c0", 0.88, 0.0),
    "terracotta": ("#c8643c", 0.7, 0.0),
    "terracotta_dark": ("#a34c2c", 0.75, 0.0),
    "clay_pot": ("#c97a52", 0.8, 0.0),
    "teal": ("#2f9aa0", 0.42, 0.0),
    "teal_dark": ("#1f6f78", 0.45, 0.0),
    "teal_gloss": ("#2f9aa0", 0.2, 0.0),
    "coral": ("#e0513f", 0.42, 0.0),
    "coral_gloss": ("#e0513f", 0.2, 0.0),
    "sun": ("#f4c849", 0.45, 0.0),
    "sun_gloss": ("#f4c849", 0.22, 0.0),
    "canvas": ("#fff4dc", 0.9, 0.0),
    "canvas_teal": ("#2f9aa0", 0.9, 0.0),
    "canvas_coral": ("#e0513f", 0.9, 0.0),
    "canvas_sun": ("#f4c849", 0.9, 0.0),
    "limestone": ("#efe3c8", 0.55, 0.0),
    "travertine": ("#e8d5b4", 0.6, 0.0),
    "teak": ("#b77b45", 0.5, 0.0),
    "teak_dark": ("#8a5631", 0.55, 0.0),
    "rattan": ("#c99a5f", 0.75, 0.0),
    "whitewash": ("#f7f4ec", 0.45, 0.0),
    "white_gloss": ("#f7f5ef", 0.18, 0.0),
    "steel": ("#c9cfd3", 0.28, 1.0),
    "stainless": ("#dfe4e7", 0.18, 1.0),
    "brass": ("#d7a447", 0.3, 1.0),
    "iron": ("#2c3236", 0.55, 0.6),
    "rubber": ("#2a2a2e", 0.85, 0.0),
    "charcoal": ("#3a3b40", 0.6, 0.0),
    "navy": ("#1d3557", 0.45, 0.0),
    "glass": ("#d6eef2", 0.05, 0.0),
    "leaf_palm": ("#4f8a3a", 0.6, 0.0),
    "leaf_dark": ("#2e6b35", 0.6, 0.0),
    "leaf": ("#4f9a4a", 0.6, 0.0),
    "bark": ("#8b6a4b", 0.9, 0.0),
    "bark_light": ("#a9876a", 0.9, 0.0),
    "soil": ("#5a4231", 0.95, 0.0),
    "pebble": ("#d9cfbd", 0.8, 0.0),
    "foam_pink": ("#ef7aa6", 0.6, 0.0),
    "foam_blue": ("#3d7fd1", 0.6, 0.0),
    "foam_green": ("#62c48a", 0.6, 0.0),
    "towel_white": ("#f7f3ea", 0.95, 0.0),
    "towel_teal": ("#5cb8bd", 0.95, 0.0),
    "towel_coral": ("#ef8a74", 0.95, 0.0),
    "towel_sun": ("#f6d36b", 0.95, 0.0),
    "towel_stripe": ("#f2e2c4", 0.95, 0.0),
}


# The tile sets: the picture each uses and its world scale (metres per repeat). export_three.py gives a T_<set> surface world-box
# UVs at this scale; the game draws it with <set>.webp and <set>_n.webp (dist/assets/splash/).
TILES = {
    "travertine": 2.4,  # the deck's pavers: 60 cm squares, 4 x 4 a repeat
    "glass_mosaic": 0.8,  # the basin: 2.5 cm glass tiles
    "mosaic_band": 0.8,  # the band round the pool and the waterline frieze: blue and white
    "stucco": 2.5,  # the walls
    "teak": 1.0,  # boards and slats
    "hedge": 1.6,  # clipped hedges
    "cobble": 1.5,  # the path and the plinth's stone
    "pine": 2.2,  # the umbrella pines' canopies: needle tufts
    "conifer": 1.2,  # the cypresses: dense scale-leaves
    "groundcover": 3.0,  # the ground under the trees round the park: dark leaves and pine needles
}


NAME = "splash"  # dist/assets/splash/splash.glb
OUT = os.path.join(REPO, "dist", "assets", "splash")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, SPLASH, TILES, os.environ.get("SPLASH_WORK", "/tmp/splash-work"))
SHARP_TILES = ["travertine", "glass_mosaic"]  # (packed at 1024, the rest at 512: they fill the screen)
PAINT = {"size": 2048, "x0": -16.6, "z0": -17.2, "span": 34.4}  # (the deck's paint and occlusion: the square they cover)
ATLAS_SIZE = {"splash_park": 1024, "palm_frond": 1000, "snacks_menu": 512, "pool_rules": 384}
DECIMATE = {"lounge": 0.55, "stations": 0.55}
