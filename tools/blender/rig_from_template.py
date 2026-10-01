"""Rig a T-pose humanoid with the skeleton of an already rigged character (Coach Panic): same bone names, same hierarchy,
same rest orientations, joints moved to fit the new body, skin weights worked out for the new mesh.
    tools/blender/run.sh tools/blender/rig_from_template.py -- body.glb rigged.glb [--template dist/assets/coach-panic.glb]
        [--set y_crotch=0.70 ...] [--debug out.json] [--tex-quality 90]

Why the rest orientations are copied, not worked out: an animation is a set of rotations per bone, and a rotation only
means the same thing on two skeletons if their bones start from the same orientation. With that, every clip made for
the template plays on the new body: copy the rotation tracks, scale how far the hips travel. Joint positions are what
make the skeleton fit the body (tools/blender/rigfit.py: landmarks measured on the mesh, ratios taken from the
template). The body should stand on the floor, facing +Z in glTF (-Y in Blender), arms out; game_export.py makes a
Meshy mesh like that. Like the template, the result has its armature scaled 0.01 with bones in centimetres."""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
import common  # noqa: E402
import rigfit  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from mathutils.kdtree import KDTree  # noqa: E402

args = common.script_args()
here = os.path.dirname(os.path.abspath(__file__))
template_path = common.option(args, "--template", os.path.join(here, "..", "..", "dist", "assets", "coach-panic.glb"))
debug_path = common.option(args, "--debug")
tex_quality = common.option(args, "--tex-quality", 90, int)
over = {}
while any(a == "--set" or a.startswith("--set=") for a in args):
    key, value = common.option(args, "--set").split("=")
    over[key] = float(value)
src, dst = args[0], args[1]


def to_gltf(v):
    """Blender (x, y, z; z up, faces -y) to glTF (x, y up, z forward)."""
    return (v[0], v[2], -v[1])


def to_blender(g):
    return Vector((g[0], -g[2], g[1]))


def mesh_arrays(obj):
    """World-space vertices (glTF axes) and triangle indices of a mesh object as it is evaluated (modifiers applied)."""
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    M = np.array(obj.matrix_world)
    world = co @ M[:3, :3].T + M[:3, 3]
    tris = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", tris)
    ev.to_mesh_clear()
    return np.c_[world[:, 0], world[:, 2], -world[:, 1]], tris.reshape(-1, 3)


# ---- 1. the template: skeleton (rest orientations, parents), joint positions, body ----------------------------------------
common.clean_scene()
common.import_model(template_path)
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
W = arm.matrix_world
bones = {b.name: b for b in arm.data.bones}
missing = [n for n, _ in rigfit.BONES if n not in bones]
if missing:
    raise SystemExit(f"The template lacks the bones {missing}")
rest_rot = {n: [list(r) for r in bones[n].matrix_local.to_3x3()] for n, _ in rigfit.BONES}
tpl_joints = {n: to_gltf(W @ bones[n].head_local) for n, _ in rigfit.BONES}
tpl_mesh = common.meshes()[0]
V, F = mesh_arrays(tpl_mesh)
calib = rigfit.calibrate(rigfit.sample_surface(V, F), tpl_joints)
print(f"TEMPLATE {os.path.basename(template_path)}: {len(bones)} bones, body {V[:, 1].max():.3f} m")

# ---- 2. the new body --------------------------------------------------------------------------------------------------------
common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
body = common.meshes()
if not body:
    raise SystemExit("No meshes in " + src)
bpy.ops.object.select_all(action="DESELECT")
for m in body:
    m.select_set(True)
bpy.context.view_layer.objects.active = body[0]
if len(body) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.name = "char1"
V, F = mesh_arrays(mesh)
S = rigfit.sample_surface(V, F)
J, M = rigfit.fit(S, calib, over)
H = M["H"]
if over:
    print("OVERRIDES", over)
print(f"BODY height {H:.3f} m: crotch {M['y_crotch']:.3f}, neck {M['y_neck']:.3f}, ankle {M['y_ankle']:.3f}, arm span {2 * M['xmax']:.3f}")
Jb = {n: to_blender(p) for n, p in J.items()}

# ---- 3. a temporary skeleton, bones running joint to joint, for the skin weights ------------------------------------------
cy, cz = M["armL"]
x_tip = M["xmax"] - 0.004
tips = {
    "LeftHand": to_blender((x_tip, cy[0] + cy[1] * x_tip, cz[0] + cz[1] * x_tip)),
    "RightHand": to_blender((-x_tip, M["armR"][0][0] + M["armR"][0][1] * x_tip, M["armR"][1][0] + M["armR"][1][1] * x_tip)),
    "LeftToeBase": to_blender((J["LeftToeBase"][0], 0.5 * J["LeftToeBase"][1], M["foot_z"][1] - 0.01)),
    "RightToeBase": to_blender((J["RightToeBase"][0], 0.5 * J["RightToeBase"][1], M["foot_z"][1] - 0.01)),
}
first_child = {}
for n, p in rigfit.BONES:
    if p and p not in first_child and n not in ("headfront",) and not (p == "Hips" and n in ("LeftUpLeg", "RightUpLeg")):
        first_child[p] = n
first_child["Hips"] = "Spine02"
first_child["Spine"] = "neck"
first_child["Head"] = "head_end"
LEAVES = ("head_end", "headfront")


def make_armature(name):
    data = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    return obj, data


tmp, tdata = make_armature("tmp")
for n, p in rigfit.BONES:
    eb = tdata.edit_bones.new(n)
    eb.head = Jb[n]
    if n in tips:
        eb.tail = tips[n]
    elif n in first_child:
        eb.tail = Jb[first_child[n]]
    else:
        eb.tail = Jb[n] + Vector((0, 0, 0.05))
    if (eb.tail - eb.head).length < 0.01:
        eb.tail = eb.head + Vector((0, 0, 0.02))
    eb.use_deform = n not in LEAVES
bpy.ops.object.mode_set(mode="OBJECT")

# Meshy's mesh arrives as loose triangle patches (a vertex per UV or normal split), which Blender's weight solver cannot
# use. So the weights are worked out on a copy with the split vertices welded, then handed to the real mesh by position.
bm = bmesh.new()
bm.from_mesh(mesh.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
weld_data = bpy.data.meshes.new("weld")
bm.to_mesh(weld_data)
bm.free()
weld = bpy.data.objects.new("weld", weld_data)
scene.collection.objects.link(weld)
bpy.ops.object.select_all(action="DESELECT")
weld.select_set(True)
tmp.select_set(True)
bpy.context.view_layer.objects.active = tmp
bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def weighted(v):
    return any(g.weight > 1e-4 for g in v.groups)


def distance_to_segment(p, head, tail):
    """How far the point p is from the bone running head to tail."""
    along = tail - head
    t = np.clip(np.dot(p - head, along) / max(np.dot(along, along), 1e-9), 0, 1)
    return np.linalg.norm(p - (head + t * along))


names = {n for n, _ in rigfit.BONES if n not in LEAVES}
loose = [v.index for v in weld_data.vertices if not weighted(v)]
print(f"WEIGHTS automatic on the welded copy: {len(weld_data.vertices) - len(loose)}/{len(weld_data.vertices)} vertices, groups {len(weld.vertex_groups)}")
if loose:
    # a vertex the solver left out follows its nearest bone
    segs = [(n, np.array(Jb[n]), np.array(tdata.bones[n].tail_local)) for n in names]
    for i in loose:
        p = np.array(weld_data.vertices[i].co)
        best = min(segs, key=lambda s: distance_to_segment(p, s[1], s[2]))
        group = weld.vertex_groups.get(best[0]) or weld.vertex_groups.new(name=best[0])
        group.add([i], 1.0, "REPLACE")
    print(f"WEIGHTS {len(loose)} vertices given to their nearest bone")
# hand the weights to the real mesh
tree = KDTree(len(weld_data.vertices))
for v in weld_data.vertices:
    tree.insert(v.co, v.index)
tree.balance()
group_names = [g.name for g in weld.vertex_groups]
for name in group_names:
    mesh.vertex_groups.new(name=name)
worst = 0.0
for v in mesh.data.vertices:
    _, wi, dist = tree.find(v.co)
    worst = max(worst, dist)
    for g in weld_data.vertices[wi].groups:
        mesh.vertex_groups[group_names[g.group]].add([v.index], g.weight, "REPLACE")
print(f"WEIGHTS copied to {len(mesh.data.vertices)} mesh vertices (furthest match {worst:.6f} m)")
bpy.data.objects.remove(weld)
bpy.data.meshes.remove(weld_data)
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.01)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)

# ---- 4. the real skeleton: the template's names, parents and rest orientations at the fitted joints ---------------------
for mod in list(mesh.modifiers):
    mesh.modifiers.remove(mod)
mesh.parent = None
bpy.data.objects.remove(tmp)
bpy.data.armatures.remove(tdata)
final, fdata = make_armature("Armature")
final.scale = (0.01, 0.01, 0.01)  # centimetres inside a 0.01 armature, like the template
for n, p in rigfit.BONES:
    eb = fdata.edit_bones.new(n)
    # orientation by axis and roll (EditBone.matrix does not keep it): the bone's Y axis and twist, as in the template
    axis, roll = bpy.types.Bone.AxisRollFromMatrix(Matrix(rest_rot[n]))
    eb.head = Jb[n] * 100.0
    eb.tail = eb.head + axis.normalized() * 5.0
    eb.roll = roll
    eb.use_deform = True
    if p:
        eb.parent = fdata.edit_bones[p]
        eb.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()
mesh.parent = final
mesh.matrix_parent_inverse = final.matrix_world.inverted()
mod = mesh.modifiers.new("Armature", "ARMATURE")
mod.object = final
for obj in scene.objects:
    obj.select_set(True)
    if obj.type == "ARMATURE":
        obj.data.pose_position = "REST"

if debug_path:
    with open(debug_path, "w") as f:
        json.dump({"joints": {k: [round(float(x), 4) for x in v] for k, v in J.items()}, "landmarks": {k: v for k, v in M.items() if isinstance(v, float)}}, f, indent=1)

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_animations=False,
    export_skins=True,
    export_image_format="JPEG",
    export_jpeg_quality=tex_quality,
)
tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
print(f"RIGGED {dst}: {len(fdata.bones)} bones, {len(mesh.vertex_groups)} weight groups, {tris} triangles")
