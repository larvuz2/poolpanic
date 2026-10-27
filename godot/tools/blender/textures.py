"""The Community Pool's tiling textures, computed in Blender's Python (numpy) and saved as PNG sets in godot/assets/textures/:
<name>_albedo.png, <name>_normal.png (OpenGL, green up, as Godot reads them), <name>_rough.png. Every one tiles seamlessly: the
patterns repeat a whole number of times across the image and the noise is periodic.

    blender -b -P godot/tools/blender/textures.py
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import TEXTURES, srgb

rng = np.random.default_rng(1962)


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


def save(name, rgb, alpha=None):
    """Save an (h, w, 3) array in 0..1 (sRGB values for colour maps, raw for data maps) as PNG."""
    h, w, _ = rgb.shape
    a = np.ones((h, w, 1), np.float32) if alpha is None else alpha[..., None]
    px = np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)], axis=2)[::-1].astype(np.float32)
    img = bpy.data.images.new(name, w, h, alpha=alpha is not None)
    img.colorspace_settings.name = "Non-Color"  # write the values as they are
    img.pixels.foreach_set(px.ravel())
    path = os.path.join(TEXTURES, name + ".png")
    os.makedirs(TEXTURES, exist_ok=True)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print("TEXTURE", os.path.relpath(path, os.path.dirname(TEXTURES)), f"{w}x{h}")


def periodic_noise(size, period, seed, octaves=4, persistence=0.5):
    """Tileable fractal value noise in 0..1 on a size×size grid; `period` lattice cells across at the first octave."""
    r = np.random.default_rng(seed)
    total = np.zeros((size, size), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        p = period * (2**o)
        lat = r.random((p, p)).astype(np.float32)
        t = np.arange(size, dtype=np.float32) * p / size
        i0 = np.floor(t).astype(int) % p
        i1 = (i0 + 1) % p
        f = t - np.floor(t)
        f = f * f * (3 - 2 * f)
        # rows (y) then columns (x)
        a = lat[i0][:, i0] * (1 - f)[None, :] + lat[i0][:, i1] * f[None, :]
        b = lat[i1][:, i0] * (1 - f)[None, :] + lat[i1][:, i1] * f[None, :]
        total += amp * (a * (1 - f)[:, None] + b * f[:, None])
        norm += amp
        amp *= persistence
    return total / norm


def normal_from_height(hgt, strength):
    """A tangent-space normal map (OpenGL) from a periodic height field (0..1 per pixel, wrapping at the edges)."""
    dx = (np.roll(hgt, -1, axis=1) - np.roll(hgt, 1, axis=1)) * 0.5 * strength
    dy = (np.roll(hgt, -1, axis=0) - np.roll(hgt, 1, axis=0)) * 0.5 * strength
    # image rows run downward; OpenGL green is up, so a height rising toward the top of the image tilts the normal up (+y)
    n = np.stack([-dx, dy, np.ones_like(hgt)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def tile_grid(size, nx, ny, grout, bevel, offset_rows=False):
    """For a grid of nx×ny tiles over the image: per-pixel tile index (ix, iy), local coords in 0..1, and a height that is 1 on
    the tile's face, falling over `bevel` (fraction of a tile) to 0 in the grout (`grout`, fraction of a tile)."""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) + 0.5
    u = xs / size * nx
    v = ys / size * ny
    iy = np.floor(v).astype(int)
    if offset_rows:
        u = u + 0.5 * (iy % 2)
    ix = np.floor(u).astype(int) % nx
    lu, lv = u - np.floor(u), v - np.floor(v)
    # distance to the tile's edge in tile units (x and y scaled to each tile's aspect)
    aspect = (size / nx) / (size / ny)
    ex = np.minimum(lu, 1 - lu) * aspect
    ey = np.minimum(lv, 1 - lv)
    e = np.minimum(ex, ey)
    g = grout / 2
    hgt = np.clip((e - g) / bevel, 0, 1)
    hgt = np.sin(hgt * math.pi / 2)  # a rounded edge
    return ix, iy % ny, lu, lv, hgt


def per_tile_random(ix, iy, seed, n=1):
    r = np.random.default_rng(seed)
    table = r.random((n, 4096)).astype(np.float32)
    k = (ix * 73856093 ^ iy * 19349663) % 4096
    return [table[i][k] for i in range(n)]


# ---- the pool's mosaic: 2.5 cm glass tiles, white and pale aqua, a metre across --------------------------------------------
def pool_mosaic(size=1024):
    n = 40
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.12, bevel=0.14)
    r1, r2, r3 = per_tile_random(ix, iy, 11, 3)
    white, aqua, deep = hexrgb("#eef7f5"), hexrgb("#a9dfdb"), hexrgb("#7cc9cc")
    col = np.where((r1 < 0.62)[..., None], white, np.where((r1 < 0.93)[..., None], aqua, deep))
    col = col * (0.94 + 0.08 * r2[..., None])
    # glass glaze: a soft highlight inside each tile, and a pale grout
    glaze = 1 + 0.05 * np.exp(-(((lu - 0.35) ** 2 + (lv - 0.35) ** 2) / 0.05))[..., None]
    grout = hexrgb("#d5ddd8") * (0.92 + 0.08 * periodic_noise(size, 8, 3)[..., None])
    albedo = col * glaze * h[..., None] + grout * (1 - h[..., None])
    rough = 0.08 + 0.06 * r3 + (1 - h) * 0.65
    height = h * 0.8 + 0.2 * periodic_noise(size, 32, 5, 3) * h
    save("pool_mosaic_albedo", albedo)
    save("pool_mosaic_normal", normal_from_height(height, 2.5))
    save("pool_mosaic_rough", np.repeat(rough[..., None], 3, 2))


# ---- the deck: 30 cm non-slip tiles, warm sand, 1.2 m across ---------------------------------------------------------------
def deck_tile(size=1024):
    n = 4
    ix, iy, lu, lv, h = tile_grid(size, n, n, grout=0.035, bevel=0.03)
    r1, r2 = per_tile_random(ix, iy, 21, 2)
    base = hexrgb("#dcb98f")
    col = base * (0.93 + 0.1 * r1[..., None]) + (r2[..., None] - 0.5) * np.array([0.03, 0.015, 0.0], np.float32)
    speck = periodic_noise(size, 128, 7, 2)
    col = col * (0.97 + 0.06 * (speck[..., None] > 0.62)) - 0.05 * (speck[..., None] < 0.3)
    mott = periodic_noise(size, 6, 8, 4)
    col = col * (0.95 + 0.08 * mott[..., None])
    grout = hexrgb("#9a7a5a")
    albedo = col * h[..., None] + grout * (1 - h[..., None])
    grit = periodic_noise(size, 256, 9, 1)
    height = h * 0.85 + 0.15 * grit * h
    rough = 0.62 + 0.18 * grit - 0.08 * mott
    rough = rough * h + 0.85 * (1 - h)
    save("deck_tile_albedo", albedo)
    save("deck_tile_normal", normal_from_height(height, 3.0))
    save("deck_tile_rough", np.repeat(rough[..., None], 3, 2))


# ---- glazed wall tiles: 15×7.5 cm in running bond, handmade glaze; three colours -------------------------------------------
def wall_tile(name, hex_main, hex_alt, alt_share=0.18, size=1024):
    # 0.6 m across: 4 tiles wide, 8 rows high
    ix, iy, lu, lv, h = tile_grid(size, 4, 8, grout=0.05, bevel=0.09, offset_rows=True)
    r1, r2, r3 = per_tile_random(ix, iy, sum(map(ord, name)), 3)
    main, alt = hexrgb(hex_main), hexrgb(hex_alt)
    col = np.where((r1 < alt_share)[..., None], alt, main) * (0.92 + 0.12 * r2[..., None])
    # the glaze pools darker at the edges of each tile and is lighter at its crown
    crown = np.clip(h, 0, 1) ** 0.6
    col = col * (0.86 + 0.16 * crown[..., None])
    wave = periodic_noise(size, 16, 13, 3)
    grout = hexrgb("#e9e2d2")
    albedo = col * h[..., None] + grout * (1 - h[..., None])
    height = h * 0.9 + 0.1 * wave * h
    rough = (0.08 + 0.08 * r3) * h + 0.8 * (1 - h)
    save(name + "_albedo", albedo)
    save(name + "_normal", normal_from_height(height, 4.0))
    save(name + "_rough", np.repeat(rough[..., None], 3, 2))


# ---- terrazzo for the locker rooms: cream with chips of the palette, 1 m across ---------------------------------------------
def terrazzo(size=1024):
    base = hexrgb("#efe4cf")
    col = np.ones((size, size, 3), np.float32) * base
    col *= 0.96 + 0.06 * periodic_noise(size, 8, 31, 3)[..., None]
    chips = [hexrgb(h) for h in ("#2f8c88", "#ef6a4c", "#f2b33d", "#1d3557", "#c88b4f", "#9fb7b3")]
    ys, xs = np.mgrid[0:size, 0:size]
    for k in range(2600):
        cx, cy = rng.integers(0, size, 2)
        rad = rng.uniform(1.5, 7.0)
        c = chips[rng.integers(0, len(chips))] * rng.uniform(0.85, 1.1)
        x0, x1 = int(cx - rad - 1), int(cx + rad + 2)
        y0, y1 = int(cy - rad - 1), int(cy + rad + 2)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        ang = rng.uniform(0, math.pi)
        dx, dy = xx - cx, yy - cy
        rx = dx * math.cos(ang) + dy * math.sin(ang)
        ry = -dx * math.sin(ang) + dy * math.cos(ang)
        m = (rx / rad) ** 2 + (ry / (rad * rng.uniform(0.5, 1.0))) ** 2 < 1
        col[yy[m] % size, xx[m] % size] = c
    rough = np.full((size, size), 0.22, np.float32) + 0.1 * periodic_noise(size, 16, 32, 2)
    save("terrazzo_albedo", col)
    save("terrazzo_normal", normal_from_height(periodic_noise(size, 64, 33, 2) * 0.3, 1.0))
    save("terrazzo_rough", np.repeat(rough[..., None], 3, 2))


# ---- plaster for the upper walls: warm, a little trowelled, 2 m across -----------------------------------------------------
def plaster(size=1024):
    n1 = periodic_noise(size, 4, 41, 5, 0.55)
    n2 = periodic_noise(size, 64, 42, 2)
    base = hexrgb("#f1dcb4")
    albedo = base * (0.93 + 0.08 * n1[..., None] + 0.03 * n2[..., None])
    save("plaster_albedo", albedo)
    save("plaster_normal", normal_from_height(n1 * 0.6 + n2 * 0.4, 1.6))
    save("plaster_rough", np.repeat((0.82 + 0.1 * n2)[..., None], 3, 2))


# ---- timber: oiled oak planks along x, 1 m across ---------------------------------------------------------------------------
def timber(size=1024):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    rows = 6
    plank = np.floor(ys / size * rows).astype(int)
    r = np.random.default_rng(51).random((rows, 3)).astype(np.float32)
    lv = (ys / size * rows) % 1
    warp = periodic_noise(size, 4, 52, 3)
    rings = np.sin((lv * 9 + warp * 6 + r[plank, 0] * 10) * math.pi * 2) * 0.5 + 0.5
    fine = periodic_noise(size, 256, 53, 1)
    streak = np.repeat(periodic_noise(size, 64, 54, 2)[:, :1], size, 1)
    light, dark = hexrgb("#d39a5c"), hexrgb("#a86b3a")
    t = np.clip(0.55 * rings + 0.3 * fine + 0.15 * streak, 0, 1)
    col = light * (1 - t[..., None]) + dark * t[..., None]
    col *= (0.92 + 0.12 * r[plank, 1])[..., None]
    gap = np.clip(np.minimum(lv, 1 - lv) / 0.012, 0, 1)
    col *= (0.55 + 0.45 * gap)[..., None]
    height = gap * 0.8 + 0.2 * rings * gap
    save("timber_albedo", col)
    save("timber_normal", normal_from_height(height, 2.0))
    save("timber_rough", np.repeat((0.45 + 0.2 * fine)[..., None], 3, 2))


# ---- the water: a tileable normal map of small ripples, and the caustic web the pool's floor shows -------------------------
def water(size=1024):
    h = periodic_noise(size, 6, 61, 5, 0.55) * 0.7 + periodic_noise(size, 24, 62, 3) * 0.3
    save("water_normal", normal_from_height(h, 9.0))


def caustics(size=1024, cells=9):
    """A tileable caustic web: thin, wavy bright lines where Voronoi cells meet (F2 - F1 small), like sunlight focused by the
    ripples. The domain is warped by periodic noise so the lines curve."""
    r = np.random.default_rng(71)
    pts = r.random((cells * cells, 2)).astype(np.float32) * size
    allp = np.concatenate([pts + np.array([dx, dy]) * size for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    amp = size / cells * 0.35
    xs = xs + (periodic_noise(size, 3, 72, 3) - 0.5) * 2 * amp
    ys = ys + (periodic_noise(size, 3, 73, 3) - 0.5) * 2 * amp
    f1 = np.full((size, size), 1e9, np.float32)
    f2 = np.full((size, size), 1e9, np.float32)
    for px, py in allp:
        d = np.hypot(xs - px, ys - py)
        f2 = np.where(d < f1, f1, np.minimum(f2, d))
        f1 = np.minimum(f1, d)
    e = (f2 - f1) / (size / cells)
    web = np.exp(-e * 22.0) + 0.35 * np.exp(-e * 7.0)
    web = (web / web.max()) ** 1.2
    save("caustics", np.repeat(web[..., None], 3, 2))


if __name__ == "__main__":
    only = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    jobs = {
        "pool_mosaic": pool_mosaic,
        "deck_tile": deck_tile,
        "wall_sea": lambda: wall_tile("wall_sea", "#3e9e8f", "#4fb1a0", 0.25),
        "wall_cream": lambda: wall_tile("wall_cream", "#f3e8cf", "#efdfc0", 0.3),
        "wall_navy": lambda: wall_tile("wall_navy", "#24456e", "#1d3557", 0.4),
        "terrazzo": terrazzo,
        "plaster": plaster,
        "timber": timber,
        "water": water,
        "caustics": caustics,
    }
    for name, job in jobs.items():
        if not only or name in only:
            job()
