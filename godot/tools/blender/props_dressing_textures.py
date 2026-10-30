"""The printed and painted surfaces of the Community Pool's dressing and locker rooms: posters, notices, the whiteboard, the
honours board, clock faces, labels. Drawn with Pillow (system python3, not Blender's), into godot/assets/textures/props/
(dr_* for the hall's dressing, lk_* first made for the locker rooms: the shower sign by the changing rooms' doors). props_dressing.py
and props_doors.py run it when a file is missing.

    python3 godot/tools/blender/props_dressing_textures.py [name ...]   (any python3 with Pillow)
"""

import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "assets", "textures", "props"))

NAVY, CORAL, MUSTARD, SEA = "#1d3557", "#ef6a4c", "#f2b33d", "#2f8c88"
CREAM, PAPER, INK = "#f3e6c9", "#f6f1e4", "#1b1c1f"
BIRO, MARKER_RED, MARKER_BLUE = "#23408e", "#c8322b", "#1f4fa8"


def F(size, weight="Bold"):
    return ImageFont.truetype(os.path.join(FONTS, f"BarlowCondensed-{weight}.ttf"), size)


def P(size):
    return ImageFont.truetype(os.path.join(FONTS, "Pacifico-Regular.ttf"), size)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def grain(img, sigma=10):
    n = Image.effect_noise(img.size, sigma).convert("RGB")
    return ImageChops.add(img.convert("RGB"), n, 1.0, -128)


def fade(img, amount=0.35, tint="#e9d3a4"):
    """Sun-faded paper: less colour, lifted toward a warm yellow."""
    img = ImageEnhance.Color(img).enhance(1 - amount * 0.8)
    return Image.blend(img, Image.new("RGB", img.size, tint), amount * 0.45)


def vignette(img, strength=0.35, col="#6b4a2a"):
    w, h = img.size
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rectangle((0, 0, w, h), fill=255)
    d.rounded_rectangle((w * 0.06, h * 0.06, w * 0.94, h * 0.94), radius=int(min(w, h) * 0.2), fill=0)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.08)).point(lambda v: int(v * strength))
    return Image.composite(Image.new("RGB", (w, h), col), img, m)


def hand(img, xy, s, font, fill, jitter=4, seed=1, spacing=0.0, anchor_center=False):
    """Hand-written text: each letter drawn on its own, turned and lifted a little at random."""
    r = random.Random(seed)
    x, y = xy
    widths = [font.getlength(c) for c in s]
    if anchor_center:
        x -= sum(widths) / 2 + spacing * len(s) / 2
    for c, wch in zip(s, widths):
        if c != " ":
            box = font.getbbox(c)
            pad = int(font.size * 0.6)
            g = Image.new("RGBA", (int(wch) + 2 * pad, font.size * 2), (0, 0, 0, 0))
            ImageDraw.Draw(g).text((pad, font.size * 0.3), c, font=font, fill=fill)
            g = g.rotate(r.uniform(-jitter, jitter), resample=Image.BICUBIC, center=(pad + wch / 2, font.size))
            img.paste(g, (int(x - pad), int(y - font.size * 0.3 + r.uniform(-1.5, 1.5) * font.size / 30)), g)
        x += wch + spacing
    return x


def wobble_line(d, a, b, fill, width=3, seed=0, amp=1.2):
    r = random.Random(seed)
    n = 12
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((a[0] + (b[0] - a[0]) * t + r.uniform(-amp, amp), a[1] + (b[1] - a[1]) * t + r.uniform(-amp, amp)))
    d.line(pts, fill=fill, width=width, joint="curve")


def ctext(d, xy, s, font, fill, anchor="mm"):
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + ".png")
    img.convert("RGBA" if img.mode == "RGBA" else "RGB").save(path, optimize=True)
    print("TEXTURE", os.path.relpath(path, os.path.dirname(OUT)), img.size)


# ---- pictograms ------------------------------------------------------------------------------------------------------------
POSES = {
    # joints in body heights from the feet line (y up is negative): head, then limbs as polylines
    "stand": dict(head=(0, -0.86), limbs=[[(0, -0.72), (0, -0.3)], [(0, -0.66), (-0.2, -0.45), (-0.24, -0.28)], [(0, -0.66), (0.2, -0.45), (0.24, -0.28)], [(0, -0.3), (-0.12, 0.0)], [(0, -0.3), (0.12, 0.0)]]),
    "run": dict(head=(0.14, -0.86), limbs=[[(0.1, -0.72), (0.0, -0.32)], [(0.08, -0.66), (0.3, -0.52), (0.42, -0.66)], [(0.08, -0.66), (-0.14, -0.5), (-0.3, -0.36)], [(0.0, -0.32), (0.26, -0.16), (0.22, 0.02)], [(0.0, -0.32), (-0.14, -0.12), (-0.4, -0.06)]]),
    "dive": dict(head=(0.3, -0.3), limbs=[[(0.18, -0.36), (-0.22, -0.62)], [(0.16, -0.38), (0.5, -0.12)], [(0.16, -0.34), (0.48, -0.06)], [(-0.22, -0.62), (-0.5, -0.86)], [(-0.22, -0.62), (-0.56, -0.8)]]),
    "bomb": dict(head=(-0.02, -0.74), limbs=[[(0.0, -0.6), (-0.06, -0.3)], [(-0.06, -0.3), (0.18, -0.46), (0.2, -0.22)], [(-0.04, -0.3), (0.12, -0.5), (0.14, -0.26)], [(0.0, -0.56), (0.2, -0.42)], [(0.0, -0.56), (0.24, -0.36)]]),
    "eat": dict(head=(0, -0.86), limbs=[[(0, -0.72), (0, -0.3)], [(0, -0.66), (-0.2, -0.45), (-0.24, -0.28)], [(0, -0.66), (0.2, -0.6), (0.12, -0.82)], [(0, -0.3), (-0.12, 0.0)], [(0, -0.3), (0.12, 0.0)]]),
    "whistle": dict(head=(0, -0.86), limbs=[[(0, -0.72), (0, -0.3)], [(0, -0.66), (-0.22, -0.8), (-0.3, -1.0)], [(0, -0.66), (0.18, -0.7), (0.1, -0.84)], [(0, -0.3), (-0.12, 0.0)], [(0, -0.3), (0.12, 0.0)]]),
}


def figure(d, cx, cy, s, pose, col, w=None):
    p = POSES[pose]
    w = w or max(3, int(s * 0.085))
    T = lambda q: (cx + q[0] * s, cy + q[1] * s)
    for limb in p["limbs"]:
        d.line([T(q) for q in limb], fill=col, width=w, joint="curve")
        for q in (limb[0], limb[-1]):
            x, y = T(q)
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=col)
    hx, hy = T(p["head"])
    r = s * 0.1
    d.ellipse((hx - r, hy - r, hx + r, hy + r), fill=col)


def waves(d, x0, x1, y, amp, col, w=4, period=40):
    pts = [(x, y + amp * math.sin((x - x0) / period * 2 * math.pi)) for x in range(int(x0), int(x1) + 1, 3)]
    d.line(pts, fill=col, width=w, joint="curve")


def no_sign(d, cx, cy, r, w=None, col="#d6423a"):
    w = w or int(r * 0.16)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=col, width=w)
    a = math.radians(45)
    d.line((cx - r * math.cos(a) + w * 0.2, cy - r * math.sin(a) + w * 0.2, cx + r * math.cos(a) - w * 0.2, cy + r * math.sin(a) - w * 0.2), fill=col, width=w)


def pictogram(kind, size=200, bg=None):
    """One rule's pictogram: a navy figure, a red prohibition ring where it is a 'no'."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0) if bg is None else rgb(bg) + (255,))
    d = ImageDraw.Draw(img)
    c = size / 2
    s = size * 0.62
    col = NAVY
    if kind == "run":
        figure(d, c, c + s * 0.4, s, "run", col)
        no_sign(d, c, c, size * 0.45)
    elif kind == "dive":
        figure(d, c + s * 0.05, c + s * 0.25, s, "dive", col)
        waves(d, size * 0.12, size * 0.88, c + s * 0.42, 4, SEA, 5, 28)
        no_sign(d, c, c, size * 0.45)
    elif kind == "bomb":
        figure(d, c, c + s * 0.32, s, "bomb", col)
        for k in (-1, 1):
            d.line((c + k * s * 0.3, c + s * 0.3, c + k * s * 0.45, c + s * 0.12), fill=SEA, width=5)
        waves(d, size * 0.12, size * 0.88, c + s * 0.42, 4, SEA, 5, 28)
        no_sign(d, c, c, size * 0.45)
    elif kind == "eat":
        figure(d, c - s * 0.05, c + s * 0.42, s * 0.92, "eat", col)
        x, y = c + s * 0.12, c - s * 0.42
        d.polygon([(x - 13, y), (x + 13, y), (x, y + 30)], fill=MUSTARD)
        d.ellipse((x - 14, y - 22, x + 14, y + 4), fill=CORAL)
        no_sign(d, c, c, size * 0.45)
    elif kind == "shower":
        figure(d, c + s * 0.05, c + s * 0.45, s * 0.85, "stand", col)
        d.line((c - s * 0.45, c - s * 0.62, c - s * 0.45, c - s * 0.75, c - s * 0.1, c - s * 0.75), fill=col, width=6)
        d.pieslice((c - s * 0.2, c - s * 0.78, c + s * 0.06, c - s * 0.55), 180, 360, fill=col)
        for k in range(5):
            x = c - s * 0.16 + k * s * 0.055
            d.line((x, c - s * 0.58, x + 3, c - s * 0.45), fill=SEA, width=4)
        d.ellipse((c - size * 0.45, c - size * 0.45, c + size * 0.45, c + size * 0.45), outline="#3f8a4a", width=int(size * 0.07))
    elif kind == "whistle":
        figure(d, c, c + s * 0.42, s * 0.9, "whistle", col)
        d.rounded_rectangle((c + s * 0.12, c - s * 0.4, c + s * 0.32, c - s * 0.3), 4, fill=MUSTARD)
        for k in range(3):
            d.arc((c + s * 0.25 + k * 9, c - s * 0.55 - k * 9, c + s * 0.45 + k * 9, c - s * 0.25 + k * 9), 290, 350, fill=CORAL, width=4)
        d.ellipse((c - size * 0.45, c - size * 0.45, c + size * 0.45, c + size * 0.45), outline="#3f8a4a", width=int(size * 0.07))
    return img


# ---- the locker rooms ---------------------------------------------------------------------------------------------------------
def lk_note_ooo():
    w, h = 256, 320
    img = Image.new("RGB", (w, h), "#fbf8ee")
    d = ImageDraw.Draw(img)
    for y in range(70, h, 26):
        d.line((0, y, w, y), fill="#b9cde6", width=2)
    d.line((34, 0, 34, h), fill="#e8a3a3", width=2)
    hand(img, (46, 40), "Out of", P(52), MARKER_RED, 5, 3)
    hand(img, (60, 112), "order!", P(58), MARKER_RED, 5, 4)
    wobble_line(d, (52, 196), (212, 190), MARKER_RED, 5, 2)
    hand(img, (48, 220), "key snapped -", F(30, "SemiBold"), BIRO, 3, 5)
    hand(img, (48, 254), "use No. 14  (Dave)", F(28, "SemiBold"), BIRO, 3, 6)
    save(grain(img, 6), "lk_note_out_of_order")


def lk_note_kick():
    w = 256
    img = Image.new("RGB", (w, w), "#f7df6e")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w, 34), fill="#f0d25a")
    hand(img, (26, 44), "No. 7 sticks", F(44, "SemiBold"), BIRO, 4, 11)
    hand(img, (26, 100), "- give it a", F(44, "SemiBold"), BIRO, 4, 12)
    hand(img, (26, 156), "good KICK :)", F(44, "SemiBold"), BIRO, 4, 13)
    save(grain(img, 6), "lk_note_kick")


def lk_sign_shower():
    w, h = 512, 256
    img = Image.new("RGB", (w, h), CREAM)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, w - 8, h - 8), 26, outline=NAVY, width=10)
    pic = pictogram("shower", 176, CREAM)
    img.paste(pic, (30, 40), pic)
    ctext(d, (350, 88), "PLEASE SHOWER", F(42, "ExtraBold"), NAVY)
    ctext(d, (350, 140), "BEFORE SWIMMING", F(36, "Bold"), SEA)
    ctext(d, (350, 194), "thank you", P(28), CORAL)
    save(grain(fade(img, 0.15), 5), "lk_sign_shower")


def lk_sign_valuables():
    w, h = 512, 192
    img = Image.new("RGB", (w, h), NAVY)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, w - 8, h - 8), 18, outline=CREAM, width=5)
    ctext(d, (w / 2, 62), "LOCKERS: 20p", F(64, "ExtraBold"), MUSTARD)
    ctext(d, (w / 2, 128), "The club cannot accept responsibility", F(28, "SemiBold"), CREAM)
    ctext(d, (w / 2, 160), "for valuables left in lockers", F(28, "SemiBold"), CREAM)
    save(grain(img, 5), "lk_sign_valuables")


def lk_scale_dial():
    s = 256
    img = Image.new("RGB", (s, s), "#f4f1ea")
    d = ImageDraw.Draw(img)
    c = s / 2
    d.ellipse((6, 6, s - 6, s - 6), fill="#fbfaf5", outline=NAVY, width=8)
    for k in range(60):
        a = math.radians(-150 + k * 5)
        r0 = c - 24 if k % 5 else c - 36
        d.line((c + math.sin(a) * r0, c - math.cos(a) * r0, c + math.sin(a) * (c - 16), c - math.cos(a) * (c - 16)), fill=INK, width=2 if k % 5 else 4)
        if k % 10 == 0:
            ctext(d, (c + math.sin(a) * (c - 56), c - math.cos(a) * (c - 56)), str(k * 2), F(24, "Bold"), INK)
    ctext(d, (c, c + 52), "kg", F(28, "Bold"), CORAL)
    a = math.radians(-150 + 37 * 5)
    d.line((c, c, c + math.sin(a) * (c - 30), c - math.cos(a) * (c - 30)), fill="#d6423a", width=5)
    d.ellipse((c - 9, c - 9, c + 9, c + 9), fill=INK)
    save(img, "lk_scale_dial")


# ---- the hall's dressing ---------------------------------------------------------------------------------------------------
def dr_poster_gala():
    w, h = 512, 768
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):  # a sunset sky
        t = y / h
        a, b = rgb("#f6c27a"), rgb("#f3e2c0")
        d.line((0, y, w, y), fill=tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    d.ellipse((96, 190, 416, 510), fill=CORAL)
    for k in range(6):
        y = 400 + k * 18
        d.rectangle((90, y, 420, y + 5 + k), fill="#f4d6a6")
    for k, col in enumerate([SEA, "#3a9e98", NAVY, SEA, NAVY]):
        y0 = 500 + k * 36
        pts = [(x, y0 + 12 * math.sin(x / 46 + k)) for x in range(-10, w + 12, 6)] + [(w + 10, h), (-10, h)]
        d.polygon(pts, fill=col)
    # a diver in a swallow dive over the sun
    body = [(132, 262), (210, 230), (300, 262), (360, 330), (392, 410)]
    d.line(body, fill=NAVY, width=30, joint="curve")
    d.line([(150, 255), (110, 250), (80, 262)], fill=NAVY, width=12, joint="curve")
    d.line([(160, 250), (128, 220), (98, 214)], fill=NAVY, width=12, joint="curve")
    d.line([(392, 410), (404, 470)], fill=NAVY, width=16)
    d.line([(380, 400), (380, 466)], fill=NAVY, width=14)
    d.ellipse((96, 236, 142, 282), fill=NAVY)
    d.rectangle((0, 0, w, 150), fill=NAVY)
    ctext(d, (w / 2, 52), "HARBOURSIDE", F(78, "Black"), CREAM)
    ctext(d, (w / 2, 118), "SWIM  GALA", F(66, "ExtraBold"), MUSTARD)
    ctext(d, (w / 2, 196), "1974", P(64), NAVY)
    d.rectangle((0, h - 104, w, h), fill=CREAM)
    ctext(d, (w / 2, h - 74), "SATURDAY 17 AUGUST  ·  2.30 PM", F(36, "Bold"), NAVY)
    ctext(d, (w / 2, h - 36), "HARBOURSIDE BATHS  ·  ADMISSION 10p", F(30, "SemiBold"), CORAL)
    img = fade(img, 0.45)
    d = ImageDraw.Draw(img)
    d.line((w / 2, 0, w / 2 + 3, h), fill="#e2cfa6", width=2)  # the fold
    d.line((0, h / 2, w, h / 2 - 2), fill="#e2cfa6", width=2)
    img = vignette(img, 0.4)
    save(grain(img, 9), "dr_poster_gala")


def dr_poster_learn():
    w, h = 512, 768
    img = Image.new("RGB", (w, h), "#7cc6e3")
    d = ImageDraw.Draw(img)
    for k in range(9):
        y0 = 360 + k * 46
        pts = [(x, y0 + 10 * math.sin(x / 38 + k * 1.3)) for x in range(-10, w + 12, 6)] + [(w + 10, h), (-10, h)]
        d.polygon(pts, fill=SEA if k % 2 else "#3a9e98")
    ctext(d, (w / 2, 92), "LEARN", F(132, "Black"), NAVY)
    ctext(d, (w / 2, 196), "TO SWIM!", F(96, "Black"), CREAM)
    # a swimmer in armbands in a duck ring
    cx, cy = 256, 390
    d.ellipse((cx - 150, cy - 26, cx + 150, cy + 70), fill=MUSTARD)
    d.ellipse((cx - 92, cy - 4, cx + 92, cy + 44), fill="#3a9e98")
    d.ellipse((cx + 112, cy - 98, cx + 182, cy - 28), fill=MUSTARD)  # the duck's head
    d.polygon([(cx + 176, cy - 70), (cx + 214, cy - 60), (cx + 176, cy - 50)], fill=CORAL)
    d.ellipse((cx + 148, cy - 80, cx + 162, cy - 66), fill=NAVY)
    d.rectangle((cx + 128, cy - 40, cx + 162, cy + 6), fill=MUSTARD)
    d.ellipse((cx - 50, cy - 150, cx + 50, cy - 50), fill="#f2b48f")  # the face
    d.chord((cx - 52, cy - 156, cx + 52, cy - 80), 180, 360, fill=CORAL)  # a swim cap
    d.ellipse((cx - 22, cy - 112, cx - 10, cy - 100), fill=NAVY)
    d.ellipse((cx + 10, cy - 112, cx + 22, cy - 100), fill=NAVY)
    d.arc((cx - 24, cy - 104, cx + 24, cy - 70), 20, 160, fill=NAVY, width=5)
    for k in (-1, 1):
        d.line((cx + k * 40, cy - 40, cx + k * 110, cy - 110), fill="#f2b48f", width=24)
        d.rounded_rectangle((cx + k * 75 - 22, cy - 92, cx + k * 75 + 22, cy - 58), 10, fill=CORAL)
    d.rectangle((0, h - 150, w, h), fill=CREAM)
    ctext(d, (w / 2, h - 112), "CLASSES FOR ALL AGES", F(46, "ExtraBold"), NAVY)
    ctext(d, (w / 2, h - 66), "Ducklings · Improvers · Adults", F(34, "SemiBold"), SEA)
    ctext(d, (w / 2, h - 28), "ask at the desk", P(28), CORAL)
    img = vignette(fade(img, 0.3), 0.3)
    save(grain(img, 8), "dr_poster_learn")


def dr_whiteboard():
    w, h = 1024, 512
    img = Image.new("RGB", (w, h), "#f5f6f3")
    d = ImageDraw.Draw(img)
    # ghosts of old writing, not quite wiped
    ghost = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hand(ghost, (560, 380), "relay order?", F(40, "SemiBold"), (40, 70, 140, 34), 4, 21)
    hand(ghost, (120, 440), "8 x 50 kick", F(40, "SemiBold"), (40, 70, 140, 30), 4, 22)
    img.paste(ghost, (0, 0), ghost)
    hand(img, (30, 18), "SQUAD A  -  LAP TIMES", F(46, "ExtraBold"), MARKER_BLUE, 2, 1)
    cols = [30, 190, 300, 410, 520]
    rows = [78 + 46 * k for k in range(8)]
    for k, y in enumerate(rows):
        wobble_line(d, (cols[0], y), (cols[-1], y), "#3a3b40", 2, 40 + k, 0.8)
    for k, x in enumerate(cols):
        wobble_line(d, (x, rows[0]), (x, rows[-1]), "#3a3b40", 2, 60 + k, 0.8)
    f = F(32, "SemiBold")
    for k, s in enumerate(["NAME", "50 FR", "100 FR", "200 IM"]):
        hand(img, (cols[k] + 10, rows[0] + 6), s, f, INK, 2, 70 + k)
    data = [
        ("MARCO", "0:24.1", "0:53.8", "2:09.5"),
        ("ROSIE", "0:31.6", "1:09.2", "2:41.0"),
        ("BENJI", "0:33.0", "1:12.4", "-"),
        ("LOLA", "0:29.9", "1:05.7", "2:33.8"),
        ("ARLO", "0:35.2", "1:17.0", "2:58.1"),
        ("MINA", "0:30.4", "1:06.9", "2:36.2"),
    ]
    for i, row in enumerate(data):
        for k, s in enumerate(row):
            hand(img, (cols[k] + 10, rows[i + 1] + 6), s, f, MARKER_BLUE if k else INK, 3, 100 + i * 7 + k)
    d.ellipse((182, rows[1] - 2, 306, rows[2] + 2), outline=MARKER_RED, width=4)
    hand(img, (cols[4] + 14, rows[1] + 2), "<- PB!", F(32, "ExtraBold"), MARKER_RED, 6, 140)
    # the lessons timetable
    hand(img, (640, 18), "SWIM LESSONS", F(50, "ExtraBold"), MARKER_RED, 2, 150)
    wobble_line(d, (640, 72), (940, 70), MARKER_RED, 4, 151)
    lessons = [
        ("MON", "4.00", "Ducklings", "#2b8a4a"),
        ("TUE", "5.30", "Improvers", MARKER_BLUE),
        ("WED", "7.00", "Adults (beginners)", INK),
        ("THU", "4.00", "Ducklings", "#2b8a4a"),
        ("FRI", "6.30am", "Squad A", MARKER_BLUE),
        ("SAT", "9.00", "Gala practice!", MARKER_RED),
    ]
    for i, (day, t, what, col) in enumerate(lessons):
        y = 88 + i * 46
        hand(img, (640, y), day, F(34, "ExtraBold"), INK, 2, 160 + i)
        hand(img, (708, y), t, F(34, "SemiBold"), col, 3, 170 + i)
        hand(img, (800, y), what, F(34, "SemiBold"), col, 3, 180 + i)
    # a fish doodle and a reminder
    fx, fy = 860, 440
    d.ellipse((fx, fy, fx + 80, fy + 44), outline=MARKER_BLUE, width=4)
    d.line((fx, fy + 22, fx - 30, fy, fx - 28, fy + 46, fx, fy + 22), fill=MARKER_BLUE, width=4)
    d.ellipse((fx + 54, fy + 12, fx + 64, fy + 22), fill=MARKER_BLUE)
    for k in range(3):
        d.ellipse((fx + 88 + k * 10, fy - 8 - k * 18, fx + 100 + k * 12, fy + 4 - k * 16), outline=MARKER_BLUE, width=2)
    hand(img, (640, 372), "GALA SATURDAY!!", F(46, "ExtraBold"), MARKER_RED, 4, 190)
    hand(img, (40, 456), "no phones on deck - Coach W.", F(30, "SemiBold"), INK, 3, 191)
    save(grain(img, 3), "dr_whiteboard")


def dr_rules():
    w, h = 512, 768
    img = Image.new("RGB", (w, h), "#f6efdc")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w, 120), fill=NAVY)
    ctext(d, (w / 2, 64), "POOL RULES", F(92, "Black"), CREAM)
    items = [("run", "NO RUNNING"), ("dive", "NO DIVING IN"), ("bomb", "NO BOMBING"), ("eat", "NO FOOD ON"), ("shower", "SHOWER"), ("whistle", "LISTEN TO THE")]
    second = ["", "THE SHALLOW END", "", "THE POOLSIDE", "BEFORE YOU SWIM", "LIFEGUARD"]
    for i, (kind, cap) in enumerate(items):
        cx = 128 + (i % 2) * 256
        cy = 210 + (i // 2) * 190
        pic = pictogram(kind, 140)
        img.paste(pic, (int(cx - 70), int(cy - 82)), pic)
        ctext(d, (cx, cy + 74), cap, F(30, "ExtraBold"), NAVY)
        if second[i]:
            ctext(d, (cx, cy + 102), second[i], F(24, "Bold"), SEA)
    d.rectangle((0, h - 60, w, h), fill=CORAL)
    ctext(d, (w / 2, h - 30), "Thank you!  -  The Management", F(32, "Bold"), "#fff7e8")
    d.rounded_rectangle((4, 4, w - 4, h - 4), 12, outline=NAVY, width=8)
    save(grain(fade(img, 0.12), 5), "dr_rules")


def dr_honours():
    w, h = 512, 768
    r = random.Random(3)
    img = Image.new("RGB", (w, h), "#5b3820")
    d = ImageDraw.Draw(img)
    for x in range(0, w, 2):  # the grain of the varnished board
        v = 18 * math.sin(x / 23.0) + r.uniform(-14, 14)
        d.line((x, 0, x + r.uniform(-3, 3), h), fill=(int(91 + v), int(56 + v * 0.6), int(32 + v * 0.3)), width=2)
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    d = ImageDraw.Draw(img)
    gold, shade = "#e2bb5c", "#3a2210"
    d.rectangle((18, 18, w - 18, h - 18), outline=gold, width=4)
    d.rectangle((28, 28, w - 28, h - 28), outline="#b48c3c", width=2)
    for y, s, f in [(76, "HARBOURSIDE SWIMMING CLUB", F(40, "ExtraBold")), (124, "CLUB  CHAMPIONS", F(50, "Black"))]:
        ctext(d, (w / 2 + 2, y + 2), s, f, shade)
        ctext(d, (w / 2, y), s, f, gold)
    d.line((90, 160, w - 90, 160), fill=gold, width=2)
    names = ["E. HARGREAVES", "J. MORLEY", "P. QUINN", "D. ASHWORTH", "R. KAPOOR", "M. FLYNN", "S. OKAFOR", "T. BRENNAN", "A. WATERS", "L. DUBOIS", "K. NAKAMURA", "H. PRICE", "G. ROSSI", "B. FINCH", "C. MARSH", "F. OYELARAN", "W. STORM", "N. BROOKS", "J. FONTAINE", "R. RIVERS"]
    f = F(25, "SemiBold")
    for i in range(36):
        col = i // 18
        row = i % 18
        x = 50 + col * 222
        y = 182 + row * 31
        year = 1962 + i
        if i < 34:
            d.text((x + 1, y + 1), f"{year}", font=f, fill=shade)
            d.text((x, y), f"{year}", font=f, fill=gold)
            nm = names[(i * 7) % len(names)]
            d.text((x + 59, y + 1), nm, font=f, fill=shade)
            d.text((x + 58, y), nm, font=f, fill=gold)
        else:  # the last lines are still blank, waiting
            d.text((x, y), f"{year}", font=f, fill="#8c6a35")
    save(grain(img, 6), "dr_honours")


def dr_team_photo():
    w, h = 384, 288
    img = Image.new("RGB", (w, h), "#d9c49c")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w, 150), fill="#cdb48a")
    d.rectangle((0, 150, w, h), fill="#9fbcb5")
    for k in range(7):  # the back row, standing
        x = 46 + k * 49
        d.ellipse((x - 13, 52, x + 13, 80), fill="#6e5236")
        d.rounded_rectangle((x - 20, 80, x + 20, 190), 10, fill="#2b3a4a")
    for k in range(6):  # the front row, kneeling
        x = 70 + k * 49
        d.ellipse((x - 13, 118, x + 13, 146), fill="#7a5a3c")
        d.rounded_rectangle((x - 20, 146, x + 20, 224), 10, fill="#33495c")
    d.rectangle((70, 232, 314, 270), fill="#f3e6c9")
    ctext(d, (192, 251), "HARBOURSIDE S.C. 1974", F(26, "Bold"), NAVY)
    img = ImageEnhance.Color(img).enhance(0.25)
    img = Image.blend(img, Image.new("RGB", img.size, "#a97c4a"), 0.25)
    img = vignette(img, 0.6, "#3a2a1a").filter(ImageFilter.GaussianBlur(0.7))
    save(grain(img, 12), "dr_team_photo")


def note_img(w, h, bg, lines, seed=0, lined=False):
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    if lined:
        for y in range(44, h, 24):
            d.line((0, y, w, y), fill="#b9cde6", width=1)
    for (x, y, s, font, col) in lines:
        if font == "center":
            continue
        hand(img, (x, y), s, font, col, 3, seed + y)
    return img


def dr_corkboard():
    w, h = 1024, 640
    r = random.Random(5)
    img = Image.new("RGB", (w, h), "#b78755")
    d = ImageDraw.Draw(img)
    for _ in range(9000):
        x, y = r.uniform(0, w), r.uniform(0, h)
        s = r.uniform(1, 3.2)
        v = r.choice([-34, -22, 18, 26])
        d.ellipse((x, y, x + s, y + s), fill=(183 + v, 135 + v, 85 + v))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    notes = []
    # lost property
    n = Image.new("RGB", (250, 320), "#fbfaf4")
    nd = ImageDraw.Draw(n)
    ctext(nd, (125, 34), "LOST PROPERTY", F(38, "ExtraBold"), NAVY)
    for i, s in enumerate(["- blue goggles", "- 2 odd flip-flops", "- towel (dinosaur)", "- car keys (Ford)", "- false teeth (!!)"]):
        hand(n, (18, 70 + i * 40), s, F(30, "SemiBold"), BIRO, 2, 300 + i)
    hand(n, (40, 278), "ask at the desk", F(28, "SemiBold"), MARKER_RED, 2, 310)
    notes.append((n, 40, 40, -3))
    # aqua fit flyer
    n = Image.new("RGB", (240, 300), CORAL)
    nd = ImageDraw.Draw(n)
    ctext(nd, (120, 64), "AQUA", F(80, "Black"), "#fff4e0")
    ctext(nd, (120, 134), "FIT", F(80, "Black"), NAVY)
    ctext(nd, (120, 200), "Tues & Thurs", F(34, "Bold"), "#fff4e0")
    ctext(nd, (120, 236), "10 am", F(34, "Bold"), "#fff4e0")
    ctext(nd, (120, 274), "all welcome!", P(22), NAVY)
    notes.append((n, 318, 30, 4))
    # club trials
    n = Image.new("RGB", (260, 190), MUSTARD)
    nd = ImageDraw.Draw(n)
    ctext(nd, (130, 46), "SWIM CLUB", F(50, "Black"), NAVY)
    ctext(nd, (130, 100), "TRIALS", F(54, "Black"), "#fff7e8")
    ctext(nd, (130, 156), "Saturday 9 am · ages 8-14", F(26, "Bold"), NAVY)
    notes.append((n, 588, 46, -2))
    # a child's drawing of a fish
    n = Image.new("RGB", (240, 200), "#ffffff")
    nd = ImageDraw.Draw(n)
    for k in range(14):
        y = 150 + k * 4
        nd.line((10, y, 230, y + r.uniform(-4, 4)), fill="#5aa9d6", width=3)
    nd.ellipse((50, 50, 170, 130), fill="#f3934a", outline="#d9622a", width=4)
    nd.polygon([(52, 90), (14, 56), (18, 128)], fill="#f3934a", outline="#d9622a")
    nd.ellipse((132, 70, 154, 92), fill="#ffffff", outline=INK, width=3)
    nd.ellipse((140, 77, 150, 87), fill=INK)
    for k in range(3):
        nd.ellipse((184 + k * 8, 50 - k * 16, 196 + k * 10, 62 - k * 14), outline="#5aa9d6", width=3)
    hand(n, (120, 172), "by Lola 6", F(24, "SemiBold"), "#c8322b", 6, 330)
    notes.append((n, 850, 30, 6))
    # a polaroid
    n = Image.new("RGB", (190, 220), "#f8f8f4")
    nd = ImageDraw.Draw(n)
    nd.rectangle((12, 12, 178, 166), fill="#7cc6e3")
    nd.rectangle((12, 110, 178, 166), fill="#3a9e98")
    nd.ellipse((84, 70, 110, 96), fill="#f2b48f")
    nd.chord((82, 66, 112, 92), 180, 360, fill=CORAL)
    nd.line((70, 112, 96, 98, 124, 112), fill="#f2b48f", width=8)
    hand(n, (22, 176), "Doris - 100 lengths!", F(24, "SemiBold"), BIRO, 3, 340)
    notes.append((n, 300, 360, -7))
    # for sale, with tear-off tabs
    n = Image.new("RGB", (230, 270), "#fbfaf4")
    nd = ImageDraw.Draw(n)
    ctext(nd, (115, 34), "FOR SALE", F(44, "Black"), NAVY)
    hand(n, (16, 68), "kids wetsuit, age 6-7", F(28, "SemiBold"), BIRO, 2, 350)
    hand(n, (16, 104), "worn twice!  £10", F(28, "SemiBold"), BIRO, 2, 351)
    for k in range(7):
        x = 6 + k * 31
        if k in (1, 4):
            continue  # torn off already
        nd.line((x, 160, x, 270), fill="#bdbab0", width=1)
        tab = Image.new("RGBA", (100, 26), (0, 0, 0, 0))
        ImageDraw.Draw(tab).text((2, 0), "07700 9", font=F(20, "SemiBold"), fill=BIRO)
        tab = tab.rotate(90, expand=True)
        n.paste(tab, (x + 3, 165), tab)
    notes.append((n, 546, 300, 3))
    # a sticky note
    n = Image.new("RGB", (170, 170), "#f7df6e")
    hand(n, (12, 14), "Has anyone", F(30, "SemiBold"), BIRO, 3, 360)
    hand(n, (12, 50), "seen my blue", F(30, "SemiBold"), BIRO, 3, 361)
    hand(n, (12, 86), "flask??", F(30, "SemiBold"), BIRO, 3, 362)
    hand(n, (70, 124), "- Jean", F(30, "SemiBold"), BIRO, 3, 363)
    notes.append((n, 820, 300, -5))
    # timetable of the pool's opening hours
    n = Image.new("RGB", (240, 200), "#e8f1f2")
    nd = ImageDraw.Draw(n)
    nd.rectangle((0, 0, 240, 40), fill=SEA)
    ctext(nd, (120, 20), "OPENING HOURS", F(30, "ExtraBold"), "#ffffff")
    for i, s in enumerate(["Mon-Fri   6.30 - 21.00", "Sat   8.00 - 18.00", "Sun   8.00 - 16.00", "Adults only: Wed 19-21"]):
        nd.text((14, 52 + i * 36), s, font=F(26, "SemiBold"), fill=NAVY)
    notes.append((n, 40, 400, 2))
    for n, x, y, ang in notes:
        n = n.convert("RGBA")
        sh = Image.new("RGBA", (n.width + 30, n.height + 30), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rectangle((15, 15, n.width + 15, n.height + 15), fill=(40, 20, 0, 110))
        sh = sh.filter(ImageFilter.GaussianBlur(6)).rotate(ang, expand=True, resample=Image.BICUBIC)
        img.paste(sh, (x + 4, y + 8), sh)
        n2 = n.rotate(ang, expand=True, resample=Image.BICUBIC)
        img.paste(n2, (x, y), n2)
        d = ImageDraw.Draw(img)
        px, py = x + n2.width / 2, y + 22
        col = r.choice([CORAL, "#3d7fd1", MUSTARD, "#4f9a5a"])
        d.ellipse((px - 10, py - 10, px + 10, py + 10), fill=col)
        d.ellipse((px - 5, py - 6, px + 1, py), fill="#ffffff")
    save(grain(img, 5), "dr_corkboard")


def dr_vending_panel():
    w, h = 256, 1024
    img = Image.new("RGB", (w, h), NAVY)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((14, 20, w - 14, 230), 18, fill=CORAL)
    ctext(d, (w / 2, 92), "Harbour", P(54), "#fff4e0")
    ctext(d, (w / 2, 168), "FIZZ", F(96, "Black"), NAVY)
    waves(d, 30, w - 30, 214, 5, "#fff4e0", 5, 30)
    ctext(d, (w / 2, 270), "ICE COLD", F(46, "Black"), MUSTARD)
    d.rounded_rectangle((40, 310, w - 40, 370), 6, fill="#0f1b2b")
    ctext(d, (w / 2, 341), "60p", F(46, "Bold"), "#ff9a3c")
    for i in range(4):
        for j in range(3):
            x, y = 52 + j * 56, 400 + i * 62
            d.rounded_rectangle((x, y, x + 44, y + 44), 8, fill="#e8e4da")
            ctext(d, (x + 22, y + 22), "123456789*0#"[i * 3 + j], F(30, "Bold"), NAVY)
    d.rounded_rectangle((80, 664, 176, 760), 10, fill="#2a2a2e")
    d.rectangle((122, 680, 134, 744), fill="#000000")
    ctext(d, (w / 2, 790), "EXACT CHANGE", F(30, "Bold"), "#ff9a3c")
    ctext(d, (w / 2, 822), "ONLY", F(30, "Bold"), "#ff9a3c")
    d.rounded_rectangle((60, 860, 196, 960), 12, fill="#2a2a2e")
    ctext(d, (w / 2, 990), "PUSH", F(26, "Bold"), CREAM)
    save(grain(img, 4), "dr_vending_panel")


def dr_vending_side():
    w, h = 256, 512
    img = Image.new("RGB", (w, h), SEA)
    d = ImageDraw.Draw(img)
    r = random.Random(8)
    for _ in range(40):
        x, y, s = r.uniform(0, w), r.uniform(0, h), r.uniform(6, 22)
        d.ellipse((x, y, x + s, y + s), outline="#bfe7e3", width=3)
    d.rounded_rectangle((60, 90, 196, 420), 30, fill=CORAL)
    d.rectangle((60, 130, 196, 150), fill="#d9d9d9")
    d.rectangle((60, 380, 196, 398), fill="#d9d9d9")
    t = Image.new("RGBA", (320, 120), (0, 0, 0, 0))
    ImageDraw.Draw(t).text((160, 60), "FIZZ", font=F(110, "Black"), fill="#fff4e0", anchor="mm")
    t = t.rotate(90, expand=True)
    img.paste(t, (68, 105), t)
    ctext(d, (w / 2, 470), "Harbour Fizz", P(36), "#fff4e0")
    ctext(d, (w / 2, 50), "REFRESHING!", F(40, "Black"), MUSTARD)
    save(grain(img, 5), "dr_vending_side")


def dr_menu():
    w, h = 512, 768
    r = random.Random(6)
    img = Image.new("RGB", (w, h), "#2b3330")
    d = ImageDraw.Draw(img)
    for _ in range(60):  # old chalk, wiped
        x, y = r.uniform(0, w), r.uniform(0, h)
        d.ellipse((x, y, x + r.uniform(30, 120), y + r.uniform(10, 40)), fill="#36403c")
    img = img.filter(ImageFilter.GaussianBlur(8))
    chalk = "#f1efe6"
    ctext(ImageDraw.Draw(img), (w / 2, 80), "Café", P(96), chalk)
    d = ImageDraw.Draw(img)
    wobble_line(d, (120, 150), (392, 146), "#f2b48f", 4, 1)
    items = [("Tea / Coffee", "1.20"), ("Hot Chocolate", "1.50"), ("Cheese Toastie", "2.80"), ("Chips", "2.00"), ("Flapjack", "1.40"), ("Ice Lolly", "1.00"), ("Squash", "0.80")]
    for i, (a, b) in enumerate(items):
        y = 182 + i * 58
        hand(img, (44, y), a, F(42, "SemiBold"), chalk, 2, 400 + i)
        hand(img, (390, y), b, F(42, "SemiBold"), "#f7df6e", 2, 420 + i)
        d.line((250, y + 34, 380, y + 34), fill="#59625e", width=2)
    hand(img, (44, 600), "Soup of the day:", F(36, "SemiBold"), "#ef9fbf", 3, 440)
    hand(img, (70, 644), "tomato!", P(40), "#ef9fbf", 4, 441)
    cx, cy = 400, 670
    d.rounded_rectangle((cx - 34, cy - 30, cx + 30, cy + 34), 8, outline=chalk, width=4)
    d.arc((cx + 18, cy - 16, cx + 50, cy + 18), 270, 90, fill=chalk, width=4)
    for k in range(3):
        d.arc((cx - 24 + k * 18, cy - 74, cx - 8 + k * 18, cy - 40), 100, 260, fill=chalk, width=3)
    save(grain(img, 7), "dr_menu")


def dr_pace_face():
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s / 2
    d.ellipse((4, 4, s - 4, s - 4), fill="#fbfaf5")
    for k in range(60):
        a = math.radians(k * 6)
        big = k % 5 == 0
        r0 = c - (40 if big else 26)
        d.line((c + math.sin(a) * r0, c - math.cos(a) * r0, c + math.sin(a) * (c - 12), c - math.cos(a) * (c - 12)), fill=NAVY if big else "#3a3b40", width=7 if big else 3)
        if big:
            n = 60 if k == 0 else k
            col = "#d6423a" if n in (60, 15, 30, 45) else INK
            ctext(d, (c + math.sin(a) * (c - 88), c - math.cos(a) * (c - 88)), str(n), F(64, "Black"), col)
    ctext(d, (c, c + 92), "HARBOURSIDE S.C.", F(26, "Bold"), SEA)
    save(img, "dr_pace_face")


def dr_clock_face():
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s / 2
    d.ellipse((2, 2, s - 2, s - 2), fill="#f6efdc")
    for k in range(60):
        a = math.radians(k * 6)
        big = k % 5 == 0
        r0 = c - (16 if big else 10)
        d.line((c + math.sin(a) * r0, c - math.cos(a) * r0, c + math.sin(a) * (c - 5), c - math.cos(a) * (c - 5)), fill=NAVY, width=4 if big else 1)
    for k in range(1, 13):
        a = math.radians(k * 30)
        ctext(d, (c + math.sin(a) * (c - 36), c - math.cos(a) * (c - 36)), str(k), F(30, "Bold"), NAVY)
    ctext(d, (c, c + 42), "Harbourside", P(16), CORAL)
    save(img, "dr_clock_face")


def dr_no_running():
    w, h = 256, 384
    img = Image.new("RGB", (w, h), "#f4f1ea")
    d = ImageDraw.Draw(img)
    pic = pictogram("run", 230)
    img.paste(pic, (13, 14), pic)
    d.rectangle((0, 262, w, h), fill=NAVY)
    ctext(d, (w / 2, 300), "NO", F(56, "Black"), "#f4f1ea")
    ctext(d, (w / 2, 348), "RUNNING", F(56, "Black"), MUSTARD)
    r = random.Random(4)
    for _ in range(9):  # chipped enamel at the edges
        x = r.choice([r.uniform(0, 14), r.uniform(w - 14, w)])
        y = r.uniform(0, h)
        s = r.uniform(3, 8)
        d.ellipse((x, y, x + s, y + s * 0.7), fill="#2a2a2e")
    save(grain(img, 5), "dr_no_running")


def dr_sign(name, bg, fg, lines, size=(256, 128), pict=None):
    img = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(img)
    w, h = size
    d.rounded_rectangle((5, 5, w - 5, h - 5), 10, outline=fg, width=4)
    x0 = 20
    if pict == "flame":
        d.polygon([(44, 100), (28, 70), (40, 30), (52, 54), (62, 26), (74, 64), (70, 100)], fill=fg)
        x0 = 92
    if pict == "phone":
        d.rounded_rectangle((26, 40, 74, 92), 10, fill=fg)
        d.rounded_rectangle((20, 26, 80, 44), 8, fill=fg)
        for i in range(3):
            for j in range(3):
                d.ellipse((34 + j * 12, 52 + i * 12, 42 + j * 12, 60 + i * 12), fill=bg)
        x0 = 92
    n = len(lines)
    for i, (s, size_) in enumerate(lines):
        y = h / 2 + (i - (n - 1) / 2) * size_ * 1.05
        d.text((x0 + (w - 20 - x0) / 2, y), s, font=F(size_, "ExtraBold"), fill=fg, anchor="mm")
    save(grain(img, 4), name)


def dr_labels():
    dr_sign("dr_label_towels", CREAM, NAVY, [("CLEAN TOWELS", 40), ("please take one", 26)], (384, 128))
    dr_sign("dr_label_hamper", NAVY, CREAM, [("USED TOWELS", 44)], (384, 96))
    dr_sign("dr_label_lost", MUSTARD, NAVY, [("LOST PROPERTY", 44)], (384, 96))
    dr_sign("dr_sign_extinguisher", "#d6423a", "#ffffff", [("FIRE", 38), ("EXTINGUISHER", 30)], (256, 128), "flame")
    dr_sign("dr_sign_phone", "#f2c230", "#1b1c1f", [("EMERGENCY", 32), ("PHONE · 999", 30)], (256, 128), "phone")
    dr_sign("dr_label_kickboards", SEA, "#ffffff", [("KICKBOARDS", 40), ("return after use!", 24)], (384, 128))
    dr_sign("dr_sign_hose", "#d6423a", "#ffffff", [("FIRE HOSE", 44)], (256, 96))


def dr_cafe_view():
    """What the café's glass doors show: a warm corridor, stairs up to the viewing gallery, the café's counter at the end."""
    w, h = 512, 640
    img = Image.new("RGB", (w, h), "#e9c99a")
    d = ImageDraw.Draw(img)
    vx, vy = 250, 300  # the vanishing point
    d.polygon([(0, h), (w, h), (vx + 70, vy + 70), (vx - 70, vy + 70)], fill="#b98a5a")  # the floor
    for k in range(9):  # floor boards
        x = -200 + k * 110
        d.line((x, h, vx - 70 + k * 17.5, vy + 70), fill="#a77a4c", width=2)
    d.polygon([(0, 0), (vx - 70, vy - 110), (vx - 70, vy + 70), (0, h)], fill="#f0d9b0")  # left wall
    d.polygon([(w, 0), (vx + 70, vy - 110), (vx + 70, vy + 70), (w, h)], fill="#e3c79c")  # right wall
    d.polygon([(0, 0), (w, 0), (vx + 70, vy - 110), (vx - 70, vy - 110)], fill="#f6e6c6")  # ceiling
    d.rectangle((vx - 70, vy - 110, vx + 70, vy + 70), fill="#f8ead0")  # the end wall
    # the café counter at the end, its sign and a pendant lamp
    d.rectangle((vx - 60, vy + 10, vx + 60, vy + 66), fill=SEA)
    d.rectangle((vx - 64, vy + 4, vx + 64, vy + 12), fill="#c88b4f")
    d.rectangle((vx - 44, vy - 80, vx + 44, vy - 50), fill=NAVY)
    ctext(d, (vx, vy - 65), "CAFÉ", F(26, "Black"), CREAM)
    for k in (-30, 30):
        d.line((vx + k, vy - 110, vx + k, vy - 30), fill="#3a3b40", width=2)
        d.pieslice((vx + k - 12, vy - 40, vx + k + 12, vy - 18), 180, 360, fill=MUSTARD)
        d.ellipse((vx + k - 5, vy - 26, vx + k + 5, vy - 18), fill="#fff4d0")
    # stairs rising up the right wall to the gallery
    for k in range(10):
        x0 = w - 20 - k * 22
        y0 = h - 40 - k * 34
        d.polygon([(x0, y0), (x0 - 40, y0 - 10), (x0 - 40, y0 + 14), (x0, y0 + 30)], fill="#d6b07a" if k % 2 else "#c99f6a")
    d.line((w - 10, h - 120, w - 230, h - 460), fill="#1d3557", width=8)
    for k in range(6):
        x = w - 20 - k * 40
        y = h - 130 - k * 62
        d.line((x, y, x, y + 70), fill="#1d3557", width=4)
    # a framed photograph and a plant on the left
    d.rectangle((40, 170, 130, 250), fill="#c88b4f")
    d.rectangle((48, 178, 122, 242), fill="#7cc6e3")
    d.rectangle((48, 215, 122, 242), fill=SEA)
    d.ellipse((30, 470, 110, 560), fill="#3f8a4a")
    d.rectangle((50, 540, 92, 600), fill="#c9714a")
    img = img.filter(ImageFilter.GaussianBlur(1.6))  # seen through the glass, a little soft
    glow = Image.new("RGB", (w, h), "#ffd9a0")
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).ellipse((vx - 200, vy - 200, vx + 200, vy + 200), fill=90)
    img = Image.composite(glow, img, m.filter(ImageFilter.GaussianBlur(60)))
    save(grain(img, 4), "dr_cafe_view")


ALL = {
    f.__name__: f
    for f in [lk_note_ooo, lk_note_kick, lk_sign_shower, lk_sign_valuables, lk_scale_dial, dr_poster_gala, dr_poster_learn, dr_whiteboard, dr_rules, dr_honours, dr_team_photo, dr_corkboard, dr_vending_panel, dr_vending_side, dr_menu, dr_pace_face, dr_clock_face, dr_no_running, dr_labels, dr_cafe_view]
}

if __name__ == "__main__":
    names = sys.argv[1:] or list(ALL)
    for n in names:
        ALL[n]()
