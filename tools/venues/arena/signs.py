"""The Grand Gala Arena's printed and painted surfaces, drawn with Pillow into its work folder (the poster, the nominees, the red
carpet's photograph, the flamingo's portrait, the emblem and the press pen's ducks are fal's, made ready by painted.py): an awards
night's signs, black and midnight enamel with gold rims and ivory deco capitals. The trampoline's DAREDEVILS · SPLASH ZONE board,
LIFEGUARD, WATER CARE, EYE CARE; GENTLEMEN and LADIES over the changing rooms' doors; the CHAMPAGNE BAR (it is sparkling pool
water); the ice swan's PLEASE DO NOT LICK; the VIP lounge's STRICTLY NO SPLASHING; the PRESS pen; the reserved card on the royal
box's empty chair (M.); the orchestra's stand (THE CANNONBALL OVERTURE); the lectern's AND THE WINNER IS…; the confetti cannons'
warnings; the coaches' tunnel; tonight's programme; the trophy's plate (THE GOLDEN WHISTLE); the banners. The helpers are the
Cruise Ship's (tools/venues/cruise/signs.py).

    python3 tools/venues/arena/signs.py [name ...]
"""

import os, sys, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.setdefault("VENUE_WORK", "/tmp/arena-work")
spec = importlib.util.spec_from_file_location("cruise_signs", os.path.join(HERE, "..", "cruise", "signs.py"))
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
S = C.S
S.OUT = os.path.join(WORK, "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw

F, P, grain, save, sunfade, fit, enamel = S.F, S.P, S.grain, S.save, S.sunfade, C.fit, C.enamel
BLACK, MIDNIGHT, IVORY, GOLD, BRASS, CRIMSON, NAVY = "#141418", "#141d36", "#f6ecd6", "#e2bf6a", "#b8913c", "#a3233a", "#22305a"


def board(name, title, sub=None, W=768, H=280, bg=BLACK, fg=GOLD, sub_fg=IVORY, frac=0.6, seed=1, script=False):
    img, d = enamel(W, H, bg, rim=BRASS, seed=seed)
    top = int(H * (frac if sub else 0.9))
    fnt = (lambda s: P(s)) if script else (lambda s: F(s, "Black"))
    fit(d, (50, 34, W - 50, top), title, fnt, 170, fg)
    if sub:
        fit(d, (60, top, W - 60, H - 40), sub, lambda s: F(s, "Bold"), 70, sub_fg)
    save(sunfade(grain(img, 3), 0.05), name)


def deco(name, title, sub=None, W=1024, H=300, bg=BLACK, fg=GOLD):
    """A deco plate: gold rules top and bottom, stepped corners, spaced capitals."""
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    for k, inset in enumerate((10, 24)):
        d.rectangle((inset, inset, W - inset - 1, H - inset - 1), outline=fg if k == 0 else BRASS, width=6 if k == 0 else 2)
    for cx, cy in ((24, 24), (W - 25, 24), (24, H - 25), (W - 25, H - 25)):
        d.rectangle((cx - 14, cy - 14, cx + 14, cy + 14), fill=fg)
    top = int(H * (0.62 if sub else 0.86))
    fit(d, (70, 40, W - 70, top), " ".join(title), lambda s: F(s, "Black"), 200, fg)
    if sub:
        fit(d, (90, top, W - 90, H - 44), sub, lambda s: F(s, "SemiBold"), 70, IVORY)
    save(grain(img, 2), name)


def stations():
    board("splash_zone", "DAREDEVILS", "SPLASH ZONE · LANE 5", W=1024, H=256, bg=CRIMSON, fg=IVORY, sub_fg=GOLD)
    board("lifeguard", "LIFEGUARD", W=768, H=256, bg=CRIMSON, fg=IVORY)
    board("water_care", "WATER CARE", "CHLORINE · TEST KIT", W=1024, H=512, bg=MIDNIGHT)
    board("eye_care", "EYE CARE", "RINSE · BLINK · CARRY ON", W=1024, H=512, bg=MIDNIGHT)


def doors():
    deco("gentlemen", "GENTLEMEN", W=1024, H=220)
    deco("ladies", "LADIES", W=1024, H=220)


def stories():
    board("champagne", "CHAMPAGNE BAR", "(IT'S SPARKLING POOL WATER)", W=1024, H=300, bg=MIDNIGHT)
    board("ice_swan", "ICE SCULPTURE", "PLEASE DO NOT LICK", W=768, H=280, bg=NAVY)
    board("vip", "VIP LOUNGE", "STRICTLY NO SPLASHING", W=1024, H=300, bg=CRIMSON, fg=IVORY, sub_fg=GOLD)
    board("press", "PRESS", "FLASH PHOTOGRAPHY ENCOURAGED", W=1024, H=300)
    board("reserved", "Reserved", "M.", W=512, H=320, bg=IVORY, fg=CRIMSON, sub_fg=BLACK, script=True)
    board("royal_box", "ROYAL BOX", W=1024, H=220, bg=CRIMSON, fg=GOLD)
    board("orchestra", "THE POOL PANIC PHILHARMONIC", "TONIGHT: THE CANNONBALL OVERTURE", W=1280, H=300)
    board("cannon", "CONFETTI CANNON", "DO NOT LOOK DOWN THE BARREL", W=768, H=256, bg=CRIMSON, fg=IVORY, sub_fg=GOLD)
    board("tunnel", "COACHES' TUNNEL", "WALK, DO NOT RUN. RUN IF IT'S CARL.", W=1280, H=300, bg=MIDNIGHT)
    deco("lectern", "AND THE WINNER IS", "· · ·", W=1024, H=360)
    deco("trophy_plate", "THE GOLDEN WHISTLE", "POOL PANIC · SEASON FINALE", W=1024, H=300)
    deco("awards_name", "THE POOL PANIC AWARDS", "THE SEASON'S LAST NIGHT · BLACK TIE · NO BOMBING", W=2048, H=300)
    programme()


def programme():
    W, H = 640, 900
    img = Image.new("RGB", (W, H), IVORY)
    d = ImageDraw.Draw(img)
    d.rectangle((12, 12, W - 13, H - 13), outline=GOLD, width=8)
    d.rectangle((30, 30, W - 31, H - 31), outline=BLACK, width=2)
    d.rectangle((30, 30, W - 31, 190), fill=BLACK)
    fit(d, (60, 50, W - 60, 120), "TONIGHT", lambda s: F(s, "Black"), 90, GOLD)
    fit(d, (60, 120, W - 60, 175), "THE ORDER OF THE EVENING", lambda s: F(s, "Bold"), 40, IVORY)
    rows = [
        ("7:00", "Arrivals. Red carpet."),
        ("7:30", "The lap of honour"),
        ("8:00", "Belly flop of the year"),
        ("8:15", "Carl (unscheduled)"),
        ("8:30", "A moment for Flamingo"),
        ("9:00", "Coach of the Year"),
        ("9:05", "Panic"),
    ]
    for k, (t, s) in enumerate(rows):
        y = 220 + k * 92
        fit(d, (50, y, 170, y + 60), t, lambda z: F(z, "Black"), 52, CRIMSON)
        fit(d, (180, y, W - 50, y + 60), s, lambda z: F(z, "Bold"), 46, BLACK)
    save(grain(img, 2), "programme")


def banners():
    for k, (bg, fg) in enumerate(((MIDNIGHT, GOLD), (CRIMSON, GOLD), (BLACK, GOLD))):
        W, H = 512, 1024
        img = Image.new("RGB", (W, H), bg)
        d = ImageDraw.Draw(img)
        d.rectangle((18, 18, W - 19, H - 19), outline=fg, width=10)
        d.polygon([(0, H - 120), (W // 2, H - 10), (W, H - 120), (W, H), (0, H)], fill="#000000")
        d.polygon([(W // 2 - 90, 170), (W // 2, 90), (W // 2 + 90, 170), (W // 2, 250)], fill=fg)
        fit(d, (50, 300, W - 50, 520), "GRAND", lambda s: F(s, "Black"), 180, fg)
        fit(d, (50, 520, W - 50, 740), "GALA", lambda s: F(s, "Black"), 180, fg)
        fit(d, (60, 760, W - 60, 840), "SEASON FINALE", lambda s: F(s, "Bold"), 60, IVORY)
        save(img, "banner_%d" % k)


def window_night():
    """An arched window's night: deep blue, a few stars, the moon in one (a second without it)."""
    import random as _r

    for name, moon in (("window_night", True), ("window_night2", False)):
        W, H = 256, 512
        img = Image.new("RGB", (W, H))
        d = ImageDraw.Draw(img)
        for y in range(H):
            t = y / H
            d.line((0, y, W, y), fill=(int(14 + 30 * t), int(22 + 40 * t), int(58 + 70 * t)))
        r = _r.Random(len(name))
        for _ in range(40):
            x, y = r.randrange(W), r.randrange(int(H * 0.8))
            k = r.choice((1, 1, 2))
            d.ellipse((x - k, y - k, x + k, y + k), fill="#f4f0dc")
        if moon:
            d.ellipse((150, 70, 214, 134), fill="#f6eecf")
            d.ellipse((168, 62, 230, 124), fill=(16, 25, 64))
        d.rectangle((0, int(H * 0.86), W, H), fill="#0b1024")
        for k in range(9):
            x0 = k * 30 + r.randrange(-6, 6)
            d.rectangle((x0, int(H * 0.86) - r.randrange(20, 70), x0 + 22, H), fill="#0b1024")
            if r.random() < 0.6:
                d.rectangle((x0 + 6, int(H * 0.86) - 14, x0 + 12, int(H * 0.86) - 6), fill="#e8c46a")
        save(img, name)


JOBS = {"stations": stations, "doors": doors, "stories": stories, "banners": banners, "windows": window_night}

if __name__ == "__main__":
    only = sys.argv[1:]
    for name, job in JOBS.items():
        if not only or name in only:
            job()
