"""Fits one T-pose humanoid skeleton to another body: what to measure on a mesh, and where each joint goes.

Pure numpy, so it runs inside Blender (rig_from_template.py) and in plain Python. Everything here uses glTF axes in
metres: x to the character's left, y up, z forward, feet at y = 0, arms out along x (a T-pose).

How it works. The template (Coach Panic) is a mesh with a skeleton whose joint positions are known. Measure() finds a
few landmarks on any body: the neck, the crotch, the ankle, the line each arm lies on, and so on. calibrate() measures
the template and writes down where each of its joints sits relative to those landmarks (as ratios). fit() measures a new
body and puts every joint where the same ratios say it goes. The skeleton keeps its bone names, hierarchy and rest
orientations (rig_from_template.py), so animation made for the template plays on the new body."""
import numpy as np

# The Mixamo-style names of the template skeleton (Meshy's rig), parent first.
BONES = [
    ("Hips", None),
    ("LeftUpLeg", "Hips"), ("LeftLeg", "LeftUpLeg"), ("LeftFoot", "LeftLeg"), ("LeftToeBase", "LeftFoot"),
    ("RightUpLeg", "Hips"), ("RightLeg", "RightUpLeg"), ("RightFoot", "RightLeg"), ("RightToeBase", "RightFoot"),
    ("Spine02", "Hips"), ("Spine01", "Spine02"), ("Spine", "Spine01"),
    ("LeftShoulder", "Spine"), ("LeftArm", "LeftShoulder"), ("LeftForeArm", "LeftArm"), ("LeftHand", "LeftForeArm"),
    ("RightShoulder", "Spine"), ("RightArm", "RightShoulder"), ("RightForeArm", "RightArm"), ("RightHand", "RightForeArm"),
    ("neck", "Spine"), ("Head", "neck"), ("head_end", "Head"), ("headfront", "Head"),
]


def sample_surface(V, F, n=400000, seed=1):
    """n points spread evenly over the triangles (V: vertices, F: triangle indices). Smooth parts of a low-poly mesh have
    few vertices, so measuring on vertices alone is unreliable."""
    rng = np.random.default_rng(seed)
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    tri = rng.choice(len(F), size=n, p=area / area.sum())
    r1, r2 = rng.random(n), rng.random(n)
    s = np.sqrt(r1)
    return (1 - s)[:, None] * a[tri] + (s * (1 - r2))[:, None] * b[tri] + (s * r2)[:, None] * c[tri]


def _pct(a, lo, hi):
    return np.percentile(a, [lo, hi])


def _line_fit(P, x):
    """Least squares y(x), z(x) through points, rejecting the points far from the line (a hand, an armband)."""
    for _ in range(3):
        A = np.c_[np.ones_like(x), x]
        cy = np.linalg.lstsq(A, P[:, 1], rcond=None)[0]
        cz = np.linalg.lstsq(A, P[:, 2], rcond=None)[0]
        r = np.hypot(P[:, 1] - (cy[0] + cy[1] * x), P[:, 2] - (cz[0] + cz[1] * x))
        keep = r < 2.2 * np.median(r)
        P, x = P[keep], x[keep]
    return cy, cz, float(np.median(r[keep]))


def measure(S):
    """Landmarks of a T-pose body from its surface points S (N x 3)."""
    M = {}
    H = float(S[:, 1].max())
    xmax = float(np.abs(S[:, 0]).max())
    M["H"], M["xmax"] = H, xmax
    outer = S[np.abs(S[:, 0]) > 0.72 * xmax]
    y_out = float(np.median(outer[:, 1]))
    M["y_arm_out"] = y_out
    # each arm is a straight line: y = cy0 + cy1*|x|, z = cz0 + cz1*|x|, with a radius
    for side, sg in (("L", 1), ("R", -1)):
        m = (sg * S[:, 0] > 0.30 * xmax) & (sg * S[:, 0] < 0.97 * xmax) & (np.abs(S[:, 1] - y_out) < 0.08 * H)
        cy, cz, r = _line_fit(S[m], sg * S[m][:, 0])
        M["arm" + side] = (cy, cz)
        M["arm_r" + side] = r
    r_arm = (M["arm_rL"] + M["arm_rR"]) / 2
    M["arm_r"] = r_arm
    M["strip"] = 0.12 * xmax  # the central strip used to find the middle of the body, front to back
    # crotch: the top of the highest height where there is still a gap between the legs
    g = 0.005
    scan = np.arange(0.12 * H, 0.62 * H, 0.004 * H)
    gap = np.array([
        (np.abs(S[(S[:, 1] >= y) & (S[:, 1] < y + 0.004 * H)][:, 0]).min() > g) if np.any((S[:, 1] >= y) & (S[:, 1] < y + 0.004 * H)) else True
        for y in scan
    ])
    where = np.where(gap)[0]
    M["y_crotch"] = float(scan[where.max()] + 0.004 * H) if len(where) else 0.35 * H
    # neck: the narrowest central width between the arms and the widest part of the head
    clip = 0.45 * xmax
    ys = np.arange(y_out - 0.02 * H, H, 0.005 * H)
    w = []
    for y in ys:
        s = S[(S[:, 1] >= y) & (S[:, 1] < y + 0.005 * H) & (np.abs(S[:, 0]) < clip)]
        w.append(np.ptp(s[:, 0]) if len(s) > 20 else 0.0)
    w = np.array(w)
    plateau = w[ys < y_out + 0.06 * H].max()
    start = np.where((ys > y_out) & (w < 0.6 * plateau))[0]
    i0 = int(start[0]) if len(start) else 0
    peak = i0 + 2 + int(np.argmax(w[i0 + 2:])) if len(w) > i0 + 3 else i0
    seg = np.convolve(w[i0:peak + 1], np.ones(3) / 3, mode="same")
    M["y_neck"] = float(ys[i0 + 1 + int(np.argmin(seg[1:-1]))] + 0.0025 * H) if len(seg) > 3 else float(ys[i0])
    # ankle: where the foot's footprint has shrunk to that of the shin
    L = S[(S[:, 0] > 0.01) & (S[:, 1] < 0.40 * H)]
    ys3 = np.arange(0.02 * H, 0.22 * H, 0.005 * H)
    areas = []
    for y in ys3:
        s = L[(L[:, 1] >= y) & (L[:, 1] < y + 0.005 * H)]
        if len(s) < 30:
            areas.append(np.nan)
            continue
        x0, x1 = _pct(s[:, 0], 2, 98)
        z0, z1 = _pct(s[:, 2], 2, 98)
        areas.append((x1 - x0) * (z1 - z0))
    areas = np.array(areas)
    amin = np.nanmin(areas[ys3 > 0.03 * H])
    low = np.where((ys3 > 0.03 * H) & (areas < 1.25 * amin))[0]
    M["y_ankle_det"] = float(ys3[low[0]]) if len(low) else 0.07 * H
    # the foot (left): its length along z and where its middle is along x
    s = S[(S[:, 0] > 0.01) & (S[:, 1] < 0.025 * H)]
    M["foot_z"] = tuple(map(float, _pct(s[:, 2], 1, 99)))
    M["foot_x"] = float(np.mean(_pct(s[:, 0], 2, 98)))
    return M


def leg_center(S, H, y, side=1, half=0.01):
    """x and z of the middle of one leg at height y."""
    s = S[(side * S[:, 0] > 0.01) & (np.abs(S[:, 1] - y) < half * H)]
    x0, x1 = _pct(side * s[:, 0], 2, 98)
    z0, z1 = _pct(s[:, 2], 2, 98)
    return side * (x0 + x1) / 2, (z0 + z1) / 2


def torso_center_z(S, H, y, w, half=0.01):
    """The middle, front to back, of the body at height y (points within w of the middle line only)."""
    s = S[(np.abs(S[:, 1] - y) < half * H) & (np.abs(S[:, 0]) < w)]
    z0, z1 = _pct(s[:, 2], 2, 98)
    return (z0 + z1) / 2


def head_front_z(S, y_head):
    """How far forward the face reaches above the base of the head."""
    s = S[(S[:, 1] > y_head) & (np.abs(S[:, 0]) < 0.25)]
    return float(np.percentile(s[:, 2], 99.5))


def _arm_at(M, side, x):
    cy, cz = M["arm" + side]
    return cy[0] + cy[1] * x, cz[0] + cz[1] * x


def calibrate(S, joints):
    """Ratios that say where each template joint sits relative to the landmarks measured on the template's own body
    (S: its surface points; joints: {bone name: (x, y, z)} of its skeleton in the same axes)."""
    M = measure(S)
    H = M["H"]
    J = {k: np.array(v) for k, v in joints.items()}
    C = {"M": M}
    c = C
    c["head"] = (J["Head"][1] - M["y_neck"]) / (H - M["y_neck"])
    c["head_end"] = (H - J["head_end"][1]) / H
    span = M["y_neck"] - M["y_crotch"]
    c["hips"] = (J["Hips"][1] - M["y_crotch"]) / span
    c["upleg"] = (0.5 * (J["LeftUpLeg"][1] + J["RightUpLeg"][1]) - M["y_crotch"]) / span
    c["spine"] = [(J[n][1] - J["Hips"][1]) / (M["y_neck"] - J["Hips"][1]) for n in ("Spine02", "Spine01", "Spine")]
    c["ankle"] = 0.5 * (J["LeftFoot"][1] + J["RightFoot"][1]) / M["y_ankle_det"]
    c["knee"] = (J["LeftLeg"][1] - J["LeftFoot"][1]) / (J["LeftUpLeg"][1] - J["LeftFoot"][1])
    c["toe_y"] = J["LeftToeBase"][1] / J["LeftFoot"][1]
    z0, z1 = M["foot_z"]
    c["toe_z"] = (J["LeftToeBase"][2] - z0) / (z1 - z0)
    c["toe_x"] = J["LeftToeBase"][0] / M["foot_x"]
    c["upleg_x"] = J["LeftUpLeg"][0] / leg_center(S, H, M["y_crotch"] - 0.05 * H)[0]
    arm = J["LeftArm"][0]
    c["shoulder_x"] = arm / M["xmax"]
    c["wrist"] = (J["LeftHand"][0] - arm) / (M["xmax"] - arm)
    c["elbow"] = (J["LeftForeArm"][0] - arm) / (J["LeftHand"][0] - arm)
    c["clavicle_x"] = J["LeftShoulder"][0] / arm
    # depth of the spine and neck relative to the body's middle at that height
    c["dz"] = {}
    for n in ("Hips", "Spine02", "Spine01", "Spine", "neck", "Head"):
        c["dz"][n] = (J[n][2] - torso_center_z(S, H, J[n][1], M["strip"])) / H
    c["headfront_z"] = (J["headfront"][2] - J["Head"][2]) / H
    c["head_end_z"] = (J["head_end"][2] - J["Head"][2]) / H
    return C


def fit(S, C, over=None):
    """Joint positions {bone name: (x, y, z)} for the body S, from the template's ratios C. `over` replaces any measured
    landmark (for instance {"y_crotch": 0.70}) where the measurement is fooled, say by shorts that cover the thighs."""
    M = measure(S)
    if over:
        M.update(over)
    H = M["H"]
    J = {}
    top, neck, crotch = M["y_top"] if "y_top" in M else H, M["y_neck"], M["y_crotch"]
    span = neck - crotch
    y_ankle = C["ankle"] * M["y_ankle_det"]
    y_hips = crotch + C["hips"] * span
    y_up = crotch + C["upleg"] * span
    y_knee = y_ankle + C["knee"] * (y_up - y_ankle)
    # the spine and head, down the middle
    def mid(y):
        return torso_center_z(S, H, y, M["strip"])
    # the spine runs down the middle of the body's depth (the template's own small lean is not copied)
    J["Hips"] = (0.0, y_hips, mid(y_hips))
    for n, f in zip(("Spine02", "Spine01", "Spine"), C["spine"]):
        y = y_hips + f * (neck - y_hips)
        J[n] = (0.0, y, mid(y))
    J["neck"] = (0.0, neck, mid(neck))
    y_head = neck + C["head"] * (top - neck)
    J["Head"] = (0.0, y_head, mid(y_head))
    J["head_end"] = (0.0, top - C["head_end"] * H, J["Head"][2] + C["head_end_z"] * H)
    J["headfront"] = (0.0, y_head, J["Head"][2] + C["headfront_z"] * H)
    # arms
    for side, sg, nm in (("L", 1, "Left"), ("R", -1, "Right")):
        xs = C["shoulder_x"] * M["xmax"]
        xw = xs + C["wrist"] * (M["xmax"] - xs)
        xe = xs + C["elbow"] * (xw - xs)
        for bone, x in (("Arm", xs), ("ForeArm", xe), ("Hand", xw)):
            y, z = _arm_at(M, side, x)
            J[nm + bone] = (sg * x, y, z)
        y, z = _arm_at(M, side, xs)
        J[nm + "Shoulder"] = (sg * C["clavicle_x"] * xs, y, mid(y))
    # legs
    z0, z1 = M["foot_z"]
    for side, sg, nm in (("L", 1, "Left"), ("R", -1, "Right")):
        xu = leg_center(S, H, crotch - 0.05 * H, sg)[0] * C["upleg_x"]
        J[nm + "UpLeg"] = (xu, y_up, leg_center(S, H, y_up - 0.03 * H, sg)[1])
        xk, zk = leg_center(S, H, y_knee, sg)
        J[nm + "Leg"] = (xk, y_knee, zk)
        xa, za = leg_center(S, H, y_ankle + 0.02 * H, sg)
        J[nm + "Foot"] = (xa, y_ankle, za)
        J[nm + "ToeBase"] = (sg * abs(M["foot_x"]) * C["toe_x"], C["toe_y"] * y_ankle, z0 + C["toe_z"] * (z1 - z0))
    M["y_ankle"] = y_ankle
    return J, M
