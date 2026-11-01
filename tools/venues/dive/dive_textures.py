"""The Jumping Pool's tiling textures, into its work folder: ten photographic materials painted once on fal (README: the prompts)
made seamless here, each its albedo and a normal map from its own relief (the Lazy River's method, river_textures.py; the Cruise
Ship's helpers, cruise_textures.py), and the palm fronds for the planters.

- the new ones (the cobalt mosaic, the majolica, the lawn, the box hedge, the render, the roof tiles, the striped awning) and
  five of the Rooftop Pool's (the travertine, the marble, the concrete, the teak, the linen) came out of fal nearly seamless, so
  they are blended with themselves shifted by half only in a thin band at the edges; the majolica's one tile is cut whole from the
  picture's row of four; the teak's boards are staggered (no blending);
- the relief: the picture's luminance less a blurred copy (joints, grout, the grain, the weave stand out; the photograph's slow
  shading does not tilt the normals).

    blender -b -P tools/venues/dive/dive_textures.py [-- name ...]
"""

import os, sys, importlib.util
import numpy as np

DIVE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIVE_DIR)
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import tile_set, palm_frond

GEN = os.environ.get("DIVE_GEN", os.path.join(WORK, "gen"))
spec = importlib.util.spec_from_file_location("river_tex", os.path.join(DIVE_DIR, "..", "river", "river_textures.py"))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)  # (the river's seamless and relief, without running its jobs)


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
    hh, ww = a.shape[:2]
    ys, xs = np.linspace(0, hh - 1, size), np.linspace(0, ww - 1, size)
    y0_, x0_ = np.floor(ys).astype(int), np.floor(xs).astype(int)
    y1_, x1_ = np.minimum(y0_ + 1, hh - 1), np.minimum(x0_ + 1, ww - 1)
    fy, fx = (ys - y0_)[:, None, None], (xs - x0_)[None, :, None]
    top = a[y0_][:, x0_] * (1 - fx) + a[y0_][:, x1_] * fx
    bot = a[y1_][:, x0_] * (1 - fx) + a[y1_][:, x1_] * fx
    return (top * (1 - fy) + bot * fy).astype(np.float32)


def flatten(p):
    """The photograph's slow shading down its height taken out: each row divided by its own mean (smoothed a little), so the
    bronze's bright middle does not band the cladding every repeat (its fins run top to bottom, alike all the way)."""
    rows = p.mean(axis=1)
    k = np.ones(15, np.float32) / 15
    rows = np.stack([np.convolve(np.concatenate([rows[-7:, c], rows[:, c], rows[:7, c]]), k, "valid") for c in range(3)], axis=1)
    return np.clip(p / np.maximum(rows[:, None, :], 1e-3) * p.reshape(-1, 3).mean(axis=0), 0, 1)


def staggered(p, period, seed=7):
    """Boards running along y, `period` pixels wide: each board turned round by its own amount along its length, so the picture's
    top/bottom wrap becomes a butt joint at a different place in every board (the Cruise Ship's planks)."""
    n = p.shape[0]
    rng = np.random.default_rng(seed)
    lum = p.mean(axis=2).mean(axis=0)
    phase = int(np.argmin(np.array([lum[k::period].mean() for k in range(period)])))
    out = p.copy()
    for c in range(-1, n // period + 1):
        x0, x1 = max(0, phase + c * period + 2), min(n, phase + (c + 1) * period - 1)
        if x1 <= x0:
            continue
        shift = int(rng.integers(0, n))
        out[:, x0:x1] = np.roll(p[:, x0:x1], shift, axis=0)
        out[shift % n : shift % n + 2, x0:x1] *= 0.35  # (the joint)
    return out


def seamless_v(p, band):
    """Top to bottom only: blended with itself shifted by half along y in a band at the top and bottom edges (its columns stay
    where they are: the lawn's mowing stripes)."""
    n = p.shape[0]
    q = np.roll(p, n // 2, axis=0)
    d = np.minimum(np.arange(n), n - 1 - np.arange(n)) / n
    m = np.clip(d / band, 0, 1)
    m = (m * m * (3 - 2 * m))[:, None, None]
    return p * m + q * (1 - m)


def photo_set(name, strength, size=1024, crop=None, tint=(1, 1, 1), gain=1.0, gamma=1.0, band=0.03, r=20, turn=False, flat=0, boards=0, across=True):
    p = photo(name + ".png", size, crop)
    if flat:
        p = flatten(p)
    if boards:
        p = staggered(p, boards)
    if band:
        p = R.seamless(p, band, hash(name) % 997) if across else seamless_v(p, band)
    p = np.clip(p * np.array(tint, np.float32) * gain, 0, 1) ** gamma
    if turn:
        p = np.ascontiguousarray(np.rot90(p))
    tile_set(name, p, R.relief(p, r), strength)


def majolica():
    """One tile of the waterline band (the picture is four alike side by side: its second, whole and square)."""
    img = bpy.data.images.load(os.path.join(GEN, "majolica.png"))
    w, h = img.size
    bpy.data.images.remove(img)
    q = (w / 4) / w
    photo_set("majolica", 1.8, size=512, crop=(q, 2 * q, 0.0, 1.0), band=0.0)


def jobs():
    return {
        "travertine": lambda: photo_set("travertine", 1.8, band=0.02),
        "mosaic": lambda: photo_set("mosaic", 2.4, band=0.02, gain=1.02),
        "majolica": majolica,
        "marble": lambda: photo_set("marble", 1.0, band=0.06),
        "concrete": lambda: photo_set("concrete", 1.6, band=0.02, gain=1.02),
        "teak": lambda: photo_set("teak", 2.4, band=0, boards=85),
        "lawn": lambda: photo_set("lawn", 2.0, band=0.1, flat=1, across=False),
        "hedge": lambda: photo_set("hedge", 3.0, band=0.08, gain=1.05),
        "stucco": lambda: photo_set("stucco", 1.4, band=0.06),
        "rooftile": lambda: photo_set("rooftile", 3.2, band=0.03),
        "awning": lambda: photo_set("awning", 1.6, band=0.03),
        "linen": lambda: photo_set("linen", 2.0, band=0.05),
        "palm_frond": palm_frond,
    }


if __name__ == "__main__":
    only = args()
    for name, job in jobs().items():
        if not only or name in only:
            job()
