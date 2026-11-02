"""The Grand Gala Arena's furniture in black tie and its stories at the edge of play, in game coordinates: the furniture stands in
the game's own boxes (dist/spatial.mjs RESORT_SPEC's furniture), the stories on the stage's side of the deck, off the platform on
the hall's floor and up in the boxes, never where a guest walks or waits:

- the CHAMPAGNE BAR at the kiosk (walnut and gold leaf, a Calacatta top where the game's dog treats sit, a back bar of bottles and a
  mirror, a tower of coupes, an ice bucket, the sign: IT'S SPARKLING POOL WATER);
- floral urns on black marble pedestals at two of the palms' places (white lilies and red roses), and at the third the ICE
  SCULPTURE, a swan melting into a bucket (PLEASE DO NOT LICK);
- the VIP lounge at the loungers: two crimson velvet chaises with gold legs and satin cushions, a champagne bucket on its stand at
  the parasol's place (VIP LOUNGE · STRICTLY NO SPLASHING);
- the four confetti cannons at the classic's places (DO NOT LOOK DOWN THE BARREL), gold star balloons tied to them;
- the flamingo's memorial on its easel with a wreath of lilies in front of the left drape, the winner's lectern with its envelope
  in front of the right (AND THE WINNER IS…);
- off the platform in the back right corner, the PRESS pen: a riser behind a velvet rope where three rubber ducks of the press
  (a paparazzo, a reporter, one who only claps) wait with their flashes, and the POOL PANIC TV jib swinging its camera over the
  corner; in the back left, the orchestra pit (THE POOL PANIC PHILHARMONIC, tonight THE CANNONBALL OVERTURE: empty chairs, music
  stands, timpani, a gold harp, a tuba with a duck in its bell, the conductor's podium, a seal in a bow tie as the guest artist);
- the ROYAL BOX in the middle of the far wall's boxes: a crimson canopy and a gold crown, two thrones, one of them empty with a
  bouquet of roses and a card on the rail: Reserved · M.;
- the COACHES' TUNNEL in the gap between the stands (WALK, DO NOT RUN. RUN IF IT'S CARL.).

    blender -b -P tools/venues/arena/props_gala.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
RND = random.Random(41)
M = dict(
    walnut=tmat_tile("walnut", "#5a3520", 0.35),
    goldleaf=tmat_tile("goldleaf", "#d9ae4a", 0.35),
    marble=tmat_tile("marble", "#f1ece4", 0.2),
    nero=tmat_tile("nero", "#141418", 0.15),
    velvet=tmat_tile("velvet", "#8f1f32", 0.85),
    linen=tmat_tile("linen", "#f3ead6", 0.9),
    gold=sm("gold"),
    brass=sm("brass"),
    gold_paint=sm("gold_paint"),
    crimson=sm("crimson"),
    burgundy=sm("burgundy"),
    navy=sm("navy"),
    midnight=sm("midnight"),
    ivory=sm("ivory"),
    black=sm("black"),
    ink=sm("ink"),
    chrome=sm("chrome"),
    silver=sm("silver"),
    glass=sm("coupe_glass", "#f2f6f2", 0.05, alpha=0.45),
    bubbly=sm("champagne", "#f2d98a", 0.1, alpha=0.75),
    bottle=sm("bottle_green", "#1f3a26", 0.15),
    foil=sm("bottle_foil", "#d9ae4a", 0.3, 1.0),
    ice=sm("ice", "#cfe9f6", 0.06, alpha=0.7),
    water=sm("melt", "#bfe0f0", 0.05, alpha=0.5),
    leaf=sm("leaf"),
    leaf_dark=sm("leaf_dark"),
    rose=sm("rose"),
    lily=sm("lily"),
    satin=sm("satin_ivory", "#f6ecd6", 0.25),
    satin_gold=sm("satin_gold", "#e2bf6a", 0.25),
    rubber=sm("rubber"),
    charcoal=sm("charcoal"),
    lens=sm("lens", "#1a2a3a", 0.05, 0.5),
    flash=lamp_mat("flash", "#ffffff", 8.0),
    bulb=lamp_mat("bar_bulb", "#ffe2a0", 5.0),
    onair=lamp_mat("on_air", "#ff3a3a", 6.0),
    confetti=[sm("confetti_" + c[1:], c, 0.4) for c in ("#d9ae4a", "#a3233a", "#f6ecd6", "#2b3f73", "#e86d9a")],
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


b = xbox


def coupe(x, y, z, full=True):
    """A champagne coupe: a foot, a stem, a shallow bowl, the champagne in it."""
    out = [cyl("CoupeFoot", 0.035, 0.006, g(x, y, z), M["glass"], 8), cyl("CoupeStem", 0.005, 0.07, g(x, y + 0.006, z), M["glass"], 4)]
    out.append(cyl("CoupeBowl", 0.012, 0.03, g(x, y + 0.076, z), M["glass"], 10, r2=0.05))
    if full:
        out.append(cyl("CoupeFill", 0.044, 0.004, g(x, y + 0.098, z), M["bubbly"], 10))
    return out


def champagne(x, y, z, tilt=0.0):
    o = [cyl("Bottle", 0.04, 0.2, g(x, y, z), M["bottle"], 10), cyl("Neck", 0.04, 0.1, g(x, y + 0.2, z), M["bottle"], 10, r2=0.016)]
    o.append(cyl("Foil", 0.017, 0.06, g(x, y + 0.29, z), M["foil"], 8))
    o.append(cyl("Label", 0.041, 0.07, g(x, y + 0.06, z), M["ivory"], 10))
    return o


def bouquet(x, y, z, r=0.35, n=14, colours=("rose", "lily")):
    """A spray of flowers: leaves, roses and lilies on a dome."""
    out = [sphere("Greens", r, g(x, y + r * 0.5, z), M["leaf_dark"], 10, 6, scale=(1, 1, 0.75))]
    for k in range(n):
        a = k * 2.399
        rr = r * math.sqrt((k + 0.5) / n)
        px, pz = x + math.cos(a) * rr, z + math.sin(a) * rr
        py = y + r * 0.5 + math.sqrt(max(0, r * r - rr * rr)) * 0.75
        m = M[colours[k % len(colours)]]
        out.append(sphere("Bloom", 0.07 if m is M["rose"] else 0.085, g(px, py, pz), m, 6, 4))
    return out


# ================================================================================================================================
# THE CHAMPAGNE BAR at the kiosk (its front toward the pool, -x; the game's treats sit on the top at x 12.45, y 1.24)
# ================================================================================================================================
KX, KZ = KIOSK
o = [
    b("BarKick", -1.18, 1.18, 0.0, 0.12, 0.6, 1.0, M["nero"], 0.01),
    b("BarFront", -1.2, 1.2, 0.12, 1.18, 0.55, 1.04, M["walnut"], 0.01),
    b("BarTop", -1.26, 1.26, 1.18, 1.24, 0.5, 1.1, M["marble"], 0.01),
    b("BarRail", -1.2, 1.2, 0.2, 0.24, 1.08, 1.12, M["brass"], 0.005),
]
for k in range(9):  # gold-leaf flutes on the front
    u = -1.0 + k * 0.25
    o.append(b("Flute", u - 0.05, u + 0.05, 0.3, 1.08, 1.04, 1.07, M["goldleaf"], 0.01))
# the back bar: shelves of bottles before a mirror, the sign on top
o += [
    b("BackBar", -1.2, 1.2, 0.0, 0.95, -1.05, -0.7, M["walnut"], 0.01),
    b("BackTop", -1.24, 1.24, 0.95, 0.99, -1.07, -0.66, M["marble"], 0.01),
    b("Mirror", -1.1, 1.1, 1.0, 2.3, -1.05, -1.02, M["chrome"], 0.0),
    b("MirrorFrame", -1.2, 1.2, 2.3, 2.42, -1.08, -0.95, M["goldleaf"], 0.01),
]
for y in (1.35, 1.85):
    o.append(b("Shelf", -1.1, 1.1, y - 0.03, y, -1.02, -0.82, M["gold"], 0.005))
    for k in range(9):
        u = -0.95 + k * 0.24
        o += champagne(u, y, -0.92) if k % 3 != 1 else [cyl("Spirit", 0.045, 0.24, g(u, y, -0.92), sm("amber", "#b8762a", 0.15), 10)]
o.append(face("BarSign", 2.2, 0.64, 0.0, 2.8, -0.98, 0.0, signmat("champagne", 0.4)))
o.append(b("BarSignBack", -1.16, 1.16, 2.44, 3.16, -1.05, -0.99, M["midnight"], 0.01))
for k in range(9):
    o.append(sphere("Light_Bulb", 0.035, g(-1.1 + k * 0.275, 3.2, -1.0), M["bulb"], 6, 4))
# the tower of coupes on the counter's left end, an ice bucket with a bottle on the right, a bell
TY = 1.24
for tier, n in enumerate((4, 3, 2, 1)):
    for i in range(n):
        for j in range(n):
            o += coupe(-0.85 + (i - (n - 1) / 2) * 0.1, TY + tier * 0.105, 0.8 + (j - (n - 1) / 2) * 0.1)
o.append(cyl("IceBucket", 0.11, 0.22, g(0.75, TY, 0.78), M["silver"], 14, r2=0.13))
o.append(cyl("Ice", 0.12, 0.02, g(0.75, TY + 0.2, 0.78), M["ice"], 12))
o += champagne(0.77, TY + 0.1, 0.76)
o.append(cyl("Bell", 0.06, 0.05, g(0.2, TY, 0.95), M["brass"], 12, r2=0.015))
add("bar", yawed(o, KX, KZ, TO_MX, "ChampagneBar"))
# two gold star balloons tied to the bar's end
for k, (dz, h) in enumerate(((-1.0, 2.6), (-0.7, 2.9))):
    add("bar", card("StarBalloon", "star_balloon", 0.7, KX - 0.9, h, KZ + dz, TO_MX + 0.3 * k))
    add("bar", rod("BalloonString", (KX - 0.9, 1.24, KZ + dz), (KX - 0.9, h + 0.05, KZ + dz), 0.004, M["ivory"], 3))

# ================================================================================================================================
# FLORAL URNS at two of the palms' places, the ICE SWAN at the third (by the doors)
# ================================================================================================================================
for (px, pz) in DECK_PALMS:
    if px > 0:
        continue
    o = [
        b("Pedestal", -0.32, 0.32, 0.0, 1.0, -0.32, 0.32, M["nero"], 0.02),
        b("PedestalCap", -0.38, 0.38, 1.0, 1.06, -0.38, 0.38, M["gold"], 0.01),
        b("PedestalFoot", -0.38, 0.38, 0.0, 0.08, -0.38, 0.38, M["gold"], 0.01),
        cyl("Urn", 0.16, 0.12, g(0, 1.06, 0), M["gold"], 16, r2=0.2),
        cyl("UrnBowl", 0.2, 0.3, g(0, 1.18, 0), M["gold"], 16, r2=0.32),
    ]
    o += bouquet(0, 1.38, 0, r=0.5, n=26)
    for k in range(6):  # lilies' long leaves and trailing ivy
        a = k * PI / 3 + 0.3
        o.append(rod("Ivy", (math.cos(a) * 0.3, 1.45, math.sin(a) * 0.3), (math.cos(a) * 0.45, 0.85, math.sin(a) * 0.45), 0.025, M["leaf"], 4))
    add("flowers", yawed(o, px, pz, 0.0, "FloralUrn"))
SX, SZ = [p for p in DECK_PALMS if p[0] > 0][0]
o = [
    b("SwanPedestal", -0.34, 0.34, 0.0, 0.95, -0.34, 0.34, M["walnut"], 0.02),
    b("SwanTray", -0.4, 0.4, 0.95, 1.0, -0.4, 0.4, M["silver"], 0.01),
    cyl("Bucket", 0.12, 0.22, g(0.32, 0.0, 0.45), M["silver"], 12, r2=0.14),
    cyl("BucketWater", 0.13, 0.01, g(0.32, 0.18, 0.45), M["water"], 12),
    flat("Puddle", 0.5, 0.36, 0.2, 0.004, 0.55, M["water"], turn=0.4),
    # the swan: a body, wings, a neck curving up and over, a head and beak; a block of ice under it
    b("IceBlock", -0.3, 0.3, 1.0, 1.12, -0.3, 0.3, M["ice"], 0.03),
    sphere("SwanBody", 0.26, g(0, 1.3, 0.02), M["ice"], 12, 8, scale=(0.7, 1.0, 0.65)),
    sphere("WingL", 0.2, g(-0.14, 1.38, -0.06), M["ice"], 10, 6, scale=(0.35, 1.0, 0.6)),
    sphere("WingR", 0.2, g(0.14, 1.38, -0.06), M["ice"], 10, 6, scale=(0.35, 1.0, 0.6)),
    tube("SwanNeck", [g(0, 1.4, 0.18), g(0, 1.62, 0.24), g(0, 1.8, 0.14), g(0, 1.82, 0.02)], 0.045, M["ice"], 6, 8),
    sphere("SwanHead", 0.07, g(0, 1.82, 0.04), M["ice"], 8, 6),
    cyl("Beak", 0.025, 0.1, g(0, 1.8, 0.08), M["ice"], 6, r2=0.005, rot=(PI / 2, 0, 0)),
    sphere("Drip", 0.02, g(0.3, 0.93, 0.42), M["water"], 6, 4, scale=(1, 1, 1.6)),
]
o.append(rod("SignLeg", (-0.55, 0.0, 0.25), (-0.55, 0.9, 0.25), 0.012, M["brass"], 4))
o.append(face("SwanSign", 0.66, 0.24, -0.55, 0.98, 0.26, 0.0, signmat("ice_swan", 0.4)))
add("flowers", yawed(o, SX, SZ, TO_MX + 0.5, "IceSwan"))

# ================================================================================================================================
# THE VIP LOUNGE at the loungers (along z), a champagne bucket on its stand at the parasol's place
# ================================================================================================================================
for (lx, lz) in LOUNGERS:
    o = [b("ChaiseSeat", -0.4, 0.4, 0.22, 0.46, -0.95, 0.95, M["velvet"], 0.05)]
    for su in (-0.34, 0.34):
        for sv in (-0.85, 0.85):
            o.append(cyl("ChaiseLeg", 0.035, 0.22, g(su, 0.0, sv), M["gold"], 8, r2=0.02))
    o.append(b("ChaiseBack", -0.4, 0.4, 0.46, 0.95, -0.95, -0.72, M["velvet"], 0.06))
    o.append(tube("ChaiseScroll", [g(-0.4, 0.95, -0.84), g(0.4, 0.95, -0.84)], 0.12, M["velvet"], 1, 10))
    o.append(b("ChaiseTrim", -0.42, 0.42, 0.2, 0.24, -0.97, 0.97, M["gold"], 0.01))
    o.append(tube("Bolster", [g(-0.32, 0.55, -0.62), g(0.32, 0.55, -0.62)], 0.1, M["satin_gold"], 1, 10))
    o.append(b("Cushion", -0.2, 0.2, 0.46, 0.56, 0.3, 0.7, M["satin"], 0.04))
    o.append(towel_folded("VipTowel", 0.36, 0.28, 0.06, sm("towel_white"), sm("towel_sun"), g(0.0, 0.46, -0.15), 0.1))
    add("vip", yawed(o, lx, lz, 0.0, "VipChaise"))
UX, UZ = UMBRELLA
o = [
    cyl("StandFoot", 0.18, 0.03, g(0, 0, 0), M["gold"], 12),
    cyl("StandPost", 0.02, 0.62, g(0, 0.03, 0), M["gold"], 8),
    cyl("Bucket", 0.12, 0.24, g(0, 0.62, 0), M["silver"], 14, r2=0.15),
    cyl("Ice", 0.14, 0.02, g(0, 0.83, 0), M["ice"], 12),
]
o += champagne(0.02, 0.72, 0.0)
o.append(rod("VipSignPost", (0.0, 0.03, -0.14), (0.0, 1.1, -0.14), 0.012, M["gold"], 6))
o.append(b("VipSignBack", -0.32, 0.32, 1.0, 1.22, -0.16, -0.14, M["gold"], 0.005))
o.append(face("VipSign", 0.6, 0.176, 0.0, 1.11, -0.135, 0.0, signmat("vip", 0.4)))
add("vip", yawed(o, UX, UZ, PI, "ChampagneStand"))

# ================================================================================================================================
# THE CONFETTI CANNONS at the classic's places, gold star balloons tied to them
# ================================================================================================================================
for i, (cx_, cz_) in enumerate(CANNONS):
    yaw = PI if cz_ > 0 else 0.0  # (its front, and the sign, toward the pool)
    lean = (-1 if cx_ < 0 else 1) * (1 if yaw == 0.0 else -1)  # (the barrel leans out, away from the deck's middle)
    tilt = 0.35 * lean
    o = [cyl("CannonBase", 0.32, 0.18, g(0, 0, 0), M["crimson"], 14), cyl("CannonRing", 0.34, 0.04, g(0, 0.18, 0), M["gold"], 14)]
    barrel = cyl("CannonBarrel", 0.17, 1.05, g(0, 0.2, 0), M["gold"], 14, r2=0.22)
    barrel.rotation_euler = (0, tilt, 0)
    apply_all(barrel)
    o.append(barrel)
    o.append(torus("Muzzle", 0.22, 0.04, g(math.sin(tilt) * 1.05, 0.2 + math.cos(tilt) * 1.05, 0), M["crimson"], 16, 5))
    for k in range(18):  # confetti spilled round its foot
        a, r = RND.random() * 2 * PI, 0.35 + RND.random() * 0.35
        o.append(flat("Confetti", 0.05, 0.03, math.cos(a) * r, 0.004, math.sin(a) * r, M["confetti"][k % 5], turn=RND.random() * PI))
    if i < 2:
        o.append(face("CannonSign", 0.6, 0.2, 0.0, 0.1, 0.33, 0.0, signmat("cannon", 0.4)))
    add("cannons", yawed(o, cx_, cz_, yaw, "ConfettiCannon"))
    hb = 2.6 + 0.3 * (i % 2)
    add("cannons", card("StarBalloon", "star_balloon", 0.6, cx_ + 0.3, hb, cz_, PI / 2 if cx_ < 0 else -PI / 2))
    add("cannons", rod("BalloonString", (cx_ + 0.3, 0.18, cz_), (cx_ + 0.3, hb + 0.05, cz_), 0.004, M["ivory"], 3))

# ================================================================================================================================
# THE FLAMINGO'S MEMORIAL in front of the left drape, THE WINNER'S LECTERN in front of the right
# ================================================================================================================================
o = [
    rod("EaselLegL", (-0.35, 0.0, 0.1), (-0.05, 1.9, -0.05), 0.022, M["gold"], 6),
    rod("EaselLegR", (0.35, 0.0, 0.1), (0.05, 1.9, -0.05), 0.022, M["gold"], 6),
    rod("EaselBack", (0.0, 0.0, -0.45), (0.0, 1.85, -0.07), 0.022, M["gold"], 6),
    b("EaselLedge", -0.45, 0.45, 0.62, 0.66, -0.02, 0.1, M["gold"], 0.005),
    b("PortraitFrame", -0.46, 0.46, 0.66, 1.85, -0.04, 0.0, M["black"], 0.01),
    face("Flamingo", 0.82, 1.09, 0.0, 1.255, 0.005, 0.0, signmat("flamingo", 0.4)),
    rod("BlackRibbon", (0.2, 1.85, 0.01), (0.46, 1.58, 0.01), 0.025, M["black"], 4),
    torus("Wreath", 0.3, 0.07, g(0.0, 0.32, 0.25), M["leaf_dark"], 18, 6, rot=(PI / 2, 0, 0)),
]
for k in range(10):
    a = k * 2 * PI / 10
    o.append(sphere("WreathLily", 0.06, g(math.cos(a) * 0.3, 0.32 + math.sin(a) * 0.3, 0.3), M["lily"], 6, 4))
o.append(b("WreathStand", -0.03, 0.03, 0.0, 0.3, 0.2, 0.26, M["gold"], 0.0))
add("stories", yawed(o, -13.5, -15.25, 0.25, "FlamingoMemorial"))
o = [
    b("LecternBase", -0.32, 0.32, 0.0, 0.08, -0.25, 0.25, M["nero"], 0.01),
    b("LecternBody", -0.26, 0.26, 0.08, 1.0, -0.2, 0.2, M["walnut"], 0.02),
    b("LecternTop", -0.34, 0.34, 1.0, 1.06, -0.3, 0.32, M["goldleaf"], 0.01),
    face("LecternPlate", 0.48, 0.17, 0.0, 0.78, 0.205, 0.0, signmat("lectern", 0.4)),
    rod("MicStem", (0.15, 1.06, 0.1), (0.05, 1.42, 0.25), 0.01, M["black"], 6),
    sphere("Mic", 0.035, g(0.05, 1.44, 0.26), M["charcoal"], 8, 6, scale=(1, 1, 1.4)),
    b("Envelope", -0.14, 0.12, 1.06, 1.075, -0.08, 0.1, M["gold"], 0.0),
    b("EnvelopeSeal", -0.03, 0.01, 1.075, 1.08, 0.0, 0.03, M["crimson"], 0.0),
]
o += bouquet(-0.25, 1.06, 0.15, r=0.12, n=7, colours=("rose",))
add("stories", yawed(o, 13.3, -15.3, -0.25, "WinnersLectern"))

# ================================================================================================================================
# THE PRESS PEN off the platform in the back right corner, the POOL PANIC TV jib
# ================================================================================================================================
PY0 = -0.2  # the riser's top: the ducks peer over the platform
o = [b("PressRiser", 17.3, 21.6, HALL_Y, PY0, -16.0, -13.9, M["midnight"], 0.02), b("RiserTrim", 17.26, 21.64, PY0 - 0.06, PY0, -16.04, -13.86, M["gold"], 0.005)]
for z in (-15.6, -14.85, -14.1):
    o.append(cyl("RopePost", 0.03, 0.95, g(17.4, PY0, z), M["brass"], 8))
    o.append(sphere("RopeTop", 0.05, g(17.4, PY0 + 0.97, z), M["brass"], 8, 5))
o.append(poly_tube("PressRope", [g(17.4, PY0 + 0.9, -15.6), g(17.4, PY0 + 0.7, -15.22), g(17.4, PY0 + 0.9, -14.85), g(17.4, PY0 + 0.7, -14.47), g(17.4, PY0 + 0.9, -14.1)], 0.025, M["velvet"], 8, 0.1))
o.append(rod("PressSignPost", (17.5, PY0, -16.0), (17.5, PY0 + 2.1, -16.0), 0.03, M["brass"]))
o.append(face("PressSign", 1.4, 0.41, 17.55, PY0 + 1.9, -15.4, -PI / 2, signmat("press", 0.4)))
add("press", *o)
for k, (cut, x, z, th) in enumerate((("duck_paparazzo", 18.0, -15.2, -PI / 2 + 0.3), ("duck_reporter", 18.5, -14.4, -PI / 2 - 0.2), ("duck_clap", 19.4, -15.5, -PI / 2 + 0.1), ("duck_paparazzo", 19.9, -14.5, -PI / 2 - 0.35))):
    add("press", card("PressDuck", cut, 0.75 if k != 2 else 0.6, x, PY0, z, th))
    if cut == "duck_paparazzo":
        add("press", sphere("Light_Flash", 0.05, g(x - 0.1, PY0 + 0.66, z + 0.12), M["flash"], 6, 4))
# the jib: a tripod on the hall's floor, a long arm with a counterweight, the camera out over the corner
JX, JZ = 23.5, -15.0
o = []
for k in range(3):
    a = k * 2 * PI / 3
    o.append(rod("JibLeg", (JX + math.cos(a) * 0.9, HALL_Y, JZ + math.sin(a) * 0.9), (JX, 1.2, JZ), 0.04, M["black"], 6))
o.append(cyl("JibHead", 0.18, 0.3, g(JX, 1.2, JZ), M["charcoal"], 12))
o.append(rod("JibArm", (JX + 2.0, 1.0, JZ + 0.3), (JX - 4.6, 3.6, JZ + 0.6), 0.07, M["black"], 8))
o.append(b("Counterweight", JX + 1.8, JX + 2.4, 0.7, 1.2, JZ + 0.1, JZ + 0.5, M["charcoal"], 0.02))
o.append(b("Camera", JX - 5.0, JX - 4.4, 3.3, 3.75, JZ + 0.45, JZ + 0.8, M["black"], 0.03))
o.append(cyl("CameraLens", 0.12, 0.3, g(JX - 5.0, 3.52, JZ + 0.62), M["lens"], 12, rot=(0, -PI / 2, 0)))
o.append(b("TallyBox", JX - 4.8, JX - 4.6, 3.75, 3.85, JZ + 0.55, JZ + 0.7, M["black"], 0.0))
o.append(sphere("Light_Tally", 0.04, g(JX - 4.7, 3.88, JZ + 0.62), M["onair"], 6, 4))
add("press", *o)

# ================================================================================================================================
# THE ORCHESTRA PIT off the platform in the back left corner (the Coach Cam's mostly)
# ================================================================================================================================
OY = HALL_Y + 0.25
o = [b("PitFloor", -26.3, -16.6, HALL_Y, OY, -16.0, -13.8, M["walnut"], 0.01), b("PitRail", -16.62, -16.5, OY, OY + 0.9, -16.0, -13.8, M["goldleaf"], 0.01)]
o.append(face("OrchestraSign", 3.2, 0.75, -16.65, 0.75, -14.95, PI / 2, signmat("orchestra", 0.4)))
o.append(b("OrchestraSignBack", -16.72, -16.66, 0.33, 1.17, -16.6, -13.3, M["midnight"], 0.01))
for z in (-16.0, -13.9):
    o.append(b("OrchestraSignPost", -16.75, -16.67, OY, 0.33, z - 0.04, z + 0.04, M["gold"], 0.0))
for row, (x, n) in enumerate(((-18.0, 5), (-19.4, 6))):
    for k in range(n):
        z = -15.6 + k * (1.8 / max(1, n - 1))
        o += [b("PitChair", x - 0.2, x + 0.2, OY, OY + 0.45, z - 0.2, z + 0.2, M["black"], 0.01), b("PitChairBack", x - 0.24, x - 0.2, OY + 0.45, OY + 0.9, z - 0.2, z + 0.2, M["black"], 0.01)]
        o += [rod("MusicStand", (x + 0.55, OY, z), (x + 0.55, OY + 1.0, z), 0.012, M["black"], 4), b("StandDesk", x + 0.5, x + 0.56, OY + 0.95, OY + 1.3, z - 0.22, z + 0.22, M["black"], 0.0), b("Score", x + 0.49, x + 0.5, OY + 1.0, OY + 1.26, z - 0.18, z + 0.18, M["ivory"], 0.0)]
for k, z in enumerate((-15.4, -14.5)):  # timpani
    o.append(cyl("Kettle", 0.3, 0.55, g(-21.2, OY, z), M["brass"], 16, r2=0.36))
    o.append(cyl("Head", 0.37, 0.02, g(-21.2, OY + 0.75, z), M["ivory"], 16))
    o.append(cyl("Kettle2", 0.37, 0.2, g(-21.2, OY + 0.55, z), M["brass"], 16))
# the harp: a column, a curved neck, the soundboard, strings
hx_, hz_ = -22.6, -15.3
o.append(cyl("HarpColumn", 0.05, 1.7, g(hx_ + 0.35, OY, hz_), M["gold"], 8))
o.append(tube("HarpNeck", [g(hx_ + 0.35, OY + 1.7, hz_), g(hx_ + 0.1, OY + 1.85, hz_), g(hx_ - 0.2, OY + 1.55, hz_), g(hx_ - 0.35, OY + 1.4, hz_)], 0.05, M["gold"], 6, 8))
o.append(tube("HarpBoard", [g(hx_ - 0.35, OY + 1.4, hz_), g(hx_ + 0.3, OY + 0.05, hz_)], 0.07, M["gold"], 1, 8))
for k in range(8):
    t = (k + 1) / 9
    x = hx_ - 0.35 + 0.65 * t
    o.append(rod("HarpString", (x, OY + 1.4 - 1.35 * t, hz_), (x, OY + 1.6 + 0.15 * t, hz_), 0.004, M["ivory"], 3))
# the tuba with a duck in its bell, the conductor's podium, the seal
o.append(tube("TubaBody", [g(-20.2, OY + 0.4, -14.4), g(-20.2, OY + 0.9, -14.4), g(-20.0, OY + 1.1, -14.3)], 0.12, M["brass"], 6, 10))
o.append(cyl("TubaBell", 0.12, 0.35, g(-20.2, OY + 1.1, -14.4), M["brass"], 14, r2=0.3))
o.append(card("TubaDuck", "duck_clap", 0.3, -20.2, OY + 1.3, -14.4, PI / 2))
o.append(b("Podium", -17.4, -16.9, OY, OY + 0.3, -15.2, -14.6, M["nero"], 0.01))
o.append(b("PodiumRail", -17.42, -17.36, OY + 0.3, OY + 1.2, -15.2, -14.6, M["gold"], 0.005))
o.append(rod("Baton", (-17.1, OY + 1.0, -14.9), (-16.9, OY + 1.05, -14.8), 0.006, M["ivory"], 3))
o.append(cyl("SealDrum", 0.3, 0.4, g(-23.8, OY, -14.5), M["crimson"], 14))
o.append(torus("SealDrumRim", 0.3, 0.03, g(-23.8, OY + 0.4, -14.5), M["gold"], 14, 5))
o.append(card("Seal", "seal", 0.9, -23.8, OY + 0.4, -14.5, PI / 2 - 0.3))
add("orchestra", *o)

# ================================================================================================================================
# THE ROYAL BOX in the middle of the far wall's boxes (shell.py hall_wall: the far wall's 8 bays; its box floor at kit.BOX_Y0)
# ================================================================================================================================
BAY = (HALL["z1"] - HALL["z0"]) / 8
RZ = HALL["z0"] + 3.5 * BAY  # the fourth bay's middle
WX = HALL["x1"]
BY = BOX_Y0
o = []
for su in (-1, 1):
    z = RZ + su * 0.55
    o += [b("Throne", WX - 0.9, WX - 0.4, BY, BY + 0.5, z - 0.3, z + 0.3, M["velvet"], 0.03), b("ThroneBack", WX - 0.45, WX - 0.35, BY + 0.5, BY + 1.55, z - 0.3, z + 0.3, M["velvet"], 0.03)]
    o.append(b("ThroneFrame", WX - 0.47, WX - 0.33, BY + 1.5, BY + 1.62, z - 0.36, z + 0.36, M["gold"], 0.02))
    o.append(sphere("ThroneFinial", 0.06, g(WX - 0.4, BY + 1.7, z), M["gold"], 8, 5))
o += bouquet(WX - 0.65, BY + 0.5, RZ + 0.55, r=0.2, n=9, colours=("rose",))
o.append(b("RoyalCanopy", WX - 1.6, WX, BY + 2.7, BY + 2.9, RZ - 1.8, RZ + 1.8, M["velvet"], 0.03))
o.append(b("RoyalValance", WX - 1.62, WX - 1.5, BY + 2.35, BY + 2.9, RZ - 1.8, RZ + 1.8, M["velvet"], 0.02))
o.append(b("ValanceFringe", WX - 1.64, WX - 1.5, BY + 2.31, BY + 2.36, RZ - 1.8, RZ + 1.8, M["gold"], 0.0))
o.append(face("RoyalSign", 2.2, 0.47, WX - 1.65, BY + 2.62, RZ, -PI / 2, signmat("royal_box", 0.4)))
crown = [cyl("CrownBand", 0.32, 0.22, g(WX - 0.8, BY + 2.9, RZ), M["gold"], 16)]
for k in range(8):
    a = k * PI / 4
    crown.append(sphere("CrownPoint", 0.06, g(WX - 0.8 + math.cos(a) * 0.3, BY + 3.2, RZ + math.sin(a) * 0.3), M["gold"], 6, 4))
crown.append(sphere("CrownJewel", 0.08, g(WX - 0.8, BY + 3.25, RZ), M["crimson"], 8, 6))
o += crown
o.append(face("ReservedCard", 0.4, 0.25, WX - 1.33, BY + 0.98, RZ + 0.55, -PI / 2, signmat("reserved", 0.4)))
add("royal", *o)

# ================================================================================================================================
# THE COACHES' TUNNEL in the gap between the end stand and the far stand
# ================================================================================================================================
TX0, TX1, TZ = 16.45, 17.65, 14.75
o = [b("TunnelDark", TX0, TX1, HALL_Y, 0.8, TZ + 0.2, TZ + 3.0, M["midnight"], 0.0)]
for x in (TX0, TX1 - 0.18):
    o.append(b("TunnelPier", x, x + 0.18, HALL_Y, 0.9, TZ, TZ + 0.25, M["walnut"], 0.01))
o.append(b("TunnelHead", TX0, TX1, 0.9, 1.5, TZ, TZ + 0.25, M["goldleaf"], 0.01))
o.append(face("TunnelSign", 1.15, 0.27, (TX0 + TX1) / 2, 1.2, TZ - 0.005, PI, signmat("tunnel", 0.4)))
add("tunnel", *o)

for k, v in parts.items():
    print("GROUP", k, tris(v))
if LOOK:
    look("gala_bar", g(13.4, 1.2, 11.2), 5, 20, 250, (960, 640), 16, 35)
    look("gala_press", g(19.5, 0.0, -15.0), 9, 20, 200, (960, 640), 16, 35)
for k, v in parts.items():
    save_part("gala_" + k, v)
