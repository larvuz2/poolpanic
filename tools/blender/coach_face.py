"""Give Coach Waters a face that can act: eyes, lids, pupils, brows and moustache on bones the game moves.
    python3 tools/blender/coach_face.py in.glb out.glb [--debug DIR]
(plain Python with numpy, PIL and OpenCV, no Blender: the file is read and written like carry_clips.py does, and the clips,
the body's mesh and its skin stay as they were). The Meshy model's face is painted: two big white eyes with a black dot each,
two black brows and a moustache, on one textured mesh. Paint cannot move, so this script adds what can:

  - new eyes: a smooth white ball over each painted eye, a little bigger, so the painted dots are hidden inside it;
  - pupils: a black disc on each ball, with a white glint, that a bone turns about the eye's centre (the gaze) and another
    scales (pinpoint in a fright, wide in relief);
  - lids: an upper and a lower lid for each eye, skin shells round the ball with a dark line on the edge, each turned by a
    bone about the eye's axis (a blink, a squint, a heavy half-closed eye). Open, they are tucked behind the face;
  - brows: two dark bars in front of the forehead where the painted ones were (which are painted out of the texture), each
    with a bone at its inner and its outer end, so a brow goes up and down, tilts (worry, anger) and squeezes;
  - the moustache: the model's own, weighted to two bones under the nose (StacheL and StacheR) so its ends can curl up, droop
    and quiver.
Everything new is one more primitive in the coach's mesh, with a material of its own (flat colours, no texture: COLOR_0),
and the bones are children of a `Face` bone under the head. `Face` undoes the head's rest rotation and the armature's 0.01
scale, so every face bone's frame is the model's own at rest (x to his left, y up, z forward, metres): a game or a viewer
moves them in those terms (dist/scene/coach-face.mjs). The numbers the game needs (eye centres and radii, the lids' rest
angles) are in the `Face` node's extras. No clip keys a face bone: the face is the game's to drive, over any clip.

Run it last, on a file that has every clip already (character_clips.py and ground_clips.py go through Blender, which would
not keep the face's frames); transplant_clips.py can still add clips afterwards. A file that has a face already is refused."""
import io
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import skinpose  # noqa: E402
from skinpose import Rig, accessor, matrix_quat  # noqa: E402

HEAD = "Head"
FACE = "Face"
SIDES = (("L", 1.0), ("R", -1.0))  # his left is +x (he faces +z)

EYE_GROW = 1.05  # the new eye's radius over the painted one's (whose facets reach 1.026 of it, and a few more at the edge)
EYE_CAP = 120.0  # degrees from the front that the new eye ball covers (the rest is inside the head)
LID_OUT = (1.05, 1.04)  # the upper and lower lids' radii over the eye's
LID_REST = (100.0, -100.0)  # elevation of each lid's edge at the front, degrees: open, tucked behind the face
LINE_WIDTH = 6.0  # degrees: the dark line on each lid's edge
PUPIL = 0.0155  # metres: the pupil's radius on the ball
GLINT = 0.0045
GLINT_AT = (-0.3, 0.4)  # where the glint sits on the pupil, in pupil radii (x on screen left, up): one light for both eyes
BROW_DEPTH = 0.014  # metres, front to back
BROW_GAP = 0.004  # in front of the forehead
BROW_HEIGHT = 0.024  # metres, at the brow's thickest (the painted ones are 3 cm: a little thinner, they have room to rise under the cap)
BROW_LOWER = 0.003  # metres the new brows sit below the painted ones' middle
STACHE_FALLOFF = 0.02  # metres: the skin round the moustache that follows it, fading
STACHE_HINGE = 0.03  # metres from the middle: where each half of the moustache turns

SKIN_COLOUR_BOX = dict(y=(1.36, 1.53), ax=(0.03, 0.2), z=0.08)


def option(args, name, default=None):
    return args[args.index(name) + 1] if name in args else default


def srgb_to_linear(c):
    c = np.asarray(c, dtype=float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def smoothstep(a, b, x):
    u = np.clip((np.asarray(x, dtype=float) - a) / (b - a), 0.0, 1.0)
    return u * u * (3 - 2 * u)


def rot_x(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


# ---- reading the painted face ------------------------------------------------------------------------------------------


class Painted:
    """The rest mesh, its texture and where on the body each texel of a triangle is."""

    def __init__(self, rig):
        doc, binary = rig.doc, rig.binary
        self.rig = rig
        _, self.V = rig.pose(None, 0.0)
        mesh_node = next(n for n in doc["nodes"] if "skin" in n and "mesh" in n)
        prim = doc["meshes"][mesh_node["mesh"]]["primitives"][0]
        self.uv = accessor(doc, binary, prim["attributes"]["TEXCOORD_0"]).astype(float)
        texture = doc["materials"][prim["material"]]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
        self.image_index = doc["textures"][texture]["source"]
        view = doc["bufferViews"][doc["images"][self.image_index]["bufferView"]]
        start = view.get("byteOffset", 0)
        from PIL import Image

        self.image = np.asarray(Image.open(io.BytesIO(binary[start : start + view["byteLength"]])).convert("RGB")).copy()
        self.H, self.W = self.image.shape[:2]
        self.T = rig.triangles
        self.centroids = self.V[self.T].mean(axis=1)

    def texels(self, triangles):
        """Every texel inside the given triangles in the texture: (rows, cols, 3D points) at the texel centres."""
        rows, cols, points = [], [], []
        for t in triangles:
            a, b, c = self.T[t]
            p = self.uv[[a, b, c]] * [self.W, self.H]
            lo = np.floor(p.min(axis=0)).astype(int)
            hi = np.ceil(p.max(axis=0)).astype(int)
            xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
            q = np.c_[xs.ravel() + 0.5, ys.ravel() + 0.5]
            m = np.array([[p[0, 0] - p[2, 0], p[1, 0] - p[2, 0]], [p[0, 1] - p[2, 1], p[1, 1] - p[2, 1]]])
            if abs(np.linalg.det(m)) < 1e-9:
                continue
            l12 = np.linalg.solve(m, (q - p[2]).T).T
            bary = np.c_[l12, 1 - l12.sum(axis=1)]
            inside = (bary >= -1e-6).all(axis=1)
            if not inside.any():
                continue
            bary = bary[inside]
            rows.append(np.clip(ys.ravel()[inside], 0, self.H - 1))
            cols.append(np.clip(xs.ravel()[inside], 0, self.W - 1))
            points.append(bary @ self.V[[a, b, c]])
        if not rows:
            return np.zeros(0, int), np.zeros(0, int), np.zeros((0, 3))
        return np.concatenate(rows), np.concatenate(cols), np.concatenate(points)

    def in_box(self, x=None, ax=None, y=None, z=None):
        c = self.centroids
        m = np.ones(len(c), bool)
        if x:
            m &= (c[:, 0] > x[0]) & (c[:, 0] < x[1])
        if ax:
            m &= (np.abs(c[:, 0]) > ax[0]) & (np.abs(c[:, 0]) < ax[1])
        if y:
            m &= (c[:, 1] > y[0]) & (c[:, 1] < y[1])
        if z is not None:
            m &= c[:, 2] > z
        return np.where(m)[0]


def fit_sphere(points):
    A = np.c_[2 * points, np.ones(len(points))]
    b = (points**2).sum(axis=1)
    sol = np.linalg.lstsq(A, b, rcond=None)[0]
    centre = sol[:3]
    return centre, float(math.sqrt(sol[3] + centre @ centre))


def measure(p):
    """The painted face: eyes (centre, radius, where the dot looks), brows (centreline and height along them), the
    moustache's vertices, and the colours."""
    img = p.image.astype(float)
    lum = img.mean(axis=2)
    out = {"eyes": {}, "brows": {}}
    whites, dots = [], []
    for side, sx in SIDES:
        tris = p.in_box(x=(0.0, 0.2) if sx > 0 else (-0.2, 0.0), y=(1.34, 1.56), z=0.06)
        rows, cols, pts = p.texels(tris)
        c = img[rows, cols]
        l = c.mean(axis=1)
        sat = c.max(axis=1) - c.min(axis=1)
        white = (l > 185) & (sat < 45)
        centre, r = fit_sphere(pts[white])
        if not 0.06 < r < 0.12:
            raise SystemExit(f"the {side} eye does not look like a ball (radius {r:.3f})")
        on_ball = np.abs(np.linalg.norm(pts - centre, axis=1) - r) < 0.012
        front = (pts[:, 2] - centre[2]) > 0.3 * r
        ahead = (pts - centre) / np.linalg.norm(pts - centre, axis=1, keepdims=True)
        dot = (l < 70) & on_ball & front & (sat < 60) & (ahead[:, 2] > 0.85)  # (the brows overlap the top of the ball)
        if dot.sum() < 4:
            raise SystemExit(f"no painted pupil found on the {side} eye")
        d = pts[dot] - centre
        d = d / np.linalg.norm(d, axis=1, keepdims=True)
        look = d.mean(axis=0)
        look /= np.linalg.norm(look)
        spread = float(np.degrees(np.arccos(np.clip(d @ look, -1, 1))).max())
        out["eyes"][side] = {"centre": centre, "r": r, "look": look, "dot_deg": spread}
        whites.append(c[white])
        dots.append(c[dot])
    # brows: dark brown texels on the forehead, above the eyes, below the cap
    tris = p.in_box(ax=(0.015, 0.2), y=(1.5, 1.6), z=0.07)
    rows, cols, pts = p.texels(tris)
    c = img[rows, cols]
    l = c.mean(axis=1)
    brown = (l < 85) & (c[:, 0] - c[:, 1] < 40)
    eyes = out["eyes"]
    for side, sx in SIDES:
        e = eyes[side]
        # not on an eye ball (the black dot) and not the hair at the sides
        off_ball = np.linalg.norm(pts - e["centre"], axis=1) > e["r"] * 1.01
        mine = brown & (np.sign(pts[:, 0]) == sx) & off_ball & (np.abs(pts[:, 0]) < 0.195)
        P = pts[mine]
        ax = np.abs(P[:, 0])
        edges = np.linspace(ax.min(), ax.max(), 9)
        line = []
        for a, b in zip(edges, edges[1:]):
            m = (ax >= a) & (ax <= b)
            if m.sum() < 3:
                continue
            ys = P[m, 1]
            lo, hi = np.percentile(ys, 5), np.percentile(ys, 95)
            line.append((sx * (a + b) / 2, (lo + hi) / 2, hi - lo))
        out["brows"][side] = {"line": np.array(line), "rows": rows[mine], "cols": cols[mine]}
    out["brow_colour"] = np.median(c[brown], axis=0)
    out["white_colour"] = np.median(np.concatenate(whites), axis=0)
    out["pupil_colour"] = np.median(np.concatenate(dots), axis=0)
    # skin round the eyes
    b = SKIN_COLOUR_BOX
    tris = p.in_box(ax=b["ax"], y=b["y"], z=b["z"])
    rows, cols, pts = p.texels(tris)
    c = img[rows, cols]
    red = c[:, 0] - c[:, 1]
    skin = (c.mean(axis=1) > 110) & (red > 30) & (red < 100)
    out["skin_colour"] = np.median(c[skin], axis=0)
    # the moustache: dark vertices under the nose
    V = p.V
    vc = img[np.clip((p.uv[:, 1] * p.H).astype(int), 0, p.H - 1), np.clip((p.uv[:, 0] * p.W).astype(int), 0, p.W - 1)]
    vl = vc.mean(axis=1)
    core = (V[:, 1] > 1.27) & (V[:, 1] < 1.41) & (np.abs(V[:, 0]) < 0.14) & (V[:, 2] > 0.1) & (vl < 95) & (vc[:, 0] - vc[:, 1] < 40)
    out["stache"] = np.where(core)[0]
    return out


# ---- the new geometry ----------------------------------------------------------------------------------------------------


class Builder:
    """Vertices (model space at rest), normals, colours (linear), one bone each or two blended, and triangles."""

    def __init__(self):
        self.P, self.N, self.C, self.J, self.Wt, self.T = [], [], [], [], [], []

    def add(self, P, N, colour, joints, weights, T):
        base = sum(len(p) for p in self.P)
        n = len(P)
        self.P.append(np.asarray(P, float))
        self.N.append(np.asarray(N, float))
        self.C.append(np.tile(colour, (n, 1)))
        self.J.append(np.asarray(joints, int).reshape(n, 4))
        self.Wt.append(np.asarray(weights, float).reshape(n, 4))
        self.T.append(np.asarray(T, int) + base)

    def arrays(self):
        return (np.concatenate(self.P), np.concatenate(self.N), np.concatenate(self.C), np.concatenate(self.J),
                np.concatenate(self.Wt), np.concatenate(self.T))


def cap_mesh(axis_from, half_angle, rings, segments, radius, centre, frame=np.eye(3), pole_cap=True):
    """A spherical cap round +z (in `frame`, rotated), from its pole out to `half_angle` degrees: (points, normals, triangles).
    `axis_from` is unused but kept for reading: the cap's own axis is the frame's z."""
    pts, nrm = [], []
    pts.append(frame @ np.array([0, 0, 1.0]))
    for i in range(1, rings + 1):
        theta = math.radians(half_angle) * i / rings
        for j in range(segments):
            phi = 2 * math.pi * j / segments
            pts.append(frame @ np.array([math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)]))
    pts = np.array(pts)
    tris = []
    for j in range(segments):
        tris.append((0, 1 + j, 1 + (j + 1) % segments))
    for i in range(1, rings):
        a, b = 1 + (i - 1) * segments, 1 + i * segments
        for j in range(segments):
            j2 = (j + 1) % segments
            tris.append((a + j, b + j, b + j2))
            tris.append((a + j, b + j2, a + j2))
    return centre + radius * pts, pts, np.array(tris)


def frame_z_to(direction):
    """A rotation that takes +z to `direction` (and keeps x as close to +x as it can)."""
    z = direction / np.linalg.norm(direction)
    x = np.array([1.0, 0, 0]) - z * z[0]
    if np.linalg.norm(x) < 1e-6:
        x = np.array([0, 1.0, 0]) - z * z[1]
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.c_[x, y, z]


def lid_mesh(radius, centre, elevation, upper, rings=8, segments=32):
    """A lid: half a sphere round the eye (round +y for the upper lid, -y for the lower), turned about x so its edge crosses
    the front of the eye at `elevation` degrees (90 is the top, -90 the bottom). Returns the shell and the dark line along
    its edge: two (points, normals, triangles)."""
    base = np.array([[1.0, 0, 0], [0, 0, 1.0], [0, -1.0, 0]]) if upper else np.array([[1.0, 0, 0], [0, 0, -1.0], [0, 1.0, 0]])
    # base: a frame whose z is +y (upper) or -y (lower); then turned about x by -elevation (see the docstring's maths)
    frame = rot_x(-elevation) @ base
    shell = cap_mesh(None, 90.0, rings, segments, radius, centre, frame)
    # the line: a band from the edge to LINE_WIDTH degrees in, a hair outside the shell, thinning to nothing at the corners
    # (where the edge meets the eye's sides); the half of it at the back is inside the head or behind the ball
    pts, nrm, tris = [], [], []
    for j in range(segments + 1):
        phi = 2 * math.pi * j / segments
        width = math.radians(LINE_WIDTH) * float(smoothstep(0.62, 0.85, abs(math.sin(phi))))  # none at the corners
        for theta in (math.pi / 2, math.pi / 2 - width):
            d = frame @ np.array([math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)])
            pts.append(centre + radius * 1.004 * d)
            nrm.append(d)
    for j in range(segments):
        a = 2 * j
        tris.append((a, a + 2, a + 3))
        tris.append((a, a + 3, a + 1))
    pts, nrm = np.array(pts), np.array(nrm)
    return shell, (pts, nrm, np.array(tris))


def brow_mesh(line, surface_z, sign):
    """A brow: a bar along the centreline `line` (x, y, height of the painted brow), inner end first, oval in section,
    thick at the inner end and tapering to a point at the outer one. Returns points, normals, triangles, how much of each
    vertex the outer end's bone has, and the two ends."""
    n = 16
    xs = np.linspace(line[0, 0], line[-1, 0], n)
    order = np.argsort(np.abs(line[:, 0]))
    lx, ly = np.abs(line[order, 0]), line[order, 1]
    ys = np.interp(np.abs(xs), lx, ly) - BROW_LOWER
    u = np.linspace(0, 1, n)
    shape = np.minimum(0.45 + 0.55 * smoothstep(0.0, 0.18, u), 1.0) * (1.0 - 0.8 * smoothstep(0.45, 1.0, u))
    hs = BROW_HEIGHT * shape
    ds = BROW_DEPTH * (0.6 + 0.4 * shape)
    zs = np.array([surface_z(x, y) for x, y in zip(xs, ys)])
    zs = np.convolve(np.pad(zs, 2, mode="edge"), np.ones(5) / 5, mode="valid")  # (not every facet of the forehead)
    zs = np.maximum(zs, [surface_z(x, y) for x, y in zip(xs, ys)]) + BROW_GAP + ds / 2
    m = 12
    pts, nrm = [], []
    for x, y, z, h, d in zip(xs, ys, zs, hs, ds):
        for k in range(m):
            a = 2 * math.pi * k / m
            f, v = math.cos(a), math.sin(a)  # front-back, up-down
            pts.append((x, y + 0.5 * h * v, z + 0.5 * d * f))
            g = np.array([0.0, v / max(h, 1e-6), f / max(d, 1e-6)])
            nrm.append(g / np.linalg.norm(g))
    tris = []
    for i in range(n - 1):
        for k in range(m):
            a, b = i * m + k, i * m + (k + 1) % m
            tris += [(a, a + m, b + m), (a, b + m, b)]
    for i, outward in ((0, -1.0), (n - 1, 1.0)):  # the two ends, closed
        centre_index = len(pts)
        pts.append((xs[i], ys[i], zs[i]))
        nrm.append((outward * np.sign(xs[i]), 0.0, 0.0))
        for k in range(m):
            a, b = i * m + k, i * m + (k + 1) % m
            tris.append((centre_index, a, b))
    pts, nrm = np.array(pts), np.array(nrm, dtype=float)
    weights_out = np.r_[np.repeat(smoothstep(0.0, 1.0, u), m), [0.0, 1.0]]
    return pts, nrm, np.array(tris), weights_out, (np.array([xs[0], ys[0], zs[0]]), np.array([xs[-1], ys[-1], zs[-1]]))


def paint_out_brows(p, found):
    """The texture with the painted brows turned into forehead skin (RGB, uint8)."""
    import cv2

    img = p.image.astype(float)
    H, W = img.shape[:2]
    forehead = np.zeros((H, W), np.uint8)
    rows, cols, _ = p.texels(p.in_box(ax=(0.0, 0.21), y=(1.48, 1.61), z=0.05))
    forehead[rows, cols] = 1
    forehead = cv2.dilate(forehead, np.ones((3, 3), np.uint8), iterations=2)  # (the texels a filter reads past the edge)
    brow = np.zeros((H, W), np.uint8)
    for side, _ in SIDES:
        brow[found["brows"][side]["rows"], found["brows"][side]["cols"]] = 1
    brow = cv2.dilate(brow, np.ones((3, 3), np.uint8), iterations=3)
    red = (img[:, :, 0] - img[:, :, 1] > 80) & (img[:, :, 0] > 100)
    white = (img.mean(axis=2) > 200) & (img.max(axis=2) - img.min(axis=2) < 45)
    mask = (brow > 0) & (forehead > 0) & ~red & ~white
    alpha = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.2)
    alpha = np.where(mask, 1.0, np.where((forehead > 0) & ~red & ~white, np.clip(alpha * 1.6, 0, 1), 0.0))[:, :, None]
    skin = found["skin_colour"].astype(float)
    out = img * (1 - alpha) + skin * alpha
    return np.clip(np.round(out), 0, 255).astype(np.uint8)


# ---- writing --------------------------------------------------------------------------------------------------------------


def write_glb(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(text) + 8 + len(binary)))
        f.write(struct.pack("<II", len(text), skinpose.CHUNK_JSON) + text)
        f.write(struct.pack("<II", len(binary), skinpose.CHUNK_BIN) + binary)


class Packer:
    """Appends typed arrays to the binary as new buffer views and accessors."""

    def __init__(self, doc, binary):
        self.doc, self.binary = doc, bytearray(binary)

    def view(self, data, target=None):
        self.binary.extend(b"\0" * (-len(self.binary) % 4))
        offset = len(self.binary)
        self.binary.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        self.doc["bufferViews"].append(view)
        return len(self.doc["bufferViews"]) - 1

    def accessor(self, array, kind, component, target=None, bounds=False, normalized=False):
        dtype = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[component]
        array = np.ascontiguousarray(np.asarray(array).astype(dtype))
        acc = {"bufferView": self.view(array.tobytes(), target), "componentType": component, "count": int(len(array)), "type": kind}
        if normalized:
            acc["normalized"] = True
        if bounds:
            flat = array.reshape(len(array), -1).astype(float)
            acc["min"], acc["max"] = [float(v) for v in flat.min(axis=0)], [float(v) for v in flat.max(axis=0)]
        self.doc["accessors"].append(acc)
        return len(self.doc["accessors"]) - 1

    def overwrite(self, index, array):
        """Write new values into an existing accessor, in place (same count and type, tightly packed)."""
        acc = self.doc["accessors"][index]
        view = self.doc["bufferViews"][acc["bufferView"]]
        dtype = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[acc["componentType"]]
        data = np.ascontiguousarray(np.asarray(array).astype(dtype)).tobytes()
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        assert not view.get("byteStride") or view["byteStride"] == len(data) // acc["count"], "a strided accessor"
        self.binary[start : start + len(data)] = data

    def replace_image(self, image_index, data):
        """Point the image at new bytes (the old ones go when the file is repacked)."""
        self.doc["images"][image_index]["bufferView"] = self.view(data)

    def repack(self):
        """Drop the accessors and buffer views nothing uses any more, and the bytes under them."""
        doc = self.doc
        used_acc = set()
        for mesh in doc["meshes"]:
            for prim in mesh["primitives"]:
                used_acc.update(prim["attributes"].values())
                if "indices" in prim:
                    used_acc.add(prim["indices"])
                for target in prim.get("targets", []):
                    used_acc.update(target.values())
        for skin in doc.get("skins", []):
            if "inverseBindMatrices" in skin:
                used_acc.add(skin["inverseBindMatrices"])
        for anim in doc.get("animations", []):
            for sampler in anim["samplers"]:
                used_acc.update((sampler["input"], sampler["output"]))
        acc_map = {old: new for new, old in enumerate(sorted(used_acc))}
        accessors = [doc["accessors"][old] for old in sorted(used_acc)]
        used_views = sorted({a["bufferView"] for a in accessors if "bufferView" in a} | {im["bufferView"] for im in doc.get("images", []) if "bufferView" in im})
        view_map, views, binary = {}, [], bytearray()
        for old in used_views:
            v = dict(doc["bufferViews"][old])
            start = v.get("byteOffset", 0)
            binary.extend(b"\0" * (-len(binary) % 4))
            v["byteOffset"] = len(binary)
            binary.extend(self.binary[start : start + v["byteLength"]])
            view_map[old] = len(views)
            views.append(v)
        for a in accessors:
            if "bufferView" in a:
                a["bufferView"] = view_map[a["bufferView"]]
        for im in doc.get("images", []):
            if "bufferView" in im:
                im["bufferView"] = view_map[im["bufferView"]]
        for mesh in doc["meshes"]:
            for prim in mesh["primitives"]:
                prim["attributes"] = {k: acc_map[v] for k, v in prim["attributes"].items()}
                if "indices" in prim:
                    prim["indices"] = acc_map[prim["indices"]]
                if "targets" in prim:
                    prim["targets"] = [{k: acc_map[v] for k, v in t.items()} for t in prim["targets"]]
        for skin in doc.get("skins", []):
            if "inverseBindMatrices" in skin:
                skin["inverseBindMatrices"] = acc_map[skin["inverseBindMatrices"]]
        for anim in doc.get("animations", []):
            for sampler in anim["samplers"]:
                sampler["input"], sampler["output"] = acc_map[sampler["input"]], acc_map[sampler["output"]]
        doc["accessors"], doc["bufferViews"] = accessors, views
        self.binary = binary
        doc["buffers"][0]["byteLength"] = len(binary)


# ---- the script -----------------------------------------------------------------------------------------------------------


def main(args):
    src, dst = args[0], args[1]
    debug = option(args, "--debug")
    rig = Rig(src)
    doc, binary = rig.doc, rig.binary
    if any(n.get("name") == FACE for n in doc["nodes"]):
        raise SystemExit(f"{src} has a face already: start from the file without one")
    p = Painted(rig)
    found = measure(p)
    V = p.V
    eyes = found["eyes"]

    # the head's rest frame: the face bone undoes it (rotation and scale)
    world = rig.world_matrices(rig.local(None, 0.0))
    head_node = rig.by_name[HEAD]
    Hw = world[head_node]
    s = float(np.cbrt(np.linalg.det(Hw[:3, :3])))
    R_head = Hw[:3, :3] / s
    assert np.allclose(R_head @ R_head.T, np.eye(3), atol=1e-5), "the head's rest frame is not a rotation and a scale"
    face_at = (eyes["L"]["centre"] + eyes["R"]["centre"]) / 2

    # ---- bones: (name, parent name, model-space position) ----
    bones = [(FACE, HEAD, face_at)]
    for side, _ in SIDES:
        e = eyes[side]
        R = e["r"] * EYE_GROW
        e["R"] = R
        bones += [
            ("Eye" + side, FACE, e["centre"]),
            ("Lid" + side, "Eye" + side, e["centre"]),
            ("LidLow" + side, "Eye" + side, e["centre"]),
            ("Look" + side, "Eye" + side, e["centre"]),
            ("Pupil" + side, "Look" + side, e["centre"] + e["look"] * R),
        ]

    # how far forward the face is at a point (for the brows): the front-most triangle over it, not the cap's brim (which
    # juts out above the brows), and the new eye balls
    head_joint = rig.index[HEAD]
    on_head = np.where(rig.dominant == head_joint)[0]
    front = p.in_box(ax=(0.0, 0.25), y=(1.45, 1.62), z=0.0)
    A, B, C = (V[p.T[front, k]] for k in range(3))

    def surface_z(x, y):
        v0, v1 = B[:, :2] - A[:, :2], C[:, :2] - A[:, :2]
        q = np.array([x, y]) - A[:, :2]
        den = v0[:, 0] * v1[:, 1] - v0[:, 1] * v1[:, 0]
        ok = np.abs(den) > 1e-12
        u = np.where(ok, (q[:, 0] * v1[:, 1] - q[:, 1] * v1[:, 0]) / np.where(ok, den, 1), -1)
        w = np.where(ok, (v0[:, 0] * q[:, 1] - v0[:, 1] * q[:, 0]) / np.where(ok, den, 1), -1)
        inside = (u >= 0) & (w >= 0) & (u + w <= 1)
        z = A[:, 2] + u * (B[:, 2] - A[:, 2]) + w * (C[:, 2] - A[:, 2])
        z = z[inside & (z < 0.19)]
        z = float(z.max()) if len(z) else 0.14
        for side, _ in SIDES:  # in front of the new eye balls too
            e = eyes[side]
            d2 = e["R"] ** 2 - (x - e["centre"][0]) ** 2 - (y - e["centre"][1]) ** 2
            if d2 > 0:
                z = max(z, e["centre"][2] + math.sqrt(d2))
        return z

    brow_meshes = {}
    for side, sx in SIDES:
        line = found["brows"][side]["line"]
        mesh = brow_mesh(line, surface_z, sx)
        brow_meshes[side] = mesh
        inner, outer = mesh[4]
        bones += [("BrowIn" + side, FACE, inner), ("BrowOut" + side, FACE, outer)]
    stache = found["stache"]
    S = V[stache]
    pivot = np.array([0.0, S[:, 1].max() - 0.012, float(np.percentile(S[:, 2], 70))])
    bones += [
        ("Stache", FACE, pivot),
        ("StacheL", "Stache", pivot + [STACHE_HINGE, 0, 0]),
        ("StacheR", "Stache", pivot - [STACHE_HINGE, 0, 0]),
    ]

    # ---- nodes and joints ----
    node_of = {}
    first_joint = len(rig.joint_nodes)
    for k, (name, parent, at) in enumerate(bones):
        if name == FACE:
            t = np.linalg.inv(Hw) @ np.r_[at, 1.0]
            node = {"name": name, "translation": [float(v) for v in t[:3]], "rotation": [float(v) for v in matrix_quat(R_head.T)],
                    "scale": [1 / s] * 3}
            parent_node = head_node
        else:
            offset = at - dict((b[0], b[2]) for b in bones)[parent]
            node = {"name": name, "translation": [float(v) for v in offset]}
            parent_node = node_of[parent]
        doc["nodes"].append(node)
        node_of[name] = len(doc["nodes"]) - 1
        doc["nodes"][parent_node].setdefault("children", []).append(node_of[name])
    joint_of = {name: first_joint + k for k, (name, _, _) in enumerate(bones)}
    skin = doc["skins"][0]
    skin["joints"] = list(skin["joints"]) + [node_of[b[0]] for b in bones]

    # inverse bind matrices: the old ones and inv(world at rest) of each new bone (whose world is a translation)
    ibm = [m for m in rig.inverse_bind]
    for name, _, at in bones:
        m = np.eye(4)
        m[:3, 3] = -at
        ibm.append(m)
    pack = Packer(doc, binary)
    ibm_flat = np.stack([m.T.reshape(16) for m in ibm])  # column-major
    skin["inverseBindMatrices"] = pack.accessor(ibm_flat, "MAT4", 5126)

    # ---- the new primitive ----
    white = srgb_to_linear(found["white_colour"] * 1.04)
    black = srgb_to_linear(found["pupil_colour"] * 0.6)
    glint = srgb_to_linear([250, 250, 250])
    skin_col = srgb_to_linear(found["skin_colour"])
    line_col = srgb_to_linear(found["brow_colour"] * 0.9)
    brow_col = srgb_to_linear(found["brow_colour"])
    one = lambda j, n: (np.tile([j, 0, 0, 0], (n, 1)), np.tile([1.0, 0, 0, 0], (n, 1)))  # noqa: E731
    b = Builder()
    for side, sx in SIDES:
        e = eyes[side]
        c, R = e["centre"], e["R"]
        P, N, T = cap_mesh(None, EYE_CAP, 12, 32, R, c, frame_z_to(np.array([0, 0, 1.0])))
        b.add(P, N, white, *one(joint_of["Eye" + side], len(P)), T)
        for upper, name, out, rest in ((True, "Lid", LID_OUT[0], LID_REST[0]), (False, "LidLow", LID_OUT[1], LID_REST[1])):
            shell, line = lid_mesh(R * out, c, rest, upper)
            b.add(shell[0], shell[1], skin_col, *one(joint_of[name + side], len(shell[0])), shell[2])
            b.add(line[0], line[1], line_col, *one(joint_of[name + side], len(line[0])), line[2])
        f = frame_z_to(e["look"])
        P, N, T = cap_mesh(None, math.degrees(math.asin(PUPIL / R)), 3, 24, R * 1.012, c, f)
        b.add(P, N, black, *one(joint_of["Pupil" + side], len(P)), T)
        g = f @ rot_y(math.degrees(GLINT_AT[0] * PUPIL / R)) @ rot_x(-math.degrees(GLINT_AT[1] * PUPIL / R))
        P, N, T = cap_mesh(None, math.degrees(math.asin(GLINT / R)), 2, 12, R * 1.016, c, g)
        b.add(P, N, glint, *one(joint_of["Pupil" + side], len(P)), T)
        P, N, T, w_out, _ = brow_meshes[side]
        joints = np.tile([joint_of["BrowIn" + side], joint_of["BrowOut" + side], 0, 0], (len(P), 1))
        weights = np.c_[1 - w_out, w_out, np.zeros(len(P)), np.zeros(len(P))]
        b.add(P, N, brow_col, joints, weights, T)
    P, N, C, J, Wt, T = b.arrays()
    N = N / np.linalg.norm(N, axis=1, keepdims=True)
    prim = {
        "attributes": {
            "POSITION": pack.accessor(P, "VEC3", 5126, 34962, bounds=True),
            "NORMAL": pack.accessor(N, "VEC3", 5126, 34962),
            "COLOR_0": pack.accessor(np.c_[np.round(np.clip(C, 0, 1) * 255), np.full(len(C), 255)], "VEC4", 5121, 34962, normalized=True),
            "JOINTS_0": pack.accessor(J, "VEC4", 5121 if J.max() < 256 else 5123, 34962),
            "WEIGHTS_0": pack.accessor(Wt, "VEC4", 5126, 34962),
        },
        "indices": pack.accessor(T.reshape(-1), "SCALAR", 5123, 34963),
        "material": len(doc["materials"]),
    }
    doc["materials"].append({
        "name": "CoachFace",
        "doubleSided": True,
        "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0.0, "roughnessFactor": 0.68},
    })
    mesh_node = next(n for n in doc["nodes"] if "skin" in n and "mesh" in n)
    body = doc["meshes"][mesh_node["mesh"]]["primitives"][0]
    doc["meshes"][mesh_node["mesh"]]["primitives"].append(prim)

    # ---- the moustache's weights, in the body's own skin ----
    dist = np.full(len(V), np.inf)
    from scipy.spatial import cKDTree

    dist[on_head] = cKDTree(S).query(V[on_head])[0]
    w_st = np.where(dist <= 1e-9, 1.0, 1.0 - smoothstep(0.0, STACHE_FALLOFF, dist))
    w_st[(V[:, 1] > 1.42) | (V[:, 2] < 0.08)] = 0.0
    w_st[stache] = 1.0
    ends = smoothstep(0.01, 0.065, np.abs(V[:, 0]))  # the ends curl; the middle stays with the moustache's own bone
    joints, weights = rig.joints.copy(), rig.weights.copy()
    touched = np.where(w_st > 1e-4)[0]
    for v in touched:
        jw = {int(j): float(w) * (1 - w_st[v]) for j, w in zip(joints[v], weights[v]) if w > 0}
        side = joint_of["StacheL"] if V[v, 0] > 0 else joint_of["StacheR"]
        jw[joint_of["Stache"]] = jw.get(joint_of["Stache"], 0) + w_st[v] * (1 - ends[v])
        jw[side] = jw.get(side, 0) + w_st[v] * ends[v]
        top = sorted(jw.items(), key=lambda kv: -kv[1])[:4]
        total = sum(w for _, w in top)
        top += [(0, 0.0)] * (4 - len(top))
        joints[v] = [j for j, _ in top]
        weights[v] = [w / total for _, w in top]
    joints_acc = doc["accessors"][body["attributes"]["JOINTS_0"]]
    if joints.max() > 255 and joints_acc["componentType"] == 5121:
        body["attributes"]["JOINTS_0"] = pack.accessor(joints, "VEC4", 5123, 34962)
    else:
        pack.overwrite(body["attributes"]["JOINTS_0"], joints)
    pack.overwrite(body["attributes"]["WEIGHTS_0"], weights)

    # ---- paint the brows out of the texture ----
    # The atlas is in many small islands, so nothing is smeared in from round about (an inpainting brought the cap's red
    # and the brows' own edges in): the brows' texels, a few texels more for their soft edges, become the forehead's
    # skin colour, faded in at the border, and only inside the forehead's own triangles.
    import cv2

    painted = paint_out_brows(p, found)
    ok, jpeg = cv2.imencode(".jpg", cv2.cvtColor(painted, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
    assert ok
    pack.replace_image(p.image_index, jpeg.tobytes())

    # ---- what the game needs ----
    face = doc["nodes"][node_of[FACE]]
    face["extras"] = {
        "eyes": {side: {"centre": [round(float(v), 5) for v in eyes[side]["centre"]], "radius": round(eyes[side]["R"], 5),
                        "look": [round(float(v), 4) for v in eyes[side]["look"]]} for side, _ in SIDES},
        "origin": [round(float(v), 5) for v in face_at],  # where the Face bone is, in the model: its children are offsets from it
        "lidRest": list(LID_REST),
        "pupil": PUPIL,
        "brows": {side: {"inner": [round(float(v), 5) for v in brow_meshes[side][4][0]],
                         "outer": [round(float(v), 5) for v in brow_meshes[side][4][1]]} for side, _ in SIDES},
        "stache": [round(float(v), 5) for v in pivot],
    }
    pack.repack()
    write_glb(dst, doc, pack.binary)
    print("FACE", len(bones), "bones;", len(P), "vertices,", len(T), "triangles;", len(touched), "moustache vertices weighted")
    for side, _ in SIDES:
        e = eyes[side]
        print(f"EYE {side} centre {np.round(e['centre'], 4)} r {e['r']:.4f} -> {e['R']:.4f} look {np.round(e['look'], 3)} dot {e['dot_deg']:.1f} deg")
        print(f"BROW {side}", np.round(found["brows"][side]["line"], 4).tolist())
    print("COLOURS white", found["white_colour"], "pupil", found["pupil_colour"], "skin", found["skin_colour"], "brow", found["brow_colour"])
    print("STACHE", len(stache), "core vertices, pivot", np.round(pivot, 4))
    print("WROTE", dst, os.path.getsize(dst), "bytes (was", os.path.getsize(src), ")")
    if debug:
        os.makedirs(debug, exist_ok=True)
        cv2.imwrite(os.path.join(debug, "texture.jpg"), cv2.cvtColor(painted, cv2.COLOR_RGB2BGR))


if __name__ == "__main__":
    main(sys.argv[1:])
