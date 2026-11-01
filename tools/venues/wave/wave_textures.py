"""The Wave Pool's tiling textures and cut-outs (numpy), into its work folder. Two from the classic venue's photographs
(dist/assets/wave/: the coral-stone pavers, the rippled sand), graded for the late-afternoon sun; the rest made here: glazed Malibu
tile (stars and quatrefoils, cobalt, sunshine, coral and teal on cream, raised outlines in the 1930s California way), the aqua glass
mosaic of the pool and its waterline band, and from the earlier venues' scripts the stucco (Splash Park's), the boardwalk, the
thatch and teak (the Sunset Lagoon's), palm fronds, beach grass, hibiscus and bougainvillea; and the breeze blocks' cut-out (the
end walls are screens of mid-century breeze block).

    blender -b -P tools/venues/wave/wave_textures.py [-- name ...]
"""

import os, sys, math, importlib.util
import numpy as np

WAVE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, WAVE_DIR)
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile, save, cutout

PHOTOS = os.path.join(REPO, "dist", "assets", "wave")


def borrow(venue, file):
    """An earlier venue's textures script as a module (it finds this venue's kit, already loaded as `kit`)."""
    spec = importlib.util.spec_from_file_location(venue + "_tex", os.path.join(WAVE_DIR, "..", venue, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def photo(file, size):
    """A photograph from the classic venue as an array (rows top-down, sRGB values as stored), `size` square."""
    img = bpy.data.images.load(os.path.join(PHOTOS, file))
    img.scale(size, size)
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(size, size, 4)[::-1, :, :3]


def lum(rgb):
    return rgb @ np.array([0.3, 0.55, 0.15], np.float32)


# ---- the deck: coquina pavers, each its own warmth, shells and pits in the stone, the joints a little sandy ------------------------
def pavers(size=1024):
    p = photo("coral-stone.jpg", size)
    l = lum(p)
    # each paver its own shade: the photo's bond is 4 across, 6 down; a per-cell tint from the cell index
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    row = np.floor(ys * 6).astype(int)
    col_i = np.floor((xs + (row % 2) * 0.125) * 4).astype(int) % 4
    rng = np.random.default_rng(311)
    tint = rng.random((6, 4, 3)).astype(np.float32)
    t = tint[row % 6, col_i]
    warm = np.stack([1.0 + 0.05 * t[..., 0], 0.985 + 0.03 * t[..., 1], 0.95 + 0.04 * t[..., 2]], -1)
    col = p * warm * (0.94 + 0.08 * t[..., :1])
    # coquina: little shells (pale crescents) and dark pits
    fl = noise(size, 320, 312, 1)
    shell = np.clip((fl - 0.9) / 0.03, 0, 1) * (noise(size, 40, 313, 2) > 0.5)
    pit = np.clip((noise(size, 256, 314, 1) - 0.9) / 0.03, 0, 1) * (noise(size, 28, 315, 2) > 0.55)
    col = col * (1 - 0.6 * shell[..., None]) + hexrgb("#fff7ea") * 0.6 * shell[..., None]
    col = col * (1 - 0.35 * pit[..., None])
    # sun-bleached middles, sandy joints (the photo's joints are its brightest lines)
    joint = np.clip((l - np.percentile(l, 97)) * 12, 0, 1)
    col = col * (1 - joint[..., None] * 0.6) + hexrgb("#d9be8c") * joint[..., None] * 0.6
    height = (1 - joint) * 0.8 + 0.2 * l - 0.3 * pit
    tile_set("pavers", col, height, 2.2)


# ---- Malibu tile: 15 cm glazed tiles, two motifs in a checker, raised outlines, a glaze with a little crazing ------------------------
def malibu(size=1024):
    n = 4  # 0.6 m a repeat
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.045, bevel=0.06)
    r1, r2 = per_tile(ix, iy, 321, 2)
    cx, cy = lu - 0.5, lv - 0.5
    r = np.hypot(cx, cy)
    a = np.arctan2(cy, cx)
    cream, navy, sun, coral, teal, cobalt = (
        hexrgb(c) for c in ("#f4e7c9", "#173f58", "#ffc93c", "#e2574a", "#1f9aa0", "#2a5fa8")
    )
    star = (ix + iy) % 2 == 0
    # motif A, an eight-pointed star: sunshine, a teal heart, a cobalt ring round it
    s = 0.2 + 0.17 * (0.5 + 0.5 * np.cos(8 * a)) ** 2.2
    inA = r < s
    lineA = np.abs(r - s) < 0.022
    ringA = np.abs(r - 0.33) < 0.03
    # motif B, a quatrefoil: coral petals, a sunshine heart
    q = 0.31 * (0.6 + 0.4 * np.abs(np.cos(2 * a)) ** 0.7)
    inB = r < q
    lineB = np.abs(r - q) < 0.022
    # the corners: quarter circles that make rings where four tiles meet
    cr = np.hypot(np.minimum(lu, 1 - lu), np.minimum(lv, 1 - lv))
    corner = cr < 0.17
    cornerLine = np.abs(cr - 0.17) < 0.02
    col = np.broadcast_to(cream, lu.shape + (3,)).copy()
    sel = lambda m, c: np.where(m[..., None], c, col)  # noqa: E731
    col = sel(corner, teal)
    col = sel(star & inA, sun)
    col = sel(star & (r < 0.075), teal)
    col = sel(star & ringA & ~inA, cobalt)
    col = sel(~star & inB, coral)
    col = sel(~star & (r < 0.09), sun)
    outline = (star & (lineA | (np.abs(r - 0.075) < 0.016))) | (~star & (lineB | (np.abs(r - 0.09) < 0.016))) | cornerLine
    col = sel(outline, navy)
    col = col * (0.93 + 0.09 * r2[..., None])
    # the glaze: a soft highlight, pooled colour at the outlines, fine crazing
    glaze = 1 + 0.06 * np.exp(-(((lu - 0.3) ** 2 + (lv - 0.28) ** 2) / 0.06))[..., None]
    craze = noise(size, 96, 322, 1)
    crazing = (np.abs(craze - 0.5) < 0.008) * 0.12
    grout = hexrgb("#e2d8c4")
    albedo = (col * glaze * (1 - crazing[..., None])) * h[..., None] + grout * (1 - h[..., None])
    height = h * 0.8 + outline * 0.12 * h + 0.03 * noise(size, 32, 323, 2) * h
    tile_set("malibu", albedo, height, 2.6)


# ---- the beach: the photo's ripples, paler and finer, a few shells ---------------------------------------------------------------
def sand(size=1024):
    p = photo("sand.jpg", size)
    l = lum(p)
    base = hexrgb("#ecd3a2")
    k = (l - l.mean()) / max(1e-3, l.std())
    col = base * (0.97 + 0.075 * k)[..., None] * 0.9 + p * 0.1
    col = col * (0.95 + 0.08 * noise(size, 3, 333, 3))[..., None]
    fl = noise(size, 256, 331, 1)
    shell = np.clip((fl - 0.9) / 0.03, 0, 1) * (noise(size, 32, 332, 2) > 0.6)
    col = col * (1 - shell[..., None] * 0.7) + hexrgb("#fff6ea") * shell[..., None] * 0.7
    tile_set("sand", np.clip(col, 0, 1), l + shell * 0.2, 1.6)


# ---- the breeze blocks: a 4×4 screen of 30 cm blocks, each a circle in a square with four petals cut out round it ------------------
def breeze(size=512):
    # (one panel: 4 blocks across, 3 high; the atlas never repeats a picture, so a panel is one picture)
    W, H = size, size * 3 // 4
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    lu, lv = (xs / W * 4) % 1, (ys / H * 3) % 1
    cx, cy = lu - 0.5, lv - 0.5
    r = np.hypot(cx, cy)
    a = np.arctan2(cy, cx)
    # the openings: four leaf shapes round a solid ring, a solid frame
    petal = r < 0.42 * np.abs(np.cos(2 * (a - math.pi / 4))) ** 0.6
    hole = petal & (r > 0.16) & (np.minimum(np.minimum(lu, 1 - lu), np.minimum(lv, 1 - lv)) > 0.07)
    alpha = (~hole).astype(np.float32)
    shade = 0.9 + 0.1 * noise(size, 32, 341, 2)[:H]
    rim = np.clip(1 - np.abs(r - 0.16) / 0.03, 0, 1)
    col = hexrgb("#f4ecdc") * (shade * (1 - 0.15 * rim))[..., None]
    cutout("breeze", col, alpha)


TEAK = None


def jobs():
    lagoon = borrow("lagoon", "lagoon_textures.py")
    splash = borrow("splash", "splash_textures.py")
    return {
        "pavers": pavers,
        "malibu": malibu,
        "sand": sand,
        "glass_mosaic": lambda: glass_mosaic(
            blend=[("#68d8d6", 0.3), ("#44c6cc", 0.26), ("#a6ece6", 0.2), ("#239fbd", 0.14), ("#eefaf6", 0.1)]
        ),
        "mosaic_band": lambda: mosaic_band(colours=("#174958", "#1f9aa0", "#e2574a", "#fff1d8")),
        "stucco": splash.stucco,
        "teak": lagoon.teak,
        "boardwalk": lagoon.boardwalk,
        "thatch": lagoon.thatch,
        "breeze": breeze,
        "palm_frond": palm_frond,
        "beach_grass": lagoon.beach_grass,
        "hibiscus": lambda: flower_cluster(
            "hibiscus", ["#e8344a", "#ff6a5a", "#ffc93c"], ["#2f6a2c", "#3f7d34", "#4c8a3a"], seed=9, n_flowers=12, n_leaves=40, flower_r=(0.07, 0.1)
        ),
        "bougainvillea": lambda: flower_cluster(
            "bougainvillea", ["#d6337f", "#e2559a", "#c22a6e", "#ec7ab0"], ["#3f7d34", "#2f6a2c", "#55903f"], seed=7, n_flowers=60
        ),
    }


if __name__ == "__main__":
    only = args()
    for name, job in jobs().items():
        if not only or name in only:
            job()
