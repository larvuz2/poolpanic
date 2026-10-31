"""What every dressed venue's Blender scripts share (tools/venues/<venue>/, for the three.js game; README "Splash Park dressed for
real"). The Harbourside's venue kit (godot/tools/blender/lib.py, props_kit.py: boxes by extents, tubes, text, towels, pots, the
game <-> Blender axes) is reused as it is, read only; this adds the materials the exporter reads, saving a part, quick previews.

A venue's kit.py does `from kitbase import *`, then `configure(...)` with its name, palette and tile sets, and takes its paths from
what that returns. Conventions:
- Metres, game axes: x across the lanes (+x the top of the game's view), y up, z along the lanes (-z the back). `g(x, y, z)` turns
  a game position into Blender's (x, -z, y). Pieces are modelled in place in game coordinates, or at the origin and placed by the
  venue's placements.json (asset, pos, rot, scale).
- Material names tell the exporter (common/export_three.py) what a surface becomes:
    T_<set>[@rrggbb]  a tile set (the venue's TILES): world-box UVs at its scale, its picture and normal map in the game, tinted
    CUT_<name>        a cut-out picture (fronds, flowers): the cut-out atlas, alpha-tested, two-sided
    SG_<name>         a printed or painted picture: the sign atlas
    emission          a lamp's glass (`lamp`: pale by day, lit after dusk)
- Object names: Light_<kind> (a lamp: glows, pools of light after dusk), NightGlow_* (lit only after dusk, added), Glass_*,
  Door_A/Door_B and Fins_1..3 (kept as the game's own nodes), LifeRing and Flashlight (left out; their places recorded).
"""

import os, sys, math, json

COMMON = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(COMMON, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "godot", "tools", "blender"))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import *  # noqa: F401,F403  (g, srgb, mat, box, cyl, sphere, torus, tube, text, plane, extrude_shape, join, ...)
from props_kit import (  # noqa: F401
    PI,
    FACE,
    bx,
    gbx,
    xf,
    grp,
    at_origin,
    set_origin,
    decal,
    flat_text,
    framed,
    towel_folded,
    towel_rolled,
    towel_hanging,
    flip_flop,
    goggles,
    bottle,
    duffel,
    tote,
    frond,
    pictogram_3d,
    tris,
)


class V:
    """The venue being made (configure)."""

    name = None
    palette = {}
    tiles = {}
    work = parts = tex = signs = previews = out = None


def configure(name, palette, tiles, work=None):
    """Set the venue: `name` (its files: dist/assets/<out>/<name>.glb), its palette {name: (hex, roughness, metalness)}, its tile
    sets {set: metres a repeat}. Returns its paths: work, parts, tex, signs, previews, out."""
    V.name, V.palette, V.tiles = name, palette, tiles
    V.work = work or os.environ.get("VENUE_WORK") or f"/tmp/{name}-work"
    V.parts = os.path.join(V.work, "parts")  # one GLB per script
    V.tex = os.path.join(V.work, "textures")  # tile sets and cut-outs (PNG)
    V.signs = os.path.join(V.work, "signs")  # printed and painted surfaces (PNG, drawn with Pillow)
    V.previews = os.environ.get("PP_PREVIEWS", os.path.join(V.work, "previews"))
    for d in (V.parts, V.tex, V.signs, V.previews):
        os.makedirs(d, exist_ok=True)
    return V.work, V.parts, V.tex, V.signs, V.previews


def sm(name, hex_=None, rough=None, metal=None, **kw):
    """A material from the park's palette (or the Harbourside's, or a new colour)."""
    if hex_ is None and name in V.palette:
        hex_, r0, m0 = V.palette[name]
        rough = r0 if rough is None else rough
        metal = m0 if metal is None else metal
    return mat(name, hex_, rough, metal, **kw)


def tmat_tile(set_, preview_hex="#cccccc", rough=0.6, tint=None):
    """A surface that becomes the tile set `set_` in the game (its colour here is only for Blender previews). With `tint`
    ("#rrggbb") the game multiplies the picture by that colour (one neutral picture, many colours: the rubber tiles)."""
    assert set_ in V.tiles, set_
    if tint:
        return mat("T_" + set_ + "@" + tint.lstrip("#"), tint, rough, 0.0)
    return mat("T_" + set_, preview_hex, rough, 0.0)


def cutmat(name, rough=0.7):
    """A cut-out picture from TEX (palm fronds, flowers): its alpha is the shape; packed into the game's cut-out atlas."""
    return mat("CUT_" + name, "#ffffff", rough, 0.0, image=os.path.join(V.tex, name + "_alpha.png"))


def signmat(name, rough=0.6):
    """A printed or painted surface from SIGNS: packed into the game's sign atlas."""
    return mat("SG_" + name, "#ffffff", rough, 0.0, image=os.path.join(V.signs, name + ".png"))


def lamp_mat(name="lamp_glass", hex_="#fff1d6", strength=4.0):
    """Glass that glows (a bulb, a lantern's pane): by day a pale glass, by night its glow (the game: `glow` class)."""
    return mat(name, hex_, 0.2, 0.0, emit=hex_, emit_strength=strength)


def gbox(name, center, size, m, bev=0.0, seg=2):
    """A box in game coordinates: `center` (x, y, z), `size` (along x, y, z)."""
    return box(name, (size[0], size[2], size[1]), g(*center), m, bev, seg)


def save_part(name, objs):
    """Write the objects (trees) to PARTS/<name>.glb, unmerged (the exporter merges everything by material class anyway)."""
    path = os.path.join(V.parts, name + ".glb")
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
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
    n = 0
    for o in objs:
        for c in [o, *o.children_recursive]:
            if c.type == "MESH":
                n += sum(len(p.vertices) - 2 for p in c.data.polygons)
    print(f"PART {name}: {n} triangles, {os.path.getsize(path) / 1024:.0f} KB")
    return n


def look(name, target, dist=8.0, elev=30, azim=-35, size=(960, 640), samples=20, lens=35, sun=(50, 0, 35)):
    """A quick daylight Cycles render (sun and sky) of the scene, to see a piece before it goes to the game."""
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = size
    s.render.film_transparent = False
    s.view_settings.view_transform = "AgX" if "AgX" in [v.identifier for v in s.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    if s.world is None:
        s.world = bpy.data.worlds.new("World")
    s.world.use_nodes = True
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*srgb("#bfe3f2"), 1)
    bg.inputs["Strength"].default_value = 0.8
    cam_data = bpy.data.cameras.new("LookCam")
    cam_data.lens = lens
    cam_data.clip_end = 400
    cam = bpy.data.objects.new("LookCam", cam_data)
    s.collection.objects.link(cam)
    t = Vector(target)
    e, a = math.radians(elev), math.radians(azim)
    cam.location = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    s.camera = cam
    sd = bpy.data.lights.new("LookSun", "SUN")
    sd.energy = 4.0
    sd.angle = math.radians(3)
    sd.color = srgb("#fff0d8")
    so = bpy.data.objects.new("LookSun", sd)
    s.collection.objects.link(so)
    so.rotation_euler = tuple(math.radians(v) for v in sun)
    path = os.path.join(V.previews, name + ".png")
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(so)
    print("LOOK", path)
    return path


def args():
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
