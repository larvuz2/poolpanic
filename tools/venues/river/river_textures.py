"""The Lazy River's tiling textures, into its work folder: seven photographic materials painted once on fal (README: the prompts)
made seamless here, each its albedo and a normal map from its own relief, and the jungle's procedural sets.

- seamless: the picture is blended with itself shifted by half (whose edges then run on across the wrap) in a band along the edges,
  the band's line broken by noise so no straight seam shows;
- the relief: the picture's luminance, its broad light and shade taken out (a blurred copy subtracted), so the joints, the grain
  and the pebbles stand out and a slow shading of the photograph does not tilt the normals;
- each set's own touch: the sandstone a little warmer, the temple stone a little greener, the river rock darker and wetter, the
  bamboo brighter.

    blender -b -P tools/venues/river/river_textures.py [-- name ...]
"""

import os, sys, math, importlib.util
import numpy as np

RIVER_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, RIVER_DIR)
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, save, tufts

GEN = os.environ.get("RIVER_GEN", os.path.join(WORK, "gen"))


def borrow(venue, file):
    spec = importlib.util.spec_from_file_location(venue + "_tex", os.path.join(RIVER_DIR, "..", venue, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def photo(file, size):
    img = bpy.data.images.load(os.path.join(GEN, file))
    img.scale(size, size)
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(size, size, 4)[::-1, :, :3].copy()


def blur(a, r):
    """A box blur of radius r, wrapping (periodic), twice (near a gaussian)."""
    for _ in range(2):
        acc = np.zeros_like(a)
        for k in range(-r, r + 1):
            acc += np.roll(a, k, axis=0)
        a = acc / (2 * r + 1)
        acc = np.zeros_like(a)
        for k in range(-r, r + 1):
            acc += np.roll(a, k, axis=1)
        a = acc / (2 * r + 1)
    return a


def seamless(p, band=0.1, seed=1):
    """Blend the picture with itself shifted by half in a band along its edges, the band's inner line broken by noise."""
    n = p.shape[0]
    q = np.roll(np.roll(p, n // 2, axis=0), n // 2, axis=1)
    u = np.arange(n, dtype=np.float32) / n
    edge = np.minimum(u, 1 - u)  # distance to the nearest edge, 0..0.5
    wobble = (noise(n, 6, seed, 3) - 0.5) * band * 0.9
    dx = edge[None, :] + wobble
    dy = edge[:, None] + wobble.T
    m = np.clip(np.minimum(dx, dy) / band, 0, 1)
    m = m * m * (3 - 2 * m)
    return p * m[..., None] + q * (1 - m[..., None])


def relief(p, r=24):
    l = p @ np.array([0.3, 0.55, 0.15], np.float32)
    hp = l - blur(l, r)
    lo, hi = np.percentile(hp, 2), np.percentile(hp, 98)
    return np.clip((hp - lo) / (hi - lo + 1e-6), 0, 1)


def photo_set(name, file, strength, size=1024, tint=(1, 1, 1), gain=1.0, gamma=1.0, band=0.1, r=24):
    p = seamless(photo(file, size), band, hash(name) % 997)
    p = np.clip(p * np.array(tint, np.float32) * gain, 0, 1) ** gamma
    tile_set(name, p, relief(p, r), strength)


def jobs():
    lagoon = borrow("lagoon", "lagoon_textures.py")
    return {
        "sandstone": lambda: photo_set("sandstone", "sandstone.png", 2.2, tint=(1.03, 1.0, 0.96)),
        "templestone": lambda: photo_set("templestone", "templestone.png", 3.2, tint=(0.98, 1.02, 0.98)),
        "riverrock": lambda: photo_set("riverrock", "riverrock.png", 3.6, gain=1.05),
        "riverbed": lambda: photo_set("riverbed", "riverbed.png", 2.0),
        "planks": lambda: photo_set("planks", "planks.png", 2.4, band=0.06),
        "leaflitter": lambda: photo_set("leaflitter", "leaflitter.png", 2.6, gain=0.95),
        "bamboo": lambda: photo_set("bamboo", "bamboo.png", 2.6, gain=1.06, band=0.06),
        "thatch": lagoon.thatch,
        "canopy": lambda: tufts("canopy", "#1f4a26", "#3f8a3a", "#a7cf62", 28, 321, 5.0),
        "hedge": lambda: tufts("hedge", "#1d3f22", "#2f6b34", "#7fb04a", 40, 77, 4.0),
        "palm_frond": palm_frond,
    }


if __name__ == "__main__":
    only = args()
    for name, job in jobs().items():
        if not only or name in only:
            job()
