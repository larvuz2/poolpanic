"""Shared ground for the Aqua Disco's Blender scripts (the disco venue dressed for the three.js game, 31 October 2026).

The common kit (tools/venues/common/kitbase.py) brings the materials the exporter reads, saving a part and previews; this adds the
Aqua Disco's plan (dist/spatial.mjs DISCO), its palette and its tile sets. An indoor room: the deck runs wall to wall, the walls
stand at x +-14.0 (their face), z -16.12 (the back, with the entrance) and z 13.6 (the far end, behind the stage). What moves to the
beat stays the game's (scene/disco.mjs: the moving-head spots, the lasers, the LED rim, the sparkles, the mirror ball, the neon sign
and the equaliser, the stage's ring, disc and bulbs, Valentina, the speakers' cones, the DJ and the bartender): the model is the room
and the furniture round them.

COACH_PARTS (the exporter merges them as C_<class>, the game shows them only in the Coach Cam): the ceiling and its rigs, and the
upper part of the near wall (x -14), which the overview's camera looks over.
"""

import os, sys, math, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
sys.path.insert(0, HERE)
from kitbase import *  # noqa: F401,F403

# ---- the plan (dist/spatial.mjs DISCO; poolGeometry: four zones, 6.6 m by 8.3 m half) -----------------------------------------
ROOM = dict(x0=-14.2, x1=14.2, z0=-16.7, z1=13.6)
DECK = dict(x0=-13.6, x1=13.6, z0=-15.2, z1=12.9)
HX, HZ = 6.6, 8.3
ZONES = [-4.8, -1.6, 1.6, 4.8]
WATER_Y = -0.25
FLOOR_Y = -1.42
WALL_X = 14.0  # the long walls' faces (x = +-14.0)
FACE_Z = -16.12  # the back wall's face (the entrance in it)
END_Z = 13.6  # the far end's wall face, behind the stage
CEIL_Y = 8.6  # the ceiling's underside at the walls (it vaults up to about 11 over the pool)
DOOR = dict(half=1.26, height=2.6)  # the entrance: two leaves, each as wide as its side's way in (spatial doors.doorX 0.62)
STAGE = dict(x=0.0, z=11.6, y=0.62, r=2.8)
STATIONS = dict(fins=(-11.4, 7.2), chlorine=(11.6, 7.0), relief=(11.6, 2.8))
SANITATION = dict(rack=(-13.1, -2.6), bin=(-11.8, 1.4))
RING_MOUNTS = [(-3.6, -15.7, 0.0), (-13.85, -6.0, PI / 2), (13.85, -4.6, -PI / 2)]
BENCHES = [(-10.4, -1.85), (10.6, -2.6)]  # (their seats run along z)
FIXTURES = dict(
    fishNet=(13.85, -1.6, -PI / 2),
    treats=(-12.6, 10.6),  # (the game's jar stands at x -12.05, y 1.45: kioskTreats; the bar's top is at 1.24)
    flashlight=(11.6, -7.4),
    fuseBox=(13.9, 11.4, -PI / 2),
)
FURNITURE = dict(
    dj=(-12.2, -9.4, 1.0, 1.3),  # (x, z, half x, half z)
    bar=(-12.9, 10.6, 0.75, 1.5),
    speakers=[(-12.9, 4.2), (12.9, -10.2), (4.6, 12.2), (-4.6, 12.2)],
    plant=(-13.0, -12.4),
)
LASERS = [-6.0, 0.0, 6.0]  # (the game's laser heads on the back wall at y 4.6)
SIGN = dict(y=5.55, w=8.4, h=2.1)  # the game's neon sign over the entrance (its canvas)
EQ = dict(y=3.6, w=6.4, h=1.3)  # the game's equaliser screen

# ---- the palette: an art-deco nightclub, deep violet and black glass, chrome and gold, neon -----------------------------------
DISCO = {
    "ink": ("#0d0818", 0.5, 0.0),
    "violet": ("#2a1650", 0.55, 0.0),
    "violet_light": ("#4a2c86", 0.5, 0.0),
    "plum": ("#3a1838", 0.6, 0.0),
    "velvet": ("#5a1a5e", 0.85, 0.0),
    "velvet_teal": ("#0f4a5a", 0.85, 0.0),
    "black_gloss": ("#121018", 0.15, 0.0),
    "black_matte": ("#17141e", 0.8, 0.0),
    "granite": ("#1c1824", 0.2, 0.0),
    "chrome": ("#e6e8f0", 0.12, 1.0),
    "gold": ("#d9a441", 0.25, 1.0),
    "brass": ("#c9953a", 0.3, 1.0),
    "steel": ("#9a9cac", 0.35, 1.0),
    "truss": ("#2a2a34", 0.45, 0.8),
    "white_gloss": ("#f4f2f8", 0.15, 0.0),
    "cream": ("#f1e6d6", 0.6, 0.0),
    "magenta": ("#ff3fb4", 0.4, 0.0),
    "cyan": ("#34e6ff", 0.4, 0.0),
    "lime": ("#9cff4f", 0.4, 0.0),
    "sun": ("#ffd24a", 0.4, 0.0),
    "orange": ("#ff8a3c", 0.4, 0.0),
    "mirror": ("#dfe4f0", 0.04, 1.0),
    "glass": ("#cfe4f4", 0.05, 0.0),
    "rubber": ("#1a1a20", 0.85, 0.0),
    "charcoal": ("#26222c", 0.7, 0.0),
    "leaf": ("#2f7a46", 0.6, 0.0),
    "leaf_dark": ("#1f5a36", 0.6, 0.0),
    "bark": ("#6a4a34", 0.9, 0.0),
    "towel_white": ("#f7f3ea", 0.95, 0.0),
    "towel_pink": ("#ff8ac8", 0.95, 0.0),
    "towel_cyan": ("#7fe6f2", 0.95, 0.0),
    "towel_violet": ("#9a7ad8", 0.95, 0.0),
    "towel_stripe": ("#f2e6ff", 0.95, 0.0),
}

# The tile sets: the picture each uses and its world scale (metres per repeat).
TILES = {
    "glassfloor": 2.0,  # the deck: 50 cm squares of black glass, a soft colour glowing in some (a dance floor at rest)
    "glass_mosaic": 0.8,  # the basin: deep blue and silver glass tiles
    "mosaic_band": 0.8,  # the band and the waterline frieze: magenta, violet and gold
    "quilt": 0.9,  # the walls' padded velvet, buttoned in diamonds
    "acoustic": 1.2,  # the upper walls and the ceiling: dark fabric panels in slats
    "grille": 0.25,  # speaker cloth
    "mirrortile": 0.6,  # mirror mosaic (the columns' faces, the bar's front, the booth)
    "terrazzo": 1.6,  # the stage's steps and the entrance's floor: black terrazzo with gold chips
}

NAME = "disco"  # dist/assets/disco/disco.glb
OUT = os.path.join(REPO, "dist", "assets", "disco")
PLACEMENTS = os.path.join(HERE, "placements.json")
WORK, PARTS, TEX, SIGNS, PREVIEWS = configure(NAME, DISCO, TILES)
COACH_PARTS = ["ceiling"]  # (merged as C_<class>: the Coach Cam's only)
SHARP_TILES = ["glassfloor", "glass_mosaic"]
PAINT = {"size": 2048, "x0": -14.6, "z0": -17.0, "span": 31.0}
ATLAS_SIZE = {"aqua_disco_crest": 1024, "poster_fever": 512, "poster_splash": 512, "poster_synchro": 512, "poster_deep": 512}
DECIMATE = {"stations": 0.6}
