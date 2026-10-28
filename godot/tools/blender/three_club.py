"""The Harbourside Community Swim Club for the three.js game (28 October 2026): the building and every placed prop made for the
Godot test (club_shell.glb, godot/data/placements/*.json), turned into a few merged meshes the game draws cheaply.

    blender -b -P godot/tools/blender/three_club.py -- [out_dir]          (default: dist/assets/club)
    then: godot/tools/three-club-pack.sh                                    (compresses the GLB for the game)

What it does, so the venue costs a few draw calls and a small download:
- Leaves out what the three.js game draws and moves itself: the mop and bucket (every pool's mop station), the fish net, the
  skimmer rack and the fuse box (incident fixtures with live parts), the life rings and the lifeguard's flashlight (carried).
- Simplifies the dense props (plants, lockers, racks: Decimate) and keeps the architecture and the signs as they are.
- Merges everything into one mesh per material class, its colour in the vertex colours: matte, satin, gloss, metal, glow (unlit),
  leaf (two-sided) and glass, each also without shadows ("_n": the floor's paint, flat things on walls). The Godot tile materials
  (GD_*) keep one material per texture set with world-scaled UVs (a tile is the size it is in Godot); the signs, posters and labels
  share one texture atlas (and one more for the cut-out ones: banners, icons).
- Keeps as their own nodes what the game moves: the changing rooms' doors (Door_Men, Door_Women), the clocks' hands (Hand_*), the
  three pairs of fins on the rack (Fins_1..3); the near wall (NearWall, only for the Coach Cam) and the shadow casters (ShadowOnly:
  the roof with its skylight, seen by the sun, never by the camera).
- Bakes ambient occlusion: into the alpha of the props' vertex colours (they are dense enough), and from above onto the deck
  (`floor_ao.png`): soft contact shadows under benches, round the props' feet and along the walls, which the game applies to
  its ambient light only.

Writes harbourside.raw.glb, harbourside.json (the lights' places, the atlases' list) and the textures to out_dir.
"""

import os, sys, json, glob, math, re, hashlib
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import *

REPO = os.path.abspath(os.path.join(GODOT, ".."))
argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0]) if argv else os.path.join(REPO, "dist", "assets", "club")
WORK = os.environ.get("THREE_CLUB_WORK", os.path.join("/tmp", "three-club"))
AO_SIZE = int(os.environ.get("THREE_CLUB_AO", "1"))  # (0: no baking, for a quick try)
AO_SAMPLES = int(os.environ.get("THREE_CLUB_AO_SAMPLES", "48"))
os.makedirs(OUT, exist_ok=True)
os.makedirs(WORK, exist_ok=True)

SKIP = {"props/mop_bucket.glb", "props/fish_net.glb", "props/skimmer_rack.glb", "props/fuse_box.glb"}
DROP = re.compile(r"^(LifeRing|Flashlight)(\.\d+)?$")  # (the rings and the torch, not the stands and boards they hang on)
# Decimate ratios by asset (what is left of the triangles); assets not named keep theirs when they are small.
DECIMATE = {
    "club_shell": 0.6,
    "plant_palm": 0.3,
    "plant_fern": 0.3,
    "plant_big": 0.35,
    "plant_snake": 0.5,
    "sill_succulents": 0.25,
    "sill_pothos": 0.3,
    "locker_bay_men": 0.35,
    "locker_bay_women": 0.35,
    "bench_dressed": 0.3,
    "bench": 0.35,
    "fins_rack": 0.35,
    "trophy_cabinet": 0.35,
    "noodle_bin": 0.4,
    "rope_reel": 0.35,
    "rope_anchor": 0.4,
    "chlorine_station": 0.55,
    "first_aid_station": 0.55,
    "office_counter": 0.55,
    "towel_cubbies": 0.35,
    "kickboard_rack": 0.55,
    "waste_bin": 0.5,
    "treat_table": 0.5,
    "spectator_chairs": 0.55,
    "lifeguard_chair": 0.6,
    "hose_reel": 0.45,
    "buoy_basket": 0.45,
    "drinking_fountain": 0.6,
    "lost_property": 0.55,
    "cafe_doors": 0.6,
    "vending_machine": 0.7,
    "starting_block_1": 0.6,
    "starting_block_2": 0.6,
    "starting_block_3": 0.6,
    "ladder": 0.6,
    "flag_post": 0.5,
    "laundry_hamper": 0.6,
    "emergency_phone": 0.6,
    "sill_bits": 0.6,
    "filing_cabinet": 0.7,
}
# The Godot tile materials: the texture set each uses and its world scale (metres per repeat), as club_scene.gd's material().
GD = {
    "deck": ("deck_tile", 1.8, "#fff4e4"),
    "pool_tile": ("pool_mosaic", 1.0, "#ffffff"),
    "waterline": ("wall_navy", 0.3, "#ffffff"),
    "deck_band": ("wall_sea", 0.45, "#ffffff"),
    "wall_sea": ("wall_sea", 0.6, "#ffffff"),
    "wall_navy": ("wall_navy", 0.6, "#ffffff"),
    "wall_cream": ("wall_cream", 0.6, "#ffffff"),
    "plaster": ("plaster", 2.0, "#ffffff"),
    "timber": ("timber", 1.0, "#ffffff"),
    "terrazzo": ("terrazzo", 1.0, "#ffffff"),
    "mosaic_navy": ("pool_mosaic", 0.45, "#30507e"),
    "mosaic_cream": ("pool_mosaic", 0.45, "#fff4dc"),
    "mosaic_coral": ("pool_mosaic", 0.45, "#ff8a6c"),
    "mosaic_sea": ("pool_mosaic", 0.45, "#4fb6aa"),
    "mosaic_mustard": ("pool_mosaic", 0.45, "#ffc456"),
    "foliage": (None, 0, "#4f8f4a"),
    "foliage_shrub": (None, 0, "#3f7a45"),
}

reset()


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    return new, roots


# ---- gather: the building and every placed prop, each mesh tagged with its asset ------------------------------------------
items = []  # (object, asset name)
new, _ = import_glb(os.path.join(VENUE, "club_shell.glb"))
items += [(o, "club_shell") for o in new]
for f in sorted(glob.glob(os.path.join(GODOT, "data", "placements", "*.json"))):
    for p in json.load(open(f)):
        if p["asset"] in SKIP:
            continue
        path = os.path.join(GODOT, "assets", "venue", p["asset"])
        new, roots = import_glb(path)
        e = bpy.data.objects.new("Placed_" + os.path.basename(path), None)
        bpy.context.scene.collection.objects.link(e)
        for r in roots:
            r.parent = e
        x, y, z = p["pos"]
        e.location = g(x, y, z)
        e.rotation_euler = (0, 0, math.radians(p.get("rot", 0)))
        e.scale = [p.get("scale", 1.0)] * 3
        name = os.path.splitext(os.path.basename(p["asset"]))[0]
        items += [(o, name) for o in new]
bpy.context.view_layer.update()

lights = []  # where the lamps are (Godot coordinates), for the game's glows
anchors = {"LifeRing": [], "Flashlight": []}  # where the props left out held the game's own rings and torch
special = []  # (object, node name): kept as nodes the game moves
static = []  # (object, asset)
counts = {}


def godot(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


for o, asset in items:
    if o.type != "MESH":
        continue
    n = o.name
    if DROP.match(n):
        c = sum((o.matrix_world @ Vector(b) for b in o.bound_box), Vector()) / 8
        anchors[n.startswith("LifeRing") and "LifeRing" or "Flashlight"].append(
            [round(c.x, 3), round(c.z, 3), round(-c.y, 3)]
        )
        bpy.data.objects.remove(o)
        continue
    world = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = world
    o.data = o.data.copy()
    if n.startswith(("Light_", "UnderwaterLight_")):
        c = sum((world @ Vector(b) for b in o.bound_box), Vector()) / 8
        kind = re.sub(r"[\.\d]+$", "", n.split("_", 1)[1]) if n.startswith("Light_") else "Underwater"
        lights.append({"kind": kind, "at": godot(c)})
    if asset.startswith("locker_bay_") and n.startswith("Door"):
        special.append((o, "Door_Men" if "men" == asset.split("_")[-1] else "Door_Women"))
        continue
    if re.match(r"Hand(Minute|Second)", n):
        counts[n] = counts.get(n, 0) + 1
        special.append((o, re.sub(r"\.\d+$", "", n) + ("_%d" % counts[n])))
        continue
    if re.match(r"Fins_\d", n):
        special.append((o, n[:6]))
        continue
    if n.startswith("Keep_NearWall"):
        special.append((o, "NearWall"))
        continue
    if n.startswith("ShadowOnly_"):
        special.append((o, "ShadowOnly"))
        continue
    static.append((o, asset))
print("GATHERED", len(static), "static meshes,", len(special), "special,", len(lights), "lights")


# ---- simplify the dense props ---------------------------------------------------------------------------------------------
def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


before_tris = sum(tris(o) for o, _ in static)
dg = bpy.context.evaluated_depsgraph_get()
for o, asset in static:
    ratio = DECIMATE.get(asset)
    if not ratio or tris(o) < 300 or o.name.startswith(("Glass_", "Light_")):
        continue
    mod = o.modifiers.new("Decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = False
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    old = o.data
    o.data = mesh
    bpy.data.meshes.remove(old)
    # smooth shading by angle, so the simplified bevels still read as rounded
    o.data.shade_smooth()
    o.data.set_sharp_from_angle(angle=math.radians(34))
print("DECIMATED", before_tris, "->", sum(tris(o) for o, _ in static), "triangles")
_per = {}
for o, asset in static:
    _per[asset] = _per.get(asset, 0) + tris(o)
print("BY ASSET", sorted(_per.items(), key=lambda kv: -kv[1])[:20])


# ---- materials: what each one becomes -------------------------------------------------------------------------------------
def principled(m):
    if not m or not m.use_nodes:
        return None
    for nd in m.node_tree.nodes:
        if nd.type == "BSDF_PRINCIPLED":
            return nd
    return None


def image_of(m):
    if not m or not m.use_nodes:
        return None
    for nd in m.node_tree.nodes:
        if nd.type == "TEX_IMAGE" and nd.image:
            return nd.image
    return None


def lin(c):
    return [float(c[0]), float(c[1]), float(c[2])]


def flat_class(m):
    """(class, linear colour) of a material without an image."""
    p = principled(m)
    if p is None:
        return "satin", [0.7, 0.7, 0.7]
    col = lin(p.inputs["Base Color"].default_value)
    rough = p.inputs["Roughness"].default_value
    metal = p.inputs["Metallic"].default_value
    alpha = p.inputs["Alpha"].default_value
    es = p.inputs["Emission Strength"].default_value if "Emission Strength" in p.inputs else 0
    ec = lin(p.inputs["Emission Color"].default_value) if "Emission Color" in p.inputs else [0, 0, 0]
    name = m.name.lower()
    if es > 0.01 and max(ec) > 0.01:
        return "glow", [min(1.0, c * max(1.0, es * 0.6)) for c in ec]
    if alpha < 0.95:
        return "glass", col
    if metal > 0.5:
        return "metal", col
    if re.match(r"(leaf|frond|succulent|fern|pothos|palm|snake|monstera|foliage)", name):
        return "leaf", col
    if rough < 0.3:
        return "gloss", col
    if rough < 0.62:
        return "satin", col
    return "matte", col


def image_average(img):
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    c = px[:, :3].mean(axis=0)
    return [float(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c]  # (sRGB pixels to linear)


def image_key(img):
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return hashlib.md5(px[::7].tobytes()).hexdigest() + "%dx%d" % tuple(img.size)


def has_cutout(img):
    if img.channels < 4:
        return False
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return float(px[3::4].min()) < 0.5


# images used by faces whose UVs stay inside the picture go in an atlas; a repeating one becomes its average colour
atlas_images = {}  # key -> {"img", "cut", "uses"}
face_plan = {}  # object name -> list per polygon of ("gd", key) | ("flat", class, col) | ("atlas", key)
for o, asset in static:
    me = o.data
    uv = me.uv_layers.active
    plan = []
    mat_plan = {}
    for i, m in enumerate(me.materials):
        if m is None:
            mat_plan[i] = ("flat", "satin", [0.7, 0.7, 0.7])
            continue
        base = re.sub(r"\.\d+$", "", m.name)
        if base.startswith("GD_"):
            mat_plan[i] = ("gd", base[3:])
            continue
        img = image_of(m)
        if img is None:
            cls, col = flat_class(m)
            if o.name.startswith("Glass_"):
                cls = "glass"
            mat_plan[i] = ("flat", cls, col)
            continue
        # UV range of the faces using it
        inside = True
        if uv is not None:
            for p in me.polygons:
                if p.material_index != i:
                    continue
                for li in p.loop_indices:
                    u, v = uv.data[li].uv
                    if u < -0.02 or u > 1.02 or v < -0.02 or v > 1.02:
                        inside = False
                        break
                if not inside:
                    break
        else:
            inside = False
        if inside:
            key = image_key(img)
            if key not in atlas_images:
                atlas_images[key] = {"img": img, "cut": has_cutout(img), "name": re.sub(r"\.\d+$", "", img.name)}
            mat_plan[i] = ("atlas", key)
        else:
            cls, _ = flat_class(m)
            mat_plan[i] = ("flat", cls if cls not in ("glow",) else "satin", image_average(img))
    face_plan[o.name] = [mat_plan.get(p.material_index, ("flat", "satin", [0.7, 0.7, 0.7])) for p in me.polygons]
print("ATLAS IMAGES", len(atlas_images), [a["name"] for a in atlas_images.values()])


# ---- the atlases ----------------------------------------------------------------------------------------------------------
def scaled_pixels(img, longest):
    w, h = img.size
    k = min(1.0, longest / max(w, h))
    nw, nh = max(4, int(round(w * k))), max(4, int(round(h * k)))
    c = img.copy()
    if (nw, nh) != (w, h):
        c.scale(nw, nh)
    px = np.empty(nw * nh * 4, dtype=np.float32)
    c.pixels.foreach_get(px)
    bpy.data.images.remove(c)
    return px.reshape(nh, nw, 4)


def pack(entries, size, pad=4):
    """Shelf-pack (key, h, w) into a size×size square; returns key -> (x, y) of the top-left corner (y from the top)."""
    entries = sorted(entries, key=lambda e: -e[1])
    x = y = shelf = 0
    out = {}
    for key, h, w in entries:
        if x + w + pad * 2 > size:
            x, y, shelf = 0, y + shelf, 0
        if y + h + pad * 2 > size:
            return None
        out[key] = (x + pad, y + pad)
        x += w + pad * 2
        shelf = max(shelf, h + pad * 2)
    return out


atlas_uv = {}  # image key -> (atlas name, u0, v0, du, dv)
atlases = {}
for cut in (False, True):
    group = {k: a for k, a in atlas_images.items() if a["cut"] == cut}
    if not group:
        continue
    name = "atlas_cut" if cut else "atlas_signs"
    size = 2048 if not cut else 1024
    for longest in (512, 448, 384, 320, 256, 192, 160, 128):
        pics = {k: scaled_pixels(a["img"], longest if not a["name"].startswith("banner") else min(longest, 400)) for k, a in group.items()}
        spots = pack([(k, p.shape[0], p.shape[1]) for k, p in pics.items()], size)
        if spots:
            break
    canvas = np.zeros((size, size, 4), dtype=np.float32)
    canvas[..., 3] = 0.0 if cut else 1.0
    for k, (x, ytop) in spots.items():
        p = pics[k]  # rows bottom-up (Blender's pixels)
        h, w = p.shape[:2]
        # place with its rows flipped to top-down for the canvas, then edge-extend 4 px against bleeding
        img = p[::-1]
        canvas[ytop : ytop + h, x : x + w] = img
        for d in range(1, 5):
            canvas[ytop - d, x : x + w] = img[0]
            canvas[ytop + h - 1 + d, x : x + w] = img[-1]
            canvas[ytop - 4 : ytop + h + 4, x - d] = canvas[ytop - 4 : ytop + h + 4, x]
            canvas[ytop - 4 : ytop + h + 4, x + w - 1 + d] = canvas[ytop - 4 : ytop + h + 4, x + w - 1]
        # the UV rectangle (v from the bottom)
        atlas_uv[k] = (name, x / size, (size - ytop - h) / size, w / size, h / size)
    out_img = bpy.data.images.new(name, size, size, alpha=True)
    out_img.pixels.foreach_set(canvas[::-1].reshape(-1))
    out_img.filepath_raw = os.path.join(WORK, name + ".png")
    out_img.file_format = "PNG"
    out_img.save()
    atlases[name] = {"size": size, "images": len(spots), "longest": longest}
    print("ATLAS", name, size, len(spots), "images at", longest, "px")


# ---- per face: material class, vertex colour, UVs -------------------------------------------------------------------------
CLASS_MATS = {}


def class_mat(name):
    if name not in CLASS_MATS:
        m = bpy.data.materials.new("H_" + name)
        m.use_nodes = True
        CLASS_MATS[name] = m
    return CLASS_MATS[name]


def flat_obj(o):
    dims = sorted(o.dimensions)
    return dims[0] < 0.045


NOCAST_ASSETS = {"floor_markings"}
for o, asset in static:
    me = o.data
    plan = face_plan[o.name]
    nocast = asset in NOCAST_ASSETS or flat_obj(o) or o.name.startswith(("Light_", "UnderwaterLight_", "Glass_"))
    if me.uv_layers.active is None:
        me.uv_layers.new(name="UVMap")
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    uv = me.uv_layers.active  # (after adding the colours: a new layer moves the old ones in memory)
    names = []
    index_of = {}
    poly_class = []
    mw = o.matrix_world
    for p, step in zip(me.polygons, plan):
        if step[0] == "gd":
            tex, scale, tint = GD.get(step[1], (None, 0, "#888888"))
            cname = ("tile_" + tex) if tex else "leaf"
            c = list(srgb(tint)) if tex else list(srgb(tint))
        elif step[0] == "atlas":
            cname = atlas_uv[step[1]][0].replace("atlas_", "")
            c = [1.0, 1.0, 1.0]
        else:
            cname, c = step[1], step[2]
        if nocast and not cname.startswith("tile_") and cname not in ("glass", "signs", "cut", "glow"):
            cname += "_n"
        if cname not in index_of:
            index_of[cname] = len(names)
            names.append(cname)
        poly_class.append((cname, c, step))
    me.materials.clear()
    for nme in names:
        me.materials.append(class_mat(nme))
    nrm = mw.to_3x3().inverted().transposed()
    for p, (cname, c, step) in zip(me.polygons, poly_class):
        p.material_index = index_of[cname]
        for li in p.loop_indices:
            col.data[li].color = (c[0], c[1], c[2], 1.0)
        if step[0] == "gd":
            tex, scale, _ = GD.get(step[1], (None, 1, ""))
            if not tex:
                continue
            n = (nrm @ p.normal).normalized()
            gn = (abs(n.x), abs(n.z), abs(n.y))  # Godot x, y (up), z
            for li in p.loop_indices:
                v = mw @ me.vertices[me.loops[li].vertex_index].co
                gx, gy, gz = v.x, v.z, -v.y
                if gn[1] >= gn[0] and gn[1] >= gn[2]:
                    uvv = (gx, gz)
                elif gn[0] >= gn[2]:
                    uvv = (gz, gy)
                else:
                    uvv = (gx, gy)
                uv.data[li].uv = (uvv[0] / scale, uvv[1] / scale)
        elif step[0] == "atlas":
            _, u0, v0, du, dv = atlas_uv[step[1]]
            for li in p.loop_indices:
                u, v = uv.data[li].uv
                u = min(1.0, max(0.0, u))
                v = min(1.0, max(0.0, v))
                uv.data[li].uv = (u0 + u * du, v0 + v * dv)
    me.color_attributes.active_color = col
    # only the first UV map goes on
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    # world space: the transform goes into the vertices
    me.transform(mw)
    o.matrix_world = Matrix.Identity(4)

# ---- the floor's paint: everything on the deck (not the depth marks on the coping) baked into one picture -----------------
PAINT = {"size": 2048, "x0": -15.2, "z0": -16.8, "span": 30.4}


def bake_floor_paint():
    floor = [o for o, a in static if a == "floor_markings"]
    if not floor:
        return []
    pieces = []
    for o in floor:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        low = [f for f in bm.faces if max(v.co.z for v in f.verts) < 0.03]
        high = [f for f in bm.faces if f not in set(low)]
        # the paint on the deck goes to its own mesh; what stands higher (the coping's depth marks) stays
        paint = o.copy()
        paint.data = o.data.copy()
        bpy.context.scene.collection.objects.link(paint)
        bm2 = bmesh.new()
        bm2.from_mesh(paint.data)
        bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if max(v.co.z for v in f.verts) >= 0.03], context="FACES")
        bm2.to_mesh(paint.data)
        bm2.free()
        bmesh.ops.delete(bm, geom=low, context="FACES")
        bm.to_mesh(o.data)
        bm.free()
        pieces.append(paint)
    s = bpy.context.scene
    hidden = {}
    for ob in s.objects:
        hidden[ob] = ob.hide_render
        ob.hide_render = ob not in pieces
    # an unlit material: the vertex colour, times the tile picture where the face was tiled
    mosaic = bpy.data.images.load(os.path.join(TEXTURES, "pool_mosaic_albedo.png"))
    bake_mats = {}
    for o in pieces:
        for i, m in enumerate(o.data.materials):
            key = m.name
            if key not in bake_mats:
                bm_ = bpy.data.materials.new("Bake_" + key)
                bm_.use_nodes = True
                nt = bm_.node_tree
                nt.nodes.clear()
                out = nt.nodes.new("ShaderNodeOutputMaterial")
                em = nt.nodes.new("ShaderNodeEmission")
                attr = nt.nodes.new("ShaderNodeAttribute")
                attr.attribute_name = "Col"
                if "pool_mosaic" in key:
                    tex = nt.nodes.new("ShaderNodeTexImage")
                    tex.image = mosaic
                    mul = nt.nodes.new("ShaderNodeMix")
                    mul.data_type = "RGBA"
                    mul.blend_type = "MULTIPLY"
                    mul.inputs["Factor"].default_value = 1.0
                    nt.links.new(attr.outputs["Color"], mul.inputs[6])
                    nt.links.new(tex.outputs["Color"], mul.inputs[7])
                    nt.links.new(mul.outputs[2], em.inputs["Color"])
                else:
                    nt.links.new(attr.outputs["Color"], em.inputs["Color"])
                nt.links.new(em.outputs[0], out.inputs[0])
                bake_mats[key] = bm_
            o.data.materials[i] = bake_mats[key]
    cam = bpy.data.objects.new("PaintCam", bpy.data.cameras.new("PaintCam"))
    s.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = PAINT["span"]
    cx, cz = PAINT["x0"] + PAINT["span"] / 2, PAINT["z0"] + PAINT["span"] / 2
    cam.location = g(cx, 30, cz)
    cam.rotation_euler = (0, 0, 0)
    cam.data.clip_end = 100
    s.camera = cam
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 16
    s.cycles.max_bounces = 0
    s.cycles.use_denoising = False
    s.render.film_transparent = True
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    s.render.resolution_x = s.render.resolution_y = PAINT["size"]
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    s.render.filepath = os.path.join(WORK, "floor_paint.png")
    bpy.ops.render.render(write_still=True)
    for ob, h in hidden.items():
        ob.hide_render = h
    for o in pieces:
        bpy.data.objects.remove(o)
    bpy.data.objects.remove(cam)
    print("FLOOR PAINT baked", PAINT)
    return [o for o in floor if len(o.data.polygons) == 0]


for o in bake_floor_paint():
    static[:] = [(a, b) for a, b in static if a != o]
    bpy.data.objects.remove(o)

# ---- merge: one mesh per material class -----------------------------------------------------------------------------------
objs = [o for o, _ in static]
for ob in bpy.context.scene.objects:
    ob.select_set(False)
for ob in objs:
    ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
merged = bpy.context.active_object
merged.name = "Static"
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="MATERIAL")
bpy.ops.object.mode_set(mode="OBJECT")
statics = [o for o in bpy.context.scene.objects if o.type == "MESH" and (o.name == "Static" or o.name.startswith("Static."))]
for o in statics:
    m = o.data.materials[o.data.polygons[0].material_index]
    cls = m.name[2:]
    o.name = "S_" + cls
    o.data.name = "S_" + cls
    # one material per mesh
    o.data.materials.clear()
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.material_index = 0

# ---- the kept nodes: their own materials (class by their first material), transforms kept ---------------------------------
_tile_avg = {}


def tile_avg(tex):
    """The average colour of a tile set's albedo (linear), for things drawn without the texture."""
    if tex not in _tile_avg:
        img = bpy.data.images.load(os.path.join(TEXTURES, tex + "_albedo.png"))
        _tile_avg[tex] = image_average(img)
        bpy.data.images.remove(img)
    return _tile_avg[tex]


for o, node in special:
    o.name = node
    me = o.data
    me.name = node
    if node == "ShadowOnly":
        me.materials.clear()
        me.materials.append(class_mat("shadow"))
        continue
    cls, c = ("matte", [0.8, 0.8, 0.8])
    if len(me.materials) and me.materials[0]:
        m0 = me.materials[0]
        base = re.sub(r"\.\d+$", "", m0.name)
        if base.startswith("GD_"):
            tex, scale, tint = GD.get(base[3:], (None, 1, "#ffffff"))
            cls, c = ("tile_" + tex) if tex else "leaf", list(srgb(tint))
        else:
            cls, c = flat_class(m0)
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    cols = []
    for p in me.polygons:
        m = me.materials[p.material_index] if p.material_index < len(me.materials) else None
        if m is not None and re.sub(r"\.\d+$", "", m.name).startswith("GD_"):
            tex, _, tint = GD.get(re.sub(r"\.\d+$", "", m.name)[3:], (None, 1, "#ffffff"))
            t = list(srgb(tint))
            cc = [a * b for a, b in zip(tile_avg(tex), t)] if tex else t
        else:
            _, cc = flat_class(m) if m else ("", c)
        for li in p.loop_indices:
            col.data[li].color = (cc[0], cc[1], cc[2], 1.0)
    me.color_attributes.active_color = col
    # (a kept node is drawn in its colours: the near wall's tiles as their average, seen only by the Coach Cam)
    me.materials.clear()
    me.materials.append(class_mat("nearwall" if node == "NearWall" else "matte" if cls.startswith("tile_") else cls))

print("STATIC MESHES", sorted((o.name, tris(o)) for o in statics))
print("TOTAL TRIANGLES", sum(tris(o) for o in statics), "+ special", sum(tris(o) for o, _ in special))


# ---- ambient occlusion: in the props' vertices, and under everything on the floor --------------------------------------------
def ao_setup():
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = AO_SAMPLES
    s.cycles.use_denoising = False
    s.world = s.world or bpy.data.worlds.new("W")
    s.world.light_settings.distance = 1.2  # (contact shadows only: the roof 9 m up must not darken the floor)


def bake_vertex_ao(targets):
    """AO per vertex corner into the alpha of the colours (the game uses it on the ambient light only)."""
    ao_setup()
    for o in targets:
        a = o.data.color_attributes.get("AOv") or o.data.color_attributes.new("AOv", "FLOAT_COLOR", "CORNER")
        o.data.color_attributes.active_color = a
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for o in targets:
        o.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    for o in targets:
        me = o.data
        a = me.color_attributes["AOv"]
        c = me.color_attributes["Col"]
        ao = np.empty(len(a.data) * 4, dtype=np.float32)
        a.data.foreach_get("color", ao)
        col = np.empty(len(c.data) * 4, dtype=np.float32)
        c.data.foreach_get("color", col)
        col[3::4] = np.clip(ao[0::4] * 1.05, 0.0, 1.0)  # (a touch lighter: the bake's open sky reads 0.95)
        c.data.foreach_set("color", col)
        me.color_attributes.remove(a)
        me.color_attributes.active_color = me.color_attributes["Col"]


def bake_floor_ao():
    """AO on the deck, from above: a plane at the deck's height, baked against everything standing on it."""
    ao_setup()
    P = PAINT
    me = bpy.data.meshes.new("FloorAO")
    x0, z0, sp = P["x0"], P["z0"], P["span"]
    corners = [(x0, z0), (x0 + sp, z0), (x0 + sp, z0 + sp), (x0, z0 + sp)]
    me.from_pydata([tuple(g(x, 0.004, z)) for x, z in corners], [], [(0, 3, 2, 1)])
    uvl = me.uv_layers.new(name="UVMap")
    for li, loop in enumerate(me.loops):
        x, z = corners[loop.vertex_index]
        uvl.data[li].uv = ((x - x0) / sp, 1 - (z - z0) / sp)
    # a grid of quads, so the bake has room to work (one quad bakes fine too, this only helps the ray origin)
    plane = bpy.data.objects.new("FloorAO", me)
    bpy.context.scene.collection.objects.link(plane)
    img = bpy.data.images.new("floor_ao", 1024, 1024, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    m = bpy.data.materials.new("FloorAOMat")
    m.use_nodes = True
    nd = m.node_tree.nodes.new("ShaderNodeTexImage")
    nd.image = img
    m.node_tree.nodes.active = nd
    me.materials.append(m)
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    plane.select_set(True)
    bpy.context.view_layer.objects.active = plane
    bpy.ops.object.bake(type="AO", target="IMAGE_TEXTURES", margin=4)
    img.filepath_raw = os.path.join(WORK, "floor_ao.png")
    img.file_format = "PNG"
    img.save()
    bpy.data.objects.remove(plane)


if AO_SIZE > 0:
    props_ao = [o for o in statics if not o.name.startswith(("S_glass", "S_glow", "S_cut", "S_signs", "S_tile_"))]
    bake_vertex_ao(props_ao)
    print("AO BAKED into the vertices of", [o.name for o in props_ao])
    bake_floor_ao()
    print("AO BAKED on the floor")

# ---- the mural, with the four picture lights' warm wash painted in (the game draws no spotlights) ----------------------------
MURAL = {"width": 15.2, "height": 4.75, "at": [0, 4.78, -16.685], "lamps": [-5.7, -1.9, 1.9, 5.7]}


def mural_with_wash():
    img = bpy.data.images.load(os.path.join(TEXTURES, "mural.png"))
    w0, h0 = img.size
    img.scale(2048, int(round(2048 * h0 / w0)))
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    ys = (np.arange(h) / (h - 1))[:, None]  # 0 at the bottom, 1 at the top
    xs = np.arange(w)[None, :] / (w - 1) * MURAL["width"] - MURAL["width"] / 2
    wash = np.zeros((h, w), dtype=np.float32)
    for lx in MURAL["lamps"]:
        # a soft cone from the hood above the top edge: bright near the top, fading down the wall and to the sides
        spread = 1.1 + (1 - ys) * 1.6
        wash += np.exp(-(((xs - lx) / spread) ** 2)) * (0.25 + 0.75 * ys**1.6)
    wash = np.clip(wash, 0, 1.4)
    tint = np.array([1.0, 0.86, 0.66], dtype=np.float32)
    lit = px[..., :3] * (0.82 + 0.38 * wash[..., None] * tint)
    px[..., :3] = np.clip(lit, 0, 1)
    img.pixels.foreach_set(px.reshape(-1))
    img.filepath_raw = os.path.join(WORK, "mural.png")
    img.file_format = "PNG"
    img.save()
    print("MURAL", w, h)


mural_with_wash()

# ---- export ---------------------------------------------------------------------------------------------------------------
# (only the textured meshes need UVs: the flat ones lose them, which also lets more of their vertices be shared)
for o in statics + [o for o, _ in special]:
    cls = o.data.materials[0].name[2:] if len(o.data.materials) else ""
    if not (cls.startswith("tile_") or cls in ("signs", "cut")):
        while len(o.data.uv_layers):
            o.data.uv_layers.remove(o.data.uv_layers[0])
for ob in bpy.context.scene.objects:
    ob.select_set(False)
keep = statics + [o for o, _ in special]
for o in keep:
    o.select_set(True)
raw = os.path.join(WORK, "harbourside.raw.glb")
bpy.ops.export_scene.gltf(
    filepath=raw,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_extras=False,
    export_cameras=False,
    export_lights=False,
    export_image_format="NONE",
)
total = sum(tris(o) for o in keep)
json.dump(
    {
        "made": "godot/tools/blender/three_club.py",
        "triangles": total,
        "lights": lights,
        "atlases": atlases,
        "ao": AO_SIZE,
        "paint": PAINT,
        "anchors": anchors,
        "mural": MURAL,
        "meshes": sorted(o.name for o in keep),
    },
    open(os.path.join(WORK, "harbourside.json"), "w"),
    indent=1,
)
print("EXPORTED", raw, total, "triangles", os.path.getsize(raw) // 1024, "KB")
