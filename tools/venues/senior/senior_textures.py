"""Senior Aqua Fit's tiling textures and cut-outs (numpy), into its work folder. Two from the classic venue's photographs
(dist/assets/senior/: the travertine deck, the art-deco fan mosaic of the pool); the rest made here: white marble with grey veins,
cream brick, raked gravel, the cast-iron lace in the arches' spandrels (a cut-out), a fern's frond, ivy; and from the earlier venues'
scripts the stucco (Splash Park's), teak (the Sunset Lagoon's), the frieze's mosaic band, clipped hedge, ground cover, palm fronds,
roses and lavender (the common kit).

    blender -b -P tools/venues/senior/senior_textures.py [-- name ...]
"""

import os, sys, math, importlib.util
import numpy as np

SENIOR_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SENIOR_DIR)
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile, save, cutout, tufts

PHOTOS = os.path.join(REPO, "dist", "assets", "senior")


def borrow(venue, file):
    spec = importlib.util.spec_from_file_location(venue + "_tex", os.path.join(SENIOR_DIR, "..", venue, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def photo(file, w, h=None):
    h = h or w
    img = bpy.data.images.load(os.path.join(PHOTOS, file))
    img.scale(w, h)
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[::-1, :, :3]


def lum(rgb):
    return rgb @ np.array([0.3, 0.55, 0.15], np.float32)


def travertine(size=1024):
    p = photo("travertine.jpg", size)
    l = lum(p)
    # (warmer, the joints a touch deeper: the late sun lies across it)
    col = p * np.array([1.02, 1.0, 0.96], np.float32)
    joint = np.clip((np.percentile(l, 4) + 0.05 - l) * 6, 0, 1)
    col = col * (1 - joint[..., None] * 0.25)
    tile_set("travertine", col, l * 0.6 + (1 - joint) * 0.4, 1.6)


def fanmosaic(size=1024):
    p = photo("mosaic.jpg", size)
    tile_set("fanmosaic", p, lum(p), 2.2)


# ---- white marble: soft grey veins wandering through it, a warm cast, a polish ------------------------------------------------------
def marble(size=1024):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    warp = noise(size, 3, 711, 5, 0.6)
    warp2 = noise(size, 8, 712, 4)
    v = np.sin((xs * 2 + ys * 1 + warp * 2.6 + warp2 * 0.6) * math.pi * 2)
    veins = np.exp(-np.abs(v) * 9) * 0.7 + np.exp(-np.abs(np.sin((xs * 1 - ys * 3 + warp2 * 3.1) * math.pi * 2)) * 18) * 0.35
    cloud = noise(size, 6, 713, 4)
    base = hexrgb("#f3efe7") * (0.96 + 0.05 * cloud[..., None])
    vein = hexrgb("#9a968e")
    col = base * (1 - veins[..., None] * 0.55) + vein * veins[..., None] * 0.55
    col = col * (1 + np.array([0.01, 0.0, -0.015], np.float32))
    tile_set("marble", col, 0.5 + 0.1 * cloud - 0.1 * veins, 0.6)


# ---- cream brick: Flemish-ish courses, each brick its own shade, sandy mortar ---------------------------------------------------------
def brick(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    rows = 16  # 7.5 cm courses, 1.2 m a repeat
    row = np.floor(ys * rows).astype(int)
    lv = (ys * rows) % 1
    off = (row % 2) * 0.5
    n = 5
    lu = ((xs * n + off) % 1)
    bi = np.floor(xs * n + off).astype(int) % n
    r = np.random.default_rng(721).random((rows, n, 2)).astype(np.float32)
    shade = r[row % rows, bi, 0]
    base = hexrgb("#e9d9bb") * (0.88 + 0.16 * shade[..., None])
    base = base * (0.95 + 0.06 * noise(size, 64, 722, 2)[..., None])
    mortar = np.minimum(np.minimum(lv, 1 - lv) / 0.08, np.minimum(lu, 1 - lu) / 0.02)
    m = np.clip(mortar, 0, 1)
    col = base * m[..., None] + hexrgb("#d8ccb2") * (1 - m[..., None])
    tile_set("brick", col, m * 0.8 + 0.2 * noise(size, 32, 723, 2), 2.4)


# ---- raked gravel: pale pea shingle --------------------------------------------------------------------------------------------------
def gravel(size=512):
    g1 = noise(size, 160, 731, 1)
    g2 = noise(size, 64, 732, 2)
    peb = np.clip((g1 - 0.45) * 3, 0, 1)
    col = hexrgb("#d7cbb2") * (0.8 + 0.3 * peb[..., None]) * (0.95 + 0.08 * g2[..., None])
    tile_set("gravel", col, peb * 0.8 + 0.2 * g2, 2.0)


# ---- the iron lace in the arches' spandrels: scrolls and a fleuron in a quarter-arch, white cast iron ---------------------------------
def iron_lace(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    alpha = np.zeros((size, size), np.float32)
    # the frame: the arch's quarter circle (the spandrel is the square minus the circle) and its two straight edges
    r = np.hypot(xs, ys)  # (the arch's centre at the picture's top-left corner: the column's side)
    frame = (np.abs(r - 0.98) < 0.025) | (xs > 0.965) | (ys > 0.965)
    inside = r > 0.98
    # scrolls: rings and spirals sprinkled in the spandrel, a fleuron at the corner
    for cx, cy, rr in ((0.82, 0.82, 0.12), (0.62, 0.9, 0.08), (0.9, 0.62, 0.08), (0.45, 0.97, 0.05), (0.97, 0.45, 0.05)):
        d = np.hypot(xs - cx, ys - cy)
        a = np.arctan2(ys - cy, xs - cx)
        spiral = np.abs(d - rr * (0.4 + 0.6 * ((a + math.pi) / (2 * math.pi)))) < 0.012
        frame |= spiral & inside
        frame |= (np.abs(d - rr) < 0.012) & inside
    frame |= (np.hypot(xs - 0.94, ys - 0.94) < 0.03)
    alpha = frame.astype(np.float32)
    col = np.broadcast_to(hexrgb("#f4f1e8"), (size, size, 3)) * (0.92 + 0.08 * noise(size, 16, 741, 2))[..., None]
    cutout("iron_lace", col, alpha)


# ---- a fern's frond: leaflets either side of a curving stem -------------------------------------------------------------------------
def fern(w=512, h=128):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xs / w, ys / h - 0.5
    stem = np.abs(v - 0.06 * np.sin(u * 3)) < 0.012
    k = (u * 34) % 1
    width = 0.42 * np.sin(np.clip(u, 0, 1) * math.pi) ** 0.7
    leaf = (np.abs(v) < width * (0.25 + 0.75 * np.abs(np.sin(k * math.pi)))) & (np.abs(v) > 0.01)
    alpha = (stem | leaf).astype(np.float32)
    col = np.broadcast_to(hexrgb("#4f8a3e"), (h, w, 3)) * (0.75 + 0.35 * (1 - np.abs(v)[..., None] * 1.5))
    cutout("fern", col, alpha)


def jobs():
    lagoon = borrow("lagoon", "lagoon_textures.py")
    splash = borrow("splash", "splash_textures.py")
    return {
        "travertine": travertine,
        "fanmosaic": fanmosaic,
        "marble": marble,
        "mosaic_band": lambda: mosaic_band(colours=("#143d33", "#1f5c4a", "#c9a14a", "#f3ead8")),
        "stucco": splash.stucco,
        "brick": brick,
        "teak": lagoon.teak,
        "gravel": gravel,
        "groundcover": groundcover,
        "hedge": hedge,
        "canopy": lambda: tufts("canopy", "#24502b", "#4a8f3c", "#a7cf62", 28, 321, 5.0),
        "conifer": lambda: tufts("conifer", "#162f22", "#2c5534", "#5f8a48", 48, 131, 6.0),
        "iron_lace": iron_lace,
        "fern": fern,
        "palm_frond": palm_frond,
        "roses": lambda: flower_cluster("roses", ["#f6a8bd", "#fff1e6", "#e2566e", "#ffd3a5"], ["#3f6b3a", "#4f7f45"], seed=4, n_flowers=26),
        "lavender": lambda: flower_cluster("lavender", ["#8c78c8", "#a58fd8", "#7a66b8"], ["#6f8f5a", "#5f7f4a"], seed=5, n_flowers=50, flower_r=(0.02, 0.035)),
        "geranium": lambda: flower_cluster("geranium", ["#e2384f", "#ff6f86", "#d02a40"], ["#3f7a34", "#4c8a3a"], seed=6, n_flowers=18),
    }


if __name__ == "__main__":
    only = args()
    for name, job in jobs().items():
        if not only or name in only:
            job()
