"""New skin weights for the snow monkey, worked out from where each vertex sits on the body instead of by Blender's bone heat.
    tools/blender/run.sh tools/blender/monkey_skin.py -- rigged.glb reskinned.glb [--smooth 6] [--debug weights.json]

Why (19 October 2026, the creator: "look at the monkey's face… it's like it's ripped off… the monkey's back, I can see the
emptiness"): rig_from_template.py's bone-heat weights tied the monkey's chin and cheek fur to the shoulders and the arms, which
sit at the same height as the big head in the T-pose, and the shards of fur on its back to the arms and the legs. Standing
still nothing showed; walking on all fours, with the arms swung down and the head pitched back, the face stretched into long
strips and the back opened up.

Here every vertex is weighted by region, in the rest pose (the joints from the rigged file):
- the head: everything inside an ellipsoid round the skull and the face (the ears, the cheek ruff, the eyes, the chin), wholly
  the Head, with a soft band to the neck under it;
- the arms: a capsule round each arm, out past the shoulder, weighted along the limb (Shoulder, Arm, ForeArm, Hand, blended a
  few centimetres either side of each joint), fading into the chest at the armpit;
- the legs: below the hips, either side of the middle, along the limb (UpLeg, Leg, Foot, ToeBase), fading into the pelvis;
- the tail (a lump behind the left shin, fused to the leg): the left thigh;
- the trunk: what is left, along the spine by height (Hips, Spine02, Spine01, Spine, neck), each a tent between its neighbours.
Then the weights are smoothed over the welded surface (`--smooth` passes, the head's core held at 1), so no two neighbouring
vertices pull apart, and normalized to at most four bones."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
import numpy as np  # noqa: E402
from mathutils.kdtree import KDTree  # noqa: E402

args = common.script_args()
src, dst = args[0], args[1]
passes = common.option(args, "--smooth", 6, int)
debug_path = common.option(args, "--debug")


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


common.clean_scene()
common.import_model(src)
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
mesh = common.meshes()[0]


def g(v):
    """Blender world (z up, -y forward) to (x, up, forward)."""
    return np.array([v.x, v.z, -v.y])


J = {b.name: g(arm.matrix_world @ b.head_local) for b in arm.data.bones}
P = np.array([g(mesh.matrix_world @ v.co) for v in mesh.data.vertices])
x, y, f = P[:, 0], P[:, 1], P[:, 2]
n = len(P)
BONES = [
    "Hips", "Spine02", "Spine01", "Spine", "neck", "Head",
    "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
    "RightShoulder", "RightArm", "RightForeArm", "RightHand",
    "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
    "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
]
col = {b: i for i, b in enumerate(BONES)}
W = np.zeros((n, len(BONES)))

# ---- the head ------------------------------------------------------------------------------------------------------------
neck_y, head_y = J["neck"][1], J["Head"][1]
# The skull's box: the vertices above the Head joint, away from the arms.
above = (y > head_y + 0.03) & (np.abs(x) < 0.3)
lo, hi = P[above].min(axis=0), P[above].max(axis=0)
c = np.array([0.0, (head_y + hi[1]) / 2 - 0.01, (lo[2] + hi[2]) / 2])
ry_ = (hi[1] - head_y) / 2 + 0.07  # down to just under the chin
rx_ = (hi[0] - lo[0]) / 2 * 1.02
rz_ = (hi[2] - lo[2]) / 2 * 1.04
s = np.sqrt(((x - c[0]) / rx_) ** 2 + ((y - c[1]) / ry_) ** 2 + ((f - c[2]) / rz_) ** 2)
head = 1 - smoothstep(0.92, 1.12, s)
# (the face and the chin in front, whatever their height above the shoulders)
face = smoothstep(0.08, 0.12, f) * smoothstep(neck_y - 0.07, neck_y - 0.02, y) * (np.abs(x) < rx_ * 0.8)
head = np.maximum(head, face)
# (never the arms: anything far out sideways at arm height is the arm's)
head *= 1 - smoothstep(rx_ * 0.95, rx_ * 1.15, np.abs(x)) * (y < head_y + 0.02)

# ---- the arms ------------------------------------------------------------------------------------------------------------
arms = np.zeros(n)
for side, pre in ((1, "Left"), (-1, "Right")):
    a0, a1 = J[pre + "Shoulder"], J[pre + "Hand"]
    tip = np.array([side * np.abs(x).max(), a1[1], a1[2]])
    d = tip - a0
    L = np.linalg.norm(d)
    u = d / L
    rel = P - a0
    t = rel @ u  # metres along the arm from the shoulder joint
    radial = np.linalg.norm(rel - np.outer(t, u), axis=1)
    out = side * x
    w = smoothstep(J[pre + "Arm"][0] * side + 0.0, J[pre + "Arm"][0] * side + 0.05, out) * (1 - smoothstep(0.075, 0.105, radial))
    w *= out > 0
    w *= 1 - head
    arms = np.maximum(arms, w)
    # along the limb: tents at the joints
    stops = [(pre + "Shoulder", 0.0), (pre + "Arm", (J[pre + "Arm"] - a0) @ u),
             (pre + "ForeArm", (J[pre + "ForeArm"] - a0) @ u), (pre + "Hand", (J[pre + "Hand"] - a0) @ u)]
    for k, (bone, at) in enumerate(stops):
        nxt = stops[k + 1][1] if k + 1 < len(stops) else None
        lo = at - 0.03
        if nxt is None:
            share = smoothstep(lo, at + 0.03, t)
        else:
            share = smoothstep(lo, at + 0.03, t) * (1 - smoothstep(nxt - 0.03, nxt + 0.03, t))
        if k == 0:
            share = 1 - smoothstep(stops[1][1] - 0.03, stops[1][1] + 0.03, t)
        W[:, col[bone]] += w * share

# ---- the legs ------------------------------------------------------------------------------------------------------------
hip_y = J["LeftUpLeg"][1]
legs = np.zeros(n)
# The tail: a lump of fur that hangs behind the left shin in the T-pose, fused to the leg all round its edge (and a little
# across the middle). Anything tied to two bones that swing apart tears, so it is the left leg's, held to the thigh.
tail = smoothstep(-0.12, -0.15, f) * (1 - smoothstep(0.18, 0.22, y)) * smoothstep(-0.05, -0.03, x)
for side, pre in ((1, "Left"), (-1, "Right")):
    # (behind the hip joint the band is wider: walking on all fours bends the hips 80 degrees, which stretches the rump, and
    # a wide band spreads that over many triangles instead of opening a gap)
    behind = smoothstep(J["Hips"][2], J["Hips"][2] - 0.08, f)
    w = (1 - smoothstep(hip_y - 0.08 - 0.10 * behind, hip_y + 0.02 + 0.03 * behind, y)) * smoothstep(0.0, 0.04, side * x)
    if side > 0:
        w = np.maximum(w * (1 - tail), tail)
    else:
        w *= 1 - tail
    w *= 1 - head
    w *= 1 - np.minimum(arms, 1)
    legs = np.maximum(legs, w)
    knee, ankle, toe = J[pre + "Leg"][1], J[pre + "Foot"][1], J[pre + "ToeBase"]
    up = smoothstep(knee - 0.025, knee + 0.025, y)
    shin = (1 - up) * smoothstep(ankle - 0.01, ankle + 0.025, y)
    low = (1 - up) * (1 - smoothstep(ankle - 0.01, ankle + 0.025, y))
    toes = low * smoothstep(toe[2] - 0.04, toe[2] - 0.0, f)
    foot = low - toes
    if side > 0:  # the tail rides on the thigh, not the shin or the foot
        up, shin, foot, toes = (up * (1 - tail) + tail * 0.8, shin * (1 - tail) + tail * 0.2, foot * (1 - tail),
                                toes * (1 - tail))
    for bone, share in ((pre + "UpLeg", up), (pre + "Leg", shin), (pre + "Foot", foot), (pre + "ToeBase", toes)):
        W[:, col[bone]] += w * share

# ---- the trunk -----------------------------------------------------------------------------------------------------------
trunk = np.clip(1 - head - arms - legs, 0, 1)
chain = [("Hips", J["Hips"][1]), ("Spine02", J["Spine02"][1]), ("Spine01", J["Spine01"][1]), ("Spine", J["Spine"][1]),
         ("neck", J["neck"][1]), ("Head", J["Head"][1])]
for k, (bone, at) in enumerate(chain):
    prev = chain[k - 1][1] if k else None
    nxt = chain[k + 1][1] if k + 1 < len(chain) else None
    if prev is None:
        share = 1 - np.clip((y - at) / (nxt - at), 0, 1)
    elif nxt is None:
        share = np.clip((y - prev) / (at - prev), 0, 1)
    else:
        share = np.where(y < at, np.clip((y - prev) / (at - prev), 0, 1), 1 - np.clip((y - at) / (nxt - at), 0, 1))
    W[:, col[bone]] += trunk * share
W[:, col["Head"]] += head

# ---- smoothing over the welded surface -------------------------------------------------------------------------------------
tree = KDTree(n)
for i, p in enumerate(P):
    tree.insert(p, i)
tree.balance()
weld = np.arange(n)
for i, p in enumerate(P):
    for _, j, _ in tree.find_range(p, 1e-5):
        weld[i] = min(weld[i], j)
uniq, idx = np.unique(weld, return_inverse=True)
m = len(uniq)
edges = set()
for poly in mesh.data.polygons:
    vs = [idx[v] for v in poly.vertices]
    for a, b in zip(vs, vs[1:] + vs[:1]):
        if a != b:
            edges.add((min(a, b), max(a, b)))
E = np.array(sorted(edges))
Wm = np.zeros((m, len(BONES)))
np.add.at(Wm, idx, W)
cnt = np.bincount(idx, minlength=m)[:, None]
Wm /= np.maximum(cnt, 1)
core = np.zeros(m)
np.maximum.at(core, idx, (s < 0.85).astype(float))
deg = np.bincount(E.ravel(), minlength=m)[:, None]
for _ in range(passes):
    acc = np.zeros_like(Wm)
    np.add.at(acc, E[:, 0], Wm[E[:, 1]])
    np.add.at(acc, E[:, 1], Wm[E[:, 0]])
    avg = np.where(deg > 0, acc / np.maximum(deg, 1), Wm)
    Wm = 0.5 * Wm + 0.5 * avg
    # the skull and the face stay wholly the head's
    Wm[core > 0] = 0
    Wm[core > 0, col["Head"]] = 1
W = Wm[idx]

# ---- at most four bones, normalized ----------------------------------------------------------------------------------------
W[W < 0.01] = 0
order = np.argsort(-W, axis=1)
keep = np.zeros_like(W, dtype=bool)
np.put_along_axis(keep, order[:, :4], True, axis=1)
W = np.where(keep, W, 0)
W /= np.maximum(W.sum(axis=1, keepdims=True), 1e-9)

for vg in list(mesh.vertex_groups):
    mesh.vertex_groups.remove(vg)
groups = {b: mesh.vertex_groups.new(name=b) for b in BONES}
for i in range(n):
    for b in np.nonzero(W[i])[0]:
        groups[BONES[b]].add([i], float(W[i, b]), "REPLACE")
print(
    f"RESKINNED {n} vertices ({m} welded): head {np.mean(W[:, col['Head']] > 0.5):.0%}, "
    f"arms {np.mean(arms > 0.5):.0%}, legs {np.mean(legs > 0.5):.0%}, tail {np.mean(tail > 0.5):.0%}; ellipsoid "
    f"centre {np.round(c, 3).tolist()} radii {[round(float(r), 3) for r in (rx_, ry_, rz_)]}"
)
if debug_path:
    with open(debug_path, "w") as fh:
        json.dump({"centre": c.tolist(), "radii": [rx_, ry_, rz_]}, fh)

for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=dst, export_format="GLB", export_animations=False, export_skins=True, export_image_format="JPEG",
    export_jpeg_quality=90,
)
print("WROTE", dst)
