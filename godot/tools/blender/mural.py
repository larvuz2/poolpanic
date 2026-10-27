"""The mural on the end wall behind the starting blocks: a hand-painted harbour at sunset, the club's name in a retro script on a
ribbon. Flat shapes in Blender rendered with emission-only colours (an exact palette), then given a painted canvas grain.
Writes godot/assets/textures/mural.png (3200 × 1000, for a 15.2 × 4.75 m panel).

    blender -b -P godot/tools/blender/mural.py
"""

import os, sys, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from lib import *

reset()
W, H = 32.0, 10.0  # the canvas in Blender units (x right, y up), rendered at 100 px per unit
_layer = [0.0]


def flat(name, hex_):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*srgb(hex_), 1)
    e.inputs["Strength"].default_value = 1.0
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def shape(name, pts, hex_):
    """A flat polygon at the next layer up (later shapes cover earlier ones)."""
    _layer[0] += 0.01
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, _layer[0])) for x, y in pts]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(flat(name + "_m", hex_))
    return o


def circle(name, cx, cy, r, hex_, n=64, squash=1.0):
    return shape(name, [(cx + r * math.cos(2 * math.pi * k / n), cy + r * squash * math.sin(2 * math.pi * k / n)) for k in range(n)], hex_)


def rect(name, x0, y0, x1, y1, hex_):
    return shape(name, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], hex_)


def band(name, y_fn, y_floor, hex_, x0=-1.0, x1=W + 1, steps=240):
    """The area under a curve: a hill line, a wave band."""
    pts = [(x0 + (x1 - x0) * k / steps, y_fn(x0 + (x1 - x0) * k / steps)) for k in range(steps + 1)]
    return shape(name, pts + [(x1, y_floor), (x0, y_floor)], hex_)


def label(name, body, x, y, size, hex_, face="BarlowCondensed-Black", align="CENTER"):
    _layer[0] += 0.01
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    f = font(face)
    if f:
        cu.font = f
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.location = (x, y, _layer[0])
    o.data.materials.append(flat(name + "_m", hex_))
    return o


# ---- the sky: bands from peach at the horizon to blue, a low sun with its rings -------------------------------------------
sky = ["#f9d9a8", "#f6c99a", "#f2b996", "#e9ad9b", "#b9b8c4", "#8fbcd6", "#6fafd6"]
for k, c in enumerate(sky):
    rect(f"Sky{k}", -1, 4.6 + k * 0.85, W + 1, H + 1, c)
circle("SunGlow2", 24.5, 5.4, 3.3, "#fbe0b0")
circle("SunGlow1", 24.5, 5.4, 2.5, "#fcd28f")
circle("Sun", 24.5, 5.4, 1.7, "#f8b44f")
# clouds: soft stacked ellipses
for k, (cx, cy, s) in enumerate([(5, 8.6, 1.0), (13.5, 9.1, 0.8), (19, 8.2, 0.7), (29, 8.8, 0.9)]):
    for j, (dx, dy, r) in enumerate([(-0.9, 0, 0.55), (0, 0.25, 0.75), (0.95, 0.05, 0.6), (0.3, -0.15, 0.6)]):
        circle(f"Cloud{k}_{j}", cx + dx * s, cy + dy * s, r * s, "#fff1df", 40, 0.62)

# ---- the far coast: hills in three teals, a town along the harbour wall -----------------------------------------------------
band("HillFar", lambda x: 5.6 + 0.9 * math.sin(x * 0.23 + 1.2) + 0.4 * math.sin(x * 0.61), 3.5, "#9cc7bd")
band("HillMid", lambda x: 4.9 + 1.2 * math.exp(-((x - 6) ** 2) / 18) + 0.5 * math.sin(x * 0.4 + 0.3), 3.5, "#6fae9f")
# the town: houses in the palette with roofs and windows
houses = ["#ef6a4c", "#f2b33d", "#f3e6c9", "#7cc6e3", "#f2b48f", "#2f8c88", "#f4f1ea", "#ef8a74"]
x = 9.0
k = 0
rng = np.random.default_rng(7)
while x < 21.5:
    w = 0.7 + rng.random() * 0.6
    h = 0.9 + rng.random() * 0.9
    c = houses[k % len(houses)]
    rect(f"House{k}", x, 4.2, x + w, 4.2 + h, c)
    roof = "#8a5a33" if k % 3 else "#1d3557"
    shape(f"Roof{k}", [(x - 0.06, 4.2 + h), (x + w + 0.06, 4.2 + h), (x + w / 2, 4.2 + h + 0.38)], roof)
    for wy in np.arange(4.45, 4.2 + h - 0.2, 0.42):
        for wx in np.arange(x + 0.14, x + w - 0.2, 0.3):
            rect(f"Win{k}_{wx:.1f}_{wy:.1f}", wx, wy, wx + 0.13, wy + 0.2, "#fff1d6" if rng.random() < 0.4 else "#36506e")
    x += w + 0.04
    k += 1
rect("HarbourWall", 8.6, 3.9, 22, 4.25, "#d9c3a0")
rect("HarbourWallTop", 8.6, 4.2, 22, 4.3, "#efe2c4")

# ---- the lighthouse on its rocks (left), red and white, its lamp glowing ------------------------------------------------
band("Rocks", lambda x: 3.6 + 1.3 * math.exp(-((x - 3.2) ** 2) / 3.0), 2.0, "#5b6f78", x0=0.0, x1=7.0)
lx, base_y = 3.2, 4.7
for k in range(6):
    y0 = base_y + k * 0.62
    w0 = 0.62 - k * 0.045
    w1 = 0.62 - (k + 1) * 0.045
    shape(f"Tower{k}", [(lx - w0, y0), (lx + w0, y0), (lx + w1, y0 + 0.62), (lx - w1, y0 + 0.62)], "#ef6a4c" if k % 2 == 0 else "#f4f1ea")
rect("Gallery", lx - 0.5, base_y + 3.72, lx + 0.5, base_y + 3.84, "#1d3557")
rect("Lamp", lx - 0.28, base_y + 3.84, lx + 0.28, base_y + 4.3, "#fde7a6")
shape("Cupola", [(lx - 0.36, base_y + 4.3), (lx + 0.36, base_y + 4.3), (lx, base_y + 4.75)], "#1d3557")
shape("Beam", [(lx + 0.25, base_y + 4.1), (lx + 6.5, base_y + 4.9), (lx + 6.5, base_y + 3.4)], "#fdeec4")

# ---- the sea: rolling bands of waves with curling crests, from the horizon to the bottom edge -----------------------------
sea = ["#7cc6e3", "#4fb1a0", "#2f8c88", "#2a6f8f", "#1d3557"]
for k, c in enumerate(sea):
    y0 = 3.6 - k * 0.78
    ph = k * 1.7
    band(f"Sea{k}", lambda x, y0=y0, ph=ph, k=k: y0 + 0.16 * math.sin(x * (0.9 + 0.15 * k) + ph) + 0.08 * math.sin(x * 2.3 + ph), -1.0, c)
    # crests: little white curls along the top of each band
    if k > 2:
        continue
    n_curls = 9 + k * 2
    for j in range(n_curls):
        cx = (j + 0.5 * (k % 2)) * (W / n_curls) + 0.6
        cy = y0 + 0.16 * math.sin(cx * (0.9 + 0.15 * k) + ph) + 0.08 * math.sin(cx * 2.3 + ph)
        r = 0.2 + 0.06 * k
        circle(f"Curl{k}_{j}", cx, cy + r * 0.2, r, "#f4f1ea", 24)
        circle(f"CurlIn{k}_{j}", cx + r * 0.25, cy + r * 0.05, r * 0.72, c, 24)

# ---- sailing boats and gulls ------------------------------------------------------------------------------------------------
for k, (bx, by, s, sail) in enumerate([(6.3, 3.72, 0.8, "#f4f1ea"), (25.2, 3.78, 1.0, "#ef6a4c"), (29.4, 3.74, 0.75, "#f2b33d")]):
    shape(f"Hull{k}", [(bx - 0.9 * s, by), (bx + 0.9 * s, by), (bx + 0.65 * s, by - 0.32 * s), (bx - 0.65 * s, by - 0.32 * s)], "#1d3557")
    shape(f"Sail{k}", [(bx - 0.05 * s, by + 0.1), (bx - 0.05 * s, by + 1.9 * s), (bx + 0.85 * s, by + 0.1)], sail)
    shape(f"Jib{k}", [(bx - 0.15 * s, by + 0.1), (bx - 0.15 * s, by + 1.5 * s), (bx - 0.75 * s, by + 0.1)], "#f9e4c3")
for k, (gx, gy, s) in enumerate([(9.5, 7.6, 0.4), (10.6, 8.1, 0.3), (21.5, 7.2, 0.35), (12.3, 7.0, 0.25), (28.3, 6.6, 0.3)]):
    shape(f"Gull{k}", [(gx - s, gy + 0.15 * s), (gx - s * 0.5, gy + 0.35 * s), (gx, gy), (gx + s * 0.5, gy + 0.35 * s), (gx + s, gy + 0.15 * s), (gx + s * 0.5, gy + 0.2 * s), (gx, gy - 0.12 * s), (gx - s * 0.5, gy + 0.2 * s)], "#2a3b55")

# swimmers and a friendly fish in the waves
for k, (sx, sy, cap) in enumerate([(7.0, 2.4, "#ef6a4c"), (11.4, 1.7, "#f2b33d"), (23.0, 2.1, "#f4f1ea")]):
    circle(f"Head{k}", sx, sy, 0.24, "#f2b48f")
    shape(f"Cap{k}", [(sx - 0.25, sy + 0.02), (sx + 0.25, sy + 0.02), (sx + 0.18, sy + 0.22), (sx, sy + 0.27), (sx - 0.18, sy + 0.22)], cap)
    shape(f"Arm{k}", [(sx + 0.15, sy - 0.05), (sx + 0.75, sy + 0.55), (sx + 0.85, sy + 0.45), (sx + 0.3, sy - 0.12)], "#f2b48f")
    circle(f"Splash{k}", sx - 0.35, sy - 0.2, 0.14, "#f4f1ea", 20)
fx, fy = 29.0, 1.2
shape("FishBody", [(fx - 0.7, fy), (fx - 0.2, fy + 0.4), (fx + 0.5, fy + 0.25), (fx + 0.7, fy), (fx + 0.5, fy - 0.25), (fx - 0.2, fy - 0.4)], "#f2b33d")
shape("FishTail", [(fx - 0.65, fy), (fx - 1.1, fy + 0.35), (fx - 1.05, fy - 0.35)], "#ef6a4c")
circle("FishEye", fx + 0.38, fy + 0.08, 0.07, "#1d3557", 16)

# ---- the club's name on a ribbon, centred -----------------------------------------------------------------------------------
cx, cy = W / 2, 7.05
shape("RibbonTailL", [(cx - 7.6, cy - 0.7), (cx - 6.0, cy - 0.7), (cx - 6.0, cy + 0.2), (cx - 7.6, cy + 0.2), (cx - 7.1, cy - 0.25)], "#c9714a")
shape("RibbonTailR", [(cx + 7.6, cy - 0.7), (cx + 6.0, cy - 0.7), (cx + 6.0, cy + 0.2), (cx + 7.6, cy + 0.2), (cx + 7.1, cy - 0.25)], "#c9714a")
shape("Ribbon", [(cx - 6.4, cy - 0.55), (cx + 6.4, cy - 0.55), (cx + 6.4, cy + 0.55), (cx - 6.4, cy + 0.55)], "#ef6a4c")
rect("RibbonEdgeT", cx - 6.4, cy + 0.47, cx + 6.4, cy + 0.55, "#f4f1ea")
rect("RibbonEdgeB", cx - 6.4, cy - 0.55, cx + 6.4, cy - 0.47, "#f4f1ea")
label("ClubSub", "COMMUNITY  SWIM  CLUB  ·  EST. 1962", cx, cy, 0.62, "#f4f1ea")
label("ClubNameShadow", "Harbourside", cx + 0.14, cy + 1.62, 3.1, "#1d3557", "Pacifico-Regular")
label("ClubName", "Harbourside", cx, cy + 1.78, 3.1, "#f3e6c9", "Pacifico-Regular")

# ---- a painted border -------------------------------------------------------------------------------------------------------
for name, x0, y0, x1, y1 in [("BorderB", 0, 0, W, 0.22), ("BorderT", 0, H - 0.22, W, H), ("BorderL", 0, 0, 0.22, H), ("BorderR", W - 0.22, 0, W, H)]:
    rect(name, x0, y0, x1, y1, "#f3e6c9")

# ---- render (orthographic, flat colours, the Standard view so the palette stays exact) --------------------------------------
s = bpy.context.scene
s.render.engine = "CYCLES"
s.cycles.samples = 8
s.cycles.use_denoising = False
s.view_settings.view_transform = "Standard"
s.render.resolution_x, s.render.resolution_y = 3200, 1000
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
s.collection.objects.link(cam)
cam.data.type = "ORTHO"
cam.data.ortho_scale = W
cam.location = (W / 2, H / 2, 10)
s.camera = cam
tmp = "/tmp/pp-mural-raw.png"
s.render.filepath = tmp
bpy.ops.render.render(write_still=True)

# ---- the painted canvas: a soft brush grain and a little colour drift ------------------------------------------------------
img = bpy.data.images.load(tmp)
w, h = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
rng = np.random.default_rng(3)
grain = rng.random((h // 4 + 1, w // 4 + 1)).astype(np.float32)
grain = np.kron(grain, np.ones((4, 4), np.float32))[:h, :w]
streak = np.repeat(rng.random((1, w)).astype(np.float32), h, 0)
px[..., :3] *= (0.955 + 0.06 * grain[..., None]) * (0.985 + 0.03 * streak[..., None])
out = bpy.data.images.new("mural", w, h)
out.colorspace_settings.name = "Non-Color"
out.pixels.foreach_set(px.ravel())
path = os.path.join(TEXTURES, "mural.png")
out.filepath_raw = path
out.file_format = "PNG"
out.save()
print("MURAL", path)
