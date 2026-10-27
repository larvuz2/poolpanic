"""Shared pieces for props_lockers.py and props_dressing.py: boxes by their extents, decals, sub-assemblies built at the origin
and moved into place, and the small things a swimming club collects (towels, socks, flip-flops, goggles, kickboards, bags,
pot plants). Everything here is built in Blender coordinates; a sub-assembly faces Blender -Y (Godot +Z) until it is moved.
"""

import os, sys, math, random, shutil, subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import *

PROPS = os.path.join(VENUE, "props")
TEXDIR = os.path.join(TEXTURES, "props")
PI = math.pi

# facing (Godot direction) -> rotation about Blender Z for an assembly built facing Blender -Y (Godot +Z)
FACE = {"+z": 0.0, "+x": PI / 2, "-x": -PI / 2, "-z": PI}


def ensure_textures(names):
    """Draw the textures (props_dressing_textures.py, Pillow) if any of `names` is missing."""
    missing = [n for n in names if not os.path.exists(os.path.join(TEXDIR, n + ".png"))]
    if not missing:
        return
    script = os.path.join(HERE, "props_dressing_textures.py")
    for py in ("python3", "python3.12", "python3.13", "python3.11"):
        exe = shutil.which(py)
        if exe and subprocess.run([exe, "-c", "from PIL import Image"], capture_output=True).returncode == 0:
            subprocess.run([exe, script], check=True)
            return
    raise RuntimeError("No python3 with Pillow to draw the textures: " + ", ".join(missing))


def tmat(name, rough=0.6, metal=0.0, emit_strength=0.0):
    """A material showing the texture godot/assets/textures/props/<name>.png."""
    m = mat("TX_" + name, "#ffffff", rough, metal, image=os.path.join(TEXDIR, name + ".png"))
    if emit_strength:
        nt = m.node_tree
        p = nt.nodes["Principled BSDF"]
        tex = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
        nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = emit_strength
    return m


def bx(name, x0, x1, y0, y1, z0, z1, m=None, bev=0.01, seg=2):
    """A box by its extents in Blender coordinates."""
    xa, xb = sorted((x0, x1))
    ya, yb = sorted((y0, y1))
    za, zb = sorted((z0, z1))
    return box(name, (xb - xa, yb - ya, zb - za), ((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2), m, bev, seg)


def gbx(name, x0, x1, y0, y1, z0, z1, m=None, bev=0.01, seg=2):
    """A box by its extents in Godot coordinates (x, y up, z)."""
    return bx(name, x0, x1, -z0, -z1, y0, y1, m, bev, seg)


def xf(obj, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, scale=None):
    """Turn (x, then y, then z) and move an object built at the origin, keeping its origin at `loc`."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # the mesh in world space, its origin at 0
    if scale is not None:
        obj.scale = scale if hasattr(scale, "__len__") else (scale, scale, scale)
    obj.rotation_euler = (rx, ry, rz)
    obj.location = loc
    apply_all(obj)
    return obj


def grp(parts, name, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0):
    """Join the parts into one mesh named `name`, then turn and move it as one."""
    o = join([p for p in parts if p], name)
    return xf(o, loc, rz, rx, ry)


def at_origin(obj, loc=(0, 0, 0)):
    """Bake the object's transform into its mesh (its origin to the world's origin), then move it by `loc`, origin and all:
    a part modelled around (0, 0, 0) gets its pivot there (a clock's hand)."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.location = loc
    return obj


def set_origin(obj, point):
    """Move an object's origin to `point` (Blender coordinates) without moving its mesh: a hinge, a clock's hub."""
    p = Vector(point)
    d = p - obj.matrix_world.translation
    obj.data.transform(Matrix.Translation(-d))
    obj.location = obj.location + d
    return obj


def decal(name, w, h, m, loc=(0, 0, 0), rz=0.0, tilt=0.0):
    """A w×h picture standing upright and facing Blender -Y, then turned by rz about Z (tilt: turned within its plane)."""
    o = plane(name, w, h, (0, 0, 0), m, (PI / 2, tilt, 0))
    return xf(o, loc, rz)


def flat_text(name, body, size, m, loc=(0, 0, 0), rz=0.0, depth=0.004, face=None, align="CENTER", rx=PI / 2, res=2):
    """Text standing up and facing Blender -Y, then turned by rz; light on triangles (curve resolution `res`; depth 0 = flat)."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = depth / 2
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.resolution_u = res
    f = font(face or "BarlowCondensed-Bold")
    if f:
        cu.font = f
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (rx, 0, 0)
    for q in bpy.context.selected_objects:
        q.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    if depth == 0:  # keep only the front face
        pass
    o.data.materials.clear()
    o.data.materials.append(m)
    return xf(o, loc, rz)


def framed(name, w, h, art, frame_m, loc, rz=0.0, depth=0.03, border=0.035, glass=True, mat_border=0.0, mount=None):
    """A framed picture hung flat on a wall: the frame's back on the wall (y=0 locally), the picture in front, glazed."""
    parts = []
    W, H = w + 2 * border + 2 * mat_border, h + 2 * border + 2 * mat_border
    for k, (cx, cz, sw, sh) in enumerate([(0, H / 2 - border / 2, W, border), (0, -H / 2 + border / 2, W, border), (-W / 2 + border / 2, 0, border, H), (W / 2 - border / 2, 0, border, H)]):
        parts.append(bx(f"{name}Frame{k}", cx - sw / 2, cx + sw / 2, -depth, 0, cz - sh / 2, cz + sh / 2, frame_m, min(0.008, border * 0.3)))
    parts.append(bx(f"{name}Back", -W / 2 + 0.01, W / 2 - 0.01, -0.012, 0, -H / 2 + 0.01, H / 2 - 0.01, mount or mat("paper"), 0))
    parts.append(decal(f"{name}Art", w, h, art, (0, -0.014, 0)))
    o = grp(parts, name)
    out = [o]
    if glass:
        g_ = decal(f"Glass_{name}", W - 2 * border + 0.01, H - 2 * border + 0.01, mat("glass_frame", "#e8f4f6", 0.04, alpha=0.18), (0, -depth * 0.7, 0))
        out.append(g_)
    for p in out:
        xf(p, loc, rz)
    return out


# ---- soft and small things ---------------------------------------------------------------------------------------------------
def towel_folded(name, w, d, h, m, stripe=None, loc=(0, 0, 0), rz=0.0):
    parts = [bx(name + "Body", -w / 2, w / 2, -d / 2, d / 2, 0, h, m, min(0.02, h * 0.45), 3)]
    if stripe:
        for sx in (-1, 1):
            parts.append(bx(name + f"Stripe{sx}", sx * w * 0.3 - 0.025, sx * w * 0.3 + 0.025, -d / 2 - 0.002, d / 2 + 0.002, 0.004, h + 0.002, stripe, min(0.015, h * 0.4)))
    return grp(parts, name, loc, rz)


def towel_rolled(name, r, length, m, stripe=None, loc=(0, 0, 0), rz=0.0):
    """A rolled towel lying along local X, its spiral end showing."""
    parts = [cyl(name + "Roll", r, length, (-length / 2, 0, r), m, 18, bev=min(0.012, r * 0.3), rot=(0, PI / 2, 0))]
    parts.append(torus(name + "Spiral", r * 0.55, r * 0.12, (length / 2 + 0.001, 0, r), m, 16, 6, rot=(0, PI / 2, 0)))
    if stripe:
        parts.append(cyl(name + "Band", r + 0.003, 0.05, (-0.025 + length * 0.2, 0, r), stripe, 18, rot=(0, PI / 2, 0)))
    return grp(parts, name, loc, rz)


def towel_hanging(name, w, length, m, stripe=None, loc=(0, 0, 0), rz=0.0, sag=0.02):
    """A towel hanging from a hook: a soft slab, folded over at the top, bellying out a little at the bottom."""
    bm_parts = []
    o = bx(name + "Hang", -w / 2, w / 2, -0.025, 0, -length, 0, m, 0.012, 2)
    for v in o.data.vertices:  # it hangs away from the wall at the bottom and pinches in at the hook
        t = -v.co.z / length
        v.co.y -= sag * t * t * 3
        v.co.x *= 0.72 + 0.28 * min(1.0, t * 3)
    bm_parts.append(o)
    bm_parts.append(cyl(name + "Fold", 0.03, w * 0.72, (-w * 0.36, -0.02, -0.02), m, 12, rot=(0, PI / 2, 0)))
    if stripe:
        for z in (-length + 0.08, -length + 0.12):
            s = bx(name + f"Stripe{z:.2f}", -w / 2 + 0.005, w / 2 - 0.005, -0.03 - sag * 2.6, -0.004, z, z + 0.025, stripe, 0)
            bm_parts.append(s)
    return grp(bm_parts, name, loc, rz)


def robe(name, m, belt_m=None, loc=(0, 0, 0), rz=0.0):
    """A bathrobe on a hook: a body, two sleeves hanging at the sides, a collar and a belt tied loose."""
    parts = []
    body = bx(name + "Body", -0.24, 0.24, -0.06, 0, -1.08, -0.04, m, 0.03, 2)
    for v in body.data.vertices:
        t = -v.co.z / 1.08
        v.co.x *= 0.55 + 0.45 * min(1.0, t * 2.2)
        v.co.y -= 0.02 * t
    parts.append(body)
    for sx in (-1, 1):
        s = bx(name + f"Sleeve{sx}", -0.065, 0.065, -0.07, -0.005, -0.62, 0, m, 0.03, 2)
        parts.append(xf(s, (sx * 0.2, 0, -0.12), ry=sx * 0.12))
    parts.append(torus(name + "Collar", 0.09, 0.025, (0, -0.04, -0.07), m, 20, 8, rot=(PI / 2 - 0.3, 0, 0)))
    if belt_m:
        parts.append(bx(name + "Belt", -0.22, 0.22, -0.075, -0.055, -0.6, -0.56, belt_m, 0.008))
        for sx, ang in ((-1, 0.15), (1, -0.25)):
            b = bx(name + f"BeltEnd{sx}", -0.018, 0.018, -0.008, 0.008, -0.3, 0, belt_m, 0.006)
            parts.append(xf(b, (sx * 0.05, -0.07, -0.58), ry=ang))
    return grp(parts, name, loc, rz)


def sock(name, m, loc=(0, 0, 0), rz=0.0, cuff=None):
    """A sock lying on the floor: a squashed bent tube with a toe and a heel."""
    pts = [(-0.13, 0, 0.022), (0.0, 0, 0.022), (0.06, 0.03, 0.02), (0.1, 0.1, 0.018)]
    parts = [poly_tube(name + "Leg", pts, 0.032, m, 12, 0.06)]
    parts.append(sphere(name + "Toe", 0.033, (0.1, 0.1, 0.018), m, 12, 8))
    if cuff:
        parts.append(cyl(name + "Cuff", 0.034, 0.03, (-0.15, 0, 0.022), cuff, 12, rot=(0, PI / 2, 0)))
    o = join(parts, name)
    o.scale = (1, 1, 0.5)
    return xf(o, loc, rz, scale=(1, 1, 0.5))


def flip_flop(name, sole_m, strap_m, loc=(0, 0, 0), rz=0.0, length=0.26):
    """A flip-flop: a foot-shaped sole and a V strap with its toe post."""
    pts = []
    for k in range(28):
        a = 2 * PI * k / 28
        y = math.sin(a) * length / 2
        t = (y / (length / 2) + 1) / 2  # 0 at the heel, 1 at the toe
        wid = 0.038 + 0.022 * t - 0.012 * math.exp(-((t - 0.45) ** 2) / 0.02)
        pts.append((math.cos(a) * wid, y))
    sole = extrude_shape(name + "Sole", pts, 0.016, (0, 0, 0), sole_m, (0, 0, 0), 0.004)
    top = extrude_shape(name + "Top", [(x * 0.94, y * 0.96) for x, y in pts], 0.003, (0, 0, 0.016), mat("flipflop_top", "#f2e2c4", 0.8), (0, 0, 0))
    toe = (0.0, length * 0.3, 0.02)
    strap = poly_tube(name + "Strap", [(-0.045, -0.01, 0.018), (-0.03, length * 0.12, 0.05), toe, (0.03, length * 0.12, 0.05), (0.045, -0.01, 0.018)], 0.008, strap_m, 8, 0.04)
    return grp([sole, top, strap], name, loc, rz)


def goggles(name, lens_m, strap_m, loc=(0, 0, 0), rz=0.0, lying=True):
    parts = []
    for sx in (-1, 1):
        parts.append(torus(name + f"Rim{sx}", 0.022, 0.006, (sx * 0.03, 0, 0), strap_m, 16, 6))
        parts.append(cyl(name + f"Lens{sx}", 0.02, 0.008, (sx * 0.03, 0, -0.004), lens_m, 16))
    parts.append(tube(name + "Strap", [(-0.05, 0, 0), (-0.07, 0.06, 0), (0, 0.1, 0), (0.07, 0.06, 0), (0.05, 0, 0)], 0.004, strap_m))
    o = join(parts, name)
    return xf(o, loc, rz, rx=0 if lying else PI / 2)


def bottle(name, m, cap_m, h=0.22, r=0.035, loc=(0, 0, 0), rz=0.0, lying=False):
    parts = [cyl(name + "Body", r, h * 0.82, (0, 0, 0), m, 16, bev=0.008)]
    parts.append(cyl(name + "Neck", r * 0.55, h * 0.1, (0, 0, h * 0.82), m, 12))
    parts.append(cyl(name + "Cap", r * 0.6, h * 0.08, (0, 0, h * 0.92), cap_m, 12, bev=0.004))
    o = join(parts, name)
    if lying:
        return xf(o, loc, rz, ry=PI / 2)
    return xf(o, loc, rz)


def duffel(name, m, trim_m, l=0.5, r=0.14, loc=(0, 0, 0), rz=0.0):
    """A sports holdall lying on its base: a rounded barrel with end panels, a zip and two carry straps."""
    parts = [bx(name + "Body", -l / 2, l / 2, -r, r, 0, r * 1.7, m, r * 0.6, 3)]
    for sx in (-1, 1):
        parts.append(bx(name + f"End{sx}", sx * l / 2 - 0.01, sx * l / 2 + 0.01 * sx, -r * 0.8, r * 0.8, 0.02, r * 1.55, trim_m, 0.03, 2))
    parts.append(bx(name + "Zip", -l * 0.42, l * 0.42, -0.012, 0.012, r * 1.7 - 0.01, r * 1.7 + 0.006, trim_m, 0.004))
    for sy in (-1, 1):
        parts.append(poly_tube(name + f"Strap{sy}", [(-l * 0.22, sy * r * 0.5, r * 1.55), (-l * 0.12, sy * r * 0.35, r * 2.3), (l * 0.12, sy * r * 0.35, r * 2.3), (l * 0.22, sy * r * 0.5, r * 1.55)], 0.012, trim_m, 8, 0.06))
    return grp(parts, name, loc, rz)


def tote(name, m, strap_m, loc=(0, 0, 0), rz=0.0, w=0.36, d=0.14, h=0.34):
    parts = [bx(name + "Body", -w / 2, w / 2, -d / 2, d / 2, 0, h, m, 0.03, 2)]
    for sy in (-1, 1):
        parts.append(poly_tube(name + f"Strap{sy}", [(-w * 0.3, sy * d * 0.45, h - 0.02), (-w * 0.2, sy * d * 0.4, h + 0.17), (w * 0.2, sy * d * 0.4, h + 0.17), (w * 0.3, sy * d * 0.45, h - 0.02)], 0.009, strap_m, 8, 0.07))
    parts.append(bx(name + "Pocket", -w * 0.3, w * 0.3, -d / 2 - 0.006, -d / 2, h * 0.2, h * 0.6, strap_m, 0.006))
    return grp(parts, name, loc, rz)


def kickboard(name, m, w=0.3, l=0.46, t=0.035, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, grip=None):
    """A foam kickboard lying flat (long along local Y): a rounded nose, two finger holes near the tail."""
    pts = []
    for k in range(10):
        a = PI * k / 9
        pts.append((math.cos(a) * w / 2, l / 2 - w / 2 + math.sin(a) * w / 2))
    pts += [(-w / 2, -l / 2 + 0.04), (-w / 2 + 0.04, -l / 2), (w / 2 - 0.04, -l / 2), (w / 2, -l / 2 + 0.04)]
    o = extrude_shape(name, pts, t, (0, 0, 0), m, (0, 0, 0), min(0.012, t * 0.4))
    parts = [o]
    if grip:
        for sx in (-1, 1):
            parts.append(bx(name + f"Hole{sx}", sx * w * 0.28 - 0.035, sx * w * 0.28 + 0.035, -l / 2 + 0.05, -l / 2 + 0.09, t - 0.002, t + 0.001, grip, 0.004))
    return grp(parts, name, loc, rz, rx, ry)


def pull_buoy(name, m, loc=(0, 0, 0), rz=0.0, rx=0.0):
    """A pull buoy: two foam cylinders joined by a waist."""
    parts = [cyl(name + "A", 0.05, 0.08, (0, 0, 0), m, 14, bev=0.015), cyl(name + "B", 0.05, 0.08, (0, 0, 0.13), m, 14, bev=0.015)]
    parts.append(cyl(name + "Waist", 0.03, 0.06, (0, 0, 0.075), mat("foam_white", "#f2f0e8", 0.8), 12))
    return grp(parts, name, loc, rz, rx)


def pot_plant(name, kind, pot_m, loc=(0, 0, 0), rz=0.0, scale=1.0, seed=1):
    """A pot plant: 'palm' (a kentia, tall arching fronds), 'fern' (a Boston fern, a fountain of fronds), 'snake' (upright blades),
    'succulent' (a little rosette), 'trailing' (a pothos spilling over the rim). Pivot at the pot's base."""
    r = random.Random(seed)
    leaf, dark = mat("leaf"), mat("leaf_dark")
    leaf_l = mat("leaf_light", "#79b04f", 0.55)
    soil = mat("soil", "#4a3426", 0.95)
    R, H = dict(palm=(0.26, 0.48), fern=(0.22, 0.34), snake=(0.17, 0.3), trailing=(0.09, 0.1)).get(kind, (0.07, 0.08))
    parts = [cyl(name + "Pot", R, H, (0, 0, 0), pot_m, 24, bev=0.01, r2=R * 1.12)]
    parts.append(torus(name + "Rim", R * 1.12, 0.018 * max(0.5, R / 0.2), (0, 0, H), pot_m, 28, 8))
    parts.append(cyl(name + "Soil", R * 1.05, 0.01, (0, 0, H - 0.03), soil, 20))
    if kind == "palm":
        stem_m = mat("palm_stem", "#7a8a4a", 0.6)
        for k in range(16):  # canes of different heights, each ending in an arching frond of leaflets
            a = 2 * PI * k / 16 * 2.6 + r.uniform(-0.25, 0.25)
            top = H + 0.25 + r.uniform(0.0, 0.75)
            lean = r.uniform(0.04, 0.16)
            base = Vector((math.cos(a) * 0.04, math.sin(a) * 0.04, H - 0.03))
            tip = Vector((math.cos(a) * lean, math.sin(a) * lean, top))
            parts.append(poly_tube(name + f"Cane{k}", [base, tip], 0.009, stem_m, 6, 0.0))
            parts.append(frond(name + f"Frond{k}", r.uniform(0.7, 1.0), 0.36, leaf if k % 3 else dark, tuple(tip), a, r.uniform(0.35, 0.8), 1.3, teeth=14))
    elif kind == "fern":
        for k in range(28):
            a = 2 * PI * k / 28 * 3.1 + r.uniform(-0.15, 0.15)
            parts.append(frond(name + f"Frond{k}", r.uniform(0.4, 0.62), 0.13, leaf if k % 2 else (dark if k % 3 else leaf_l), (0, 0, H - 0.02), a, r.uniform(0.5, 1.2), 2.2, teeth=10))
    elif kind == "snake":
        for k in range(9):
            a = r.uniform(0, 2 * PI)
            d = r.uniform(0.0, 0.09)
            hgt = r.uniform(0.45, 0.85)
            blade = extrude_shape(name + f"Blade{k}", [(-0.035, 0), (0.035, 0), (0.03, hgt * 0.7), (0.0, hgt), (-0.03, hgt * 0.7)], 0.012, (0, 0, 0), dark if k % 2 else mat("snake_leaf", "#4d7f3e", 0.5), (PI / 2, 0, 0))
            for v in blade.data.vertices:
                v.co.y += 0.02 * math.sin(v.co.z * 6)
            blade.rotation_euler = (r.uniform(-0.12, 0.12), r.uniform(-0.12, 0.12), a)
            blade.location = (math.cos(a) * d, math.sin(a) * d, H - 0.03)
            apply_all(blade)
            parts.append(blade)
        parts.append(torus(name + "Band", R * 1.0 + 0.005, 0.012, (0, 0, H * 0.5), mat("mustard"), 24, 6))
    elif kind == "trailing":
        for k in range(16):  # a mound of heart leaves, each turned its own way
            a = 2 * PI * k / 16 * 2.3
            rr = 0.015 + 0.055 * ((k * 7) % 5) / 4
            lf = sphere(name + f"Mound{k}", 0.026, (0, 0, 0), leaf if k % 2 else leaf_l, 8, 6, (1.0, 0.75, 0.28))
            parts.append(xf(lf, (math.cos(a) * rr, math.sin(a) * rr, H + 0.02 + 0.05 * (1 - rr / 0.07)), a, rx=r.uniform(-0.7, 0.7), ry=r.uniform(-0.5, 0.5)))
        for k in range(6):  # vines spilling over the rim, a leaf every few centimetres
            a = 2 * PI * k / 6 + r.uniform(-0.3, 0.3)
            hang = r.uniform(0.1, 0.32)
            pts = [Vector((math.cos(a) * R * 0.6, math.sin(a) * R * 0.6, H + 0.03)), Vector((math.cos(a) * R * 1.25, math.sin(a) * R * 1.25, H + 0.01)), Vector((math.cos(a) * R * 1.35, math.sin(a) * R * 1.35, H - hang))]
            parts.append(poly_tube(name + f"Vine{k}", pts, 0.0035, dark, 5, 0.05))
            n = 2 + int(hang / 0.07)
            for i in range(n):
                t = (i + 1) / (n + 1)
                p = pts[1] + (pts[2] - pts[1]) * t
                side = 1 if i % 2 else -1
                off = Vector((-math.sin(a) * side, math.cos(a) * side, 0)) * 0.02 + Vector((math.cos(a), math.sin(a), 0)) * 0.012
                lf = sphere(name + f"Leaf{k}_{i}", 0.026 - i * 0.002, (0, 0, 0), leaf if (k + i) % 2 else leaf_l, 8, 6, (1.0, 0.75, 0.28))
                parts.append(xf(lf, p + off, a + side * 0.6, rx=0.9 * side))
    else:  # succulent rosette
        for ring_, (n, rr, tilt) in enumerate([(8, 0.06, 1.0), (6, 0.04, 0.6), (4, 0.02, 0.3)]):
            for k in range(n):
                a = 2 * PI * k / n + ring_ * 0.4
                p = sphere(name + f"Petal{ring_}_{k}", 0.03 - ring_ * 0.006, (0, 0, 0), mat("succulent", "#7fae8a", 0.5), 10, 6, (1.4, 0.6, 0.35))
                p.rotation_euler = (0, -tilt, a)
                p.location = (math.cos(a) * rr, math.sin(a) * rr, H + 0.012 + ring_ * 0.012)
                apply_all(p)
                parts.append(p)
    return grp(parts, name, loc, rz) if scale == 1.0 else xf(join(parts, name), loc, rz, scale=scale)


def frond(name, length, width, m, base, azim, pitch, droop, teeth=0, thick=0.004):
    """A flat leaf (a palm frond, a fern frond, a blade) along its own length: tapered, with leaflet teeth when `teeth`, lifted
    by `pitch` (radians up) at the base and curving down by `droop` along it; from `base`, toward azimuth `azim`."""
    n = max(6, teeth * 2) if teeth else 8
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        w = width / 2 * math.sin(PI * min(1.0, t * 1.05)) ** 0.7
        if teeth and i % 2 == 1:
            w *= 1.25
        elif teeth:
            w *= 0.35
        top.append((t * length, w))
        bot.append((t * length, -w))
    pts = top + list(reversed(bot[1:-1]))
    o = extrude_shape(name, pts, thick, (0, 0, 0), m, (0, 0, 0))
    for v in o.data.vertices:  # rise, then droop
        t = v.co.x / length
        v.co.z += length * (math.sin(pitch) * t - droop * 0.5 * t * t) + abs(v.co.y) * 0.4
        v.co.x *= math.cos(pitch) * 0.9 + 0.1
    return xf(o, base, azim)


def pictogram_3d(name, kind, height, m, loc=(0, 0, 0), rz=0.0, depth=0.01):
    """The changing-room figure, a flat cut-out standing up and facing Blender -Y: 'woman' (a dress) or 'man'."""
    h = height
    parts = [cyl(name + "Head", h * 0.11, depth, (0, 0, h * 0.86), m, 20, rot=(PI / 2, 0, 0))]
    if kind == "woman":
        body = [(-h * 0.1, h * 0.72), (h * 0.1, h * 0.72), (h * 0.2, h * 0.3), (-h * 0.2, h * 0.3)]
        legs = [(-h * 0.1, h * 0.3), (-h * 0.03, h * 0.3), (-h * 0.03, 0), (-h * 0.1, 0)]
        legs2 = [(h * 0.03, h * 0.3), (h * 0.1, h * 0.3), (h * 0.1, 0), (h * 0.03, 0)]
        shapes = [body, legs, legs2]
    else:
        body = [(-h * 0.13, h * 0.72), (h * 0.13, h * 0.72), (h * 0.13, h * 0.38), (-h * 0.13, h * 0.38)]
        legs = [(-h * 0.13, h * 0.4), (-h * 0.015, h * 0.4), (-h * 0.015, 0), (-h * 0.13, 0)]
        legs2 = [(h * 0.015, h * 0.4), (h * 0.13, h * 0.4), (h * 0.13, 0), (h * 0.015, 0)]
        shapes = [body, legs, legs2]
    arms = [[(-h * 0.17, h * 0.72), (-h * 0.11, h * 0.72), (-h * 0.13, h * 0.4), (-h * 0.19, h * 0.42)], [(h * 0.11, h * 0.72), (h * 0.17, h * 0.72), (h * 0.19, h * 0.42), (h * 0.13, h * 0.4)]]
    if kind != "woman":
        arms = [[(-h * 0.2, h * 0.72), (-h * 0.15, h * 0.72), (-h * 0.15, h * 0.4), (-h * 0.2, h * 0.4)], [(h * 0.15, h * 0.72), (h * 0.2, h * 0.72), (h * 0.2, h * 0.4), (h * 0.15, h * 0.4)]]
    for k, s in enumerate(shapes + arms):
        parts.append(extrude_shape(name + f"Shape{k}", s, depth, (0, 0, 0), m, (PI / 2, 0, 0)))
    return grp(parts, name, loc, rz)


def tris(objs):
    n = 0
    for o in objs:
        if o and o.type == "MESH":
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n
