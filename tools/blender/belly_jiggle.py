"""Write the belly's own motion into a character's clips: the stomach lags the body, bounces on every step and landing,
sways with the hips, and rises a little with every breath in the idles.
    python3 tools/blender/belly_jiggle.py in.glb out.glb [--only Walk,Run] [--oneshot Cannonball] [--gain 1.0]
(plain Python with numpy, no Blender). The character has the three belly bones of belly_bones.py (BellyUpper, BellyMid,
BellyLower). Every clip already plays on them, still: this tool works out where each part of the belly goes while the clip
plays and keys the bones' positions in every frame, so a clip carries its belly with it and nothing in the game has to
simulate it.
How. A belly is a mass on a spring: the part of the body it hangs from (the spine or the hips, as the clip moves them) is
the anchor, the belly's front follows it through a spring with damping, a little late and overshooting, so it lags when the
body starts, bounces when it lands and swings out when the hips turn. Each bone is one such spring per axis (the clip's own
axes: x left, y up, z forward), integrated in small steps through the clip; the pull toward the anchor is the spring's, and
only the anchor's speed is needed (a base excitation), so a clip's jerks (a hop's landing, a heel strike) become the bounce they
would be. A looping clip is run round for several loops and the last one is kept, so the belly's motion is in step with its
loop; a one-shot clip (`--oneshot`, a jump that does not repeat) starts at rest. How far the belly may go from the anchor is
limited softly (a few centimetres: the mesh's weights are made for that), and bigger springs belong to the lower, heavier
belly. The result is written as the bones' position keys, in the parent bone's own axes (the file's centimetres).
Every other key of the file stays as it was; running it again replaces what it wrote before."""
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import skinpose  # noqa: E402
from skinpose import Rig  # noqa: E402

FPS = 24
SUBSTEPS = 8
LOOPS = 10
# per belly bone: how far in front of the bone's head its front is (metres; the mass hangs there), the spring's natural
# frequency (Hz) and damping ratio for x (sideways), y (up) and z (forward), the share of the displacement kept
BELLY = {
    "BellyUpper": {"reach": 0.35, "hz": (3.0, 3.4, 3.0), "zeta": (0.22, 0.22, 0.22), "gain": 0.55},
    "BellyMid": {"reach": 0.40, "hz": (2.3, 2.6, 2.3), "zeta": (0.16, 0.16, 0.16), "gain": 0.9},
    "BellyLower": {"reach": 0.355, "hz": (2.0, 2.2, 2.0), "zeta": (0.14, 0.14, 0.14), "gain": 1.0},
}
# the idles breathe: frames per breath, and how far each belly bone rises and moves forward on the in-breath (metres)
BREATH = {"IdleScan": 48, "IdleScratch": 48}
BREATH_MOVE = {"BellyUpper": (0.003, 0.002), "BellyMid": (0.006, 0.004), "BellyLower": (0.0045, 0.003)}
LIMIT = np.array([0.025, 0.040, 0.030])  # metres: how far a belly may go from where it hangs, sideways, up and down, forward


def args_of(argv):
    options = {"--only": None, "--oneshot": [], "--gain": 1.0}
    rest = []
    i = 0
    while i < len(argv):
        if argv[i] in options:
            options[argv[i]] = float(argv[i + 1]) if argv[i] == "--gain" else argv[i + 1].split(",")
            i += 2
        else:
            rest.append(argv[i])
            i += 1
    return options, rest


def hermite(points, loops):
    """A cubic through the frame samples (n x 3): returns position(t) and velocity(t), t in frames."""
    n = len(points)

    def get(i):
        return points[i % n] if loops else points[min(max(i, 0), n - 1)]

    def tangent(i):
        return (get(i + 1) - get(i - 1)) / 2.0  # per frame

    def at(t):
        i = int(math.floor(t))
        u = t - i
        p0, p1, m0, m1 = get(i), get(i + 1), tangent(i), tangent(i + 1)
        h00, h10, h01, h11 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u, -2 * u**3 + 3 * u**2, u**3 - u**2
        d00, d10, d01, d11 = 6 * u**2 - 6 * u, 3 * u**2 - 4 * u + 1, -6 * u**2 + 6 * u, 3 * u**2 - 2 * u
        return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1, (d00 * p0 + d10 * m0 + d01 * p1 + d11 * m1) * FPS

    return at


def simulate(anchor, hz, zeta, loops):
    """The displacement (n x 3, metres) of a spring-held mass from its anchor (n x 3 samples, one per frame), per axis."""
    n = len(anchor)
    at = hermite(anchor, loops)
    omega = 2 * math.pi * np.asarray(hz)
    damp = 2 * np.asarray(zeta) * omega
    cycles = LOOPS if loops else 1
    dt = 1.0 / (FPS * SUBSTEPS)
    p0, v0 = at(0.0)
    x, v = p0.copy(), v0.copy()  # starts level with the anchor and moving with it
    out = np.zeros((n, 3))
    for c in range(cycles):
        for f in range(n):
            if c == cycles - 1:
                p, _ = at(float(f))
                out[f] = x - p
            for s in range(SUBSTEPS):
                p, pv = at(f + s / SUBSTEPS)
                a = -damp * (v - pv) - omega**2 * (x - p)
                v = v + a * dt
                x = x + v * dt
    return out


def soft_limit(u, gain):
    limit = LIMIT * gain
    return limit * np.tanh(u / limit)


def write_translation(doc, binary, clip_name, node, times_accessor, values):
    """Give `node` in clip `clip_name` position keys at the times of `times_accessor` (an Nx3 float array of values)."""
    animation = next(a for a in doc["animations"] if a["name"] == clip_name)
    channel = next(
        (c for c in animation["channels"] if c["target"]["node"] == node and c["target"]["path"] == "translation"), None
    )
    binary.extend(b"\0" * (-len(binary) % 4))
    offset = len(binary)
    for v in values:
        binary.extend(struct.pack("<3f", *[float(x) for x in v]))
    doc["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(values) * 12})
    doc["accessors"].append(
        {"bufferView": len(doc["bufferViews"]) - 1, "componentType": 5126, "count": len(values), "type": "VEC3"}
    )
    out = len(doc["accessors"]) - 1
    if channel is None:
        animation["samplers"].append({"input": times_accessor, "interpolation": "LINEAR", "output": out})
        animation["channels"].append(
            {"sampler": len(animation["samplers"]) - 1, "target": {"node": node, "path": "translation"}}
        )
    else:
        sampler = animation["samplers"][channel["sampler"]]
        sampler["input"], sampler["output"] = times_accessor, out
    doc["buffers"][0]["byteLength"] = len(binary)


def full_times_accessor(doc, clip_name, frames):
    """The accessor of the key times of a track of the clip with a key in every frame (a constant track has two)."""
    animation = next(a for a in doc["animations"] if a["name"] == clip_name)
    for c in animation["channels"]:
        sampler = animation["samplers"][c["sampler"]]
        if doc["accessors"][sampler["input"]]["count"] == frames + 1:
            return sampler["input"]
    raise SystemExit(f"{clip_name}: no track with a key in every frame to take the times from")


def write_glb(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(text), skinpose.CHUNK_JSON) + text)
        f.write(struct.pack("<II", len(binary), skinpose.CHUNK_BIN) + binary)


def main():
    options, rest = args_of(sys.argv[1:])
    if len(rest) != 2:
        raise SystemExit(__doc__)
    src, dst = rest
    rig = Rig(src)
    missing = [n for n in BELLY if n not in rig.by_name]
    if missing:
        raise SystemExit(f"{src} has no {', '.join(missing)}: add them with belly_bones.py first")
    doc, binary = rig.doc, bytearray(rig.binary)
    names = options["--only"] or sorted(rig.clips)
    gain = options["--gain"]
    world_rest = rig.world_matrices(rig.local(None, 0.0))
    for name in names:
        if name not in rig.clips:
            raise SystemExit(f"{src} has no clip {name}; it has {sorted(rig.clips)}")
        frames = int(round(rig.length(name) * FPS))
        loops = name not in options["--oneshot"]
        n = frames if loops else frames + 1  # a looping clip's last frame is its first again
        anchors = {b: [] for b in BELLY}
        parents = {b: rig.parent[rig.by_name[b]] for b in BELLY}
        for f in range(n):
            local = rig.local(name, f / FPS)
            for b in BELLY:
                local[rig.by_name[b]] = rig.rest_trs[rig.by_name[b]]  # the belly bone at rest: its own keys do not count
            world = rig.world_matrices(local)
            for b, spec in BELLY.items():
                node = rig.by_name[b]
                head = world[node][:3, 3]
                # the mass hangs at the belly's front: the bone's head, `reach` metres forward in the body's own frame
                forward = world[parents[b]][:3, :3] @ (np.linalg.inv(world_rest[parents[b]][:3, :3]) @ np.array([0.0, 0.0, 1.0]))
                anchors[b].append(head + forward / np.linalg.norm(forward) * spec["reach"])
        tracks, report = {}, []
        for b, spec in BELLY.items():
            u = simulate(np.array(anchors[b]), spec["hz"], spec["zeta"], loops)
            u = soft_limit(u, spec["gain"] * gain)
            if name in BREATH:
                phase = 2 * math.pi * np.arange(n) / BREATH[name]
                rise, out = BREATH_MOVE[b]
                u = u + np.c_[np.zeros(n), rise * np.sin(phase), out * np.sin(phase)]
            keys = []
            for f in range(n):
                local = rig.local(name, f / FPS)
                for bb in BELLY:
                    local[rig.by_name[bb]] = rig.rest_trs[rig.by_name[bb]]
                parent_world = rig.world_matrices(local)[parents[b]]
                keys.append(rig.rest_trs[rig.by_name[b]][0] + np.linalg.inv(parent_world[:3, :3]) @ u[f])
            if loops:
                keys.append(keys[0])  # the loop's closing key
            tracks[b] = np.array(keys)
            report.append(f"{b} up {u[:, 1].min() * 100:+.1f}..{u[:, 1].max() * 100:+.1f}, fwd {u[:, 2].min() * 100:+.1f}..{u[:, 2].max() * 100:+.1f}, side {u[:, 0].min() * 100:+.1f}..{u[:, 0].max() * 100:+.1f}")
        times = full_times_accessor(doc, name, frames)
        for b, values in tracks.items():
            write_translation(doc, binary, name, rig.by_name[b], times, values)
        print(f"JIGGLE {name:12s} {'loop' if loops else 'one shot'}: " + "; ".join(report) + " cm")
    write_glb(dst, doc, binary)
    print(f"JIGGLED {dst}: {len(names)} clips, {os.path.getsize(dst)} bytes")


if __name__ == "__main__":
    main()
