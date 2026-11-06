"""Senior Aqua Fit's painted and printed surfaces, drawn with Pillow into its work folder (the Founder's portrait and the six aqua
ballet photographs are fal's, cut into it by painted.sh; the main sign and the rug are the classic's photographs): emerald enamel with
gilt letters, engraved brass, chalk. The programme of the day (13:00 NAP, compulsory), the conservatory's rules (no bombing: this
means you, Harold), the Founder's brass plate, the clock's face (always time for aqua fit), the hydrotherapy notice (max. 4, or 3 if
one is Harold), QUIET PLEASE · NAP IN PROGRESS, the slippers' rack, ZIMMER PARKING, AQUA BINGO and its cards, the lost property,
today's moves (the flamingo, the teapot, the slow wave), CAP OF THE WEEK, the penny scale, the newspaper (THE DAILY DIP), two books'
covers, the mosaic doormat (SALVETE), the depth plates, and the stations' boards (FLIPPERS, WATER CARE, EYE CARE, LIFE RING, FISH NET,
SKIMMER, LITTER, BISCUITS, DANGER). The helpers are Splash Park's (tools/venues/splash/signs.py).

    python3 tools/venues/senior/signs.py [name ...]
"""

import os, sys, math, random, importlib.util, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
S.OUT = os.path.join(os.environ.get("VENUE_WORK", "/tmp/senior-work"), "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "common"))
from carl_art import paste_carl  # (Cannonball Carl where a stick figure used to be: common/carl_art.py)

F, P, centred, grain, save, sunfade = S.F, S.P, S.centred, S.grain, S.save, S.sunfade
EMERALD, DEEP, GOLD, CREAM, IVORY, INK, RED, ROSE, BRASS = (
    "#1f5c4a",
    "#143d33",
    "#d9b85c",
    "#f3ead8",
    "#fbf6ea",
    "#1b1c1f",
    "#b8262f",
    "#e8829a",
    "#c9a14a",
)


def fit(d, box, s, font_fn, size, fill, stroke=0, stroke_fill=None, min_size=16):
    x0, y0, x1, y1 = box
    while size > min_size:
        f = font_fn(size)
        l, t, r, b = d.textbbox((0, 0), s, font=f, stroke_width=stroke)
        if r - l <= (x1 - x0) and b - t <= (y1 - y0) * 1.05:
            break
        size -= 3
    centred(d, box, s, font_fn(size), fill, stroke, stroke_fill)


def enamel(W, H, bg=EMERALD, edge=GOLD, r=22, wd=10):
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((wd, wd, W - wd, H - wd), r, outline=edge, width=wd)
    d.rounded_rectangle((wd * 2 + 4, wd * 2 + 4, W - wd * 2 - 4, H - wd * 2 - 4), max(4, r - 8), outline=edge, width=2)
    for cx, cy in ((wd * 3 + 6, wd * 3 + 6), (W - wd * 3 - 6, wd * 3 + 6), (wd * 3 + 6, H - wd * 3 - 6), (W - wd * 3 - 6, H - wd * 3 - 6)):
        d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=edge)
    return img, d


def brass(W, H):
    img = Image.new("RGB", (W, H), BRASS)
    d = ImageDraw.Draw(img)
    for y in range(0, H, 2):
        k = 0.92 + 0.08 * math.sin(y * 0.3)
        d.line([(0, y), (W, y)], fill=(int(201 * k), int(161 * k), int(74 * k)))
    d.rectangle((6, 6, W - 6, H - 6), outline="#8f6d2c", width=4)
    return img, d


def chalkboard(W, H, frame="#6b4a32"):
    img = Image.new("RGB", (W, H), "#26302c")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline=frame, width=max(14, W // 30))
    return img, d


def panel(name, title, sub, W=768, H=320, bg=EMERALD, fg=GOLD, sub_fg=CREAM):
    img, d = enamel(W, H, bg, fg)
    fit(d, (50, 36, W - 50, 210), title, lambda s: F(s, "Black"), 140, fg)
    fit(d, (60, 210, W - 60, H - 40), sub, lambda s: F(s, "Bold"), 56, sub_fg)
    save(sunfade(grain(img, 4), 0.08), name)


def programme():
    W, H = 640, 960
    img, d = enamel(W, H, DEEP, GOLD, 18, 12)
    fit(d, (40, 40, W - 40, 150), "Today's Programme", lambda s: P(s), 72, GOLD)
    rows = [
        ("10:00", "AQUA FIT"),
        ("11:00", "AQUA BINGO"),
        ("12:00", "LUNCHEON"),
        ("13:00", "NAP (COMPULSORY)"),
        ("14:00", "AQUA FIT (AGAIN)"),
        ("15:00", "TEA & BISCUITS"),
        ("16:00", "GOSSIP"),
    ]
    for k, (t, s) in enumerate(rows):
        y = 190 + k * 100
        d.text((60, y), t, font=F(56, "Bold"), fill=GOLD)
        d.text((220, y), s, font=F(56, "Bold"), fill=CREAM)
        d.line([(60, y + 80), (W - 60, y + 80)], fill="#2c5a4c", width=2)
    save(grain(img, 4), "programme")


def rules():
    W, H = 768, 896
    img, d = enamel(W, H, IVORY, EMERALD, 14, 12)
    d.rectangle((24, 24, W - 24, 150), fill=EMERALD)
    fit(d, (40, 30, W - 40, 145), "CONSERVATORY RULES", lambda s: F(s, "Black"), 80, GOLD)
    lines = [
        "1  No bombing. (This means you, Harold.)",
        "2  Walk, don't run. Wheeling is fine.",
        "3  Hearing aids out before swimming",
        "4  Swim caps: the more flowers the better",
        "5  Tea is at three. Always.",
        "6  Be nice to the coach",
    ]
    for k, s in enumerate(lines):
        fit(d, (40, 190 + k * 110, W - 40, 270 + k * 110), s, lambda z: F(z, "Bold"), 46, EMERALD)
    save(sunfade(grain(img, 5), 0.1), "rules")


def founder_plate():
    W, H = 768, 160
    img, d = brass(W, H)
    fit(d, (30, 18, W - 30, 92), "OUR FOUNDER · MRS. EDITH PLUMM", lambda s: F(s, "Black"), 60, "#3a2d10")
    fit(d, (30, 92, W - 30, 146), "1926 · SHE NEVER SPLASHED", lambda s: F(s, "Bold"), 40, "#3a2d10")
    save(grain(img, 3), "founder_plate")


def clock():
    W = 512
    img = Image.new("RGB", (W, W), IVORY)
    d = ImageDraw.Draw(img)
    c = W / 2
    d.ellipse((8, 8, W - 8, W - 8), outline=INK, width=10)
    d.ellipse((30, 30, W - 30, W - 30), outline=GOLD, width=4)
    numerals = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"]
    for k, n in enumerate(numerals):
        a = math.radians(90 - k * 30)
        x, y = c + math.cos(a) * 190, c - math.sin(a) * 190
        centred(d, (x - 40, y - 30, x + 40, y + 30), n, F(46, "Bold"), INK)
    fit(d, (130, 300, W - 130, 350), "TIME FOR AQUA FIT", lambda s: F(s, "Bold"), 34, EMERALD)
    # (always ten o'clock: aqua fit)
    for a, L, wd in ((math.radians(90 - 300), 120, 14), (math.radians(90), 170, 9)):
        d.line([(c, c), (c + math.cos(a) * L, c - math.sin(a) * L)], fill=INK, width=wd)
    d.ellipse((c - 14, c - 14, c + 14, c + 14), fill=GOLD)
    save(grain(img, 3), "clock")


def hydro():
    W, H = 640, 320
    img, d = enamel(W, H, "#e9f4f1", EMERALD, 16, 10)
    fit(d, (40, 30, W - 40, 130), "HYDROTHERAPY", lambda s: F(s, "Black"), 96, EMERALD)
    fit(d, (40, 140, W - 40, 210), "38°C · BUBBLES ON THE HOUR", lambda s: F(s, "Bold"), 48, DEEP)
    fit(d, (40, 210, W - 40, 290), "MAX. 4 BATHERS (3 IF ONE IS HAROLD)", lambda s: F(s, "Bold"), 40, RED)
    save(grain(img, 4), "hydro")


def nap():
    W, H = 640, 256
    img, d = enamel(W, H, "#2b3a5a", GOLD, 18, 10)
    fit(d, (40, 26, W - 40, 130), "QUIET PLEASE", lambda s: F(s, "Black"), 100, GOLD)
    fit(d, (40, 132, W - 40, 220), "NAP IN PROGRESS · Zzz", lambda s: F(s, "Bold"), 60, CREAM)
    save(grain(img, 4), "nap")


def slippers():
    W, H = 768, 192
    img, d = enamel(W, H, EMERALD, GOLD, 16, 8)
    fit(d, (30, 20, W - 30, 120), "SLIPPERS HERE, PLEASE", lambda s: F(s, "Black"), 90, GOLD)
    fit(d, (30, 118, W - 30, 176), "(flippers on the other rack)", lambda s: F(s, "Bold"), 44, CREAM)
    save(grain(img, 4), "slippers")


def zimmer():
    """Paint on the floor (a cut-out: the travertine shows between): four bays' lines and the words in front of them."""
    W, H = 1024, 512
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for k in range(5):
        x = 24 + k * 244
        d.rectangle((x - 9, 20, x + 9, 330), fill="#e9c23a")
    d.rectangle((15, 20, W - 15, 38), fill="#e9c23a")
    fit(d, (40, 360, W - 40, 490), "ZIMMER PARKING", lambda s: F(s, "Black"), 130, "#e9c23a")
    tex = os.path.join(os.path.dirname(S.OUT), "textures")
    os.makedirs(tex, exist_ok=True)
    img.save(os.path.join(tex, "zimmer_alpha.png"))
    print("CUT zimmer")


def bingo():
    W, H = 768, 256
    img, d = enamel(W, H, RED, GOLD, 20, 10)
    fit(d, (40, 20, W - 40, 170), "AQUA BINGO", lambda s: F(s, "Black"), 150, GOLD)
    fit(d, (40, 170, W - 40, 236), "EYES DOWN · 11 O'CLOCK", lambda s: F(s, "Bold"), 52, CREAM)
    save(grain(img, 4), "bingo")


def bingo_card():
    W, H = 384, 256
    img = Image.new("RGB", (W, H), IVORY)
    d = ImageDraw.Draw(img)
    rnd = random.Random(5)
    for r in range(3):
        for c in range(5):
            x0, y0 = 12 + c * 72, 12 + r * 78
            d.rectangle((x0, y0, x0 + 68, y0 + 74), outline=RED, width=3)
            if rnd.random() < 0.6:
                centred(d, (x0, y0, x0 + 68, y0 + 74), str(rnd.randint(1, 90)), F(40, "Bold"), INK)
                if rnd.random() < 0.4:
                    d.ellipse((x0 + 8, y0 + 8, x0 + 60, y0 + 66), outline="#2f5fa8", width=6)
    save(grain(img, 3), "bingo_card")


def lost_property():
    W, H = 512, 160
    img, d = brass(W, H)
    fit(d, (24, 20, W - 24, 140), "LOST PROPERTY", lambda s: F(s, "Black"), 80, "#3a2d10")
    save(grain(img, 3), "lost_property")


def moves():
    W, H = 640, 768
    img, d = chalkboard(W, H)
    fit(d, (40, 40, W - 40, 140), "Today's Moves", lambda s: P(s), 70, GOLD)
    names = ["THE FLAMINGO", "THE TEAPOT", "THE SLOW WAVE"]
    for k, n in enumerate(names):
        y = 190 + k * 190
        cx = 130
        # Carl in chalk, in the water, doing the move (6 November 2026: once a stick figure)
        paste_carl(img, ["chalk_flamingo", "chalk_teapot", "chalk_wave"][k], (cx - 110, y - 10, cx + 110, y + 170), tint="#f4f1e6")
        d.text((260, y + 40), n, font=F(52, "Bold"), fill="#f4f1e6")
    save(grain(img.filter(ImageFilter.GaussianBlur(0.6)), 8), "moves")


def cap_week():
    W, H = 512, 640
    img, d = enamel(W, H, ROSE, IVORY, 20, 10)
    fit(d, (30, 30, W - 30, 120), "CAP OF THE WEEK", lambda s: F(s, "Black"), 66, IVORY)
    # the cap: a dome covered in rubber flowers
    cx, cy = W / 2, 360
    d.chord((cx - 150, cy - 150, cx + 150, cy + 150), 180, 360, fill="#9fd9c0")
    rnd = random.Random(3)
    for k in range(26):
        a = rnd.uniform(math.pi, 2 * math.pi)
        r = rnd.uniform(20, 135)
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        c = rnd.choice(["#f6c1cc", "#fff1a8", "#c9b3f0", "#ffffff", "#ffb38a"])
        for p in range(5):
            b = p * 2 * math.pi / 5
            d.ellipse((x + math.cos(b) * 12 - 10, y + math.sin(b) * 12 - 10, x + math.cos(b) * 12 + 10, y + math.sin(b) * 12 + 10), fill=c)
        d.ellipse((x - 7, y - 7, x + 7, y + 7), fill="#f3c24a")
    fit(d, (30, 420, W - 30, 520), "DORIS", lambda s: P(s), 90, IVORY)
    fit(d, (30, 520, W - 30, 600), "(again)", lambda s: F(s, "Bold"), 50, IVORY)
    save(grain(img, 4), "cap_week")


def scale_face():
    W = 384
    img = Image.new("RGB", (W, W), IVORY)
    d = ImageDraw.Draw(img)
    c = W / 2
    d.ellipse((10, 10, W - 10, W - 10), outline=RED, width=12)
    for k in range(21):
        a = math.radians(225 - k * 13.5)
        d.line([(c + math.cos(a) * 140, c - math.sin(a) * 140), (c + math.cos(a) * 165, c - math.sin(a) * 165)], fill=INK, width=4)
    fit(d, (90, 230, W - 90, 280), "WEIGH YOURSELF · 1d", lambda s: F(s, "Bold"), 32, INK)
    a = math.radians(140)
    d.line([(c, c), (c + math.cos(a) * 140, c - math.sin(a) * 140)], fill=RED, width=8)
    fit(d, (90, 100, W - 90, 150), "HONEST", lambda s: F(s, "Black"), 40, EMERALD)
    save(grain(img, 3), "scale_face")


def newspaper():
    W, H = 512, 384
    img = Image.new("RGB", (W, H), "#efe8d6")
    d = ImageDraw.Draw(img)
    fit(d, (20, 10, W - 20, 90), "THE DAILY DIP", lambda s: F(s, "Black"), 80, INK)
    d.line([(20, 96), (W - 20, 96)], fill=INK, width=3)
    fit(d, (20, 104, W - 20, 170), "LOCAL SWAN WEARS CAP", lambda s: F(s, "Black"), 52, INK)
    for k in range(10):
        y = 190 + k * 18
        for col in range(3):
            x0 = 20 + col * 162
            d.line([(x0, y), (x0 + 150 - (k % 3) * 20, y)], fill="#8a857a", width=6)
    save(grain(img, 6), "newspaper")


def book(name, title, bg, fg):
    W, H = 256, 384
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    d.rectangle((14, 14, W - 14, H - 14), outline=fg, width=4)
    for k, line in enumerate(title.split("|")):
        fit(d, (24, 60 + k * 70, W - 24, 120 + k * 70), line, lambda s: F(s, "Black"), 50, fg)
    save(grain(img, 5), name)


def doormat():
    W, H = 1024, 384
    img = Image.new("RGB", (W, H), "#efe3c8")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline=DEEP, width=40)
    d.rectangle((50, 50, W - 50, H - 50), outline=GOLD, width=10)
    fit(d, (90, 90, W - 90, H - 90), "SALVETE", lambda s: F(s, "Black"), 200, DEEP)
    img = S.tiles(img, 48, grout="#e3d6bb", seed=4, jitter=0.05)
    save(grain(img, 4), "doormat")


def depth():
    W, H = 384, 160
    img, d = brass(W, H)
    fit(d, (20, 16, W - 20, 100), "1.4 M", lambda s: F(s, "Black"), 80, "#3a2d10")
    fit(d, (20, 96, W - 20, 146), "GENTLY DOES IT", lambda s: F(s, "Bold"), 34, "#3a2d10")
    save(grain(img, 3), "depth")


def copy_classic():
    for src, dst in (("sign.jpg", "sign_main"), ("rug.jpg", "rug")):
        Image.open(os.path.join(REPO, "dist", "assets", "senior", src)).convert("RGB").save(os.path.join(S.OUT, dst + ".png"))
        print("SIGN", dst, "(the classic's)")


JOBS = {
    "copy_classic": copy_classic,
    "programme": programme,
    "rules": rules,
    "founder_plate": founder_plate,
    "clock": clock,
    "hydro": hydro,
    "nap": nap,
    "slippers": slippers,
    "zimmer": zimmer,
    "bingo": bingo,
    "bingo_card": bingo_card,
    "lost_property": lost_property,
    "moves": moves,
    "cap_week": cap_week,
    "scale_face": scale_face,
    "newspaper": newspaper,
    "books": lambda: [book("book_1", "KNITTING|FOR|SWIMMERS", "#7a2f3a", GOLD), book("book_2", "1001|BISCUITS", "#2f5fa8", IVORY)],
    "doormat": doormat,
    "depth": depth,
    "panels": lambda: [
        panel("flippers", "FLIPPERS", "ONE PAIR EACH · NO SWAPSIES"),
        panel("water_care", "WATER CARE", "CHLORINE · pH · PATIENCE"),
        panel("eye_care", "EYE CARE", "RINSE · BLINK · FIND YOUR GLASSES", bg="#2b3a5a"),
        panel("life_ring", "LIFE RING", "THROW GENTLY", bg=RED),
        panel("fish_net", "FISH NET", "FOR GOLDFISH. AND TEETH.", bg=DEEP),
        panel("skimmer", "SKIMMER", "LEAVES · PETALS · HATPINS"),
        panel("litter", "LITTER", "THANK YOU, DEAR", W=512, H=256, bg="#2b3a34"),
        panel("biscuits", "BISCUITS", "FOR GOOD DOGS", W=512, H=256, bg="#7a4127"),
        panel("danger", "DANGER", "ELECTRICITY · DO NOT FIDDLE", W=512, H=320, bg="#f3dc6a", fg=INK, sub_fg=INK),
    ],
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for k, job in JOBS.items():
        if not only or k in only:
            job()
