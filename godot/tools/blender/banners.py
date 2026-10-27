"""The club's hanging banners for the upper walls: four designs painted as flat shapes and rendered to textures (like the mural),
each hung from a brass rod as gently rippled cloth with tassels. Writes godot/assets/textures/banner_<k>.png and
godot/assets/venue/props/banner_<k>.glb (pivot on the wall at floor level, the banner's top at 8.6 m, front toward Godot +Z), and
godot/data/placements/banners.json.

    blender -b -P godot/tools/blender/banners.py
"""

import os, sys, math, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from lib import *

BW, BH = 4.0, 10.0  # a banner's canvas (Blender units), rendered at 128 px per unit: 512 × 1280
_z = [0.0]


def flat(name, hex_):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*srgb(hex_), 1)
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def shape(name, pts, hex_):
    _z[0] += 0.01
    bm = bmesh.new()
    bm.faces.new([bm.verts.new((x, y, _z[0])) for x, y in pts])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(flat(name, hex_))
    return o


def circle(name, cx, cy, r, hex_, n=64):
    return shape(name, [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)], hex_)


def rect(name, x0, y0, x1, y1, hex_):
    return shape(name, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], hex_)


def label(name, body, x, y, size, hex_, face="BarlowCondensed-Black"):
    _z[0] += 0.01
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    f = font(face)
    if f:
        cu.font = f
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.location = (x, y, _z[0])
    o.data.materials.append(flat(name, hex_))
    return o


def anchor(cx, cy, s, hex_):
    rect("AShank", cx - 0.07 * s, cy - 0.9 * s, cx + 0.07 * s, cy + 0.75 * s, hex_)
    rect("AStock", cx - 0.45 * s, cy + 0.45 * s, cx + 0.45 * s, cy + 0.57 * s, hex_)
    circle("AEye", cx, cy + 0.9 * s, 0.16 * s, hex_, 32)
    arc_o = [(cx + 0.7 * s * math.cos(a), cy - 0.25 * s + 0.65 * s * math.sin(a)) for a in np.linspace(math.pi * 1.1, math.pi * 1.9, 24)]
    arc_i = [(cx + 0.56 * s * math.cos(a), cy - 0.25 * s + 0.52 * s * math.sin(a)) for a in np.linspace(math.pi * 1.9, math.pi * 1.1, 24)]
    shape("AArms", arc_o + arc_i, hex_)


def chevrons(y, hex_):
    """The swallow-tail bottom edge: two points."""
    shape("TailL", [(0, y), (BW / 2, y), (0, y - 0.9)], hex_)
    shape("TailR", [(BW / 2, y), (BW, y), (BW, y - 0.9)], hex_)


def render_banner(k, design):
    reset()
    _z[0] = 0.0
    design()
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.samples = 8
    s.view_settings.view_transform = "Standard"
    s.render.film_transparent = True
    s.render.resolution_x, s.render.resolution_y = 512, 1280
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    s.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = BH
    cam.location = (BW / 2, BH / 2, 10)
    s.camera = cam
    path = os.path.join(TEXTURES, f"banner_{k}_alpha.png")
    s.render.filepath = path
    s.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    print("BANNER", path)
    return path


def crest():
    rect("Field", 0, 0.9, BW, BH, "#1d3557")
    chevrons(0.9, "#1d3557")
    rect("EdgeL", 0.18, 0.9, 0.3, BH - 0.2, "#f2b33d")
    rect("EdgeR", BW - 0.3, 0.9, BW - 0.18, BH - 0.2, "#f2b33d")
    label("Top", "HARBOURSIDE", BW / 2, 8.6, 0.62, "#f3e6c9")
    circle("Ring", BW / 2, 5.6, 1.45, "#f3e6c9")
    circle("RingIn", BW / 2, 5.6, 1.28, "#2f8c88")
    anchor(BW / 2, 5.55, 1.15, "#f3e6c9")
    label("Bottom", "SWIM CLUB", BW / 2, 3.25, 0.62, "#f3e6c9")
    label("Year", "EST. 1962", BW / 2, 2.35, 0.42, "#f2b33d")


def gala():
    rect("Field", 0, 0.9, BW, BH, "#ef6a4c")
    chevrons(0.9, "#ef6a4c")
    rect("Band", 0, BH - 1.0, BW, BH - 0.7, "#f3e6c9")
    label("Top", "GALA", BW / 2, 8.15, 0.95, "#f3e6c9")
    label("Top2", "CHAMPIONS", BW / 2, 7.25, 0.55, "#1d3557")
    # a cup
    shape("Cup", [(1.2, 6.3), (2.8, 6.3), (2.55, 5.1), (2.15, 4.8), (1.85, 4.8), (1.45, 5.1)], "#f2b33d")
    rect("Stem", 1.88, 4.2, 2.12, 4.85, "#f2b33d")
    rect("Base", 1.5, 3.95, 2.5, 4.25, "#f2b33d")
    for y, t in ((3.2, "1974"), (2.5, "1988"), (1.8, "2003 · 2019")):
        label(f"Y{y}", t, BW / 2, y, 0.48, "#f3e6c9")


def waves():
    rect("Field", 0, 0.9, BW, BH, "#2f8c88")
    chevrons(0.9, "#2f8c88")
    for j, y0 in enumerate((2.0, 2.9, 3.8)):
        pts = [(x, y0 + 0.22 * math.sin(x * 3.1 + j)) for x in np.linspace(0, BW, 40)]
        shape(f"Wave{j}", pts + [(BW, y0 - 0.5), (0, y0 - 0.5)], ["#7cc6e3", "#4fb1a0", "#f3e6c9"][j])
    for i, (t, y) in enumerate((("SWIM", 8.3), ("SPLASH", 7.1), ("SMILE", 5.9))):
        label(f"W{i}", t, BW / 2, y, 0.9, ["#f3e6c9", "#f2b33d", "#f3e6c9"][i])


def league():
    rect("Field", 0, 0.9, BW, BH, "#f2b33d")
    chevrons(0.9, "#f2b33d")
    label("Top", "COUNTY", BW / 2, 8.3, 0.75, "#1d3557")
    label("Top2", "LEAGUE", BW / 2, 7.4, 0.75, "#1d3557")
    for i in range(5):  # a row of stars
        cx = 0.7 + i * 0.65
        pts = []
        for k in range(10):
            r = 0.26 if k % 2 == 0 else 0.11
            a = math.pi / 2 + k * math.pi / 5
            pts.append((cx + r * math.cos(a), 6.2 + r * math.sin(a)))
        shape(f"Star{i}", pts, "#ef6a4c")
    label("Div", "DIVISION ONE", BW / 2, 4.9, 0.5, "#1d3557")
    label("Yr", "2024 · 2025", BW / 2, 4.1, 0.46, "#ef6a4c")
    circle("Medal", BW / 2, 2.6, 0.7, "#ef6a4c")
    circle("MedalIn", BW / 2, 2.6, 0.5, "#f3e6c9")
    label("One", "1", BW / 2, 2.6, 0.7, "#1d3557")


def banner_mesh(k, tex):
    """The cloth: 1.2 × 3.0 m, gently rippled, hanging from a brass rod at 8.6 m; tassels at the swallow-tail points."""
    reset()
    W_, H_ = 1.2, 3.0
    top = 8.6
    cloth_m = mat(f"banner_{k}", "#ffffff", 0.85, image=tex)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    nx, ny = 12, 24
    verts = {}
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            x = (u - 0.5) * W_
            z = top - (1 - v) * H_
            y = -0.06 - 0.025 * math.sin(u * math.pi * 3 + 0.6) * (1 - v * 0.6)
            verts[i, j] = bm.verts.new((x, y, z))
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new([verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]])
            for l, (a, b) in zip(f.loops, [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]):
                l[uv].uv = (a / nx, b / ny)
    me = bpy.data.meshes.new("Cloth")
    bm.to_mesh(me)
    bm.free()
    cloth = bpy.data.objects.new("Cloth", me)
    bpy.context.scene.collection.objects.link(cloth)
    set_mat(cloth, cloth_m)
    smooth(cloth, 60)
    parts = [cloth]
    brass = mat("brass")
    parts.append(cyl("Rod", 0.022, W_ + 0.3, (-(W_ + 0.3) / 2, -0.06, top + 0.03), brass, 16, rot=(0, math.pi / 2, 0)))
    for sx in (-1, 1):
        parts.append(sphere(f"Finial{sx}", 0.045, (sx * (W_ / 2 + 0.17), -0.06, top + 0.03), brass, 16, 8))
        parts.append(cyl(f"Bracket{sx}", 0.012, 0.08, (sx * (W_ / 2 + 0.08), -0.08, top + 0.03), brass, 8, rot=(math.pi / 2, 0, 0)))
    # tassels at the two tail points (the tails end 0.27 m below the cloth's straight bottom edge in the texture)
    for sx in (-1, 1):
        tz = top - H_
        parts.append(cyl(f"TasselCord{sx}", 0.006, 0.12, (sx * W_ / 2 * 0.98, -0.06, tz - 0.12), mat("mustard"), 6))
        parts.append(cyl(f"Tassel{sx}", 0.03, 0.16, (sx * W_ / 2 * 0.98, -0.06, tz - 0.28), mat("mustard"), 12, r2=0.012))
    root = parent_all(parts, f"Banner{k}")
    export(os.path.join(VENUE, "props", f"banner_{k}.glb"), [root])


if __name__ == "__main__":
    for k, d in enumerate((crest, gala, waves, league), 1):
        tex = render_banner(k, d)
        banner_mesh(k, tex)
    Zf, Zb = 13.5 - 0.0, -16.7
    placements = [
        # above the changing rooms on the -Z wall (facing +Z): two each side
        {"asset": "props/banner_1.glb", "pos": [-11.9, 0, Zb], "rot": 0, "note": "-Z wall above the MEN changing room: the crest"},
        {"asset": "props/banner_3.glb", "pos": [-9.5, 0, Zb], "rot": 0, "note": "-Z wall above the MEN changing room"},
        {"asset": "props/banner_2.glb", "pos": [9.5, 0, Zb], "rot": 0, "note": "-Z wall above the WOMEN changing room: gala champions"},
        {"asset": "props/banner_1.glb", "pos": [11.9, 0, Zb], "rot": 0, "note": "-Z wall above the WOMEN changing room: the crest"},
        # above the viewing gallery on the +Z wall (facing -Z), smaller
        {"asset": "props/banner_4.glb", "pos": [-6.0, 1.59, Zf], "rot": 180, "scale": 0.85, "note": "+Z wall above the gallery (85%: from 6.35 to 8.9 m, clear of the window's sign and the cornice)"},
        {"asset": "props/banner_1.glb", "pos": [-2.0, 1.59, Zf], "rot": 180, "scale": 0.85, "note": "+Z wall above the gallery (85%: from 6.35 to 8.9 m, clear of the window's sign and the cornice)"},
        {"asset": "props/banner_3.glb", "pos": [2.0, 1.59, Zf], "rot": 180, "scale": 0.85, "note": "+Z wall above the gallery (85%: from 6.35 to 8.9 m, clear of the window's sign and the cornice)"},
        {"asset": "props/banner_2.glb", "pos": [6.0, 1.59, Zf], "rot": 180, "scale": 0.85, "note": "+Z wall above the gallery (85%: from 6.35 to 8.9 m, clear of the window's sign and the cornice)"},
    ]
    path = os.path.join(GODOT, "data", "placements", "banners.json")
    json.dump(placements, open(path, "w"), indent=1)
    print("PLACEMENTS", path)
