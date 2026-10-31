"""Splash Park's printed and painted surfaces, drawn with Pillow (any python3 with Pillow) into WORK/signs: the hand-painted tile
sign over the entrance, the cabanas' boards, the snack bar's menu, the stations' panels, the rules board, the depth plaques.

    python3 tools/venues/splash/signs.py [name ...]
"""

import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.abspath(os.path.join(HERE, "..", "..", "..", "godot", "tools", "blender", "fonts"))
OUT = os.path.join(os.environ.get("SPLASH_WORK", "/tmp/splash-work"), "signs")
os.makedirs(OUT, exist_ok=True)

TEAL, TEAL_DARK, CORAL, SUN = "#2f9aa0", "#1f6f78", "#e0513f", "#f4c849"
CREAM, CANVAS, NAVY, COBALT, INK = "#f6ecda", "#fff4dc", "#1d3557", "#1f5fa6", "#1b1c1f"


def F(size, weight="Bold"):
    return ImageFont.truetype(os.path.join(FONTS, f"BarlowCondensed-{weight}.ttf"), size)


def P(size):
    return ImageFont.truetype(os.path.join(FONTS, "Pacifico-Regular.ttf"), size)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def grain(img, sigma=8):
    n = Image.effect_noise(img.size, sigma).convert("RGB")
    return ImageChops.add(img.convert("RGB"), n, 1.0, -128)


def sunfade(img, amount=0.2, tint="#f3e2bf"):
    img = ImageEnhance.Color(img).enhance(1 - amount * 0.6)
    return Image.blend(img, Image.new("RGB", img.size, tint), amount * 0.35)


def centred(d, box, s, font, fill, stroke=0, stroke_fill=None):
    x0, y0, x1, y1 = box
    l, t, r, b = d.textbbox((0, 0), s, font=font, stroke_width=stroke)
    d.text(
        ((x0 + x1 - (r - l)) / 2 - l, (y0 + y1 - (b - t)) / 2 - t),
        s,
        font=font,
        fill=fill,
        stroke_width=stroke,
        stroke_fill=stroke_fill,
    )


def save(img, name):
    img.convert("RGB").save(os.path.join(OUT, name + ".png"))
    print("SIGN", name, img.size)


def tiles(img, n_across, grout="#e9e2d2", seed=3, jitter=0.06):
    """Lay the picture out as glazed tiles: grout lines, each tile a touch lighter or darker, a glaze highlight."""
    w, h = img.size
    t = w / n_across
    r = random.Random(seed)
    out = img.copy()
    px = out.load()
    d = ImageDraw.Draw(out)
    rows = int(round(h / t))
    for j in range(rows):
        for i in range(n_across):
            k = 1 + r.uniform(-jitter, jitter)
            box = (int(i * t), int(j * t), int((i + 1) * t), int((j + 1) * t))
            region = out.crop(box)
            region = ImageEnhance.Brightness(region).enhance(k)
            out.paste(region, box)
    for i in range(n_across + 1):
        d.line([(i * t, 0), (i * t, h)], fill=grout, width=max(2, int(t * 0.05)))
    for j in range(rows + 1):
        d.line([(0, j * t), (w, j * t)], fill=grout, width=max(2, int(t * 0.05)))
    gl = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(gl)
    for j in range(rows):
        for i in range(n_across):
            gd.ellipse((i * t + t * 0.12, j * t + t * 0.1, i * t + t * 0.5, j * t + t * 0.42), fill=26)
    gl = gl.filter(ImageFilter.GaussianBlur(t * 0.08))
    return Image.composite(Image.new("RGB", (w, h), "#ffffff"), out, gl)


# ---- the sign over the entrance: SPLASH PARK hand-painted on glazed tiles, a sun and waves ------------------------------------
def splash_park():
    W, H = 2048, 448
    img = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(img)
    # a border of cobalt with a thin sun-yellow line
    d.rectangle((0, 0, W, H), fill=COBALT)
    d.rectangle((26, 26, W - 26, H - 26), fill=SUN)
    d.rectangle((40, 40, W - 40, H - 40), fill=CANVAS)
    # the sun, rising on the left, and waves on the right
    cx, cy = 230, 300
    for k in range(14):
        a = math.pi + k * math.pi / 13
        d.polygon(
            [
                (cx + math.cos(a - 0.08) * 120, cy + math.sin(a - 0.08) * 120),
                (cx + math.cos(a) * 190, cy + math.sin(a) * 190),
                (cx + math.cos(a + 0.08) * 120, cy + math.sin(a + 0.08) * 120),
            ],
            fill="#f2a33a",
        )
    d.pieslice((cx - 110, cy - 110, cx + 110, cy + 110), 180, 360, fill=SUN, outline="#f2a33a", width=6)
    for k in range(3):
        y = 330 + k * 34
        pts = [(x, y + math.sin(x / 34) * 12) for x in range(1700, W - 44, 6)]
        d.line(pts, fill=[TEAL, COBALT, TEAL_DARK][k], width=16)
    pts = [(x, 392 + math.sin(x / 30) * 8) for x in range(44, W - 44, 6)]
    d.line(pts, fill=TEAL, width=12)
    centred(d, (380, 40, 1700, 330), "Splash Park", P(220), CORAL, stroke=8, stroke_fill=CANVAS)
    centred(d, (380, 300, 1700, 400), "POOL  ·  SUN  ·  SPLASH", F(64, "ExtraBold"), TEAL_DARK)
    img = tiles(img, 16, seed=5)
    save(sunfade(grain(img, 6), 0.12), "splash_park")


def cabana(letter, colour):
    W, H = 1024, 192
    img = Image.new("RGB", (W, H), colour)
    d = ImageDraw.Draw(img)
    d.rectangle((10, 10, W - 10, H - 10), outline=CANVAS, width=8)
    centred(d, (0, 0, W, H), f"CABANA  {letter}", F(132, "Black"), CANVAS)
    for x in (70, W - 70):
        d.ellipse((x - 18, H / 2 - 18, x + 18, H / 2 + 18), fill=SUN)
    save(sunfade(grain(img, 5), 0.15), f"cabana_{letter.lower()}")


def changing(letter, colour):
    """The small plaque on each cabana's door: CHANGING, with the figures."""
    W, H = 512, 256
    img = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((6, 6, W - 6, H - 6), 26, fill=colour)
    d.rounded_rectangle((18, 18, W - 18, H - 18), 20, outline=CANVAS, width=5)
    centred(d, (0, 20, W, 130), "CHANGING", F(96, "ExtraBold"), CANVAS)
    centred(d, (0, 130, W, 230), "ROOMS  &  LOCKERS", F(50, "Bold"), CANVAS)
    save(grain(img, 4), f"changing_{letter.lower()}")


def snacks():
    """The snack bar's menu board: chalk on a teal board, hand lettered."""
    W, H = 768, 1024
    img = Image.new("RGB", (W, H), "#1f4e4f")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline="#b77b45", width=34)
    centred(d, (0, 50, W, 210), "Snacks", P(130), SUN)
    items = [
        ("ICE LOLLY", "2.50"),
        ("CHIPS", "3.00"),
        ("HOT DOG", "4.50"),
        ("NACHOS", "4.00"),
        ("SLUSHIE", "3.50"),
        ("LEMONADE", "2.80"),
        ("WATERMELON", "2.00"),
    ]
    f, fp = F(64, "Bold"), F(64, "ExtraBold")
    for k, (n, p) in enumerate(items):
        y = 270 + k * 92
        d.text((80, y), n, font=f, fill="#f4f1ea")
        d.text((W - 80 - d.textlength(p, font=fp), y), p, font=fp, fill="#f6d36b")
        d.line([(80 + d.textlength(n, font=f) + 16, y + 48), (W - 100 - d.textlength(p, font=fp), y + 48)], fill="#7aa3a0", width=3)
    centred(d, (0, H - 140, W, H - 50), "~ ice cold drinks ~", P(56), "#f4f1ea")
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    save(grain(img, 10), "snacks_menu")


def snack_banner():
    W, H = 1024, 192
    img = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(img)
    centred(d, (0, 0, W, H), "SNACK  SHACK", F(140, "Black"), CORAL)
    save(sunfade(grain(img, 5), 0.1), "snack_banner")


def panel(name, title, sub, bg, fg=CANVAS, icon=None):
    """A station's panel: a big title, a line under it, an icon."""
    W, H = 768, 384
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((14, 14, W - 14, H - 14), 30, outline=fg, width=8)
    centred(d, (0, 40, W, 230), title, F(150, "Black"), fg)
    centred(d, (0, 230, W, 340), sub, F(62, "Bold"), fg)
    save(grain(img, 5), name)


def rules():
    W, H = 768, 1024
    img = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 210), fill=TEAL)
    centred(d, (0, 0, W, 210), "POOL RULES", F(150, "Black"), CANVAS)
    lines = [
        "1  Shower before you swim",
        "2  No running on the deck",
        "3  No diving in the shallows",
        "4  Lane 5: trampoline landing",
        "5  Listen to the coach",
        "6  No glass by the pool",
        "7  Have fun, stay safe!",
    ]
    for k, s in enumerate(lines):
        d.text((60, 260 + k * 100), s, font=F(66, "Bold"), fill=NAVY)
    d.rectangle((0, H - 60, W, H), fill=CORAL)
    save(sunfade(grain(img, 6), 0.15), "pool_rules")


def depth(name, s):
    W, H = 256, 128
    img = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(img)
    centred(d, (0, 0, W, H), s, F(110, "Black"), NAVY)
    save(grain(img, 4), name)


def lifeguard():
    W, H = 768, 256
    img = Image.new("RGB", (W, H), CORAL)
    d = ImageDraw.Draw(img)
    d.rectangle((12, 12, W - 12, H - 12), outline=CANVAS, width=8)
    centred(d, (0, 0, W, H), "LIFEGUARD", F(170, "Black"), CANVAS)
    save(sunfade(grain(img, 5), 0.12), "lifeguard")


def splash_zone():
    W, H = 1024, 256
    img = Image.new("RGB", (W, H), SUN)
    d = ImageDraw.Draw(img)
    for x in range(-H, W + H, 64):
        d.polygon([(x, 0), (x + 32, 0), (x + 32 + H, H), (x + H, H)], fill=INK)
    d.rectangle((40, 40, W - 40, H - 40), fill=SUN)
    centred(d, (40, 40, W - 40, H - 40), "SPLASH ZONE · LANE 5", F(100, "Black"), INK)
    save(grain(img, 5), "splash_zone")


JOBS = {
    "splash_park": splash_park,
    "cabana_a": lambda: cabana("A", TEAL),
    "cabana_b": lambda: cabana("B", CORAL),
    "changing_a": lambda: changing("A", TEAL_DARK),
    "changing_b": lambda: changing("B", "#b94032"),
    "snacks_menu": snacks,
    "snack_banner": snack_banner,
    "water_care": lambda: panel("water_care", "WATER CARE", "CHLORINE · TESTING", SUN, NAVY),
    "eye_care": lambda: panel("eye_care", "EYE CARE", "RINSE · DROPS · TOWELS", "#e8f3ea", TEAL_DARK),
    "pool_rules": rules,
    "lifeguard": lifeguard,
    "splash_zone": splash_zone,
    "depth_14": lambda: depth("depth_14", "1.4 m"),
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for n, job in JOBS.items():
        if not only or n in only:
            job()
