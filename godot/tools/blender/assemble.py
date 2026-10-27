"""Assemble the Community Pool in Blender for a quick look: the building (club_shell.glb) and every prop placed by
godot/data/placements/*.json, rendered with Cycles from the game's camera or from a given view. It is a check for placement and
scale, not the game's look (Godot lights it its own way).

    blender -b -P godot/tools/blender/assemble.py -- out.png [game|top|<x,y,z,tx,ty,tz in Godot coords>] [samples]

A placements file is a list of {"asset": "props/<name>.glb", "pos": [x, y, z], "rot": <degrees about Godot y>, "scale": 1}:
the asset's front (+Z in Godot) turns to face (sin rot, 0, cos rot).
"""

import os, sys, json, math, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lib import *

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
out = argv[0] if argv else "/tmp/pp-previews/assembly.png"
view = argv[1] if len(argv) > 1 else "game"
samples = int(argv[2]) if len(argv) > 2 else 24

reset()


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    return new, roots


shell, _ = import_glb(os.path.join(VENUE, "club_shell.glb"))
for o in shell:
    if o.name.startswith("ShadowOnly_"):
        o.visible_camera = False
    if o.name.startswith("Glass_"):
        o.visible_shadow = False

count = 0
for f in sorted(glob.glob(os.path.join(GODOT, "data", "placements", "*.json"))):
    for p in json.load(open(f)):
        path = os.path.join(GODOT, "assets", "venue", p["asset"])
        if not os.path.exists(path):
            print("MISSING", p["asset"])
            continue
        new, roots = import_glb(path)
        e = bpy.data.objects.new("Placed_" + os.path.basename(path), None)
        bpy.context.scene.collection.objects.link(e)
        for r in roots:
            r.parent = e
        x, y, z = p["pos"]
        e.location = g(x, y, z)
        e.rotation_euler = (0, 0, math.radians(p.get("rot", 0)))
        e.scale = [p.get("scale", 1.0)] * 3
        count += 1
print("PLACED", count)

# light: a low warm sun from beyond the windows (+X in Godot), as the game's, and a soft sky
s = bpy.context.scene
s.render.engine = "CYCLES"
s.cycles.device = "CPU"
s.cycles.samples = samples
s.cycles.use_denoising = True
s.render.resolution_x, s.render.resolution_y = 1280, 720
s.world = bpy.data.worlds.new("W")
s.world.use_nodes = True
s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (*srgb("#cfe2ea"), 1)
s.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.2
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
s.collection.objects.link(sun)
sun.data.energy = 4.0
sun.data.color = srgb("#ffd29a")
d = Vector(g(-0.72, -0.62, -0.34)).normalized()  # the direction the light travels
sun.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
s.collection.objects.link(cam)
s.camera = cam
if view == "game":
    # the game's framing at the coach's start: 42° vertical, 22 m back along (-0.65, 0.76, 0) from (-1.45, 0.45, -3.2)
    cam.data.sensor_fit = "VERTICAL"
    cam.data.angle = math.radians(42)
    t = Vector((-1.45, 0.45, -3.2))
    pos = t + Vector((-0.65, 0.76, 0)).normalized() * 22.0
    cam.location = g(*pos)
    cam.rotation_euler = (g(*t) - cam.location).to_track_quat("-Z", "Y").to_euler()
elif view == "top":
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 32
    cam.location = g(0, 40, -1.6)
    cam.rotation_euler = (0, 0, 0)
else:
    v = [float(a) for a in view.split(",")]
    cam.data.angle = math.radians(50)
    cam.location = g(*v[:3])
    cam.rotation_euler = (g(*v[3:]) - cam.location).to_track_quat("-Z", "Y").to_euler()
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED", out)
