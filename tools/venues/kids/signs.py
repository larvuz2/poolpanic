"""The Kids Pool's printed and painted surfaces, drawn with Pillow (any python3 with Pillow) into its work folder: the gate's arch
board, the beach huts' numbers, the ice-cream cart's menu, the stations' panels, the rules, the lifeguard's board. The drawing
helpers are Splash Park's (tools/venues/splash/signs.py).

    python3 tools/venues/kids/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
S.OUT = os.path.join(os.environ.get("VENUE_WORK", "/tmp/kids-work"), "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter

PINK, SUN, SKY, MINT, CORAL, LILAC = "#ff7eb3", "#ffd23f", "#4fc3f7", "#7bd8b0", "#ff8a5c", "#b49cff"
CREAM, NAVY, WHITE = "#fff6e4", "#24456e", "#ffffff"
F, P, centred, grain, save, tiles = S.F, S.P, S.centred, S.grain, S.save, S.tiles


def kids_pool():
    """The arch over the gate: KIDS POOL in bubbly letters, each letter its own colour, on a sky board with clouds and a sun."""
    W, H = 2048, 512
    img = Image.new("RGB", (W, H), "#8fd8fb")
    d = ImageDraw.Draw(img)
    for k in range(9):  # soft clouds
        cx, cy, r = 120 + k * 230, 80 + (k % 3) * 40, 70 + (k % 2) * 30
        for dx in (-r * 0.7, 0, r * 0.7):
            d.ellipse((cx + dx - r * 0.6, cy - r * 0.45, cx + dx + r * 0.6, cy + r * 0.45), fill="#e9f8ff")
    d.ellipse((1850, 40, 2010, 200), fill=SUN)
    for k in range(12):
        a = k * math.tau / 12
        d.line([(1930 + math.cos(a) * 95, 120 + math.sin(a) * 95), (1930 + math.cos(a) * 130, 120 + math.sin(a) * 130)], fill=SUN, width=12)
    word = "KIDS POOL"
    font = F(300, "Black")
    colours = [PINK, SKY, SUN, MINT, None, CORAL, LILAC, PINK, SKY]
    x = (W - d.textlength(word, font=font)) / 2
    for ch, c in zip(word, colours):
        if ch != " ":
            d.text((x, 90), ch, font=font, fill=c, stroke_width=14, stroke_fill=WHITE)
        x += d.textlength(ch, font=font)
    d.rectangle((0, 0, W, H), outline=WHITE, width=24)
    save(grain(img, 4), "kids_pool")


def hut(n, colour):
    """A beach hut's number plate: a white disc with the number in the hut's colour."""
    W = 256
    img = Image.new("RGB", (W, W), colour)
    d = ImageDraw.Draw(img)
    d.ellipse((12, 12, W - 12, W - 12), fill=WHITE)
    centred(d, (0, 0, W, W), str(n), F(170, "Black"), colour)
    save(grain(img, 3), f"hut_{n}")


def ice_cream():
    """The ice-cream cart's menu: the flavours with little scoops."""
    W, H = 768, 768
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 170), fill=PINK)
    centred(d, (0, 0, W, 170), "Ice Cream", P(120), WHITE)
    flavours = [("STRAWBERRY", "#ff8fb0"), ("VANILLA", "#fff1c9"), ("MINT CHIP", "#9fe3c4"), ("CHOCOLATE", "#8a5a3c"), ("BLUE SHARK", "#7fd0f5"), ("LEMON", "#ffe066")]
    for k, (name, c) in enumerate(flavours):
        y = 210 + k * 88
        d.ellipse((60, y, 130, y + 70), fill=c, outline="#d9c3a5", width=4)
        d.text((160, y + 4), name, font=F(64, "ExtraBold"), fill=NAVY)
    d.rectangle((0, H - 40, W, H), fill=SKY)
    save(grain(img, 5), "ice_cream")


def rules():
    W, H = 768, 1024
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 200), fill=SKY)
    centred(d, (0, 0, W, 200), "SPLASH RULES", F(130, "Black"), WHITE)
    lines = [("Walk, don't run!", PINK), ("Grown-ups watch", CORAL), ("Shower first", SKY), ("Toys in the water: OK", MINT), ("Be kind, take turns", LILAC), ("Listen to the coach", NAVY), ("Have a splashing time!", SUN)]
    for k, (s, c) in enumerate(lines):
        y = 250 + k * 104
        d.ellipse((50, y + 10, 100, y + 60), fill=c)
        d.text((125, y), s, font=F(68, "Bold"), fill=NAVY)
    save(grain(img, 5), "kids_rules")


JOBS = {
    "kids_pool": kids_pool,
    "ice_cream": ice_cream,
    "kids_rules": rules,
    "water_care": lambda: S.panel("water_care", "WATER CARE", "CHLORINE · TESTING", SUN, NAVY),
    "eye_care": lambda: S.panel("eye_care", "EYE CARE", "RINSE · DROPS · TOWELS", "#e8f3ea", "#1f6f78"),
    "lifeguard": S.lifeguard,
    **{f"hut_{n}": (lambda n=n, c=c: hut(n, c)) for n, c in enumerate([PINK, SKY, SUN, MINT, CORAL, LILAC], 1)},
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for n, job in JOBS.items():
        if not only or n in only:
            job()
