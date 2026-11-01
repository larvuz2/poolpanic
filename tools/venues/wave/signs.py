"""The Wave Pool's painted and printed surfaces, drawn with Pillow into its work folder (the mural is fal's, cropped into it by
build_all.sh). A 1960s surf park's: the roof sign (Wave Pool in brush script on a coral board, SURF'S UP · EST. 1962), the gate's arch,
the chambers' numbers and their warnings, the LED board's brass plate, the lifeguard tower's boards, the tube hut's and the Surf
Shack's (a menu in cents), the stations' boards (WATER CARE, EYE CARE, LIFE RING, FISH NET, SKIMMER, WASTE, DOG TREATS), the wave
machine's door and its fuse board, and the goofy ones: the rules (the octopus is not a lifeguard), the surf report (today: waves;
tomorrow: also waves), YOU MUST BE THIS TALL TO SURF on a shark, SPF 9000, the Hall of Wipeouts (snapshots of splashes), the lost &
found's flip-flops (never a pair), the siren's warning (hold on to your trunks); the floor's sun medallions, the depth plaques, six
surfboards' decks. The helpers are Splash Park's (tools/venues/splash/signs.py).

    python3 tools/venues/wave/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
S.OUT = os.path.join(os.environ.get("VENUE_WORK", "/tmp/wave-work"), "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

F, P, centred, grain, save, sunfade, rgb = S.F, S.P, S.centred, S.grain, S.save, S.sunfade, S.rgb
CREAM, CORAL, TEAL, SEAFOAM, SUN, NAVY, TEAK, WHITE, RED, INK = (
    "#fff1d8",
    "#e2574a",
    "#1f9aa0",
    "#8fd8c8",
    "#ffc93c",
    "#174958",
    "#b57a43",
    "#fbfaf4",
    "#d43a2f",
    "#1b1c1f",
)


def text_fit(d, box, s, font_fn, size, fill, stroke=0, stroke_fill=None, min_size=20):
    """Centred text, as large as `size` but shrunk to fit the box's width."""
    x0, y0, x1, y1 = box
    while size > min_size:
        f = font_fn(size)
        l, t, r, b = d.textbbox((0, 0), s, font=f, stroke_width=stroke)
        if r - l <= (x1 - x0) and b - t <= (y1 - y0) * 1.05:
            break
        size -= 4
    centred(d, box, s, font_fn(size), fill, stroke, stroke_fill)


def board(W, H, bg, seed=1, edge=None, radius=24, width=10):
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    if edge:
        d.rounded_rectangle((width, width, W - width, H - width), radius, outline=edge, width=width)
    return img, d


def wood(W, H, base=TEAK, seed=1, planks=1):
    """A board of teak: grain along it, planks, a little weathering."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H), base)
    d = ImageDraw.Draw(img)
    r, g_, b = rgb(base)
    for y in range(0, H, 3):
        k = 0.88 + 0.12 * math.sin(y * 0.07 + rnd.random()) + rnd.uniform(-0.04, 0.04)
        d.line([(0, y), (W, y + rnd.randint(-3, 3))], fill=(int(r * k), int(g_ * k), int(b * k)), width=3)
    for k in range(1, planks):
        y = H * k // planks
        d.line([(0, y), (W, y)], fill=(int(r * 0.55), int(g_ * 0.55), int(b * 0.55)), width=4)
    return img, d


def chalk(img, d, box, lines, font, fill="#f4f1e6", gap=1.25):
    x0, y0, x1, y1 = box
    y = y0
    for s in lines:
        f = F(font, "Bold") if not s.startswith("~") else P(int(font * 0.8))
        s = s.lstrip("~")
        l, t, r, b = d.textbbox((0, 0), s, font=f)
        d.text(((x0 + x1 - (r - l)) / 2 - l, y), s, font=f, fill=fill)
        y += int(font * gap)


def chalky(img, amount=10):
    return grain(img.filter(ImageFilter.GaussianBlur(0.6)), amount)


# ---- the roof sign: Wave Pool in script, a bulb-lit coral board -------------------------------------------------------------------
def roof_sign():
    W, H = 1040, 230
    img, d = board(W, H, CORAL)
    # stripes of sunrays behind the words, faded
    for k in range(-12, 13):
        a = math.radians(90 + k * 7.5)
        d.polygon([(W / 2, H + 60), (W / 2 + math.cos(a - 0.05) * 1200, H + 60 - math.sin(a - 0.05) * 1200), (W / 2 + math.cos(a + 0.05) * 1200, H + 60 - math.sin(a + 0.05) * 1200)], fill="#e86a54" if k % 2 else CORAL)
    d.rectangle((0, 0, W, 16), fill=CREAM)
    d.rectangle((0, H - 16, W, H), fill=CREAM)
    f = P(150)
    for dx, dy in ((7, 8),):
        centred(d, (dx, -18 + dy, W + dx, H - 52 + dy), "Wave Pool", f, NAVY)
    centred(d, (0, -18, W, H - 52), "Wave Pool", f, SUN, 7, NAVY)
    centred(d, (0, H - 62, W, H - 18), "SURF'S UP  ·  EST. 1962", F(40, "Black"), CREAM)
    save(sunfade(grain(img, 5), 0.08), "roof_sign")


# ---- the gate: a teal arch board, SURF GATE, little waves --------------------------------------------------------------------------
def gate_sign():
    W, H = 1024, 256
    img, d = board(W, H, TEAL, edge=CREAM, radius=40, width=12)
    for x in range(40, W - 40, 60):
        d.arc((x, H - 70, x + 60, H - 10), 180, 360, fill=SEAFOAM, width=8)
    centred(d, (0, 20, W, 150), "SURF GATE", F(140, "Black"), CREAM)
    centred(d, (0, 140, W, 200), "~ WAVE POOL · BIENVENIDOS · ALOHA ~", F(40, "Bold"), SUN)
    save(sunfade(grain(img, 5), 0.1), "gate_sign")


def chamber(n):
    W, H = 160, 200
    img, d = board(W, H, CREAM, edge=NAVY, radius=18, width=8)
    centred(d, (0, 10, W, H - 40), str(n), F(150, "Black"), CORAL, 4, NAVY)
    centred(d, (0, H - 54, W, H - 14), "CHAMBER", F(30, "Bold"), NAVY)
    save(grain(img, 4), f"chamber_{n}")


def chamber_warn():
    W, H = 384, 256
    img, d = board(W, H, WHITE, edge=RED, radius=10, width=10)
    d.rectangle((10, 10, W - 10, 80), fill=RED)
    centred(d, (0, 10, W, 80), "DANGER", F(66, "Black"), WHITE)
    centred(d, (0, 90, W, 160), "WAVE CHAMBER", F(54, "Black"), INK)
    text_fit(d, (24, 160, W - 24, 230), "NO SWIMMING IN HERE. SERIOUSLY.", lambda s: F(s, "Bold"), 32, INK)
    save(sunfade(grain(img, 4), 0.1), "chamber_warn")


def led_plate():
    W, H = 512, 96
    img, d = board(W, H, "#c9a24a", edge="#7a5f22", radius=12, width=6)
    centred(d, (0, 0, W, H), "WAVE-O-MATIC  MK II  ·  1962", F(50, "Black"), "#3a2d10")
    save(grain(img, 6), "led_plate")


def siren_warn():
    W, H = 512, 320
    img, d = board(W, H, SUN, radius=10)
    for x in range(-H, W + H, 48):
        d.polygon([(x, 0), (x + 24, 0), (x + 24 + 40, 40), (x + 40, 40)], fill=INK)
        d.polygon([(x, H - 40), (x + 24, H - 40), (x + 24 + 40, H), (x + 40, H)], fill=INK)
    text_fit(d, (20, 48, W - 20, 140), "WHEN THE SIREN SOUNDS", lambda s: F(s, "Black"), 56, INK)
    centred(d, (0, 140, W, 220), "HOLD ON TO", F(64, "Black"), RED)
    centred(d, (0, 210, W, 290), "YOUR TRUNKS", F(64, "Black"), RED)
    save(grain(img, 5), "siren_warn")


# ---- the lifeguard tower ------------------------------------------------------------------------------------------------------------
def lifeguard():
    W, H = 768, 192
    img, d = board(W, H, RED, edge=WHITE, radius=16, width=10)
    centred(d, (0, 0, W, H), "LIFEGUARD", F(150, "Black"), WHITE)
    save(sunfade(grain(img, 5), 0.12), "lifeguard")


def red_cross():
    W = 256
    img, d = board(W, W, WHITE)
    d.rectangle((W * 0.38, W * 0.12, W * 0.62, W * 0.88), fill=RED)
    d.rectangle((W * 0.12, W * 0.38, W * 0.88, W * 0.62), fill=RED)
    save(grain(img, 3), "red_cross")


def flag_board():
    W, H = 512, 384
    img, d = wood(W, H, "#d9c4a0", 5, 3)
    centred(d, (0, 10, W, 90), "TODAY'S FLAG", F(64, "Black"), NAVY)
    for k, (c, s) in enumerate([(("#3cb46e"), "CALM"), (SUN, "WAVES"), (RED, "MONSTER")]):
        y = 110 + k * 88
        d.rectangle((40, y, 130, y + 64), fill=c, outline=INK, width=4)
        d.text((160, y + 2), s, font=F(60, "Black"), fill=INK)
    # a chalk tick by WAVES, always
    d.line([(400, 225), (420, 250), (470, 190)], fill=WHITE, width=10)
    save(grain(img, 5), "flag_board")


# ---- the tube hut and the Surf Shack --------------------------------------------------------------------------------------------------
def tube_hut():
    W, H = 768, 256
    img, d = board(W, H, SUN, edge=NAVY, radius=30, width=10)
    centred(d, (0, 10, W, 170), "TUBE HUT", F(150, "Black"), NAVY)
    centred(d, (0, 170, W, 236), "FREE · PLEASE BRING THEM BACK", F(46, "Bold"), CORAL)
    save(sunfade(grain(img, 5), 0.1), "tube_hut")


def tube_rules():
    W, H = 384, 512
    img = Image.new("RGB", (W, H), "#2f3b36")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline="#8a5a33", width=18)
    chalk(img, d, (20, 34, W - 20, H), ["TUBES:", "ONE EACH", "NO STACKING", "NO SITTING", "ON THE DUCK", "~thank you!"], 58, gap=1.22)
    save(chalky(img), "tube_rules")


def surf_shack():
    W, H = 1024, 220
    img, d = wood(W, H, "#8a5a33", 9, 2)
    centred(d, (0, -8, W, H), "SURF SHACK", F(170, "Black"), SUN, 6, NAVY)
    save(sunfade(grain(img, 5), 0.1), "surf_shack")


def shack_menu():
    W, H = 512, 640
    img = Image.new("RGB", (W, H), "#26302c")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline="#8a5a33", width=20)
    centred(d, (0, 30, W, 120), "Menu", P(84), SUN)
    items = [
        ("SHAVE ICE", "25¢"),
        ("CORN DOG", "35¢"),
        ("HOT DOG", "30¢"),
        ("PINEAPPLE", "20¢"),
        ("SURF WAX", "15¢"),
        ("SUNSCREEN", "FREE"),
        ("A TUBE", "ASK THE COACH"),
    ]
    for k, (a, b) in enumerate(items):
        y = 150 + k * 66
        d.text((44, y), a, font=F(50, "Bold"), fill="#f4f1e6")
        l, t, r, bb = d.textbbox((0, 0), b, font=F(44, "Bold"))
        d.text((W - 44 - (r - l), y + 4), b, font=F(44, "Bold"), fill=SUN if k < 6 else CORAL)
    save(chalky(img), "shack_menu")


# ---- the stations' boards -----------------------------------------------------------------------------------------------------------
def panel(name, title, sub, bg, fg=CREAM, W=768, H=320, icon=None):
    img, d = board(W, H, bg, edge=fg, radius=28, width=10)
    text_fit(d, (40, 30, W - 40, 210), title, lambda s: F(s, "Black"), 150, fg)
    text_fit(d, (40, 210, W - 40, H - 30), sub, lambda s: F(s, "Bold"), 60, fg)
    save(sunfade(grain(img, 5), 0.1), name)


# ---- the goofy ones ------------------------------------------------------------------------------------------------------------------
def rules():
    W, H = 640, 896
    img, d = board(W, H, CREAM)
    d.rectangle((0, 0, W, 170), fill=TEAL)
    text_fit(d, (20, 0, W - 20, 170), "WAVE POOL RULES", lambda s: F(s, "Black"), 100, CREAM)
    lines = [
        "1  Ride the wave, don't fight it",
        "2  No surfing in the chambers",
        "3  No running (wading is fine)",
        "4  One tube per bather",
        "5  The octopus is not a lifeguard",
        "6  Siren = monster. Hold on.",
        "7  Listen to the coach",
    ]
    for k, s in enumerate(lines):
        d.text((40, 210 + k * 90), s, font=F(52, "Bold"), fill=NAVY)
    d.rectangle((0, H - 50, W, H), fill=CORAL)
    save(sunfade(grain(img, 6), 0.15), "rules")


def surf_report():
    W, H = 640, 512
    img = Image.new("RGB", (W, H), "#26302c")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline="#8a5a33", width=22)
    centred(d, (0, 30, W, 120), "Surf Report", P(76), SUN)
    chalk(img, d, (30, 140, W - 30, H), ["TODAY: WAVES", "TOMORROW: ALSO WAVES", "WATER: WET", "OCTOPUS: FRIENDLY"], 56, gap=1.3)
    d.ellipse((W - 150, 40, W - 60, 130), outline=SUN, width=6)
    for k in range(8):
        a = k * math.pi / 4
        d.line([(W - 105 + math.cos(a) * 55, 85 + math.sin(a) * 55), (W - 105 + math.cos(a) * 75, 85 + math.sin(a) * 75)], fill=SUN, width=6)
    save(chalky(img), "surf_report")


def height_shark():
    W, H = 320, 1024
    img = Image.new("RGB", (W, H), SEAFOAM)
    d = ImageDraw.Draw(img)
    # the shark, standing on its tail, grinning
    body = [(160, 120), (230, 260), (250, 520), (220, 760), (170, 900), (120, 760), (90, 520), (100, 260)]
    d.polygon(body, fill="#7d93a6", outline=NAVY)
    d.polygon([(165, 900), (100, 990), (230, 990)], fill="#7d93a6", outline=NAVY)
    d.polygon([(95, 420), (20, 520), (95, 500)], fill="#6a8094", outline=NAVY)
    d.polygon([(245, 420), (310, 520), (245, 500)], fill="#6a8094", outline=NAVY)
    d.polygon([(130, 300), (160, 260), (210, 300), (190, 600), (130, 600)], fill="#e8eef2")
    d.ellipse((125, 190, 155, 220), fill=WHITE, outline=NAVY, width=3)
    d.ellipse((185, 190, 215, 220), fill=WHITE, outline=NAVY, width=3)
    d.ellipse((134, 199, 148, 213), fill=INK)
    d.ellipse((194, 199, 208, 213), fill=INK)
    d.chord((120, 220, 220, 300), 0, 180, fill="#b43a3a", outline=NAVY, width=3)
    for k in range(6):
        x = 130 + k * 15
        d.polygon([(x, 260), (x + 7, 275), (x + 14, 260)], fill=WHITE)
    # the arm pointing at the line, the line itself
    d.rectangle((0, 108, W, 116), fill=CORAL)
    d.polygon([(232, 300), (300, 150), (280, 140), (220, 280)], fill="#7d93a6", outline=NAVY)
    d.rectangle((0, 0, W, 104), fill=CREAM)
    text_fit(d, (6, 4, W - 6, 56), "YOU MUST BE", lambda s: F(s, "Black"), 52, NAVY)
    text_fit(d, (6, 50, W - 6, 104), "THIS TALL TO SURF", lambda s: F(s, "Black"), 44, CORAL)
    # a ruler down the side
    for y in range(120, H, 20):
        d.line([(0, y), (24 if (y // 20) % 5 else 44, y)], fill=NAVY, width=3)
    save(grain(img, 4), "height_shark")


def spf():
    W, H = 384, 512
    img, d = board(W, H, SUN, edge=CORAL, radius=30, width=12)
    d.ellipse((92, 40, 292, 240), fill=CORAL)
    for k in range(12):
        a = k * math.pi / 6
        d.line([(192 + math.cos(a) * 110, 140 + math.sin(a) * 110), (192 + math.cos(a) * 150, 140 + math.sin(a) * 150)], fill=CORAL, width=10)
    centred(d, (0, 260, W, 380), "SPF 9000", F(100, "Black"), NAVY)
    centred(d, (0, 380, W, 470), "FREE · PUSH HERE", F(52, "Bold"), NAVY)
    save(grain(img, 5), "spf")


def wipeouts():
    W, H = 1024, 640
    img, d = wood(W, H, "#6f4a2c", 21, 4)
    d.rectangle((0, 0, W, 120), fill=NAVY)
    centred(d, (0, 0, W, 120), "Hall of Wipeouts", P(84), SUN)
    rnd = random.Random(7)
    captions = ["TED '62", "LULU '63", "BIG AL '63", "THE DUCK", "MARCO?!", "TED AGAIN", "DORIS '64", "COACH '65"]
    for k in range(8):
        cx, cy = 130 + (k % 4) * 255, 250 + (k // 4) * 245
        ang = rnd.uniform(-8, 8)
        ph = Image.new("RGB", (190, 210), WHITE)
        pd = ImageDraw.Draw(ph)
        sky = rnd.choice(["#7fc8e8", "#f2b46b", "#9fd6e8", "#f6d27a"])
        pd.rectangle((12, 12, 178, 160), fill=sky)
        pd.rectangle((12, 110, 178, 160), fill=rnd.choice(["#1f9aa0", "#2a7fb0", "#3aa8b8"]))
        # the splash: a burst of white with legs or a board sticking out
        sx, sy = rnd.randint(60, 130), rnd.randint(90, 115)
        for j in range(14):
            a = rnd.uniform(math.pi, 2 * math.pi)
            r = rnd.uniform(18, 46)
            pd.ellipse((sx + math.cos(a) * r - 9, sy + math.sin(a) * r - 9, sx + math.cos(a) * r + 9, sy + math.sin(a) * r + 9), fill=WHITE)
        if k % 3 == 0:
            pd.polygon([(sx - 6, sy - 40), (sx + 8, sy - 72), (sx + 16, sy - 68), (sx + 4, sy - 36)], fill=rnd.choice([CORAL, SUN]))
        else:
            pd.line([(sx - 8, sy - 30), (sx - 14, sy - 62)], fill="#e2b48a", width=7)
            pd.line([(sx + 8, sy - 30), (sx + 18, sy - 60)], fill="#e2b48a", width=7)
        text_fit(pd, (10, 162, 180, 204), captions[k], lambda s: F(s, "Bold"), 34, INK)
        ph = ph.rotate(ang, expand=True, fillcolor=None)
        mask = Image.new("L", (190, 210), 255).rotate(ang, expand=True)
        img.paste(ph, (int(cx - ph.width / 2), int(cy - ph.height / 2)), mask)
        d.ellipse((cx - 8, cy - 112, cx + 8, cy - 96), fill=RED)
    save(grain(img, 5), "wipeouts")


def lost_found():
    W, H = 512, 192
    img, d = wood(W, H, "#d9c4a0", 31)
    centred(d, (0, 0, W, 120), "LOST & FOUND", F(84, "Black"), NAVY)
    centred(d, (0, 110, W, 180), "(flip-flops: we only ever find one)", F(36, "Bold"), NAVY)
    save(grain(img, 5), "lost_found")


def pump_house():
    W, H = 640, 256
    img, d = board(W, H, "#e9e5da", edge=NAVY, radius=8, width=10)
    d.rectangle((10, 10, W - 10, 90), fill=NAVY)
    centred(d, (0, 10, W, 90), "WAVE MACHINE", F(70, "Black"), SUN)
    centred(d, (0, 96, W, 170), "AUTHORISED STAFF ONLY", F(56, "Black"), INK)
    centred(d, (0, 170, W, 240), "KNOCK LOUDLY · IT'S LOUD IN HERE", F(38, "Bold"), CORAL)
    save(grain(img, 5), "pump_house")


def tickets():
    W, H = 640, 192
    img, d = board(W, H, CORAL, edge=CREAM, radius=24, width=10)
    centred(d, (0, 0, W, H), "TICKETS", F(150, "Black"), CREAM)
    save(sunfade(grain(img, 5), 0.1), "tickets")


def gauge():
    W = 256
    img, d = board(W, W, "#f4f1e6")
    d.ellipse((8, 8, W - 8, W - 8), outline=INK, width=10)
    for k in range(11):
        a = math.radians(225 - k * 27)
        d.line([(128 + math.cos(a) * 90, 128 - math.sin(a) * 90), (128 + math.cos(a) * 110, 128 - math.sin(a) * 110)], fill=INK, width=5)
    d.arc((30, 30, W - 30, W - 30), -45, 0, fill=RED, width=14)
    a = math.radians(-30)
    d.line([(128, 128), (128 + math.cos(a) * 95, 128 - math.sin(a) * 95)], fill=RED, width=8)
    d.ellipse((116, 116, 140, 140), fill=INK)
    centred(d, (0, 160, W, 210), "WAVES", F(36, "Black"), INK)
    save(img, "gauge")


# ---- the floor: two sun medallions in tile, the depth plaques on the coping ---------------------------------------------------------
def medallion(name, seed):
    W = 1024
    img = Image.new("RGB", (W, W), "#efe3c8")
    d = ImageDraw.Draw(img)
    c = W / 2
    rings = [(500, NAVY), (470, "#f4e7c9"), (440, TEAL), (380, "#f4e7c9"), (360, CORAL), (300, "#f4e7c9"), (280, SUN)]
    for r, col in rings:
        d.ellipse((c - r, c - r, c + r, c + r), fill=col)
    # the rays: 16 points of coral and teal
    for k in range(16):
        a = k * math.pi / 8 + (math.pi / 16 if seed % 2 else 0)
        col = CORAL if k % 2 else TEAL
        r0, r1 = 300, 438 if k % 2 else 400
        d.polygon([(c + math.cos(a - 0.12) * r0, c + math.sin(a - 0.12) * r0), (c + math.cos(a) * r1, c + math.sin(a) * r1), (c + math.cos(a + 0.12) * r0, c + math.sin(a + 0.12) * r0)], fill=col)
    # the sun's face
    d.ellipse((c - 200, c - 200, c + 200, c + 200), fill=SUN, outline=NAVY, width=10)
    d.arc((c - 110, c - 40, c + 110, c + 130), 20, 160, fill=NAVY, width=16)
    for ex in (-70, 70):
        d.arc((c + ex - 40, c - 90, c + ex + 40, c - 20), 200, 340, fill=NAVY, width=14)
    d.ellipse((c - 150, c + 10, c - 100, c + 50), fill="#f39a6a")
    d.ellipse((c + 100, c + 10, c + 150, c + 50), fill="#f39a6a")
    # the lettering round the ring
    word = "WAVE POOL · EST. 1962 · " * 2
    f = F(54, "Black")
    for i, ch in enumerate(word):
        a = -math.pi / 2 + i * (2 * math.pi / len(word))
        layer = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        centred(ld, (0, 0, 80, 80), ch, f, NAVY)
        layer = layer.rotate(-math.degrees(a) - 90, resample=Image.BICUBIC)
        img.paste(layer, (int(c + math.cos(a) * 410 - 40), int(c + math.sin(a) * 410 - 40)), layer)
    img = S.tiles(img, 32, grout="#e6dcc4", seed=seed, jitter=0.05)
    save(grain(img, 4), name)


def depth(name, s):
    W, H = 256, 128
    img, d = board(W, H, CREAM)
    centred(d, (0, 0, W, H), s, F(100, "Black"), NAVY)
    save(grain(img, 4), name)


def no_diving():
    W, H = 256, 128
    img, d = board(W, H, CREAM)
    d.ellipse((14, 14, 114, 114), outline=RED, width=10)
    d.line([(30, 98), (98, 30)], fill=RED, width=10)
    d.line([(44, 50), (84, 80)], fill=NAVY, width=12)
    d.ellipse((76, 40, 96, 60), fill=NAVY)
    text_fit(d, (118, 0, W - 6, H), "NO DIVING", lambda s: F(s, "Black"), 50, NAVY)
    save(grain(img, 4), "no_diving")


# ---- surfboards' decks: a stringer, a stripe or a flower, a little wax ---------------------------------------------------------------
BOARDS = [
    ("board_1", CREAM, [("stripe", CORAL), ("stripe2", TEAL)]),
    ("board_2", SUN, [("flower", CORAL)]),
    ("board_3", TEAL, [("stripe", CREAM), ("stripe2", CORAL)]),
    ("board_4", CORAL, [("flame", SUN)]),
    ("board_5", "#a8d8f0", [("rainbow", None)]),
    ("board_6", WHITE, [("bite", NAVY)]),
]


def surfboard(name, base, motifs):
    W, H = 256, 1024
    img = Image.new("RGB", (W, H), base)
    d = ImageDraw.Draw(img)
    for kind, col in motifs:
        if kind == "stripe":
            d.rectangle((0, 300, W, 360), fill=col)
        if kind == "stripe2":
            d.rectangle((0, 380, W, 410), fill=col)
        if kind == "flower":
            for k in range(5):
                a = k * 2 * math.pi / 5
                d.ellipse((128 + math.cos(a) * 50 - 40, 520 + math.sin(a) * 50 - 40, 128 + math.cos(a) * 50 + 40, 520 + math.sin(a) * 50 + 40), fill=col)
            d.ellipse((108, 500, 148, 540), fill=SUN if base != SUN else WHITE)
        if kind == "flame":
            for k in range(5):
                x = 30 + k * 48
                d.polygon([(x, 1024), (x + 24, 700 - (k % 2) * 120), (x + 48, 1024)], fill=col)
        if kind == "rainbow":
            for k, c in enumerate([RED, "#f47742", SUN, "#3cb46e", "#2f8fe0", "#7d5ab8"]):
                d.rectangle((0, 380 + k * 28, W, 408 + k * 28), fill=c)
        if kind == "bite":
            # a bite out of the rail (drawn as the board's background colour: the shape is the board's)
            for k in range(7):
                d.ellipse((W - 40, 420 + k * 30, W + 20, 470 + k * 30), fill="#9fb6c4")
    d.line([(W / 2, 0), (W / 2, H)], fill="#8a5a33", width=5)  # the stringer
    wax = Image.effect_noise((W, H), 30).convert("L").point(lambda v: 255 if v > 200 else 0).filter(ImageFilter.GaussianBlur(2))
    img = Image.composite(Image.new("RGB", (W, H), "#f6f2e6"), img, wax.point(lambda v: v // 5))
    save(grain(img, 4), name)


def score_cards():
    W, H = 384, 160
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    for k, (n, c) in enumerate((("10", TEAL), ("9.5", CORAL), ("2", NAVY))):
        x0 = k * 128
        d.rectangle((x0 + 6, 6, x0 + 122, H - 6), fill=WHITE, outline=c, width=6)
        centred(d, (x0, 0, x0 + 128, H), n, F(96, "Black"), c)
    save(grain(img, 3), "score_cards")


JOBS = {
    "score_cards": score_cards,
    "roof_sign": roof_sign,
    "gate_sign": gate_sign,
    "chambers": lambda: [chamber(n) for n in range(1, 6)],
    "chamber_warn": chamber_warn,
    "led_plate": led_plate,
    "siren_warn": siren_warn,
    "lifeguard": lifeguard,
    "red_cross": red_cross,
    "flag_board": flag_board,
    "tube_hut": tube_hut,
    "tube_rules": tube_rules,
    "surf_shack": surf_shack,
    "shack_menu": shack_menu,
    "panels": lambda: [
        panel("water_care", "WATER CARE", "CHLORINE · pH · LOVE", TEAL),
        panel("eye_care", "EYE CARE", "FRESH WATER · RINSE · BLINK", "#3a8fd0"),
        panel("life_ring", "LIFE RING", "THROW, DON'T WAVE", RED),
        panel("fish_net", "FISH NET", "FOR FISH. NOT OCTOPUSES.", NAVY),
        panel("skimmer", "SKIMMER", "LEAVES · WRAPPERS · HATS", "#3d8a5a"),
        panel("waste", "WASTE", "FEED ME", "#6a6f75", W=512, H=256),
        panel("dog_treats", "DOG TREATS", "GOOD BOYS ONLY", "#8a5a33", W=512, H=256),
        panel("fuse", "DANGER", "HIGH VOLTAGE · WAVES", SUN, INK, W=512, H=320),
    ],
    "rules": rules,
    "surf_report": surf_report,
    "height_shark": height_shark,
    "spf": spf,
    "wipeouts": wipeouts,
    "lost_found": lost_found,
    "pump_house": pump_house,
    "tickets": tickets,
    "gauge": gauge,
    "medallions": lambda: [medallion("medallion_a", 1), medallion("medallion_b", 2)],
    "depth": lambda: [depth("depth_" + k, s) for k, s in (("0", "0 M"), ("05", "0.5 M"), ("1", "1 M"), ("15", "1.5 M"), ("2", "2 M"))],
    "no_diving": no_diving,
    "boards": lambda: [surfboard(*b) for b in BOARDS],
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for k, job in JOBS.items():
        if not only or k in only:
            job()
