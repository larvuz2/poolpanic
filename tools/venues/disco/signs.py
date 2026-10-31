"""The Aqua Disco's printed and painted surfaces, drawn with Pillow (any python3 with Pillow) into its work folder: the art-deco
crest over the stage, four retro posters of the club's nights, the juice bar's board and menu, the DJ's riser board, the rules, the
stations' panels, the zones' numbers. The drawing helpers are Splash Park's (tools/venues/splash/signs.py).

    python3 tools/venues/disco/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
S.OUT = os.path.join(os.environ.get("VENUE_WORK", "/tmp/disco-work"), "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter

INK, VIOLET, MAGENTA, CYAN, LIME, GOLD, CREAM = "#0d0818", "#2a1650", "#ff3fb4", "#34e6ff", "#9cff4f", "#ffd24a", "#f1e6d6"
F, P, centred, grain, save = S.F, S.P, S.centred, S.grain, S.save


def glow_text(img, xy, s, font, fill, glow, blur=14, anchor="mm"):
    """Text with a neon glow behind it."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text(xy, s, font=font, fill=glow, anchor=anchor)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.paste(layer, (0, 0), layer)
    img.paste(layer, (0, 0), layer)
    ImageDraw.Draw(img).text(xy, s, font=font, fill=fill, anchor=anchor)


def sunburst(d, cx, cy, r0, r1, n, colours, start=180, end=360):
    for k in range(n):
        a0 = math.radians(start + (end - start) * k / n)
        a1 = math.radians(start + (end - start) * (k + 0.5) / n)
        d.polygon([(cx + math.cos(a0) * r0, cy + math.sin(a0) * r0), (cx + math.cos(a0) * r1, cy + math.sin(a0) * r1), (cx + math.cos(a1) * r1, cy + math.sin(a1) * r1), (cx + math.cos(a1) * r0, cy + math.sin(a1) * r0)], fill=colours[k % len(colours)])


def crest():
    """The crest over the stage's backdrop: AQUA DISCO in deco capitals under a gold sunburst, waves and a mirror ball."""
    W, H = 2048, 1024
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    sunburst(d, W / 2, H * 0.62, 120, 620, 26, ["#3a2470", "#1a0f33"])
    for k, r in enumerate((300, 270)):
        d.arc((W / 2 - r, H * 0.62 - r, W / 2 + r, H * 0.62 + r), 180, 360, fill=GOLD, width=10 - k * 4)
    # the mirror ball at the burst's heart
    cx, cy, r = W / 2, H * 0.36, 110
    for j in range(-6, 7):
        for i in range(-6, 7):
            x, y = cx + i * 18, cy + j * 18
            if (x - cx) ** 2 + (y - cy) ** 2 < r * r:
                v = 140 + int(110 * random.Random(i * 31 + j).random())
                d.rectangle((x - 8, y - 8, x + 8, y + 8), fill=(v, v, min(255, v + 30)))
    glow_text(img, (W / 2, H * 0.72), "AQUA DISCO", F(260, "Black"), CREAM, MAGENTA, 18)
    glow_text(img, (W / 2, H * 0.88), "DANCE  ·  SPLASH  ·  REPEAT", F(84, "Bold"), CYAN, CYAN, 10)
    for k in range(3):
        y = H - 40 - k * 16
        d.line([(x, y + 6 * math.sin(x / 40 + k)) for x in range(0, W, 8)], fill=GOLD if k == 0 else "#3a2470", width=5)
    d.rectangle((0, 0, W - 1, H - 1), outline=GOLD, width=16)
    save(grain(img, 4), "aqua_disco_crest")


def poster(name, title, sub, date, bg, fg, accent, motif):
    """A retro night's poster: a coloured ground, a motif, the title in big capitals, the date line."""
    W, H = 512, 768
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    if motif == "burst":
        sunburst(d, W / 2, H * 0.42, 30, 400, 22, [accent, bg], 0, 360)
    elif motif == "rings":
        for k in range(8):
            r = 30 + k * 34
            d.ellipse((W / 2 - r, H * 0.38 - r, W / 2 + r, H * 0.38 + r), outline=accent if k % 2 else fg, width=8)
    elif motif == "waves":
        for k in range(10):
            y = 120 + k * 36
            d.line([(x, y + 14 * math.sin(x / 34 + k * 0.7)) for x in range(0, W + 8, 8)], fill=accent if k % 2 else fg, width=8)
    elif motif == "ball":
        cx, cy, r = W / 2, H * 0.36, 150
        for j in range(-10, 11):
            for i in range(-10, 11):
                x, y = cx + i * 16, cy + j * 16
                if (x - cx) ** 2 + (y - cy) ** 2 < r * r:
                    v = 120 + int(130 * random.Random(i * 13 + j * 7).random())
                    d.rectangle((x - 7, y - 7, x + 7, y + 7), fill=(v, v, min(255, v + 40)))
        for k in range(10):
            a = k * math.tau / 10
            d.line([(cx, cy), (cx + math.cos(a) * 260, cy + math.sin(a) * 260)], fill=accent, width=3)
    d.rectangle((0, H * 0.62, W, H), fill=bg)
    centred(d, (0, H * 0.63, W, H * 0.78), title, F(70, "Black"), fg)
    centred(d, (0, H * 0.78, W, H * 0.87), sub, F(42, "Bold"), accent)
    centred(d, (0, H * 0.88, W, H * 0.96), date, F(34, "Bold"), fg)
    d.rectangle((10, 10, W - 10, H - 10), outline=fg, width=6)
    save(S.sunfade(grain(img, 8), 0.1), name)


def juice_bar():
    W, H = 1024, 256
    img = Image.new("RGB", (W, H), INK)
    glow_text(img, (W / 2, H / 2), "Juice Bar", P(150), "#e8ffd6", LIME, 16)
    save(img, "juice_bar")


def juice_menu():
    W, H = 512, 768
    img = Image.new("RGB", (W, H), "#120a20")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), outline=GOLD, width=16)
    glow_text(img, (W / 2, 90), "Smoothies", P(80), "#ffe8f6", MAGENTA, 10)
    items = [("DISCO BERRY", "5"), ("MANGO GROOVE", "5"), ("BLUE LAGOON", "6"), ("KIWI KICK", "5"), ("NEON LIME", "4"), ("PINK FLAMINGO", "6")]
    for k, (n, p) in enumerate(items):
        y = 180 + k * 86
        d.text((50, y), n, font=F(50, "Bold"), fill="#f4f1ea")
        d.text((W - 50, y), p, font=F(54, "ExtraBold"), fill=GOLD, anchor="ra")
    save(grain(img, 6), "juice_menu")


def dj_board():
    W, H = 1024, 256
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    for k in range(36):
        x = 30 + k * 27
        h = 40 + 150 * abs(math.sin(k * 0.7)) * (0.6 + 0.4 * math.sin(k * 0.23))
        d.rectangle((x, H - 30 - h, x + 18, H - 30), fill=[MAGENTA, CYAN, GOLD][k % 3])
    glow_text(img, (W / 2, H / 2 - 10), "DJ  BOOTH", F(150, "Black"), CREAM, CYAN, 14)
    save(img, "dj_board")


def rules():
    W, H = 768, 1024
    img = Image.new("RGB", (W, H), "#160c2a")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 200), fill=MAGENTA)
    centred(d, (0, 0, W, 200), "DISCO RULES", F(140, "Black"), CREAM)
    lines = ["1  Shower before you dance", "2  No running on the floor", "3  Stay in your zone", "4  Follow Valentina", "5  No glass by the pool", "6  Listen to the coach", "7  Keep on dancing!"]
    for k, s in enumerate(lines):
        d.text((60, 260 + k * 100), s, font=F(64, "Bold"), fill=[CYAN, GOLD, LIME, MAGENTA][k % 4])
    save(grain(img, 6), "disco_rules")


def zone(n):
    W, H = 512, 256
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, W - 8, H - 8), 40, outline=GOLD, width=10)
    centred(d, (0, 0, W, H), f"ZONE {n}", F(150, "Black"), GOLD)
    save(img, f"zone_{n}")


JOBS = {
    "aqua_disco_crest": crest,
    "poster_fever": lambda: poster("poster_fever", "SPLASH FEVER", "AQUA AEROBICS ALL NIGHT", "FRIDAYS · 9 PM", "#2a0f3a", "#ffd24a", "#ff3fb4", "burst"),
    "poster_splash": lambda: poster("poster_splash", "DEEP END DISCO", "DJ MARCO SPINS", "SATURDAYS · 10 PM", "#0a2a4a", "#f1e6d6", "#34e6ff", "ball"),
    "poster_synchro": lambda: poster("poster_synchro", "SYNCHRO NIGHT", "WITH VALENTINA", "SUNDAYS · 8 PM", "#3a0a2a", "#ffe8f6", "#9cff4f", "rings"),
    "poster_deep": lambda: poster("poster_deep", "BOOGIE WAVES", "FOAM PARTY SPECIAL", "1 NOV · 9 PM", "#102030", "#9cff4f", "#ff8a3c", "waves"),
    "juice_bar": juice_bar,
    "juice_menu": juice_menu,
    "dj_board": dj_board,
    "disco_rules": rules,
    "water_care": lambda: S.panel("water_care", "WATER CARE", "CHLORINE · TESTING", GOLD, INK),
    "eye_care": lambda: S.panel("eye_care", "EYE CARE", "RINSE · DROPS · TOWELS", "#e8e0ff", VIOLET),
    **{f"zone_{n}": (lambda n=n: zone(n)) for n in (1, 2, 3, 4)},
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for n, job in JOBS.items():
        if not only or n in only:
            job()
