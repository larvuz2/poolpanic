"""Splash Park for the three.js game: every part (WORK/parts/*.glb) and every placed prop (placements.json) turned into a few
merged meshes the game draws cheaply, as the Harbourside's exporter does (godot/tools/blender/three_club.py), with what an
open-air venue lit at any hour needs.

    blender -b -P tools/venues/splash/export_three.py
    then: tools/venues/splash/pack.sh          (compresses the GLB and the pictures into dist/assets/splash/)

- Merges everything into one mesh per material class, its colour in the vertex colours: matte, satin, gloss, metal, leaf
  (two-sided), glass, each also without shadows ("_n": flat things); `lamp` (lantern glass and bulbs: pale glass by day, lit
  after dusk by the game), `nightglow` (lit windows and halos: drawn only after dusk, added onto the picture). A T_<set> material
  becomes `tile_<set>` with world-box UVs at the set's scale (kit.TILES); the signs share one atlas, the cut-outs (palm fronds,
  flowers: alpha-tested, two-sided, casting dappled shadows) another.
- Keeps as their own nodes what the game moves: the cabanas' doors (Door_A, Door_B), the fins on the rack (Fins_1..3).
- Leaves out what the game draws itself and records where it was: the life rings (anchors.LifeRing), the torch (anchors.Flashlight).
- Bakes the paint on the deck (floor.glb: lane numbers, the splash zone's board, NO RUNNING) into one top-down picture, and the
  ambient occlusion: into the alpha of the props' vertex colours, and from above onto the deck (`floor_ao.png`; contact shadows
  only, which the game applies to its ambient light: the sun's shadows are the game's own, at every hour).

Writes splash.raw.glb, splash.json and the pictures to WORK/out.
"""

import os, sys, json, glob, math, re, hashlib
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *  # noqa: F401,F403

OUTW = os.path.join(WORK, "out")
os.makedirs(OUTW, exist_ok=True)
AO = int(os.environ.get("SPLASH_AO", "1"))
AO_SAMPLES = int(os.environ.get("SPLASH_AO_SAMPLES", "48"))
DECIMATE = json.loads(os.environ.get("SPLASH_DECIMATE", "{}"))  # (asset -> ratio, for a dense prop)
DROP = re.compile(r"^(LifeRing|Flashlight)(\.\d+)?$")
# the longest side a sign or cut-out keeps in its atlas (others: as large as the atlas allows, up to 512)
ATLAS_SIZE = {"splash_park": 1024, "palm_frond": 1000, "snacks_menu": 512, "pool_rules": 384}

reset()


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    return new, roots


# ---- gather -------------------------------------------------------------------------------------------------------------------
items = []  # (object, asset)
placed = json.load(open(PLACEMENTS)) if os.path.exists(PLACEMENTS) else []
placed_assets = {p["asset"] for p in placed}
for path in sorted(glob.glob(os.path.join(PARTS, "*.glb"))):
    name = os.path.splitext(os.path.basename(path))[0]
    if name in placed_assets:
        continue  # (an asset made at the origin: only its placements go in)
    new, _ = import_glb(path)
    items += [(o, name) for o in new]
for p in placed:
    path = os.path.join(PARTS, p["asset"] + ".glb")
    new, roots = import_glb(path)
    e = bpy.data.objects.new("Placed_" + p["asset"], None)
    bpy.context.scene.collection.objects.link(e)
    for r in roots:
        r.parent = e
    x, y, z = p["pos"]
    e.location = g(x, y, z)
    e.rotation_euler = (0, 0, math.radians(p.get("rot", 0)))
    e.scale = [p.get("scale", 1.0)] * 3
    items += [(o, p["asset"]) for o in new]
bpy.context.view_layer.update()

lights, anchors, special, static, floor = [], {"LifeRing": [], "Flashlight": []}, [], [], []


def game(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


for o, asset in items:
    if o.type != "MESH":
        continue
    n = o.name
    world = o.matrix_world.copy()
    centre = sum((world @ Vector(b) for b in o.bound_box), Vector()) / 8
    if DROP.match(n):
        anchors["LifeRing" if n.startswith("LifeRing") else "Flashlight"].append(game(centre))
        bpy.data.objects.remove(o)
        continue
    o.parent = None
    o.matrix_world = world
    o.data = o.data.copy()
    if n.startswith(("Light_", "UnderwaterLight")):
        kind = re.sub(r"[\.\d]+$", "", n.split("_", 1)[1]) if n.startswith("Light_") else "Underwater"
        lights.append({"kind": kind, "at": game(centre)})
    if asset == "floor":
        floor.append(o)
        continue
    m = re.match(r"^(Door_[AB]|Fins_\d)", n)
    if m:
        special.append((o, m.group(1)))
        continue
    static.append((o, asset))
print("GATHERED", len(static), "static,", len(special), "kept,", len(floor), "floor,", len(lights), "lights")


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


for o, asset in static:
    ratio = DECIMATE.get(asset)
    if not ratio or tris(o) < 300:
        continue
    mod = o.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = ratio
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = mesh


# ---- the deck's paint: a top-down picture of floor.glb ------------------------------------------------------------------------------
PAINT = {"size": 2048, "x0": -16.6, "z0": -17.2, "span": 34.4}


def principled(m):
    if not m or not m.use_nodes:
        return None
    return next((nd for nd in m.node_tree.nodes if nd.type == "BSDF_PRINCIPLED"), None)


def image_of(m):
    if not m or not m.use_nodes:
        return None
    return next((nd.image for nd in m.node_tree.nodes if nd.type == "TEX_IMAGE" and nd.image), None)


def bake_floor_paint():
    s = bpy.context.scene
    hidden = {ob: ob.hide_render for ob in s.objects}
    for ob in s.objects:
        ob.hide_render = ob not in floor
    for o in floor:
        for i, m in enumerate(o.data.materials):
            bm_ = bpy.data.materials.new("Paint_" + m.name)
            bm_.use_nodes = True
            nt = bm_.node_tree
            nt.nodes.clear()
            out = nt.nodes.new("ShaderNodeOutputMaterial")
            em = nt.nodes.new("ShaderNodeEmission")
            img = image_of(m)
            if img:
                tex = nt.nodes.new("ShaderNodeTexImage")
                tex.image = img
                nt.links.new(tex.outputs["Color"], em.inputs["Color"])
            else:
                p = principled(m)
                em.inputs["Color"].default_value = p.inputs["Base Color"].default_value if p else (1, 1, 1, 1)
            nt.links.new(em.outputs[0], out.inputs[0])
            o.data.materials[i] = bm_
    cam = bpy.data.objects.new("PaintCam", bpy.data.cameras.new("PaintCam"))
    s.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = PAINT["span"]
    cam.location = g(PAINT["x0"] + PAINT["span"] / 2, 30, PAINT["z0"] + PAINT["span"] / 2)
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
    s.render.filepath = os.path.join(OUTW, "floor_paint.png")
    bpy.ops.render.render(write_still=True)
    for ob, h in hidden.items():
        ob.hide_render = h
    for o in floor:
        bpy.data.objects.remove(o)
    bpy.data.objects.remove(cam)
    print("FLOOR PAINT", PAINT)


bake_floor_paint()


# ---- materials: what each becomes ---------------------------------------------------------------------------------------------------
def lin(c):
    return [float(c[0]), float(c[1]), float(c[2])]


def flat_class(m, obj_name=""):
    p = principled(m)
    if p is None:
        return "satin", [0.7, 0.7, 0.7]
    col = lin(p.inputs["Base Color"].default_value)
    rough = p.inputs["Roughness"].default_value
    metal = p.inputs["Metallic"].default_value
    alpha = p.inputs["Alpha"].default_value
    es = p.inputs["Emission Strength"].default_value
    ec = lin(p.inputs["Emission Color"].default_value)
    name = m.name.lower()
    if obj_name.startswith("NightGlow_"):
        return "nightglow", col
    if es > 0.01 and max(ec) > 0.01:
        return "lamp", ec
    if alpha < 0.95:
        return "glass", col
    if metal > 0.5:
        return "metal", col
    if re.match(r"(leaf|frond|foliage|geranium|grass|fern)", name):
        return "leaf", col
    if rough < 0.3:
        return "gloss", col
    if rough < 0.62:
        return "satin", col
    return "matte", col


def image_key(img):
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return hashlib.md5(px[::7].tobytes()).hexdigest() + "%dx%d" % tuple(img.size)


atlas_images, face_plan = {}, {}
for o, asset in static:
    me = o.data
    mat_plan = {}
    for i, m in enumerate(me.materials):
        if m is None:
            mat_plan[i] = ("flat", "satin", [0.7, 0.7, 0.7])
            continue
        base = re.sub(r"\.\d+$", "", m.name)
        if base.startswith("T_"):
            mat_plan[i] = ("tile", base[2:])
            continue
        img = image_of(m)
        if img is not None and base.startswith(("CUT_", "SG_")):
            key = image_key(img)
            if key not in atlas_images:
                atlas_images[key] = {"img": img, "cut": base.startswith("CUT_"), "name": base.split("_", 1)[1]}
            mat_plan[i] = ("atlas", key)
            continue
        cls, col = flat_class(m, o.name)
        if o.name.startswith("Glass_"):
            cls = "glass"
        if o.name.startswith(("Light_",)) and cls not in ("lamp",):
            cls = "lamp"
        mat_plan[i] = ("flat", cls, col)
    face_plan[o.name] = [mat_plan.get(p.material_index, ("flat", "satin", [0.7, 0.7, 0.7])) for p in me.polygons]
print("ATLAS IMAGES", [a["name"] for a in atlas_images.values()])


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


atlas_uv, atlases = {}, {}
for cut in (False, True):
    group = {k: a for k, a in atlas_images.items() if a["cut"] == cut}
    if not group:
        continue
    name = "atlas_cut" if cut else "atlas_signs"
    size = 2048 if not cut else 1024
    for scale in (1.0, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3):
        pics = {k: scaled_pixels(a["img"], int(ATLAS_SIZE.get(a["name"], 512) * scale)) for k, a in group.items()}
        spots = pack([(k, p.shape[0], p.shape[1]) for k, p in pics.items()], size)
        if spots:
            break
    canvas = np.zeros((size, size, 4), dtype=np.float32)
    canvas[..., 3] = 0.0 if cut else 1.0
    for k, (x, ytop) in spots.items():
        p = pics[k]
        h, w = p.shape[:2]
        img = p[::-1]
        canvas[ytop : ytop + h, x : x + w] = img
        for d in range(1, 5):
            canvas[ytop - d, x : x + w] = img[0]
            canvas[ytop + h - 1 + d, x : x + w] = img[-1]
            canvas[ytop - 4 : ytop + h + 4, x - d] = canvas[ytop - 4 : ytop + h + 4, x]
            canvas[ytop - 4 : ytop + h + 4, x + w - 1 + d] = canvas[ytop - 4 : ytop + h + 4, x + w - 1]
        atlas_uv[k] = (name, x / size, (size - ytop - h) / size, w / size, h / size)
    out_img = bpy.data.images.new(name, size, size, alpha=True)
    out_img.pixels.foreach_set(canvas[::-1].reshape(-1))
    out_img.filepath_raw = os.path.join(OUTW, name + ".png")
    out_img.file_format = "PNG"
    out_img.save()
    atlases[name] = {"size": size, "images": len(spots), "scale": scale}
    print("ATLAS", name, size, len(spots), "at", scale)

# ---- per face: class, colour, UVs ------------------------------------------------------------------------------------------------------
CLASS_MATS = {}


def class_mat(name):
    if name not in CLASS_MATS:
        m = bpy.data.materials.new("H_" + name)
        m.use_nodes = True
        CLASS_MATS[name] = m
    return CLASS_MATS[name]


def flat_obj(o):
    return sorted(o.dimensions)[0] < 0.03


for o, asset in static:
    me = o.data
    plan = face_plan[o.name]
    nocast = flat_obj(o) or o.name.startswith(("Light_", "UnderwaterLight", "Glass_", "NightGlow_"))
    if me.uv_layers.active is None:
        me.uv_layers.new(name="UVMap")
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    uv = me.uv_layers.active
    names, index_of, poly_class = [], {}, []
    mw = o.matrix_world
    for p, step in zip(me.polygons, plan):
        if step[0] == "tile":
            cname, c = "tile_" + step[1], [1.0, 1.0, 1.0]
        elif step[0] == "atlas":
            cname, c = atlas_uv[step[1]][0].replace("atlas_", ""), [1.0, 1.0, 1.0]
        else:
            cname, c = step[1], step[2]
        if nocast and cname in ("matte", "satin", "gloss", "metal", "leaf"):
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
        if step[0] == "tile":
            scale = TILES[step[1]]
            n = (nrm @ p.normal).normalized()
            gn = (abs(n.x), abs(n.z), abs(n.y))
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
                uv.data[li].uv = (u0 + min(1.0, max(0.0, u)) * du, v0 + min(1.0, max(0.0, v)) * dv)
    me.color_attributes.active_color = col
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    me.transform(mw)
    o.matrix_world = Matrix.Identity(4)

# ---- merge: one mesh per class ------------------------------------------------------------------------------------------------------------
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
    o.name = o.data.name = "S_" + cls
    o.data.materials.clear()
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.material_index = 0

# the kept nodes: their colours, one class each (a door: satin; the fins: their own)
for o, node in special:
    o.name = o.data.name = node
    me = o.data
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    cls0 = None
    for p in me.polygons:
        m = me.materials[p.material_index] if p.material_index < len(me.materials) else None
        cls, c = flat_class(m) if m else ("satin", [0.7, 0.7, 0.7])
        cls0 = cls0 or cls
        for li in p.loop_indices:
            col.data[li].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.active_color = col
    me.materials.clear()
    me.materials.append(class_mat("satin" if cls0 in (None, "glass", "lamp", "nightglow") else cls0))

print("STATIC MESHES", sorted((o.name, tris(o)) for o in statics))


# ---- ambient occlusion ------------------------------------------------------------------------------------------------------------------------
def ao_setup():
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = AO_SAMPLES
    s.cycles.use_denoising = False
    s.world = s.world or bpy.data.worlds.new("W")
    s.world.light_settings.distance = 1.0


def no_occluders(objs):
    """Cut-outs (fronds, flowers), glass and glows cast no occlusion (the bake would see their cards as solid)."""
    saved = {}
    for o in objs:
        saved[o] = (o.hide_render,)
        o.hide_render = True
    return saved


def bake_vertex_ao(targets):
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
        a, c = me.color_attributes["AOv"], me.color_attributes["Col"]
        ao = np.empty(len(a.data) * 4, dtype=np.float32)
        a.data.foreach_get("color", ao)
        col = np.empty(len(c.data) * 4, dtype=np.float32)
        c.data.foreach_get("color", col)
        col[3::4] = np.clip(ao[0::4] * 1.05, 0.0, 1.0)
        c.data.foreach_set("color", col)
        me.color_attributes.remove(a)
        me.color_attributes.active_color = me.color_attributes["Col"]


def bake_floor_ao():
    ao_setup()
    P = PAINT
    me = bpy.data.meshes.new("FloorAO")
    x0, z0, sp = P["x0"], P["z0"], P["span"]
    corners = [(x0, z0), (x0 + sp, z0), (x0 + sp, z0 + sp), (x0, z0 + sp)]
    me.from_pydata([tuple(g(x, 0.065, z)) for x, z in corners], [], [(0, 3, 2, 1)])  # (above the coping and the band)
    uvl = me.uv_layers.new(name="UVMap")
    for li, loop in enumerate(me.loops):
        x, z = corners[loop.vertex_index]
        uvl.data[li].uv = ((x - x0) / sp, 1 - (z - z0) / sp)
    plane_ = bpy.data.objects.new("FloorAO", me)
    bpy.context.scene.collection.objects.link(plane_)
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
    plane_.select_set(True)
    bpy.context.view_layer.objects.active = plane_
    bpy.ops.object.bake(type="AO", target="IMAGE_TEXTURES", margin=4)
    img.filepath_raw = os.path.join(OUTW, "floor_ao.png")
    img.file_format = "PNG"
    img.save()
    bpy.data.objects.remove(plane_)


if AO:
    see_through = [o for o in statics if o.name.startswith(("S_cut", "S_glass", "S_glow", "S_lamp", "S_nightglow"))]
    for o in see_through:
        o.hide_render = True
    props_ao = [
        o
        for o in statics
        if not o.name.startswith(("S_glass", "S_lamp", "S_nightglow", "S_cut", "S_signs", "S_tile_"))
        or o.name in ("S_tile_pine", "S_tile_conifer")  # (the trees' canopies: dense enough for occlusion in their vertices)
    ]
    bake_vertex_ao(props_ao)
    print("AO in the vertices of", [o.name for o in props_ao])
    bake_floor_ao()
    print("AO on the floor")
    for o in see_through:
        o.hide_render = False

# ---- export ------------------------------------------------------------------------------------------------------------------------------------
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
raw = os.path.join(OUTW, "splash.raw.glb")
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
        "made": "tools/venues/splash/export_three.py",
        "triangles": total,
        "lights": lights,
        "atlases": atlases,
        "ao": AO,
        "paint": PAINT,
        "anchors": anchors,
        "tiles": {k: v for k, v in TILES.items() if any(o.name == "S_tile_" + k for o in statics)},
        "meshes": sorted(o.name for o in keep),
    },
    open(os.path.join(OUTW, "splash.json"), "w"),
    indent=1,
)
print("EXPORTED", raw, total, "triangles", os.path.getsize(raw) // 1024, "KB")
