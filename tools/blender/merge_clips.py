"""Put the clips of other GLBs onto a character: its bone names must match (same rig, as Meshy's are).
    tools/blender/run.sh tools/blender/merge_clips.py -- base.glb out.glb more.glb [more2.glb ...] [--replace]
The base keeps its mesh and clips; every clip of the other files is added under its own name. A clip whose name is
already taken is skipped, or replaces the old one with --replace. The other files' meshes are dropped."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402

args = common.script_args()
replace = common.flag(args, "--replace")
base, dst, others = args[0], args[1], args[2:]

common.clean_scene()
common.import_model(base)
arm = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"][0]
for action in bpy.data.actions:
    action.use_fake_user = True
for path in others:
    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    common.import_model(path)
    for action in set(bpy.data.actions) - before_actions:
        action.use_fake_user = True
        clash = bpy.data.actions.get(action.name.split(".001")[0]) if action.name.endswith(".001") else None
        if clash and clash is not action:
            if replace:
                bpy.data.actions.remove(clash)
                action.name = action.name[: -len(".001")]
            else:
                print("SKIPPED", action.name, "(name taken)")
                bpy.data.actions.remove(action)
                continue
        print("ADDED", action.name, "from", os.path.basename(path))
    for obj in set(bpy.data.objects) - before_objects:
        bpy.data.objects.remove(obj)
common.export_clips(arm, dst)
print("CLIPS", sorted(a.name for a in bpy.data.actions))
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
