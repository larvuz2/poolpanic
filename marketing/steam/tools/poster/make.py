"""make.py VARIANT... : writes poster/shots/<variant>.json (the cast, where each stands, its pose and face, the venue, the cameras)."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = open(os.path.join(HERE, "poster-lib.js")).read()
MARINA = os.path.join(HERE, "marina.glb")
SW = "swimmer-woman.glb"  # the dances' source

F = {
    "waters": "coach-panic.glb", "brooks": "coach-brooks.glb", "rivers": "coach-rivers.glb", "storm": "coach-storm.glb",
    "fontaine": "coach-fontaine.glb", "marsh": "coach-marsh.glb", "marina": "/poster/marina.glb", "carl": "carl.glb",
    "leopard": "leopard-man.glb", "kid": "fish-kid.glb", "marco": "models/marco.glb", "valentina": "models/valentina.glb",
    "karen": "models/karen.glb", "dog": "models/dog.glb", "dj": "models/dj.glb", "bartender": "models/bartender.glb",
    "judge": "models/official-judge.glb", "starter": "models/official-starter.glb", "monkey": "models/snow-monkey.glb",
    "macaw1": "models/macaw-scarlet.glb", "macaw2": "models/macaw-bluegold.glb", "granny": "seniors/senior-granny.glb",
    "grandpa": "seniors/senior-grandpa.glb", "tallgran": "seniors/senior-tallgran.glb", "stout": "seniors/senior-stout.glb",
    "boy": "swimmer-boy.glb", "tallman": "swimmer-tall-man.glb", "woman": "swimmer-woman.glb",
    "heavy": "swimmer-heavy-man.glb", "tallwoman": "swimmer-tall-woman.glb",
}

# Where everyone stands (local x to the camera's right, z toward the camera), the same in every poster.
SPOT = {
    "waters": (-0.45, 2.7), "marina": (0.45, 2.6),
    "dog": (-1.85, 2.85), "kid": (1.8, 2.7), "monkey": (2.75, 2.95),
    "rivers": (-1.5, 1.55), "storm": (-2.7, 1.15), "marsh": (-3.9, 0.7),
    "brooks": (1.5, 1.55), "fontaine": (2.7, 1.15), "karen": (3.9, 0.7),
    "carl": (-0.85, -0.35), "marco": (0.85, -0.45), "leopard": (-2.15, -0.75), "valentina": (2.15, -0.75),
    "dj": (-3.35, -1.0), "bartender": (3.35, -1.0), "granny": (-4.75, -0.55), "boy": (0.0, -1.0),
    "judge": (-4.3, -2.1), "tallman": (-3.05, -2.0), "woman": (-1.8, -1.85), "grandpa": (-0.6, -1.9),
    "tallwoman": (0.6, -1.85), "heavy": (1.8, -1.85), "tallgran": (3.05, -2.0), "starter": (4.3, -2.1),
    "stout": (4.85, -0.9),
    "macaw1": (-2.6, -0.4), "macaw2": (2.9, -0.2),
}


def cast(poses, squeeze=1.0):
    out = []
    for cid, pose in poses.items():
        x, z = SPOT[cid]
        x *= squeeze
        c = {"id": cid, "f": F[cid], "x": x, "z": z}
        c.update(pose)
        c["x"] += c.pop("dx", 0); c["z"] += c.pop("dz", 0)
        out.append(c)
    return out


D = lambda name, t=0.0, **k: dict(clip=name, src=SW, t=t, **k)  # a dance borrowed from a swimmer

HAPPY = {
    "waters": dict(clip="Panic", t=0.3, face="relief", turn=0.22),
    "marina": dict(clip="Panic", t=0.35, turn=-0.22),
    "dog": dict(clip="Leap", t=0.5, y=0.25, ground=True),
    "kid": dict(clip="CarryIdle", t=0.2, turn=-0.3),
    "monkey": dict(clip="MonkeyHop", t=0.4, turn=-0.5),
    "rivers": D("DanceBoth", 0.25, face="relief", turn=0.15),
    "storm": D("DanceLeft", 0.5, face="relief", turn=0.2),
    "marsh": D("DanceRight", 0.1, face="relief", turn=0.25),
    "brooks": D("DanceRight", 0.3, face="relief", turn=-0.15),
    "fontaine": D("DanceBoth", 0.7, face="relief", turn=-0.2),
    "karen": dict(clip="Point", t=0.6, turn=-0.9),
    "carl": D("DanceBoth", 0.45, turn=0.1),
    "marco": dict(clip="DanceRight", t=0.6, turn=-0.1),
    "leopard": dict(clip="Panic", t=0.3, turn=0.2),
    "valentina": dict(clip="DanceBoth", t=0.15, turn=-0.2),
    "dj": dict(clip="DanceLeft", t=0.8, turn=0.3),
    "bartender": dict(clip="Shake", t=0.3, turn=-0.3),
    "granny": dict(clip="Sit", t=0.2, chair=True, turn=0.35),
    "boy": D("DanceLeft", 0.35),
    "judge": dict(clip="IdleScan", src=SW, t=0.5, turn=0.3),
    "tallman": D("DanceRight", 0.55, turn=0.2),
    "woman": dict(clip="Panic", t=0.6, turn=0.1),
    "grandpa": D("DanceBoth", 0.9),
    "tallwoman": D("DanceLeft", 0.15, turn=-0.1),
    "heavy": dict(clip="Panic", t=0.2, src=SW, turn=-0.1),
    "tallgran": D("DanceRight", 0.75, turn=-0.2),
    "starter": dict(clip="IdleScan", src=SW, t=0.1, turn=-0.3),
    "stout": D("DanceLeft", 0.6, turn=-0.4),
    "macaw1": dict(clip="Fly", t=0.3, y=2.9, ground=False, turn=1.2),
    "macaw2": dict(clip="Fly", t=0.7, y=3.15, ground=False, turn=-1.4),
}

CHAOS = {
    "waters": dict(clip="FreakOut", t=0.4, face="panic", turn=0.1),
    "marina": dict(clip="Panic", t=0.35, turn=-0.25),
    "dog": dict(clip="Run", t=0.3, turn=0.6),
    "kid": dict(clip="BucketDump", t=0.5, turn=-0.4),
    "monkey": dict(clip="MonkeyRun", t=0.3, turn=-0.9),
    "rivers": dict(clip="Startle", t=0.35, face="alarm", turn=0.3),
    "storm": dict(clip="Haul", t=0.5, face="struggle", turn=0.5),
    "marsh": dict(clip="FreakOut", t=0.75, face="panic", turn=0.2),
    "brooks": dict(clip="Startle", t=0.5, face="alarm", turn=-0.3),
    "fontaine": dict(clip="IceSlide", t=0.45, face="dizzy", turn=-0.2),
    "karen": dict(clip="Complain", t=0.4, turn=-1.0),
    "carl": dict(clip="Cannonball", t=0.55, y=2.25, dx=-2.0, dz=0.6),
    "marco": dict(clip="Panic", t=0.1, turn=-0.1),
    "leopard": dict(clip="Panic", t=0.6, turn=0.3),
    "valentina": dict(clip="Panic", t=0.45, turn=-0.3),
    "dj": dict(clip="Panic", t=0.85, turn=0.3),
    "bartender": dict(clip="Panic", t=0.25, turn=-0.3),
    "granny": dict(clip="Sit", t=0.2, chair=True, turn=0.35),
    "boy": dict(clip="Panic", t=0.7),
    "judge": dict(clip="IdleScan", src=SW, t=0.5, turn=0.3),
    "tallman": dict(clip="Panic", t=0.15, turn=0.2),
    "woman": dict(clip="Panic", t=0.6, turn=0.1),
    "grandpa": dict(clip="Panic", t=0.4),
    "tallwoman": dict(clip="Panic", t=0.9, turn=-0.1),
    "heavy": dict(clip="Panic", t=0.2, turn=-0.1),
    "tallgran": dict(clip="Panic", t=0.5, turn=-0.2),
    "starter": dict(clip="IdleScan", src=SW, t=0.1, turn=-0.3),
    "stout": dict(clip="Panic", t=0.05, turn=-0.4),
    "macaw1": dict(clip="Fly", t=0.3, y=2.9, ground=False, turn=1.2),
    "macaw2": dict(clip="Fly", t=0.7, y=3.15, ground=False, turn=-1.4),
}
# Waters and Marina happy in the middle, the coaches on the left in trouble, those on the right dancing; the guests half and half.
MIXED = dict(HAPPY)
MIXED.update({
    "rivers": CHAOS["rivers"], "storm": CHAOS["storm"], "marsh": CHAOS["marsh"],
    "carl": CHAOS["carl"], "leopard": CHAOS["leopard"], "dj": CHAOS["dj"], "tallman": CHAOS["tallman"],
    "woman": CHAOS["woman"], "judge": CHAOS["judge"], "karen": dict(clip="Complain", t=0.4, turn=-1.0),
    "kid": CHAOS["kid"], "dog": CHAOS["dog"],
})
CUT_BLOCKS = [-12, 12, 0.015, 1.3, -10.45, -8.62]
BUNTING = [-14, 14, 1.6, 7, -9.9, -0.5]
TRIMS = [-12, 12, 0.2, 1.3, -10.5, -8.7]

VARIANTS = {
    "test-arena": dict(venue="arena", C=[0, -11.3], A=0, poses=HAPPY, clear=[BUNTING, TRIMS], cut=CUT_BLOCKS, cams=[
        {"pos": [0, 2.7, -3.0], "at": [0, 1.0, -11.3], "fov": 40},
        {"pos": [0, 1.6, -4.2], "at": [0, 1.25, -11.3], "fov": 44},
    ]),
    "gala-party": dict(venue="arena", C=[0, -11.6], A=0, poses=HAPPY, clear=[BUNTING, TRIMS], cut=CUT_BLOCKS, cams=[
        {"pos": [0, 1.55, -3.4], "at": [0, 1.3, -11.6], "fov": 48},
        {"pos": [0, 2.3, -3.0], "at": [0, 1.05, -11.6], "fov": 46},
        {"pos": [-1.0, 0.85, -5.6], "at": [0, 1.5, -11.6], "fov": 56},
    ]),
    "harbour-chaos": dict(venue="club", C=[0, -11.6], A=0, poses=CHAOS, clear=[BUNTING, TRIMS], cut=CUT_BLOCKS, cams=[
        {"pos": [0, 1.55, -3.4], "at": [0, 1.3, -11.6], "fov": 48},
        {"pos": [0, 2.3, -3.0], "at": [0, 1.05, -11.6], "fov": 46},
        {"pos": [1.0, 0.85, -5.6], "at": [0, 1.5, -11.6], "fov": 56},
    ]),
    "splash-mixed": dict(venue="resort", C=[0, -11.6], A=0, poses=MIXED, clear=[BUNTING, TRIMS], cut=CUT_BLOCKS, cams=[
        {"pos": [0, 1.55, -3.4], "at": [0, 1.3, -11.6], "fov": 48},
        {"pos": [0, 2.3, -3.0], "at": [0, 1.05, -11.6], "fov": 46},
        {"pos": [-1.0, 0.85, -5.6], "at": [0, 1.5, -11.6], "fov": 56},
    ]),
}


for base, pose, venue in [("gala-party", HAPPY, "arena"), ("harbour-chaos", CHAOS, "club"), ("splash-mixed", MIXED, "resort")]:
    VARIANTS[base + "-p"] = dict(venue=venue, C=[0, -11.6], A=0, poses=pose, clear=[BUNTING, TRIMS], cut=CUT_BLOCKS, size=[1440, 1800], squeeze=0.76, cams=[
        {"pos": [0, 1.45, -4.0], "at": [0, 2.0, -11.6], "fov": 60},
        {"pos": [0.6, 0.95, -5.2], "at": [0, 2.1, -11.6], "fov": 64},
    ])


def write(name):
    v = VARIANTS[name]
    after = "const CAST = %s; const C = %s; const A = %s; const CLEAR = %s; const CUT = %s; const FLOOR = 0;\n%s" % (
        json.dumps(cast(v["poses"], v.get("squeeze", 1.0))), json.dumps(v["C"]), v["A"], json.dumps(v.get("clear", [])), json.dumps(v.get("cut")), LIB)
    shot = {"venue": v["venue"], "out": "poster/out/%s.jpg" % name, "hud": False, "freeze": True,
            "settle": v.get("settle", 6000), "routes": {"/poster/marina.glb": MARINA}, "after": after,
            "cameras": v["cams"], "render": 3000, "size": v.get("size", [1920, 1080])}
    os.makedirs(os.path.join(HERE, "shots"), exist_ok=True)
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    p = os.path.join(HERE, "shots", name + ".json")
    json.dump(shot, open(p, "w"))
    print("wrote", p)


for n in sys.argv[1:]:
    write(n)
