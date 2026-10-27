"""Outside the window wall: palms and shrubs in the club's garden. They are hardly seen, but the low sun throws their fronds'
shadows through the windows across the deck, and in Godot they sway (their fronds use GD_foliage, a wind shader), so the light on
the floor moves. Modelled in place (Godot coordinates); writes godot/assets/venue/exterior.glb.

    blender -b -P godot/tools/blender/exterior.py
"""

import os, sys, math, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import *

reset()
random.seed(1962)
trunk_m = mat("palm_trunk", "#9a7652", 0.85)
ring_m = mat("palm_ring", "#7e5f42", 0.9)
leaf_m = gdmat("foliage", "#4f8f4a", 0.6)
shrub_m = gdmat("foliage_shrub", "#3f7a45", 0.7)
parts = []


def frond(name, base, yaw, pitch, length, droop):
    """A palm frond: a midrib with leaflets either side, arching out and down from `base` (Blender coords)."""
    bm = bmesh.new()
    n = 26
    pts = []
    for i in range(n + 1):
        t = i / n
        x = length * t
        z = math.sin(pitch) * x - droop * (x / length) ** 2 * length
        pts.append(Vector((x * math.cos(pitch) * 0 + x, 0, z)))
    rot = Matrix.Rotation(yaw, 4, "Z")
    for i in range(2, n):
        t = i / n
        p = pts[i]
        tangent = (pts[i + 1] - pts[i - 1]).normalized()
        side = Vector((0, 1, 0))
        ll = 0.55 * math.sin(math.pi * min(1.0, t * 1.15)) + 0.08
        for s in (-1, 1):
            tip = p + side * s * ll + Vector((0, 0, -0.22 * ll)) + tangent * 0.18
            w = 0.055
            v0 = bm.verts.new(rot @ (p - tangent * w) + base)
            v1 = bm.verts.new(rot @ (p + tangent * w) + base)
            v2 = bm.verts.new(rot @ tip + base)
            bm.faces.new([v0, v1, v2])
    # the midrib as a thin strip
    for i in range(n):
        a, b = pts[i], pts[i + 1]
        w = 0.025 * (1 - i / n) + 0.008
        q = [bm.verts.new(rot @ (a + Vector((0, -w, 0))) + base), bm.verts.new(rot @ (b + Vector((0, -w, 0))) + base),
             bm.verts.new(rot @ (b + Vector((0, w, 0))) + base), bm.verts.new(rot @ (a + Vector((0, w, 0))) + base)]
        bm.faces.new(q)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    set_mat(o, leaf_m)
    return o


def palm(name, gx, gz, height, lean_dir, lean):
    base = g(gx, 0, gz)
    pts = []
    for k in range(9):
        t = k / 8
        off = Vector((math.cos(lean_dir), math.sin(lean_dir), 0)) * lean * t * t
        pts.append(base + off + Vector((0, 0, height * t)))
    trunk = tube(name + "Trunk", pts, 0.2, trunk_m)
    out = [trunk]
    for k in range(1, 12):  # the ringed bark
        t = k / 12
        idx = t * 8
        c = pts[int(idx)].lerp(pts[min(8, int(idx) + 1)], idx - int(idx))
        out.append(torus(f"{name}Ring{k}", 0.205 - 0.03 * t, 0.025, c, ring_m, 20, 6))
    top = pts[-1]
    out.append(sphere(name + "Crown", 0.32, top, trunk_m, 12, 8))
    for k in range(13):
        yaw = 2 * math.pi * k / 13 + random.uniform(-0.15, 0.15)
        pitch = random.uniform(0.15, 0.55)
        out.append(frond(f"{name}Frond{k}", top, yaw, pitch, random.uniform(2.4, 3.2), random.uniform(0.9, 1.5)))
    return out


def shrub(name, gx, gz, r):
    out = []
    for k in range(7):
        off = Vector((random.uniform(-r, r) * 0.6, random.uniform(-r, r) * 0.6, random.uniform(0.2, 0.6) * r))
        out.append(sphere(f"{name}{k}", r * random.uniform(0.5, 0.8), g(gx, 0, gz) + off, shrub_m, 14, 8))
    return out


# palms along the garden beyond the windows (x 16-20), spaced so their fronds fall in the windows' light
for k, (x, z, h, ld, le) in enumerate([(17.2, -12.0, 9.5, 2.6, 1.1), (18.5, -3.5, 10.5, 3.3, 0.8), (17.0, 3.8, 8.6, 2.2, 1.3), (18.8, 10.5, 9.8, 2.9, 0.9), (20.5, -8.0, 11.5, 3.0, 0.7)]):
    parts += palm(f"Palm{k}", x, z, h, ld, le)
for k, (x, z, r) in enumerate([(16.0, -15.0, 1.1), (16.2, -7.5, 1.3), (15.9, -0.5, 1.0), (16.3, 7.2, 1.2), (16.0, 13.0, 1.1)]):
    parts += shrub(f"Shrub{k}", x, z, r)
# the garden's ground, a lawn strip under the windows
parts.append(box("Lawn", (8, 34, 0.1), g(19.0, -0.06, -1.6), mat("lawn", "#6aa856", 0.9), 0))

root = parent_all(parts, "Exterior")
export(os.path.join(VENUE, "exterior.glb"), [root])
