"""Rig a humanoid mesh: a basic armature fitted to its size, automatic weights, an optional walk cycle, glTF out.
    tools/blender/run.sh tools/blender/humanoid_rig.py -- in.glb out.glb [--walk] [--frames 24] [--height M]

The mesh should stand on the floor in a T-pose or A-pose, facing the front (glTF +Z, Blender -Y): what Tripo and
Meshy produce. Bone positions come from body proportions, so check a turntable of the result (turntable.py with
--animation Walk) and adjust the PROPORTIONS below for a stylised body. The bones: hips (root), spine, chest, neck,
head, and per side thigh, shin, foot, shoulder, upper_arm, forearm, hand. Custom bones (a jetpack, a weapon socket)
are one `bone(...)` line each in `build_armature`."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
from mathutils import Vector  # noqa: E402

# Fractions of the body's height (z) and half-width (x), for a T-pose character facing -Y.
PROPORTIONS = {
    "hip": 0.52,
    "spine_top": 0.72,
    "neck": 0.84,
    "head_top": 0.99,
    "knee": 0.285,
    "ankle": 0.045,
    "toe": 0.14,  # how far the foot reaches forward, as a fraction of height
    "hip_x": 0.055,
    "shoulder_x": 0.05,
    "shoulder_z": 0.80,
    "elbow_x": 0.17,
    "wrist_x": 0.31,
    "hand_x": 0.39,
}

args = common.script_args()
walk = common.flag(args, "--walk")
frames = common.option(args, "--frames", 24, int)
height_override = common.option(args, "--height", None, float)
src, dst = args[0], args[1]

common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
body = common.meshes()
if not body:
    raise SystemExit("No meshes in " + src)
# One mesh to skin: join the pieces (keeps their materials).
bpy.ops.object.select_all(action="DESELECT")
for m in body:
    m.select_set(True)
bpy.context.view_layer.objects.active = body[0]
if len(body) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

lo, hi = common.world_bounds([mesh])
H = height_override or (hi.z - lo.z)
floor = lo.z
cx = (lo.x + hi.x) / 2
cy = (lo.y + hi.y) / 2
P = PROPORTIONS


def at(x, z, y=0.0):
    return Vector((cx + x * H, cy + y * H, floor + z * H))


def build_armature():
    bpy.ops.object.mode_set(mode="OBJECT")
    arm_data = bpy.data.armatures.new("Armature")
    arm = bpy.data.objects.new("Armature", arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    bones = arm_data.edit_bones

    def bone(name, head, tail, parent=None, connect=False):
        b = bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = bones[parent]
            b.use_connect = connect
        return b

    bone("hips", at(0, P["hip"] - 0.03), at(0, P["hip"] + 0.05))
    bone("spine", at(0, P["hip"] + 0.05), at(0, (P["hip"] + P["spine_top"]) / 2 + 0.05), "hips", True)
    bone("chest", bones["spine"].tail, at(0, P["spine_top"] + 0.04), "spine", True)
    bone("neck", bones["chest"].tail, at(0, P["neck"]), "chest", True)
    bone("head", bones["neck"].tail, at(0, P["head_top"]), "neck", True)
    for side, s in (("L", 1), ("R", -1)):
        hip = at(s * P["hip_x"], P["hip"] - 0.02)
        bone("thigh." + side, hip, at(s * P["hip_x"], P["knee"]), "hips")
        bone("shin." + side, bones["thigh." + side].tail, at(s * P["hip_x"], P["ankle"]), "thigh." + side, True)
        bone("foot." + side, bones["shin." + side].tail, at(s * P["hip_x"], P["ankle"] * 0.4, -P["toe"]), "shin." + side, True)
        bone("shoulder." + side, bones["chest"].tail - Vector((0, 0, 0.04 * H)), at(s * P["shoulder_x"], P["shoulder_z"]), "chest")
        bone("upper_arm." + side, bones["shoulder." + side].tail, at(s * P["elbow_x"], P["shoulder_z"]), "shoulder." + side, True)
        bone("forearm." + side, bones["upper_arm." + side].tail, at(s * P["wrist_x"], P["shoulder_z"]), "upper_arm." + side, True)
        bone("hand." + side, bones["forearm." + side].tail, at(s * P["hand_x"], P["shoulder_z"]), "forearm." + side, True)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


arm = build_armature()
# Automatic weights: the armature deforms the mesh.
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
weighted = sum(1 for v in mesh.data.vertices if any(g.weight > 0 for g in v.groups))
print(f"RIG bones={len(arm.data.bones)} weighted_vertices={weighted}/{len(mesh.data.vertices)} height={H:.2f}")


def walk_cycle():
    """A loop of `frames` frames: opposite arm and leg swing, knees bend on the lift, hips bob, spine twists."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    action = bpy.data.actions.new("Walk")
    arm.animation_data_create().action = action
    pose = arm.pose.bones
    for b in pose:
        b.rotation_mode = "XYZ"
    scene.frame_start, scene.frame_end = 1, frames
    swing, bend = math.radians(28), math.radians(38)
    for f in range(frames + 1):
        t = 2 * math.pi * f / frames
        frame = 1 + f
        for side, phase in (("L", 0.0), ("R", math.pi)):
            leg = math.sin(t + phase)
            lift = max(0.0, math.cos(t + phase))
            pose["thigh." + side].rotation_euler = (-swing * leg, 0, 0)
            pose["shin." + side].rotation_euler = (bend * lift, 0, 0)
            pose["foot." + side].rotation_euler = (-bend * 0.4 * lift, 0, 0)
            pose["upper_arm." + side].rotation_euler = (swing * 0.8 * leg, 0, 0)
            pose["forearm." + side].rotation_euler = (-math.radians(14) * (1 - leg) / 2, 0, 0)
        pose["hips"].location = (0, 0, -0.012 * H * abs(math.cos(t)))
        pose["spine"].rotation_euler = (0, 0, math.radians(5) * math.sin(t))
        pose["chest"].rotation_euler = (0, 0, -math.radians(4) * math.sin(t))
        for b in pose:
            b.keyframe_insert("rotation_euler", frame=frame)
        pose["hips"].keyframe_insert("location", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")
    # Loop cleanly: smooth interpolation, no extrapolation drift.
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    print(f"WALK frames=1-{frames}")


if walk:
    walk_cycle()
    arm.animation_data.action.name = "Walk"
    # Keep the clip in the exported file as a named animation.
    track = arm.animation_data.nla_tracks.new()
    track.name = "Walk"
    track.strips.new("Walk", 1, arm.animation_data.action)
    arm.animation_data.action = None

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_animations=bool(walk),
    export_animation_mode="NLA_TRACKS",
    export_skins=True,
)
print("EXPORTED", dst)
