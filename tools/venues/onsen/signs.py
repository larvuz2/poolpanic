"""The Mountain Hot Springs' painted and printed surfaces, drawn with Pillow into its work folder: the bathhouse's plaque (温泉), the
hot spring rules (the monkeys are not guests), the monkey warning, SLIPPERY! VERY., the springs' wooden plaques with their
temperatures, the stations' boards (MINERALS, EYE CARE, LIFE RING, FISH NET, SKIMMER, WASTE, DOG TREATS), the drinks machine's
front (hot corn soup, banana milk), a signpost's arrows and the bath-salt sacks. Brush-painted on wood mostly; the kanji are drawn
with WenQuanYi Zen Hei (the system's), the rest with the bundled Barlow. The helpers are Splash Park's (tools/venues/splash/signs.py).

    python3 tools/venues/onsen/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
S.OUT = os.path.join(os.environ.get("VENUE_WORK", "/tmp/onsen-work"), "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter, ImageFont

F, centred, grain, save = S.F, S.centred, S.grain, S.save
INK, WOOD, WOOD_DARK, PAPER, RED, INDIGO, SNOW, YELLOW = "#1c1612", "#c9a374", "#6b4a32", "#f3e6c8", "#b8352c", "#2c3c78", "#eef3fa", "#f2c230"
KANJI_FONT = next(
    (p for p in ("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc") if os.path.exists(p)),
    None,
)


def K(size):
    return ImageFont.truetype(KANJI_FONT, size) if KANJI_FONT else F(size, "Black")


def wood(W, H, base=WOOD, seed=1):
    """A board of wood: grain along it, darker edges, a little weathering."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H), base)
    d = ImageDraw.Draw(img)
    r, g_, b = S.rgb(base)
    for y in range(0, H, 3):
        k = 0.88 + 0.12 * math.sin(y * 0.09 + rnd.random()) + rnd.uniform(-0.04, 0.04)
        d.line([(0, y), (W, y + rnd.randint(-3, 3))], fill=(int(r * k), int(g_ * k), int(b * k)), width=3)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    edge = Image.new("L", (W, H), 0)
    ImageDraw.Draw(edge).rectangle((0, 0, W, H), outline=255, width=max(6, W // 60))
    edge = edge.filter(ImageFilter.GaussianBlur(W / 50))
    return Image.composite(Image.new("RGB", (W, H), WOOD_DARK), img, edge.point(lambda v: v * 0.6))


def bath_plaque():
    """The plaque over the bathhouse door: 温泉 in big brush strokes, MOUNTAIN HOT SPRINGS under it, a red seal."""
    W, H = 1024, 384
    img = wood(W, H, "#4a3426", 3)
    d = ImageDraw.Draw(img)
    d.rectangle((18, 18, W - 18, H - 18), outline="#c9a24a", width=8)
    centred(d, (0, 20, W, 270), "温泉", K(230), "#f3e6c8")
    centred(d, (0, 270, W, 360), "MOUNTAIN HOT SPRINGS", F(66, "Black"), "#c9a24a")
    d.rectangle((W - 140, 60, W - 60, 140), fill=RED)
    centred(d, (W - 140, 60, W - 60, 140), "湯", K(60), "#f3e6c8")
    save(grain(img, 6), "bath_plaque")


def rules():
    W, H = 768, 1024
    img = wood(W, H, WOOD, 5)
    d = ImageDraw.Draw(img)
    d.rectangle((24, 24, W - 24, H - 24), outline=WOOD_DARK, width=10)
    centred(d, (0, 40, W, 150), "HOT SPRING RULES", F(92, "Black"), INK)
    centred(d, (0, 150, W, 230), "温泉のルール", K(64), RED)
    rows = [
        "1. WASH BEFORE YOU SOAK",
        "2. NO SWIMMING. (YES, REALLY.)",
        "3. NO RUNNING. IT'S ICE.",
        "4. TOWELS STAY OUT OF THE WATER",
        "5. DO NOT FEED THE MONKEYS",
        "6. THE MONKEYS ARE NOT GUESTS",
        "   (THEY DISAGREE)",
    ]
    for k, row in enumerate(rows):
        d.text((60, 270 + k * 100), row, font=F(54, "Bold"), fill=INK if k != 6 else "#6b4a32")
    save(grain(img, 6), "rules")


def monkey_warning():
    """A yellow triangle with a snow monkey's red face and a towel on its head: CAUTION · MONKEYS · THEY WILL TAKE YOUR SEAT."""
    W, H = 768, 768
    img = Image.new("RGB", (W, H), "#f4f1e8")
    d = ImageDraw.Draw(img)
    d.polygon([(W / 2, 40), (W - 50, 520), (50, 520)], fill=YELLOW, outline=INK)
    d.line([(W / 2, 40), (W - 50, 520), (50, 520), (W / 2, 40)], fill=INK, width=22, joint="curve")
    cx, cy = W / 2, 360
    d.ellipse((cx - 120, cy - 110, cx + 120, cy + 110), fill="#9a8a7a")  # the fur
    d.ellipse((cx - 78, cy - 60, cx + 78, cy + 84), fill="#d8505a")  # the red face
    for ex in (cx - 32, cx + 32):
        d.ellipse((ex - 14, cy - 18, ex + 14, cy + 10), fill=INK)
    d.arc((cx - 30, cy + 20, cx + 30, cy + 60), 200, 340, fill=INK, width=6)
    d.rectangle((cx - 100, cy - 150, cx + 100, cy - 100), fill="#ffffff", outline=INK, width=5)  # the towel on its head
    centred(d, (0, 540, W, 640), "CAUTION: MONKEYS", F(84, "Black"), INK)
    centred(d, (0, 640, W, 730), "THEY WILL TAKE YOUR SEAT", F(50, "Bold"), RED)
    save(grain(img, 5), "monkey_warning")


def slippery():
    W, H = 512, 640
    img = Image.new("RGB", (W, H), "#f4f1e8")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((16, 16, W - 16, H - 16), 30, outline=RED, width=14)
    # a stick figure flying off its feet
    cx, cy = W / 2, 250
    d.ellipse((cx + 40, cy - 150, cx + 100, cy - 90), fill=INK)
    d.line([(cx + 60, cy - 90), (cx - 40, cy)], fill=INK, width=18)
    d.line([(cx + 30, cy - 60), (cx + 140, cy - 110)], fill=INK, width=14)
    d.line([(cx + 10, cy - 40), (cx - 90, cy - 90)], fill=INK, width=14)
    d.line([(cx - 40, cy), (cx - 150, cy - 40)], fill=INK, width=16)
    d.line([(cx - 40, cy), (cx + 40, cy + 60)], fill=INK, width=16)
    d.line([(50, 360), (W - 50, 360)], fill="#7fb0d8", width=12)
    for x in (120, 250, 380):
        d.line([(x, 330), (x + 30, 300)], fill="#7fb0d8", width=6)
    centred(d, (0, 400, W, 510), "SLIPPERY!", F(110, "Black"), RED)
    centred(d, (0, 510, W, 600), "VERY.", F(80, "Black"), INK)
    save(grain(img, 4), "slippery")


def spring_plaque(k, temp, hot=False):
    W, H = 384, 512
    img = wood(W, H, WOOD, 20 + k)
    d = ImageDraw.Draw(img)
    centred(d, (0, 20, W, 230), str(k), F(220, "Black"), INK)
    centred(d, (0, 230, W, 330), "SPRING", F(70, "Black"), INK)
    centred(d, (0, 330, W, 440), f"{temp}°C", F(96, "Black"), RED if hot else WOOD_DARK)
    if hot:
        centred(d, (0, 430, W, 500), "HOT HOT HOT", F(48, "Black"), RED)
    save(grain(img, 6), f"spring_{k}")


def board(name, title, sub, kanji=None, bg=WOOD, seed=7):
    """A station's wooden board: the title brushed big, a line under it, its kanji in a red seal."""
    W, H = 768, 384
    img = wood(W, H, bg, seed)
    d = ImageDraw.Draw(img)
    d.rectangle((14, 14, W - 14, H - 14), outline=WOOD_DARK, width=8)
    centred(d, (0, 30, W - (150 if kanji else 0), 230), title, F(140, "Black"), INK)
    centred(d, (0, 240, W - (150 if kanji else 0), 340), sub, F(56, "Bold"), WOOD_DARK)
    if kanji:
        d.rectangle((W - 160, 90, W - 40, 290), fill=RED)
        centred(d, (W - 160, 90, W - 40, 290), kanji, K(100), PAPER)
    save(grain(img, 5), name)


def vending():
    """The drinks machine's front: a lit window of cans and bottles in rows, red HOT and blue COLD tags, buttons, the slot."""
    W, H = 512, 1024
    img = Image.new("RGB", (W, H), "#e8edf2")
    d = ImageDraw.Draw(img)
    d.rectangle((24, 24, W - 24, 140), fill="#d8483a")
    centred(d, (24, 24, W - 24, 100), "あったか〜い", K(56), "#ffffff")
    centred(d, (24, 92, W - 24, 140), "HOT & COLD DRINKS", F(36, "Black"), "#ffffff")
    d.rectangle((36, 160, W - 36, 660), fill="#f8fbff", outline="#9aa6b2", width=6)
    rnd = random.Random(4)
    drinks = [("CORN", "#f2c230"), ("MILK", "#ffffff"), ("TEA", "#7a8a3a"), ("SOUP", "#e08a3a"), ("MELON", "#7ccf6a"), ("BANANA", "#f4dc6a"), ("COCOA", "#6a4a32"), ("YUZU", "#f2d43a")]
    for row in range(4):
        y = 190 + row * 118
        for col in range(5):
            x = 60 + col * 82
            name, c = drinks[(row * 5 + col) % len(drinks)]
            d.rounded_rectangle((x, y, x + 52, y + 80), 10, fill=c, outline="#4a4a4a", width=2)
            d.rectangle((x + 6, y + 28, x + 46, y + 50), fill="#ffffff")
            hot = row < 2
            d.rectangle((x - 2, y + 86, x + 56, y + 104), fill="#d8483a" if hot else "#3a6ad8")
            centred(d, (x - 2, y + 86, x + 56, y + 104), "HOT" if hot else "COLD", F(18, "Black"), "#ffffff")
    d.rectangle((W - 150, 700, W - 50, 820), fill="#2b2d31")
    d.rectangle((W - 130, 720, W - 70, 740), fill="#c9a24a")
    d.rectangle((60, 860, W - 60, 950), fill="#1c1c1e")
    centred(d, (60, 860, W - 60, 950), "PUSH", F(40, "Bold"), "#9aa6b2")
    save(grain(img, 3), "vending")


def signpost():
    """Three arrows on a post: 湯 BATHHOUSE, SPRINGS, MONKEYS (DON'T)."""
    W, H = 768, 512
    img = wood(W, H, WOOD, 31)
    d = ImageDraw.Draw(img)
    for k, (t, c, left) in enumerate((("湯 BATHHOUSE", INK, True), ("SPRINGS", INK, False), ("MONKEYS (DON'T)", RED, False))):
        y = 40 + k * 160
        d.rectangle((20, y, W - 20, y + 130), outline=WOOD_DARK, width=6)
        f = K(76) if "湯" in t else F(84, "Black")
        centred(d, (90 if left else 20, y, W - 20 if left else W - 90, y + 130), t, f, c)
        tip, back = (40, 110) if left else (W - 40, W - 110)  # the arrow's head, painted
        d.polygon([(tip, y + 65), (back, y + 25), (back, y + 105)], fill=c)
    save(grain(img, 5), "signpost")


def salt_sack():
    W, H = 384, 512
    img = Image.new("RGB", (W, H), "#e6dcc6")
    d = ImageDraw.Draw(img)
    for y in range(0, H, 6):
        d.line([(0, y), (W, y)], fill="#d8cdb4", width=1)
    centred(d, (0, 80, W, 250), "湯の花", K(110), INDIGO)
    centred(d, (0, 260, W, 340), "BATH SALTS", F(64, "Black"), INDIGO)
    centred(d, (0, 340, W, 400), "EXTRA MINERALLY", F(40, "Bold"), RED)
    save(grain(img, 6), "salt_sack")


JOBS = {
    "bath_plaque": bath_plaque,
    "rules": rules,
    "monkey_warning": monkey_warning,
    "slippery": slippery,
    "spring_1": lambda: spring_plaque(1, 41),
    "spring_2": lambda: spring_plaque(2, 42),
    "spring_3": lambda: spring_plaque(3, 43),
    "spring_4": lambda: spring_plaque(4, 46, hot=True),
    "minerals": lambda: board("minerals", "MINERALS", "SPRING CARE · SALTS", "塩"),
    "eye_care": lambda: board("eye_care", "EYE CARE", "RINSE · DROPS · TOWELS", "目"),
    "life_ring": lambda: board("life_ring", "LIFE RING", "THROW · DON'T PANIC", None, "#d8483a", 9),
    "fish_net": lambda: board("fish_net", "FISH NET", "FOR FISH. NOT MONKEYS.", None, WOOD, 11),
    "skimmer": lambda: board("skimmer", "SKIMMER", "LEAVES · SNOW · ETC.", None, WOOD, 12),
    "waste": lambda: board("waste", "WASTE", "ゴミ · RUBBISH", None, WOOD, 13),
    "treats": lambda: board("treats", "DOG TREATS", "NOT FOR MONKEYS", None, WOOD, 14),
    "vending": vending,
    "signpost": signpost,
    "salt_sack": salt_sack,
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for name, job in JOBS.items():
        if not only or name in only:
            job()
