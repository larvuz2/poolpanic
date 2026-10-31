"""Splash Park's tiling textures and cut-out pictures, computed with numpy (the Harbourside's noise and tile tools,
godot/tools/blender/textures.py), into WORK/textures: <set>_albedo.png and <set>_normal.png (OpenGL, green up) for every tile set
in kit.TILES, and <name>_alpha.png for the cut-outs (palm fronds, bougainvillea, hibiscus). Every tile set tiles seamlessly.

    blender -b -P tools/venues/splash/splash_textures.py [-- name ...]
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403  (the shared ones: glass mosaic, mosaic band, hedge, tufts, ground cover, cut-outs)
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile
rng = np.random.default_rng(2026)


# ---- the deck: travertine pavers, 60 x 40 cm in running bond, pitted and veined, warm cream to honey ------------------------
def travertine(size=1024):
    # 2.4 m a repeat: 60 cm squares, 4 x 4, laid square (a resort's stone deck)
    ix, iy, lu, lv, h = tile_grid(size, 4, 4, grout=0.016, bevel=0.035)
    r1, r2, r3, r4 = per_tile(ix, iy, 31, 4)
    # (close tones: from the game's height a stronger spread reads as a checkerboard)
    tones = np.stack([hexrgb(c) for c in ("#ebdcc0", "#e8d7b8", "#eee1c9", "#e6d3b2", "#ecdcbe")])
    col = tones[(r1 * len(tones)).astype(int) % len(tones)]
    col = col * (0.975 + 0.035 * r2[..., None])
    # faint strata across each slab (the stone's bedding), at a per-slab phase and slant
    warp = noise(size, 6, 32, 3)
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    turn = np.where(r4 < 0.5, ys, xs)  # half the slabs laid turned
    strata = np.sin((turn * 4 * 9 + warp * 2.2 + r3 * 20) * math.pi) * 0.5 + 0.5
    strata = strata**3
    col = col * (0.985 + 0.03 * strata[..., None]) - np.array([0.0, 0.006, 0.014]) * strata[..., None]
    mott = noise(size, 12, 33, 4)
    col = col * (0.955 + 0.07 * mott[..., None])
    # pits: small dark holes, filled travertine's honest flaw
    pits = noise(size, 192, 34, 2)
    pit = np.clip((pits - 0.8) / 0.05, 0, 1) * (noise(size, 24, 35, 2) > 0.5)
    col = col * (1 - 0.25 * pit[..., None])
    grout = hexrgb("#d9c6a3") * (0.94 + 0.06 * noise(size, 64, 36, 2)[..., None])
    albedo = col * h[..., None] + grout * (1 - h[..., None])
    grit = noise(size, 256, 37, 1)
    height = h * 0.88 + 0.07 * grit * h + 0.05 * strata * h - 0.25 * pit * h
    tile_set("travertine", albedo, height, 3.2)


# ---- stucco: warm lime render, softly trowelled ---------------------------------------------------------------------------------
def stucco(size=1024):
    n1 = noise(size, 4, 61, 5, 0.55)
    n2 = noise(size, 48, 62, 3)
    n3 = noise(size, 12, 63, 3)
    base = hexrgb("#f6ecda")
    albedo = base * (0.94 + 0.06 * n1[..., None] + 0.03 * n2[..., None]) - np.array([0.0, 0.01, 0.025]) * n3[..., None]
    height = n1 * 0.5 + n2 * 0.35 + n3 * 0.15
    tile_set("stucco", albedo, height, 1.8)


# ---- teak: oiled boards along x, 1 m a repeat ---------------------------------------------------------------------------------------
def teak(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    rows = 8
    plank = np.floor(ys / size * rows).astype(int)
    r = np.random.default_rng(71).random((rows, 3)).astype(np.float32)
    lv = (ys / size * rows) % 1
    warp = noise(size, 4, 72, 3)
    rings = np.sin((lv * 7 + warp * 7 + r[plank, 0] * 10) * math.pi * 2) * 0.5 + 0.5
    fine = noise(size, 128, 73, 1)
    light, dark = hexrgb("#c48a52"), hexrgb("#93582e")
    t = np.clip(0.5 * rings + 0.35 * fine, 0, 1)
    col = light * (1 - t[..., None]) + dark * t[..., None]
    col *= (0.9 + 0.14 * r[plank, 1])[..., None]
    gap = np.clip(np.minimum(lv, 1 - lv) / 0.03, 0, 1)
    col *= (0.5 + 0.5 * gap)[..., None]
    tile_set("teak", col, gap * 0.85 + 0.15 * rings * gap, 2.2)


# ---- cobble: rough sandstone blocks for the plinth and the paths -------------------------------------------------------------------
def cobble(size=512):
    ix, iy, lu, lv, h = tile_grid(size, 3, 5, grout=0.05, bevel=0.12, offset_rows=True)
    r1, r2 = per_tile(ix, iy, 91, 2)
    base = hexrgb("#d6bf98")
    col = base * (0.86 + 0.18 * r1[..., None])
    rough = noise(size, 32, 92, 3)
    col *= (0.9 + 0.14 * rough)[..., None]
    grout = hexrgb("#9d8a6c")
    albedo = col * h[..., None] + grout * (1 - h[..., None])
    tile_set("cobble", albedo, h * 0.8 + rough * 0.2 * h, 4.0)


if __name__ == "__main__":
    jobs = {
        "travertine": travertine,
        "glass_mosaic": glass_mosaic,
        "mosaic_band": mosaic_band,
        "stucco": stucco,
        "teak": teak,
        "hedge": hedge,
        "cobble": cobble,
        "pine": lambda: tufts("pine", "#1d3a24", "#3b6a35", "#8fae5a", 20, 121, 5.0),
        "conifer": lambda: tufts("conifer", "#162f22", "#2c5534", "#5f8a48", 48, 131, 6.0),
        "groundcover": groundcover,
        "palm_frond": palm_frond,
        "bougainvillea": lambda: flower_cluster("bougainvillea", ["#d6337f", "#e2559a", "#c22a6e", "#ec7ab0"], ["#3f7d34", "#2f6a2c", "#55903f"], seed=7, n_flowers=60),
        "hibiscus": lambda: flower_cluster("hibiscus", ["#e0412f", "#f26b3a", "#f4c849"], ["#2f6a2c", "#3f7d34", "#4c8a3a"], seed=9, n_flowers=12, n_leaves=40, flower_r=(0.07, 0.1)),
    }
    only = args()
    for name, job in jobs.items():
        if not only or name in only:
            job()
