#!/usr/bin/env python3
"""Shrink the textures of a GLB for the game (plain Python and Pillow, no Blender).

    python3 tools/glb_shrink.py IN.glb OUT.glb [--size 512] [--quality 82]

Every embedded image is resized so its longer side is at most --size pixels and saved again as a JPEG (a PNG with transparency
stays a PNG); the meshes, materials and everything else are copied as they are. Made for the small props generated with Tripo
(the Kids Pool's toys, the mop and its bucket, 16 October 2026): their 2048-pixel textures are far more than a prop a metre tall
on the deck needs.
"""
import io
import json
import struct
import sys

from PIL import Image


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, _ = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF" and version == 2, "not a GLB 2.0 file"
    offset, doc, binary = 12, None, b""
    while offset < len(data):
        length, kind = struct.unpack_from("<I4s", data, offset)
        chunk = data[offset + 8 : offset + 8 + length]
        if kind == b"JSON":
            doc = json.loads(chunk)
        elif kind == b"BIN\0":
            binary = chunk
        offset += 8 + length
    return doc, binary


def write_glb(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    with open(path, "wb") as out:
        out.write(struct.pack("<4sII", b"glTF", 2, total))
        out.write(struct.pack("<I4s", len(text), b"JSON") + text)
        out.write(struct.pack("<I4s", len(binary), b"BIN\0") + binary)


def shrink(src, dst, size=512, quality=82):
    doc, binary = read_glb(src)
    views = doc["bufferViews"]
    images = {i.get("bufferView"): i for i in doc.get("images", []) if "bufferView" in i}
    # Rebuild the binary chunk view by view, with the images replaced.
    out, new_views = bytearray(), []
    for index, view in enumerate(views):
        start = view.get("byteOffset", 0)
        blob = binary[start : start + view["byteLength"]]
        if index in images:
            image = Image.open(io.BytesIO(blob))
            image.thumbnail((size, size), Image.LANCZOS)
            buffer = io.BytesIO()
            if image.mode in ("RGBA", "LA") and image.getextrema()[-1][0] < 255:
                image.save(buffer, "PNG", optimize=True)
                images[index]["mimeType"] = "image/png"
            else:
                image.convert("RGB").save(buffer, "JPEG", quality=quality, optimize=True)
                images[index]["mimeType"] = "image/jpeg"
            blob = buffer.getvalue()
        out += b"\0" * (-len(out) % 4)
        new_views.append({**view, "byteOffset": len(out), "byteLength": len(blob)})
        out += blob
    doc["bufferViews"] = new_views
    doc["buffers"] = [{"byteLength": len(out)}]
    write_glb(dst, doc, bytes(out))


if __name__ == "__main__":
    args = sys.argv[1:]
    size = int(args[args.index("--size") + 1]) if "--size" in args else 512
    quality = int(args[args.index("--quality") + 1]) if "--quality" in args else 82
    paths = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or not args[i - 1].startswith("--"))]
    shrink(paths[0], paths[1], size, quality)
