"""The Sunset Lagoon's tiling textures and cut-outs (numpy), into its work folder: the shared ones (tools/venues/common/
venue_textures.py) in the lagoon's colours, and its own: the boardwalk's weathered hardwood planks, thatch, woven bamboo, beach
sand, teak; cut-outs for beach grass, palm fronds and flowers.

    blender -b -P tools/venues/lagoon/lagoon_textures.py [-- name ...]
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403
from venue_textures import *  # noqa: F401,F403
from venue_textures import hexrgb, noise, normal_from_height, tile_grid, per_tile


# ---- the boardwalk: hardwood planks along z, 15 cm, 6 mm gaps, butt joints staggered, nail heads over the joists --------------
def boardwalk(size=1024):
    rows = 12  # 1.8 m a repeat: 15 cm planks
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    plank = np.floor(xs * rows).astype(int)  # (columns: the planks run along the picture's v, the game's z)
    lu = (xs * rows) % 1  # across a plank
    rng = np.random.default_rng(611)
    r = rng.random((rows, 6)).astype(np.float32)
    # each plank's butt joint: one per repeat at its own place (two lengths of board in each column)
    joint = r[plank, 0]
    seg = (ys > joint).astype(int)
    dv = np.minimum(np.abs(ys - joint), np.minimum(np.abs(ys - joint + 1), np.abs(ys - joint - 1)))
    end = np.clip(dv / 0.004, 0, 1)
    # per board: a tone (honey to silvered grey), a grain phase
    tone = np.where(seg == 0, r[plank, 1], r[plank, 2])
    warm, grey, dark = hexrgb("#c39468"), hexrgb("#ad9a84"), hexrgb("#8c6a4c")
    base = warm * (1 - tone[..., None] * 0.55) + grey * (tone[..., None] * 0.55)
    warp = noise(size, 6, 612, 3)
    grain = np.sin((lu * 3.0 + warp * 2.5 + r[plank, 3] * 9 + ys * 1.5) * math.pi * 2 * 3) * 0.5 + 0.5
    fine = noise(size, 256, 613, 1)
    streak = noise(size, 64, 614, 2)
    base = base * (0.86 + 0.22 * np.where(seg == 0, r[plank, 4], r[plank, 5]))[..., None]
    col = base * (0.84 + 0.16 * grain[..., None] + 0.08 * fine[..., None]) * (0.9 + 0.14 * streak[..., None])
    col = col * (1 - 0.35 * (grain**5)[..., None]) + dark * (0.3 * (grain**5)[..., None])
    # sun-bleached middles, darker edges where the water runs off
    edge = np.clip(np.minimum(lu, 1 - lu) / 0.12, 0, 1)
    col *= (0.88 + 0.12 * edge)[..., None]
    mott = noise(size, 5, 615, 4)
    col *= (0.94 + 0.09 * mott)[..., None]
    # nail heads: two to a plank over each joist (every 60 cm: three a repeat)
    nails = np.zeros_like(xs)
    for j in range(3):
        y0 = (j + 0.5) / 3
        for u0 in (0.22, 0.78):
            d = ((lu - u0) * (1 / rows) * size) ** 2 + ((ys - y0) * size) ** 2
            nails = np.maximum(nails, np.exp(-d / 6.0))
    col = col * (1 - 0.55 * nails[..., None]) + hexrgb("#3a342e") * 0.55 * nails[..., None]
    gap = np.clip(np.minimum(lu, 1 - lu) / 0.035, 0, 1) * end
    col *= (0.25 + 0.75 * gap)[..., None]
    height = gap * (0.85 + 0.1 * grain) + 0.05 * fine - 0.2 * nails
    tile_set("boardwalk", col, height, 3.0)


# ---- thatch: courses of straw combed down the slope (the picture's v), each course's lip in shadow -------------------------------
def thatch(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    courses = 4
    lv = (ys * courses) % 1  # 0 at a course's top, 1 at its lip
    course = np.floor(ys * courses).astype(int)
    rng = np.random.default_rng(621)
    # strands: a fine random value per column, shifted per course, smeared a little along v
    cols = rng.random((courses, size)).astype(np.float32)
    strands = cols[course, (xs * size).astype(int) % size]
    s2 = noise(size, 48, 622, 2)
    wav = noise(size, 8, 623, 3)
    straw = np.clip(strands * 0.7 + s2 * 0.3, 0, 1)
    light, mid, dark = hexrgb("#e3c27e"), hexrgb("#c99a52"), hexrgb("#7a5a2e")
    col = mid * (1 - straw[..., None]) + light * straw[..., None]
    col = col * (0.85 + 0.2 * wav[..., None])
    # the lip of each course hangs over the next: dark under it, the ends ragged
    rag = noise(size, 64, 624, 2) * 0.12
    lip = np.clip((lv - (0.8 - rag)) / 0.2, 0, 1)
    top = np.clip(1 - lv / 0.15, 0, 1)
    col = col * (1 - 0.45 * lip[..., None]) * (1 - 0.3 * top[..., None])
    col = col * (1 - 0.25 * (strands < 0.12)[..., None]) + dark * 0.0
    height = straw * 0.6 + (1 - lip) * 0.4 - top * 0.3
    tile_set("thatch", col, height, 4.0)


# ---- woven bamboo panels: a basket weave of split-bamboo strips, light and dark ---------------------------------------------------
def weave(size=512):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    n = 6  # 15 cm squares, 0.9 m a repeat
    ix, iy = np.floor(xs * n).astype(int), np.floor(ys * n).astype(int)
    u, v = (xs * n) % 1, (ys * n) % 1
    flip = (ix + iy) % 2 == 0
    k = 3  # strips per square
    across = np.where(flip, v, u)
    along = np.where(flip, u, v)
    strip = np.floor(across * k).astype(int)
    sv = (across * k) % 1
    edge = np.clip(np.minimum(sv, 1 - sv) / 0.06, 0, 1)
    r = np.random.default_rng(631).random((n, n, k)).astype(np.float32)
    tone = r[ix % n, iy % n, strip % k]
    light, dark = hexrgb("#dcc08a"), hexrgb("#a8844a")
    col = light * (1 - tone[..., None] * 0.35) + dark * (tone[..., None] * 0.35)
    # the strips dip under their neighbours at each square's ends
    dip = np.sin(along * math.pi) ** 0.5
    nodes = np.sin((along * 2 + tone) * math.pi * 2) ** 16  # bamboo nodes now and then
    sheen = np.sin((across * k % 1) * math.pi) ** 0.6  # each strip rounded: light down its middle
    col = col * (0.55 + 0.45 * dip[..., None]) * (0.8 + 0.2 * edge[..., None]) * (0.85 + 0.2 * sheen[..., None])
    col *= (1 - 0.04 * nodes[..., None])
    fine = noise(size, 128, 632, 1)
    col *= (0.94 + 0.08 * fine)[..., None]
    height = edge * dip * 0.9 + fine * 0.1
    tile_set("weave", col, height, 3.0)


# ---- beach sand: fine grain, soft wind ripples, a few shells and darker damp patches ------------------------------------------
def sand(size=1024):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    grain = noise(size, 512, 641, 1)
    grain2 = noise(size, 128, 642, 2)
    warp = noise(size, 4, 643, 3)
    ripple = np.sin((ys * 22 + warp * 3.0 + xs * 2) * math.pi * 2) * 0.5 + 0.5
    ripple = ripple ** 1.5
    patch = noise(size, 3, 644, 4)
    base = hexrgb("#ead0a0")
    col = base * (0.92 + 0.08 * grain[..., None] + 0.05 * grain2[..., None])
    col = col * (0.95 + 0.07 * ripple[..., None])
    damp = np.clip((patch - 0.62) / 0.2, 0, 1)
    col = col * (1 - 0.12 * damp[..., None])
    # shells and pebbles: small bright flecks, a few darker
    fl = noise(size, 256, 645, 1)
    shell = np.clip((fl - 0.86) / 0.04, 0, 1) * (noise(size, 32, 646, 2) > 0.55)
    col = col * (1 - shell[..., None]) + hexrgb("#fbf3e6") * shell[..., None]
    peb = np.clip((noise(size, 192, 647, 1) - 0.88) / 0.04, 0, 1) * (noise(size, 16, 648, 2) > 0.6)
    col = col * (1 - 0.5 * peb[..., None]) + hexrgb("#9a8a72") * 0.5 * peb[..., None]
    height = ripple * 0.6 + grain * 0.25 + shell * 0.3 + peb * 0.3
    tile_set("sand", col, height, 2.0)


# ---- teak: oiled boards along x, 1 m a repeat (Splash Park's) ---------------------------------------------------------------------
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


# ---- beach grass: a tuft of thin blades fanning up from the bottom middle ---------------------------------------------------------
def beach_grass(w=256, h=256):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    u = xs / (w - 1)
    v = 1 - ys / (h - 1)  # 0 at the root
    alpha = np.zeros((h, w), np.float32)
    col = np.zeros((h, w, 3), np.float32)
    r = np.random.default_rng(651)
    tints = [hexrgb(c) for c in ("#9aa65a", "#b7b86a", "#7f9447", "#c9bf7a", "#8c9a50")]
    for k in range(46):
        x0 = 0.5 + r.normal(0, 0.06)
        lean = r.normal(0, 0.28)
        length = r.uniform(0.45, 0.98)
        bend = r.uniform(0.05, 0.25) * np.sign(lean)
        t = v / length
        cx = x0 + lean * t * length + bend * t**2 * length
        width = 0.012 * (1 - t) + 0.002
        m = (t >= 0) & (t <= 1) & (np.abs(u - cx) < width)
        tint = tints[k % len(tints)] * (0.75 + 0.3 * t[..., None]) * (0.85 + 0.2 * r.random())
        col = np.where(m[..., None], tint, col)
        alpha = np.where(m, 1.0, alpha)
    cutout("beach_grass", col, alpha)


if __name__ == "__main__":
    jobs = {
        "boardwalk": boardwalk,
        "thatch": thatch,
        "weave": weave,
        "sand": sand,
        "teak": teak,
        "glass_mosaic": lambda: glass_mosaic(
            blend=[("#5fd6d2", 0.3), ("#3cc3c6", 0.26), ("#9ce8e2", 0.2), ("#2aa4b8", 0.14), ("#e9f8f4", 0.1)]
        ),
        "mosaic_band": lambda: mosaic_band(colours=("#16706f", "#2aa7a0", "#ee8a5a", "#f6efe0")),
        "hedge": hedge,
        "canopy": lambda: tufts("canopy", "#24502b", "#4a8f3c", "#a7cf62", 28, 321, 5.0),
        "palm_frond": palm_frond,
        "beach_grass": beach_grass,
        "hibiscus": lambda: flower_cluster(
            "hibiscus", ["#e0412f", "#ff6a5a", "#f4c849"], ["#2f6a2c", "#3f7d34", "#4c8a3a"], seed=9, n_flowers=12, n_leaves=40, flower_r=(0.07, 0.1)
        ),
        "bougainvillea": lambda: flower_cluster(
            "bougainvillea", ["#d6337f", "#e2559a", "#c22a6e", "#ec7ab0"], ["#3f7d34", "#2f6a2c", "#55903f"], seed=7, n_flowers=60
        ),
    }
    only = args()
    for name, job in jobs.items():
        if not only or name in only:
            job()
