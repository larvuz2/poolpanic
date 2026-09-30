"""Shared helpers for the headless Blender scripts (run them with tools/blender/run.sh)."""
import math
import os
import sys

import bpy
from mathutils import Vector


def script_args():
    """Arguments after the `--` that run.sh puts before the script's own."""
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def option(args, name, default=None, cast=str):
    """`--name value` from args (removed from the list), or the default."""
    if name in args:
        i = args.index(name)
        value = cast(args[i + 1])
        del args[i : i + 2]
        return value
    return default


def flag(args, name):
    if name in args:
        args.remove(name)
        return True
    return False


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(path):
    """Import a glTF/GLB, FBX, OBJ or blend file into the (empty) scene."""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == ".blend":
        with bpy.data.libraries.load(path) as (src, dst):
            dst.objects = src.objects
        for obj in dst.objects:
            if obj is not None:
                bpy.context.collection.objects.link(obj)
    else:
        raise SystemExit(f"Cannot import {ext} files")


def meshes():
    """The model's meshes: not the glTF importer's bone-shape helpers (it parks those in `glTF_not_exported`)."""
    return [
        o
        for o in bpy.context.scene.objects
        if o.type == "MESH" and not any(c.name == "glTF_not_exported" for c in o.users_collection)
    ]


def world_bounds(objects):
    """(min, max) corners of the objects' bounding boxes in world space."""
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for obj in objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def set_engine(scene, name="eevee"):
    """EEVEE (its id changed between Blender versions), Workbench or Cycles, all on the CPU here."""
    if name == "workbench":
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "TEXTURE"
    elif name == "cycles":
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 32
    else:
        for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            try:
                scene.render.engine = engine
                break
            except TypeError:
                continue
        eevee = scene.eevee
        if hasattr(eevee, "taa_render_samples"):
            eevee.taa_render_samples = 16


def studio_lights(scene, strength=1.0):
    """A plain grey world, a key sun and a softer fill, so a model reads clearly in a preview."""
    world = bpy.data.worlds.new("preview")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.32, 0.36, 0.40, 1)
    bg.inputs["Strength"].default_value = strength
    scene.world = world
    for name, energy, rot in (("key", 3.0, (0.9, 0.2, 0.6)), ("fill", 1.2, (0.7, -0.3, -2.2))):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        obj = bpy.data.objects.new(name, light)
        obj.rotation_euler = rot
        scene.collection.objects.link(obj)


def add_camera(scene, target, distance, elevation_deg=14, parent=None):
    cam_data = bpy.data.cameras.new("preview")
    cam_data.lens = 50
    cam = bpy.data.objects.new("preview", cam_data)
    scene.collection.objects.link(cam)
    e = math.radians(elevation_deg)
    cam.location = target + Vector((0, -distance * math.cos(e), distance * math.sin(e)))
    track = cam.constraints.new("TRACK_TO")
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    marker = bpy.data.objects.new("look-at", None)
    marker.location = target
    scene.collection.objects.link(marker)
    track.target = marker
    scene.camera = cam
    return cam, marker
