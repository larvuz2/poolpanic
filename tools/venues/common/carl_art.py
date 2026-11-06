"""Cannonball Carl for the signs (6 November 2026, the creator: "the stickman… it's not good… a slippery man like falling off, but choose
Carl as the model… if you see other… stickman figurines replaced with actual characters, mostly Carl").

The pictures in carl/ are GPT Image 2.5 drawings made with renders of Carl's own model (dist/assets/carl.glb) as the reference: flat
cartoon poses with clean outlines and no background (slip, ice, run, dive, bomb, eat, shower, listen, lifejacket), three chalk sketches
for Senior Aqua Fit's board (chalk_flamingo, chalk_teapot, chalk_wave: white chalk on transparent) and the Harbourside's faded team
photo (team1974.jpg). The sign scripts paste them where a stick figure used to be:

    from carl_art import carl, paste_carl
    paste_carl(img, "slip", (x0, y0, x1, y1))      # fitted into the box, centred, keeping its shape
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "carl")


def carl(name):
    """One of Carl's pictures (RGBA; the team photo is RGB)."""
    for ext in (".png", ".jpg"):
        path = os.path.join(ART, name + ext)
        if os.path.exists(path):
            im = Image.open(path)
            return im.convert("RGBA") if ext == ".png" else im.convert("RGB")
    raise FileNotFoundError(name)


def fit(im, w, h):
    """The picture scaled to fit inside w × h, keeping its shape."""
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def paste_carl(img, name, box, anchor="centre", tint=None):
    """Paste Carl's picture `name` into `img` inside `box` (x0, y0, x1, y1), centred (or `anchor` "bottom": standing on the box's
    bottom). `tint`: a colour for a one-colour sketch (the chalk drawings)."""
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    pic = fit(carl(name), x1 - x0, y1 - y0)
    if tint is not None:
        solid = Image.new("RGBA", pic.size, tint)
        solid.putalpha(pic.split()[3])
        pic = solid
    x = x0 + (x1 - x0 - pic.width) // 2
    y = y1 - pic.height if anchor == "bottom" else y0 + (y1 - y0 - pic.height) // 2
    if img.mode == "RGBA" or pic.mode != "RGBA":
        img.paste(pic, (x, y), pic if pic.mode == "RGBA" else None)
    else:
        img.paste(pic, (x, y), pic)
    return (x, y, x + pic.width, y + pic.height)
