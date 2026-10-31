"""The Aqua Disco's tiling textures and cut-outs (numpy), into its work folder: the shared ones (tools/venues/common/
venue_textures.py) in the disco's colours, and its own: the glass dance floor, buttoned velvet, acoustic slats, speaker cloth,
mirror mosaic and black terrazzo.

    blender -b -P tools/venues/disco/disco_textures.py [-- name ...]
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile


# ---- the deck: 50 cm squares of black glass in thin chrome joints, some lit softly from inside in the club's colours -------------
def glassfloor(size=1024):
    n = 4  # 2 m a repeat
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.012, bevel=0.015)
    r1, r2, r3 = per_tile(ix, iy, 701, 3)
    base = hexrgb("#16101f")
    tints = [hexrgb(c) for c in ("#ff3fb4", "#34e6ff", "#8f6bff", "#ffd24a")]
    lit = r1 > 0.55  # about half the squares glow
    tint = np.stack(tints)[(r2 * len(tints)).astype(int) % len(tints)]
    # a soft glow from the square's middle, as from a lamp under the glass
    d = np.sqrt((lu - 0.5) ** 2 + (lv - 0.5) ** 2) / 0.707
    glow = np.clip(1 - d, 0, 1) ** 1.6 * (0.22 + 0.2 * r3)
    col = base[None, None, :] * (0.9 + 0.1 * r3[..., None])
    col = np.where(lit[..., None], col + tint * glow[..., None], col)
    # the glass: a faint diagonal streak of reflection and a fine sparkle
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    streak = np.clip(1 - np.abs(((lu + lv) % 1) - 0.35) / 0.08, 0, 1) * 0.04
    sparkle = (noise(size, 256, 702, 1) > 0.93) * 0.03
    col = col + streak[..., None] + sparkle[..., None]
    joint = hexrgb("#6a6878")
    albedo = col * h[..., None] + joint * (1 - h[..., None])
    height = h * 0.9 + 0.1 * noise(size, 64, 703, 2) * h
    tile_set("glassfloor", albedo, height, 1.6)


# ---- buttoned velvet: diamonds pulled in to a button at each corner, a sheen across each puff ----------------------------------
def quilt(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    n = 4  # 4 diamonds across 0.9 m
    u = (xs + ys) * n % 1
    v = (xs - ys) * n % 1
    puff = np.sin(u * math.pi) * np.sin(v * math.pi)
    seam = np.clip(np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v)) / 0.06, 0, 1)
    bu, bv = np.abs(u - 0) , np.abs(v - 0)
    du = np.minimum(u, 1 - u)
    dv = np.minimum(v, 1 - v)
    button = np.clip(1 - np.sqrt(du**2 + dv**2) / 0.06, 0, 1)
    nap = noise(size, 128, 711, 2)
    base = hexrgb("#ffffff")  # (neutral: tinted per wall, T_quilt@rrggbb)
    shade = 0.45 + 0.55 * puff**0.6
    col = base * shade[..., None] * (0.92 + 0.08 * nap[..., None])
    col = col * (0.7 + 0.3 * seam[..., None])
    col = col * (1 - 0.5 * button[..., None]) + hexrgb("#d9a441") * 0.5 * button[..., None]
    height = puff * 0.8 * seam + 0.2 * nap
    tile_set("quilt", col, height, 3.0)


# ---- acoustic slats: vertical timber slats over dark felt, 1.2 m a repeat ---------------------------------------------------------
def acoustic(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    n = 16
    lu = (xs * n) % 1
    slat = (lu > 0.28).astype(np.float32)
    r = np.random.default_rng(721).random(n).astype(np.float32)
    tone = r[(xs * n).astype(int) % n]
    wood = hexrgb("#2b2034") * (0.9 + 0.2 * tone[..., None]) * (0.95 + 0.08 * noise(size, 64, 722, 2)[..., None])
    felt = hexrgb("#0b0812") * (0.9 + 0.1 * noise(size, 128, 723, 1)[..., None])
    edge = np.clip(np.minimum(lu - 0.28, 1 - lu) / 0.06, 0, 1)
    col = np.where(slat[..., None] > 0, wood * (0.75 + 0.25 * edge[..., None]), felt)
    tile_set("acoustic", col, slat * (0.6 + 0.4 * edge), 2.5)


# ---- speaker cloth: a fine black weave -------------------------------------------------------------------------------------------
def grille(size=256):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    n = 48
    w = (np.sin(xs * n * math.pi * 2) * np.sin(ys * n * math.pi * 2)) * 0.5 + 0.5
    col = hexrgb("#1c1a22") * (0.75 + 0.35 * w[..., None])
    tile_set("grille", col, w, 1.5)


# ---- mirror mosaic: 3 cm squares of mirror, each at its own tilt (its own brightness), dark joints -------------------------------
def mirrortile(size=512):
    n = 20
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.08, bevel=0.06)
    r1, r2 = per_tile(ix, iy, 731, 2)
    silver = hexrgb("#e8ecf6") * (0.55 + 0.45 * r1[..., None])
    tint = np.stack([hexrgb(c) for c in ("#ffd1f0", "#d6fbff", "#e8e0ff", "#fff2c8")])[(r2 * 4).astype(int) % 4]
    col = silver * (0.8 + 0.2 * tint)
    joint = hexrgb("#141218")
    albedo = col * h[..., None] + joint * (1 - h[..., None])
    tile_set("mirrortile", albedo, h, 2.0)


# ---- black terrazzo with gold and white chips ---------------------------------------------------------------------------------------
def terrazzo(size=512):
    base = hexrgb("#16131c") * (0.9 + 0.12 * noise(size, 8, 741, 3)[..., None])
    col = base.copy()
    for k, (c, thr) in enumerate((("#d9a441", 0.86), ("#f1e6d6", 0.88), ("#6a4a9a", 0.87))):
        chip = noise(size, 96 + k * 24, 742 + k, 1)
        m = chip > thr
        col[m] = hexrgb(c) * (0.85 + 0.15 * np.random.default_rng(743 + k).random())
    tile_set("terrazzo", col, noise(size, 128, 746, 1) * 0.3, 1.0)


if __name__ == "__main__":
    jobs = {
        "glassfloor": glassfloor,
        "quilt": quilt,
        "acoustic": acoustic,
        "grille": grille,
        "mirrortile": mirrortile,
        "terrazzo": terrazzo,
        "glass_mosaic": lambda: glass_mosaic(
            blend=[("#1f6fd6", 0.3), ("#2f8fe8", 0.24), ("#7fc8ff", 0.16), ("#123c8a", 0.16), ("#dfe6f6", 0.14)]
        ),
        "mosaic_band": lambda: mosaic_band(colours=("#2a1650", "#8f6bff", "#ff3fb4", "#ffd24a")),
        "palm_frond": palm_frond,
    }
    only = args()
    for name, job in jobs.items():
        if not only or name in only:
            job()
