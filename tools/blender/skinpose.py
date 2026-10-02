"""Pose a skinned glTF/GLB character without Blender: read the file, play a clip at any time, skin the mesh (numpy).
    from skinpose import Rig
    rig = Rig("character.glb")
    world, verts = rig.pose("Walk", 0.5)        # the bones' world matrices (metres) and the posed vertices (N x 3)
The same maths as the game (three.js) and rig-check.mjs: a vertex goes to sum(weight * jointWorld * inverseBind * vertex),
the clip's tracks replace a node's local translation / rotation / scale, and a clip is sampled by linear interpolation
(spherical for rotations). `overrides` {bone name: 3x3 matrix} is turned into the bone's local rotation before the matrices
are built: tools that adjust a clip (clear_arms.py, belly_jiggle.py) use it to try a change before they write it."""
import json
import math
import struct

import numpy as np

CHUNK_JSON, CHUNK_BIN = 0x4E4F534A, 0x004E4942
COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
DTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}


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
    return doc, binary


def accessor(doc, binary, index):
    """The values of an accessor as an array (count x components), floats for normalised data."""
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    n = COMPONENTS[acc["type"]]
    dtype = np.dtype(DTYPES[acc["componentType"]])
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or n * dtype.itemsize
    if stride == n * dtype.itemsize:
        values = np.frombuffer(binary, dtype=dtype, count=acc["count"] * n, offset=start).reshape(acc["count"], n)
    else:
        values = np.stack(
            [np.frombuffer(binary, dtype=dtype, count=n, offset=start + i * stride) for i in range(acc["count"])]
        )
    if acc.get("normalized"):
        values = values.astype(np.float64) / np.iinfo(dtype).max
    return values


def quat_matrix(q):
    x, y, z, w = q
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )


def matrix_quat(m):
    """Unit quaternion (x, y, z, w) of a rotation matrix."""
    t = m[0, 0] + m[1, 1] + m[2, 2]
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        q = ((m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s)
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = (0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s)
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = ((m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s)
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = ((m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s)
    q = np.array(q)
    return q / np.linalg.norm(q)


def quat_multiply(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array(
        [
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz,
        ]
    )


def axis_angle_quat(axis, angle):
    axis = np.asarray(axis, dtype=float)
    axis = axis / np.linalg.norm(axis)
    s = math.sin(angle / 2)
    return np.array([axis[0] * s, axis[1] * s, axis[2] * s, math.cos(angle / 2)])


def slerp(a, b, u):
    d = float(np.dot(a, b))
    if d < 0:
        b, d = -b, -d
    if d > 0.9995:
        q = a + (b - a) * u
        return q / np.linalg.norm(q)
    theta = math.acos(min(1.0, d))
    return (a * math.sin((1 - u) * theta) + b * math.sin(u * theta)) / math.sin(theta)


def trs_matrix(t, q, s):
    m = np.eye(4)
    m[:3, :3] = quat_matrix(q) * np.asarray(s)[None, :]
    m[:3, 3] = t
    return m


def sample_track(times, values, t, rotation=False):
    """One channel at time t (clamped), linear keys; rotations slerped."""
    if t <= times[0]:
        return values[0]
    if t >= times[-1]:
        return values[-1]
    i = int(np.searchsorted(times, t, side="right")) - 1
    u = (t - times[i]) / (times[i + 1] - times[i])
    if rotation:
        return slerp(values[i], values[i + 1], u)
    return values[i] + (values[i + 1] - values[i]) * u


class Rig:
    def __init__(self, path):
        self.path = path
        doc, binary = read_glb(path)
        self.doc, self.binary = doc, binary
        nodes = doc["nodes"]
        self.nodes = nodes
        self.parent = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
        skin = doc["skins"][0]
        self.joint_nodes = list(skin["joints"])
        self.names = [nodes[j]["name"] for j in self.joint_nodes]
        self.index = {n: k for k, n in enumerate(self.names)}
        ibm = accessor(doc, binary, skin["inverseBindMatrices"]).astype(np.float64)
        self.inverse_bind = np.stack([m.reshape(4, 4).T for m in ibm])  # glTF is column-major
        mesh_node = next(n for n in nodes if "skin" in n and "mesh" in n)
        prim = doc["meshes"][mesh_node["mesh"]]["primitives"][0]
        self.rest = accessor(doc, binary, prim["attributes"]["POSITION"]).astype(np.float64)
        self.joints = accessor(doc, binary, prim["attributes"]["JOINTS_0"]).astype(np.int64)
        self.weights = accessor(doc, binary, prim["attributes"]["WEIGHTS_0"]).astype(np.float64)
        self.triangles = accessor(doc, binary, prim["indices"]).astype(np.int64).reshape(-1, 3)
        self.clips = self._read_clips()
        # the nodes whose matrices matter, from the roots down
        needed = set()
        for j in self.joint_nodes:
            n = j
            while n is not None:
                needed.add(n)
                n = self.parent.get(n)

        def depth(n):
            d = 0
            while n in self.parent:
                n, d = self.parent[n], d + 1
            return d

        self.order = sorted(needed, key=depth)
        self.rest_trs = {
            i: (
                np.array(nodes[i].get("translation", [0, 0, 0]), dtype=float),
                np.array(nodes[i].get("rotation", [0, 0, 0, 1]), dtype=float),
                np.array(nodes[i].get("scale", [1, 1, 1]), dtype=float),
            )
            for i in self.order
        }
        for i in self.order:  # a node given as a matrix is not handled: a rigged export uses TRS
            if "matrix" in nodes[i]:
                raise SystemExit(f"{path}: node {nodes[i].get('name')} is given as a matrix")
        self.by_name = {nodes[i].get("name"): i for i in self.order}
        self.one_hot = np.argmax(self.weights, axis=1)
        self.dominant = self.joints[np.arange(len(self.rest)), self.one_hot]  # joint index of the heaviest weight
        # vertices that sit at one position (a mesh with split vertices) share a normal
        keys = np.round(self.rest * 1e5).astype(np.int64)
        _, self.weld = np.unique(keys, axis=0, return_inverse=True)
        self.weld = self.weld.reshape(-1)

    def _read_clips(self):
        clips = {}
        for animation in self.doc.get("animations", []):
            tracks = {}
            for channel in animation["channels"]:
                sampler = animation["samplers"][channel["sampler"]]
                node = channel["target"]["node"]
                path = channel["target"]["path"]
                times = accessor(self.doc, self.binary, sampler["input"]).reshape(-1).astype(np.float64)
                values = accessor(self.doc, self.binary, sampler["output"]).astype(np.float64)
                tracks[(node, path)] = (times, values)
            clips[animation["name"]] = tracks
        return clips

    def length(self, clip):
        return max(t[0][-1] for t in self.clips[clip].values())

    def local(self, clip, t, rotations=None):
        """The local (translation, rotation, scale) of every needed node at time t of a clip (None: the rest pose).
        `rotations` {node: quaternion} replaces some nodes' rotations afterwards."""
        out = {}
        tracks = self.clips[clip] if clip else {}
        for i in self.order:
            tr, ro, sc = self.rest_trs[i]
            if (i, "translation") in tracks:
                tr = sample_track(*tracks[(i, "translation")], t)
            if (i, "rotation") in tracks:
                ro = sample_track(*tracks[(i, "rotation")], t, rotation=True)
            if (i, "scale") in tracks:
                sc = sample_track(*tracks[(i, "scale")], t)
            out[i] = (tr, ro, sc)
        if rotations:
            for i, q in rotations.items():
                out[i] = (out[i][0], q, out[i][2])
        return out

    def world_matrices(self, local):
        """4x4 world matrix of every node in `order`."""
        world = {}
        for i in self.order:
            m = trs_matrix(*local[i])
            p = self.parent.get(i)
            world[i] = world[p] @ m if p in world else m
        return world

    def skin_matrices(self, world):
        return np.stack([world[j] @ self.inverse_bind[k] for k, j in enumerate(self.joint_nodes)])

    def skin(self, matrices, subset=None):
        """Posed vertices (N x 3) for the given joint matrices; `subset` is an index array of the vertices wanted."""
        sel = slice(None) if subset is None else subset
        v = np.c_[self.rest[sel], np.ones(len(self.rest[sel]))]
        j, w = self.joints[sel], self.weights[sel]
        out = np.zeros((len(v), 3))
        for c in range(4):
            m = matrices[j[:, c]]  # (n, 4, 4)
            out += w[:, c : c + 1] * np.einsum("nij,nj->ni", m[:, :3, :], v)
        return out

    def pose(self, clip, t, rotations=None):
        world = self.world_matrices(self.local(clip, t, rotations))
        return world, self.skin(self.skin_matrices(world))

    def joint_position(self, world, name):
        return world[self.by_name[name]][:3, 3]

    def vertex_normals(self, verts):
        """Smooth normals of a posed mesh (welded: duplicated vertices share one)."""
        a, b, c = (verts[self.triangles[:, k]] for k in range(3))
        face = np.cross(b - a, c - a)  # area weighted
        acc = np.zeros((self.weld.max() + 1, 3))
        for k in range(3):
            np.add.at(acc, self.weld[self.triangles[:, k]], face)
        n = acc[self.weld]
        length = np.linalg.norm(n, axis=1, keepdims=True)
        return n / np.maximum(length, 1e-12)


# ---- the body as a volume ------------------------------------------------------------------------------------------------


def voxelize(verts, triangles, lo, size, shape):
    """Boolean grid, True inside a closed mesh: for every column along z, the crossings with the triangles are sorted and
    the stretches between the 1st and 2nd, 3rd and 4th ... are inside (parity). `lo` is the corner of voxel (0, 0, 0)
    (the grid's points are at lo + (i + 0.5) * size)."""
    nx, ny, nz = shape
    crossings = [[] for _ in range(nx * ny)]
    a, b, c = verts[triangles[:, 0]], verts[triangles[:, 1]], verts[triangles[:, 2]]
    for k in range(len(triangles)):
        p0, p1, p2 = a[k], b[k], c[k]
        # the triangle's footprint on the x-y grid
        x0 = int(math.floor((min(p0[0], p1[0], p2[0]) - lo[0]) / size - 0.5)) + 1
        x1 = int(math.floor((max(p0[0], p1[0], p2[0]) - lo[0]) / size - 0.5))
        y0 = int(math.floor((min(p0[1], p1[1], p2[1]) - lo[1]) / size - 0.5)) + 1
        y1 = int(math.floor((max(p0[1], p1[1], p2[1]) - lo[1]) / size - 0.5))
        if x1 < 0 or y1 < 0 or x0 >= nx or y0 >= ny or x0 > x1 or y0 > y1:
            continue
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, nx - 1), min(y1, ny - 1)
        d = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1])
        if abs(d) < 1e-14:
            continue
        gx = lo[0] + (np.arange(x0, x1 + 1) + 0.5) * size
        gy = lo[1] + (np.arange(y0, y1 + 1) + 0.5) * size
        X, Y = np.meshgrid(gx, gy, indexing="ij")
        l0 = ((p1[1] - p2[1]) * (X - p2[0]) + (p2[0] - p1[0]) * (Y - p2[1])) / d
        l1 = ((p2[1] - p0[1]) * (X - p2[0]) + (p0[0] - p2[0]) * (Y - p2[1])) / d
        l2 = 1 - l0 - l1
        # a point on an edge belongs to one side only (a half-open test), or a crossing would be counted twice
        eps = 1e-12
        inside = (l0 >= -eps) & (l1 >= -eps) & (l2 >= -eps) & ~((l0 < eps) & (l1 < eps)) & ~((l0 < eps) & (l2 < eps)) & ~((l1 < eps) & (l2 < eps))
        inside &= (l0 > 0) | (l1 > 0) | (l2 > 0)
        z = l0 * p0[2] + l1 * p1[2] + l2 * p2[2]
        for i, j in zip(*np.nonzero(inside)):
            crossings[(x0 + i) * ny + (y0 + j)].append(z[i, j])
    grid = np.zeros(shape, dtype=bool)
    zc = lo[2] + (np.arange(nz) + 0.5) * size
    for col, zs in enumerate(crossings):
        if len(zs) < 2:
            continue
        zs.sort()
        for m in range(0, len(zs) - 1, 2):
            grid[col // ny, col % ny, (zc >= zs[m]) & (zc < zs[m + 1])] = True
    return grid


class Volume:
    """What the torso occupies, as a cloud of points that moves with the skin.
    Built from the bind pose: the closed mesh is filled (parity along z), and the voxels that belong to the torso are kept:
    the inside of the body and a thin skin outside it, each with its signed distance to the body's surface (negative inside)
    and the skin weights of the nearest mesh vertex. A voxel belongs to a limb or to the head if the vertex nearest to it
    is carried mostly by that part's bones (the same rule that decides which bone moves a vertex), and to the torso if not;
    with `below` only what lies lower than that height (bind pose, metres) is kept. `at(matrices)` moves the cloud with a
    pose; `signed(tree, points)` is then how far a point is inside the torso (negative: the depth) or outside it (small
    positive), and a large value for a point that is nowhere near it."""

    PARTS = ("Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "ToeBase")  # (with Left / Right in front)
    HEAD = ("neck", "Head", "head_end", "headfront")

    def __init__(self, rig, size=0.012, skin=0.02, below=None):
        from scipy import ndimage
        from scipy.spatial import cKDTree

        self.rig = rig
        rest = rig.rest
        margin = skin + 3 * size
        lo = rest.min(axis=0) - margin
        hi = rest.max(axis=0) + margin
        shape = tuple(int(math.ceil(v)) for v in (hi - lo) / size)
        occ = voxelize(rest, rig.triangles, lo, size, shape)
        # signed distance to the surface (metres): positive outside
        sd = (ndimage.distance_transform_edt(~occ) - ndimage.distance_transform_edt(occ)) * size
        idx = np.argwhere(sd < skin)
        centres = lo + (idx + 0.5) * size
        sd = sd[tuple(idx.T)]
        _, nearest = cKDTree(rest).query(centres)
        apart = [rig.index[s + n] for s in ("Left", "Right") for n in self.PARTS if s + n in rig.index]
        apart += [rig.index[n] for n in self.HEAD if n in rig.index]
        mine = ~np.isin(rig.dominant[nearest], apart)
        if below is not None:  # only the part of the torso lower than this (bind pose height, metres)
            mine &= centres[:, 1] < below
        self.centres = centres[mine]
        self.sd = sd[mine]
        self.joints = rig.joints[nearest[mine]]
        self.weights = rig.weights[nearest[mine]]
        self.size = size

    def at(self, matrices):
        """The cloud's points in a pose (joint matrices as skin_matrices() makes them)."""
        v = np.c_[self.centres, np.ones(len(self.centres))]
        out = np.zeros((len(v), 3))
        for c in range(4):
            out += self.weights[:, c : c + 1] * np.einsum("nij,nj->ni", matrices[self.joints[:, c]][:, :3, :], v)
        return out

    def tree(self, matrices):
        from scipy.spatial import cKDTree

        return cKDTree(self.at(matrices))

    def signed(self, tree, points, far=1.0):
        """Signed distance (metres) of points to the posed torso's surface: negative inside (the depth), a little positive
        just outside, and `far` for a point that is not among the torso's voxels (a point has to have three of them within
        two voxels' reach, so a stray one does not count)."""
        d, i = tree.query(points, k=3)
        return np.where(d[:, 2] < 2.2 * self.size, np.median(self.sd[i], axis=1), far)
