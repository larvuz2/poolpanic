"""The Cruise Ship's painted pieces made once on fal (README: the prompts), made ready for the model (python3 with Pillow and numpy):
- the kraken (1:1, on white: the pool floor's mosaic) keyed into a cut-out from its edges and trimmed;
- CAPTAIN FOR A DAY, the photo board: its white margin keyed away, and its two face holes too (the white inside it, the largest
  enclosed patches), so the sea and the guests show through them;
- the towel animals and the seagulls (3:2 sheets of six, on white) cut into their pieces by their blobs, each keyed and trimmed,
  named in reading order;
- the travel poster, Captain Barnacle's portrait and the deck plan resized into the signs.

    python3 tools/venues/cruise/painted.py <folder with the fal pictures> <work folder>
"""

import sys, os, collections
import numpy as np
from PIL import Image

GEN, WORK = sys.argv[1], sys.argv[2]
os.makedirs(WORK + "/textures", exist_ok=True)
os.makedirs(WORK + "/signs", exist_ok=True)
STEPS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def flood(mask, seeds):
    """The pixels of `mask` joined to any of `seeds`."""
    h, w = mask.shape
    out = np.zeros((h, w), bool)
    q = collections.deque()
    for y, x in seeds:
        if mask[y, x] and not out[y, x]:
            out[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in STEPS:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def key_white(img, tol=26, holes=0):
    """Alpha 0 for the near-white pixels joined to the border, and (`holes`) for the `holes` largest enclosed white patches too;
    the edge eaten a pixel and softened."""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    white = (255 - a).max(axis=2) < tol
    border = [(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)]
    bg = flood(white, border)
    if holes:
        inner = white & ~bg
        # (on a quarter-size map, the enclosed patches by size)
        small = np.asarray(Image.fromarray(inner.astype(np.uint8) * 255).resize((w // 4, h // 4), Image.NEAREST)) > 0
        lab, sizes = label(small)
        for n in sorted(sizes, key=sizes.get, reverse=True)[:holes]:
            ys, xs = np.nonzero(lab == n)
            seeds = [(min(h - 1, y * 4 + 2), min(w - 1, x * 4 + 2)) for y, x in zip(ys[::7], xs[::7])]
            bg |= flood(inner, seeds)
    alpha = (~bg).astype(np.float32)
    er = alpha.copy()
    for dy, dx in STEPS:
        er = np.minimum(er, np.roll(np.roll(alpha, dy, 0), dx, 1))
    soft = (er * 4 + sum(np.roll(np.roll(er, dy, 0), dx, 1) for dy, dx in STEPS)) / 8
    rgba = np.dstack([a.astype(np.uint8), (np.clip(soft, 0, 1) * 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA"), er > 0.5


def label(mask):
    """Connected patches (8-way) of a small mask: (labels, {label: size})."""
    h, w = mask.shape
    lab = np.zeros((h, w), int)
    sizes = {}
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not lab[y, x]:
                n = len(sizes) + 1
                q = collections.deque([(y, x)])
                lab[y, x] = n
                k = 0
                while q:
                    cy, cx = q.popleft()
                    k += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n
                                q.append((ny, nx))
                sizes[n] = k
    return lab, sizes


def trim(im, pad=6):
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def fit(im, longest):
    k = longest / max(im.size)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def sheet(file, names, tol, rows=2, longest=384):
    """A sheet of pieces on white: its largest blobs, one per name, in reading order (`rows` rows), each keyed and trimmed."""
    img = Image.open(GEN + "/" + file).convert("RGB")
    keyed, mask = key_white(img, tol)
    S = 256
    small = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((S, S), Image.NEAREST)) > 0
    lab, sizes = label(small)
    big = sorted(sizes, key=sizes.get, reverse=True)[: len(names)]
    boxes = []
    for n in big:
        ys, xs = np.nonzero(lab == n)
        boxes.append((ys.min(), xs.min(), ys.max(), xs.max(), n))
    boxes.sort(key=lambda b: (int((b[0] + b[2]) / 2 // (S / rows)), (b[1] + b[3]) / 2))
    kx, ky = img.width / S, img.height / S
    for name, (y0, x0, y1, x1, n) in zip(names, boxes):
        box = (int(x0 * kx) - 4, int(y0 * ky) - 4, int((x1 + 1) * kx) + 4, int((y1 + 1) * ky) + 4)
        piece = keyed.crop(box)
        m = (lab[y0 : y1 + 1, x0 : x1 + 1] == n).astype(np.uint8) * 255
        m = Image.fromarray(m).resize((piece.width - 8, piece.height - 8), Image.NEAREST)
        holder = Image.new("L", piece.size, 0)
        holder.paste(m, (4, 4))
        grown = np.asarray(holder).astype(np.float32)
        for _ in range(4):
            grown = np.maximum.reduce([grown] + [np.roll(np.roll(grown, dy, 0), dx, 1) for dy, dx in STEPS])
        a = np.minimum(np.asarray(piece.getchannel("A")), grown.astype(np.uint8))
        piece.putalpha(Image.fromarray(a))
        fit(trim(piece), longest).save(f"{WORK}/textures/{name}_alpha.png")
        print("CUT", name, piece.size)


# ---- the kraken on the pool's floor ----------------------------------------------------------------------------------------
kraken, _ = key_white(Image.open(GEN + "/kraken.png"))
fit(trim(kraken), 1024).save(WORK + "/textures/kraken_alpha.png")
# ---- CAPTAIN FOR A DAY: the margin and the two face holes --------------------------------------------------------------------
board, _ = key_white(Image.open(GEN + "/photoop.png"), tol=20, holes=2)
fit(trim(board), 1024).save(WORK + "/textures/photoop_alpha.png")
# ---- the towel animals and the seagulls ------------------------------------------------------------------------------------
sheet("towels.png", ["towel_elephant", "towel_swan", "towel_monkey", "towel_crab", "towel_turtle", "towel_octopus"], tol=10)
sheet("gulls.png", ["gull_fry", "gull_squawk", "gull_asleep", "gull_shades", "gull_smug", "gull_brolly"], tol=8)
# ---- the poster, the captain, the deck plan ------------------------------------------------------------------------------------
fit(Image.open(GEN + "/poster.png").convert("RGB"), 768).save(WORK + "/signs/poster.png")
fit(Image.open(GEN + "/captain.png").convert("RGB"), 768).save(WORK + "/signs/captain.png")
fit(Image.open(GEN + "/deckplan.png").convert("RGB"), 1024).save(WORK + "/signs/deckplan.png")
print("PAINTED", WORK)
