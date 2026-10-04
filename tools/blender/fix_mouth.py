"""Take a mouth off a Meshy character that is meant to have none. Meshy sometimes reads a shadow under the nose as a smile and
models a lip groove with a dark interior. This relaxes the surface inside a box on the face (the border of the box stays
put), gives the moved vertices the normals of the new surface, and paints the texture of the triangles there with the skin
colour found just below and beside the box. Run it on the mesh as Meshy made it, before game_export.py and the rig:
    tools/blender/run.sh tools/blender/fix_mouth.py -- in.glb out.glb --box x0,x1,z0,z1,y_max [--paint] [--paint-box x0,x1,z0,z1,y_max]
        [--iters 250] [--mu 0] [--mark]
--box is in the mesh's own coordinates (Blender: Z up, -Y the front, a Meshy mesh is centred on the origin): the vertices with
x0 <= x <= x1, z0 <= z <= z1 and y <= y_max are relaxed. Cover the whole mouth and nothing of the nose or the goggles.
--iters and --mu: plain relaxation (--mu 0, many iterations) leaves a smooth patch; --mu -0.53 (Taubin, the default, 40
iterations) keeps more of the original relief but can leave a faint crease.
--paint repaints the texture: every triangle with a vertex in --paint-box (default: --box) gets the skin colour, never over
the texels of another triangle. --mark paints magenta instead, to see which texels it would cover.
The boy of the generic swimmers: --box=-0.12,0.13,0.43,0.505,-0.10 --paint-box=-0.10,0.12,0.435,0.51,-0.10 --iters 250 --mu 0 --paint"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
import common  # noqa: E402

args = common.script_args()
src, dst = args[0], args[1]
box = [float(v) for v in common.option(args, "--box").split(",")]
paint_box = [float(v) for v in common.option(args, "--paint-box", common.option(args, "--box")).split(",")]
mu = common.option(args, "--mu", -0.53, float)
iters = common.option(args, "--iters", 250 if mu == 0 else 40, int)
paint = common.flag(args, "--paint")
mark = common.flag(args, "--mark")

common.clean_scene()
common.import_model(src)
assert not [o for o in bpy.context.scene.objects if o.type == "ARMATURE"], "run this on the mesh before it is rigged"
obj = common.meshes()[0]
me = obj.data
me.calc_loop_triangles()
world, back = obj.matrix_world, obj.matrix_world.inverted()

# The mesh is split at every UV seam: weld the copies of each vertex, work on the welded surface, copy the result back.
points = np.array([(world @ v.co)[:] for v in me.vertices])
_, first, welded = np.unique(np.round(points * 1e5).astype(np.int64), axis=0, return_index=True, return_inverse=True)
welded = welded.ravel()
count = len(first)
at = np.zeros((count, 3))
np.add.at(at, welded, points)
at /= np.bincount(welded, minlength=count)[:, None]
tris = welded[np.array([t.vertices[:] for t in me.loop_triangles])]
neighbours = [set() for _ in range(count)]
for a, b, c in tris:
    neighbours[a].update((b, c))
    neighbours[b].update((a, c))
    neighbours[c].update((a, b))
neighbours = [np.array(sorted(s)) for s in neighbours]


def inside(b):
    x0, x1, z0, z1, y_max = b
    return (at[:, 0] >= x0) & (at[:, 0] <= x1) & (at[:, 2] >= z0) & (at[:, 2] <= z1) & (at[:, 1] <= y_max)


region = inside(box)
moving = np.where(region)[0]
assert len(moving), "no vertex is inside --box"
before = at.copy()
for _ in range(iters):
    for factor in (0.5,) if mu == 0 else (0.5, mu):
        relaxed = at.copy()
        for i in moving:
            relaxed[i] = at[i] + factor * (at[neighbours[i]].mean(axis=0) - at[i])
        at = relaxed
moved = np.linalg.norm(at - before, axis=1)
print("RELAXED %d of %d vertices, moved %.1f mm at most, %.1f mm on average" % (len(moving), count, moved.max() * 1000, moved[moving].mean() * 1000))
for i, v in enumerate(me.vertices):
    v.co = back @ Vector(at[welded[i]])
me.update()

# The surface is smooth-shaded with Meshy's own normals, which still describe the old groove: the moved vertices and their
# neighbours get the normal of the new surface (area-weighted over the welded mesh).
corner = np.empty(len(me.loops) * 3)
me.corner_normals.foreach_get("vector", corner)
corner = corner.reshape(-1, 3)
face = np.cross(at[tris[:, 1]] - at[tris[:, 0]], at[tris[:, 2]] - at[tris[:, 0]])
normal = np.zeros_like(at)
for k in range(3):
    np.add.at(normal, tris[:, k], face)
normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-12)
touched = np.zeros(count, dtype=bool)
touched[moving] = True
for i in moving:
    touched[neighbours[i]] = True
corner_vertex = welded[np.array([loop.vertex_index for loop in me.loops])]
renewed = touched[corner_vertex]
winding = np.sign(np.sum(normal[corner_vertex[~renewed]] * corner[~renewed], axis=1).mean())  # agree with the normals left alone
corner[renewed] = winding * normal[corner_vertex[renewed]]
me.normals_split_custom_set(corner.tolist())
print("NORMALS renewed at %d of %d corners" % (renewed.sum(), len(corner)))

if paint or mark:
    uv = me.uv_layers.active.data
    image = next(i for i in bpy.data.images if i.size[0] > 0)
    w, h = image.size
    pixels = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(h, w, 4)  # rows run from the bottom, like v
    polys = [([welded[v] for v in p.vertices], [tuple(uv[li].uv) for li in p.loop_indices]) for p in me.polygons]

    def covered(selection, grow=0):
        """The texels inside the UV triangles of a selection of polygons (a little outside them, by `grow` texels)."""
        mask = np.zeros((h, w), dtype=bool)
        for _, corners in selection:
            a, b, c = [np.array([u * w - 0.5, v * h - 0.5]) for u, v in corners[:3]]
            lo = np.maximum(np.floor(np.minimum(np.minimum(a, b), c)).astype(int) - grow, 0)
            hi = np.minimum(np.ceil(np.maximum(np.maximum(a, b), c)).astype(int) + grow, [w - 1, h - 1])
            xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-9:
                continue
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
            slack = 1.5 / max(np.linalg.norm(b - a), 1.0)  # a little outside, for the bleed round each island
            hit = (l1 >= -slack) & (l2 >= -slack) & (1 - l1 - l2 >= -slack)
            mask[ys[hit], xs[hit]] = True
        return mask

    in_paint = inside(paint_box)
    x0, x1, z0, z1, y_max = box
    below_and_beside = inside((x0 - 0.06, x1 + 0.06, z0 - 0.09, z0, y_max + 0.02)) | inside((x1, x1 + 0.08, z0, z1, y_max + 0.02)) | inside((x0 - 0.08, x0, z0, z1, y_max + 0.02))
    patch = [p for p in polys if in_paint[p[0]].any()]
    ring = [p for p in polys if below_and_beside[p[0]].all() and not in_paint[p[0]].any()]
    other = [p for p in polys if not in_paint[p[0]].any()]
    mask = covered(patch, grow=2)
    for _, corners in patch:  # a triangle too small for any texel centre still owns the texels at its corners
        for u, v in corners[:3]:
            mask[max(int(v * h) - 3, 0) : int(v * h) + 4, max(int(u * w) - 3, 0) : int(u * w) + 4] = True
    for _ in range(4):  # the padding round each island, which a filtered edge samples
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        mask = grown
    mask &= ~covered(other)  # never over the texels of another triangle (the goggles' frame, say)
    skin_texels = pixels[..., :3][covered(ring) & ~mask]
    skin = np.median(skin_texels[skin_texels.sum(axis=1) > 0.6], axis=0)
    print("PAINT %d texels of %d with the skin colour %s (from %d texels round the patch)" % (mask.sum(), w * h, skin.round(3), len(skin_texels)))
    pixels[mask, :3] = (1.0, 0.0, 1.0) if mark else skin
    image.pixels.foreach_set(pixels.reshape(-1))
    image.update()
    image.pack()
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=False, export_image_format="JPEG", export_jpeg_quality=92)
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
