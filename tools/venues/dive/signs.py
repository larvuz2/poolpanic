"""The Jumping Pool's printed and painted surfaces, drawn with Pillow into its work folder (the club's poster, the Hall of Fame,
Sir Reginald Splashworth's portrait, the emblem, the peacocks and ducks are fal's, made ready by painted.py): a country club's
signs, racing green enamel with brass rims and cream deco capitals. SPLASHWORTH COUNTRY CLUB on the clubhouse; the diving rules
(5. Chickening out is allowed. See the coop.); the CHICKEN-OUT ZONE (NO SHAME. SOME SHAME.); the SPLASH-O-METER's dial (DRIP to
CARL); the judges' plate and their scorecards (9.5, 10, 2); SPLASH ZONE · PONCHOS; RELAX · MASSAGE; HOT TUB · MAX 6; the founder's
plaque; the heights' signs (LOW 1, MID 2, HIGH 3) and the platforms' fronts (1 m, 3 m, 6 m); the stations' boards; the depth
plates; the floor's stencils. The helpers are Splash Park's and the Cruise Ship's (tools/venues/splash/signs.py,
tools/venues/cruise/signs.py).

    python3 tools/venues/dive/signs.py [name ...]
"""

import os, sys, math, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.setdefault("VENUE_WORK", "/tmp/dive-work")
spec = importlib.util.spec_from_file_location("cruise_signs", os.path.join(HERE, "..", "cruise", "signs.py"))
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
S = C.S
S.OUT = os.path.join(WORK, "signs")
os.makedirs(S.OUT, exist_ok=True)
from PIL import Image, ImageDraw

F, P, grain, save, sunfade, fit, enamel = S.F, S.P, S.grain, S.save, S.sunfade, C.fit, C.enamel
GREEN, CREAM, GOLD, BRASS, INK, NAVY, RED, YELLOW, LEAF, WHITE = (
    "#2f6b4a",
    "#f6efdf",
    "#e2bf6a",
    "#b8913c",
    "#17181a",
    "#23415e",
    "#e2453c",
    "#f1c232",
    "#46b553",
    "#fbf8f1",
)


def board(name, title, sub=None, W=768, H=280, bg=GREEN, fg=CREAM, sub_fg=GOLD, frac=0.6, seed=1):
    img, d = enamel(W, H, bg, rim=BRASS, seed=seed)
    top = int(H * (frac if sub else 0.9))
    fit(d, (50, 34, W - 50, top), title, lambda s: F(s, "Black"), 170, fg)
    if sub:
        fit(d, (60, top, W - 60, H - 40), sub, lambda s: F(s, "Bold"), 70, sub_fg)
    save(sunfade(grain(img, 4), 0.1), name)


def club_name():
    W, H = 2048, 300
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    fit(d, (60, 20, W - 60, 200), "S P L A S H W O R T H   C O U N T R Y   C L U B", lambda z: F(z, "Black"), 200, NAVY)
    fit(d, (300, 196, W - 300, 280), "EST. 1927  ·  DIVING SOCIETY  ·  MEMBERS AND THEIR CHICKENS", lambda z: F(z, "SemiBold"), 70, GREEN)
    save(img, "club_name")


def rules():
    W, H = 640, 900
    img, d = enamel(W, H, CREAM, rim=BRASS, seed=7)
    d.rounded_rectangle((26, 26, W - 27, 150), 14, fill=GREEN)
    fit(d, (50, 40, W - 50, 140), "DIVING RULES", lambda s: F(s, "Black"), 90, CREAM)
    rows = [
        "1. One diver at a time.",
        "2. Wait for a clear landing.",
        "3. No showing off. Yes, you.",
        "4. Feet first unless certified.",
        "5. Chickening out is allowed.",
        "   See the coop.",
        "6. No cannonballs.",
        "   Carl, we mean it.",
    ]
    for k, s in enumerate(rows):
        fit(d, (56, 178 + k * 84, W - 50, 240 + k * 84), s, lambda z: F(z, "Bold"), 46, NAVY)
    save(sunfade(grain(img, 3), 0.08), "rules")


def chicken():
    W, H = 900, 380
    img, d = enamel(W, H, YELLOW, rim="#7a5a22", seed=9)
    fit(d, (50, 36, W - 50, 190), "CHICKEN-OUT ZONE", lambda s: F(s, "Black"), 150, INK)
    fit(d, (60, 196, W - 60, 270), "NO SHAME.  SOME SHAME.", lambda s: F(s, "Black"), 80, RED)
    fit(d, (60, 272, W - 60, 340), "please return the rubber chickens after use", lambda s: F(s, "SemiBold"), 50, INK)
    save(grain(img, 4), "chicken")


def splashometer():
    """The SPLASH-O-METER's dial: a half circle of bands from DRIP to CARL, the needle hard over at CARL."""
    S_ = 768
    img = Image.new("RGB", (S_, S_), CREAM)
    d = ImageDraw.Draw(img)
    cx, cy, r = S_ / 2, S_ * 0.62, S_ * 0.42
    bands = [("DRIP", "#9fd6e6"), ("SPLOSH", "#46b553"), ("KER-SPLASH", "#f1c232"), ("TSUNAMI", "#ff8a2a"), ("CARL", "#e2453c")]
    for k, (word, col) in enumerate(bands):
        a0, a1 = 180 + k * 36, 180 + (k + 1) * 36
        d.pieslice((cx - r, cy - r, cx + r, cy + r), a0, a1, fill=col, outline=INK, width=4)
        am = math.radians((a0 + a1) / 2)
        tx, ty = cx + math.cos(am) * r * 0.72, cy + math.sin(am) * r * 0.72
        f = F(46 if len(word) < 7 else 28, "Black")
        l, t, rr, b = d.textbbox((0, 0), word, font=f)
        d.text((tx - (rr - l) / 2, ty - (b - t) / 2 - t), word, font=f, fill=INK)
    d.ellipse((cx - r * 0.36, cy - r * 0.36, cx + r * 0.36, cy + r * 0.36), fill=CREAM, outline=INK, width=4)
    a = math.radians(180 + 4.6 * 36)
    d.line((cx, cy, cx + math.cos(a) * r * 0.95, cy + math.sin(a) * r * 0.95), fill=INK, width=14)
    d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=BRASS, outline=INK, width=4)
    fit(d, (60, 24, S_ - 60, 130), "SPLASH-O-METER", lambda s: F(s, "Black"), 110, GREEN)
    fit(d, (80, S_ - 150, S_ - 80, S_ - 60), "TODAY'S RECORD: CARL (AGAIN)", lambda s: F(s, "Bold"), 56, RED)
    d.rectangle((6, 6, S_ - 7, S_ - 7), outline=BRASS, width=12)
    save(grain(img, 3), "splashometer")


def judges():
    board("judges", "JUDGES", "THEIR DECISION IS FINAL. AND HURTFUL.", W=768, H=240, bg=NAVY)
    for k, s in enumerate(["9.5", "10", "2"]):
        img = Image.new("RGB", (256, 256), WHITE)
        d = ImageDraw.Draw(img)
        d.rectangle((6, 6, 249, 249), outline=INK, width=6)
        fit(d, (20, 20, 236, 236), s, lambda z: F(z, "Black"), 200, [NAVY, GREEN, RED][k])
        save(img, f"score_{k}")


def plates():
    board("ponchos", "SPLASH ZONE", "PONCHOS FREE · CARL IS DIVING", W=768, H=260, bg="#1f6fa8")
    board("relax", "RELAX · MASSAGE", "SHHH. THE PEACOCKS ARE NAPPING.", W=900, H=240)
    board("hot_tub", "HOT TUB · MAX 6", "NO DIVING (OBVIOUSLY)", W=768, H=240, bg="#c8664a")
    board("founder_plate", "SIR REGINALD SPLASHWORTH", "FOUNDER · 1927 · NEVER BELLY-FLOPPED (ALLEGEDLY)", W=1024, H=220, bg=GOLD, fg=INK, sub_fg=INK)
    board("halloffame_plate", "HALL OF FAME", "IN HONOUR OF THE BRAVE AND THE RED-BELLIED", W=900, H=200, bg=GREEN)
    board("lifeguard", "LIFEGUARD", "ON DUTY · MOSTLY", W=512, H=200, bg=RED, fg=WHITE, sub_fg=YELLOW)
    board("towels", "TOWELS & FINS", "TAKE ONE · RETURN ONE · PEACOCKS EXCLUDED", W=768, H=240)
    board("peacocks", "BEWARE OF THE PEACOCKS", "THEY ARE MEMBERS", W=900, H=220, bg=NAVY)
    for k, (word, col, ink) in enumerate((("LOW", LEAF, WHITE), ("MID", YELLOW, "#3a2f00"), ("HIGH", RED, WHITE))):
        img, d = enamel(512, 300, col, rim=BRASS, seed=20 + k)
        fit(d, (40, 30, 472, 200), word, lambda s: F(s, "Black"), 180, ink)
        fit(d, (40, 196, 472, 270), ("SPRINGBOARD · 1", "3 m PLATFORM · 2", "6 m PLATFORM · 3")[k], lambda s: F(s, "Bold"), 70, ink)
        save(grain(img, 3), "height_" + word.lower())
        img = Image.new("RGB", (512, 160), col)
        d = ImageDraw.Draw(img)
        fit(d, (20, 10, 492, 150), ("1 m", "3 m", "6 m")[k], lambda s: F(s, "Black"), 140, ink)
        save(img, "metres_" + word.lower())


def stations():
    board("water_care", "HOT TUB CARE", "CHLORINE · pH · BUBBLES")
    board("eye_care", "EYE CARE", "RINSE · BLINK · SPOT THE PEACOCK")
    board("life_ring", "LIFE RING", "THROW · DON'T DIVE AFTER IT", W=640, H=240, bg=RED)
    board("fish_net", "FISH NET", "FOR LEAVES AND FEATHERS", W=640, H=240)
    board("skimmer", "POOL SKIMMER", "LEAVES · PETALS · PEACOCK FEATHERS", W=768, H=240)
    board("waste", "WASTE", None, W=480, H=180)
    board("danger", "DANGER", "HIGH VOLTAGE · NOT A DIVING BOARD", W=640, H=240, bg=RED, sub_fg=YELLOW)
    board("treats", "DOG TREATS", "FOR MEMBERS' DOGS. NOT THE DUCKS.", W=640, H=240)


def depth(name, s, sub=None):
    img = Image.new("RGB", (320, 160), "#f4f6f8")
    d = ImageDraw.Draw(img)
    d.rectangle((6, 6, 313, 153), outline=NAVY, width=6)
    fit(d, (20, 14, 300, 112 if sub else 144), s, lambda z: F(z, "Black"), 120, NAVY)
    if sub:
        fit(d, (20, 108, 300, 148), sub, lambda z: F(z, "Bold"), 36, RED)
    save(img, name)


def depths():
    depth("depth_42", "4.2 m", "DEEP WATER")
    depth("no_running", "NO RUNNING")


def stencil(name, s, W=1024, H=200):
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    fit(d, (20, 14, W - 20, H - 14), s, lambda z: F(z, "Black"), 160, "black")
    save(img, name)


def stencils():
    stencil("st_divers", "DIVERS QUEUE HERE")
    stencil("st_deep", "DEEP WATER · 4.2 m")


JOBS = {
    "club_name": club_name,
    "rules": rules,
    "chicken": chicken,
    "splashometer": splashometer,
    "judges": judges,
    "plates": plates,
    "stations": stations,
    "depths": depths,
    "stencils": stencils,
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for name, job in JOBS.items():
        if not only or name in only:
            job()
