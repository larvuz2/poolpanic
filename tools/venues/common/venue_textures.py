"""Tiling textures and cut-outs every dressed venue may use, computed with numpy (the Harbourside's noise and tile tools,
godot/tools/blender/textures.py), into the venue's work folder: <set>_albedo.png and <set>_normal.png (OpenGL, green up), every
one seamless, and <name>_alpha.png for the cut-outs. A venue's textures script imports these and adds its own.
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitbase import V, bpy  # noqa: F401
import textures as T  # godot/tools/blender/textures.py (periodic_noise, normal_from_height, tile_grid, per_tile_random)

hexrgb, noise, normal_from_height, tile_grid, per_tile = (
    T.hexrgb,
    T.periodic_noise,
    T.normal_from_height,
    T.tile_grid,
    T.per_tile_random,
)


def save(name, rgb, alpha=None):
    h, w, _ = rgb.shape
    a = np.ones((h, w, 1), np.float32) if alpha is None else alpha[..., None]
    px = np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)], axis=2)[::-1].astype(np.float32)
    img = bpy.data.images.new(name, w, h, alpha=alpha is not None)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(V.tex, name + ".png")
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print("TEXTURE", name, f"{w}x{h}")



def tile_set(name, albedo, height, strength):
    save(name + "_albedo", albedo)
    save(name + "_normal", normal_from_height(height, strength))



# ---- the basin: 2.5 cm glass mosaic, turquoise blend, white grout -------------------------------------------------------------
def glass_mosaic(size=1024, name="glass_mosaic", blend=None):
    n = 32  # 0.8 m a repeat
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.11, bevel=0.15)
    r1, r2, r3 = per_tile(ix, iy, 41, 3)
    blend = blend or [("#7fd3d6", 0.34), ("#5cc3cc", 0.26), ("#a8e3e1", 0.2), ("#3fa9bd", 0.12), ("#e8f6f3", 0.08)]
    cum = np.cumsum([p for _, p in blend])
    idx = np.searchsorted(cum, r1 * cum[-1])
    pal = np.stack([hexrgb(c) for c, _ in blend])
    col = pal[np.clip(idx, 0, len(blend) - 1)] * (0.93 + 0.1 * r2[..., None])
    glaze = 1 + 0.07 * np.exp(-(((lu - 0.32) ** 2 + (lv - 0.32) ** 2) / 0.05))[..., None]
    grout = hexrgb("#e4ece8")
    albedo = col * glaze * h[..., None] + grout * (1 - h[..., None])
    height = h * 0.85 + 0.15 * noise(size, 32, 42, 3) * h
    tile_set(name, albedo, height, 2.4)



# ---- the band round the pool: cobalt, sky and white tiles, scattered like a hand-laid blend ----------------------------------
def mosaic_band(size=1024, name="mosaic_band", colours=("#1f5fa6", "#2f7fc4", "#7cc1e6", "#f2f5f0")):
    n = 32
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.11, bevel=0.15)
    r1, r2 = per_tile(ix, iy, 51, 2)
    # a slow wave in the blend: patches richer in white, patches deeper in cobalt
    patch = noise(size, 4, 52, 3)
    cobalt, mid, sky, white = (hexrgb(c) for c in colours)
    t = r1 * 0.75 + patch * 0.25
    col = np.where(
        (t < 0.38)[..., None], cobalt, np.where((t < 0.6)[..., None], mid, np.where((t < 0.78)[..., None], sky, white))
    )
    col = col * (0.92 + 0.1 * r2[..., None])
    glaze = 1 + 0.07 * np.exp(-(((lu - 0.32) ** 2 + (lv - 0.32) ** 2) / 0.05))[..., None]
    grout = hexrgb("#e6ece9")
    albedo = col * glaze * h[..., None] + grout * (1 - h[..., None])
    height = h * 0.85 + 0.15 * noise(size, 32, 53, 3) * h
    tile_set(name, albedo, height, 2.4)



# ---- clipped hedge: small glossy leaves, light on top of each tuft --------------------------------------------------------------------
def hedge(size=512):
    a = noise(size, 48, 81, 4, 0.6)
    b = noise(size, 96, 82, 2)
    c = noise(size, 6, 83, 3)
    leaf = np.clip((a - 0.35) * 2.2, 0, 1)
    dark, mid, light = hexrgb("#1f4f27"), hexrgb("#3c7a38"), hexrgb("#79ad4f")
    col = dark * (1 - leaf[..., None]) + mid * leaf[..., None]
    col = col * (1 - b[..., None] * 0.35) + light * (b[..., None] * 0.35 * leaf[..., None])
    col *= (0.88 + 0.2 * c)[..., None]
    tile_set("hedge", col, a * 0.7 + b * 0.3, 6.0)



# ---- the umbrella pines' canopy: tufts of needles, dark inside, sunlit olive tips ------------------------------------------------
def tufts(name, dark, mid, light, scale, seed, strength):
    size = 512
    a = noise(size, scale, seed, 4, 0.62)
    b = noise(size, scale * 4, seed + 1, 2)
    c = noise(size, 4, seed + 2, 3)
    tuft = np.clip((a - 0.38) * 2.6, 0, 1)
    col = hexrgb(dark) * (1 - tuft[..., None]) + hexrgb(mid) * tuft[..., None]
    tip = np.clip((b - 0.55) * 3, 0, 1) * tuft
    col = col * (1 - tip[..., None] * 0.6) + hexrgb(light) * (tip[..., None] * 0.6)
    col *= (0.86 + 0.22 * c)[..., None]
    tile_set(name, col, a * 0.7 + b * 0.3, strength)



def groundcover(size=512):
    a = noise(size, 40, 141, 4, 0.6)
    b = noise(size, 128, 142, 2)
    c = noise(size, 5, 143, 3)
    leaf = np.clip((a - 0.4) * 2.2, 0, 1)
    soil, dark, mid = hexrgb("#3b3326"), hexrgb("#24402a"), hexrgb("#3f6634")
    col = soil * (1 - leaf[..., None]) + (dark * (1 - b[..., None]) + mid * b[..., None]) * leaf[..., None]
    needles = (noise(size, 256, 144, 1) > 0.7) * (1 - leaf)
    col = col * (1 - needles[..., None] * 0.4) + hexrgb("#8a6a42") * needles[..., None] * 0.4
    col *= (0.8 + 0.3 * c)[..., None]
    tile_set("groundcover", col, a * 0.8 + b * 0.2, 4.0)



# ---- cut-outs ---------------------------------------------------------------------------------------------------------------------------
def cutout(name, rgb, alpha):
    save(name + "_alpha", rgb, alpha)



def palm_frond(w=1024, h=256):
    """A coconut palm's frond seen flat: a rib down the middle (left to right: base to tip), leaflets angled toward the tip on
    both sides, narrowing to the tip; per-leaflet tints, a light rib."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    u = xs / (w - 1)  # along the frond, 0 at the base
    v = (ys / (h - 1) - 0.5) * 2  # across, -1..1
    alpha = np.zeros((h, w), np.float32)
    col = np.zeros((h, w, 3), np.float32)
    green_a, green_b, green_c = hexrgb("#5c9a3e"), hexrgb("#3f7d34"), hexrgb("#8dbb55")
    reach = np.clip(np.sin(np.clip(u, 0, 1) * math.pi * 0.92 + 0.12), 0, 1) ** 0.8  # leaflet length along the frond
    n = 30
    r = np.random.default_rng(101)
    for side in (-1, 1):
        for k in range(n):
            u0 = 0.05 + k / n * 0.9
            ang = math.radians(38 + 12 * r.random())
            # long in the middle, short at the base and the tip, and never past the tip
            length = (0.08 + 0.92 * float(np.sin(min(1, u0) ** 0.8 * math.pi))) * (0.85 + 0.2 * r.random()) * 0.95
            length = min(length, (0.995 - u0) * (w / h) / 2 / max(math.cos(ang), 0.2))
            # a leaflet: a thin lens from (u0, 0) running out at `ang` toward the tip, `length` (in v units) long
            du = (u - u0) * (w / h) / 2  # in v units
            dv = v * side
            along = du * math.cos(ang) + dv * math.sin(ang)
            across = -du * math.sin(ang) + dv * math.cos(ang)
            t = along / max(length, 1e-3)
            width = 0.04 * np.sin(np.clip(t, 0, 1) * math.pi) ** 0.7 * (1 - 0.3 * t)
            m = (t > 0) & (t < 1) & (np.abs(across) < width) & (dv > -0.02)
            soft = np.clip(1 - np.abs(across) / np.maximum(width, 1e-4), 0, 1)
            tint = [green_a, green_b, green_c][k % 3] * (0.85 + 0.25 * r.random())
            shade = (0.75 + 0.35 * soft[..., None]) * (0.85 + 0.2 * t[..., None])
            col = np.where(m[..., None], tint * shade, col)
            alpha = np.where(m, 1.0, alpha)
    rib = (np.abs(v) < 0.035 * (1 - 0.7 * u)) & (u < 0.995)
    col = np.where(rib[..., None], hexrgb("#c9b46a"), col)
    alpha = np.where(rib, 1.0, alpha)
    cutout("palm_frond", col, alpha)



def flower_cluster(name, petals, leaves, size=256, seed=1, n_flowers=34, n_leaves=26, flower_r=(0.05, 0.085)):
    """A loose round cluster of leaves with flowers on top (bougainvillea, hibiscus): soft blobs on a disc."""
    r = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    alpha = np.zeros((size, size), np.float32)
    col = np.zeros((size, size, 3), np.float32)

    def blob(cx, cy, rx, ry, rot, colour):
        nonlocal alpha, col
        dx, dy = xs - cx, ys - cy
        a = dx * math.cos(rot) + dy * math.sin(rot)
        b = -dx * math.sin(rot) + dy * math.cos(rot)
        d = (a / rx) ** 2 + (b / ry) ** 2
        m = d < 1
        shade = 0.78 + 0.3 * (1 - d) - 0.12 * (b / ry)
        col = np.where(m[..., None], colour * shade[..., None], col)
        alpha = np.where(m, 1.0, alpha)

    for _ in range(n_leaves):
        a, rad = r.uniform(0, math.tau), 0.42 * math.sqrt(r.random())
        blob(0.5 + math.cos(a) * rad, 0.5 + math.sin(a) * rad, 0.07, 0.03, r.uniform(0, math.pi), hexrgb(leaves[r.integers(len(leaves))]))
    for _ in range(n_flowers):
        a, rad = r.uniform(0, math.tau), 0.4 * math.sqrt(r.random())
        cx, cy = 0.5 + math.cos(a) * rad, 0.5 + math.sin(a) * rad
        fr = r.uniform(*flower_r)
        c = hexrgb(petals[r.integers(len(petals))])
        for k in range(3):
            pa = k * math.tau / 3 + r.uniform(0, 1)
            blob(cx + math.cos(pa) * fr * 0.45, cy + math.sin(pa) * fr * 0.45, fr * 0.55, fr * 0.4, pa, c)
    cutout(name, col, alpha)
