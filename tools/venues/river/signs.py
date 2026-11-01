"""The Lazy River's painted and carved surfaces, drawn with Pillow into its work folder (the explorer's map, the travel poster and
the Lazy Idol are fal's, made ready by painted.py): signs painted on old hardwood (the boards cut from the planks' own photograph),
a carved stone lintel, a chalk menu, crate stencils. LAZY RIVER over the jungle gate; ALL ABOARD! and EXIT on the docks' arches,
TUBE RETURN, TUBES (lazy or rapids?); the Coconut Shack and its menu (Temple Fries); TEMPLE RAPIDS carved over the river's way
out; SHHH! IDOL SLEEPING, NO SPLASHING THE IDOL, BEWARE OF THE CROCODILE (he is a log); a signpost's arrows; the river's rules (5. No
racing. This means you, Marco.); MISSING: ONE TUBE (reward: one coconut); the depth plates; EXPEDITION 1931 on the crates; and the
stations' boards (WATER CARE, EYE CARE, LIFE RING, FISH NET, SKIMMER, LITTER, DANGER). The helpers are Splash Park's
(tools/venues/splash/signs.py).

    python3 tools/venues/river/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
WORK = os.environ.get("VENUE_WORK", "/tmp/river-work")
GEN = os.environ.get("RIVER_GEN", os.path.join(WORK, "gen"))
S.OUT = os.path.join(WORK, "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

F, P, centred, grain, save, sunfade = S.F, S.P, S.centred, S.grain, S.save, S.sunfade
YELLOW, CREAM, INK, RED, GREEN, JUNGLE, ORANGE, TEAL = (
    "#ffd23f",
    "#f6e6c0",
    "#1b1712",
    "#c8372d",
    "#2f6b3c",
    "#1f4a2c",
    "#f07a2a",
    "#1f9aa0",
)
_PLANKS = None


def fit(d, box, s, font_fn, size, fill, stroke=0, stroke_fill=None, min_size=14):
    x0, y0, x1, y1 = box
    while size > min_size:
        f = font_fn(size)
        l, t, r, b = d.textbbox((0, 0), s, font=f, stroke_width=stroke)
        if r - l <= (x1 - x0) and b - t <= (y1 - y0) * 1.05:
            break
        size -= 3
    centred(d, box, s, font_fn(size), fill, stroke, stroke_fill)


def planks():
    global _PLANKS
    if _PLANKS is None:
        _PLANKS = Image.open(os.path.join(GEN, "planks.png")).convert("RGB")
    return _PLANKS


def wood(W, H, seed=0, dark=0.8, rot=True):
    """A board cut from the planks' photograph (turned so the grain runs along it), a little darker, its edge burnt."""
    src = planks()
    r = random.Random(seed)
    if rot:
        src = src.rotate(90, expand=True)
    k = max(W / src.width, H / src.height) * 1.0
    big = src.resize((max(W, int(src.width * k * 1.6)), max(H, int(src.height * k * 1.6))))
    x, y = r.randrange(0, big.width - W + 1), r.randrange(0, big.height - H + 1)
    img = ImageEnhance.Brightness(big.crop((x, y, x + W, y + H))).enhance(dark)
    d = ImageDraw.Draw(img)
    for i in range(10):
        d.rectangle((i, i, W - 1 - i, H - 1 - i), outline=(40 + i * 6, 26 + i * 4, 14 + i * 2))
    for cx, cy in ((26, 26), (W - 26, 26), (26, H - 26), (W - 26, H - 26)):
        d.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill="#2a241c")
        d.ellipse((cx - 4, cy - 6, cx + 2, cy - 1), fill="#6a6258")
    return img, d


def painted(name, title, sub=None, W=768, H=320, fg=YELLOW, sub_fg=CREAM, seed=1, title_frac=0.62):
    img, d = wood(W, H, seed)
    top = int(H * (title_frac if sub else 0.92))
    fit(d, (46, 26, W - 46, top), title, lambda s: F(s, "Black"), 160, fg, 6, INK)
    if sub:
        fit(d, (56, top, W - 56, H - 30), sub, lambda s: F(s, "Bold"), 60, sub_fg, 3, INK)
    save(sunfade(grain(img, 6), 0.1), name)


def stone(name, title, W=1536, H=256, seed=3):
    """Letters cut into a grey-green stone lintel (from the temple stone's photograph): dark in the cut, light on its lip."""
    src = Image.open(os.path.join(GEN, "templestone.png")).convert("RGB")
    r = random.Random(seed)
    k = W / src.width * 1.4
    big = src.resize((int(src.width * k), int(src.height * k)))
    x, y = r.randrange(0, big.width - W), r.randrange(0, big.height - H)
    img = ImageEnhance.Brightness(big.crop((x, y, x + W, y + H))).enhance(1.05)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    fit(md, (60, 30, W - 60, H - 30), title, lambda s: F(s, "Black"), 200, 255)
    lip = mask.filter(ImageFilter.MaxFilter(5))
    img.paste((214, 210, 190), (0, 0), Image.eval(lip, lambda v: int(v * 0.55)))
    shade = Image.new("RGB", (W, H), (34, 36, 28))
    img.paste(shade, (3, 4), mask)
    save(grain(img, 4), name)


def menu():
    W, H = 640, 896
    img, d = wood(W, H, 7, 0.75)
    d.rectangle((40, 40, W - 40, H - 40), fill="#24302a")
    fit(d, (60, 56, W - 60, 170), "COCONUT SHACK", lambda s: F(s, "Black"), 90, YELLOW)
    rows = [
        ("Mango smoothie", "2"),
        ("Fresh coconut", "1"),
        ("Banana split", "3"),
        ("Pineapple on a stick", "1"),
        ("Temple Fries", "2"),
        ("Idol Iced Tea", "1"),
        ("Snake-shaped jelly", "1"),
    ]
    for k, (s, p) in enumerate(rows):
        y = 200 + k * 82
        d.text((76, y), s, font=F(46, "Bold"), fill=CREAM)
        d.text((W - 120, y), p, font=F(52, "Black"), fill=YELLOW)
        d.line([(76, y + 70), (W - 76, y + 70)], fill="#3b4a40", width=2)
    fit(d, (60, H - 120, W - 60, H - 56), "prices in coconuts", lambda s: F(s, "Bold"), 40, "#c9d6c2")
    save(grain(img, 6), "menu")


def rules():
    W, H = 640, 832
    img, d = wood(W, H, 9, 0.85)
    fit(d, (50, 40, W - 50, 160), "RIVER RULES", lambda s: F(s, "Black"), 100, YELLOW, 5, INK)
    lines = [
        "1  Sit in the tube.",
        "2  Lie back.",
        "3  Do nothing.",
        "4  Repeat.",
        "5  No racing.",
        "   (This means you, Marco.)",
        "6  Do not wake the Idol.",
    ]
    for k, s in enumerate(lines):
        d.text((70, 200 + k * 86), s, font=F(50, "Bold"), fill=CREAM, stroke_width=2, stroke_fill=INK)
    save(sunfade(grain(img, 6), 0.12), "rules")


def missing():
    W, H = 512, 704
    img = Image.new("RGB", (W, H), "#efe2bf")
    d = ImageDraw.Draw(img)
    d.rectangle((14, 14, W - 14, H - 14), outline="#7a5a2a", width=4)
    fit(d, (40, 40, W - 40, 150), "MISSING", lambda s: F(s, "Black"), 120, RED)
    fit(d, (40, 150, W - 40, 210), "ONE TUBE", lambda s: F(s, "Black"), 60, INK)
    # the tube, drawn
    cx, cy = W // 2, 360
    for k, c in enumerate(("#ff7a3a", "#ffd23f", "#ff7a3a", "#ffd23f")):
        d.pieslice((cx - 120, cy - 120, cx + 120, cy + 120), k * 90, k * 90 + 90, fill=c)
    d.ellipse((cx - 55, cy - 55, cx + 55, cy + 55), fill="#efe2bf")
    d.ellipse((cx - 120, cy - 120, cx + 120, cy + 120), outline=INK, width=4)
    d.ellipse((cx - 55, cy - 55, cx + 55, cy + 55), outline=INK, width=4)
    fit(d, (40, 500, W - 40, 560), "LAST SEEN ON THE RAPIDS", lambda s: F(s, "Bold"), 40, INK)
    fit(d, (40, 570, W - 40, 650), "REWARD: ONE COCONUT", lambda s: F(s, "Black"), 50, GREEN)
    save(sunfade(grain(img, 10), 0.18), "missing")


def arrow(name, s, point, W=768, H=192, seed=11):
    """A signpost's board cut to an arrow, its letters painted (a cut-out: the board's shape)."""
    img, d = wood(W, H, seed, 0.85)
    fit(d, (90 if point < 0 else 40, 26, W - (40 if point < 0 else 90), H - 26), s, lambda z: F(z, "Black"), 110, YELLOW, 4, INK)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    if point > 0:
        md.polygon([(0, 0), (W - H // 2, 0), (W, H // 2), (W - H // 2, H), (0, H)], fill=255)
    else:
        md.polygon([(W, 0), (H // 2, 0), (0, H // 2), (H // 2, H), (W, H)], fill=255)
    img = grain(img, 6).convert("RGBA")
    img.putalpha(mask)
    tex = os.path.join(WORK, "textures")
    os.makedirs(tex, exist_ok=True)
    img.save(os.path.join(tex, name + "_alpha.png"))
    print("CUT", name)


def crate(name, s, W=512, H=384, seed=13):
    img, d = wood(W, H, seed, 0.95, rot=False)
    fit(d, (40, 90, W - 40, 230), s, lambda z: F(z, "Black"), 90, "#2a2219")
    fit(d, (40, 240, W - 40, 310), "EXPEDITION 1931", lambda z: F(z, "Bold"), 40, "#2a2219")
    save(sunfade(grain(img, 8), 0.15), name)


def depth():
    W, H = 384, 160
    img, d = wood(W, H, 17, 0.9)
    fit(d, (24, 16, W - 24, 104), "0.9 M", lambda s: F(s, "Black"), 90, CREAM, 3, INK)
    fit(d, (24, 100, W - 24, 146), "NO DIVING", lambda s: F(s, "Bold"), 36, YELLOW, 2, INK)
    save(grain(img, 4), "depth")


def jobs():
    return {
        "sign_main": lambda: painted("sign_main", "LAZY RIVER", "THE LOST TEMPLE · EST. 1931", 1024, 320, seed=2),
        "all_aboard": lambda: painted("all_aboard", "ALL ABOARD!", "ONE BOTTOM PER TUBE", seed=3),
        "exit": lambda: painted("exit", "EXIT", "TUBES TO THE RETURN, PLEASE", fg=CREAM, sub_fg=YELLOW, seed=4),
        "tube_return": lambda: painted("tube_return", "TUBE RETURN", "DROP IT HERE", seed=5),
        "tubes": lambda: painted("tubes", "TUBES", "LAZY OR RAPIDS?", seed=6),
        "snacks": lambda: painted("snacks", "COCONUT SHACK", "SNACKS · SMOOTHIES · SHADE", 1024, 320, seed=7),
        "menu": menu,
        "temple": lambda: stone("temple", "TEMPLE RAPIDS"),
        "shhh": lambda: painted("shhh", "SHHH!", "IDOL SLEEPING", 640, 320, fg=CREAM, sub_fg=YELLOW, seed=8),
        "no_splash": lambda: painted("no_splash", "NO SPLASHING", "THE IDOL", 640, 320, seed=9),
        "croc": lambda: painted("croc", "BEWARE OF THE CROCODILE", "(he is a log)", 768, 320, fg=RED, seed=10, title_frac=0.6),
        "rules": rules,
        "missing": missing,
        "arrow_temple": lambda: arrow("arrow_temple", "TEMPLE", 1, seed=21),
        "arrow_cave": lambda: arrow("arrow_cave", "CAVE FALLS", -1, seed=22),
        "arrow_snacks": lambda: arrow("arrow_snacks", "SNACKS", -1, seed=23),
        "arrow_out": lambda: arrow("arrow_out", "WAY OUT?", 1, seed=24),
        "crate_bananas": lambda: crate("crate_bananas", "BANANAS", seed=31),
        "crate_idol": lambda: crate("crate_idol", "IDOL POLISH", seed=32),
        "crate_tubes": lambda: crate("crate_tubes", "SPARE TUBES", seed=33),
        "depth": depth,
        "water_care": lambda: painted("water_care", "WATER CARE", "CHLORINE · pH · PATIENCE", seed=41),
        "eye_care": lambda: painted("eye_care", "EYE CARE", "RINSE · BLINK · LOOK AGAIN", seed=42),
        "life_ring": lambda: painted("life_ring", "LIFE RING", "THROW, DON'T BOWL", fg=CREAM, sub_fg=YELLOW, seed=43),
        "fish_net": lambda: painted("fish_net", "FISH NET", "FOR FISH. NOT CROCODILES.", seed=44),
        "skimmer": lambda: painted("skimmer", "SKIMMER", "LEAVES · PETALS · BANANA PEEL", seed=45),
        "litter": lambda: painted("litter", "LITTER", "FEED THE IDOL'S BIN", 512, 256, seed=46),
        "danger": lambda: painted("danger", "DANGER", "ELECTRICITY · NO MONKEYING", 512, 320, fg=RED, sub_fg=CREAM, seed=47),
    }


if __name__ == "__main__":
    only = sys.argv[1:]
    for name, job in jobs().items():
        if not only or name in only:
            job()
