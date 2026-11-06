"""The Cruise Ship's printed and painted surfaces, drawn with Pillow into its work folder (the travel poster, Captain Barnacle's
portrait, the deck plan, the kraken, the photo board, the towel animals and the seagulls are fal's, made ready by painted.py):
enamel signs on steel in the ship's navy, white and signal red with brass rims, deco lettering. PANIC OF THE SEAS on the
superstructure; THE LIDO BAR and its menu (the Kraken Colada); TODAY ON BOARD (15:30 BELLY FLOP CHAMPIONSHIP); the pool's rules (6. No
cannonballs. This means you, Carl.); MUSTER STATION B; the stairway lobbies' signs; HOT TUB (no seagulls); LOST & FOUND; SEAGULL
CROSSING; WET DECK; the shuffleboard's CAPTAIN'S CUP and the belly flop judges' scorecards; the lifeboats' and the life jacket boxes'
stencils; the depth plates; the ship's bell's plaque; the stations' boards (WATER CARE, EYE CARE, FIN RENTAL, LIFE RING, FISH NET,
POOL SKIMMER, WASTE, FIRST AID, DANGER). The helpers are Splash Park's (tools/venues/splash/signs.py).

    python3 tools/venues/cruise/signs.py [name ...]
"""

import os, sys, math, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("splash_signs", os.path.join(HERE, "..", "splash", "signs.py"))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
WORK = os.environ.get("VENUE_WORK", "/tmp/cruise-work")
S.OUT = os.path.join(WORK, "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "common"))
from carl_art import paste_carl  # (Cannonball Carl where a stick figure used to be: common/carl_art.py)

F, P, centred, grain, save, sunfade = S.F, S.P, S.centred, S.grain, S.save, S.sunfade
NAVY, NAVY_D, WHITE, CREAM, RED, BRASS, INK, GREEN, YELLOW, TEAL = (
    "#1d3557",
    "#13233b",
    "#f6f4ee",
    "#f3e8cf",
    "#c8202e",
    "#c9a24a",
    "#17181a",
    "#1f8a4c",
    "#ffd23f",
    "#1f9aa0",
)


def fit(d, box, s, font_fn, size, fill, stroke=0, stroke_fill=None, min_size=12):
    x0, y0, x1, y1 = box
    while size > min_size:
        f = font_fn(size)
        l, t, r, b = d.textbbox((0, 0), s, font=f, stroke_width=stroke)
        if r - l <= (x1 - x0) and b - t <= (y1 - y0) * 1.05:
            break
        size -= 2
    centred(d, box, s, font_fn(size), fill, stroke, stroke_fill)


def left(d, xy, s, font, fill):
    d.text(xy, s, font=font, fill=fill)


def enamel(W, H, bg=NAVY, rim=BRASS, radius=28, seed=0):
    """A vitreous enamel sign on steel: a brass rim, a hairline inner rule, four rivets, a few chips at the edge, a little fade."""
    img = Image.new("RGB", (W, H), rim)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((10, 10, W - 11, H - 11), radius, fill=bg)
    d.rounded_rectangle((22, 22, W - 23, H - 23), max(4, radius - 10), outline=WHITE if bg != WHITE else NAVY, width=3)
    for cx, cy in ((34, 34), (W - 34, 34), (34, H - 34), (W - 34, H - 34)):
        d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill="#8a7a52")
        d.ellipse((cx - 4, cy - 5, cx + 1, cy), fill="#e6d7a8")
    r = random.Random(seed)
    for _ in range(5):
        x = r.choice([r.randrange(12, W - 12), r.choice([14, W - 14])])
        y = r.choice([r.choice([14, H - 14]), r.randrange(12, H - 12)])
        d.ellipse((x - 5, y - 4, x + 6, y + 5), fill="#2b2b2b")
    return img, d


def board(name, title, sub=None, W=768, H=320, bg=NAVY, fg=WHITE, sub_fg=YELLOW, seed=1, title_frac=0.6, script=False):
    img, d = enamel(W, H, bg, seed=seed)
    top = int(H * (title_frac if sub else 0.9))
    fnt = (lambda s: P(s)) if script else (lambda s: F(s, "Black"))
    fit(d, (50, 34, W - 50, top), title, fnt, 170, fg)
    if sub:
        fit(d, (60, top, W - 60, H - 40), sub, lambda s: F(s, "Bold"), 70, sub_fg)
    save(sunfade(grain(img, 5), 0.12), name)


def ship_name():
    """PANIC OF THE SEAS, the ship's name across the top tier: navy deco capitals spaced wide on white, a red rule under it."""
    W, H = 2048, 256
    img = Image.new("RGB", (W, H), "#f2f3f0")
    d = ImageDraw.Draw(img)
    s = "P A N I C   O F   T H E   S E A S"
    fit(d, (40, 18, W - 40, H - 56), s, lambda z: F(z, "Black"), 220, NAVY)
    d.rectangle((300, H - 44, W - 300, H - 32), fill=RED)
    save(img, "ship_name")


def lido_bar():
    """THE LIDO BAR: gold deco script on navy, a cocktail glass each side."""
    img, d = enamel(1024, 300, NAVY_D, seed=4)
    fit(d, (130, 40, 894, 200), "The Lido Bar", lambda s: P(s), 150, "#f1c85a")
    fit(d, (130, 196, 894, 262), "COCKTAILS · MOCKTAILS · REGRETS", lambda s: F(s, "Bold"), 56, CREAM)
    for cx in (80, 944):
        d.polygon([(cx - 36, 110), (cx + 36, 110), (cx, 160)], fill="#f1c85a")
        d.rectangle((cx - 3, 160, cx + 3, 205), fill="#f1c85a")
        d.rectangle((cx - 22, 205, cx + 22, 212), fill="#f1c85a")
        d.ellipse((cx + 14, 92, cx + 34, 112), fill="#9bd34a")
    save(sunfade(grain(img, 4), 0.08), "lido_bar")


def bar_menu():
    img, d = enamel(640, 900, CREAM, rim=BRASS, seed=5)
    fit(d, (60, 50, 580, 150), "TODAY'S COCKTAILS", lambda s: F(s, "Black"), 80, NAVY)
    d.rectangle((90, 156, 550, 161), fill=RED)
    rows = [
        ("The Kraken Colada", "8"),
        ("Seasick Sangria", "7"),
        ("Mai Tai Typhoon", "9"),
        ("Iceberg Mojito", "8"),
        ("Captain's Grog", "6"),
        ("Man Overboard", "5"),
        ("Belly Flop Fizz", "7"),
        ("Lifeboat Lemonade", "4"),
    ]
    f, g = F(46, "Bold"), F(40, "SemiBold")
    for k, (a, b) in enumerate(rows):
        y = 190 + k * 76
        left(d, (70, y), a, f, NAVY)
        left(d, (540, y + 4), b, f, RED)
        d.line((70, y + 60, 570, y + 60), fill="#d9ccb0", width=2)
    fit(d, (60, 800, 580, 850), "Mocktails for the coach. Always.", lambda s: F(s, "SemiBold"), 38, "#7a6a4a")
    save(sunfade(grain(img, 4), 0.1), "bar_menu")


def programme():
    """TODAY ON BOARD: the day's programme on a white board with a navy header."""
    W, H = 720, 1000
    img, d = enamel(W, H, WHITE, rim=BRASS, seed=6)
    d.rounded_rectangle((26, 26, W - 27, 190), 14, fill=NAVY)
    fit(d, (50, 40, W - 50, 130), "TODAY ON BOARD", lambda s: F(s, "Black"), 90, WHITE)
    fit(d, (50, 128, W - 50, 180), "LIDO DECK 14 · AT SEA", lambda s: F(s, "Bold"), 44, YELLOW)
    rows = [
        ("08:00", "Sunrise Yoga (mind the swell)"),
        ("10:00", "Towel Animal Masterclass"),
        ("12:00", "Unveiling of the Shrimp Tower"),
        ("14:00", "Bingo with Captain Barnacle"),
        ("15:30", "BELLY FLOP CHAMPIONSHIP"),
        ("17:00", "Spot the Kraken (prizes)"),
        ("19:00", "Lifeboat Drill (sorry)"),
        ("21:00", "Sail-Away Disco"),
    ]
    for k, (t, s) in enumerate(rows):
        y = 220 + k * 92
        big = "BELLY" in s
        d.text((60, y), t, font=F(48, "Black"), fill=RED if big else NAVY)
        fit(d, (190, y, W - 50, y + 58), s, lambda z: F(z, "Black" if big else "Bold"), 48, RED if big else INK)
        d.line((60, y + 72, W - 60, y + 72), fill="#d4dbe2", width=2)
    save(sunfade(grain(img, 3), 0.08), "programme")


def rules():
    W, H = 640, 860
    img, d = enamel(W, H, WHITE, rim=BRASS, seed=7)
    d.rounded_rectangle((26, 26, W - 27, 150), 14, fill=RED)
    fit(d, (50, 40, W - 50, 140), "LIDO POOL RULES", lambda s: F(s, "Black"), 84, WHITE)
    rows = [
        "1. No diving. The ocean is that way.",
        "2. No running. The ship rolls for you.",
        "3. Hold on in a swell.",
        "4. Do not feed the seagulls.",
        "   They have a union.",
        "5. A towel reserves nothing.",
        "6. No cannonballs.",
        "   This means you, Carl.",
    ]
    for k, s in enumerate(rows):
        fit(d, (56, 178 + k * 80, W - 50, 236 + k * 80), s, lambda z: F(z, "Bold"), 44, NAVY)
    save(sunfade(grain(img, 3), 0.1), "rules")


def muster():
    """MUSTER STATION B: the green safety sign with its figures and arrow."""
    img = Image.new("RGB", (768, 384), GREEN)
    d = ImageDraw.Draw(img)
    d.rectangle((8, 8, 759, 375), outline=WHITE, width=8)
    # Carl in a life jacket too small for him, on a white disc (6 November 2026: once four little figures under a roof)
    d.ellipse((46, 26, 334, 358), fill=WHITE)
    paste_carl(img, "lifejacket", (66, 40, 314, 348))
    fit(d, (340, 60, 740, 220), "MUSTER", lambda s: F(s, "Black"), 150, WHITE)
    fit(d, (340, 210, 740, 330), "STATION B", lambda s: F(s, "Black"), 110, WHITE)
    save(grain(img, 3), "muster")


def stairs():
    """STAIRS with a drawn arrow down (the font has none)."""
    W, H = 768, 240
    img, d = enamel(W, H, NAVY, seed=8)
    d.polygon([(70, 60), (130, 60), (130, 110), (160, 110), (100, 170), (40, 110), (70, 110)], fill=YELLOW)
    fit(d, (180, 34, W - 50, 150), "STAIRS", lambda z: F(z, "Black"), 150, WHITE)
    fit(d, (180, 148, W - 50, 204), "DECKS 3 – 13 · MIND THE ROLL", lambda z: F(z, "Bold"), 56, YELLOW)
    save(sunfade(grain(img, 5), 0.12), "stairs")


def hot_tub():
    board("hot_tub", "HOT TUB", "MAX 6 · NO SEAGULLS", W=640, H=300, bg=TEAL)


def lost_found():
    W, H = 640, 760
    img, d = enamel(W, H, CREAM, rim=BRASS, seed=9)
    fit(d, (50, 40, W - 50, 150), "LOST & FOUND", lambda s: F(s, "Black"), 90, NAVY)
    d.rectangle((80, 152, W - 80, 157), fill=RED)
    rows = [
        "One flip-flop (left)",
        "Dentures (upper)",
        "A toupee, slightly wet",
        "Grandma's sun hat",
        "A rubber duck (not ours)",
        "Somebody's husband",
    ]
    for k, s in enumerate(rows):
        fit(d, (60, 190 + k * 84, W - 50, 250 + k * 84), "· " + s, lambda z: F(z, "Bold"), 48, INK)
    save(sunfade(grain(img, 4), 0.12), "lost_found")


def gull_crossing():
    """SEAGULL CROSSING: a yellow diamond with a gull in it, its plate under."""
    W, H = 512, 640
    img = Image.new("RGB", (W, H), "#fff6dd")
    d = ImageDraw.Draw(img)
    d.polygon([(256, 20), (492, 256), (256, 492), (20, 256)], fill=INK)
    d.polygon([(256, 40), (472, 256), (256, 472), (40, 256)], fill=YELLOW)
    # a gull's silhouette
    d.ellipse((190, 230, 320, 300), fill=INK)
    d.ellipse((290, 200, 340, 245), fill=INK)
    d.polygon([(338, 220), (378, 230), (338, 236)], fill=INK)
    d.polygon([(200, 250), (120, 180), (230, 236)], fill=INK)
    d.polygon([(240, 300), (230, 350), (250, 300)], fill=INK)
    d.polygon([(270, 300), (280, 350), (285, 300)], fill=INK)
    d.rectangle((40, 520, 472, 620), fill=INK)
    fit(d, (56, 528, 456, 612), "SEAGULL CROSSING", lambda s: F(s, "Black"), 80, YELLOW)
    save(grain(img, 3), "gull_crossing")


def wet_deck():
    W, H = 480, 640
    img = Image.new("RGB", (W, H), YELLOW)
    d = ImageDraw.Draw(img)
    d.rectangle((10, 10, W - 11, H - 11), outline=INK, width=10)
    fit(d, (40, 40, W - 40, 170), "CAUTION", lambda s: F(s, "Black"), 120, INK)
    # Carl going over on the wet deck (6 November 2026: once a stick figure)
    d.rectangle((90, 430, 390, 444), fill=INK)
    paste_carl(img, "slip", (40, 168, W - 40, 448))
    fit(d, (40, 470, W - 40, 600), "WET DECK", lambda s: F(s, "Black"), 120, INK)
    save(grain(img, 3), "wet_deck")


def captains_cup():
    board("captains_cup", "SHUFFLEBOARD", "THE CAPTAIN'S CUP · CHEATS WALK THE PLANK", W=768, H=280)


def belly_flop():
    """BELLY FLOP CHAMPIONSHIP: a red banner, today 15:30."""
    W, H = 1400, 300
    img = Image.new("RGB", (W, H), RED)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 40):
        d.polygon([(x, H - 26), (x + 20, H - 2), (x + 40, H - 26)], fill="#9c1622")
    fit(d, (60, 30, W - 60, 190), "BELLY FLOP CHAMPIONSHIP", lambda s: F(s, "Black"), 160, WHITE)
    fit(d, (60, 186, W - 60, 262), "TODAY 15:30 · THE JUDGES' DECISION IS SPLASHY", lambda s: F(s, "Bold"), 60, YELLOW)
    save(grain(img, 4), "belly_flop")


def scorecards():
    """The judges' scorecards: 9.5, 10, 2 (the third judge was splashed)."""
    W, H = 768, 300
    img = Image.new("RGB", (W, H), "#f2f2ee")
    d = ImageDraw.Draw(img)
    for k, s in enumerate(["9.5", "10", "2"]):
        x0 = 12 + k * 252
        d.rectangle((x0, 12, x0 + 240, H - 12), fill=WHITE, outline=INK, width=6)
        fit(d, (x0 + 14, 30, x0 + 226, H - 30), s, lambda z: F(z, "Black"), 220, RED if s == "2" else NAVY)
    save(img, "scorecards")


def stencil(name, s, W=768, H=200, bg=WHITE, fg=NAVY):
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    fit(d, (24, 16, W - 24, H - 16), s, lambda z: F(z, "Black"), 150, fg)
    save(sunfade(grain(img, 6), 0.1), name)


def depth(name, s):
    img = Image.new("RGB", (320, 160), "#f4f6f8")
    d = ImageDraw.Draw(img)
    d.rectangle((6, 6, 313, 153), outline=NAVY, width=6)
    fit(d, (20, 16, 300, 144), s, lambda z: F(z, "Black"), 120, NAVY)
    save(img, name)


def bell_plaque():
    img, d = enamel(512, 200, "#b8913c", rim="#7a5a22", radius=18, seed=12)
    fit(d, (44, 30, 468, 120), "SHIP'S BELL", lambda s: F(s, "Black"), 80, NAVY_D)
    fit(d, (44, 116, 468, 172), "RUNG BY THE CAPTAIN ONLY", lambda s: F(s, "Bold"), 44, NAVY_D)
    save(img, "bell_plaque")


def captain_plate():
    img, d = enamel(640, 160, "#b8913c", rim="#7a5a22", radius=14, seed=13)
    fit(d, (40, 26, 600, 96), "CAPTAIN A. BARNACLE", lambda s: F(s, "Black"), 70, NAVY_D)
    fit(d, (40, 92, 600, 140), "MASTER OF THIS VESSEL SINCE 1931 · NEVER SEASICK", lambda s: F(s, "Bold"), 36, NAVY_D)
    save(img, "captain_plate")


def stations():
    board("water_care", "WATER CARE", "CHLORINE · pH · PATIENCE", bg=NAVY)
    board("eye_care", "EYE CARE", "RINSE · BLINK · LOOK AT THE HORIZON", bg=TEAL)
    board("fin_rental", "FIN RENTAL", "RETURN AFTER USE · NO FLIPPERS ON THE BRIDGE", W=768, H=260)
    board("life_ring", "LIFE RING", "THROW · DON'T TOSS", W=640, H=260, bg=RED)
    board("fish_net", "FISH NET", "FOR FISH. AND RUBBER DUCKS.", W=640, H=260)
    board("skimmer", "POOL SKIMMER", "LEAVES · NAPKINS · SEAGULL FEATHERS", W=768, H=260)
    board("waste", "WASTE", None, W=480, H=200)
    board("first_aid", "FIRST AID", "SEASICK? ASK THE CAPTAIN. HE ISN'T.", W=640, H=260, bg=GREEN)
    board("danger", "DANGER", "HIGH VOLTAGE · NOT A SPLASH ZONE", W=640, H=260, bg=RED)
    board("treats", "DOG TREATS", "FOR THE SHIP'S DOG. NOT THE CAPTAIN.", W=640, H=260)


def stencils():
    stencil("lifejackets", "LIFE JACKETS · 24 ADULT")
    stencil("towels", "FRESH TOWELS · PLEASE TAKE ONE")
    for n in (7, 9, 11, 13):
        stencil(f"lifeboat_{n}", f"LIFEBOAT {n}", W=512, H=160, bg="#ff6a1f", fg=WHITE)
    stencil("lido_deck", "LIDO DECK 14", W=1024, H=200, bg=WHITE, fg=NAVY)
    stencil("photo_here", "SMILE! PHOTO HERE", W=768, H=160, bg=NAVY, fg=YELLOW)
    stencil("buffet", "SUNSET BUFFET · SHRIMP TOWER", W=1024, H=200, bg=NAVY, fg=WHITE)


def lane_number(n):
    img = Image.new("RGB", (256, 256), NAVY)
    d = ImageDraw.Draw(img)
    d.rectangle((8, 8, 247, 247), outline=WHITE, width=8)
    fit(d, (30, 20, 226, 236), str(n), lambda z: F(z, "Black"), 220, WHITE)
    save(img, f"lane_{n}")


def depths():
    lane_number(1)
    lane_number(2)
    depth("depth_12", "1.2 m")
    depth("depth_09", "0.9 m")
    depth("no_diving", "NO DIVING")


def crest():
    """The line's crest on the funnel: a navy disc, a gold ring, a white P riding a wave."""
    S_ = 512
    img = Image.new("RGB", (S_, S_), "#c8202e")
    d = ImageDraw.Draw(img)
    d.ellipse((16, 16, S_ - 16, S_ - 16), fill="#e0b648")
    d.ellipse((40, 40, S_ - 40, S_ - 40), fill=NAVY)
    fit(d, (120, 70, 392, 330), "P", lambda z: F(z, "Black"), 300, WHITE)
    for k in range(3):
        y = 350 + k * 34
        pts = [(110 + x, y + 14 * math.sin(x / 40.0)) for x in range(0, 292, 6)]
        d.line(pts, fill=WHITE if k != 1 else "#6fc3ea", width=12)
    save(img, "crest")


def cinema():
    board("cinema", "SAIL-AWAY CINEMA", "TONIGHT: JAWS (WE'RE SORRY)", W=1400, H=260)


def telegraph():
    """The engine telegraph's dial: FULL AHEAD, HALF, STOP, ASTERN, and PANIC in red, the pointer on PANIC."""
    S_ = 512
    img = Image.new("RGB", (S_, S_), "#c9a24a")
    d = ImageDraw.Draw(img)
    d.ellipse((12, 12, S_ - 12, S_ - 12), fill="#f3e8cf", outline="#7a5a22", width=14)
    words = ["FULL AHEAD", "HALF", "STOP", "ASTERN", "PANIC"]
    for k, wd in enumerate(words):
        a = math.radians(-160 + k * 35)
        cx, cy = S_ / 2 + math.cos(a) * 165, S_ / 2 + math.sin(a) * 165
        fit(d, (cx - 70, cy - 26, cx + 70, cy + 26), wd, lambda z: F(z, "Black"), 44, RED if wd == "PANIC" else NAVY)
        d.line((S_ / 2 + math.cos(a + 0.3) * 120, S_ / 2 + math.sin(a + 0.3) * 120, S_ / 2 + math.cos(a + 0.3) * 215, S_ / 2 + math.sin(a + 0.3) * 215), fill="#7a5a22", width=4)
    a = math.radians(-160 + 4 * 35)
    d.line((S_ / 2, S_ / 2, S_ / 2 + math.cos(a) * 140, S_ / 2 + math.sin(a) * 140), fill=INK, width=16)
    d.ellipse((S_ / 2 - 26, S_ / 2 - 26, S_ / 2 + 26, S_ / 2 + 26), fill="#7a5a22")
    save(img, "telegraph")


JOBS = {
    "telegraph": telegraph,
    "crest": crest,
    "cinema": cinema,
    "ship_name": ship_name,
    "lido_bar": lido_bar,
    "bar_menu": bar_menu,
    "programme": programme,
    "rules": rules,
    "muster": muster,
    "stairs": stairs,
    "hot_tub": hot_tub,
    "lost_found": lost_found,
    "gull_crossing": gull_crossing,
    "wet_deck": wet_deck,
    "captains_cup": captains_cup,
    "belly_flop": belly_flop,
    "scorecards": scorecards,
    "bell_plaque": bell_plaque,
    "captain_plate": captain_plate,
    "stations": stations,
    "stencils": stencils,
    "depths": depths,
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for name, job in JOBS.items():
        if not only or name in only:
            job()
