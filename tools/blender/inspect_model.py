"""What is in a model: meshes (size, triangles, materials), armatures (bones), animations (frame ranges).
    tools/blender/run.sh tools/blender/inspect_model.py -- model.glb"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402

args = common.script_args()
path = args[0]
common.clean_scene()
common.import_model(path)
scene = bpy.context.scene
ms = common.meshes()
print(f"MODEL {os.path.basename(path)}")
lo, hi = common.world_bounds(ms) if ms else ((0, 0, 0), (0, 0, 0))
print(f"  size (x, y, z): {hi[0]-lo[0]:.2f} x {hi[1]-lo[1]:.2f} x {hi[2]-lo[2]:.2f}  (Blender axes: Z is up)")
for m in ms:
    tris = sum(len(p.vertices) - 2 for p in m.data.polygons)
    mats = [s.material.name for s in m.material_slots if s.material]
    groups = len(m.vertex_groups)
    print(f"  mesh {m.name}: {len(m.data.vertices)} verts, {tris} tris, materials {mats}, weight groups {groups}")
for a in [o for o in scene.objects if o.type == "ARMATURE"]:
    print(f"  armature {a.name}: {len(a.data.bones)} bones: {', '.join(b.name for b in a.data.bones)}")
for act in bpy.data.actions:
    lo_f, hi_f = act.frame_range
    print(f"  animation {act.name}: frames {lo_f:.0f}-{hi_f:.0f}, {len(act.fcurves)} curves")
if not ms:
    print("  (no meshes found)")
