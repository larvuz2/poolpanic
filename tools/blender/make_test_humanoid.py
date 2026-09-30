"""A stand-in character built from primitives (T-pose, facing -Y, feet on the floor, 1.8 m tall), for testing the
rig pipeline when no real mesh is at hand.
    tools/blender/run.sh tools/blender/make_test_humanoid.py -- out.glb"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402

out = common.script_args()[0]
common.clean_scene()
parts = []


def box(name, size, loc, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = color
    o.data.materials.append(mat)
    # A few cuts so the joints have vertices to bend.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.subdivide(number_cuts=3)
    bpy.ops.object.mode_set(mode="OBJECT")
    parts.append(o)


skin, shirt, pants = (0.9, 0.7, 0.55, 1), (0.95, 0.75, 0.2, 1), (0.1, 0.25, 0.4, 1)
box("head", (0.22, 0.22, 0.24), (0, 0, 1.68), skin)
box("torso", (0.36, 0.2, 0.52), (0, 0, 1.25), shirt)
box("hips", (0.34, 0.2, 0.18), (0, 0, 0.93), pants)
for side, x in (("L", 0.1), ("R", -0.1)):
    box("thigh" + side, (0.15, 0.16, 0.44), (x, 0, 0.66), pants)
    box("shin" + side, (0.12, 0.13, 0.44), (x, 0, 0.23), pants)
    box("foot" + side, (0.12, 0.26, 0.07), (x, -0.06, 0.035), (0.1, 0.1, 0.1, 1))
    box("arm" + side, (0.56, 0.11, 0.11), (x * 1 + (0.43 if side == "L" else -0.43), 0, 1.42), shirt)
    box("hand" + side, (0.14, 0.09, 0.08), (x + (0.78 if side == "L" else -0.78), 0, 1.42), skin)
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
bpy.context.object.name = "character"
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB")
print("EXPORTED", out)
