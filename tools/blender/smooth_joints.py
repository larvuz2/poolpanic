"""Stop the mesh tearing at bent joints. A low-poly limb is a long tube with one ring of vertices at the knee or elbow,
so a deep bend (a run's knees) stretches its long faces into spikes and tears the texture. This adds rings of vertices
across each joint (texture coordinates and normals interpolate, so nothing shows) and spreads the skin weights over them,
so the two bones hand the limb over gradually instead of at one ring.
    tools/blender/run.sh tools/blender/smooth_joints.py -- in.glb out.glb [--joints knee,elbow] [--half 0.4] [--cuts 2]
--joints picks the joints (default knee,elbow); --half is the half width of the blended band as a fraction of the
shorter of the two bones; --cuts is the number of new rings on each side of the joint. Clips, skin and textures are kept."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
import common  # noqa: E402

args = common.script_args()
joints = common.option(args, "--joints", "knee,elbow").split(",")
half_fraction = common.option(args, "--half", 0.4, float)
cuts = common.option(args, "--cuts", 2, int)
src, dst = args[0], args[1]

common.clean_scene()
common.import_model(src)
scene = bpy.context.scene
arm = [o for o in scene.objects if o.type == "ARMATURE"][0]
bones = common.humanoid_bones(arm)
mesh = common.meshes()[0]
mw = mesh.matrix_world
inv = mw.inverted()
W = arm.matrix_world
before = len(mesh.data.polygons)

# (parent bone, child bone, the bone after the child): the joint is the child's head.
SPECS = {
    "knee": lambda b: (b["thigh"], b["shin"], b["foot"]),
    "elbow": lambda b: (b["upper"], b["fore"], b["hand"]),
}
scale = mw.to_scale()[0] or 1.0


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


bm = bmesh.new()
bm.from_mesh(mesh.data)
deform = bm.verts.layers.deform.active
groups = {g.name: g.index for g in mesh.vertex_groups}
for side in ("left", "right"):
    for joint in joints:
        parent, child, after = SPECS[joint](bones[side])
        p0, j, p2 = (W @ b.head_local for b in (parent, child, after))
        d = ((j - p0).normalized() + (p2 - j).normalized()).normalized()
        half = half_fraction * min((j - p0).length, (p2 - j).length)
        # The limb: its faces lie along the axis between the joints either side of this one and close to it. A low-poly
        # limb has a few long faces that run far past the joint, so a face is cut only when it lies wholly inside the limb.
        reach_up, reach_down = d.dot(p0 - j) - 0.03, d.dot(p2 - j) + 0.03

        def place(v):
            p = mw @ v.co
            along = d.dot(p - j)
            return along, ((p - j) - d * along).length

        def in_limb(v):
            along, across = place(v)
            return reach_up <= along <= reach_down and across <= 0.16

        for k in range(-cuts, cuts + 1):
            faces = [f for f in bm.faces if all(in_limb(v) for v in f.verts)]
            geom = set(faces)
            for f in faces:
                geom.update(f.edges)
                geom.update(f.verts)
            bmesh.ops.bisect_plane(
                bm,
                geom=list(geom),
                dist=0.003 / scale,
                plane_co=inv @ (j + d * (half * k / cuts)),
                plane_no=(inv.to_3x3() @ d).normalized(),
            )
        # Hand the limb from one bone to the next over the band.
        a, b = groups[parent.name], groups[child.name]
        changed = 0
        for v in bm.verts:
            along, across = place(v)
            if abs(along) > half or across > 0.16:
                continue
            w = v[deform]
            other = sum(x for g, x in w.items() if g not in (a, b))
            share = max(0.0, 1.0 - other)
            child_weight = smoothstep((along + half) / (2 * half)) * share
            w[a] = share - child_weight
            w[b] = child_weight
            changed += 1
        print("JOINT", side, joint, "band ±%.3f m" % half, "weights set on", changed, "vertices; triangles now", sum(len(f.verts) - 2 for f in bm.faces))
bm.to_mesh(mesh.data)
bm.free()
mesh.data.update()
print("TRIANGLES", before, "->", sum(len(p.vertices) - 2 for p in mesh.data.polygons))
common.export_clips(arm, dst, export_image_format="AUTO")
print("EXPORTED", dst, os.path.getsize(dst), "bytes")
