"""The Lazy River's painted pieces made once on fal (README: the prompts), made ready for the model (python3 with Pillow and numpy):
- the Lazy Idol's face (1:1, on white) keyed into a cut-out from its edges (the white flood-filled in from the border only, so the
  pale lichen inside stays) and trimmed;
- the foliage sheet (1:1, on white: three monstera leaves, two banana leaves, a liana, heliconia, a bird of paradise, a bromeliad)
  cut into its nine pieces by their blobs, each keyed and trimmed, named in reading order;
- the explorer's map and the travel poster resized into the signs.

    python3 tools/venues/river/painted.py <folder with idol.png, foliage.png, map.png, poster.png> <work folder>
"""

import sys, os, collections
import numpy as np
from PIL import Image

GEN, WORK = sys.argv[1], sys.argv[2]
os.makedirs(WORK + "/textures", exist_ok=True)
os.makedirs(WORK + "/signs", exist_ok=True)


def key_white(img, tol=26):
    """Alpha 0 for the near-white pixels joined to the border (a flood fill from every border pixel), 1 elsewhere, the edge
    eaten a pixel and softened."""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    white = (255 - a).max(axis=2) < tol
    bg = np.zeros((h, w), bool)
    q = collections.deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    alpha = (~bg).astype(np.float32)
    # erode one pixel (the white halo), then a little softening
    er = alpha.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        er = np.minimum(er, np.roll(np.roll(alpha, dy, 0), dx, 1))
    soft = (er * 4 + sum(np.roll(np.roll(er, dy, 0), dx, 1) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))) / 8
    rgba = np.dstack([a.astype(np.uint8), (np.clip(soft, 0, 1) * 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA"), er > 0.5


def trim(im, pad=6):
    bb = im.getchannel("A").getbbox()
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def fit(im, longest):
    k = longest / max(im.size)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


# ---- the idol ------------------------------------------------------------------------------------------------------------------
idol, _ = key_white(Image.open(GEN + "/idol.png"))
fit(trim(idol), 1024).save(WORK + "/textures/idol_alpha.png")

# ---- the foliage sheet: its blobs, largest nine, in reading order --------------------------------------------------------------
sheet = Image.open(GEN + "/foliage.png").convert("RGB")
keyed, mask = key_white(sheet)
small = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((256, 256), Image.NEAREST)) > 0
lab = np.zeros(small.shape, int)
blobs = []
for y in range(256):
    for x in range(256):
        if small[y, x] and not lab[y, x]:
            n = len(blobs) + 1
            q = collections.deque([(y, x)])
            lab[y, x] = n
            pts = []
            while q:
                cy, cx = q.popleft()
                pts.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < 256 and 0 <= nx < 256 and small[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            q.append((ny, nx))
            ys, xs = zip(*pts)
            blobs.append((len(pts), min(ys), min(xs), max(ys), max(xs), n))
big = sorted(blobs, reverse=True)[:9]
# reading order: rows by the blob's middle height (three rows), then left to right
big.sort(key=lambda b: ((b[1] + b[3]) / 2 // 85, (b[2] + b[4]) / 2))
names = ["monstera_1", "monstera_2", "monstera_3", "banana_1", "banana_2", "liana", "heliconia", "paradise", "bromeliad"]
k = sheet.width / 256
for name, (_, y0, x0, y1, x1, n) in zip(names, big):
    box = (int(x0 * k) - 4, int(y0 * k) - 4, int((x1 + 1) * k) + 4, int((y1 + 1) * k) + 4)
    piece = keyed.crop(box)
    # (only this blob: anything of a neighbour's in its box goes)
    m = (lab[y0 : y1 + 1, x0 : x1 + 1] == n).astype(np.uint8) * 255
    m = Image.fromarray(m).resize((piece.width - 8, piece.height - 8), Image.NEAREST)
    holder = Image.new("L", piece.size, 0)
    holder.paste(m, (4, 4))
    # grow the blob's mask a little so the keyed edge inside it decides
    grown = np.asarray(holder).astype(np.float32)
    for _ in range(3):
        grown = np.maximum.reduce([grown] + [np.roll(np.roll(grown, dy, 0), dx, 1) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))])
    a = np.minimum(np.asarray(piece.getchannel("A")), grown.astype(np.uint8))
    # (leaves have no pure white: the background caught inside a monstera's holes or between stems goes too)
    rgb = np.asarray(piece.convert("RGB")).astype(np.int16)
    a = np.where((255 - rgb).max(axis=2) < 22, 0, a).astype(np.uint8)
    piece.putalpha(Image.fromarray(a))
    fit(trim(piece), 512).save(f"{WORK}/textures/{name}_alpha.png")
    print("CUT", name, piece.size)

# ---- the map and the poster --------------------------------------------------------------------------------------------------
fit(Image.open(GEN + "/map.png").convert("RGB"), 1024).save(WORK + "/signs/map.png")
fit(Image.open(GEN + "/poster.png").convert("RGB"), 768).save(WORK + "/signs/poster.png")
print("PAINTED", WORK)
