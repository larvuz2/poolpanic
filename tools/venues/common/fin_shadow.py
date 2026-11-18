"""The fin station's contact shadow on each dressed venue's deck (18 November 2026): every dressed venue's model had its own fin rack
baked at the plan's old station, and its deck's occlusion (`floor_ao.webp`) a soft shadow under it. Since the stations moved to every
pool's lower-left corner and became one shared station (scene/fin-station.mjs; the game cuts the old rack out of the model, dressed.mjs
BAKED_FIN_RACKS), this clears the old shadow (the deck there filled in from round it) and lays the station's own one where it
stands now (fin-station-floor-ao.png, baked under the station by fin_station.py), turned as the game turns the station.

    python3 tools/venues/common/fin_shadow.py          (once: a venue done says so in its JSON, `finStation`, and is left alone)
"""

import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ASSETS = os.path.join(REPO, "dist", "assets")
SHADOW = os.path.join(HERE, "fin-station-floor-ao.png")
SPAN_X, SPAN_Y = 4.0, 3.0  # (the shadow's picture: metres along the station's length and its depth, fin_station.py)
MARGIN = 0.45  # (metres round the old rack's box that its shadow reached)

# venue: (its folder and files, the box its old rack stood in (dressed.mjs BAKED_FIN_RACKS), the station's place now (spatial.mjs))
VENUES = {
    "resort": ("splash", "splash", (-12.6, 7.9, 0.5, 1.05), (-11.4, -11.0)),
    "lagoon": ("lagoon", "lagoon", (-12.6, 7.9, 0.5, 1.05), (-11.4, -11.0)),
    "arena": ("arena-club", "arena", (-12.6, 7.9, 0.5, 1.05), (-11.4, -11.0)),
    "aquatic": ("aquatic", "aquatic", (-12.6, 7.9, 0.5, 1.05), (-11.4, -11.0)),
    "disco": ("disco", "disco", (-11.4, 7.2, 0.5, 1.05), (-9.8, -11.0)),
    "kids": ("kids", "kids", (-10.3, 7.8, 0.5, 1.06), (-8.2, -11.0)),
    "senior": ("senior-club", "senior", (12.4, -5.6, 0.45, 1.06), (-9.8, -11.0)),
    "cruise": ("cruise-club", "cruise", (-13.4, -9.4, 0.47, 1.15), (-6.6, -11.0)),
}


# What else went from a venue's deck with the station's coming (dressed.mjs BAKED_CLEARANCE), its planter's shadow filled in too:
# Splash Park's and the Sunset Lagoon's palm in the corner by the station (its planter 0.68 m round).
CLEARED = {"resort": [(-14.7, -9.6, 0.75)], "lagoon": [(-14.7, -9.6, 0.75)]}


def fill_from_round(ao, r0, r1, c0, c1):
    """The deck inside rows r0..r1, columns c0..c1 made again from its border: the average of the two straight-line blends between
    the border's opposite sides (so a wall's or a neighbour's shade running through it carries on)."""
    top, bottom = ao[r0 - 1, c0:c1], ao[r1, c0:c1]
    left, right = ao[r0:r1, c0 - 1], ao[r0:r1, c1]
    rows, cols = r1 - r0, c1 - c0
    t = (np.arange(rows) + 1)[:, None] / (rows + 1)
    u = (np.arange(cols) + 1)[None, :] / (cols + 1)
    vertical = top[None, :] * (1 - t) + bottom[None, :] * t
    horizontal = left[:, None] * (1 - u) + right[:, None] * u
    ao[r0:r1, c0:c1] = (vertical + horizontal) / 2


def main():
    shadow = np.asarray(Image.open(SHADOW).convert("L"), dtype=np.float32) / 255
    # (the picture's columns run along the station's length (its model's x), its rows down its depth; the game turns the model a
    # quarter (FIN_STATION_ANGLE), its length along the world's z and its depth along x: rows of the deck's picture are z, columns x)
    turned = shadow[:, ::-1].T
    for vid, (folder, name, (bx, bz, bhx, bhz), (sx, sz)) in VENUES.items():
        jpath = os.path.join(ASSETS, folder, name + ".json")
        info = json.load(open(jpath))
        P = info["paint"]
        ipath = os.path.join(ASSETS, folder, "floor_ao.webp")
        ao = np.asarray(Image.open(ipath).convert("L"), dtype=np.float32) / 255
        ao = ao.copy()
        H, W = ao.shape
        ppm = W / P["span"]
        col = lambda x: (x - P["x0"]) * ppm
        row = lambda z: (z - P["z0"]) * ppm
        done = info.get("finStation")
        if done and done.get("cleared", []) == [list(c) for c in CLEARED.get(vid, [])]:
            print(vid, "done already")
            continue
        if done:
            # (only what was cleared since: its shadow filled in)
            for x, z, r in CLEARED.get(vid, []):
                q = r + MARGIN
                fill_from_round(ao, int(np.floor(row(z - q))), int(np.ceil(row(z + q))), int(np.floor(col(x - q))), int(np.ceil(col(x + q))))
            Image.fromarray((np.clip(ao, 0, 1) * 255 + 0.5).astype(np.uint8)).convert("RGB").save(ipath, "WEBP", quality=86, method=6)
            done["cleared"] = [list(c) for c in CLEARED.get(vid, [])]
            json.dump(info, open(jpath, "w"), indent=1)
            print(vid, "cleared", done["cleared"])
            continue
        # the old rack's shadow: gone, the deck filled in from round it
        r0, r1 = int(np.floor(row(bz - bhz - MARGIN))), int(np.ceil(row(bz + bhz + MARGIN)))
        c0, c1 = int(np.floor(col(bx - bhx - MARGIN))), int(np.ceil(col(bx + bhx + MARGIN)))
        before = float(ao[r0:r1, c0:c1].mean())
        fill_from_round(ao, r0, r1, c0, c1)
        for x, z, r in CLEARED.get(vid, []):
            q = r + MARGIN
            fill_from_round(ao, int(np.floor(row(z - q))), int(np.ceil(row(z + q))), int(np.floor(col(x - q))), int(np.ceil(col(x + q))))
        # the station's shadow where it stands
        rows, cols = int(round(SPAN_X * ppm)), int(round(SPAN_Y * ppm))
        patch = np.asarray(Image.fromarray((turned * 255).astype(np.uint8)).resize((cols, rows), Image.LANCZOS), dtype=np.float32) / 255
        pr0, pc0 = int(round(row(sz) - rows / 2)), int(round(col(sx) - cols / 2))
        ao[pr0 : pr0 + rows, pc0 : pc0 + cols] *= patch
        Image.fromarray((np.clip(ao, 0, 1) * 255 + 0.5).astype(np.uint8)).convert("RGB").save(ipath, "WEBP", quality=86, method=6)
        info["finStation"] = {
            "made": "tools/venues/common/fin_shadow.py",
            "cut": {"x": bx, "z": bz, "hx": bhx, "hz": bhz},
            "at": {"x": sx, "z": sz},
            "cleared": [list(c) for c in CLEARED.get(vid, [])],
        }
        json.dump(info, open(jpath, "w"), indent=1)
        print(f"{vid}: the old rack's shade ({before:.2f} on average) filled in; the station's laid at {sx}, {sz}")


if __name__ == "__main__":
    main()
