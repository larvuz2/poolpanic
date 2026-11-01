"""The Mountain Hot Springs' tiling textures (numpy), into its work folder. Four from the classic venue's photographs
(dist/assets/onsen/: the stone path, the snow, the rock, the springs' pebbled floor), graded for the blue hour; the rest made here:
pale hinoki boards, charred cedar boards (yakisugi), white lime plaster, grey kawara roof tiles, cedar bark, the cedars' needles.

    blender -b -P tools/venues/onsen/onsen_textures.py [-- name ...]
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile

PHOTOS = os.path.join(REPO, "dist", "assets", "onsen")


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


# ---- the terrace: the stone path's flags, cooled toward the ice's blue, a glassy sheen along the joints ------------------------------
def flagstone(size=1024):
    p = photo("stone-path.jpg", size)
    l = lum(p)
    ice = hexrgb("#b8c6d6")
    col = p * 0.55 + ice * l[..., None] * 0.6
    # frost in the joints: the darkest lines pale, as if filled with rime
    joint = np.clip((0.32 - l) * 5, 0, 1)
    col = col * (1 - joint[..., None] * 0.5) + hexrgb("#dfe8f2") * joint[..., None] * 0.5
    tile_set("flagstone", col, l, 2.0)


def snow(size=1024):
    p = photo("snow.jpg", size)
    sparkle = (noise(size, 256, 901, 1) > 0.965) * 0.08
    col = np.clip(p * 1.04 + sparkle[..., None], 0, 1)
    tile_set("snow", col, lum(p), 0.8)


def rock(size=1024):
    p = photo("rock.jpg", size)
    tile_set("rock", p * np.array([0.98, 0.99, 1.04], np.float32), lum(p), 2.6)


def pebbles(size=1024):
    p = photo("pool-floor.jpg", size)
    tile_set("pebbles", p, lum(p), 2.0)


# ---- boards: pale hinoki and charred cedar, eight boards a metre, the grain running along them -----------------------------------
def boards(name, light, dark, seed, rows=8, size=512, charred=False):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    plank = np.floor(ys / size * rows).astype(int)
    r = np.random.default_rng(seed).random((rows, 3)).astype(np.float32)
    lv = (ys / size * rows) % 1
    warp = noise(size, 4, seed + 1, 3)
    rings = np.sin((lv * 5 + warp * 6 + r[plank, 0] * 10 + xs / size * 0.6) * math.pi * 2) * 0.5 + 0.5
    fine = noise(size, 128, seed + 2, 1)
    t = np.clip(0.55 * rings + 0.3 * fine, 0, 1)
    col = hexrgb(light) * (1 - t[..., None]) + hexrgb(dark) * t[..., None]
    col *= (0.9 + 0.14 * r[plank, 1])[..., None]
    if charred:  # the alligator crackle of burnt cedar
        crack = noise(size, 32, seed + 3, 2)
        col *= (0.8 + 0.25 * np.clip((crack - 0.35) * 3, 0, 1))[..., None]
    gap = np.clip(np.minimum(lv, 1 - lv) / 0.035, 0, 1)
    col *= (0.45 + 0.55 * gap)[..., None]
    tile_set(name, col, gap * 0.85 + 0.15 * rings * gap, 2.0)


def plaster(size=512):
    base = hexrgb("#efe9dc") * (0.94 + 0.06 * noise(size, 8, 931, 3)[..., None])
    trowel = noise(size, 24, 932, 2)
    col = base * (0.97 + 0.04 * trowel[..., None])
    # a little damp along the bottom of each repeat (snow splashes on the wall)
    ys = np.mgrid[0:size, 0:size][0].astype(np.float32) / size
    col *= (1 - 0.06 * np.clip((ys - 0.85) * 6, 0, 1))[..., None]
    tile_set("plaster", col, trowel * 0.3, 0.6)


def kawara(size=512):
    """Grey roof tiles: rounded channels (eight a metre) in courses (five a metre), each course's lip a dark line, the glaze shining."""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    u = (xs * 8) % 1
    v = (ys * 5) % 1
    course = np.floor(ys * 5).astype(int)
    r = np.random.default_rng(941).random((5, 8)).astype(np.float32)
    col_i = np.floor(xs * 8).astype(int)
    roll = np.sin(u * math.pi) ** 0.6
    height = roll * (0.6 + 0.4 * v)
    base = hexrgb("#4a5058") * (0.85 + 0.25 * roll[..., None]) * (0.92 + 0.1 * r[course, col_i][..., None])
    lip = np.clip((v - 0.9) * 10, 0, 1)
    col = base * (1 - lip[..., None] * 0.55)
    tile_set("kawara", col, height - lip * 0.5, 2.6)


def bark(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    warp = noise(size, 6, 951, 3)
    ridges = np.abs(np.sin((xs * 14 + warp * 2) * math.pi)) ** 0.5
    fine = noise(size, 64, 952, 2)
    col = hexrgb("#6a4a34") * (0.6 + 0.45 * ridges[..., None]) * (0.9 + 0.15 * fine[..., None])
    tile_set("bark", col, ridges * 0.8 + fine * 0.2, 2.4)


def cedar(size=512):
    """The cedars' needles: dense dark-green sprays, lighter tips, a dusting of frost (neutral enough to be tinted)."""
    n1 = noise(size, 48, 961, 2)
    n2 = noise(size, 160, 962, 1)
    sprays = np.clip(n1 * 0.6 + n2 * 0.6, 0, 1)
    col = hexrgb("#2a4636") * (0.7 + 0.5 * sprays[..., None])
    frost = np.clip((noise(size, 96, 963, 1) - 0.72) * 4, 0, 1)
    col = col * (1 - frost[..., None] * 0.6) + hexrgb("#e6eef6") * frost[..., None] * 0.6
    tile_set("cedar", col, sprays, 1.6)


if __name__ == "__main__":
    jobs = {
        "flagstone": flagstone,
        "snow": snow,
        "rock": rock,
        "pebbles": pebbles,
        "hinoki": lambda: boards("hinoki", "#d6b385", "#b08a5e", 971),
        "timber": lambda: boards("timber", "#4a3426", "#241811", 972, charred=True),
        "plaster": plaster,
        "kawara": kawara,
        "bark": bark,
        "cedar": cedar,
    }
    only = args()
    for name, job in jobs.items():
        if not only or name in only:
            job()
