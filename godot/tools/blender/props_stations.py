"""The Community Pool's gameplay furniture and stations: benches, the fins rack, the chlorine and first-aid (eye-relief) stations,
the lifeguard chair, the life rings, the office counter, the drinking fountain, the big plant, the dog-treat table, the recycling
bins, and the wall kit (skimmer rack, fish net, fuse box) with the mop and bucket. Each is its own GLB in
godot/assets/venue/props/, pivot on the floor at the centre of its footprint (godot/docs/look.md), front toward Godot +Z (Blender -Y);
wall-mounted ones have their pivot on the wall face at floor level. Carried things (fins_pair, chlorine_bucket, life_ring, mop) are
centred on their pivot as noted on each.

    blender -b -P godot/tools/blender/props_stations.py [-- [--preview] [asset ...]]

The label textures (signs, stickers, screens) are drawn here with numpy and saved in godot/assets/textures/props/.
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
from lib import *

PROPS = os.path.join(VENUE, "props")
TEXP = os.path.join(TEXTURES, "props")
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
ONLY = [a for a in ARGS if not a.startswith("--")]
R90 = math.pi / 2


# ---------------------------------------------------------------------------------------------------------------------------
# Small helpers on top of lib.py
# ---------------------------------------------------------------------------------------------------------------------------


def jn(objs, name):
    """Join parts into one object whose origin is the scene origin (each part's location baked into its mesh first), so the
    group can then be rotated about and moved from its own modelling origin."""
    objs = [o for o in objs if o]
    for o in objs:
        o.data.transform(Matrix.Translation(o.location))
        o.location = (0, 0, 0)
    return join(objs, name)


def strut(name, p0, p1, w, m, bev=0.008, d=None):
    """A square bar from p0 to p1 (legs, braces)."""
    p0, p1 = Vector(p0), Vector(p1)
    v = p1 - p0
    o = box(name, (w, d or w, v.length), (0, 0, 0), m, 0)
    o.rotation_euler = v.to_track_quat("Z", "Y").to_euler()
    o.location = (p0 + p1) / 2
    apply_all(o)
    if bev:
        bevel(o, bev, 2)
    return o


def rod(name, p0, p1, r, m, verts=12):
    """A round bar from p0 to p1."""
    p0, p1 = Vector(p0), Vector(p1)
    v = p1 - p0
    o = cyl(name, r, v.length, (0, 0, 0), m, verts)
    o.data.transform(Matrix.Translation((0, 0, -v.length / 2)))
    o.rotation_euler = v.to_track_quat("Z", "Y").to_euler()
    o.location = (p0 + p1) / 2
    apply_all(o)
    return o


def glove(name, m, loc, rot):
    """A chemical gauntlet, flat, fingers down (an outline extruded and bevelled)."""
    pts = [(-0.05, 0.0), (-0.055, -0.13), (-0.075, -0.16), (-0.1, -0.21), (-0.085, -0.225), (-0.05, -0.19), (-0.045, -0.3),
           (-0.035, -0.31), (-0.025, -0.24), (-0.02, -0.33), (-0.008, -0.335), (0.0, -0.245), (0.008, -0.33), (0.02, -0.33),
           (0.024, -0.24), (0.033, -0.31), (0.045, -0.305), (0.05, -0.2), (0.055, -0.13), (0.06, 0.0), (0.075, 0.12), (-0.065, 0.12)]
    o = extrude_shape(name, pts, 0.022, (0, 0, -0.011), m)
    bevel(o, 0.008, 1)
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    return o


def hook(name, loc, m, l=0.06):
    """A wall hook sticking out toward -Y with an upturned tip."""
    x, y, z = loc
    return poly_tube(name, [(x, y, z), (x, y - l, z), (x, y - l - 0.012, z + 0.03)], 0.006, m, sides=8, corner=0.012)


def label(name, w, h, loc, file, rot=(R90, 0, 0), rough=0.6):
    return plane(name, w, h, loc, img_mat(file.replace(".png", ""), file, rough), rot)


def tris(o):
    n = 0
    for c in [o, *o.children_recursive]:
        if c.type == "MESH":
            n += sum(len(p.vertices) - 2 for p in c.data.polygons)
    return n


def ltext(name, body, size, loc=(0, 0, 0), rot=(R90, 0, 0), m=None, align="CENTER", face=None, depth=0.0, res=2, spacing=1.0):
    """Lighter 3D text than lib.text: curve resolution 2 and flat by default (a few hundred triangles a word)."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = depth / 2
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.resolution_u = res
    cu.space_character = spacing
    f = font(face or "BarlowCondensed-Bold")
    if f:
        cu.font = f
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = rot
    o.location = loc
    for s in bpy.context.selected_objects:
        s.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    apply_all(o)
    if m:
        set_mat(o, m)
    return o


def uv_box(o, su=1.0, sv=1.0, along="x"):
    """Box-project UVs (metres / su, sv) so a texture's u runs along the object's `along` axis (wood grain, stripes)."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    off = Vector(o.location)
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co + off
            if along == "x":
                u, v = (c.x, c.y) if ax == 2 else (c.x, c.z) if ax == 1 else (c.y, c.z)
            elif along == "y":
                u, v = (c.y, c.x) if ax == 2 else (c.x, c.z) if ax == 1 else (c.y, c.z)
            else:  # z
                u, v = (c.x, c.y) if ax == 2 else (c.z, c.x) if ax == 1 else (c.z, c.y)
            l[uv].uv = (u / su, v / sv)
    bm.to_mesh(me)
    bm.free()
    return o


def uv_plane_fit(o, axis_u="x", axis_v="z"):
    """UVs 0..1 over the object's bounds along two axes (labels on boxes)."""
    me = o.data
    idx = {"x": 0, "y": 1, "z": 2}
    iu, iv = idx[axis_u.strip("-")], idx[axis_v.strip("-")]
    cs = [v.co for v in me.vertices]
    lo_u, hi_u = min(c[iu] for c in cs), max(c[iu] for c in cs)
    lo_v, hi_v = min(c[iv] for c in cs), max(c[iv] for c in cs)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            u = (l.vert.co[iu] - lo_u) / max(hi_u - lo_u, 1e-6)
            v = (l.vert.co[iv] - lo_v) / max(hi_v - lo_v, 1e-6)
            if axis_u.startswith("-"):
                u = 1 - u
            if axis_v.startswith("-"):
                v = 1 - v
            l[uv].uv = (u, v)
    bm.to_mesh(me)
    bm.free()
    return o


def img_mat(name, file, rough=0.5, metal=0.0, emit=0.0):
    """A material with an image from textures/props/; `emit` > 0 makes it glow with the image's colours (screens, displays)."""
    fresh = name not in bpy.data.materials
    m = mat(name, "#ffffff", rough, metal, image=os.path.join(TEXP, file))
    if fresh and "alpha" in file:
        # alpha through a Round node: glTF exports it as MASK (clipped), which sorts cleanly in Godot
        nt = m.node_tree
        p = nt.nodes["Principled BSDF"]
        tex = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
        rnd = nt.nodes.new("ShaderNodeMath")
        rnd.operation = "ROUND"
        nt.links.new(tex.outputs["Alpha"], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], p.inputs["Alpha"])
        try:
            m.surface_render_method = "DITHERED"
        except Exception:
            pass
    if emit:
        nt = m.node_tree
        p = nt.nodes["Principled BSDF"]
        tex = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
        nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = emit
    return m


def two_sided(m):
    m.use_backface_culling = False
    return m


def clear_mat(name, hex_, alpha=0.35, rough=0.08):
    """A see-through material (glass, clear plastic tubing): pair it with a `Glass_` object name for Godot."""
    m = mat(name, hex_, rough, 0.0, alpha=alpha)
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        pass
    return m


def lathe(name, prof, m=None, seg=32, loc=(0, 0, 0), sm=True):
    """Spin a profile [(r, z), ...] round Blender Z: pots, bottles, bowls, buckets."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in prof]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=seg, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if m:
        set_mat(o, m)
    if sm:
        smooth(o, 50)
    return o


def ribbon(name, rows, m=None, thick=0.0, loc=(0, 0, 0)):
    """A sheet through rows of points (each row a list of (x, y, z) across the sheet): leaves, fin blades, towels."""
    bm = bmesh.new()
    grid = [[bm.verts.new(p) for p in row] for row in rows]
    for i in range(len(grid) - 1):
        a, b = grid[i], grid[i + 1]
        for j in range(len(a) - 1):
            if a[j] is None or a[j + 1] is None or b[j] is None or b[j + 1] is None:
                continue
            bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if thick:
        s = o.modifiers.new("Solid", "SOLIDIFY")
        s.thickness = thick
        s.offset = 0
        apply_all(o)
    if m:
        set_mat(o, m)
    smooth(o, 50)
    return o


def faces_mat(o, m, test):
    """Give the faces whose centre passes `test(Vector)` the material `m` (bands on a ring, stripes on a drum)."""
    if m.name not in [s.name for s in o.data.materials if s]:
        o.data.materials.append(m)
    k = [s.name for s in o.data.materials].index(m.name)
    for p in o.data.polygons:
        if test(p.center):
            p.material_index = k
    return o


def place(o, loc=None, rot=None):
    if rot is not None:
        o.rotation_euler = rot
    if loc is not None:
        o.location = loc
    apply_all(o)
    return o


def xform(o, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Rotate an object about its own origin then move it by loc (applied)."""
    o.rotation_euler = rot
    apply_all(o)
    o.location = Vector(o.location) + Vector(loc)
    return o


def screw(name, loc, m, r=0.009, h=0.005, rot=(0, 0, 0)):
    return cyl(name, r, h, loc, m, 8, rot=rot)


def finish(root, name, view):
    """Preview (with --preview) and export one prop."""
    if PREVIEW:
        preview(name, *view, size=(640, 480), samples=12)
    export(os.path.join(PROPS, name + ".glb"), [root])
    print(f"TRIS {name} {tris(root)}")


# ---------------------------------------------------------------------------------------------------------------------------
# Label textures, drawn with numpy (2× supersampled), saved under textures/props/
# ---------------------------------------------------------------------------------------------------------------------------


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


class Canvas:
    """A small raster to draw labels on: shapes in output pixels, y down."""

    def __init__(self, w, h, bg="#ffffff", transparent=False, ss=3):
        self.w, self.h, self.ss = w, h, ss
        W, H = w * ss, h * ss
        self.rgb = np.empty((H, W, 3), np.float32)
        self.rgb[:] = hexrgb(bg)
        self.a = np.zeros((H, W), np.float32) if transparent else np.ones((H, W), np.float32)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.x = (xx + 0.5) / ss
        self.y = (yy + 0.5) / ss
        self.transparent = transparent

    def fill(self, mask, col, alpha=1.0):
        c = hexrgb(col) if isinstance(col, str) else np.asarray(col, np.float32)
        self.rgb[mask] = self.rgb[mask] * (1 - alpha) + c * alpha
        self.a[mask] = np.maximum(self.a[mask], alpha)

    def rect(self, x0, y0, x1, y1, col, r=0.0, alpha=1.0):
        if r <= 0:
            m = (self.x >= x0) & (self.x <= x1) & (self.y >= y0) & (self.y <= y1)
        else:
            cx = np.clip(self.x, x0 + r, x1 - r)
            cy = np.clip(self.y, y0 + r, y1 - r)
            m = (self.x - cx) ** 2 + (self.y - cy) ** 2 <= r * r
            m &= (self.x >= x0) & (self.x <= x1) & (self.y >= y0) & (self.y <= y1)
        self.fill(m, col, alpha)

    def circle(self, cx, cy, r, col, r0=0.0, alpha=1.0, sx=1.0, sy=1.0):
        d = np.hypot((self.x - cx) / sx, (self.y - cy) / sy)
        self.fill((d <= r) & (d >= r0), col, alpha)

    def poly_mask(self, pts):
        x, y = self.x, self.y
        inside = np.zeros(x.shape, bool)
        n = len(pts)
        for i in range(n):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            if y0 == y1:
                continue
            cond = (y0 > y) != (y1 > y)
            xint = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
            inside ^= cond & (x < xint)
        return inside

    def poly(self, pts, col, alpha=1.0):
        self.fill(self.poly_mask(pts), col, alpha)

    def seg(self, x0, y0, x1, y1, w, col, alpha=1.0):
        px, py = self.x - x0, self.y - y0
        dx, dy = x1 - x0, y1 - y0
        L2 = max(dx * dx + dy * dy, 1e-9)
        t = np.clip((px * dx + py * dy) / L2, 0, 1)
        d = np.hypot(px - t * dx, py - t * dy)
        self.fill(d <= w / 2, col, alpha)

    def path(self, pts, w, col, alpha=1.0):
        for a, b in zip(pts, pts[1:]):
            self.seg(*a, *b, w, col, alpha)

    def save(self, name):
        s = self.ss
        H, W = self.h, self.w
        rgb = self.rgb.reshape(H, s, W, s, 3).mean(axis=(1, 3))
        a = self.a.reshape(H, s, W, s).mean(axis=(1, 3))
        px = np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)[..., None]], axis=2)[::-1].astype(np.float32)
        img = bpy.data.images.new(name, W, H, alpha=self.transparent)
        img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(px.ravel())
        os.makedirs(TEXP, exist_ok=True)
        path = os.path.join(TEXP, name + ".png")
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
        bpy.data.images.remove(img)
        return path


def tex_wood(name, base, dark, w=512, h=128, seed=3):
    """Honey timber along u: one repeat per metre along the grain, 0.25 m across."""
    r = np.random.default_rng(seed)
    U, V = np.meshgrid(np.arange(w) / w, np.arange(h) / h)
    warp = 0.025 * np.sin(2 * np.pi * (2 * U + r.random())) + 0.012 * np.sin(2 * np.pi * (7 * U + r.random()))
    rows = r.random(h)
    for _ in range(3):
        rows = (np.roll(rows, 1) + rows + np.roll(rows, -1)) / 3
    rows = (rows - rows.min()) / (rows.max() - rows.min())
    idx = (((V + warp) % 1.0) * h).astype(int) % h
    streak = rows[idx]
    rings = 0.5 + 0.5 * np.sin(2 * np.pi * (9 * (V + 1.6 * warp) + 0.3 * np.sin(2 * np.pi * U)))
    t = np.clip(0.55 * streak**1.5 + 0.25 * rings**6, 0, 1)
    rgb = hexrgb(base) * (1 - t[..., None]) + hexrgb(dark) * t[..., None]
    rgb *= (0.96 + 0.04 * np.sin(2 * np.pi * (31 * V + 2 * warp)))[..., None]
    c = Canvas(w, h, ss=1)
    c.rgb[:] = rgb
    return c.save(name)


def diamond(c, s=128, border="#d6423a"):
    c.poly([(s / 2, 3), (s - 3, s / 2), (s / 2, s - 3), (3, s / 2)], border)
    c.poly([(s / 2, 15), (s - 15, s / 2), (s / 2, s - 15), (15, s / 2)], "#ffffff")


def make_textures():
    os.makedirs(TEXP, exist_ok=True)
    tex_wood("wood_honey", "#d39a5c", "#a96a35", seed=3)
    tex_wood("wood_dark", "#9a6438", "#6e4224", seed=7)

    # a striped beach towel: stripes across v
    c = Canvas(128, 128, "#5aa9d6", ss=1)
    for y0, y1, col in [(10, 22, "#f2e2c4"), (26, 30, "#ef8a74"), (34, 46, "#f2e2c4"), (74, 86, "#f2e2c4"), (90, 94, "#ef8a74"), (98, 110, "#f2e2c4")]:
        c.rect(0, y0, 128, y1, col)
    c.rgb *= (0.94 + 0.06 * np.random.default_rng(2).random((128, 128)))[..., None]
    c.save("towel_stripes")

    # the club's crest: a sun over waves in a navy roundel
    c = Canvas(128, 128, "#1d3557", transparent=True)
    c.circle(64, 64, 62, "#1d3557")
    c.circle(64, 64, 55, "#f3e6c9", r0=50)
    c.circle(64, 64, 49, "#7cc6e3")
    m = (np.hypot(c.x - 64, c.y - 70) <= 22) & (c.y <= 72)
    c.fill(m, "#f2b33d")
    for k, (y0, col) in enumerate([(70, "#f4f1ea"), (80, "#2f8c88"), (90, "#f4f1ea"), (100, "#2f8c88")]):
        wave = y0 + 4 * np.sin((c.x + 10 * k) / 7)
        c.fill((c.y >= wave) & (np.hypot(c.x - 64, c.y - 64) <= 49), col)
    c.save("crest_alpha")

    # GHS diamonds: oxidiser (flame over circle) and harmful (!)
    c = Canvas(128, 128, transparent=True)
    diamond(c)
    c.circle(64, 84, 15, "#1b1c1f", r0=8)
    c.poly([(64, 30), (75, 46), (79, 60), (74, 70), (54, 70), (49, 60), (53, 47), (60, 55)], "#1b1c1f")
    c.rect(44, 100, 84, 106, "#1b1c1f")
    c.save("ghs_flame_alpha")
    c = Canvas(128, 128, transparent=True)
    diamond(c)
    c.poly([(57, 34), (71, 34), (67, 80), (61, 80)], "#1b1c1f")
    c.circle(64, 92, 7, "#1b1c1f")
    c.save("ghs_excl_alpha")

    # high voltage
    c = Canvas(128, 112, transparent=True)
    c.poly([(64, 4), (124, 108), (4, 108)], "#1b1c1f")
    c.poly([(64, 22), (108, 100), (20, 100)], "#f6cf45")
    c.poly([(70, 38), (50, 74), (63, 74), (55, 98), (80, 62), (67, 62), (76, 38)], "#1b1c1f")
    c.save("voltage_alpha")

    # the lifeguards' rota on a clipboard
    rr = random.Random(5)
    c = Canvas(192, 256, "#f6f1e4")
    c.rect(0, 0, 192, 30, "#ef6a4c")
    for x0, x1 in [(12, 70), (78, 104), (112, 150)]:
        c.rect(x0, 11, x1, 19, "#fff6ec", r=3)
    cols = [10, 60, 92, 124, 156, 184]
    for y in range(44, 250, 20):
        c.seg(8, y, 186, y, 1.2, "#9fb3c8")
    for x in cols:
        c.seg(x, 40, x, 244, 1.2, "#9fb3c8")
    c.rect(10, 104, 184, 122, "#f6e05e", alpha=0.6)
    for row in range(10):
        y = 54 + row * 20
        xs = 14
        while xs < 52:
            L = rr.randint(5, 12)
            c.path([(xs, y + rr.uniform(-1, 1)), (xs + L / 2, y - 3), (xs + L, y + rr.uniform(-1, 2))], 1.6, "#1d3557")
            xs += L + 3
        for k in range(4):
            cx = cols[k + 1] + 16
            r = rr.random()
            if r < 0.45:
                c.path([(cx - 6, y), (cx - 2, y + 4), (cx + 6, y - 5)], 2.0, "#2f8c88")
            elif r < 0.6:
                c.circle(cx, y, 5, "#d6423a", r0=3.6)
    c.save("rota")

    # the office monitor: four pool cameras
    c = Canvas(256, 160, "#0f151b")
    rr = random.Random(9)
    for i in range(2):
        for j in range(2):
            x0, y0 = 6 + i * 125, 6 + j * 77
            c.rect(x0, y0, x0 + 119, y0 + 71, "#c9b88f")
            c.rect(x0 + 14, y0 + 10, x0 + 105, y0 + 62, "#3a9fc4")
            for k in range(1, 4):
                c.seg(x0 + 14, y0 + 10 + k * 13, x0 + 105, y0 + 10 + k * 13, 1.2, "#1d3557")
            for _ in range(5):
                c.circle(x0 + rr.uniform(20, 100), y0 + rr.uniform(14, 58), 2.4, rr.choice(["#ef6a4c", "#f6cf45", "#f4f1ea"]))
            c.rect(x0 + 4, y0 + 3, x0 + 34, y0 + 7, "#f4f1ea")
    c.circle(244, 10, 3.5, "#ff3b30")
    c.rgb *= (0.9 + 0.1 * (np.sin(c.y * 2.2) > 0))[..., None]
    c.save("cctv")

    # the bottle filler's counter (seven segments)
    c = Canvas(160, 40, "#0b1410")
    segs = {"a": (0, 0, 1, 0), "b": (1, 0, 1, 1), "c": (1, 1, 1, 2), "d": (0, 2, 1, 2), "e": (0, 1, 0, 2), "f": (0, 0, 0, 1), "g": (0, 1, 1, 1)}
    digits = {"1": "bc", "2": "abged", "4": "fgbc", "8": "abcdefg", "6": "afgedc"}
    for k, d in enumerate("12486"):
        ox, oy = 14 + k * 28, 6
        for s in digits[d]:
            x0, y0, x1, y1 = segs[s]
            c.seg(ox + x0 * 14, oy + y0 * 14, ox + x1 * 14, oy + y1 * 14, 3.4, "#5dff9a")
    c.save("counter_digits")

    # the wet-floor sign's face: a slipping figure in a warning triangle
    c = Canvas(128, 160, "#f6cf45")
    c.poly([(64, 52), (118, 148), (10, 148)], "#1b1c1f")
    c.poly([(64, 66), (106, 141), (22, 141)], "#f6cf45")
    c.circle(74, 86, 6, "#1b1c1f")
    c.path([(70, 94), (60, 116)], 7, "#1b1c1f")
    c.path([(60, 116), (78, 126), (86, 136)], 5.5, "#1b1c1f")
    c.path([(60, 116), (44, 124), (40, 134)], 5.5, "#1b1c1f")
    c.path([(68, 99), (82, 104)], 4.5, "#1b1c1f")
    c.path([(66, 99), (52, 94)], 4.5, "#1b1c1f")
    c.rect(28, 136, 100, 139, "#1b1c1f")
    c.save("wetfloor")

    # a paw print label
    c = Canvas(128, 96, "#f3e6c9")
    c.rect(4, 4, 124, 92, "#ef6a4c", r=12)
    c.rect(10, 10, 118, 86, "#f6f1e4", r=9)
    for dx, dy, r in [(-16, -10, 6), (-6, -17, 6.5), (6, -17, 6.5), (16, -10, 6)]:
        c.circle(64 + dx, 66 + dy, r, "#8a5a33")
    c.circle(64, 72, 11, "#8a5a33", sx=1.2, sy=0.85)
    c.save("paw_label")

    # the treat jar's label: WOOF! drawn in strokes, a paw below
    c = Canvas(192, 112, "#f3e6c9")
    c.rect(3, 3, 189, 109, "#ef6a4c", r=12)
    c.rect(9, 9, 183, 103, "#f6f1e4", r=9)
    ink = "#8a5a33"
    x = 34
    c.path([(x, 20), (x + 8, 54), (x + 16, 30), (x + 24, 54), (x + 32, 20)], 7, ink)
    c.circle(x + 50, 37, 17, ink, r0=10.5, sx=0.75)
    c.circle(x + 78, 37, 17, ink, r0=10.5, sx=0.75)
    c.path([(x + 106, 54), (x + 106, 20), (x + 122, 20)], 7, ink)
    c.seg(x + 106, 36, x + 118, 36, 7, ink)
    c.poly([(x + 132, 19), (x + 140, 19), (x + 138, 45), (x + 134, 45)], ink)
    c.circle(x + 136, 52, 4, ink)
    for dx, dy, r in [(-13, -8, 5), (-5, -14, 5.5), (5, -14, 5.5), (13, -8, 5)]:
        c.circle(96 + dx, 86 + dy, r, ink)
    c.circle(96, 91, 9, ink, sx=1.2, sy=0.8)
    c.save("woof_label")

    # tiles for the fountain's plinth: 4 x 4 small glazed tiles
    c = Canvas(256, 256, "#e9e1cf", ss=1)
    rr = random.Random(4)
    for i in range(4):
        for j in range(4):
            col = rr.choice(["#3e9e8f", "#4fb1a0", "#47a796", "#5cbcae", "#3a978a"])
            c.rect(i * 64 + 3, j * 64 + 3, i * 64 + 61, j * 64 + 61, col, r=4)
            c.rect(i * 64 + 8, j * 64 + 6, i * 64 + 40, j * 64 + 12, "#ffffff", r=3, alpha=0.18)
    c.save("tile_sea_small")

    # netting
    c = Canvas(128, 128, transparent=True, ss=2)
    for k in range(-8, 9):
        o = k * 16
        c.seg(o, 0, o + 128, 128, 2.0, "#f0efe8")
        c.seg(o + 128, 0, o, 128, 2.0, "#f0efe8")
    c.save("net_alpha")

    # recycling icons (white on a transparent ground)
    c = Canvas(128, 128, transparent=True)
    c.poly([(56, 14), (72, 14), (72, 32), (86, 48), (86, 114), (42, 114), (42, 48), (56, 32)], "#ffffff")
    c.rect(54, 8, 74, 16, "#ffffff", r=2)
    c.save("icon_bottle_alpha")
    c = Canvas(128, 128, transparent=True)
    c.rect(24, 22, 104, 106, "#ffffff", r=4)
    for y in (40, 54, 68, 82):
        c.rect(34, y, 94, y + 5, "#1d3557", alpha=0.0)
        c.fill((c.x > 34) & (c.x < 94) & (c.y > y) & (c.y < y + 5), "#000000", 0.0)
    c.a[((c.x > 34) & (c.x < 94) & (((c.y > 40) & (c.y < 45)) | ((c.y > 56) & (c.y < 61)) | ((c.y > 72) & (c.y < 77)) | ((c.y > 88) & (c.y < 93))))] = 0
    c.save("icon_paper_alpha")
    c = Canvas(128, 128, transparent=True)
    c.circle(64, 76, 40, "#ffffff", sx=1.0, sy=0.95)
    c.poly([(52, 40), (76, 40), (70, 26), (58, 26)], "#ffffff")
    c.poly([(54, 22), (64, 30), (74, 22), (70, 16), (58, 16)], "#ffffff")
    c.save("icon_general_alpha")

    # first aid: AED (heart and bolt) and eye wash (an eye and drops)
    c = Canvas(128, 128, "#1f9a5a")
    c.circle(48, 52, 21, "#ffffff")
    c.circle(80, 52, 21, "#ffffff")
    c.poly([(29, 60), (99, 60), (64, 104)], "#ffffff")
    c.poly([(70, 34), (52, 66), (64, 66), (56, 92), (80, 56), (68, 56), (76, 34)], "#d6423a")
    c.save("aed_sign")
    c = Canvas(128, 128, "#1f9a5a")
    m = (np.hypot(c.x - 64, c.y - 92) <= 56) & (np.hypot(c.x - 64, c.y + 4) <= 56)
    c.fill(m, "#ffffff")
    c.circle(64, 44, 15, "#2f8c88")
    c.circle(64, 44, 7, "#1b1c1f")
    c.circle(58, 39, 3, "#ffffff")
    for dx in (-22, 0, 22):
        c.circle(64 + dx, 96, 7, "#7cc6e3")
        c.poly([(64 + dx - 6.5, 94), (64 + dx + 6.5, 94), (64 + dx, 80)], "#7cc6e3")
    c.save("eyewash_sign")

    # a droplet roundel for the fountain sign
    c = Canvas(96, 96, transparent=True)
    c.circle(48, 48, 46, "#2f8c88")
    c.circle(48, 58, 19, "#ffffff")
    c.poly([(30, 54), (66, 54), (48, 20)], "#ffffff")
    c.save("droplet_alpha")
    print("TEXTURES done")


# ---------------------------------------------------------------------------------------------------------------------------
# Shared materials
# ---------------------------------------------------------------------------------------------------------------------------


def M():
    return dict(
        wood=img_mat("wood_honey", "wood_honey.png", 0.55),
        wood_dark=img_mat("wood_dark", "wood_dark.png", 0.6),
        navy=mat("navy_paint", "#1f3a5f", 0.38, 0.15),
        steel=mat("steel"),
        chrome=mat("chrome"),
        brushed=mat("steel_brushed"),
        rubber=mat("rubber"),
        white=mat("white"),
        whiteg=mat("white_gloss"),
        cream=mat("cream"),
        coral=mat("coral_gloss"),
        mustard=mat("mustard_gloss"),
        sea=mat("sea_gloss"),
        paper=mat("paper"),
        black=mat("black"),
        rope=mat("rope", "#efe4cc", 0.9),
    )


def wood_box(name, size, loc, m, along="x", bev=0.008, rot=(0, 0, 0)):
    o = box(name, size, loc, m, bev, rot=rot)
    return uv_box(o, 1.0, 0.25, along)


# ---------------------------------------------------------------------------------------------------------------------------
# 1. Benches
# ---------------------------------------------------------------------------------------------------------------------------


def bench_frame(x, mm):
    parts = []
    pts = [(x, 0, 0.055), (x, -0.455, 0.055), (x, -0.42, 0.39), (x, 0.42, 0.39), (x, 0.455, 0.055), (x, 0.0, 0.055)]
    parts.append(poly_tube(f"Frame{x:+.1f}", pts, 0.032, mm["navy"], sides=12, corner=0.09))
    parts.append(box(f"ShelfRail{x:+.1f}", (0.05, 0.86, 0.04), (x, 0, 0.18), mm["navy"], 0.01))
    parts.append(box(f"SeatPlate{x:+.1f}", (0.09, 0.82, 0.012), (x, 0, 0.421), mm["navy"], 0.004))
    for s in (-1, 1):
        parts.append(box(f"Foot{x:+.1f}{s}", (0.085, 0.13, 0.024), (x, s * 0.425, 0.012), mm["rubber"], 0.008))
        parts.append(box(f"Gusset{x:+.1f}{s}", (0.012, 0.09, 0.09), (x, s * 0.37, 0.355), mm["navy"], 0.004, rot=(s * 0.78, 0, 0)))
    return parts


def bench_base(mm):
    parts = []
    for k in range(5):
        y = -0.376 + k * 0.188
        parts.append(wood_box(f"Slat{k}", (3.38, 0.168, 0.045), (0, y, 0.4495), mm["wood"], bev=0.012))
        for x in (-1.4, 0, 1.4):
            parts.append(screw(f"Bolt{k}{x:+.1f}", (x, y, 0.472), mm["chrome"], 0.011, 0.004))
    for k in range(3):
        y = -0.2 + k * 0.2
        parts.append(wood_box(f"ShelfSlat{k}", (3.3, 0.16, 0.03), (0, y, 0.215), mm["wood_dark"], bev=0.008))
    for x in (-1.4, 0, 1.4):
        parts += bench_frame(x, mm)
    # a little brass plaque on the front edge: a memorial bench
    parts.append(box("Plaque", (0.18, 0.004, 0.03), (0.55, -0.4615, 0.4495), mat("brass"), 0.002))
    parts.append(ltext("PlaqueText", "M. WATERS 1962", 0.016, (0.55, -0.4645, 0.4495), m=mat("navy")))
    return parts


def folded_towel(name, loc, size=(0.42, 0.3, 0.085), rotz=0.0):
    tm = img_mat("towel_stripes", "towel_stripes.png", 0.95)
    t = box(name, size, (0, 0, size[2] / 2), tm, 0.03, 3)
    uv_box(t, 0.42, 0.42, "y")
    lips = []
    for k in range(3):
        z = size[2] * (k + 0.5) / 3
        lips.append(box(f"{name}Fold{k}", (size[0] - 0.02, 0.02, size[2] / 3 - 0.006), (0, -size[1] / 2 + 0.004, z), tm, 0.008))
        uv_box(lips[-1], 0.42, 0.42, "x")
    o = jn([t, *lips], name)
    o.rotation_euler = (0, 0, rotz)
    o.location = loc
    apply_all(o)
    return o


def flip_flop(name, loc, rotz, sole, strap):
    pts = []
    for k in range(24):
        a = 2 * math.pi * k / 24
        y = 0.13 * math.cos(a)
        w = 0.042 + 0.012 * math.cos(a) - 0.008 * math.cos(2 * a)
        pts.append((w * math.sin(a), y))
    s = extrude_shape(name + "Sole", pts, 0.022, (0, 0, 0), sole, bev=0.006)
    s2 = extrude_shape(name + "Bed", [(x * 0.9, y * 0.94) for x, y in pts], 0.004, (0, 0, 0.022), mat("ff_bed", "#f3e6c9", 0.8))
    st = tube(name + "Strap", [(-0.04, -0.01, 0.024), (-0.025, 0.05, 0.05), (0.0, 0.085, 0.028), (0.025, 0.05, 0.05), (0.04, -0.01, 0.024)], 0.008, strap)
    o = jn([s, s2, st], name)
    o.rotation_euler = (0, 0, rotz)
    o.location = loc
    apply_all(o)
    return o


def goggles(name, m_strap, m_lens, loc=(0, 0, 0), rot=(0, 0, 0), strap=True):
    parts = []
    for s in (-1, 1):
        parts.append(torus(f"{name}Rim{s}", 0.022, 0.007, (s * 0.03, 0, 0), m_strap, 16, 8, rot=(R90, 0, 0)))
        parts.append(sphere(f"{name}Lens{s}", 0.02, (s * 0.03, -0.003, 0), m_lens, 12, 6, scale=(1, 0.45, 1)))
    parts.append(tube(f"{name}Bridge", [(-0.01, -0.004, 0.0), (0, -0.006, 0.004), (0.01, -0.004, 0.0)], 0.003, m_strap, res=2, sides=4))
    if strap:
        parts.append(tube(f"{name}Strap", [(-0.052, 0, 0), (-0.07, 0.04, 0), (-0.05, 0.09, 0), (0.05, 0.09, 0), (0.07, 0.04, 0), (0.052, 0, 0)], 0.004, m_strap, res=2, sides=4))
    o = jn(parts, name)
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    return o


def bench(dressed=False):
    """A poolside bench, 3.4 x 0.98: five honey slats on three navy steel frames, a slatted shelf below. The dressed one has a
    swimmer's things on it."""
    reset()
    mm = M()
    parts = bench_base(mm)
    if dressed:
        parts.append(folded_towel("Towel", (-1.0, 0.05, 0.472), rotz=0.08))
        # a hand towel draped over the front edge
        path = [(-0.05, 0.476), (-0.3, 0.476), (-0.44, 0.472), (-0.485, 0.43), (-0.495, 0.36), (-0.49, 0.3)]
        drape = ribbon("Drape", [[(x, y, z) for x in (-0.62, -0.5, -0.38)] for (y, z) in path], img_mat("towel_stripes", "towel_stripes.png", 0.95), 0.01)
        uv_box(drape, 0.42, 0.42, "y")
        parts.append(drape)
        parts.append(flip_flop("FlipFlopL", (-0.55, -0.05, 0.0), 0.35, mat("coral"), mat("navy")))
        parts.append(flip_flop("FlipFlopR", (-0.38, 0.06, 0.0), -0.2, mat("coral"), mat("navy")))
        # a reusable bottle
        bm_ = mat("bottle_sea", "#2f9c95", 0.25, 0.3)
        bottle = lathe("Bottle", [(0.0, 0.0), (0.034, 0.0), (0.037, 0.01), (0.037, 0.19), (0.03, 0.215), (0.019, 0.225), (0.019, 0.235), (0.0, 0.235)], bm_, 20, (0.32, -0.22, 0.472))
        cap = cyl("BottleCap", 0.022, 0.035, (0.32, -0.22, 0.705), mat("chrome"), 16, bev=0.004)
        loop = torus("BottleLoop", 0.014, 0.0035, (0.32, -0.22, 0.745), mat("black"), 16, 6, rot=(R90, 0, 0))
        band = cyl("BottleBand", 0.0375, 0.05, (0.32, -0.22, 0.54), mat("white"), 20)
        parts += [bottle, cap, loop, band]
        # the swim bag (a duffel) with goggles hanging off its handle
        navy = mat("bag_navy", "#22426b", 0.7)
        bag = sphere("Bag", 0.25, (1.0, 0.02, 0.472 + 0.12), navy, 24, 12, scale=(1.0, 0.62, 0.5))
        for s in (-1, 1):
            parts.append(sphere(f"BagEnd{s}", 0.2, (1.0 + s * 0.215, 0.02, 0.59), mat("coral"), 16, 10, scale=(0.12, 0.62, 0.52)))
        zip_ = tube("BagZip", [(0.82, 0.02, 0.706), (1.0, 0.02, 0.721), (1.18, 0.02, 0.706)], 0.005, mat("black"))
        handles = [tube(f"BagHandle{s}", [(0.88, s * 0.06 + 0.02, 0.69), (0.92, s * 0.075 + 0.02, 0.79), (1.08, s * 0.075 + 0.02, 0.79), (1.12, s * 0.06 + 0.02, 0.69)], 0.012, mat("navy")) for s in (-1, 1)]
        crest = plane("BagCrest", 0.1, 0.1, (1.06, -0.137, 0.6), img_mat("crest", "crest_alpha.png", 0.6), rot=(R90 - 0.25, 0, 0))
        parts += [bag, zip_, crest, *handles]
        # goggles: hooked over the front handle, dangling over the seat's edge
        parts.append(goggles("Goggles", mat("goggle_strap", "#ef7aa6", 0.6), clear_mat("goggle_lens", "#7cc6e3", 0.6, 0.05), (0.98, -0.47, 0.37), (0.25, 0, 0.1), strap=False))
        parts.append(tube("GoggleStrap", [(0.93, -0.47, 0.38), (0.92, -0.45, 0.46), (0.93, -0.3, 0.55), (0.96, -0.12, 0.72), (1.0, -0.04, 0.785), (1.04, -0.12, 0.72), (1.05, -0.3, 0.55), (1.04, -0.45, 0.46), (1.03, -0.47, 0.38)], 0.004, mat("goggle_strap"), res=2, sides=4))
        # a paperback left open, face down
        book = box("Book", (0.13, 0.19, 0.018), (0.62, 0.18, 0.481), mat("book", "#e7c255", 0.7), 0.004, rot=(0, 0, 0.3))
        page = box("BookPages", (0.124, 0.18, 0.012), (0.62, 0.18, 0.479), mat("paper"), 0.002, rot=(0, 0, 0.3))
        parts += [book, page]
    root = parent_all(parts, "BenchDressed" if dressed else "Bench")
    finish(root, "bench_dressed" if dressed else "bench", ((0, 0, 0.35), 3.6, 30, -30))


# ---------------------------------------------------------------------------------------------------------------------------
# 2. Fins rack and a pair of fins
# ---------------------------------------------------------------------------------------------------------------------------


def fin(name, main, dark, flip=False):
    """One swim fin lying flat, 0.55 long along +X: a slipper-like foot pocket at -X, the blade with raised side rails at +X."""
    rows = []
    xs = [-0.08 + 0.04 * k for k in range(9)]
    span = xs[-1] - xs[0]
    for x in xs:
        t = (x - xs[0]) / span
        w = 0.068 + 0.04 * t
        z = 0.007 + 0.028 * t * t
        notch = 0.018 if t > 0.99 else 0.0
        rows.append([(x - notch * (1 - abs(u)), u * w, z + 0.003 * (1 - abs(u))) for u in (-1, -0.5, 0, 0.5, 1)])
    blade = ribbon(name + "Blade", rows, main, 0.007)
    rail_pts = lambda s: [(x, s * (0.068 + 0.04 * (x - xs[0]) / span), 0.009 + 0.028 * ((x - xs[0]) / span) ** 2) for x in xs[::2]]
    rails = [tube(name + f"Rail{s}", rail_pts(s), 0.008, dark, res=2, sides=4) for s in (-1, 1)]
    pocket = sphere(name + "Pocket", 0.15, (-0.15, 0, 0.032), dark, 14, 7, scale=(1.0, 0.5, 0.2))
    toe = sphere(name + "Toe", 0.09, (-0.07, 0, 0.022), dark, 10, 5, scale=(1.0, 0.75, 0.22))
    hole = sphere(name + "Opening", 0.05, (-0.235, 0, 0.055), mat("fin_hole", "#151618", 0.9), 10, 5, scale=(1.0, 0.8, 0.18))
    hole.rotation_euler = (0, 0.35, 0)
    apply_all(hole)
    rib = tube(name + "Rib", [(-0.04, 0, 0.022), (0.1, 0, 0.016), (0.22, 0, 0.03)], 0.006, dark, res=2, sides=4)
    o = jn([blade, *rails, pocket, toe, hole, rib], name)
    if flip:
        o.scale.y = -1
        apply_all(o)
    return o


FIN_COLOURS = [("#3d7fd1", "#24538f"), ("#f6cf45", "#c99a1c"), ("#ef6a4c", "#b8432c")]


def fin_pair(k, stacked=False):
    main, dark = FIN_COLOURS[k]
    mm_, md = mat(f"fin{k}", main, 0.35), mat(f"fin{k}_dark", dark, 0.45)
    a = fin(f"FinA{k}", mm_, md)
    b = fin(f"FinB{k}", mm_, md)
    if stacked:
        b.rotation_euler = (0, 0, 0.06)
        b.location = (0.01, 0.01, 0.022)
    else:
        a.rotation_euler = (0, 0, 0.04)
        a.location = (0, -0.105, 0)
        b.rotation_euler = (0, 0, -0.05)
        b.location = (0.03, 0.105, 0.0)
    apply_all(a)
    apply_all(b)
    return jn([a, b], f"Fins_{k + 1}")


def kickboard(name, loc, col, rotz=0.0):
    pts = [(0.15 * math.cos(math.pi * k / 9), 0.13 + 0.09 * math.sin(math.pi * k / 9)) for k in range(10)]
    pts += [(-0.15, -0.16), (-0.12, -0.2), (0.12, -0.2), (0.15, -0.16)]
    o = extrude_shape(name, pts, 0.03, (0, 0, 0), col)
    bevel(o, 0.008, 1)
    o.rotation_euler = (0, 0, rotz)
    o.location = loc
    apply_all(o)
    return o


def pull_buoy(name, loc, rot, a, b):
    p1 = cyl(name + "A", 0.042, 0.18, (0, -0.044, -0.09), a, 12)
    p2 = cyl(name + "B", 0.042, 0.18, (0, 0.044, -0.09), b, 12)
    for p in (p1, p2):
        bevel(p, 0.014, 1)
    w = box(name + "Web", (0.03, 0.04, 0.14), (0, 0, 0), b, 0.006)
    o = jn([p1, p2, w], name)
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    return o


def fins_rack():
    """The fins rack, 2.06 x 0.96: a low timber-topped navy steel table with three bays, a pair of fins lying in each on angled
    pegs (Fins_1..3, hidden by Godot as they are taken), a crate of pull-buoys in the end bay, kickboards and an odd fin on the
    shelf below, a sign front and back."""
    reset()
    mm = M()
    parts = []
    H = 0.72
    # legs, aprons, rails
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box(f"Leg{sx}{sy}", (0.05, 0.05, H - 0.02), (sx * 1.0, sy * 0.45, (H - 0.02) / 2), mm["navy"], 0.01))
            parts.append(box(f"Foot{sx}{sy}", (0.07, 0.07, 0.02), (sx * 1.0, sy * 0.45, 0.01), mm["rubber"], 0.006))
        parts.append(box(f"EndRail{sx}", (0.04, 0.86, 0.04), (sx * 1.0, 0, 0.12), mm["navy"], 0.008))
        parts.append(wood_box(f"EndApron{sx}", (0.03, 0.86, 0.12), (sx * 1.0, 0, H - 0.1), mm["wood_dark"], "y"))
    for sy in (-1, 1):
        parts.append(box(f"Apron{sy}", (1.96, 0.025, 0.16), (0, sy * 0.465, H - 0.11), mm["navy"], 0.008))
        parts.append(box(f"LowRail{sy}", (1.96, 0.04, 0.04), (0, sy * 0.45, 0.12), mm["navy"], 0.008))
    # the top: timber slats along x, bays split by cleats, a raised front lip
    for k in range(6):
        y = -0.4 + k * 0.16
        parts.append(wood_box(f"TopSlat{k}", (2.06, 0.15, 0.03), (0, y, H + 0.015), mm["wood"], bev=0.008))
    for x in (-0.53, -0.03, 0.47):
        parts.append(wood_box(f"Cleat{x:+.2f}", (0.035, 0.9, 0.035), (x, 0, H + 0.047), mm["wood_dark"], "y"))
    parts.append(wood_box("Lip", (2.06, 0.03, 0.05), (0, -0.465, H + 0.04), mm["wood_dark"]))
    # angled pegs that the fin pockets slide over, and the pairs (lying with their blades toward the back)
    peg = mat("peg", "#e0b07a", 0.5)
    for k, xc in enumerate((-0.78, -0.28, 0.22)):
        for s in (-1, 1):
            parts.append(cyl(f"Peg{k}{s}", 0.011, 0.075, (xc + s * 0.105, -0.405, H + 0.02), peg, 10, rot=(0.35, 0, 0)))
            parts.append(sphere(f"PegKnob{k}{s}", 0.017, (xc + s * 0.105, -0.43, H + 0.09), peg, 8, 4))
        p = fin_pair(k)
        p.rotation_euler = (0, 0, R90)
        p.location = (xc, -0.07, H + 0.03)
        apply_all(p)
        parts.append(p)
        parts.append(ltext(f"BayNo{k}", str(k + 1), 0.05, (xc, -0.481, H + 0.04), m=mat("cream")))
    # the end bay: a coral crate of pull-buoys
    crate_m = mat("crate", "#2f8c88", 0.55)
    cx, cy, cz = 0.76, 0.0, H + 0.03
    cw, cd, ch = 0.5, 0.42, 0.24
    walls = [
        box("CrateFloor", (cw, cd, 0.02), (cx, cy, cz + 0.01), crate_m, 0.006),
        box("CrateF", (cw, 0.02, ch), (cx, cy - cd / 2 + 0.01, cz + ch / 2), crate_m, 0.006),
        box("CrateB", (cw, 0.02, ch), (cx, cy + cd / 2 - 0.01, cz + ch / 2), crate_m, 0.006),
        box("CrateL", (0.02, cd, ch), (cx - cw / 2 + 0.01, cy, cz + ch / 2), crate_m, 0.006),
        box("CrateR", (0.02, cd, ch), (cx + cw / 2 - 0.01, cy, cz + ch / 2), crate_m, 0.006),
    ]
    slot = mat("crate_slot", "#1f5f5c", 0.7)
    for sy in (-1, 1):
        for k in range(4):
            walls.append(box(f"CrateSlot{sy}{k}", (0.07, 0.006, 0.08), (cx - 0.18 + k * 0.12, cy + sy * (cd / 2 + 0.0), cz + 0.09), slot, 0.002))
        walls.append(box(f"CrateHandle{sy}", (0.12, 0.006, 0.03), (cx, cy + sy * (cd / 2), cz + 0.165), slot, 0.002))
    parts.append(jn(walls, "Crate"))
    buoy_cols = [("buoy_navy", "#22426b"), ("buoy_yellow", "#f6cf45"), ("buoy_pink", "#ef7aa6"), ("buoy_white", "#f4f1ea")]
    for k, (bx, by, bz, rx, ry, rz) in enumerate([(-0.09, -0.08, 0.1, 1.45, 0, 0.1), (0.1, -0.07, 0.1, 1.5, 0.1, -0.2), (-0.08, 0.09, 0.1, 1.6, 0, 0.3), (0.09, 0.09, 0.11, 1.5, 0.2, 0.0), (0.0, 0.0, 0.2, 1.2, 0.5, 1.2)]):
        a = mat(*buoy_cols[k % 4], 0.8)
        b = mat(*buoy_cols[(k + 1) % 4], 0.8)
        parts.append(pull_buoy(f"Buoy{k}", (cx + bx, cy + by, cz + bz), (rx, ry, rz), a, b))
    # goggles hung on a hook at the end
    parts.append(cyl("GoggleHook", 0.006, 0.06, (1.03, 0.2, 0.62), mm["chrome"], 8, rot=(0, R90, 0)))
    parts.append(goggles("GogglesHung", mat("goggle_strap2", "#3d7fd1", 0.5), clear_mat("goggle_lens2", "#f2b33d", 0.6), (1.05, 0.2, 0.55), (R90, 0, R90), True))
    # the shelf below: slats, two stacks of kickboards and an odd green fin from lost property
    for k in range(4):
        parts.append(wood_box(f"ShelfSlat{k}", (1.96, 0.18, 0.025), (0, -0.33 + k * 0.22, 0.155), mm["wood_dark"], bev=0.006))
    foam = [mat("foam_blue"), mat("foam_yellow"), mat("foam_pink"), mat("foam_green"), mat("foam_orange")]
    for s, x0 in enumerate((-0.62, -0.18)):
        for k in range(3):
            parts.append(kickboard(f"Kick{s}{k}", (x0 + random.Random(k + s * 7).uniform(-0.02, 0.02), 0.0, 0.168 + k * 0.031), foam[(k + s * 2) % 5], R90 + random.Random(k).uniform(-0.08, 0.08)))
    odd = fin("OddFin", mat("fin_green", "#62c48a", 0.35), mat("fin_green_dark", "#2f8a55", 0.45))
    odd.rotation_euler = (0, 0, 2.6)
    odd.location = (0.5, 0.05, 0.168)
    apply_all(odd)
    parts.append(odd)
    tag = box("OddTag", (0.05, 0.035, 0.002), (0.38, 0.0, 0.215), mat("paper"), 0.001, rot=(0, 0.3, 0.4))
    parts.append(tag)
    # the signs on the aprons: front (the deck side) and back (the camera's side)
    cream = mat("sign_cream", "#f3e6c9", 0.5)
    parts.append(ltext("SignFront", "FINS · PLEASE RETURN", 0.09, (0, -0.4785, H - 0.11), m=cream))
    parts.append(ltext("SignBack", "FINS · PLEASE RETURN", 0.09, (0, 0.4785, H - 0.11), (R90, 0, math.pi), m=cream))
    for sy in (-1, 1):
        parts.append(plane(f"Crest{sy}", 0.12, 0.12, (sy * -0.82, sy * 0.4785, H - 0.11), img_mat("crest", "crest_alpha.png", 0.6), rot=(R90, 0, 0 if sy < 0 else math.pi)))
    root = parent_all(parts, "FinsRack")
    finish(root, "fins_rack", ((0, 0, 0.5), 3.0, 34, -35))


def fins_pair_carried(k=0):
    """A pair of fins as the coach carries them: stacked, blades along +X, centred on the pivot."""
    reset()
    p = fin_pair(k, stacked=True)
    root = parent_all([p], "FinsPair")
    if PREVIEW and k == 0:
        preview("fins_pair", (0, 0, 0.03), 1.0, 35, -30, size=(640, 480), samples=12)
    name = "fins_pair" if k == 0 else f"fins_pair_{k + 1}"
    export(os.path.join(PROPS, name + ".glb"), [root])
    print(f"TRIS {name} {tris(root)}")


# ---------------------------------------------------------------------------------------------------------------------------
# 3. The chlorine station and the bucket the coach carries
# ---------------------------------------------------------------------------------------------------------------------------


def drum(name, loc, r=0.22, h=0.86, col="#2f6fc0"):
    x, y, z = loc
    dm = mat("drum_blue", col, 0.45)
    parts = [lathe(name, [(0, 0), (r - 0.02, 0), (r, 0.02), (r, h - 0.03), (r - 0.02, h), (0, h)], dm, 28, (x, y, z))]
    for zz in (0.3, 0.58):
        parts.append(torus(name + f"Rib{zz}", r, 0.012, (x, y, z + h * zz), dm, 28, 6))
    parts.append(cyl(name + "Label", r + 0.003, 0.2, (x, y, z + 0.42), mat("label_white", "#f4f1ea", 0.7), 28))
    parts.append(label(name + "Diamond", 0.11, 0.11, (x, y - r - 0.006, z + 0.52), "ghs_excl_alpha.png"))
    for k, (dx, dy, rr_) in enumerate([(-0.1, 0.06, 0.035), (0.11, -0.04, 0.025)]):
        parts.append(cyl(name + f"Bung{k}", rr_, 0.025, (x + dx, y + dy, z + h), mat("bung", "#e9e3d3", 0.6), 12, bev=0.005))
    return parts


def jerry_can(name, loc, rotz, col="#f2efe6"):
    x, y, z = loc
    cm = mat("hdpe", col, 0.55)
    body = box(name, (0.22, 0.14, 0.3), (0, 0, 0.15), cm, 0.03, 2)
    handle = box(name + "Handle", (0.12, 0.03, 0.05), (-0.03, 0, 0.33), cm, 0.012)
    neck = cyl(name + "Neck", 0.025, 0.04, (0.07, 0, 0.3), cm, 12)
    cap = cyl(name + "Cap", 0.03, 0.03, (0.07, 0, 0.335), mat("cap_blue", "#2f6fc0", 0.5), 12, bev=0.005)
    lab = plane(name + "Label", 0.12, 0.12, (0.0, -0.0715, 0.15), img_mat("ghs_flame_alpha", "ghs_flame_alpha.png", 0.6))
    o = jn([body, handle, neck, cap, lab], name)
    o.rotation_euler = (0, 0, rotz)
    o.location = loc
    apply_all(o)
    return o


def chlorine_station():
    """The chlorine store, 1.8 x 1.2: a mustard steel chemical cabinet with hazard diamonds, two blue drums and jerry cans on a
    spill pallet, a dosing pump on the backboard feeding clear tubes into the drums, gauntlets and goggles on hooks, a sign."""
    reset()
    mm = M()
    parts = []
    must = mat("cab_mustard", "#f4c849", 0.4, 0.2)
    navy = mm["navy"]
    # the backboard on two steel legs with feet
    parts.append(box("Backboard", (1.8, 0.04, 1.62), (0, 0.58, 0.98), mat("board_grey", "#d9d6cc", 0.7), 0.01))
    for sx in (-1, 1):
        parts.append(box(f"Post{sx}", (0.06, 0.06, 1.95), (sx * 0.87, 0.53, 0.975), navy, 0.01))
        parts.append(box(f"PostFoot{sx}", (0.06, 0.3, 0.03), (sx * 0.87, 0.42, 0.015), navy, 0.008))
    parts.append(box("SignPlate", (1.6, 0.03, 0.24), (0, 0.545, 1.84), must, 0.01))
    parts.append(ltext("SignText", "CHLORINE · STAFF ONLY", 0.13, (0.04, 0.528, 1.84), m=navy))
    for sx in (-1, 1):
        parts.append(label(f"SignDiamond{sx}", 0.17, 0.17, (sx * 0.68, 0.528, 1.84), "ghs_flame_alpha.png"))
    # hazard tape along the bottom of the backboard
    stripe = mat("tape_black", "#1b1c1f", 0.6)
    parts.append(box("Tape", (1.8, 0.004, 0.06), (0, 0.558, 0.2), must, 0.0))
    for k in range(18):
        parts.append(box(f"TapeStripe{k}", (0.04, 0.002, 0.075), (-0.86 + k * 0.1, 0.555, 0.2), stripe, 0.0, rot=(0, 0.6, 0)))
    # the cabinet (left): body, two doors, louvres, handles, a padlock, the diamonds
    cx, cw, cd, chh = -0.46, 0.84, 0.46, 1.22
    cy = 0.32
    parts.append(box("Cabinet", (cw, cd, chh), (cx, cy, 0.05 + chh / 2), must, 0.015))
    parts.append(box("CabPlinth", (cw - 0.04, cd - 0.04, 0.05), (cx, cy, 0.025), navy, 0.006))
    for s in (-1, 1):
        dx = cx + s * (cw / 4)
        parts.append(box(f"Door{s}", (cw / 2 - 0.03, 0.02, chh - 0.06), (dx, cy - cd / 2 - 0.008, 0.05 + chh / 2), must, 0.008))
        for k in range(4):
            parts.append(box(f"Louvre{s}{k}", (0.26, 0.014, 0.012), (dx, cy - cd / 2 - 0.02, 0.18 + k * 0.035), mat("louvre", "#c99a2a", 0.5), 0.003, rot=(0.6, 0, 0)))
        parts.append(label(f"DoorDiamond{s}", 0.2, 0.2, (dx, cy - cd / 2 - 0.0185, 0.85), "ghs_flame_alpha.png" if s < 0 else "ghs_excl_alpha.png"))
        parts.append(box(f"DoorHandle{s}", (0.02, 0.025, 0.16), (cx + s * 0.04, cy - cd / 2 - 0.03, 0.62), mm["chrome"], 0.006))
    parts.append(box("Hasp", (0.06, 0.012, 0.03), (cx, cy - cd / 2 - 0.026, 0.72), mm["steel"], 0.004))
    parts.append(box("Padlock", (0.045, 0.02, 0.05), (cx, cy - cd / 2 - 0.04, 0.68), mat("brass"), 0.008))
    parts.append(torus("Shackle", 0.016, 0.004, (cx, cy - cd / 2 - 0.04, 0.71), mm["chrome"], 12, 6, rot=(R90, 0, 0)))
    parts.append(box("CabSign", (0.5, 0.004, 0.07), (cx, cy - cd / 2 - 0.02, 1.15), mat("label_white", "#f4f1ea", 0.7), 0.0))
    parts.append(ltext("CabSignText", "OXIDISER · KEEP DRY", 0.05, (cx, cy - cd / 2 - 0.0225, 1.15), m=mat("red")))
    # on the cabinet: a measuring jug, a test kit, a dosing log
    top = 0.05 + chh
    jug = lathe("Glass_Jug", [(0, 0), (0.06, 0), (0.07, 0.17), (0.072, 0.18), (0.066, 0.18), (0.056, 0.004), (0, 0.004)], clear_mat("jug_clear", "#e9f2f0", 0.45), 20, (cx - 0.22, cy - 0.05, top))
    jug_h = poly_tube("JugHandle", [(cx - 0.15, cy - 0.05, top + 0.15), (cx - 0.11, cy - 0.05, top + 0.13), (cx - 0.11, cy - 0.05, top + 0.05), (cx - 0.145, cy - 0.05, top + 0.035)], 0.008, mat("jug_red", "#d6423a", 0.5), sides=8, corner=0.02)
    marks = [cyl(f"JugMark{k}", 0.0662 + 0.0045 * k, 0.004, (cx - 0.22, cy - 0.05, top + 0.04 + 0.035 * k), mat("jug_red"), 20) for k in range(4)]
    parts += [jug, jug_h, *marks]
    kit = box("TestKit", (0.24, 0.14, 0.07), (cx + 0.12, cy - 0.06, top + 0.035), mat("kit_white", "#f4f1ea", 0.4), 0.012, rot=(0, 0, 0.12))
    parts.append(kit)
    for k, col in enumerate(["#ef7aa6", "#f6cf45", "#d6423a", "#7cc6e3"]):
        parts.append(cyl(f"Vial{k}", 0.012, 0.09, (cx + 0.05 + k * 0.045, cy - 0.06 + k * 0.006, top + 0.06), mat(f"vial{k}", col, 0.3), 10))
    parts.append(box("LogBook", (0.2, 0.27, 0.02), (cx + 0.2, cy + 0.12, top + 0.01), mat("logbook", "#2f8c88", 0.6), 0.004, rot=(0, 0, -0.2)))
    # the spill pallet (right) with two drums and two jerry cans
    px0, px1 = 0.02, 0.9
    pal = mat("pallet", "#2a2d33", 0.7)
    parts.append(box("Pallet", (px1 - px0, 1.06, 0.16), ((px0 + px1) / 2, -0.06, 0.08), pal, 0.02))
    for k in range(9):
        parts.append(box(f"Grid{k}", (0.02, 1.0, 0.012), (px0 + 0.05 + k * 0.1, -0.06, 0.166), mat("grid", "#4a4e57", 0.6), 0.0))
    parts += drum("DrumA", (0.25, 0.2, 0.172))
    parts += drum("DrumB", (0.67, 0.2, 0.172))
    parts.append(jerry_can("CanA", (0.24, -0.38, 0.172), 0.15))
    parts.append(jerry_can("CanB", (0.62, -0.42, 0.172), -0.3, "#f2b33d"))
    # the dosing pump on the backboard, its clear tubes into the drums, a power lead
    pump_x, pump_z = 0.46, 1.32
    parts.append(box("Pump", (0.22, 0.13, 0.26), (pump_x, 0.495, pump_z), mat("pump_white", "#eef0ef", 0.35), 0.02))
    parts.append(box("PumpFace", (0.17, 0.01, 0.12), (pump_x, 0.428, pump_z + 0.04), mat("pump_blue", "#2f6fc0", 0.4), 0.004))
    parts.append(box("PumpDisplay", (0.08, 0.006, 0.03), (pump_x - 0.02, 0.423, pump_z + 0.06), mat("lcd", "#5dff9a", 0.3, emit="#5dff9a", emit_strength=1.5), 0.0))
    parts.append(cyl("PumpKnob", 0.022, 0.02, (pump_x + 0.045, 0.43, pump_z + 0.01), mm["black"], 14, rot=(R90, 0, 0)))
    parts.append(cyl("PumpHead", 0.045, 0.05, (pump_x, 0.46, pump_z - 0.155), mat("pump_blue"), 16))
    clear = clear_mat("tube_clear", "#dff1ee", 0.4)
    parts.append(tube("Glass_TubeA", [(pump_x - 0.02, 0.46, pump_z - 0.16), (pump_x - 0.06, 0.44, 1.05), (0.2, 0.3, 1.1), (0.15, 0.26, 1.045)], 0.008, clear, res=4, sides=8))
    parts.append(tube("Glass_TubeB", [(pump_x + 0.02, 0.46, pump_z - 0.16), (pump_x + 0.08, 0.44, 1.08), (0.72, 0.3, 1.1), (0.78, 0.16, 1.045)], 0.008, clear, res=4, sides=8))
    parts.append(tube("Lead", [(pump_x + 0.11, 0.5, pump_z + 0.08), (0.7, 0.52, 1.5), (0.86, 0.54, 1.3), (0.86, 0.54, 0.7)], 0.006, mm["black"], res=3, sides=4))
    # gauntlets, goggles and an apron on hooks above the cabinet
    gm = mat("gauntlet", "#3aa057", 0.45)
    for k, gx in enumerate((-0.82, -0.68)):
        parts.append(hook(f"GloveHook{k}", (gx, 0.56, 1.58), mm["chrome"]))
        parts.append(glove(f"Gauntlet{k}", gm, (gx, 0.535, 1.6), (R90, 0.08 * (1 - 2 * k), 0)))
    parts.append(hook("GogglesHook", (-0.46, 0.56, 1.6), mm["chrome"]))
    visor = ribbon("Glass_Visor", [[(-0.46 + 0.085 * math.sin(a), 0.52 - 0.05 * math.cos(a), z) for a in (-1.2, -0.6, 0, 0.6, 1.2)] for z in (1.5, 1.56)], clear_mat("visor", "#e3f3f6", 0.5), 0.004)
    parts.append(visor)
    parts.append(tube("VisorStrap", [(-0.56, 0.5, 1.53), (-0.53, 0.54, 1.6), (-0.46, 0.55, 1.62), (-0.39, 0.54, 1.6), (-0.36, 0.5, 1.53)], 0.006, mm["black"], res=2, sides=4))
    parts.append(hook("ApronHook", (-0.2, 0.56, 1.62), mm["chrome"]))
    apron = ribbon("Apron", [[(-0.2 + x * (0.13 + 0.06 * t), 0.53 - 0.03 * t * t, 1.62 - 0.55 * t) for x in (-1, -0.5, 0, 0.5, 1)] for t in (0, 0.25, 0.5, 0.75, 1)], mat("apron", "#22426b", 0.6), 0.006)
    parts.append(apron)
    # the dosing log on a clipboard
    parts.append(box("Clipboard", (0.2, 0.012, 0.28), (0.05, 0.555, 1.45), mat("clipboard", "#8a5a33", 0.6), 0.004))
    parts.append(label("ClipRota", 0.18, 0.24, (0.05, 0.548, 1.44), "rota.png"))
    parts.append(box("Clip", (0.08, 0.016, 0.03), (0.05, 0.55, 1.58), mm["chrome"], 0.004))
    root = parent_all(parts, "ChlorineStation")
    finish(root, "chlorine_station", ((0, 0, 0.85), 3.6, 22, -28))


def chlorine_bucket():
    """The bucket of chlorine tablets the coach carries: a white pail with a wire handle, a blue label, tablets and a scoop.
    Pivot at the centre of its base."""
    reset()
    wm = mat("pail", "#f4f2ec", 0.35)
    parts = [lathe("Pail", [(0, 0), (0.12, 0), (0.125, 0.01), (0.15, 0.26), (0.158, 0.265), (0.158, 0.275), (0.146, 0.275), (0.138, 0.02), (0, 0.02)], wm, 28)]
    parts.append(torus("PailRim", 0.152, 0.006, (0, 0, 0.255), wm, 28, 6))
    lab = lathe("PailLabel", [(0.1385, 0.08), (0.1435, 0.08), (0.1475, 0.2), (0.1425, 0.2)], mat("label_blue", "#2f6fc0", 0.5), 28)
    parts.append(lab)
    parts.append(label("PailDiamond", 0.07, 0.07, (0, -0.148, 0.14), "ghs_flame_alpha.png", rot=(R90 - 0.1, 0, 0)))
    for s in (-1, 1):
        parts.append(cyl(f"Lug{s}", 0.014, 0.01, (s * 0.152, 0, 0.235), wm, 10, rot=(0, R90, 0)))
    parts.append(tube("Bail", [(-0.16, 0, 0.235), (-0.15, 0, 0.36), (0, 0, 0.42), (0.15, 0, 0.36), (0.16, 0, 0.235)], 0.004, mat("steel"), res=4, sides=8))
    parts.append(cyl("Grip", 0.012, 0.09, (-0.045, 0, 0.415), mat("black"), 10, rot=(0, R90, 0)))
    parts.append(cyl("Fill", 0.14, 0.01, (0, 0, 0.225), mat("tabs", "#f7f7f2", 0.6), 28))
    tab = mat("tablet", "#ffffff", 0.7)
    rr = random.Random(3)
    for k in range(16):
        a, r = rr.uniform(0, 6.28), 0.115 * math.sqrt(rr.random())
        parts.append(cyl(f"Tab{k}", 0.028, 0.018, (r * math.cos(a), r * math.sin(a), 0.232), tab, 12, bev=0.004, rot=(rr.uniform(-0.4, 0.4), rr.uniform(-0.4, 0.4), 0)))
    scoop = lathe("Scoop", [(0, 0), (0.04, 0), (0.042, 0.06), (0.038, 0.06), (0.036, 0.006), (0, 0.006)], mat("scoop", "#2f6fc0", 0.4), 16)
    sh = cyl("ScoopHandle", 0.01, 0.12, (0, 0, 0.03), mat("scoop"), 8, rot=(0, R90, 0))
    sc = jn([scoop, sh], "Scoop")
    sc.rotation_euler = (0.3, -0.5, 0.6)
    sc.location = (0.05, 0.03, 0.22)
    apply_all(sc)
    parts.append(sc)
    root = parent_all(parts, "ChlorineBucket")
    finish(root, "chlorine_bucket", ((0, 0, 0.2), 1.2, 30, -30))


# ---------------------------------------------------------------------------------------------------------------------------
# 4. The first-aid (eye-relief) station
# ---------------------------------------------------------------------------------------------------------------------------


def green_cross(name, size, loc, rot=(R90, 0, 0), col="#1f9a5a", plate="#f4f1ea"):
    x, y, z = loc
    parts = []
    t = size / 3
    parts.append(box(name + "V", (t, 0.008, size), (0, 0, 0), mat("cross_green", col, 0.45), 0.003))
    parts.append(box(name + "H", (size, 0.008, t), (0, 0, 0), mat("cross_green"), 0.003))
    o = jn(parts, name)
    o.rotation_euler = (rot[0] - R90, rot[1], rot[2])
    o.location = loc
    apply_all(o)
    return o


def rescue_tube(name, length=1.0, r=0.065):
    """A red foam rescue tube along local Z (base at 0), with black end clips and a yellow lanyard ring."""
    red = mat("rescue_red", "#d93a32", 0.55)
    body = cyl(name, r, length, (0, 0, 0), red, 16)
    bevel(body, 0.03, 2)
    clips = [cyl(name + f"Clip{k}", r * 0.5, 0.05, (0, 0, z), mat("black"), 10) for k, z in enumerate((-0.04, length - 0.01))]
    band = cyl(name + "Band", r + 0.003, 0.05, (0, 0, length * 0.55), mat("white"), 16)
    txt = ltext(name + "Text", "RESCUE", 0.05, (0, -r - 0.002, length * 0.35), (R90, R90, 0), mat("white"))
    return jn([body, *clips, band, txt], name)


def first_aid_station():
    """The eye-relief (first-aid) station, 1.8 x 1.2: a white counter with a green cross, a sink with a plumbed eye wash, eye-wash
    bottles and an AED on the backboard, towels, a kit, an oxygen cylinder on its trolley, a rescue tube, a clinical bin."""
    reset()
    mm = M()
    parts = []
    white, whiteg = mat("fa_white", "#f6f4ee", 0.35), mm["whiteg"]
    green = mat("fa_green", "#1f9a5a", 0.45)
    # the counter
    cy, cd, ch = 0.18, 0.76, 0.86
    parts.append(box("Counter", (1.8, cd, ch), (0, cy, 0.06 + ch / 2), white, 0.015))
    parts.append(box("Kick", (1.76, cd - 0.06, 0.06), (0, cy + 0.02, 0.03), mm["black"], 0.006))
    parts.append(box("Top", (1.84, cd + 0.06, 0.04), (0, cy - 0.01, 0.06 + ch + 0.02), mat("top_cream", "#ece4d0", 0.3), 0.012))
    parts.append(box("TopEdge", (1.84, 0.012, 0.045), (0, cy - cd / 2 - 0.045, 0.06 + ch + 0.02), green, 0.004))
    fy = cy - cd / 2
    for k in range(4):
        x = -0.675 + k * 0.45
        parts.append(box(f"Door{k}", (0.43, 0.02, ch - 0.2), (x, fy - 0.008, 0.06 + (ch - 0.2) / 2 + 0.02), whiteg, 0.008))
        parts.append(box(f"Drawer{k}", (0.43, 0.02, 0.14), (x, fy - 0.008, 0.06 + ch - 0.1), whiteg, 0.008))
        parts.append(box(f"Pull{k}", (0.12, 0.02, 0.016), (x, fy - 0.025, 0.06 + ch - 0.1), mm["chrome"], 0.006))
        parts.append(box(f"Knob{k}", (0.02, 0.02, 0.1), (x + (0.17 if k % 2 == 0 else -0.17), fy - 0.025, 0.55), mm["chrome"], 0.006))
    parts.append(green_cross("DoorCross", 0.26, (-0.225, fy - 0.022, 0.4)))
    parts.append(green_cross("DoorCross2", 0.26, (0.225, fy - 0.022, 0.4)))
    for sx in (-1, 1):
        parts.append(green_cross(f"SideCross{sx}", 0.3, (sx * 0.903, cy, 0.5), rot=(R90, 0, R90)))
    tz = 0.06 + ch + 0.04
    # the sink and the plumbed eye wash (two upward nozzles with dust caps, a green push paddle)
    sx0 = 0.48
    parts.append(box("Sink", (0.5, 0.42, 0.012), (sx0, cy - 0.02, tz + 0.002), mm["brushed"], 0.004))
    parts.append(box("SinkBowl", (0.44, 0.36, 0.01), (sx0, cy - 0.02, tz + 0.004), mat("sink_dark", "#9aa3a9", 0.25, 1.0), 0.004))
    parts.append(cyl("Drain", 0.03, 0.004, (sx0, cy - 0.02, tz + 0.008), mm["chrome"], 12))
    parts.append(cyl("EyeStem", 0.018, 0.2, (sx0, cy + 0.14, tz), mm["chrome"], 12))
    parts.append(poly_tube("EyeBar", [(sx0 - 0.08, cy + 0.04, tz + 0.2), (sx0 - 0.08, cy + 0.14, tz + 0.2), (sx0 + 0.08, cy + 0.14, tz + 0.2), (sx0 + 0.08, cy + 0.04, tz + 0.2)], 0.012, mm["chrome"], sides=8, corner=0.03))
    for s in (-1, 1):
        parts.append(cyl(f"Nozzle{s}", 0.022, 0.04, (sx0 + s * 0.08, cy + 0.04, tz + 0.18), mm["chrome"], 12))
        parts.append(cyl(f"DustCap{s}", 0.03, 0.02, (sx0 + s * 0.08, cy + 0.04, tz + 0.225), mat("dustcap", "#f6cf45", 0.4), 14, bev=0.006))
    parts.append(box("Paddle", (0.14, 0.012, 0.09), (sx0 + 0.15, cy + 0.12, tz + 0.15), green, 0.006, rot=(0, 0, 0.4)))
    # the backboard: white panel, a green trim, the sign, the AED, the eye-wash bottles, a towel dispenser
    by = 0.575
    parts.append(box("Backboard", (1.8, 0.04, 1.06), (0, by, tz + 0.53), white, 0.01))
    parts.append(box("Trim", (1.8, 0.044, 0.05), (0, by, tz + 1.04), green, 0.006))
    parts.append(box("SignPlate", (0.9, 0.03, 0.2), (0, by - 0.035, tz + 1.17), green, 0.01))
    parts.append(green_cross("SignCross", 0.13, (-0.3, by - 0.052, tz + 1.17), col="#f4f1ea"))
    parts.append(ltext("SignText", "FIRST AID", 0.13, (0.08, by - 0.052, tz + 1.17), m=mat("cream")))
    for sx in (-1, 1):
        parts.append(box(f"SignStay{sx}", (0.03, 0.03, 0.12), (sx * 0.3, by - 0.01, tz + 1.04), mm["steel"], 0.006))
    # AED cabinet
    parts.append(box("AED", (0.34, 0.14, 0.4), (-0.6, by - 0.09, tz + 0.55), green, 0.02))
    parts.append(label("AEDSign", 0.2, 0.2, (-0.6, by - 0.162, tz + 0.6), "aed_sign.png"))
    parts.append(ltext("AEDText", "AED", 0.07, (-0.6, by - 0.162, tz + 0.43), m=mat("cream")))
    parts.append(box("AEDLatch", (0.03, 0.02, 0.07), (-0.46, by - 0.165, tz + 0.55), mm["chrome"], 0.006))
    # eye-wash bottle holder: a green-backed wall box with two bottles and a mirror
    ex = 0.05
    parts.append(box("EyeHolder", (0.36, 0.1, 0.42), (ex, by - 0.07, tz + 0.5), white, 0.015))
    parts.append(label("EyeSign", 0.14, 0.14, (ex, by - 0.122, tz + 0.62), "eyewash_sign.png"))
    for s in (-1, 1):
        b = lathe(f"EyeBottle{s}", [(0, 0), (0.045, 0), (0.048, 0.01), (0.048, 0.13), (0.03, 0.16), (0.018, 0.17), (0, 0.17)], mat("eyebottle", "#f4f1ea", 0.4), 16, (ex + s * 0.08, by - 0.14, tz + 0.29))
        c = cyl(f"EyeCap{s}", 0.025, 0.04, (ex + s * 0.08, by - 0.14, tz + 0.46), green, 12, bev=0.006)
        band = cyl(f"EyeBand{s}", 0.0485, 0.05, (ex + s * 0.08, by - 0.14, tz + 0.34), mat("eyeband", "#7cc6e3", 0.5), 16)
        parts += [b, c, band]
    parts.append(box("EyeLip", (0.36, 0.12, 0.03), (ex, by - 0.14, tz + 0.28), white, 0.008))
    parts.append(box("Mirror", (0.3, 0.012, 0.26), (0.55, by - 0.026, tz + 0.72), mat("mirror", "#dfe8ec", 0.03, 1.0), 0.006))
    parts.append(box("MirrorFrame", (0.33, 0.01, 0.29), (0.55, by - 0.022, tz + 0.72), green, 0.006))
    # on the counter: a kit, a stack of towels, a tissue box, a pump bottle
    parts.append(box("Kit", (0.3, 0.2, 0.14), (-0.55, cy - 0.1, tz + 0.07), green, 0.02))
    parts.append(green_cross("KitCross", 0.08, (-0.55, cy - 0.201, tz + 0.08), col="#f4f1ea"))
    parts.append(box("KitHandle", (0.12, 0.03, 0.02), (-0.55, cy - 0.1, tz + 0.15), mm["black"], 0.008))
    tw = mat("towel_white", "#f7f5ef", 0.95)
    tb = mat("towel_navy", "#33557e", 0.95)
    for k in range(4):
        parts.append(box(f"Towel{k}", (0.32, 0.24, 0.055), (-0.17 + 0.006 * (k % 2), cy - 0.08, tz + 0.03 + k * 0.057), tw, 0.022))
        parts.append(box(f"TowelBand{k}", (0.322, 0.03, 0.057), (-0.17 + 0.006 * (k % 2), cy - 0.2, tz + 0.03 + k * 0.057), tb, 0.01))
    parts.append(box("Tissues", (0.2, 0.11, 0.09), (0.12, cy - 0.15, tz + 0.045), mat("tissue_box", "#7cc6e3", 0.5), 0.01, rot=(0, 0, 0.2)))
    parts.append(sphere("Tissue", 0.035, (0.12, cy - 0.15, tz + 0.1), mat("paper"), 10, 6, scale=(1, 0.7, 1.2)))
    # the front: an oxygen cylinder on a trolley, a rescue tube against the counter, a yellow clinical bin
    ox, oy = -0.68, -0.4
    parts.append(box("TrolleyBase", (0.24, 0.2, 0.03), (ox, oy, 0.08), mm["steel"], 0.008))
    for s in (-1, 1):
        parts.append(cyl(f"Wheel{s}", 0.07, 0.03, (ox + s * 0.13, oy + 0.06, 0.07), mm["black"], 14, rot=(0, R90, 0)))
    parts.append(poly_tube("TrolleyFrame", [(ox - 0.1, oy + 0.06, 0.08), (ox - 0.1, oy + 0.1, 1.05), (ox + 0.1, oy + 0.1, 1.05), (ox + 0.1, oy + 0.06, 0.08)], 0.012, mm["steel"], sides=8, corner=0.05))
    red = mat("oxy_red", "#d6423a", 0.35)
    parts.append(lathe("Oxygen", [(0, 0), (0.085, 0), (0.09, 0.02), (0.09, 0.72), (0.06, 0.8), (0.03, 0.82), (0, 0.82)], red, 20, (ox, oy, 0.095)))
    parts.append(cyl("OxyShoulder", 0.0905, 0.08, (ox, oy, 0.75), mat("white"), 20))
    parts.append(cyl("Valve", 0.025, 0.08, (ox, oy, 0.91), mm["chrome"], 12))
    parts.append(sphere("Gauge", 0.03, (ox, oy - 0.03, 0.96), mm["white"], 12, 6, scale=(1, 0.5, 1)))
    parts.append(cyl("OxyStrap", 0.092, 0.03, (ox, oy, 0.5), mm["black"], 20))
    parts.append(tube("Mask", [(ox + 0.03, oy - 0.04, 0.95), (ox + 0.12, oy - 0.1, 0.8), (ox + 0.1, oy - 0.1, 0.6), (ox + 0.05, oy - 0.1, 0.55)], 0.006, clear_mat("tube_clear", "#dff1ee", 0.4), res=3, sides=4))
    rt = rescue_tube("RescueTube", 0.95)
    rt.rotation_euler = (-0.3, 0, 0.0)
    rt.location = (-0.15, -0.5, 0.06)
    apply_all(rt)
    parts.append(rt)
    binm = mat("clinical", "#f6cf45", 0.45)
    parts.append(lathe("Bin", [(0, 0), (0.15, 0), (0.17, 0.5), (0, 0.5)], binm, 20, (0.6, -0.36, 0.0)))
    parts.append(cyl("BinLid", 0.18, 0.04, (0.6, -0.36, 0.5), binm, 20, bev=0.012))
    parts.append(box("Pedal", (0.12, 0.08, 0.02), (0.6, -0.54, 0.03), mm["black"], 0.006))
    parts.append(box("BinLabel", (0.14, 0.004, 0.08), (0.6, -0.525, 0.35), mm["white"], 0.0, rot=(0.04, 0, 0)))
    root = parent_all(parts, "FirstAidStation")
    finish(root, "first_aid_station", ((0, 0, 0.8), 3.6, 22, -28))


# ---------------------------------------------------------------------------------------------------------------------------
# 5. The lifeguard chair
# ---------------------------------------------------------------------------------------------------------------------------


def flashlight(name, loc):
    x, y, z = loc
    yl, bk = mat("torch_yellow", "#f6cf45", 0.45), mat("black")
    body = cyl(name + "Body", 0.022, 0.2, (x, y, z), yl, 14)
    head = lathe(name + "Head", [(0, 0), (0.024, 0), (0.038, 0.06), (0.038, 0.075), (0, 0.075)], bk, 16, (x, y, z - 0.075))
    head.rotation_euler = (math.pi, 0, 0)
    head.location = (x, y, z)
    apply_all(head)
    lens = cyl(name + "Lens", 0.033, 0.004, (x, y, z - 0.077), mat("lens", "#fff6d8", 0.1, emit="#fff1c4", emit_strength=0.5), 16)
    grip = cyl(name + "Grip", 0.0235, 0.08, (x, y, z + 0.06), bk, 14)
    cap = cyl(name + "Cap", 0.02, 0.02, (x, y, z + 0.2), bk, 12)
    loop = torus(name + "Loop", 0.03, 0.004, (x, y, z + 0.25), bk, 12, 6, rot=(R90, 0, 0))
    return jn([body, head, lens, grip, cap, loop], name)


def lifeguard_chair():
    """The lifeguard's high chair, 1.4 wide x 1.2 deep, seat at 1.8 m: splayed mustard legs, a white seat, back and armrests,
    a rear ladder, a LIFEGUARD plate, a rescue tube and a whistle hanging off it, a torch on a hook at the front (`Flashlight`)."""
    reset()
    mm = M()
    parts = []
    must = mat("chair_mustard", "#f2b33d", 0.35)
    white = mat("chair_white", "#f7f5ef", 0.3)
    TOP = 1.76

    def leg(z, sx, sy):
        return (sx * (0.62 - 0.25 * z / TOP), sy * (0.52 - 0.32 * z / TOP), z)

    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(strut(f"Leg{sx}{sy}", leg(0.0, sx, sy), leg(TOP, sx, sy), 0.07, must, 0.015))
            parts.append(box(f"Foot{sx}{sy}", (0.12, 0.12, 0.03), leg(0.015, sx, sy), mm["rubber"], 0.008))
        # side rails and an X brace
        for z in (0.42, 1.12):
            parts.append(strut(f"SideRail{sx}{z}", leg(z, sx, -1), leg(z, sx, 1), 0.045, must, 0.01))
        parts.append(strut(f"BraceA{sx}", leg(0.42, sx, -1), leg(1.12, sx, 1), 0.035, white, 0.008, d=0.02))
        parts.append(strut(f"BraceB{sx}", leg(0.42, sx, 1), leg(1.12, sx, -1), 0.035, white, 0.008, d=0.02))
    # the ladder's rungs at the back, a front rail and the footrest
    for k, z in enumerate((0.36, 0.72, 1.08, 1.44)):
        a, b = leg(z, -1, 1), leg(z, 1, 1)
        parts.append(box(f"Rung{k}", (b[0] - a[0] + 0.02, 0.1, 0.035), (0, a[1], z), white, 0.01))
    parts.append(strut("FrontRail", leg(0.42, -1, -1), leg(0.42, 1, -1), 0.045, must, 0.01))
    fz = 1.12
    fa, fb = leg(fz, -1, -1), leg(fz, 1, -1)
    parts.append(box("Footrest", (fb[0] - fa[0] + 0.08, 0.2, 0.045), (0, fa[1] - 0.04, fz + 0.035), white, 0.012))
    # seat, cushion, back, armrests
    parts.append(box("SeatFrame", (0.86, 0.5, 0.05), (0, 0, TOP + 0.02), must, 0.012))
    for k in range(4):
        parts.append(box(f"SeatSlat{k}", (0.9, 0.12, 0.03), (0, -0.2 + k * 0.133, TOP + 0.06), white, 0.01))
    parts.append(box("Cushion", (0.66, 0.4, 0.06), (0, -0.02, TOP + 0.105), mat("cushion", "#22426b", 0.8), 0.025, 3))
    parts.append(box("CushionPiping", (0.665, 0.405, 0.012), (0, -0.02, TOP + 0.105), mat("coral"), 0.005))
    for sx in (-1, 1):
        parts.append(strut(f"BackPost{sx}", (sx * 0.36, 0.22, TOP + 0.04), (sx * 0.38, 0.3, 2.42), 0.055, must, 0.012))
        parts.append(box(f"ArmPost{sx}", (0.045, 0.045, 0.26), (sx * 0.42, -0.2, TOP + 0.17), must, 0.01))
        parts.append(box(f"Arm{sx}", (0.08, 0.58, 0.035), (sx * 0.42, 0.02, TOP + 0.31), white, 0.012))
    for k, z in enumerate((2.04, 2.17, 2.3)):
        t = (z - TOP) / (2.42 - TOP)
        parts.append(box(f"BackSlat{k}", (0.8, 0.03, 0.1), (0, 0.22 + 0.08 * t + 0.03, z), white, 0.01, rot=(-0.12, 0, 0)))
    # the LIFEGUARD plate under the seat, tilted with the front legs
    pz = 1.5
    pa = leg(pz, -1, -1)
    plate = box("Plate", (0.74, 0.03, 0.17), (0, pa[1] - 0.04, pz), mat("plate_navy", "#1d3557", 0.4), 0.01)
    txt = ltext("PlateText", "LIFEGUARD", 0.12, (0, pa[1] - 0.056, pz), m=mat("cream"))
    for o in (plate, txt):
        o.location = Vector(o.location)
    parts += [plate, txt]
    parts.append(strut("PlateBar", leg(pz, -1, -1), leg(pz, 1, -1), 0.04, must, 0.008))
    # a rescue tube hanging off the right armrest by its strap, a whistle on a lanyard off the left
    rt = rescue_tube("RescueTube", 0.92, 0.06)
    rt.location = (0.5, 0.0, 1.0)
    apply_all(rt)
    parts.append(rt)
    parts.append(tube("RescueStrap", [(0.5, 0.0, 1.9), (0.48, -0.02, 2.06), (0.42, 0.0, 2.11), (0.36, 0.0, 2.06), (0.4, 0.0, 2.0)], 0.009, mat("strap", "#f6cf45", 0.6), res=3, sides=4))
    parts.append(tube("Lanyard", [(-0.42, -0.24, 2.09), (-0.47, -0.25, 1.95), (-0.47, -0.27, 1.82), (-0.44, -0.25, 1.95), (-0.4, -0.24, 2.09)], 0.004, mat("lanyard", "#ef6a4c", 0.6), res=3, sides=4))
    whistle = box("Whistle", (0.025, 0.05, 0.03), (-0.465, -0.27, 1.79), mat("whistle", "#f2b33d", 0.3), 0.01)
    parts.append(whistle)
    # a straw sun hat on the back post, a water bottle in a clip on the left arm
    straw = mat("straw", "#e3c27e", 0.8)
    hat = [cyl("HatBrim", 0.2, 0.008, (0, 0, 0), straw, 24, bev=0.003), sphere("HatCrown", 0.1, (0, 0, 0.0), straw, 16, 8, scale=(1, 1, 0.8)), cyl("HatBand", 0.101, 0.03, (0, 0, 0.0), mat("coral"), 16)]
    h = jn(hat, "SunHat")
    h.rotation_euler = (1.25, 0.2, 0)
    h.location = (-0.44, 0.38, 2.24)
    apply_all(h)
    parts.append(h)
    parts.append(cyl("BottleClip", 0.04, 0.05, (-0.47, 0.18, 2.03), mm["steel"], 12))
    parts.append(cyl("Bottle", 0.035, 0.22, (-0.47, 0.18, 1.98), mat("bottle_sea", "#2f9c95", 0.25, 0.3), 14, bev=0.01))
    # the torch on its hook at the front of the footrest (`Flashlight`, the coach takes it)
    parts.append(hook("TorchHook", (-0.22, fa[1] - 0.13, fz + 0.02), mm["chrome"], 0.03))
    parts.append(flashlight("Flashlight", (-0.22, fa[1] - 0.18, fz - 0.23)))
    root = parent_all(parts, "LifeguardChair")
    finish(root, "lifeguard_chair", ((0, 0, 1.2), 4.6, 20, -32))


# ---------------------------------------------------------------------------------------------------------------------------
# Shapes with their own UVs: curved labels, leaves, a net bag
# ---------------------------------------------------------------------------------------------------------------------------


def curved_label(name, r, h, arc, loc, m, n=10):
    """A label wrapped on a cylinder of radius r (axis Z through loc), centred on its front (-Y), UVs 0..1."""
    x0, y0, z0 = loc
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    rows = []
    for zz in (z0 - h / 2, z0 + h / 2):
        rows.append([bm.verts.new((x0 + r * math.sin(a), y0 - r * math.cos(a), zz)) for a in [(-arc / 2 + arc * k / n) for k in range(n + 1)]])
    for k in range(n):
        f = bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
        for l, (u, v) in zip(f.loops, [(k / n, 0), ((k + 1) / n, 0), ((k + 1) / n, 1), (k / n, 1)]):
            l[uv].uv = (u, v)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    smooth(o, 60)
    return o


def leaf(name, L, W, m, droop=0.35, cup=0.25, slits=True, rows=14, cols=8):
    """A monstera leaf along +Y from the origin (its petiole end), half-width W, drooping toward the tip, splits cut from the
    edges in toward the midrib."""
    bm = bmesh.new()
    grid = []
    for i in range(rows + 1):
        t = i / rows
        w = W * math.sqrt(max(0.0, math.sin(math.pi * min(t * 1.08 + 0.04, 1.0)))) * (1.1 - 0.35 * t)
        row = []
        for j in range(cols + 1):
            u = -1 + 2 * j / cols
            x = u * w
            y = t * L
            z = -droop * L * t * t + cup * w * u * u - 0.25 * cup * w
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(rows):
        for j in range(cols):
            u = -1 + 2 * (j + 0.5) / cols
            t = (i + 0.5) / rows
            if slits and 0.3 < t < 0.85 and i % 4 == 2 and abs(u) > 0.42:
                continue
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    smooth(o, 70)
    return o


def net_bag(name, centre, R, depth, m, out=0.12, n=16, rows=6):
    """A net bag hanging from a hoop of radius R in the wall's plane (XZ) round `centre`, sagging down and out from the wall
    (-Y), with UVs for a netting texture."""
    cx, cy, cz = centre
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    tip = Vector((cx, cy - out, cz - R - depth))
    grid = []
    for i in range(rows + 1):
        t = i / rows
        row = []
        for k in range(n):
            a = 2 * math.pi * k / n
            rim = Vector((cx + R * math.cos(a), cy, cz + R * math.sin(a)))
            p = rim.lerp(tip, t)
            bulge = math.sin(math.pi * t) * 0.6
            p.y -= out * bulge
            p.x += (rim.x - cx) * bulge * 0.5
            row.append(bm.verts.new(p))
        grid.append(row)
    for i in range(rows):
        for k in range(n):
            k2 = (k + 1) % n
            f = bm.faces.new((grid[i][k], grid[i][k2], grid[i + 1][k2], grid[i + 1][k]))
            for l, (u, v) in zip(f.loops, [(k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1)]):
                l[uv].uv = (u / n * 4, v / rows * 2)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, m)
    smooth(o, 80)
    return o


# ---------------------------------------------------------------------------------------------------------------------------
# 6. Life rings: the ring, a freestanding board and a wall board
# ---------------------------------------------------------------------------------------------------------------------------


def ring_obj(name="LifeRing"):
    """A coral life ring lying flat (axis Blender Z), outer radius 0.38, four white bands, a grab line held at the bands."""
    coral, white = mat("ring_coral", "#ef6a4c", 0.5), mat("ring_white", "#f7f5ef", 0.5)
    R, r = 0.285, 0.095
    o = torus(name, R, r, (0, 0, 0), coral, 36, 12)
    bands = [math.pi / 4 + k * math.pi / 2 for k in range(4)]

    def in_band(c):
        a = math.atan2(c.y, c.x)
        return any(abs((a - b + math.pi) % (2 * math.pi) - math.pi) < 0.17 for b in bands)

    faces_mat(o, white, in_band)
    rope = mat("rope")
    parts = [o]
    # the grab line: swags between the bands, just outside the ring, and a wrap round the ring at each band
    pts = []
    for k in range(4):
        a0, a1 = bands[k], bands[k] + math.pi / 2
        for j in range(9):
            a = a0 + (a1 - a0) * j / 8
            sag = math.sin(math.pi * j / 8)
            rr = R + r + 0.006 + 0.022 * sag
            pts.append((rr * math.cos(a), rr * math.sin(a), -0.035 * sag))
    parts.append(tube(name + "Line", pts, 0.008, rope, res=1, sides=4, cyclic=True))
    for k, b in enumerate(bands):
        w = torus(name + f"Wrap{k}", r + 0.008, 0.007, (0, 0, 0), rope, 16, 4, rot=(R90, 0, 0))
        w.location = (R * math.cos(b), R * math.sin(b), 0)
        w.rotation_euler = (0, 0, b)
        apply_all(w)
        parts.append(w)
    return jn(parts, name)


def life_ring():
    """The ring alone, as the coach carries it: lying flat, pivot at its centre."""
    reset()
    o = ring_obj("LifeRing")
    root = parent_all([o], "LifeRingCarried")
    finish(root, "life_ring", ((0, 0, 0), 1.5, 45, -30))


def throw_coil(name, loc, m, loops=6, r=0.11):
    """A coiled throw rope hanging from a hook at loc: loops in the XZ plane, stacked slightly toward -Y."""
    x, y, z = loc
    pts = []
    rr = random.Random(2)
    for k in range(loops):
        rk = r * (1 + rr.uniform(-0.08, 0.08))
        dy = -0.012 * k
        for j in range(8):
            a = math.pi / 2 + 2 * math.pi * j / 8
            pts.append((x + rk * math.cos(a) * 0.9, y + dy, z - rk + rk * math.sin(a) * 1.15))
    pts.append((x + 0.02, y - 0.08, z - 2.3 * r))
    pts.append((x + 0.05, y - 0.09, z - 2.6 * r))
    return tube(name, pts, 0.008, m, res=2, sides=4)


def ring_board(wall=False):
    """The LIFE RING board, navy with white lettering, the ring hanging on its peg. Freestanding on two posts (with a coiled throw
    rope), or wall-mounted (its back on the wall face, local y = 0, battens reaching 7 cm behind it into the wall)."""
    reset()
    mm = M()
    parts = []
    navy = mat("board_navy", "#1d3557", 0.4)
    white = mm["whiteg"]
    W = 0.8
    if wall:
        z0, z1, by = 1.04, 2.04, -0.015
        for sx in (-1, 1):
            parts.append(box(f"Batten{sx}", (0.06, 0.075, 0.9), (sx * 0.3, 0.0375, (z0 + z1) / 2), mm["wood_dark"], 0.006))
    else:
        z0, z1, by = 0.9, 2.0, 0.07
        for sx in (-1, 1):
            parts.append(box(f"Post{sx}", (0.06, 0.06, 2.06), (sx * 0.45, by + 0.04, 1.03), white, 0.012))
            parts.append(box(f"PostCap{sx}", (0.075, 0.075, 0.03), (sx * 0.45, by + 0.04, 2.075), mat("coral"), 0.01))
            parts.append(box(f"Base{sx}", (0.16, 0.3, 0.03), (sx * 0.45, 0.0, 0.015), mm["navy"], 0.008))
            parts.append(box(f"Gusset{sx}", (0.02, 0.12, 0.12), (sx * 0.45, -0.04, 0.08), mm["navy"], 0.004, rot=(0.78, 0, 0)))
        parts.append(box("Rail", (0.84, 0.04, 0.04), (0, by + 0.04, 0.35), white, 0.01))
    h = z1 - z0
    zc = (z0 + z1) / 2
    parts.append(box("Board", (W, 0.03, h), (0, by, zc), navy, 0.01))
    fy = by - 0.016
    for k, (sx, sz, lx, lz) in enumerate([(W - 0.06, 0.015, 0, z1 - 0.03), (W - 0.06, 0.015, 0, z0 + 0.03), (0.015, h - 0.06, -(W / 2 - 0.03), zc), (0.015, h - 0.06, W / 2 - 0.03, zc)]):
        parts.append(box(f"Border{k}", (sx, 0.004, sz), (lx, fy, lz), white, 0.0))
    parts.append(ltext("Title", "LIFE RING", 0.1, (0, fy - 0.001, z1 - 0.08), m=white))
    peg_z = z1 - 0.165 - 0.38 + 0.206
    parts.append(cyl("Peg", 0.016, 0.16, (0, fy, peg_z), mm["chrome"], 12, rot=(R90, 0, 0)))
    parts.append(sphere("PegKnob", 0.024, (0, fy - 0.16, peg_z), mm["chrome"], 12, 6))
    ring = ring_obj("LifeRing")
    ring.rotation_euler = (R90, 0, 0.12)
    ring.location = (0, fy - 0.1, peg_z - 0.19 - 0.016)
    apply_all(ring)
    parts.append(ring)
    if not wall:
        parts.append(ltext("Motto", "THROW · DON'T GO", 0.06, (0, fy - 0.001, z0 + 0.065), m=mat("cream")))
        parts.append(hook("CoilHook", (0.45, by + 0.01, 1.3), mm["chrome"], 0.05))
        parts.append(throw_coil("ThrowRope", (0.45, by - 0.04, 1.33), mat("rope_yellow", "#f6cf45", 0.85)))
        parts.append(cyl("ThrowBag", 0.055, 0.16, (0.45, by - 0.05, 0.84), mat("throwbag", "#d6423a", 0.7), 14, bev=0.02))
    name = "life_ring_wall" if wall else "life_ring_stand"
    root = parent_all(parts, "LifeRingWall" if wall else "LifeRingStand")
    finish(root, name, ((0, 0, 1.3), 3.0, 15, -25))


# ---------------------------------------------------------------------------------------------------------------------------
# 7. The office counter
# ---------------------------------------------------------------------------------------------------------------------------


def office_counter():
    """The lifeguards' office counter, 2.8 x 1.2: a navy front with POOL OFFICE in cream, a timber ledge (clipboard, hand bell),
    a desk behind (CRT monitor on the cameras, radio, lamp `Light_DeskLamp`, mug, first-aid box), a stool, lost property."""
    reset()
    mm = M()
    parts = []
    navy = mat("office_navy", "#1d3557", 0.4)
    must = mat("office_mustard", "#f2b33d", 0.4)
    # the front unit
    fy0, fy1, FH = -0.58, -0.2, 1.04
    parts.append(box("Front", (2.76, fy1 - fy0, FH), (0, (fy0 + fy1) / 2, FH / 2), navy, 0.015))
    parts.append(box("Kick", (2.72, 0.02, 0.08), (0, fy0 - 0.005, 0.04), mm["black"], 0.004))
    for k in range(13):
        x = -1.26 + k * 0.21
        parts.append(wood_box(f"Batten{k}", (0.12, 0.02, 0.5), (x, fy0 - 0.01, 0.36), mm["wood"], "z", 0.006))
    parts.append(box("Stripe", (2.74, 0.02, 0.05), (0, fy0 - 0.008, 0.7), must, 0.006))
    parts.append(ltext("Name", "POOL OFFICE", 0.17, (-0.15, fy0 - 0.012, 0.86), m=mat("cream")))
    parts.append(plane("NameCrest", 0.2, 0.2, (0.72, fy0 - 0.012, 0.86), img_mat("crest", "crest_alpha.png", 0.6)))
    parts.append(wood_box("Ledge", (2.82, 0.44, 0.045), (0, (fy0 + fy1) / 2 - 0.01, FH + 0.0225), mm["wood"], bev=0.01))
    lz = FH + 0.045
    # the desk behind (timber top on end panels and a drawer pedestal)
    dz = 0.76
    parts.append(wood_box("Desk", (2.76, 0.52, 0.04), (0, 0.06, dz - 0.02), mm["wood"], bev=0.008))
    for sx in (-1, 1):
        parts.append(box(f"EndPanel{sx}", (0.03, 0.5, dz - 0.04), (sx * 1.365, 0.06, (dz - 0.04) / 2), navy, 0.006))
    parts.append(box("Pedestal", (0.42, 0.48, dz - 0.04), (1.12, 0.06, (dz - 0.04) / 2), mat("ped_cream", "#efe6d2", 0.45), 0.008))
    for k in range(3):
        parts.append(box(f"Drawer{k}", (0.38, 0.02, 0.2), (1.12, 0.31, 0.12 + k * 0.23), mat("ped_cream"), 0.006))
        parts.append(box(f"DrawerPull{k}", (0.1, 0.02, 0.015), (1.12, 0.325, 0.2 + k * 0.23), mm["chrome"], 0.005))
    # the CRT monitor showing the pool cameras, turned toward the stool
    crt = mat("crt_beige", "#e2dccb", 0.5)
    mon = [
        box("CRT", (0.42, 0.36, 0.34), (0, 0, 0.17), crt, 0.03),
        box("CRTBack", (0.3, 0.2, 0.24), (0, -0.25, 0.15), crt, 0.04),
        box("CRTFoot", (0.22, 0.2, 0.04), (0, -0.05, -0.02), crt, 0.01),
        plane("Screen", 0.34, 0.25, (0, 0.182, 0.18), img_mat("cctv", "cctv.png", 0.2, emit=1.2), rot=(R90, 0, math.pi)),
        cyl("CRTLed", 0.007, 0.004, (0.17, 0.181, 0.03), mat("led", "#5dff9a", 0.3, emit="#5dff9a", emit_strength=2.0), 8, rot=(R90, 0, 0)),
    ]
    m_ = jn(mon, "Monitor")
    m_.rotation_euler = (0, 0, 0.5)
    m_.location = (-0.55, 0.0, dz + 0.04)
    apply_all(m_)
    parts.append(m_)
    # a desk radio with a telescopic antenna
    rad = [
        box("Radio", (0.26, 0.1, 0.15), (0, 0, 0.075), mat("radio", "#ef6a4c", 0.4), 0.025),
        cyl("Speaker", 0.045, 0.006, (-0.05, -0.05, 0.075), mat("grille", "#e3c27e", 0.6), 16, rot=(R90, 0, 0)),
        cyl("Dial", 0.022, 0.012, (0.07, -0.052, 0.09), mm["cream"], 12, rot=(R90, 0, 0)),
        rod("Antenna", (0.1, 0.02, 0.15), (0.2, 0.06, 0.5), 0.004, mm["chrome"], 6),
        sphere("AntennaTip", 0.008, (0.2, 0.06, 0.5), mm["chrome"], 8, 4),
    ]
    r_ = jn(rad, "Radio")
    r_.rotation_euler = (0, 0, -0.25)
    r_.location = (0.25, -0.02, dz)
    apply_all(r_)
    parts.append(r_)
    # the desk lamp (its bulb is a Light_ node)
    lx, ly = 0.75, 0.2
    parts.append(cyl("LampBase", 0.08, 0.025, (lx, ly, dz), mm["navy"], 20, bev=0.006))
    parts.append(rod("LampArm1", (lx, ly, dz + 0.02), (lx - 0.06, ly - 0.08, dz + 0.32), 0.01, mm["chrome"], 8))
    parts.append(rod("LampArm2", (lx - 0.06, ly - 0.08, dz + 0.32), (lx - 0.2, ly - 0.24, dz + 0.36), 0.01, mm["chrome"], 8))
    parts.append(sphere("LampJoint", 0.018, (lx - 0.06, ly - 0.08, dz + 0.32), mm["chrome"], 10, 5))
    shade = lathe("LampShade", [(0.0, 0.0), (0.03, 0.0), (0.04, -0.03), (0.075, -0.11), (0.07, -0.112), (0.0, -0.02)], mat("lamp_mustard", "#f2b33d", 0.35), 18, (0, 0, 0))
    shade.rotation_euler = (0.5, 0, 0.7)
    shade.location = (lx - 0.21, ly - 0.25, dz + 0.37)
    apply_all(shade)
    parts.append(shade)
    bulb = sphere("Light_DeskLamp", 0.026, (lx - 0.255, ly - 0.3, dz + 0.3), mat("bulb", "#fff3d6", 0.2, emit="#ffe2a8", emit_strength=3.0), 10, 6)
    parts.append(bulb)
    # a mug, a first-aid box, a pen pot
    mug = lathe("Mug", [(0, 0), (0.04, 0), (0.042, 0.1), (0.036, 0.1), (0.035, 0.008), (0, 0.008)], mat("mug", "#2f8c88", 0.3), 16, (0.05, 0.12, dz))
    mug_h = torus("MugHandle", 0.025, 0.006, (0.095, 0.12, dz + 0.05), mat("mug"), 12, 6, rot=(R90, 0, 0))
    tea = cyl("Tea", 0.035, 0.004, (0.05, 0.12, dz + 0.08), mat("tea", "#7a4a26", 0.15), 16)
    parts += [mug, mug_h, tea]
    parts.append(box("FirstAidBox", (0.26, 0.16, 0.12), (-0.05, 0.22, dz + 0.06), mat("fa_green", "#1f9a5a", 0.45), 0.015, rot=(0, 0, 0.15)))
    parts.append(green_cross("FirstAidCross", 0.07, (-0.06, 0.135, dz + 0.065), rot=(R90, 0, 0.15), col="#f4f1ea"))
    parts.append(cyl("PenPot", 0.035, 0.1, (-0.95, 0.15, dz), mm["navy"], 14))
    for k, (dx, dy, col) in enumerate([(0.01, 0.0, "#d6423a"), (-0.01, 0.01, "#1d3557"), (0.0, -0.012, "#f2b33d")]):
        parts.append(rod(f"Pen{k}", (-0.95 + dx, 0.15 + dy, dz + 0.02), (-0.95 + dx * 4, 0.15 + dy * 4, dz + 0.16), 0.005, mat(f"pen{k}", col, 0.4), 6))
    # on the ledge: the rota on a clipboard, a hand bell, a whistle, a sign-in book
    cb = [box("Clipboard", (0.24, 0.32, 0.01), (0, 0, 0.005), mat("clipboard", "#8a5a33", 0.6), 0.003),
          plane("ClipRota", 0.21, 0.28, (0, -0.01, 0.0105), img_mat("rota", "rota.png", 0.6), rot=(0, 0, 0)),
          box("Clip", (0.09, 0.03, 0.016), (0, 0.14, 0.014), mm["chrome"], 0.004)]
    c_ = jn(cb, "Clipboard")
    c_.rotation_euler = (0, 0, 0.2)
    c_.location = (0.35, -0.4, lz)
    apply_all(c_)
    parts.append(c_)
    parts.append(tube("PenChain", [(0.48, -0.36, lz + 0.01), (0.55, -0.42, lz + 0.004), (0.6, -0.36, lz + 0.006)], 0.003, mm["chrome"], res=2, sides=4))
    parts.append(rod("ChainPen", (0.6, -0.36, lz + 0.006), (0.7, -0.44, lz + 0.006), 0.006, mm["navy"], 6))
    bell = [lathe("Bell", [(0, 0), (0.06, 0), (0.058, 0.01), (0.045, 0.04), (0.02, 0.055), (0, 0.058)], mat("brass"), 18, (0, 0, 0.012)),
            cyl("BellBase", 0.065, 0.012, (0, 0, 0), mm["black"], 18),
            cyl("BellKnob", 0.008, 0.025, (0, 0, 0.055), mm["chrome"], 8)]
    b_ = jn(bell, "HandBell")
    b_.location = (1.05, -0.4, lz)
    apply_all(b_)
    parts.append(b_)
    parts.append(box("SignInBook", (0.3, 0.22, 0.025), (-0.5, -0.42, lz + 0.0125), mat("book_red", "#c2453b", 0.6), 0.005, rot=(0, 0, -0.1)))
    parts.append(box("SignInPages", (0.29, 0.21, 0.005), (-0.5, -0.42, lz + 0.027), mm["paper"], 0.002, rot=(0, 0, -0.1)))
    parts.append(tube("Lanyard", [(-1.0, -0.35, lz + 0.004), (-1.08, -0.42, lz + 0.004), (-1.0, -0.48, lz + 0.004), (-0.92, -0.42, lz + 0.004), (-0.97, -0.37, lz + 0.004)], 0.004, mat("lanyard", "#ef6a4c", 0.6), res=2, sides=4))
    parts.append(box("Whistle", (0.05, 0.025, 0.025), (-0.9, -0.42, lz + 0.013), mat("whistle", "#f2b33d", 0.3), 0.008))
    # the stool behind the desk
    sx_, sy_ = -0.3, 0.4
    parts.append(cyl("StoolBase", 0.19, 0.03, (sx_, sy_, 0), mm["navy"], 20, bev=0.01))
    parts.append(cyl("StoolColumn", 0.03, 0.56, (sx_, sy_, 0.03), mm["chrome"], 12))
    parts.append(torus("StoolRing", 0.17, 0.012, (sx_, sy_, 0.3), mm["chrome"], 24, 6))
    for k in range(3):
        a = k * 2 * math.pi / 3
        parts.append(rod(f"StoolSpoke{k}", (sx_, sy_, 0.3), (sx_ + 0.16 * math.cos(a), sy_ + 0.16 * math.sin(a), 0.3), 0.008, mm["chrome"], 6))
    parts.append(cyl("StoolSeat", 0.18, 0.06, (sx_, sy_, 0.6), mat("stool_seat", "#ef6a4c", 0.6), 22, bev=0.02))
    # lost property: a cardboard box with a flip-flop and goggles poking out
    card = mat("cardboard", "#c9a06a", 0.85)
    lpx, lpy = -1.05, 0.4
    parts.append(box("LostBox", (0.42, 0.3, 0.26), (lpx, lpy, 0.13), card, 0.006))
    parts.append(box("LostFlapL", (0.42, 0.13, 0.006), (lpx, lpy - 0.2, 0.27), card, 0.0, rot=(-0.9, 0, 0)))
    parts.append(box("LostFlapR", (0.42, 0.13, 0.006), (lpx, lpy + 0.2, 0.27), card, 0.0, rot=(0.9, 0, 0)))
    parts.append(ltext("LostText", "LOST PROPERTY", 0.045, (lpx, lpy - 0.152, 0.16), m=mm["black"]))
    parts.append(flip_flop("LostFlop", (lpx - 0.08, lpy, 0.2), 0.0, mat("foam_yellow"), mat("navy")))
    lf = [o for o in [parts[-1]]][0]
    lf.rotation_euler = (0.9, 0.2, 0.3)
    apply_all(lf)
    parts.append(goggles("LostGoggles", mat("goggle_strap", "#ef7aa6", 0.6), clear_mat("goggle_lens", "#7cc6e3", 0.6, 0.05), (lpx + 0.1, lpy - 0.05, 0.27), (0.6, 0, 0.4)))
    parts.append(sphere("LostCap", 0.08, (lpx + 0.05, lpy + 0.06, 0.25), mat("swimcap", "#62c48a", 0.4), 14, 7, scale=(1, 1, 0.75)))
    root = parent_all(parts, "OfficeCounter")
    finish(root, "office_counter", ((0, 0, 0.7), 4.6, 32, -25))


# ---------------------------------------------------------------------------------------------------------------------------
# 8. The drinking fountain
# ---------------------------------------------------------------------------------------------------------------------------


def drinking_fountain():
    """A stainless drinking fountain (a high and a low bowl) and bottle filler on a tower of small sea-green tiles, on a tiled
    plinth; a cup dispenser, a step for small swimmers, a DRINKING WATER sign. 1.0 wide x 1.08 deep."""
    reset()
    mm = M()
    parts = []
    tiles = img_mat("tile_sea_small", "tile_sea_small.png", 0.25)
    stone = mat("stone_cream", "#efe3c8", 0.55)
    ss = mm["brushed"]
    p = box("Plinth", (1.0, 1.08, 0.1), (0, 0, 0.05), tiles, 0.01)
    parts.append(uv_box(p, 0.24, 0.24))
    parts.append(box("PlinthCap", (1.0, 1.08, 0.035), (0, 0, 0.1175), stone, 0.012))
    tw = box("Tower", (0.84, 0.3, 1.6), (0, 0.38, 0.135 + 0.8), tiles, 0.012)
    parts.append(uv_box(tw, 0.24, 0.24))
    parts.append(box("TowerCap", (0.9, 0.36, 0.05), (0, 0.38, 1.76), stone, 0.015))
    parts.append(box("TowerBand", (0.86, 0.32, 0.04), (0, 0.38, 1.6), mat("band_navy", "#1d3557", 0.35), 0.01))
    fy = 0.23
    # the bottle filler: a stainless recess, spout, sensor, drip grille, the counter
    parts.append(box("FillerPlate", (0.36, 0.02, 0.62), (0, fy - 0.005, 1.17), ss, 0.012))
    parts.append(box("FillerRecess", (0.28, 0.02, 0.4), (0, fy - 0.012, 1.12), mat("recess", "#7d868c", 0.3, 1.0), 0.01))
    parts.append(cyl("Spout", 0.016, 0.05, (0, fy - 0.07, 1.27), mm["chrome"], 12))
    parts.append(box("SpoutArm", (0.04, 0.07, 0.03), (0, fy - 0.04, 1.31), ss, 0.008))
    parts.append(cyl("Sensor", 0.014, 0.006, (0.09, fy - 0.025, 1.38), mat("sensor", "#1b1c1f", 0.2), 12, rot=(R90, 0, 0)))
    parts.append(box("Grille", (0.26, 0.12, 0.02), (0, fy - 0.07, 0.93), ss, 0.006))
    for k in range(6):
        parts.append(box(f"GrilleSlot{k}", (0.02, 0.1, 0.004), (-0.1 + k * 0.04, fy - 0.07, 0.941), mat("recess"), 0.0))
    parts.append(plane("Counter", 0.2, 0.05, (0, fy - 0.0165, 1.42), img_mat("counter_digits", "counter_digits.png", 0.3, emit=1.5)))
    # the high bowl and the low bowl, on stainless arms, with bubblers and push buttons
    for k, (bx, bz, br) in enumerate([(-0.17, 0.86, 0.17), (0.25, 0.6, 0.14)]):
        bowl = lathe(f"Bowl{k}", [(0, -0.07), (br * 0.5, -0.07), (br, -0.02), (br + 0.01, 0.0), (br - 0.008, 0.002), (br * 0.45, -0.055), (0, -0.055)], ss, 24, (bx, fy - 0.17, bz))
        parts.append(bowl)
        parts.append(box(f"BowlArm{k}", (0.12, 0.12, 0.08), (bx, fy - 0.05, bz - 0.05), ss, 0.02))
        parts.append(cyl(f"Bubbler{k}", 0.014, 0.05, (bx + 0.03, fy - 0.12, bz - 0.055), mm["chrome"], 10))
        parts.append(sphere(f"BubblerTip{k}", 0.016, (bx + 0.03, fy - 0.12, bz), mm["chrome"], 10, 5))
        parts.append(box(f"Button{k}", (0.07, 0.03, 0.035), (bx, fy - 0.17 - br - 0.005, bz - 0.03), mat("btn_blue", "#3d7fd1", 0.4), 0.01))
        parts.append(rod(f"Pipe{k}", (bx, fy - 0.15, bz - 0.07), (bx, fy - 0.03, 0.135), 0.014, mm["chrome"], 10))
    # a step for small swimmers under the low bowl
    parts.append(wood_box("Step", (0.32, 0.24, 0.025), (0.25, -0.22, 0.275), mm["wood"], bev=0.006))
    for sx in (-1, 1):
        parts.append(wood_box(f"StepSide{sx}", (0.025, 0.24, 0.14), (0.25 + sx * 0.145, -0.22, 0.205), mm["wood_dark"], "y", 0.005))
    parts.append(ltext("StepText", "LITTLE SWIMMERS", 0.03, (0.25, -0.22, 0.2885), (0, 0, 0), mat("cream")))
    # the cup dispenser on the tower's front
    cx = -0.33
    parts.append(cyl("CupTube", 0.045, 0.36, (cx, fy - 0.06, 0.96), clear_mat("cup_tube", "#e3f1f2", 0.35), 16))
    parts.append(cyl("CupCap", 0.05, 0.03, (cx, fy - 0.06, 1.32), ss, 16, bev=0.008))
    parts.append(cyl("CupMouth", 0.05, 0.04, (cx, fy - 0.06, 0.93), ss, 16))
    parts.append(lathe("Cups", [(0, 0.0), (0.03, 0.0), (0.042, 0.33), (0, 0.33)], mat("cups", "#f7f5ef", 0.6), 14, (cx, fy - 0.06, 0.9)))
    parts.append(box("CupBracket", (0.03, 0.06, 0.3), (cx, fy - 0.01, 1.1), ss, 0.006))
    # the sign at the top of the tower
    parts.append(box("SignPlate", (0.74, 0.02, 0.16), (0, fy - 0.004, 1.66), stone, 0.008))
    parts.append(plane("Droplet", 0.12, 0.12, (-0.28, fy - 0.0155, 1.66), img_mat("droplet", "droplet_alpha.png", 0.5)))
    parts.append(ltext("SignText", "DRINKING WATER", 0.1, (0.06, fy - 0.0155, 1.66), m=mat("navy")))
    # a drain grate in the plinth top under the bowls
    parts.append(box("Drain", (0.6, 0.1, 0.006), (-0.0, 0.06, 0.137), ss, 0.002))
    for k in range(10):
        parts.append(box(f"DrainSlot{k}", (0.03, 0.07, 0.004), (-0.27 + k * 0.06, 0.06, 0.139), mat("drain_dark", "#3a3b40", 0.5), 0.0))
    # plumbing access panel on the back, and a sticker
    parts.append(box("AccessPanel", (0.4, 0.012, 0.3), (0, 0.534, 0.5), ss, 0.006))
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(screw(f"PanelScrew{sx}{sz}", (sx * 0.17, 0.54, 0.5 + sz * 0.12), mm["chrome"], 0.008, 0.004, rot=(R90, 0, 0)))
    parts.append(plane("BackCrest", 0.16, 0.16, (0, 0.531, 1.2), img_mat("crest", "crest_alpha.png", 0.6), rot=(R90, 0, math.pi)))
    root = parent_all(parts, "DrinkingFountain")
    finish(root, "drinking_fountain", ((0, 0, 0.85), 3.0, 22, -30))


# ---------------------------------------------------------------------------------------------------------------------------
# 9. The big plant
# ---------------------------------------------------------------------------------------------------------------------------


def plant_big():
    """A lush monstera ("Monty", by the label) in a glazed sea-green pot, moss on the soil, a watering can at its foot. 1 x 1."""
    reset()
    parts = []
    glaze = mat("pot_glaze", "#2a8f88", 0.15)
    pot = lathe("Pot", [(0, 0.03), (0.22, 0.03), (0.25, 0.06), (0.33, 0.48), (0.37, 0.5), (0.37, 0.55), (0.33, 0.56), (0.3, 0.5), (0, 0.5)], glaze, 36)
    foot = lathe("PotFoot", [(0, 0), (0.23, 0), (0.24, 0.03), (0, 0.03)], mat("pot_foot", "#c9714a", 0.8), 36)
    band = lathe("PotBand", [(0.293, 0.36), (0.307, 0.36), (0.317, 0.42), (0.303, 0.42)], mat("pot_band", "#f3e6c9", 0.3), 36)
    for o in (band,):
        o.scale = (1.035, 1.035, 1)
        apply_all(o)
    parts += [pot, foot, band]
    parts.append(cyl("Soil", 0.305, 0.02, (0, 0, 0.48), mat("soil", "#4a3424", 0.95), 32))
    rr = random.Random(11)
    moss = [mat("moss", "#5f8f3a", 0.95), mat("moss2", "#7aa346", 0.95)]
    for k in range(30):
        a, r = rr.uniform(0, 6.28), 0.27 * math.sqrt(rr.random())
        parts.append(sphere(f"Moss{k}", rr.uniform(0.03, 0.055), (r * math.cos(a), r * math.sin(a), 0.49), moss[k % 2], 8, 4, scale=(1, 1, 0.55)))
    # the leaves on their petioles: old, low, big ones outside; young, high, upright ones in the middle
    greens = [two_sided(mat("leaf", "#3f8a4a", 0.5)), two_sided(mat("leaf_dark", "#2c6b3a", 0.55)), two_sided(mat("leaf_mid", "#4c9a52", 0.5))]
    stem = mat("stem", "#5e9447", 0.6)
    rl = random.Random(21)
    n = 17
    for k in range(n):
        t = k / (n - 1)
        yaw = k * 2.39996 + rl.uniform(-0.25, 0.25)
        bz = 0.7 + 0.6 * t + rl.uniform(-0.04, 0.04)
        br = 0.11 - 0.07 * t
        L = 0.47 - 0.12 * t + rl.uniform(-0.03, 0.02)
        pitch = -0.1 + 0.55 * t + rl.uniform(-0.1, 0.1)
        d = Vector((math.cos(yaw), math.sin(yaw), 0))
        base = d * br + Vector((0, 0, bz))
        root_pt = d * 0.04 + Vector((0, 0, 0.49))
        mid = root_pt.lerp(base, 0.55) - d * 0.02 + Vector((0, 0, 0.1))
        parts.append(tube(f"Petiole{k}", [tuple(root_pt), tuple(mid), tuple(base)], 0.009, stem, res=3, sides=4))
        lf = leaf(f"Leaf{k}", L, 0.52 * L, greens[k % 3], droop=0.4 - 0.2 * t, cup=0.2, slits=t < 0.85, rows=12, cols=10)
        lf.rotation_euler = (pitch, rl.uniform(-0.25, 0.25), yaw - R90)
        lf.location = base
        apply_all(lf)
        parts.append(lf)
    # a new leaf still furled
    parts.append(tube("Furled", [(0.0, 0.02, 0.5), (0.01, 0.02, 0.9), (0.03, 0.0, 1.2), (0.05, -0.02, 1.32)], 0.014, mat("leaf_new", "#8bbf5a", 0.5), res=3, sides=8))
    # the label stake "MONTY"
    parts.append(box("Stake", (0.012, 0.004, 0.18), (0.18, -0.14, 0.56), mat("stake", "#f4f1ea", 0.5), 0.002))
    parts.append(box("StakeHead", (0.08, 0.004, 0.045), (0.18, -0.142, 0.66), mat("stake"), 0.003))
    parts.append(ltext("StakeText", "MONTY", 0.03, (0.18, -0.145, 0.66), m=mat("navy")))
    # a watering can at the pot's foot
    can = mat("can_coral", "#ef6a4c", 0.4)
    wc = [cyl("CanBody", 0.085, 0.19, (0, 0, 0), can, 18, bev=0.015),
          rod("CanSpout", (0.06, 0, 0.05), (0.2, 0, 0.22), 0.013, can, 8),
          cyl("CanRose", 0.026, 0.03, (0.0, 0, 0.0), can, 12),
          tube("CanHandle", [(-0.075, 0, 0.14), (-0.05, 0, 0.26), (0.03, 0, 0.25), (0.06, 0, 0.19)], 0.01, can, res=3, sides=4)]
    rose = wc[2]
    rose.rotation_euler = (0, 0.8, 0)
    rose.location = (0.21, 0, 0.22)
    apply_all(rose)
    w_ = jn(wc, "WateringCan")
    w_.rotation_euler = (0, 0, -2.3)
    w_.location = (0.34, -0.34, 0.0)
    apply_all(w_)
    parts.append(w_)
    root = parent_all(parts, "PlantBig")
    finish(root, "plant_big", ((0, 0, 0.8), 3.0, 22, -30))


# ---------------------------------------------------------------------------------------------------------------------------
# 10. The dog-treat table
# ---------------------------------------------------------------------------------------------------------------------------


def bone(name, m, loc, rot, L=0.07, r=0.009):
    parts = [cyl(name, r, L, (0, 0, -L / 2), m, 8, rot=(0, 0, 0))]
    for s in (-1, 1):
        for t in (-1, 1):
            parts.append(sphere(name + f"K{s}{t}", r * 1.45, (t * r * 0.9, 0, s * L / 2), m, 8, 4))
    o = jn(parts, name)
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    return o


def treat_table():
    """A small round café table (0.72) with a big glass jar of bone treats labelled WOOF!, a paw-print water bowl on the floor."""
    reset()
    mm = M()
    parts = []
    iron = mat("cast_iron", "#2e3036", 0.55, 0.3)
    parts.append(lathe("Base", [(0, 0), (0.25, 0), (0.25, 0.012), (0.2, 0.03), (0.06, 0.05), (0, 0.05)], iron, 32))
    parts.append(cyl("Column", 0.03, 0.62, (0, 0, 0.05), iron, 14))
    parts.append(lathe("Collar", [(0, 0.6), (0.03, 0.6), (0.09, 0.67), (0.09, 0.69), (0, 0.69)], iron, 20))
    parts.append(cyl("Top", 0.355, 0.03, (0, 0, 0.69), mat("enamel_cream", "#f3e6c9", 0.3), 40, bev=0.01))
    parts.append(torus("TopRim", 0.355, 0.016, (0, 0, 0.705), mat("rim_navy", "#1d3557", 0.35), 40, 8))
    tz = 0.72
    # the jar of treats
    jx, jy = -0.09, 0.06
    glass = clear_mat("jar_glass", "#e6f3f2", 0.28, 0.05)
    jar = lathe("Glass_Jar", [(0, 0), (0.12, 0), (0.13, 0.015), (0.13, 0.24), (0.11, 0.275), (0.095, 0.285), (0.095, 0.3), (0.09, 0.3), (0.09, 0.288), (0.118, 0.24), (0.118, 0.02), (0, 0.012)], glass, 28, (jx, jy, tz))
    parts.append(jar)
    parts.append(cyl("JarLid", 0.102, 0.035, (jx, jy, tz + 0.295), mat("lid_red", "#d6423a", 0.35), 28, bev=0.008))
    parts.append(sphere("LidKnob", 0.025, (jx, jy, tz + 0.335), mat("lid_red"), 12, 6, scale=(1, 1, 0.6)))
    tm = mat("treat", "#c98e55", 0.75)
    tm2 = mat("treat_dark", "#a8693b", 0.75)
    rr = random.Random(8)
    k = 0
    for layer in range(5):
        for j in range(4 if layer < 4 else 2):
            a = rr.uniform(0, 6.28)
            r = rr.uniform(0.0, 0.06)
            parts.append(bone(f"Bone{k}", tm if k % 3 else tm2, (jx + r * math.cos(a), jy + r * math.sin(a), tz + 0.03 + layer * 0.042), (R90 + rr.uniform(-0.3, 0.3), 0, rr.uniform(0, 3.14))))
            k += 1
    parts.append(curved_label("Label", 0.1325, 0.12, 1.4, (jx, jy, tz + 0.13), img_mat("woof_label", "woof_label.png", 0.6)))
    # two loose treats on a saucer, a dog lead coiled on the table
    parts.append(lathe("Saucer", [(0, 0), (0.06, 0), (0.08, 0.015), (0.075, 0.017), (0.055, 0.004), (0, 0.004)], mm["whiteg"], 20, (0.2, -0.12, tz)))
    parts.append(bone("Loose0", tm, (0.19, -0.12, tz + 0.016), (R90, 0, 0.4)))
    parts.append(bone("Loose1", tm2, (0.22, -0.1, tz + 0.03), (R90 + 0.2, 0, -0.8)))
    pts = [(0.17 + 0.055 * math.cos(a), 0.22 + 0.045 * math.sin(a), tz + 0.008 + 0.002 * a) for a in [k * 0.6 for k in range(22)]]
    parts.append(tube("Lead", pts, 0.006, mat("lead_red", "#ef6a4c", 0.6), res=1, sides=4))
    parts.append(torus("LeadClip", 0.012, 0.004, (0.235, 0.24, tz + 0.012), mm["chrome"], 10, 4))
    # the water bowl on the floor
    bx, by = 0.23, -0.23
    parts.append(lathe("Bowl", [(0, 0), (0.09, 0), (0.12, 0.06), (0.11, 0.065), (0.08, 0.012), (0, 0.012)], mm["steel"], 28, (bx, by, 0)))
    parts.append(cyl("Water", 0.1, 0.002, (bx, by, 0.045), mat("bowl_water", "#9fd3e0", 0.05), 24))
    parts.append(ltext("BowlText", "DOG", 0.03, (bx, by - 0.105, 0.035), (R90 - 0.5, 0, 0), mat("navy")))
    root = parent_all(parts, "TreatTable")
    finish(root, "treat_table", ((0, 0, 0.45), 2.0, 28, -30))


# ---------------------------------------------------------------------------------------------------------------------------
# 11. The recycling station
# ---------------------------------------------------------------------------------------------------------------------------


def waste_bin():
    """A recycling station, 1.24 x 1.24: three wheelie bins (BOTTLES, PAPER, GENERAL) with coloured lids on a timber deck, a
    crate of empties and a bundle of flattened cardboard behind them, a sign on a post."""
    reset()
    mm = M()
    parts = []
    for k in range(7):
        parts.append(wood_box(f"Deck{k}", (1.24, 0.17, 0.035), (0, -0.53 + k * 0.1767, 0.0175), mm["wood_dark"], bev=0.006))
    for sy in (-1, 1):
        parts.append(wood_box(f"Bearer{sy}", (0.08, 1.2, 0.02), (sy * 0.55, 0, 0.0), mm["wood_dark"], "y", 0.004))
    z0 = 0.035
    bins = [("BOTTLES", "#2f8c88", "#22706d", "icon_bottle_alpha.png"), ("PAPER", "#3d7fd1", "#2c64ad", "icon_paper_alpha.png"), ("GENERAL", "#4a4d55", "#2f3137", "icon_general_alpha.png")]
    for k, (word, body_c, lid_c, icon) in enumerate(bins):
        x = -0.41 + k * 0.41
        body = mat(f"bin_body{k}", body_c, 0.5)
        lidm = mat(f"bin_lid{k}", lid_c, 0.4)
        # a slightly tapered body
        b = box(f"Bin{k}", (0.36, 0.48, 0.8), (x, -0.08, z0 + 0.42), body, 0.03)
        for v in b.data.vertices:
            t = (v.co.z - (z0 + 0.42 - 0.4)) / 0.8
            sc = 0.9 + 0.1 * t
            v.co.x = (v.co.x - 0) * sc if False else v.co.x
        bt = b
        bt.data.transform(Matrix.Translation((0, 0, 0)))
        parts.append(bt)
        parts.append(box(f"BinRim{k}", (0.38, 0.5, 0.04), (x, -0.08, z0 + 0.83), body, 0.012))
        lid = box(f"Lid{k}", (0.39, 0.53, 0.045), (x, -0.09, z0 + 0.87), lidm, 0.015)
        parts.append(lid)
        if k == 0:
            parts.append(cyl(f"LidHole{k}", 0.06, 0.006, (x, -0.12, z0 + 0.891), mat("hole_dark", "#151618", 0.9), 20))
            parts.append(torus(f"LidHoleRim{k}", 0.065, 0.008, (x, -0.12, z0 + 0.893), lidm, 20, 6))
        elif k == 1:
            parts.append(box(f"LidSlot{k}", (0.26, 0.04, 0.006), (x, -0.14, z0 + 0.892), mat("hole_dark"), 0.002))
            parts.append(box(f"LidSlotRim{k}", (0.29, 0.07, 0.012), (x, -0.14, z0 + 0.89), lidm, 0.004))
        else:
            parts.append(box(f"LidFlap{k}", (0.3, 0.2, 0.012), (x, -0.2, z0 + 0.896), mat("flap", "#5b5e66", 0.5), 0.005))
        parts.append(box(f"LidGrip{k}", (0.2, 0.03, 0.03), (x, -0.36, z0 + 0.86), lidm, 0.01))
        # front: the icon and the word
        parts.append(plane(f"Icon{k}", 0.2, 0.2, (x, -0.3215, z0 + 0.58), img_mat(icon.replace(".png", ""), icon, 0.5)))
        parts.append(ltext(f"Word{k}", word, 0.075, (x, -0.322, z0 + 0.38), m=mat("cream")))
        parts.append(box(f"Stripe{k}", (0.3, 0.004, 0.02), (x, -0.321, z0 + 0.3), mat("cream"), 0.0))
        # back: hinge bar, handle, two wheels
        parts.append(rod(f"Hinge{k}", (x - 0.17, 0.18, z0 + 0.86), (x + 0.17, 0.18, z0 + 0.86), 0.012, lidm, 8))
        parts.append(poly_tube(f"Handle{k}", [(x - 0.13, 0.16, z0 + 0.74), (x - 0.13, 0.22, z0 + 0.76), (x + 0.13, 0.22, z0 + 0.76), (x + 0.13, 0.16, z0 + 0.74)], 0.012, lidm, sides=8, corner=0.03))
        parts.append(rod(f"Axle{k}", (x - 0.2, 0.15, z0 + 0.07), (x + 0.2, 0.15, z0 + 0.07), 0.01, mm["steel"], 8))
        for s in (-1, 1):
            parts.append(cyl(f"Wheel{k}{s}", 0.07, 0.04, (x + s * 0.15 - 0.02, 0.15, z0 + 0.07), mm["rubber"], 16, rot=(0, R90, 0)))
            parts.append(cyl(f"Hub{k}{s}", 0.03, 0.042, (x + s * 0.15 - 0.021, 0.15, z0 + 0.07), mm["steel"], 10, rot=(0, R90, 0)))
    # behind the bins: a crate of empty bottles and a bundle of flattened cardboard
    crate = mat("bottle_crate", "#f2b33d", 0.55)
    cx, cy = -0.38, 0.43
    parts.append(box("Crate", (0.4, 0.3, 0.2), (cx, cy, z0 + 0.1), crate, 0.012))
    parts.append(box("CrateInside", (0.36, 0.26, 0.02), (cx, cy, z0 + 0.19), mat("crate_in", "#b8842a", 0.6), 0.0))
    gl = [mat("glass_green", "#3e8a4a", 0.1), mat("glass_brown", "#8a5a33", 0.1), mat("glass_clear", "#cfe9ef", 0.1)]
    for i in range(3):
        for j in range(2):
            if (i, j) == (2, 1):
                continue
            bx, by = cx - 0.12 + i * 0.12, cy - 0.07 + j * 0.14
            parts.append(lathe(f"Bottle{i}{j}", [(0, 0), (0.035, 0), (0.035, 0.16), (0.014, 0.22), (0.012, 0.27), (0, 0.27)], gl[(i + j) % 3], 12, (bx, by, z0 + 0.03)))
    card = mat("cardboard", "#c9a06a", 0.85)
    for k in range(4):
        parts.append(box(f"Card{k}", (0.6, 0.012, 0.42 - k * 0.04), (0.25 + k * 0.01, 0.5 - k * 0.014, z0 + 0.22), card, 0.004, rot=(-0.18, 0, 0.02 * k)))
    parts.append(torus("String", 0.012, 0.004, (0, 0, 0), mm["rope"], 8, 4))
    for z in (0.15, 0.32):
        parts.append(box(f"Twine{z}", (0.64, 0.07, 0.008), (0.265, 0.48, z0 + z), mm["rope"], 0.002, rot=(-0.18 + R90, 0, 0)))
    # the sign: a post at the back right, a double-sided board
    parts.append(box("SignPost", (0.05, 0.05, 1.3), (0.57, 0.57, z0 + 0.65), mm["navy"], 0.01))
    parts.append(box("SignBoard", (0.5, 0.025, 0.2), (0.33, 0.57, z0 + 1.18), mat("sign_board", "#2f8c88", 0.45), 0.01))
    parts.append(ltext("SignFront", "PLEASE RECYCLE", 0.08, (0.33, 0.556, z0 + 1.18), m=mat("cream")))
    parts.append(ltext("SignBack", "PLEASE RECYCLE", 0.08, (0.33, 0.584, z0 + 1.18), (R90, 0, math.pi), mat("cream")))
    root = parent_all(parts, "WasteBins")
    finish(root, "waste_bin", ((0, 0, 0.55), 3.0, 28, -30))


# ---------------------------------------------------------------------------------------------------------------------------
# 12. The wall kit, the mop bucket and the mop
# ---------------------------------------------------------------------------------------------------------------------------


def skimmer_rack():
    """Wall-mounted (the -X wall, never seen but it casts its shadow): a timber batten with hooks holding a long-pole leaf
    skimmer, a wall brush and a coiled vacuum hose. Pivot on the wall face at floor level; battens reach 7 cm into the wall."""
    reset()
    mm = M()
    parts = []
    for z in (1.5, 1.2):
        parts.append(wood_box(f"Batten{z}", (2.6, 0.03, 0.1), (0, -0.015, z), mm["wood"], bev=0.006))
        parts.append(box(f"Spacer{z}", (2.5, 0.07, 0.06), (0, 0.035, z), mm["wood_dark"], 0.004))
    alu = mat("alu", "#c3cad0", 0.3, 1.0)
    # skimmer on the upper hooks
    for x in (-0.8, 0.6):
        parts.append(hook(f"HookS{x}", (x, -0.03, 1.47), mm["chrome"], 0.07))
    parts.append(rod("SkimmerPole", (-1.25, -0.09, 1.5), (1.15, -0.09, 1.5), 0.016, alu, 10))
    parts.append(cyl("PoleEnd", 0.02, 0.05, (-1.3, -0.09, 1.5), mm["black"], 10, rot=(0, R90, 0)))
    fr = mat("skim_frame", "#3d7fd1", 0.4)
    frame = poly_tube("SkimmerFrame", [(1.15, -0.09, 1.5), (1.25, -0.09, 1.5), (1.25, -0.09, 1.72), (1.65, -0.09, 1.72), (1.65, -0.09, 1.28), (1.25, -0.09, 1.28), (1.25, -0.09, 1.5)], 0.012, fr, sides=8, corner=0.05)
    parts.append(frame)
    netm = two_sided(img_mat("net", "net_alpha.png", 0.8))
    parts.append(plane("SkimmerNet", 0.38, 0.42, (1.45, -0.09, 1.5), netm))
    # brush on the lower hooks
    for x in (-0.5, 0.8):
        parts.append(hook(f"HookB{x}", (x, -0.03, 1.17), mm["chrome"], 0.07))
    parts.append(rod("BrushPole", (-0.95, -0.09, 1.2), (1.3, -0.09, 1.2), 0.016, alu, 10))
    parts.append(box("BrushHead", (0.07, 0.06, 0.46), (-1.0, -0.09, 1.2), mat("brush_body", "#f4f1ea", 0.5), 0.015))
    parts.append(box("Bristles", (0.06, 0.05, 0.44), (-1.06, -0.09, 1.2), mat("bristle", "#2c4f7c", 0.9), 0.005))
    # the vacuum hose coiled on a big hook
    parts.append(box("HoseHook", (0.06, 0.18, 0.04), (0.1, -0.09, 0.95), mm["steel"], 0.01))
    hosem = mat("hose", "#5aa9d6", 0.5)
    pts = []
    for k in range(5 * 10):
        a = math.pi / 2 + 2 * math.pi * k / 10
        r = 0.24 + 0.01 * math.sin(k)
        pts.append((0.1 + r * math.cos(a) * 0.95, -0.06 - 0.012 * k / 10 - 0.03, 0.93 - r + r * math.sin(a) * 1.05))
    parts.append(tube("Hose", pts, 0.022, hosem, res=3, sides=8))
    parts.append(cyl("HoseCuff", 0.03, 0.08, (0.32, -0.12, 0.62), mat("hose_cuff", "#2a2a2e", 0.6), 10))
    root = parent_all(parts, "SkimmerRack")
    finish(root, "skimmer_rack", ((0.2, 0, 1.1), 4.6, 10, -20))


def fish_net():
    """A long-handled fish net on two wall hooks (the +X wall, above the radiators). Pivot on the wall face at floor level."""
    reset()
    mm = M()
    parts = []
    z = 1.38
    for x in (-0.5, 0.3):
        parts.append(box(f"HookPlate{x}", (0.05, 0.075, 0.1), (x, 0.0225, z - 0.02), mm["wood_dark"], 0.006))
        parts.append(hook(f"Hook{x}", (x, -0.015, z - 0.03), mm["chrome"], 0.06))
    pole = mat("net_pole", "#2f8c88", 0.4)
    parts.append(rod("Handle", (-1.0, -0.06, z), (0.62, -0.06, z), 0.016, pole, 10))
    parts.append(cyl("Grip", 0.02, 0.22, (-1.02, -0.06, z), mm["black"], 10, rot=(0, R90, 0)))
    parts.append(torus("HangLoop", 0.03, 0.005, (-1.07, -0.06, z), mm["rope"], 10, 4, rot=(R90, 0, 0)))
    hoop_c = (0.86, -0.06, z)
    parts.append(torus("Hoop", 0.22, 0.01, hoop_c, mat("hoop", "#c3cad0", 0.3, 1.0), 32, 6, rot=(R90, 0, 0)))
    parts.append(box("Ferrule", (0.08, 0.035, 0.035), (0.64, -0.06, z), mm["steel"], 0.008))
    netm = two_sided(img_mat("net", "net_alpha.png", 0.8))
    parts.append(net_bag("NetBag", hoop_c, 0.21, 0.32, netm, out=0.1))
    parts.append(sphere("Leaf", 0.03, (0.86, -0.12, z - 0.42), mat("leaf_dead", "#b88a3e", 0.8), 8, 4, scale=(1.4, 0.5, 0.9)))
    root = parent_all(parts, "FishNet")
    finish(root, "fish_net", ((0, 0, 1.2), 3.4, 10, -20))


def fuse_box():
    """A grey electrical cabinet with a yellow high-voltage sticker, a key, labels and grey conduits running up the wall, along
    under the dado and up the window pier past the sill. Pivot on the wall face at floor level (the +X wall at z 12.05)."""
    reset()
    mm = M()
    parts = []
    grey = mat("cab_grey", "#a9aeb2", 0.45, 0.3)
    dark = mat("cab_dark", "#7d8388", 0.5, 0.3)
    bz0, bz1, W = 0.85, 1.48, 0.46
    parts.append(box("Cabinet", (W, 0.24, bz1 - bz0), (0, -0.05, (bz0 + bz1) / 2), grey, 0.015))
    parts.append(box("Door", (W - 0.04, 0.02, bz1 - bz0 - 0.04), (0, -0.175, (bz0 + bz1) / 2), grey, 0.01))
    for z in (bz0 + 0.12, bz1 - 0.12):
        parts.append(cyl(f"Hinge{z}", 0.012, 0.06, (-W / 2 + 0.01, -0.18, z - 0.03), dark, 10))
    parts.append(cyl("Lock", 0.022, 0.015, (0.17, -0.19, (bz0 + bz1) / 2), mm["chrome"], 14, rot=(R90, 0, 0)))
    parts.append(box("Key", (0.012, 0.03, 0.04), (0.17, -0.205, (bz0 + bz1) / 2 - 0.01), mat("brass"), 0.003))
    parts.append(torus("KeyRing", 0.018, 0.003, (0.17, -0.205, (bz0 + bz1) / 2 - 0.05), mm["chrome"], 12, 4, rot=(0, R90, 0)))
    parts.append(box("KeyTag", (0.006, 0.03, 0.05), (0.172, -0.21, (bz0 + bz1) / 2 - 0.09), mat("tag_red", "#d6423a", 0.6), 0.002))
    parts.append(plane("Voltage", 0.15, 0.13, (0, -0.1865, bz1 - 0.14), img_mat("voltage", "voltage_alpha.png", 0.5)))
    parts.append(box("LabelStrip", (0.24, 0.004, 0.05), (0, -0.187, bz0 + 0.12), mat("label_white", "#f4f1ea", 0.7), 0.0))
    parts.append(ltext("LabelText", "MAINS · POOL PLANT", 0.028, (0, -0.1895, bz0 + 0.12), m=mm["black"]))
    for k in range(5):
        parts.append(box(f"Vent{k}", (0.2, 0.006, 0.01), (0, -0.186, bz0 + 0.2 + k * 0.025), dark, 0.002))
    # conduits: three up from the top, along to the pier (local +X), up past the sill
    cm = mat("conduit", "#b9bdc0", 0.4, 0.2)
    for k, dx in enumerate((-0.12, 0.0, 0.12)):
        y = -0.03
        zt = 1.83 - k * 0.05
        xe = 0.88 + k * 0.05
        parts.append(poly_tube(f"Conduit{k}", [(dx, y, bz1), (dx, y, zt), (xe, y, zt), (xe, y, 4.2)], 0.016, cm, sides=8, corner=0.07))
        for z in (2.6, 3.4):
            parts.append(box(f"Saddle{k}{z}", (0.05, 0.02, 0.03), (xe, y + 0.002, z), mm["steel"], 0.004))
    parts.append(box("JunctionBox", (0.22, 0.07, 0.16), (0.93, -0.035, 4.3), grey, 0.01))
    parts.append(poly_tube("FloorConduit", [(0.0, -0.03, bz0), (0.0, -0.03, 0.12), (0.0, -0.06, 0.0)], 0.02, cm, sides=8, corner=0.06))
    root = parent_all(parts, "FuseBox")
    finish(root, "fuse_box", ((0.4, 0, 2.2), 6.0, 10, -25))


def mop_bucket():
    """A yellow wheeled mop bucket with a wringer, a folded CAUTION WET FLOOR sign leaning on it. 0.68 x 0.68."""
    reset()
    mm = M()
    parts = []
    yel = mat("bucket_yellow", "#f6cf45", 0.35)
    grey = mat("wringer_grey", "#5b5e66", 0.45)
    # the base with four casters
    parts.append(box("Base", (0.56, 0.4, 0.05), (0, 0.06, 0.09), yel, 0.02))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl(f"Caster{sx}{sy}", 0.035, 0.03, (sx * 0.23, 0.06 + sy * 0.15, 0.035), mm["black"], 12, rot=(R90, 0, 0)))
            parts.append(box(f"Fork{sx}{sy}", (0.04, 0.05, 0.04), (sx * 0.23, 0.06 + sy * 0.15, 0.075), grey, 0.006))
    # the bucket (tapered) with its water
    b = box("Bucket", (0.52, 0.36, 0.3), (0, 0.06, 0.26), yel, 0.04)
    for v in b.data.vertices:
        t = (v.co.z - 0.11) / 0.3
        v.co.x *= 0.9 + 0.1 * t
        v.co.y = 0.06 + (v.co.y - 0.06) * (0.9 + 0.1 * t)
    parts.append(b)
    parts.append(box("Water", (0.46, 0.3, 0.01), (0, 0.06, 0.39), mat("mop_water", "#a8c6c9", 0.08), 0.004))
    parts.append(box("BucketRim", (0.54, 0.38, 0.025), (0, 0.06, 0.41), yel, 0.01))
    # the wringer at the +X end, its lever up
    parts.append(box("Wringer", (0.2, 0.3, 0.2), (0.16, 0.06, 0.5), grey, 0.025))
    parts.append(box("WringerPlate", (0.16, 0.24, 0.12), (0.08, 0.06, 0.52), mat("wringer_plate", "#7d8388", 0.4), 0.01))
    parts.append(poly_tube("Lever", [(0.24, -0.06, 0.55), (0.3, -0.06, 0.95), (0.3, 0.18, 0.95), (0.24, 0.18, 0.55)], 0.014, grey, sides=8, corner=0.05))
    parts.append(cyl("LeverGrip", 0.02, 0.22, (0.3, -0.05, 0.95), mm["black"], 10, rot=(-R90, 0, 0)))
    parts.append(poly_tube("PushHandle", [(-0.26, -0.08, 0.38), (-0.3, -0.08, 0.85), (-0.3, 0.2, 0.85), (-0.26, 0.2, 0.38)], 0.012, mm["chrome"], sides=8, corner=0.05))
    parts.append(ltext("BucketText", "POOL", 0.05, (-0.05, -0.115, 0.27), m=mm["navy"]))
    # the folded wet-floor sign, leaning on the bucket's front
    face = img_mat("wetfloor", "wetfloor.png", 0.4)
    sign_parts = [box("SignBoard", (0.3, 0.035, 0.62), (0, 0, 0.31), yel, 0.012)]
    sign_parts.append(plane("SignFace", 0.28, 0.35, (0, -0.0185, 0.24), face))
    sign_parts.append(ltext("SignCaution", "CAUTION", 0.07, (0, -0.0185, 0.51), m=mm["black"]))
    sign_parts.append(ltext("SignWet", "WET FLOOR", 0.05, (0, -0.0185, 0.45), m=mm["black"]))
    sign_parts.append(box("SignHandle", (0.12, 0.04, 0.03), (0, 0, 0.6), mm["black"], 0.008))
    sg = jn(sign_parts, "WetFloorSign")
    sg.rotation_euler = (-0.28, 0, 0.0)
    sg.location = (-0.04, -0.3, 0.0)
    apply_all(sg)
    parts.append(sg)
    root = parent_all(parts, "MopBucket")
    finish(root, "mop_bucket", ((0, 0, 0.45), 2.8, 25, -30))


def mop():
    """The mop the coach carries: about 1.5 m, upright along Blender Z (Godot Y), pivot at its middle."""
    reset()
    mm = M()
    parts = []
    alu = mat("alu", "#c3cad0", 0.3, 1.0)
    parts.append(cyl("Handle", 0.014, 1.32, (0, 0, -0.6), alu, 10))
    parts.append(cyl("Grip", 0.018, 0.16, (0, 0, 0.58), mat("grip_yellow", "#f6cf45", 0.5), 10, bev=0.006))
    parts.append(torus("HangLoop", 0.022, 0.004, (0, 0, 0.77), mm["black"], 10, 4, rot=(R90, 0, 0)))
    parts.append(box("Clamp", (0.1, 0.06, 0.05), (0, 0, -0.6), mat("clamp", "#3d7fd1", 0.45), 0.012))
    strand = mat("strand", "#ece6d6", 0.95)
    rr = random.Random(4)
    for k in range(18):
        a = 2 * math.pi * k / 18
        r0 = 0.02
        r1 = 0.07 + rr.uniform(0, 0.03)
        pts = [(r0 * math.cos(a), r0 * math.sin(a) * 0.6, -0.62), (r1 * math.cos(a), r1 * math.sin(a) * 0.7, -0.7), ((r1 + 0.02) * math.cos(a + 0.2), (r1 + 0.02) * math.sin(a + 0.2) * 0.7, -0.75 - rr.uniform(0, 0.03))]
        parts.append(tube(f"Strand{k}", pts, 0.011, strand, res=2, sides=4))
    root = parent_all(parts, "Mop")
    finish(root, "mop", ((0, 0, 0), 2.2, 15, -30))


JOBS = {}


def job(name):
    def deco(fn):
        JOBS[name] = fn
        return fn

    return deco


job("bench")(lambda: bench(False))
job("bench_dressed")(lambda: bench(True))
job("fins_rack")(fins_rack)
job("fins_pair")(lambda: [fins_pair_carried(k) for k in range(3)])
job("chlorine_station")(chlorine_station)
job("chlorine_bucket")(chlorine_bucket)
job("first_aid_station")(first_aid_station)
job("lifeguard_chair")(lifeguard_chair)
job("life_ring")(life_ring)
job("life_ring_stand")(lambda: ring_board(False))
job("life_ring_wall")(lambda: ring_board(True))
job("office_counter")(office_counter)
job("drinking_fountain")(drinking_fountain)
job("plant_big")(plant_big)
job("treat_table")(treat_table)
job("waste_bin")(waste_bin)
job("skimmer_rack")(skimmer_rack)
job("fish_net")(fish_net)
job("fuse_box")(fuse_box)
job("mop_bucket")(mop_bucket)
job("mop")(mop)


if __name__ == "__main__":
    make_textures()
    for name, fn in JOBS.items():
        if not ONLY or name in ONLY:
            fn()
