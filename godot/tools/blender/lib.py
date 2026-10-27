"""Shared tools for the Community Pool's Blender assets (run by Blender: `blender -b -P <script>.py`).

Conventions (godot/docs/look.md):
- Metres. Blender is Z-up; glTF/Godot is Y-up. The exporter maps Blender (x, y, z) to Godot (x, z, -y), so an asset whose front
  faces Blender -Y faces Godot +Z, and `g(x, y, z)` turns a Godot position into Blender's for pieces modelled in place.
- Props: the pivot is on the floor at the centre of the footprint, the front faces Blender -Y (Godot +Z).
- Materials come from PALETTE by name; Godot replaces the ones whose name starts with "GD_" by its own (shaders, triplanar tiles).
"""

import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
GODOT = os.path.abspath(os.path.join(HERE, "..", ".."))
VENUE = os.path.join(GODOT, "assets", "venue")
TEXTURES = os.path.join(GODOT, "assets", "textures")
FONTS = os.path.join(HERE, "fonts")
PREVIEWS = os.environ.get("PP_PREVIEWS", os.path.join("/tmp", "pp-previews"))


def g(x, y, z):
    """A Godot position (x, y up, z) as Blender's (x, -z, y)."""
    return Vector((x, -z, y))


def srgb(hex_):
    """'#rrggbb' to linear RGB (Blender's colour inputs are linear)."""
    h = hex_.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# The Harbourside palette (godot/docs/look.md): sun-washed seaside colours.
PALETTE = {
    "navy": ("#1d3557", 0.45, 0.0),
    "navy_gloss": ("#1d3557", 0.18, 0.0),
    "coral": ("#ef6a4c", 0.45, 0.0),
    "coral_gloss": ("#ef6a4c", 0.22, 0.0),
    "mustard": ("#f2b33d", 0.45, 0.0),
    "mustard_gloss": ("#f2b33d", 0.25, 0.0),
    "sea": ("#2f8c88", 0.4, 0.0),
    "sea_gloss": ("#2f8c88", 0.15, 0.0),
    "sky": ("#7cc6e3", 0.4, 0.0),
    "cream": ("#f3e6c9", 0.5, 0.0),
    "cream_gloss": ("#f3e6c9", 0.2, 0.0),
    "white": ("#f4f1ea", 0.4, 0.0),
    "white_gloss": ("#f7f5ef", 0.15, 0.0),
    "plaster": ("#f0d9b0", 0.85, 0.0),
    "peach": ("#f2b48f", 0.7, 0.0),
    "timber": ("#c88b4f", 0.55, 0.0),
    "timber_dark": ("#8a5a33", 0.6, 0.0),
    "timber_light": ("#e0b07a", 0.55, 0.0),
    "steel": ("#c9cfd3", 0.28, 1.0),
    "steel_brushed": ("#b9c0c6", 0.42, 1.0),
    "chrome": ("#e6eaee", 0.08, 1.0),
    "brass": ("#d7a447", 0.3, 1.0),
    "rubber": ("#2a2a2e", 0.85, 0.0),
    "charcoal": ("#3a3b40", 0.6, 0.0),
    "grey": ("#8b9196", 0.6, 0.0),
    "grey_light": ("#c5c8c6", 0.6, 0.0),
    "glass": ("#cfe9ef", 0.05, 0.0),
    "red": ("#d6423a", 0.4, 0.0),
    "green": ("#4f9a5a", 0.6, 0.0),
    "leaf": ("#3f8a4a", 0.55, 0.0),
    "leaf_dark": ("#2c6b3a", 0.6, 0.0),
    "terracotta": ("#c9714a", 0.8, 0.0),
    "foam_blue": ("#3d7fd1", 0.7, 0.0),
    "foam_yellow": ("#f6cf45", 0.7, 0.0),
    "foam_pink": ("#ef7aa6", 0.7, 0.0),
    "foam_green": ("#62c48a", 0.7, 0.0),
    "foam_orange": ("#f3934a", 0.7, 0.0),
    "towel_blue": ("#5aa9d6", 0.95, 0.0),
    "towel_stripe": ("#f2e2c4", 0.95, 0.0),
    "towel_coral": ("#ef8a74", 0.95, 0.0),
    "black": ("#1b1c1f", 0.5, 0.0),
    "paper": ("#f6f1e4", 0.9, 0.0),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    s.unit_settings.scale_length = 1.0


def mat(name, hex_=None, rough=None, metal=None, emit=None, emit_strength=0.0, alpha=1.0, image=None):
    """A material by palette name (or a new one with the given colour). `image`: a texture file for the base colour."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    base = PALETTE.get(name)
    if base and hex_ is None:
        hex_, r0, m0 = base
        rough = r0 if rough is None else rough
        metal = m0 if metal is None else metal
    rough = 0.5 if rough is None else rough
    metal = 0.0 if metal is None else metal
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*srgb(hex_ or "#ffffff"), 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = (*srgb(emit), 1)
        p.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    if image:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image, check_existing=True)
        nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])
        if image.endswith(".png") and "alpha" in os.path.basename(image):
            nt.links.new(tex.outputs["Alpha"], p.inputs["Alpha"])
            m.blend_method = "CLIP"
    return m


def gdmat(name, preview_hex="#888888", rough=0.5, metal=0.0):
    """A material Godot replaces with its own (its name starts GD_): the colour here is only for Blender previews."""
    return mat("GD_" + name, preview_hex, rough, metal)


def _link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def apply_all(obj):
    """Apply the object's transform and modifiers."""
    _activate(obj)
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def smooth(obj, angle=35):
    _activate(obj)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()
    return obj


def bevel(obj, width=0.01, segments=2, angle=40, harden=True):
    if width <= 0:
        return obj
    b = obj.modifiers.new("Bevel", "BEVEL")
    b.width = width
    b.segments = segments
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(angle)
    b.harden_normals = harden
    b.miter_outer = "MITER_ARC"
    apply_all(obj)
    return smooth(obj, 30)


def set_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


def box(name, size, loc=(0, 0, 0), m=None, bev=0.01, seg=2, rot=(0, 0, 0)):
    """A box of `size` (x, y, z) centred at `loc` (Blender coordinates), bevelled."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = _link(bpy.data.objects.new(name, me))
    o.scale = size
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    if m:
        set_mat(o, m)
    if bev:
        bevel(o, min(bev, min(size) * 0.45), seg)
    return o


def cyl(name, r, h, loc=(0, 0, 0), m=None, verts=24, bev=0.0, rot=(0, 0, 0), r2=None):
    """A cylinder (or cone with r2) along local Z, its base at loc's z unless rotated (then centred)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = _link(bpy.data.objects.new(name, me))
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    if m:
        set_mat(o, m)
    if bev:
        bevel(o, bev, 2)
    else:
        smooth(o, 40)
    return o


def sphere(name, r, loc=(0, 0, 0), m=None, seg=24, rings=12, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = _link(bpy.data.objects.new(name, me))
    o.scale = scale
    o.location = loc
    apply_all(o)
    if m:
        set_mat(o, m)
    smooth(o, 60)
    return o


def torus(name, R, r, loc=(0, 0, 0), m=None, seg=40, rseg=14, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=R, minor_radius=r, major_segments=seg, minor_segments=rseg, location=loc, rotation=rot
    )
    o = bpy.context.active_object
    o.name = name
    apply_all(o)
    if m:
        set_mat(o, m)
    smooth(o, 60)
    return o


def tube(name, points, r, m=None, res=4, sides=12, cyclic=False):
    """A round tube through `points` (Blender coordinates), smoothed corners: rails, hoses, ropes."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = max(1, sides // 4)
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    sp.use_cyclic_u = cyclic
    o = _link(bpy.data.objects.new(name, cu))
    _activate(o)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    if m:
        set_mat(o, m)
    smooth(o, 60)
    return o


def poly_tube(name, points, r, m=None, sides=12, corner=0.06):
    """A tube through `points` with rounded corners of radius `corner` (a bent rail)."""
    pts = [Vector(p) for p in points]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        d1, d2 = (a - b).normalized(), (c - b).normalized()
        k = min(corner, (a - b).length * 0.45, (c - b).length * 0.45)
        p0, p2 = b + d1 * k, b + d2 * k
        for t in [j / 6 for j in range(7)]:
            out.append((1 - t) ** 2 * p0 + 2 * (1 - t) * t * b + t * t * p2)
    out.append(pts[-1])
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = max(1, sides // 4)
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(out) - 1)
    for sp_pt, p in zip(sp.points, out):
        sp_pt.co = (*p, 1)
    o = _link(bpy.data.objects.new(name, cu))
    _activate(o)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    if m:
        set_mat(o, m)
    smooth(o, 60)
    return o


def font(name="BarlowCondensed-Bold"):
    path = os.path.join(FONTS, name + ".ttf")
    if os.path.exists(path):
        return bpy.data.fonts.load(path, check_existing=True)
    return None


def text(name, body, size=0.2, depth=0.01, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), m=None, align="CENTER", face=None, bev=0.0):
    """3D text, standing up and facing Blender -Y by default (Godot +Z)."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = depth / 2
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.bevel_depth = bev
    cu.resolution_u = 3
    f = font(face or "BarlowCondensed-Bold")
    if f:
        cu.font = f
    o = _link(bpy.data.objects.new(name, cu))
    o.rotation_euler = rot
    o.location = loc
    _activate(o)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    apply_all(o)
    if m:
        set_mat(o, m)
    return o


def plane(name, w, h, loc=(0, 0, 0), m=None, rot=(math.pi / 2, 0, 0)):
    """A w×h plane with UVs 0..1, standing and facing Blender -Y by default (for signs, posters, the mural)."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x + 0.5, l.vert.co.y + 0.5)
    bmesh.ops.scale(bm, vec=(w, h, 1), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = _link(bpy.data.objects.new(name, me))
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    if m:
        set_mat(o, m)
    return o


def extrude_shape(name, pts2d, depth, loc=(0, 0, 0), m=None, rot=(0, 0, 0), bev=0.0):
    """A flat polygon (x, y points) extruded along Z by `depth` (pennants, signs, cut-outs)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0)) for x, y in pts2d]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, depth), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = _link(bpy.data.objects.new(name, me))
    o.rotation_euler = rot
    o.location = loc
    apply_all(o)
    if m:
        set_mat(o, m)
    if bev:
        bevel(o, bev, 2)
    return o


def join(objs, name):
    objs = [o for o in objs if o]
    _activate(objs[0])
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    return o


def move(obj, offset):
    obj.location = Vector(obj.location) + Vector(offset)
    return obj


def copy(obj, name, loc=None, rot=None, mirror_x=False):
    o = obj.copy()
    o.data = obj.data.copy()
    o.name = name
    _link(o)
    if loc is not None:
        o.location = loc
    if rot is not None:
        o.rotation_euler = rot
    if mirror_x:
        o.scale.x *= -1
        apply_all(o)
        _activate(o)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
    return o


def parent_all(objs, name):
    """An empty named `name` holding `objs`: one node in Godot with its parts named."""
    e = _link(bpy.data.objects.new(name, None))
    for o in objs:
        if o:
            o.parent = e
    return e


# Parts that stay their own node in Godot (it moves, hides or lights them, or they need their own flags); everything else in an
# export is merged into one mesh per object tree, one surface per material, so a prop costs a few draw calls, not dozens.
KEEP = ("Door", "Light_", "Glass_", "Fins_", "Hand", "Flashlight", "LifeRing", "ShadowOnly_", "UnderwaterLight_", "Keep_")


def merge_tree(root):
    """Join every mesh under `root` (and root itself if a mesh) whose name does not start with a KEEP prefix into one mesh."""
    meshes = [o for o in [root, *root.children_recursive] if o.type == "MESH" and not o.name.startswith(KEEP)]
    # parts that only differ by their flags merge among themselves: all the shadow-only pieces, all the glass
    for prefix in ("ShadowOnly_", "Glass_"):
        group = [o for o in root.children_recursive if o.type == "MESH" and o.name.startswith(prefix)]
        if len(group) > 1:
            gw = {o: o.matrix_world.copy() for o in group}
            for o in bpy.context.selected_objects:
                o.select_set(False)
            for o in group:
                o.select_set(True)
            bpy.context.view_layer.objects.active = group[0]
            bpy.ops.object.join()
            bpy.context.active_object.name = prefix + "Merged"
    # keep the kept parts' transforms: unparent them (keeping world transforms) before the join, re-parent after
    kept = [o for o in root.children_recursive if o.name.startswith(KEEP)]
    saved = {o: o.matrix_world.copy() for o in kept}
    for o in kept:
        o.parent = None
        o.matrix_world = saved[o]
    if len(meshes) < 2:
        for o in kept:
            o.parent = root
            o.matrix_world = saved[o]
        return root
    target = meshes[0]
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    merged = bpy.context.active_object
    merged.name = (root.name + "Mesh") if root.type != "MESH" else root.name
    if root.type != "MESH" and merged.parent is not root:
        mw = merged.matrix_world.copy()
        merged.parent = root
        merged.matrix_world = mw
    for o in kept:
        o.parent = root if root.type != "MESH" else merged
        o.matrix_world = saved[o]
    return root


def export(path, objs=None, merge=True):
    """Export the given objects (or everything) as a GLB, Y-up, with materials and images embedded. `merge`: join each tree's
    meshes into one (see KEEP)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if merge:
        roots = objs or [o for o in bpy.context.scene.objects if o.parent is None]
        for r in roots:
            if r.type in ("MESH", "EMPTY"):
                merge_tree(r)
        objs = [o for o in (objs or []) if o.name in bpy.context.scene.objects] or None
    for o in bpy.context.scene.objects:
        o.select_set(False)
    sel = objs or list(bpy.context.scene.objects)
    for o in sel:
        o.select_set(True)
        for c in o.children_recursive:
            c.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=False,
        export_cameras=False,
        export_lights=False,
    )
    tris = 0
    for o in sel:
        for c in [o, *o.children_recursive]:
            if c.type == "MESH":
                tris += sum(len(p.vertices) - 2 for p in c.data.polygons)
    print(f"EXPORTED {os.path.relpath(path, GODOT)} ({tris} triangles, {os.path.getsize(path) / 1024:.0f} KB)")


def preview(name, target=(0, 0, 0.5), dist=4.0, elev=28, azim=-35, size=(900, 700), samples=24, lens=40):
    """A quick Cycles render of the scene from a 3/4 view, to look at the asset before it goes to Godot."""
    os.makedirs(PREVIEWS, exist_ok=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = size
    s.render.film_transparent = False
    if s.world is None:
        s.world = bpy.data.worlds.new("World")
    s.world.use_nodes = True
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*srgb("#cfe0e4"), 1)
    bg.inputs["Strength"].default_value = 0.9
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = lens
    cam = _link(bpy.data.objects.new("PreviewCam", cam_data))
    t = Vector(target)
    e, a = math.radians(elev), math.radians(azim)
    cam.location = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    s.camera = cam
    sun_data = bpy.data.lights.new("PreviewSun", "SUN")
    sun_data.energy = 3.5
    sun_data.angle = math.radians(8)
    sun = _link(bpy.data.objects.new("PreviewSun", sun_data))
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    path = os.path.join(PREVIEWS, name + ".png")
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(sun)
    print("PREVIEW", path)
    return path
