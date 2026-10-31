"""The Sunset Lagoon's printed and painted surfaces, drawn with Pillow (any python3 with Pillow) into its work folder: the carved
SUNSET LAGOON board over the beach house, the tiki bar's board and chalk menu, the surf school's board, the beach signpost's
arrows, the stations' panels, the rules, the lifeguard's board, the splash zone on the deck. The drawing helpers are Splash
Park's (tools/venues/splash/signs.py).

    python3 tools/venues/lagoon/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
S.OUT = os.path.join(os.environ.get("VENUE_WORK", "/tmp/lagoon-work"), "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter

TEAL, TEAL_DARK, CORAL, SUN = "#2aa7a0", "#16706f", "#ee6a4a", "#f4c849"
CREAM, NAVY, WOOD, WOOD_DARK, INK = "#fff1d6", "#173a4f", "#b98a5a", "#5e3d24", "#1b1c1f"
F, P, centred, grain, save, sunfade = S.F, S.P, S.centred, S.grain, S.save, S.sunfade


def wood(W, H, base=WOOD, seed=1, planks=1):
    """A board of sun-bleached timber: grain lines along it, a few knots, planks across if more than one."""
    r = random.Random(seed)
    img = Image.new("RGB", (W, H), base)
    d = ImageDraw.Draw(img)
    br = S.rgb(base)
    for k in range(int(H / 3)):
        y = k * 3 + r.uniform(-1, 1)
        shade = r.uniform(0.82, 1.08)
        c = tuple(max(0, min(255, int(v * shade))) for v in br)
        amp, ph = r.uniform(1, 4), r.uniform(0, 6)
        d.line([(x, y + amp * math.sin(x / r.uniform(60, 160) + ph)) for x in range(0, W + 8, 8)], fill=c, width=2)
    for _ in range(max(1, W // 400)):
        x, y = r.uniform(0.1, 0.9) * W, r.uniform(0.2, 0.8) * H
        for s in range(5, 0, -1):
            d.ellipse((x - s * 5, y - s * 2.2, x + s * 5, y + s * 2.2), outline=tuple(int(v * (0.7 + s * 0.05)) for v in br), width=2)
    for k in range(1, planks):
        y = k * H / planks
        d.line([(0, y), (W, y)], fill=tuple(int(v * 0.45) for v in br), width=6)
    return img


def sunset_lagoon():
    """The board over the beach house: SUNSET LAGOON in a brush script, carved and painted cream on a deep teal ground, a setting
    sun and waves on the left, a palm on the right, inside a frame of sun-bleached timber."""
    W, H = 2048, 512
    img = wood(W, H, "#a87a4c", 3)
    d = ImageDraw.Draw(img)
    # the painted panel
    d.rounded_rectangle((40, 40, W - 40, H - 40), 40, fill=TEAL_DARK)
    # the sun and its stripes, half sunk into the sea
    cx, cy, rr = 250, 330, 150
    for k, c in enumerate(["#ffd46a", "#ffb04a", "#ff8a4a", "#ee6a4a"]):
        y0 = cy - rr + k * rr * 0.5
        d.pieslice((cx - rr, cy - rr, cx + rr, cy + rr), 180, 360, fill=c) if k == 0 else None
    for k in range(4):
        y = cy - rr * 0.25 - k * rr * 0.22
        d.rectangle((cx - rr, y - 8, cx + rr, y), fill=TEAL_DARK)
    for k in range(3):
        y = cy + 25 + k * 34
        d.line([(x, y + 9 * math.sin(x / 26 + k)) for x in range(80, 430, 6)], fill="#7fd8d0", width=10)
    # the palm on the right
    px = W - 220
    d.line([(px - 30 + 8 * math.sin(t / 20), 470 - t) for t in range(0, 300, 6)], fill="#3a2a1a", width=22)
    for a in range(0, 360, 40):
        ang = math.radians(a)
        pts = [(px - 30 + math.cos(ang) * t, 175 - math.sin(ang) * t * 0.45 + (t / 12) ** 2) for t in range(0, 150, 10)]
        d.line(pts, fill="#2f7a3a", width=18)
    # the words
    centred(d, (420, 40, W - 420, H - 90), "Sunset Lagoon", P(230), CREAM, stroke=10, stroke_fill="#0e4a4a")
    centred(d, (420, H - 140, W - 420, H - 50), "BEACH  CLUB  ·  EST. 1962", F(70, "Bold"), SUN)
    # nails in the frame
    for x in (70, W - 70):
        for y in (70, H - 70):
            d.ellipse((x - 9, y - 9, x + 9, y + 9), fill="#4a4038")
    save(sunfade(grain(img, 7), 0.12), "sunset_lagoon")


def tiki_bar():
    """The tiki bar's board: TIKI BAR in chunky carved letters on a plank."""
    W, H = 1024, 256
    img = wood(W, H, "#8a5a35", 5)
    d = ImageDraw.Draw(img)
    centred(d, (0, 0, W, H), "TIKI  BAR", F(190, "Black"), SUN, stroke=8, stroke_fill="#3a2414")
    for x in (40, W - 40):
        d.ellipse((x - 10, H / 2 - 10, x + 10, H / 2 + 10), fill="#3a2a1a")
    save(grain(img, 6), "tiki_bar")


def tiki_menu():
    """The bar's chalk menu: tropical drinks on a dark board in a bamboo frame."""
    W, H = 768, 1024
    img = Image.new("RGB", (W, H), "#22302c")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline="#d8b568", width=34)
    centred(d, (0, 50, W, 210), "Cocktails", P(120), SUN)
    items = [
        ("MAI TAI", "9"),
        ("PIÑA COLADA", "8"),
        ("BLUE LAGOON", "9"),
        ("COCONUT COOLER", "6"),
        ("MANGO SMOOTHIE", "5"),
        ("FRESH PINEAPPLE", "4"),
        ("ICED TEA", "3"),
    ]
    f, fp = F(60, "Bold"), F(62, "ExtraBold")
    for k, (n, p) in enumerate(items):
        y = 260 + k * 92
        d.text((80, y), n, font=f, fill="#f4f1ea")
        d.text((W - 80 - d.textlength(p, font=fp), y), p, font=fp, fill="#ff9a6a")
    centred(d, (0, H - 140, W, H - 50), "~ happy hour at sunset ~", P(50), "#f4f1ea")
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    save(grain(img, 10), "tiki_menu")


def surf_school():
    W, H = 1024, 256
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    for k in range(5):
        y = 200 + k * 9
        d.line([(x, y + 6 * math.sin(x / 30 + k)) for x in range(0, W, 8)], fill=TEAL, width=5)
    centred(d, (0, 10, W, 190), "SURF  SCHOOL", F(170, "Black"), CORAL, stroke=4, stroke_fill="#ffffff")
    save(sunfade(grain(img, 6), 0.18), "surf_school")


def arrow(name, word, colour, point=1):
    """One of the signpost's arrows: a painted plank pointing left (-1) or right (1), the word on it."""
    W, H = 768, 160
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base = wood(W, H, colour, hash(name) % 97).convert("RGBA")
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    tip = 110
    if point > 0:
        md.polygon([(0, 8), (W - tip, 8), (W - 4, H / 2), (W - tip, H - 8), (0, H - 8)], fill=255)
    else:
        md.polygon([(W, 8), (tip, 8), (4, H / 2), (tip, H - 8), (W, H - 8)], fill=255)
    img.paste(base, (0, 0), mask)
    d = ImageDraw.Draw(img)
    centred(d, (tip if point < 0 else 20, 0, W - (tip if point > 0 else 20), H), word, F(110, "Black"), CREAM)
    bg = Image.new("RGB", (W, H), "#6b4a2e")
    bg.paste(img, (0, 0), img)
    save(grain(bg, 5), name)


def rules():
    W, H = 768, 1024
    img = wood(W, H, "#c7a074", 9, planks=5)
    d = ImageDraw.Draw(img)
    d.rectangle((40, 40, W - 40, 220), fill=TEAL_DARK)
    centred(d, (40, 40, W - 40, 220), "LAGOON RULES", F(130, "Black"), CREAM)
    lines = [
        "1  Shower before you swim",
        "2  Walk on the boardwalk",
        "3  No glass by the pool",
        "4  Lane 5: trampoline landing",
        "5  Storm? Out of the water",
        "6  Listen to the coach",
        "7  Aloha & have fun!",
    ]
    for k, s in enumerate(lines):
        d.text((70, 270 + k * 100), s, font=F(64, "Bold"), fill=NAVY)
    save(sunfade(grain(img, 6), 0.12), "lagoon_rules")


def lifeguard():
    W, H = 768, 256
    img = Image.new("RGB", (W, H), CORAL)
    d = ImageDraw.Draw(img)
    d.rectangle((12, 12, W - 12, H - 12), outline=CREAM, width=8)
    centred(d, (0, 0, W, H), "LIFEGUARD", F(170, "Black"), CREAM)
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
    "sunset_lagoon": sunset_lagoon,
    "tiki_bar": tiki_bar,
    "tiki_menu": tiki_menu,
    "surf_school": surf_school,
    "arrow_beach": lambda: arrow("arrow_beach", "BEACH", "#2aa7a0", 1),
    "arrow_bar": lambda: arrow("arrow_bar", "TIKI BAR", "#ee6a4a", -1),
    "arrow_surf": lambda: arrow("arrow_surf", "SURF", "#e0a62c", 1),
    "arrow_bonfire": lambda: arrow("arrow_bonfire", "BONFIRE", "#b8432c", -1),
    "water_care": lambda: S.panel("water_care", "WATER CARE", "CHLORINE · TESTING", SUN, NAVY),
    "eye_care": lambda: S.panel("eye_care", "EYE CARE", "RINSE · DROPS · TOWELS", "#e8f3ea", TEAL_DARK),
    "lagoon_rules": rules,
    "lifeguard": lifeguard,
    "splash_zone": splash_zone,
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for n, job in JOBS.items():
        if not only or n in only:
            job()
