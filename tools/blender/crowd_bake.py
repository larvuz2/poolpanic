"""Bake the Aquatic Centre's crowd (31 October 2026): Meshy spectators rigged on Coach Waters' skeleton, each with the two still poses
of character_clips.py --character crowd (CrowdSit, CrowdCheer), frozen into very low meshes that the game draws instanced
(dist/scene/crowd-models.mjs). Every spectator's texture goes into one atlas, and a mask beside it marks the white t-shirt, so the game
tints the shirt per person (one body, many fans).

    tools/blender/run.sh tools/blender/crowd_bake.py -- OUT_DIR dad.clips.glb dad.joints.json [more pairs...] [--tris 700] [--slot 512]

Writes OUT_DIR/crowd.glb (one mesh per spectator and pose, `<name>_sit` / `<name>_cheer`, positions, normals and atlas UVs, no
material), OUT_DIR/crowd.png (the atlas) and crowd_mask.png (white where the shirt is; pack both to WebP) and OUT_DIR/crowd.json (each spectator's slot, its triangles,
and where its right hand is in each pose, for what the game puts in it). The shirt: texels that are near white and grey-free, on
faces between the hips and the neck in the rest pose (eyes, socks and shoes are white too, but outside that band)."""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
import common  # noqa: E402

args = common.script_args()
TRIS = common.option(args, "--tris", 700, int)
SLOT = common.option(args, "--slot", 512, int)
rest = [a for a in args if not a.startswith("--")]
skip = set()
for i, a in enumerate(args):
    if a in ("--tris", "--slot"):
        skip.add(args[i + 1])
rest = [a for a in rest if a not in skip]
out_dir, pairs = rest[0], rest[1:]
os.makedirs(out_dir, exist_ok=True)
people = [(pairs[i], pairs[i + 1]) for i in range(0, len(pairs), 2)]
COLS = 4
ROWS = math.ceil(len(people) / COLS)
atlas = np.zeros((ROWS * SLOT, COLS * SLOT, 4), dtype=np.float32)
POSES = {"sit": "CrowdSit", "cheer": "CrowdCheer"}
baked, manifest = [], {"slot": SLOT, "cols": COLS, "rows": ROWS, "people": []}


def evaluated_copy(obj, name):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(obj.matrix_world)
    me.name = name
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def image_pixels(img, size):
    c = img.copy()
    c.scale(size, size)
    px = np.empty(size * size * 4, dtype=np.float32)
    c.pixels.foreach_get(px)
    bpy.data.images.remove(c)
    return px.reshape(size, size, 4)  # (row 0 at the bottom, as Blender keeps them)


common.clean_scene()
for k, (glb, joints_path) in enumerate(people):
    name = os.path.basename(glb).split(".")[0]
    joints = json.load(open(joints_path))["joints"]
    hips_y, neck_y = joints["Hips"][1], joints["neck"][1]
    for o in list(bpy.data.objects):  # (everything but the poses already baked)
        if o not in baked:
            bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):  # (each body's clips are its own: the hips move by its own height)
        bpy.data.actions.remove(a)
    bpy.ops.import_scene.gltf(filepath=glb)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects if o.type == "MESH")
    img = next(n.image for m in body.data.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
    tex = image_pixels(img, SLOT)
    # the shirt's mask, painted in UV space from the rest pose's faces between the hips and the neck
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    r = evaluated_copy(body, "rest")
    uv = r.data.uv_layers.active.data
    band = np.zeros((SLOT, SLOT), dtype=bool)
    for poly in r.data.polygons:
        zs = [r.data.vertices[v].co.z for v in poly.vertices]  # (Blender z is up)
        if not (hips_y - 0.16 <= sum(zs) / len(zs) <= neck_y + 0.04):
            continue
        pts = np.array([uv[li].uv[:] for li in poly.loop_indices]) * (SLOT - 1)
        x0, y0 = np.floor(pts.min(0)).astype(int)
        x1, y1 = np.ceil(pts.max(0)).astype(int)
        if x1 < x0 or y1 < y0:
            continue
        ys, xs = np.mgrid[y0 : y1 + 1, x0 : x1 + 1]
        inside = np.zeros(xs.shape, dtype=bool)
        for t in range(1, len(pts) - 1):  # a fan of triangles
            a, b, c = pts[0], pts[t], pts[t + 1]
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-9:
                continue
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
            inside |= (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
        yy, xx = np.clip(ys[inside], 0, SLOT - 1), np.clip(xs[inside], 0, SLOT - 1)
        band[yy, xx] = True
    rgb = tex[..., :3]
    white = (rgb.min(-1) > 0.55) & ((rgb.max(-1) - rgb.min(-1)) < 0.1)
    mask = (band & white).astype(np.float32)
    print("MASK", name, "band %.2f white %.2f shirt %.2f" % (band.mean(), white.mean(), mask.mean()), "hips %.2f neck %.2f" % (hips_y, neck_y),
          "rest z %.2f..%.2f" % (min(v.co.z for v in r.data.vertices), max(v.co.z for v in r.data.vertices)))
    # a little growth and softening, so the shirt's tint reaches its folds' darker texels and its edges do not shimmer
    grown = mask.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grown = np.maximum(grown, np.roll(np.roll(mask, dy, 0), dx, 1) * band)
    mask = grown
    bpy.data.objects.remove(r)
    col, row = k % COLS, k // COLS
    flip = ROWS - 1 - row  # (Blender's rows run bottom-up; the slots' rows, like the UVs', top-down)
    atlas[flip * SLOT : (flip + 1) * SLOT, col * SLOT : (col + 1) * SLOT, :3] = rgb
    atlas[flip * SLOT : (flip + 1) * SLOT, col * SLOT : (col + 1) * SLOT, 3] = mask
    # the two poses, frozen and cut down
    arm.data.pose_position = "POSE"
    arm.animation_data_create()
    for track in list(arm.animation_data.nla_tracks):  # (the importer lays every clip on a track: only the one asked for plays)
        arm.animation_data.nla_tracks.remove(track)
    hands, tris = {}, {}
    for pose, action in POSES.items():
        arm.animation_data.action = bpy.data.actions[action]
        bpy.context.scene.frame_set(0)
        bpy.context.view_layer.update()
        o = evaluated_copy(body, f"{name}_{pose}")
        uv0 = np.array([d.uv[:] for d in o.data.uv_layers.active.data])
        print("UV", name, pose, [l.name for l in o.data.uv_layers], o.data.uv_layers.active.name, uv0.min(0), uv0.max(0))
        # weld Meshy's split vertices (the UVs live on the corners and stay), so the cut keeps a closed surface
        import bmesh

        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
        bm.to_mesh(o.data)
        bm.free()
        n_tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        dec = o.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = min(1.0, TRIS / n_tris)
        dec.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=dec.name)
        uvl = o.data.uv_layers.active.data
        for d in uvl:
            u, v = d.uv
            d.uv = ((col + u) / COLS, 1 - (row + 1 - v) / ROWS)
        keep = o.data.uv_layers.active.name
        for name_ in [n for n in o.data.uv_layers.keys() if n != keep]:
            o.data.uv_layers.remove(o.data.uv_layers[name_])
        o.data.materials.clear()
        tris[pose] = sum(len(p.vertices) - 2 for p in o.data.polygons)
        hand = arm.matrix_world @ arm.pose.bones["RightHand"].head
        hands[pose] = [round(hand.x, 3), round(hand.z, 3), round(-hand.y, 3)]  # (game axes: x, y up, z forward)
        baked.append(o)
    manifest["people"].append({"name": name, "slot": [col, row], "tris": tris, "handR": hands})
    print("BAKED", name, tris)

# the atlas and the shirts' mask, two pictures (a browser drops the colour under a transparent texel, so the mask is not the alpha)
for name, pixels in (("crowd", np.dstack([atlas[..., :3], np.ones(atlas.shape[:2], np.float32)])),
                     ("crowd_mask", np.dstack([atlas[..., 3]] * 3 + [np.ones(atlas.shape[:2], np.float32)]))):
    img = bpy.data.images.new(name, COLS * SLOT, ROWS * SLOT, alpha=False)
    img.pixels.foreach_set(pixels.reshape(-1))
    img.filepath_raw = os.path.join(out_dir, name + ".png")
    img.file_format = "PNG"
    img.save()
bpy.ops.object.select_all(action="DESELECT")
for o in baked:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(out_dir, "crowd.glb"),
    export_format="GLB",
    use_selection=True,
    export_materials="NONE",
    export_texcoords=True,
    export_normals=True,
    export_animations=False,
    export_skins=False,
)
json.dump(manifest, open(os.path.join(out_dir, "crowd.json"), "w"), indent=1)
print("EXPORTED", out_dir, sum(sum(p["tris"].values()) for p in manifest["people"]), "triangles in all")
