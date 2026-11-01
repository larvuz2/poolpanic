"""The Cruise Ship's tiling textures, into its work folder: eight photographic materials painted once on fal (README: the prompts)
made seamless here, each its albedo and a normal map from its own relief (the Lazy River's method, river_textures.py), and the
palm fronds for the planters.

- most of them came out of fal nearly seamless already (their edges differ from each other about as much as two neighbouring
  columns inside), so they are blended with themselves shifted by half only in a thin band at the edges, which would ghost a
  regular pattern (planks, tiles, windows) if it were wide;
- the facade's window bays and the canvas's stripes are cropped first to a whole number of repeats, so they meet across the wrap;
  the non-skid's yellow safety line is cropped off (it would repeat every 1.6 m);
- the relief: the picture's luminance less a blurred copy (joints, seams, rivets, the grain stand out; the photograph's slow shading
  does not tilt the normals).

    blender -b -P tools/venues/cruise/cruise_textures.py [-- name ...]
"""

import os, sys, importlib.util
import numpy as np

CRUISE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CRUISE_DIR)
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import noise, tile_set, palm_frond

GEN = os.environ.get("CRUISE_GEN", os.path.join(WORK, "gen"))
spec = importlib.util.spec_from_file_location("river_tex", os.path.join(CRUISE_DIR, "..", "river", "river_textures.py"))


def _river():
    # (the river's seamless and relief, without running its jobs)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


R = _river()


def photo(file, size, crop=None):
    """The picture at size × size; `crop` (x0, x1, y0, y1) in fractions first."""
    img = bpy.data.images.load(os.path.join(GEN, file))
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    a = px.reshape(h, w, 4)[::-1, :, :3]
    if crop:
        x0, x1, y0, y1 = crop
        a = a[int(y0 * h) : int(y1 * h), int(x0 * w) : int(x1 * w)]
    # (a plain bilinear resize)
    hh, ww = a.shape[:2]
    ys = np.linspace(0, hh - 1, size)
    xs = np.linspace(0, ww - 1, size)
    y0_ = np.floor(ys).astype(int)
    x0_ = np.floor(xs).astype(int)
    y1_ = np.minimum(y0_ + 1, hh - 1)
    x1_ = np.minimum(x0_ + 1, ww - 1)
    fy = (ys - y0_)[:, None, None]
    fx = (xs - x0_)[None, :, None]
    top = a[y0_][:, x0_] * (1 - fx) + a[y0_][:, x1_] * fx
    bot = a[y1_][:, x0_] * (1 - fx) + a[y1_][:, x1_] * fx
    return (top * (1 - fy) + bot * fy).astype(np.float32)


def staggered(p, period, seed=7):
    """Planks running along y, `period` pixels wide: each plank turned round by its own amount along its length, so the picture's
    top/bottom wrap becomes a butt joint at a different place in every plank, each closed with a line of black caulking."""
    n = p.shape[0]
    rng = np.random.default_rng(seed)
    lum = p.mean(axis=2).mean(axis=0)
    # the caulking lines are the darkest columns: their phase within the period
    phase = int(np.argmin(np.array([lum[k::period].mean() for k in range(period)])))
    out = p.copy()
    for c in range(-1, n // period + 1):
        x0, x1 = max(0, phase + c * period + 2), min(n, phase + (c + 1) * period - 1)
        if x1 <= x0:
            continue
        shift = int(rng.integers(0, n))
        out[:, x0:x1] = np.roll(p[:, x0:x1], shift, axis=0)
        out[shift % n : shift % n + 3, x0:x1] *= 0.18  # (the joint's caulking)
    return out


def seamless_v(p, band):
    """Top to bottom only: blended with itself shifted by half along y in a band at the top and bottom edges (its columns stay
    where they are: for a picture already whole across, the canvas's stripes)."""
    n = p.shape[0]
    q = np.roll(p, n // 2, axis=0)
    d = np.minimum(np.arange(n), n - 1 - np.arange(n)) / n
    m = np.clip(d / band, 0, 1)
    m = (m * m * (3 - 2 * m))[:, None, None]
    return p * m + q * (1 - m)


def photo_set(name, strength, size=1024, crop=None, tint=(1, 1, 1), gain=1.0, gamma=1.0, band=0.035, r=20, planks=0, across=True, turn=False):
    p = photo(name + ".png", size, crop)
    if planks:
        p = staggered(p, planks)
    p = R.seamless(p, band, hash(name) % 997) if across else seamless_v(p, band)
    p = np.clip(p * np.array(tint, np.float32) * gain, 0, 1) ** gamma
    if turn:
        # (a top face takes its picture's height along z: the planks turned to run along x, fore and aft)
        p = np.ascontiguousarray(np.rot90(p))
    tile_set(name, p, R.relief(p, r), strength)


def jobs():
    return {
        # (sixteen planks across, each 64 px: their joints staggered; the thinnest band at the sides, where they already meet)
        "teak": lambda: photo_set("teak", 2.6, tint=(1.02, 1.0, 0.97), planks=64, band=0.012, turn=True),
        "paint": lambda: photo_set("paint", 3.0, gain=1.02, band=0.05),
        # (the yellow safety line cropped off)
        "nonskid": lambda: photo_set("nonskid", 2.2, crop=(0.0, 0.62, 0.0, 1.0), band=0.1),
        "mosaic": lambda: photo_set("mosaic", 2.4, gain=1.03),
        # (two whole pairs of balcony decks: their period 934 px)
        "hullside": lambda: photo_set("hullside", 2.0, crop=(0.0, 1.0, 120 / 2048, (120 + 2 * 934) / 2048)),
        # (six whole window bays, their period 279 px)
        "facade": lambda: photo_set("facade", 2.0, crop=(140 / 2048, (140 + 6 * 279) / 2048, 0.0, 1.0)),
        # (three whole pairs of stripes, their period 520 px, cut mid-stripe; the fabric's fringe at the top and bottom cut off)
        "canvas": lambda: photo_set("canvas", 1.6, crop=(250 / 2048, (250 + 3 * 520) / 2048, 0.1, 0.9), band=0.08, across=False),
        "mahogany": lambda: photo_set("mahogany", 2.2),
        "palm_frond": palm_frond,
    }


if __name__ == "__main__":
    only = args()
    for name, job in jobs().items():
        if not only or name in only:
            job()
