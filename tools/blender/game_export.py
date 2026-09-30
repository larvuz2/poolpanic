"""Make a GLB game-ready: shrink its textures (JPEG, at most --tex pixels a side) and export again with the skin and all
of the clips (each under its own name). Reports the triangle count and file size.
    tools/blender/run.sh tools/blender/game_export.py -- in.glb out.glb [--tex 1024] [--quality 85] [--clip Walk]
        [--roughness 0.75] [--keep-material] [--keep-origin] [--height 1.75]
--clip names the clip of a model with a single animation, like a walk straight from Meshy (polish_walk.py names its own).
Meshy's material arrives emissive and fully metallic, which a game's lights turn into a glowing mirror, so it is made a
plain matte one (no emission, no metal, --roughness) unless --keep-material. A model with no skin (a mesh straight from
Meshy, origin at its middle) is stood on the floor, centred, facing +Z, unless --keep-origin; --height scales it to that many metres tall first (Meshy makes everyone the same height)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import common  # noqa: E402

args = common.script_args()
tex = common.option(args, "--tex", 1024, int)
clip = common.option(args, "--clip")
quality = common.option(args, "--quality", 85, int)
roughness = common.option(args, "--roughness", 0.75, float)
keep_material = common.flag(args, "--keep-material")
keep_origin = common.flag(args, "--keep-origin")
height = common.option(args, "--height", None, float)
src, dst = args[0], args[1]

common.clean_scene()
common.import_model(src)
for image in bpy.data.images:
    if image.size[0] > tex or image.size[1] > tex:
        scale = tex / max(image.size)
        image.scale(max(1, int(image.size[0] * scale)), max(1, int(image.size[1] * scale)))
    print("IMAGE", image.name, tuple(image.size))
if not keep_material:
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            node.inputs["Metallic"].default_value = 0.0
            node.inputs["Roughness"].default_value = roughness
            node.inputs["Specular IOR Level"].default_value = 0.5  # with these, the exporter writes no specular extension
            node.inputs["Specular Tint"].default_value = (1, 1, 1, 1)
            node.inputs["IOR"].default_value = 1.5
            for link in list(node.inputs["Emission Color"].links):
                material.node_tree.links.remove(link)
            node.inputs["Emission Color"].default_value = (0, 0, 0, 1)
            node.inputs["Emission Strength"].default_value = 0.0
            print("MATERIAL", material.name, "matte, roughness", roughness)
if clip:
    if len(bpy.data.actions) == 1:
        bpy.data.actions[0].name = clip
    else:
        print("WARNING: --clip only names a file's single clip; this one has", len(bpy.data.actions))
tris = sum(len(p.vertices) - 2 for m in common.meshes() for p in m.data.polygons)
print("TRIANGLES", tris)
print("CLIPS", sorted(a.name for a in bpy.data.actions))
armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
if not armatures and not keep_origin:
    # Blender's Z is up: lift the mesh so its lowest point is z = 0 and centre it on x and y, baking it into the vertices.
    if height:
        lo, hi = common.world_bounds(common.meshes())
        k = height / (hi.z - lo.z)
        for obj in common.meshes():
            obj.select_set(True)
            obj.scale *= k
        bpy.context.view_layer.update()
        print("SCALE", round(k, 4))
    lo, hi = common.world_bounds(common.meshes())
    shift = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    for obj in common.meshes():
        obj.select_set(True)
        obj.location += shift  # meshes here sit at the top level of the scene, without a parent
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    print("FEET origin shift", tuple(round(v, 3) for v in shift))
options = {"export_image_format": "JPEG", "export_jpeg_quality": quality}
if armatures:
    common.export_clips(armatures[0], dst, **options)
else:
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=False, **options)
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
