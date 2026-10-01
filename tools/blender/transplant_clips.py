"""Add clips of one GLB to a finished character on the same skeleton, and change nothing else in the file:
    python3 tools/blender/transplant_clips.py SOURCE.glb TARGET.glb OUT.glb --only Panic [--scale K]
(plain Python, no Blender). SOURCE is a GLB with the clips (Coach Panic's file, or what character_clips.py wrote), TARGET the
character that gets them. Like retarget_clips.py, a bone's rotation keys are copied by name, unchanged (both skeletons start
from the same rest orientations, so a rotation means the same on either), and the hips' travel is multiplied by K, the ratio
of the two hip heights unless --scale says otherwise, so a child hops lower and a giant higher. Unlike it, the file is not
read into Blender and written out again: the mesh, skin, textures and the other clips stay byte for byte what they were, and
the new clips are appended to the file's binary data. A clip the target already has is an error, not an overwrite (start from
the file without it). The clips go into the file in alphabetical order, like the exporter's.

glTF stores a bone's whole local translation, not an offset from its rest position, so a copied value would put the Coach's
joint positions on another body. What is carried over is each key's offset from the source bone's rest translation, scaled
by K and added to the target bone's own."""
import json
import math
import os
import struct
import sys

CHUNK_JSON, CHUNK_BIN = 0x4E4F534A, 0x004E4942
COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
FLOAT = 5126


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, _ = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise SystemExit(f"{path} is not a glTF 2 binary")
    doc, binary, offset = None, b"", 12
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        body = data[offset + 8 : offset + 8 + length]
        if kind == CHUNK_JSON:
            doc = json.loads(body.decode("utf-8"))
        elif kind == CHUNK_BIN:
            binary = body
        offset += 8 + length
    if doc is None:
        raise SystemExit(f"{path} has no JSON chunk")
    return doc, binary


def write_glb(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(text), CHUNK_JSON) + text)
        f.write(struct.pack("<II", len(binary), CHUNK_BIN) + binary)


def floats(doc, binary, index):
    """The tuples of floats in an accessor."""
    acc = doc["accessors"][index]
    if acc["componentType"] != FLOAT or "sparse" in acc:
        raise SystemExit(f"accessor {index} is not plain float data")
    view = doc["bufferViews"][acc["bufferView"]]
    n = COMPONENTS[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or n * 4
    return [struct.unpack_from(f"<{n}f", binary, start + i * stride) for i in range(acc["count"])]


def matrix(node):
    """A node's local transform as a row-major 4x4 (translation, rotation, scale)."""
    if "matrix" in node:
        m = node["matrix"]  # column-major in the file
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    tx, ty, tz = node.get("translation", [0, 0, 0])
    r = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    return [
        [r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx],
        [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty],
        [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz],
        [0, 0, 0, 1],
    ]


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def world_height(doc, index):
    """How high a node stands in the file's world (metres, y up)."""
    parents = {c: i for i, n in enumerate(doc["nodes"]) for c in n.get("children", [])}
    m = matrix(doc["nodes"][index])
    while index in parents:
        index = parents[index]
        m = multiply(matrix(doc["nodes"][index]), m)
    return m[1][3]


def by_name(doc):
    names = {}
    for i, node in enumerate(doc["nodes"]):
        if "name" in node:
            names[node["name"]] = i
    return names


def main():
    args = sys.argv[1:]
    only = scale = None
    rest = []
    i = 0
    while i < len(args):
        if args[i] == "--only":
            only, i = args[i + 1].split(","), i + 2
        elif args[i] == "--scale":
            scale, i = float(args[i + 1]), i + 2
        else:
            rest.append(args[i])
            i += 1
    if len(rest) != 3:
        raise SystemExit(__doc__)
    source_path, target_path, out_path = rest
    src, src_bin = read_glb(source_path)
    dst, dst_bin = read_glb(target_path)
    src_names, dst_names = by_name(src), by_name(dst)

    # the same skeleton: the same bones, and the same rest rotations (what makes a rotation mean the same thing)
    def joints(doc):
        return {doc["nodes"][j]["name"] for skin in doc["skins"] for j in skin["joints"]}

    src_joints, dst_joints = joints(src), joints(dst)
    if src_joints != dst_joints:
        raise SystemExit(f"The skeletons differ, so the clips do not fit: {sorted(src_joints ^ dst_joints)}")
    bones = sorted(src_joints)
    for name in bones:
        a = src["nodes"][src_names[name]].get("rotation", [0, 0, 0, 1])
        b = dst["nodes"][dst_names[name]].get("rotation", [0, 0, 0, 1])
        if 1 - abs(sum(p * q for p, q in zip(a, b))) > 1e-6:  # q and -q are the same rotation
            raise SystemExit(f"{name} rests differently on the two characters: this is not the same skeleton")

    if "Hips" not in bones:
        raise SystemExit("There is no Hips bone")
    k = scale if scale else world_height(dst, dst_names["Hips"]) / world_height(src, src_names["Hips"])

    clips = {a["name"]: a for a in src.get("animations", [])}
    wanted = only or sorted(clips)
    for name in wanted:
        if name not in clips:
            raise SystemExit(f"{source_path} has no clip {name}; it has {sorted(clips)}")
        if any(a["name"] == name for a in dst.get("animations", [])):
            raise SystemExit(f"{target_path} already has a clip {name}")

    binary = bytearray(dst_bin)

    def add_accessor(values, kind, bounds=False):
        n = COMPONENTS[kind]
        offset = len(binary)
        for v in values:
            binary.extend(struct.pack(f"<{n}f", *v))
        binary.extend(b"\0" * (-len(binary) % 4))
        dst["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(values) * n * 4})
        acc = {"bufferView": len(dst["bufferViews"]) - 1, "componentType": FLOAT, "count": len(values), "type": kind}
        if bounds:
            acc["min"] = [min(v[c] for v in values) for c in range(n)]
            acc["max"] = [max(v[c] for v in values) for c in range(n)]
        dst["accessors"].append(acc)
        return len(dst["accessors"]) - 1

    made = {}
    for name in wanted:
        clip = clips[name]
        inputs, samplers, channels = {}, [], []
        for ch in clip["channels"]:
            node_name = src["nodes"][ch["target"]["node"]]["name"]
            path = ch["target"]["path"]
            sampler = clip["samplers"][ch["sampler"]]
            if sampler["input"] not in inputs:
                times = floats(src, src_bin, sampler["input"])
                inputs[sampler["input"]] = add_accessor(times, "SCALAR", bounds=True)
            values = floats(src, src_bin, sampler["output"])
            if path == "translation":
                rest_s = src["nodes"][src_names[node_name]].get("translation", [0, 0, 0])
                rest_t = dst["nodes"][dst_names[node_name]].get("translation", [0, 0, 0])
                values = [tuple(rest_t[c] + k * (v[c] - rest_s[c]) for c in range(3)) for v in values]
            kind = "VEC4" if path == "rotation" else "VEC3"
            samplers.append(
                {
                    "input": inputs[sampler["input"]],
                    "interpolation": sampler.get("interpolation", "LINEAR"),
                    "output": add_accessor(values, kind),
                }
            )
            channels.append({"sampler": len(samplers) - 1, "target": {"node": dst_names[node_name], "path": path}})
        made[name] = {"name": name, "channels": channels, "samplers": samplers}
        if "extras" in clip:
            made[name]["extras"] = clip["extras"]
        print(f"CLIP {name}: {len(channels)} channels, hips travel x{k:.3f}")

    animations = dst.get("animations", []) + list(made.values())
    dst["animations"] = sorted(animations, key=lambda a: a["name"])
    dst["buffers"][0]["byteLength"] = len(binary)
    write_glb(out_path, dst, bytes(binary))
    print(f"TRANSPLANTED {out_path}: {len(made)} clip(s) on {len(bones)} bones, {os.path.getsize(out_path)} bytes")


if __name__ == "__main__":
    main()
