"""The Mountain Hot Springs' gameplay furniture, in wood and straw, each where the game keeps its hit box and label (kit.PLAN: dist/
spatial.mjs ONSEN, dist/scene/props.mjs for what the game itself draws on them):
- MINERALS (the water care: a cart of bath-salt sacks, a barrel of crystals, a ladle) and EYE CARE (a washstand, ceramic basins, a
  bamboo pipe, little towels, eye drops, a mirror), their boards on posts above, painted on both faces;
- the skimmer's board on the near side (the game hangs the skimmer on its hooks there), the waste barrel;
- the three life-ring boards, each with a snowy roof and a peg (the game hangs the ring at 1.65 m: `LifeRing` records where); the fish
  net's board (the game's net on its rods); the torch's post (`Flashlight`); the fuse box's backboard (the game draws the box and its
  lever); the dog treats' stand with its jar.

    blender -b -P tools/venues/onsen/props_stations.py [-- --look]
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

reset()
LOOK = "--look" in args()
R = random.Random(733)
M = dict(
    hinoki=tmat_tile("hinoki", "#c9a374", 0.6),
    timber=tmat_tile("timber", "#3b2a20", 0.75),
    post=sm("timber"),
    snow=tmat_tile("snow", "#eef3fa", 0.8),
    iron=sm("iron"),
    straw=sm("straw"),
    rope=sm("rope"),
    white=sm("white"),
    ceramic=sm("ceramic"),
    ceramic_blue=sm("ceramic_blue"),
    bamboo=sm("bamboo"),
    towel=sm("towel"),
    towel_blue=sm("towel_blue"),
    red=sm("red"),
    glass=sm("glass_jar", "#d6eef2", 0.05, alpha=0.3),
    mirror=sm("mirror", "#dfe9ee", 0.05, 1.0),
    granite=sm("granite"),
    brass=sm("brass"),
    ring=sm("ring_orange", "#f47742", 0.5),
)
parts = {}


def add(group, *objs):
    parts.setdefault(group, []).extend(o for o in objs if o is not None)


def box(name, x0, x1, y0, y1, z0, z1, m, bev=0.01):
    return gbx(name, min(x0, x1), max(x0, x1), y0, y1, min(z0, z1), max(z0, z1), m, bev)


def rod(name, a, b, r, m, sides=8):
    return tube(name, [g(*a), g(*b)], r, m, 1, sides)


def yawed(objs, x, z, yaw, name):
    o = join(objs, name)
    # (the joined pieces keep the first one's pivot: bake it, so the turn and the move are about the local origin)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.rotation_euler = (0, 0, yaw)
    o.location = g(x, 0, z)
    apply_all(o)
    return o


def painted(img, w, h, y, z_front, z_back):
    """A picture on both faces of a board whose faces are at local z `z_front` (+z) and `z_back`."""
    a = plane("Pic", w, h, (0, -(z_front + 0.002), y), signmat(img, 0.6))
    b = plane("Pic", w, h, (0, -(z_back - 0.002), y), signmat(img, 0.6), rot=(PI / 2, 0, PI))
    return [a, b]


def roof_cap(w, y, d=0.22):
    return [
        box("Cap", -w / 2 - 0.15, w / 2 + 0.15, y, y + 0.07, -d, d, M["post"], 0.02),
        box("CapSnow", -w / 2 - 0.12, w / 2 + 0.12, y + 0.07, y + 0.17, -d + 0.02, d - 0.02, M["snow"], 0.04),
    ]


def sign_frame(img, w, h, y0, posts=True):
    """A board with its picture on both faces, on two posts from the ground (local, facing +z), a little snowy roof."""
    pcs = [box("SignBoard", -w / 2, w / 2, y0, y0 + h, -0.03, 0.03, M["hinoki"], 0.01)]
    pcs += painted(img, w - 0.06, h - 0.06, y0 + h / 2, 0.03, -0.03)
    if posts:
        for s_ in (-1, 1):
            pcs.append(box("SignPost", s_ * w / 2 - 0.05, s_ * w / 2 + 0.05, 0, y0 + h + 0.08, -0.05, 0.05, M["post"], 0.01))
    pcs += roof_cap(w, y0 + h + 0.08)
    return pcs


# ---- MINERALS and EYE CARE (the stations face +x, toward the springs; the camera reads their boards' backs, painted too) --------------
ch = STATIONS["chlorine"]
pc = []
pc.append(box("CartTop", -0.85, 0.85, 0.7, 0.78, -0.5, 0.5, M["hinoki"], 0.02))
for sx in (-0.75, 0.75):
    for sz in (-0.4, 0.4):
        pc.append(box("CartLeg", sx - 0.05, sx + 0.05, 0, 0.7, sz - 0.05, sz + 0.05, M["post"], 0.01))
pc.append(box("CartShelf", -0.8, 0.8, 0.22, 0.27, -0.45, 0.45, M["hinoki"], 0.01))
for s_, x in ((0, -0.45), (1, 0.05)):
    pc.append(sphere("Sack", 0.28, (x, -0.0, 1.05), M["straw"], 14, 10, scale=(1.0, 0.75, 1.15)))
    pc.append(plane("SackLabel", 0.34, 0.45, (x, -0.215, 1.02), signmat("salt_sack", 0.8)))
    pc.append(torus("SackTie", 0.09, 0.02, (x, 0, 1.35), M["rope"], 12, 4))
pc.append(cyl("Barrel", 0.24, 0.42, (0.55, 0, 0.78), M["hinoki"], 16, r2=0.22))
for y in (0.85, 1.12):
    pc.append(torus("Hoop", 0.235, 0.012, (0.55, 0, y), M["iron"], 16, 4))
pc.append(sphere("Crystals", 0.21, (0.55, 0, 1.2), M["white"], 12, 6, scale=(1, 1, 0.45)))
pc.append(rod("LadleHandle", (0.55, 1.22, 0.05), (0.8, 1.6, 0.28), 0.014, M["hinoki"], 6))
pc.append(cyl("LadleCup", 0.07, 0.07, (0.55, 0, 1.18), M["hinoki"], 10))
# its board above, on posts at the back
board = sign_frame("minerals", 1.5, 0.75, 1.75)
for o in board:
    o.location = (o.location[0], o.location[1] + 0.55, o.location[2])  # (behind the cart: its posts clear of the sacks)
    apply_all(o)
pc += board
add("stations", yawed(pc, ch["x"], ch["z"], PI / 2, "Minerals"))

rl = STATIONS["relief"]
pe = []
pe.append(box("StandTop", -0.85, 0.85, 0.82, 0.9, -0.48, 0.48, M["hinoki"], 0.02))
pe.append(box("StandBody", -0.8, 0.8, 0, 0.82, -0.42, 0.42, M["timber"], 0.01))
for x in (-0.42, 0.28):
    pe.append(cyl("Basin", 0.2, 0.12, (x, 0, 0.9), M["ceramic"], 16, r2=0.24))
    pe.append(cyl("BasinWater", 0.2, 0.01, (x, 0, 1.0), M["ceramic_blue"], 16))
pe.append(rod("PipeUp", (0.75, 0, 0.35), (0.75, 1.35, 0.35), 0.04, M["bamboo"], 8))
pe.append(rod("Pipe", (0.75, 1.32, 0.35), (-0.42, 1.18, -0.1), 0.035, M["bamboo"], 8))
for k in range(3):
    pe.append(towel_folded("EyeTowel", 0.22, 0.2, 0.05, M["towel"], M["towel_blue"], (0.7, 0.2, 0.9 + k * 0.05), 0.1 * k))
pe.append(box("DropsBox", -0.08, 0.12, 0.9, 0.98, -0.42, -0.25, M["hinoki"], 0.005))
for k in range(4):
    pe.append(cyl("Drops", 0.018, 0.08, (-0.05 + k * 0.05, 0.34, 0.98), M["white"], 8))
pe.append(box("MirrorPost", -0.03, 0.03, 0.9, 1.8, -0.46, -0.4, M["post"], 0.005))
pe.append(box("Mirror", -0.25, 0.25, 1.35, 1.75, -0.41, -0.39, M["mirror"], 0.005))
board = sign_frame("eye_care", 1.5, 0.75, 1.9)
for o in board:
    o.location = (o.location[0], o.location[1] + 0.55, o.location[2])
    apply_all(o)
pe += board
add("stations", yawed(pe, rl["x"], rl["z"], PI / 2, "EyeCare"))

# ---- the skimmer's board on the near side, and the waste barrel ------------------------------------------------------------------------
sk = SANITATION["rack"]
wallX = DECK["minX"] - 0.45
sb = [box("SkimmerBoard", wallX - 0.08, wallX + 0.08, 1.12, 2.37, sk["z"] - 1.95, sk["z"] + 1.95, M["hinoki"], 0.02)]
for zz in (sk["z"] - 1.7, sk["z"] + 1.7):
    sb.append(box("SkimmerPost", wallX - 0.07, wallX + 0.07, 0, 2.5, zz - 0.07, zz + 0.07, M["post"], 0.01))
title = sign_frame("skimmer", 1.4, 0.7, 2.45, posts=False)
add("sanitation", *sb, yawed(title, wallX, sk["z"], PI / 2, "SkimmerTitle"))
bn = SANITATION["bin"]
bi = [cyl("WasteBarrel", 0.55, 1.15, g(bn["x"], 0, bn["z"]), M["hinoki"], 20, r2=0.5)]
for y in (0.18, 0.6, 1.0):
    bi.append(torus("WasteHoop", 0.53 - y * 0.03, 0.02, g(bn["x"], y, bn["z"]), M["iron"], 20, 4))
lid = cyl("WasteLid", 0.52, 0.06, (0, 0, 0), M["timber"], 20)
lid.rotation_euler = (0.35, 0, 0)
lid.location = g(bn["x"] + 0.1, 1.18, bn["z"])
apply_all(lid)
bi.append(lid)
bi.append(sphere("LidSnow", 0.46, g(bn["x"] + 0.1, 1.24, bn["z"]), M["snow"], 14, 6, scale=(1, 1, 0.15)))
wplate = [box("WastePlate", -0.32, 0.32, 0.5, 0.82, -0.02, 0.02, M["timber"], 0.01)] + painted("waste", 0.6, 0.3, 0.66, 0.02, -0.02)
for o in wplate:
    o.location = (o.location[0], o.location[1] - 0.55, o.location[2])
    apply_all(o)
bi.append(yawed(wplate, bn["x"], bn["z"], -PI / 2, "WastePlate"))
add("sanitation", *bi)

# ---- the life-ring boards, the fish net's board, the torch's post ----------------------------------------------------------------------
for k, mnt in enumerate(RING_MOUNTS):
    rb_ = [box("RingBoard", -0.82, 0.82, 0.05, 2.55, -0.245, -0.115, M["red"], 0.02)]
    rb_.append(box("RingBoardFrame", -0.86, 0.86, 0.02, 0.1, -0.26, -0.1, M["post"], 0.01))
    rb_ += painted("life_ring", 1.5, 0.75, 2.95, -0.115, -0.245)
    rb_.append(box("RingSignBack", -0.8, 0.8, 2.57, 3.33, -0.21, -0.15, M["hinoki"], 0.01))
    for s_ in (-1, 1):
        rb_.append(box("RingPost", s_ * 0.86 - 0.06, s_ * 0.86 + 0.06, 0, 3.45, -0.24, -0.12, M["post"], 0.01))
    caps = roof_cap(1.72, 3.45, 0.3)
    for o in caps:
        o.location = (o.location[0], o.location[1] + 0.18, o.location[2])
        apply_all(o)
    rb_ += caps
    rb_.append(rod("RingPeg", (0, 2.25, -0.12), (0, 2.25, 0.16), 0.05, M["post"], 8))
    add("rings", yawed(rb_, mnt["x"], mnt["z"], mnt["angle"], f"RingBoard{k}"))
    ring_at = torus("LifeRing", 0.4, 0.1, g(mnt["x"], 1.65, mnt["z"]), M["ring"], 16, 6)
    add("rings", ring_at)
fn = FIXTURES["fishNet"]
fb = [box("NetBoard", -0.7, 0.7, 0.05, 2.85, -0.245, -0.115, M["hinoki"], 0.02)]
for s_ in (-1, 1):
    fb.append(box("NetPost", s_ * 0.74 - 0.06, s_ * 0.74 + 0.06, 0, 3.5, -0.24, -0.12, M["post"], 0.01))
fb += painted("fish_net", 1.3, 0.65, 3.18, -0.115, -0.245)
fb.append(box("NetSignBack", -0.68, 0.68, 2.86, 3.5, -0.21, -0.15, M["hinoki"], 0.01))
caps = roof_cap(1.5, 3.5, 0.3)
for o in caps:
    o.location = (o.location[0], o.location[1] + 0.18, o.location[2])
    apply_all(o)
fb += caps
add("rings", yawed(fb, fn["x"], fn["z"], fn["angle"], "FishNetBoard"))
fl = FIXTURES["flashlight"]
fp = [box("TorchPost", fl["x"] - 0.07, fl["x"] + 0.07, 0, 1.12, fl["z"] - 0.07, fl["z"] + 0.07, M["post"], 0.01)]
fp.append(box("TorchShelf", fl["x"] - 0.24, fl["x"] + 0.24, 1.12, 1.17, fl["z"] - 0.18, fl["z"] + 0.18, M["hinoki"], 0.01))
fp.append(box("TorchShelfSnow", fl["x"] - 0.22, fl["x"] + 0.22, 1.17, 1.19, fl["z"] + 0.06, fl["z"] + 0.17, M["snow"], 0.005))
fp.append(cyl("Flashlight", 0.06, 0.3, g(fl["x"], 1.09, fl["z"]), M["iron"], 8))  # (its middle, 1.24 m up, is where the game puts the torch)
add("fixtures", *fp)

# ---- the fuse box's backboard (the game draws the box and its lever on it), the dog treats' stand --------------------------------------
fu = FIXTURES["fuseBox"]
fz = fu["z"] - 0.12 - 0.15  # (the back of the game's box)
fk = [box("FuseBoard", fu["x"] - 0.75, fu["x"] + 0.75, 0.0, 2.6, fz - 0.08, fz, M["timber"], 0.01)]
for s_ in (-1, 1):
    fk.append(box("FusePost", fu["x"] + s_ * 0.8 - 0.07, fu["x"] + s_ * 0.8 + 0.07, 0, 2.75, fz - 0.12, fz + 0.02, M["post"], 0.01))
fk.append(box("FuseRoof", fu["x"] - 1.0, fu["x"] + 1.0, 2.75, 2.82, fz - 0.4, fz + 0.45, M["post"], 0.02))
fk.append(box("FuseRoofSnow", fu["x"] - 0.96, fu["x"] + 0.96, 2.82, 2.94, fz - 0.37, fz + 0.42, M["snow"], 0.04))
fk.append(rod("Cable", (fu["x"] + 0.4, 2.3, fz + 0.02), (fu["x"] + 0.6, 2.75, fz + 0.02), 0.02, M["iron"], 5))
add("fixtures", *fk)
tr = FIXTURES["treats"]
ts = [box("TreatsTop", tr["x"] - 0.32, tr["x"] + 0.32, 0.74, 0.8, tr["z"] - 0.32, tr["z"] + 0.32, M["hinoki"], 0.02)]
for sx in (-0.26, 0.26):
    for sz in (-0.26, 0.26):
        ts.append(box("TreatsLeg", tr["x"] + sx - 0.04, tr["x"] + sx + 0.04, 0, 0.74, tr["z"] + sz - 0.04, tr["z"] + sz + 0.04, M["post"], 0.005))
ts.append(cyl("Glass_Jar", 0.2, 0.38, g(tr["x"], 0.8, tr["z"]), M["glass"], 16))
ts.append(cyl("JarLid", 0.21, 0.06, g(tr["x"], 1.18, tr["z"]), M["red"], 16))
for k in range(5):
    a = k * 1.3
    ts.append(cyl("Bone", 0.022, 0.18, g(tr["x"] + math.cos(a) * 0.07, 0.86 + k * 0.05, tr["z"] + math.sin(a) * 0.07), M["white"], 6, rot=(PI / 2, 0, a)))
tsign = [box("TreatsStick", -0.02, 0.02, 0.8, 1.55, -0.02, 0.02, M["post"], 0.0), box("TreatsBoard", -0.32, 0.32, 1.3, 1.62, -0.02, 0.02, M["hinoki"], 0.01)]
tsign += painted("treats", 0.6, 0.3, 1.46, 0.02, -0.02)
for o in tsign:
    o.location = (o.location[0] + 0.24, o.location[1], o.location[2])
    apply_all(o)
ts.append(yawed(tsign, tr["x"], tr["z"], -PI / 2, "TreatsSign"))
add("fixtures", *ts)

for k, v in parts.items():
    print("GROUP", k, tris([o for o in v if o and o.type == "MESH"]))
if LOOK:
    look("st_minerals", g(-13.4, 1.2, 3.2), 4.5, 16, 270, (960, 640), 18, 35)
    look("st_eye", g(-13.4, 1.2, 9.6), 4.5, 16, 250, (960, 640), 18, 35)
    look("st_near", g(-14.8, 1.6, -6.0), 9, 14, 270, (1280, 720), 18, 30)
    look("st_fuse", g(9.6, 1.4, -15.0), 4, 10, 10, (960, 640), 18, 35)
    look("st_treats", g(-11.6, 1.0, 11.8), 3, 14, 250, (960, 640), 18, 35)
save_part("stations", [o for v in parts.values() for o in v if o])
