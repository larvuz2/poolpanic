"""The Rooftop Pool's printed and painted surfaces, drawn with Pillow into its work folder (the hotel's poster, DJ SPLASH's gig
poster, the Employee of the Month, the Wall of Shame, the emblem, the pigeons and the things dropped off the roof are fal's, made
ready by painted.py): a five-star hotel's signs, black glass and brushed brass with gold deco capitals, and its staff's own
notices on top of them. HOTEL VERTIGO and SKY POOL · 57 on the lift cores; the Sky Bar's cocktails (the Free Fall Fizz); the pool's
rules (3. Do not feed the pigeons. They have a lawyer.); DAYS WITHOUT A PHONE OVERBOARD: 0 over the phone net; the window
cleaner's BACK IN 5 MINUTES (since Tuesday); SEE YOUR HOUSE! on the coin binoculars; VIP ONLY; ALTITUDE 185 m; the aircraft light's
DO NOT HANG TOWELS; the Employee of the Month's plaque; the depth plates (1.15 m, and 185 m on the knife edge); the stations'
boards (WATER CARE, EYE CARE, LIFE RING, POOL SKIMMER, WASTE, DANGER, DOG TREATS); the floor's stencils. The helpers are Splash
Park's and the Cruise Ship's (tools/venues/splash/signs.py, tools/venues/cruise/signs.py).

    python3 tools/venues/roof/signs.py [name ...]
"""

import os, sys, random, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.setdefault("VENUE_WORK", "/tmp/roof-work")
spec = importlib.util.spec_from_file_location("cruise_signs", os.path.join(HERE, "..", "cruise", "signs.py"))
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
S = C.S
S.OUT = os.path.join(WORK, "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw

F, P, grain, save, sunfade, fit, enamel = S.F, S.P, S.grain, S.save, S.sunfade, C.fit, C.enamel
INK, GLASS, GOLD, BRASS, CREAM, TEAL, CORAL, RED, GREEN, YELLOW, WHITE, BLUE = (
    "#17181a",
    "#121416",
    "#e2bf6a",
    "#b8913c",
    "#f3ead8",
    "#1f5a5c",
    "#ff7a5c",
    "#c8202e",
    "#1f8a4c",
    "#ffd23f",
    "#f6f4ee",
    "#2f6fd0",
)


def lux(W, H, bg=GLASS, rule=GOLD, radius=10):
    """A black glass (or brass) plate: a thin gold rule inset, four tiny brass studs."""
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((14, 14, W - 15, H - 15), radius, outline=rule, width=3)
    for cx, cy in ((26, 26), (W - 26, 26), (26, H - 26), (W - 26, H - 26)):
        d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill="#9a7a3a")
    return img, d


def plate(name, title, sub=None, W=768, H=260, bg=GLASS, fg=GOLD, sub_fg=CREAM, frac=0.62):
    img, d = lux(W, H, bg, rule=fg if bg != GOLD else INK)
    top = int(H * (frac if sub else 0.92))
    fit(d, (46, 30, W - 46, top), title, lambda s: F(s, "Black"), 160, fg)
    if sub:
        fit(d, (56, top, W - 56, H - 34), sub, lambda s: F(s, "SemiBold"), 64, sub_fg)
    save(grain(img, 3), name)


def vertigo():
    """HOTEL VERTIGO across the lift cores' tops: gold deco capitals spaced wide on black, a little V crest each side."""
    W, H = 2048, 320
    img = Image.new("RGB", (W, H), GLASS)
    d = ImageDraw.Draw(img)
    fit(d, (260, 40, W - 260, 220), "H O T E L   V E R T I G O", lambda z: F(z, "Black"), 220, GOLD)
    fit(d, (260, 216, W - 260, 290), "SKY POOL  ·  LEVEL 57  ·  185 m ABOVE THE CITY", lambda z: F(z, "SemiBold"), 70, CREAM)
    for cx in (130, W - 130):
        d.ellipse((cx - 96, 64, cx + 96, 256), outline=GOLD, width=8)
        d.polygon([(cx - 56, 104), (cx - 26, 104), (cx, 196), (cx + 26, 104), (cx + 56, 104), (cx + 10, 228), (cx - 10, 228)], fill=GOLD)
    save(img, "vertigo")


def lift57():
    """Over the lift doors: an up arrow (drawn: the font has none), 57, SKY POOL."""
    W, H = 768, 200
    img, d = lux(W, H)
    d.polygon([(70, 140), (110, 64), (150, 140)], fill=GOLD)
    fit(d, (170, 30, 330, 170), "57", lambda z: F(z, "Black"), 160, GOLD)
    fit(d, (350, 40, W - 40, 160), "SKY POOL", lambda z: F(z, "Bold"), 120, CREAM)
    save(img, "lift57")


def bar_menu():
    img, d = lux(640, 900, bg="#1a1512")
    fit(d, (60, 44, 580, 140), "SKY BAR", lambda s: F(s, "Black"), 110, GOLD)
    fit(d, (60, 136, 580, 186), "COCKTAILS AT ALTITUDE", lambda s: F(s, "SemiBold"), 44, CREAM)
    d.line((120, 196, 520, 196), fill=GOLD, width=3)
    rows = [
        ("The Vertigo", "18"),
        ("Don't Look Down", "17"),
        ("Free Fall Fizz", "16"),
        ("Altitude Sickness", "19"),
        ("Selfie Stick Sour", "15"),
        ("Pigeon Punch", "14"),
        ("Cloud Nine Colada", "17"),
        ("The Drop", "21"),
    ]
    f = F(46, "Bold")
    for k, (a, b) in enumerate(rows):
        y = 222 + k * 74
        d.text((70, y), a, font=f, fill=CREAM)
        d.text((520, y + 2), b, font=f, fill=GOLD)
        d.line((70, y + 60, 570, y + 60), fill="#3a3028", width=2)
    fit(d, (60, 815, 580, 860), "Margaritas by the tray. Ask the coach.", lambda s: F(s, "SemiBold"), 38, "#b89a6a")
    save(grain(img, 3), "bar_menu")


def rules():
    W, H = 640, 880
    img, d = lux(W, H, bg=CREAM, rule=BRASS)
    d.rounded_rectangle((26, 26, W - 27, 150), 8, fill=TEAL)
    fit(d, (50, 40, W - 50, 140), "SKY POOL RULES", lambda s: F(s, "Black"), 84, CREAM)
    rows = [
        "1. No diving. It is a long way down.",
        "2. No selfies on the edge.",
        "3. Do not feed the pigeons.",
        "   They have a lawyer.",
        "4. Don't look down.",
        "5. What goes over the edge",
        "   stays over the edge.",
        "6. No cannonballs. Yes, Carl.",
    ]
    for k, s in enumerate(rows):
        fit(d, (56, 180 + k * 82, W - 50, 240 + k * 82), s, lambda z: F(z, "Bold"), 46, INK)
    save(sunfade(grain(img, 3), 0.06), "rules")


def phone_net():
    """The counter over the phone net: a safety board with a flip number reading 0."""
    W, H = 900, 420
    img, d = enamel(W, H, bg=YELLOW, rim="#2a2a2a", radius=16, seed=21)
    fit(d, (50, 36, W - 50, 116), "DAYS WITHOUT A PHONE", lambda s: F(s, "Black"), 90, INK)
    fit(d, (50, 110, W - 50, 176), "GOING OVER THE EDGE:", lambda s: F(s, "Black"), 70, INK)
    d.rounded_rectangle((W // 2 - 110, 196, W // 2 + 110, 380), 14, fill=INK)
    d.line((W // 2 - 110, 288, W // 2 + 110, 288), fill="#444", width=4)
    fit(d, (W // 2 - 100, 200, W // 2 + 100, 376), "0", lambda s: F(s, "Black"), 200, WHITE)
    d.text((60, 300), "PHONE", font=F(56, "Black"), fill=INK)
    d.text((60, 350), "CATCHER", font=F(40, "Bold"), fill=INK)
    d.text((W - 270, 300), "RECORD:", font=F(46, "Black"), fill=INK)
    d.text((W - 270, 346), "4 HOURS", font=F(46, "Bold"), fill=RED)
    save(grain(img, 4), "phone_net")


def cleaner():
    """The window cleaner's cradle: his notice, hung on the guard rail."""
    W, H = 768, 380
    img, d = enamel(W, H, bg=WHITE, rim="#2a2a2a", radius=10, seed=22)
    d.rectangle((24, 24, W - 25, 110), fill="#e8641f")
    fit(d, (40, 30, W - 40, 104), "WINDOW CLEANING", lambda s: F(s, "Black"), 80, WHITE)
    fit(d, (40, 120, W - 40, 220), "BACK IN 5 MINUTES", lambda s: F(s, "Black"), 100, INK)
    fit(d, (40, 222, W - 40, 280), "(since Tuesday)", lambda s: F(s, "SemiBold"), 54, "#555")
    fit(d, (40, 290, W - 40, 350), "PLEASE DO NOT WAVE. HE WAVES BACK.", lambda s: F(s, "Bold"), 44, RED)
    save(grain(img, 4), "cleaner")


def binoculars():
    img, d = lux(512, 220, bg=GOLD, rule=INK)
    fit(d, (34, 26, 478, 120), "SEE YOUR HOUSE!", lambda s: F(s, "Black"), 90, INK)
    fit(d, (34, 120, 478, 190), "1 COIN · 3 MINUTES · NO REFUNDS FOR FOG", lambda s: F(s, "Bold"), 44, INK)
    save(img, "binoculars")


def small_plates():
    plate("vip", "VIP ONLY", "AND THEIR PIGEONS", W=512, H=240, bg="#5a1220", fg=GOLD)
    plate("altitude", "ALTITUDE 185 m", "EARS MAY POP · HATS MAY FLY", W=768, H=240)
    plate("aircraft", "AIRCRAFT WARNING LIGHT", "PLEASE DO NOT HANG TOWELS ON IT", W=900, H=240, bg=RED, fg=WHITE, sub_fg=YELLOW)
    plate("pigeons", "PIGEONS ARE NOT GUESTS", "WHATEVER THEY TELL YOU", W=900, H=240)
    plate("employee_plaque", "EMPLOYEE OF THE MONTH", "COACH WATERS · EVERY MONTH SINCE OPENING", W=900, H=200, bg=GOLD, fg=INK, sub_fg=INK)
    plate("dj_name", "DJ SPLASH", "SUNSET SESSIONS", W=1024, H=260, bg="#0c0c12", fg="#ff3fb4", sub_fg="#3fd8ff")
    plate("towels", "FRESH TOWELS", "ONE PER GUEST · PIGEONS EXCLUDED", W=768, H=220, bg=CREAM, fg=TEAL, sub_fg=INK)
    plate("concierge", "SKY CONCIERGE", "LUGGAGE · LOST PHONES · REGRETS", W=768, H=220)


def buttons():
    """The lift's panel: two rows of brass buttons, 57 lit, and the staff's note."""
    W, H = 560, 240
    img, d = lux(W, H, bg="#2a2018", rule=GOLD)
    for k, n in enumerate(["1", "12", "24", "33", "41", "57"]):
        cx, cy = 70 + k * 84, 80
        d.ellipse((cx - 30, cy - 30, cx + 30, cy + 30), fill="#ffd27a" if n == "57" else "#b8913c", outline="#5a4020", width=3)
        fit(d, (cx - 26, cy - 20, cx + 26, cy + 20), n, lambda z: F(z, "Black"), 40, INK)
    fit(d, (30, 130, W - 30, 220), "PLEASE DO NOT PRESS ALL THE BUTTONS", lambda z: F(z, "Bold"), 48, CREAM)
    save(img, "buttons")


def stations():
    plate("water_care", "WATER CARE", "CHLORINE · pH · CALM", bg=TEAL, fg=CREAM, sub_fg=GOLD)
    plate("eye_care", "EYE CARE", "RINSE · BLINK · ADMIRE THE VIEW", bg=TEAL, fg=CREAM, sub_fg=GOLD)
    plate("life_ring", "LIFE RING", "THROW · DON'T TOSS OVER THE EDGE", W=640, H=240, bg=RED, fg=WHITE, sub_fg=YELLOW)
    plate("skimmer", "POOL SKIMMER", "LEAVES · NAPKINS · FEATHERS", W=768, H=240)
    plate("waste", "WASTE", None, W=480, H=180)
    plate("danger", "DANGER", "HIGH VOLTAGE · NOT A SPLASH ZONE", W=640, H=240, bg=RED, fg=WHITE, sub_fg=YELLOW)
    plate("treats", "DOG TREATS", "FOR VIP DOGS. NOT THE PIGEONS.", W=640, H=240)
    plate("fish_net", "FISH NET", "LEAVES · DUCKS · NOT PHONES", W=640, H=240)
    plate("tips", "TIPS", "PIGEON FUND", W=320, H=150, bg=GOLD, fg=INK, sub_fg=INK)


def depth(name, s, sub=None):
    img = Image.new("RGB", (320, 160), "#f4efe2")
    d = ImageDraw.Draw(img)
    d.rectangle((6, 6, 313, 153), outline=TEAL, width=6)
    fit(d, (20, 14, 300, 112 if sub else 144), s, lambda z: F(z, "Black"), 120, TEAL)
    if sub:
        fit(d, (20, 108, 300, 148), sub, lambda z: F(z, "Bold"), 36, RED)
    save(img, name)


def depths():
    depth("depth_115", "1.15 m")
    depth("depth_185", "185 m", "TO THE STREET")
    depth("no_diving", "NO DIVING")


def stencil(name, s, W=1024, H=200):
    """For the floor's paint: dark letters on white (shell.py lays the dark only)."""
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    fit(d, (20, 14, W - 20, H - 14), s, lambda z: F(z, "Black"), 160, "black")
    save(img, name)


def stencils():
    stencil("st_mind_edge", "MIND THE EDGE")
    stencil("st_level57", "SKY POOL · 57", W=1024, H=220)
    stencil("st_vip", "VIP", W=512, H=220)


JOBS = {
    "vertigo": vertigo,
    "lift57": lift57,
    "bar_menu": bar_menu,
    "rules": rules,
    "phone_net": phone_net,
    "cleaner": cleaner,
    "binoculars": binoculars,
    "small_plates": small_plates,
    "buttons": buttons,
    "stations": stations,
    "depths": depths,
    "stencils": stencils,
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for name, job in JOBS.items():
        if not only or name in only:
            job()
