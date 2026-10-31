"""The Kids Pool's tiling textures and cut-outs (numpy), into its work folder: the shared ones (tools/venues/common/venue_textures.py)
in the Kids Pool's colours, and its own: poured rubber (EPDM granules, neutral: the deck's colours are tints, T_rubber@rrggbb),
painted boards for the beach huts (neutral, tinted), broadleaf crowns for the trees.

    blender -b -P tools/venues/kids/kids_textures.py [-- name ...]
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile


# ---- poured rubber: fine granules, a few coloured flecks, soft and matte; neutral so a tint gives each colour --------------------
def rubber(size=1024):
    rng = np.random.default_rng(301)
    grain = noise(size, 256, 302, 2)
    grain2 = noise(size, 128, 303, 2)
    base = hexrgb("#f1ede6") * (0.9 + 0.12 * grain[..., None]) * (0.96 + 0.06 * grain2[..., None])
    # flecks: small granules of other colours (white, a darker grey, a few of the palette)
    fleck = noise(size, 320, 304, 1)
    pick = noise(size, 64, 305, 1)
    flecks = [hexrgb(c) for c in ("#ffffff", "#c9c3b8", "#ffd9e6", "#d7f0fb", "#fff0bf")]
    col = base.copy()
    for k, c in enumerate(flecks):
        m = (fleck > 0.74) & (pick > k / len(flecks)) & (pick <= (k + 1) / len(flecks))
        col[m] = c * (0.94 + 0.06 * rng.random())
    mott = noise(size, 6, 306, 3)
    col *= (0.96 + 0.05 * mott)[..., None]
    height = grain * 0.6 + fleck * 0.4
    tile_set("rubber", col, height, 2.2)


# ---- painted boards (the beach huts): planks across, grooves, the paint a touch worn at the edges --------------------------------
def boards(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    rows = 8
    lv = (ys / size * rows) % 1
    plank = np.floor(ys / size * rows).astype(int)
    r = np.random.default_rng(311).random((rows, 2)).astype(np.float32)
    grain = noise(size, 64, 312, 2)
    paint = hexrgb("#fbf8f1") * (0.95 + 0.04 * r[plank, 0][..., None] + 0.03 * grain[..., None])
    groove = np.clip(np.minimum(lv, 1 - lv) / 0.05, 0, 1)
    col = paint * (0.6 + 0.4 * groove)[..., None]
    tile_set("boards", col, groove * 0.9 + grain * 0.1, 3.0)


# ---- broadleaf crowns: clusters of rounded leaves, sunlit on top -------------------------------------------------------------------
def canopy(size=512):
    tufts("canopy", "#24502b", "#4a8f3c", "#a7cf62", 28, 321, 5.0)


if __name__ == "__main__":
    jobs = {
        "rubber": rubber,
        "boards": boards,
        "canopy": canopy,
        "glass_mosaic": lambda: glass_mosaic(
            blend=[("#8fe0ea", 0.32), ("#5fd0e4", 0.26), ("#bdeef4", 0.22), ("#3fb8d8", 0.12), ("#f2fbfb", 0.08)]
        ),
        "mosaic_band": lambda: mosaic_band(colours=("#ff7eb3", "#ffa6c9", "#ffd23f", "#fff8ee")),
        "hedge": hedge,
        "groundcover": groundcover,
        "conifer": lambda: tufts("conifer", "#162f22", "#2c5534", "#5f8a48", 48, 131, 6.0),
        "palm_frond": palm_frond,
        "hydrangea": lambda: flower_cluster(
            "hydrangea", ["#9fc3ff", "#c4a8ff", "#ff9fc8", "#b9d4ff"], ["#3f7d34", "#2f6a2c", "#55903f"], seed=17, n_flowers=70, flower_r=(0.035, 0.06)
        ),
        "hibiscus": lambda: flower_cluster(
            "hibiscus", ["#ff5a7a", "#ff8a5c", "#ffd23f"], ["#2f6a2c", "#3f7d34", "#4c8a3a"], seed=9, n_flowers=12, n_leaves=40, flower_r=(0.07, 0.1)
        ),
    }
    only = args()
    for name, job in jobs.items():
        if not only or name in only:
            job()
