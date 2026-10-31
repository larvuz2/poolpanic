"""Shared ground for the Aquatic Centre's Blender scripts (the aquatic venue dressed for the three.js game, 31 October 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
Aquatic Centre's plan (dist/spatial.mjs AQUATIC: Splash Park's floor plan, RESORT_SPEC, without its trampoline, the changing rooms'
doors in the timing wall), its palette and its tile sets. An indoor natatorium: the deck is a tabletop 1.95 m over the hall's floor,
grandstands on the far side (+x) and the far end (+z) and, for the Coach Cam only, the near side (-x); the timing wall along the back.
What moves stays the game's (scene/aquatic.mjs: the timing board's times, the pace clocks' hands, the club flags, the crowd in the
stands and the scrolling ribbons in front of them).

COACH_PARTS (merged as C_<class>, shown only in the Coach Cam): the roof and the near side's hall (its wall and grandstand).
"""

import os, sys, math, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the plan (dist/spatial.mjs RESORT_SPEC / AQUATIC) ----------------------------------------------------------------------------
ROOM = dict(x0=-16.2, x1=17.0, z0=-16.7, z1=13.5)
DECK = dict(x0=-15.6, x1=16.4, z0=-15.2, z1=12.65)
HX, HZ = 8.2, 8.3
LANES = [-6.4, -3.2, 0.0, 3.2, 6.4]
WATER_Y = -0.25
FLOOR_Y = -1.42
HALL_Y = -1.95  # the hall's floor round the tabletop (scene/aquatic.mjs FLOOR)
HALL = dict(x0=-26.5, x1=27.3, z0=-16.15, z1=24.5)  # (scene/aquatic.mjs AQUATIC_HALL)
EAVE, RIDGE = 13.0, 21.0
FACE_Z = -16.13  # the timing wall's face (the doors in it)
DOORS_X = 10.7
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
MASSAGE = (-5.5, 11.75)  # the game's massage table (along x): kept clear
LIFEGUARD = (-13.4, -7.6)
KIOSK = (13.4, 11.2)  # the officials' table
OFFICIALS_DESK = 0.76  # its top: sitting height (dist/scene/officials.mjs DESK)
OFFICIAL_SEATS = [(-0.6, 0.47), (0.6, 0.45)]  # (z from the table's middle, seat top): the Chief Judge, the Starter (on 0.11 of cushions)
PODIUM = (12.4, 4.8)
TEAM_BENCH = (-12.9, 10.6)
PLANT = (15.4, -11.2)
BOARD = dict(x=0.4, y=2.55, w=9.6, h=4.2)  # the game's timing board on the wall
CLOCKS = [0.4 - 7.0, 0.4 + 7.0]  # the game's pace clocks (y 2.55, r 1.32)
STAND = dict(tiers=7, depth=1.15, rise=0.55)  # (scene/aquatic.mjs STAND: the crowd sits on these)
STANDS = [
    dict(axis="x", dir=1, front=17.7, a0=-13.6, a1=22.4, coach=False),
    dict(axis="z", dir=1, front=14.6, a0=-14.4, a1=16.4, coach=False),
    dict(axis="x", dir=-1, front=-16.9, a0=-13.6, a1=22.4, coach=True),
]

# ---- the palette: a municipal competition pool, white and blue, red trim, a bit of gold and a lot of plastic ----------------------
AQUA = {
    "white": ("#f4f8fb", 0.45, 0.0),
    "white_gloss": ("#f7f9fb", 0.15, 0.0),
    "navy": ("#10284a", 0.45, 0.0),
    "blue": ("#1f5fd1", 0.4, 0.0),
    "blue_light": ("#5aa8ea", 0.45, 0.0),
    "red": ("#e03a3a", 0.4, 0.0),
    "gold": ("#e9b949", 0.3, 1.0),
    "silver": ("#c9d1da", 0.3, 1.0),
    "bronze": ("#c98a52", 0.35, 1.0),
    "steel": ("#c9cfd3", 0.28, 1.0),
    "stainless": ("#dfe4e7", 0.18, 1.0),
    "chrome": ("#e6e8f0", 0.12, 1.0),
    "black": ("#16191f", 0.5, 0.0),
    "charcoal": ("#2b3038", 0.6, 0.0),
    "grey": ("#8a95a3", 0.6, 0.0),
    "concrete": ("#b8bfc6", 0.85, 0.0),
    "yellow": ("#ffd24a", 0.4, 0.0),
    "green": ("#2fae7a", 0.45, 0.0),
    "orange": ("#ff8a3c", 0.45, 0.0),
    "pink": ("#ff7eb3", 0.45, 0.0),
    "duck": ("#ffd23a", 0.35, 0.0),
    "beak": ("#ff8a2a", 0.35, 0.0),
    "rubber": ("#1a1a20", 0.85, 0.0),
    "glass": ("#d6eef2", 0.05, 0.0),
    "cardboard": ("#c9a46e", 0.9, 0.0),
    "wood": ("#b98a5a", 0.6, 0.0),
    "leaf": ("#3f8a46", 0.6, 0.0),
    "leaf_dark": ("#2a6a3a", 0.6, 0.0),
    "towel_white": ("#f7f3ea", 0.95, 0.0),
    "towel_blue": ("#5aa8ea", 0.95, 0.0),
    "towel_red": ("#ef6a5a", 0.95, 0.0),
    "towel_yellow": ("#f6d36b", 0.95, 0.0),
    "towel_stripe": ("#e8eef6", 0.95, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "deck": 1.2,  # the deck: white anti-slip tiles, 15 cm, a blue grid line every metre... and a few chipped ones
    "glass_mosaic": 0.8,  # the basin: competition blue
    "mosaic_band": 0.8,  # the band and the waterline frieze: navy, blue and white
    "rubberfloor": 2.0,  # the hall's floor: blue-grey sports flooring with a fleck
    "panel": 2.4,  # the hall's walls: white acoustic panels with a perforation pattern
    "seats": 0.5,  # the grandstands' seat rows: moulded plastic (neutral: tinted)
    "concrete": 2.0,  # the stands' concrete
    "teak": 1.0,  # benches
    "walltile": 1.0,  # the walls' glazed dado: 10 cm white tiles, a blue one here and there
}

NAME = "aquatic"  # dist/assets/aquatic/aquatic.glb
OUT = os.path.join(REPO, "dist", "assets", "aquatic")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, AQUA, TILES)
COACH_PARTS = ["ceiling"]
SHARP_TILES = ["deck", "glass_mosaic"]
PAINT = {"size": 2048, "x0": -16.6, "z0": -17.2, "span": 34.4}
ATLAS_SIZE = {"records": 768, "marco": 512, "tv_logo": 256}
DECIMATE = {"stations": 0.6}
