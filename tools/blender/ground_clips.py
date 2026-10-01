"""Stand a character's clips on the floor: lift the hips of each clip so that the lowest point of the mesh, over the whole
clip, rests on the floor instead of sinking under it.
    tools/blender/run.sh tools/blender/ground_clips.py -- in.glb out.glb [--only Walk,Run]
A walk or run taken from another body (retarget_clips.py), or from Meshy, often holds the body a few centimetres too low,
so the feet are cut off by the ground. The fix is one height per clip: every key of the root bone's position (the hips)
moves straight up by the same amount, and since everything hangs from the hips the whole body rises. The pose, the speed,
the loop and the length do not change. The amount is how far the mesh goes below the floor at its lowest, found by
playing the clip in Blender (every frame, or about 48 of them in a long clip). Only the values of those position keys are
rewritten, straight in the GLB: the rest of the file (mesh, skin, bones, textures, the other clips) stays as it was, byte
for byte, and the result is measured again from the file written. A clip that already stands on the floor (an idle) is
left alone, so running it twice changes nothing. Run it last, after retarget_clips.py."""
import json
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common  # noqa: E402
import numpy as np  # noqa: E402

args = common.script_args()
only = common.option(args, "--only")
src, dst = args[0], args[1]
ON_THE_FLOOR = 0.0005  # metres: a clip whose lowest point is this close to the floor is left as it is


def measure(path):
    """{clip: lowest height of the posed mesh in each sampled frame, in metres above the floor}, and the root bone's name."""
    common.clean_scene()
    common.import_model(path)
    scene = bpy.context.scene
    arm = next((o for o in scene.objects if o.type == "ARMATURE"), None)
    if arm is None:
        raise SystemExit(f"{path} has no armature")
    roots = [b for b in arm.data.bones if b.parent is None]
    if len(roots) != 1:
        raise SystemExit(f"{arm.name} has {len(roots)} root bones, expected one")
    meshes = common.meshes()
    arm.animation_data_create()
    result = {}
    for action in sorted(bpy.data.actions, key=lambda a: a.name):
        arm.animation_data.action = action
        if action.slots and getattr(arm.animation_data, "action_slot", None) is None:
            arm.animation_data.action_slot = action.slots[0]
        first, last = int(round(action.frame_range[0])), int(round(action.frame_range[1]))
        step = max(1, math.ceil((last - first) / 48))
        heights = []
        for frame in range(first, last + 1, step):
            scene.frame_set(frame)
            deps = bpy.context.evaluated_depsgraph_get()
            low = math.inf
            for mesh in meshes:
                posed = mesh.evaluated_get(deps)
                data = posed.to_mesh()
                co = np.empty(len(data.vertices) * 3)
                data.vertices.foreach_get("co", co)
                matrix = np.array(posed.matrix_world)
                low = min(low, float((co.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3])[:, 2].min()))
                posed.to_mesh_clear()
            heights.append(low)
        result[action.name] = np.array(heights)
    return result, roots[0].name


# ---- the GLB: only the position keys of the root bone are rewritten -----------------------------------------------------


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, _ = struct.unpack("<4sII", data[:12])
    if magic != b"glTF" or version != 2:
        raise SystemExit(f"{path} is not a GLB 2 file")
    json_length = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20 : 20 + json_length])
    bin_start = 20 + json_length
    bin_length = struct.unpack("<I", data[bin_start : bin_start + 4])[0]
    return gltf, data[20 : 20 + json_length], bytearray(data[bin_start + 8 : bin_start + 8 + bin_length])


def write_glb(path, gltf, json_bytes, binary):
    if json_bytes is None:
        json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes)
        f.write(struct.pack("<I4s", len(binary), b"BIN\0") + binary)


def lift_clips(gltf, binary, root_name, lifts):
    """Raise the root bone's position keys of the clips in `lifts` ({name: metres}); returns True if the JSON changed."""
    nodes = gltf["nodes"]
    root = next(i for i, n in enumerate(nodes) if n.get("name") == root_name)
    parent = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
    # the root's keys are in its parent's space: undo whatever scale and turn the parents have to move straight up
    chain = []
    node = parent.get(root)
    while node is not None:
        chain.append(nodes[node])
        node = parent.get(node)
    to_world = np.eye(3)
    for n in chain:  # nearest parent first
        r = np.eye(3)
        if "matrix" in n:
            r = np.array(n["matrix"]).reshape(4, 4).T[:3, :3]
        else:
            x, y, z, w = n.get("rotation", [0, 0, 0, 1])
            r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]) @ np.diag(n.get("scale", [1, 1, 1]))
        to_world = r @ to_world
    uses = {}
    for animation in gltf["animations"]:
        for sampler in animation["samplers"]:
            uses[sampler["output"]] = uses.get(sampler["output"], 0) + 1
    changed = False
    for animation in gltf["animations"]:
        if animation["name"] not in lifts:
            continue
        up = np.linalg.inv(to_world) @ np.array([0.0, lifts[animation["name"]], 0.0])
        channel = next((c for c in animation["channels"] if c["target"]["node"] == root and c["target"]["path"] == "translation"), None)
        if channel is None:
            raise SystemExit(f"{animation['name']} has no position keys for {root_name}, so it cannot be lifted")
        sampler = animation["samplers"][channel["sampler"]]
        if sampler.get("interpolation") == "CUBICSPLINE":
            raise SystemExit(f"{animation['name']}: cubic spline keys are not handled")
        accessor = gltf["accessors"][sampler["output"]]
        if uses[sampler["output"]] > 1:  # the same keys are shared with another clip or bone: this one gets a copy
            old = gltf["bufferViews"][accessor["bufferView"]]
            start = old.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            copy = bytes(binary[start : start + accessor["count"] * 12])
            binary.extend(b"\0" * (-len(binary) % 4))
            gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(copy)})
            binary.extend(copy)
            gltf["buffers"][0]["byteLength"] = len(binary)
            accessor = dict(accessor, bufferView=len(gltf["bufferViews"]) - 1)
            accessor.pop("byteOffset", None)
            gltf["accessors"].append(accessor)
            uses[sampler["output"]] -= 1
            sampler["output"] = len(gltf["accessors"]) - 1
            uses[sampler["output"]] = 1
            changed = True
        view = gltf["bufferViews"][accessor["bufferView"]]
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", 12)
        for key in range(accessor["count"]):
            at = start + key * stride
            values = np.array(struct.unpack_from("<3f", binary, at)) + up
            struct.pack_into("<3f", binary, at, *values)
        if "min" in accessor:
            accessor["min"] = [a + b for a, b in zip(accessor["min"], up)]
            accessor["max"] = [a + b for a, b in zip(accessor["max"], up)]
            changed = True
    return changed


# ---- go ---------------------------------------------------------------------------------------------------------------

before, root_name = measure(src)
if only:
    wanted = only.split(",")
    missing = [n for n in wanted if n not in before]
    if missing:
        raise SystemExit(f"{src} has no clips {missing}; it has {sorted(before)}")
    before = {n: h for n, h in before.items() if n in wanted}
if not before:
    raise SystemExit(f"{src} has no clips")
lifts = {}
for name, heights in before.items():
    if abs(heights.min()) < ON_THE_FLOOR:
        print(f"FLOOR {name}: already stands on the floor (lowest point {heights.min() * 100:+.1f} cm)")
    else:
        lifts[name] = -float(heights.min())
gltf, json_bytes, binary = read_glb(src)
if lifts and lift_clips(gltf, binary, root_name, lifts):
    json_bytes = None
write_glb(dst, gltf, json_bytes, binary)

if lifts:
    after, _ = measure(dst)
    for name, metres in lifts.items():
        a, h = before[name], after[name]
        print(
            f"LIFT {name}: lowest point {a.min() * 100:+.1f} cm (mean {a.mean() * 100:+.1f}) -> lifted {metres * 100:+.1f} cm"
            f" -> lowest {h.min() * 100:+.1f}, mean {h.mean() * 100:+.1f}, highest {h.max() * 100:+.1f} cm"
        )
print(f"GROUNDED {dst}: {len(before)} clips checked, {len(lifts)} lifted, {os.path.getsize(dst)} bytes")
