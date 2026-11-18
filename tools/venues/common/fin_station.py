"""The fin station every pool that hands out fins puts by its pool's lower-left corner (18 November 2026, the creator: "the fins
should always be on top of the station, like we have it on some other levels… we always can see the fins from a top-down view…
they're always in the same place"): the Community Pool's own fins rack, the low timber-topped table with a pair of fins lying in
each of its three bays (godot/assets/venue/props/fins_rack.glb, made by godot/tools/blender/props_stations.py, read only), made
into a small model the game draws cheaply, as the venues' exporter makes their props (common/export_three.py):

    blender -b -P tools/venues/common/fin_station.py            (writes dist/assets/models/fin-station.glb)

- Simplified (Decimate: the table and what lies on it to a third, the fins to a half), the crest decals left out.
- One mesh per material class (matte, satin, gloss, metal), its colour in the vertex colours (a picture's average for the
  timber), the ambient occlusion baked into their alpha with a floor under the table; the game gives each class the venue's own
  material (scene/fin-station.mjs), so the station takes each venue's light.
- The three pairs of fins their own nodes (Fins_1..3: the game hides each as it is taken), their own satin.
- As the Godot prop: its pivot on the floor at the middle of its footprint, 2.06 m along x, its front (the pegs, the bay numbers)
  toward +z; the game turns it to face the pool.
Packed with gltfpack (positions as floats, like every dressed venue).
"""

import os, sys, re, subprocess
import numpy as np
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(REPO, "godot", "assets", "venue", "props", "fins_rack.glb")
WORK = os.environ.get("VENUE_WORK", "/tmp/fin-station-work")
OUT = os.path.join(REPO, "dist", "assets", "models", "fin-station.glb")
RACK_KEEP, FINS_KEEP = 0.34, 0.5  # (what Decimate leaves of the triangles)
os.makedirs(WORK, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)


def principled(m):
    return m and m.node_tree and m.node_tree.nodes.get("Principled BSDF")


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def colour(m):
    """A material's colour (linear) and class, as the venues' exporter decides them."""
    p = principled(m)
    if p is None:
        return [0.7, 0.7, 0.7], "satin"
    bc = p.inputs["Base Color"]
    col = list(bc.default_value[:3])
    img = bc.links[0].from_node.image if bc.is_linked and getattr(bc.links[0].from_node, "image", None) else None
    if img is not None:
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        rgb = px.reshape(-1, 4)[:, :3].mean(axis=0)
        col = list(srgb_to_linear(rgb) if img.colorspace_settings.name == "sRGB" else rgb)
    rough, metal = p.inputs["Roughness"].default_value, p.inputs["Metallic"].default_value
    cls = "metal" if metal > 0.5 else "gloss" if rough < 0.3 else "satin" if rough < 0.62 else "matte"
    return col, cls


def decimate(o, keep):
    mod = o.modifiers.new("Simplify", "DECIMATE")
    mod.ratio = keep
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# ---- gather: the table and the three pairs, in world space -------------------------------------------------------------------
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    w = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = w
    o.data = o.data.copy()
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)
fins = sorted([o for o in meshes if re.match(r"^Fins_\d$", o.name)], key=lambda o: o.name)
rack = [o for o in meshes if o not in fins]
assert len(fins) == 3 and len(rack) == 1, (len(fins), len(rack))
rack = rack[0]
print("SOURCE", tris(rack), "+", [tris(f) for f in fins], "triangles")

# the crest decals (a cut-out picture) are left out: the faces that wear the crest's material
crest = [i for i, m in enumerate(rack.data.materials) if m and "crest" in m.name]
if crest:
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(rack.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in crest], context="FACES")
    bm.to_mesh(rack.data)
    bm.free()

decimate(rack, RACK_KEEP)
for f in fins:
    decimate(f, FINS_KEEP)


# ---- colours and classes: the table split into one object per class; each pair one satin --------------------------------------
def paint(o, classes=True):
    """Write each face's material colour into the corners' colour (Col, alpha 1 until the occlusion is baked) and return the
    faces' classes."""
    me = o.data
    plan = [colour(m) for m in me.materials]
    col = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    data = np.ones((len(me.loops), 4), dtype=np.float32)
    face_cls = []
    for p in me.polygons:
        c, cls = plan[p.material_index] if plan else ([0.7, 0.7, 0.7], "satin")
        for li in p.loop_indices:
            data[li, :3] = c
        face_cls.append(cls)
    col.data.foreach_set("color", data.ravel())
    me.color_attributes.active_color = col
    return face_cls


def class_material(cls):
    name = "H_" + cls
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return m


parts = []
face_cls = paint(rack)
for cls in sorted(set(face_cls)):
    o = rack.copy()
    o.data = rack.data.copy()
    o.name = "Station_" + cls
    bpy.context.scene.collection.objects.link(o)
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if face_cls[f.index] != cls], context="FACES")
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.clear()
    o.data.materials.append(class_material(cls))
    parts.append(o)
bpy.data.objects.remove(rack)
for f in fins:
    paint(f)
    f.data.materials.clear()
    f.data.materials.append(class_material("satin"))

# ---- ambient occlusion in the vertices' alpha, a floor under the table --------------------------------------------------------
s = bpy.context.scene
s.render.engine = "CYCLES"
s.cycles.device = "CPU"
s.cycles.samples = int(os.environ.get("VENUE_AO_SAMPLES", "64"))
s.cycles.use_denoising = False
s.world = s.world or bpy.data.worlds.new("W")
s.world.light_settings.distance = 0.6
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
floor = bpy.context.active_object
targets = parts + fins
for o in targets:
    a = o.data.color_attributes.new("AOv", "FLOAT_COLOR", "CORNER")
    o.data.color_attributes.active_color = a
bpy.ops.object.select_all(action="DESELECT")
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
bpy.data.objects.remove(floor)

# ---- its contact shadow on a floor, as the venues' exporter bakes their deck's (a plane 6.5 cm up, occlusion within 1 m): stamped
# into each dressed venue's floor_ao.webp where the station stands (tools/venues/common/fin_shadow.py) ------------------------------
SHADOW = os.path.join(HERE, "fin-station-floor-ao.png")
SW, SH, SPAN_X, SPAN_Y = 200, 150, 4.0, 3.0  # (pixels; metres along the model's x, its length, and its y)
s.world.light_settings.distance = 1.0
me = bpy.data.meshes.new("FloorAO")
corners = [(-SPAN_X / 2, -SPAN_Y / 2), (SPAN_X / 2, -SPAN_Y / 2), (SPAN_X / 2, SPAN_Y / 2), (-SPAN_X / 2, SPAN_Y / 2)]
me.from_pydata([(x, y, 0.065) for x, y in corners], [], [(0, 1, 2, 3)])
uvl = me.uv_layers.new(name="UVMap")
for li, loop in enumerate(me.loops):
    x, y = corners[loop.vertex_index]
    uvl.data[li].uv = (x / SPAN_X + 0.5, y / SPAN_Y + 0.5)
plane = bpy.data.objects.new("FloorAO", me)
s.collection.objects.link(plane)
img = bpy.data.images.new("fin_floor_ao", SW, SH, alpha=False)
img.colorspace_settings.name = "Non-Color"
fm = bpy.data.materials.new("FloorAOMat")
fm.use_nodes = True
nd = fm.node_tree.nodes.new("ShaderNodeTexImage")
nd.image = img
fm.node_tree.nodes.active = nd
me.materials.append(fm)
bpy.ops.object.select_all(action="DESELECT")
plane.select_set(True)
bpy.context.view_layer.objects.active = plane
bpy.ops.object.bake(type="AO", target="IMAGE_TEXTURES", margin=4)
img.filepath_raw = SHADOW
img.file_format = "PNG"
img.save()
bpy.data.objects.remove(plane)
print("SHADOW", SHADOW, SW, SH, SPAN_X, SPAN_Y)

# ---- export ---------------------------------------------------------------------------------------------------------------------
for o in targets:
    while len(o.data.uv_layers):
        o.data.uv_layers.remove(o.data.uv_layers[0])
bpy.ops.object.select_all(action="DESELECT")
for o in targets:
    o.select_set(True)
raw = os.path.join(WORK, "fin-station.raw.glb")
bpy.ops.export_scene.gltf(
    filepath=raw,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_texcoords=False,
    export_normals=True,
    export_materials="EXPORT",
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_extras=False,
    export_cameras=False,
    export_lights=False,
    export_image_format="NONE",
)
print("EXPORTED", raw, sum(tris(o) for o in targets), "triangles", [(o.name, tris(o)) for o in targets])
os.makedirs(os.path.dirname(OUT), exist_ok=True)
subprocess.run(["npx", "--yes", "gltfpack@1.3.0", "-i", raw, "-o", OUT, "-kn", "-km", "-kv", "-vpf"], check=True)
print("PACKED", OUT, os.path.getsize(OUT) // 1024, "KB")
