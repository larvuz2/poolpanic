"""The Aquatic Centre's tiling textures (numpy), into its work folder: the shared ones (tools/venues/common/venue_textures.py) in the
centre's colours, and its own: the deck's white anti-slip tiles (a blue line every metre, the odd chipped tile), blue-grey sports
flooring for the hall, perforated acoustic panels, moulded seat plastic (neutral: tinted per section), board-marked concrete, teak.

    blender -b -P tools/venues/aquatic/aquatic_textures.py [-- name ...]
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile


# ---- the deck: 15 cm white anti-slip tiles, grey grout, a pale blue tile row every 1.2 m, a few chipped corners -------------------
def deck(size=1024):
    n = 8  # 1.2 m a repeat
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.028, bevel=0.05)
    r1, r2, r3 = per_tile(ix, iy, 801, 3)
    white = hexrgb("#eef3f6") * (0.96 + 0.05 * r1[..., None])
    blue = hexrgb("#b4cfe9") * (0.95 + 0.06 * r1[..., None])
    col = np.where(((iy % n) == 0)[..., None], blue, white)
    # the anti-slip grit: fine bumps, slightly darker
    grit = noise(size, 384, 802, 1)
    col = col * (0.97 + 0.04 * grit[..., None])
    # a few chipped corners (darker, rougher)
    chip = (r2 > 0.93) & (lu < 0.22) & (lv < 0.22) & ((lu + lv) < 0.25)
    col = np.where(chip[..., None], hexrgb("#9aa4ad"), col)
    # faint water stains near the grout
    stain = noise(size, 6, 803, 3) * 0.02
    col = col - stain[..., None]
    grout = hexrgb("#b6c3cc") * (0.95 + 0.05 * noise(size, 64, 804, 2)[..., None])
    albedo = col * h[..., None] + grout * (1 - h[..., None])
    height = h * (0.85 + 0.1 * grit) - chip * 0.4
    tile_set("deck", albedo, height, 3.0)


# ---- the hall's floor: blue-grey sports flooring with a fleck, painted court lines faint under the scuffs --------------------------
def rubberfloor(size=512):
    base = hexrgb("#3a5770") * (0.92 + 0.1 * noise(size, 6, 811, 3)[..., None])
    fleck = noise(size, 256, 812, 1)
    col = base * (0.95 + 0.06 * fleck[..., None])
    col = np.where((fleck > 0.88)[..., None], hexrgb("#7f98b0"), col)
    scuff = np.clip((noise(size, 24, 813, 2) - 0.7) * 3, 0, 1) * 0.12
    col = col * (1 - scuff[..., None])
    tile_set("rubberfloor", col, fleck * 0.3, 1.0)


# ---- acoustic panels: white boards 1.2 m wide in a grid of perforations, shadow joints ----------------------------------------------
def panel(size=1024):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    pu, pv = (xs * 2) % 1, (ys * 1) % 1
    joint = np.clip(np.minimum(np.minimum(pu, 1 - pu), np.minimum(pv, 1 - pv)) / 0.008, 0, 1)
    holes = (np.sin(xs * 2 * math.pi * 80) * np.sin(ys * 2 * math.pi * 80)) > 0.85
    border = (np.minimum(np.minimum(pu, 1 - pu), np.minimum(pv, 1 - pv)) > 0.06)
    col = hexrgb("#e8eef3") * (0.96 + 0.04 * noise(size, 8, 821, 3)[..., None])
    col = np.where((holes & border)[..., None], hexrgb("#9aa6b2"), col)
    col = col * (0.55 + 0.45 * joint[..., None])
    tile_set("panel", col, joint * 0.8 + (1 - (holes & border)) * 0.2, 2.0)


# ---- moulded seat plastic: a soft sheen across, scuffed; neutral (tinted per section, T_seats@rrggbb) -----------------------------
def seats(size=256):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    sheen = 0.88 + 0.12 * np.sin(ys * math.pi) ** 2
    scuff = noise(size, 32, 831, 2)
    col = hexrgb("#ffffff") * (sheen * (0.95 + 0.05 * scuff))[..., None]
    tile_set("seats", col, scuff * 0.2, 0.8)


# ---- board-marked concrete for the stands: the planks' imprint, pores, a few drips ---------------------------------------------------
def concrete(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    plank = np.floor(ys * 10).astype(int)
    r = np.random.default_rng(841).random(10).astype(np.float32)
    base = hexrgb("#b8bfc6") * (0.9 + 0.1 * r[plank][..., None])
    grain = noise(size, 48, 842, 3)
    pores = (noise(size, 256, 843, 1) > 0.9) * 0.15
    col = base * (0.92 + 0.1 * grain[..., None]) * (1 - pores[..., None])
    seam = np.clip(np.abs(((ys * 10) % 1) - 0.5) * 2 - 0.94, 0, 1) * 8
    col = col * (1 - 0.25 * seam[..., None])
    tile_set("concrete", col, grain * 0.5 - seam * 0.3, 1.5)


# ---- glazed wall tiles: 10 cm white, a cool sheen, grey grout, now and then a blue one (and the odd one cracked) ----------------------
def walltile(size=512):
    n = 10
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.035, bevel=0.08)
    r1, r2, r3 = per_tile(ix, iy, 851, 3)
    white = hexrgb("#f4f8fa") * (0.95 + 0.06 * r1[..., None])
    col = np.where((r2 > 0.94)[..., None], hexrgb("#3a87d2") * (0.95 + 0.05 * r1[..., None]), white)
    col = np.where(((r2 > 0.9) & (r2 <= 0.94))[..., None], hexrgb("#a9d0ee"), col)
    sheen = np.clip(1 - np.abs(lu - lv) * 3, 0, 1) * 0.04
    col = col + sheen[..., None]
    crack = (r3 > 0.97) & (np.abs(lu - lv * 0.7 - 0.15) < 0.012)
    col = np.where(crack[..., None], hexrgb("#8a96a0"), col)
    grout = hexrgb("#b9c4cc")
    albedo = col * h[..., None] + grout * (1 - h[..., None])
    tile_set("walltile", albedo, h - crack * 0.3, 2.0)


# ---- teak (Splash Park's) ------------------------------------------------------------------------------------------------------------
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


if __name__ == "__main__":
    jobs = {
        "deck": deck,
        "rubberfloor": rubberfloor,
        "panel": panel,
        "seats": seats,
        "concrete": concrete,
        "teak": teak,
        "walltile": walltile,
        "glass_mosaic": lambda: glass_mosaic(
            blend=[("#2a76c6", 0.34), ("#3a87d2", 0.26), ("#5aa8ea", 0.16), ("#1d5aa6", 0.14), ("#cfe6f6", 0.1)]
        ),
        "mosaic_band": lambda: mosaic_band(colours=("#10284a", "#1f5fd1", "#5aa8ea", "#f4f8fb")),
        "palm_frond": palm_frond,
    }
    only = args()
    for name, job in jobs.items():
        if not only or name in only:
            job()
