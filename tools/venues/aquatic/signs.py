"""The Aquatic Centre's printed and painted surfaces, drawn with Pillow into its work folder: the pool records board (with Carl's
slowest lap), the DAYS WITHOUT A CANNONBALL counter, a cardboard cut-out of Marco "the Missile", the POOL PANIC TV logo, the club
banners (the Otters, the Seals, the Soggy Biscuits), Splashy the duck's NO RUNNING poster, the WET FLOOR boards, the vending
machine's front, the trophies' plaques, the stations' panels, the lifeguard's board. The helpers are Splash Park's
(tools/venues/splash/signs.py).

    python3 tools/venues/aquatic/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
S.OUT = os.path.join(os.environ.get("VENUE_WORK", "/tmp/aquatic-work"), "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter

NAVY, BLUE, RED, WHITE, GOLD, YELLOW, INK = "#10284a", "#1f5fd1", "#e03a3a", "#f4f8fb", "#e9b949", "#ffd24a", "#141820"
F, P, centred, grain, save, sunfade = S.F, S.P, S.centred, S.grain, S.save, S.sunfade


def records():
    """The pool records board: a navy board with gold lettering, the records in rows, the last two a little embarrassing."""
    W, H = 768, 1024
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    d.rectangle((14, 14, W - 14, H - 14), outline=GOLD, width=10)
    centred(d, (0, 30, W, 150), "POOL RECORDS", F(110, "Black"), GOLD)
    rows = [
        ("50 M FREESTYLE", "MARCO", "21.30"),
        ("100 M BACKSTROKE", "OKAFOR", "53.12"),
        ("200 M BUTTERFLY", "TANAKA", "1:54.90"),
        ("100 M BREASTSTROKE", "LINDQVIST", "58.77"),
        ("LONGEST FLOAT", "LEOPARD MAN", "2 H 14 MIN"),
        ("BIGGEST SPLASH", "CARL", "9.8 M"),
        ("SLOWEST LAP", "CARL", "4:12.88"),
    ]
    for k, (ev, who, t) in enumerate(rows):
        y = 190 + k * 112
        d.text((50, y), ev, font=F(44, "Bold"), fill=WHITE)
        d.text((50, y + 50), who, font=F(46, "Black"), fill="#ff8a6a" if who in ("MARCO", "CARL") else "#9fd0ff")
        d.text((W - 50, y + 50), t, font=F(46, "ExtraBold"), fill=GOLD, anchor="ra")
        d.line([(50, y + 104), (W - 50, y + 104)], fill="#2a4a7a", width=3)
    save(grain(img, 6), "records")


def cannonball():
    """DAYS WITHOUT A CANNONBALL: 0 (a tally board, its digits on hooks: the 0 is very used)."""
    W, H = 768, 512
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 120), fill=RED)
    centred(d, (0, 0, W, 120), "SAFETY FIRST", F(84, "Black"), WHITE)
    centred(d, (0, 130, W, 200), "DAYS WITHOUT A", F(64, "Bold"), NAVY)
    centred(d, (0, 195, W, 270), "CANNONBALL", F(80, "Black"), NAVY)
    d.rounded_rectangle((W / 2 - 110, 285, W / 2 + 110, 490), 18, fill=INK)
    centred(d, (W / 2 - 110, 285, W / 2 + 110, 490), "0", F(190, "Black"), "#ff5a3a")
    d.text((40, 440), "BEST: 0", font=F(40, "Bold"), fill=NAVY)
    d.text((W - 40, 440), "SIGH.", font=F(40, "Bold"), fill=RED, anchor="ra")
    save(grain(img, 5), "cannonball")


def marco():
    """A cardboard cut-out of Marco "the Missile" mid-flex: red cap with an M, goggles up, a gold medal, GO MARCO! underneath."""
    W, H = 512, 1024
    img = Image.new("RGB", (W, H), "#c9a46e")
    d = ImageDraw.Draw(img)
    cx = W / 2
    skin, cap = "#e8b48a", RED
    # legs and swim shorts
    d.rectangle((cx - 70, 620, cx - 18, 900), fill=skin)
    d.rectangle((cx + 18, 620, cx + 70, 900), fill=skin)
    d.rectangle((cx - 80, 560, cx + 80, 650), fill=BLUE)
    # torso, flexing arms
    d.rounded_rectangle((cx - 95, 330, cx + 95, 590), 40, fill=skin)
    for s in (-1, 1):
        d.line([(cx + s * 90, 360), (cx + s * 190, 330), (cx + s * 185, 220)], fill=skin, width=56, joint="curve")
        d.ellipse((cx + s * 185 - 42, 180, cx + s * 185 + 42, 262), fill=skin)
        d.ellipse((cx + s * 150 - 40, 300, cx + s * 150 + 30, 360), fill="#d89a70")
    # head, cap, goggles up, grin
    d.ellipse((cx - 85, 130, cx + 85, 320), fill=skin)
    d.chord((cx - 90, 115, cx + 90, 280), 180, 360, fill=cap)
    centred(d, (cx - 40, 130, cx + 40, 200), "M", F(70, "Black"), WHITE)
    for s in (-1, 1):
        d.ellipse((cx + s * 45 - 26, 190, cx + s * 45 + 26, 230), fill="#7fd8ff", outline=INK, width=6)
        d.ellipse((cx + s * 40 - 8, 245, cx + s * 40 + 8, 262), fill=INK)
    d.arc((cx - 45, 255, cx + 45, 300), 10, 170, fill=INK, width=8)
    # medal
    d.line([(cx - 40, 330), (cx, 420), (cx + 40, 330)], fill=RED, width=12)
    d.ellipse((cx - 32, 410, cx + 32, 474), fill=GOLD, outline="#a87a1a", width=5)
    # the slogan
    d.rectangle((0, 900, W, H), fill=NAVY)
    centred(d, (0, 905, W, H), "GO MARCO!", F(100, "Black"), YELLOW)
    save(sunfade(grain(img, 9), 0.08), "marco")


def tv_logo():
    W, H = 256, 256
    img = Image.new("RGB", (W, H), RED)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((12, 12, W - 12, H - 12), 30, fill=WHITE)
    centred(d, (0, 30, W, 130), "POOL", F(80, "Black"), RED)
    centred(d, (0, 110, W, 190), "PANIC", F(66, "Black"), NAVY)
    centred(d, (0, 180, W, 236), "TV", F(50, "Black"), RED)
    save(img, "tv_logo")


def club(name, title, bg, fg, emblem):
    """A club's hanging banner: its name and a cartoon emblem (an otter's face, a seal's, a soggy biscuit)."""
    W, H = 384, 768
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    d.polygon([(0, H - 80), (W / 2, H), (W, H - 80), (W, H), (0, H)], fill="#ffffff00" if False else bg)
    cx, cy = W / 2, 300
    if emblem == "otter":
        d.ellipse((cx - 110, cy - 100, cx + 110, cy + 110), fill="#8a5a35")
        d.ellipse((cx - 70, cy - 10, cx + 70, cy + 100), fill="#d9b38a")
        for s in (-1, 1):
            d.ellipse((cx + s * 50 - 14, cy - 40, cx + s * 50 + 14, cy - 12), fill=INK)
            d.ellipse((cx + s * 95 - 26, cy - 110, cx + s * 95 + 26, cy - 60), fill="#8a5a35")
        d.ellipse((cx - 20, cy + 10, cx + 20, cy + 36), fill=INK)
        for s in (-1, 1):
            for k in range(3):
                d.line([(cx + s * 30, cy + 30 + k * 10), (cx + s * 110, cy + 20 + k * 16)], fill=INK, width=3)
    elif emblem == "seal":
        d.ellipse((cx - 110, cy - 110, cx + 110, cy + 110), fill="#7f8ea0")
        for s in (-1, 1):
            d.ellipse((cx + s * 45 - 20, cy - 40, cx + s * 45 + 20, cy), fill=INK)
        d.ellipse((cx - 30, cy + 10, cx + 30, cy + 46), fill="#3a4250")
        d.ellipse((cx - 30, cy - 200, cx + 30, cy - 140), fill=RED)  # a ball on its nose... above its head
    else:  # the soggy biscuit: a round biscuit, a bite out of it, drips
        d.ellipse((cx - 110, cy - 110, cx + 110, cy + 110), fill="#d9a35a")
        d.ellipse((cx + 50, cy - 140, cx + 160, cy - 30), fill=bg)
        for k in range(9):
            a = k * 0.7
            d.ellipse((cx + math.cos(a) * 60 - 8, cy + math.sin(a) * 60 - 8, cx + math.cos(a) * 60 + 8, cy + math.sin(a) * 60 + 8), fill="#a8743a")
        for x in (cx - 60, cx, cx + 40):
            d.ellipse((x - 10, cy + 110, x + 10, cy + 150), fill="#9fd0ff")
    for k, line in enumerate(title.split("\n")):
        centred(d, (0, 470 + k * 90, W, 560 + k * 90), line, F(86, "Black"), fg)
    d.rectangle((0, 0, W, 24), fill=fg)
    save(grain(img, 5), name)


def splashy():
    """Splashy the duck says NO RUNNING!: the mascot in a swim cap pointing at you."""
    W, H = 512, 768
    img = Image.new("RGB", (W, H), "#9fd0ff")
    d = ImageDraw.Draw(img)
    cx, cy = W / 2, 330
    d.ellipse((cx - 160, cy - 40, cx + 150, cy + 200), fill="#ffd23a")
    d.ellipse((cx - 100, cy - 220, cx + 100, cy - 20), fill="#ffd23a")
    d.chord((cx - 104, cy - 236, cx + 104, cy - 90), 180, 360, fill=RED)
    d.ellipse((cx - 50, cy - 160, cx - 10, cy - 115), fill=WHITE)
    d.ellipse((cx - 38, cy - 148, cx - 18, cy - 124), fill=INK)
    d.polygon([(cx + 60, cy - 110), (cx + 170, cy - 95), (cx + 60, cy - 70)], fill="#ff8a2a")
    d.polygon([(cx - 120, cy + 40), (cx - 230, cy - 40), (cx - 200, cy + 10)], fill="#ffd23a")
    d.rectangle((0, H - 220, W, H), fill=RED)
    centred(d, (0, H - 220, W, H - 120), "SPLASHY SAYS:", F(64, "Bold"), WHITE)
    centred(d, (0, H - 130, W, H - 20), "NO RUNNING!", F(96, "Black"), YELLOW)
    save(grain(img, 5), "splashy")


def wet_floor():
    W, H = 256, 384
    img = Image.new("RGB", (W, H), YELLOW)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 70), fill=INK)
    centred(d, (0, 0, W, 70), "CAUTION", F(56, "Black"), YELLOW)
    # the slipping figure
    cx, cy = W / 2, 200
    d.ellipse((cx + 20, cy - 80, cx + 56, cy - 44), fill=INK)
    d.line([(cx + 30, cy - 44), (cx - 10, cy + 20)], fill=INK, width=14)
    d.line([(cx - 10, cy + 20), (cx - 60, cy + 10)], fill=INK, width=12)
    d.line([(cx - 10, cy + 20), (cx + 40, cy + 60)], fill=INK, width=12)
    d.line([(cx + 20, cy - 20), (cx + 70, cy - 50)], fill=INK, width=10)
    d.line([(cx + 10, cy - 15), (cx - 50, cy - 40)], fill=INK, width=10)
    d.line([(cx - 90, cy + 75), (cx + 90, cy + 75)], fill=INK, width=8)
    centred(d, (0, H - 80, W, H), "WET FLOOR", F(54, "Black"), INK)
    save(img, "wet_floor")


def vending():
    W, H = 512, 1024
    img = Image.new("RGB", (W, H), BLUE)
    d = ImageDraw.Draw(img)
    centred(d, (0, 10, W, 120), "ISO-SPLASH", F(90, "Black"), WHITE)
    d.rectangle((30, 140, W - 140, H - 160), fill="#d8eefa")
    cols = ["#ff5a3a", "#ffd24a", "#2fae7a", "#ff7eb3", "#5aa8ea"]
    for r in range(5):
        for c in range(4):
            x, y = 50 + c * 80, 165 + r * 140
            d.rounded_rectangle((x, y, x + 50, y + 110), 14, fill=cols[(r + c) % 5])
            d.rectangle((x, y + 40, x + 50, y + 70), fill=WHITE)
        d.line([(40, 290 + r * 140), (W - 150, 290 + r * 140)], fill="#7f98b0", width=6)
    d.rectangle((W - 120, 160, W - 30, 420), fill=INK)
    for k in range(9):
        d.rectangle((W - 108 + (k % 3) * 28, 190 + (k // 3) * 40, W - 88 + (k % 3) * 28, 214 + (k // 3) * 40), fill="#9fd0ff")
    d.rectangle((60, H - 130, W - 60, H - 50), fill=INK)
    save(grain(img, 4), "vending")


def plaque(name, text):
    W, H = 256, 96
    img = Image.new("RGB", (W, H), "#2a2018")
    d = ImageDraw.Draw(img)
    d.rectangle((6, 6, W - 6, H - 6), outline=GOLD, width=4)
    centred(d, (0, 0, W, H), text, F(30, "Bold"), GOLD)
    save(img, name)


def banner_quiet():
    W, H = 1536, 192
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    centred(d, (0, 0, W, H), "QUIET PLEASE  ·  STARTER'S ORDERS  ·  NO BOMBING", F(110, "Black"), WHITE)
    d.rectangle((0, 0, W, 12), fill=RED)
    d.rectangle((0, H - 12, W, H), fill=BLUE)
    save(img, "banner_quiet")


def _sky(W, H, top="#5fa8e8", bottom="#d9eefb", seed=1, clouds=5):
    """A daylight sky seen through the hall's glass: a gradient, soft clouds, two diagonal glints on the pane."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H))
    t, b = Image.new("RGB", (1, 1), top).getpixel((0, 0)), Image.new("RGB", (1, 1), bottom).getpixel((0, 0))
    d = ImageDraw.Draw(img)
    for y in range(H):
        u = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(t[i] + (b[i] - t[i]) * u) for i in range(3)))
    cl = Image.new("L", (W, H), 0)
    dc = ImageDraw.Draw(cl)
    for _ in range(clouds):
        cx, cy, r = rnd.uniform(0, W), rnd.uniform(H * 0.1, H * 0.7), rnd.uniform(W * 0.08, W * 0.16)
        for k in range(5):
            dx, dy = rnd.uniform(-1.6, 1.6) * r, rnd.uniform(-0.3, 0.3) * r
            rr = r * rnd.uniform(0.6, 1.1)
            dc.ellipse((cx + dx - rr, cy + dy - rr * 0.7, cx + dx + rr, cy + dy + rr * 0.7), fill=235)
    cl = cl.filter(ImageFilter.GaussianBlur(W / 60))
    img = Image.composite(Image.new("RGB", (W, H), "#ffffff"), img, cl)
    glint = Image.new("L", (W, H), 0)
    dg = ImageDraw.Draw(glint)
    for x0, wd in ((W * 0.15, W * 0.12), (W * 0.42, W * 0.05)):
        dg.polygon([(x0, H), (x0 + wd, H), (x0 + wd + H * 0.6, 0), (x0 + H * 0.6, 0)], fill=60)
    glint = glint.filter(ImageFilter.GaussianBlur(W / 80))
    return Image.composite(Image.new("RGB", (W, H), "#ffffff"), img, glint)


def window_sky():
    """The upper panes of the hall's tall windows: sky and clouds."""
    save(_sky(512, 512, seed=3, clouds=6), "window_sky")


def window_town(name="window_town", duck=True, seed=12):
    """The lowest panes: the town outside under the sky. Rooftops, trees, a church spire, the gasometer, and (in one view of
    two, seen now and then) the town's water tower, which is a giant rubber duck (Splashy's dad, the locals say)."""
    W, H = 512, 512
    img = _sky(W, H, top="#78b8ee", bottom="#e2f2fb", seed=seed - 4, clouds=3)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    # far hills
    d.polygon([(0, 330)] + [(x, 300 + 16 * math.sin(x / 70) + 8 * math.sin(x / 23)) for x in range(0, W + 1, 16)] + [(W, H), (0, H)], fill="#9fc6a8")
    # the duck water tower on its legs
    tx = 380 if duck else -400
    for lx in (tx - 34, tx + 34):
        d.line([(lx, 400), (tx + (lx - tx) * 0.4, 250)], fill="#7d8a96", width=6)
    d.line([(tx - 24, 330), (tx + 24, 330)], fill="#7d8a96", width=4)
    d.ellipse((tx - 52, 196, tx + 46, 262), fill="#ffd24a")
    d.ellipse((tx - 60, 160, tx - 16, 204), fill="#ffd24a")
    d.polygon([(tx - 62, 182), (tx - 86, 188), (tx - 62, 194)], fill="#f08a2a")
    d.ellipse((tx - 46, 172, tx - 38, 180), fill="#141820")
    # the church spire and the gasometer
    sx = 110 if duck else 360
    d.polygon([(sx, 236), (sx + 14, 236), (sx + 7, 170)], fill="#8a7a6a")
    d.rectangle((sx - 6, 236, sx + 20, 330), fill="#b8a48c")
    d.ellipse((220, 262, 300, 300), fill="#9aa7b0")
    d.rectangle((220, 280, 300, 340), fill="#9aa7b0")
    for y in range(286, 340, 10):
        d.line([(220, y), (300, y)], fill="#7f8c95", width=2)
    # rooftops: a row of houses with red and grey roofs and lit windows
    x = -10
    while x < W:
        w_ = rnd.randint(46, 80)
        h_ = rnd.randint(50, 80)
        top = 420 - h_
        wall = rnd.choice(["#efe2c8", "#e8d2b0", "#d9c4a6", "#f2ece0", "#cfd8de"])
        roof = rnd.choice(["#c4553a", "#a9473a", "#6e7680", "#b8603e"])
        d.rectangle((x, top, x + w_, H), fill=wall)
        d.polygon([(x - 4, top), (x + w_ / 2, top - rnd.randint(20, 34)), (x + w_ + 4, top)], fill=roof)
        for wy in range(top + 12, H - 20, 26):
            for wx in range(x + 8, x + w_ - 12, 20):
                d.rectangle((wx, wy, wx + 9, wy + 12), fill="#5a7a96")
        x += w_ + rnd.randint(-4, 6)
    # trees in front
    for k in range(9):
        cx, cy, r = rnd.uniform(0, W), rnd.uniform(430, 470), rnd.uniform(26, 44)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rnd.choice(["#4f8a4a", "#5e9a52", "#3f7a44"]))
    save(grain(img, 4), name)


def mural():
    """The timing wall's mural over the doors: a cartoon swimmer in a cap doing butterfly over painted waves, the hall's motto."""
    W, H = 1024, 384
    img = Image.new("RGB", (W, H), "#e9f5fb")
    d = ImageDraw.Draw(img)
    for k, col in enumerate(("#1f5fd1", "#3a87d2", "#5aa8ea")):
        y0 = 250 + k * 34
        d.polygon([(0, H)] + [(x, y0 + 16 * math.sin(x / 40 + k)) for x in range(0, W + 1, 8)] + [(W, H)], fill=col)
    # the swimmer: two arms flung over the water, a red cap, goggles, splash drops
    cx, cy = 300, 220
    d.ellipse((cx - 50, cy - 50, cx + 50, cy + 40), fill="#e8a070")
    d.chord((cx - 52, cy - 56, cx + 52, cy + 30), 180, 360, fill="#e03a3a")
    for gx in (cx - 22, cx + 18):
        d.ellipse((gx - 16, cy - 10, gx + 16, cy + 16), fill="#5aa8ea", outline="#10284a", width=4)
    for s in (-1, 1):
        d.line([(cx + s * 40, cy + 10), (cx + s * 140, cy - 70), (cx + s * 210, cy - 10)], fill="#e8a070", width=34, joint="curve")
    rnd = random.Random(5)
    for _ in range(26):
        x, y, r = rnd.uniform(60, 540), rnd.uniform(130, 260), rnd.uniform(5, 12)
        d.ellipse((x - r, y - r * 1.3, x + r, y + r), fill="#ffffff")
    d.text((620, 80), "SWIM FAST.", font=F(96, "Black"), fill="#10284a")
    d.text((620, 180), "DON'T PANIC.", font=F(96, "Black"), fill="#e03a3a")
    d.text((624, 290), "(OKAY, PANIC A LITTLE)", font=F(40, "Bold"), fill="#ffffff")
    save(grain(img, 5), "mural")


def lifeguard():
    W, H = 768, 256
    img = Image.new("RGB", (W, H), RED)
    d = ImageDraw.Draw(img)
    d.rectangle((12, 12, W - 12, H - 12), outline=WHITE, width=8)
    centred(d, (0, 0, W, H), "LIFEGUARD", F(170, "Black"), WHITE)
    save(img, "lifeguard")


JOBS = {
    "records": records,
    "cannonball": cannonball,
    "marco": marco,
    "tv_logo": tv_logo,
    "club_otters": lambda: club("club_otters", "THE\nOTTERS", "#1f5fd1", WHITE, "otter"),
    "club_seals": lambda: club("club_seals", "THE\nSEALS", "#10284a", YELLOW, "seal"),
    "club_biscuits": lambda: club("club_biscuits", "SOGGY\nBISCUITS", "#e03a3a", WHITE, "biscuit"),
    "splashy": splashy,
    "wet_floor": wet_floor,
    "vending": vending,
    "plaque_flipper": lambda: plaque("plaque_flipper", "GOLDEN FLIPPER '87"),
    "plaque_duck": lambda: plaque("plaque_duck", "BEST DUCK 2019"),
    "plaque_goggles": lambda: plaque("plaque_goggles", "CLEAREST GOGGLES"),
    "plaque_fish": lambda: plaque("plaque_fish", "FISH OF THE YEAR"),
    "banner_quiet": banner_quiet,
    "lifeguard": lifeguard,
    "window_sky": window_sky,
    "window_town": window_town,
    "window_town2": lambda: window_town("window_town2", duck=False, seed=31),
    "mural": mural,
    "water_care": lambda: S.panel("water_care", "WATER CARE", "CHLORINE · TESTING", YELLOW, NAVY),
    "eye_care": lambda: S.panel("eye_care", "EYE CARE", "RINSE · DROPS · TOWELS", "#e8f3ea", NAVY),
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for n, job in JOBS.items():
        if not only or n in only:
            job()
